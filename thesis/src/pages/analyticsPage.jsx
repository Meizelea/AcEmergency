import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, TrendingUp, AlertCircle, 
  Clock, CheckCircle2, Users, FileText, Shield, CalendarDays, X, Download, Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, CartesianGrid, BarChart, Bar 
} from 'recharts';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const pdfRef = useRef(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

      for (const useBearer of [false, true]) {
        try {
          const reportsRes = await fetch(`${API_BASE_URL}/api/reports/admin/`, { 
            method: 'GET', 
            headers: getAuthHeaders(useBearer) 
          });

          if (reportsRes.ok) {
            const data = await reportsRes.json();
            const fetchedReports = Array.isArray(data) ? data : (data?.results || []);
            setRawReports(fetchedReports);
            sessionStorage.setItem(CACHE_KEY_ANALYTICS_REPORTS, JSON.stringify(fetchedReports));
            break;
          }
        } catch (err) {
          console.warn("Reports fetch attempt failed:", err);
        }
      }

      for (const useBearer of [false, true]) {
        try {
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
        } catch (err) {
          console.warn("Users fetch attempt failed:", err);
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

    return reports;
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

  const handleDownloadPDF = async () => {
    if (!pdfRef.current) return;
    setIsExportingPdf(true);

    try {
      const element = pdfRef.current;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth - 12;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 6, 6, imgWidth, Math.min(imgHeight, pdfHeight - 12));

      const brgyTag = assignedBarangay ? assignedBarangay.replace(/\s+/g, '_') : 'General';
      pdf.save(`Aksyon_Analytics_${brgyTag}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <AdminLayout>
      {/* PERFECT A4 PORTRAIT PRINT OVERRIDES - COMPLETELY STRIPS SCROLLBARS & RE-ALIGNS RECHARTS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            background-color: #ffffff !important;
            color: #111827 !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Hide Web Nav Bar, Sidebars, and Web Container */
          header, nav, sidebar, .no-print, button, select, input, ::-webkit-scrollbar {
            display: none !important;
          }

          /* Force Main Printable Ref to fill full A4 height without scrollbars */
          .print-capture-root {
            width: 100vw !important;
            min-height: 100vh !important;
            margin: 0 !important;
            padding: 12mm 10mm !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          .grid-3-cols {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 12px !important;
          }

          /* Explicit SVG Height fixes so Recharts doesn't get cut off or overflow */
          .recharts-wrapper, .recharts-surface {
            overflow: visible !important;
            width: 100% !important;
          }
          
          .chart-box-trends {
            height: 240px !important;
          }
          .chart-box-donuts {
            height: 180px !important;
          }
        }
      `}</style>

      <div className="p-4 sm:p-6 bg-[#f4f6f8] min-h-screen">
        
        {/* TOP CONTROLS (HIDDEN ON PRINT) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 no-print">
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
              onClick={handleDownloadPDF}
              disabled={isExportingPdf || isLoading}
              className="bg-[#b32d2d] hover:bg-[#8e2323] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Download PDF</span>
                </>
              )}
            </button>

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

        {/* PRINTABLE CONTAINER (STANDALONE CLEAN PDF ROOT) */}
        <div ref={pdfRef} className="print-capture-root bg-white p-6 rounded-xl border border-gray-200 shadow-xs max-w-7xl mx-auto space-y-5 overflow-hidden">
          
          {/* AKSYON HEADER BANNER */}
          <div className="bg-[#b32d2d] text-white p-4 rounded-lg flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Aksyon</h2>
              <p className="text-xs text-red-100 font-medium">Executive Analytics & System Insights Report</p>
            </div>
            <div className="text-right text-xs font-bold">
              <div>Jurisdiction: Brgy. {assignedBarangay || 'Central Command'}</div>
              <div className="text-[10px] text-red-100 font-normal">Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>

          {/* ROW 1: STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 grid-3-cols gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
              <span className="text-xs font-bold text-gray-500 block uppercase">Total System Users</span>
              <div className="text-3xl font-black text-gray-900 mt-1">{usersCount}</div>
              <span className="text-[10px] text-gray-400 font-medium">Registered resident & admin accounts</span>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
              <span className="text-xs font-bold text-gray-500 block uppercase">System Reports</span>
              <div className="text-3xl font-black text-gray-900 mt-1">{reports.length}</div>
              <span className="text-[10px] text-gray-400 font-medium">Submissions in Brgy. {assignedBarangay || 'Unassigned'}</span>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
              <span className="text-xs font-bold text-gray-500 block uppercase">Covered Jurisdiction</span>
              <div className="text-xl font-black text-gray-900 mt-1">{assignedBarangay ? `Brgy. ${assignedBarangay}` : 'Central Command'}</div>
              <span className="text-[10px] text-gray-400 font-medium">Assigned Station Jurisdiction</span>
            </div>
          </div>

          {/* ROW 2: TODAY STATUS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 grid-3-cols gap-4">
            <div className="bg-[#059669] text-white p-4 rounded-lg flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Resolved Today</span>
              <div className="text-3xl font-black mt-1">{resolvedToday}</div>
              <span className="text-[10px] text-emerald-100 font-medium block">Completed Dispatches</span>
            </div>

            <div className="bg-[#109EEF] text-white p-4 rounded-lg flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white">Ongoing Today</span>
              <div className="text-3xl font-black mt-1">{inProgressToday}</div>
              <span className="text-[10px] text-blue-100 font-medium block">Active Emergency Units</span>
            </div>

            <div className="bg-[#dc2626] text-white p-4 rounded-lg flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-red-100">Pending Today</span>
              <div className="text-3xl font-black mt-1">{pendingToday}</div>
              <span className="text-[10px] text-red-100 font-medium block">Pending Reports</span>
            </div>
          </div>

          {/* ROW 3: REPORT TRENDS LINE CHART */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-gray-900">Report Trends</h3>
              <div className="flex items-center gap-2 no-print">
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
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs font-bold bg-white text-gray-700"
                >
                  <option value="7days">This Week (7 Days)</option>
                  <option value="today">Today</option>
                  <option value="month">Past Month</option>
                  <option value="year">Past Year</option>
                  <option value="custom">Custom Date Range...</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>

            <div className="h-64 chart-box-trends w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 20, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="time" 
                    interval={timeRange === 'month' ? 4 : 'preserveStartEnd'}
                    tick={{ fontSize: 10, fill: '#6b7280' }} 
                    dy={5}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="reports" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReports)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROW 4: 3 BREAKDOWN CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 grid-3-cols gap-4">
            
            {/* Box 1: Status Donut Chart */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
              <h4 className="font-bold text-xs text-gray-900 mb-2">Report Status</h4>
              <div className="h-44 chart-box-donuts w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={4}>
                      {statusPieData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-black text-gray-900">{timeFilteredReports.length}</span>
                  <span className="text-[8px] uppercase font-bold text-gray-400">Total</span>
                </div>
              </div>
              <div className="w-full flex justify-around text-[9px] font-bold text-gray-500 border-t border-gray-200 pt-2 mt-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Pending </span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600"></span> Ongoing </span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600"></span> Resolved</span>
              </div>
            </div>

            {/* Box 2: Emergency Categories Donut Chart */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
              <h4 className="font-bold text-xs text-gray-900 mb-2">Emergency Categories</h4>
              <div className="h-44 chart-box-donuts w-full flex items-center justify-center relative">
                {incidentTypeData.length === 0 ? (
                  <span className="text-xs font-bold text-gray-400">No records</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={incidentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={4}>
                        {incidentTypeData.map((entry, idx) => (
                          <Cell key={`cell-cat-${idx}`} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-black text-gray-900">{incidentTypeData.length}</span>
                  <span className="text-[8px] uppercase font-bold text-gray-400">Categories</span>
                </div>
              </div>
              <div className="w-full flex flex-wrap justify-center gap-1 text-[9px] font-bold text-gray-500 border-t border-gray-200 pt-2 mt-1">
                {incidentTypeData.map((item, idx) => (
                  <span key={item.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span> 
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Box 3: Peak Incident Hours Bar Chart */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
              <h4 className="font-bold text-xs text-gray-900 mb-2">Peak Incident Hours</h4>
              <div className="h-44 chart-box-donuts w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="slot" tick={{ fontSize: 8, fill: '#6b7280', fontWeight: 600 }} dy={5} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="count" fill="#b32d2d" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[9px] text-gray-400 font-medium border-t border-gray-200 pt-2 text-right">
                Dispatch call density by time of day
              </div>
            </div>

          </div>

        </div>

      </div>
    </AdminLayout>
  );
}