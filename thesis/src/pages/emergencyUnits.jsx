import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Truck, Navigation, RefreshCw } from 'lucide-react';

import AdminLayout from '../components/header';

// =========================================================================
// EMERGENCY BASE STATIONS DISPATCH COORD DICTIONARY (Angeles City)
// =========================================================================
const emergencyBases = [
  { name: 'Angeles City Fire Station (HQ)', lat: 15.1343, lng: 120.5901, type: 'Fire Engine', address: 'Pampang Rd', contact: '0451234567', choice: 'fire' },
  { name: 'Balibago Sub-Station', lat: 15.1682, lng: 120.5841, type: 'Ambulance', address: 'McArthur Highway', contact: '0451234568', choice: 'hospital' },
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
  const navigate = useNavigate();

  const [matrixData, setMatrixData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';

  const fetchAndSyncMatrix = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      
      // Pull raw reports from the active admin endpoint
      const reportsRes = await fetch(`http://${targetHostname}:8000/api/reports/admin/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authPrefix
        }
      });

      if (!reportsRes.ok) {
        throw new Error(`Server returned ${reportsRes.status}: ${reportsRes.statusText}`);
      }

      const reportsData = await reportsRes.json();
      const rawReports = Array.isArray(reportsData) ? reportsData : (reportsData?.results || []);

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

        // Filter bases matching the required unit type
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

  useEffect(() => {
    fetchAndSyncMatrix();
  }, [token, navigate, targetHostname]);

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0]">
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white rounded-full p-2">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="font-bold text-2xl text-gray-900">Tactical Responder Dispatch Matrix</h2>
              <p className="text-xs text-gray-500 font-medium">Real-time nearest station routing for pending incident dispatches</p>
            </div>
          </div>

          <button 
            onClick={fetchAndSyncMatrix}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Dispatch
          </button>
        </div>

        {/* MASTER TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 bg-gray-50/50">
            <h3 className="font-bold text-lg text-gray-900">Active Incidents</h3>
            <span className="text-sm text-gray-400 font-bold">{matrixData.length} Incidents Pending Dispatch</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-8 w-24">Incident ID</th>
                  <th className="py-4 px-8">Active Emergency Description</th>
                  <th className="py-4 px-8">Barangay</th>
                  <th className="py-4 px-8">Required Fleet Unit</th>
                  <th className="py-4 px-8">Nearest Base Station</th>
                  <th className="py-4 px-8 text-right">Distance (KM)</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-bold">
                      Calculating dispatch distances and base station coordinates...
                    </td>
                  </tr>
                ) : matrixData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      No active emergency units pending dispatch.
                    </td>
                  </tr>
                ) : (
                  matrixData.map((row) => (
                    <tr key={row.report_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="py-5 px-8 text-sm font-bold text-gray-500">#{row.report_id}</td>
                      <td className="py-5 px-8 text-sm font-bold text-gray-800 max-w-xs truncate" title={row.incident_description}>
                        {row.incident_description}
                      </td>
                      <td className="py-5 px-8 text-sm font-medium text-gray-600">
                        Brgy. {row.barangay === 'Lourdes Northwest' || row.barangay === 'Lourdes NorthWest' ? 'Lourdes North West' : row.barangay}
                      </td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}