import sqlite3

def update_database():
    """
    Aktualizuje databázi - přidá tabulku order_shipping_details pro ukládání informací o pobočkách Zásilkovny
    """
    conn = sqlite3.connect('zentos.db')
    cursor = conn.cursor()
    
    print("Aktualizuji databázi - přidávám podporu pro pobočky Zásilkovny...")
    
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
    
    conn.commit()
    print("Aktualizace databáze byla úspěšně dokončena.")
    conn.close()

# Spustit funkci
if __name__ == "__main__":
    update_database()