import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AdminLayout from '../components/header';

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
  let bgColor = '#facc15';
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
        const targetHostname = window.location.hostname || '127.0.0.1';
        
        // Supports Token or Bearer depending on backend auth backend setup
        const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;

        const headersConfiguration = {
          'Content-Type': 'application/json',
          'Authorization': authPrefix
        };

        const analyticsRes = await fetch(`http://${targetHostname}:8000/api/reports/admin/`, { 
          headers: headersConfiguration 
        });

        if (analyticsRes.status === 401) {
          console.warn("Session expired or unauthorized token. Redirecting to login...");
          localStorage.removeItem('ac_token');
          navigate('/login');
          return;
        }

        if (!analyticsRes.ok) {
          throw new Error(`Server returned ${analyticsRes.status}: ${analyticsRes.statusText}`);
        }

        const reportsData = await analyticsRes.json();
        
        let rawList = Array.isArray(reportsData) 
          ? reportsData 
          : (reportsData && Array.isArray(reportsData.results)) 
            ? reportsData.results 
            : [];
          
        setReports(rawList);

        // Bar Chart processing
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

        // Pie Chart processing
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
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;

      const response = await fetch(`http://${targetHostname}:8000/api/reports/admin/${reportId}/`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authPrefix
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

      {/* DASHBOARD MAIN GRID */}
      <main className="h-full grid grid-cols-12 overflow-hidden bg-gray-200 gap-[1px]">
        
        {/* DYNAMIC TELEMETRY LEAFLET MAP */}
        <section className="col-span-8 bg-white relative overflow-hidden z-0">
          <MapContainer 
            center={[15.1440, 120.5880]} 
            zoom={13} 
            minZoom={12} 
            maxBounds={angelesCityBounds} 
            maxBoundsViscosity={1.0} 
            style={{ height: '100%', width: '100%' }} 
            zoomControl={false} 
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

  return (
    <button 
      onClick={isActive ? null : onClick} 
      className={`${colorClass} px-5 py-2 rounded-md text-[11px] font-black uppercase tracking-tight border transition-all ${!isActive ? 'active:scale-95' : ''}`}
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