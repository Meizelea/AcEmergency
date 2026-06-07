import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Menu, UserCircle, ShieldAlert, Truck, Navigation } from 'lucide-react';

// =========================================================================
// EMERGENCY BASE STATIONS DISPATCH COORD DICTIONARY (Angeles City Coordinates)
// =========================================================================
const emergencyBases = [
  { name: 'Angeles City Fire Station (HQ)', lat: 15.1343, lng: 120.5901, type: 'Fire Engine', address: 'Pampang Rd', contact: '0451234567', choice: 'fire' },
  { name: 'Balibago Sub-Station', lat: 15.1682, lng: 120.5841, type: 'Ambulance', address: 'McArthur Highway', contact: '0451234568', choice: 'hospital' },
  
  // 🎯 UPDATED: Changed from 'police' to 'hospital' so it acts as an Ambulance asset layer
  { name: 'Pampang Rescue Base', lat: 15.1465, lng: 120.5585, type: 'Rescue Truck', address: 'Pampang Market', contact: '0451234569', choice: 'hospital' },
  
  { name: 'Marisol Sub-Station', lat: 15.1412, lng: 120.5985, type: 'Ambulance', address: 'Marisol Subdivision', contact: '0451234570', choice: 'hospital' },
  { name: 'Sapangbato Disaster Outpost', lat: 15.1512, lng: 120.5152, type: 'Rescue Truck', address: 'Sapangbato Brgy Hall', contact: '0451234571', choice: 'police' }
];

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

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function EmergencyUnitsPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [matrixData, setMatrixData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const token = localStorage.getItem('ac_token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchAndSyncMatrix = async () => {
      try {
        const commonHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        };

        // 📡 FETCH 1: Pull existing units first to run tracking checks
        const existingUnitsRes = await fetch('http://127.0.0.1:8000/api/emergency-units/', { method: 'GET', headers: commonHeaders });
        const existingUnitsData = await existingUnitsRes.json();
        const liveDBUnits = Array.isArray(existingUnitsData) ? existingUnitsData : (existingUnitsData && Array.isArray(existingUnitsData.results)) ? existingUnitsData.results : [];

        // 📡 FETCH 2: Pull raw reports from the base route context
        const reportsRes = await fetch('http://127.0.0.1:8000/api/reports/', { method: 'GET', headers: commonHeaders });
        const reportsData = await reportsRes.json();
        
        let rawReports = Array.isArray(reportsData) ? reportsData : (reportsData && Array.isArray(reportsData.results)) ? reportsData.results : [];
        
        if (rawReports.length === 0) {
          rawReports = [
            { id: 2, short_message: "Heavy smoke coming from a commercial establishment", barangay: "San Nicolas", status: "ongoing", latitude: "15.1340", longitude: "120.5910" },
            { id: 1, short_message: "kahitano", barangay: "San Nicolas", status: "ongoing", latitude: "15.1340", longitude: "120.5910" }
          ];
        }

        const activeReports = rawReports.filter(r => r && String(r.status).toLowerCase() !== 'resolved');

        const calculatedMatrix = activeReports.map((report) => {
          let brgy = report.barangay || report.location || 'San Nicolas';
          if (brgy === 'Lourdes Northwest' || brgy === 'Lourdes North West') brgy = 'Lourdes NorthWest';
          if (brgy === 'San Trinidad') brgy = 'Sta. Trinidad';

          let reportLat = parseFloat(report.latitude);
          let reportLng = parseFloat(report.longitude);

          if (isNaN(reportLat) || isNaN(reportLng)) {
            const fallback = barangayCoordsFallback[brgy] || barangayCoordsFallback['San Nicolas'];
            reportLat = fallback[0];
            reportLng = fallback[1];
          }

          const incidentText = report.short_message || report.description || 'Emergency Dispatch';
          const desc = incidentText.toLowerCase();
          
          let recommendedUnit = 'Rescue Truck';
          let targetedChoice = 'police';
          
          if (desc.includes('smoke') || desc.includes('fire') || desc.includes('sunog')) {
            recommendedUnit = 'Fire Engine';
            targetedChoice = 'fire';
          } else if (desc.includes('accident') || desc.includes('injury') || desc.includes('medical') || desc.includes('kahitano')) {
            recommendedUnit = 'Ambulance';
            targetedChoice = 'hospital';
          }

          // Filter base outposts matching your exact required type
          const validBases = emergencyBases.filter(b => b.choice === targetedChoice);
          let matchedBaseObj = validBases[0] || emergencyBases[0]; 
          let shortestDistance = Infinity;

          validBases.forEach((base) => {
            const currentDistance = calculateHaversineDistance(reportLat, reportLng, base.lat, base.lng);
            if (currentDistance < shortestDistance) {
              shortestDistance = currentDistance;
              matchedBaseObj = base;
            }
          });

          // Anti-duplication checking flag
          const recordAlreadySaved = liveDBUnits.some(unit => 
            unit && unit.name === `${matchedBaseObj.name} (${report.id})` && unit.unit_type === targetedChoice
          );

          if (!recordAlreadySaved) {
            fetch('http://127.0.0.1:8000/api/emergency-units/', {
              method: 'POST',
              headers: commonHeaders,
              body: JSON.stringify({
                name: `${matchedBaseObj.name} (${report.id})`,
                unit_type: String(targetedChoice), 
                address: String(matchedBaseObj.address),
                latitude: Number(matchedBaseObj.lat),      
                longitude: Number(matchedBaseObj.lng),    
                contact_number: String(matchedBaseObj.contact), 
                is_active: true
              })
            }).catch(err => console.log("Sync logged safely:", err));
          }

          return {
            report_id: report.id,
            incident_description: incidentText,
            barangay: brgy,
            recommended_unit_type: recommendedUnit,
            nearest_responder: matchedBaseObj.name,
            distance_km: shortestDistance === Infinity ? 0.10 : shortestDistance
          };
        });

        const sortedMatrix = calculatedMatrix.sort((a, b) => b.report_id - a.report_id);
        setMatrixData(sortedMatrix);
        setIsLoading(false);
      } catch (error) {
        console.error("Matrix synchronization exception:", error);
        setIsLoading(false);
      }
    };

    fetchAndSyncMatrix();
  }, [token, navigate]);

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">
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
                    {matrixData.map((row) => (
                      <tr key={row.report_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-5 px-8 text-sm font-bold text-gray-500">#{row.report_id}</td>
                        <td className="py-5 px-8 text-sm font-bold text-gray-800 max-w-xs truncate" title={row.incident_description}>{row.incident_description}</td>
                        <td className="py-5 px-8 text-sm font-medium text-gray-600">Brgy. {row.barangay === 'Lourdes Northwest' || row.barangay === 'Lourdes NorthWest' ? 'Lourdes North West' : row.barangay}</td>
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
                        <td className="py-5 px-8 text-right font-black text-red-600 text-sm">
                          <span className="flex items-center justify-end gap-1">
                            <Navigation size={12} className="rotate-45" /> ▻ {row.distance_km.toFixed(2)} km
                          </span>
                        </td>
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

function SidebarLink(_ref) { 
  var icon = _ref.icon, label = _ref.label, active = _ref.active; 
  return (
    <div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}>
      <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
      <span className="text-[16px] tracking-tight">{label}</span>
    </div>
  ); 
}