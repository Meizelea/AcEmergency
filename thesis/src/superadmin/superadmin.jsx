import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, UserPlus, Search, Edit3, Trash2, 
  Eye, EyeOff, CheckCircle, XCircle, Phone, MapPin, X, AlertCircle, Loader2, Lock, RefreshCw, AlertTriangle
} from 'lucide-react';

import AdminLayout from '../components/header';

// Full list of all 33 Barangays of Angeles City, Pampanga
export const ANGELES_BARANGAYS = [
  "Agapito del Rosario",
  "Amsic",
  "Anunas",
  "Balibago",
  "Capaya",
  "Claro M. Recto",
  "Cuayan",
  "Cutcut",
  "Cutud",
  "Lourdes Sur",
  "Lourdes Sur East",
  "Lourdes NorthWest",
  "Margavel",
  "Mining",
  "Ninoy Aquino (Marisol)",
  "Pampang",
  "Pandan",
  "Plaridel",
  "Poblacion",
  "Pulung Cacutud",
  "Pulung Maragul",
  "Pulungbulalu",
  "Salapungan",
  "San Jose",
  "San Nicolas",
  "Santa Teresita",
  "Santa Trinidad",
  "Santo Cristo",
  "Santo Domingo",
  "Santo Rosario",
  "Sapangbato",
  "Tabun",
  "Vigen de los Remedios"
];

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';
const CACHE_KEY_ADMINS = 'cache_super_admins_v1';

/* ---------------------------------- helpers ---------------------------------- */

const readCachedAdmins = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_ADMINS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const parseJsonSafe = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

function formatApiError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);

  const parts = Object.entries(data).map(([field, messages]) => {
    const text = Array.isArray(messages)
      ? messages.join(' ')
      : typeof messages === 'object'
        ? JSON.stringify(messages)
        : String(messages);
    const label = field === 'non_field_errors' ? '' : `${field.replace(/_/g, ' ')}: `;
    return `${label}${text}`;
  });

  return parts.length ? parts.join(' | ') : fallback;
}

async function authFetch(url, options = {}) {
  const cleanToken = (localStorage.getItem('ac_token') || '').replace(/^(Token|Bearer)\s+/i, '').trim();
  if (!cleanToken) return null;

  let res = null;

  for (const prefix of ['Token', 'Bearer']) {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${prefix} ${cleanToken}`,
        ...(options.headers || {})
      }
    });

    if (res.status === 401) continue;

    if (res.status === 403) {
      const body = await parseJsonSafe(res.clone());
      const detail = String(body?.detail || '').toLowerCase();
      if (detail.includes('credentials were not provided')) continue;
    }

    return res;
  }

  return res;
}

/* ---------------------------------- page ---------------------------------- */

export default function SuperAdminPage() {
  const navigate = useNavigate();

  const [admins, setAdmins] = useState(readCachedAdmins);
  const [isLoading, setIsLoading] = useState(() => readCachedAdmins().length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [pageError, setPageError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  const hasDataRef = useRef(admins.length > 0);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  // Status Change Modal State
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    admin: null,
    isSubmitting: false
  });

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
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    try {
      localStorage.removeItem(CACHE_KEY_ADMINS);
    } catch {
      /* ignore */
    }
  }, []);

  const reportFailure = useCallback(async (response, fallback) => {
    if (!response || response.status === 401) {
      setSessionExpired(true);
      setPageError('Your session has expired. Please log in again.');
      return;
    }

    const data = await parseJsonSafe(response);
    setPageError(formatApiError(data, `${fallback} (${response.status}).`));
  }, []);

  // 1. Fetch Administrators List
  const fetchAdmins = useCallback(async () => {
    const cleanToken = (localStorage.getItem('ac_token') || '').replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) {
      navigate('/login');
      return;
    }

    if (!hasDataRef.current) setIsLoading(true);
    setPermissionDenied(false);
    setPageError('');
    setSessionExpired(false);

    try {
      let res = await authFetch(`${API_BASE}/api/users/privileged-admin/`);

      if (res && res.status === 404) {
        res = await authFetch(`${API_BASE}/api/users/admin/`);
      }

      if (res && res.status === 403) {
        setPermissionDenied(true);
        return;
      }

      if (!res || !res.ok) {
        await reportFailure(res, 'Failed to load the admin roster');
        return;
      }

      const data = await res.json();
      const userList = Array.isArray(data) ? data : (data?.results || []);

      const barangayAdmins = userList.filter((u) => {
        const isPrivileged =
          u.is_superuser === true ||
          u.role?.toUpperCase() === 'PRIVILEGED_ADMIN' ||
          u.username === 'g2c405';

        return !isPrivileged;
      });

      setAdmins(barangayAdmins);
      hasDataRef.current = true;
      try {
        sessionStorage.setItem(CACHE_KEY_ADMINS, JSON.stringify(barangayAdmins));
      } catch {
        /* storage unavailable */
      }
    } catch (error) {
      console.error("Failed to load admin roster:", error);
      setPageError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, reportFailure]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Modal Openers
  const openCreateModal = () => {
    setModalMode('create');
    setShowPassword(false);
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
    setShowPassword(false);
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

  const openStatusConfirmModal = (admin) => {
    setStatusModal({
      isOpen: true,
      admin: admin,
      isSubmitting: false
    });
  };

  // 2. Create / Update Admin Record with 11-digit Phone Validation
  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    setFormError('');

    const phoneDigitsOnly = formData.contact_number.replace(/\D/g, '');
    if (phoneDigitsOnly.length !== 11) {
      setFormError('Contact number must be exactly 11 digits (e.g., 09171234567).');
      return;
    }

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
        contact_number: phoneDigitsOnly
      };

      if (formData.password && formData.password.trim() !== '') {
        payload.password = formData.password;
      }

      const primaryUrl = isEdit
        ? `${API_BASE}/api/users/privileged-admin/${selectedAdmin.id}/`
        : `${API_BASE}/api/users/privileged-admin/register/`;

      const fallbackUrl = isEdit
        ? `${API_BASE}/api/users/admin/${selectedAdmin.id}/`
        : `${API_BASE}/api/users/admin/`;

      const options = {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      };

      let response = await authFetch(primaryUrl, options);

      if (response && response.status === 404) {
        response = await authFetch(fallbackUrl, options);
      }

      if (!response) {
        setFormError('You are not logged in. Please log in again.');
        return;
      }

      if (!response.ok) {
        const errorData = await parseJsonSafe(response);

        if (response.status === 401) {
          setFormError('Your session has expired. Please log in again, then retry.');
        } else if (response.status === 403) {
          setFormError(formatApiError(errorData, 'You do not have permission to do this.'));
        } else {
          setFormError(formatApiError(errorData, `Request failed (${response.status}).`));
        }
        return;
      }

      setIsModalOpen(false);
      fetchAdmins();
    } catch (err) {
      console.error(err);
      setFormError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Toggle Status Active / Disabled via Modal Action
  const handleExecuteStatusToggle = async () => {
    const admin = statusModal.admin;
    if (!admin) return;

    const currentActiveState = admin.is_active ?? true;
    setStatusModal(prev => ({ ...prev, isSubmitting: true }));
    setPageError('');
    setSessionExpired(false);

    try {
      const options = {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentActiveState })
      };

      let response = await authFetch(`${API_BASE}/api/users/privileged-admin/${admin.id}/`, options);

      if (response && response.status === 404) {
        response = await authFetch(`${API_BASE}/api/users/admin/${admin.id}/`, options);
      }

      if (response && response.ok) {
        setAdmins((prev) => {
          const updatedAdmins = prev.map((a) =>
            a.id === admin.id ? { ...a, is_active: !currentActiveState } : a
          );
          try {
            sessionStorage.setItem(CACHE_KEY_ADMINS, JSON.stringify(updatedAdmins));
          } catch {
            /* ignore */
          }
          return updatedAdmins;
        });
        setStatusModal({ isOpen: false, admin: null, isSubmitting: false });
      } else {
        await reportFailure(response, 'Could not update the admin status');
        setStatusModal(prev => ({ ...prev, isSubmitting: false }));
      }
    } catch (error) {
      console.error("Status update error:", error);
      setPageError('Could not reach the server. Check your connection and try again.');
      setStatusModal(prev => ({ ...prev, isSubmitting: false }));
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

        {/* Page-level error banner */}
        {pageError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 text-xs font-semibold text-red-700">
              <AlertCircle size={18} className="shrink-0" />
              <span>{pageError}</span>
            </div>
            {sessionExpired && (
              <button
                onClick={() => navigate('/login')}
                className="shrink-0 bg-[#b32d2d] hover:bg-[#8b2323] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Log in again
              </button>
            )}
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
              onClick={() => fetchAdmins()}
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
                              onClick={() => openStatusConfirmModal(admin)} 
                              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                isActive ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                              }`}
                              title={isActive ? "Disable Admin Account" : "Activate Admin Account"}
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
                  <AlertCircle size={16} className="shrink-0" /> {formError}
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
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required={modalMode === 'create'}
                          value={formData.password} 
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full border border-gray-200 rounded-xl p-2.5 pr-9 text-xs text-gray-800 outline-none focus:border-[#b32d2d]" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
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
                      <label className="text-[11px] font-bold text-gray-600 block mb-1">
                        Contact Number <span className="text-[10px] text-gray-400 font-normal">(11 digits)</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        maxLength={11}
                        placeholder="09171234567"
                        value={formData.contact_number} 
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, contact_number: cleaned });
                        }}
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

      {/* STATUS CONFIRMATION MODAL */}
      {statusModal.isOpen && statusModal.admin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center my-auto">
            
            <div className={`p-3.5 rounded-full mb-4 ${
              (statusModal.admin.is_active ?? true) ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertTriangle size={26} />
            </div>
            
            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              {(statusModal.admin.is_active ?? true) ? 'Disable Administrator Account' : 'Activate Administrator Account'}
            </h3>
            
            <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
              Are you sure you want to {(statusModal.admin.is_active ?? true) ? 'disable' : 'reactivate'} admin account for{' '}
              <span className="font-bold text-gray-800">@{statusModal.admin.username}</span>?
              {(statusModal.admin.is_active ?? true) && ' They will temporarily lose access to their command dashboard until enabled again.'}
            </p>

            <div className="flex items-center gap-2.5 w-full">
              <button
                type="button"
                disabled={statusModal.isSubmitting}
                onClick={() => setStatusModal({ isOpen: false, admin: null, isSubmitting: false })}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                type="button"
                disabled={statusModal.isSubmitting}
                onClick={handleExecuteStatusToggle}
                className={`flex-1 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  (statusModal.admin.is_active ?? true)
                    ? 'bg-[#b32d2d] hover:bg-[#8b2323]'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusModal.isSubmitting && <Loader2 className="animate-spin" size={14} />}
                {(statusModal.admin.is_active ?? true) ? 'Disable Admin' : 'Activate Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}