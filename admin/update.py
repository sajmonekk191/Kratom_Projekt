import sqlite3

def update_database():
    """
    Aktualizuje databázi - přidá tabulky order_shipping_details, order_metadata a order_rewards
    a aktualizuje bankovní účet
    """
    conn = sqlite3.connect('zentos.db')
    cursor = conn.cursor()
    
    print("Aktualizuji databázi - přidávám nové tabulky...")
    
    # Vytvoření tabulky pro detaily dopravy (pobočky Zásilkovny)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS order_shipping_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        branch_id TEXT,
        branch_name TEXT,
        branch_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders (id)
    )
    ''')
    print("Tabulka 'order_shipping_details' byla úspěšně vytvořena.")
    
    # Vytvoření tabulky pro metadata objednávek
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS order_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id)
    )
    ''')
    print("Tabulka 'order_metadata' byla úspěšně vytvořena.")
    
    # Vytvoření tabulky pro odměny objednávek
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS order_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        level INTEGER NOT NULL,
        name TEXT NOT NULL,
        threshold REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id)
    )
    ''')
    print("Tabulka 'order_rewards' byla úspěšně vytvořena.")
    
    # Aktualizace bankovního účtu
    try:
        # Kontrola, zda existuje záznam pro bank_account
        cursor.execute('SELECT * FROM settings WHERE key = ?', ('bank_account',))
        setting = cursor.fetchone()
        
        if setting:
            # Aktualizace existujícího záznamu
            cursor.execute('''
            UPDATE settings
            SET value = ?, updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
            ''', ('3361960019/3030', 'bank_account'))
            print("Bankovní účet byl aktualizován na 3361960019/3030.")
        else:
            # Vytvoření nového záznamu
            cursor.execute('''
            INSERT INTO settings (key, value)
            VALUES (?, ?)
            ''', ('bank_account', '3361960019/3030'))
            print("Bankovní účet byl nastaven na 3361960019/3030.")
        
        # Můžeme zkontrolovat aktuální hodnoty v tabulce settings
        cursor.execute('SELECT key, value FROM settings')
        print("\nAktuální nastavení systému:")
        for key, value in cursor.fetchall():
            print(f"{key}: {value}")
    
    except Exception as e:
        print(f"Chyba při aktualizaci bankovního účtu: {e}")
    
    conn.commit()
    print("\nAktualizace databáze byla úspěšně dokončena.")
    conn.close()

# Spustit funkci
if __name__ == "__main__":
    update_database()