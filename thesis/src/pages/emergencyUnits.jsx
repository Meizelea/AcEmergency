import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, 
  RefreshCw, 
  Loader2, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Radio
} from 'lucide-react';

import AdminLayout from '../components/header';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  }
  return `https://api.aksyon.online`;
};

const API_BASE_URL = getApiBaseUrl();
const CACHE_KEY_UNITS = 'cache_admin_emergency_units_v1';

export default function EmergencyUnitsPage() {
  const navigate = useNavigate();

  // Load cached units or default to empty list
  const [units, setUnits] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_UNITS);
    return cached ? JSON.parse(cached) : [];
  });

  const [isLoading, setIsLoading] = useState(() => units.length === 0);
  const token = localStorage.getItem('ac_token');

  const getAuthHeaders = useCallback((useBearer = false) => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return { 'Authorization': `${authPrefix} ${cleanToken}`, 'Content-Type': 'application/json' };
  }, [token]);

  // Fetch only emergency responder units
  const fetchEmergencyUnits = useCallback(async () => {
    for (const useBearer of [false, true]) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/emergency-units/`, { 
          headers: getAuthHeaders(useBearer) 
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.results || []);
          setUnits(list);
          sessionStorage.setItem(CACHE_KEY_UNITS, JSON.stringify(list));
          return;
        }
      } catch (err) {
        console.error("Failed to load emergency units:", err);
      }
    }
  }, [getAuthHeaders]);

  const synchronizeData = useCallback(async (silent = false) => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!silent && units.length === 0) setIsLoading(true);
    await fetchEmergencyUnits();
    setIsLoading(false);
  }, [token, navigate, fetchEmergencyUnits, units.length]);

  // Polling refresh (15s interval)
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

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] font-sans flex flex-col space-y-6">
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#b32d2d] text-white rounded-full p-2.5 shrink-0 shadow-xs">
              <Truck size={22} />
            </div>
            <div>
              <h2 className="font-bold text-xl sm:text-2xl text-gray-900">Emergency Units Directory</h2>
              <p className="text-xs text-gray-500 font-medium">Active emergency responder stations and dispatch units.</p>
            </div>
          </div>

          <button 
            onClick={() => synchronizeData(false)}
            disabled={isLoading}
            className="w-full sm:w-auto bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-[#b32d2d]" : ""} /> 
            {isLoading ? "Syncing..." : "Refresh Units"}
          </button>
        </div>

        {/* EMERGENCY UNITS DIRECTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-sm sm:text-base text-gray-900 flex items-center gap-2">
              <Radio size={16} className="text-[#b32d2d]" /> Registered Responder Stations
            </h3>
            <span className="text-xs text-gray-900 font-black">
              {units.length} Total Registered Units
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider select-none">
                  <th className="py-3.5 px-6">UNIT / STATION NAME</th>
                  <th className="py-3.5 px-6">UNIT TYPE</th>
                  <th className="py-3.5 px-6">LOCATION / BARANGAY</th>
                  <th className="py-3.5 px-6">CONTACT NUMBER</th>
                  <th className="py-3.5 px-6 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-bold">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={18} />
                      Loading emergency unit records...
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-medium">
                      No emergency responder units registered.
                    </td>
                  </tr>
                ) : (
                  units.map((unit, index) => (
                    <tr key={unit.id || index} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900 flex items-center gap-2">
                        <Truck size={16} className="text-[#b32d2d] shrink-0" />
                        {unit.name || unit.station_name || 'Emergency Base Unit'}
                      </td>
                      <td className="py-4 px-6 font-semibold text-gray-700 uppercase">
                        <span className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-[10px] font-bold">
                          {unit.type || unit.unit_type || 'General Responder'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-gray-400 shrink-0" />
                          <span>{unit.barangay || unit.location || 'Central Base'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-800">
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-emerald-600 shrink-0" />
                          <span>{unit.contact_number || unit.phone || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          String(unit.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          <ShieldCheck size={12} />
                          {unit.status || 'ACTIVE'}
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