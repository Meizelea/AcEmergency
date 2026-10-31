import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, TrendingUp, AlertCircle, 
  Clock, CheckCircle2, Users, FileText, Shield, CalendarDays, X
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, CartesianGrid, BarChart, Bar 
} from 'recharts';

import AdminLayout from '../components/header';

export const ANGELES_BARANGAYS = [
  "Agapito del Rosario",
  "Santo Rosario",
  "Tabun",
  "Cutud",
  "Ninoy Aquino",
  "Santa Trinidad",
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

const DONUT_COLORS = ['#0284c7', '#0d9488', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899', '#6366f1'];

const CATEGORY_MAP = {
  'road_accident': 'Road Accident',
  'fire': 'Fire',
  'natural_hazard': 'Flooding and Natural Hazards',
  'medical_emergency': 'Medical Emergency',
  'infrastructure_hazard': 'Infrastructure Hazard',
  'public_safety': 'Public Safety Incident',
  'other': 'Other'
};

const CACHE_KEY_ANALYTICS_REPORTS = 'cache_analytics_reports_v5';
const CACHE_KEY_ANALYTICS_USERS = 'cache_analytics_users_v5';
const CACHE_KEY_ADMIN_PROFILE = 'cache_admin_profile_v5';

export default function AnalyticsPage() {
  const navigate = useNavigate();

  const [assignedBarangay, setAssignedBarangay] = useState(() => {
    try {
      const cachedProfile = sessionStorage.getItem(CACHE_KEY_ADMIN_PROFILE);
      if (cachedProfile) {
        const parsed = JSON.parse(cachedProfile);
        const brgy = parsed?.assigned_barangay || parsed?.barangay || parsed?.residential_barangay;
        if (brgy) return typeof brgy === 'object' ? (brgy.name || brgy.label) : brgy;
      }
      const storedUser = localStorage.getItem('ac_user_data') || localStorage.getItem('ac_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        const brgy = parsed?.assigned_barangay || parsed?.barangay || parsed?.residential_barangay;
        if (brgy) return typeof brgy === 'object' ? (brgy.name || brgy.label) : brgy;
      }
    } catch (err) {
      console.error("Error reading admin assigned barangay:", err);
    }
    return '';
  });

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
  
  // Default to '7days' (This Week) instead of 'all'
  const [timeRange, setTimeRange] = useState('7days');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const token = localStorage.getItem('ac_token');
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';

  const getAuthHeaders = useCallback((useBearer = false) => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return { 'Authorization': `${authPrefix} ${cleanToken}`, 'Content-Type': 'application/json' };
  }, [token]);

  const loadAdminProfile = useCallback(async () => {
    try {
      const rawToken = token || '';
      const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
      if (!cleanToken) return;

      for (const useBearer of [false, true]) {
        const res = await fetch(`${API_BASE_URL}/api/users/me/`, {
          headers: getAuthHeaders(useBearer)
        });

        if (res.ok) {
          const userData = await res.json();
          const rawBrgy = userData.assigned_barangay || userData.barangay || userData.residential_barangay;
          const cleanBrgy = typeof rawBrgy === 'object' ? (rawBrgy.name || rawBrgy.label) : rawBrgy;

          if (cleanBrgy) {
            setAssignedBarangay(cleanBrgy);
            localStorage.setItem('ac_user_data', JSON.stringify(userData));
            sessionStorage.setItem(CACHE_KEY_ADMIN_PROFILE, JSON.stringify(userData));
          }
          break;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch admin profile:', err);
    }
  }, [token, API_BASE_URL, getAuthHeaders]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadAdminProfile();
  }, [token, navigate, loadAdminProfile]);

  const reports = useMemo(() => {
    if (!assignedBarangay) return rawReports;
    const targetNorm = String(assignedBarangay).toLowerCase().replace(/^sta\.\s*/, 'santa ').trim();
    return rawReports.filter(r => {
      const b = String(r.barangay || r.location || '').toLowerCase().replace(/^sta\.\s*/, 'santa ').trim();
      return b.includes(targetNorm) || targetNorm.includes(b);
    });
  }, [rawReports, assignedBarangay]);

  const fetchData = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent && rawReports.length === 0) setIsLoading(true);
    setIsSyncing(true);

    try {
      await loadAdminProfile();

      let fetchedReports = [];
      for (const useBearer of [false, true]) {
        const reportsRes = await fetch(`${API_BASE_URL}/api/reports/admin/`, { 
          method: 'GET', 
          headers: getAuthHeaders(useBearer) 
        });

        if (reportsRes.ok) {
          const data = await reportsRes.json();
          fetchedReports = Array.isArray(data) ? data : (data?.results || []);
          setRawReports(fetchedReports);
          sessionStorage.setItem(CACHE_KEY_ANALYTICS_REPORTS, JSON.stringify(fetchedReports));
          break;
        }
      }

      for (const useBearer of [false, true]) {
        const usersRes = await fetch(`${API_BASE_URL}/api/users/admin/`, { 
          method: 'GET', 
          headers: getAuthHeaders(useBearer) 
        });

        if (usersRes.ok) {
          const uData = await usersRes.json();
          const uList = Array.isArray(uData) ? uData : (uData?.results || []);
          setUsersCount(uList.length);
          sessionStorage.setItem(CACHE_KEY_ANALYTICS_USERS, JSON.stringify(uList.length));
          break;
        }
      }

    } catch (error) {
      console.error("Analytics fetch error:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [token, API_BASE_URL, getAuthHeaders, rawReports.length, loadAdminProfile]);

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);

    const handleFocus = () => fetchData(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData]);

  const getCategoryName = (report) => {
    if (!report) return 'Other';

    let rawCategory = '';

    if (typeof report.category === 'object' && report.category !== null) {
      rawCategory = report.category.name || report.category.title || report.category.label || report.category.code || '';
    } else if (report.category_name) {
      rawCategory = report.category_name;
    } else if (report.category) {
      rawCategory = String(report.category);
    } else if (report.incident_type) {
      rawCategory = String(report.incident_type);
    }

    const cleanKey = rawCategory.toLowerCase().trim();
    if (CATEGORY_MAP[cleanKey]) {
      return CATEGORY_MAP[cleanKey];
    }

    return rawCategory || 'Other';
  };

  // Filter reports strictly by chosen time range or custom date range
  const timeFilteredReports = useMemo(() => {
    const now = new Date();

    if ((fromDate || toDate) && timeRange === 'custom') {
      const startMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
      const endMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
      return reports.filter(r => {
        if (!r.created_at) return false;
        const time = new Date(r.created_at).getTime();
        return time >= startMs && time <= endMs;
      });
    }

    if (timeRange === 'today') {
      const todayStr = now.toDateString();
      return reports.filter(r => r.created_at && new Date(r.created_at).toDateString() === todayStr);
    }

    if (timeRange === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return reports.filter(r => r.created_at && new Date(r.created_at) >= sevenDaysAgo);
    }

    if (timeRange === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return reports.filter(r => r.created_at && new Date(r.created_at) >= thirtyDaysAgo);
    }

    if (timeRange === 'year') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      return reports.filter(r => r.created_at && new Date(r.created_at) >= oneYearAgo);
    }

    return reports; // 'all'
  }, [reports, timeRange, fromDate, toDate]);

  const todayStr = new Date().toDateString();
  const todaysReports = useMemo(() => {
    return reports.filter(r => r.created_at && new Date(r.created_at).toDateString() === todayStr);
  }, [reports, todayStr]);

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

  // Trend Chart Data
  const trendData = useMemo(() => {
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

    if (timeRange === 'custom') {
      const dateMap = {};
      timeFilteredReports.forEach(r => {
        if (!r.created_at) return;
        const dStr = new Date(r.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        dateMap[dStr] = (dateMap[dStr] || 0) + 1;
      });

      const keys = Object.keys(dateMap);
      if (keys.length === 0) return [{ time: 'N/A', reports: 0 }];

      return keys.map(k => ({
        time: k,
        reports: dateMap[k]
      }));
    }

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
  }, [timeRange, todaysReports, reports, timeFilteredReports]);

  const hourlyData = useMemo(() => {
    const slots = [
      { slot: 'Morning (6A-12P)', count: 0 },
      { slot: 'Afternoon (12P-6P)', count: 0 },
      { slot: 'Evening (6P-12A)', count: 0 },
      { slot: 'Night (12A-6A)', count: 0 }
    ];

    timeFilteredReports.forEach(r => {
      if (!r.created_at) return;
      const h = new Date(r.created_at).getHours();
      if (h >= 6 && h < 12) slots[0].count++;
      else if (h >= 12 && h < 18) slots[1].count++;
      else if (h >= 18 && h < 24) slots[2].count++;
      else slots[3].count++;
    });

    return slots;
  }, [timeFilteredReports]);

  const statusPieData = useMemo(() => {
    const p = timeFilteredReports.filter(r => ['pending', 'submitted'].includes(String(r.status).toLowerCase())).length;
    const o = timeFilteredReports.filter(r => ['ongoing', 'responding'].includes(String(r.status).toLowerCase())).length;
    const res = timeFilteredReports.filter(r => String(r.status).toLowerCase() === 'resolved').length;
    return [
      { name: 'Pending', value: p, color: '#dc2626' },
      { name: 'Ongoing', value: o, color: '#0284c7' },
      { name: 'Resolved', value: res, color: '#16a34a' }
    ].filter(d => d.value > 0);
  }, [timeFilteredReports]);

  const incidentTypeData = useMemo(() => {
    const catMap = {};

    timeFilteredReports.forEach(r => {
      const catName = getCategoryName(r);
      catMap[catName] = (catMap[catName] || 0) + 1;
    });

    return Object.keys(catMap).map(catName => ({
      name: catName,
      value: catMap[catName]
    })).filter(d => d.value > 0);
  }, [timeFilteredReports]);

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f4f6f8]">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp size={22} className="text-[#b32d2d] shrink-0" />
            <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
              System Analytics & Insights
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-300 shadow-xs">
              Brgy. {assignedBarangay || 'Unassigned'} Jurisdiction
            </div>

            <button 
              onClick={() => {
                sessionStorage.removeItem(CACHE_KEY_ANALYTICS_REPORTS);
                sessionStorage.removeItem(CACHE_KEY_ANALYTICS_USERS);
                sessionStorage.removeItem(CACHE_KEY_ADMIN_PROFILE);
                fetchData(false);
              }} 
              disabled={isSyncing}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> 
              {isSyncing ? "Syncing..." : "Sync Data"}
            </button>
          </div>
        </div>

        {/* OVERALL COUNTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Total System Users</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{usersCount}</div>
            <span className="text-[11px] text-gray-400 font-medium">Registered resident & admin accounts</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">System Reports</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{reports.length}</div>
            <span className="text-[11px] text-gray-400 font-medium">
              Submissions in Brgy. {assignedBarangay || 'Unassigned'}
            </span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Covered Jurisdiction</span>
            <div className="text-2xl font-black text-gray-900 mt-1">
              {assignedBarangay ? `Brgy. ${assignedBarangay}` : 'Central Command'}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">
              Assigned Station Jurisdiction
            </span>
          </div>
        </div>

        {/* TODAY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#dc2626] text-white p-5 rounded-xl shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-red-100">Pending Today</span>
            <div className="text-4xl font-black mt-2">{pendingToday}</div>
            <span className="text-xs text-red-100 mt-1 block font-medium">Pending Reports</span>
          </div>

          <div className="bg-[#109EEF] text-white p-5 rounded-xl shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-white">Ongoing Today</span>
            <div className="text-4xl font-black mt-2">{inProgressToday}</div>
            <span className="text-xs text-blue-100 mt-1 block font-medium">Active Emergency Units</span>
          </div>

          <div className="bg-[#059669] text-white p-5 rounded-xl shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Resolved Today</span>
            <div className="text-4xl font-black mt-2">{resolvedToday}</div>
            <span className="text-xs text-emerald-100 mt-1 block font-medium">Completed Dispatches</span>
          </div>
        </div>

        {/* MAIN CENTER: REPORT TREND LINE CHART */}
        <div className="bg-white p-6 rounded-xl border border-gray-200/80 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-bold text-base text-gray-900">Report Trends</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* TIME RANGE HORIZON DROPDOWN */}
              <select 
                value={timeRange} 
                onChange={(e) => {
                  const val = e.target.value;
                  setTimeRange(val);
                  if (val !== 'custom') {
                    setFromDate('');
                    setToDate('');
                  }
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 bg-white shadow-xs focus:outline-none cursor-pointer"
              >
                <option value="7days">This Week (7 Days)</option>
                <option value="today">Today</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
                <option value="custom">Custom Date Range...</option>
                <option value="all">All Time</option>
              </select>

              {/* DUAL DATE PICKER FOR CUSTOM TIME WINDOW */}
              <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 py-1 shadow-xs text-xs text-gray-600 font-bold gap-2">
                <CalendarDays size={14} className="text-gray-400 shrink-0" />
                
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 uppercase">From</span>
                  <input 
                    type="date" 
                    value={fromDate} 
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setTimeRange('custom');
                    }} 
                    className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold text-gray-700" 
                  />
                </div>

                <span className="text-gray-300">•</span>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 uppercase">To</span>
                  <input 
                    type="date" 
                    value={toDate} 
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setTimeRange('custom');
                    }} 
                    className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold text-gray-700" 
                  />
                </div>

                {(fromDate || toDate) && (
                  <X 
                    size={14} 
                    className="text-gray-400 hover:text-red-500 cursor-pointer ml-1 shrink-0" 
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                      setTimeRange('7days');
                    }} 
                    title="Clear Custom Dates"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="h-64 w-full min-w-0">
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

        {/* BREAKDOWN GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Status Distribution Donut */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center">
            <h4 className="font-bold text-sm text-gray-900 self-start mb-4">Report Status</h4>
            <div className="h-44 w-full min-w-0 flex items-center justify-center relative">
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
                <span className="text-xl font-black text-gray-900">{timeFilteredReports.length}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Total</span>
              </div>
            </div>
            <div className="w-full flex justify-around text-[11px] font-bold text-gray-500 mt-2 border-t border-gray-100 pt-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Pending </span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600"></span> Ongoing </span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600"></span> Resolved</span>
            </div>
          </div>

          {/* Card 2: Dynamic Category Donut */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center">
            <h4 className="font-bold text-sm text-gray-900 self-start mb-4">Emergency Categories</h4>
            <div className="h-44 w-full min-w-0 flex items-center justify-center relative">
              {incidentTypeData.length === 0 ? (
                <span className="text-xs font-bold text-gray-400">No category records</span>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={incidentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={68} paddingAngle={4}>
                      {incidentTypeData.map((entry, idx) => (
                        <Cell key={`cell-cat-${idx}`} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-gray-900">{incidentTypeData.length}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Categories</span>
              </div>
            </div>
            <div className="w-full flex flex-wrap justify-center gap-2 text-[10px] font-bold text-gray-500 mt-2 border-t border-gray-100 pt-3">
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
            <h4 className="font-bold text-sm text-gray-900 mb-4">Peak Incident Hours</h4>
            <div className="h-44 w-full min-w-0">
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
              Dispatch call density grouped by time of day
            </div>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}