import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Menu, UserCircle, Search, Filter, Calendar, AlertCircle, Truck } from 'lucide-react';

export default function ReportsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // 🛡️ SECURITY GUARDRAIL: Pull verification token from local storage
  const token = localStorage.getItem('ac_token');

  const fetchReports = async () => {
    // 🛡️ Stop execution if token is missing
    if (!token) return;

    try {
      const response = await fetch('http://127.0.0.1:8000/api/reports/admin-reports/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        }
      });
      const data = await response.json();
      
      // Unpack raw lists or paginated DRF objects safely
      if (Array.isArray(data)) {
        setReports(data);
      } else if (data && Array.isArray(data.results)) {
        setReports(data.results);
      } else {
        setReports([]);
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to query records database from Django:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 🛡️ SECURITY GUARDRAIL: Redirect unauthenticated direct traffic out immediately
    if (!token) {
      navigate('/login');
      return;
    }
    fetchReports();
  }, [token, navigate]);

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      // 🎯 DEFINITIVE FIX: Converts frontend labels into your partner's strict lowercase models.py TextChoices keys
      const statusDatabaseMap = {
        'Pending': 'pending',       
        'Responding': 'ongoing',   // ⚡ Maps frontend action directly to backend 'ongoing' code string
        'Resolved': 'resolved'      
      };

      const finalPayloadValue = statusDatabaseMap[newStatus] || 'submitted';

      const response = await fetch(`http://127.0.0.1:8000/api/reports/admin-reports/${reportId}/`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ status: finalPayloadValue })
      });

      if (response.ok) {
        // UI layer successfully updates local state right away
        setReports(prevReports => prevReports.map(report => 
            report.id === reportId ? { ...report, status: finalPayloadValue } : report
        ));
      } else {
        const errorDetails = await response.json();
        console.error("Django Model Serializer Validation Rejection Log:", errorDetails);
      }
    } catch (error) {
      console.error("Failed to execute data modification:", error);
    }
  };

  // 🛡️ SECURITY GUARDRAIL: Do not render layout canvas if token parameters are missing
  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting to incident log directory...</div>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Filter processing chain
  const filteredReports = reports.filter(report => {
    if (!report) return false;

    const matchedSearch = 
      (report.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.barangay || report.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(report.id).includes(searchQuery);

    const currentStatusNormalized = String(report.status).toLowerCase();
    
    let matchedStatus = true;
    if (statusFilter === 'Pending') {
      matchedStatus = (currentStatusNormalized === 'pending' || currentStatusNormalized === 'submitted');
    } else if (statusFilter === 'Responding') {
      matchedStatus = (currentStatusNormalized === 'ongoing');
    } else if (statusFilter === 'Resolved') {
      matchedStatus = (currentStatusNormalized === 'resolved');
    }

    return matchedSearch && matchedStatus;
  });

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">

      {/* UNIVERSAL SIDEBAR */}
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
        <div className="flex-1 bg-[#f0f0f0] flex flex-col rounded-t-md overflow-hidden mx-2 mb-2 shadow-2xl">
          
          {/* UNIVERSAL RED HEADER */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/dashboard' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Dashboard</span>
                <span onClick={() => navigate('/reports')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/reports' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Reports</span>
                <span onClick={() => navigate('/analytics')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/analytics' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Analytics</span>
                <span onClick={() => navigate('/users')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/users' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Users</span>
                <span onClick={() => navigate('/emergency-units')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Emergency Units</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          {/* UTILITY CONTROL BAR */}
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
                  <Search size={18} className="text-gray-400 ml-4" />
                  <input type="text" placeholder="Search Incident ID, type or barangay..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none" />
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

            {/* EXPANDED MASTER TABLE LAYOUT */}
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
                      <th className="py-4 px-6">Location Workspace</th>
                      <th className="py-4 px-6">Timestamp Created</th>
                      <th className="py-4 px-6 text-center w-80">Command Action Workflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-bold">Querying core emergency database rows...</td></tr>
                    ) : filteredReports.length === 0 ? (
                      <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-medium">No system incident logs match your current filter parameters.</td></tr>
                    ) : (
                      filteredReports.map((report) => {
                        const currentStatusRaw = String(report.status).toLowerCase();
                        
                        // Bridge normalized states to match uppercase interface button definitions
                        const displayLabel = currentStatusRaw === 'ongoing' ? 'Responding' : (currentStatusRaw === 'submitted' || currentStatusRaw === 'pending') ? 'Pending' : 'Resolved';
                        
                        return (
                          <tr key={report.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                            <td className="py-5 px-6 font-black text-gray-400 text-sm">#{report.id}</td>
                            <td className="py-5 px-6">
                              <div className="font-bold text-gray-800 text-[15px]">{report.description || 'Emergency Dispatch'}</div>
                              <div className="text-xs text-gray-400 mt-0.5 font-medium">Citizen Reporter ID Key: {report.user || '2'}</div>
                            </td>
                            <td className="py-5 px-6 text-sm font-semibold text-gray-600">
                              <div>Brgy. {report.barangay || report.location || 'Angeles City'}</div>
                              {report.street && <div className="text-[11px] text-gray-400 font-medium mt-0.5">St: {report.street}</div>}
                            </td>
                            <td className="py-5 px-6 text-xs font-bold text-gray-400">
                              <div className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(report.created_at)}</div>
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
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (<div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}><span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span><span className="text-[16px] tracking-tight">{label}</span></div>);
}

function StatusButton({ label, currentStatus, onClick }) {
  const isActive = currentStatus?.toLowerCase() === label?.toLowerCase();
  let colorClass = "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 cursor-pointer";
  
  if (isActive) {
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-sm";
    if (label === "Responding") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-md";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-md";
  }

  return (<button onClick={isActive ? null : onClick} className={`${colorClass} px-4 py-1.5 rounded text-[11px] font-black uppercase tracking-tight border transition-all ${!isActive && 'active:scale-95'}`}>{label}</button>);
}