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

  // 1. Create Reports Table matching mobile payload
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

  // 2. Create Users Table matching new fields
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

// Dashboard Analytics (Updated to use city/barangay grouping mapping layout)
app.get('/api/analytics', async (req, res) => {
  try {
    // 1. Fetch all raw reports and users needed for complex calculations
    const allReports = await db.all('SELECT * FROM reports');
    const allUsers = await db.all('SELECT id, username FROM users');
    
    // Create a quick lookup map for usernames based on user ID
    const userMap = {};
    allUsers.forEach(u => { userMap[u.id] = u.username; });

    // 2. Compute basic stats
    const total_reports = allReports.length;
    const submitted = allReports.filter(r => r.status === 'submitted').length;
    const pending = allReports.filter(r => r.status === 'pending' || r.status === 'Pending').length;
    const resolved = allReports.filter(r => r.status === 'resolved' || r.status === 'Resolved').length;

    // 3. Compute top reporters
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

    // 4. Compute reports in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const reports_last_7_days = allReports.filter(r => new Date(r.created_at) >= sevenDaysAgo).length;

    // 5. Compute reports by barangay simple list
    const reports_by_barangay = {};
    allReports.forEach(r => {
      if (r.barangay) {
        reports_by_barangay[r.barangay] = (reports_by_barangay[r.barangay] || 0) + 1;
      }
    });

    // 6. Compute reports by barangay with full details (Targeting specific thesis boundary layers)
    const targetBarangays = ["Sta. Trinidad", "San Nicolas", "Lourdes NorthWest", "Claro M. Recto"];
    const reports_by_barangay_with_details = {};
    
    // Initialize empty arrays for your target dashboard barangays
    targetBarangays.forEach(b => { reports_by_barangay_with_details[b] = []; });
    
    // Populate with matching report records
    allReports.forEach(r => {
      if (reports_by_barangay_with_details[r.barangay]) {
        reports_by_barangay_with_details[r.barangay].push({
          id: r.id,
          user_id: r.user_id,
          latitude: r.latitude,
          longitude: r.longitude,
          street: r.street,
          barangay: r.barangay,
          city: r.city,
          description: r.description,
          image: r.image || "",
          created_at: r.created_at,
          status: r.status,
          priority_score: r.priority_score
        });
      }
    });

    // 7. Compute hourly distributions (0-23 hours)
    const reports_by_hour = {};
    for (let i = 0; i < 24; i++) { reports_by_hour[i] = 0; }
    
    allReports.forEach(r => {
      const reportHour = new Date(r.created_at).getHours();
      if (!isNaN(reportHour)) {
        reports_by_hour[reportHour] += 1;
      }
    });

    // 8. Mock DBSCAN clusters structure matching your machine learning coordinates payload
    // Note: If you want actual live DBSCAN execution directly in this JS file later, 
    // we can implement a simple clustering algorithm or pull from a python script.
    const dbscan_clusters = allReports.map(r => ({
      id: r.id,
      latitude: r.latitude,
      longitude: r.longitude,
      cluster: -1 // Defaulting to noise (-1) as per your example structure
    }));

    // 9. Assemble and return the complete payload structure
    res.json({
      basic_stats: {
        total_reports,
        submitted,
        pending,
        resolved
      },
      top_reporters,
      reports_last_7_days,
      reports_by_barangay,
      reports_by_barangay_with_details,
      dbscan_clusters,
      reports_by_hour
    });

  } catch (error) {
    console.error("Analytics Calculation Error:", error);
    res.status(500).json({ error: 'Database error calculating analytics dashboards' });
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

// Register / Create new user (Updated with new keys requested)
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
      id: result.lastID, 
      firstname, lastname, username, email, 
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

    // Search for a user with the matching email/username, password, and active status
    const query = 'SELECT * FROM users WHERE (email = ? OR username = ?) AND password = ? AND status = "Active"';
    const user = await db.get(query, [email, email, password]);

    if (user) {
      // Access Control: Dashboard access restricted to admins and dispatchers
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

// ==========================================
// EMERGENCY UNITS DISPATCH ENGINE
// ==========================================

// Simple Haversine formula to compute distance between coordinates in Kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(a-1));
  return parseFloat((R * c).toFixed(2)); // Distance in km
}

app.get('/api/emergency-units', async (req, res) => {
  try {
    // 1. Mock Database list of active emergency units with their real-time base locations
    const units = [
      { id: 1, name: "Angeles Fire Station Alpha", type: "Fire Engine", lat: 15.1343, lng: 120.5901, status: "Available" },
      { id: 2, name: "Balibago Medical Response Team", type: "Ambulance", lat: 15.1691, lng: 120.5840, status: "Available" },
      { id: 3, name: "Angeles City Police Station 3", type: "Police Cruiser", lat: 15.1432, lng: 120.5771, status: "Available" },
      { id: 4, name: "Pampang Medical Dispatch", type: "Ambulance", lat: 15.1460, lng: 120.5580, status: "Busy" },
      { id: 5, name: "Marisol Central Rescue", type: "Rescue Truck", lat: 15.1310, lng: 120.6010, status: "Available" }
    ];

    // 2. Fetch reports to find active, unresolved entries
    const activeReports = await db.all("SELECT * FROM reports WHERE status != 'Resolved' AND status != 'resolved'");

    // 3. Match each report to its smartest unit type match and closest distance matrix
    const dispatchMatrix = activeReports.map(report => {
      // Logic mapping: What type of vehicle *should* go?
      let recommendedUnitType = "Police Cruiser"; // default safety backup
      const description = (report.description || '').toLowerCase();
      
      if (description.includes('fire') || description.includes('smoke') || description.includes('burn')) {
        recommendedUnitType = "Fire Engine";
      } else if (description.includes('accident') || description.includes('injury') || description.includes('hurt') || description.includes('patient')) {
        recommendedUnitType = "Ambulance";
      } else if (description.includes('rescue') || description.includes('flood') || description.includes('trapped')) {
        recommendedUnitType = "Rescue Truck";
      }

      // Filter units matching that specific structural recommendation
      const matchingUnits = units.filter(u => u.type === recommendedUnitType);

      let nearestUnit = null;
      let minDistance = Infinity;

      // Distance calculation matrix loop
      matchingUnits.forEach(unit => {
        if (report.latitude && report.longitude) {
          const dist = calculateDistance(report.latitude, report.longitude, unit.lat, unit.lng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestUnit = unit;
          }
        }
      });

      return {
        report_id: report.id,
        incident_description: report.description || "Emergency Call",
        barangay: report.barangay || report.location || "Unknown",
        recommended_unit_type: recommendedUnitType,
        nearest_responder: nearestUnit ? nearestUnit.name : "No matching units currently available",
        distance_km: nearestUnit ? minDistance : null,
        responder_status: nearestUnit ? nearestUnit.status : "N/A"
      };
    });

    res.json(dispatchMatrix);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process tactical unit distance matrix." });
  }
});

// Start server engine
app.listen(PORT, () => console.log(`✅ SQLite Backend Server running on http://localhost:${PORT}`));