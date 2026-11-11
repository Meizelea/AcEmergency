import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Mail, X, UserCircle, Phone,
  MapPin, CheckCircle, XCircle, AlertCircle,
  Filter, ShieldAlert, RefreshCw, AlertTriangle, ShieldCheck,
  ArrowUp, ArrowDown
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

const getFullName = (u) =>
  `${u?.first_name || ''} ${u?.last_name || ''}`.trim() || u?.username || '';

const getReasonLabel = (value) =>
  SUSPENSION_REASONS.find(r => r.value === value)?.label || (value || '').replace(/_/g, ' ');

const getDetailLabel = (value) => {
  for (const list of Object.values(SUSPENSION_DETAILS)) {
    const found = list.find(d => d.value === value);
    if (found) return found.label;
  }
  return (value || '').replace(/_/g, ' ');
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
  const [idSortOrder, setIdSortOrder] = useState('asc'); // 'asc' | 'desc'

  // Profile Modal & Management States
  const [selectedUser, setSelectedUser] = useState(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notificationMsg, setNotificationMsg] = useState('');

  // Suspension Form Modal State
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendForm, setSuspendForm] = useState({ reason: '', detail: '', notes: '' });
  const [suspendError, setSuspendError] = useState('');
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

  // 1. FETCH USERS EXCLUSIVELY FOR THIS PAGE
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

  // FETCH ON MOUNT AND FOCUS (NO AUTO-REFRESH INTERVAL)
  useEffect(() => {
    const hasCache = Boolean(sessionStorage.getItem(CACHE_KEY_CITIZENS));
    fetchUsers(hasCache);

    const handleFocus = () => fetchUsers(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchUsers]);

  // LOCAL REFRESH BUTTON HANDLER
  const handleLocalSync = (e) => {
    e.stopPropagation();
    e.preventDefault();
    sessionStorage.removeItem(CACHE_KEY_CITIZENS);
    fetchUsers(false);
  };

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }


  const filteredUsers = users.filter(user => {
    if (!user) return false;

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
  }).sort((a, b) => {
    const diff = (Number(a.id) || 0) - (Number(b.id) || 0);
    return idSortOrder === 'asc' ? diff : -diff;
  });

  const handleOpenUserModal = (user) => {
    setSelectedUser(user);
    setErrorMsg('');
    setNotificationMsg('');
    setIsProfileModalOpen(true);
  };

  const handleOpenSuspendModal = (user) => {
    setSelectedUser(user);
    setSuspendForm({ reason: '', detail: '', notes: '' });
    setSuspendError('');
    setIsSuspendModalOpen(true);
  };

  // Reason change resets the detail (no default selection). "Other" has a single implicit detail.
  const handleReasonChange = (newReason) => {
    setSuspendError('');
    setSuspendForm(prev => ({
      ...prev,
      reason: newReason,
      detail: newReason === 'other' ? 'other_detail' : ''
    }));
  };

  // Shared PATCH helper (tries each endpoint / auth scheme like the fetch does)
  const patchUser = async (target, payload) => {
    const patchEndpoints = [
      `${API_BASE_URL}/api/users/admin/users/${target.id}/`,
      `${API_BASE_URL}/api/users/admin/${target.id}/`,
      `${API_BASE_URL}/api/users/${target.id}/`
    ];
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
          if (response.ok) return true;
        } catch (error) {
          console.warn(`Patch failed for ${endpoint}:`, error);
        }
      }
    }
    return false;
  };

  // Optimistic UI update
  const applyLocalUpdate = (target, payload) => {
    const updatedUser = { ...target, ...payload };
    setSelectedUser(prev => (prev && prev.id === target.id ? updatedUser : prev));
    const updatedList = users.map(u => u.id === target.id ? updatedUser : u);
    setUsers(updatedList);
    sessionStorage.setItem(CACHE_KEY_CITIZENS, JSON.stringify(updatedList));
  };

  const executeSuspendUser = async (target, form) => {
    setIsSubmittingSuspension(true);

    const payload = {
      is_active: false,
      suspension_reason: form.reason,
      suspension_detail: form.detail,
      suspension_notes: form.notes.trim(),
      suspended_at: new Date().toISOString()
    };

    applyLocalUpdate(target, payload);
    const success = await patchUser(target, payload);

    setIsSubmittingSuspension(false);
    setIsSuspendModalOpen(false);

    if (success) {
      setErrorMsg('');
      setNotificationMsg(`${getFullName(target)} has been suspended.`);
    } else {
      setNotificationMsg('');
      setErrorMsg("Failed to synchronize state with server, changes saved locally.");
    }
  };

  const executeReactivateUser = async (target) => {
    const payload = {
      is_active: true,
      suspension_reason: '',
      suspension_detail: '',
      suspension_notes: '',
      reactivated_at: new Date().toISOString()
    };

    applyLocalUpdate(target, payload);
    const success = await patchUser(target, payload);

    if (success) {
      setErrorMsg('');
      setNotificationMsg(`${getFullName(target)} has been re-activated.`);
    } else {
      setNotificationMsg('');
      setErrorMsg("Failed to synchronize state with server, changes saved locally.");
    }
  };

  // Suspension form submit -> validate -> confirm -> execute
  const requestSuspendUser = () => {
    if (!selectedUser) return;

    if (!suspendForm.reason) {
      setSuspendError('Please select a suspension reason.');
      return;
    }
    if (!suspendForm.detail) {
      setSuspendError('Please select a suspension detail.');
      return;
    }
    if (suspendForm.reason === 'other' && !suspendForm.notes.trim()) {
      setSuspendError('Please describe the reason for suspension.');
      return;
    }

    setSuspendError('');
    const target = selectedUser;
    const form = { ...suspendForm };
    setConfirmModal({
      isOpen: true,
      title: 'Suspend Resident',
      message: `Are you sure you want to suspend ${getFullName(target)}? Reason: ${getReasonLabel(form.reason)}.`,
      confirmText: 'Suspend Resident',
      action: () => executeSuspendUser(target, form)
    });
  };

  const requestReactivateUser = (target) => {
    if (!target) return;
    setConfirmModal({
      isOpen: true,
      title: 'Re-activate Resident',
      message: `Are you sure you want to lift the suspension and re-activate ${getFullName(target)}?`,
      confirmText: 'Re-activate Resident',
      action: () => executeReactivateUser(target)
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] relative flex flex-col">
        
        {/* PAGE HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <Users className="text-[#b32d2d]" size={24} />
            <h1 className="font-black text-xl sm:text-2xl text-gray-900">Registered Residents</h1>
          </div>
          <span className="text-xs sm:text-sm text-gray-900 font-black">
            {filteredUsers.length} Enrolled Residents
          </span>
        </div>

        {/* PAGE-LEVEL FEEDBACK (actions can now be done straight from the table) */}
        {!isProfileModalOpen && (errorMsg || notificationMsg) && (
          <div className={`mb-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border shrink-0 ${
            errorMsg ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {errorMsg ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle size={16} className="text-emerald-600 shrink-0" />}
            <span className="flex-1">{errorMsg || notificationMsg}</span>
            <X size={16} className="cursor-pointer shrink-0" onClick={() => { setErrorMsg(''); setNotificationMsg(''); }} />
          </div>
        )}

        {/* CONTROLS & FILTER HEADER */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 mb-6 shrink-0">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full">
            
            {/* SEARCH BAR */}
            <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-xs w-full sm:w-72 lg:w-80 overflow-hidden">
              <Search size={18} className="text-gray-400 ml-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Search resident name, email, or brgy..." 
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
                <option value="ALL">All Registered Residents</option>
                <option value="CLEAN">Active Residents</option>
                <option value="DISABLED">Suspended Residents</option>
              </select>
            </div>

            {/* ISOLATED REFRESH / SYNC DATA BUTTON */}
            <button
              type="button"
              onClick={handleLocalSync}
              disabled={isSyncing}
              className="sm:ml-auto bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> 
              {isSyncing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* MASTER DIRECTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-300 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">
                    <button
                      type="button"
                      onClick={() => setIdSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                      title={idSortOrder === 'asc' ? 'Sorted ascending (click for descending)' : 'Sorted descending (click for ascending)'}
                      className="flex items-center gap-1 uppercase font-black tracking-wider cursor-pointer hover:text-[#b32d2d] transition-colors"
                    >
                      ID
                      {idSortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    </button>
                  </th>
                  <th className="py-3.5 px-4 sm:px-6">Full Name</th>
                  <th className="py-3.5 px-4 sm:px-6">Email</th>
                  <th className="py-3.5 px-4 sm:px-6">Barangay</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="6" className="py-12 text-center text-gray-400 font-bold">Querying resident accounts database...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan="6" className="py-12 text-center text-gray-400 font-medium">No registered residents found matching that criteria.</td></tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isActive = user.is_active ?? true;

                    return (
                      <tr
                        key={user.id || user.username}
                        onClick={() => handleOpenUserModal(user)}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-4 sm:px-6 font-black text-gray-800 text-sm tracking-tight">{user.id}</td>
                        <td className="py-4 px-4 sm:px-6 text-sm font-bold text-gray-700">{getFullName(user)}</td>
                        <td className="py-4 px-4 sm:px-6 text-xs sm:text-sm text-gray-500 font-medium">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail size={14} className="text-gray-400 shrink-0" />
                            <span className="truncate">{user.email || 'No email registered'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-xs sm:text-sm font-semibold text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-[#b32d2d] shrink-0" />
                            <span className="truncate">Brgy. {user.residential_barangay || user.barangay || 'Not Specified'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 sm:px-6">
                          {/* READ-ONLY STATUS */}
                          <span className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold border flex items-center gap-1 w-fit ${
                            isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-4 px-4 sm:px-6 text-center">
                          {isActive ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenSuspendModal(user); }}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-[11px] sm:text-xs uppercase tracking-tight rounded flex items-center gap-1.5 mx-auto transition-all active:scale-95 shadow-xs cursor-pointer"
                            >
                              <ShieldAlert size={13} /> Suspend
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); requestReactivateUser(user); }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] sm:text-xs uppercase tracking-tight rounded flex items-center gap-1.5 mx-auto transition-all active:scale-95 shadow-xs cursor-pointer"
                            >
                              <ShieldCheck size={13} /> Re-activate
                            </button>
                          )}
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
                  <h3 className="font-bold text-lg sm:text-xl text-gray-900">Resident Profile</h3>
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
                  <span className="text-[10px] font-black uppercase text-gray-400">Resident ID</span>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">#{selectedUser.id || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400">Username</span>
                  <p className="text-sm font-black text-[#b32d2d] mt-0.5">{selectedUser.username}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-gray-400">Full Name</span>
                <p className="text-base font-black text-gray-900 mt-0.5">
                  {getFullName(selectedUser)}
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
                  <span className="text-[10px] font-black uppercase text-gray-400">Barangay</span>
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
              {!(selectedUser.is_active ?? true) && (
                <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl space-y-1 text-xs">
                  <span className="font-bold text-red-800 uppercase text-[10px] block">Suspension Reason</span>
                  <p className="text-gray-800 font-semibold">
                    {selectedUser.suspension_reason ? getReasonLabel(selectedUser.suspension_reason) : 'No reason recorded'}
                  </p>
                  {selectedUser.suspension_detail && selectedUser.suspension_detail !== 'other_detail' && (
                    <p className="text-gray-800 font-medium">
                      <span className="text-gray-500">Detail:</span> {getDetailLabel(selectedUser.suspension_detail)}
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
                    <ShieldAlert size={16} /> Suspend Resident
                  </button>
                ) : (
                  <button 
                    onClick={() => requestReactivateUser(selectedUser)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-tight rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <ShieldCheck size={16} /> Re-activate Resident
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND RESIDENT FORM MODAL */}
      {isSuspendModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100 my-8">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={22} className="text-red-600 shrink-0" />
                <h3 className="font-extrabold text-base text-gray-900">
                  Suspend Resident
                </h3>
              </div>
              <X 
                size={18} 
                className="text-gray-400 hover:text-gray-600 cursor-pointer" 
                onClick={() => setIsSuspendModalOpen(false)} 
              />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); requestSuspendUser(); }} className="p-5 space-y-4 text-xs">
              <p className="text-gray-600 font-semibold">
                {getFullName(selectedUser)} <span className="text-gray-400 font-medium">(ID {selectedUser.id})</span>
              </p>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Suspension Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={suspendForm.reason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-800 focus:outline-none focus:border-red-500"
                >
                  <option value="" disabled>Select a Reason</option>
                  {SUSPENSION_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* "Other" has a single implicit detail, so the detail dropdown is hidden for it */}
              {suspendForm.reason !== 'other' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Suspension Detail <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={suspendForm.detail}
                    disabled={!suspendForm.reason}
                    onChange={(e) => { setSuspendError(''); setSuspendForm({ ...suspendForm, detail: e.target.value }); }}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-800 focus:outline-none focus:border-red-500 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="" disabled>Select a Detail</option>
                    {(SUSPENSION_DETAILS[suspendForm.reason] || []).map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  {suspendForm.reason === 'other'
                    ? <>Description <span className="text-red-500">*</span></>
                    : 'Additional Notes (Optional, max 200 chars)'}
                </label>
                <textarea
                  maxLength={200}
                  rows={3}
                  placeholder={suspendForm.reason === 'other' ? 'Describe the reason for this suspension...' : 'Provide specific notes regarding this suspension...'}
                  value={suspendForm.notes}
                  onChange={(e) => { setSuspendError(''); setSuspendForm({ ...suspendForm, notes: e.target.value }); }}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-800 focus:outline-none focus:border-red-500 leading-relaxed"
                />
                <span className="text-[10px] text-gray-400 block text-right mt-1">
                  {suspendForm.notes.length}/200 characters
                </span>
              </div>

              {suspendError && (
                <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" /> {suspendError}
                </div>
              )}

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
                  {isSubmittingSuspension ? 'Suspending...' : 'Suspend Resident'}
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