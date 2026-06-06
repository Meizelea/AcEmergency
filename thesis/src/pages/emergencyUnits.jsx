import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Menu, UserCircle, ShieldAlert, Truck, Navigation } from 'lucide-react';

// =========================================================================
// EMERGENCY BASE STATIONS DISPATCH COORD DICTIONARY (Angeles City Coordinates)
// =========================================================================
const emergencyBases = [
  { name: 'Angeles City Fire Station (HQ)', lat: 15.1343, lng: 120.5901, type: 'Fire Engine' },
  { name: 'Balibago Sub-Station', lat: 15.1682, lng: 120.5841, type: 'Ambulance' },
  { name: 'Pampang Rescue Base', lat: 15.1465, lng: 120.5585, type: 'Rescue Truck' },
  { name: 'Marisol Sub-Station', lat: 15.1412, lng: 120.5985, type: 'Ambulance' },
  { name: 'Sapangbato Disaster Outpost', lat: 15.1512, lng: 120.5152, type: 'Rescue Truck' }
];

// Fallback Barangay Center Coordinates for mapping calculations if GPS strings are corrupted/missing
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

// =========================================================================
// 📐 THE HAVERSINE GEOMETRIC DISTANCE CALCULATOR FORMULA
// =========================================================================
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in Kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Outputs exact distance in KM
}

export default function EmergencyUnitsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [matrixData, setMatrixData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🛡️ SECURITY GUARDRAIL: Pull authentication token from localStorage
  const token = localStorage.getItem('ac_token');

  useEffect(() => {
    // 🛡️ SECURITY GUARDRAIL: Instantly kick out unauthenticated traffic
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUnitsMatrix = async () => {
      try {
        // Fetch raw report entries directly from your live Django endpoints
        const res = await fetch('http://127.0.0.1:8000/api/reports/admin-reports/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          }
        });
        const data = await res.json();
        
        const rawReports = Array.isArray(data) ? data : (data && Array.isArray(data.results)) ? data.results : [];
        
        // Filter: We only compute dispatch lines for ongoing/unresolved emergencies
        const activeReports = rawReports.filter(r => r && String(r.status).toLowerCase() !== 'resolved');

        // 👇 BUILD LIVE GEOMETRIC OUTPOST MATCHING MATRIX
        const calculatedMatrix = activeReports.map((report) => {
          const brgy = report.barangay || report.location || 'Unknown';
          let reportLat = parseFloat(report.latitude);
          let reportLng = parseFloat(report.longitude);

          // Fallback coordinate alignment if mobile capture dataset provides pixels/garbage values
          if (isNaN(reportLat) || isNaN(reportLng) || reportLat > 90 || reportLng > 180) {
            const fallback = barangayCoordsFallback[brgy];
            if (fallback) {
              reportLat = fallback[0];
              reportLng = fallback[1];
            }
          }

          // Smart Classification: Dynamically determine the vehicle type required based on incident keywords
          const desc = (report.description || '').toLowerCase();
          let recommendedUnit = 'Rescue Truck'; // Baseline dispatch
          if (desc.includes('fire') || desc.includes('smoke') || desc.includes('sunog')) {
            recommendedUnit = 'Fire Engine';
          } else if (desc.includes('accident') || desc.includes('injury') || desc.includes('sakit') || desc.includes('medical')) {
            recommendedUnit = 'Ambulance';
          }

          // Loop over outposts to detect the absolute nearest dispatcher location
          let nearestStationName = 'HQ Central Station';
          let shortestDistance = Infinity;

          if (!isNaN(reportLat) && !isNaN(reportLng)) {
            emergencyBases.forEach((base) => {
              const currentDistance = calculateHaversineDistance(reportLat, reportLng, base.lat, base.lng);
              if (currentDistance < shortestDistance) {
                shortestDistance = currentDistance;
                nearestStationName = base.name;
              }
            });
          }

          return {
            report_id: report.id,
            incident_description: report.description || 'Emergency Dispatch',
            barangay: brgy,
            recommended_unit_type: recommendedUnit,
            nearest_responder: nearestStationName,
            distance_km: shortestDistance === Infinity ? null : shortestDistance,
            responder_status: 'Available'
          };
        });

        setMatrixData(calculatedMatrix);
        setIsLoading(false);
      } catch (error) {
        console.error("Error connecting to unit calculator:", error);
        setIsLoading(false);
      }
    };

    fetchUnitsMatrix();
  }, [token, navigate]);

  // 🛡️ SECURITY GUARDRAIL: Do not render layout DOM elements if unauthenticated
  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting to dispatch...</div>;
  }

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
                      <tr><td colSpan="6" className="py-8 text-center text-gray-400 font-bold">Running real-time coordinate proximity calculations...</td></tr>
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
                          <td className="py-5 px-8 text-sm font-bold text-gray-800 max-w-xs truncate" title={row.incident_description}>{row.incident_description}</td>
                          <td className="py-5 px-8 text-sm font-medium text-gray-600">Brgy. {row.barangay}</td>
                          <td className="py-5 px-8">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 w-fit ${
                              row.recommended_unit_type === 'Fire Engine' ? 'bg-red-50 text-red-700 border-red-200' :
                              row.recommended_unit_type === 'Ambulance' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                              <Truck size={12} /> {row.recommended_unit_type}
                            </span>
                          </td>
                          <td className="py-5 px-8">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span className="text-sm font-bold text-gray-700">{row.nearest_responder}</span>
                            </div>
                          </td>
                          <td className="py-5 px-8 text-right font-black text-gray-900 text-sm">
                            {row.distance_km !== null ? (
                              <span className="flex items-center justify-end gap-1 text-red-600">
                                <Navigation size={12} className="rotate-45" /> {row.distance_km.toFixed(2)} km
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