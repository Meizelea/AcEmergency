import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Mail, X, Eye, UserCircle, Phone, 
  MapPin, CheckCircle, XCircle, Trash2, AlertCircle, 
  Filter, Flag, RefreshCw
} from 'lucide-react';

import AdminLayout from '../components/header';

export const ANGELES_BARANGAYS = [
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

const CACHE_KEY_CITIZENS = 'cache_admin_citizens_v1';

export default function UsersPage() {
  const navigate = useNavigate();

  // Cached state initialization
  const [users, setUsers] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_CITIZENS);
    return cached ? JSON.parse(cached) : [];
  });

  const [isLoading, setIsLoading] = useState(() => users.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reportFilter, setReportFilter] = useState('ALL'); // ALL, CLEAN, REPORTED, DISABLED

  // Modal & Management States
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notificationMsg, setNotificationMsg] = useState('');

  const token = localStorage.getItem('ac_token');
  const targetHostname = window.location.hostname || '127.0.0.1';
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';
  //const API_BASE_URL = `http://${targetHostname}:8000`;

  // 1. FETCH USERS WITH AUTOMATIC REFRESH ON VISIT/REVISIT
  const fetchUsers = useCallback(async (silent = false) => {
    if (!token) {
      navigate('/login');
      return;
    }

    if (!silent && users.length === 0) setIsLoading(true);
    setIsSyncing(true);

    const endpoints = [
      `${API_BASE_URL}/api/users/admin/`,
      `${API_BASE_URL}/api/users/`
    ];

    for (const endpoint of endpoints) {
      for (const useBearer of [false, true]) {
        try {
          const authPrefix = useBearer ? 'Bearer' : 'Token';
          const cleanToken = token.replace(/^(Token|Bearer)\s+/i, '').trim();

          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `${authPrefix} ${cleanToken}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            const list = Array.isArray(data) ? data : (data?.results || []);
            setUsers(list);
            sessionStorage.setItem(CACHE_KEY_CITIZENS, JSON.stringify(list));
            setIsLoading(false);
            setIsSyncing(false);
            return;
          }
        } catch (error) {
          console.warn(`Failed fetching from ${endpoint}:`, error);
        }
      }
    }

    setIsLoading(false);
    setIsSyncing(false);
  }, [token, navigate, API_BASE_URL, users.length]);

  // Always re-fetch live state upon visiting/revisiting page
  useEffect(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  // SEARCH & ACCOUNT STATUS FILTERING (INCLUDES DISABLED ACCOUNTS OPTION)
  const filteredUsers = users.filter(user => {
    if (!user) return false;

    const isAdminAccount = Boolean(user.assigned_barangay) || user.username === 'admin' || user.is_staff === true;
    if (isAdminAccount) return false;

    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    const emailStr = (user.email || '').toLowerCase();
    const usernameStr = (user.username || '').toLowerCase();
    const brgyStr = (user.residential_barangay || user.barangay || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = fullName.includes(query) || emailStr.includes(query) || usernameStr.includes(query) || brgyStr.includes(query);

    let matchesFilter = true;
    const isActive = user.is_active ?? true;

    if (reportFilter === 'REPORTED') {
      matchesFilter = Boolean(user.is_reported || user.report_count > 0);
    } else if (reportFilter === 'CLEAN') {
      matchesFilter = isActive && !user.is_reported && (!user.report_count || user.report_count === 0);
    } else if (reportFilter === 'DISABLED') {
      matchesFilter = !isActive;
    }

    return matchesSearch && matchesFilter;
  });

  // Modal open trigger
  const handleOpenUserModal = (user) => {
    setSelectedUser(user);
    setErrorMsg('');
    setNotificationMsg('');
    setIsModalOpen(true);
  };

  // 2. FUNCTIONAL DISABLE & ENABLE ACCOUNT (TOGGLE IS_ACTIVE TRUE/FALSE)
  const handleToggleUserStatus = async () => {
    if (!selectedUser) return;
    const currentActiveState = selectedUser.is_active ?? true;
    const targetState = !currentActiveState;
    const actionText = currentActiveState ? 'disable' : 'activate';

    if (!window.confirm(`Are you sure you want to ${actionText} the account for @${selectedUser.username}?`)) {
      return;
    }

    // Optimistic UI Update
    const updatedUser = { ...selectedUser, is_active: targetState };
    setSelectedUser(updatedUser);
    const updatedList = users.map(u => u.id === selectedUser.id ? updatedUser : u);
    setUsers(updatedList);
    sessionStorage.setItem(CACHE_KEY_CITIZENS, JSON.stringify(updatedList));

    const patchEndpoints = [
      `${API_BASE_URL}/api/users/admin/users/${selectedUser.id}/`,
      `${API_BASE_URL}/api/users/admin/${selectedUser.id}/`,
      `${API_BASE_URL}/api/users/${selectedUser.id}/`
    ];

    let success = false;
    const cleanToken = token.replace(/^(Token|Bearer)\s+/i, '').trim();

    for (const endpoint of patchEndpoints) {
      for (const useBearer of [false, true]) {
        try {
          const authPrefix = useBearer ? 'Bearer' : 'Token';
          const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `${authPrefix} ${cleanToken}`
            },
            body: JSON.stringify({ is_active: targetState })
          });

          if (response.ok) {
            success = true;
            setNotificationMsg(`Account successfully ${targetState ? 'activated' : 'disabled'}.`);
            break;
          }
        } catch (error) {
          console.warn(`Patch failed for ${endpoint}:`, error);
        }
      }
      if (success) break;
    }

    if (!success) {
      setErrorMsg("Failed to synchronize state with server, changes saved locally.");
    }
  };

  const handleReportUserPlaceholder = () => {
    if (!selectedUser) return;
    setNotificationMsg(`Report flagged for @${selectedUser.username}. (Backend integration pending)`);
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] relative flex flex-col">
        
        {/* CONTROLS & FILTER HEADER (SCALABLE & RESPONSIVE) */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 mb-6 shrink-0">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            
            {/* SEARCH BAR */}
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-xs w-full sm:w-72 lg:w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Search user name, email, or brgy..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2 px-3 text-xs font-medium text-gray-700 focus:outline-none" 
              />
            </div>

            {/* REPORTED & DISABLED USERS FILTER DROPDOWN */}
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-xs text-xs text-gray-600 font-bold w-full sm:w-auto">
              <Filter size={14} className="text-gray-400 mr-2 shrink-0" />
              <select 
                value={reportFilter} 
                onChange={(e) => setReportFilter(e.target.value)} 
                className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2 w-full"
              >
                <option value="ALL">All Registered Citizens</option>
                <option value="CLEAN">Clean Active Accounts</option>
                <option value="DISABLED">Disabled / Suspended Accounts</option>
                <option value="REPORTED">Flagged / Reported Users</option>
              </select>
            </div>

            {/* REFRESH / SYNC DATA BUTTON */}
            <button
              onClick={() => fetchUsers(false)}
              disabled={isSyncing}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> 
              {isSyncing ? "Syncing..." : "Sync Data"}
            </button>
          </div>
        </div>

        {/* MASTER DIRECTORY TABLE (RESPONSIVE SCROLL CONTAINER) */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3">
              <Users className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-lg sm:text-xl text-gray-900">Registered Citizens Directory</h2>
            </div>
            <span className="text-xs sm:text-sm text-gray-400 font-bold">{filteredUsers.length} Enrolled Citizens</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6 w-32">Username</th>
                  <th className="py-3.5 px-4 sm:px-6">Account Holder Name</th>
                  <th className="py-3.5 px-4 sm:px-6">Residential Barangay</th>
                  <th className="py-3.5 px-4 sm:px-6">Email Address Link</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center w-36">Actions</th>
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
                        <td className="py-4 px-4 sm:px-6 font-black text-gray-800 text-sm tracking-tight">@{user.username}</td>
                        <td className="py-4 px-4 sm:px-6 text-sm font-bold text-gray-700">{finalName}</td>
                        <td className="py-4 px-4 sm:px-6 text-xs sm:text-sm font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#b32d2d] shrink-0" />
                            <span className="truncate">Brgy. {user.residential_barangay || user.barangay || 'Not Specified'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-xs sm:text-sm text-gray-500 font-medium">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail size={14} className="text-gray-400 shrink-0" /> 
                            <span className="truncate">{user.email || 'No email attached'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold border flex items-center gap-1 w-fit ${
                            isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenUserModal(user); }} 
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 font-bold text-[11px] sm:text-xs uppercase tracking-tight rounded flex items-center gap-1.5 mx-auto transition-all active:scale-95 shadow-xs cursor-pointer"
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

      {/* USER FILE MODAL (RESPONSIVE SCALING) */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 my-8">
            
            <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <UserCircle size={32} className="text-[#b32d2d] shrink-0" />
                <div>
                  <h3 className="font-bold text-lg sm:text-xl text-gray-900">Citizen Account Profile</h3>
                  <p className="text-xs text-gray-400 font-medium">Database Identifier: #{selectedUser.id || 'N/A'}</p>
                </div>
              </div>
              <X 
                size={20} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0" 
                onClick={() => setIsModalOpen(false)} 
              />
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" /> {errorMsg}
              </div>
            )}

            {notificationMsg && (
              <div className="mx-6 mt-4 p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                <Flag size={16} className="text-amber-600 shrink-0" /> {notificationMsg}
              </div>
            )}

            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-100">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Account ID</span>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">#{selectedUser.id || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Username</span>
                  <p className="text-sm font-black text-[#b32d2d] mt-0.5">@{selectedUser.username}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-gray-400">Full Name</span>
                <p className="text-base font-black text-gray-900 mt-0.5">
                  {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.username}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Contact Number</span>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-1">
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    {selectedUser.contact_number || 'No phone attached'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Residential Barangay</span>
                  <p className="text-sm font-semibold text-gray-700 mt-0.5 flex items-center gap-1">
                    <MapPin size={14} className="text-[#b32d2d] shrink-0" />
                    Brgy. {selectedUser.residential_barangay || selectedUser.barangay || 'Not Specified'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-gray-400">Email Address</span>
                <p className="text-sm font-medium text-gray-600 mt-0.5 flex items-center gap-1">
                  <Mail size={14} className="text-gray-400 shrink-0" />
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
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-100">
                <button 
                  onClick={handleReportUserPlaceholder}
                  className="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs uppercase tracking-tight rounded-lg border border-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                >
                  <Flag size={14} className="text-amber-600" /> Report Citizen
                </button>
                
                <button 
                  onClick={handleToggleUserStatus}
                  className={`flex-1 py-2.5 font-bold text-xs uppercase tracking-tight rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs ${
                    (selectedUser.is_active ?? true)
                      ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                      : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                  }`}
                >
                  {(selectedUser.is_active ?? true) ? (
                    <>
                      <Trash2 size={14} /> Disable Account
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} /> Activate Account
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}