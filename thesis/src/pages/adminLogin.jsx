import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';

const targetHostname = window.location.hostname || '127.0.0.1';

// const API_BASE = 'https://api.aksyon.online';
const API_BASE = `http://${targetHostname}:8000`;

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot Password States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // const response = await fetch('https://api.aksyon.online/api/users/login/', {
      const response = await fetch(`${API_BASE}/api/users/login/`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.email.trim(),
          password: formData.password,
        }),
      });

      const contentType = response.headers.get('content-type');
      let data = {};
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (response.ok) {
        // 1. Extract Token safely
        const token = data.token || data.key || data.access;
        localStorage.setItem('ac_token', token);

        // 2. Extract full User Object
        const extractedUser = data.user || data.account || data;
        const normalizedUsername = (extractedUser.username || formData.email).trim();
        const rawRole = extractedUser.role
          ? String(extractedUser.role).toUpperCase()
          : (normalizedUsername === 'g2c405' ? 'PRIVILEGED_ADMIN' : 'ADMIN');

        const isSuper = Boolean(
          extractedUser.is_superuser === true ||
          rawRole === 'PRIVILEGED_ADMIN' ||
          rawRole === 'SUPERADMIN' ||
          normalizedUsername === 'g2c405'
        );

        const normalizedUser = {
          ...extractedUser,
          username: normalizedUsername,
          role: rawRole,
          is_superuser: isSuper,
        };

        // 3. Persist individual flags so ProtectedRoute can inspect them immediately
        localStorage.setItem('ac_user', JSON.stringify(normalizedUser));
        localStorage.setItem('user_role', rawRole);
        localStorage.setItem('is_superuser', String(isSuper));
        localStorage.setItem('username', normalizedUsername);

        // 4. Route accurately according to privilege level
        if (isSuper) {
          navigate('/superadmin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        setError(
          data.error ||
          data.non_field_errors ||
          data.detail ||
          'Invalid credentials or inactive account.'
        );
      }
    } catch (err) {
      console.error('Login connection diagnostic failure:', err);
      setError(
        'Connection refused. Double-check that your server is running and CORS settings allow this request.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');

    try {
      // const response = await fetch('https://api.aksyon.online/api/users/forgot-password/', {
      const response = await fetch(`${API_BASE}/api/users/forgot-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: forgotEmail.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setForgotMessage(
          data.message || 
          'If an account with that email exists, a password reset link has been dispatched to your inbox.'
        );
        setForgotSuccess(true);
      } else {
        setForgotError(
          data.detail ||
          data.error ||
          data.email?.[0] ||
          'Failed to send password reset request. Verify your email address.'
        );
      }
    } catch (err) {
      console.error('Forgot password submission failed:', err);
      setForgotError('Connection error. Please try again later.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
    setForgotMessage('');
  };

  return (
    <div className="min-h-screen w-full bg-[#1a1a1a] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#b32d2d] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

      {/* Login Card */}
      <div className="bg-[#2a2a2a] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden z-10 border border-white/10">
        {/* Header Banner */}
        <div className="bg-[#b32d2d] p-8 text-center text-white">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase">Aksyon</h1>
          <p className="text-red-100 text-sm mt-1 font-medium">Command Center Portal</p>
        </div>

        {/* Input Interactive Box Area */}
        <div className="p-8">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Email or Username
              </label>
              <div className="flex items-center bg-[#1f1f1f] border border-gray-700 rounded-lg overflow-hidden focus-within:border-[#b32d2d] transition-colors">
                <div className="pl-4 text-gray-500">
                  <Mail size={18} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Enter admin identifier..."
                  className="w-full p-3 text-gray-200 bg-transparent focus:outline-none text-sm"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="mb-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="flex items-center bg-[#1f1f1f] border border-gray-700 rounded-lg overflow-hidden focus-within:border-[#b32d2d] transition-colors">
                <div className="pl-4 text-gray-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full p-3 text-gray-200 bg-transparent focus:outline-none text-sm"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {/* Forgot Password Trigger */}
            <div className="flex justify-end mb-6">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(formData.email.includes('@') ? formData.email : '');
                  setIsForgotModalOpen(true);
                }}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#b32d2d] hover:bg-[#8b2323] text-white p-3.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Authenticating Gateway...
                </>
              ) : (
                'Secure Login'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-gray-500 text-xs font-medium">
            Authorized Personnel Only. <br /> Access is monitored and logged.
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={closeForgotModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-black text-white uppercase tracking-wide mb-1">
              Reset Password
            </h3>
            <p className="text-gray-400 text-xs mb-5">
              Enter your registered administrator email to receive a password recovery link.
            </p>

            {forgotError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold">
                <AlertCircle size={16} /> {forgotError}
              </div>
            )}

            {forgotSuccess ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={24} />
                </div>
                <h4 className="text-white text-sm font-bold mb-1">Recovery Email Sent</h4>
                <p className="text-gray-400 text-xs mb-5">
                  {forgotMessage}
                </p>
                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="w-full bg-[#1f1f1f] hover:bg-[#333333] text-white py-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Registered Email Address
                  </label>
                  <div className="flex items-center bg-[#1f1f1f] border border-gray-700 rounded-lg overflow-hidden focus-within:border-[#b32d2d] transition-colors">
                    <div className="pl-4 text-gray-500">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      required
                      placeholder="admin@aksyon.online"
                      className="w-full p-3 text-gray-200 bg-transparent focus:outline-none text-sm"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="flex-1 bg-[#1f1f1f] hover:bg-[#333333] text-gray-300 py-3 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-[#b32d2d] hover:bg-[#8b2323] text-white py-3 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}