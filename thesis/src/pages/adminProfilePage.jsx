import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/header';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Key, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  Save, 
  Lock, 
  Loader2,
  Info,
  X
} from 'lucide-react';

const targetHostname = window.location.hostname || '127.0.0.1';

// const API_BASE = 'https://api.aksyon.online';
const API_BASE = `http://${targetHostname}:8000`;

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '', info: '' });

  // Officer Profile State
  const [adminData, setAdminData] = useState({
    id: null,
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    contact_number: '',
    assigned_barangay: '',
    role: '',
    is_staff: false,
    is_superuser: false,
    date_joined: '',
  });

  // Password State
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordError, setPasswordError] = useState('');

  const getAuthHeaders = () => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    return cleanToken 
      ? { 'Authorization': `Token ${cleanToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

  // 1. Fetch Profile Data
  const fetchAdminProfile = async () => {
    try {
      setLoading(true);
      setFeedback({ error: '', success: '', info: '' });

      let res = await fetch(`${API_BASE}/api/users/me/`, {
        headers: getAuthHeaders(),
      });

      if (res.ok) {
        const userObj = await res.json();

        const resolvedRole = userObj.is_superuser || userObj.role?.toUpperCase() === 'PRIVILEGED_ADMIN'
          ? 'PRIVILEGED ADMIN'
          : userObj.role?.toUpperCase() || (userObj.is_staff ? 'ADMIN' : 'STAFF');

        const resolvedBarangay = userObj.assigned_barangay || userObj.residential_barangay || '';

        const profileData = {
          id: userObj.id || null,
          username: userObj.username || '',
          email: userObj.email || '',
          first_name: userObj.first_name || '',
          last_name: userObj.last_name || '',
          contact_number: userObj.contact_number || userObj.phone_number || '',
          assigned_barangay: resolvedBarangay,
          role: resolvedRole,
          is_staff: Boolean(userObj.is_staff),
          is_superuser: Boolean(userObj.is_superuser),
          date_joined: userObj.date_joined || '',
        };

        setAdminData(profileData);
        localStorage.setItem('ac_user', JSON.stringify(userObj));
      } else {
        const stored = localStorage.getItem('ac_user');
        if (stored) {
          const userObj = JSON.parse(stored);
          setAdminData((prev) => ({
            ...prev,
            ...userObj,
            role: userObj.is_superuser ? 'PRIVILEGED ADMIN' : (userObj.role || 'ADMIN'),
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching admin profile:', err);
      setFeedback({ error: 'Failed to synchronize live profile data.', success: '', info: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  // 2. Update Profile Details (First Name, Last Name, Email, Contact Number)
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSavingDetails(true);
    setFeedback({ error: '', success: '', info: '' });

    try {
      if (!adminData.id) {
        throw new Error('User ID not found. Please log in again.');
      }

      const payload = {
        first_name: adminData.first_name.trim(),
        last_name: adminData.last_name.trim(),
        email: adminData.email.trim(),
        contact_number: adminData.contact_number.trim(),
      };

      const isPrivileged = adminData.is_superuser || adminData.role === 'PRIVILEGED ADMIN';
      const primaryUrl = isPrivileged
        ? `${API_BASE}/api/users/privileged-admin/${adminData.id}/`
        : `${API_BASE}/api/users/admin/${adminData.id}/`;

      let res = await fetch(primaryUrl, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status === 403) {
        const alternateUrl = isPrivileged
          ? `${API_BASE}/api/users/admin/${adminData.id}/`
          : `${API_BASE}/api/users/privileged-admin/${adminData.id}/`;

        res = await fetch(alternateUrl, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = typeof errData === 'object' 
          ? Object.values(errData).flat().join(' ') 
          : 'Server rejected profile updates.';
        throw new Error(message);
      }

      const updatedUser = await res.json().catch(() => ({}));

      // Update local storage and state
      const stored = JSON.parse(localStorage.getItem('ac_user') || '{}');
      localStorage.setItem('ac_user', JSON.stringify({ ...stored, ...payload, ...updatedUser }));

      setFeedback({
        error: '',
        success: 'Officer profile details updated successfully.',
        info: '',
      });
    } catch (err) {
      console.error('Update error:', err);
      setFeedback({ error: err.message || 'Unable to update details.', success: '', info: '' });
    } finally {
      setSavingDetails(false);
    }
  };

  // 3. Password Update Workflow (Submits current_password and new_password to backend)
  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setChangingPassword(true);

    try {
      const endpoints = [
        `${API_BASE}/api/users/change-password/`,
        `${API_BASE}/api/users/password/change/`,
        `${API_BASE}/api/auth/change-password/`
      ];

      let res = null;
      let errData = {};

      for (const url of endpoints) {
        res = await fetch(url, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            current_password: passwordForm.current_password,
            new_password: passwordForm.new_password,
          }),
        });

        if (res.ok) break;
        errData = await res.json().catch(() => ({}));
      }

      if (!res || !res.ok) {
        const errMsg = errData.current_password || errData.new_password || errData.detail || 'Password update failed. Check your current password.';
        throw new Error(Array.isArray(errMsg) ? errMsg.join(' ') : errMsg);
      }

      setIsPasswordModalOpen(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setFeedback({
        error: '',
        success: 'Passphrase changed successfully.',
        info: '',
      });
    } catch (err) {
      setPasswordError(err.message || 'Password update failed.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#f3f4f6] p-6 lg:p-10 font-sans text-gray-800">
        
        {/* Top Header Banner */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
              <ShieldCheck className="text-[#b32d2d]" size={24} />
              ADMINISTRATIVE PROFILE & CREDENTIALS
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage command center access, contact records, and dispatch clearance.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            COMMAND POST AUTHENTICATED
          </div>
        </div>

        {/* Feedback Messages */}
        {feedback.error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
            <AlertCircle size={16} className="shrink-0" /> {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
            <CheckCircle size={16} className="shrink-0" /> {feedback.success}
          </div>
        )}
        {feedback.info && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
            <Info size={16} className="shrink-0" /> {feedback.info}
          </div>
        )}

        {/* Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Admin Identity Badge */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <div className="w-full h-full rounded-full bg-[#b32d2d]/10 border-2 border-[#b32d2d] flex items-center justify-center text-[#b32d2d]">
                  <User size={44} />
                </div>
                <div className="absolute bottom-0 right-0 p-1.5 bg-emerald-500 border-2 border-white rounded-full text-white" title="Verified Active">
                  <ShieldCheck size={14} />
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="animate-spin text-[#b32d2d]" size={18} />
                </div>
              ) : (
                <>
                  <h2 className="text-base font-black text-gray-900">
                    {adminData.first_name || adminData.last_name 
                      ? `${adminData.first_name} ${adminData.last_name}`.trim() 
                      : adminData.username || 'System Administrator'}
                  </h2>
                  <p className="text-xs font-medium text-gray-400">@{adminData.username || 'admin'}</p>
                </>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2.5 text-xs text-left">
                <div className="flex justify-between items-center text-gray-500">
                  <span className="font-semibold text-gray-400 uppercase text-[10px]">Access Role</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-[#b32d2d] font-bold text-[10px] tracking-wider uppercase">
                    {adminData.role || 'ADMIN'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span className="font-semibold text-gray-400 uppercase text-[10px]">Assigned Station</span>
                  <span className="font-medium text-gray-800 text-right">
                    {adminData.assigned_barangay ? `Brgy. ${adminData.assigned_barangay}` : 'Central Command'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span className="font-semibold text-gray-400 uppercase text-[10px]">Enrolled On</span>
                  <span className="font-medium text-gray-600">
                    {adminData.date_joined ? new Date(adminData.date_joined).toLocaleDateString() : 'Active Session'}
                  </span>
                </div>
              </div>
            </div>

            {/* Permissions Summary Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                <Lock size={14} className="text-[#b32d2d]" /> System Permissions
              </h3>
              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" /> Full Incident Dispatch Clearance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" /> Emergency Units Operational Control
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500" /> Public Broadcast Authority
                </li>
              </ul>
            </div>
          </div>

          {/* Right Column: Profile & Security Edit Forms */}
          <div className="lg:col-span-2 space-y-6">

            {/* Officer Details Form */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <User size={16} className="text-[#b32d2d]" /> Officer Profile Information
                </h2>
                <span className="text-[11px] text-gray-400 font-medium">Auto-synced with station logs</span>
              </div>

              <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">First Name</label>
                    <input
                      type="text"
                      value={adminData.first_name}
                      onChange={(e) => setAdminData({ ...adminData, first_name: e.target.value })}
                      placeholder="Officer first name..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Last Name</label>
                    <input
                      type="text"
                      value={adminData.last_name}
                      onChange={(e) => setAdminData({ ...adminData, last_name: e.target.value })}
                      placeholder="Officer last name..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Contact Number</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={adminData.contact_number}
                        onChange={(e) => setAdminData({ ...adminData, contact_number: e.target.value })}
                        placeholder="+63 900 000 0000"
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={adminData.email}
                        onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                        placeholder="admin@aksyon.online"
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Assigned Barangay Jurisdiction</label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      disabled
                      value={adminData.assigned_barangay ? `Brgy. ${adminData.assigned_barangay}` : 'Central Command Station (All Areas)'}
                      className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs text-gray-500 font-medium cursor-not-allowed"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 block">Barangay jurisdiction can only be modified by the System Superadmin.</span>
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={savingDetails}
                    className="flex items-center gap-1.5 bg-[#b32d2d] hover:bg-[#962626] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingDetails ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Save Officer Details
                  </button>
                </div>
              </form>
            </div>

            {/* Access Passphrase Reset / Change Box */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Key size={16} className="text-[#b32d2d]" /> Security & Access Passphrase
                </h2>
              </div>

              <div className="p-6">
                <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                  Update your administrative command account password or request a reset verification link sent to <span className="font-semibold text-gray-800">{adminData.email || 'your email'}</span>.
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs cursor-pointer"
                  >
                    <Lock size={14} />
                    Change Password Directly
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* PASSWORD CHANGE MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#b32d2d] px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Key size={18} />
                <h3 className="font-bold text-sm tracking-tight">Update Admin Password</h3>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-4 text-xs">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold flex items-center gap-2">
                  <AlertCircle size={15} /> {passwordError}
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  placeholder="Enter current password..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#b32d2d]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="At least 8 characters..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#b32d2d]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Re-enter new password..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-[#b32d2d]"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {changingPassword && <Loader2 className="animate-spin" size={14} />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}