const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE CONNECTION (XAMPP MySQL)
// ==========================================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'emergency_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==========================================
// REPORTS API ENDPOINTS
// ==========================================
app.get('/api/reports', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reports ORDER BY id DESC');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/reports/recent', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reports ORDER BY id DESC LIMIT 3');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/reports', async (req, res) => {
  try {
    const { type, location, reporter } = req.body;
    const finalReporter = reporter || 'System Admin'; 
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    
    const query = 'INSERT INTO reports (type, location, date, status, reporter) VALUES (?, ?, ?, ?, ?)';
    const [result] = await pool.query(query, [type, location, today, 'Pending', finalReporter]);
    
    res.status(201).json({ id: result.insertId, type, location, date: today, status: 'Pending', reporter: finalReporter });
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.put('/api/reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.query('UPDATE reports SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status updated successfully', id, status });
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.get('/api/analytics', async (req, res) => {
  try {
    const colors = ['#b32d2d', '#f26522', '#ffc20e', '#6d6e71', '#939598', '#10b981', '#3b82f6'];
    const [barRows] = await pool.query('SELECT location AS d, COUNT(*) AS v FROM reports GROUP BY location LIMIT 6');
    const [pieRows] = await pool.query('SELECT type AS name, COUNT(*) AS value FROM reports GROUP BY type');
    
    const formattedPieData = pieRows.map((row, index) => ({
      name: row.name, value: row.value, color: colors[index % colors.length]
    }));
    
    res.json({ barChart: barRows, pieChart: formattedPieData });
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

// ==========================================
// USERS API ENDPOINTS
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;
    const joinedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const query = 'INSERT INTO users (name, email, phone, role, status, joined) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await pool.query(query, [name, email, phone, role, 'Active', joinedDate]);
    res.status(201).json({ id: result.insertId, name, email, phone, role, status: 'Active', joined: joinedDate });
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.put('/api/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (parseInt(id) === 1) return res.status(403).json({ error: 'Cannot modify root admin' });
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'User status updated' });
  } catch (error) { res.status(500).json({ error: 'Database error' }); }
});

app.listen(PORT, () => console.log(`✅ MySQL Backend Server running on http://localhost:${PORT}`));

// ==========================================
// AUTHENTICATION (LOGIN)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Search for a user with the matching email, password, and an 'Active' status
    const query = 'SELECT * FROM users WHERE email = ? AND password = ? AND status = "Active"';
    const [users] = await pool.query(query, [email, password]);

    // If a user is found...
    if (users.length > 0) {
      const user = users[0];
      
      // Security Check: Only let Admins or Dispatchers into the web dashboard
      if (user.role === 'System Admin' || user.role === 'Dispatcher') {
        res.json({ 
          success: true, 
          user: { id: user.id, name: user.name, role: user.role, email: user.email } 
        });
      } else {
        res.status(403).json({ error: 'Access denied. Dashboard is for Admins/Dispatchers only.' });
      }
    } else {
      res.status(401).json({ error: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: 'Database error during login' });
  }
});