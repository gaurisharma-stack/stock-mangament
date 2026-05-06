const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/production/recipes — List all recipes with details
router.get('/recipes', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const recipes = db.prepare(`
      SELECT pr.*, 
        fi.name as finished_name, 
        ii.name as ingredient_name,
        ii.stock_qty as ingredient_stock
      FROM production_recipes pr
      JOIN items fi ON pr.finished_item_code = fi.item_code AND fi.company_id = ?
      JOIN items ii ON pr.ingredient_item_code = ii.item_code AND ii.company_id = ?
      WHERE pr.company_id = ?
      ORDER BY pr.finished_item_code
    `).all(companyId, companyId, companyId);

    // Group by finished product
    const grouped = {};
    for (const r of recipes) {
      if (!grouped[r.finished_item_code]) {
        grouped[r.finished_item_code] = {
          finished_item_code: r.finished_item_code,
          finished_name: r.finished_name,
          ingredients: [],
        };
      }
      grouped[r.finished_item_code].ingredients.push({
        id: r.id,
        ingredient_item_code: r.ingredient_item_code,
        ingredient_name: r.ingredient_name,
        quantity_required: r.quantity_required,
        ingredient_stock: r.ingredient_stock,
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/production/recipes — Create a new recipe
router.post('/recipes', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { finished_item_code, ingredients } = req.body;

    if (!finished_item_code || !ingredients || !ingredients.length) {
      return res.status(400).json({ error: 'Finished item code and at least one ingredient required' });
    }

    // Validate finished item exists for this company
    const finished = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(finished_item_code, companyId);
    if (!finished) {
      return res.status(404).json({ error: `Finished item ${finished_item_code} not found` });
    }

    const insertRecipe = db.prepare(
      'INSERT INTO production_recipes (finished_item_code, ingredient_item_code, company_id, quantity_required) VALUES (?, ?, ?, ?)'
    );

    const createRecipe = db.transaction(() => {
      // Remove existing recipe for this product in this company
      db.prepare('DELETE FROM production_recipes WHERE finished_item_code = ? AND company_id = ?').run(finished_item_code, companyId);

      for (const ing of ingredients) {
        const ingredientItem = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(ing.ingredient_item_code, companyId);
        if (!ingredientItem) {
          throw new Error(`Ingredient ${ing.ingredient_item_code} not found`);
        }
        insertRecipe.run(finished_item_code, ing.ingredient_item_code, companyId, ing.quantity_required);
      }
    });

    createRecipe();
    res.status(201).json({ message: 'Recipe created successfully', finished_item_code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/production/produce — Execute production
router.post('/produce', (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { finished_item_code, quantity } = req.body;

    if (!finished_item_code || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid finished_item_code and positive quantity required' });
    }

    // Get recipe for this company
    const recipe = db.prepare(
      'SELECT pr.*, i.stock_qty, i.name as ingredient_name FROM production_recipes pr JOIN items i ON pr.ingredient_item_code = i.item_code AND i.company_id = ? WHERE pr.finished_item_code = ? AND pr.company_id = ?'
    ).all(companyId, finished_item_code, companyId);

    if (!recipe.length) {
      return res.status(404).json({ error: 'No recipe found for this product' });
    }

    // Check all ingredients have sufficient stock
    const insufficientStock = [];
    for (const ing of recipe) {
      const required = ing.quantity_required * quantity;
      if (ing.stock_qty < required) {
        insufficientStock.push({
          ingredient: ing.ingredient_item_code,
          name: ing.ingredient_name,
          required,
          available: ing.stock_qty,
        });
      }
    }

    if (insufficientStock.length > 0) {
      return res.status(400).json({
        error: 'Insufficient ingredient stock',
        details: insufficientStock,
      });
    }

    // Execute production in a transaction
    const produce = db.transaction(() => {
      // Subtract ingredients
      for (const ing of recipe) {
        const requiredQty = ing.quantity_required * quantity;

        db.prepare('UPDATE items SET stock_qty = stock_qty - ? WHERE item_code = ? AND company_id = ?')
          .run(requiredQty, ing.ingredient_item_code, companyId);

        // Log subtraction transaction for each ingredient
        db.prepare(
          'INSERT INTO transactions (item_code, company_id, transaction_type, quantity, unit_price, total_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          ing.ingredient_item_code,
          companyId,
          'Production',
          requiredQty,
          0,
          0,
          `Used in production of ${quantity}x ${finished_item_code}`
        );
      }

      // Add finished product
      db.prepare('UPDATE items SET stock_qty = stock_qty + ? WHERE item_code = ? AND company_id = ?')
        .run(quantity, finished_item_code, companyId);

      // Log production transaction for finished product
      const finishedItem = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(finished_item_code, companyId);
      db.prepare(
        'INSERT INTO transactions (item_code, company_id, transaction_type, quantity, unit_price, total_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        finished_item_code,
        companyId,
        'Production',
        quantity,
        finishedItem.unit_price,
        quantity * finishedItem.unit_price,
        `Produced ${quantity} units`
      );
    });

    produce();

    const updated = db.prepare('SELECT * FROM items WHERE item_code = ? AND company_id = ?').get(finished_item_code, companyId);
    res.status(201).json({
      message: `Produced ${quantity} units of ${finished_item_code}`,
      newStockLevel: updated.stock_qty,
      item: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
