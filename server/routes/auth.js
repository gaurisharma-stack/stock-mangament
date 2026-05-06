const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

// Generate a random 6-character alphanumeric invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: 0,O,1,I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a unique invite code (retry if collision)
function getUniqueInviteCode() {
  let code;
  let attempts = 0;
  do {
    code = generateInviteCode();
    const existing = db.prepare('SELECT id FROM companies WHERE invite_code = ?').get(code);
    if (!existing) return code;
    attempts++;
  } while (attempts < 20);
  throw new Error('Failed to generate unique invite code');
}

// Create JWT token
function createToken(user) {
  return jwt.sign(
    { userId: user.id, companyId: user.company_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register — Create a new company + admin user
router.post('/register', async (req, res) => {
  try {
    const { companyName, name, email, password } = req.body;

    if (!companyName || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const inviteCode = getUniqueInviteCode();
    const passwordHash = await bcrypt.hash(password, 10);

    const result = db.transaction(() => {
      // Create company
      const company = db.prepare(
        'INSERT INTO companies (name, invite_code) VALUES (?, ?)'
      ).run(companyName.trim(), inviteCode);

      // Create admin user
      const user = db.prepare(
        'INSERT INTO users (email, password_hash, name, company_id, role) VALUES (?, ?, ?, ?, ?)'
      ).run(email.toLowerCase().trim(), passwordHash, name.trim(), company.lastInsertRowid, 'admin');

      return {
        userId: user.lastInsertRowid,
        companyId: company.lastInsertRowid,
        companyName: companyName.trim(),
        inviteCode,
        role: 'admin',
      };
    })();

    const token = createToken({
      id: result.userId,
      company_id: result.companyId,
      role: result.role,
    });

    res.status(201).json({
      token,
      user: {
        id: result.userId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: result.role,
        companyId: result.companyId,
        companyName: result.companyName,
        inviteCode: result.inviteCode,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/join — Join existing company via invite code
router.post('/join', async (req, res) => {
  try {
    const { inviteCode, name, email, password } = req.body;

    if (!inviteCode || !name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find company by invite code
    const company = db.prepare('SELECT * FROM companies WHERE invite_code = ?').get(inviteCode.toUpperCase().trim());
    if (!company) {
      return res.status(404).json({ error: 'Invalid invite code. Please check and try again.' });
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = db.prepare(
      'INSERT INTO users (email, password_hash, name, company_id, role) VALUES (?, ?, ?, ?, ?)'
    ).run(email.toLowerCase().trim(), passwordHash, name.trim(), company.id, 'member');

    const token = createToken({
      id: user.lastInsertRowid,
      company_id: company.id,
      role: 'member',
    });

    res.status(201).json({
      token,
      user: {
        id: user.lastInsertRowid,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role: 'member',
        companyId: company.id,
        companyName: company.name,
        inviteCode: company.invite_code,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login — Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare(
      'SELECT u.*, c.name as company_name, c.invite_code FROM users u JOIN companies c ON u.company_id = c.id WHERE u.email = ?'
    ).get(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company_name,
        inviteCode: user.invite_code,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — Get current user info (protected)
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(
      'SELECT u.id, u.email, u.name, u.role, u.company_id, c.name as company_name, c.invite_code FROM users u JOIN companies c ON u.company_id = c.id WHERE u.id = ?'
    ).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
      inviteCode: user.invite_code,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
