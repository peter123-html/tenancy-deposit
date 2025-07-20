const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Ensure uploads folder exists
const uploadDir = './uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Set up SQLite database
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Database error:', err.message);
    return;
  }
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
});

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key', // Replace with a secure key
