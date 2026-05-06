const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/transactions — List all transactions with filters
router.get('/', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { type, item_code, direction } = req.query;
    let query = `
      SELECT t.*, i.name as item_name 
      FROM transactions t 
      JOIN items i ON t.item_code = i.item_code AND t.company_id = i.company_id
      WHERE t.company_id = ?
    `;
    const params = [companyId];

    if (type) {
      query += ' AND t.transaction_type = ?';
      params.push(type);
    }
    if (item_code) {
      query += ' AND t.item_code LIKE ?';
      params.push(`%${item_code}%`);
    }
    if (direction === 'addition') {
      query += " AND t.transaction_type IN ('Purchase', 'Production')";
    } else if (direction === 'subtraction') {
      query += " AND t.transaction_type IN ('Sale', 'Broken')";
    }

    query += ' ORDER BY t.created_at DESC';
    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/purchase — Add stock
router.post('/purchase', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { item_code, quantity, unit_price, supplier, notes } = req.body;

    if (!item_code || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid item_code and positive quantity required' });
    }

    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found. Create the item first.' });
    }

    const total_amount = quantity * (unit_price || item.unit_price);

    const purchase = db.transaction(() => {
      // Record transaction
      const info = db.prepare(
        'INSERT INTO transactions (item_code, company_id, transaction_type, quantity, unit_price, total_amount, supplier, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(item_code, companyId, 'Purchase', quantity, unit_price || item.unit_price, total_amount, supplier || '', notes || '');

      // Increment stock
      db.prepare('UPDATE items SET stock_qty = stock_qty + ?, unit_price = ? WHERE item_code = ? AND company_id = ?')
        .run(quantity, unit_price || item.unit_price, item_code, companyId);

      return info;
    });

    purchase();

    const updated = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    res.status(201).json({
      message: `Purchased ${quantity} units of ${item_code}`,
      newStockLevel: updated.stock_qty,
      item: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/sale — Sell stock
router.post('/sale', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { item_code, quantity, unit_price, service_charge, notes } = req.body;

    if (!item_code || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid item_code and positive quantity required' });
    }

    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.stock_qty < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${item.stock_qty}, Requested: ${quantity}`,
      });
    }

    const price = unit_price || item.unit_price;
    const total_amount = quantity * price;
    const svcCharge = service_charge || 0;

    const sale = db.transaction(() => {
      db.prepare(
        'INSERT INTO transactions (item_code, company_id, transaction_type, quantity, unit_price, total_amount, service_charge, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(item_code, companyId, 'Sale', quantity, price, total_amount, svcCharge, notes || '');

      db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE item_code = ? AND company_id = ?')
        .run(quantity, item_code, companyId);
    });

    sale();

    const updated = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    res.status(201).json({
      message: `Sold ${quantity} units of ${item_code}`,
      totalAmount: total_amount,
      serviceCharge: svcCharge,
      grandTotal: total_amount + svcCharge,
      newStockLevel: updated.stock_qty,
      item: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/broken — Mark items as broken/damaged
router.post('/broken', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { item_code, quantity, notes } = req.body;

    if (!item_code || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid item_code and positive quantity required' });
    }

    const item = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.stock_qty < quantity) {
      return res.status(400).json({
        error: `Insufficient stock. Available: ${item.stock_qty}, Requested: ${quantity}`,
      });
    }

    const total_amount = quantity * item.unit_price;

    const broken = db.transaction(() => {
      db.prepare(
        'INSERT INTO transactions (item_code, company_id, transaction_type, quantity, unit_price, total_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(item_code, companyId, 'Broken', quantity, item.unit_price, total_amount, notes || 'Damaged/Broken');

      db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE item_code = ? AND company_id = ?')
        .run(quantity, item_code, companyId);
    });

    broken();

    const updated = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(item_code, companyId);
    res.status(201).json({
      message: `Marked ${quantity} units of ${item_code} as broken`,
      lossAmount: total_amount,
      newStockLevel: updated.stock_qty,
      item: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/transactions/:id — Delete a transaction and reverse its stock effect
router.delete('/:id', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const txn = db.prepare('SELECT * FROM transactions WHERE id = ? AND company_id = ?').get(req.params.id, companyId);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const del = db.transaction(() => {
      // Reverse the stock effect
      if (txn.transaction_type === 'Purchase') {
        db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE item_code = ? AND company_id = ?').run(txn.quantity, txn.item_code, companyId);
      } else if (txn.transaction_type === 'Sale' || txn.transaction_type === 'Broken') {
        db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE item_code = ? AND company_id = ?').run(txn.quantity, txn.item_code, companyId);
      }
      db.prepare('DELETE FROM transactions WHERE id = ? AND company_id = ?').run(req.params.id, companyId);
    });

    del();
    res.json({ message: 'Transaction deleted and stock adjusted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
