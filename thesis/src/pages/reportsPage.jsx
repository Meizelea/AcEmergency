import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Filter, MapPin } from 'lucide-react';

import AdminLayout from '../components/header';

// Strict Allowed Barangay options matched to models.py choices
const ALLOWED_BARANGAYS = [
  "Claro M. Recto",
  "San Nicolas",
  "Sta. Trinidad",
  "Lourdes NorthWest"
];

export default function ReportsPage() {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [editingReportId, setEditingReportId] = useState(null);
  const token = localStorage.getItem('ac_token');

  const targetHostname = window.location.hostname || '127.0.0.1';

  const fetchReports = async () => {
    if (!token) return;
    try {
      const results = await Promise.allSettled([
        fetch(`http://${targetHostname}:8000/api/reports/admin-reports/`, { headers: { 'Authorization': `Token ${token}` } })
      ]);

      const getData = async (res) => {
        if (res.status === 'fulfilled' && res.value && res.value.ok) {
          return await res.value.json();
        }
        return [];
      };

      const [adminData, userData] = await Promise.all([getData(results[0]), getData(results[1])]);

      const combined = [...(Array.isArray(adminData) ? adminData : adminData.results || []), 
                        ...(Array.isArray(userData) ? userData : userData.results || [])];
      
      const uniqueReports = Array.from(new Map(combined.map(r => [r.id, r])).values());
      
      setReports(uniqueReports.sort((a, b) => b.id - a.id));
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

  // HANDLER A: Updates Status (Pending / Responding / Resolved)
  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      const statusDatabaseMap = {
        'Pending': 'pending',       
        'Responding': 'ongoing',   
        'Resolved': 'resolved'      
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
        setReports(prevReports => prevReports.map(report => 
            report.id === reportId ? { ...report, status: finalPayloadValue } : report
        ));
      } else {
        console.error("Django Serializer Rejected Status Change.");
      }
    } catch (error) {
      console.error("Failed to execute data status modification:", error);
    }
  };

  // 🔄 HANDLER B: Updates Barangay Selection directly to Django database
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
        setReports(prevReports => prevReports.map(report =>
          report.id === reportId ? { ...report, barangay: selectedBarangay } : report
        ));
        setEditingReportId(null); 
      } else {
        console.error("Django Serializer Rejected Barangay Dropdown Assignment.");
      }
    } catch (error) {
      console.error("Failed to patch updated Barangay selection:", error);
    }
  };

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const filteredReports = reports.filter(report => {
    if (!report) return false;

    const reportTextContent = report.short_message || report.description || '';
    const barangayTextContent = report.barangay || report.location || '';

    const matchedSearch = 
      reportTextContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      barangayTextContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(report.id).includes(searchQuery);

    const currentStatusNormalized = String(report.status).toLowerCase();
    
    let matchedStatus = true;
    if (statusFilter === 'Pending') {
      matchedStatus = (currentStatusNormalized === 'pending' || currentStatusNormalized === 'submitted');
    } else if (statusFilter === 'Responding') {
      matchedStatus = (currentStatusNormalized === 'ongoing' || currentStatusNormalized === 'responding');
    } else if (statusFilter === 'Resolved') {
      matchedStatus = (currentStatusNormalized === 'resolved');
    }

    return matchedSearch && matchedStatus;
  });

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-4" />
              <input 
                type="text" 
                placeholder="Search Incident ID, type or barangay..." 
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
              </select>
            </div>
          </div>
        </div>

        {/* MASTER TABLE LAYOUT */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-xl text-gray-900">Emergency Master Incident Logs</h2>
            </div>
            <span className="text-sm text-gray-400 font-bold">{filteredReports.length} Total Matched Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6 w-20">ID</th>
                  <th className="py-4 px-6">Emergency Details</th>
                  <th className="py-4 px-6 w-64">Location Workspace (Barangay)</th>
                  <th className="py-4 px-6">Timestamp</th>
                  <th className="py-4 px-6 text-center w-80">Command Action Workflow</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-bold">Querying core database rows...</td></tr>
                ) : filteredReports.length === 0 ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-medium">No records matched.</td></tr>
                ) : (
                  filteredReports.map((report) => {
                    const currentStatusRaw = String(report.status).toLowerCase();
                    const displayLabel = currentStatusRaw === 'ongoing' || currentStatusRaw === 'responding' ? 'Responding' : (currentStatusRaw === 'submitted' || currentStatusRaw === 'pending') ? 'Pending' : 'Resolved';
                    
                    let currentBarangayDisplay = report.barangay || report.location || 'Click to set';
                    if (currentBarangayDisplay === 'Lourdes NorthWest') currentBarangayDisplay = 'Lourdes North West';
                    
                    return (
                      <tr key={report.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                        <td className="py-5 px-6 font-black text-gray-400 text-sm">#{report.id}</td>
                        <td className="py-5 px-6">
                          <div className="font-bold text-gray-800 text-[15px]">{report.short_message || report.description || 'Emergency Incident'}</div>
                          <div className="text-xs text-gray-400 mt-0.5 font-medium">Reporter ID: {report.user || '2'}</div>
                        </td>
                        
                        {/* DYNAMIC INTERACTIVE BARANGAY DROPDOWN COLUMN */}
                        <td className="py-5 px-6 text-sm">
                          {editingReportId === report.id ? (
                            <div className="relative bg-white border border-gray-400 rounded px-2 py-1 shadow-inner flex items-center gap-1">
                              <select 
                                defaultValue={report.barangay || ""} 
                                onChange={(e) => handleBarangayUpdate(report.id, e.target.value)}
                                onBlur={() => setEditingReportId(null)}
                                autoFocus
                                className="w-full text-xs font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer py-0.5"
                              >
                                <option value="" disabled>-- Choose Barangay --</option>
                                {ALLOWED_BARANGAYS.map((brgy) => (
                                  <option key={brgy} value={brgy}>
                                    {brgy === 'Lourdes NorthWest' ? 'Lourdes North West' : brgy}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div 
                              onClick={() => setEditingReportId(report.id)} 
                              className="group flex flex-col cursor-pointer hover:bg-gray-200/60 p-1.5 rounded transition-all w-fit"
                              title="Click to edit Barangay field value"
                            >
                              <div className="font-bold text-gray-700 flex items-center gap-1 text-[13px]">
                                <MapPin size={12} className="text-[#b32d2d] shrink-0" />
                                <span>Brgy. {currentBarangayDisplay}</span>
                              </div>
                              {report.street && <div className="text-[11px] text-gray-400 font-medium ml-4 truncate max-w-[180px]">St: {report.street}</div>}
                              <span className="text-[9px] text-[#b32d2d] font-black tracking-wide uppercase opacity-0 group-hover:opacity-100 transition-opacity ml-4 mt-0.5">✏️ Click to Change</span>
                            </div>
                          )}
                        </td>

                        <td className="py-5 px-6 text-xs font-bold text-gray-400">
                          <div>{formatDate(report.created_at)}</div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex gap-1.5 justify-center">
                            <StatusButton label="Pending" currentStatus={displayLabel} onClick={() => handleStatusUpdate(report.id, 'Pending')} />
                            <StatusButton label="Responding" currentStatus={displayLabel} onClick={() => handleStatusUpdate(report.id, 'Responding')} />
                            <StatusButton label="Resolved" currentStatus={displayLabel} onClick={() => handleStatusUpdate(report.id, 'Resolved')} />
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
  }

  return (
    <button 
      onClick={isActive ? null : onClick} 
      className={`${colorClass} px-4 py-1.5 rounded text-[11px] font-black uppercase tracking-tight border transition-all ${!isActive ? 'active:scale-95' : ''}`}
    >
      {label}
    </button>
  );
}