import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/header';
import {
  Database,
  CloudUpload,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  Clock,
  Info
} from 'lucide-react';

const targetHostname = window.location.hostname || '127.0.0.1';
const API_BASE = 'https://api.aksyon.online';
// const API_BASE = `http://${targetHostname}:8000`;

const CACHE_KEY_BACKUPS = 'cache_admin_backups_history_v1';

export default function BackupsPage() {
  const navigate = useNavigate();

  // Load past backups from session cache if available
  const [backupHistory, setBackupHistory] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_BACKUPS);
    return cached ? JSON.parse(cached) : [];
  });

  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  // Confirmation Decision Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    return cleanToken
      ? { Authorization: `Token ${cleanToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }, []);

  // Check if current user is Privileged Admin
  useEffect(() => {
    const token = localStorage.getItem('ac_token');
    const user = JSON.parse(localStorage.getItem('ac_user') || '{}');
    
    if (!token) {
      navigate('/login');
      return;
    }

    const isPrivileged = user.is_superuser || user.role?.toUpperCase() === 'PRIVILEGED ADMIN';
    if (!isPrivileged) {
      setFeedback({
        error: 'Access Restricted: Database backups require Privileged Administrator authorization.',
        success: ''
      });
    }
  }, [navigate]);

  // Execute Database Backup POST endpoint
  const handleCreateBackup = async () => {
    setIsCreating(true);
    setFeedback({ error: '', success: '' });

    try {
      let res = await fetch(`${API_BASE}/api/backups/database/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      // Bearer token retry fallback
      if (res.status === 401) {
        const rawToken = localStorage.getItem('ac_token') || '';
        const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
        res = await fetch(`${API_BASE}/api/backups/database/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
        });
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Database backup generation failed.');
      }

      // Success Response
      const newBackup = data.backup;
      const updatedHistory = [newBackup, ...backupHistory];

      setBackupHistory(updatedHistory);
      sessionStorage.setItem(CACHE_KEY_BACKUPS, JSON.stringify(updatedHistory));

      setFeedback({
        error: '',
        success: `Database backup created and verified successfully! File: ${newBackup.filename}`,
      });
    } catch (err) {
      console.error('Database backup error:', err);
      setFeedback({
        error: err.message || 'A server error occurred while producing the database copy.',
        success: '',
      });
    } finally {
      setIsCreating(false);
      setConfirmModalOpen(false);
    }
  };

  // Helper to format raw bytes into human-readable MB / KB
  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f3f4f6] font-sans text-gray-800 flex flex-col space-y-6">
        
        {/* TOP TOOLBAR & TITLE */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
              <Database className="text-[#b32d2d]" size={24} />
              SYSTEM DATABASE BACKUPS
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Create complete system backups and save verified copies directly to secure cloud storage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={isCreating}
              className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating Backup...
                </>
              ) : (
                <>
                  <CloudUpload size={16} />
                  Create Database Backup
                </>
              )}
            </button>
          </div>
        </div>

        {/* FEEDBACK NOTIFICATIONS */}
        {feedback.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs shrink-0">
            <AlertCircle size={16} className="shrink-0" /> {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs shrink-0">
            <CheckCircle size={16} className="shrink-0" /> {feedback.success}
          </div>
        )}

        {/* ROW 1: USER-FRIENDLY STATUS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Capacity */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-xl shrink-0">
              <HardDrive size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Maximum File Size</span>
              <span className="text-base font-black text-gray-900">49.00 MB Capacity</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Optimized compressed database format</p>
            </div>
          </div>

          {/* Card 2: Health Check */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Backup Quality Check</span>
              <span className="text-base font-black text-gray-900">Automated Health Check</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Verifies database contents are complete & readable</p>
            </div>
          </div>

          {/* Card 3: Storage */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cloud Storage</span>
              <span className="text-base font-black text-gray-900">Secure Backup Folder</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Safely saved to encrypted system storage</p>
            </div>
          </div>

        </div>

        {/* ROW 2: BACKUP HISTORY DIRECTORY TABLE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-[#b32d2d]" />
              <h2 className="text-sm font-bold text-gray-900">Session Generated Backups</h2>
            </div>
            <span className="text-xs font-black text-gray-900">
              {backupHistory.length} Total Snapshots Created
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-xs font-black text-gray-900 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-6">SNAPSHOT FILENAME</th>
                  <th className="py-3.5 px-6">FILE SIZE</th>
                  <th className="py-3.5 px-6">STORAGE LOCATION</th>
                  <th className="py-3.5 px-6">TIMESTAMP (UTC)</th>
                  <th className="py-3.5 px-6 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {backupHistory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-gray-400 font-medium">
                      <Database className="mx-auto mb-2 opacity-30" size={32} />
                      No backup snapshots created in this session yet. Click "Create Database Backup" to generate one.
                    </td>
                  </tr>
                ) : (
                  backupHistory.map((item, index) => (
                    <tr key={item.filename || index} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900 flex items-center gap-2">
                        <Database size={14} className="text-[#b32d2d]" />
                        {item.filename}
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-700">
                        {formatBytes(item.size_bytes)}
                      </td>
                      <td className="py-4 px-6 font-semibold text-gray-500">
                        <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-[11px]">
                          Secure Cloud Storage
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-500">
                        {item.created_at || 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
                          <CheckCircle size={12} /> Verified & Saved
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CONFIRMATION DECISION MODAL */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-full mb-4">
              <Database size={28} />
            </div>

            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              Create System Database Backup
            </h3>

            <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
              Are you sure you want to generate a new database copy? It will perform an integrity check and store the file in secure cloud storage.
            </p>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isCreating && <Loader2 size={14} className="animate-spin" />}
                Create Backup
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}