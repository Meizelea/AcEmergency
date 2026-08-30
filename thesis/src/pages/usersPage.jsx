import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Mail, X, Eye, UserCircle, Phone, 
  MapPin, CheckCircle, XCircle, Edit3, Trash2, AlertCircle, Save 
} from 'lucide-react';

import AdminLayout from '../components/header';

export const ANGELES_BARANGAYS = [
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

export default function UsersPage() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal & Management States
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    barangay: ANGELES_BARANGAYS[0]
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';

  // 1. Fetch Users
  const fetchUsers = async () => {
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      const response = await fetch(`http://${targetHostname}:8000/api/users/admin/users/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authPrefix
        }
      });
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data?.results || []);
      setUsers(list);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token, navigate, targetHostname]);

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  // Filter out admins/staff and show only regular resident users
  const filteredUsers = users.filter(user => {
    if (!user) return false;
    
    // An admin has an assigned_barangay or is superadmin/admin username
    const isAdminAccount = Boolean(user.assigned_barangay) || user.username === 'admin' || user.is_staff === true;
    if (isAdminAccount) return false;

    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    const emailStr = (user.email || '').toLowerCase();
    const usernameStr = (user.username || '').toLowerCase();
    const brgyStr = (user.residential_barangay || user.barangay || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    return fullName.includes(query) || emailStr.includes(query) || usernameStr.includes(query) || brgyStr.includes(query);
  });

  // Modal open trigger
  const handleOpenUserModal = (user) => {
    setSelectedUser(user);
    const userBrgy = user.residential_barangay || user.barangay;
    setEditFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      contact_number: user.contact_number || '',
      barangay: ANGELES_BARANGAYS.includes(userBrgy) ? userBrgy : ANGELES_BARANGAYS[0]
    });
    setIsEditing(false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // 2. Toggle Disable/Enable Account
  const handleToggleUserStatus = async () => {
    if (!selectedUser) return;
    const currentActiveState = selectedUser.is_active ?? true;
    const actionText = currentActiveState ? 'disable' : 'activate';

    if (!window.confirm(`Are you sure you want to ${actionText} this user (@${selectedUser.username})?`)) {
      return;
    }

    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      const response = await fetch(`http://${targetHostname}:8000/api/users/admin/users/${selectedUser.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authPrefix
        },
        body: JSON.stringify({ is_active: !currentActiveState })
      });

      if (response.ok) {
        const updated = { ...selectedUser, is_active: !currentActiveState };
        setSelectedUser(updated);
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
      } else {
        setErrorMsg("Failed to update user status.");
      }
    } catch (error) {
      console.error("Status toggle error:", error);
      setErrorMsg("Network error updating status.");
    }
  };

  // 3. Save User Changes
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');

    try {
      const authPrefix = token.startsWith('Bearer ') || token.startsWith('Token ') ? token : `Token ${token}`;
      const payload = {
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        email: editFormData.email,
        contact_number: editFormData.contact_number,
        residential_barangay: editFormData.barangay
      };

      const response = await fetch(`http://${targetHostname}:8000/api/users/admin/users/${selectedUser.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authPrefix
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const updated = { 
          ...selectedUser, 
          ...payload,
          residential_barangay: editFormData.barangay 
        };
        setSelectedUser(updated);
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? updated : u));
        setIsEditing(false);
      } else {
        const errData = await response.json();
        setErrorMsg(JSON.stringify(errData) || "Failed to save user updates.");
      }
    } catch (error) {
      console.error("User edit error:", error);
      setErrorMsg("Network error saving changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 h-full overflow-y-auto bg-[#f0f0f0] relative">
        
        {/* TOP SEARCH BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
            <Search size={18} className="text-gray-400 ml-4" />
            <input 
              type="text" 
              placeholder="Search user name, email, or brgy..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none" 
            />
          </div>
        </div>

        {/* MASTER DIRECTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-xl text-gray-900">Registered Citizens Directory</h2>
            </div>
            <span className="text-sm text-gray-400 font-bold">{filteredUsers.length} Enrolled Citizens</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-4 px-6 w-32">Username</th>
                  <th className="py-4 px-6">Account Holder Name</th>
                  <th className="py-4 px-6">Residential Barangay</th>
                  <th className="py-4 px-6">Email Address Link</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="6" className="py-12 text-center text-gray-400 font-bold">Querying active credentials database...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="6" className="py-12 text-center text-gray-400 font-medium">No citizen accounts found matching that criteria.</td></tr>
                ) : (
                  filteredUsers.map((user) => {
                    const finalName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
                    const isActive = user.is_active ?? true;

                    return (
                      <tr 
                        key={user.id || user.username} 
                        onClick={() => handleOpenUserModal(user)}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-5 px-6 font-black text-gray-800 text-sm tracking-tight">@{user.username}</td>
                        <td className="py-5 px-6 text-[15px] font-bold text-gray-700">{finalName}</td>
                        <td className="py-5 px-6 text-sm font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#b32d2d]" />
                            <span>Brgy. {user.residential_barangay || user.barangay || 'Not Specified'}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-sm text-gray-500 font-medium">
                          <div className="flex items-center gap-1.5">
                            <Mail size={14} className="text-gray-400" /> {user.email || 'No email attached'}
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
                        <td className="py-5 px-6 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenUserModal(user); }} 
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-bold text-xs uppercase tracking-tight rounded flex items-center gap-1.5 mx-auto transition-all active:scale-95 shadow-sm"
                          >
                            <Eye size={13} /> View File
                          </button>
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

      {/* USER FILE MODAL */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100">
            
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <UserCircle size={32} className="text-[#b32d2d]" />
                <div>
                  <h3 className="font-bold text-xl text-gray-900">Citizen Account Profile</h3>
                  <p className="text-xs text-gray-400 font-medium">Database Identifier: #{selectedUser.id || 'N/A'}</p>
                </div>
              </div>
              <X 
                size={20} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer" 
                onClick={() => setIsModalOpen(false)} 
              />
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} /> {errorMsg}
              </div>
            )}

            <div className="p-6">
              {isEditing ? (
                /* EDIT USER FORM */
                <form onSubmit={handleUpdateUser} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">First Name</label>
                      <input 
                        type="text" 
                        required
                        value={editFormData.first_name} 
                        onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Last Name</label>
                      <input 
                        type="text" 
                        required
                        value={editFormData.last_name} 
                        onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Contact Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 09171234567"
                      value={editFormData.contact_number} 
                      onChange={(e) => setEditFormData({ ...editFormData, contact_number: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Residential Barangay</label>
                    <select 
                      value={editFormData.barangay} 
                      onChange={(e) => setEditFormData({ ...editFormData, barangay: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d] bg-white cursor-pointer"
                    >
                      {ANGELES_BARANGAYS.map((brgy) => (
                        <option key={brgy} value={brgy}>{brgy}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Email Address</label>
                    <input 
                      type="email" 
                      value={editFormData.email} 
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#b32d2d]" 
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-sm rounded-lg shadow-md flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> {isSaving ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                /* VIEW USER DETAILS */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400">Account ID / Number</span>
                      <p className="text-sm font-bold text-gray-800 mt-0.5">#{selectedUser.id || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400">System Username</span>
                      <p className="text-sm font-black text-[#b32d2d] mt-0.5">@{selectedUser.username}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Full Name</span>
                    <p className="text-base font-black text-gray-900 mt-0.5">
                      {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400">Contact Number</span>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-1">
                        <Phone size={14} className="text-gray-400" />
                        {selectedUser.contact_number || 'No phone attached'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-gray-400">Residential Barangay</span>
                      <p className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-1">
                        <MapPin size={14} className="text-[#b32d2d]" />
                        Brgy. {selectedUser.residential_barangay || selectedUser.barangay || 'Not Specified'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Email Address</span>
                    <p className="text-sm font-medium text-gray-600 mt-0.5 flex items-center gap-1">
                      <Mail size={14} className="text-gray-400" />
                      {selectedUser.email || 'No email registered'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400">Account Access Status</span>
                    <div className="mt-1">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${
                        (selectedUser.is_active ?? true) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {(selectedUser.is_active ?? true) ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {(selectedUser.is_active ?? true) ? 'Active & Verified' : 'Disabled / Suspended'}
                      </span>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-3 pt-6 border-t border-gray-100">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg border border-blue-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Edit3 size={16} /> Edit Details
                    </button>
                    <button 
                      onClick={handleToggleUserStatus}
                      className={`flex-1 py-2.5 font-bold text-sm rounded-lg border transition-all flex items-center justify-center gap-2 ${
                        (selectedUser.is_active ?? true)
                          ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                          : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                      }`}
                    >
                      <Trash2 size={16} /> {(selectedUser.is_active ?? true) ? 'Disable Account' : 'Activate Account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}