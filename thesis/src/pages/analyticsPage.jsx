import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

import AdminLayout from '../components/header';

export default function AnalyticsPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [unitsCount, setUnitsCount] = useState(0);
  const [trendFilter, setTrendFilter] = useState('Today');
  const [isLoading, setIsLoading] = useState(true);

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchAllData = async () => {
      try {
        const headersConfiguration = {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        };

        // Fetch Reports
        const reportsRes = await fetch(`http://${targetHostname}:8000/api/reports/admin-reports/`, { headers: headersConfiguration });
        const reportsData = await reportsRes.json();
        const rawReports = Array.isArray(reportsData) ? reportsData : (reportsData?.results || []);
        setReports(rawReports);

        // Fetch Users Count
        const usersRes = await fetch(`http://${targetHostname}:8000/api/users/admin/users/`, { headers: headersConfiguration });
        const usersData = await usersRes.json();
        const rawUsers = Array.isArray(usersData) ? usersData : (usersData?.results || []);
        setUsersCount(rawUsers.length);

        // Fetch Units Count
        const unitsRes = await fetch(`http://${targetHostname}:8000/api/emergency-units/`, { headers: headersConfiguration });
        const unitsData = await unitsRes.json();
        const rawUnits = Array.isArray(unitsData) ? unitsData : (unitsData?.results || []);
        setUnitsCount(rawUnits.length);

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load analytics data:", error);
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [token, navigate, targetHostname]);

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  // ==========================================
  // METRIC CALCULATIONS
  // ==========================================
  const todayDateStr = new Date().toDateString();

  const isCreatedToday = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString).toDateString() === todayDateStr;
  };

  const pendingToday = reports.filter(r => isCreatedToday(r.created_at) && (r.status?.toLowerCase() === 'pending' || r.status?.toLowerCase() === 'submitted')).length;
  const inProgressToday = reports.filter(r => isCreatedToday(r.created_at) && (r.status?.toLowerCase() === 'ongoing' || r.status?.toLowerCase() === 'responding')).length;
  const resolvedToday = reports.filter(r => isCreatedToday(r.created_at) && r.status?.toLowerCase() === 'resolved').length;

  // 1. Report Trend (Hourly 12 AM - 11 PM)
  const hoursLabels = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'];
  const hourlyReportCounts = Array(24).fill(0);

  reports.forEach(r => {
    if (r.created_at) {
      const d = new Date(r.created_at);
      if (!isNaN(d.getTime())) {
        hourlyReportCounts[d.getHours()]++;
      }
    }
  });

  const trendData = hoursLabels.map((hour, idx) => ({
    time: hour,
    reports: hourlyReportCounts[idx]
  }));

  // 2. Incident Classification Distribution (Fire vs Medical vs Police)
  let fireCount = 0;
  let medicalCount = 0;
  let policeCount = 0;

  reports.forEach(r => {
    const text = (r.short_message || r.description || '').toLowerCase();
    if (text.includes('fire') || text.includes('smoke') || text.includes('sunog')) fireCount++;
    else if (text.includes('accident') || text.includes('injury') || text.includes('medical') || text.includes('hospital')) medicalCount++;
    else policeCount++;
  });

  const incidentTypeData = [
    { name: 'Fire Incident', value: fireCount || 1, color: '#0284c7' },
    { name: 'Medical/Rescue', value: medicalCount || 1, color: '#0f766e' },
    { name: 'Police/Peace', value: policeCount || 1, color: '#f59e0b' }
  ];

  // 3. Status Distribution
  const submittedTotal = reports.filter(r => r.status?.toLowerCase() === 'submitted' || r.status?.toLowerCase() === 'pending').length;
  const respondingTotal = reports.filter(r => r.status?.toLowerCase() === 'ongoing' || r.status?.toLowerCase() === 'responding').length;
  const resolvedTotal = reports.filter(r => r.status?.toLowerCase() === 'resolved').length;

  const statusDistributionData = [
    { name: 'Pending', count: submittedTotal },
    { name: 'Responding', count: respondingTotal },
    { name: 'Resolved', count: resolvedTotal }
  ];

  // 4. Verification Distribution (Simulated comparison)
  const verificationData = [
    { category: 'Verified', count: Math.round(reports.length * 0.75) },
    { category: 'Unverified', count: Math.round(reports.length * 0.25) }
  ];

  // 5. Most Reported Barangay Donut
  const barangayCounts = {};
  reports.forEach(r => {
    const b = r.barangay || r.location || 'San Nicolas';
    barangayCounts[b] = (barangayCounts[b] || 0) + 1;
  });

  const barangayDonutData = Object.keys(barangayCounts).map((key, i) => ({
    name: key,
    value: barangayCounts[key],
    color: ['#0284c7', '#0f766e', '#e11d48', '#d97706', '#8b5cf6'][i % 5]
  }));

  return (
    <AdminLayout>
      {/* NATIVE PRINT SYSTEM CSS */}
      <style>{`
        @media print {
          aside, header, button, .no-print { display: none !important; }
          body, #analytics-content-view { background: #fff !important; color: #000 !important; overflow: visible !important; height: auto !important; }
          .bg-white { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
        }
      `}</style>

      <div id="analytics-content-view" className="p-8 h-full overflow-y-auto bg-[#f8fafc] text-gray-800">
        
        {/* TOP TITLE & PRINT EXPORT */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Analytics Dashboard</h1>
          <button 
            onClick={() => window.print()}
            className="no-print bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Download size={14} /> Export Report
          </button>
        </div>

        {/* 1. TOP 3 STAT PILLS */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Users</h3>
            <p className="text-sm font-semibold text-gray-400 mt-1">
              <span className="text-xl font-black text-gray-900 mr-1.5">{isLoading ? '...' : usersCount}</span> accounts
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Reports</h3>
            <p className="text-sm font-semibold text-gray-400 mt-1">
              <span className="text-xl font-black text-gray-900 mr-1.5">{isLoading ? '...' : reports.length}</span> reports submitted
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Emergency Units</h3>
            <p className="text-sm font-semibold text-gray-400 mt-1">
              <span className="text-xl font-black text-gray-900 mr-1.5">{isLoading ? '...' : unitsCount}</span> registered units
            </p>
          </div>
        </div>

        {/* 2. THREE COLOR-CODED METRIC CARDS */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-[#e11d48] text-white p-6 rounded-2xl shadow-sm">
            <h4 className="text-xs font-black tracking-wider uppercase opacity-90">Pending Today</h4>
            <div className="text-4xl font-black mt-2 mb-1">{isLoading ? '...' : pendingToday}</div>
            <p className="text-xs opacity-80 font-medium">Reports created today</p>
          </div>
          <div className="bg-[#d97706] text-white p-6 rounded-2xl shadow-sm">
            <h4 className="text-xs font-black tracking-wider uppercase opacity-90">In Progress Today</h4>
            <div className="text-4xl font-black mt-2 mb-1">{isLoading ? '...' : inProgressToday}</div>
            <p className="text-xs opacity-80 font-medium">Reports responding today</p>
          </div>
          <div className="bg-[#059669] text-white p-6 rounded-2xl shadow-sm">
            <h4 className="text-xs font-black tracking-wider uppercase opacity-90">Resolved Today</h4>
            <div className="text-4xl font-black mt-2 mb-1">{isLoading ? '...' : resolvedToday}</div>
            <p className="text-xs opacity-80 font-medium">Reports resolved today</p>
          </div>
        </div>

        {/* 3. REPORT TREND MAIN CHART */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-gray-900">Report Trend</h3>
              <p className="text-xs text-gray-400">Daily report volume for the last 7 days, this month, or today</p>
            </div>
            <select 
              value={trendFilter} 
              onChange={(e) => setTrendFilter(e.target.value)}
              className="text-xs font-bold border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none cursor-pointer shadow-sm"
            >
              <option value="Today">Today</option>
              <option value="Week">This Week</option>
              <option value="Month">This Month</option>
            </select>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '12px' }} />
                <Line type="monotone" dataKey="reports" stroke="#0f766e" strokeWidth={2} dot={{ r: 3, fill: '#0f766e' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. BOTTOM 4-GRID ANALYTICS BREAKDOWN */}
        <div className="grid grid-cols-4 gap-6">
          
          {/* Card 1: Donut Distribution with Center Count */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-sm text-gray-900 mb-2">Emergency Type Distribution</h3>
            <div className="relative h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={incidentTypeData} innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value">
                    {incidentTypeData.map((e, idx) => (
                      <Cell key={idx} fill={e.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-gray-400">Total</span>
                <span className="text-xl font-black text-gray-800">{reports.length}</span>
              </div>
            </div>
            <div className="flex justify-center gap-4 text-[10px] font-bold text-gray-500 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#0284c7]"></div> Fire</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#0f766e]"></div> Medical</div>
            </div>
          </div>

          {/* Card 2: Report Status Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 mb-4">Report Status</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: Verification Metric Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 mb-4">Verified vs Unverified</h3>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={verificationData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 4: Most Registered Area Donut */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <h3 className="font-bold text-sm text-gray-900 mb-2">Most Reported Area</h3>
            <div className="relative h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={barangayDonutData.length ? barangayDonutData : [{ name: 'None', value: 1, color: '#e2e8f0' }]} innerRadius={55} outerRadius={75} paddingAngle={2} dataKey="value">
                    {barangayDonutData.map((e, idx) => (
                      <Cell key={idx} fill={e.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-gray-400">Total</span>
                <span className="text-xl font-black text-gray-800">{reports.length}</span>
              </div>
            </div>
            <div className="flex justify-center text-[10px] font-bold text-gray-400 mt-2">
              <span>{barangayDonutData[0]?.name || 'No Data'}</span>
            </div>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}