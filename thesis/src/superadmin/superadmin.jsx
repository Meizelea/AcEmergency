import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, UserPlus, Search, Edit3, Trash2, 
  Eye, CheckCircle, XCircle, Phone, MapPin, X, AlertCircle, Loader2, Lock, RefreshCw
} from 'lucide-react';

import AdminLayout from '../components/header';

// Updated Angeles Barangay Choices from image list
export const ANGELES_BARANGAYS = [
  "Agapito del Rosario",
  "Santo Rosario",
  "Tabun",
  "Cutud",
  "Marisol"
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';
const CACHE_KEY_ADMINS = 'cache_super_admins_v1';

export default function SuperAdminPage() {
  const navigate = useNavigate();

  const [admins, setAdmins] = useState(() => {
    const cached = localStorage.getItem(CACHE_KEY_ADMINS);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(() => admins.length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    barangay: ANGELES_BARANGAYS[0],
    contact_number: ''
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Helper to extract barangay from all possible backend field names
  const getAdminBarangay = (admin) => {
    return (
      admin?.assigned_barangay ||
      admin?.residential_barangay ||
      admin?.barangay ||
      null
    );
  };

  // Helper to extract contact number
  const getAdminContact = (admin) => {
    return admin?.contact_number || admin?.phone_number || null;
  };

  // Token & Header extraction supporting both Token and Bearer headers
  const getAuthHeaders = useCallback((useBearer = false) => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return { 'Authorization': `${authPrefix} ${cleanToken}`, 'Content-Type': 'application/json' };
  }, []);

  // 1. Fetch Administrators List
  const fetchAdmins = useCallback(async () => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) {
      navigate('/login');
      return;
    }

    if (admins.length === 0) setIsLoading(true);
    setPermissionDenied(false);

    try {
      let res = null;
      let data = null;

      for (const useBearer of [false, true]) {
        res = await fetch(`${API_BASE}/api/users/privileged-admin/`, {
          headers: getAuthHeaders(useBearer),
        });

        if (res.status === 404) {
          res = await fetch(`${API_BASE}/api/users/admin/`, {
            headers: getAuthHeaders(useBearer),
          });
        }

        if (res.status === 403) {
          setPermissionDenied(true);
          setIsLoading(false);
          return;
        }

        if (res.ok) {
          data = await res.json();
          break;
        }
      }

      if (!res || !res.ok) {
        throw new Error(`Server returned ${res?.status || 'Unknown error'}`);
      }

      const userList = Array.isArray(data) ? data : (data?.results || []);

      const barangayAdmins = userList.filter((u) => {
        const isPrivileged =
          u.is_superuser === true ||
          u.role?.toUpperCase() === 'PRIVILEGED_ADMIN' ||
          u.username === 'g2c405';

        return !isPrivileged;
      });

      setAdmins(barangayAdmins);
      localStorage.setItem(CACHE_KEY_ADMINS, JSON.stringify(barangayAdmins));
    } catch (error) {
      console.error("Failed to load admin roster:", error);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, getAuthHeaders, admins.length]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Modal Openers
  const openCreateModal = () => {
    setModalMode('create');
    setFormData({
      username: '',
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      barangay: ANGELES_BARANGAYS[0],
      contact_number: ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (admin) => {
    const currentBrgy = getAdminBarangay(admin);
    setModalMode('edit');
    setSelectedAdmin(admin);
    setFormData({
      username: admin.username || '',
      email: admin.email || '',
      password: '',
      first_name: admin.first_name || '',
      last_name: admin.last_name || '',
      barangay: ANGELES_BARANGAYS.includes(currentBrgy) ? currentBrgy : ANGELES_BARANGAYS[0],
      contact_number: getAdminContact(admin) || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openViewModal = (admin) => {
    setModalMode('view');
    setSelectedAdmin(admin);
    setIsModalOpen(true);
  };

  // 2. Create / Update Admin Record
  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const isEdit = modalMode === 'edit';
      const payload = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        assigned_barangay: formData.barangay,
        residential_barangay: formData.barangay,
        barangay: formData.barangay,
        contact_number: formData.contact_number
      };

      if (formData.password && formData.password.trim() !== '') {
        payload.password = formData.password;
      }

      let response = null;
      for (const useBearer of [false, true]) {
        const endpoint = isEdit 
          ? `${API_BASE}/api/users/privileged-admin/${selectedAdmin.id}/` 
          : `${API_BASE}/api/users/privileged-admin/register/`;

        response = await fetch(endpoint, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: getAuthHeaders(useBearer),
          body: JSON.stringify(payload)
        });

        if (response.status === 404) {
          const fallbackEndpoint = isEdit 
            ? `${API_BASE}/api/users/admin/${selectedAdmin.id}/` 
            : `${API_BASE}/api/users/admin/`;

          response = await fetch(fallbackEndpoint, {
            method: isEdit ? 'PATCH' : 'POST',
            headers: getAuthHeaders(useBearer),
            body: JSON.stringify(payload)
          });
        }

        if (response.ok) break;
      }

      if (!response || !response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(JSON.stringify(errorData) || 'Failed to save admin record');
      }

      setIsModalOpen(false);
      fetchAdmins();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Operation failed. Verify field requirements.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Toggle Status Active / Disabled
  const handleToggleAdminStatus = async (admin) => {
    const currentActiveState = admin.is_active ?? true;
    const actionText = currentActiveState ? 'disable' : 'activate';
    
    if (!window.confirm(`Are you sure you want to ${actionText} admin @${admin.username}?`)) {
      return;
    }

    try {
      let response = null;
      for (const useBearer of [false, true]) {
        response = await fetch(`${API_BASE}/api/users/privileged-admin/${admin.id}/`, {
          method: 'PATCH',
          headers: getAuthHeaders(useBearer),
          body: JSON.stringify({ is_active: !currentActiveState })
        });

        if (response.status === 404) {
          response = await fetch(`${API_BASE}/api/users/admin/${admin.id}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(useBearer),
            body: JSON.stringify({ is_active: !currentActiveState })
          });
        }

        if (response.ok) break;
      }

      if (response && response.ok) {
        const updatedAdmins = admins.map(a => a.id === admin.id ? { ...a, is_active: !currentActiveState } : a);
        setAdmins(updatedAdmins);
        localStorage.setItem(CACHE_KEY_ADMINS, JSON.stringify(updatedAdmins));
      }
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  // Search Filter
  const filteredAdmins = admins.filter(admin => {
    const query = searchQuery.toLowerCase();
    const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.toLowerCase();
    const username = (admin.username || '').toLowerCase();
    const brgy = (getAdminBarangay(admin) || '').toLowerCase();
    return fullName.includes(query) || username.includes(query) || brgy.includes(query);
  });

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f3f4f6] font-sans flex flex-col">
        
        {/* Permission 403 Warning Banner */}
        {permissionDenied && (
          <div className="mb-6 p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 shrink-0">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Access Restricted to Privileged Admins</h4>
              <p className="text-xs text-amber-700 mt-1">
                Your account does not possess privileged administration permissions to view or edit the administrators directory.
              </p>
            </div>
          </div>
        )}

        {/* HEADER TOOLBAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search admin name, username, or brgy..." 
              value={searchQuery} 
              disabled={permissionDenied}
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full py-2.5 pl-10 pr-3 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none disabled:bg-gray-50 shadow-xs" 
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={fetchAdmins}
              disabled={isLoading || permissionDenied}
              className="flex-1 sm:flex-none bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin text-[#b32d2d]" : ""} /> 
              {isLoading ? "Refreshing..." : "Refresh Roster"}
            </button>

            <button 
              onClick={openCreateModal}
              disabled={permissionDenied}
              className="flex-1 sm:flex-none bg-[#b32d2d] hover:bg-[#8b2323] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus size={16} /> Register New Admin
            </button>
          </div>
        </div>

        {/* MASTER TABLE CONTAINER */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-sm sm:text-base text-gray-900 tracking-tight">System Administrators Directory</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">{filteredAdmins.length} Barangay Admins</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4 sm:px-6 min-w-[180px]">Admin Name</th>
                  <th className="py-3.5 px-4 sm:px-6 min-w-[160px] whitespace-nowrap">Assigned Barangay</th>
                  <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap">Contact Number</th>
                  <th className="py-3.5 px-4 sm:px-6 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-medium">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={18} />
                      Querying administrator roster...
                    </td>
                  </tr>
                ) : permissionDenied ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-medium">
                      403 Forbidden: Privileged admin credentials required.
                    </td>
                  </tr>
                ) : filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-medium">
                      No barangay admin accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => {
                    const isActive = admin.is_active ?? true;
                    const brgy = getAdminBarangay(admin);
                    const contact = getAdminContact(admin);

                    return (
                      <tr key={admin.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 sm:py-4 px-4 sm:px-6">
                          <div className="font-bold text-gray-800 text-sm">
                            {admin.first_name || admin.last_name ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() : admin.username}
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium mt-0.5">@{admin.username}</div>
                        </td>
                        <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-xs font-semibold text-gray-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#b32d2d]" />
                            <span>{brgy ? `Brgy. ${brgy}` : 'Central Command'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-xs text-gray-600 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Phone size={14} className="text-gray-400 shrink-0" />
                            <span>{contact || 'No phone set'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 sm:py-4 px-4 sm:px-6 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 shrink-0 ${
                            isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3.5 sm:py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => openViewModal(admin)} 
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all cursor-pointer"
                              title="View Admin File"
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              onClick={() => openEditModal(admin)} 
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all cursor-pointer"
                              title="Edit Admin Information"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              onClick={() => handleToggleAdminStatus(admin)} 
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                isActive ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                              }`}
                              title={isActive ? "Disable Admin" : "Enable Admin"}
                            >
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

      {/* CRUD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="p-4 sm:p-6 flex flex-col h-full overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5 shrink-0">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={22} className="text-[#b32d2d]" />
                  <h3 className="font-bold text-sm sm:text-base text-gray-900">
                    {modalMode === 'create' ? 'Register New Admin' : modalMode === 'edit' ? 'Update Admin Record' : 'Administrator Details'}
                  </h3>
                </div>
                <X size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setIsModalOpen(false)} />
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              {/* View Only Mode */}
              {modalMode === 'view' && selectedAdmin && (
                <div className="space-y-3.5 text-xs text-gray-600 flex-1">
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                    <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Full Name</label>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedAdmin.first_name || selectedAdmin.last_name ? `${selectedAdmin.first_name || ''} ${selectedAdmin.last_name || ''}`.trim() : selectedAdmin.username}
                    </p>
                  </div>
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Username</label>
                      <p className="text-xs font-semibold text-[#b32d2d]">@{selectedAdmin.username}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Assigned Station</label>
                      <p className="text-xs font-bold text-gray-700">
                        {getAdminBarangay(selectedAdmin) ? `Brgy. ${getAdminBarangay(selectedAdmin)}` : 'Central Command'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Contact Number</label>
                      <p className="text-xs font-medium text-gray-700">{getAdminContact(selectedAdmin) || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Email Routing</label>
                      <p className="text-xs font-medium text-gray-700">{selectedAdmin.email || 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="mt-4 w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer">
                    Close File
                  </button>
                </div>
              )}

              {/* Create / Edit Form Mode */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <form onSubmit={handleSaveAdmin} className="space-y-4 text-xs flex-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.first_name} 
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.last_name} 
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Username</label>
                      <input 
                        type="text" 
                        required
                        value={formData.username} 
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">
                        Password {modalMode === 'edit' && <span className="text-[10px] text-gray-400 font-normal">(leave blank to keep)</span>}
                      </label>
                      <input 
                        type="password" 
                        required={modalMode === 'create'}
                        value={formData.password} 
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Assigned Barangay</label>
                      <select 
                        value={formData.barangay} 
                        onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d] bg-white cursor-pointer"
                      >
                        {ANGELES_BARANGAYS.map((brgy) => (
                          <option key={brgy} value={brgy}>{brgy}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">Contact Number</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. 09171234567"
                        value={formData.contact_number} 
                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">Email Address</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                    />
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {submitting && <Loader2 className="animate-spin" size={14} />}
                      {modalMode === 'create' ? 'Create Admin Account' : 'Save Changes'}
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