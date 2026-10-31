import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, Filter, MapPin, X, 
  Image as ImageIcon, Video, Loader2,
  Calendar, ArrowUpDown, User, Clock, CheckCircle2, RefreshCw, AlertTriangle, CalendarDays
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AdminLayout from '../components/header';

const targetHostname = window.location.hostname || '127.0.0.1';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }
  return `https://api.aksyon.online`;
};

const API_BASE_URL = getApiBaseUrl();

// CACHE KEYS
const CACHE_KEY_REPORTS = 'cache_admin_reports_v12';
const CACHE_KEY_UNITS = 'cache_admin_units_v2';
const CACHE_KEY_USERS_MAP = 'cache_admin_users_map_v10';

const redMarkerIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background-color: #ef4444; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const barangayCoordsFallback = {
  'Santa Trinidad': [15.1320, 120.5950],
  'Sta. Trinidad': [15.1320, 120.5950],
  'San Nicolas': [15.140, 120.5910],
  'Lourdes NorthWest': [15.1410, 120.5810],
  'Claro M. Recto': [15.1420, 120.5990]
};

export const ANGELES_BARANGAYS = [
  "Santa Trinidad",
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const CATEGORY_MAP = {
  'road_accident': 'Road Accident',
  'fire': 'Fire',
  'natural_hazard': 'Flooding and Natural Hazards',
  'medical_emergency': 'Medical Emergency',
  'infrastructure_hazard': 'Infrastructure Hazard',
  'public_safety': 'Public Safety Incident',
  'other': 'Other'
};

const CATEGORY_UNIT_TYPES = {
  'Road Accident': ['Police', 'Medical', 'Hospital', 'Traffic', 'Emergency', 'PNP'],
  'Fire': ['Fire', 'BFP', 'Fire Station', 'Rescue'],
  'Medical Emergency': ['Medical', 'Hospital', 'Ambulance', 'Health', 'ER'],
  'Flooding and Natural Hazards': ['Disaster', 'DRRMO', 'CDRRMO', 'Rescue', 'Barangay'],
  'Infrastructure Hazard': ['Barangay', 'Engineering', 'DRRMO', 'Public Works'],
  'Public Safety Incident': ['Police', 'PNP', 'Barangay', 'Law Enforcement', 'Patrol'],
  'Other': []
};

export default function ReportsPage() {
  const navigate = useNavigate();

  const resolveUserDisplayName = (u) => {
    if (!u) return null;
    if (typeof u === 'string') return u.trim() || null;
    const firstLast = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    if (firstLast) return firstLast;
    if (u.full_name && u.full_name.trim()) return u.full_name.trim();
    if (u.username && u.username.trim()) return u.username.trim();
    if (u.email && u.email.trim()) return u.email.split('@')[0];
    return null;
  };

  const [reports, setReports] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_REPORTS);
    return cached ? JSON.parse(cached) : [];
  });

  const [emergencyUnits, setEmergencyUnits] = useState(() => {
    const cached = localStorage.getItem(CACHE_KEY_UNITS);
    return cached ? JSON.parse(cached) : [];
  });

  const [usersMap, setUsersMap] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_USERS_MAP);
    const existingMap = cached ? JSON.parse(cached) : {};

    const cachedReports = sessionStorage.getItem(CACHE_KEY_REPORTS);
    if (cachedReports) {
      try {
        const parsedReports = JSON.parse(cachedReports);
        parsedReports.forEach(r => {
          const userObj = (typeof r.user === 'object' && r.user !== null) ? r.user : (r.user_details || r.profile);
          const name = resolveUserDisplayName(userObj) || r.reporter_name || `${r.first_name || ''} ${r.last_name || ''}`.trim();
          const uid = typeof r.user === 'number' || typeof r.user === 'string' ? r.user : r.user?.id;
          if (name) {
            if (r.id) existingMap[r.id] = name;
            if (uid) existingMap[uid] = name;
          }
        });
      } catch (e) {
        console.error("Failed to parse cached reports for user map initialization:", e);
      }
    }
    return existingMap;
  });

  const [isLoading, setIsLoading] = useState(() => reports.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); 
  const [dateRangeFilter, setDateRangeFilter] = useState('7_days'); // Defaults to 7 Days (This Week)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');

  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    action: null
  });

  const videoCache = useRef({});
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const pendingUserFetches = useRef(new Set());

  const token = localStorage.getItem('ac_token');

  const getAuthHeaders = useCallback(() => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    return {
      'Content-Type': 'application/json',
      'Authorization': rawToken.startsWith('Bearer ') || rawToken.startsWith('Token ') 
        ? rawToken 
        : `Token ${cleanToken}`
    };
  }, [token]);

  const getCategoryName = (report) => {
    if (!report) return 'General Emergency';
    
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

    return rawCategory || report.short_message || 'General Emergency';
  };

  const resolveMissingUser = async (reportId, userId) => {
    if (!reportId || pendingUserFetches.current.has(reportId)) return;
    pendingUserFetches.current.add(reportId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/admin/${reportId}/`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const detailData = await res.json();
        const userObj = detailData?.user || detailData?.user_details || detailData?.profile;
        const displayName = resolveUserDisplayName(userObj) || detailData?.reporter_name;

        if (displayName) {
          setUsersMap(prev => {
            const updated = { ...prev, [reportId]: displayName };
            if (userId) updated[userId] = displayName;
            sessionStorage.setItem(CACHE_KEY_USERS_MAP, JSON.stringify(updated));
            return updated;
          });
        }
      }
    } catch (err) {
      console.error(`Failed to resolve user for report #${reportId}:`, err);
    }
  };

  const getReporterName = (report) => {
    if (!report) return 'Anonymous Citizen';

    const userObj = (typeof report.user === 'object' && report.user !== null) ? report.user : (report.user_details || report.profile);
    const resolvedFromObj = resolveUserDisplayName(userObj);
    if (resolvedFromObj) return resolvedFromObj;

    const flatFirstLast = `${report.first_name || ''} ${report.last_name || ''}`.trim();
    if (flatFirstLast) return flatFirstLast;
    if (report.reporter_name) return report.reporter_name;
    if (report.username) return report.username;

    const rawUserId = typeof report.user === 'number' || typeof report.user === 'string' 
      ? report.user 
      : (report.user_id || report.user?.id);

    if (usersMap[report.id]) return usersMap[report.id];
    if (rawUserId && usersMap[rawUserId]) return usersMap[rawUserId];

    if (report.id && !usersMap[report.id] && (!rawUserId || !usersMap[rawUserId])) {
      resolveMissingUser(report.id, rawUserId);
    }

    if (rawUserId) return `Citizen #${rawUserId}`;

    return 'Anonymous Citizen';
  };

  const getExactAddressSubtitle = (report) => {
    if (!report) return 'Exact address not specified';
    if (report.exact_address && report.exact_address.trim() !== '') return report.exact_address;
    if (report.address && report.address.trim() !== '') return report.address;
    if (report.street && report.street.trim() !== '') return `St: ${report.street}`;
    if (report.location_name && report.location_name.trim() !== '') return report.location_name;

    const lat = parseFloat(report.latitude);
    const lng = parseFloat(report.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    return 'Exact address not specified';
  };

  const fetchUsersMap = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/admin/`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data?.results || []);
        setUsersMap(prev => {
          const newMap = { ...prev };
          rawList.forEach(u => {
            const displayName = resolveUserDisplayName(u);
            if (displayName) newMap[u.id] = displayName;
          });
          sessionStorage.setItem(CACHE_KEY_USERS_MAP, JSON.stringify(newMap));
          return newMap;
        });
      }
    } catch (err) {
      console.error("Bulk user fetch error:", err);
    }
  }, [getAuthHeaders]);

  const fetchEmergencyUnits = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/emergency-units/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data) ? data : (data?.results || []);
        setEmergencyUnits(rawList);
        localStorage.setItem(CACHE_KEY_UNITS, JSON.stringify(rawList));
      }
    } catch (error) {
      console.error("Error fetching emergency units:", error);
    }
  }, [getAuthHeaders]);

  const fetchReports = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent && reports.length === 0) setIsLoading(true);
    setIsSyncing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/admin/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data) ? data : (data?.results || []);
        const sorted = rawList.sort((a, b) => b.id - a.id);

        setUsersMap(prev => {
          const updated = { ...prev };
          sorted.forEach(r => {
            const userObj = (typeof r.user === 'object' && r.user !== null) ? r.user : (r.user_details || r.profile);
            const name = resolveUserDisplayName(userObj) || r.reporter_name || `${r.first_name || ''} ${r.last_name || ''}`.trim();
            const uid = typeof r.user === 'number' || typeof r.user === 'string' ? r.user : r.user?.id;
            if (name) {
              if (r.id) updated[r.id] = name;
              if (uid) updated[uid] = name;
            }
          });
          sessionStorage.setItem(CACHE_KEY_USERS_MAP, JSON.stringify(updated));
          return updated;
        });

        setReports(sorted);
        sessionStorage.setItem(CACHE_KEY_REPORTS, JSON.stringify(sorted));
        fetchUsersMap();
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [token, getAuthHeaders, fetchUsersMap, reports.length]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchReports(true);
    fetchEmergencyUnits();

    const interval = setInterval(() => {
      fetchReports(true);
    }, 15000);

    const handleFocus = () => fetchReports(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, navigate, fetchReports, fetchEmergencyUnits]);

  const getNearestResponderText = (report) => {
    if (report?.nearest_responder) {
      const responderName = typeof report.nearest_responder === 'object' 
        ? (report.nearest_responder.name || report.nearest_responder.title || 'Emergency Unit')
        : report.nearest_responder;

      const distStr = report.distance_km ? ` (${parseFloat(report.distance_km).toFixed(2)} km)` : '';
      return `${responderName}${distStr}`;
    }

    let reportLat = parseFloat(report?.latitude);
    let reportLng = parseFloat(report?.longitude);

    if (isNaN(reportLat) || isNaN(reportLng)) {
      const fallback = barangayCoordsFallback[report?.barangay || report?.location] || [15.1320, 120.5950];
      reportLat = fallback[0];
      reportLng = fallback[1];
    }

    const activeUnits = emergencyUnits.filter(u => u.is_active !== false);
    const basePool = activeUnits.length > 0 ? activeUnits : emergencyUnits;

    if (basePool.length === 0) return 'N/A';

    const categoryName = getCategoryName(report);
    const allowedTypes = CATEGORY_UNIT_TYPES[categoryName] || [];

    let categoryFilteredPool = basePool;
    if (allowedTypes.length > 0) {
      const matched = basePool.filter((unit) => {
        const unitType = (unit.type || unit.unit_type || unit.category || '').toLowerCase();
        const unitName = (unit.name || '').toLowerCase();
        return allowedTypes.some((t) => 
          unitType.includes(t.toLowerCase()) || unitName.includes(t.toLowerCase())
        );
      });

      if (matched.length > 0) {
        categoryFilteredPool = matched;
      }
    }

    let nearestUnit = categoryFilteredPool[0];
    let minDistance = calculateHaversineDistance(reportLat, reportLng, nearestUnit.latitude, nearestUnit.longitude);

    categoryFilteredPool.forEach((unit) => {
      const dist = calculateHaversineDistance(reportLat, reportLng, unit.latitude, unit.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestUnit = unit;
      }
    });

    const unitName = typeof nearestUnit === 'object' ? (nearestUnit.name || 'Emergency Base') : nearestUnit;
    return `${unitName} (${minDistance.toFixed(2)} km)`;
  };

  const handleOpenReportModal = async (report) => {
    setSelectedReport(report);
    setActiveVideoUrl(null);
    setIsModalOpen(true);

    if (report.video_thumbnail_url) {
      if (videoCache.current[report.id]) {
        setActiveVideoUrl(videoCache.current[report.id]);
        return;
      }

      setIsVideoLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/reports/admin/${report.id}/video-url/`, {
          headers: getAuthHeaders()
        });

        if (res.ok) {
          const data = await res.json();
          if (data.video_url) {
            videoCache.current[report.id] = data.video_url;
            setActiveVideoUrl(data.video_url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch signed video URL:", err);
      } finally {
        setIsVideoLoading(false);
      }
    }
  };

  const executeStatusUpdate = async (reportId, newStatus) => {
    try {
      const statusDatabaseMap = {
        'Pending': 'pending',      
        'Ongoing': 'ongoing',   
        'Resolved': 'resolved'
      };

      const finalPayloadValue = statusDatabaseMap[newStatus] || newStatus.toLowerCase();
      const resolvedAtVal = finalPayloadValue === 'resolved' ? new Date().toISOString() : null;

      const payload = { 
        status: finalPayloadValue,
        resolved_at: resolvedAtVal
      };

      const updatedReports = reports.map(r => r.id === reportId ? { ...r, ...payload } : r);
      setReports(updatedReports);
      sessionStorage.setItem(CACHE_KEY_REPORTS, JSON.stringify(updatedReports));

      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport(prev => ({ ...prev, ...payload }));
      }

      await fetch(`${API_BASE_URL}/api/reports/admin/${reportId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error("Failed to execute status update:", error);
    }
  };

  const requestStatusUpdate = (reportId, newStatus) => {
    setConfirmModal({
      isOpen: true,
      title: 'Update Report Status',
      message: `Are you sure you want to change the status of Report #${reportId} to "${newStatus}"?`,
      confirmText: 'Update Status',
      action: () => executeStatusUpdate(reportId, newStatus)
    });
  };

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) 
      ? dateString 
      : d.toLocaleDateString('en-US', { 
          month: 'short', 
          day: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
  };

  const formatResolvedTime = (report) => {
    const isResolved = String(report?.status).toLowerCase() === 'resolved';
    if (!isResolved) return '—';
    if (report.resolved_at) {
      const d = new Date(report.resolved_at);
      return isNaN(d.getTime()) ? report.resolved_at : d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    return '—';
  };

  // Enhanced Filter Logic Supporting Custom "From" and "To" Date Range
  const filteredReports = reports.filter(report => {
    if (!report) return false;
    const reportText = (report.short_message || report.description || '').toLowerCase();
    const categoryText = getCategoryName(report).toLowerCase();
    const barangayText = (report.barangay || report.location || '').toLowerCase();
    const posterText = getReporterName(report).toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchedSearch = reportText.includes(query) || categoryText.includes(query) || barangayText.includes(query) || posterText.includes(query) || String(report.id).includes(query);
    const currentStat = String(report.status).toLowerCase();
    
    let matchedStatus = true;
    if (statusFilter === 'Pending') matchedStatus = (currentStat === 'pending' || currentStat === 'submitted');
    else if (statusFilter === 'Ongoing') matchedStatus = (currentStat === 'ongoing');
    else if (statusFilter === 'Resolved') matchedStatus = (currentStat === 'resolved');

    let matchedDate = true;
    const now = new Date();

    // 1. Check Custom "From - To" Date Range Picker first if populated
    if ((fromDate || toDate) && report.created_at) {
      const reportTime = new Date(report.created_at).getTime();
      const startMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
      const endMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Infinity;
      matchedDate = reportTime >= startMs && reportTime <= endMs;
    } 
    // 2. Preset Date Horizon Filter (Today, 7 Days, 30 Days)
    else if (dateRangeFilter !== 'all_time' && dateRangeFilter !== 'custom' && report.created_at) {
      const reportTimestamp = new Date(report.created_at).getTime();
      if (dateRangeFilter === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        const reportDateStr = new Date(report.created_at).toISOString().split('T')[0];
        matchedDate = todayStr === reportDateStr;
      } else if (dateRangeFilter === '7_days') {
        const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        matchedDate = reportTimestamp >= sevenDaysAgo;
      } else if (dateRangeFilter === '30_days') {
        const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
        matchedDate = reportTimestamp >= thirtyDaysAgo;
      }
    }

    return matchedSearch && matchedStatus && matchedDate;
  }).sort((a, b) => {
    if (sortBy === 'date_desc') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    if (sortBy === 'date_asc') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortBy === 'resolved_desc') return new Date(b.resolved_at || 0) - new Date(a.resolved_at || 0);
    return 0;
  });

  let modalLat = parseFloat(selectedReport?.latitude);
  let modalLng = parseFloat(selectedReport?.longitude);
  const selectedBrgy = selectedReport?.barangay || selectedReport?.location || 'Santa Trinidad';

  if (isNaN(modalLat) || isNaN(modalLng)) {
    const fallback = barangayCoordsFallback[selectedBrgy] || [15.1320, 120.5950];
    modalLat = fallback[0];
    modalLng = fallback[1];
  }

  const hasImage = Boolean(selectedReport?.image_url);
  const hasVideo = Boolean(selectedReport?.video_thumbnail_url || activeVideoUrl);

  const cartoUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] flex flex-col">
        
        {/* CONTROLS HEADER */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 mb-6 shrink-0">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full">
            
            {/* SEARCH */}
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-xs w-full sm:w-64 lg:w-72 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Search category, description, poster..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2 px-3 text-xs font-medium text-gray-700 focus:outline-none" 
              />
            </div>

            {/* STATUS FILTER */}
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-xs text-xs text-gray-600 font-bold">
              <Filter size={14} className="text-gray-400 mr-2 shrink-0" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2 w-full">
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            {/* QUICK DATE HORIZON FILTER */}
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-xs text-xs text-gray-600 font-bold">
              <Clock size={14} className="text-gray-400 mr-2 shrink-0" />
              <select 
                value={dateRangeFilter} 
                onChange={(e) => {
                  const val = e.target.value;
                  setDateRangeFilter(val);
                  if (val !== 'custom') {
                    setFromDate('');
                    setToDate('');
                  }
                }} 
                className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2 w-full"
              >
                <option value="7_days">This Week (7 Days)</option>
                <option value="today">Today</option>
                <option value="30_days">Last 30 Days</option>
                <option value="custom">Custom Date Range...</option>
                <option value="all_time">All Time</option>
              </select>
            </div>

            {/* CUSTOM "FROM" AND "TO" DATE RANGE PICKER */}
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 py-1 shadow-xs text-xs text-gray-600 font-bold gap-2">
              <CalendarDays size={14} className="text-gray-400 shrink-0" />
              
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 uppercase">From</span>
                <input 
                  type="date" 
                  value={fromDate} 
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setDateRangeFilter('custom');
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
                    setDateRangeFilter('custom');
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
                    setDateRangeFilter('7_days');
                  }} 
                  title="Clear Date Range"
                />
              )}
            </div>

            {/* SORT DROPDOWN */}
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-xs text-xs text-gray-600 font-bold">
              <ArrowUpDown size={14} className="text-gray-400 mr-2 shrink-0" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2 w-full">
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="resolved_desc">Recently Resolved</option>
              </select>
            </div>

            {/* SYNC DATA BUTTON */}
            <button
              onClick={() => fetchReports(false)}
              disabled={isSyncing}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> 
              {isSyncing ? "Syncing..." : "Sync Data"}
            </button>
          </div>
        </div>

        {/* MASTER TABLE CONTAINER */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f8fafc] text-gray-800 text-[11px] font-black uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4 sm:px-5 w-20">ID</th>
                  <th className="py-3.5 px-4 sm:px-5 w-48 sm:w-52">TIMESTAMP</th>
                  <th className="py-3.5 px-4 sm:px-5">EMERGENCY CATEGORY</th>
                  <th className="py-3.5 px-4 sm:px-5 whitespace-nowrap">POSTER NAME</th>
                  <th className="py-3.5 px-4 sm:px-5 whitespace-nowrap">LOCATION (BARANGAY)</th>
                  <th className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">RESOLVED AT</th>
                  <th className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">STATUS DROPDOWN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-400 font-bold">Querying reports database...</td></tr>
                ) : filteredReports.length === 0 ? (
                  <tr><td colSpan="7" className="py-12 text-center text-gray-400 font-medium">No records matched.</td></tr>
                ) : (
                  filteredReports.map((report) => {
                    const currentStatusRaw = String(report.status).toLowerCase();
                    const displayLabel = currentStatusRaw === 'ongoing' 
                      ? 'Ongoing' 
                      : (currentStatusRaw === 'submitted' || currentStatusRaw === 'pending') 
                        ? 'Pending' 
                        : 'Resolved';
                    
                    return (
                      <tr 
                        key={report.id} 
                        onClick={() => handleOpenReportModal(report)}
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 sm:px-5 font-black text-gray-400 text-xs">#{report.id}</td>

                        <td className="py-3.5 px-4 sm:px-5 text-xs font-bold text-gray-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-red-500 shrink-0" />
                            <span>{formatDate(report.created_at)}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-5">
                          <div className="font-bold text-gray-900 text-xs">
                            {getCategoryName(report)}
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium mt-0.5 truncate max-w-[220px]">
                            {getExactAddressSubtitle(report)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-5 font-bold text-gray-800 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-gray-400 shrink-0" />
                            <span>{getReporterName(report)}</span>
                          </div>
                        </td>
                        
                        <td className="py-3.5 px-4 sm:px-5 text-xs font-bold text-gray-800 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <MapPin size={13} className="text-red-500 shrink-0" />
                            <span>Brgy. {report.barangay || report.location || 'Santa Trinidad'}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 sm:px-5 text-center font-bold text-gray-800 text-[11px] whitespace-nowrap">
                          {formatResolvedTime(report)}
                        </td>

                        <td className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={displayLabel}
                            onChange={(e) => requestStatusUpdate(report.id, e.target.value)}
                            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide border cursor-pointer outline-none transition-all ${
                              displayLabel === 'Pending' 
                                ? 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]'
                                : displayLabel === 'Ongoing'
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            }`}
                          >
                            <option value="Pending">PENDING</option>
                            <option value="Ongoing">ONGOING</option>
                            <option value="Resolved">RESOLVED</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* INSPECTION MODAL */}
      {isModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] my-auto">
            
            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50/50 shrink-0">
              <div>
                <h3 className="font-black text-lg sm:text-xl text-gray-900 tracking-tight flex items-center gap-2">
                  Report ID #{selectedReport.id}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{formatDate(selectedReport.created_at)}</span>
                  <span>•</span>
                  <span className={`uppercase font-black ${
                    String(selectedReport.status).toLowerCase() === 'ongoing' ? 'text-[#109EEF]' :
                    String(selectedReport.status).toLowerCase() === 'resolved' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {selectedReport.status || 'Pending'}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                <select
                  value={
                    String(selectedReport.status).toLowerCase() === 'ongoing' ? 'Ongoing' :
                    String(selectedReport.status).toLowerCase() === 'resolved' ? 'Resolved' : 'Pending'
                  }
                  onChange={(e) => requestStatusUpdate(selectedReport.id, e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase border bg-white outline-none cursor-pointer focus:border-[#b32d2d]"
                >
                  <option value="Pending">PENDING</option>
                  <option value="Ongoing">ONGOING</option>
                  <option value="Resolved">RESOLVED</option>
                </select>

                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                <div className="col-span-1 md:col-span-6 space-y-4">
                  <div>
                    <h4 className="font-black text-sm text-gray-900">Report Details</h4>
                    <p className="text-xs text-gray-400">Core information submitted with this report.</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Report ID</span>
                      <span className="font-black text-gray-800">#{selectedReport.id}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Category</span>
                      <span className="font-black text-gray-800">{getCategoryName(selectedReport)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Poster Name</span>
                      <span className="font-bold text-gray-800">{getReporterName(selectedReport)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Location Area</span>
                      <span className="font-bold text-gray-800">Brgy. {selectedReport.barangay || selectedReport.location || 'Angeles City'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Coordinates</span>
                      <span className="font-bold text-gray-800">{modalLat.toFixed(6)}, {modalLng.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Status</span>
                      <span className={`font-black uppercase ${
                        String(selectedReport.status).toLowerCase() === 'ongoing' ? 'text-[#109EEF]' :
                        String(selectedReport.status).toLowerCase() === 'resolved' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {selectedReport.status || 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-emerald-600 uppercase">Resolved Time</span>
                      <span className="font-bold text-emerald-700">
                        {formatResolvedTime(selectedReport)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-bold text-gray-400 uppercase">Nearest Responder</span>
                      <span className="font-bold text-gray-800 text-right">{getNearestResponderText(selectedReport)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-6 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={16} className="text-[#b32d2d]" />
                      <h4 className="font-black text-sm text-gray-900">Report Location</h4>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${modalLat},${modalLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
                    >
                      Open Google Street View ↗
                    </a>
                  </div>
                  
                  <div className="flex-1 min-h-[220px] rounded-xl overflow-hidden border border-gray-200 relative shadow-inner">
                    <MapContainer 
                      center={[modalLat, modalLng]} 
                      zoom={17} 
                      style={{ height: '100%', width: '100%' }} 
                      zoomControl={true}
                    >
                      <TileLayer 
                        url={cartoUrl} 
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' 
                        maxZoom={19}
                      />

                      <Marker position={[modalLat, modalLng]} icon={redMarkerIcon}>
                        <Popup>
                          <div className="font-bold text-xs">{getCategoryName(selectedReport)}</div>
                          <div className="text-[10px] text-gray-500">Brgy. {selectedBrgy}</div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>

              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-black text-sm text-gray-900 mb-2">Emergency Details & Narrative</h4>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedReport.description || selectedReport.short_message || 'No additional narrative description provided.'}
                </div>
              </div>

              <div className="bg-red-50/60 border border-red-100 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                  EXACT EMERGENCY LOCATION / ADDRESS
                </span>
                <div className="text-xs font-bold text-gray-900 flex items-start gap-1.5">
                  <MapPin size={15} className="text-[#b32d2d] shrink-0 mt-0.5" />
                  <span>
                    {getExactAddressSubtitle(selectedReport)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 pl-5">
                  GPS Coordinates: {selectedReport.latitude || '15.1450'}, {selectedReport.longitude || '120.5887'} (Brgy. {selectedReport.barangay || 'Central'})
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-black text-sm text-gray-900 mb-2">Incident Media Attachments</h4>
                
                {hasImage ? (
                  <div className="rounded-xl overflow-hidden border border-gray-200 max-h-80 bg-black flex items-center justify-center">
                    <img 
                      src={selectedReport.image_url} 
                      alt="Incident Evidence" 
                      className="max-h-80 object-contain w-full" 
                    />
                  </div>
                ) : hasVideo ? (
                  <div className="rounded-xl overflow-hidden border border-gray-200 max-h-80 bg-black flex flex-col items-center justify-center relative">
                    {isVideoLoading ? (
                      <div className="p-12 flex flex-col items-center justify-center text-[#b32d2d] font-semibold gap-2">
                        <Loader2 className="animate-spin text-[#b32d2d]" size={28} />
                        <span className="text-xs">Loading secure video stream...</span>
                      </div>
                    ) : activeVideoUrl ? (
                      <video 
                        src={activeVideoUrl} 
                        controls 
                        autoPlay
                        className="max-h-80 w-full object-contain"
                        preload="metadata"
                      >
                        Your browser does not support video playback.
                      </video>
                    ) : (
                      <div className="relative w-full h-80 flex items-center justify-center">
                        <img 
                          src={selectedReport.video_thumbnail_url} 
                          alt="Video Thumbnail" 
                          className="max-h-80 w-full object-contain filter brightness-75" 
                        />
                        <div className="absolute flex flex-col items-center justify-center bg-black/60 px-4 py-2 rounded-lg text-white text-xs font-bold gap-1">
                          <Video size={20} className="text-red-500" />
                          <span>Video Processing / Preview</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon size={28} className="mb-2 text-gray-300" />
                    <span className="text-xs font-semibold">No image or video attached with this incident log.</span>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* CONFIRMATION DECISION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-4">
              <AlertTriangle size={28} />
            </div>
            
            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              {confirmModal.title}
            </h3>
            
            <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  if (confirmModal.action) confirmModal.action();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}