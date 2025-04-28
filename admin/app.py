import os
import json
import hashlib
import hmac
import time
import datetime
import uuid
import csv
import shutil
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, request, jsonify, session, send_from_directory, render_template, make_response
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_cors import CORS
import sqlite3
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image
import qrcode
from io import BytesIO
import base64

# Inicializace Flask aplikace
app = Flask(__name__, static_folder='static', static_url_path='')
csrf = CSRFProtect(app)
csrf.init_app(app)
@app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
@csrf.exempt
def api_csrf_exempt(path):
    # Tato funkce jen stanovuje pattern pro CSRF výjimky, ale není volána
    pass

CORS(app, 
     supports_credentials=True, 
     origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5000", "http://127.0.0.1:5000", 
              "http://localhost", "http://127.0.0.1"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-CSRFToken"],
     expose_headers=["Content-Type", "X-CSRFToken"])

# Konfigurace
app.config['SECRET_KEY'] = '55'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(days=30)
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = None
app.config['SESSION_COOKIE_DOMAIN'] = None 
app.config['WTF_CSRF_ENABLED'] = False
app.config['SESSION_COOKIE_PATH'] = '/'
app.config['INVOICES_FOLDER'] = 'faktury'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64 MB max upload

# Vytvoření potřebných složek, pokud neexistují
for folder in [app.config['INVOICES_FOLDER'], app.config['UPLOAD_FOLDER']]:
    if not os.path.exists(folder):
        os.makedirs(folder)

# Připojení k databázi SQLite
def get_db_connection():
    conn = sqlite3.connect('zentos.db')
    conn.row_factory = sqlite3.Row
    return conn

# Inicializace databáze
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Vytvoření tabulky uživatelů (admins)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Vytvoření tabulky produktů
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        type TEXT NOT NULL,
        variant TEXT NOT NULL,
        stock INTEGER DEFAULT 0,
        featured BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Vytvoření tabulky zákazníků
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        city TEXT,
        zip TEXT,
        country TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Vytvoření tabulky objednávek
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_id INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        shipping_method TEXT NOT NULL,
        shipping_price REAL NOT NULL,
        payment_method TEXT NOT NULL,
        payment_price REAL NOT NULL,
        total REAL NOT NULL,
        status TEXT NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    )
    ''')
    
    # Vytvoření tabulky položek objednávek
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        name TEXT NOT NULL,
        variant TEXT NOT NULL,
        price REAL NOT NULL,
        quantity INTEGER NOT NULL,
        total REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    )
    ''')
    
    # Vytvoření tabulky faktur
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        order_id INTEGER NOT NULL,
        customer_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (customer_id) REFERENCES customers (id)
    )
    ''')
    
    # Vytvoření tabulky nastavení
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Vytvoření výchozího admina
    default_admin_username = "5226"
    admin_exists_query = "SELECT id FROM admins WHERE username = ?"
    admin_exists = cursor.execute(admin_exists_query, (default_admin_username,)).fetchone()
    
    if not admin_exists:
        admin_password = "11259"
        password_hash = generate_password_hash(admin_password)
        
        insert_admin_query = '''
        INSERT INTO admins (username, password_hash, name, email)
        VALUES (?, ?, ?, ?)
        '''
        cursor.execute(insert_admin_query, (
            default_admin_username,
            password_hash,
            "Šimon Novák",
            "admin@sajrajt.cz"
        ))
        
        # Vložení výchozího nastavení
        default_settings = [
            ("shop_name", "Sajrajt.cz"),
            ("shop_email", "info@sajrajt.cz"),
            ("shop_phone", "+420 123 456 789"),
            ("shop_currency", "czk"),
            ("company_name", "Šimon Novák"),
            ("company_address", "Nedašov 11"),
            ("company_city", "Nedašov"),
            ("company_zip", "76333"),
            ("company_country", "Česká republika"),
            ("company_ico", "19930356"),
            ("company_dic", ""),
            ("bank_account", "123456789/0800"),
            ("invoice_prefix", "FV")
        ]
        
        for key, value in default_settings:
            cursor.execute('''
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ''', (key, value))
        
        # Vložení ukázkových produktů
        insert_product_query = '''
        INSERT INTO products (code, name, description, price, type, variant, stock, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        # Vložení základních produktů
        products_data = [
            ("RED50", "Kratom Red", "Kvalitní červený kratom", 150, "red", "50g", 100, 1),
            ("RED100", "Kratom Red", "Kvalitní červený kratom", 220, "red", "100g", 100, 0),
            ("RED200", "Kratom Red", "Kvalitní červený kratom", 400, "red", "200g", 100, 0),
            ("RED500", "Kratom Red", "Kvalitní červený kratom", 900, "red", "500g", 100, 0),
            ("RED1000", "Kratom Red", "Kvalitní červený kratom", 1700, "red", "1kg", 100, 0),
            
            ("WHITE50", "Kratom White", "Energický bílý kratom", 150, "white", "50g", 100, 0),
            ("WHITE100", "Kratom White", "Energický bílý kratom", 220, "white", "100g", 100, 1),
            ("WHITE200", "Kratom White", "Energický bílý kratom", 400, "white", "200g", 100, 0),
            ("WHITE500", "Kratom White", "Energický bílý kratom", 900, "white", "500g", 100, 0),
            ("WHITE1000", "Kratom White", "Energický bílý kratom", 1700, "white", "1kg", 100, 0),
            
            ("GREEN50", "Kratom Green", "Výjimečný zelený kratom", 150, "green", "50g", 100, 0),
            ("GREEN100", "Kratom Green", "Výjimečný zelený kratom", 220, "green", "100g", 100, 0),
            ("GREEN200", "Kratom Green", "Výjimečný zelený kratom", 400, "green", "200g", 100, 1),
            ("GREEN500", "Kratom Green", "Výjimečný zelený kratom", 900, "green", "500g", 100, 0),
            ("GREEN1000", "Kratom Green", "Výjimečný zelený kratom", 1700, "green", "1kg", 100, 0),
        ]
        
        for product in products_data:
            cursor.execute(insert_product_query, product)
    
    conn.commit()
    conn.close()

# Inicializace databáze při startu aplikace
with app.app_context():
    init_db()

# Získání nastavení
def get_settings():
    conn = get_db_connection()
    settings_rows = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    
    settings = {}
    for row in settings_rows:
        settings[row['key']] = row['value']
    
    return settings

# Firemní údaje pro faktury
def generate_invoice_pdf(invoice_number, order, customer):
    # Získání firemních údajů
    company_info = get_company_info()
    
    # Vytvoření čistě číselného variabilního symbolu z čísla objednávky
    var_symbol = ''.join([c for c in order['order_number'] if c.isdigit()])
    # Zkrácení variabilního symbolu
    short_vs = var_symbol[:8] + var_symbol[-2:] if len(var_symbol) > 10 else var_symbol
    
    # Sestavení cesty k souboru - použití zkráceného variabilního symbolu pro název souboru
    file_path = os.path.join(app.config['INVOICES_FOLDER'], f"FV{short_vs}.pdf")
    
    # Cesty k různým variantám Roboto fontů
    font_dir = "admin/font/static"
    font_variants = {
        'regular': 'Roboto_Condensed-Regular.ttf',
        'bold': 'Roboto_Condensed-Bold.ttf',
        'medium': 'Roboto_Condensed-Medium.ttf',
        'light': 'Roboto_Condensed-Light.ttf',
        'black': 'Roboto_Condensed-Black.ttf',
    }
    
    # Registrace fontů
    fonts_registered = True
    try:
        for variant, filename in font_variants.items():
            path = os.path.join(font_dir, filename)
            if os.path.exists(path):
                font_name = f"Roboto-{variant.capitalize()}"
                pdfmetrics.registerFont(TTFont(font_name, path))
            else:
                # Pokud nenajdeme cestu s admin/font/static, zkusíme relativní cestu font/static
                alt_path = os.path.join("font/static", filename)
                if os.path.exists(alt_path):
                    font_name = f"Roboto-{variant.capitalize()}"
                    pdfmetrics.registerFont(TTFont(font_name, alt_path))
                else:
                    fonts_registered = False
                    print(f"Font {filename} nebyl nalezen.")
    except Exception as e:
        fonts_registered = False
        print(f"Chyba při registraci fontů: {e}")
    
    # Vytvoření PDF
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Nastavení metadat PDF s použitím zkráceného variabilního symbolu jako čísla faktury
    invoice_title = f"FV{short_vs}"  # Formát: FV + zkrácený variabilní symbol
    p.setAuthor(company_info['name'])
    p.setTitle(invoice_title)
    p.setSubject(f"Faktura za objednávku {order['order_number']}")
    
    # Funkce pro bezpečné vykreslení českého textu s použitím správné varianty fontu
    def draw_czech_text(p, x, y, text, size=10, style='regular'):
        if fonts_registered:
            if style == 'bold':
                p.setFont("Roboto-Bold", size)
            elif style == 'medium':
                p.setFont("Roboto-Medium", size)
            elif style == 'light':
                p.setFont("Roboto-Light", size)
            elif style == 'black':
                p.setFont("Roboto-Black", size)
            else:
                p.setFont("Roboto-Regular", size)
        else:
            # Fallback na standardní fonty, pokud Roboto není k dispozici
            if style in ['bold', 'black']:
                p.setFont("Helvetica-Bold", size)
            else:
                p.setFont("Helvetica", size)
        
        p.drawString(x, y, text)
    
    # Konstanty pro nastavení pozic
    ITEMS_PER_PAGE_FIRST = 10  # Max. položek na první stránce
    ITEMS_PER_PAGE = 15        # Max. položek na dalších stránkách
    ITEM_HEIGHT = 20           # Výška jedné položky
    
    # PŘÍPRAVA DAT PRO STRÁNKOVÁNÍ
    
    # Získání všech produktů z objednávky
    all_items = []
    
    if order.get('items') and len(order['items']) > 0:
        for item in order['items']:
            product_text = f"{item['name']} {item['variant']} - {item['quantity']} ks"
            price_text = f"{item['total']:.2f} Kč".replace('.', ',')
            all_items.append({"text": product_text, "price": price_text, "type": "product"})
    else:
        # Fallback pro případ, že položky nejsou k dispozici
        product_text = f"realizace objednávky {order['order_number']}"
        price_text = f"{order['subtotal']:.2f} Kč".replace('.', ',')
        all_items.append({"text": product_text, "price": price_text, "type": "product"})
    
    # Doprava - vždy zobrazit, i s cenou 0
    if 'shipping_method' in order:
        shipping_method_texts = {
            'zasilkovna': 'Zásilkovna',
            'ppl': 'PPL',
            'express': 'Expresní doručení',
            'personal': 'Osobní odběr',
            'dpd': 'DPD',
            'cp': 'Česká pošta'
        }
        shipping_method_text = shipping_method_texts.get(order['shipping_method'], 'Doprava')
        shipping_text = f"Doprava - {shipping_method_text}"
        
        shipping_price_value = 0
        if 'shipping_price' in order:
            shipping_price_value = order['shipping_price']
            
        shipping_price = f"{shipping_price_value:.2f} Kč".replace('.', ',')
        all_items.append({"text": shipping_text, "price": shipping_price, "type": "shipping"})
    
    # Způsob platby - vždy zobrazit, i s cenou 0
    payment_method_text = "Převodem"  # Výchozí hodnota
    if 'payment_method' in order:
        payment_method_texts = {
            'card': 'Platba kartou',
            'bank': 'Bankovní převod',
            'cod': 'Dobírka',
            'cash': 'Hotově',
            'personal': 'Osobní odběr'
        }
        payment_method_text = payment_method_texts.get(order['payment_method'], 'Převodem')
    
    # Určení ceny platby - vždy zobrazit, i když je 0
    payment_price_value = 0
    if 'payment_price' in order:
        payment_price_value = order['payment_price']
    
    payment_text = f"Poplatek - {payment_method_text}"
    payment_price = f"{payment_price_value:.2f} Kč".replace('.', ',')
    all_items.append({"text": payment_text, "price": payment_price, "type": "payment"})
    
    # Výpočet počtu stránek
    if len(all_items) <= ITEMS_PER_PAGE_FIRST:
        total_pages = 1
    else:
        remaining_items = len(all_items) - ITEMS_PER_PAGE_FIRST
        additional_pages = (remaining_items + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE
        total_pages = 1 + additional_pages
    
    # PRVNÍ STRÁNKA
    
    # Nahrání loga s podporou průhlednosti
    logo_path = "logo.png"
    if os.path.exists(logo_path):
        p.drawImage(logo_path, 30, height - 80, width=60, height=60, preserveAspectRatio=True, mask='auto')
    else:
        # Fallback na text, pokud logo neexistuje
        if fonts_registered:
            p.setFont("Roboto-Black", 36)
        else:
            p.setFont("Helvetica-Bold", 36)
        p.drawString(40, height - 70, "Sajrajt.cz")
    
    # Číslo faktury - použijeme stejný formát jako v názvu souboru
    invoice_title = f"FV{short_vs}"  # Formát: FV + zkrácený variabilní symbol
    if fonts_registered:
        p.setFont("Roboto-Bold", 16)
    else:
        p.setFont("Helvetica-Bold", 16)
    p.drawString(width - 190, height - 40, invoice_title)
    
    # Přidáme číslo stránky, pokud je více stránek
    if total_pages > 1:
        p.drawString(width - 100, height - 60, f"Strana 1/{total_pages}")
    
    # Horní horizontální čára
    p.setStrokeColor(colors.black)
    p.line(40, height - 85, width - 50, height - 85)
    
    # Sekce Dodavatel
    draw_czech_text(p, 40, height - 105, "DODAVATEL", size=9, style='medium')
    draw_czech_text(p, 40, height - 125, company_info['name'], size=12, style='bold')
    draw_czech_text(p, 40, height - 140, company_info['address'], style='regular')
    draw_czech_text(p, 40, height - 155, f"{company_info['zip']} {company_info['city']}", style='regular')
    
    # IČO a neplátce DPH
    draw_czech_text(p, 40, height - 175, "IČO", style='bold')
    draw_czech_text(p, 180, height - 175, company_info['ico'], style='medium')
    draw_czech_text(p, 40, height - 190, "Neplátce DPH", style='bold')
    
    # Bankovní údaje
    draw_czech_text(p, 40, height - 210, "Bankovní účet", style='bold')
    draw_czech_text(p, 180, height - 210, company_info['bank_account'], style='medium')
    
    # Variabilní symbol
    draw_czech_text(p, 40, height - 225, "Variabilní symbol", style='bold')
    
    # Vytvoření čistě číselného variabilního symbolu z čísla objednávky
    var_symbol = ''.join([c for c in order['order_number'] if c.isdigit()])
    # Zkrácení variabilního symbolu
    short_vs = var_symbol[:8] + var_symbol[-2:] if len(var_symbol) > 10 else var_symbol
    draw_czech_text(p, 180, height - 225, short_vs, style='medium')
    
    # Způsob platby
    draw_czech_text(p, 40, height - 240, "Způsob platby", style='bold')
    draw_czech_text(p, 180, height - 240, payment_method_text, style='medium')
    
    # Sekce Odběratel
    draw_czech_text(p, 350, height - 105, "ODBĚRATEL", size=9, style='medium')
    draw_czech_text(p, 350, height - 125, customer['name'], size=12, style='bold')
    
    # Pouze pokud jsou informace k dispozici
    if customer.get('address'):
        draw_czech_text(p, 350, height - 140, customer['address'], style='regular')
    
    if customer.get('zip') and customer.get('city'):
        address_line = f"{customer['zip']} {customer['city']}"
        if customer.get('country') and customer['country'] != 'Česká republika':
            address_line += f" - {customer['country']}"
        else:
            address_line += " - CZ"
        draw_czech_text(p, 350, height - 155, address_line, style='regular')
    
    # Datum vystavení a splatnosti
    now = datetime.datetime.now()
    due_date = now + datetime.timedelta(days=10)
    
    draw_czech_text(p, 350, height - 190, "Datum vystavení", style='bold')
    draw_czech_text(p, 480, height - 190, now.strftime('%d. %m. %Y'), style='regular')
    
    draw_czech_text(p, 350, height - 205, "Datum splatnosti", style='bold')
    draw_czech_text(p, 480, height - 205, due_date.strftime('%d. %m. %Y'), style='regular')
    
    # Nadpisy sloupců pro položky
    items_start = height - 280
    draw_czech_text(p, 40, items_start, "POLOŽKY", size=9, style='medium')
    draw_czech_text(p, width - 105, items_start, "CENA", size=9, style='medium')
    p.setStrokeColor(colors.black)
    p.line(40, items_start - 10, width - 50, items_start - 10)
    
    # Vykreslení položek na první stránce
    y_position = items_start - 25
    shipping_payment_header_shown = False
    
    items_for_first_page = min(len(all_items), ITEMS_PER_PAGE_FIRST)
    
    for i in range(items_for_first_page):
        item = all_items[i]
        
        # Speciální hlavička pro dopravu a platbu
        if item['type'] in ['shipping', 'payment'] and not shipping_payment_header_shown:
            shipping_payment_header_shown = True
            
            # Oddělovací čára
            p.setStrokeColor(colors.lightgrey)
            p.line(40, y_position + 5, width - 50, y_position + 5)
            y_position -= 15
            
            # Nadpis sekce
            draw_czech_text(p, 40, y_position, "DOPRAVA A PLATBA", size=9, style='medium')
            y_position -= 20
        
        # Vykreslení položky
        draw_czech_text(p, 40, y_position, item['text'], style='medium')
        draw_czech_text(p, width - 105, y_position, item['price'], style='regular')
        y_position -= ITEM_HEIGHT
    
    # Pokud je jen jedna stránka, zobrazíme celkovou cenu a QR kód
    if total_pages == 1:
        # Určíme pozici pro souhrnnou sekci
        y_summary = max(y_position - 20, 150)  # Minimálně na pozici 150
        
        # Zobrazení slevy (pokud existuje)
        if 'discount' in order and order['discount'] > 0:
            # Oddělovací čára
            p.setStrokeColor(colors.black)
            p.line(40, y_summary, width - 50, y_summary)
            y_discount = y_summary - 25
            draw_czech_text(p, 40, y_discount, "Sleva", style='medium')
            draw_czech_text(p, width - 105, y_discount, f"-{order['discount']:.2f} Kč".replace('.', ','), style='medium')
            y_summary = y_discount - 20
        
        # Tlustší čára nad celkovou částkou k úhradě - použijeme dvojitou čáru
        p.setStrokeColor(colors.black)
        p.line(40, y_summary, width - 50, y_summary)
        p.line(40, y_summary - 2, width - 50, y_summary - 2)
        
        # Větší a výraznější text pro celkovou částku
        draw_czech_text(p, 40, y_summary - 25, "CELKEM K ÚHRADĚ:", size=14, style='bold')
        draw_czech_text(p, width - 115, y_summary - 25, f"{order['total']:.2f} Kč".replace('.', ','), size=14, style='bold')
        
        # QR kód
        iban = 'CZ6130300000003361960019'
        formattedAmount = f"{order['total']:.2f}"
        message = f"Objednávka číslo #{order['order_number']}"
        
        qr_data = f"SPD*1.0*ACC:{iban}*AM:{formattedAmount}*CC:CZK*MSG:{message}*X-VS:{short_vs}"
        
        qr = qrcode.make(qr_data, box_size=4)
        qr_img = BytesIO()
        qr.save(qr_img)
        qr_img.seek(0)
        
        qr_y = max(y_summary - 120, 60)  # Minimálně 60 od spodního okraje
        p.drawImage(ImageReader(qr_img), 40, qr_y, width=90, height=90)
        draw_czech_text(p, 40, qr_y - 10, "QR Platba", size=8, style='medium')
    
    # Patička stránky
    draw_czech_text(p, 40, 30, "Faktura vytvořena pomocí interního systému Zentos.", size=8, style='light')
    
    # DALŠÍ STRÁNKY
    if total_pages > 1:
        # Pokračujeme dalšími stránkami
        remaining_items = all_items[items_for_first_page:]
        
        for page in range(2, total_pages + 1):
            p.showPage()
            
            # Zjednodušená hlavička na dalších stránkách
            if os.path.exists(logo_path):
                p.drawImage(logo_path, 30, height - 80, width=60, height=60, preserveAspectRatio=True, mask='auto')
            else:
                if fonts_registered:
                    p.setFont("Roboto-Black", 36)
                else:
                    p.setFont("Helvetica-Bold", 36)
                p.drawString(40, height - 70, "Sajrajt.cz")
            
            if fonts_registered:
                p.setFont("Roboto-Bold", 16)
            else:
                p.setFont("Helvetica-Bold", 16)
            
            p.drawString(width - 190, height - 40, invoice_title)
            p.drawString(width - 100, height - 60, f"Strana {page}/{total_pages}")
            
            # Horizontální čára
            p.setStrokeColor(colors.black)
            p.line(40, height - 85, width - 50, height - 85)
            
            # Nadpisy sloupců pro položky
            items_start = height - 120
            draw_czech_text(p, 40, items_start, "POLOŽKY", size=9, style='medium')
            draw_czech_text(p, width - 105, items_start, "CENA", size=9, style='medium')
            p.setStrokeColor(colors.black)
            p.line(40, items_start - 10, width - 50, items_start - 10)
            
            # Vykreslení položek na další stránce
            y_position = items_start - 25
            
            # Zjištění, které položky patří na tuto stránku
            start_idx = (page - 2) * ITEMS_PER_PAGE
            end_idx = min(start_idx + ITEMS_PER_PAGE, len(remaining_items))
            items_for_this_page = remaining_items[start_idx:end_idx]
            
            # Kontrola, zda na této stránce máme položky dopravy/platby
            has_shipping_or_payment = any(item['type'] in ['shipping', 'payment'] for item in items_for_this_page)
            shipping_payment_header_shown_this_page = False
            
            for item in items_for_this_page:
                # Speciální hlavička pro dopravu a platbu
                if item['type'] in ['shipping', 'payment'] and not shipping_payment_header_shown_this_page and has_shipping_or_payment:
                    shipping_payment_header_shown_this_page = True
                    
                    # Oddělovací čára
                    p.setStrokeColor(colors.lightgrey)
                    p.line(40, y_position + 5, width - 50, y_position + 5)
                    y_position -= 15
                    
                    # Nadpis sekce
                    draw_czech_text(p, 40, y_position, "DOPRAVA A PLATBA", size=9, style='medium')
                    y_position -= 20
                
                # Vykreslení položky
                draw_czech_text(p, 40, y_position, item['text'], style='medium')
                draw_czech_text(p, width - 105, y_position, item['price'], style='regular')
                y_position -= ITEM_HEIGHT
            
            # Pokud je poslední stránka, zobrazíme celkovou cenu a QR kód
            if page == total_pages:
                # Určíme pozici pro souhrnnou sekci
                y_summary = max(y_position - 20, 150)  # Minimálně na pozici 150
                
                # Zobrazení slevy (pokud existuje)
                if 'discount' in order and order['discount'] > 0:
                    # Oddělovací čára
                    p.setStrokeColor(colors.black)
                    p.line(40, y_summary, width - 50, y_summary)
                    y_discount = y_summary - 25
                    draw_czech_text(p, 40, y_discount, "Sleva", style='medium')
                    draw_czech_text(p, width - 105, y_discount, f"-{order['discount']:.2f} Kč".replace('.', ','), style='medium')
                    y_summary = y_discount - 20
                
                # Tlustší čára nad celkovou částkou k úhradě - použijeme dvojitou čáru
                p.setStrokeColor(colors.black)
                p.line(40, y_summary, width - 50, y_summary)
                p.line(40, y_summary - 2, width - 50, y_summary - 2)
                
                # Větší a výraznější text pro celkovou částku
                draw_czech_text(p, 40, y_summary - 25, "CELKEM K ÚHRADĚ:", size=14, style='bold')
                draw_czech_text(p, width - 115, y_summary - 25, f"{order['total']:.2f} Kč".replace('.', ','), size=14, style='bold')
                
                # QR kód
                iban = 'CZ6130300000003361960019'
                formattedAmount = f"{order['total']:.2f}"
                message = f"Objednávka číslo #{order['order_number']}"
                
                qr_data = f"SPD*1.0*ACC:{iban}*AM:{formattedAmount}*CC:CZK*MSG:{message}*X-VS:{short_vs}"
                
                qr = qrcode.make(qr_data, box_size=4)
                qr_img = BytesIO()
                qr.save(qr_img)
                qr_img.seek(0)
                
                qr_y = max(y_summary - 120, 60)  # Minimálně 60 od spodního okraje
                p.drawImage(ImageReader(qr_img), 40, qr_y, width=90, height=90)
                draw_czech_text(p, 40, qr_y - 10, "QR Platba", size=8, style='medium')
            
            # Patička stránky
            draw_czech_text(p, 40, 30, "Faktura vytvořena pomocí interního systému Zentos.", size=8, style='light')
    
    # Uložení PDF
    p.save()
    
    # Převod BytesIO na skutečný soubor
    with open(file_path, 'wb') as f:
        f.write(buffer.getvalue())
    
    return file_path

def get_company_info():
    # Zkusíme nejprve získat info z nastavení v databázi
    conn = get_db_connection()
    settings = {}
    
    try:
        settings_rows = conn.execute('SELECT key, value FROM settings').fetchall()
        for row in settings_rows:
            settings[row['key']] = row['value']
    except:
        # Pokud tabulka settings neexistuje nebo nastane chyba
        pass
    
    conn.close()
    
    # Výchozí hodnoty, pokud nejsou v databázi
    company_info = {
        'name': settings.get('company_name', 'Šimon Novák'),
        'address': settings.get('company_address', 'Nedašov 11'),
        'city': settings.get('company_city', 'Nedašov'),
        'zip': settings.get('company_zip', '76333'),
        'country': settings.get('company_country', 'Česká republika'),
        'ico': settings.get('company_ico', '19930356'),
        'dic': settings.get('company_dic', ''),
        'phone': settings.get('shop_phone', '+420 732 189 053'),
        'email': settings.get('shop_email', 'info@sajrajt.cz'),
        'web': settings.get('shop_web', 'www.sajrajt.cz'),
        'bank_account': settings.get('bank_account', '3361960019/3030')
    }
    
    return company_info

# Pomocné funkce pro textové reprezentace
def get_payment_method_text(method):
    method_map = {
        'card': 'Online platba kartou',
        'bank': 'Bankovní převod',
        'cod': 'Dobírka'
    }
    return method_map.get(method, method)

def get_shipping_method_text(method):
    method_map = {
        'zasilkovna': 'Zásilkovna',
        'ppl': 'PPL',
        'express': 'Exkluzivní doručení',
        'personal': 'Osobní odběr'
    }
    return method_map.get(method, method)

# ===== API ENDPOINTY =====

# Ping endpoint pro kontrolu, zda API běží
@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'success', 'message': 'Zentos API is running'})

# ===== AUTENTIZACE =====
@csrf.exempt
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'status': 'error', 'message': 'Vyplňte prosím všechna pole'}), 400
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM admins WHERE username = ?', (username,)).fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        # Vyčistíme session a přidáme nové údaje
        session.clear()
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['name'] = user['name']
        session['timestamp'] = int(time.time())  # Pro ověření čerstvosti session
        session.permanent = True
        
        # Explicitní uložení session
        session.modified = True
        
        # Debug výpis na serveru
        print(f"Login successful. Session data: {session}")
        print(f"User ID in session: {session.get('user_id')}")
        
        # Nastavení odpovědi
        response = jsonify({
            'status': 'success',
            'message': 'Přihlášení úspěšné',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'name': user['name'],
                'email': user['email']
            }
        })
        
        return response
    
    return jsonify({'status': 'error', 'message': 'Nesprávné přihlašovací údaje'}), 401

@csrf.exempt
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'success', 'message': 'Odhlášení úspěšné'})

@csrf.exempt
@app.route('/api/session-check', methods=['GET'])
def session_check():
    print("Session check called")
    print("Session content:", session)
    print("user_id in session:", 'user_id' in session)
    
    # Ověřte, že session a cookies fungují
    if 'user_id' in session:
        # Zde přidáme další timestamp pro zajištění, že session není stará
        session['timestamp'] = int(time.time())
        session.modified = True
        
        # Pro jistotu výpis do konzole
        print("Session cookie domain:", app.config.get('SESSION_COOKIE_DOMAIN'))
        print("Session cookie samesite:", app.config.get('SESSION_COOKIE_SAMESITE'))
        
        return jsonify({
            'status': 'success',
            'authenticated': True,
            'user': {
                'id': session.get('user_id'),
                'username': session.get('username'),
                'name': session.get('name')
            }
        })
    return jsonify({'status': 'success', 'authenticated': False})

# Přidejte tuto funkci pro generování CSRF tokenu
@csrf.exempt
@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    csrf_token = generate_csrf()
    response = jsonify({'csrfToken': csrf_token})
    response.headers.set('X-CSRFToken', csrf_token)
    return response

# Vypněte CSRF ochranu pro API endpointy, které ji nepotřebují
@csrf.exempt
def csrf_exempt(view):
    return view

# ===== PRODUKTY =====
@app.route('/api/products', methods=['GET'])
def get_products():
    conn = get_db_connection()
    products = conn.execute('SELECT * FROM products ORDER BY name, variant').fetchall()
    conn.close()
    
    return jsonify({
        'status': 'success',
        'products': [dict(row) for row in products]
    })

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    conn = get_db_connection()
    product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
    conn.close()
    
    if product:
        return jsonify({
            'status': 'success',
            'product': dict(product)
        })
    
    return jsonify({'status': 'error', 'message': 'Produkt nenalezen'}), 404

@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.get_json()
    
    required_fields = ['name', 'price', 'type', 'variant', 'stock']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'Chybí povinné pole: {field}'
            }), 400
    
    conn = get_db_connection()
    try:
        code = data.get('code', f"{data['type'].upper()}{data['variant'].replace('g', '').replace('kg', '000')}")
        
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO products (code, name, description, price, type, variant, stock, featured)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            code,
            data['name'],
            data.get('description', ''),
            data['price'],
            data['type'],
            data['variant'],
            data['stock'],
            data.get('featured', 0)
        ))
        
        product_id = cursor.lastrowid
        conn.commit()
        
        # Načtení vytvořeného produktu
        product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Produkt byl úspěšně vytvořen',
            'product': dict(product)
        })
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Produkt s tímto kódem již existuje'
        }), 400
    except Exception as e:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při vytváření produktu: {str(e)}'
        }), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    data = request.get_json()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Kontrola, zda produkt existuje
        product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
        
        if not product:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Produkt nenalezen'
            }), 404
        
        # Aktualizace produktu
        cursor.execute('''
        UPDATE products
        SET name = ?, description = ?, price = ?, type = ?, variant = ?,
            stock = ?, featured = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (
            data.get('name', product['name']),
            data.get('description', product['description']),
            data.get('price', product['price']),
            data.get('type', product['type']),
            data.get('variant', product['variant']),
            data.get('stock', product['stock']),
            data.get('featured', product['featured']),
            product_id
        ))
        
        conn.commit()
        
        # Načtení aktualizovaného produktu
        updated_product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Produkt byl úspěšně aktualizován',
            'product': dict(updated_product)
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při aktualizaci produktu: {str(e)}'
        }), 500

@csrf.exempt
@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    conn = get_db_connection()
    
    try:
        # Kontrola, zda produkt existuje
        product = conn.execute('SELECT * FROM products WHERE id = ?', (product_id,)).fetchone()
        
        if not product:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Produkt nenalezen'
            }), 404
        
        # Kontrola, zda produkt není použit v objednávkách
        order_items = conn.execute('SELECT * FROM order_items WHERE product_id = ?', (product_id,)).fetchone()
        
        if order_items:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Produkt nelze smazat, protože je použit v objednávkách'
            }), 400
        
        # Smazání produktu
        conn.execute('DELETE FROM products WHERE id = ?', (product_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Produkt byl úspěšně smazán'
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při mazání produktu: {str(e)}'
        }), 500

# ===== ZÁKAZNÍCI =====
@app.route('/api/customers', methods=['GET'])
def get_customers():
    conn = get_db_connection()
    customers = conn.execute('SELECT * FROM customers ORDER BY name').fetchall()
    conn.close()
    
    # Přidání počtu objednávek a celkové útraty
    customers_with_stats = []
    
    for customer in customers:
        customer_dict = dict(customer)
        
        conn = get_db_connection()
        orders_count = conn.execute('SELECT COUNT(*) as count FROM orders WHERE customer_id = ?', 
                                    (customer['id'],)).fetchone()['count']
        
        total_spent = conn.execute('SELECT SUM(total) as total FROM orders WHERE customer_id = ?', 
                                  (customer['id'],)).fetchone()['total'] or 0
        conn.close()
        
        customer_dict['orders_count'] = orders_count
        customer_dict['total_spent'] = total_spent
        customers_with_stats.append(customer_dict)
    
    return jsonify({'status': 'success',
        'customers': customers_with_stats
    })

@app.route('/api/customers/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    conn = get_db_connection()
    customer = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
    
    if not customer:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Zákazník nenalezen'
        }), 404
    
    # Načtení objednávek zákazníka
    orders = conn.execute('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', 
                        (customer_id,)).fetchall()
    
    orders_list = []
    for order in orders:
        order_dict = dict(order)
        order_items = conn.execute('SELECT * FROM order_items WHERE order_id = ?', 
                                 (order['id'],)).fetchall()
        order_dict['items'] = [dict(item) for item in order_items]
        orders_list.append(order_dict)
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'customer': dict(customer),
        'orders': orders_list
    })

@app.route('/api/customers', methods=['POST'])
def create_customer():
    data = request.get_json()
    
    required_fields = ['name', 'email']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'Chybí povinné pole: {field}'
            }), 400
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO customers (name, email, phone, address, city, zip, country)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['name'],
            data['email'],
            data.get('phone', ''),
            data.get('address', ''),
            data.get('city', ''),
            data.get('zip', ''),
            data.get('country', '')
        ))
        
        customer_id = cursor.lastrowid
        conn.commit()
        
        # Načtení vytvořeného zákazníka
        customer = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Zákazník byl úspěšně vytvořen',
            'customer': dict(customer)
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při vytváření zákazníka: {str(e)}'
        }), 500

@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    data = request.get_json()
    
    conn = get_db_connection()
    
    try:
        # Kontrola, zda zákazník existuje
        customer = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
        
        if not customer:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Zákazník nenalezen'
            }), 404
        
        # Aktualizace zákazníka
        conn.execute('''
        UPDATE customers
        SET name = ?, email = ?, phone = ?, address = ?, city = ?, zip = ?, country = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (
            data.get('name', customer['name']),
            data.get('email', customer['email']),
            data.get('phone', customer['phone']),
            data.get('address', customer['address']),
            data.get('city', customer['city']),
            data.get('zip', customer['zip']),
            data.get('country', customer['country']),
            customer_id
        ))
        
        conn.commit()
        
        # Načtení aktualizovaného zákazníka
        updated_customer = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Zákazník byl úspěšně aktualizován',
            'customer': dict(updated_customer)
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při aktualizaci zákazníka: {str(e)}'
        }), 500

@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    conn = get_db_connection()
    
    try:
        # Kontrola, zda zákazník existuje
        customer = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
        
        if not customer:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Zákazník nenalezen'
            }), 404
        
        # Kontrola, zda zákazník nemá objednávky
        orders = conn.execute('SELECT * FROM orders WHERE customer_id = ?', (customer_id,)).fetchone()
        
        if orders:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Zákazníka nelze smazat, protože má objednávky'
            }), 400
        
        # Smazání zákazníka
        conn.execute('DELETE FROM customers WHERE id = ?', (customer_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Zákazník byl úspěšně smazán'
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při mazání zákazníka: {str(e)}'
        }), 500

# ===== OBJEDNÁVKY =====
@app.route('/api/orders', methods=['GET'])
def get_orders():
    # Parametry pro filtrování
    status = request.args.get('status')
    sort_by = request.args.get('sort_by', 'newest')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    # Inicializace s prázdným seznamem
    orders_with_items = []
    
    # Kontrola session
    if 'user_id' not in session:
        print("Session check fail: user_id not in session")
        print("Session data:", session)
        return jsonify({
            'status': 'error',
            'message': 'Nepřihlášený uživatel'
        }), 401
    
    try:
        conn = get_db_connection()
        
        # Základní query
        query = '''
        SELECT o.*, c.name AS customer_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE 1=1
        '''
        params = []
        
        # Přidání filtrů
        if status and status != 'all':
            query += ' AND o.status = ?'
            params.append(status)
        
        if date_from:
            query += ' AND o.created_at >= ?'
            params.append(date_from)
        
        if date_to:
            query += ' AND o.created_at <= ?'
            params.append(date_to + ' 23:59:59')
        
        # Přidání řazení
        if sort_by == 'newest':
            query += ' ORDER BY o.created_at DESC'
        elif sort_by == 'oldest':
            query += ' ORDER BY o.created_at ASC'
        elif sort_by == 'price-high':
            query += ' ORDER BY o.total DESC'
        elif sort_by == 'price-low':
            query += ' ORDER BY o.total ASC'
        
        orders = conn.execute(query, params).fetchall()
        
        # Načtení položek pro každou objednávku
        for order in orders:
            order_dict = dict(order)
            
            # Získání položek objednávky
            items = conn.execute('''
            SELECT * FROM order_items WHERE order_id = ?
            ''', (order['id'],)).fetchall()
            
            order_dict['items'] = [dict(item) for item in items]
            orders_with_items.append(order_dict)
        
        conn.close()
        
        # Obnovení session
        session.modified = True
        
        return jsonify({
            'status': 'success',
            'orders': orders_with_items
        })
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při získávání objednávek: {str(e)}'
        }), 500

@app.route('/api/orders/<string:order_number>', methods=['GET'])
def get_order(order_number):
    conn = get_db_connection()
    
    # Upravený dotaz pro získání objednávky včetně admin_note
    order = conn.execute('''
    SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           c.address AS customer_address, c.city AS customer_city, c.zip AS customer_zip,
           c.country AS customer_country
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.order_number = ?
    ''', (order_number,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Objednávka nenalezena'
        }), 404
    
    order_dict = dict(order)
    
    # Načtení položek objednávky
    items = conn.execute('''
    SELECT * FROM order_items WHERE order_id = ?
    ''', (order['id'],)).fetchall()
    
    order_dict['items'] = [dict(item) for item in items]
    
    # Načtení faktury, pokud existuje
    invoice = conn.execute('''
    SELECT * FROM invoices WHERE order_id = ?
    ''', (order['id'],)).fetchone()
    
    if invoice:
        order_dict['invoice'] = dict(invoice)
    
    # Načtení metadat objednávky
    metadata_rows = conn.execute('''
    SELECT key, value FROM order_metadata WHERE order_id = ?
    ''', (order['id'],)).fetchall()
    
    metadata = {}
    for row in metadata_rows:
        # Zkusíme konvertovat hodnoty na boolean, pokud je to možné
        if row['value'].lower() in ('true', 'false'):
            metadata[row['key']] = row['value'].lower() == 'true'
        else:
            metadata[row['key']] = row['value']
    
    order_dict['metadata'] = metadata
    
    # Načtení informací o odměně
    reward = conn.execute('''
    SELECT level, name, threshold FROM order_rewards WHERE order_id = ?
    ''', (order['id'],)).fetchone()
    
    if reward:
        order_dict['reward'] = dict(reward)
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'order': order_dict
    })


# funkce pro vytvoření objednávky s novým způsobem generování ID
@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    
    # Kontrola povinných polí
    required_fields = ['customer', 'products', 'shipping', 'payment']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'Chybí povinné pole: {field}'
            }), 400
    
    conn = get_db_connection()
    try:
        # Začátek transakce
        conn.execute('BEGIN')
        
        # Kontrola, zda zákazník existuje, případně vytvoření nového
        customer = conn.execute('''
        SELECT * FROM customers
        WHERE email = ? AND name = ?
        ''', (data['customer']['email'], data['customer']['name'])).fetchone()
        
        if customer:
            customer_id = customer['id']
            
            # Aktualizace informací o zákazníkovi, pokud jsou nové
            if (data['customer']['phone'] and data['customer']['phone'] != customer['phone']) or \
               (data['customer']['address'] and data['customer']['address'] != customer['address']) or \
               (data['customer']['city'] and data['customer']['city'] != customer['city']) or \
               (data['customer']['zip'] and data['customer']['zip'] != customer['zip']):
                conn.execute('''
                UPDATE customers
                SET phone = ?, address = ?, city = ?, zip = ?, country = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''', (
                    data['customer']['phone'] or customer['phone'],
                    data['customer']['address'] or customer['address'],
                    data['customer']['city'] or customer['city'],
                    data['customer']['zip'] or customer['zip'],
                    data['customer']['country'] or customer['country'],
                    customer_id
                ))
        else:
            cursor = conn.cursor()
            cursor.execute('''
            INSERT INTO customers (name, email, phone, address, city, zip, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['customer']['name'],
                data['customer']['email'],
                data['customer']['phone'],
                data['customer']['address'],
                data['customer']['city'],
                data['customer']['zip'],
                data['customer']['country']
            ))
            customer_id = cursor.lastrowid
        
        # Generování čísla objednávky - použití nové funkce
        order_number = generate_numeric_order_id()
        
        # Vložení objednávky
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO orders (
            order_number, customer_id, subtotal, shipping_method, shipping_price,
            payment_method, payment_price, total, status, note
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            order_number,
            customer_id,
            data['subtotal'],
            data['shipping']['method'],
            data['shipping']['price'],
            data['payment']['method'],
            data['payment']['price'],
            data['total'],
            data.get('status', 'new'),
            data.get('note', '')
        ))
        
        order_id = cursor.lastrowid
        
        # Vložení položek objednávky
        for product in data['products']:
            # Získání informací o produktu
            product_info = None
            if 'id' in product and product['id']:
                product_info = conn.execute('SELECT * FROM products WHERE id = ?', (product['id'],)).fetchone()
            else:
                product_info = conn.execute('''
                SELECT * FROM products
                WHERE type = ? AND variant = ?
                ''', (product['type'], product['variant'])).fetchone()
            
            product_id = product_info['id'] if product_info else None
            
            # Vložení položky
            conn.execute('''
            INSERT INTO order_items (
                order_id, product_id, name, variant, price, quantity, total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                order_id,
                product_id,
                product['name'],
                product['variant'],
                product['price'],
                product['quantity'],
                product['total']
            ))
            
            # Aktualizace skladu, pokud existuje produkt
            if product_id:
                conn.execute('''
                UPDATE products
                SET stock = MAX(0, stock - ?), updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                ''', (product['quantity'], product_id))
        
        # Zpracování metadat
        if 'metadata' in data and data['metadata']:
            metadata = data['metadata']
            for key, value in metadata.items():
                conn.execute('''
                INSERT INTO order_metadata (order_id, key, value)
                VALUES (?, ?, ?)
                ''', (order_id, key, str(value)))
        
        # Zpracování informací o odměně
        if 'reward' in data and data['reward']:
            reward = data['reward']
            conn.execute('''
            INSERT INTO order_rewards (order_id, level, name, threshold)
            VALUES (?, ?, ?, ?)
            ''', (
                order_id,
                reward.get('level', 0),
                reward.get('name', ''),
                reward.get('threshold', 0)
            ))
        
        # Commit transakce
        conn.commit()
        
        # Načtení vytvořené objednávky
        created_order = conn.execute('''
        SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
        ''', (order_id,)).fetchone()
        
        order_dict = dict(created_order)
        
        # Načtení položek objednávky
        items = conn.execute('''
        SELECT * FROM order_items WHERE order_id = ?
        ''', (order_id,)).fetchall()
        
        order_dict['items'] = [dict(item) for item in items]
        
        # Načtení metadat
        metadata_rows = conn.execute('''
        SELECT key, value FROM order_metadata WHERE order_id = ?
        ''', (order_id,)).fetchall()
        
        metadata = {}
        for row in metadata_rows:
            # Zkusíme konvertovat boolean hodnoty
            if row['value'].lower() in ('true', 'false'):
                metadata[row['key']] = row['value'].lower() == 'true'
            else:
                metadata[row['key']] = row['value']
                
        order_dict['metadata'] = metadata
        
        # Načtení odměny
        reward = conn.execute('''
        SELECT level, name, threshold FROM order_rewards WHERE order_id = ?
        ''', (order_id,)).fetchone()
        
        if reward:
            order_dict['reward'] = dict(reward)
        
        return jsonify({
            'status': 'success',
            'message': 'Objednávka byla úspěšně vytvořena',
            'order': order_dict
        })
    except Exception as e:
        conn.rollback()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při vytváření objednávky: {str(e)}'
        }), 500
    finally:
        conn.close()

def generate_numeric_order_id():
    # Aktuální datum ve formátu YYYYMMDD
    now = datetime.datetime.now()
    date_part = now.strftime('%Y%m%d')
    
    conn = get_db_connection()
    
    try:
        # Zjistíme nejvyšší pořadové číslo pro aktuální den
        # Tady hledáme pouze objednávky s čistě numerickým ID ve správném formátu
        today_prefix = date_part + '%'
        
        # Použijeme délku ID pro filtrování, aby se vyhnuli konverzi nečíselných hodnot
        # ID formátu YYYYMMDDNNNNNN má délku 14 znaků
        query = """
        SELECT order_number FROM orders 
        WHERE order_number LIKE ? 
        AND length(order_number) = 14
        AND order_number GLOB '[0-9]*'
        ORDER BY order_number DESC LIMIT 1
        """
        
        last_order = conn.execute(query, (today_prefix,)).fetchone()
        
        if last_order:
            try:
                # Pokud již existují objednávky pro dnešní den
                last_number = last_order['order_number']
                
                # Kontrola, zda ID je plně číselné, než se pokusíme o extrakci
                if last_number.isdigit():
                    # Extrahujeme posledních 6 číslic
                    seq_num = int(last_number[-6:])
                    # Inkrementujeme o 1
                    new_seq_num = seq_num + 1
                else:
                    # Pokud není číselné, začneme od 1
                    new_seq_num = 1
            except (ValueError, TypeError):
                # Pokud dojde k chybě při konverzi, začneme od 1
                new_seq_num = 1
        else:
            # První objednávka dne začíná od 1
            new_seq_num = 1
        
        # Formátování nového pořadového čísla na 6 číslic (doplnění nulami zleva)
        seq_part = f"{new_seq_num:06d}"
        
        # Výsledné ID objednávky
        order_number = date_part + seq_part
        
        return order_number
    finally:
        conn.close()

@app.route('/api/orders/<string:order_number>/shipping-details', methods=['GET'])
def get_order_shipping_details(order_number):
    """Získání detailů o dopravě objednávky včetně pobočky Zásilkovny"""
    conn = get_db_connection()
    
    # Nejprve zjistíme ID objednávky podle čísla objednávky
    order = conn.execute('SELECT id, shipping_method FROM orders WHERE order_number = ?', 
                    (order_number,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Objednávka nenalezena'
        }), 404
    
    # Získáme informace o pobočce, pokud existují
    branch = None
    if order['shipping_method'] == 'zasilkovna':
        branch_data = conn.execute('''
        SELECT branch_id, branch_name, branch_address
        FROM order_shipping_details
        WHERE order_id = ?
        ''', (order['id'],)).fetchone()
        
        if branch_data:
            branch = {
                'id': branch_data['branch_id'],
                'name': branch_data['branch_name'],
                'address': branch_data['branch_address']
            }
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'shipping_method': order['shipping_method'],
        'branch': branch
    })

@app.route('/api/orders/<string:order_number>', methods=['PUT'])
def update_order(order_number):
    data = request.get_json()
    
    conn = get_db_connection()
    
    try:
        # Kontrola, zda objednávka existuje
        order = conn.execute('SELECT * FROM orders WHERE order_number = ?', (order_number,)).fetchone()
        
        if not order:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Objednávka nenalezena'
            }), 404
        
        # Začátek transakce
        conn.execute('BEGIN')
        
        # Pokud jsou data zákazníka, aktualizujeme zákazníka
        if 'customer' in data:
            customer_data = data['customer']
            conn.execute('''
            UPDATE customers
            SET name = ?, email = ?, phone = ?, address = ?, city = ?, zip = ?, country = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (
                customer_data.get('name', ''),
                customer_data.get('email', ''),
                customer_data.get('phone', ''),
                customer_data.get('address', ''),
                customer_data.get('city', ''),
                customer_data.get('zip', ''),
                customer_data.get('country', ''),
                order['customer_id']
            ))
        
        # Aktualizace objednávky včetně dopravy a platby
        shipping_method = order['shipping_method']
        shipping_price = order['shipping_price']
        payment_method = order['payment_method']
        payment_price = order['payment_price']
        subtotal = order['subtotal']
        total = order['total']
        admin_note = order['admin_note'] if 'admin_note' in order else None
        
        if 'shipping' in data:
            shipping_method = data['shipping'].get('method', shipping_method)
            shipping_price = data['shipping'].get('price', shipping_price)
        
        if 'payment' in data:
            payment_method = data['payment'].get('method', payment_method)
            payment_price = data['payment'].get('price', payment_price)
        
        if 'subtotal' in data:
            subtotal = data['subtotal']
            
        if 'total' in data:
            total = data['total']
            
        # Přidání podpory pro admin_note
        if 'admin_note' in data:
            admin_note = data['admin_note']
        
        # Aktualizace objednávky
        conn.execute('''
        UPDATE orders
        SET status = ?, note = ?, admin_note = ?,
            shipping_method = ?, shipping_price = ?,
            payment_method = ?, payment_price = ?,
            subtotal = ?, total = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (
            data.get('status', order['status']),
            data.get('note', order['note']),
            admin_note,
            shipping_method,
            shipping_price,
            payment_method,
            payment_price,
            subtotal,
            total,
            order['id']
        ))
        
        # Pokud jsou nové položky objednávky, aktualizujeme je
        if 'products' in data:
            # Smažeme existující položky
            conn.execute('DELETE FROM order_items WHERE order_id = ?', (order['id'],))
            
            # Přidáme nové položky
            for product in data['products']:
                # Získání informací o produktu
                product_info = None
                if 'id' in product and product['id']:
                    product_info = conn.execute('SELECT * FROM products WHERE id = ?', (product['id'],)).fetchone()
                else:
                    product_info = conn.execute('''
                    SELECT * FROM products
                    WHERE type = ? AND variant = ?
                    ''', (product.get('type', ''), product.get('variant', ''))).fetchone()
                
                product_id = product_info['id'] if product_info else None
                
                # Vložení položky
                conn.execute('''
                INSERT INTO order_items (
                    order_id, product_id, name, variant, price, quantity, total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    order['id'],
                    product_id,
                    product.get('name', ''),
                    product.get('variant', ''),
                    product.get('price', 0),
                    product.get('quantity', 1),
                    product.get('total', 0)
                ))
        
        # Commit transakce
        conn.commit()
        
        # Načtení aktualizované objednávky
        updated_order = conn.execute('''
        SELECT o.*, c.name AS customer_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
        ''', (order['id'],)).fetchone()
        
        order_dict = dict(updated_order)
        
        # Načtení položek objednávky
        items = conn.execute('''
        SELECT * FROM order_items WHERE order_id = ?
        ''', (order['id'],)).fetchall()
        
        order_dict['items'] = [dict(item) for item in items]
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Objednávka byla úspěšně aktualizována',
            'order': order_dict
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při aktualizaci objednávky: {str(e)}'
        }), 500

@csrf.exempt
@app.route('/api/orders/<string:order_number>', methods=['DELETE'])
def delete_order(order_number):
    conn = get_db_connection()
    
    try:
        # Kontrola, zda objednávka existuje
        order = conn.execute('SELECT * FROM orders WHERE order_number = ?', (order_number,)).fetchone()
        
        if not order:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Objednávka nenalezena'
            }), 404
        
        # Začátek transakce
        conn.execute('BEGIN')
        
        # Kontrola, zda objednávka nemá fakturu
        invoice = conn.execute('SELECT * FROM invoices WHERE order_id = ?', (order['id'],)).fetchone()
        
        if invoice:
            # Odstranění faktury
            conn.execute('DELETE FROM invoices WHERE id = ?', (invoice['id'],))
            
            # Smazání PDF souboru faktury, pokud existuje
            invoice_path = os.path.join(app.config['INVOICES_FOLDER'], f"{invoice['invoice_number']}.pdf")
            if os.path.exists(invoice_path):
                os.remove(invoice_path)
        
        # Vrácení produktů na sklad
        items = conn.execute('SELECT * FROM order_items WHERE order_id = ? AND product_id IS NOT NULL', (order['id'],)).fetchall()
        
        for item in items:
            conn.execute('''
            UPDATE products
            SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (item['quantity'], item['product_id']))
        
        # Smazání položek objednávky
        conn.execute('DELETE FROM order_items WHERE order_id = ?', (order['id'],))
        
        # Smazání objednávky
        conn.execute('DELETE FROM orders WHERE id = ?', (order['id'],))
        
        # Commit transakce
        conn.commit()
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Objednávka byla úspěšně smazána'
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při mazání objednávky: {str(e)}'
        }), 500

@app.route('/api/orders/<string:order_number>/print', methods=['GET'])
def print_order(order_number):
    conn = get_db_connection()
    
    # Načtení objednávky
    order = conn.execute('''
    SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           c.address AS customer_address, c.city AS customer_city, c.zip AS customer_zip,
           c.country AS customer_country
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.order_number = ?
    ''', (order_number,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Objednávka nenalezena'
        }), 404
    
    # Načtení položek objednávky
    items = conn.execute('''
    SELECT * FROM order_items WHERE order_id = ?
    ''', (order['id'],)).fetchall()
    
    conn.close()
    
    # Sestavení HTML pro tisk
    html = f"""
    <!DOCTYPE html>
    <html lang="cs">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Objednávka #{order_number}</title>
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; }}
            h1 {{ margin-bottom: 10px; }}
            .order-header {{ margin-bottom: 20px; }}
            .order-info {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
            .order-info div {{ width: 48%; }}
            .order-items {{ width: 100%; border-collapse: collapse; margin-bottom: 30px; }}
            .order-items th, .order-items td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
            .order-items th {{ background-color: #f2f2f2; }}
            .order-total {{ text-align: right; }}
            .order-total table {{ margin-left: auto; width: 300px; }}
            .order-total td {{ padding: 5px; }}
            .order-total .total {{ font-weight: bold; }}
            .footer {{ margin-top: 50px; font-size: 12px; text-align: center; color: #777; }}
            @media print {{ 
                body {{ padding: 0; }}
                button {{ display: none; }}
                @page {{ margin: 2cm; }}
            }}
        </style>
    </head>
    <body>
        <button onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; cursor: pointer;">Vytisknout</button>
        
        <div class="order-header">
            <h1>Objednávka #{order_number}</h1>
            <p>Datum vytvoření: {datetime.datetime.fromisoformat(order['created_at'].replace('Z', '+00:00')).strftime('%d.%m.%Y %H:%M')}</p>
            <p>Status: {order['status']}</p>
        </div>
        
        <div class="order-info">
            <div>
                <h3>Zákazník</h3>
                <p>
                    <strong>{order['customer_name']}</strong><br>
                    Email: {order['customer_email']}<br>
                    Telefon: {order['customer_phone'] or '-'}<br>
                    Adresa: {(order['customer_address'] or '-') + ', ' + (order['customer_city'] or '') + ', ' + (order['customer_zip'] or '')}
                </p>
            </div>
            <div>
                <h3>Doručení a platba</h3>
                <p>
                    Doprava: {get_shipping_method_text(order['shipping_method'])}<br>
                    Platba: {get_payment_method_text(order['payment_method'])}<br>
                    {f"Poznámka: {order['note']}" if order['note'] else ""}
                </p>
            </div>
        </div>
        
        <h3>Položky objednávky</h3>
        <table class="order-items">
            <thead>
                <tr>
                    <th>Položka</th>
                    <th>Varianta</th>
                    <th>Cena za kus</th>
                    <th>Množství</th>
                    <th>Celkem</th>
                </tr>
            </thead>
            <tbody>
    """
    
    # Přidání položek objednávky
    for item in items:
        html += f"""
                <tr>
                    <td>{item['name']}</td>
                    <td>{item['variant']}</td>
                    <td>{item['price']:.2f} Kč</td>
                    <td>{item['quantity']} ks</td>
                    <td>{item['total']:.2f} Kč</td>
                </tr>
        """
    
    # Přidání dopravy a platby
    html += f"""
                <tr>
                    <td>Doprava</td>
                    <td>{get_shipping_method_text(order['shipping_method'])}</td>
                    <td>{order['shipping_price']:.2f} Kč</td>
                    <td>1 ks</td>
                    <td>{order['shipping_price']:.2f} Kč</td>
                </tr>
    """
    
    if order['payment_price'] > 0:
        html += f"""
                <tr>
                    <td>Platba</td>
                    <td>{get_payment_method_text(order['payment_method'])}</td>
                    <td>{order['payment_price']:.2f} Kč</td>
                    <td>1 ks</td>
                    <td>{order['payment_price']:.2f} Kč</td>
                </tr>
        """
    
    html += f"""
            </tbody>
        </table>
        
        <div class="order-total">
            <table>
                <tr>
                    <td>Mezisoučet:</td>
                    <td>{order['subtotal']:.2f} Kč</td>
                </tr>
                <tr>
                    <td>Doprava:</td>
                    <td>{order['shipping_price']:.2f} Kč</td>
                </tr>
                <tr>
                    <td>Platba:</td>
                    <td>{order['payment_price']:.2f} Kč</td>
                </tr>
                <tr class="total">
                    <td>Celková cena:</td>
                    <td>{order['total']:.2f} Kč</td>
                </tr>
            </table>
        </div>
        
        <div class="footer">
            <p>Tento dokument byl vygenerován systémem Zentos. Děkujeme za Váš nákup.</p>
            <p>{get_settings().get('company_name', 'Šimon Novák')} | {get_settings().get('company_address', 'Nedašov 11')}, {get_settings().get('company_zip', '76333')} {get_settings().get('company_city', 'Nedašov')} | IČO: {get_settings().get('company_ico', '19930356')}</p>
        </div>
    </body>
    </html>
    """
    
    response = make_response(html)
    response.headers['Content-Type'] = 'text/html'
    return response

# ===== API ENDPOINTY PRO POZNÁMKY =====

@app.route('/api/orders/<string:order_number>/notes', methods=['GET'])
def get_order_notes(order_number):
    """Získání všech poznámek pro danou objednávku"""
    conn = get_db_connection()
    
    # Nejprve zkontrolujeme, zda objednávka existuje
    order = conn.execute('SELECT id FROM orders WHERE order_number = ?', (order_number,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Objednávka nenalezena'
        }), 404
    
    # Získáme všechny poznámky pro objednávku, seřazené od nejnovější
    notes = conn.execute('''
    SELECT id, admin_name, note_text, created_at
    FROM order_notes
    WHERE order_id = ?
    ORDER BY created_at DESC
    ''', (order['id'],)).fetchall()
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'notes': [dict(note) for note in notes]
    })

@app.route('/api/orders/<string:order_number>/notes', methods=['POST'])
def add_order_note(order_number):
    """Přidání nové poznámky k objednávce"""
    data = request.get_json()
    
    if 'note_text' not in data or not data['note_text'].strip():
        return jsonify({
            'status': 'error',
            'message': 'Text poznámky je povinný'
        }), 400
    
    conn = get_db_connection()
    
    # Kontrola, zda objednávka existuje
    order = conn.execute('SELECT id FROM orders WHERE order_number = ?', (order_number,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Objednávka nenalezena'
        }), 404
    
    try:
        # Získání informací o přihlášeném uživateli
        admin_id = session.get('user_id')
        admin_name = "Systém"  # Výchozí hodnota
        
        if admin_id:
            admin = conn.execute('SELECT name FROM admins WHERE id = ?', (admin_id,)).fetchone()
            if admin:
                admin_name = admin['name']
        else:
            # Pokud není uživatel přihlášen, nelze přidat poznámku
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Uživatel není přihlášen'
            }), 401
        
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO order_notes (order_id, admin_id, admin_name, note_text)
        VALUES (?, ?, ?, ?)
        ''', (order['id'], admin_id, admin_name, data['note_text']))
        
        note_id = cursor.lastrowid
        conn.commit()
        
        # Získání časového razítka vytvořené poznámky
        created_note = conn.execute('SELECT created_at FROM order_notes WHERE id = ?', (note_id,)).fetchone()
        created_at = created_note['created_at'] if created_note else datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Poznámka byla úspěšně přidána',
            'note': {
                'id': note_id,
                'admin_name': admin_name,
                'note_text': data['note_text'],
                'created_at': created_at
            }
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při přidávání poznámky: {str(e)}'
        }), 500

@app.route('/api/orders/<string:order_number>/notes/<int:note_id>', methods=['DELETE'])
def delete_order_note(order_number, note_id):
    """Smazání poznámky"""
    conn = get_db_connection()
    
    # Kontrola, zda objednávka existuje
    order = conn.execute('SELECT id FROM orders WHERE order_number = ?', (order_number,)).fetchone()
    
    if not order:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Objednávka nenalezena'
        }), 404
    
    # Kontrola, zda poznámka existuje a patří k této objednávce
    note = conn.execute('''
    SELECT * FROM order_notes
    WHERE id = ? AND order_id = ?
    ''', (note_id, order['id'])).fetchone()
    
    if not note:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Poznámka nenalezena'
        }), 404
    
    try:
        # Kontrola, zda má uživatel práva mazat poznámku (superadmin může mazat všechny)
        admin_id = session.get('user_id')
        if not admin_id:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Uživatel není přihlášen'
            }), 401
        
        # Zde můžete přidat logiku pro kontrolu rolí - např. superadmin může mazat cizí poznámky
        # Pro jednoduchost zatím dovolíme mazat všem přihlášeným uživatelům
        
        conn.execute('DELETE FROM order_notes WHERE id = ?', (note_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Poznámka byla úspěšně smazána'
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při mazání poznámky: {str(e)}'
        }), 500

# ===== FAKTURY =====
@app.route('/api/invoices/<string:order_number>', methods=['POST'])
def create_invoice(order_number):
    conn = get_db_connection()
    
    try:
        # Kontrola, zda objednávka existuje
        order_query = '''
        SELECT o.*, 
               c.id as customer_id, c.name as customer_name, c.email as customer_email,
               c.phone as customer_phone, c.address as customer_address, 
               c.city as customer_city, c.zip as customer_zip, c.country as customer_country
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.order_number = ?
        '''
        
        order = conn.execute(order_query, (order_number,)).fetchone()
        
        if not order:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Objednávka nenalezena'
            }), 404
        
        # Kontrola, zda již faktura neexistuje
        existing_invoice = conn.execute('''
        SELECT * FROM invoices WHERE order_id = ?
        ''', (order['id'],)).fetchone()
        
        if existing_invoice:
            conn.close()
            return jsonify({
                'status': 'success',
                'message': 'Faktura již existuje',
                'invoice': dict(existing_invoice)
            })
        
        # Začátek transakce
        conn.execute('BEGIN')
        
        # Načtení položek objednávky
        items = conn.execute('''
        SELECT * FROM order_items WHERE order_id = ?
        ''', (order['id'],)).fetchall()
        
        # Generování čísla faktury
        year = datetime.datetime.now().year
        invoice_prefix = get_settings().get('invoice_prefix', 'FV')
        
        # Získání posledního čísla faktury pro tento rok
        last_invoice = conn.execute('''
        SELECT invoice_number FROM invoices 
        WHERE invoice_number LIKE ? 
        ORDER BY id DESC LIMIT 1
        ''', (f"{invoice_prefix}{year}%",)).fetchone()
        
        if last_invoice:
            last_number = int(last_invoice['invoice_number'].replace(f"{invoice_prefix}{year}", ""))
            invoice_number = f"{invoice_prefix}{year}{(last_number + 1):04d}"
        else:
            invoice_number = f"{invoice_prefix}{year}0001"
        
        # Vytvoření PDF faktury
        order_dict = dict(order)
        order_dict['items'] = [dict(item) for item in items]
        
        # Vytvoření zákaznického slovníku z objednávky
        customer_dict = {
            'id': order['customer_id'],
            'name': order['customer_name'],
            'email': order['customer_email'],
            'phone': order['customer_phone'],
            'address': order['customer_address'],
            'city': order['customer_city'],
            'zip': order['customer_zip'],
            'country': order['customer_country']
        }
        
        file_path = generate_invoice_pdf(invoice_number, order_dict, customer_dict)
        
        # Uložení faktury do databáze
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO invoices (invoice_number, order_id, customer_id, amount, status, file_path)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            invoice_number,
            order['id'],
            order['customer_id'],
            order['total'],
            'issued',
            file_path
        ))
        
        invoice_id = cursor.lastrowid
        
        # Aktualizace statusu objednávky
        conn.execute('''
        UPDATE orders
        SET status = CASE WHEN status = 'new' THEN 'processing' ELSE status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (order['id'],))
        
        # Commit transakce
        conn.commit()
        
        # Načtení vytvořené faktury
        invoice = conn.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Faktura byla úspěšně vytvořena',
            'invoice': dict(invoice)
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při vytváření faktury: {str(e)}'
        }), 500

@app.route('/api/invoices/<string:invoice_number>/view', methods=['GET'])
def view_invoice(invoice_number):
    conn = get_db_connection()
    invoice = conn.execute('SELECT * FROM invoices WHERE invoice_number = ?', (invoice_number,)).fetchone()
    conn.close()
    
    if not invoice:
        return jsonify({
            'status': 'error',
            'message': 'Faktura nenalezena'
        }), 404
    
    file_path = invoice['file_path']
    
    if not os.path.exists(file_path):
        # Pokud soubor neexistuje, pokusíme se ho znovu vygenerovat
        conn = get_db_connection()
        
        order = conn.execute('''
        SELECT o.*, c.* 
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
        ''', (invoice['order_id'],)).fetchone()
        
        items = conn.execute('''
        SELECT * FROM order_items WHERE order_id = ?
        ''', (invoice['order_id'],)).fetchall()
        
        conn.close()
        
        if not order:
            return jsonify({
                'status': 'error',
                'message': 'Objednávka nenalezena'
            }), 404
        
        # Vytvoření PDF faktury
        order_dict = dict(order)
        order_dict['items'] = [dict(item) for item in items]
        customer_dict = {k.replace('c_', ''): order[k] for k in order.keys() if k.startswith('c_')}
        
        file_path = generate_invoice_pdf(invoice_number, order_dict, customer_dict)
    
    return send_from_directory(os.path.dirname(file_path), os.path.basename(file_path))

@app.route('/api/invoices/<string:invoice_number>/download', methods=['GET'])
def download_invoice(invoice_number):
    conn = get_db_connection()
    invoice = conn.execute('SELECT * FROM invoices WHERE invoice_number = ?', (invoice_number,)).fetchone()
    conn.close()
    
    if not invoice:
        return jsonify({
            'status': 'error',
            'message': 'Faktura nenalezena'
        }), 404
    
    file_path = invoice['file_path']
    
    if not os.path.exists(file_path):
        return jsonify({
            'status': 'error',
            'message': 'Soubor faktury nenalezen'
        }), 404
    
    # Bezpečné stažení faktury pomocí send_from_directory
    try:
        response = send_from_directory(
            os.path.dirname(file_path),
            os.path.basename(file_path),
            as_attachment=True,
            download_name=f"Faktura-{invoice_number}.pdf"
        )
        
        # Nastavení hlaviček pro zabránění ukládání do cache
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Chyba při stahování faktury: {str(e)}'
        }), 500

@app.route('/api/invoices/<string:invoice_number>/send-email', methods=['POST'])
def send_invoice_email_endpoint(invoice_number):
    conn = get_db_connection()
    
    try:
        # Získání informací o faktuře
        invoice_info = conn.execute('''
        SELECT i.*, o.order_number
        FROM invoices i
        JOIN orders o ON i.order_id = o.id
        WHERE i.invoice_number = ?
        ''', (invoice_number,)).fetchone()
        
        if not invoice_info:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Faktura nenalezena'
            }), 404
        
        # Načtení detailů objednávky
        order = conn.execute('''
        SELECT o.*
        FROM orders o
        WHERE o.id = ?
        ''', (invoice_info['order_id'],)).fetchone()
        
        if not order:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Objednávka nenalezena'
            }), 404
        
        # Načtení zákazníka
        customer = conn.execute('''
        SELECT *
        FROM customers
        WHERE id = ?
        ''', (order['customer_id'],)).fetchone()
        
        if not customer:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Zákazník nenalezen'
            }), 404
        
        # Načtení položek objednávky
        items = conn.execute('''
        SELECT *
        FROM order_items
        WHERE order_id = ?
        ''', (order['id'],)).fetchall()
        
        # Kontrola, zda existuje soubor faktury
        file_path = invoice_info['file_path']
        
        if not os.path.exists(file_path):
            # Pokud soubor neexistuje, zkusíme ho znovu vygenerovat
            order_dict = dict(order)
            order_dict['items'] = [dict(item) for item in items]
            
            customer_dict = dict(customer)
            
            file_path = generate_invoice_pdf(invoice_number, order_dict, customer_dict)
            
            if not os.path.exists(file_path):
                conn.close()
                return jsonify({
                    'status': 'error',
                    'message': 'Soubor faktury nelze vygenerovat'
                }), 500
        
        # Získání firemních údajů
        company_info = get_company_info()
        
        # Příprava dat pro email
        invoice_data = dict(invoice_info)
        order_data = dict(order)
        order_data['items'] = [dict(item) for item in items]
        customer_data = dict(customer)
        
        # Odeslání emailu
        success = send_invoice_email_direct(
            invoice_data,
            file_path,
            customer_data,
            order_data,
            company_info
        )
        
        if success:
            # Aktualizace stavu faktury v databázi
            conn.execute('''
            UPDATE invoices
            SET status = 'sent'
            WHERE invoice_number = ?
            ''', (invoice_number,))
            conn.commit()
            conn.close()
            
            return jsonify({
                'status': 'success',
                'message': f'Faktura byla úspěšně odeslána na email {customer["email"]}'
            })
        else:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Nepodařilo se odeslat fakturu emailem'
            }), 500
            
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při zpracování požadavku: {str(e)}'
        }), 500

# Opravená a přímá implementace funkce send_invoice_email
def send_invoice_email_direct(invoice_info, file_path, customer_data, order_data, company_info):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    
    # SMTP konfigurace - použití přímých hodnot místo getenv
    smtp_server = "wes1-smtp.wedos.net"
    smtp_port = 587
    from_email = "sn@snovak.cz"  # Přímá emailová adresa
    password = "!66"      # Přímé heslo (pro účely testování)
    
    # Údaje z parametrů
    to_email = customer_data['email']
    invoice_number = invoice_info['invoice_number']
    order_number = order_data['order_number']
    customer_name = customer_data['name']
    
    # Vytvoření souhrnu objednávky
    order_summary = ""
    total_price = 0
    
    for item in order_data['items']:
        price = item['price'] * item['quantity']
        total_price += price
        order_summary += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">{item['name']} - {item['variant']}</td>
            <td align="center" style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">{item['quantity']} ks</td>
            <td align="right" style="padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; white-space: nowrap;">{price:.2f} Kč</td>
        </tr>
        """
    
    # Přidání řádku slevy, pokud existuje
    if 'discount' in order_data and order_data['discount'] > 0:
        order_summary += f"""
        <tr>
            <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">Sleva</td>
            <td align="center" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">1 ks</td>
            <td align="right" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; white-space: nowrap; color: #FF5252;">-{order_data['discount']:.2f} Kč</td>
        </tr>
        """
    
    # Informace o dopravě a platbě
    shipping_method = ""
    if order_data['shipping_method'] == 'zasilkovna':
        # Check if there's branch info
        if 'branch' in order_data.get('shipping', {}) and order_data['shipping']['branch'].get('name'):
            branch_name = order_data['shipping']['branch']['name']
            shipping_method = f"Zásilkovna - {branch_name}"
        else:
            shipping_method = "Zásilkovna"
    elif order_data['shipping_method'] == 'ppl':
        shipping_method = "PPL"
    elif order_data['shipping_method'] == 'express':
        shipping_method = "Exkluzivní doručení"
    elif order_data['shipping_method'] == 'personal':
        shipping_method = "Osobní odběr"
    
    payment_method = ""
    if order_data['payment_method'] == 'card':
        payment_method = "Platba kartou"
    elif order_data['payment_method'] == 'bank':
        payment_method = "Bankovní převod"
    elif order_data['payment_method'] == 'cod':
        payment_method = "Dobírka"
    
    # Vytvoření variabilního symbolu z čísla objednávky
    variable_symbol = order_number[:8] + order_number[-2:] if len(order_number) >= 10 else order_number
    
    # Vytvoření URL pro QR kód
    qr_code_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SPD*1.0*ACC:CZ6130300000003361960019*AM:{order_data['total']:.2f}*CC:CZK*MSG:Objednavka{order_number}*X-VS:{variable_symbol}"
    
    # Sestavení těla emailu v HTML s vylepšeným responzivním designem
    subject = f"Vaše faktura č. {invoice_number} - Sajrajt.cz"
    body = f"""<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Faktura - Sajrajt.cz</title>
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #ffffff;">
    <!-- Email container -->
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; margin: 10px auto;">
        <!-- Header -->
        <tr>
            <td align="center" style="background-color: #121212; padding: 30px 20px; border-radius: 16px 16px 0 0; border: 1px solid #69f0ae; border-bottom: none;">
                <h1 style="margin: 0; font-size: 40px; color: #ffffff; text-transform: uppercase; letter-spacing: 3px; font-weight: 700;">SAJRAJT.CZ</h1>
                <p style="margin: 5px 0 0; color: #69f0ae; letter-spacing: 1px; text-transform: uppercase; font-weight: 500;">VÁŠ PRÉMIOVÝ DODAVATEL KRATOMU</p>
            </td>
        </tr>
        
        <!-- Main content -->
        <tr>
            <td style="background-color: #1a1a1a; padding: 30px 25px; border-left: 1px solid #69f0ae; border-right: 1px solid #69f0ae;">
                <!-- Heading -->
                <h2 style="color: #69f0ae; border-bottom: 2px solid #69f0ae; padding-bottom: 12px; text-transform: uppercase; margin-top: 0; font-weight: 600;">DĚKUJEME ZA VÁŠ NÁKUP!</h2>
                
                <p style="color: #e0e0e0; margin-bottom: 20px; line-height: 1.5; font-size: 16px;">Vážený zákazníku <strong style="color: #ffffff;">{customer_name}</strong>,</p>
                
                <p style="color: #e0e0e0; margin-bottom: 25px; line-height: 1.5; font-size: 16px;">děkujeme za Váš nákup v našem e-shopu. V příloze najdete kompletní fakturu k Vaší objednávce <strong style="color: #69f0ae;">#{order_number}</strong>.</p>
                
                <!-- Order summary -->
                <div style="margin: 35px 0; background-color: #2a2a2a; padding: 25px; border-radius: 16px; border: 1px solid #69f0ae; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                    <h3 style="color: #69f0ae; margin-top: 0; margin-bottom: 20px; text-transform: uppercase; font-weight: 600;">SHRNUTÍ VAŠÍ OBJEDNÁVKY</h3>
                    
                    <!-- Order items table -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; color: #e0e0e0; margin-bottom: 5px;">
                        <tr style="background-color: rgba(105, 240, 174, 0.1);">
                            <th align="left" style="padding: 12px 15px; border-bottom: 2px solid #69f0ae; color: #ffffff; text-transform: uppercase; font-size: 14px; font-weight: 600;">PRODUKT</th>
                            <th align="center" style="padding: 12px 15px; border-bottom: 2px solid #69f0ae; color: #ffffff; text-transform: uppercase; font-size: 14px; font-weight: 600;">MNOŽSTVÍ</th>
                            <th align="right" style="padding: 12px 15px; border-bottom: 2px solid #69f0ae; color: #ffffff; text-transform: uppercase; font-size: 14px; font-weight: 600;">CENA</th>
                        </tr>
                        {order_summary}
                        <tr>
                            <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">Doprava - {shipping_method}</td>
                            <td align="center" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">1 ks</td>
                            <td align="right" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; white-space: nowrap;">{order_data['shipping_price']:.2f} Kč</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">Platba - {payment_method}</td>
                            <td align="center" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0;">1 ks</td>
                            <td align="right" style="padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #e0e0e0; white-space: nowrap;">{order_data['payment_price']:.2f} Kč</td>
                        </tr>
                        <tr style="background-color: rgba(105, 240, 174, 0.1);">
                            <td colspan="2" style="padding: 15px; color: #ffffff; font-weight: bold;">CELKEM K ÚHRADĚ:</td>
                            <td align="right" style="padding: 15px; color: #69f0ae; font-weight: bold; font-size: 18px; white-space: nowrap;">{order_data['total']:.2f} Kč</td>
                        </tr>
                    </table>
                </div>
                
                {'' if order_data['payment_method'] != 'bank' else f'''
                <!-- Payment details section -->
                <p style="color: #e0e0e0; margin-bottom: 15px; line-height: 1.5; font-size: 16px;">Pokud jste ještě platbu neprovedli, prosím proveďte ji na následující účet nebo jednoduše naskenujte QR kód níže:</p>
                
                <div style="margin: 25px 0; background-color: #222222; padding: 25px; border-radius: 16px; border: 1px solid #69f0ae; box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                    <!-- Payment info boxes -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 25px;">
                        <tr>
                            <!-- Číslo účtu -->
                            <td width="33%" style="padding: 0 6px 0 0;">
                                <div style="background-color: #1a1a1a; padding: 15px; border-radius: 12px; border: 1px solid rgba(105, 240, 174, 0.3);">
                                    <p style="margin: 0; color: #69f0ae; text-transform: uppercase; font-size: 13px; font-weight: 600;">ČÍSLO ÚČTU</p>
                                    <p style="margin: 8px 0 0; color: #ffffff; font-weight: bold; font-size: 16px;">3361960019/3030</p>
                                </div>
                            </td>
                            
                            <!-- Variabilní symbol -->
                            <td width="33%" style="padding: 0 6px;">
                                <div style="background-color: #1a1a1a; padding: 15px; border-radius: 12px; border: 1px solid rgba(105, 240, 174, 0.3);">
                                    <p style="margin: 0; color: #69f0ae; text-transform: uppercase; font-size: 13px; font-weight: 600;">VARIABILNÍ SYMBOL</p>
                                    <p style="margin: 8px 0 0; color: #ffffff; font-weight: bold; font-size: 16px;">{variable_symbol}</p>
                                </div>
                            </td>
                            
                            <!-- Částka -->
                            <td width="33%" style="padding: 0 0 0 6px;">
                                <div style="background-color: #1a1a1a; padding: 15px; border-radius: 12px; border: 1px solid rgba(105, 240, 174, 0.3);">
                                    <p style="margin: 0; color: #69f0ae; text-transform: uppercase; font-size: 13px; font-weight: 600;">ČÁSTKA</p>
                                    <p style="margin: 8px 0 0; color: #ffffff; font-weight: bold; font-size: 16px; white-space: nowrap;">{order_data['total']:.2f} Kč</p>
                                </div>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- QR Code -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        <tr>
                            <td align="center">
                                <p style="margin: 0 0 15px 0; color: #69f0ae; font-weight: bold; text-transform: uppercase;">QR PLATBA</p>
                                <div style="display: inline-block; background-color: #ffffff; padding: 10px; border-radius: 12px;">
                                    <img src="{qr_code_url}" width="200" height="200" alt="QR kód pro platbu" style="display: block; border: 0;">
                                </div>
                                <p style="margin: 15px 0 0; color: #e0e0e0; font-size: 14px;">Pro platbu jednoduše načtěte QR kód v bankovní aplikaci</p>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                        <p style="margin: 0; color: #e0e0e0; font-size: 14px; text-align: center;"><strong style="color: #69f0ae;">Tip:</strong> Pro rychlejší zpracování vaší objednávky prosím uvádějte variabilní symbol.</p>
                    </div>
                </div>
                '''}
                
                <!-- Status box -->
                <div style="margin: 35px 0; background-color: rgba(0, 230, 118, 0.08); padding: 20px; border-radius: 16px; border: 1px solid rgba(105, 240, 174, 0.3); display: flex; align-items: center;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        <tr>
                            <td width="50" valign="top">
                                <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                    <tr>
                                        <td width="40" height="40" bgcolor="#00c853" style="border-radius: 20px; text-align: center; color: #ffffff; font-weight: bold; font-size: 24px;">✓</td>
                                    </tr>
                                </table>
                            </td>
                            <td style="padding-left: 15px;">
                                <p style="margin: 0 0 5px 0; color: #69f0ae; font-weight: bold; font-size: 16px;">OBJEDNÁVKA BYLA PŘIJATA</p>
                                <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.5;">Vaše objednávka byla úspěšně zaregistrována a již se zpracovává.</p>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Contact info -->
                <p style="color: #e0e0e0; margin-top: 30px; line-height: 1.5; font-size: 16px;">V případě jakýchkoliv dotazů nás neváhejte kontaktovat na <a href="mailto:info@sajrajt.cz" style="color: #69f0ae; text-decoration: none; font-weight: bold;">info@sajrajt.cz</a> nebo telefonicky na <strong style="color: #ffffff;">{company_info['phone']}</strong>.</p>
                
                <p style="color: #e0e0e0; line-height: 1.5; font-size: 16px;">Děkujeme za Vaši důvěru a přejeme Vám krásný den.</p>
                
                <p style="margin-top: 35px; color: #e0e0e0; line-height: 1.5;">S pozdravem,<br>
                <span style="color: #69f0ae; font-weight: bold; font-size: 18px; text-transform: uppercase; display: inline-block; margin-top: 5px; border-left: 3px solid #69f0ae; padding-left: 10px;">Tým Sajrajt.cz</span></p>
            </td>
        </tr>
        
        <!-- Footer -->
        <tr>
            <td style="background-color: #121212; padding: 25px 20px; border: 1px solid #69f0ae; border-top: none; border-radius: 0 0 16px 16px; font-size: 12px; color: #9e9e9e; text-align: center;">
                <p style="margin: 15px 0 5px; color: #9e9e9e;">&copy; 2025 Sajrajt.cz | Všechna práva vyhrazena</p>
                <p style="margin: 5px 0 0; color: #9e9e9e; font-size: 11px;">Tento e-mail byl vygenerován automaticky, prosíme neodpovídejte na něj.</p>
            </td>
        </tr>
    </table>
</body>
</html>"""
    
    # Vytvoření emailu
    msg = MIMEMultipart()
    msg['Subject'] = subject
    msg['From'] = f"Sajrajt.cz <{from_email}>"
    msg['To'] = to_email
    
    # Přidání HTML těla
    msg.attach(MIMEText(body, 'html'))
    
    # Přidání faktury jako přílohy
    try:
        with open(file_path, 'rb') as f:
            attachment = MIMEApplication(f.read(), _subtype='pdf')
            attachment.add_header('Content-Disposition', 'attachment', filename=f"Faktura-{invoice_number}.pdf")
            msg.attach(attachment)
    except Exception as e:
        print(f"Chyba při čtení souboru faktury: {e}")
        return False
    
    # Odeslání emailu
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(from_email, password)
            server.sendmail(from_email, [to_email], msg.as_string())
        print(f"Faktura byla úspěšně odeslána na {to_email}")
        return True
    except Exception as e:
        print(f"Chyba při odesílání e-mailu: {str(e)}")
        return False

# ===== NASTAVENÍ =====
@app.route('/api/settings', methods=['GET'])
def get_settings_endpoint():
    settings = get_settings()
    return jsonify({
        'status': 'success',
        'settings': settings
    })

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    data = request.get_json()
    
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        
        for key, value in data.items():
            # Kontrola, zda nastavení existuje
            setting = conn.execute('SELECT * FROM settings WHERE key = ?', (key,)).fetchone()
            
            if setting:
                # Aktualizace nastavení
                conn.execute('''
                UPDATE settings
                SET value = ?, updated_at = CURRENT_TIMESTAMP
                WHERE key = ?
                ''', (value, key))
            else:
                # Vytvoření nového nastavení
                conn.execute('''
                INSERT INTO settings (key, value)
                VALUES (?, ?)
                ''', (key, value))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Nastavení bylo úspěšně aktualizováno',
            'settings': get_settings()
        })
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při aktualizaci nastavení: {str(e)}'
        }), 500

# ===== STATISTIKY =====
@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    period = request.args.get('period', 'month')
    
    conn = get_db_connection()
    
    try:
        # Určení časového období
        now = datetime.datetime.now()
        
        if period == 'day':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            previous_start = start_date - datetime.timedelta(days=1)
            previous_end = start_date
        elif period == 'week':
            # Začátek aktuálního týdne (pondělí)
            start_date = now - datetime.timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
            previous_start = start_date - datetime.timedelta(weeks=1)
            previous_end = start_date
        elif period == 'year':
            # Začátek aktuálního roku
            start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_start = start_date.replace(year=start_date.year - 1)
            previous_end = start_date
        else:  # month (výchozí)
            # Začátek aktuálního měsíce
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # Předchozí měsíc
            if start_date.month == 1:
                previous_start = start_date.replace(year=start_date.year - 1, month=12)
            else:
                previous_start = start_date.replace(month=start_date.month - 1)
            previous_end = start_date
        
        # Převod na string formát pro SQLite
        start_date_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
        previous_start_str = previous_start.strftime('%Y-%m-%d %H:%M:%S')
        previous_end_str = previous_end.strftime('%Y-%m-%d %H:%M:%S')
        
        # Získání celkových statistik pro aktuální období
        current_stats = conn.execute('''
        SELECT 
            COUNT(*) as total_orders,
            SUM(total) as total_revenue,
            COUNT(DISTINCT customer_id) as total_customers,
            (SELECT SUM(quantity) FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE created_at >= ?)) as total_products
        FROM orders
        WHERE created_at >= ?
        ''', (start_date_str, start_date_str)).fetchone()
        
        # Získání celkových statistik pro předchozí období
        previous_stats = conn.execute('''
        SELECT 
            COUNT(*) as total_orders,
            SUM(total) as total_revenue,
            COUNT(DISTINCT customer_id) as total_customers,
            (SELECT SUM(quantity) FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE created_at >= ? AND created_at < ?)) as total_products
        FROM orders
        WHERE created_at >= ? AND created_at < ?
        ''', (previous_start_str, previous_end_str, previous_start_str, previous_end_str)).fetchone()
        
        # Výpočet procentuálních změn
        def calculate_percentage_change(current, previous):
            if not previous or previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 2)
        
        # Formátování výsledků
        current_stats_dict = dict(current_stats)
        previous_stats_dict = dict(previous_stats)
        
        # Nahrazení None hodnot nulami
        for key in current_stats_dict:
            if current_stats_dict[key] is None:
                current_stats_dict[key] = 0
            if previous_stats_dict[key] is None:
                previous_stats_dict[key] = 0
        
        # Výpočet změn
        changes = {
            'orders_change': calculate_percentage_change(current_stats_dict['total_orders'], previous_stats_dict['total_orders']),
            'revenue_change': calculate_percentage_change(current_stats_dict['total_revenue'], previous_stats_dict['total_revenue']),
            'customers_change': calculate_percentage_change(current_stats_dict['total_customers'], previous_stats_dict['total_customers']),
            'products_change': calculate_percentage_change(current_stats_dict['total_products'], previous_stats_dict['total_products'])
        }
        
        # Získání top produktů
        top_products = conn.execute('''
        SELECT 
            oi.name,
            oi.variant,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.total) as total_revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= ?
        GROUP BY oi.name, oi.variant
        ORDER BY total_revenue DESC
        LIMIT 5
        ''', (start_date_str,)).fetchall()
        
        # Získání obratů dle času
        time_revenue = []
        
        if period == 'day':
            # Hodinové intervaly
            for hour in range(24):
                hour_start = start_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                hour_end = hour_start + datetime.timedelta(hours=1)
                
                hour_revenue = conn.execute('''
                SELECT SUM(total) as revenue, COUNT(*) as orders
                FROM orders
                WHERE created_at >= ? AND created_at < ?
                ''', (hour_start.strftime('%Y-%m-%d %H:%M:%S'), hour_end.strftime('%Y-%m-%d %H:%M:%S'))).fetchone()
                
                time_revenue.append({
                    'time': f"{hour}:00",
                    'revenue': hour_revenue['revenue'] or 0,
                    'orders': hour_revenue['orders'] or 0
                })
        elif period == 'week':
            # Denní intervaly
            for day in range(7):
                day_start = start_date + datetime.timedelta(days=day)
                day_end = day_start + datetime.timedelta(days=1)
                
                day_revenue = conn.execute('''
                SELECT SUM(total) as revenue, COUNT(*) as orders
                FROM orders
                WHERE created_at >= ? AND created_at < ?
                ''', (day_start.strftime('%Y-%m-%d %H:%M:%S'), day_end.strftime('%Y-%m-%d %H:%M:%S'))).fetchone()
                
                time_revenue.append({
                    'time': day_start.strftime('%a'),  # Den v týdnu
                    'revenue': day_revenue['revenue'] or 0,
                    'orders': day_revenue['orders'] or 0
                })
        elif period == 'year':
            # Měsíční intervaly
            for month in range(1, 13):
                if month < 13:
                    month_start = now.replace(month=month, day=1, hour=0, minute=0, second=0, microsecond=0)
                    if month < 12:
                        month_end = now.replace(month=month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
                    else:
                        month_end = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
                    
                    month_revenue = conn.execute('''
                    SELECT SUM(total) as revenue, COUNT(*) as orders
                    FROM orders
                    WHERE created_at >= ? AND created_at < ?
                    ''', (month_start.strftime('%Y-%m-%d %H:%M:%S'), month_end.strftime('%Y-%m-%d %H:%M:%S'))).fetchone()
                    
                    time_revenue.append({
                        'time': month_start.strftime('%b'),  # Zkrácený název měsíce
                        'revenue': month_revenue['revenue'] or 0,
                        'orders': month_revenue['orders'] or 0
                    })
        else:  # month
            # Denní intervaly pro aktuální měsíc
            days_in_month = (now.replace(month=now.month + 1, day=1) - datetime.timedelta(days=1)).day if now.month < 12 else 31
            
            for day in range(1, days_in_month + 1):
                day_start = now.replace(day=day, hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + datetime.timedelta(days=1)
                
                # Pokud je den v budoucnosti, přeskočíme ho
                if day_start > now:
                    continue
                
                day_revenue = conn.execute('''
                SELECT SUM(total) as revenue, COUNT(*) as orders
                FROM orders
                WHERE created_at >= ? AND created_at < ?
                ''', (day_start.strftime('%Y-%m-%d %H:%M:%S'), day_end.strftime('%Y-%m-%d %H:%M:%S'))).fetchone()
                
                time_revenue.append({
                    'time': f"{day}.",  # Den v měsíci
                    'revenue': day_revenue['revenue'] or 0,
                    'orders': day_revenue['orders'] or 0
                })
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'stats': {
                'current': {
                    'total_orders': current_stats_dict['total_orders'],
                    'total_revenue': current_stats_dict['total_revenue'],
                    'total_customers': current_stats_dict['total_customers'],
                    'total_products': current_stats_dict['total_products']
                },
                'changes': changes,
                'top_products': [dict(product) for product in top_products],
                'time_revenue': time_revenue
            }
        })
    except Exception as e:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při získávání statistik: {str(e)}'
        }), 500

# ===== PLACEHOLDER IMAGE =====
@app.route('/api/placeholder/<int:width>/<int:height>', methods=['GET'])
def placeholder_image(width, height):
    # Tvoří jednoduchý SVG obrázek jako placeholder
    svg = f'''
    <svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <line x1="0" y1="0" x2="{width}" y2="{height}" stroke="#ccc" stroke-width="1"/>
        <line x1="0" y1="{height}" x2="{width}" y2="0" stroke="#ccc" stroke-width="1"/>
        <text x="{width/2}" y="{height/2}" font-family="Arial" font-size="16" fill="#999" text-anchor="middle">{width}x{height}</text>
    </svg>
    '''
    
    response = make_response(svg)
    response.headers['Content-Type'] = 'image/svg+xml'
    return response

# ===== ADMINISTRACE SLEVOVÝCH KÓDŮ =====
@app.route('/api/coupons', methods=['GET'])
def get_coupons():
    """Získání všech slevových kódů"""
    conn = get_db_connection()
    coupons = conn.execute('''
    SELECT c.*, COUNT(cu.id) as usage_count_real
    FROM coupons c
    LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
    ''').fetchall()
    conn.close()
    
    return jsonify({
        'status': 'success',
        'coupons': [dict(coupon) for coupon in coupons]
    })

@app.route('/api/coupons/<int:coupon_id>', methods=['GET'])
def get_coupon(coupon_id):
    """Získání detailu slevového kódu"""
    conn = get_db_connection()
    coupon = conn.execute('SELECT * FROM coupons WHERE id = ?', (coupon_id,)).fetchone()
    
    if not coupon:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Slevový kód nenalezen'
        }), 404
    
    # Získání historie použití kupónu
    usage = conn.execute('''
    SELECT cu.*, c.name as customer_name, o.order_number
    FROM coupon_usage cu
    JOIN customers c ON cu.customer_id = c.id
    JOIN orders o ON cu.order_id = o.id
    WHERE cu.coupon_id = ?
    ORDER BY cu.used_at DESC
    ''', (coupon_id,)).fetchall()
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'coupon': dict(coupon),
        'usage': [dict(use) for use in usage]
    })

@app.route('/api/coupons', methods=['POST'])
def create_coupon():
    """Vytvoření nového slevového kódu"""
    data = request.get_json()
    
    # Validace dat
    required_fields = ['code', 'discount_type', 'discount_value']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'Chybí povinné pole: {field}'
            }), 400
    
    # Ověření, že code je ve velkých písmenech a bez mezer
    data['code'] = data['code'].strip().upper()
    
    conn = get_db_connection()
    try:
        # Kontrola, zda kód již existuje
        existing = conn.execute('SELECT id FROM coupons WHERE code = ?', (data['code'],)).fetchone()
        if existing:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Slevový kód s tímto kódem již existuje'
            }), 400
        
        # Příprava dat pro vložení
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO coupons (
            code, discount_type, discount_value, min_order_value, max_discount,
            description, one_per_customer, usage_limit, valid_from, valid_until, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['code'],
            data['discount_type'],
            data['discount_value'],
            data.get('min_order_value'),
            data.get('max_discount'),
            data.get('description', ''),
            data.get('one_per_customer', True),
            data.get('usage_limit'),
            data.get('valid_from'),
            data.get('valid_until'),
            data.get('active', True)
        ))
        
        coupon_id = cursor.lastrowid
        conn.commit()
        
        # Načtení vytvořeného kupónu
        coupon = conn.execute('SELECT * FROM coupons WHERE id = ?', (coupon_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Slevový kód byl úspěšně vytvořen',
            'coupon': dict(coupon)
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při vytváření slevového kódu: {str(e)}'
        }), 500

@app.route('/api/coupons/<int:coupon_id>', methods=['PUT'])
def update_coupon(coupon_id):
    """Aktualizace slevového kódu"""
    data = request.get_json()
    
    conn = get_db_connection()
    try:
        # Kontrola, zda kupón existuje
        coupon = conn.execute('SELECT * FROM coupons WHERE id = ?', (coupon_id,)).fetchone()
        if not coupon:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Slevový kód nenalezen'
            }), 404
        
        # Pokud se mění kód, ověřit, že nový kód ještě neexistuje
        if 'code' in data and data['code'] != coupon['code']:
            data['code'] = data['code'].strip().upper()
            existing = conn.execute(
                'SELECT id FROM coupons WHERE code = ? AND id != ?', 
                (data['code'], coupon_id)
            ).fetchone()
            
            if existing:
                conn.close()
                return jsonify({
                    'status': 'error',
                    'message': 'Slevový kód s tímto kódem již existuje'
                }), 400
        
        # Aktualizace kupónu
        conn.execute('''
        UPDATE coupons
        SET code = ?,
            discount_type = ?,
            discount_value = ?,
            min_order_value = ?,
            max_discount = ?,
            description = ?,
            one_per_customer = ?,
            usage_limit = ?,
            valid_from = ?,
            valid_until = ?,
            active = ?
        WHERE id = ?
        ''', (
            data.get('code', coupon['code']).strip().upper(),
            data.get('discount_type', coupon['discount_type']),
            data.get('discount_value', coupon['discount_value']),
            data.get('min_order_value', coupon['min_order_value']),
            data.get('max_discount', coupon['max_discount']),
            data.get('description', coupon['description']),
            data.get('one_per_customer', coupon['one_per_customer']),
            data.get('usage_limit', coupon['usage_limit']),
            data.get('valid_from', coupon['valid_from']),
            data.get('valid_until', coupon['valid_until']),
            data.get('active', coupon['active']),
            coupon_id
        ))
        
        conn.commit()
        
        # Načtení aktualizovaného kupónu
        updated_coupon = conn.execute('SELECT * FROM coupons WHERE id = ?', (coupon_id,)).fetchone()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Slevový kód byl úspěšně aktualizován',
            'coupon': dict(updated_coupon)
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při aktualizaci slevového kódu: {str(e)}'
        }), 500

@app.route('/api/coupons/<int:coupon_id>', methods=['DELETE'])
def delete_coupon(coupon_id):
    """Smazání slevového kódu"""
    conn = get_db_connection()
    try:
        # Kontrola, zda kupón existuje
        coupon = conn.execute('SELECT * FROM coupons WHERE id = ?', (coupon_id,)).fetchone()
        if not coupon:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Slevový kód nenalezen'
            }), 404
        
        # Kontrola, zda kupón nebyl použit
        usage = conn.execute('SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ?', (coupon_id,)).fetchone()
        if usage and usage['count'] > 0:
            # Místo smazání jen deaktivujeme
            conn.execute('UPDATE coupons SET active = 0 WHERE id = ?', (coupon_id,))
            conn.commit()
            conn.close()
            
            return jsonify({
                'status': 'success',
                'message': 'Slevový kód byl deaktivován, protože již byl použit'
            })
        
        # Smazání kupónu
        conn.execute('DELETE FROM coupons WHERE id = ?', (coupon_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'status': 'success',
            'message': 'Slevový kód byl úspěšně smazán'
        })
        
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při mazání slevového kódu: {str(e)}'
        }), 500

# Nové možnosti pro notifikaci o nových objednávkách
@app.route('/api/admin/recent-orders', methods=['GET'])
def get_recent_orders():
    """Získání nedávných objednávek pro notifikace"""
    # Získání časového limitu (výchozí: 24 hodin)
    hours = request.args.get('hours', 24, type=int)
    
    conn = get_db_connection()
    try:
        # Výpočet časového limitu
        time_limit = datetime.datetime.now() - datetime.timedelta(hours=hours)
        time_limit_str = time_limit.strftime('%Y-%m-%d %H:%M:%S')
        
        # Získání objednávek
        orders = conn.execute('''
        SELECT o.id, o.order_number, o.total, o.status, o.created_at,
               c.name as customer_name, c.email as customer_email
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        WHERE o.created_at >= ?
        ORDER BY o.created_at DESC
        ''', (time_limit_str,)).fetchall()
        
        # Vypočtení statistik
        stats = {
            'count': len(orders),
            'total_value': sum(order['total'] for order in orders),
            'new_count': sum(1 for order in orders if order['status'] == 'new'),
            'pending_count': sum(1 for order in orders if order['status'] in ['new', 'processing'])
        }
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'orders': [dict(order) for order in orders],
            'stats': stats
        })
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při získávání nedávných objednávek: {str(e)}'
        }), 500

# ===== API ENDPOINTY PRO E-SHOP =====

@app.route('/api/shop/create-order', methods=['POST'])
def create_shop_order():
    data = request.get_json()
    
    # Validace dat
    required_fields = ['customer', 'items', 'shipping', 'payment', 'total']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'status': 'error',
                'message': f'Chybí povinné pole: {field}'
            }), 400
    
    conn = get_db_connection()
    try:
        # Začátek transakce
        conn.execute('BEGIN')
        
        # Kontrola, zda zákazník již existuje
        customer_data = data['customer']
        customer = conn.execute('''
        SELECT * FROM customers
        WHERE email = ?
        ''', (customer_data['email'],)).fetchone()
        
        if customer:
            customer_id = customer['id']
            
            # Aktualizace informací o zákazníkovi
            conn.execute('''
            UPDATE customers
            SET name = ?,
                phone = ?,
                address = ?,
                city = ?,
                zip = ?,
                country = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (
                customer_data['name'],
                customer_data.get('phone', ''),
                customer_data.get('address', ''),
                customer_data.get('city', ''),
                customer_data.get('zip', ''),
                customer_data.get('country', 'Česká republika'),
                customer_id
            ))
        else:
            # Vytvoření nového zákazníka
            cursor = conn.cursor()
            cursor.execute('''
            INSERT INTO customers (name, email, phone, address, city, zip, country)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                customer_data['name'],
                customer_data['email'],
                customer_data.get('phone', ''),
                customer_data.get('address', ''),
                customer_data.get('city', ''),
                customer_data.get('zip', ''),
                customer_data.get('country', 'Česká republika')
            ))
            customer_id = cursor.lastrowid
        
        # Generování čísla objednávky
        now = datetime.datetime.now()
        date_part = now.strftime('%Y%m%d')
        
        # Zjistíme nejvyšší pořadové číslo pro aktuální den
        today_prefix = date_part + '%'
        last_order = conn.execute('''
        SELECT order_number FROM orders
        WHERE order_number LIKE ?
        ORDER BY order_number DESC LIMIT 1
        ''', (today_prefix,)).fetchone()
        
        if last_order:
            try:
                seq_num = int(last_order['order_number'][8:])
                new_seq_num = seq_num + 1
            except:
                new_seq_num = 1
        else:
            new_seq_num = 1
        
        order_number = f"{date_part}{new_seq_num:06d}"
        
        # Výpočet cen
        items = data['items']
        subtotal = sum(item['price'] * item['quantity'] for item in items)
        shipping_price = data['shipping']['price']
        payment_price = data['payment']['price']
        
        # Aplikace slevového kódu, pokud existuje
        applied_coupon = data.get('coupon', {})
        discount_amount = data.get('discount', 0)
        coupon_code = None
        
        if applied_coupon and 'code' in applied_coupon:
            coupon_code = applied_coupon['code']
            if discount_amount == 0:
                discount_amount = applied_coupon.get('discount', 0)
            
            # Ověření slevového kódu
            coupon = conn.execute('''
            SELECT * FROM coupons
            WHERE code = ? AND (usage_limit IS NULL OR usage_count < usage_limit)
            AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
            ''', (coupon_code,)).fetchone()
            
            if coupon:
                # Kontrola, zda uživatel již tento kód použil
                if coupon['one_per_customer']:
                    used_by_customer = conn.execute('''
                    SELECT COUNT(*) as count FROM coupon_usage
                    WHERE coupon_id = ? AND customer_id = ?
                    ''', (coupon['id'], customer_id)).fetchone()['count'] > 0
                    
                    if used_by_customer:
                        return jsonify({
                            'status': 'error',
                            'message': 'Tento slevový kód jste již použili'
                        }), 400
                
                # Výpočet slevy pokud nebyla explicitně poskytnuta
                if discount_amount == 0:
                    if coupon['discount_type'] == 'percentage':
                        discount_amount = round(subtotal * coupon['discount_value'] / 100)
                    else:  # fixed
                        discount_amount = coupon['discount_value']
                    
                    # Omezení slevy na maximální hodnotu
                    if coupon['max_discount'] and discount_amount > coupon['max_discount']:
                        discount_amount = coupon['max_discount']
                
                # Ensure discount doesn't exceed subtotal
                discount_amount = min(discount_amount, subtotal)
            else:
                if not data.get('skip_coupon_validation'):
                    return jsonify({
                        'status': 'error',
                        'message': 'Neplatný slevový kód'
                    }), 400
        
        # Výpočet celkové ceny - Ensure it's never negative
        total = max(0, subtotal + shipping_price + payment_price - discount_amount)
        
        # Uložení objednávky
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO orders (
            order_number,
            customer_id,
            subtotal,
            shipping_method,
            shipping_price,
            payment_method,
            payment_price,
            total,
            status,
            note,
            discount
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            order_number,
            customer_id,
            subtotal,
            data['shipping']['method'],
            shipping_price,
            data['payment']['method'],
            payment_price,
            total,
            'new',
            data.get('note', ''),
            discount_amount
        ))
        
        order_id = cursor.lastrowid
        
        # Uložení položek objednávky
        for item in data['items']:
            # Vyhledání produktu v databázi, pokud je k dispozici
            product_id = None
            if 'id' in item and item['id']:
                product = conn.execute('SELECT * FROM products WHERE id = ?', (item['id'],)).fetchone()
                if product:
                    product_id = product['id']
            
            conn.execute('''
            INSERT INTO order_items (
                order_id, product_id, name, variant, price, quantity, total
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                order_id,
                product_id,
                item.get('name', ''),
                item.get('variant', ''),
                item.get('price', 0),
                item.get('quantity', 1),
                item.get('price', 0) * item.get('quantity', 1)
            ))
        
        # Uložení informací o Zásilkovně, pokud byly vybrány
        branch_info = None
        if data['shipping']['method'] == 'zasilkovna' and 'branch' in data['shipping']:
            branch = data['shipping']['branch']
            
            if branch and 'id' in branch and 'name' in branch:
                conn.execute('''
                INSERT INTO order_shipping_details (
                    order_id,
                    branch_id,
                    branch_name,
                    branch_address
                ) VALUES (?, ?, ?, ?)
                ''', (
                    order_id,
                    branch['id'],
                    branch['name'],
                    branch.get('address', '')
                ))
                
                # Save branch info for response
                branch_info = {
                    'id': branch['id'],
                    'name': branch['name'],
                    'address': branch.get('address', '')
                }
        
        # Vytvoření faktury a odeslání emailu
        try:
            # Příprava dat pro vytvoření faktury
            order_dict = {
                'id': order_id,
                'order_number': order_number,
                'customer_id': customer_id,
                'subtotal': subtotal,
                'shipping_method': data['shipping']['method'],
                'shipping_price': shipping_price,
                'payment_method': data['payment']['method'],
                'payment_price': payment_price,
                'total': total,
                'status': 'new',
                'note': data.get('note', ''),
                'items': data['items'],
                'created_at': now.strftime('%Y-%m-%d %H:%M:%S'),
                'discount': discount_amount  # CRITICAL: Include discount
            }
            
            # Přidání informací o Zásilkovně, pokud existují
            if branch_info:
                order_dict['shipping'] = {
                    'method': data['shipping']['method'],
                    'price': shipping_price,
                    'branch': branch_info
                }
            
            # Vytvoření slovníku se zákaznickými údaji
            customer_dict = {
                'id': customer_id,
                'name': customer_data['name'],
                'email': customer_data['email'],
                'phone': customer_data.get('phone', ''),
                'address': customer_data.get('address', ''),
                'city': customer_data.get('city', ''),
                'zip': customer_data.get('zip', ''),
                'country': customer_data.get('country', 'Česká republika')
            }
            
            # Generování čísla faktury
            year = datetime.datetime.now().year
            invoice_prefix = get_settings().get('invoice_prefix', 'FV')
            
            # Získání posledního čísla faktury pro tento rok
            last_invoice = conn.execute('''
            SELECT invoice_number FROM invoices 
            WHERE invoice_number LIKE ? 
            ORDER BY id DESC LIMIT 1
            ''', (f"{invoice_prefix}{year}%",)).fetchone()
            
            if last_invoice:
                last_number = int(last_invoice['invoice_number'].replace(f"{invoice_prefix}{year}", ""))
                invoice_number = f"{invoice_prefix}{year}{(last_number + 1):04d}"
            else:
                invoice_number = f"{invoice_prefix}{year}0001"
            
            # Vytvoření PDF faktury
            file_path = generate_invoice_pdf(invoice_number, order_dict, customer_dict)
            
            # Uložení faktury do databáze
            cursor.execute('''
            INSERT INTO invoices (invoice_number, order_id, customer_id, amount, status, file_path)
            VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                invoice_number,
                order_id,
                customer_id,
                total,
                'issued',
                file_path
            ))
            
            invoice_id = cursor.lastrowid
            
            # Načtení vytvořené faktury
            invoice_info = conn.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,)).fetchone()
            
            if invoice_info:
                # Získání firemních údajů
                company_info = get_company_info()
                
                # Odeslání emailu s fakturou
                email_sent = send_invoice_email_direct(
                    dict(invoice_info),
                    file_path,
                    customer_dict,
                    order_dict,
                    company_info
                )
                
                if email_sent:
                    # Aktualizace stavu faktury v databázi
                    conn.execute('''
                    UPDATE invoices
                    SET status = 'sent'
                    WHERE id = ?
                    ''', (invoice_id,))
                    print(f"Email s fakturou úspěšně odeslán na {customer_dict['email']}")
                else:
                    print(f"Nepodařilo se odeslat email s fakturou na {customer_dict['email']}")
            else:
                print("Nepodařilo se najít vytvořenou fakturu v databázi")
                
        except Exception as e:
            # Logování chyby, ale nezrušení celé transakce
            print(f"Chyba při vytváření/odesílání faktury: {str(e)}")
            import traceback
            traceback.print_exc()
        
        # Commit transakce
        conn.commit()
        
        # Příprava odpovědi pro klienta
        response_data = {
            'status': 'success',
            'message': 'Objednávka byla úspěšně vytvořena',
            'order': {
                'id': order_id,
                'order_number': order_number,
                'total': total,
                'discount': discount_amount,
                'shipping': {
                    'method': data['shipping']['method'],
                    'price': shipping_price
                },
                'payment': {
                    'method': data['payment']['method'],
                    'price': payment_price
                }
            }
        }
        
        # Přidání informací o pobočce Zásilkovny, pokud jsou k dispozici
        if branch_info:
            response_data['order']['shipping']['branch'] = branch_info
        
        # Přidání odkazu na platební bránu, pokud je to platba kartou
        if data['payment']['method'] == 'card':
            # Zde by byla integrace s platební bránou
            response_data['payment_url'] = f"/payment/{order_number}"
        
        return jsonify(response_data)
        
    except Exception as e:
        conn.rollback()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při vytváření objednávky: {str(e)}'
        }), 500
    finally:
        conn.close()

@app.route('/api/shop/verify-coupon', methods=['POST'])
def verify_coupon():
    """
    Endpoint pro ověření platnosti slevového kódu
    """
    data = request.get_json()
    
    if 'code' not in data:
        return jsonify({
            'status': 'error',
            'message': 'Chybí kód kupónu'
        }), 400
    
    code = data['code'].strip().upper()
    subtotal = data.get('subtotal', 0)
    customer_email = data.get('customer_email', None)
    
    conn = get_db_connection()
    try:
        # Najdeme kupón podle kódu
        coupon = conn.execute('''
        SELECT * FROM coupons
        WHERE code = ? 
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND active = 1
        ''', (code,)).fetchone()
        
        if not coupon:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': 'Neplatný slevový kód'
            }), 404
        
        # Kontrola, zda kupón vyžaduje minimální částku
        if coupon['min_order_value'] and subtotal < coupon['min_order_value']:
            conn.close()
            return jsonify({
                'status': 'error',
                'message': f'Tento kód lze použít až od {coupon["min_order_value"]} Kč'
            }), 400
        
        # Kontrola, zda zákazník již kupón použil (pokud je omezení jeden na zákazníka)
        customer_id = None
        if customer_email and coupon['one_per_customer']:
            customer = conn.execute('SELECT id FROM customers WHERE email = ?', (customer_email,)).fetchone()
            if customer:
                customer_id = customer['id']
                
                used_by_customer = conn.execute('''
                SELECT COUNT(*) as count FROM coupon_usage
                WHERE coupon_id = ? AND customer_id = ?
                ''', (coupon['id'], customer_id)).fetchone()['count'] > 0
                
                if used_by_customer:
                    conn.close()
                    return jsonify({
                        'status': 'error',
                        'message': 'Tento slevový kód jste již použili'
                    }), 400
        
        # Výpočet slevy
        discount_amount = 0
        if coupon['discount_type'] == 'percentage':
            discount_amount = round(subtotal * coupon['discount_value'] / 100)
            discount_text = f"{coupon['discount_value']}%"
        else:  # fixed
            discount_amount = coupon['discount_value']
            discount_text = f"{coupon['discount_value']} Kč"
        
        # Omezení slevy na maximální hodnotu
        if coupon['max_discount'] and discount_amount > coupon['max_discount']:
            discount_amount = coupon['max_discount']
        
        # Formátování odpovědi
        coupon_info = {
            'code': coupon['code'],
            'type': coupon['discount_type'],
            'value': coupon['discount_value'],
            'discount': discount_amount,
            'description': coupon['description'] or discount_text
        }
        
        conn.close()
        return jsonify({
            'status': 'success',
            'message': 'Slevový kód byl úspěšně aplikován',
            'coupon': coupon_info
        })
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při ověřování kupónu: {str(e)}'
        }), 500

# Endpoint pro získání dostupných platebních a dopravních metod s cenami
@app.route('/api/shop/shipping-payment-methods', methods=['GET'])
def get_shipping_payment_methods():
    """
    Získání dostupných platebních a dopravních metod s aktuálními cenami
    """
    try:
        # Zde bychom mohli načítat dynamické ceny z databáze
        # Pro jednoduchost použijeme pevné hodnoty
        
        shipping_methods = [
            {
                'id': 'zasilkovna',
                'name': 'Zásilkovna',
                'description': 'Doručení na výdejní místo',
                'price': 79,
                'requires_branch': True,
                'estimated_delivery': '1-2 dny'
            },
            {
                'id': 'ppl',
                'name': 'PPL',
                'description': 'Doručení na adresu',
                'price': 89,
                'requires_branch': False,
                'estimated_delivery': '1-2 dny'
            },
            {
                'id': 'express',
                'name': 'Expresní doručení',
                'description': 'Doručení do 2 hodin (do 10 km od Brumov-Bylnice)',
                'price': 149,
                'requires_branch': False,
                'estimated_delivery': 'do 2 hodin'
            },
            {
                'id': 'pickup',
                'name': 'Osobní odběr',
                'description': 'Nedašov',
                'price': 0,
                'requires_branch': False,
                'estimated_delivery': 'Ihned k vyzvednutí'
            }
        ]
        
        payment_methods = [
            {
                'id': 'card',
                'name': 'Online platba kartou',
                'description': 'Rychlá a bezpečná platba',
                'price': 0,
                'compatible_with': ['zasilkovna', 'ppl', 'express', 'pickup']
            },
            {
                'id': 'bank',
                'name': 'Bankovní převod',
                'description': 'Platba předem na účet',
                'price': 0,
                'compatible_with': ['zasilkovna', 'ppl', 'express', 'pickup']
            },
            {
                'id': 'cod',
                'name': 'Dobírka',
                'description': 'Platba při převzetí',
                'price': 39,
                'compatible_with': ['zasilkovna', 'ppl', 'express']
            }
        ]
        
        return jsonify({
            'status': 'success',
            'shipping': shipping_methods,
            'payment': payment_methods
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Chyba při získávání metod dopravy a platby: {str(e)}'
        }), 500

# Endpoint pro získání dostupných produktů pro e-shop
@app.route('/api/shop/products', methods=['GET'])
def get_shop_products():
    """
    Získání dostupných produktů pro e-shop s filtrem na aktivní produkty a skladem
    """
    conn = get_db_connection()
    try:
        products = conn.execute('''
        SELECT id, code, name, description, price, type, variant, stock, featured
        FROM products
        WHERE stock > 0
        ORDER BY type, variant
        ''').fetchall()
        
        # Přeformátování dat pro frontend
        formatted_products = []
        for product in products:
            # Vytvoření URL s obrázkem na základě typu produktu
            image_url = f"/img/{product['type'].lower()}-kratom.jpg"
            
            # Formátování produktu
            formatted_product = {
                'id': product['id'],
                'name': product['name'],
                'variant': product['variant'],
                'price': product['price'],
                'description': product['description'],
                'type': product['type'],
                'stock': product['stock'],
                'image': image_url,
                'featured': bool(product['featured'])
            }
            
            # Extrakce numerické hodnoty a jednotky z varianty (např. "500g" -> 500, "g")
            import re
            match = re.match(r'(\d+)(\w+)', product['variant'])
            if match:
                value, unit = match.groups()
                formatted_product['weight'] = int(value)
                formatted_product['unit'] = unit
            
            formatted_products.append(formatted_product)
        
        conn.close()
        return jsonify({
            'status': 'success',
            'products': formatted_products
        })
        
    except Exception as e:
        if conn:
            conn.close()
        return jsonify({
            'status': 'error',
            'message': f'Chyba při získávání produktů: {str(e)}'
        }), 500

# ===== IMPORT/EXPORT =====

# Pomocná funkce pro překlad statusu do čitelného textu
def translate_status(status):
    """Převede kódový status na čitelný text"""
    status_map = {
        'new': 'Nová',
        'processing': 'Zpracovává se',
        'shipped': 'Odeslána',
        'completed': 'Dokončena',
        'cancelled': 'Zrušena'
    }
    return status_map.get(status, status)

@app.route('/api/export/orders', methods=['GET'])
def export_orders():
    """Export objednávek do CSV souboru"""
    # Parametry pro filtrování
    order_ids_param = request.args.get('order_ids')
    status = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    # Rozšířený základní dotaz s více údaji
    query = '''
    SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
           c.address AS customer_address, c.city AS customer_city, c.zip AS customer_zip,
           c.country AS customer_country
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE 1=1
    '''
    params = []
    
    # Přidání filtru pro ID objednávek, pokud existují
    if order_ids_param:
        order_ids = order_ids_param.split(',')
        placeholders = ', '.join(['?'] * len(order_ids))
        query += f' AND o.id IN ({placeholders})'
        params.extend(order_ids)
    
    # Přidání dalších filtrů
    if status and status != 'all':
        query += ' AND o.status = ?'
        params.append(status)
    
    if date_from:
        query += ' AND o.created_at >= ?'
        params.append(date_from)
    
    if date_to:
        query += ' AND o.created_at <= ?'
        params.append(date_to + ' 23:59:59')
    
    # Přidání řazení
    query += ' ORDER BY o.created_at DESC'
    
    conn = get_db_connection()
    orders = conn.execute(query, params).fetchall()
    
    # Vytvoření CSV souboru s rozšířenými sloupci
    csv_data = []
    header = [
        'ID', 'Číslo objednávky', 'Zákazník', 'Email', 'Telefon', 'Adresa', 'Město', 'PSČ', 'Země',
        'Položky', 'Datum vytvoření', 'Mezisoučet', 'Doprava cena', 'Platba cena', 'Celková cena', 
        'Status', 'Doprava metoda', 'Platba metoda', 'Poznámka zákazníka', 'Interní poznámka'
    ]
    csv_data.append(header)
    
    for order in orders:
        # Získání položek objednávky
        items = conn.execute('''
        SELECT * FROM order_items WHERE order_id = ?
        ''', (order['id'],)).fetchall()
        
        # Sestavení řetězce s položkami (včetně cen)
        items_str = ", ".join([f"{item['name']} {item['variant']} ({item['price']} Kč) x{item['quantity']}" for item in items])
        
        # Status převod na čitelný text (bez HTML)
        status_text = translate_status(order['status'])
        
        # Získání interních poznámek z tabulky order_notes - podle přesné struktury tabulky
        admin_notes_query = '''
        SELECT id, order_id, admin_name, note_text, created_at
        FROM order_notes 
        WHERE order_id = ? 
        ORDER BY created_at DESC
        '''
        admin_notes = conn.execute(admin_notes_query, (order['id'],)).fetchall()
        
        # Sestavení textu interních poznámek
        admin_note_list = []
        for note in admin_notes:
            try:
                # Formátování data - převod z YYYY-MM-DD HH:MM:SS na DD.MM.YYYY
                date_str = note['created_at']
                if date_str:
                    try:
                        # Parsování datumu
                        date_parts = date_str.split(' ')[0].split('-')
                        if len(date_parts) == 3:
                            year, month, day = date_parts
                            date_str = f"{day}.{month}.{year}"
                    except:
                        # Při chybě použijeme původní formát
                        pass
                
                # Sestavení formátované poznámky: datum (admin): text
                note_text = note['note_text'] if note['note_text'] else ""
                admin_name = note['admin_name'] if note['admin_name'] else ""
                
                if date_str and admin_name and note_text:
                    admin_note_list.append(f"{date_str} ({admin_name}): {note_text}")
                elif admin_name and note_text:
                    admin_note_list.append(f"({admin_name}): {note_text}")
                elif note_text:
                    admin_note_list.append(note_text)
            except Exception as e:
                print(f"Chyba při zpracování poznámky: {e}")
                continue
        
        # Spojíme všechny poznámky do jednoho textu odděleného |
        admin_note_text = " | ".join(admin_note_list)
        
        # Přidání řádku s objednávkou - rozšířená verze
        row = [
            order['id'],
            order['order_number'],
            order['customer_name'],
            order['customer_email'],
            order['customer_phone'] or '',
            order['customer_address'] or '',
            order['customer_city'] or '',
            order['customer_zip'] or '',
            order['customer_country'] or '',
            items_str,
            order['created_at'],
            f"{order['subtotal']:.2f}",  # Mezisoučet jako samostatné pole
            f"{order['shipping_price']:.2f}",  # Cena dopravy jako samostatné pole
            f"{order['payment_price']:.2f}",  # Cena platby jako samostatné pole
            f"{order['total']:.2f}",  # Celková cena bez textu "Kč"
            status_text,
            get_shipping_method_text(order['shipping_method']),
            get_payment_method_text(order['payment_method']),
            order['note'] or '',
            admin_note_text  # Přidána interní poznámka z tabulky order_notes
        ]
        csv_data.append(row)
    
    conn.close()
    
    # Vytvoření CSV souboru
    import io
    import csv
    
    output = io.StringIO()  # Použijeme StringIO místo BytesIO pro textové operace
    
    # Vytvoření CSV writeru s českým oddělovačem
    writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # Zápis všech řádků
    for row in csv_data:
        writer.writerow(row)
    
    # Převod na bytes a přidání BOM pro UTF-8
    csv_bytes = output.getvalue().encode('utf-8-sig')
    
    # Vytvoření odpovědi
    response = make_response(csv_bytes)
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    response.headers['Content-Disposition'] = 'attachment; filename=objednavky.csv'
    return response

@app.route('/api/import/orders', methods=['POST'])
def import_orders():
    """
    Importuje objednávky z CSV souboru
    Formát CSV by měl odpovídat exportu ze systému
    """
    # Kontrola, zda byl odeslán soubor
    if 'file' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'Nebyl vybrán žádný soubor'
        }), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': 'Nebyl vybrán žádný soubor'
        }), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({
            'status': 'error',
            'message': 'Je podporován pouze formát CSV'
        }), 400
    
    # Získání možností importu
    update_existing = request.form.get('update_existing', 'false').lower() in ('true', '1', 'yes', 'y')
    create_missing = request.form.get('create_missing', 'false').lower() in ('true', '1', 'yes', 'y')
    
    if not update_existing and not create_missing:
        return jsonify({
            'status': 'error',
            'message': 'Vyberte alespoň jednu možnost importu'
        }), 400
    
    # Uložení souboru
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(file_path)
    
    # Zpracování CSV souboru
    try:
        # Statistiky importu
        stats = {
            'updated': 0,
            'created': 0,
            'skipped': 0,
            'errors': 0
        }
        
        conn = get_db_connection()
        conn.execute('BEGIN')
        
        with open(file_path, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile, delimiter=';')
            
            for row in reader:
                try:
                    # Kontrola, zda objednávka existuje
                    order_number = row.get('Číslo objednávky') or row.get('ID')
                    if not order_number:
                        stats['errors'] += 1
                        continue
                    
                    existing_order = conn.execute(
                        'SELECT * FROM orders WHERE order_number = ?', 
                        (order_number,)
                    ).fetchone()
                    
                    if existing_order and update_existing:
                        # Aktualizace existující objednávky
                        update_order_from_csv(conn, existing_order, row)
                        stats['updated'] += 1
                    elif not existing_order and create_missing:
                        # Vytvoření nové objednávky
                        create_order_from_csv(conn, row)
                        stats['created'] += 1
                    else:
                        # Přeskočení objednávky
                        stats['skipped'] += 1
                except Exception as e:
                    print(f"Chyba při importu řádku: {e}")
                    stats['errors'] += 1
        
        conn.commit()
        conn.close()
        
        # Sestavení zprávy o výsledku
        message = f"Import byl dokončen: "
        details = []
        
        if stats['updated'] > 0:
            details.append(f"aktualizováno {stats['updated']} objednávek")
        if stats['created'] > 0:
            details.append(f"vytvořeno {stats['created']} nových objednávek")
        if stats['skipped'] > 0:
            details.append(f"přeskočeno {stats['skipped']} objednávek")
        if stats['errors'] > 0:
            details.append(f"chyba u {stats['errors']} objednávek")
        
        message += ", ".join(details)
        
        return jsonify({
            'status': 'success',
            'message': message,
            'stats': stats
        })
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        
        return jsonify({
            'status': 'error',
            'message': f'Chyba při importu objednávek: {str(e)}'
        }), 500
    finally:
        # Odstranění souboru
        if os.path.exists(file_path):
            os.remove(file_path)

def update_order_from_csv(conn, existing_order, row):
    """
    Aktualizace existující objednávky z řádku CSV
    """
    # Mapování sloupců CSV na sloupce v databázi
    status_map = {
        'Nová': 'new',
        'Zpracovává se': 'processing',
        'Odeslána': 'shipped',
        'Dokončena': 'completed',
        'Zrušena': 'cancelled'
    }
    
    # Získání hodnot z CSV - rozšířená verze
    status = status_map.get(row.get('Status'), existing_order['status'])
    note = row.get('Poznámka zákazníka', existing_order['note'] or '')
    
    # Zpracování interních poznámek - nyní budeme ukládat do tabulky order_notes
    internal_notes = row.get('Interní poznámka', '')
    
    # Zpracování cen - důležité při importu
    try:
        # Zkusit získat ceny z CSV
        subtotal = float(row.get('Mezisoučet', '0').replace(',', '.').replace(' Kč', ''))
        shipping_price = float(row.get('Doprava cena', '0').replace(',', '.').replace(' Kč', ''))
        payment_price = float(row.get('Platba cena', '0').replace(',', '.').replace(' Kč', ''))
        total = float(row.get('Celková cena', '0').replace(',', '.').replace(' Kč', ''))
    except:
        # Pokud nelze získat ceny, ponecháme původní hodnoty
        subtotal = existing_order['subtotal']
        shipping_price = existing_order['shipping_price']
        payment_price = existing_order['payment_price']
        total = existing_order['total']
    
    # Aktualizace objednávky bez admin_note
    update_sql = '''
    UPDATE orders
    SET status = ?,
        note = ?,
        subtotal = ?,
        shipping_price = ?,
        payment_price = ?,
        total = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    '''
    
    params = (
        status, 
        note, 
        subtotal, 
        shipping_price, 
        payment_price, 
        total, 
        existing_order['id']
    )
    
    # Aktualizace objednávky
    conn.execute(update_sql, params)
    
    # Zpracování interních poznámek
    if internal_notes:
        # Získáme informace o aktuálním uživateli pro zápis poznámek
        admin_id = 1  # Výchozí hodnota, ideálně bychom měli získat ID aktuálního admin uživatele
        admin_name = "Admin"  # Výchozí hodnota
        
        try:
            # Zkusíme získat informace o aktuálním uživateli ze session
            if 'user_id' in session:
                admin_id = session['user_id']
            if 'name' in session:
                admin_name = session['name']
        except:
            pass
        
        # Rozdělení poznámek podle oddělovače |
        note_parts = internal_notes.split('|')
        
        for note_part in note_parts:
            note_text = note_part.strip()
            if not note_text:
                continue
            
            # Extrahování data a autora, pokud jsou ve formátu "DD.MM.YYYY (autor): text"
            date_str = None
            author = None
            extracted_text = note_text
            
            # Pokus o extrakci data a autora
            import re
            date_author_match = re.match(r'(\d{1,2}\.\d{1,2}\.\d{4})\s*\(([^)]+)\):\s*(.*)', note_text)
            if date_author_match:
                date_str = date_author_match.group(1)
                author = date_author_match.group(2)
                extracted_text = date_author_match.group(3)
            
            # Pokud máme extrahované datum, převedeme ho na formát YYYY-MM-DD
            created_at = None
            if date_str:
                try:
                    day, month, year = date_str.split('.')
                    created_at = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                except:
                    created_at = None
            
            # Pokud máme extrahovaného autora, použijeme ho
            if author:
                admin_name = author
            
            # Přidání poznámky do tabulky order_notes
            insert_note_sql = '''
            INSERT INTO order_notes (order_id, admin_id, admin_name, note_text, created_at)
            VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            '''
            
            conn.execute(insert_note_sql, (
                existing_order['id'],
                admin_id,
                admin_name,
                extracted_text,
                created_at
            ))
    
    # Kontrola, zda existují položky v CSV
    items_str = row.get('Položky', '')
    if items_str:
        # Zkontrolujeme stávající položky - můžeme je odstranit a vytvořit nové
        conn.execute('DELETE FROM order_items WHERE order_id = ?', (existing_order['id'],))
        
        # Přidání nových položek
        items = items_str.split(',')
        for item_str in items:
            try:
                # Zpracování položky formátu "Název Varianta (Cena Kč) xPočet"
                # nebo "Název Varianta xPočet"
                
                # Rozdělení na části podle "x"
                parts = item_str.strip().split('x')
                if len(parts) < 2:
                    continue
                
                # Poslední část je množství
                quantity = int(parts[-1].strip())
                
                # Spojení zbytku jako název+varianta+cena
                name_variant_price = ''.join(parts[:-1]).strip()
                
                # Extrakce ceny, pokud existuje
                price = 0
                if '(' in name_variant_price and ')' in name_variant_price:
                    price_part = name_variant_price.split('(')[-1].split(')')[0]
                    try:
                        price = float(price_part.replace('Kč', '').strip().replace(',', '.'))
                        name_variant_price = name_variant_price.split('(')[0].strip()
                    except:
                        pass
                
                # Rozdělení na název a variantu
                if ' - ' in name_variant_price:
                    name_variant_parts = name_variant_price.split(' - ')
                    name = name_variant_parts[0].strip()
                    variant = name_variant_parts[1].strip()
                else:
                    name = name_variant_price
                    variant = ''
                
                # Hledání produktu v databázi
                product = conn.execute('''
                SELECT * FROM products
                WHERE name = ? AND variant = ?
                ''', (name, variant)).fetchone()
                
                product_id = product['id'] if product else None
                
                # Pokud nemáme cenu z CSV, zkusíme ji získat z produktu
                if price == 0 and product:
                    price = product['price']
                
                total_item = price * quantity
                
                # Přidání položky objednávky
                conn.execute('''
                INSERT INTO order_items (
                    order_id, product_id, name, variant, price, quantity, total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    existing_order['id'],
                    product_id,
                    name,
                    variant,
                    price,
                    quantity,
                    total_item
                ))
            except Exception as e:
                print(f"Chyba při zpracování položky {item_str}: {e}")
    
    return True

def create_order_from_csv(conn, row):
    """
    Vytvoření nové objednávky z řádku CSV
    """
    # Mapování stavů, dopravy a plateb
    status_map = {
        'Nová': 'new',
        'Zpracovává se': 'processing',
        'Odeslána': 'shipped',
        'Dokončena': 'completed',
        'Zrušena': 'cancelled'
    }
    
    shipping_map = {
        'Zásilkovna': 'zasilkovna',
        'PPL': 'ppl',
        'Exkluzivní doručení': 'express',
        'Osobní odběr': 'personal'
    }
    
    payment_map = {
        'Online platba kartou': 'card',
        'Bankovní převod': 'bank',
        'Dobírka': 'cod'
    }
    
    # Získání hodnot z CSV - rozšířená verze
    order_number = row.get('Číslo objednávky') or row.get('ID')
    customer_name = row.get('Zákazník', '')
    customer_email = row.get('Email', '')
    customer_phone = row.get('Telefon', '')
    customer_address = row.get('Adresa', '')
    
    # Zpracování adresy
    customer_city = row.get('Město', '')
    customer_zip = row.get('PSČ', '')
    customer_country = row.get('Země', 'Česká republika')
    
    # Pokud nemáme přímo město a PSČ, zkusíme je získat z adresy
    if not customer_city or not customer_zip:
        address_parts = customer_address.split(',')
        if len(address_parts) > 1 and not customer_city:
            customer_city = address_parts[1].strip()
        if len(address_parts) > 2 and not customer_zip:
            zipcode_country = address_parts[2].strip()
            if '-' in zipcode_country:
                zipcode_country_parts = zipcode_country.split('-')
                customer_zip = zipcode_country_parts[0].strip()
                if not customer_country and len(zipcode_country_parts) > 1:
                    customer_country = zipcode_country_parts[1].strip()
            else:
                customer_zip = zipcode_country
    
    # Zpracování cen z CSV - přímá podpora pro jednotlivé ceny
    try:
        subtotal = float(row.get('Mezisoučet', '0').replace(',', '.').replace(' Kč', ''))
    except:
        subtotal = 0
        
    try:
        shipping_price = float(row.get('Doprava cena', '0').replace(',', '.').replace(' Kč', ''))
    except:
        shipping_price = 0
        
    try:
        payment_price = float(row.get('Platba cena', '0').replace(',', '.').replace(' Kč', ''))
    except:
        payment_price = 0
        
    try:
        total = float(row.get('Celková cena', '0').replace(',', '.').replace(' Kč', ''))
    except:
        # Pokud nemáme celkovou cenu, vypočítáme ji
        total = subtotal + shipping_price + payment_price
    
    # Pokud nemáme mezisoučet, vypočítáme ho z celkové ceny
    if subtotal == 0 and total > 0:
        subtotal = total - shipping_price - payment_price
        if subtotal < 0:
            subtotal = total
    
    # Získání údajů o dopravě a platbě
    shipping_text = row.get('Doprava metoda', '')
    shipping_method = shipping_map.get(shipping_text, 'zasilkovna')
    
    payment_text = row.get('Platba metoda', '')
    payment_method = payment_map.get(payment_text, 'bank')
    
    # Datum vytvoření - oprava formátu času
    created_at = row.get('Datum vytvoření', '')
    if not created_at:
        created_at = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    else:
        # Zkusíme zpracovat datum v různých formátech
        try:
            # Pokud je datum už ve správném formátu, necháme ho být
            if not ' ' in created_at or not ':' in created_at:
                # Pokud nemá čas, přidáme aktuální čas
                created_at = f"{created_at} {datetime.datetime.now().strftime('%H:%M:%S')}"
        except:
            # Při problému použijeme aktuální datum a čas
            created_at = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # Status objednávky
    status = status_map.get(row.get('Status', ''), 'new')
    
    # Poznámky
    note = row.get('Poznámka zákazníka', '')
    internal_notes = row.get('Interní poznámka', '')
    
    # Nejdříve zkontrolujeme/vytvoříme zákazníka
    customer = conn.execute('''
    SELECT * FROM customers
    WHERE email = ? AND name = ?
    ''', (customer_email, customer_name)).fetchone()
    
    if customer:
        customer_id = customer['id']
        
        # Aktualizace informací o zákazníkovi, pokud jsou v importu podrobnější
        if customer_phone or customer_address or customer_city or customer_zip:
            conn.execute('''
            UPDATE customers
            SET phone = CASE WHEN ? != '' THEN ? ELSE phone END,
                address = CASE WHEN ? != '' THEN ? ELSE address END,
                city = CASE WHEN ? != '' THEN ? ELSE city END,
                zip = CASE WHEN ? != '' THEN ? ELSE zip END,
                country = CASE WHEN ? != '' THEN ? ELSE country END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (
                customer_phone, customer_phone,
                customer_address, customer_address,
                customer_city, customer_city,
                customer_zip, customer_zip,
                customer_country, customer_country,
                customer_id
            ))
    else:
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO customers (name, email, phone, address, city, zip, country)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            customer_name,
            customer_email,
            customer_phone,
            customer_address,
            customer_city,
            customer_zip,
            customer_country
        ))
        customer_id = cursor.lastrowid
    
    # Vytvoření objednávky bez sloupce admin_note
    insert_sql = '''
    INSERT INTO orders (
        order_number, customer_id, subtotal, shipping_method, shipping_price,
        payment_method, payment_price, total, status, note, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    params = (
        order_number,
        customer_id,
        subtotal,
        shipping_method,
        shipping_price,
        payment_method,
        payment_price,
        total,
        status,
        note,
        created_at
    )
    
    # Vytvoření objednávky
    cursor = conn.cursor()
    cursor.execute(insert_sql, params)
    
    order_id = cursor.lastrowid
    
    # Zpracování interních poznámek - ukládání do tabulky order_notes
    if internal_notes:
        # Získáme informace o aktuálním uživateli pro zápis poznámek
        admin_id = 1  # Výchozí hodnota, ideálně bychom měli získat ID aktuálního admin uživatele
        admin_name = "Admin"  # Výchozí hodnota
        
        try:
            # Zkusíme získat informace o aktuálním uživateli ze session
            if 'user_id' in session:
                admin_id = session['user_id']
            if 'name' in session:
                admin_name = session['name']
        except:
            pass
        
        # Rozdělení poznámek podle oddělovače |
        note_parts = internal_notes.split('|')
        
        for note_part in note_parts:
            note_text = note_part.strip()
            if not note_text:
                continue
            
            # Extrahování data a autora, pokud jsou ve formátu "DD.MM.YYYY (autor): text"
            date_str = None
            author = None
            extracted_text = note_text
            
            # Pokus o extrakci data a autora
            import re
            date_author_match = re.match(r'(\d{1,2}\.\d{1,2}\.\d{4})\s*\(([^)]+)\):\s*(.*)', note_text)
            if date_author_match:
                date_str = date_author_match.group(1)
                author = date_author_match.group(2)
                extracted_text = date_author_match.group(3)
            
            # Pokud máme extrahované datum, převedeme ho na formát YYYY-MM-DD
            created_at = None
            if date_str:
                try:
                    day, month, year = date_str.split('.')
                    created_at = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                except:
                    created_at = None
            
            # Pokud máme extrahovaného autora, použijeme ho
            if author:
                admin_name = author
            
            # Přidání poznámky do tabulky order_notes
            insert_note_sql = '''
            INSERT INTO order_notes (order_id, admin_id, admin_name, note_text, created_at)
            VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
            '''
            
            conn.execute(insert_note_sql, (
                order_id,
                admin_id,
                admin_name,
                extracted_text,
                created_at
            ))
    
    # Zpracování položek objednávky
    items_str = row.get('Položky', '')
    if items_str:
        items = items_str.split(',')
        for item_str in items:
            try:
                # Zpracování položky formátu "Název Varianta (Cena Kč) xPočet"
                # nebo "Název Varianta xPočet"
                
                # Rozdělení na části podle "x"
                parts = item_str.strip().split('x')
                if len(parts) < 2:
                    continue
                
                # Poslední část je množství
                quantity = int(parts[-1].strip())
                
                # Spojení zbytku jako název+varianta+cena
                name_variant_price = ''.join(parts[:-1]).strip()
                
                # Extrakce ceny, pokud existuje
                price = 0
                if '(' in name_variant_price and ')' in name_variant_price:
                    price_part = name_variant_price.split('(')[-1].split(')')[0]
                    try:
                        price = float(price_part.replace('Kč', '').strip().replace(',', '.'))
                        name_variant_price = name_variant_price.split('(')[0].strip()
                    except:
                        pass
                
                # Rozdělení na název a variantu
                if ' - ' in name_variant_price:
                    name_variant_parts = name_variant_price.split(' - ')
                    name = name_variant_parts[0].strip()
                    variant = name_variant_parts[1].strip()
                else:
                    name = name_variant_price
                    variant = ''
                
                # Hledání produktu v databázi
                product = conn.execute('''
                SELECT * FROM products
                WHERE name = ? AND variant = ?
                ''', (name, variant)).fetchone()
                
                product_id = product['id'] if product else None
                
                # Pokud nemáme cenu z CSV, zkusíme ji získat z produktu
                if price == 0 and product:
                    price = product['price']
                
                total_item = price * quantity
                
                # Přidání položky objednávky
                conn.execute('''
                INSERT INTO order_items (
                    order_id, product_id, name, variant, price, quantity, total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    order_id,
                    product_id,
                    name,
                    variant,
                    price,
                    quantity,
                    total_item
                ))
            except Exception as e:
                print(f"Chyba při zpracování položky {item_str}: {e}")
    
    return True

@app.route('/api/export/products', methods=['GET'])
def export_products():
    """Export produktů do CSV souboru"""
    conn = get_db_connection()
    products = conn.execute('SELECT * FROM products ORDER BY name, variant').fetchall()
    conn.close()
    
    # Vytvoření CSV souboru
    csv_data = []
    header = [
        'ID', 'Kód', 'Název', 'Popis', 'Cena', 'Typ', 'Varianta', 'Skladem', 'Doporučeno'
    ]
    csv_data.append(header)
    
    for product in products:
        row = [
            product['id'],
            product['code'],
            product['name'],
            product['description'] or '',
            product['price'],
            product['type'],
            product['variant'],
            product['stock'],
            'Ano' if product['featured'] else 'Ne'
        ]
        csv_data.append(row)
    
    # Vytvoření CSV souboru
    import io
    import csv
    
    output = io.StringIO()
    
    # Nastavení pro české znaky
    output.write('\ufeff')  # UTF-8 BOM
    
    writer = csv.writer(output, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    for row in csv_data:
        writer.writerow(row)
    
    output.seek(0)
    
    # Vytvoření odpovědi
    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv; charset=utf-8'
    response.headers['Content-Disposition'] = 'attachment; filename=produkty.csv'
    return response

@app.route('/api/import/products', methods=['POST'])
def import_products():
    """Import produktů z CSV souboru"""
    # Kontrola, zda byl odeslán soubor
    if 'file' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'Nebyl vybrán žádný soubor'
        }), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': 'Nebyl vybrán žádný soubor'
        }), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({
            'status': 'error',
            'message': 'Je podporován pouze formát CSV'
        }), 400
    
    # Uložení souboru
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(file_path)
    
    # Zpracování CSV souboru
    try:
        products_to_add = []
        products_to_update = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile, delimiter=';')
            
            for row in reader:
                # Kontrola povinných polí
                required_fields = ['Název', 'Cena', 'Typ', 'Varianta']
                if not all(field in row for field in required_fields):
                    continue
                
                product = {
                    'name': row['Název'],
                    'price': float(str(row['Cena']).replace(',', '.').replace(' ', '')),
                    'type': row['Typ'],
                    'variant': row['Varianta'],
                    'description': row.get('Popis', ''),
                    'stock': int(row.get('Skladem', 0)),
                    'featured': 1 if row.get('Doporučeno', '').lower() in ['ano', 'yes', '1', 'true'] else 0
                }
                
                # Přidání kódu, pokud existuje
                if 'Kód' in row and row['Kód']:
                    product['code'] = row['Kód']
                else:
                    product['code'] = f"{product['type'].upper()}{product['variant'].replace('g', '').replace('kg', '000')}"
                
                # Kontrola, zda produkt existuje podle kódu
                conn = get_db_connection()
                existing_product = conn.execute('SELECT * FROM products WHERE code = ?', (product['code'],)).fetchone()
                conn.close()
                
                if existing_product:
                    product['id'] = existing_product['id']
                    products_to_update.append(product)
                else:
                    products_to_add.append(product)
        
        # Import do databáze
        conn = get_db_connection()
        conn.execute('BEGIN')
        
        # Přidání nových produktů
        for product in products_to_add:
            conn.execute('''
            INSERT INTO products (code, name, description, price, type, variant, stock, featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                product['code'],
                product['name'],
                product['description'],
                product['price'],
                product['type'],
                product['variant'],
                product['stock'],
                product['featured']
            ))
        
        # Aktualizace existujících produktů
        for product in products_to_update:
            conn.execute('''
            UPDATE products
            SET name = ?, description = ?, price = ?, type = ?, variant = ?,
                stock = ?, featured = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''', (
                product['name'],
                product['description'],
                product['price'],
                product['type'],
                product['variant'],
                product['stock'],
                product['featured'],
                product['id']
            ))
        
        conn.commit()
        conn.close()
        
        # Smazání souboru
        os.remove(file_path)
        
        return jsonify({
            'status': 'success',
            'message': f'Import byl úspěšně dokončen. Přidáno {len(products_to_add)} nových produktů, aktualizováno {len(products_to_update)} produktů.'
        })
    except Exception as e:
        # Smazání souboru v případě chyby
        if os.path.exists(file_path):
            os.remove(file_path)
        
        return jsonify({
            'status': 'error',
            'message': f'Chyba při importu produktů: {str(e)}'
        }), 500

# ===== Sekce stahování faktury =====    

# Přidat novou funkci pro generování zabezpečeného tokenu pro fakturu
def generate_invoice_token(invoice_number, order_number, expiration=3600):

    # Aktuální timestamp
    current_time = int(time.time())
    expiration_time = current_time + expiration
    
    # Data, která budou v tokenu
    data = f"{invoice_number}:{order_number}:{expiration_time}"
    
    # Vytvoření HMAC podpisu pomocí secret key aplikace
    secret = app.config['SECRET_KEY'].encode('utf-8')
    signature = hmac.new(secret, data.encode('utf-8'), hashlib.sha256).hexdigest()
    
    # Vrátíme token ve formátu data:signature
    token = f"{data}:{signature}"
    
    return {
        'token': token,
        'expires': expiration_time
    }

def verify_invoice_token(token, invoice_number):
    try:
        # Rozdělení tokenu na data a podpis
        token_parts = token.split(':')
        if len(token_parts) < 4:
            return False
        
        # Extrakce dat z tokenu
        token_invoice_number = token_parts[0]
        token_order_number = token_parts[1]
        expiration_time = int(token_parts[2])
        signature = token_parts[3]
        
        # Kontrola, zda token patří k požadované faktuře
        if token_invoice_number != invoice_number:
            return False
        
        # Kontrola expirace tokenu
        current_time = int(time.time())
        if current_time > expiration_time:
            return False
        
        # Ověření podpisu
        data = f"{token_invoice_number}:{token_order_number}:{expiration_time}"
        secret = app.config['SECRET_KEY'].encode('utf-8')
        expected_signature = hmac.new(secret, data.encode('utf-8'), hashlib.sha256).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    except Exception:
        return False

# Upravená funkce pro stahování faktury s ověřením tokenu
@app.route('/api/invoices/<string:invoice_number>/download', methods=['GET'])
def secure_download_invoice(invoice_number):
    conn = get_db_connection()
    invoice = conn.execute('SELECT * FROM invoices WHERE invoice_number = ?', (invoice_number,)).fetchone()
    conn.close()
    
    if not invoice:
        return jsonify({
            'status': 'error',
            'message': 'Faktura nenalezena'
        }), 404
    
    file_path = invoice['file_path']
    
    if not os.path.exists(file_path):
        return jsonify({
            'status': 'error',
            'message': 'Soubor faktury nenalezen'
        }), 404
    
    try:
        # Bezpečné stažení faktury pomocí send_from_directory
        response = send_from_directory(
            os.path.dirname(file_path),
            os.path.basename(file_path),
            as_attachment=True,
            download_name=f"Faktura-{invoice_number}.pdf"
        )
        
        # Důležité: Přidání CORS hlaviček pro umožnění stahování z jiného portu
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        
        # Hlavičky proti cache
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
    
    except Exception as e:
        print(f"Chyba při stahování faktury: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Chyba při stahování faktury: {str(e)}'
        }), 500

@app.route('/api/invoices/<string:invoice_number>/download', methods=['OPTIONS'])
def invoice_download_options(invoice_number):
    # Odpověď na OPTIONS požadavek pro CORS preflight
    response = make_response()
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Nový endpoint pro generování tokenu pro stažení faktury
@app.route('/api/invoices/<string:invoice_number>/get-download-token', methods=['POST'])
def get_invoice_download_token(invoice_number):
    # Kontrola, zda faktura existuje a patří k objednávce zákazníka
    data = request.get_json()
    order_number = data.get('order_number')
    
    if not order_number:
        return jsonify({
            'status': 'error',
            'message': 'Chybí číslo objednávky'
        }), 400
    
    conn = get_db_connection()
    
    # Ověření, že faktura patří k uvedené objednávce
    invoice_order = conn.execute('''
    SELECT i.*, o.order_number 
    FROM invoices i
    JOIN orders o ON i.order_id = o.id
    WHERE i.invoice_number = ? AND o.order_number = ?
    ''', (invoice_number, order_number)).fetchone()
    
    conn.close()
    
    if not invoice_order:
        return jsonify({
            'status': 'error',
            'message': 'Faktura nenalezena nebo nepatří k uvedené objednávce'
        }), 404
    
    # Generování tokenu (platnost 1 hodina)
    token_data = generate_invoice_token(invoice_number, order_number)
    
    return jsonify({
        'status': 'success',
        'token': token_data['token'],
        'expires': token_data['expires']
    })

# ===== SPUŠTĚNÍ APLIKACE =====
if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)