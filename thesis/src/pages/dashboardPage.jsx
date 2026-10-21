import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AdminLayout from '../components/header';

const targetHostname = window.location.hostname || '127.0.0.1';
// const API_BASE_URL = 'https://api.aksyon.online';
const API_BASE_URL = `http://${targetHostname}:8000`;

const CACHE_KEY_DASHBOARD_REPORTS = 'cache_dashboard_reports_v1';
const CACHE_KEY_USERS_MAP = 'cache_admin_users_map_v9';

const barangayCoords = {
  'Balibago': [15.1667, 120.5833],
  'Cutcut': [15.1333, 120.5667],
  'Pampang': [15.1450, 120.5600],
  'Malabanias': [15.1600, 120.5750],
  'Amsic': [15.1550, 120.5650],
  'Cutud': [15.1500, 120.6100],
  'Margot': [15.1660, 120.5330],
  'Sapangbato': [15.1500, 120.5160],
  'San Nicolas': [15.1340, 120.5910],
  'Sta. Trinidad': [15.1320, 120.5950],
  'Lourdes NorthWest': [15.1410, 120.5810],
  'Claro M. Recto': [15.1420, 120.5990]
};

const ANGELES_CITY_BOUNDS = [
  [15.1050, 120.5050],
  [15.1850, 120.6350]
];

const ANGELES_CENTER = [15.1450, 120.5880];

const createStatusIcon = (status) => {
  let bgColor = '#facc15';
  let pulseClass = 'pulse-yellow'; 

  if (String(status).toLowerCase() === 'ongoing') {
    bgColor = '#ef4444';
    pulseClass = 'pulse-red'; 
  }
  
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div class="${pulseClass}" style="background-color: ${bgColor}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
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

  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [isLoading, setIsLoading] = useState(() => reports.length === 0);
  
  // Status Filter State ('all', 'pending', 'ongoing')
  const [statusFilter, setStatusFilter] = useState('all');

  const token = localStorage.getItem('ac_token');

  const getAuthHeaders = (useBearer = false) => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return { 'Authorization': `${authPrefix} ${cleanToken}`, 'Content-Type': 'application/json' };
  };

  const fetchUsersMap = async () => {
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
  };

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

  const processChartData = (rawList) => {
    const barangayCounts = {};
    Object.keys(barangayCoords).forEach(key => { barangayCounts[key] = 0; });

    rawList.forEach(report => {
      if (report) {
        let bName = report.barangay || report.location || 'San Nicolas';
        if (bName === 'Lourdes North West') bName = 'Lourdes NorthWest';
        if (bName === 'San Trinidad') bName = 'Sta. Trinidad';
        
        if (barangayCounts[bName] !== undefined) {
          barangayCounts[bName] += 1;
        }
      }
    });

    const formattedBars = Object.keys(barangayCounts).map(key => ({
      d: key === 'Lourdes NorthWest' ? 'Lourdes NW' : key,
      v: barangayCounts[key]
    }));
    setBarData(formattedBars);

    let pendingCount = 0;
    let ongoingCount = 0;
    let resolvedCount = 0;

    rawList.forEach(report => {
      if (report) {
        const stat = String(report.status).toLowerCase();
        if (stat === 'resolved') resolvedCount++;
        else if (stat === 'ongoing') ongoingCount++;
        else pendingCount++; // Counts 'pending', 'submitted', or empty as Pending
      }
    });

    const formattedPie = [
      { name: 'Pending', value: pendingCount, color: '#ffc20e' },
      { name: 'Ongoing', value: ongoingCount, color: '#ef4444' },
      { name: 'Resolved', value: resolvedCount, color: '#10b981' }
    ].filter(item => item.value > 0); 
    
    setPieData(formattedPie.length ? formattedPie : [{ name: 'No Data', value: 1, color: '#939598' }]);
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (reports.length > 0) {
      processChartData(reports);
    }

    const fetchDashboardData = async () => {
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
            processChartData(rawList);
            setIsLoading(false);
            return;
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch dashboard metrics:", error);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, navigate]);

  // Click handler to update report status
  const handleStatusUpdate = async (reportId, newStatus) => {
    const rawTargetStatus = newStatus.toLowerCase();
    
    const payload = { status: rawTargetStatus };
    if (rawTargetStatus === 'resolved') {
      payload.resolved_at = new Date().toISOString();
    }

    // Optimistically update local UI and Cache first
    const updatedList = reports.map(report => 
      report.id === reportId ? { ...report, ...payload } : report
    );
    setReports(updatedList);
    sessionStorage.setItem(CACHE_KEY_DASHBOARD_REPORTS, JSON.stringify(updatedList));
    processChartData(updatedList);

    // Send PATCH to API
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

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  const activeReports = reports.filter(r => r && String(r.status).toLowerCase() !== 'resolved');
  
  // Filter active reports based on selected tab
  const filteredActiveReports = activeReports.filter(r => {
    const s = String(r.status).toLowerCase();
    if (statusFilter === 'pending') return s === 'pending' || s === 'submitted' || !s;
    if (statusFilter === 'ongoing') return s === 'ongoing';
    return true; // 'all'
  });

  const historyReports = reports.filter(r => r && String(r.status).toLowerCase() === 'resolved').slice(0, 10);

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  };

  return (
    <AdminLayout>
      <style>{`
        .pulse-yellow { animation: pulseY 2s infinite; }
        .pulse-red { animation: pulseR 1.5s infinite; }
        @keyframes pulseY {
          0% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(250, 204, 21, 0); }
          100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); }
        }
        @keyframes pulseR {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); }
          70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      <main className="h-full grid grid-cols-12 overflow-hidden bg-gray-200 gap-[1px]">
        
        {/* TELEMETRY LEAFLET MAP */}
        <section className="col-span-8 bg-white relative overflow-hidden z-0">
          <MapContainer 
            center={ANGELES_CENTER} 
            zoom={13} 
            minZoom={13} 
            maxZoom={18}
            maxBounds={ANGELES_CITY_BOUNDS} 
            maxBoundsViscosity={1.0} 
            bounceAtZoomLimits={true}
            style={{ height: '100%', width: '100%' }} 
            zoomControl={false} 
          >
            <TileLayer 
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              bounds={ANGELES_CITY_BOUNDS}
            />
            
            {activeReports.map((report) => {
              let targetBarangay = report.barangay || report.location || 'San Nicolas';
              if (targetBarangay === 'Lourdes North West') targetBarangay = 'Lourdes NorthWest';
              if (targetBarangay === 'San Trinidad') targetBarangay = 'Sta. Trinidad';
              
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
                      <div className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${String(report.status).toLowerCase() === 'ongoing' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {String(report.status).toLowerCase() === 'ongoing' ? 'Ongoing' : 'Pending'}
                      </div>
                    </Popup>
                  </Marker>
                );
              }
              return null; 
            })}
          </MapContainer>
        </section>

        {/* CHARTS OVERVIEW */}
        <section className="col-span-4 bg-white p-6 flex flex-col overflow-y-auto">
          <h3 className="font-bold text-gray-800 text-lg mb-4">Reports Overview</h3>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 font-bold">Loading charts...</div>
          ) : (
            <>
              <div className="w-full h-[180px] min-w-0 border-b border-gray-50 pb-6">
                {barData.length === 0 ? (
                  <div className="text-center text-xs text-gray-300 pt-16">No regional records</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ left: -25 }}>
                      <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} precision={0} />
                      <Bar dataKey="v" fill="#bae6fd" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="w-full h-[160px] min-w-0 flex items-center justify-center py-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                      {pieData.map((e, i) => (
                        <Cell key={i} fill={e.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-[10px] font-bold space-y-1.5 ml-4 shrink-0">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-gray-500 truncate w-24">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* LIVE ACTIVE EMERGENCY LOG & STATUS FILTER */}
        <section className="col-span-8 bg-[#fafafa] p-8 overflow-y-auto">
          <div className="border-b border-gray-200 pb-4 mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-black text-2xl text-gray-800 tracking-tight uppercase">
              Active Reports
            </h2>
            
            {/* STATUS FILTERS */}
            <div className="flex items-center bg-gray-200/70 p-1 rounded-xl text-xs font-bold gap-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'all' 
                    ? 'bg-white text-gray-900 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                All ({activeReports.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'pending' 
                    ? 'bg-[#fef08a] text-yellow-900 shadow-xs' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Pending ({activeReports.filter(r => String(r.status).toLowerCase() !== 'ongoing').length})
              </button>
              <button
                onClick={() => setStatusFilter('ongoing')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'ongoing' 
                    ? 'bg-[#ef4444] text-white shadow-xs' 
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Ongoing ({activeReports.filter(r => String(r.status).toLowerCase() === 'ongoing').length})
              </button>
            </div>
          </div>
          
          <div className="space-y-1">
            {isLoading ? (
              <p className="text-gray-400 font-bold py-4">Loading active reports...</p>
            ) : filteredActiveReports.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-green-500 font-bold text-lg">All Clear!</div>
                <p className="text-gray-400 text-sm">No reports match the selected status filter.</p>
              </div>
            ) : (
              filteredActiveReports.map((report) => {
                const currentStatusRaw = String(report.status).toLowerCase();
                const displayLabel = currentStatusRaw === 'ongoing' ? 'Ongoing' : 'Pending';
                const senderName = resolveUserName(report);
                const brgyName = report.barangay || report.location || 'Angeles City';
                const createdDate = formatDate(report.created_at);

                return (
                  <ReportItem 
                    key={report.id} 
                    id={report.id} 
                    title={report.short_message || report.description || 'Emergency Dispatch'} 
                    subtitle={`Reporter: ${senderName} • Brgy. ${brgyName} • ${createdDate}`} 
                    status={displayLabel} 
                    onStatusChange={handleStatusUpdate} 
                  />
                );
              })
            )}
          </div>
        </section>

        {/* RESOLVED HISTORY ROW */}
        <section className="col-span-4 bg-white p-8 overflow-y-auto border-l border-gray-200">
          <h3 className="font-bold text-lg text-gray-800 mb-8 border-b border-gray-100 pb-4">Recent History</h3>
          <div className="space-y-0">
            {isLoading ? (
              <p className="text-gray-400 font-bold py-4">Loading history...</p>
            ) : historyReports.length === 0 ? (
              <p className="text-gray-400 py-4 text-sm text-center">No resolved reports yet.</p>
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
    </AdminLayout>
  );
}

function ReportItem({ id, title, subtitle, status, onStatusChange }) {
  return (
    <div className="border border-gray-200 bg-white rounded-lg p-4 mb-3 flex items-center justify-between shadow-xs">
      <div className="max-w-[60%]">
        <div className="font-bold text-gray-900 text-lg tracking-tight truncate">{title}</div>
        <div className="text-sm text-gray-400 font-medium mt-1">{subtitle}</div>
      </div>
      <div className="flex gap-2">
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
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-xs";
    if (label === "Ongoing") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-xs";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-xs";
  }

  return (
    <button 
      type="button"
      onClick={onClick} 
      className={`${colorClass} px-5 py-2 rounded-md text-[11px] font-black uppercase tracking-tight border transition-all active:scale-95`}
    >
      {label}
    </button>
  );
}

function HistoryRow({ label, location, time }) {
  return (
    <div className="border-b border-gray-50 py-4 flex justify-between items-center group px-2 rounded-md transition-all hover:bg-gray-50 cursor-pointer">
      <div className="max-w-[70%]">
        <div className="font-bold text-gray-700 group-hover:text-[#b32d2d] transition-colors truncate">{label}</div>
        <div className="text-[10px] text-gray-400 font-medium">{location}</div>
      </div>
      <span className="text-[10px] font-bold text-gray-300 group-hover:text-gray-400 shrink-0">{time}</span>
    </div>
  );
}