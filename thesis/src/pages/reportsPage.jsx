import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Search, Filter, MapPin, X, 
  AlertTriangle, Image as ImageIcon 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import AdminLayout from '../components/header';

// Leaflet custom marker pin setup
const redMarkerIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `<div style="background-color: #ef4444; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

const barangayCoordsFallback = {
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

export const ANGELES_BARANGAYS = [
  "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", 
  "Claro M. Recto", "Cuayan", "Cutcut", "Cutud", "Lourdes North West", 
  "Lourdes Sur", "Lourdes Sur East", "Malabanias", "Margot", "Mining", 
  "Ninoy Aquino (Marisol)", "Pampang", "Pandan", "Pulung Bulu", 
  "Pulung Cacutud", "Pulung Maragul", "Salapungan", "San Jose", 
  "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", 
  "Santo Domingo", "Santo Rosario", "Sapalibutad", "Sapangbato", 
  "Tabun", "Virgen Delos Remedios"
];

export default function ReportsPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Inspection Modal State
  const [selectedReport, setSelectedReport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';

  // 1. Fetch Reports
  const fetchReports = async () => {
    if (!token) return;
    try {
      const response = await fetch(`http://${targetHostname}:8000/api/reports/admin-reports/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        }
      });
      
      const data = await response.json();
      const rawList = Array.isArray(data) ? data : (data?.results || []);
      
      setReports(rawList.sort((a, b) => b.id - a.id));
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching reports:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchReports();
  }, [token, navigate]);

  // 2. Status Updater (Supports Pending, Responding, Resolved, & Invalid)
  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      const statusDatabaseMap = {
        'Pending': 'pending',       
        'Responding': 'ongoing',   
        'Resolved': 'resolved',
        'Invalid': 'invalid'
      };

      const finalPayloadValue = statusDatabaseMap[newStatus] || 'submitted';

      const response = await fetch(`http://${targetHostname}:8000/api/reports/admin-reports/${reportId}/`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ status: finalPayloadValue })
      });

      if (response.ok) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: finalPayloadValue } : r));
        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport(prev => ({ ...prev, status: finalPayloadValue }));
        }
      }
    } catch (error) {
      console.error("Failed to execute status update:", error);
    }
  };

  // 3. Flag as Inaccurate / Invalid handler
  const handleMarkAsInvalid = (reportId) => {
    if (window.confirm("Mark this report as Invalid / False submission? This will flag it as inaccurate.")) {
      handleStatusUpdate(reportId, 'Invalid');
    }
  };

  // 4. Quick Inline Barangay Updater
  const handleBarangayUpdate = async (reportId, selectedBarangay) => {
    try {
      const response = await fetch(`http://${targetHostname}:8000/api/reports/admin-reports/${reportId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ barangay: selectedBarangay })
      });

      if (response.ok) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, barangay: selectedBarangay } : r));
        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport(prev => ({ ...prev, barangay: selectedBarangay }));
        }
        setEditingReportId(null); 
      }
    } catch (error) {
      console.error("Failed to patch Barangay:", error);
    }
  };

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Filter Search
  const filteredReports = reports.filter(report => {
    if (!report) return false;
    const reportText = (report.short_message || report.description || '').toLowerCase();
    const barangayText = (report.barangay || report.location || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchedSearch = reportText.includes(query) || barangayText.includes(query) || String(report.id).includes(query);
    const currentStat = String(report.status).toLowerCase();
    
    let matchedStatus = true;
    if (statusFilter === 'Pending') matchedStatus = (currentStat === 'pending' || currentStat === 'submitted');
    else if (statusFilter === 'Responding') matchedStatus = (currentStat === 'ongoing' || currentStat === 'responding');
    else if (statusFilter === 'Resolved') matchedStatus = (currentStat === 'resolved');
    else if (statusFilter === 'Invalid') matchedStatus = (currentStat === 'invalid');

    return matchedSearch && matchedStatus;
  });

  // Modal Coordinate Resolver
  let modalLat = parseFloat(selectedReport?.latitude);
  let modalLng = parseFloat(selectedReport?.longitude);
  const selectedBrgy = selectedReport?.barangay || selectedReport?.location || 'San Nicolas';

  if (isNaN(modalLat) || isNaN(modalLng)) {
    const fallback = barangayCoordsFallback[selectedBrgy] || [15.1440, 120.5880];
    modalLat = fallback[0];
    modalLng = fallback[1];
  }

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0]">
        
        {/* CONTROLS HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-4" />
              <input 
                type="text" 
                placeholder="Search Incident ID, description, or barangay..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none" 
              />
            </div>
            
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-sm text-sm text-gray-600 font-bold">
              <Filter size={16} className="text-gray-400 mr-2" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="py-2.5 bg-transparent focus:outline-none cursor-pointer pr-4">
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Responding">Responding</option>
                <option value="Resolved">Resolved</option>
                <option value="Invalid">Invalid / False</option>
              </select>
            </div>
          </div>
        </div>

        {/* MASTER TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-xl text-gray-900">Emergency Incident Reports</h2>
            </div>
            <span className="text-sm text-gray-400 font-bold">{filteredReports.length} Total Matched Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6 w-20">ID</th>
                  <th className="py-4 px-6">Emergency Details</th>
                  <th className="py-4 px-6 w-64">Location (Barangay)</th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6 text-center w-80">Quick Workflow</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-bold">Querying reports database...</td></tr>
                ) : filteredReports.length === 0 ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-medium">No records matched.</td></tr>
                ) : (
                  filteredReports.map((report) => {
                    const currentStatusRaw = String(report.status).toLowerCase();
                    const displayLabel = currentStatusRaw === 'ongoing' || currentStatusRaw === 'responding' 
                      ? 'Responding' 
                      : (currentStatusRaw === 'submitted' || currentStatusRaw === 'pending') 
                        ? 'Pending' 
                        : currentStatusRaw === 'invalid'
                          ? 'Invalid'
                          : 'Resolved';
                    
                    return (
                      <tr 
                        key={report.id} 
                        onClick={() => { setSelectedReport(report); setIsModalOpen(true); }}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-5 px-6 font-black text-gray-400 text-sm">#{report.id}</td>
                        <td className="py-5 px-6">
                          <div className="font-bold text-gray-800 text-[15px]">{report.short_message || report.description || 'Emergency Incident'}</div>
                          <div className="text-xs text-gray-400 mt-0.5 font-medium">Reporter ID: {report.user || '2'}</div>
                        </td>
                        
                        <td className="py-5 px-6 text-sm" onClick={(e) => e.stopPropagation()}>
                          {editingReportId === report.id ? (
                            <select 
                              defaultValue={report.barangay || ""} 
                              onChange={(e) => handleBarangayUpdate(report.id, e.target.value)}
                              onBlur={() => setEditingReportId(null)}
                              autoFocus
                              className="w-full text-xs font-bold text-gray-700 border border-gray-400 rounded p-1 bg-white"
                            >
                              {ANGELES_BARANGAYS.map((brgy) => (
                                <option key={brgy} value={brgy}>{brgy}</option>
                              ))}
                            </select>
                          ) : (
                            <div 
                              onClick={() => setEditingReportId(report.id)} 
                              className="group flex flex-col cursor-pointer hover:bg-gray-200/60 p-1.5 rounded transition-all w-fit"
                              title="Click to edit Barangay"
                            >
                              <div className="font-bold text-gray-700 flex items-center gap-1 text-[13px]">
                                <MapPin size={12} className="text-[#b32d2d] shrink-0" />
                                <span>Brgy. {report.barangay || report.location || 'Click to set'}</span>
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-5 px-6 text-xs font-bold text-gray-400">
                          <div>{formatDate(report.created_at)}</div>
                        </td>

                        <td className="py-5 px-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 justify-center">
                            <StatusButton label="Pending" currentStatus={displayLabel} onClick={() => handleStatusUpdate(report.id, 'Pending')} />
                            <StatusButton label="Responding" currentStatus={displayLabel} onClick={() => handleStatusUpdate(report.id, 'Responding')} />
                            <StatusButton label="Resolved" currentStatus={displayLabel} onClick={() => handleStatusUpdate(report.id, 'Resolved')} />
                            <StatusButton label="Invalid" currentStatus={displayLabel} onClick={() => handleMarkAsInvalid(report.id)} />
                          </div>
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

      {/* ========================================================================= */}
      {/* 🔍 DETAILED REPORT INSPECTION MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && selectedReport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            
            {/* MODAL TOP HEADER */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h3 className="font-black text-xl text-gray-900 tracking-tight flex items-center gap-2">
                  Report ID #{selectedReport.id} — {selectedReport.short_message || selectedReport.description || 'Emergency Dispatch'}
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-1">
                  {formatDate(selectedReport.created_at)} • <span className={`uppercase font-black ${String(selectedReport.status).toLowerCase() === 'invalid' ? 'text-gray-500' : 'text-[#b32d2d]'}`}>{selectedReport.status || 'Pending'}</span>
                </p>
              </div>

              {/* ACTION BUTTONS WORKFLOW */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleStatusUpdate(selectedReport.id, 'Responding')}
                  className="bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95"
                >
                  Mark In Progress
                </button>
                <button 
                  onClick={() => handleStatusUpdate(selectedReport.id, 'Resolved')}
                  className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95"
                >
                  Mark Resolved
                </button>
                <button 
                  onClick={() => handleMarkAsInvalid(selectedReport.id)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                  title="Flag report as fake, troll, or inaccurate"
                >
                  <AlertTriangle size={14} /> Mark as Invalid
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg transition-all active:scale-95 ml-2"
                >
                  Close
                </button>
              </div>
            </div>

            {/* MODAL MAIN CONTENT BODY */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-12 gap-6">
                
                {/* LEFT: REPORT DETAILS SPECS TABLE */}
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
                      <span className="font-bold text-gray-400 uppercase">Submitted By</span>
                      <span className="font-bold text-gray-800">Citizen ID #{selectedReport.user || '2'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Location Area</span>
                      <span className="font-bold text-gray-800">Brgy. {selectedReport.barangay || selectedReport.location || 'Angeles City'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-gray-200/60">
                      <span className="font-bold text-gray-400 uppercase">Coordinates</span>
                      <span className="font-bold text-gray-800">{modalLat.toFixed(6)}, {modalLng.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="font-bold text-gray-400 uppercase">Status</span>
                      <span className="font-black text-[#b32d2d] uppercase">{selectedReport.status || 'Pending'}</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT: LEAFLET PIN LOCATION MAP */}
                <div className="col-span-6 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-4">
                    <MapPin size={16} className="text-[#b32d2d]" />
                    <h4 className="font-black text-sm text-gray-900">Report Location</h4>
                  </div>
                  
                  <div className="flex-1 min-h-[220px] rounded-xl overflow-hidden border border-gray-200 relative">
                    <MapContainer 
                      center={[modalLat, modalLng]} 
                      zoom={14} 
                      style={{ height: '100%', width: '100%' }} 
                      zoomControl={false}
                    >
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                      <Marker position={[modalLat, modalLng]} icon={redMarkerIcon}>
                        <Popup>
                          <div className="font-bold text-xs">{selectedReport.short_message || 'Emergency'}</div>
                          <div className="text-[10px] text-gray-500">Brgy. {selectedBrgy}</div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>

              </div>

              {/* INCIDENT DESCRIPTION CARD */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-black text-sm text-gray-900 mb-2">Description</h4>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed font-medium">
                  {selectedReport.description || selectedReport.short_message || 'No additional narrative description provided for this emergency entry.'}
                </div>
              </div>

              {/* MEDIA ATTACHMENTS (IMAGE/VIDEO) PLACEHOLDER */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-black text-sm text-gray-900 mb-2">Incident Media Attachments</h4>
                {selectedReport.media_url || selectedReport.image || selectedReport.file ? (
                  <div className="rounded-xl overflow-hidden border border-gray-200 max-h-64 bg-black flex items-center justify-center">
                    <img 
                      src={selectedReport.media_url || selectedReport.image || selectedReport.file} 
                      alt="Incident Evidence" 
                      className="max-h-64 object-contain" 
                    />
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

function StatusButton({ label, currentStatus, onClick }) {
  const isActive = currentStatus?.toLowerCase() === label?.toLowerCase();
  let colorClass = "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 cursor-pointer";
  
  if (isActive) {
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-sm";
    if (label === "Responding") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-md";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-md";
    if (label === "Invalid") colorClass = "bg-red-100 border-red-400 text-red-700 cursor-default shadow-sm";
  }

  return (
    <button 
      onClick={isActive ? null : onClick} 
      className={`${colorClass} px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-tight border transition-all ${!isActive ? 'active:scale-95' : ''}`}
    >
      {label}
    </button>
  );
}