import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Truck, Navigation, RefreshCw, Plus, Eye, Edit3, 
  Trash2, X, MapPin, Phone, AlertCircle, Building2, Radio, 
  CheckCircle2, RotateCcw, Loader2, CheckCircle, XCircle 
} from 'lucide-react';

import AdminLayout from '../components/header';

const targetHostname = window.location.hostname || '127.0.0.1';

// const API_BASE = 'https://api.aksyon.online';
const API_BASE = `http://${targetHostname}:8000`;
const EMERGENCY_UNITS_URL = `${API_BASE}/api/emergency-units/`;

export default function PrivilegedEmergencyUnitsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('units');
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [unitForm, setUnitForm] = useState({
    name: '',
    unit_type: 'hospital',
    address: '',
    latitude: '',
    longitude: '',
    contact_number: '',
    is_active: true
  });
  const [formError, setFormError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('ac_token') || '';
    if (!token) return { 'Content-Type': 'application/json' };
    const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
    return {
      'Content-Type': 'application/json',
      'Authorization': authPrefix
    };
  };

  const getUnitTypeLabel = (type) => {
    switch (String(type).toLowerCase()) {
      case 'fire': return 'Fire Engine';
      case 'hospital': return 'Ambulance / Medical';
      case 'police': return 'Rescue Truck / Police';
      default: return type || 'Rescue Truck';
    }
  };

  const fetchEmergencyUnits = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(EMERGENCY_UNITS_URL, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUnits(Array.isArray(data) ? data : (data?.results || []));
      } else if (res.status === 403) {
        setFormError("Privileged Admin verification failed. You do not have access to manage emergency units.");
      }
    } catch (err) {
      console.error("Failed to load emergency units:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencyUnits();
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setUnitForm({ name: '', unit_type: 'hospital', address: '', latitude: '', longitude: '', contact_number: '', is_active: true });
    setFormError('');
    setIsUnitModalOpen(true);
  };

  const openEditModal = (unit) => {
    setModalMode('edit');
    setSelectedUnit(unit);
    setUnitForm({
      name: unit.name || '',
      unit_type: unit.unit_type || 'hospital',
      address: unit.address || '',
      latitude: String(unit.latitude ?? ''),
      longitude: String(unit.longitude ?? ''),
      contact_number: unit.contact_number || '',
      is_active: unit.is_active ?? true
    });
    setFormError('');
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const payload = {
        name: unitForm.name.trim(),
        unit_type: unitForm.unit_type,
        address: unitForm.address.trim(),
        latitude: parseFloat(unitForm.latitude),
        longitude: parseFloat(unitForm.longitude),
        contact_number: unitForm.contact_number.trim(),
        is_active: unitForm.is_active
      };

      if (isNaN(payload.latitude) || isNaN(payload.longitude)) {
        throw new Error('Please enter valid numeric values for Latitude and Longitude.');
      }

      const isEdit = modalMode === 'edit';
      const finalEndpoint = isEdit ? `${EMERGENCY_UNITS_URL}${selectedUnit.id}/` : EMERGENCY_UNITS_URL;

      const res = await fetch(finalEndpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(errData) || 'Failed to save emergency unit record.');
      }

      setIsUnitModalOpen(false);
      fetchEmergencyUnits();
    } catch (err) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unit) => {
    if (!window.confirm(`Are you sure you want to delete emergency unit "${unit.name}"?`)) return;

    try {
      const res = await fetch(`${EMERGENCY_UNITS_URL}${unit.id}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        setUnits(prev => prev.filter(u => u.id !== unit.id));
      }
    } catch (err) {
      console.error("Delete unit failed:", err);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0] font-sans">
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#b32d2d] text-white rounded-full p-2.5">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="font-bold text-2xl text-gray-900">Privileged Fleet Management Console</h2>
              <p className="text-xs text-gray-500 font-medium">Create, modify, and manage emergency response bases</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchEmergencyUnits}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh Data
            </button>
            <button 
              onClick={openCreateModal}
              className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} /> Register New Unit
            </button>
          </div>
        </div>

        {/* EMERGENCY UNITS INVENTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200 bg-gray-50/50">
            <h3 className="font-bold text-base text-gray-900">Privileged Emergency Units Console</h3>
            <span className="text-xs text-gray-400 font-bold">{units.length} Enrolled Stations</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6">Unit / Base Station</th>
                  <th className="py-4 px-6">Category Choice</th>
                  <th className="py-4 px-6">Address & Coordinates</th>
                  <th className="py-4 px-6">Contact Hotline</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={18} /> Querying database...
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      No emergency units registered in database.
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => {
                    const isActive = unit.is_active ?? true;
                    return (
                      <tr key={unit.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-gray-900 text-xs flex items-center gap-2">
                            <Building2 size={15} className="text-[#b32d2d] shrink-0" /> {unit.name}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-gray-50 text-gray-700">
                            {getUnitTypeLabel(unit.unit_type)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-600">
                          <div className="font-medium text-xs">{unit.address || 'Angeles City'}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{unit.latitude}, {unit.longitude}</div>
                        </td>
                        <td className="py-4 px-6 font-medium text-gray-700">{unit.contact_number || 'N/A'}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${
                            isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEditModal(unit)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all cursor-pointer">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => handleDeleteUnit(unit)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CREATE / EDIT MODAL */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <h3 className="font-bold text-base text-gray-900">
                  {modalMode === 'create' ? 'Register Emergency Unit' : 'Modify Emergency Unit'}
                </h3>
                <X size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setIsUnitModalOpen(false)} />
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              <form onSubmit={handleSaveUnit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Unit / Base Station Name</label>
                  <input 
                    type="text" required placeholder="e.g. Angeles City Central Fire Station"
                    value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Unit Type</label>
                    <select 
                      value={unitForm.unit_type} onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none bg-white cursor-pointer"
                    >
                      <option value="hospital">Hospital (Ambulance)</option>
                      <option value="police">Police Department</option>
                      <option value="fire">Fire Department</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Contact Hotline</label>
                    <input 
                      type="text" required placeholder="e.g. 0451234567"
                      value={unitForm.contact_number} onChange={(e) => setUnitForm({ ...unitForm, contact_number: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Latitude</label>
                    <input 
                      type="text" required placeholder="e.g. 15.16466"
                      value={unitForm.latitude} onChange={(e) => setUnitForm({ ...unitForm, latitude: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1">Longitude</label>
                    <input 
                      type="text" required placeholder="e.g. 120.60858"
                      value={unitForm.longitude} onChange={(e) => setUnitForm({ ...unitForm, longitude: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Address</label>
                  <input 
                    type="text" placeholder="e.g. MacArthur Highway, Angeles City"
                    value={unitForm.address} onChange={(e) => setUnitForm({ ...unitForm, address: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input 
                    type="checkbox" id="unitIsActivePriv" checked={unitForm.is_active}
                    onChange={(e) => setUnitForm({ ...unitForm, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-[#b32d2d] focus:ring-[#b32d2d] cursor-pointer"
                  />
                  <label htmlFor="unitIsActivePriv" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Station is Active & Available for Dispatch
                  </label>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button type="button" onClick={() => setIsUnitModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer">
                    {submitting && <Loader2 className="animate-spin" size={14} />}
                    {modalMode === 'create' ? 'Register Unit' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}