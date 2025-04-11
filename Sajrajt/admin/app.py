import os
import json
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
app.config['SECRET_KEY'] = '*******'
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = datetime.timedelta(days=30)
app.config['SESSION_COOKIE_SECURE'] = False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None' 
app.config['SESSION_COOKIE_DOMAIN'] = None 
app.config['WTF_CSRF_ENABLED'] = False
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
    
    # Sestavení cesty k souboru
    file_path = os.path.join(app.config['INVOICES_FOLDER'], f"{invoice_number}.pdf")
    
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
    
    # Nastavení metadat PDF
    p.setAuthor(company_info['name'])
    p.setTitle(f"Faktura {invoice_number}")
    p.setSubject(f"Faktura za objednávku {order['order_number']}")
    
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
    
    # Číslo faktury
    if fonts_registered:
        p.setFont("Roboto-Bold", 16)
    else:
        p.setFont("Helvetica-Bold", 16)
    p.drawString(width - 190, height - 40, f"Faktura {invoice_number}")
    
    # Horní horizontální čára
    p.setStrokeColor(colors.black)
    p.line(40, height - 85, width - 50, height - 85)
    
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
    
    # Sekce Dodavatel
    draw_czech_text(p, 40, height - 105, "DODAVATEL", size=9, style='medium')
    draw_czech_text(p, 40, height - 125, company_info['name'], size=12, style='bold')
    draw_czech_text(p, 40, height - 145, company_info['address'], style='regular')
    draw_czech_text(p, 40, height - 160, f"{company_info['zip']} {company_info['city']}", style='regular')
    
    # IČO
    draw_czech_text(p, 40, height - 185, "IČO", style='bold')
    draw_czech_text(p, 200, height - 185, company_info['ico'], style='medium')
    
    # Neplátce DPH
    draw_czech_text(p, 40, height - 200, "Neplátce DPH", style='bold')
    
    # Bankovní údaje
    draw_czech_text(p, 40, height - 225, "Bankovní účet", style='bold')
    draw_czech_text(p, 200, height - 225, company_info['bank_account'], style='medium')
    
    draw_czech_text(p, 40, height - 240, "Variabilní symbol", style='bold')
    
    # Vytvoření čistě číselného variabilního symbolu z čísla objednávky
    var_symbol = ''.join([c for c in order['order_number'] if c.isdigit()])
    draw_czech_text(p, 200, height - 240, var_symbol, style='medium')
    
    # Způsob platby - získáme slovní popis platební metody z objednávky
    payment_method_text = "Převodem"  # Výchozí hodnota
    if 'payment_method' in order:
        # Převod kódů platebních metod na čitelné texty
        payment_method_texts = {
            'card': 'Platba kartou',
            'bank': 'Bankovní převod',
            'cod': 'Dobírka',
            'cash': 'Hotově'
        }
        payment_method_text = payment_method_texts.get(order['payment_method'], 'Převodem')
    
    draw_czech_text(p, 40, height - 255, "Způsob platby", style='bold')
    draw_czech_text(p, 200, height - 255, payment_method_text, style='medium')
    
    # Sekce Odběratel
    draw_czech_text(p, 350, height - 105, "ODBĚRATEL", size=9, style='medium')
    draw_czech_text(p, 350, height - 125, customer['name'], size=12, style='bold')
    
    # Pouze pokud jsou informace k dispozici
    if customer.get('address'):
        draw_czech_text(p, 350, height - 145, customer['address'], style='regular')
    
    if customer.get('zip') and customer.get('city'):
        address_line = f"{customer['zip']} {customer['city']}"
        if customer.get('country') and customer['country'] != 'Česká republika':
            address_line += f" - {customer['country']}"
        else:
            address_line += " - CZ"
        draw_czech_text(p, 350, height - 160, address_line, style='regular')
    
    # Datum vystavení a splatnosti
    now = datetime.datetime.now()
    due_date = now + datetime.timedelta(days=10)
    
    draw_czech_text(p, 350, height - 220, "Datum vystavení", style='bold')
    draw_czech_text(p, 480, height - 220, now.strftime('%d. %m. %Y'), style='regular')
    
    draw_czech_text(p, 350, height - 235, "Datum splatnosti", style='bold')
    draw_czech_text(p, 480, height - 235, due_date.strftime('%d. %m. %Y'), style='regular')
    
    # Položky faktury - vypsání konkrétních produktů
    y_position = height - 320
    item_count = 0  # Počítadlo položek pro výpočet posunu spodní čáry
    
    # Nejprve vypíšeme produkty
    if order.get('items') and len(order['items']) > 0:
        for item in order['items']:
            product_text = f"{item['name']} {item['variant']} - {item['quantity']} ks"
            draw_czech_text(p, 40, y_position, product_text, style='medium')
            draw_czech_text(p, width - 105, y_position, f"{item['total']:.2f} Kč".replace('.', ','), style='regular')
            y_position -= 20
            item_count += 1
    else:
        # Fallback pro případ, že položky nejsou k dispozici
        draw_czech_text(p, 40, y_position, f"realizace objednávky {order['order_number']}", style='medium')
        draw_czech_text(p, width - 105, y_position, f"{order['subtotal']:.2f} Kč".replace('.', ','), style='regular')
        y_position -= 20
        item_count += 1
    
    # Přidáme položku pro dopravu, pokud je k dispozici
    if 'shipping_method' in order and 'shipping_price' in order and order['shipping_price'] > 0:
        # Převod kódů dopravních metod na čitelné texty
        shipping_method_texts = {
            'zasilkovna': 'Zásilkovna',
            'ppl': 'PPL',
            'express': 'Expresní doručení',
            'personal': 'Osobní odběr',
            'dpd': 'DPD',
            'cp': 'Česká pošta'
        }
        
        shipping_method_text = shipping_method_texts.get(order['shipping_method'], 'Doprava')
        draw_czech_text(p, 40, y_position, f"Doprava - {shipping_method_text}", style='medium')
        draw_czech_text(p, width - 105, y_position, f"{order['shipping_price']:.2f} Kč".replace('.', ','), style='regular')
        y_position -= 20
        item_count += 1
    
    # Přidáme položku pro poplatek za platbu, pokud je k dispozici
    if 'payment_price' in order and order['payment_price'] > 0:
        draw_czech_text(p, 40, y_position, f"Poplatek - {payment_method_text}", style='medium')
        draw_czech_text(p, width - 105, y_position, f"{order['payment_price']:.2f} Kč".replace('.', ','), style='regular')
        y_position -= 20
        item_count += 1
    
    # Výpočet pozice spodní čáry a celkové ceny dynamicky podle počtu položek
    # Základní pozice čáry je height - 380, ale posouváme ji dolů podle počtu položek
    # Odhaduji, že každá položka potřebuje přibližně 20 bodů výšky
    additional_space_needed = max(0, item_count - 3) * 20  # Pro prvních 3 položek ponecháme původní pozici
    
    # Nová pozice pro spodní čáru
    line_position = height - 380 - additional_space_needed
    
    # Nová pozice pro celkovou cenu
    total_position = line_position - 20
    
    # Vykreslení spodní horizontální čáry na upravenou pozici
    p.line(40, line_position, width - 50, line_position)
    
    # Celková cena s upravenou pozicí
    draw_czech_text(p, width - 105, total_position, f"{order['total']:.2f} Kč".replace('.', ','), size=12, style='black')
    
    # QR kód pro platbu podle specifikace
    qr_data = f"SPD*1.0*ACC:CZ3030300000002411153019*RN:SIMON NOVAK*AM:{order['total']:.2f}*CC:CZK"
    
    qr = qrcode.make(qr_data, box_size=4)
    qr_img = BytesIO()
    qr.save(qr_img)
    qr_img.seek(0)
    
    # Vložení QR kódu do PDF na upravenou pozici (posunuto dolů podle počtu položek)
    qr_position = line_position - 120  # QR kód umístíme pod čáru s dostatečným odstupem
    p.drawImage(ImageReader(qr_img), 30, qr_position, width=100, height=100)
    draw_czech_text(p, 40, qr_position - 10, "QR Platba", size=8, style='medium')
    
    # Patička faktury
    draw_czech_text(p, 40, 40, "Faktura vytvořena pomocí interního systému Zentos.", size=8, style='light')
    
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
        'bank_account': settings.get('bank_account', '2411153019/3030')
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
        session.clear()
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['name'] = user['name']
        session.permanent = True
        
        # Explicitní uložení session
        session.modified = True
        
        # Debug výpis na serveru
        print(f"Login successful. Session data: {session}")
        print(f"User ID in session: {session.get('user_id')}")
        
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
    
    if 'user_id' in session:
        session.modified = True
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
        
        # Aktualizace objednávky
        conn.execute('''
        UPDATE orders
        SET status = ?, note = ?, 
            shipping_method = ?, shipping_price = ?,
            payment_method = ?, payment_price = ?,
            subtotal = ?, total = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (
            data.get('status', order['status']),
            data.get('note', order['note']),
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
    
    return send_from_directory(
        os.path.dirname(file_path),
        os.path.basename(file_path),
        as_attachment=True,
        download_name=f"Faktura-{invoice_number}.pdf"
    )

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
    
    # SMTP konfigurace - použití přímých hodnot místo getenv
    smtp_server = "wes1-smtp.wedos.net"
    smtp_port = 587
    from_email = "sn@snovak.cz"  # Přímá emailová adresa
    password = "******"      # Přímé heslo (pro účely testování)
    
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
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">{item['name']} - {item['variant']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">{item['quantity']} ks</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">{price:.2f} Kč</td>
        </tr>
        """
    
    # Informace o dopravě a platbě
    shipping_method = ""
    if order_data['shipping_method'] == 'zasilkovna':
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
    
    # Sestavení těla emailu v HTML
    subject = f"Vaše faktura č. {invoice_number} - Sajrajt.cz"
    body = f"""
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: 'Roboto', Arial, sans-serif; color: #ffffff; line-height: 1.6; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 0 auto; padding: 0;">
                <!-- Header s logem a neon efektem -->
                <div style="text-align: center; margin-bottom: 0; padding: 30px 20px; background-color: #121212; position: relative; overflow: hidden; border-top-left-radius: 12px; border-top-right-radius: 12px; border: 1px solid rgba(105, 240, 174, 0.2); border-bottom: none;">
                    <!-- Neon glow efekt -->
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80%; height: 70%; background: radial-gradient(ellipse at center, rgba(0, 230, 118, 0.3) 0%, rgba(0, 230, 118, 0) 70%); filter: blur(20px); z-index: 0;"></div>
                    
                    <h1 style="margin: 0; font-family: 'Roboto', Arial, sans-serif; font-size: 42px; font-weight: 700; color: #ffffff; position: relative; z-index: 1; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 15px rgba(0, 230, 118, 0.7);">Sajrajt.cz</h1>
                    <p style="margin: 5px 0 0; position: relative; z-index: 1; color: #69f0ae; font-weight: 500; letter-spacing: 1px;">VÁŠ PRÉMIOVÝ DODAVATEL KRATOMU</p>
                </div>
                
                <!-- Hlavní obsah -->
                <div style="background-color: #222222; padding: 30px 25px; border-left: 1px solid rgba(105, 240, 174, 0.2); border-right: 1px solid rgba(105, 240, 174, 0.2);">
                    <!-- Zelený nadpis s podtržením -->
                    <h2 style="color: #69f0ae; border-bottom: 2px solid #69f0ae; padding-bottom: 12px; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-top: 0; text-shadow: 0 0 10px rgba(105, 240, 174, 0.3);">Děkujeme za Váš nákup!</h2>
                    
                    <p style="color: #e0e0e0; margin-bottom: 20px;">Vážený zákazníku <strong style="color: #ffffff;">{customer_name}</strong>,</p>
                    
                    <p style="color: #e0e0e0; margin-bottom: 25px;">děkujeme za Váš nákup v našem e-shopu. V příloze najdete kompletní fakturu k Vaší objednávce <strong style="color: #69f0ae; text-shadow: 0 0 8px rgba(105, 240, 174, 0.5);">#{order_number}</strong>.</p>
                    
                    <!-- Shrnutí objednávky v kartě s neonovým okrajem -->
                    <div style="margin: 30px 0; background-color: #2a2a2a; padding: 25px; border-radius: 12px; border: 1px solid rgba(105, 240, 174, 0.3); box-shadow: 0 0 20px rgba(0, 0, 0, 0.3), 0 0 10px rgba(105, 240, 174, 0.1);">
                        <h3 style="color: #69f0ae; margin-top: 0; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 8px rgba(105, 240, 174, 0.3);">Shrnutí Vaší objednávky</h3>
                        
                        <!-- Tabulka s objednávkou - stylovaná -->
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; color: #e0e0e0;">
                            <tr style="background-color: rgba(105, 240, 174, 0.1);">
                                <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #69f0ae; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Produkt</th>
                                <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #69f0ae; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Množství</th>
                                <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #69f0ae; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; color: #ffffff;">Cena</th>
                            </tr>
                            {order_summary}
                            <tr>
                                <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">Doprava - {shipping_method}</td>
                                <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">1 ks</td>
                                <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: right;">{order_data['shipping_price']:.2f} Kč</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">Platba - {payment_method}</td>
                                <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">1 ks</td>
                                <td style="padding: 12px 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: right;">{order_data['payment_price']:.2f} Kč</td>
                            </tr>
                            <tr style="font-weight: bold; background-color: rgba(105, 240, 174, 0.1);">
                                <td style="padding: 15px; color: #ffffff;" colspan="2">Celkem k úhradě:</td>
                                <td style="padding: 15px; text-align: right; color: #69f0ae; text-shadow: 0 0 8px rgba(105, 240, 174, 0.5); font-size: 18px;">{order_data['total']:.2f} Kč</td>
                            </tr>
                        </table>                        
                    </div>
                    
                    <!-- Sekce s platebními údaji -->
                    <p style="color: #e0e0e0;">Pokud jste zvolili platbu převodem, prosíme o úhradu na účet:</p>
                    <div style="background: linear-gradient(135deg, rgba(105, 240, 174, 0.1) 0%, rgba(51, 51, 51, 0.9) 100%); padding: 25px; border-radius: 12px; margin: 20px 0; border: 1px solid rgba(105, 240, 174, 0.3); box-shadow: 0 0 20px rgba(0, 0, 0, 0.2), 0 0 10px rgba(105, 240, 174, 0.1);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 15px;">
                            <div style="flex: 1; min-width: 140px; background-color: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(105, 240, 174, 0.2);">
                                <p style="margin: 0; color: #69f0ae; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-size: 13px; font-weight: 500; text-shadow: 0 0 5px rgba(105, 240, 174, 0.3);">Číslo účtu</p>
                                <p style="margin: 8px 0 0; color: #ffffff; font-weight: bold; font-size: 16px;">{company_info['bank_account']}</p>
                            </div>
                            <div style="flex: 1; min-width: 140px; background-color: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(105, 240, 174, 0.2);">
                                <p style="margin: 0; color: #69f0ae; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-size: 13px; font-weight: 500; text-shadow: 0 0 5px rgba(105, 240, 174, 0.3);">Variabilní symbol</p>
                                <p style="margin: 8px 0 0; color: #ffffff; font-weight: bold; font-size: 16px;">{order_number}</p>
                            </div>
                            <div style="flex: 1; min-width: 140px; background-color: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(105, 240, 174, 0.2);">
                                <p style="margin: 0; color: #69f0ae; font-family: 'Roboto', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-size: 13px; font-weight: 500; text-shadow: 0 0 5px rgba(105, 240, 174, 0.3);">Částka</p>
                                <p style="margin: 8px 0 0; color: #ffffff; font-weight: bold; font-size: 16px;">{order_data['total']:.2f} Kč</p>
                            </div>
                        </div>
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <p style="margin: 0; color: #e0e0e0; font-size: 13px; text-align: center;"><strong style="color: #69f0ae;">Tip:</strong> Pro rychlejší zpracování vaší objednávky prosím uvádějte variabilní symbol.</p>
                        </div>
                    </div>
                    
                    <!-- Kontakt -->
                    <p style="color: #e0e0e0; margin-top: 25px;">V případě jakýchkoliv dotazů nás neváhejte kontaktovat na <a href="mailto:info@sajrajt.cz" style="color: #69f0ae; text-decoration: none; font-weight: 500; text-shadow: 0 0 8px rgba(105, 240, 174, 0.3);">info@sajrajt.cz</a> nebo telefonicky na <strong style="color: #ffffff;">{company_info['phone']}</strong>.</p>
                    
                    <p style="color: #e0e0e0;">Děkujeme za Vaši důvěru a přejeme vám krásný den.</p>
                    
                    <p style="margin-top: 30px; color: #e0e0e0;">S pozdravem,<br>
                    <span style="color: #69f0ae; font-family: 'Roboto', Arial, sans-serif; font-weight: 500; font-size: 18px; text-shadow: 0 0 8px rgba(105, 240, 174, 0.3);">Tým Sajrajt.cz</span></p>
                </div>
                
                <!-- Patička -->
                <div style="margin-top: 0; padding: 25px 20px; border: 1px solid rgba(105, 240, 174, 0.2); border-top: none; background-color: #1a1a1a; font-size: 12px; color: #9e9e9e; text-align: center; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                    <div style="margin-bottom: 15px; display: flex; justify-content: center; align-items: center;">
                        <div style="height: 1px; background: linear-gradient(to right, transparent, rgba(105, 240, 174, 0.5), transparent); width: 80%; margin: 0 auto;"></div>
                    </div>
                    
                    <p style="margin: 15px 0 5px; color: #9e9e9e;">&copy; 2025 Sajrajt.cz | Všechna práva vyhrazena</p>
                    <p style="margin: 5px 0 0; color: #9e9e9e; font-size: 11px;">Tento e-mail byl vygenerován automaticky, prosíme neodpovídejte na něj.</p>
                </div>
            </div>
        </body>
    </html>
    """
    
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
            print(f"Přihlašování k SMTP serveru s: {from_email}")
            server.login(from_email, password)
            server.sendmail(from_email, [to_email], msg.as_string())
        print(f"Faktura byla úspěšně odeslána na {to_email}")
        return True
    except Exception as e:
        print(f"Detailní chyba při odesílání e-mailu: {str(e)}")
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

# ===== IMPORT/EXPORT =====
@app.route('/api/export/orders', methods=['GET'])
def export_orders():
    # Parametry pro filtrování
    order_ids_param = request.args.get('order_ids')
    status = request.args.get('status')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    # Základní query
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
    
    # Vytvoření CSV souboru
    csv_data = []
    header = [
        'ID', 'Číslo objednávky', 'Zákazník', 'Email', 'Telefon', 'Adresa', 'Město', 'PSČ', 'Země',
        'Položky', 'Datum vytvoření', 'Celková cena', 'Status', 'Doprava', 'Platba', 'Poznámka'
    ]
    csv_data.append(header)
    
    for order in orders:
        # Získání položek objednávky
        items = conn.execute('''
        SELECT * FROM order_items WHERE order_id = ?
        ''', (order['id'],)).fetchall()
        
        # Sestavení řetězce s položkami
        items_str = ", ".join([f"{item['name']} {item['variant']} x{item['quantity']}" for item in items])
        
        # Status převod na čitelný text (bez HTML)
        status_text = translate_status(order['status'])
        
        # Přidání řádku s objednávkou
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
            f"{order['total']:.2f} Kč",
            status_text,
            get_shipping_method_text(order['shipping_method']),
            get_payment_method_text(order['payment_method']),
            order['note'] or ''
        ]
        csv_data.append(row)
    
    conn.close()
    
    # Vytvoření CSV souboru - OPRAVENÁ ČÁST
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

# Pomocná funkce pro překlad statusu do čitelného textu
def translate_status(status):
    status_map = {
        'new': 'Nová',
        'processing': 'Zpracovává se',
        'shipped': 'Odeslána',
        'completed': 'Dokončena',
        'cancelled': 'Zrušena'
    }
    return status_map.get(status, status)

@app.route('/api/export/products', methods=['GET'])
def export_products():
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
    output = BytesIO()
    import csv
    
    # Nastavení pro české znaky
    output.write(b'\xef\xbb\xbf')  # UTF-8 BOM
    
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
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
    import csv
    
    try:
        products_to_add = []
        products_to_update = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for row in reader:
                # Kontrola povinných polí
                required_fields = ['Název', 'Cena', 'Typ', 'Varianta']
                if not all(field in row for field in required_fields):
                    continue
                
                product = {
                    'name': row['Název'],
                    'price': float(row['Cena'].replace(',', '.').replace(' ', '')),
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

# ===== SPUŠTĚNÍ APLIKACE =====
if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)