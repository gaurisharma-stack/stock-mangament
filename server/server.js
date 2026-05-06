const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Public routes (no auth required)
app.use('/api/auth', require('./routes/auth'));

// Protected routes (auth required)
app.use('/api/items', authMiddleware, require('./routes/items'));
app.use('/api/transactions', authMiddleware, require('./routes/transactions'));
app.use('/api/production', authMiddleware, require('./routes/production'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.use((req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(` Stock Management API running on http://localhost:${PORT}`);
});
