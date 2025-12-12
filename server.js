const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database('registry.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'family', 'friends', 'coworkers'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    shop TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS item_tags (
    item_id INTEGER,
    tag TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
    PRIMARY KEY(item_id, tag)
  );
`);

// Create default admin user if not exists (password: admin123)
// WARNING: Change default credentials before deploying to production!
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
  console.log('Default admin user created (username: admin, password: admin123)');
  console.log('WARNING: Change default credentials before deploying to production!');
}

// Create sample users if they don't exist (for demonstration purposes)
// WARNING: Disable or change these credentials in production!
const sampleUsers = [
  { username: 'family_user', password: 'family123', type: 'family' },
  { username: 'friends_user', password: 'friends123', type: 'friends' },
  { username: 'coworkers_user', password: 'coworkers123', type: 'coworkers' }
];

sampleUsers.forEach(user => {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
  if (!exists) {
    const hashedPassword = bcrypt.hashSync(user.password, 10);
    db.prepare('INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)').run(user.username, hashedPassword, user.type);
    console.log(`Sample user created: ${user.username} (password: ${user.password})`);
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'wedding-registry-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

function requireAdmin(req, res, next) {
  if (req.session.userId && req.session.userType === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// API Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.userType = user.user_type;
  
  res.json({ 
    success: true, 
    userType: user.user_type,
    username: user.username 
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    username: req.session.username,
    userType: req.session.userType
  });
});

// Get items (filtered by user type)
app.get('/api/items', requireAuth, (req, res) => {
  const userType = req.session.userType;
  
  let items;
  if (userType === 'admin') {
    // Admin sees all items
    items = db.prepare(`
      SELECT DISTINCT i.* FROM items i
      ORDER BY i.created_at DESC
    `).all();
  } else {
    // Other users see items tagged for their user type or 'all'
    items = db.prepare(`
      SELECT DISTINCT i.* FROM items i
      LEFT JOIN item_tags it ON i.id = it.item_id
      WHERE it.tag = ? OR it.tag = 'all'
      ORDER BY i.created_at DESC
    `).all(userType);
  }
  
  // Get tags for each item
  items.forEach(item => {
    const tags = db.prepare('SELECT tag FROM item_tags WHERE item_id = ?').all(item.id);
    item.tags = tags.map(t => t.tag);
  });
  
  res.json(items);
});

// Add item (admin only)
app.post('/api/items', requireAdmin, (req, res) => {
  const { name, description, url, shop, image_url, tags } = req.body;
  
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }
  
  try {
    const result = db.prepare('INSERT INTO items (name, description, url, shop, image_url) VALUES (?, ?, ?, ?, ?)').run(name, description, url, shop, image_url);
    const itemId = result.lastInsertRowid;
    
    // Add tags
    if (tags && tags.length > 0) {
      const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag) VALUES (?, ?)');
      tags.forEach(tag => {
        insertTag.run(itemId, tag);
      });
    }
    
    res.json({ success: true, id: itemId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update item (admin only)
app.put('/api/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, description, url, shop, image_url, tags } = req.body;
  
  try {
    db.prepare('UPDATE items SET name = ?, description = ?, url = ?, shop = ?, image_url = ? WHERE id = ?').run(name, description, url, shop, image_url, id);
    
    // Update tags
    db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(id);
    if (tags && tags.length > 0) {
      const insertTag = db.prepare('INSERT INTO item_tags (item_id, tag) VALUES (?, ?)');
      tags.forEach(tag => {
        insertTag.run(id, tag);
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete item (admin only)
app.delete('/api/items/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  try {
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Wedding Registry server running on http://localhost:${PORT}`);
  console.log('Default credentials:');
  console.log('  Admin: admin / admin123');
  console.log('  Family: family_user / family123');
  console.log('  Friends: friends_user / friends123');
  console.log('  Coworkers: coworkers_user / coworkers123');
});
