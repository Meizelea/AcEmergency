import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, Map as MapIcon, BarChart3, Users, Smartphone, Menu, UserCircle, TrendingUp, AlertTriangle, MapPin, Activity } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AnalyticsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [stats, setStats] = useState({ total: 0, mostFrequent: '-', topLocation: '-', activeCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // ==========================================
  // FETCH & CALCULATE DATA
  // ==========================================
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // 1. Fetch pre-calculated charts from your backend
        const analyticsRes = await fetch('http://localhost:3000/api/analytics');
        const analyticsData = await analyticsRes.json();
        
        // 2. Fetch all reports to calculate live stats & trends
        const reportsRes = await fetch('http://localhost:3000/api/reports');
        const reportsData = await reportsRes.json();

        setBarData(analyticsData.barChart);
        setPieData(analyticsData.pieChart);

        // 3. Calculate Top-Level Stats
        const total = reportsData.length;
        const activeCount = reportsData.filter(r => r.status !== 'Resolved').length;
        
        // Find Most Frequent Emergency Type (Safe fallback if empty)
        const topType = analyticsData.pieChart.length > 0 
          ? analyticsData.pieChart.reduce((prev, current) => (prev.value > current.value) ? prev : current).name 
          : 'None';

        // Find Most Affected Location
        const topLoc = analyticsData.barChart.length > 0
          ? analyticsData.barChart.reduce((prev, current) => (prev.v > current.v) ? prev : current).d
          : 'None';

        setStats({ total, mostFrequent: topType, topLocation: topLoc, activeCount });

        // 4. Calculate Trend Data (Group reports by Date)
        const groupedByDate = reportsData.reduce((acc, report) => {
          acc[report.date] = (acc[report.date] || 0) + 1;
          return acc;
        }, {});

        // Convert object to array and sort by date for the Line Chart
        const trendArray = Object.keys(groupedByDate).map(date => ({
          date: date,
          Incidents: groupedByDate[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date));

        setTrendData(trendArray);
        setIsLoading(false);

      } catch (error) {
        console.error("Failed to fetch analytics:", error);
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

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

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">

        <div className="flex-1 bg-[#f5f7f9] flex flex-col rounded-t-md overflow-hidden mx-2 mb-2 shadow-2xl">
          
          {/* RED HEADER */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Dashboard</span>
                <span onClick={() => navigate('/reports')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Reports</span>
                <span onClick={() => navigate('/analytics')} className="bg-[#8b2323] px-5 py-1.5 rounded-md text-sm font-bold shadow-inner cursor-pointer">Analytics</span>
                <span onClick={() => navigate('/users')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Users</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          {/* PAGE CONTENT */}
          <div className="p-8 flex-1 overflow-y-auto">
            
            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              <StatCard icon={<Activity size={24} className="text-blue-500" />} title="Total Lifetime Reports" value={isLoading ? '...' : stats.total} />
              <StatCard icon={<AlertTriangle size={24} className="text-yellow-500" />} title="Most Frequent Issue" value={isLoading ? '...' : stats.mostFrequent} />
              <StatCard icon={<MapPin size={24} className="text-red-500" />} title="Most Affected Area" value={isLoading ? '...' : `Brgy. ${stats.topLocation}`} />
              <StatCard icon={<TrendingUp size={24} className="text-green-500" />} title="Currently Active" value={isLoading ? '...' : stats.activeCount} />
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* WIDE TREND LINE CHART */}
              <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-6">Incident Volume Over Time</h3>
                <div className="h-72 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="date" tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} dx={-10} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="Incidents" stroke="#b32d2d" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* BAR CHART */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-6">Incidents by Barangay</h3>
                <div className="h-64 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                        <XAxis type="number" tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="d" tick={{fontSize: 12, fill: '#333', fontWeight: 'bold'}} axisLine={false} tickLine={false} width={80} />
                        <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="v" name="Reports" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* PIE CHART */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-6">Emergency Breakdown</h3>
                <div className="h-64 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>
          </div>
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

function StatCard({ icon, title, value }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
      <div className="bg-gray-50 p-4 rounded-full">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">{title}</p>
        <h4 className="text-2xl font-black text-gray-800 tracking-tight mt-1 truncate">{value}</h4>
      </div>
    </div>
  );
}