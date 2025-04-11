import sqlite3

def update_product_names():
    # Připojení k SQLite databázi
    conn = sqlite3.connect('zentos.db')
    cursor = conn.cursor()
    
    # Aktualizace názvů produktů - odstranění "Maeng Da" a překlad do češtiny
    cursor.execute('''
    UPDATE products 
    SET name = CASE 
        WHEN type = 'red' THEN 'Červený Kratom' 
        WHEN type = 'white' THEN 'Bílý Kratom' 
        WHEN type = 'green' THEN 'Zelený Kratom' 
        ELSE name 
    END,
    updated_at = CURRENT_TIMESTAMP
    ''')
    
    # Přidání sloupce pro řazení, pokud neexistuje
    try:
        cursor.execute("ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        # Sloupec již existuje, pokračujeme
        pass
    
    # Nastavení pořadí pro varianty hmotnosti
    variants_order = {
        '50g': 10,
        '100g': 20,
        '200g': 30, 
        '500g': 40,
        '1kg': 50
    }
    
    # Aktualizace pořadí pro správné řazení variant
    for variant, order in variants_order.items():
        cursor.execute('''
        UPDATE products 
        SET sort_order = ? 
        WHERE variant = ?
        ''', (order, variant))
    
    # Commit změn a zavření spojení
    conn.commit()
    
    # Vypíšeme počet upravených řádků
    cursor.execute('SELECT COUNT(*) FROM products')
    total_products = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"Úspěšně aktualizováno {total_products} produktů.")
    print("Produkty byly přejmenovány na 'Zelený Kratom', 'Bílý Kratom' a 'Červený Kratom'.")
    print("Varianty byly seřazeny v pořadí: 50g, 100g, 200g, 500g, 1kg")

# Spustit funkci
update_product_names()