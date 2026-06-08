import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Menu, UserCircle, Truck } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis } from 'recharts';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ==========================================
// MAP HELPERS (Angeles City)
// ==========================================
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

const angelesCityBounds = [
  [15.0800, 120.4800], 
  [15.2200, 120.6500]  
];

const createStatusIcon = (status) => {
  let bgColor = '#facc15'; // Default yellow for submitted/pending
  let pulseClass = 'pulse-yellow'; 

  if (String(status).toLowerCase() === 'ongoing' || String(status).toLowerCase() === 'responding') {
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
  const location = useLocation();

  const [showSidebar, setShowSidebar] = useState(false);
  const [reports, setReports] = useState([]);
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const token = localStorage.getItem('ac_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const headersConfiguration = {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        };

        const targetHostname = window.location.hostname || '127.0.0.1';
        const analyticsRes = await fetch(`http://${targetHostname}:8000/api/reports/admin-reports/`, { headers: headersConfiguration });
        const reportsData = await analyticsRes.json();
        
        let rawList = Array.isArray(reportsData) ? reportsData : (reportsData && Array.isArray(reportsData.results)) ? reportsData.results : [];
          
        setReports(rawList);

        // =========================================================================
        // 📊 COMPILE BAR CHART DISTRIBUTIONS DIRECTLY IN REACT FRONTEND
        // =========================================================================
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

        // =========================================================================
        // 🍩 COMPILE PIE CHART BREAKDOWN STATUS METRICS DIRECTLY IN FRONTEND
        // =========================================================================
        let submittedCount = 0;
        let pendingCount = 0;
        let ongoingCount = 0;
        let resolvedCount = 0;

        rawList.forEach(report => {
          if (report) {
            const stat = String(report.status).toLowerCase();
            if (stat === 'resolved') resolvedCount++;
            else if (stat === 'ongoing' || stat === 'responding') ongoingCount++;
            else if (stat === 'pending') pendingCount++;
            else submittedCount++;
          }
        });

        const formattedPie = [
          { name: 'Submitted', value: submittedCount, color: '#3b82f6' },
          { name: 'Pending', value: pendingCount, color: '#ffc20e' },
          { name: 'Responding', value: ongoingCount, color: '#ef4444' },
          { name: 'Resolved', value: resolvedCount, color: '#10b981' }
        ].filter(item => item.value > 0); 
        
        setPieData(formattedPie.length ? formattedPie : [{ name: 'No Data', value: 1, color: '#939598' }]);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch dashboard metrics:", error);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, navigate]);

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      const statusDatabaseMap = {
        'Pending': 'pending',       
        'Responding': 'ongoing',   
        'Resolved': 'resolved'      
      };

      const finalPayloadValue = statusDatabaseMap[newStatus] || 'submitted';

      const targetHostname = window.location.hostname || '127.0.0.1';
      const response = await fetch(`http://${targetHostname}:8000/api/reports/admin-reports/${reportId}/`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ status: finalPayloadValue })
      });

      if (response.ok) {
        setReports(prevReports => prevReports.map(report => 
            report.id === reportId ? { ...report, status: finalPayloadValue } : report
        ));
      }
    } catch (error) {
      console.error("Failed to execute status update network call:", error);
    }
  };

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  const activeReports = reports.filter(r => r && String(r.status).toLowerCase() !== 'resolved');
  const historyReports = reports.filter(r => r && String(r.status).toLowerCase() === 'resolved').slice(0, 10);

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a]">
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

      {/* SIDEBAR NAVIGATION */}
      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} /></div>
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={location.pathname === '/reports'} /></div>
          <div onClick={() => navigate('/analytics')}><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={location.pathname === '/analytics'} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={location.pathname === '/users'} /></div>
          <div onClick={() => navigate('/emergency-units')}><SidebarLink icon={<Truck size={24} />} label="Emergency Units" active={location.pathname === '/emergency-units'} /></div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-gray-200 flex flex-col rounded-t-xl overflow-hidden mx-2 mb-2 shadow-2xl relative">
          
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className="bg-[#8b2323] px-5 py-1.5 rounded-md font-bold text-sm shadow-inner cursor-pointer">Dashboard</span>
                <span onClick={() => navigate('/reports')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Reports</span>
                <span onClick={() => navigate('/analytics')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Analytics</span>
                <span onClick={() => navigate('/users')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Users</span>
                <span onClick={() => navigate('/emergency-units')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Emergency Units</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          <main className="flex-1 grid grid-cols-12 overflow-hidden bg-gray-200 gap-[1px]">
            
            {/* DYNAMIC TELEMETRY LEAFLET MAP */}
            <section className="col-span-8 bg-white relative overflow-hidden z-0">
              <MapContainer 
                center={[15.1440, 120.5880]} 
                zoom={13} minZoom={12} 
                maxBounds={angelesCityBounds} maxBoundsViscosity={1.0} 
                style={{ height: '100%', width: '100%' }} zoomControl={false} 
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                
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
                            {String(report.status).toLowerCase() === 'ongoing' ? 'Responding' : report.status || 'submitted'}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                  return null; 
                })}
              </MapContainer>
            </section>

            {/* CHARTS OVERVIEW WORKSPACE */}
            <section className="col-span-4 bg-white p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-gray-800 text-lg mb-4">Reports Overview</h3>
              {isLoading ? (<div className="flex-1 flex items-center justify-center text-gray-400 font-bold">Loading charts...</div>) : (
                <>
                  <div className="h-[180px] w-full border-b border-gray-50 pb-6">
                    {barData.length === 0 ? <div className="text-center text-xs text-gray-300 pt-16">No regional records</div> : (
                      <ResponsiveContainer><BarChart data={barData} margin={{left: -25}}><XAxis dataKey="d" tick={{fontSize: 10, fill: '#999'}} axisLine={false} tickLine={false} /><YAxis tick={{fontSize: 10, fill: '#999'}} axisLine={false} tickLine={false} precision={0} /><Bar dataKey="v" fill="#bae6fd" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer>
                    )}
                  </div>
                  <div className="flex-1 flex items-center justify-center py-6">
                    <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={pieData} innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">{pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}</Pie></PieChart></ResponsiveContainer>
                    <div className="text-[10px] font-bold space-y-1.5 ml-4 shrink-0">
                      {pieData.map(item => (<div key={item.name} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}}></div><span className="text-gray-500 truncate w-24">{item.name}</span></div>))}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* LIVE ACTIVE EMERGENCY LOG */}
            <section className="col-span-8 bg-[#fafafa] p-8 overflow-y-auto">
              <h2 className="font-black text-2xl text-gray-800 tracking-tight uppercase border-b border-gray-200 pb-4 mb-6 flex justify-between items-center">
                <span>Active Reports</span>
                <span className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold">{activeReports.length} Ongoing</span>
              </h2>
              
              <div className="space-y-1">
                {isLoading ? (
                  <p className="text-gray-400 font-bold py-4">Loading active reports...</p>
                ) : activeReports.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-green-500 font-bold text-lg">All Clear!</div>
                    <p className="text-gray-400 text-sm">No active emergencies at the moment.</p>
                  </div>
                ) : (
                  activeReports.map((report) => {
                    const currentStatusRaw = String(report.status).toLowerCase();
                    const displayLabel = currentStatusRaw === 'ongoing' ? 'Responding' : (currentStatusRaw === 'submitted' || currentStatusRaw === 'pending') ? 'Pending' : report.status;
                    
                    return (
                      <ReportItem 
                        key={report.id} 
                        id={report.id} 
                        title={report.short_message || report.description || 'Emergency Dispatch'} 
                        subtitle={`Reporter ID: ${report.user || '2'} • Brgy. ${report.barangay || report.location || 'Angeles City'} - ${formatDate(report.created_at)}`} 
                        status={displayLabel} 
                        onStatusChange={handleStatusUpdate} 
                      />
                    );
                  })
                )}
              </div>
            </section>

            {/* RESOLVED INCIDENT RECORD ROW */}
            <section className="col-span-4 bg-white p-8 overflow-y-auto border-l border-gray-200">
              <h3 className="font-bold text-lg text-gray-800 mb-8 border-b border-gray-100 pb-4">Recent History</h3>
              <div className="space-y-0">
                {isLoading ? (
                  <p className="text-gray-400 font-bold py-4">Loading history...</p>
                ) : historyReports.length === 0 ? (
                   <p className="text-gray-400 py-4 text-sm text-center">No resolved reports yet.</p>
                ) : (
                  historyReports.map((report) => (
                    <HistoryRow key={report.id} label={report.short_message || report.description || 'Resolved Incident'} location={`Brgy. {report.barangay || report.location || 'Angeles City'}`} time={formatDate(report.created_at)} />
                  ))
                )}
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (<div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}><span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span><span className="text-[16px] tracking-tight">{label}</span></div>);
}

function ReportItem({ id, title, subtitle, status, onStatusChange }) {
  return (
    <div className="border border-gray-200 bg-white rounded-lg p-4 mb-3 flex items-center justify-between shadow-sm">
      <div className="max-w-[60%]">
        <div className="font-bold text-gray-900 text-lg tracking-tight truncate">{title}</div>
        <div className="text-sm text-gray-400 font-medium mt-1">{subtitle}</div>
      </div>
      <div className="flex gap-2">
        <StatusButton label="Pending" currentStatus={status} onClick={() => onStatusChange(id, 'Pending')} />
        <StatusButton label="Responding" currentStatus={status} onClick={() => onStatusChange(id, 'Responding')} />
        <StatusButton label="Resolved" currentStatus={status} onClick={() => onStatusChange(id, 'Resolved')} />
      </div>
    </div>
  );
}

function StatusButton({ label, currentStatus, onClick }) {
  const isActive = currentStatus?.toLowerCase() === label?.toLowerCase();
  let colorClass = "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 cursor-pointer";
  
  if (isActive) {
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-sm";
    if (label === "Responding") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-md";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-md";
  }

  return (<button onClick={isActive ? null : onClick} className={`${colorClass} px-5 py-2 rounded-md text-[11px] font-black uppercase tracking-tight border transition-all ${!isActive ? 'active:scale-95' : ''}`}>{label}</button>);
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