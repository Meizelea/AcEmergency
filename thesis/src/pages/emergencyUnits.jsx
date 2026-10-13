import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Truck, 
  Navigation, 
  RefreshCw, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  X, 
  MapPin, 
  Phone, 
  AlertCircle,
  Building2,
  Radio,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';

import AdminLayout from '../components/header';

// =========================================================================
// INITIAL EMERGENCY BASE STATIONS DISPATCH REPOSITORY (From emergency-coordinates.txt)
// =========================================================================
const INITIAL_EMERGENCY_BASES = [
  // Fire Engines
  { id: 1, name: 'Angeles City Central Fire Station', lat: 15.16466, lng: 120.60858, type: 'Fire Engine', address: 'Pulung Maragul, City Hall area', contact: '0451234567', choice: 'fire' },
  { id: 2, name: 'San Nicolas Fire Substation', lat: 15.13732, lng: 120.58693, type: 'Fire Engine', address: 'Rizal Street / Angeles–Porac Road, San Nicolas', contact: '0451234568', choice: 'fire' },
  { id: 3, name: 'Anunas Fire Substation', lat: 15.158069, lng: 120.558913, type: 'Fire Engine', address: 'Fil-Am Friendship Highway, Anunas', contact: '0451234569', choice: 'fire' },

  // Ambulances / Medical
  { id: 4, name: 'Angeles University Foundation Medical Center', lat: 15.14506, lng: 120.59496, type: 'Ambulance', address: 'MacArthur Highway, Lourdes Sur East', contact: '0451234570', choice: 'hospital' },
  { id: 5, name: 'Rafael Lazatin Memorial Medical Center / Ospital ning Angeles', lat: 15.14602, lng: 120.58080, type: 'Ambulance', address: 'Visitacion Street, Pampang', contact: '0451234571', choice: 'hospital' },
  { id: 6, name: 'AC Sacred Heart Medical Center', lat: 15.12540, lng: 120.59871, type: 'Ambulance', address: 'MacArthur Highway, Santo Domingo', contact: '0451234572', choice: 'hospital' },
  { id: 7, name: 'Angeles Medical Center', lat: 15.14145, lng: 120.58944, type: 'Ambulance', address: 'Rizal Street, Lourdes Sur', contact: '0451234573', choice: 'hospital' },
  { id: 8, name: 'PRI Medical Center', lat: 15.14755, lng: 120.57754, type: 'Ambulance', address: 'Arayat Boulevard, Pampang', contact: '0451234574', choice: 'hospital' },
  { id: 9, name: 'Dr. Amando L. Garcia Medical Center', lat: 15.14223, lng: 120.58927, type: 'Ambulance', address: 'Rizal Street, Agapito del Rosario', contact: '0451234575', choice: 'hospital' },
  { id: 10, name: 'St. Catherine of Alexandria Foundation and Medical Center', lat: 15.13028, lng: 120.57620, type: 'Ambulance', address: 'New site, Rizal Extension, Cutcut', contact: '0451234576', choice: 'hospital' },
  { id: 11, name: 'Holy Family Medical Center', lat: 15.14003, lng: 120.59432, type: 'Ambulance', address: '1377 Santo Entierro Street', contact: '0451234579', choice: 'hospital' },
  { id: 12, name: 'Lifeline Medical Center', lat: 15.16387, lng: 120.55674, type: 'Ambulance', address: '57 Don Juico Avenue, Riverside, Anunas', contact: '0451234580', choice: 'hospital' },
  { id: 13, name: 'Blue Light Ambulance', lat: 15.16623, lng: 120.59032, type: 'Ambulance', address: '270 MacArthur Highway, Angeles City', contact: '0451234582', choice: 'hospital' },
  { id: 14, name: 'Philippine Red Cross / Blood Bank', lat: 15.14902, lng: 120.58466, type: 'Ambulance', address: 'D-13 Richthofen Street, Angeles City', contact: '0451234583', choice: 'hospital' },

  // Rescue Trucks & Police
  { id: 15, name: 'City Rescue (ACDRRMO)', lat: 15.16470, lng: 120.60840, type: 'Rescue Truck', address: 'Angeles City Hall Compound, Pulung Maragul', contact: '0451234581', choice: 'hospital' },
  { id: 16, name: 'Angeles City Police Office / Camp Tomas Pepito', lat: 15.12784, lng: 120.60241, type: 'Rescue Truck', address: 'San Marcos Street, Santo Domingo', contact: '0451234585', choice: 'police' },
  { id: 17, name: 'Police Station 1', lat: 15.13467, lng: 120.59112, type: 'Rescue Truck', address: 'Nepomuceno Street, Santo Rosario', contact: '0451234586', choice: 'police' },
  { id: 18, name: 'Police Station 2', lat: 15.14935, lng: 120.58471, type: 'Rescue Truck', address: 'San Francisco Street, Santa Teresita', contact: '0451234587', choice: 'police' },
  { id: 19, name: 'Police Station 3', lat: 15.16074, lng: 120.60893, type: 'Rescue Truck', address: 'Magalang–Angeles Road, Pandan area', contact: '0451234588', choice: 'police' },
  { id: 20, name: 'Police Station 4', lat: 15.16727, lng: 120.58543, type: 'Rescue Truck', address: 'Balibago', contact: '0451234589', choice: 'police' },
  { id: 21, name: 'Police Station 5', lat: 15.14416, lng: 120.55703, type: 'Rescue Truck', address: 'Bauguin Road, Cuayan', contact: '0451234590', choice: 'police' },
  { id: 22, name: 'Police Station 6', lat: 15.14849, lng: 120.58980, type: 'Rescue Truck', address: 'Jake Gonzales Boulevard', contact: '0451234591', choice: 'police' }
];

const barangayCoordsFallback = {
  'Balibago': [15.16727, 120.58543],
  'Pampang': [15.14602, 120.58080],
  'Cutcut': [15.12959, 120.57460],
  'Santo Domingo': [15.12540, 120.59871],
  'Santo Rosario': [15.13467, 120.59112],
  'Santa Teresita': [15.14935, 120.58471],
  'Sta. Teresita': [15.14935, 120.58471],
  'Lourdes Sur': [15.14145, 120.58944],
  'Lourdes Sur East': [15.14506, 120.59496],
  'Agapito del Rosario': [15.14223, 120.58927],
  'Cuayan': [15.14416, 120.55703],
  'Anunas': [15.158069, 120.558913],
  'Pulung Maragul': [15.16466, 120.60858],
  'Pandan': [15.16074, 120.60893],
  'San Nicolas': [15.13732, 120.58693],
  'Sta. Trinidad': [15.13200, 120.59500],
  'Santa Trinidad': [15.13200, 120.59500],
  'Lourdes NorthWest': [15.14100, 120.58100],
  'Claro M. Recto': [15.14200, 120.59900],
  'Malabanias': [15.16000, 120.57500],
  'Amsic': [15.15500, 120.56500],
  'Cutud': [15.15000, 120.61000],
  'Margot': [15.16600, 120.53300],
  'Sapangbato': [15.15000, 120.51600]
};

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
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

  const [activeTab, setActiveTab] = useState('matrix');

  // Emergency Units State
  const [units, setUnits] = useState(() => {
    const saved = localStorage.getItem('ac_emergency_bases');
    return saved ? JSON.parse(saved) : INITIAL_EMERGENCY_BASES;
  });

  // Manual Station Assignment Map: { [report_id]: base_station_id }
  const [assignedResponders, setAssignedResponders] = useState(() => {
    const saved = localStorage.getItem('ac_assigned_responders');
    return saved ? JSON.parse(saved) : {};
  });

  const [rawReports, setRawReports] = useState([]);
  const [matrixData, setMatrixData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Unit CRUD Modal State
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({
    name: '',
    type: 'Rescue Truck',
    choice: 'police',
    lat: '',
    lng: '',
    address: '',
    contact: ''
  });
  const [formError, setFormError] = useState('');

  // Incident Inspection Modal State
  const [selectedReportRow, setSelectedReportRow] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const token = localStorage.getItem('ac_token');

  useEffect(() => {
    localStorage.setItem('ac_emergency_bases', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    localStorage.setItem('ac_assigned_responders', JSON.stringify(assignedResponders));
  }, [assignedResponders]);

  // 1. Fetch raw active reports
  const fetchReports = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      const reportsRes = await fetch(`https://api.aksyon.online/api/reports/admin/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authPrefix
        }
      });

      if (!reportsRes.ok) {
        throw new Error(`Server returned ${reportsRes.status}`);
      }

      const data = await reportsRes.json();
      const list = Array.isArray(data) ? data : (data?.results || []);
      const active = list.filter(r => r && String(r.status).toLowerCase() !== 'resolved');
      setRawReports(active);
    } catch (err) {
      console.error("Report sync error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  // 2. Compute Dispatch Matrix (preserves algorithm recommendation while respecting manual overrides)
  useEffect(() => {
    if (rawReports.length === 0 || units.length === 0) {
      setMatrixData([]);
      return;
    }

    const calculated = rawReports.map((report) => {
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

      const validBases = units.filter(b => b.choice === targetedChoice);
      const candidates = validBases.length > 0 ? validBases : units;

      let matchedBaseObj = candidates[0];
      let shortestDistance = Infinity;

      candidates.forEach((base) => {
        const curDist = calculateHaversineDistance(reportLat, reportLng, base.lat, base.lng);
        if (curDist < shortestDistance) {
          shortestDistance = curDist;
          matchedBaseObj = base;
        }
      });

      // Check if this incident has an overridden dispatcher station
      const manualBaseId = assignedResponders[report.id];
      const activeAssignedBase = manualBaseId ? units.find(u => u.id === manualBaseId) : null;
      const isManual = Boolean(activeAssignedBase && activeAssignedBase.id !== matchedBaseObj?.id);

      const activeResponderObj = isManual ? activeAssignedBase : matchedBaseObj;
      const activeDistance = activeResponderObj 
        ? calculateHaversineDistance(reportLat, reportLng, activeResponderObj.lat, activeResponderObj.lng) 
        : shortestDistance;

      return {
        report_id: report.id,
        incident_description: incidentText,
        full_details: report.details || report.description || incidentText,
        reported_by: report.user_name || report.sender || report.reporter || 'Resident Alert',
        created_at: report.created_at || report.timestamp || report.date_reported || '',
        barangay: brgy,
        lat: reportLat,
        lng: reportLng,
        recommended_unit_type: recommendedUnit,

        // 1. Recommended Base (Always Preserved)
        recommended_responder_id: matchedBaseObj?.id,
        recommended_responder: matchedBaseObj ? matchedBaseObj.name : 'Central Base',
        recommended_distance_km: shortestDistance === Infinity ? 0.10 : shortestDistance,

        // 2. Currently Active Base (May be overridden or default recommendation)
        is_manually_assigned: isManual,
        active_responder_id: activeResponderObj?.id,
        nearest_responder: activeResponderObj ? activeResponderObj.name : 'Central Base',
        nearest_responder_address: activeResponderObj?.address || 'Angeles City Command Area',
        nearest_responder_contact: activeResponderObj?.contact || 'N/A',
        nearest_responder_type: activeResponderObj?.type || recommendedUnit,
        distance_km: activeDistance === Infinity ? 0.10 : activeDistance
      };
    });

    setMatrixData(calculated.sort((a, b) => b.report_id - a.report_id));
  }, [rawReports, units, assignedResponders]);

  // Keep modal row synchronized if state changes
  useEffect(() => {
    if (selectedReportRow) {
      const refreshed = matrixData.find(m => m.report_id === selectedReportRow.report_id);
      if (refreshed) {
        setSelectedReportRow(refreshed);
      }
    }
  }, [matrixData]);

  // Unit Modal Helpers
  const openCreateModal = () => {
    setModalMode('create');
    setUnitForm({
      name: '',
      type: 'Rescue Truck',
      choice: 'police',
      lat: '',
      lng: '',
      address: '',
      contact: ''
    });
    setFormError('');
    setIsUnitModalOpen(true);
  };

  const openEditModal = (unit) => {
    setModalMode('edit');
    setSelectedUnit(unit);
    setUnitForm({
      name: unit.name,
      type: unit.type,
      choice: unit.choice || (unit.type === 'Fire Engine' ? 'fire' : unit.type === 'Ambulance' ? 'hospital' : 'police'),
      lat: String(unit.lat),
      lng: String(unit.lng),
      address: unit.address || '',
      contact: unit.contact || ''
    });
    setFormError('');
    setIsUnitModalOpen(true);
  };

  const openViewModal = (unit) => {
    setModalMode('view');
    setSelectedUnit(unit);
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = (e) => {
    e.preventDefault();
    setFormError('');

    const parsedLat = parseFloat(unitForm.lat);
    const parsedLng = parseFloat(unitForm.lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setFormError('Please input valid numeric coordinates for Latitude and Longitude.');
      return;
    }

    if (modalMode === 'create') {
      const newUnit = {
        id: Date.now(),
        name: unitForm.name.trim(),
        type: unitForm.type,
        choice: unitForm.type === 'Fire Engine' ? 'fire' : unitForm.type === 'Ambulance' ? 'hospital' : 'police',
        lat: parsedLat,
        lng: parsedLng,
        address: unitForm.address.trim(),
        contact: unitForm.contact.trim()
      };
      setUnits(prev => [newUnit, ...prev]);
    } else if (modalMode === 'edit') {
      setUnits(prev => prev.map(u => u.id === selectedUnit.id ? {
        ...u,
        name: unitForm.name.trim(),
        type: unitForm.type,
        choice: unitForm.type === 'Fire Engine' ? 'fire' : unitForm.type === 'Ambulance' ? 'hospital' : 'police',
        lat: parsedLat,
        lng: parsedLng,
        address: unitForm.address.trim(),
        contact: unitForm.contact.trim()
      } : u));
    }

    setIsUnitModalOpen(false);
  };

  const handleDeleteUnit = (unit) => {
    if (window.confirm(`Are you sure you want to decommission and remove unit "${unit.name}"?`)) {
      setUnits(prev => prev.filter(u => u.id !== unit.id));
    }
  };

  // Change Responder Handlers
  const handleChangeResponder = (reportId, targetBaseId) => {
    setAssignedResponders(prev => ({
      ...prev,
      [reportId]: Number(targetBaseId)
    }));
  };

  const handleResetToRecommended = (reportId) => {
    setAssignedResponders(prev => {
      const copy = { ...prev };
      delete copy[reportId];
      return copy;
    });
  };

  const openReportModal = (row) => {
    setSelectedReportRow(row);
    setIsReportModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0] font-sans">
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white rounded-full p-2.5">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="font-bold text-2xl text-gray-900">Tactical Responder & Fleet Management</h2>
              <p className="text-xs text-gray-500 font-medium">Coordinate emergency units, algorithm routing, and tactical dispatch assignments</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchReports}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
            </button>
            <button 
              onClick={openCreateModal}
              className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} /> Add Emergency Unit
            </button>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex gap-2 border-b border-gray-300 mb-6">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'matrix' 
                ? 'border-[#b32d2d] text-[#b32d2d]' 
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Dispatch Routing Matrix ({matrixData.length} Active Incidents)
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'units' 
                ? 'border-[#b32d2d] text-[#b32d2d]' 
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Registered Emergency Bases & Fleet ({units.length} Stations)
          </button>
        </div>

        {/* TAB 1: DISPATCH MATRIX */}
        {activeTab === 'matrix' && (
          <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 bg-gray-50/50">
              <h3 className="font-bold text-base text-gray-900">Live Incidents Nearest-Station Routing</h3>
              <span className="text-xs text-gray-400 font-bold">{matrixData.length} Incidents Pending Dispatch</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                    <th className="py-4 px-6 w-24">Incident ID</th>
                    <th className="py-4 px-6">Emergency Description</th>
                    <th className="py-4 px-6">Barangay</th>
                    <th className="py-4 px-6">Required Unit</th>
                    <th className="py-4 px-6">Assigned Responder</th>
                    <th className="py-4 px-6 text-right">Distance (KM)</th>
                    <th className="py-4 px-6 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400 font-bold">
                        Synchronizing live dispatch distances...
                      </td>
                    </tr>
                  ) : matrixData.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400 font-medium">
                        No active incidents currently require dispatch routing.
                      </td>
                    </tr>
                  ) : (
                    matrixData.map((row) => (
                      <tr key={row.report_id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-6 font-bold text-gray-500">#{row.report_id}</td>
                        <td className="py-4 px-6 font-bold text-gray-800 max-w-xs truncate" title={row.incident_description}>
                          {row.incident_description}
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-600">
                          Brgy. {row.barangay}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 w-fit ${
                            row.recommended_unit_type === 'Fire Engine' ? 'bg-red-50 text-red-700 border-red-200' :
                            row.recommended_unit_type === 'Ambulance' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            <Truck size={12} /> {row.recommended_unit_type}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${row.is_manually_assigned ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                            <span className="font-bold text-gray-800">{row.nearest_responder}</span>
                            {row.is_manually_assigned && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-black tracking-wider">
                                Reassigned
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 block ml-4 mt-0.5">📞 {row.nearest_responder_contact}</span>
                        </td>
                        <td className="py-4 px-6 text-right font-black text-red-600 text-xs">
                          <span className="flex items-center justify-end gap-1">
                            <Navigation size={12} className="rotate-45" /> ▻ {row.distance_km.toFixed(2)} km
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => openReportModal(row)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white rounded-lg font-bold text-[11px] shadow-2xs transition-all active:scale-95 cursor-pointer"
                          >
                            <Eye size={13} /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EMERGENCY UNITS CRUD INVENTORY */}
        {activeTab === 'units' && (
          <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 bg-gray-50/50">
              <h3 className="font-bold text-base text-gray-900">Registered Emergency Fleet & Response Posts</h3>
              <span className="text-xs text-gray-400 font-bold">{units.length} Units Available</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                    <th className="py-4 px-6">Unit / Base Name</th>
                    <th className="py-4 px-6">Vehicle Type</th>
                    <th className="py-4 px-6">Address & Coordinates</th>
                    <th className="py-4 px-6">Contact Number</th>
                    <th className="py-4 px-6 text-right w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {units.map((unit) => (
                    <tr key={unit.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-bold text-gray-900 text-xs flex items-center gap-2">
                          <Building2 size={15} className="text-[#b32d2d] shrink-0" />
                          {unit.name}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${
                          unit.type === 'Fire Engine' ? 'bg-red-50 text-red-700 border-red-200' :
                          unit.type === 'Ambulance' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          <Truck size={11} /> {unit.type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-600">
                        <div className="font-medium text-xs">{unit.address || 'Angeles City'}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{unit.lat.toFixed(5)}, {unit.lng.toFixed(5)}</div>
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-700">
                        {unit.contact || 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => openViewModal(unit)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => openEditModal(unit)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all cursor-pointer"
                            title="Edit Unit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUnit(unit)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer"
                            title="Delete Unit"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: REPORT INSPECTION, RECOMMENDED RESPONDER & RESPONDER REASSIGNMENT */}
      {/* ========================================================================= */}
      {isReportModalOpen && selectedReportRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Header */}
            <div className="bg-[#b32d2d] px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={22} />
                <div>
                  <h3 className="font-bold text-base tracking-tight">Incident #{selectedReportRow.report_id} Dispatch Console</h3>
                  <p className="text-red-100 text-[11px]">Verify Proximity Telemetry & Dispatch Fleet Units</p>
                </div>
              </div>
              <button 
                onClick={() => setIsReportModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              
              {/* Incident Header Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Emergency Alert</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[10px]">
                    PENDING DISPATCH
                  </span>
                </div>
                <h4 className="text-sm font-black text-gray-900 mb-1">{selectedReportRow.incident_description}</h4>
                <p className="text-gray-600 leading-relaxed text-xs">{selectedReportRow.full_details}</p>
                
                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-gray-600">
                  <div>
                    <span className="font-bold text-gray-400 block text-[9px] uppercase">Barangay</span>
                    <span className="font-semibold text-gray-800">Brgy. {selectedReportRow.barangay}</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 block text-[9px] uppercase">Reporter</span>
                    <span className="font-semibold text-gray-800">{selectedReportRow.reported_by}</span>
                  </div>
                  <div>
                    <span className="font-bold text-gray-400 block text-[9px] uppercase">Coordinates</span>
                    <span className="font-mono text-gray-700">{selectedReportRow.lat?.toFixed(4)}, {selectedReportRow.lng?.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              {/* 1. RECOMMENDED NEAREST RESPONDER (NEVER REMOVED) */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs uppercase tracking-wider">
                    <Radio size={14} className="text-blue-600" />
                    Recommended Nearest Responder (Algorithm Match)
                  </div>
                  <span className="text-[11px] font-black text-blue-800 bg-white border border-blue-200 px-2 py-0.5 rounded-full">
                    {selectedReportRow.recommended_distance_km.toFixed(2)} KM Away
                  </span>
                </div>

                <div className="bg-white border border-blue-100 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Building2 size={15} className="text-blue-600 shrink-0" />
                      {selectedReportRow.recommended_responder}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      Target Fleet: <strong className="text-gray-600">{selectedReportRow.recommended_unit_type}</strong>
                    </span>
                  </div>

                  {selectedReportRow.is_manually_assigned && (
                    <button
                      type="button"
                      onClick={() => handleResetToRecommended(selectedReportRow.report_id)}
                      className="px-2.5 py-1 text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      title="Revert to this recommendation"
                    >
                      <RotateCcw size={12} /> Reset to this
                    </button>
                  )}
                </div>
              </div>

              {/* 2. ACTIVE / ASSIGNED RESPONDER CONTROLLER (CAN BE MODIFIED) */}
              <div className={`border rounded-xl p-4 ${selectedReportRow.is_manually_assigned ? 'bg-amber-50/70 border-amber-300' : 'bg-emerald-50/60 border-emerald-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-gray-900 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 size={15} className={selectedReportRow.is_manually_assigned ? 'text-amber-600' : 'text-emerald-600'} />
                    Active Assigned Base Station
                  </div>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black tracking-wider ${
                    selectedReportRow.is_manually_assigned 
                      ? 'bg-amber-200 text-amber-900' 
                      : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {selectedReportRow.is_manually_assigned ? 'Custom Manual Selection' : 'Using Algorithm Pick'}
                  </span>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-3.5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                        <Building2 size={16} className={selectedReportRow.is_manually_assigned ? 'text-amber-600' : 'text-emerald-600'} />
                        {selectedReportRow.nearest_responder}
                      </h5>
                      <p className="text-gray-500 text-[11px] mt-0.5 flex items-center gap-1">
                        <MapPin size={12} className="text-gray-400 shrink-0" />
                        {selectedReportRow.nearest_responder_address}
                      </p>
                    </div>
                    <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                      {selectedReportRow.distance_km.toFixed(2)} KM
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-500">Dispatch Contact Hotline:</span>
                    <span className="font-bold text-gray-900 flex items-center gap-1">
                      <Phone size={12} className="text-gray-500" />
                      {selectedReportRow.nearest_responder_contact}
                    </span>
                  </div>

                  {/* SELECTOR: CHANGE TO ANY OTHER RESPONDER BASE */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Assign a Different Response Unit or Station
                    </label>
                    <select
                      value={selectedReportRow.active_responder_id || ''}
                      onChange={(e) => handleChangeResponder(selectedReportRow.report_id, e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#b32d2d] cursor-pointer"
                    >
                      {units.map((unit) => {
                        const dist = calculateHaversineDistance(
                          selectedReportRow.lat,
                          selectedReportRow.lng,
                          unit.lat,
                          unit.lng
                        );
                        return (
                          <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.type}) — {dist.toFixed(2)} km away
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Close Dispatch File
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EMERGENCY UNIT CRUD (CREATE, EDIT, VIEW BASE STATIONS)            */}
      {/* ========================================================================= */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={20} className="text-[#b32d2d]" />
                  <h3 className="font-bold text-base text-gray-900">
                    {modalMode === 'create' ? 'Register New Emergency Unit' : modalMode === 'edit' ? 'Modify Emergency Unit' : 'Emergency Unit Profile'}
                  </h3>
                </div>
                <X size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setIsUnitModalOpen(false)} />
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              {/* View Only */}
              {modalMode === 'view' && selectedUnit && (
                <div className="space-y-3.5 text-xs">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Unit / Base Name</label>
                    <p className="text-sm font-bold text-gray-900">{selectedUnit.name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Fleet Vehicle Type</label>
                      <p className="font-bold text-gray-800">{selectedUnit.type}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Contact Number</label>
                      <p className="font-medium text-gray-700">{selectedUnit.contact || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Address Location</label>
                    <p className="font-medium text-gray-800">{selectedUnit.address || 'Angeles City'}</p>
                    <p className="text-[11px] font-mono text-gray-500 mt-1">Coordinates: {selectedUnit.lat}, {selectedUnit.lng}</p>
                  </div>

                  <button 
                    onClick={() => setIsUnitModalOpen(false)}
                    className="w-full mt-2 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}

              {/* Create / Edit Form */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <form onSubmit={handleSaveUnit} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Unit / Base Name</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Angeles City Central Fire Station"
                      value={unitForm.name}
                      onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Unit Type</label>
                      <select 
                        value={unitForm.type}
                        onChange={(e) => setUnitForm({ ...unitForm, type: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d] bg-white cursor-pointer"
                      >
                        <option value="Rescue Truck">Rescue Truck</option>
                        <option value="Ambulance">Ambulance</option>
                        <option value="Fire Engine">Fire Engine</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Emergency Hotline</label>
                      <input 
                        type="text"
                        placeholder="e.g. 0451234567"
                        value={unitForm.contact}
                        onChange={(e) => setUnitForm({ ...unitForm, contact: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Latitude</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. 15.16466"
                        value={unitForm.lat}
                        onChange={(e) => setUnitForm({ ...unitForm, lat: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Longitude</label>
                      <input 
                        type="text"
                        required
                        placeholder="e.g. 120.60858"
                        value={unitForm.lng}
                        onChange={(e) => setUnitForm({ ...unitForm, lng: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Station Address</label>
                    <input 
                      type="text"
                      placeholder="e.g. MacArthur Highway, Angeles City"
                      value={unitForm.address}
                      onChange={(e) => setUnitForm({ ...unitForm, address: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                    />
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button 
                      type="button"
                      onClick={() => setIsUnitModalOpen(false)}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      {modalMode === 'create' ? 'Add Unit' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}