import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, AlertCircle } from 'lucide-react';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        // Success! Save user data to localStorage so the app remembers who is logged in
        localStorage.setItem('ac_user', JSON.stringify(data.user));
        
        // Send them to the dashboard
        navigate('/dashboard');
      } else {
        // Show the error message from the backend (e.g., "Invalid email", "Access denied")
        setError(data.error);
      }
    } catch (err) {
      setError('Cannot connect to the server. Is XAMPP running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#1a1a1a] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#b32d2d] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

      {/* Login Card */}
      <div className="bg-[#2a2a2a] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden z-10 border border-white/10">
        
        {/* Header */}
        <div className="bg-[#b32d2d] p-8 text-center text-white">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <ShieldAlert size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase">ACEmergency</h1>
          <p className="text-red-100 text-sm mt-1 font-medium">Command Center Portal</p>
        </div>

        {/* Form */}
        <div className="p-8">
          
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3 text-sm font-bold">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className="flex items-center bg-[#1f1f1f] border border-gray-700 rounded-lg overflow-hidden focus-within:border-[#b32d2d] transition-colors">
                <div className="pl-4 text-gray-500"><Mail size={18} /></div>
                <input 
                  type="email" 
                  required
                  placeholder="admin@acemergency.ph"
                  className="w-full p-3 text-gray-200 bg-transparent focus:outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Password</label>
              <div className="flex items-center bg-[#1f1f1f] border border-gray-700 rounded-lg overflow-hidden focus-within:border-[#b32d2d] transition-colors">
                <div className="pl-4 text-gray-500"><Lock size={18} /></div>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full p-3 text-gray-200 bg-transparent focus:outline-none"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#b32d2d] hover:bg-[#8b2323] text-white p-3.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : 'Secure Login'}
            </button>

          </form>
          
          <div className="mt-6 text-center text-gray-500 text-xs font-medium">
            Authorized Personnel Only. <br/> Access is monitored and logged.
          </div>
        </div>
      </div>
    </div>
  );
}