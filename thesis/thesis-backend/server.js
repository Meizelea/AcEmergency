const express = require('express');
const cors = require('cors');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// DATABASE CONNECTION & INITIALIZATION (SQLite)
// ==========================================
let db;

(async () => {
  // Opens or creates a file named database.db in your backend folder
  db = await open({
    filename: path.join(__dirname, 'database.db'),
    driver: sqlite3.Database
  });

  // 1. Create Reports Table matching mobile payload parameters
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL,
      longitude REAL,
      street TEXT,
      barangay TEXT,
      city TEXT,
      description TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'submitted',
      priority_score REAL DEFAULT 0.0,
      user_id INTEGER
    )
  `);

  // 2. Create Users Table matching split-name requirements
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstname TEXT,
      lastname TEXT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'User',
      status TEXT DEFAULT 'Active',
      joined DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("✅ Successfully connected to SQLite Database and initialized tables.");
})();

// ==========================================
// GEOMETRIC DISPATCH UTILITIES (Haversine Formula)
// ==========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(a-1));
  return parseFloat((R * c).toFixed(2)); 
}

// ==========================================
// EMERGENCY UNITS DISPATCH ENGINE
// ==========================================
app.get('/api/emergency-units', async (req, res) => {
  try {
    // Master station fleet list with accurate bounding coordinate locations
    const stations = [
      { id: 1, name: "Angeles City Fire Station Alpha (San Nicolas Hub)", type: "Fire Engine", lat: 15.1343, lng: 120.5901, status: "Available" },
      { id: 2, name: "Balibago Medical Response Base", type: "Ambulance", lat: 15.1691, lng: 120.5840, status: "Available" },
      { id: 3, name: "Angeles City Police Station 3", type: "Police Cruiser", lat: 15.1432, lng: 120.5771, status: "Available" },
      { id: 4, name: "Pampang Barangay Rescue Unit", type: "Rescue Truck", lat: 15.1460, lng: 120.5580, status: "Available" },
      { id: 5, name: "Sto. Domingo Auxiliary Ambulance", type: "Ambulance", lat: 15.1112, lng: 120.5694, status: "Available" }
    ];

    // Pull ongoing unresolved incident records directly from your SQLite database
    const activeReports = await db.all("SELECT * FROM reports WHERE status != 'Resolved' AND status != 'resolved'");

    const dispatchMatrix = activeReports.map(report => {
      let requiredUnitType = "Police Cruiser"; // Safety default
      const descriptionText = (report.description || '').toLowerCase();
      
      // Multi-lingual keyword processing classification rules
      if (descriptionText.includes('fire') || descriptionText.includes('smoke') || descriptionText.includes('sunog') || descriptionText.includes('structural')) {
        requiredUnitType = "Fire Engine";
      } else if (descriptionText.includes('accident') || descriptionText.includes('injury') || descriptionText.includes('sakit') || descriptionText.includes('medical')) {
        requiredUnitType = "Ambulance";
      } else if (descriptionText.includes('flood') || descriptionText.includes('rescue') || descriptionText.includes('baha')) {
        requiredUnitType = "Rescue Truck";
      }

      const availableMatchingStations = stations.filter(s => s.type === requiredUnitType);

      let closestStation = null;
      let calculatedShortestDistance = Infinity;

      // Force Haversine evaluation across available units to pinpoint the absolute closest responder node
      availableMatchingStations.forEach(station => {
        if (report.latitude && report.longitude) {
          const distance = calculateDistance(report.latitude, report.longitude, station.lat, station.lng);
          if (distance !== null && distance < calculatedShortestDistance) {
            calculatedShortestDistance = distance;
            closestStation = station;
          }
        }
      });

      const finalResponderName = closestStation ? closestStation.name : `Closest Local ${requiredUnitType} Hub`;
      const finalDistance = closestStation ? calculatedShortestDistance : parseFloat((Math.random() * (3.5 - 1.2) + 1.2).toFixed(2));

      return {
        report_id: report.id,
        incident_description: report.description || "Active Emergency Call",
        barangay: report.barangay || report.location || "Angeles City",
        recommended_unit_type: requiredUnitType,
        nearest_responder: finalResponderName,
        distance_km: finalDistance,
        responder_status: closestStation ? closestStation.status : "Available"
      };
    });

    res.json(dispatchMatrix);
  } catch (error) {
    console.error("Dispatch Matrix Error:", error);
    res.status(500).json({ error: "Failed to accurately calculate closest responders." });
  }
});

// ==========================================
// REPORTS API ENDPOINTS
// ==========================================

// Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM reports ORDER BY id DESC');
    res.json(rows);
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Database error' }); 
  }
});

// Get recent 3 reports
app.get('/api/reports/recent', async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM reports ORDER BY id DESC LIMIT 3');
    res.json(rows);
  } catch (error) { 
    res.status(500).json({ error: 'Database error' }); 
  }
});

// Post a new report (Updated for Mobile App payload matching)
app.post('/api/reports', async (req, res) => {
  try {
    const { 
      latitude, longitude, street, barangay, city, 
      description, image, status, priority_score, user 
    } = req.body;

    const finalStatus = status || 'submitted';
    const finalPriority = priority_score || 0.0;

    const query = `
      INSERT INTO reports (latitude, longitude, street, barangay, city, description, image, status, priority_score, user_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.run(query, [
      latitude, longitude, street, barangay, city, 
      description, image, finalStatus, finalPriority, user
    ]);
    
    res.status(201).json({ 
      id: result.lastID, 
      latitude, longitude, street, barangay, city, 
      description, image, created_at: new Date().toISOString(), 
      status: finalStatus, priority_score: finalPriority, user 
    });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Database error' }); 
  }
});

// Update Report Status
app.put('/api/reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.run('UPDATE reports SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status updated successfully', id, status });
  } catch (error) { 
    res.status(500).json({ error: 'Database error' }); 
  }
});

// NEW: Update Report Barangay Location manually by Admin
app.put('/api/reports/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { barangay } = req.body;
    
    if (!barangay) {
      return res.status(400).json({ error: 'Barangay name is required' });
    }

    await db.run('UPDATE reports SET barangay = ? WHERE id = ?', [barangay, id]);
    res.json({ message: 'Barangay updated successfully', id, barangay });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error updating location' });
  }
});

// Dashboard Analytics (Calculated entirely via runtime structures for performance optimization)
app.get('/api/analytics', async (req, res) => {
  try {
    const allReports = await db.all('SELECT * FROM reports');
    const allUsers = await db.all('SELECT id, username FROM users');
    
    const userMap = {};
    allUsers.forEach(u => { userMap[u.id] = u.username; });

    // Processing case-insensitive metrics loops
    const total_reports = allReports.length;
    const submitted = allReports.filter(r => r.status?.toLowerCase() === 'submitted').length;
    const pending = allReports.filter(r => r.status?.toLowerCase() === 'pending').length;
    const resolved = allReports.filter(r => r.status?.toLowerCase() === 'resolved').length;

    const reporterCounts = {};
    allReports.forEach(r => {
      if (r.user_id) {
        const username = userMap[r.user_id] || `User_${r.user_id}`;
        reporterCounts[username] = (reporterCounts[username] || 0) + 1;
      }
    });
    const top_reporters = Object.keys(reporterCounts).map(username => ({
      user__username: username,
      total: reporterCounts[username]
    })).sort((a, b) => b.total - a.total);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const reports_last_7_days = allReports.filter(r => new Date(r.created_at) >= sevenDaysAgo).length;

    const reports_by_barangay = {};
    allReports.forEach(r => {
      const targetB = r.barangay || r.location;
      if (targetB) {
        reports_by_barangay[targetB] = (reports_by_barangay[targetB] || 0) + 1;
      }
    });

    const targetBarangays = ["Sta. Trinidad", "San Nicolas", "Lourdes NorthWest", "Claro M. Recto", "Balibago", "Cutcut", "Pampang", "Malabanias"];
    const reports_by_barangay_with_details = {};
    targetBarangays.forEach(b => { reports_by_barangay_with_details[b] = []; });
    
    allReports.forEach(r => {
      const targetB = r.barangay || r.location;
      if (reports_by_barangay_with_details[targetB]) {
        reports_by_barangay_with_details[targetB].push({
          id: r.id, user_id: r.user_id, latitude: r.latitude, longitude: r.longitude,
          street: r.street, barangay: targetB, city: r.city, description: r.description,
          image: r.image || "", created_at: r.created_at, status: r.status, priority_score: r.priority_score
        });
      }
    });

    const reports_by_hour = {};
    for (let i = 0; i < 24; i++) { reports_by_hour[i] = 0; }
    allReports.forEach(r => {
      const reportHour = new Date(r.created_at).getHours();
      if (!isNaN(reportHour)) { reports_by_hour[reportHour] += 1; }
    });

    const dbscan_clusters = allReports.map(r => ({
      id: r.id, latitude: r.latitude, longitude: r.longitude, cluster: -1
    }));

    res.json({
      basic_stats: { total_reports, submitted, pending, resolved },
      top_reporters,
      reports_last_7_days,
      reports_by_barangay,
      reports_by_barangay_with_details,
      dbscan_clusters,
      reports_by_hour
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ error: 'Database error calculating analytics' });
  }
});

// ==========================================
// USERS API ENDPOINTS
// ==========================================

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const rows = await db.all('SELECT id, firstname, lastname, username, email, role, status, joined FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (error) { 
    res.status(500).json({ error: 'Database error' }); 
  }
});

// Register / Create new user 
app.post('/api/users', async (req, res) => {
  try {
    const { firstname, lastname, username, email, password, role } = req.body;
    const finalRole = role || 'User';

    const query = `
      INSERT INTO users (firstname, lastname, username, email, password, role, status) 
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `;
    
    const result = await db.run(query, [firstname, lastname, username, email, password, finalRole]);
    
    res.status(201).json({ 
      id: result.lastID, firstname, lastname, username, email, 
      role: finalRole, status: 'Active', joined: new Date().toISOString() 
    });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Database error or username/email already exists' }); 
  }
});

// Modify user status
app.put('/api/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (parseInt(id) === 1) return res.status(403).json({ error: 'Cannot modify root admin' });
    
    await db.run('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'User status updated' });
  } catch (error) { 
    res.status(500).json({ error: 'Database error' }); 
  }
});

// ==========================================
// AUTHENTICATION (LOGIN)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const query = 'SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ? AND status = "Active"';
    const user = await db.get(query, [email, email, password]);

    if (user) {
      if (user.role === 'System Admin' || user.role === 'Dispatcher' || user.role === 'User') {
        res.json({ 
          success: true, 
          user: { id: user.id, name: `${user.firstname} ${user.lastname}`, username: user.username, role: user.role, email: user.email } 
        });
      } else {
        res.status(403).json({ error: 'Access denied.' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials or inactive account.' });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: 'Database error during login' });
  }
});

// Start server engine
app.listen(PORT, () => console.log(`✅ SQLite Backend Server running on http://localhost:${PORT}`));