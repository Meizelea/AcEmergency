const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE CONNECTION (XAMPP MySQL)
// ==========================================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',      // Default XAMPP username
  password: '',      // Default XAMPP password is empty
  database: 'emergency_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. GET ALL REPORTS (For the Report Management table)
app.get('/api/reports', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reports ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error("Error fetching all reports:", error);
    res.status(500).json({ error: 'Database error while fetching reports' });
  }
});

// 2. GET RECENT REPORTS (For the Dashboard recent list)
app.get('/api/reports/recent', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM reports ORDER BY id DESC LIMIT 3');
    res.json(rows);
  } catch (error) {
    console.error("Error fetching recent reports:", error);
    res.status(500).json({ error: 'Database error while fetching recent reports' });
  }
});

// 3. CREATE A NEW REPORT (From the App Simulator)
app.post('/api/reports', async (req, res) => {
  try {
    const { type, location } = req.body;
    
    // Generate today's date in MM/DD/YY format
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    const status = 'Pending';

    const query = 'INSERT INTO reports (type, location, date, status) VALUES (?, ?, ?, ?)';
    const [result] = await pool.query(query, [type, location, today, status]);

    res.status(201).json({
      id: result.insertId,
      type,
      location,
      date: today,
      status
    });
  } catch (error) {
    console.error("Error saving new report:", error);
    res.status(500).json({ error: 'Database error while saving report' });
  }
});

// 4. UPDATE REPORT STATUS (Clicking the buttons on the dashboard)
app.put('/api/reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const query = 'UPDATE reports SET status = ? WHERE id = ?';
    const [result] = await pool.query(query, [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Status updated successfully', id, status });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ error: 'Database error while updating status' });
  }
});

// 5. GET DYNAMIC ANALYTICS (Calculated directly from MySQL data)
app.get('/api/analytics', async (req, res) => {
  try {
    // Colors for the pie chart
    const colors = ['#b32d2d', '#f26522', '#ffc20e', '#6d6e71', '#939598', '#10b981', '#3b82f6'];

    // Bar Chart: Count reports grouped by location
    const [barRows] = await pool.query(
      'SELECT location AS d, COUNT(*) AS v FROM reports GROUP BY location LIMIT 6'
    );

    // Pie Chart: Count reports grouped by emergency type
    const [pieRows] = await pool.query(
      'SELECT type AS name, COUNT(*) AS value FROM reports GROUP BY type'
    );

    // Attach colors to the pie chart slices
    const formattedPieData = pieRows.map((row, index) => ({
      name: row.name,
      value: row.value,
      color: colors[index % colors.length]
    }));

    // Send the combined data back to React
    res.json({
      barChart: barRows,
      pieChart: formattedPieData
    });

  } catch (error) {
    console.error("Error calculating analytics:", error);
    res.status(500).json({ error: 'Database error while calculating analytics' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ MySQL Backend Server running on http://localhost:${PORT}`);
});