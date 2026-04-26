import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, Map as MapIcon, BarChart3, Users, Menu, UserCircle } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, PieChart, Pie, Cell, XAxis, YAxis } from 'recharts';

export default function DashboardPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [reports, setReports] = useState([]);
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // FETCH DATA ON LOAD
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const analyticsRes = await fetch('http://localhost:3000/api/analytics');
        const analyticsData = await analyticsRes.json();
        
        const reportsRes = await fetch('http://localhost:3000/api/reports/recent');
        const reportsData = await reportsRes.json();

        setBarData(analyticsData.barChart);
        setPieData(analyticsData.pieChart);
        setReports(reportsData); 
        
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // ==========================================
  // UPDATE STATUS FUNCTION
  // ==========================================
  const handleStatusUpdate = async (reportId, newStatus) => {
    try {
      // 1. Send the update to the MySQL Database
      const response = await fetch(`http://localhost:3000/api/reports/${reportId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // 2. Update the React UI instantly so it feels snappy
        setReports(prevReports => 
          prevReports.map(report => 
            report.id === reportId ? { ...report, status: newStatus } : report
          )
        );
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a]">
      
      {/* SIDEBAR */}
      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={true} /></div>
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={false} /></div>
          <div><SidebarLink icon={<MapIcon size={24} />} label="Heatmap" active={false} /></div>
          <div><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={false} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={false} /></div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="flex-1 bg-gray-200 flex flex-col rounded-t-xl overflow-hidden mx-2 mb-2 shadow-2xl relative">
          
          {/* RED HEADER */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className="bg-[#8b2323] px-5 py-1.5 rounded-md text-sm font-bold shadow-inner cursor-pointer">Dashboard</span>
                <span onClick={() => navigate('/reports')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Reports</span>
                <span className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Analytics</span>
                <span onClick={() => navigate('/users')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Users</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          {/* DASHBOARD GRID */}
          <main className="flex-1 grid grid-cols-12 overflow-hidden bg-gray-200 gap-[1px]">
            
            {/* MAP */}
            <section className="col-span-8 bg-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[#f8f8f8] flex items-center justify-center">
                <span className="text-gray-300 italic font-bold text-lg">Angeles City Map Placeholder</span>
              </div>
            </section>

            {/* CHARTS */}
            <section className="col-span-4 bg-white p-6 flex flex-col overflow-y-auto">
              <h3 className="font-bold text-gray-800 text-lg mb-4">Reports Overview</h3>
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 font-bold">Loading charts...</div>
              ) : (
                <>
                  <div className="h-[180px] w-full border-b border-gray-50 pb-6">
                    <ResponsiveContainer>
                      <BarChart data={barData} margin={{left: -25}}>
                        <XAxis dataKey="d" tick={{fontSize: 10, fill: '#999'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 10, fill: '#999'}} axisLine={false} tickLine={false} />
                        <Bar dataKey="v" fill="#bae6fd" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 flex items-center justify-center py-6">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="text-[10px] font-bold space-y-1.5 ml-4 shrink-0">
                      {pieData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}}></div>
                          <span className="text-gray-500 truncate w-24">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* REPORTS LIST (Now Interactive) */}
            <section className="col-span-8 bg-[#fafafa] p-8 overflow-y-auto">
              <h2 className="font-black text-2xl text-gray-800 tracking-tight uppercase border-b border-gray-200 pb-4 mb-6">Active Reports</h2>
              <div className="space-y-1">
                {isLoading ? (
                  <p className="text-gray-400 font-bold py-4">Loading active reports...</p>
                ) : reports.length === 0 ? (
                  <p className="text-gray-400 py-4">No recent reports found.</p>
                ) : (
                  reports.map((report) => (
                    <ReportItem 
                      key={report.id} 
                      id={report.id}
                      title={report.type} 
                      subtitle={`Brgy. ${report.location} - ${report.date}`} 
                      status={report.status} 
                      onStatusChange={handleStatusUpdate} // Pass down the function
                    />
                  ))
                )}
              </div>
            </section>

            {/* REPORT HISTORY */}
            <section className="col-span-4 bg-white p-8 overflow-y-auto">
              <h3 className="font-bold text-lg text-gray-800 mb-8 border-b border-gray-100 pb-4">Report History</h3>
              <div className="space-y-0">
                {isLoading ? (
                  <p className="text-gray-400 font-bold py-4">Loading history...</p>
                ) : reports.length === 0 ? (
                   <p className="text-gray-400 py-4">No history available.</p>
                ) : (
                  reports.map((report) => (
                    <HistoryRow key={report.id} label={report.type} time={report.date} />
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

// ==========================================
// SHARED UI COMPONENTS
// ==========================================
function SidebarLink({ icon, label, active }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}>
      <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
      <span className="text-[16px] tracking-tight">{label}</span>
    </div>
  );
}

// Updated to accept the ID and function
function ReportItem({ id, title, subtitle, status, onStatusChange }) {
  return (
    <div className="border-b border-gray-200 py-6 flex items-center justify-between hover:bg-white/80 px-2 transition-all">
      <div>
        <div className="font-bold text-gray-900 text-lg tracking-tight">{title}</div>
        <div className="text-sm text-gray-400 font-medium">{subtitle}</div>
      </div>
      <div className="flex gap-2">
        <StatusButton 
          label="Pending" 
          currentStatus={status} 
          onClick={() => onStatusChange(id, 'Pending')} 
        />
        <StatusButton 
          label="Responding" 
          currentStatus={status} 
          onClick={() => onStatusChange(id, 'Responding')} 
        />
        <StatusButton 
          label="Resolved" 
          currentStatus={status} 
          onClick={() => onStatusChange(id, 'Resolved')} 
        />
      </div>
    </div>
  );
}

// Updated to visually show which buttons are clickable vs active
function StatusButton({ label, currentStatus, onClick }) {
  const isActive = currentStatus === label;
  
  // Base style for buttons that are NOT currently active (gray, clickable)
  let colorClass = "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 cursor-pointer";
  
  // Styles for the button that IS currently active
  if (isActive) {
    if (label === "Pending") colorClass = "bg-[#fef08a] border-yellow-400 text-yellow-800 cursor-default shadow-sm";
    if (label === "Responding") colorClass = "bg-[#ef4444] border-red-700 text-white cursor-default shadow-md";
    if (label === "Resolved") colorClass = "bg-[#22c55e] border-green-700 text-white cursor-default shadow-md";
  }

  return (
    <button 
      onClick={isActive ? null : onClick} // Prevent clicking if already active
      className={`${colorClass} px-5 py-1.5 rounded-md text-[11px] font-black uppercase tracking-tight border transition-all ${!isActive && 'active:scale-95'}`}
    >
      {label}
    </button>
  );
}

function HistoryRow({ label, time }) {
  return (
    <div className="border-b border-gray-50 py-5 flex justify-between items-center group cursor-pointer hover:bg-gray-50 px-2 rounded-md transition-all">
      <span className="font-bold text-gray-700 group-hover:text-[#b32d2d] transition-colors">{label}</span>
      <span className="text-[10px] font-bold text-gray-300 group-hover:text-gray-400">{time}</span>
    </div>
  );
}