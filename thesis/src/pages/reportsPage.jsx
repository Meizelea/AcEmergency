import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Smartphone, Menu, UserCircle, Calendar, AlertCircle, ChevronDown, Truck, MapPin } from 'lucide-react';

export default function ReportsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterDate, setFilterDate] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterLocation, setFilterLocation] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Master List of actual operational Thesis Boundary layers
  const availableBarangays = [
    "Balibago", "Cutcut", "Pampang", "Malabanias", 
    "Amsic", "Cutud", "Margot", "Sapangbato", 
    "San Nicolas", "Sta. Trinidad", "Lourdes NorthWest", "Claro M. Recto"
  ];

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/reports');
        const data = await response.json();
        setReports(Array.isArray(data) ? data : []);
        setIsLoading(false);
      } catch (error) { 
        console.error("Failed to fetch reports log:", error);
        setIsLoading(false); 
      }
    };
    fetchReports();
  }, []);

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:8000/api/reports/${reportId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setReports(reports.map(report => report.id === reportId ? { ...report, status: newStatus } : report));
      }
    } catch (error) { 
      console.error("Failed to update status:", error); 
    }
  };

  // NEW: Handler logic to patch changed barangay directly into SQLite
  const handleLocationUpdate = async (reportId, newBarangay) => {
    try {
      const response = await fetch(`http://localhost:8000/api/reports/${reportId}/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barangay: newBarangay })
      });
      if (response.ok) {
        setReports(reports.map(report => report.id === reportId ? { ...report, barangay: newBarangay } : report));
        console.log(`Report #${reportId} reassigned to Brgy. ${newBarangay}`);
      }
    } catch (error) {
      console.error("Failed to update report barangay:", error);
    }
  };

  const uniqueDates = [...new Set(reports.map(r => formatDate(r.created_at)))].filter(Boolean);
  const uniqueTypes = [...new Set(reports.map(r => r.description || 'Emergency Dispatch'))].filter(Boolean);
  const uniqueLocations = [...new Set(reports.map(r => r.barangay || r.location))].filter(Boolean);
  const uniqueStatuses = ['Pending', 'Responding', 'Resolved'];

  const filteredReports = reports.filter(report => {
    const reportDate = formatDate(report.created_at);
    const reportType = report.description || 'Emergency Dispatch';
    const reportLocation = report.barangay || report.location;
    const currentStatus = report.status === 'submitted' ? 'Pending' : report.status;

    return (filterDate === 'All' || reportDate === filterDate) &&
           (filterType === 'All' || reportType === filterType) &&
           (filterLocation === 'All' || reportLocation === filterLocation) &&
           (filterStatus === 'All' || currentStatus?.toLowerCase() === filterStatus?.toLowerCase());
  });

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">
      
      {/* SIDEBAR */}
      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} /></div>
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={location.pathname === '/reports'} /></div>
          <div onClick={() => navigate('/analytics')}><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={location.pathname === '/analytics'} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={location.pathname === '/users'} /></div>
          <div onClick={() => navigate('/emergency-units')}><SidebarLink icon={<Truck size={24} />} label="Emergency Units" active={location.pathname === '/emergency-units'} /></div>
          
          <div className="mt-8 border-t border-white/10 pt-4">
            <div onClick={() => navigate('/mock-entry')}><SidebarLink icon={<Smartphone size={24} />} label="App Simulator" active={location.pathname === '/mock-entry'} /></div>
          </div>
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
                <span onClick={() => navigate('/emergency-units')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/emergency-units' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Emergency Units</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap gap-4">
                <FilterDropdown icon={<Calendar size={18} />} defaultLabel="All Dates" options={uniqueDates} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} width="w-56" />
                <FilterDropdown defaultLabel="All Types" options={uniqueTypes} value={filterType} onChange={(e) => setFilterType(e.target.value)} width="w-48" />
                <FilterDropdown defaultLabel="All Locations" options={uniqueLocations} value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} width="w-48" />
                <FilterDropdown defaultLabel="All Statuses" options={uniqueStatuses} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} width="w-40" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-3"><div className="bg-black text-white rounded-full p-1"><AlertCircle size={18} /></div><h2 className="font-bold text-xl text-gray-900">Master Reports Log</h2></div>
                <span className="text-sm text-gray-400 font-medium">{filteredReports.length} Results</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-sm">
                      <th className="py-4 px-6 font-bold w-20">ID</th>
                      <th className="py-4 px-6 font-bold">Details / Type</th>
                      <th className="py-4 px-6 font-bold w-48">Telemetry (GPS)</th>
                      <th className="py-4 px-6 font-bold w-56">Assigned Barangay</th>
                      <th className="py-4 px-6 font-bold w-28">Date</th>
                      <th className="py-4 px-6 font-bold w-72">Action / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="6" className="py-8 text-center text-gray-400">Loading...</td></tr>
                    ) : filteredReports.length === 0 ? (
                      <tr><td colSpan="6" className="py-8 text-center text-gray-400 font-medium">No matching report items found.</td></tr>
                    ) : (
                      filteredReports.map((row) => {
                        const rowStatus = row.status === 'submitted' ? 'Pending' : row.status;
                        const currentBarangay = row.barangay || row.location || 'Unknown';
                        
                        return (
                          <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                            <td className="py-5 px-6 text-sm font-bold text-gray-500">#{row.id}</td>
                            <td className="py-5 px-6 text-sm font-bold text-gray-800 max-w-xs truncate" title={row.description}>
                              {row.description || 'Emergency Dispatch'}
                            </td>
                            {/* GPS Telemetry Reference Column */}
                            <td className="py-5 px-6 text-xs text-gray-500 font-mono">
                              <div className="flex items-center gap-1">
                                <MapPin size={12} className="text-red-500 shrink-0" />
                                <span>{row.latitude?.toFixed(4)}, {row.longitude?.toFixed(4)}</span>
                              </div>
                            </td>
                            {/* NEW: Inline Editable Dropdown Selector */}
                            <td className="py-5 px-6 text-sm font-medium">
                              <div className="relative border border-gray-300 rounded-md bg-white hover:bg-gray-50 shadow-inner px-2 py-1 w-full flex items-center justify-between">
                                <select 
                                  value={currentBarangay} 
                                  onChange={(e) => handleLocationUpdate(row.id, e.target.value)}
                                  className="w-full bg-transparent outline-none appearance-none cursor-pointer pr-6 text-xs font-bold text-gray-700"
                                >
                                  <option value="Unknown" disabled>Select Location</option>
                                  {availableBarangays.map((b, idx) => (
                                    <option key={idx} value={b}>{b}</option>
                                  ))}
                                </select>
                                <ChevronDown size={12} className="text-gray-400 absolute right-2 pointer-events-none" />
                              </div>
                            </td>
                            <td className="py-5 px-6 text-sm font-medium text-gray-500">{formatDate(row.created_at)}</td>
                            <td className="py-4 px-6">
                              <div className="flex gap-1.5">
                                <StatusButton label="Pending" currentStatus={rowStatus} onClick={() => handleStatusUpdate(row.id, 'Pending')} />
                                <StatusButton label="Responding" currentStatus={rowStatus} onClick={() => handleStatusUpdate(row.id, 'Responding')} />
                                <StatusButton label="Resolved" currentStatus={rowStatus} onClick={() => handleStatusUpdate(row.id, 'Resolved')} />
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

function FilterDropdown({ icon, defaultLabel, options, value, onChange, width }) {
  return (
    <div className={`relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm ${width}`}>
      {icon && <span className="pl-4 text-gray-500">{icon}</span>}
      <select value={value} onChange={onChange} className={`w-full bg-transparent border-none outline-none appearance-none py-2.5 ${icon ? 'pl-2 pr-10' : 'px-4 pr-10'} text-sm font-bold text-gray-600 cursor-pointer focus:ring-0`}><option value="All">{defaultLabel}</option>{options.map((opt, i) => (<option key={i} value={opt}>{opt}</option>))}</select>
      <ChevronDown size={16} className="text-gray-400 absolute right-4 pointer-events-none" />
    </div>
  );
}

function StatusButton({ label, currentStatus, onClick }) {
  const isActive = currentStatus?.toLowerCase() === label?.toLowerCase();
  let colorClass = "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 cursor-pointer";
  if (isActive) {
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-sm";
    if (label === "Responding") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-md";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-md";
  }
  return (<button onClick={isActive ? null : onClick} className={`${colorClass} px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight border transition-all ${!isActive && 'active:scale-95'}`}>{label}</button>);
}