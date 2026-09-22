import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, UserPlus, Search, Edit3, Trash2, 
  Eye, CheckCircle, XCircle, Phone, MapPin, X, AlertCircle, Loader2 
} from 'lucide-react';

import AdminLayout from '../components/header';

// Backend Valid Choices (core/choices.py)
export const ANGELES_BARANGAYS = [
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

const API_BASE = 'http://localhost:8000';

export default function SuperAdminPage() {
  const navigate = useNavigate();

  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Token & Header extraction
  const getAuthHeaders = (isJson = true) => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    const headers = {};
    if (cleanToken) {
      headers['Authorization'] = `Token ${cleanToken}`;
    }
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  // 1. Fetch Administrators List
  const fetchAdmins = async () => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) {
      navigate('/login');
      return;
    }

    setIsLoading(true);
    try {
      let res = await fetch(`${API_BASE}/api/users/admin/`, {
        headers: getAuthHeaders(),
      });

      // Bearer token fallback if Token prefix gets 401
      if (res.status === 401) {
        res = await fetch(`${API_BASE}/api/users/admin/`, {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
        });
      }

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const userList = Array.isArray(data) ? data : (data?.results || []);

      // Filter: Keep active staff/superusers/assigned barangay users
      const adminUsers = userList.filter(u => 
        (u.assigned_barangay !== null && u.assigned_barangay !== undefined && u.assigned_barangay !== '') ||
        u.is_superuser === true ||
        u.is_staff === true ||
        u.role?.toUpperCase() === 'ADMIN' ||
        u.role?.toUpperCase() === 'PRIVILEGED_ADMIN' ||
        u.username === 'admin'
      );

      setAdmins(adminUsers.length > 0 ? adminUsers : userList);
    } catch (error) {
      console.error("Failed to load admin roster:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

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
    setModalMode('edit');
    setSelectedAdmin(admin);
    setFormData({
      username: admin.username || '',
      email: admin.email || '',
      password: '',
      first_name: admin.first_name || '',
      last_name: admin.last_name || '',
      barangay: ANGELES_BARANGAYS.includes(admin.assigned_barangay) ? admin.assigned_barangay : ANGELES_BARANGAYS[0],
      contact_number: admin.contact_number || admin.phone_number || ''
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
      const rawToken = localStorage.getItem('ac_token') || '';
      const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
      const isEdit = modalMode === 'edit';
      const endpoint = isEdit 
        ? `${API_BASE}/api/users/admin/${selectedAdmin.id}/` 
        : `${API_BASE}/api/users/admin/`;
      
      const payload = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        assigned_barangay: formData.barangay,
        contact_number: formData.contact_number
      };

      if (formData.password && formData.password.trim() !== '') {
        payload.password = formData.password;
      }

      let response = await fetch(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        response = await fetch(endpoint, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
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
      const rawToken = localStorage.getItem('ac_token') || '';
      const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();

      let response = await fetch(`${API_BASE}/api/users/admin/${admin.id}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !currentActiveState })
      });

      if (response.status === 401) {
        response = await fetch(`${API_BASE}/api/users/admin/${admin.id}/`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_active: !currentActiveState })
        });
      }

      if (response.ok) {
        setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, is_active: !currentActiveState } : a));
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
    const brgy = (admin.assigned_barangay || '').toLowerCase();
    return fullName.includes(query) || username.includes(query) || brgy.includes(query);
  });

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f3f4f6]">
        
        {/* HEADER TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative bg-white border border-gray-200 rounded-xl flex items-center shadow-xs w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-3.5" />
              <input 
                type="text" 
                placeholder="Search admin name, username, or brgy..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2.5 px-3 text-xs font-medium text-gray-700 focus:outline-none" 
              />
            </div>
          </div>

          <button 
            onClick={openCreateModal}
            className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-95"
          >
            <UserPlus size={16} /> Register New Admin
          </button>
        </div>

        {/* MASTER TABLE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-base text-gray-900 tracking-tight">System Administrators Directory</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">{filteredAdmins.length} Active Staff</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Admin Name</th>
                  <th className="py-3.5 px-6">Assigned Barangay</th>
                  <th className="py-3.5 px-6">Contact Number</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right w-44">Actions</th>
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
                ) : filteredAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-medium">
                      No admin accounts found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredAdmins.map((admin) => {
                    const isActive = admin.is_active ?? true;
                    return (
                      <tr key={admin.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-6">
                          <div className="font-bold text-gray-800 text-sm">
                            {admin.first_name || admin.last_name ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() : admin.username}
                          </div>
                          <div className="text-[11px] text-gray-400 font-medium mt-0.5">@{admin.username}</div>
                        </td>
                        <td className="py-4 px-6 text-xs font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#b32d2d] shrink-0" />
                            <span>Brgy. {admin.assigned_barangay || 'Central Command'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-xs text-gray-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Phone size={14} className="text-gray-400 shrink-0" />
                            <span>{admin.contact_number || admin.phone_number || 'No phone set'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 w-fit ${
                            isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => openViewModal(admin)} 
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                              title="View Admin File"
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              onClick={() => openEditModal(admin)} 
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                              title="Edit Admin Information"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              onClick={() => handleToggleAdminStatus(admin)} 
                              className={`p-1.5 rounded-lg transition-all ${
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={22} className="text-[#b32d2d]" />
                  <h3 className="font-bold text-base text-gray-900">
                    {modalMode === 'create' ? 'Register New Admin' : modalMode === 'edit' ? 'Update Admin Record' : 'Administrator Details'}
                  </h3>
                </div>
                <X size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setIsModalOpen(false)} />
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              {/* View Only Mode */}
              {modalMode === 'view' && selectedAdmin && (
                <div className="space-y-3.5 text-xs text-gray-600">
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
                    <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Full Name</label>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedAdmin.first_name || selectedAdmin.last_name ? `${selectedAdmin.first_name || ''} ${selectedAdmin.last_name || ''}`.trim() : selectedAdmin.username}
                    </p>
                  </div>
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Username</label>
                      <p className="text-xs font-semibold text-[#b32d2d]">@{selectedAdmin.username}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Assigned Station</label>
                      <p className="text-xs font-bold text-gray-700">Brgy. {selectedAdmin.assigned_barangay || 'Central Command'}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Contact Number</label>
                      <p className="text-xs font-medium text-gray-700">{selectedAdmin.contact_number || selectedAdmin.phone_number || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400 block mb-0.5">Email Routing</label>
                      <p className="text-xs font-medium text-gray-700">{selectedAdmin.email || 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="mt-4 w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-colors">
                    Close File
                  </button>
                </div>
              )}

              {/* Create / Edit Form Mode */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <form onSubmit={handleSaveAdmin} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
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

                  <div className="grid grid-cols-2 gap-3">
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

                  <div className="grid grid-cols-2 gap-3">
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
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
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