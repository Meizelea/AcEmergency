import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, TrendingUp, AlertCircle, 
  Clock, CheckCircle2, Users, FileText, Shield
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, CartesianGrid, BarChart, Bar 
} from 'recharts';

import AdminLayout from '../components/header';

export const ANGELES_BARANGAYS = [
  "Santa Trinidad",
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

const DONUT_COLORS = ['#0284c7', '#0d9488', '#f59e0b', '#dc2626', '#8b5cf6'];

// Cache Keys
const CACHE_KEY_ANALYTICS_REPORTS = 'cache_analytics_reports_v1';
const CACHE_KEY_ANALYTICS_USERS = 'cache_analytics_users_v1';
const CACHE_KEY_ADMIN_PROFILE = 'cache_admin_profile_v2';

export default function AnalyticsPage() {
  const navigate = useNavigate();

  // Retrieve assigned admin barangay accurately from session or local storage
  const assignedBarangay = useMemo(() => {
    try {
      const cachedProfile = sessionStorage.getItem(CACHE_KEY_ADMIN_PROFILE);
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        const brgy = parsed?.assigned_barangay || parsed?.residential_barangay || parsed?.barangay;
        if (brgy) return brgy;
      }
      const storedUser = localStorage.getItem('ac_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        return parsed?.assigned_barangay || parsed?.residential_barangay || parsed?.barangay || 'San Nicolas';
      }
    } catch (err) {
      console.error("Error reading admin assigned barangay:", err);
    }
    return 'San Nicolas';
  }, []);

  // Initialize state from sessionStorage if present
  const [rawReports, setRawReports] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_ANALYTICS_REPORTS);
    return cached ? JSON.parse(cached) : [];
  });

  const [usersCount, setUsersCount] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_ANALYTICS_USERS);
    return cached ? JSON.parse(cached) : 0;
  });

  const [isLoading, setIsLoading] = useState(() => rawReports.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Expanded Time Range Options: 'today' | '7days' | 'month' | 'year' | 'all'
  const [timeRange, setTimeRange] = useState('today');

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';
  const API_BASE_URL = `http://${targetHostname}:8000`;

  // Filter reports exclusively for the assigned Barangay
  const reports = useMemo(() => {
    if (!assignedBarangay) return rawReports;
    const targetNorm = assignedBarangay.toLowerCase().replace(/^sta\.\s*/, 'santa ');
    return rawReports.filter(r => {
      const b = (r.barangay || r.location || '').toLowerCase().replace(/^sta\.\s*/, 'santa ');
      return b.includes(targetNorm) || targetNorm.includes(b);
    });
  }, [rawReports, assignedBarangay]);

  const fetchData = async (silent = false) => {
    if (!token) return;
    if (!silent && rawReports.length === 0) setIsLoading(true);
    setIsSyncing(true);

    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      const headers = { 'Content-Type': 'application/json', 'Authorization': authPrefix };

      // 1. Fetch Reports
      const reportsRes = await fetch(`${API_BASE_URL}/api/reports/admin/`, { method: 'GET', headers });
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        const list = Array.isArray(data) ? data : (data?.results || []);
        setRawReports(list);
        sessionStorage.setItem(CACHE_KEY_ANALYTICS_REPORTS, JSON.stringify(list));
      }

      // 2. Fetch Users Count
      const usersRes = await fetch(`${API_BASE_URL}/api/users/admin/`, { method: 'GET', headers });
      if (usersRes.ok) {
        const uData = await usersRes.json();
        const uList = Array.isArray(uData) ? uData : (uData?.results || []);
        setUsersCount(uList.length);
        sessionStorage.setItem(CACHE_KEY_ANALYTICS_USERS, JSON.stringify(uList.length));
      }

    } catch (error) {
      console.error("Analytics fetch error:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    const hasCache = Boolean(sessionStorage.getItem(CACHE_KEY_ANALYTICS_REPORTS));
    fetchData(hasCache);
  }, [token, navigate, targetHostname]);

  // Calculations for Today's Metrics
  const today = new Date().toDateString();
  const todaysReports = useMemo(() => {
    return reports.filter(r => r.created_at && new Date(r.created_at).toDateString() === today);
  }, [reports, today]);

  const pendingToday = todaysReports.filter(r => {
    const s = String(r.status).toLowerCase();
    return s === 'pending' || s === 'submitted';
  }).length;

  const inProgressToday = todaysReports.filter(r => {
    const s = String(r.status).toLowerCase();
    return s === 'ongoing' || s === 'responding';
  }).length;

  const resolvedToday = todaysReports.filter(r => {
    const s = String(r.status).toLowerCase();
    return s === 'resolved';
  }).length;

  // Report Trend Time Series (Expanded Range Aggregation)
  const trendData = useMemo(() => {
    // 1. TODAY
    if (timeRange === 'today') {
      const hours = ['12 AM', '2 AM', '4 AM', '6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM', '10 PM'];
      return hours.map((hourLabel, idx) => {
        const hour24Start = idx * 2;
        const count = todaysReports.filter(r => {
          if (!r.created_at) return false;
          const h = new Date(r.created_at).getHours();
          return h >= hour24Start && h < hour24Start + 2;
        }).length;
        return { time: hourLabel, reports: count };
      });
    }

    // 2. THIS WEEK (7 DAYS)
    if (timeRange === '7days') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        const count = reports.filter(r => r.created_at && new Date(r.created_at).toDateString() === d.toDateString()).length;
        days.push({ time: dayStr, reports: count });
      }
      return days;
    }

    // 3. PAST MONTH (30 DAYS)
    if (timeRange === 'month') {
      const days = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        const count = reports.filter(r => r.created_at && new Date(r.created_at).toDateString() === d.toDateString()).length;
        days.push({ time: dayStr, reports: count });
      }
      return days;
    }

    // 4. PAST YEAR (12 MONTHS)
    if (timeRange === 'year') {
      const months = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
        const m = d.getMonth();
        const y = d.getFullYear();

        const count = reports.filter(r => {
          if (!r.created_at) return false;
          const rDate = new Date(r.created_at);
          return rDate.getMonth() === m && rDate.getFullYear() === y;
        }).length;

        months.push({ time: monthLabel, reports: count });
      }
      return months;
    }

    // 5. ALL TIME (YEARLY AGGREGATION)
    if (timeRange === 'all') {
      const yearMap = {};
      reports.forEach(r => {
        if (!r.created_at) return;
        const y = new Date(r.created_at).getFullYear();
        yearMap[y] = (yearMap[y] || 0) + 1;
      });

      const sortedYears = Object.keys(yearMap).sort((a, b) => Number(a) - Number(b));
      if (sortedYears.length === 0) {
        return [{ time: new Date().getFullYear().toString(), reports: 0 }];
      }

      return sortedYears.map(yearStr => ({
        time: yearStr,
        reports: yearMap[yearStr]
      }));
    }

    return [];
  }, [timeRange, todaysReports, reports]);

  // Hourly Call Volume Distribution for assigned barangay
  const hourlyData = useMemo(() => {
    const slots = [
      { slot: 'Morning (6A-12P)', count: 0 },
      { slot: 'Afternoon (12P-6P)', count: 0 },
      { slot: 'Evening (6P-12A)', count: 0 },
      { slot: 'Night (12A-6A)', count: 0 }
    ];

    reports.forEach(r => {
      if (!r.created_at) return;
      const h = new Date(r.created_at).getHours();
      if (h >= 6 && h < 12) slots[0].count++;
      else if (h >= 12 && h < 18) slots[1].count++;
      else if (h >= 18 && h < 24) slots[2].count++;
      else slots[3].count++;
    });

    return slots;
  }, [reports]);

  // Status Distribution for Donut
  const statusPieData = useMemo(() => {
    const p = reports.filter(r => ['pending', 'submitted'].includes(String(r.status).toLowerCase())).length;
    const o = reports.filter(r => ['ongoing', 'responding'].includes(String(r.status).toLowerCase())).length;
    const res = reports.filter(r => String(r.status).toLowerCase() === 'resolved').length;
    return [
      { name: 'Pending', value: p, color: '#dc2626' },
      { name: 'In Progress', value: o, color: '#f59e0b' },
      { name: 'Resolved', value: res, color: '#16a34a' }
    ].filter(d => d.value > 0);
  }, [reports]);

  // Incident Type Classifier
  const incidentTypeData = useMemo(() => {
    let medical = 0;
    let fire = 0;
    let rescue = 0;

    reports.forEach(r => {
      const text = (r.short_message || r.description || '').toLowerCase();
      if (text.includes('fire') || text.includes('sunog') || text.includes('smoke')) fire++;
      else if (text.includes('medical') || text.includes('injury') || text.includes('accident')) medical++;
      else rescue++;
    });

    return [
      { name: 'Medical', value: medical },
      { name: 'Fire', value: fire },
      { name: 'Rescue / Other', value: rescue }
    ].filter(d => d.value > 0);
  }, [reports]);

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f4f6f8]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-[#b32d2d]" />
            <h1 className="text-xl font-black text-gray-900 tracking-tight">
              System Analytics & Insights (Brgy. {assignedBarangay})
            </h1>
          </div>

          <button 
            onClick={() => {
              sessionStorage.removeItem(CACHE_KEY_ANALYTICS_REPORTS);
              sessionStorage.removeItem(CACHE_KEY_ANALYTICS_USERS);
              fetchData(false);
            }} 
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> Sync Data
          </button>
        </div>

        {/* TIER 1: OVERALL SYSTEM COUNTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Total System Users</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{usersCount}</div>
            <span className="text-[11px] text-gray-400 font-medium">Registered resident & admin accounts</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Barangay Reports</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{reports.length}</div>
            <span className="text-[11px] text-gray-400 font-medium">Total submissions in Brgy. {assignedBarangay}</span>
          </div>

          {/* DYNAMIC ASSIGNED JURISDICTION CARD */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Covered Jurisdiction</span>
            <div className="text-2xl font-black text-gray-900 mt-1">
              Brgy. {assignedBarangay}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">
              Assigned Station Jurisdiction
            </span>
          </div>
        </div>

        {/* TIER 2: TODAY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#dc2626] text-white p-5 rounded-xl shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-red-100">Pending Today</span>
            <div className="text-4xl font-black mt-2">{pendingToday}</div>
            <span className="text-xs text-red-200 mt-1 block">Reports requiring initial triage</span>
          </div>

          <div className="bg-[#d97706] text-white p-5 rounded-xl shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-100">In Progress Today</span>
            <div className="text-4xl font-black mt-2">{inProgressToday}</div>
            <span className="text-xs text-amber-200 mt-1 block">Active responding fleet units</span>
          </div>

          <div className="bg-[#059669] text-white p-5 rounded-xl shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Resolved Today</span>
            <div className="text-4xl font-black mt-2">{resolvedToday}</div>
            <span className="text-xs text-emerald-200 mt-1 block">Dispatches concluded today</span>
          </div>
        </div>

        {/* MAIN CENTER: REPORT TREND LINE CHART */}
        <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-xs mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base text-gray-900">Sector Report Volume Trend</h3>
              <p className="text-xs text-gray-400">Call volume for Brgy. {assignedBarangay}</p>
            </div>

            {/* EXPANDED TIME RANGE DROPDOWN */}
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 bg-white shadow-xs focus:outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="7days">This Week (7 Days)</option>
              <option value="month">Past Month</option>
              <option value="year">Past Year</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                <Area type="monotone" dataKey="reports" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReports)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BOTTOM ROW: BREAKDOWN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Status Distribution Donut */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center">
            <h4 className="font-bold text-sm text-gray-900 self-start mb-4">Report Status</h4>
            <div className="h-44 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={68} paddingAngle={4}>
                    {statusPieData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-gray-900">{reports.length}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Total</span>
              </div>
            </div>
            <div className="w-full flex justify-around text-[11px] font-bold text-gray-500 mt-2 border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Pend</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Resp</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600"></span> Res</span>
            </div>
          </div>

          {/* Card 2: Incident Type Donut */}
          <div className="bg-[#ffffff] p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center">
            <h4 className="font-bold text-sm text-gray-900 self-start mb-4">Incident Types</h4>
            <div className="h-44 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={incidentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={68} paddingAngle={4}>
                    {incidentTypeData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-gray-900">{incidentTypeData.length}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Types</span>
              </div>
            </div>
            <div className="w-full flex justify-around text-[11px] font-bold text-gray-500 mt-2 border-t border-gray-100 pt-3">
              {incidentTypeData.map((item, idx) => (
                <span key={item.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span> 
                  {item.name}
                </span>
              ))}
            </div>
          </div>

          {/* Card 3: Sector Peak Incident Hours */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col col-span-1 md:col-span-2">
            <h4 className="font-bold text-sm text-gray-900 mb-4">Peak Incident Hours (Brgy. {assignedBarangay})</h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="slot" tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 600 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#b32d2d" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 border-t border-gray-100 pt-2 text-right">
              Dispatch call density in Brgy. {assignedBarangay} grouped by time of day
            </div>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}