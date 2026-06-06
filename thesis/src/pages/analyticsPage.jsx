import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Smartphone, Menu, UserCircle, TrendingUp, AlertTriangle, MapPin, Activity, Download, Clock, Layers, Truck } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

export default function AnalyticsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);      // State for Peak Hours
  const [stackedData, setStackedData] = useState([]);    // State for Stacked Barangay Distribution
  const [stats, setStats] = useState({ total: 0, mostFrequent: '-', topLocation: '-', activeCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // 🛡️ SECURITY GUARDRAIL 1: Check authentication state instantly during initialization
  const token = localStorage.getItem('ac_token');

  // Helper to format timestamps to readable dates
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  };

  useEffect(() => {
    // 🛡️ SECURITY GUARDRAIL 2: Redirect unauthenticated users immediately
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const headersConfiguration = {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}` // Passes the session token cleanly to Django
        };

        // 👇 FIXED: Explicit endpoint targets routing to the corrected nested backend sub-paths
        const analyticsRes = await fetch('http://127.0.0.1:8000/api/analytics/dashboard/', { headers: headersConfiguration });
        const analyticsData = await analyticsRes.json();
        
        const reportsRes = await fetch('http://127.0.0.1:8000/api/reports/admin-reports/', { headers: headersConfiguration });
        const reportsData = await reportsRes.json();
        
        // Safe check for paginated array outputs (.results) or straight standard arrays
        const reportsArray = Array.isArray(reportsData) 
          ? reportsData 
          : (reportsData && Array.isArray(reportsData.results)) 
            ? reportsData.results 
            : [];

        // 1. Process standard Barangay Bar Chart
        let processedBars = [];
        let maxLocationName = 'None';
        if (analyticsData.reports_by_barangay) {
          processedBars = Object.keys(analyticsData.reports_by_barangay).map(key => ({
            d: key,
            v: analyticsData.reports_by_barangay[key]
          }));
          if (processedBars.length > 0) {
            maxLocationName = processedBars.reduce((prev, current) => (prev.v > current.v) ? prev : current).d;
          }
        }
        setBarData(processedBars);

        // 2. Process Status / Issues Pie Chart
        let processedPie = [];
        let maxIssueName = 'None';
        if (analyticsData.basic_stats) {
          processedPie = [
            { name: 'Submitted', value: analyticsData.basic_stats.submitted, color: '#3b82f6' },
            { name: 'Pending', value: analyticsData.basic_stats.pending, color: '#ffc20e' },
            { name: 'Resolved', value: analyticsData.basic_stats.resolved, color: '#10b981' }
          ].filter(item => item.value > 0);

          if (reportsArray.length > 0) {
            const descriptionCounts = {};
            reportsArray.forEach(r => {
              const type = r.description || 'General Emergency';
              descriptionCounts[type] = (descriptionCounts[type] || 0) + 1;
            });
            maxIssueName = Object.keys(descriptionCounts).reduce((a, b) => descriptionCounts[a] > descriptionCounts[b] ? a : b, 'General Emergency');
          }
        }
        setPieData(processedPie.length ? processedPie : [{ name: 'No Data', value: 1, color: '#939598' }]);

        // 3. Compute KPI blocks with safe checks
        const total = reportsArray.length;
        const activeCount = reportsArray.filter(r => r && r.status?.toLowerCase() !== 'resolved').length;
        setStats({ total, mostFrequent: maxIssueName, topLocation: maxLocationName, activeCount });

        // 4. Calculate Time-Series Trend Volumes
        const groupedByDate = reportsArray.reduce((acc, report) => {
          if (report && report.created_at) {
            const readableDate = formatDate(report.created_at);
            acc[readableDate] = (acc[readableDate] || 0) + 1;
          }
          return acc;
        }, {});

        const trendArray = Object.keys(groupedByDate).map(date => ({
          date: date,
          Incidents: groupedByDate[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
        setTrendData(trendArray);

        // 5. Process Peak Active Hours Matrix Array
        if (analyticsData.reports_by_hour) {
          const hoursMap = Object.keys(analyticsData.reports_by_hour).map(hour => {
            const labelInt = parseInt(hour);
            const ampm = labelInt >= 12 ? 'PM' : 'AM';
            const displayHour = labelInt % 12 === 0 ? 12 : labelInt % 12;
            return {
              hourLabel: `${displayHour} ${ampm}`,
              Incidents: analyticsData.reports_by_hour[hour]
            };
          });
          setHourlyData(hoursMap);
        }

        // 6. Process Cross-Tabulated Stacked Category Distribution per Barangay
        if (analyticsData.reports_by_barangay_with_details) {
          const stackedArray = Object.keys(analyticsData.reports_by_barangay_with_details).map(brgy => {
            const logs = analyticsData.reports_by_barangay_with_details[brgy] || [];
            
            let fireCount = 0;
            let medicalCount = 0;
            let lawCount = 0;

            logs.forEach(incident => {
              const text = (incident.description || '').toLowerCase();
              if (text.includes('fire') || text.includes('smoke') || text.includes('sunog') || text.includes('structural')) {
                fireCount++;
              } else if (text.includes('accident') || text.includes('injury') || text.includes('sakit') || text.includes('medical')) {
                medicalCount++;
              } else {
                lawCount++;
              }
            });

            return {
              barangayName: brgy,
              "Fire Engine Req.": fireCount,
              "Ambulance Req.": medicalCount,
              "Police Cruiser Req.": lawCount
            };
          }).filter(item => (item["Fire Engine Req."] + item["Ambulance Req."] + item["Police Cruiser Req."]) > 0);
          
          setStackedData(stackedArray);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Failed to compile analytics metrics:", error);
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [token, navigate]);

  // 🛡️ SECURITY GUARDRAIL 3: Prevent rendering anything if the user is unauthenticated
  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting to analytics portal...</div>;
  }

  // PRINT OVERRIDE TRIGGER
  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">
      
      {/* NATIVE PRINT SYSTEM CSS OVERRIDES */}
      <style>{`
        @media print {
          aside, header, button, .w-\[1px\] {
            display: none !important;
          }
          body, .h-screen, .overflow-hidden, #analytics-report-content {
            background-color: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .grid {
            display: grid !important;
            gap: 16px !important;
          }
          .bg-white {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* UNIVERSAL SIDEBAR */}
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

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#f5f7f9] flex flex-col rounded-t-md overflow-hidden mx-2 mb-2 shadow-2xl">
          
          {/* UNIVERSAL RED HEADER */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Dashboard</span>
                <span onClick={() => navigate('/reports')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Reports</span>
                <span onClick={() => navigate('/analytics')} className="bg-[#8b2323] px-5 py-1.5 rounded-md text-sm font-bold shadow-inner cursor-pointer">Analytics</span>
                <span onClick={() => navigate('/users')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Users</span>
                <span onClick={() => navigate('/emergency-units')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Emergency Units</span>
              </div>
            </div>
            
            {/* EXPORT ACTION LOGIC */}
            <div className="flex items-center gap-4 pr-4">
              <button 
                onClick={handleDownloadPDF} 
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-2 active:scale-95 shadow-sm"
              >
                <Download size={14} /> Export Report PDF
              </button>
              <div className="w-[1px] h-5 bg-white/20" />
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          {/* PAGE CONTENT TARGET WRAPPER */}
          <div id="analytics-report-content" className="p-8 flex-1 overflow-y-auto bg-[#f5f7f9]">
            
            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-4 gap-6 mb-8">
              <StatCard icon={<Activity size={24} className="text-blue-500" />} title="Total Lifetime Reports" value={isLoading ? '...' : stats.total} />
              <StatCard icon={<AlertTriangle size={24} className="text-yellow-500" />} title="Most Frequent Issue" value={isLoading ? '...' : stats.mostFrequent} />
              <StatCard icon={<MapPin size={24} className="text-red-500" />} title="Most Affected Area" value={isLoading ? '...' : stats.topLocation === 'None' ? 'None' : `Brgy. ${stats.topLocation}`} />
              <StatCard icon={<TrendingUp size={24} className="text-green-500" />} title="Currently Active" value={isLoading ? '...' : stats.activeCount} />
            </div>

            {/* MAIN VISUALS GRID SPLIT */}
            <div className="grid grid-cols-2 gap-6">
              
              {/* GRAPH 1: WIDE TREND LINE CHART */}
              <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-6">Incident Volume Over Time</h3>
                <div className="h-72 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : trendData.length === 0 ? <div className="h-full flex items-center justify-center text-gray-300 font-bold">No history available</div> : (
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

              {/* GRAPH 2: PEAK ACTIVE HOURS (Area Chart Distribution) */}
              <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Clock size={20} className="text-[#b32d2d]" />
                  <h3 className="font-bold text-lg text-gray-800">Peak Emergency Hours (Temporal Distribution)</h3>
                </div>
                <div className="h-72 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyData} margin={{ left: -10, right: 10 }}>
                        <defs>
                          <linearGradient id="hourColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="hourLabel" tick={{fontSize: 11, fill: '#555'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey="Incidents" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#hourColor)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* GRAPH 3: STACKED INCIDENT BREAKDOWN PER NEIGHBORHOOD */}
              <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Layers size={20} className="text-[#3b82f6]" />
                  <h3 className="font-bold text-lg text-gray-800">Incident Classification Breakdown by Barangay</h3>
                </div>
                <div className="h-80 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : stackedData.length === 0 ? <div className="h-full flex items-center justify-center text-gray-300 font-bold">No localized historical cross-tab data available</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stackedData} margin={{ bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="barangayName" tick={{fontSize: 11, fill: '#333', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar dataKey="Fire Engine Req." stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Ambulance Req." stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Police Cruiser Req." stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* GRAPH 4: TRADITIONAL TOTAL INCIDENTS BY BARANGAY */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-lg text-gray-800 mb-6">Incidents by Barangay</h3>
                <div className="h-64 w-full">
                  {isLoading ? <div className="h-full flex items-center justify-center text-gray-400">Loading data...</div> : barData.length === 0 ? <div className="h-full flex items-center justify-center text-gray-300 font-bold">No localized metrics available</div> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                        <XAxis type="number" tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="d" tick={{fontSize: 11, fill: '#333', fontWeight: 'bold'}} axisLine={false} tickLine={false} width={90} />
                        <Tooltip cursor={{fill: '#f5f5f5'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="v" name="Reports" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* GRAPH 5: PIE BREAKDOWN */}
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
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 min-w-0">
      <div className="bg-gray-50 p-3 rounded-full shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide truncate">{title}</p>
        <h4 className="text-xl font-black text-gray-800 tracking-tight mt-0.5 truncate" title={value}>{value}</h4>
      </div>
    </div>
  );
}