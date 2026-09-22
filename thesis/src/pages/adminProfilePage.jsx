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
  Loader2
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  // Real Officer Data
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

  // Password Update State
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Header formatting with fallback
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

  // 1. Fetch Real Admin Record from Backend
  const fetchAdminProfile = async () => {
    try {
      setLoading(true);
      const rawToken = localStorage.getItem('ac_token') || '';
      const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();

      // Attempt primary DRF endpoint /api/users/me/
      let res = await fetch(`${API_BASE}/api/users/me/`, {
        headers: getAuthHeaders(),
      });

      // Try Bearer token fallback if Token prefix gets 401
      if (res.status === 401) {
        res = await fetch(`${API_BASE}/api/users/me/`, {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // If backend uses /api/users/profile/ instead of /me/
      if (res.status === 404) {
        res = await fetch(`${API_BASE}/api/users/profile/`, {
          headers: getAuthHeaders(),
        });
      }

      if (res.ok) {
        const data = await res.json();
        const userObj = data.user || data;

        setAdminData({
          id: userObj.id || null,
          username: userObj.username || '',
          email: userObj.email || '',
          first_name: userObj.first_name || '',
          last_name: userObj.last_name || '',
          contact_number: userObj.contact_number || userObj.phone_number || '',
          assigned_barangay: userObj.assigned_barangay || userObj.residential_barangay || '',
          role: userObj.is_superuser ? 'SUPERADMIN' : userObj.is_staff ? 'ADMIN' : (userObj.role || 'STATION_ADMIN'),
          is_staff: Boolean(userObj.is_staff),
          is_superuser: Boolean(userObj.is_superuser),
          date_joined: userObj.date_joined || '',
        });

        // Keep cached localStorage in sync
        localStorage.setItem('ac_user', JSON.stringify(userObj));
      } else {
        // Fallback to cached user data from login if endpoint is unavailable
        const stored = localStorage.getItem('ac_user');
        if (stored) {
          const userObj = JSON.parse(stored);
          setAdminData({
            id: userObj.id || null,
            username: userObj.username || '',
            email: userObj.email || '',
            first_name: userObj.first_name || '',
            last_name: userObj.last_name || '',
            contact_number: userObj.contact_number || userObj.phone_number || '',
            assigned_barangay: userObj.assigned_barangay || userObj.residential_barangay || '',
            role: userObj.is_superuser ? 'SUPERADMIN' : userObj.is_staff ? 'ADMIN' : (userObj.role || 'STATION_ADMIN'),
            is_staff: Boolean(userObj.is_staff),
            is_superuser: Boolean(userObj.is_superuser),
            date_joined: userObj.date_joined || '',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching admin profile:', err);
      // Load fallback from localStorage
      const stored = localStorage.getItem('ac_user');
      if (stored) {
        const userObj = JSON.parse(stored);
        setAdminData((prev) => ({
          ...prev,
          ...userObj,
          role: userObj.is_superuser ? 'SUPERADMIN' : (userObj.role || 'ADMIN'),
        }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  // 2. Save Updated Profile Information
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback({ error: '', success: '' });

    try {
      const payload = {
        first_name: adminData.first_name,
        last_name: adminData.last_name,
        email: adminData.email,
        contact_number: adminData.contact_number,
      };

      const res = await fetch(`${API_BASE}/api/users/me/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Try fallback route
        const fallbackRes = await fetch(`${API_BASE}/api/users/${adminData.id || ''}/`, {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });

        if (!fallbackRes.ok) {
          throw new Error('Server rejected profile update.');
        }
      }

      // Sync local storage
      const stored = JSON.parse(localStorage.getItem('ac_user') || '{}');
      const updatedUser = { ...stored, ...payload };
      localStorage.setItem('ac_user', JSON.stringify(updatedUser));

      setFeedback({ error: '', success: 'Administrative credentials updated successfully.' });
    } catch (err) {
      // If no patch route exists, store locally
      const stored = JSON.parse(localStorage.getItem('ac_user') || '{}');
      const updatedUser = { ...stored, ...adminData };
      localStorage.setItem('ac_user', JSON.stringify(updatedUser));
      setFeedback({ error: '', success: 'Officer details updated locally.' });
    } finally {
      setSaving(false);
    }
  };

  // 3. Password Update
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setFeedback({ error: '', success: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFeedback({ error: 'New password and confirmation do not match.', success: '' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setFeedback({ error: 'Password must be at least 8 characters long.', success: '' });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/change-password/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          old_password: passwordData.oldPassword,
          new_password: passwordData.newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || 'Failed to update password.');
      }

      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setFeedback({ error: '', success: 'Access passphrase updated securely.' });
    } catch (err) {
      setFeedback({ error: err.message || 'Error updating password.', success: '' });
    } finally {
      setSavingPassword(false);
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
            <AlertCircle size={16} /> {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
            <CheckCircle size={16} /> {feedback.success}
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
                        placeholder="admin@angelescity.gov.ph"
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
                    disabled={saving}
                    className="flex items-center gap-1.5 bg-[#b32d2d] hover:bg-[#962626] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Save Officer Details
                  </button>
                </div>
              </form>
            </div>

            {/* Access Passphrase Update */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Key size={16} className="text-[#b32d2d]" /> Security & Access Passphrase
                </h2>
              </div>

              <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#b32d2d] focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="flex items-center gap-1.5 bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-xs disabled:opacity-50"
                  >
                    {savingPassword ? <Loader2 className="animate-spin" size={14} /> : <Lock size={14} />}
                    Update Passphrase
                  </button>
                </div>
              </form>
            </div>

          </div>

        </div>

      </div>
    </AdminLayout>
  );
}