import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AdminLayout from '../components/header';

const targetHostname = window.location.hostname || '127.0.0.1';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';

const CACHE_KEY_DASHBOARD_REPORTS = 'cache_dashboard_reports_v2';
const CACHE_KEY_USERS_MAP = 'cache_admin_users_map_v9';

// PRECISE BARANGAY COORDINATES FOR ANGELES CITY
const barangayCoords = {
  'Agapito del Rosario': [15.1390, 120.5885],
  'San Nicolas': [15.1325, 120.5880],
  'Sta. Trinidad': [15.1360, 120.5925],
  'Santa Trinidad': [15.1360, 120.5925],
  'Cutud': [15.1500, 120.6120],
  'Balibago': [15.1680, 120.5890],
  'Cutcut': [15.1330, 120.5690],
  'Pampang': [15.1480, 120.5580],
  'Malabanias': [15.1620, 120.5780],
  'Amsic': [15.1560, 120.5620],
  'Margot': [15.1660, 120.5330],
  'Sapangbato': [15.1520, 120.5120],
  'Lourdes NorthWest': [15.1410, 120.5810],
  'Lourdes Sur': [15.1375, 120.5865],
  'Claro M. Recto': [15.1420, 120.5990],
  'Santo Rosario': [15.1338, 120.5910]
};

const ANGELES_CITY_BOUNDS = [
  [15.1050, 120.5050],
  [15.1850, 120.6350]
];

const DEFAULT_CITY_CENTER = [15.1360, 120.5900];

function normalizeBarangayName(name) {
  if (!name || typeof name !== 'string') return '';
  let clean = name.trim();
  clean = clean.replace(/^(brgy\.?|barangay)\s+/i, '').trim();

  const lower = clean.toLowerCase();
  if (lower.includes('agapito')) return 'Agapito del Rosario';
  if (lower === 'santa trinidad' || lower === 'sta trinidad' || lower === 'sta. trinidad') return 'Sta. Trinidad';
  if (lower === 'lourdes northwest' || lower === 'lourdes north west') return 'Lourdes NorthWest';
  if (lower === 'san nicolas') return 'San Nicolas';
  if (lower === 'claro m recto' || lower === 'claro m. recto') return 'Claro M. Recto';
  if (lower === 'santo rosario' || lower === 'sta rosario' || lower === 'sta. rosario') return 'Santo Rosario';
  if (lower === 'lourdes sur') return 'Lourdes Sur';

  return clean;
}

function MapViewController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.invalidateSize();
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);

  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (container) observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

const createStatusIcon = (status) => {
  let bgColor = '#f59e0b';
  let pulseClass = 'pulse-yellow'; 

  if (String(status).toLowerCase().trim() === 'ongoing') {
    bgColor = '#2563eb';
    pulseClass = 'pulse-blue'; 
  }
  
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div class="${pulseClass}" style="background-color: ${bgColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

export default function DashboardPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_DASHBOARD_REPORTS);
    return cached ? JSON.parse(cached) : [];
  });

  const [usersMap, setUsersMap] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_USERS_MAP);
    return cached ? JSON.parse(cached) : {};
  });

  const [isLoading, setIsLoading] = useState(() => reports.length === 0);
  const [statusFilter, setStatusFilter] = useState('all');

  // Extract initial user profile barangay dynamically
  const [currentAdminBarangay, setCurrentAdminBarangay] = useState(() => {
    try {
      const keysToSearch = ['ac_user_data', 'ac_user', 'user', 'user_data', 'profile'];
      for (const k of keysToSearch) {
        const item = localStorage.getItem(k);
        if (item) {
          const u = JSON.parse(item);
          const brgy = u.assigned_barangay || u.barangay || u.barangay_name || u.assigned_barangay_name || u?.profile?.barangay;
          if (brgy && typeof brgy === 'string') return brgy;
        }
      }
    } catch (e) {
      console.warn('Failed to parse local user barangay:', e);
    }
    return '';
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    action: null
  });

  const token = localStorage.getItem('ac_token');

  const getAuthHeaders = useCallback((useBearer = false) => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return { 'Authorization': `${authPrefix} ${cleanToken}`, 'Content-Type': 'application/json' };
  }, [token]);

  // Fetch admin profile directly on mount to ensure barangay assignment matches server state
  useEffect(() => {
    const loadAdminProfile = async () => {
      const rawToken = token || '';
      const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
      if (!cleanToken) return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/users/me/`, {
          headers: { 'Authorization': `Token ${cleanToken}` }
        });
        if (res.ok) {
          const userData = await res.json();
          const brgy = userData.assigned_barangay || userData.barangay || userData.barangay_name || userData.assigned_barangay_name || userData?.profile?.barangay;
          if (brgy) {
            console.log('Fetched logged in admin assigned barangay:', brgy);
            setCurrentAdminBarangay(brgy);
            localStorage.setItem('ac_user_data', JSON.stringify(userData));
          }
        }
      } catch (err) {
        console.warn('Failed to fetch admin profile:', err);
      }
    };

    if (token) {
      loadAdminProfile();
    }
  }, [token]);

  // Compute active map coordinates based on admin barangay
  const activeMapCenter = useMemo(() => {
    if (currentAdminBarangay) {
      const cleanBrgy = normalizeBarangayName(currentAdminBarangay);
      if (barangayCoords[cleanBrgy]) {
        return barangayCoords[cleanBrgy];
      }
    }
    return DEFAULT_CITY_CENTER;
  }, [currentAdminBarangay]);

  const activeZoomLevel = useMemo(() => {
    if (currentAdminBarangay) {
      const cleanBrgy = normalizeBarangayName(currentAdminBarangay);
      if (barangayCoords[cleanBrgy]) return 16;
    }
    return 14;
  }, [currentAdminBarangay]);

  const fetchUsersMap = useCallback(async () => {
    for (const useBearer of [false, true]) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/`, {
          headers: getAuthHeaders(useBearer)
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.results || []);
          const map = {};
          list.forEach(u => {
            if (u && u.id) {
              const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
              map[u.id] = fullName || u.username || u.email || `Resident #${u.id}`;
            }
          });
          setUsersMap(map);
          sessionStorage.setItem(CACHE_KEY_USERS_MAP, JSON.stringify(map));
          return map;
        }
      } catch (err) {
        console.warn('Failed to load user map:', err);
      }
    }
    return usersMap;
  }, [getAuthHeaders, usersMap]);

  const resolveUserName = (report) => {
    if (!report) return 'Resident Alert';
    if (report.user_name) return report.user_name;
    if (report.user && usersMap[report.user]) return usersMap[report.user];
    if (typeof report.user === 'object' && report.user !== null) {
      const u = report.user;
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      return fullName || u.username || u.email || 'Resident Alert';
    }
    if (report.user && typeof report.user === 'number') return `Resident #${report.user}`;
    return report.sender || 'Resident Alert';
  };

  const pieData = useMemo(() => {
    let pendingCount = 0;
    let ongoingCount = 0;
    let resolvedCount = 0;

    reports.forEach(report => {
      if (report && report.status) {
        const stat = String(report.status).toLowerCase().trim();
        if (stat === 'dismissed' || stat.includes('dismiss')) return; 
        if (stat === 'resolved') resolvedCount++;
        else if (stat === 'ongoing') ongoingCount++;
        else pendingCount++;
      }
    });

    const formattedPie = [
      { name: 'Pending', value: pendingCount, color: '#f59e0b' },
      { name: 'Ongoing', value: ongoingCount, color: '#2563eb' },
      { name: 'Resolved', value: resolvedCount, color: '#10b981' }
    ].filter(item => item.value > 0); 

    return formattedPie.length ? formattedPie : [{ name: 'No Data', value: 1, color: '#939598' }];
  }, [reports]);

  const volumeTrendData = useMemo(() => {
    const hours = ['12 AM', '3 AM', '6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'];
    return hours.map((hourLabel, idx) => {
      const hour24Start = idx * 3;
      const count = reports.filter(r => {
        if (!r || !r.created_at || !r.status) return false;
        const stat = String(r.status).toLowerCase().trim();
        if (stat === 'dismissed' || stat.includes('dismiss')) return false;
        const h = new Date(r.created_at).getHours();
        return h >= hour24Start && h < hour24Start + 3;
      }).length;
      return { time: hourLabel, reports: count };
    });
  }, [reports]);

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    if (reports.length === 0) setIsLoading(true);

    try {
      await fetchUsersMap();

      for (const useBearer of [false, true]) {
        const analyticsRes = await fetch(`${API_BASE_URL}/api/reports/admin/`, { 
          headers: getAuthHeaders(useBearer) 
        });

        if (analyticsRes.status === 401) continue;

        if (analyticsRes.ok) {
          const reportsData = await analyticsRes.json();
          let rawList = Array.isArray(reportsData) 
            ? reportsData 
            : (reportsData && Array.isArray(reportsData.results)) 
              ? reportsData.results 
              : [];
            
          setReports(rawList);
          sessionStorage.setItem(CACHE_KEY_DASHBOARD_REPORTS, JSON.stringify(rawList));
          setIsLoading(false);
          return;
        }
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch dashboard metrics:", error);
      setIsLoading(false);
    }
  }, [token, fetchUsersMap, getAuthHeaders, reports.length]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchDashboardData();
  }, [token, navigate, fetchDashboardData]);

  const executeStatusUpdate = async (reportId, newStatus) => {
    const rawTargetStatus = newStatus.toLowerCase().trim();
    
    const payload = { status: rawTargetStatus };
    if (rawTargetStatus === 'resolved') {
      payload.resolved_at = new Date().toISOString();
    }

    const updatedList = reports.map(report => 
      report.id === reportId ? { ...report, ...payload } : report
    );
    setReports(updatedList);
    sessionStorage.setItem(CACHE_KEY_DASHBOARD_REPORTS, JSON.stringify(updatedList));

    for (const useBearer of [false, true]) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/reports/admin/${reportId}/`, {
          method: 'PATCH',
          headers: getAuthHeaders(useBearer),
          body: JSON.stringify(payload)
        });

        if (response.ok) return;
      } catch (error) {
        console.error("Failed to execute status update network call:", error);
      }
    }
  };

  const handleStatusUpdate = (reportId, newStatus) => {
    const targetReport = reports.find(r => r.id === reportId);
    const currentStatus = targetReport?.status ? String(targetReport.status).toLowerCase().trim() : '';
    if (currentStatus === newStatus.toLowerCase().trim()) return;

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

  const activeReports = reports.filter(r => {
    if (!r || !r.status) return false;
    const stat = String(r.status).toLowerCase().trim();
    return stat !== 'resolved' && stat !== 'dismissed' && !stat.includes('dismiss');
  });
  
  const filteredActiveReports = activeReports.filter(r => {
    const s = String(r.status || '').toLowerCase().trim();
    if (s === 'dismissed' || s.includes('dismiss') || s === 'resolved') return false;
    
    if (statusFilter === 'pending') return s === 'pending' || s === 'submitted' || !s;
    if (statusFilter === 'ongoing') return s === 'ongoing';
    return true;
  });

  const historyReports = reports.filter(r => {
    if (!r || !r.status) return false;
    const stat = String(r.status).toLowerCase().trim();
    return stat === 'resolved';
  }).slice(0, 10);

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  };

  return (
    <AdminLayout>
      <style>{`
        .pulse-yellow { animation: pulseY 2s infinite; }
        .pulse-blue { animation: pulseB 1.5s infinite; }
        @keyframes pulseY {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes pulseB {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.8); }
          70% { box-shadow: 0 0 0 20px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        .leaflet-container {
          z-index: 0 !important;
        }
        .leaflet-pane {
          z-index: 1 !important;
        }
        .leaflet-top, .leaflet-bottom {
          z-index: 2 !important;
        }
      `}</style>

      <main className="w-full h-full min-h-0 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-12 md:grid-rows-2 bg-gray-200 gap-[1px]">
        
        {/* TELEMETRY LEAFLET MAP */}
        <section className="col-span-1 md:col-span-8 md:row-span-1 bg-white relative z-0 min-h-[300px] md:min-h-0 h-full w-full flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            {/* Adding dynamic key forces Leaflet instance to re-mount at correct initial center once user profile resolves */}
            <MapContainer 
              key={`leaflet-map-${normalizeBarangayName(currentAdminBarangay)}`}
              center={activeMapCenter} 
              zoom={activeZoomLevel} 
              minZoom={12} 
              maxZoom={18}
              maxBounds={ANGELES_CITY_BOUNDS} 
              maxBoundsViscosity={1.0} 
              bounceAtZoomLimits={true}
              style={{ height: '100%', width: '100%', zIndex: 0 }} 
              zoomControl={false} 
            >
              <MapResizer />
              <MapViewController center={activeMapCenter} zoom={activeZoomLevel} />
              
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                bounds={ANGELES_CITY_BOUNDS}
              />
              
              {activeReports.map((report) => {
                let rawBrgy = report.barangay || report.location || 'San Nicolas';
                let targetBarangay = normalizeBarangayName(rawBrgy);
                
                let latPosition = parseFloat(report.latitude);
                let lngPosition = parseFloat(report.longitude);

                if (isNaN(latPosition) || isNaN(lngPosition) || latPosition > 90 || lngPosition > 180) {
                  const coords = barangayCoords[targetBarangay];
                  if (coords) {
                    latPosition = coords[0];
                    lngPosition = coords[1];
                  }
                }

                if (latPosition && lngPosition) {
                  return (
                    <Marker key={`map-${report.id}`} position={[latPosition, lngPosition]} icon={createStatusIcon(report.status)}>
                      <Popup className="font-sans">
                        <div className="font-bold text-gray-800">{report.short_message || report.description || 'Incident Emergency'}</div>
                        <div className="text-xs text-gray-500">Brgy. {targetBarangay}</div>
                        {report.street && <div className="text-[11px] text-gray-400 font-medium">St: {report.street}</div>}
                        <div className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${String(report.status).toLowerCase().trim() === 'ongoing' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {String(report.status).toLowerCase().trim() === 'ongoing' ? 'Ongoing' : 'Pending'}
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
                return null; 
              })}
            </MapContainer>
          </div>
        </section>

        {/* CHARTS OVERVIEW */}
        <section className="col-span-1 md:col-span-4 md:row-span-1 bg-white p-4 lg:p-5 flex flex-col min-h-[280px] md:min-h-0 h-full overflow-y-auto">
          <h3 className="font-bold text-gray-800 text-base mb-2 shrink-0">Reports Overview</h3>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 font-bold text-xs">Loading charts...</div>
          ) : (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              
              {/* 1. VOLUME TREND AREA CHART */}
              <div className="flex-1 min-h-[110px] border-b border-gray-100 pb-2 flex flex-col">
                <span className="text-xs font-bold text-gray-500 block mb-1 shrink-0">Volume Trend</span>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={volumeTrendData} margin={{ top: 2, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dashboardTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px' }} />
                      <Area type="monotone" dataKey="reports" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#dashboardTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. FULL PIE CHART */}
              <div className="flex-1 min-h-[110px] flex items-center justify-between pt-2">
                <div className="w-[120px] h-full shrink-0 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={pieData} 
                        cx="50%"
                        cy="50%"
                        innerRadius={0} 
                        outerRadius="82%" 
                        paddingAngle={2} 
                        dataKey="value"
                      >
                        {pieData.map((e, i) => (
                          <Cell key={i} fill={e.color} stroke="#ffffff" strokeWidth={1.5} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="text-xs font-bold space-y-2 ml-3 shrink-0 flex-1">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-600 truncate">{item.name} ({item.value})</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </section>

        {/* LIVE ACTIVE EMERGENCY LOG */}
        <section className="col-span-1 md:col-span-8 md:row-span-1 bg-[#fafafa] p-4 sm:p-5 lg:p-6 overflow-y-auto h-full min-h-[300px] md:min-h-0">
          <div className="border-b border-gray-200 pb-3.5 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="font-black text-lg sm:text-xl lg:text-2xl text-gray-800 tracking-tight uppercase">
              Active Reports
            </h2>
            
            <div className="flex flex-wrap items-center bg-gray-200/70 p-1 rounded-xl text-xs font-bold gap-1 w-full sm:w-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all' 
                    ? 'bg-white text-gray-900 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All ({activeReports.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'pending' 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Pending ({activeReports.filter(r => String(r.status || '').toLowerCase().trim() !== 'ongoing').length})
              </button>
              <button
                onClick={() => setStatusFilter('ongoing')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'ongoing' 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Ongoing ({activeReports.filter(r => String(r.status || '').toLowerCase().trim() === 'ongoing').length})
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-gray-400 font-bold py-4 text-sm">Loading active reports...</p>
            ) : filteredActiveReports.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-emerald-500 font-bold text-base">All Clear!</div>
                <p className="text-gray-400 text-xs mt-1">No reports match the selected status filter.</p>
              </div>
            ) : (
              filteredActiveReports.map((report) => {
                const currentStatusRaw = String(report.status || '').toLowerCase().trim();
                const displayLabel = currentStatusRaw === 'ongoing' ? 'Ongoing' : 'Pending';
                const senderName = resolveUserName(report);
                const brgyName = report.barangay || report.location || 'Angeles City';
                const createdDate = formatDate(report.created_at);

                return (
                  <ReportItem 
                    key={report.id} 
                    id={report.id} 
                    title={report.short_message || report.description || 'Emergency Dispatch'} 
                    subtitle={`Reporter: ${senderName} | Brgy. ${brgyName} | ${createdDate}`} 
                    status={displayLabel} 
                    onStatusChange={handleStatusUpdate} 
                  />
                );
              })
            )}
          </div>
        </section>

        {/* RESOLVED HISTORY FEED */}
        <section className="col-span-1 md:col-span-4 md:row-span-1 bg-white p-4 sm:p-5 lg:p-6 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-200 h-full min-h-[250px] md:min-h-0">
          <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-4 border-b border-gray-100 pb-3">Recent History</h3>
          <div className="space-y-0.5">
            {isLoading ? (
              <p className="text-gray-400 font-bold py-4 text-sm">Loading history...</p>
            ) : historyReports.length === 0 ? (
              <p className="text-gray-400 py-4 text-xs text-center">No resolved reports yet.</p>
            ) : (
              historyReports.map((report) => (
                <HistoryRow 
                  key={report.id} 
                  label={report.short_message || report.description || 'Resolved Incident'} 
                  location={`Brgy. ${report.barangay || report.location || 'Angeles City'}`} 
                  time={formatDate(report.created_at)} 
                />
              ))
            )}
          </div>
        </section>

      </main>

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

function ReportItem({ id, title, subtitle, status, onStatusChange }) {
  return (
    <div className="border border-gray-200 bg-white rounded-xl p-3.5 sm:p-4 lg:p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
      <div className="w-full sm:max-w-[55%]">
        <div className="font-bold text-gray-900 text-sm sm:text-base lg:text-lg tracking-tight truncate">{title}</div>
        <div className="text-xs text-gray-400 font-medium mt-0.5 sm:mt-1 truncate">{subtitle}</div>
      </div>
      <div className="flex gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto justify-end">
        <StatusButton label="Pending" currentStatus={status} onClick={() => onStatusChange(id, 'Pending')} />
        <StatusButton label="Ongoing" currentStatus={status} onClick={() => onStatusChange(id, 'Ongoing')} />
        <StatusButton label="Resolved" currentStatus={status} onClick={() => onStatusChange(id, 'Resolved')} />
      </div>
    </div>
  );
}

function StatusButton({ label, currentStatus, onClick }) {
  const isActive = currentStatus?.toLowerCase() === label?.toLowerCase();
  
  let colorClass = "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 cursor-pointer";
  
  if (isActive) {
    if (label === "Pending") {
      colorClass = "bg-amber-100 border-amber-400 text-amber-800 font-black cursor-default shadow-xs";
    } else if (label === "Ongoing") {
      colorClass = "bg-blue-600 border-blue-700 text-white font-black cursor-default shadow-xs";
    } else if (label === "Resolved") {
      colorClass = "bg-emerald-600 border-emerald-700 text-white font-black cursor-default shadow-xs";
    }
  }

  return (
    <button 
      type="button"
      onClick={onClick} 
      className={`${colorClass} px-2.5 sm:px-4 lg:px-5 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-[11px] lg:text-xs font-black uppercase tracking-tight border transition-all active:scale-95`}
    >
      {label}
    </button>
  );
}

function HistoryRow({ label, location, time }) {
  return (
    <div className="border-b border-gray-50 py-2.5 lg:py-3.5 flex justify-between items-center group px-1.5 rounded-md transition-all hover:bg-gray-50 cursor-pointer">
      <div className="max-w-[70%]">
        <div className="font-bold text-xs sm:text-sm lg:text-base text-gray-700 group-hover:text-[#b32d2d] transition-colors truncate">{label}</div>
        <div className="text-[11px] sm:text-xs text-gray-400 font-medium mt-0.5">{location}</div>
      </div>
      <span className="text-[11px] sm:text-xs font-bold text-gray-300 group-hover:text-gray-400 shrink-0">{time}</span>
    </div>
  );
}