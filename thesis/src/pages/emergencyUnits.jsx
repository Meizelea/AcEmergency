import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Smartphone, Menu, UserCircle, ShieldAlert, Truck, Navigation, AlertCircle } from 'lucide-react';

export default function EmergencyUnitsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [matrixData, setMatrixData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnitsMatrix = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/emergency-units');
        const data = await res.json();
        setMatrixData(Array.isArray(data) ? data : []);
        setIsLoading(false);
      } catch (error) {
        console.error("Error connecting to unit calculator:", error);
        setIsLoading(false);
      }
    };
    fetchUnitsMatrix();
  }, []);

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
          
          <div className="mt-8 border-t border-white/10 pt-4">
            <div onClick={() => navigate('/mock-entry')}><SidebarLink icon={<Smartphone size={24} />} label="App Simulator" active={location.pathname === '/mock-entry'} /></div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#f0f0f0] flex flex-col rounded-t-md overflow-hidden mx-2 mb-2 shadow-2xl">
          
          {/* UNIVERSAL RED HEADER */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Dashboard</span>
                <span onClick={() => navigate('/reports')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Reports</span>
                <span onClick={() => navigate('/analytics')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Analytics</span>
                <span onClick={() => navigate('/users')} className="text-sm px-4 py-1 font-medium cursor-pointer opacity-90 hover:opacity-100 transition-all">Users</span>
                <span onClick={() => navigate('/emergency-units')} className="bg-[#8b2323] px-5 py-1.5 rounded-md text-sm font-bold shadow-inner cursor-pointer">Emergency Units</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Command Dispatch</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          <div className="p-8 flex-1 overflow-y-auto">
            <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="bg-red-600 text-white rounded-full p-1.5"><ShieldAlert size={18} /></div>
                  <h2 className="font-bold text-xl text-gray-900">Tactical Responder Dispatch Matrix</h2>
                </div>
                <span className="text-sm text-gray-400 font-medium">{matrixData.length} Incidents Pending Dispatch</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-sm">
                      <th className="py-4 px-8 font-bold w-24">Incident ID</th>
                      <th className="py-4 px-8 font-bold">Active Emergency Description</th>
                      <th className="py-4 px-8 font-bold">Barangay</th>
                      <th className="py-4 px-8 font-bold">Required Fleet Unit</th>
                      <th className="py-4 px-8 font-bold">Nearest Base Station</th>
                      <th className="py-4 px-8 font-bold text-right">Distance (KM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="6" className="py-8 text-center text-gray-400 font-bold">Running geometric distance matrix metrics...</td></tr>
                    ) : matrixData.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-gray-400">
                          <div className="text-green-600 font-bold text-lg mb-1">Fleet Fully Available</div>
                          <p className="text-sm font-medium">No unresolved reports require dispatch mapping allocation right now.</p>
                        </td>
                      </tr>
                    ) : (
                      matrixData.map((row) => (
                        <tr key={row.report_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-5 px-8 text-sm font-bold text-gray-500">#{row.report_id}</td>
                          <td className="py-5 px-8 text-sm font-bold text-gray-800 max-w-xs truncate">{row.incident_description}</td>
                          <td className="py-5 px-8 text-sm font-medium text-gray-600">Brgy. {row.barangay}</td>
                          <td className="py-5 px-8">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 w-fit ${
                              row.recommended_unit_type === 'Fire Engine' ? 'bg-red-50 text-red-700 border-red-200' :
                              row.recommended_unit_type === 'Ambulance' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              row.recommended_unit_type === 'Rescue Truck' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                            }`}>
                              <Truck size={12} /> {row.recommended_unit_type}
                            </span>
                          </td>
                          <td className="py-5 px-8">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${row.responder_status === 'Available' ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="text-sm font-bold text-gray-700">{row.nearest_responder}</span>
                            </div>
                          </td>
                          <td className="py-5 px-8 text-right font-black text-gray-900 text-sm">
                            {row.distance_km !== null ? (
                              <span className="flex items-center justify-end gap-1 text-red-600">
                                <Navigation size={12} className="rotate-45" /> {row.distance_km} km
                              </span>
                            ) : (
                              <span className="text-gray-400">--</span>
                            )}
                          </td>
                        </tr>
                      ))
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