const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const app = express();
const port = 3000;

// Set up SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) console.error('Database error:', err.message);
  else {
    console.log('Connected to SQLite database.');
    db.run(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      amount REAL,
      status TEXT,
      deduction REAL,
      documentation TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`);
  }
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

app.post('/api/register', (req, res) => {
  const { email, password, role } = req.body;
  db.run(`INSERT INTO users (email, password, role) VALUES (?, ?, ?)`, [email, password, role], (err) => {
    if (err) return res.status(400).json({ message: 'Registration failed' });
    res.json({ message: 'Registration successful' });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
    if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });
    req.session = { user };
    res.json({ message: 'Login successful' });
  });
});

app.post('/api/deposit/request', (req, res) => {
  const { amount } = req.body;
  const user = req.session?.user;
  if (!user || user.role !== 'tenant') return res.status(403).json({ message: 'Unauthorized' });
  db.run(`INSERT INTO deposits (userId, amount, status) VALUES (?, ?, ?)`, [user.id, amount, 'pending'], (err) => {
    if (err) return res.status(400).json({ message: 'Request failed' });
    res.json({ message: 'Deposit refund requested' });
  });
});

app.post('/api/deposit/respond', upload.single('documentation'), (req, res) => {
  const { deduction } = req.body;
  const user = req.session?.user;
  if (!user || (user.role !== 'landlord' && user.role !== 'agent')) return res.status(403).json({ message: 'Unauthorized' });
  db.run(`UPDATE deposits SET status = ?, deduction = ?, documentation = ? WHERE status = ?`, ['responded', deduction, req.file?.path, 'pending'], (err) => {
    if (err) return res.status(400).json({ message: 'Response failed' });
    res.json({ message: 'Response submitted' });
  });
});

app.post('/api/deposit/accept', (req, res) => {
  const user = req.session?.user;
  if (!user || user.role !== 'tenant') return res.status(403).json({ message: 'Unauthorized' });
  db.run(`UPDATE deposits SET status = ? WHERE userId = ? AND status = ?`, ['accepted', user.id, 'responded'], (err) => {
    if (err) return res.status(400).json({ message: 'Accept failed' });
    res.json({ message: 'Deposit response accepted' });
  });
});

app.post('/api/deposit/dispute', (req, res) => {
  const user = req.session?.user;
  if (!user || user.role !== 'tenant') return res.status(403).json({ message: 'Unauthorized' });
  db.run(`UPDATE deposits SET status = ? WHERE userId = ? AND status = ?`, ['disputed', user.id, 'responded'], (err) => {
    if (err) return res.status(400).json({ message: 'Dispute failed' });
    res.json({ message: 'Deposit response disputed' });
  });
});

app.get('/api/deposit/status', (req, res) => {
  const user = req.session?.user;
  if (!user) return res.status(403).json({ message: 'Unauthorized' });
  db.get(`SELECT * FROM deposits WHERE userId = ?`, [user.id], (err, deposit) => {
    if (err) return res.status(400).json({ message: 'Error fetching status' });
    res.json({ email: user.email, role: user.role, depositStatus: deposit });
  });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
