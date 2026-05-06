const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'stock.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS items (
    item_code TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    unit_price REAL DEFAULT 0,
    stock_qty INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_code, company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Purchase','Sale','Broken','Production')),
    quantity INTEGER NOT NULL,
    unit_price REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    supplier TEXT,
    service_charge REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_code, company_id) REFERENCES items(item_code, company_id)
  );

  CREATE TABLE IF NOT EXISTS production_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finished_item_code TEXT NOT NULL,
    ingredient_item_code TEXT NOT NULL,
    company_id INTEGER NOT NULL,
    quantity_required INTEGER NOT NULL,
    FOREIGN KEY (finished_item_code, company_id) REFERENCES items(item_code, company_id),
    FOREIGN KEY (ingredient_item_code, company_id) REFERENCES items(item_code, company_id)
  );
`);

module.exports = db;
