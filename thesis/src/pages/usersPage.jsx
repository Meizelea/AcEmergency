import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Search, Mail, X, Eye, UserCircle, Phone, 
  MapPin, CheckCircle, XCircle, Trash2, AlertCircle, 
  Filter, ShieldAlert, RefreshCw, AlertTriangle, ShieldCheck
} from 'lucide-react';

import AdminLayout from '../components/header';

export const ANGELES_BARANGAYS = [
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

// Django Model Suspension Choices (from core/choices.py)
const SUSPENSION_REASONS = [
  { value: 'inappropriate_user_information', label: 'Inappropriate user information' },
  { value: 'reporting_system_abuse', label: 'Abuse of the reporting system' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'repeated_policy_violations', label: 'Repeated policy violations' },
  { value: 'other', label: 'Other' },
];

const SUSPENSION_DETAILS = {
  inappropriate_user_information: [
    { value: 'inappropriate_first_name', label: 'Inappropriate first name' },
    { value: 'inappropriate_last_name', label: 'Inappropriate last name' },
    { value: 'inappropriate_username', label: 'Inappropriate username' },
    { value: 'inappropriate_profile_information', label: 'Inappropriate profile information' },
    { value: 'false_contact_information', label: 'False or misleading contact information' },
  ],
  reporting_system_abuse: [
    { value: 'false_reports', label: 'Repeated false or fabricated reports' },
    { value: 'misleading_descriptions', label: 'Deliberately misleading report descriptions' },
    { value: 'spam_or_duplicate_reports', label: 'Repeated duplicate or spam reports' },
    { value: 'report_location_misuse', label: 'Deliberate misuse of report locations' },
  ],
  inappropriate_content: [
    { value: 'profanity_or_abuse', label: 'Profanity or abusive language in reports' },
    { value: 'inappropriate_media', label: 'Inappropriate media uploads' },
    { value: 'harassment_or_threats', label: 'Harassment or threatening content' },
  ],
  repeated_policy_violations: [
    { value: 'repeated_guideline_violations', label: 'Repeated violations of reporting guidelines' },
  ],
  other: [
    { value: 'other_detail', label: 'Other' },
  ],
};

const CACHE_KEY_CITIZENS = 'cache_admin_citizens_v2';

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
  const [reportFilter, setReportFilter] = useState('ALL'); // ALL, CLEAN, DISABLED

  // Profile Modal & Management States
  const [selectedUser, setSelectedUser] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notificationMsg, setNotificationMsg] = useState('');

  // Suspension Form Modal State
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendForm, setSuspendForm] = useState({
    reason: 'inappropriate_user_information',
    detail: 'inappropriate_username',
    notes: ''
  });
  const [isSubmittingSuspension, setIsSubmittingSuspension] = useState(false);

  // Confirmation Decision Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    action: null
  });

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

  // AUTOMATIC REFRESH POLLING & FOCUS SYNC
  useEffect(() => {
    fetchUsers(true);

    const interval = setInterval(() => {
      fetchUsers(true);
    }, 15000);

    const handleFocus = () => fetchUsers(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUsers]);

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  // SEARCH & ACCOUNT STATUS FILTERING (ONLY REGISTERED CITIZENS)
  const filteredUsers = users.filter(user => {
    if (!user) return false;

    // Filter out Admin accounts strictly to show ONLY registered citizens
    const isAdminRole = user.role === 'admin' || user.role === 'privileged_admin';
    const hasAssignedBarangay = Boolean(user.assigned_barangay);
    const isSuperuser = user.is_superuser === true || user.username === 'admin' || user.is_staff === true;

    if (isAdminRole || hasAssignedBarangay || isSuperuser) return false;

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

    if (reportFilter === 'CLEAN') {
      matchesFilter = isActive;
    } else if (reportFilter === 'DISABLED') {
      matchesFilter = !isActive;
    }

    return matchesSearch && matchesFilter;
  });

  const handleOpenUserModal = (user) => {
    setSelectedUser(user);
    setErrorMsg('');
    setNotificationMsg('');
    setIsProfileModalOpen(true);
  };

  const handleOpenSuspendModal = (user) => {
    setSelectedUser(user);
    setSuspendForm({
      reason: 'inappropriate_user_information',
      detail: 'inappropriate_username',
      notes: ''
    });
    setIsSuspendModalOpen(true);
  };

  // Handle reason dropdown change to auto-update detail options
  const handleReasonChange = (newReason) => {
    const availableDetails = SUSPENSION_DETAILS[newReason] || [];
    setSuspendForm({
      reason: newReason,
      detail: availableDetails[0]?.value || '',
      notes: suspendForm.notes
    });
  };

  // Execute Citizen Suspension against Django Backend models
  const executeSuspendUser = async () => {
    if (!selectedUser) return;
    setIsSubmittingSuspension(true);

    const payload = {
      is_active: false,
      suspension_reason: suspendForm.reason,
      suspension_detail: suspendForm.detail,
      suspension_notes: suspendForm.notes.trim(),
      suspended_at: new Date().toISOString()
    };

    // Optimistic UI Update
    const updatedUser = { ...selectedUser, ...payload };
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
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            success = true;
            break;
          }
        } catch (error) {
          console.warn(`Patch failed for ${endpoint}:`, error);
        }
      }
      if (success) break;
    }

    setIsSubmittingSuspension(false);
    setIsSuspendModalOpen(false);

    if (success) {
      setNotificationMsg(`Account @${selectedUser.username} has been suspended.`);
    } else {
      setErrorMsg("Failed to synchronize state with server, changes saved locally.");
    }
  };

  // Execute Citizen Reactivation
  const executeReactivateUser = async () => {
    if (!selectedUser) return;

    const payload = {
      is_active: true,
      suspension_reason: '',
      suspension_detail: '',
      suspension_notes: '',
      reactivated_at: new Date().toISOString()
    };

    // Optimistic UI Update
    const updatedUser = { ...selectedUser, ...payload };
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
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            success = true;
            break;
          }
        } catch (error) {
          console.warn(`Patch failed for ${endpoint}:`, error);
        }
      }
      if (success) break;
    }

    if (success) {
      setNotificationMsg(`Account @${selectedUser.username} reactivated successfully.`);
    } else {
      setErrorMsg("Failed to synchronize state with server, changes saved locally.");
    }
  };

  const requestReactivateUser = () => {
    if (!selectedUser) return;
    setConfirmModal({
      isOpen: true,
      title: 'Reactivate Citizen Account',
      message: `Are you sure you want to lift the suspension and reactivate @${selectedUser.username}?`,
      confirmText: 'Reactivate Account',
      action: executeReactivateUser
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] relative flex flex-col">
        
        {/* CONTROLS & FILTER HEADER */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 mb-6 shrink-0">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full lg:w-auto">
            
            {/* SEARCH BAR */}
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-xs w-full sm:w-72 lg:w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Search citizen name, email, or brgy..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full py-2 px-3 text-xs font-medium text-gray-700 focus:outline-none" 
              />
            </div>

            {/* STATUS FILTER DROPDOWN */}
            <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-xs text-xs text-gray-600 font-bold w-full sm:w-auto">
              <Filter size={14} className="text-gray-400 mr-2 shrink-0" />
              <select 
                value={reportFilter} 
                onChange={(e) => setReportFilter(e.target.value)} 
                className="py-2 bg-transparent focus:outline-none cursor-pointer pr-2 w-full"
              >
                <option value="ALL">All Registered Citizens</option>
                <option value="CLEAN">Active Citizens</option>
                <option value="DISABLED">Suspended Citizens</option>
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

        {/* MASTER DIRECTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3">
              <Users className="text-[#b32d2d]" size={22} />
              <h2 className="font-bold text-lg sm:text-xl text-gray-900">Registered Citizens Directory</h2>
            </div>
            {/* BOLD ENROLLED COUNTER */}
            <span className="text-xs sm:text-sm text-gray-900 font-black">
              {filteredUsers.length} Enrolled Citizens
            </span>
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
                  <tr><td colSpan="6" className="py-12 text-center text-gray-400 font-bold">Querying citizen accounts database...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="6" className="py-12 text-center text-gray-400 font-medium">No registered citizens found matching that criteria.</td></tr>
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
                            {isActive ? 'Active' : 'Suspended'}
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

      {/* USER FILE MODAL */}
      {isProfileModalOpen && selectedUser && (
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
                onClick={() => setIsProfileModalOpen(false)} 
              />
            </div>

            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" /> {errorMsg}
              </div>
            )}

            {notificationMsg && (
              <div className="mx-6 mt-4 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" /> {notificationMsg}
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
                    {(selectedUser.is_active ?? true) ? 'Active & Verified' : 'Suspended'}
                  </span>
                </div>
              </div>

              {/* SHOW SUSPENSION REASON IF SUSPENDED */}
              {!(selectedUser.is_active ?? true) && selectedUser.suspension_reason && (
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1 text-xs">
                  <span className="font-bold text-red-800 uppercase text-[10px] block">Suspension Notice</span>
                  <p className="text-gray-800 font-semibold">
                    <span className="text-gray-500">Reason:</span> {selectedUser.suspension_reason.replace(/_/g, ' ')}
                  </p>
                  {selectedUser.suspension_detail && (
                    <p className="text-gray-800 font-medium">
                      <span className="text-gray-500">Detail:</span> {selectedUser.suspension_detail.replace(/_/g, ' ')}
                    </p>
                  )}
                  {selectedUser.suspension_notes && (
                    <p className="text-gray-600 italic mt-1">
                      "{selectedUser.suspension_notes}"
                    </p>
                  )}
                </div>
              )}

              {/* ACTION BUTTON: SUSPEND / REACTIVATE CITIZEN */}
              <div className="pt-6 border-t border-gray-100 flex justify-end">
                {(selectedUser.is_active ?? true) ? (
                  <button 
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      handleOpenSuspendModal(selectedUser);
                    }}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-tight rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <ShieldAlert size={16} /> Suspend Citizen
                  </button>
                ) : (
                  <button 
                    onClick={requestReactivateUser}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-tight rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <ShieldCheck size={16} /> Reactivate Citizen Account
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND CITIZEN FORM MODAL */}
      {isSuspendModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={22} className="text-red-600 shrink-0" />
                <h3 className="font-extrabold text-base text-gray-900">
                  Suspend @{selectedUser.username}
                </h3>
              </div>
              <X 
                size={18} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer" 
                onClick={() => setIsSuspendModalOpen(false)} 
              />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); executeSuspendUser(); }} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Suspension Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={suspendForm.reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-800 focus:outline-none focus:border-red-500"
                >
                  {SUSPENSION_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Suspension Detail <span className="text-red-500">*</span>
                </label>
                <select
                  value={suspendForm.detail}
                  onChange={(e) => setSuspendForm({ ...suspendForm, detail: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-800 focus:outline-none focus:border-red-500"
                >
                  {(SUSPENSION_DETAILS[suspendForm.reason] || []).map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Additional Notes (Optional, max 200 chars)
                </label>
                <textarea
                  maxLength={200}
                  rows={3}
                  placeholder="Provide specific notes regarding this suspension..."
                  value={suspendForm.notes}
                  onChange={(e) => setSuspendForm({ ...suspendForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-800 focus:outline-none focus:border-red-500 leading-relaxed"
                />
                <span className="text-[10px] text-gray-400 block text-right mt-1">
                  {suspendForm.notes.length}/200 characters
                </span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSuspendModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSuspension}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSubmittingSuspension ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DECISION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-4">
              <AlertTriangle size={28} />
            </div>
            
            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              {confirmModal.title}
            </h3>
            
            <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  if (confirmModal.action) confirmModal.action();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}