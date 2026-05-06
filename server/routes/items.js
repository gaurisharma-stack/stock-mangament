const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/items — List all items with optional search/filter
router.get('/', (req, res) => {
  try {
    const { search, category, status } = req.query;
    const companyId = req.user.companyId;
    let query = 'SELECT * FROM items WHERE company_id = ?';
    const params = [companyId];

    if (search) {
      query += ' AND (item_code LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';
    const items = db.prepare(query).all(...params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/categories — List unique categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM items WHERE company_id = ? ORDER BY category').all(req.user.companyId);
    res.json(categories.map(c => c.category));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/stats — Dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const companyId = req.user.companyId;

    const totalValue = db.prepare(
      "SELECT COALESCE(SUM(stock_qty * unit_price), 0) as total_value FROM items WHERE company_id = ? AND status = 'Active'"
    ).get(companyId);

    const totalItems = db.prepare(
      "SELECT COUNT(*) as count FROM items WHERE company_id = ? AND status = 'Active'"
    ).get(companyId);

    const lowStock = db.prepare(
      "SELECT COUNT(*) as count FROM items WHERE company_id = ? AND stock_qty <= reorder_level AND status = 'Active'"
    ).get(companyId);

    const outOfStock = db.prepare(
      "SELECT COUNT(*) as count FROM items WHERE company_id = ? AND stock_qty = 0 AND status = 'Active'"
    ).get(companyId);

    const totalRevenue = db.prepare(
      "SELECT COALESCE(SUM(total_amount + service_charge), 0) as revenue FROM transactions WHERE company_id = ? AND transaction_type = 'Sale'"
    ).get(companyId);

    const recentSales = db.prepare(
      "SELECT t.*, i.name as item_name FROM transactions t JOIN items i ON t.item_code = i.item_code AND t.company_id = i.company_id WHERE t.company_id = ? AND t.transaction_type = 'Sale' ORDER BY t.created_at DESC LIMIT 10"
    ).all(companyId);

    const lowStockItems = db.prepare(
      "SELECT * FROM items WHERE company_id = ? AND stock_qty <= reorder_level AND status = 'Active' ORDER BY stock_qty ASC LIMIT 10"
    ).all(companyId);

    res.json({
      totalStockValue: totalValue.total_value,
      totalItems: totalItems.count,
      lowStockCount: lowStock.count,
      outOfStockCount: outOfStock.count,
      totalRevenue: totalRevenue.revenue,
      recentSales,
      lowStockItems,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/:code — Single item with transaction history
router.get('/:code', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(req.params.code, companyId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const transactions = db.prepare(
      'SELECT * FROM transactions WHERE item_code = ? AND company_id = ? ORDER BY created_at DESC'
    ).all(req.params.code, companyId);

    res.json({ ...item, transactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/items — Create new item
router.post('/', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { item_code, name, category, unit_price, stock_qty, reorder_level } = req.body;

    if (!item_code || !name) {
      return res.status(400).json({ error: 'Item code and name are required' });
    }

    const existing = db.prepare('SELECT item_code FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    if (existing) {
      return res.status(409).json({ error: 'Item code already exists' });
    }

    db.prepare(
      'INSERT INTO items (item_code, company_id, name, category, unit_price, stock_qty, reorder_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(item_code, companyId, name, category || 'General', unit_price || 0, stock_qty || 0, reorder_level || 10);

    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/items/:code — Update item
router.put('/:code', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { name, category, unit_price, reorder_level, status } = req.body;
    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(req.params.code, companyId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    db.prepare(
      'UPDATE items SET name = ?, category = ?, unit_price = ?, reorder_level = ?, status = ? WHERE item_code = ? AND company_id = ?'
    ).run(
      name || item.name,
      category || item.category,
      unit_price ?? item.unit_price,
      reorder_level ?? item.reorder_level,
      status || item.status,
      req.params.code,
      companyId
    );

    const updated = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(req.params.code, companyId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/items/:code — Two-stage delete:
// If Active → mark as Discontinued (soft delete)
// If already Discontinued → permanently remove from DB (hard delete)
router.delete('/:code', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(req.params.code, companyId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item.status === 'Discontinued') {
      // Hard delete — permanently remove item + its transactions + recipes
      db.transaction(() => {
        db.prepare('DELETE FROM production_recipes WHERE (finished_item_code = ? OR ingredient_item_code = ?) AND company_id = ?')
          .run(req.params.code, req.params.code, companyId);
        db.prepare('DELETE FROM transactions WHERE item_code = ? AND company_id = ?')
          .run(req.params.code, companyId);
        db.prepare('DELETE FROM items WHERE item_code = ? AND company_id = ?')
          .run(req.params.code, companyId);
      })();
      res.json({ message: 'Item permanently deleted', item_code: req.params.code, deleted: true });
    } else {
      // Soft delete — mark as Discontinued
      db.prepare("UPDATE items SET status = 'Discontinued' WHERE item_code = ? AND company_id = ?")
        .run(req.params.code, companyId);
      res.json({ message: 'Item discontinued', item_code: req.params.code, deleted: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
