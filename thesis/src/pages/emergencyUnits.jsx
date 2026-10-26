import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Navigation, 
  RefreshCw, 
  Eye, 
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

import AdminLayout from '../components/header';

const targetHostname = window.location.hostname || '127.0.0.1';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }
  return `https://api.aksyon.online`;
  //return `http://${targetHostname}:8000`;
};

const API_BASE_URL = getApiBaseUrl();
const CACHE_KEY_REPORTS = 'cache_admin_reports_v12';

const CATEGORY_MAP = {
  'road_accident': 'Road Accident',
  'fire': 'Fire',
  'natural_hazard': 'Flooding and Natural Hazards',
  'medical_emergency': 'Medical Emergency',
  'infrastructure_hazard': 'Infrastructure Hazard',
  'public_safety': 'Public Safety Incident',
  'other': 'Other'
};

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

export default function EmergencyUnitsPage() {
  const navigate = useNavigate();

  // Filter out any cached resolved reports right on initialization
  const [rawReports, setRawReports] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_REPORTS);
    if (!cached) return [];
    const list = JSON.parse(cached);
    return list.filter(r => String(r.status || '').toLowerCase() !== 'resolved');
  });

  const [matrixData, setMatrixData] = useState([]);
  const [isLoading, setIsLoading] = useState(() => rawReports.length === 0);

  // Sorting State ('id_desc', 'id_asc', 'dist_asc', 'dist_desc')
  const [sortBy, setSortBy] = useState('id_desc');

  const [selectedReportRow, setSelectedReportRow] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const token = localStorage.getItem('ac_token');

  const getAuthHeaders = useCallback((useBearer = false) => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return { 'Authorization': `${authPrefix} ${cleanToken}`, 'Content-Type': 'application/json' };
  }, [token]);

  const getCategoryName = (report) => {
    if (!report) return 'Other';
    let rawCat = '';

    if (typeof report.category === 'object' && report.category !== null) {
      rawCat = report.category.name || report.category.title || report.category.label || report.category.code || '';
    } else if (report.category_name) {
      rawCat = report.category_name;
    } else if (report.category) {
      rawCat = String(report.category);
    } else if (report.emergency_type) {
      rawCat = String(report.emergency_type);
    }

    const cleanKey = rawCat.toLowerCase().trim();
    if (CATEGORY_MAP[cleanKey]) {
      return CATEGORY_MAP[cleanKey];
    }

    return rawCat || report.short_message || 'Other';
  };

  const fetchReports = useCallback(async () => {
    for (const useBearer of [false, true]) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/reports/admin/`, { 
          headers: getAuthHeaders(useBearer) 
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.results || []);
          
          // STRICT FILTER: Exclude resolved reports completely
          const activeOnly = list.filter(r => String(r.status || '').toLowerCase() !== 'resolved');

          setRawReports(activeOnly);
          sessionStorage.setItem(CACHE_KEY_REPORTS, JSON.stringify(activeOnly));
          return;
        }
      } catch (err) {
        console.error("Failed to load reports:", err);
      }
    }
  }, [getAuthHeaders]);

  const synchronizeData = useCallback(async (silent = false) => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!silent && rawReports.length === 0) setIsLoading(true);
    await fetchReports();
    setIsLoading(false);
  }, [token, navigate, fetchReports, rawReports.length]);

  // AUTOMATIC POLLING REFRESH (15s interval)
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    synchronizeData(true);

    const interval = setInterval(() => {
      synchronizeData(true);
    }, 15000);

    const handleFocus = () => synchronizeData(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [token, navigate, synchronizeData]);

  // MATRIX DATA CALCULATION
  useEffect(() => {
    if (rawReports.length === 0) {
      setMatrixData([]);
      return;
    }

    const calculated = rawReports.map((report) => {
      let brgy = report.barangay || report.location || 'San Nicolas';
      let reportLat = parseFloat(report.latitude);
      let reportLng = parseFloat(report.longitude);

      if (isNaN(reportLat) || isNaN(reportLng)) {
        const fallback = barangayCoordsFallback[brgy] || barangayCoordsFallback['San Nicolas'];
        reportLat = fallback[0];
        reportLng = fallback[1];
      }

      const categoryName = getCategoryName(report);
      const fullDetailsText = report.description || report.details || report.short_message || categoryName;

      let matchedBaseName = 'Rafael Lazatin Memorial Medical Center';
      if (report.nearest_responder) {
        matchedBaseName = typeof report.nearest_responder === 'object'
          ? (report.nearest_responder.name || 'Emergency Base')
          : report.nearest_responder;
      }

      let shortestDistance = report.distance_km ? parseFloat(report.distance_km) : 0.79;

      return {
        report_id: report.id,
        category: categoryName,
        full_details: fullDetailsText,
        reported_by: report.user_name || report.sender || 'Resident Alert',
        barangay: brgy,
        lat: reportLat,
        lng: reportLng,
        nearest_responder: String(matchedBaseName),
        distance_km: shortestDistance,
        status: report.status
      };
    });

    setMatrixData(calculated);
  }, [rawReports]);

  // Click Handlers for Sort Toggles
  const toggleSortId = () => {
    setSortBy(prev => prev === 'id_desc' ? 'id_asc' : 'id_desc');
  };

  const toggleSortDistance = () => {
    setSortBy(prev => prev === 'dist_asc' ? 'dist_desc' : 'dist_asc');
  };

  // Sorted Array Calculation
  const sortedMatrixData = [...matrixData].sort((a, b) => {
    if (sortBy === 'id_desc') return Number(b.report_id) - Number(a.report_id);
    if (sortBy === 'id_asc') return Number(a.report_id) - Number(b.report_id);
    if (sortBy === 'dist_asc') return Number(a.distance_km) - Number(b.distance_km);
    if (sortBy === 'dist_desc') return Number(b.distance_km) - Number(a.distance_km);
    return 0;
  });

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] font-sans flex flex-col">
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white rounded-full p-2.5 shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="font-bold text-xl sm:text-2xl text-gray-900">Emergency Unit Dispatch</h2>
              <p className="text-xs text-gray-500 font-medium">View recommended responders based on incident location and proximity.</p>
            </div>
          </div>

          <button 
            onClick={() => synchronizeData(false)}
            disabled={isLoading}
            className="w-full sm:w-auto bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-[#b32d2d]" : ""} /> 
            {isLoading ? "Refreshing..." : "Refresh Data"}
          </button>
        </div>

        {/* DISPATCH MATRIX TABLE CONTAINER */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200 bg-gray-50/50 flex flex-wrap justify-between items-center gap-2 shrink-0">
            <h3 className="font-bold text-sm sm:text-base text-gray-900">Nearest Responders or Dispatch Recommendations</h3>
            <span className="text-xs text-gray-900 font-black">
              {sortedMatrixData.length} Incidents Pending Dispatch
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider select-none">
                  
                  {/* SORTABLE INCIDENT ID HEADER */}
                  <th 
                    onClick={toggleSortId}
                    className="py-3.5 sm:py-4 px-4 sm:px-6 w-32 cursor-pointer hover:bg-gray-200/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Incident ID</span>
                      {sortBy === 'id_desc' ? (
                        <ArrowDown size={13} className="text-[#b32d2d]" />
                      ) : sortBy === 'id_asc' ? (
                        <ArrowUp size={13} className="text-[#b32d2d]" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 sm:py-4 px-4 sm:px-6">EMERGENCY CATEGORY</th>
                  <th className="py-3.5 sm:py-4 px-4 sm:px-6">Barangay</th>
                  <th className="py-3.5 sm:py-4 px-4 sm:px-6">Nearest Responder</th>

                  {/* SORTABLE DISTANCE HEADER */}
                  <th 
                    onClick={toggleSortDistance}
                    className="py-3.5 sm:py-4 px-4 sm:px-6 text-right cursor-pointer hover:bg-gray-200/60 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Distance (KM)</span>
                      {sortBy === 'dist_asc' ? (
                        <ArrowUp size={13} className="text-[#b32d2d]" />
                      ) : sortBy === 'dist_desc' ? (
                        <ArrowDown size={13} className="text-[#b32d2d]" />
                      ) : (
                        <ArrowUpDown size={13} className="text-gray-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 sm:py-4 px-4 sm:px-6 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-bold">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={18} />
                      Calculating telemetry distances...
                    </td>
                  </tr>
                ) : sortedMatrixData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      No active incidents require dispatch routing.
                    </td>
                  </tr>
                ) : (
                  sortedMatrixData.map((row) => (
                    <tr 
                      key={row.report_id} 
                      className="hover:bg-gray-50/80 transition-all duration-200"
                    >
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 font-bold text-gray-500">
                        #{row.report_id}
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 font-bold text-gray-800 max-w-xs truncate" title={row.category}>
                        <span>{row.category}</span>
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 font-medium text-gray-600">Brgy. {row.barangay}</td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 font-bold text-gray-800">
                        {typeof row.nearest_responder === 'object' ? row.nearest_responder?.name : row.nearest_responder}
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-right font-black text-red-600">
                        <span className="flex items-center justify-end gap-1">
                          <Navigation size={12} className="rotate-45" /> ▻ {row.distance_km.toFixed(2)} km
                        </span>
                      </td>
                      <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-center">
                        <button
                          onClick={() => { setSelectedReportRow(row); setIsReportModalOpen(true); }}
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

      </div>

      {/* INSPECTION MODAL */}
      {isReportModalOpen && selectedReportRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col my-auto">
            <div className="bg-[#b32d2d] px-5 sm:px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={22} className="shrink-0" />
                <div>
                  <h3 className="font-bold text-sm sm:text-base tracking-tight">Incident #{selectedReportRow.report_id} Telemetry</h3>
                  <p className="text-red-100 text-[11px]">Proximity Matrix</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="font-bold text-gray-400 text-[10px] uppercase">Emergency Category</span>
                  <span className="font-black text-gray-900 text-xs">{selectedReportRow.category}</span>
                </div>
                <p className="text-gray-600 text-xs pt-1">{selectedReportRow.full_details}</p>
                <div className="pt-2 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div><span className="font-bold text-gray-400 block text-[9px]">BARANGAY</span><span className="font-semibold text-gray-800">Brgy. {selectedReportRow.barangay}</span></div>
                  <div>
                    <span className="font-bold text-gray-400 block text-[9px]">NEAREST RESPONDER</span>
                    <span className="font-bold text-gray-900">
                      {typeof selectedReportRow.nearest_responder === 'object' ? selectedReportRow.nearest_responder?.name : selectedReportRow.nearest_responder} ({selectedReportRow.distance_km.toFixed(2)} km)
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close Telemetry File
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}