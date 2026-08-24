import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, UserPlus, Search, Edit3, Trash2, 
  Eye, CheckCircle, XCircle, Phone, MapPin, X, AlertCircle 
} from 'lucide-react';

import AdminLayout from '../components/AdminLayout';

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
  "Lourdes North West",
  "Lourdes Sur",
  "Lourdes Sur East",
  "Malabanias",
  "Margot",
  "Mining",
  "Ninoy Aquino (Marisol)",
  "Pampang",
  "Pandan",
  "Pulung Bulu",
  "Pulung Cacutud",
  "Pulung Maragul",
  "Salapungan",
  "San Jose",
  "San Nicolas",
  "Santa Teresita",
  "Santa Trinidad",
  "Santo Cristo",
  "Santo Domingo",
  "Santo Rosario",
  "Sapalibutad",
  "Sapangbato",
  "Tabun",
  "Virgen Delos Remedios"
];

export default function SuperAdminPage() {
  const navigate = useNavigate();

  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'view'
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

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';

  // 1. READ: Fetch all Admins
  const fetchAdmins = async () => {
    if (!token) return;
    try {
      const response = await fetch(`http://${targetHostname}:8000/api/users/admin/users/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        }
      });
      const data = await response.json();
      const userList = Array.isArray(data) ? data : (data?.results || []);

      // Filter only admins / staff members
      const adminUsers = userList.filter(u => u.is_staff === true || String(u.is_staff).toLowerCase() === 'true');
      setAdmins(adminUsers);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load admin roster:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchAdmins();
  }, [token, navigate]);

  // Modal Triggers
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
      password: '', // Leave blank unless updating
      first_name: admin.first_name || '',
      last_name: admin.last_name || '',
      barangay: admin.barangay || ANGELES_BARANGAYS[0],
      contact_number: admin.contact_number || admin.phone || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openViewModal = (admin) => {
    setModalMode('view');
    setSelectedAdmin(admin);
    setIsModalOpen(true);
  };

  // 2. CREATE / UPDATE Admin Handler
  const handleSaveAdmin = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      const isEdit = modalMode === 'edit';
      const endpoint = isEdit 
        ? `http://${targetHostname}:8000/api/users/admin/users/${selectedAdmin.id}/` 
        : `http://${targetHostname}:8000/api/users/admin/users/`;
      
      const payload = {
        username: formData.username,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        barangay: formData.barangay,
        contact_number: formData.contact_number,
        is_staff: true
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(endpoint, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData) || 'Failed to save admin record');
      }

      setIsModalOpen(false);
      fetchAdmins();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Operation failed. Check your network or credentials.');
    }
  };

  // 3. DISABLE / TOGGLE STATUS Admin Handler
  const handleToggleAdminStatus = async (admin) => {
    const currentActiveState = admin.is_active ?? true;
    const actionText = currentActiveState ? 'disable' : 'activate';
    
    if (!window.confirm(`Are you sure you want to ${actionText} admin @${admin.username}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://${targetHostname}:8000/api/users/admin/users/${admin.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        },
        body: JSON.stringify({ is_active: !currentActiveState })
      });

      if (response.ok) {
        setAdmins(prev => prev.map(a => a.id === admin.id ? { ...a, is_active: !currentActiveState } : a));
      }
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  // Filter Search
  const filteredAdmins = admins.filter(admin => {
    const query = searchQuery.toLowerCase();
    const fullName = `${admin.first_name || ''} ${admin.last_name || ''}`.toLowerCase();
    const username = (admin.username || '').toLowerCase();
    const brgy = (admin.barangay || '').toLowerCase();
    return fullName.includes(query) || username.includes(query) || brgy.includes(query);
  });

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0]">
        
        {/* HEADER TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-4" />
              <input 
                type="text" 
                placeholder="Search admin name, username, or brgy..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none" 
              />
            </div>
          </div>

          <button 
            onClick={openCreateModal}
            className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-all active:scale-95"
          >
            <UserPlus size={18} /> Register New Admin
          </button>
        </div>

        {/* MASTER TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-[#b32d2d]" size={24} />
              <h2 className="font-bold text-xl text-gray-900">System Administrators Directory</h2>
            </div>
            <span className="text-sm text-gray-400 font-bold">{filteredAdmins.length} Active Staff</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6">Admin Name</th>
                  <th className="py-4 px-6">Assigned Barangay</th>
                  <th className="py-4 px-6">Contact Number</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-bold">Querying administrator roster...</td></tr>
                ) : filteredAdmins.length === 0 ? (
                  <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-medium">No admin accounts found matching criteria.</td></tr>
                ) : (
                  filteredAdmins.map((admin) => {
                    const isActive = admin.is_active ?? true;
                    return (
                      <tr key={admin.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                        <td className="py-5 px-6">
                          <div className="font-bold text-gray-800 text-[15px]">
                            {admin.first_name || admin.last_name ? `${admin.first_name || ''} ${admin.last_name || ''}` : 'Unnamed Staff'}
                          </div>
                          <div className="text-xs text-gray-400 font-medium mt-0.5">@{admin.username}</div>
                        </td>
                        <td className="py-5 px-6 text-sm font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#b32d2d]" />
                            <span>Brgy. {admin.barangay || 'Not Assigned'}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-sm text-gray-600 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Phone size={14} className="text-gray-400" />
                            <span>{admin.contact_number || admin.phone || 'No phone set'}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${
                            isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => openViewModal(admin)} 
                              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-all"
                              title="View Admin File"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => openEditModal(admin)} 
                              className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all"
                              title="Edit Admin Information"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => handleToggleAdminStatus(admin)} 
                              className={`p-2 rounded-lg transition-all ${
                                isActive ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'
                              }`}
                              title={isActive ? "Disable Admin" : "Enable Admin"}
                            >
                              <Trash2 size={16} />
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-6">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={26} className="text-[#b32d2d]" />
                  <h3 className="font-bold text-xl text-gray-900">
                    {modalMode === 'create' ? 'Register New Admin' : modalMode === 'edit' ? 'Update Admin File' : 'Administrator File'}
                  </h3>
                </div>
                <X size={20} className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setIsModalOpen(false)} />
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}

              {/* View Only Presentation Mode */}
              {modalMode === 'view' && selectedAdmin && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400">Full Name</label>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{selectedAdmin.first_name} {selectedAdmin.last_name}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400">System Username</label>
                    <p className="text-sm font-semibold text-[#b32d2d] mt-0.5">@{selectedAdmin.username}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400">Jurisdiction Barangay</label>
                    <p className="text-sm font-bold text-gray-700 mt-0.5">Brgy. {selectedAdmin.barangay || 'Not Specified'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400">Emergency Phone Number</label>
                    <p className="text-sm font-medium text-gray-600 mt-0.5">{selectedAdmin.contact_number || 'No contact configured'}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400">Email Routing</label>
                    <p className="text-sm font-medium text-gray-600 mt-0.5">{selectedAdmin.email || 'N/A'}</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="mt-6 w-full py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg">
                    Close File
                  </button>
                </div>
              )}

              {/* Create / Edit Form Mode */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <form onSubmit={handleSaveAdmin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.first_name} 
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={formData.last_name} 
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Username</label>
                      <input 
                        type="text" 
                        required
                        value={formData.username} 
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">
                        Password {modalMode === 'edit' && <span className="text-[10px] text-gray-400">(leave blank to keep)</span>}
                      </label>
                      <input 
                        type="password" 
                        required={modalMode === 'create'}
                        value={formData.password} 
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Assigned Barangay</label>
                      <select 
                        value={formData.barangay} 
                        onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d] bg-white cursor-pointer"
                      >
                        {ANGELES_BARANGAYS.map((brgy) => (
                          <option key={brgy} value={brgy}>{brgy}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Contact Number</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. 09171234567"
                        value={formData.contact_number} 
                        onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Email Address</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-sm rounded-lg shadow-md"
                    >
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