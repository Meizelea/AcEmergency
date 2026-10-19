import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, Filter, MapPin, X, 
  Image as ImageIcon, Video, Loader2,
  Calendar, ArrowUpDown, ArrowUp, ArrowDown, User, Clock, CheckCircle2, RefreshCw
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

  return `http://${targetHostname}:8000`;
};

const API_BASE_URL = getApiBaseUrl();

// CACHE KEYS
const CACHE_KEY_REPORTS = 'cache_admin_reports_v2';
const CACHE_KEY_UNITS = 'cache_admin_units_v1';

const redMarkerIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background-color: #ef4444; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const barangayCoordsFallback = {
  'Santa Trinidad': [15.1320, 120.5950],
  'Sta. Trinidad': [15.1320, 120.5950],
  'San Nicolas': [15.1340, 120.5910],
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

// Robust Reporter Name Extractor
const getReporterName = (report) => {
  if (!report) return 'Anonymous Citizen';

  const ud = report.user_details || (typeof report.user === 'object' ? report.user : null);
  if (ud) {
    if (ud.first_name || ud.last_name) {
      return `${ud.first_name || ''} ${ud.last_name || ''}`.trim();
    }
    if (ud.username) return ud.username;
    if (ud.full_name) return ud.full_name;
  }

  if (report.first_name || report.last_name) {
    return `${report.first_name || ''} ${report.last_name || ''}`.trim();
  }
  if (report.reporter_name) return report.reporter_name;
  if (report.username) return report.username;
  if (report.full_name) return report.full_name;

  const rawUserId = report.user_id || (typeof report.user === 'number' || typeof report.user === 'string' ? report.user : null);
  if (rawUserId) {
    return `Citizen #${rawUserId}`;
  }

  return 'Anonymous Citizen';
};

export default function ReportsPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_REPORTS);
    return cached ? JSON.parse(cached) : [];
  });

  const [emergencyUnits, setEmergencyUnits] = useState(() => {
    const cached = localStorage.getItem(CACHE_KEY_UNITS);
    return cached ? JSON.parse(cached) : [];
  });

  const [isLoading, setIsLoading] = useState(() => reports.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedBarangayFilter, setSelectedBarangayFilter] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'resolved_desc' | 'resolved_asc' | 'barangay_asc'

  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Video URL Cache
  const videoCache = useRef({});
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const token = localStorage.getItem('ac_token');

  const getAuthHeaders = () => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    return {
      'Content-Type': 'application/json',
      'Authorization': rawToken.startsWith('Bearer ') || rawToken.startsWith('Token ') 
        ? rawToken 
        : `Token ${cleanToken}`
    };
  };

  const fetchEmergencyUnits = async () => {
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
  };

  const fetchReports = async (silent = false) => {
    if (!token) return;
    if (!silent && reports.length === 0) setIsLoading(true);
    setIsSyncing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/admin/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const rawList = Array.isArray(data) ? data : (data?.results || []);
      const sorted = rawList.sort((a, b) => b.id - a.id);

      setReports(sorted);
      sessionStorage.setItem(CACHE_KEY_REPORTS, JSON.stringify(sorted));
    } catch (error) {
      console.error("Error fetching reports:", error);
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

    const hasCache = Boolean(sessionStorage.getItem(CACHE_KEY_REPORTS));
    fetchReports(hasCache);
    fetchEmergencyUnits();
  }, [token, navigate]);

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
    const pool = activeUnits.length > 0 ? activeUnits : emergencyUnits;

    if (pool.length === 0) return 'N/A';

    let nearestUnit = pool[0];
    let minDistance = calculateHaversineDistance(reportLat, reportLng, nearestUnit.latitude, nearestUnit.longitude);

    pool.forEach((unit) => {
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

  const handleStatusUpdate = async (reportId, newStatus) => {
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
        ...(resolvedAtVal ? { resolved_at: resolvedAtVal } : {})
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

  // Header click sorting handlers
  const handleSortTimestamp = () => {
    setSortBy(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
  };

  const handleSortResolvedAt = () => {
    setSortBy(prev => prev === 'resolved_desc' ? 'resolved_asc' : 'resolved_desc');
  };

  const uniqueBarangays = Array.from(
    new Set(reports.map(r => r.barangay || r.location).filter(Boolean))
  );

  const filteredReports = reports.filter(report => {
    if (!report) return false;
    const reportText = (report.short_message || report.description || '').toLowerCase();
    const barangayText = (report.barangay || report.location || '').toLowerCase();
    const posterText = getReporterName(report).toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchedSearch = reportText.includes(query) || barangayText.includes(query) || posterText.includes(query) || String(report.id).includes(query);
    const currentStat = String(report.status).toLowerCase();
    
    let matchedStatus = true;
    if (statusFilter === 'Pending') matchedStatus = (currentStat === 'pending' || currentStat === 'submitted');
    else if (statusFilter === 'Ongoing') matchedStatus = (currentStat === 'ongoing');
    else if (statusFilter === 'Resolved') matchedStatus = (currentStat === 'resolved');

    let matchedBarangay = true;
    if (selectedBarangayFilter !== 'ALL') {
      matchedBarangay = barangayText === selectedBarangayFilter.toLowerCase();
    }

    let matchedDate = true;
    if (filterDate && report.created_at) {
      const reportDate = new Date(report.created_at).toISOString().split('T')[0];
      matchedDate = reportDate === filterDate;
    }

    return matchedSearch && matchedStatus && matchedBarangay && matchedDate;
  }).sort((a, b) => {
    if (sortBy === 'date_desc') {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }
    if (sortBy === 'date_asc') {
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    }
    if (sortBy === 'resolved_desc') {
      return new Date(b.resolved_at || 0) - new Date(a.resolved_at || 0);
    }
    if (sortBy === 'resolved_asc') {
      return new Date(a.resolved_at || 0) - new Date(b.resolved_at || 0);
    }
    if (sortBy === 'barangay_asc') {
      return (a.barangay || '').localeCompare(b.barangay || '');
    }
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
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0]">
        
        {/* CONTROLS HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-72 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-3" />
              <input 
                type="text" 
                placeholder="Search description, poster..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2 px-3 text-xs font-medium text-gray-700 focus:outline-none" 
              />
            </div>

            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-sm text-xs text-gray-600 font-bold">
              <Filter size={14} className="text-gray-400 mr-2" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2">
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>

            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-sm text-xs text-gray-600 font-bold">
              <MapPin size={14} className="text-gray-400 mr-2" />
              <select value={selectedBarangayFilter} onChange={(e) => setSelectedBarangayFilter(e.target.value)} className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2">
                <option value="ALL">All Barangays</option>
                {uniqueBarangays.map(brgy => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                ))}
              </select>
            </div>

            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-sm text-xs text-gray-600 font-bold">
              <Calendar size={14} className="text-gray-400 mr-2" />
              <input 
                type="date" 
                value={filterDate} 
                onChange={(e) => setFilterDate(e.target.value)} 
                className="py-1.5 bg-transparent focus:outline-none cursor-pointer" 
              />
              {filterDate && (
                <X size={14} className="text-gray-400 hover:text-red-500 cursor-pointer ml-1" onClick={() => setFilterDate('')} />
              )}
            </div>

            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-sm text-xs text-gray-600 font-bold">
              <ArrowUpDown size={14} className="text-gray-400 mr-2" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2">
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="resolved_desc">Resolved (Newest First)</option>
                <option value="resolved_asc">Resolved (Oldest First)</option>
                <option value="barangay_asc">Barangay (A-Z)</option>
              </select>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem(CACHE_KEY_REPORTS);
                fetchReports(false);
              }}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> Sync Data
            </button>
          </div>
        </div>

        {/* MASTER TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f8fafc] text-gray-800 text-[11px] font-black uppercase tracking-wider select-none">
                  <th className="py-3.5 px-5 w-16">ID</th>
                  
                  {/* SORTABLE TIMESTAMP HEADER */}
                  <th 
                    onClick={handleSortTimestamp}
                    className="py-3.5 px-5 w-52 cursor-pointer hover:bg-gray-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>TIMESTAMP</span>
                      {sortBy === 'date_desc' ? (
                        <ArrowDown size={13} className="text-[#b32d2d]" />
                      ) : sortBy === 'date_asc' ? (
                        <ArrowUp size={13} className="text-[#b32d2d]" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 px-5">EMERGENCY DETAILS</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">POSTER NAME</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">LOCATION (BARANGAY)</th>
                  
                  {/* SORTABLE RESOLVED AT HEADER */}
                  <th 
                    onClick={handleSortResolvedAt}
                    className="py-3.5 px-5 text-center whitespace-nowrap cursor-pointer hover:bg-gray-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>RESOLVED AT</span>
                      {sortBy === 'resolved_desc' ? (
                        <ArrowDown size={13} className="text-[#b32d2d]" />
                      ) : sortBy === 'resolved_asc' ? (
                        <ArrowUp size={13} className="text-[#b32d2d]" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 px-5 text-center whitespace-nowrap">STATUS DROPDOWN</th>
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
                        {/* ID */}
                        <td className="py-4 px-5 font-black text-gray-400 text-xs">#{report.id}</td>

                        {/* TIMESTAMP FIXED COLOR (Neutral Dark Text) */}
                        <td className="py-4 px-5 text-xs font-bold text-gray-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-red-500 shrink-0" />
                            <span>{formatDate(report.created_at)}</span>
                          </div>
                        </td>

                        {/* EMERGENCY DETAILS */}
                        <td className="py-4 px-5">
                          <div className="font-extrabold text-gray-900 text-sm">
                            {report.short_message || report.description || 'Emergency Incident'}
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium">
                            {report.exact_address || report.address || 'Exact address not specified'}
                          </div>
                        </td>

                        {/* POSTER NAME */}
                        <td className="py-4 px-5 font-bold text-gray-800 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-gray-400" />
                            <span>{getReporterName(report)}</span>
                          </div>
                        </td>
                        
                        {/* READ-ONLY LOCATION (BARANGAY) */}
                        <td className="py-4 px-5 text-xs font-bold text-gray-800 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <MapPin size={13} className="text-red-500 shrink-0" />
                            <span>Brgy. {report.barangay || report.location || 'Santa Trinidad'}</span>
                          </div>
                        </td>

                        {/* RESOLVED AT */}
                        <td className="py-4 px-5 text-center font-bold text-gray-800 text-[11px] whitespace-nowrap">
                          {formatResolvedTime(report)}
                        </td>

                        {/* STATUS DROPDOWN */}
                        <td className="py-4 px-5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={displayLabel}
                            onChange={(e) => handleStatusUpdate(report.id, e.target.value)}
                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide border cursor-pointer outline-none transition-all ${
                              displayLabel === 'Pending' 
                                ? 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]'
                                : displayLabel === 'Ongoing'
                                ? 'bg-red-50 text-red-700 border-red-300'
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-black text-xl text-gray-900 tracking-tight flex items-center gap-2">
                  Report ID #{selectedReport.id}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-1 flex items-center gap-2">
                  <span>{formatDate(selectedReport.created_at)}</span>
                  <span>•</span>
                  <span className="uppercase font-black text-[#b32d2d]">{selectedReport.status || 'Pending'}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={
                    String(selectedReport.status).toLowerCase() === 'ongoing' ? 'Ongoing' :
                    String(selectedReport.status).toLowerCase() === 'resolved' ? 'Resolved' : 'Pending'
                  }
                  onChange={(e) => handleStatusUpdate(selectedReport.id, e.target.value)}
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

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-12 gap-6">
                
                {/* LEFT: REPORT DETAILS */}
                <div className="col-span-6 space-y-4">
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
                      <span className="font-black text-[#b32d2d] uppercase">{selectedReport.status || 'Pending'}</span>
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

                {/* RIGHT: MAP */}
                <div className="col-span-6 flex flex-col">
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
                  
                  <div className="flex-1 min-h-[240px] rounded-xl overflow-hidden border border-gray-200 relative shadow-inner">
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
                          <div className="font-bold text-xs">{selectedReport.short_message || 'Emergency Location'}</div>
                          <div className="text-[10px] text-gray-500">Brgy. {selectedBrgy}</div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>

              </div>

              {/* EMERGENCY DESCRIPTION */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-black text-sm text-gray-900 mb-2">Emergency Details & Narrative</h4>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedReport.description || selectedReport.short_message || 'No additional narrative description provided.'}
                </div>
              </div>

              {/* EXACT ADDRESS SUB-BOX */}
              <div className="bg-red-50/60 border border-red-100 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">
                  EXACT EMERGENCY LOCATION / ADDRESS
                </span>
                <div className="text-xs font-bold text-gray-900 flex items-start gap-1.5">
                  <MapPin size={15} className="text-[#b32d2d] shrink-0 mt-0.5" />
                  <span>
                    {selectedReport.exact_address || selectedReport.address || selectedReport.location_name || 'MacArthur Highway, Angeles City, Pampanga'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 pl-5">
                  GPS Coordinates: {selectedReport.latitude || '15.1450'}, {selectedReport.longitude || '120.5887'} (Brgy. {selectedReport.barangay || 'Central'})
                </p>
              </div>

              {/* MEDIA ATTACHMENTS (IMAGE / VIDEO) */}
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
                      <div className="p-12 flex flex-col items-center justify-center text-white gap-2">
                        <Loader2 className="animate-spin text-[#b32d2d]" size={28} />
                        <span className="text-xs font-semibold">Loading secure video stream...</span>
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

    </AdminLayout>
  );
}