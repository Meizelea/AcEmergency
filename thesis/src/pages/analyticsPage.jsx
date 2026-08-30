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

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [usersCount, setUsersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today'); // 'today' | '7days' | 'month'

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      const headers = { 'Content-Type': 'application/json', 'Authorization': authPrefix };

      // 1. Fetch Reports
      const reportsRes = await fetch(`http://${targetHostname}:8000/api/reports/admin/`, { method: 'GET', headers });
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(Array.isArray(data) ? data : (data?.results || []));
      }

      // 2. Fetch Users Count
      const usersRes = await fetch(`http://${targetHostname}:8000/api/users/admin/users/`, { method: 'GET', headers });
      if (usersRes.ok) {
        const uData = await usersRes.json();
        const uList = Array.isArray(uData) ? uData : (uData?.results || []);
        setUsersCount(uList.length);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Analytics fetch error:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
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

  // Report Trend Time Series
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

    // Past 7 Days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const count = reports.filter(r => r.created_at && new Date(r.created_at).toDateString() === d.toDateString()).length;
      days.push({ time: dayStr, reports: count });
    }
    return days;
  }, [timeRange, todaysReports, reports]);

  // Barangay Distribution (Normalized)
  const barangayData = useMemo(() => {
    const counts = {
      'Sta. Trinidad': 0,
      'San Nicolas': 0,
      'Lourdes NorthWest': 0,
      'Claro M. Recto': 0
    };

    reports.forEach(r => {
      let b = r.barangay || r.location;
      if (b === 'Santa Trinidad' || b === 'San Trinidad') b = 'Sta. Trinidad';
      if (b === 'Lourdes Northwest' || b === 'Lourdes North West') b = 'Lourdes NorthWest';
      if (counts[b] !== undefined) {
        counts[b] += 1;
      }
    });

    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
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
          <button 
            onClick={fetchData} 
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* TIER 1: OVERALL SYSTEM COUNTS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Total Users</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{usersCount}</div>
            <span className="text-[11px] text-gray-400 font-medium">Registered resident & admin accounts</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Total Reports</span>
            <div className="text-2xl font-black text-gray-900 mt-1">{reports.length}</div>
            <span className="text-[11px] text-gray-400 font-medium">All-time emergency submissions</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <span className="text-xs font-bold text-gray-500 block">Covered Jurisdictions</span>
            <div className="text-2xl font-black text-gray-900 mt-1">4 Zones</div>
            <span className="text-[11px] text-gray-400 font-medium">Angeles City Priority Sectors</span>
          </div>
        </div>

        {/* TIER 2: HIGH-CONTRAST TODAY CARDS */}
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
              <h3 className="font-bold text-base text-gray-900">Report Trend</h3>
              <p className="text-xs text-gray-400">Daily and hourly emergency call volume</p>
            </div>
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 bg-white shadow-xs focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
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

        {/* BOTTOM ROW: 4-CARD BREAKDOWN GRID */}
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
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center">
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

          {/* Card 3: Jurisdictional Distribution Bar */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs flex flex-col col-span-1 md:col-span-2">
            <h4 className="font-bold text-sm text-gray-900 mb-4">Barangay Incident Distribution</h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barangayData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-2 border-t border-gray-100 pt-2 text-right">
              Aggregated across active & archived reports
            </div>
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}