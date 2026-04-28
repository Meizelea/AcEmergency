import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, Map as MapIcon, BarChart3, Users, Smartphone, Menu, UserCircle, Calendar, AlertCircle, ChevronDown } from 'lucide-react';

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

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/reports');
        const data = await response.json();
        setReports(data);
        setIsLoading(false);
      } catch (error) { setIsLoading(false); }
    };
    fetchReports();
  }, []);

  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      const response = await fetch(`http://localhost:3000/api/reports/${reportId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        setReports(reports.map(report => report.id === reportId ? { ...report, status: newStatus } : report));
      }
    } catch (error) { console.error("Failed to update status:", error); }
  };

  const uniqueDates = [...new Set(reports.map(r => r.date))];
  const uniqueTypes = [...new Set(reports.map(r => r.type))];
  const uniqueLocations = [...new Set(reports.map(r => r.location))];
  const uniqueStatuses = ['Pending', 'Responding', 'Resolved'];

  const filteredReports = reports.filter(report => {
    return (filterDate === 'All' || report.date === filterDate) &&
           (filterType === 'All' || report.type === filterType) &&
           (filterLocation === 'All' || report.location === filterLocation) &&
           (filterStatus === 'All' || report.status === filterStatus);
  });

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">
      
      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} /></div>
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={location.pathname === '/reports'} /></div>
          <div onClick={() => navigate('/analytics')}><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={location.pathname === '/analytics'} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={location.pathname === '/users'} /></div>
          
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
                      <th className="py-4 px-8 font-bold w-24">ID</th>
                      <th className="py-4 px-8 font-bold">Reporter</th>
                      <th className="py-4 px-8 font-bold">Type</th>
                      <th className="py-4 px-8 font-bold">Location</th>
                      <th className="py-4 px-8 font-bold">Date</th>
                      <th className="py-4 px-8 font-bold w-72">Action / Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? <tr><td colSpan="6" className="py-8 text-center text-gray-400">Loading...</td></tr> : filteredReports.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-5 px-8 text-sm font-bold text-gray-500">#{row.id}</td>
                        <td className="py-5 px-8"><div className="flex items-center gap-2"><UserCircle size={16} className="text-gray-400" /><span className="text-sm font-bold text-gray-700">{row.reporter || 'System Admin'}</span></div></td>
                        <td className="py-5 px-8 text-sm font-bold text-gray-800">{row.type}</td>
                        <td className="py-5 px-8 text-sm font-medium text-gray-600">Brgy. {row.location}</td>
                        <td className="py-5 px-8 text-sm font-medium text-gray-500">{row.date}</td>
                        <td className="py-4 px-8"><div className="flex gap-2"><StatusButton label="Pending" currentStatus={row.status} onClick={() => handleStatusUpdate(row.id, 'Pending')} /><StatusButton label="Responding" currentStatus={row.status} onClick={() => handleStatusUpdate(row.id, 'Responding')} /><StatusButton label="Resolved" currentStatus={row.status} onClick={() => handleStatusUpdate(row.id, 'Resolved')} /></div></td>
                      </tr>
                    ))}
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
  const isActive = currentStatus === label;
  let colorClass = "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 cursor-pointer";
  if (isActive) {
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-sm";
    if (label === "Responding") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-md";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-md";
  }
  return (<button onClick={isActive ? null : onClick} className={`${colorClass} px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-tight border transition-all ${!isActive && 'active:scale-95'}`}>{label}</button>);
}