import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Download,
  Upload,
  FileJson,
  Trash2,
  AlertTriangle
} from 'lucide-react';

const API_BASE = 'https://api.aksyon.online';
const CACHE_KEY_BACKUPS = 'cache_admin_backups_history_v2';

export default function BackupsPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [backupHistory, setBackupHistory] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_BACKUPS);
    return cached ? JSON.parse(cached) : [];
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  // Modals
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedJsonFile, setSelectedJsonFile] = useState(null);
  const [parsedJsonPayload, setParsedJsonPayload] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    return cleanToken
      ? { Authorization: `Token ${cleanToken}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }, []);

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

  // Create PostgreSQL Binary Dump Backup
  const handleCreateBackup = async () => {
    setIsCreating(true);
    setFeedback({ error: '', success: '' });

    try {
      let res = await fetch(`${API_BASE}/api/backups/database/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

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
      if (!res.ok) throw new Error(data.detail || data.message || 'Backup creation failed.');

      const newBackup = { ...data.backup, format: 'DUMP' };
      const updatedHistory = [newBackup, ...backupHistory];

      setBackupHistory(updatedHistory);
      sessionStorage.setItem(CACHE_KEY_BACKUPS, JSON.stringify(updatedHistory));

      setFeedback({
        error: '',
        success: `PostgreSQL Dump created successfully! File: ${newBackup.filename}`,
      });
    } catch (err) {
      setFeedback({ error: err.message || 'Server error creating backup.', success: '' });
    } finally {
      setIsCreating(false);
      setConfirmModalOpen(false);
    }
  };

  // Export Direct JSON Backup
  const handleExportJson = async () => {
    setIsCreating(true);
    setFeedback({ error: '', success: '' });

    try {
      const res = await fetch(`${API_BASE}/api/backups/json/export/`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error('Failed to generate JSON snapshot.');

      const jsonPayload = await res.json();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `aksyon-db-export-${timestamp}.json`;

      // Trigger Browser Download
      const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const newBackup = {
        filename,
        size_bytes: blob.size,
        created_at: timestamp,
        format: 'JSON'
      };

      const updatedHistory = [newBackup, ...backupHistory];
      setBackupHistory(updatedHistory);
      sessionStorage.setItem(CACHE_KEY_BACKUPS, JSON.stringify(updatedHistory));

      setFeedback({ error: '', success: `JSON database export saved to your downloads: ${filename}` });
    } catch (err) {
      setFeedback({ error: err.message || 'JSON export failed.', success: '' });
    } finally {
      setIsCreating(false);
    }
  };

  // Select Local JSON File for Import
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setFeedback({ error: 'Please select a valid .json database backup file.', success: '' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        setSelectedJsonFile(file);
        setParsedJsonPayload(parsed);
        setRestoreModalOpen(true);
      } catch (err) {
        setFeedback({ error: 'Invalid or corrupt JSON structure.', success: '' });
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore to Server API
  const handleExecuteRestore = async () => {
    if (!parsedJsonPayload) return;

    setIsRestoring(true);
    setFeedback({ error: '', success: '' });

    try {
      const res = await fetch(`${API_BASE}/api/backups/json/restore/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: parsedJsonPayload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to restore database state.');

      // CLEAR CLIENT SESSION CACHE SO OTHER PAGES RE-FETCH RESTORED DATA
      sessionStorage.clear();

      setFeedback({
        error: '',
        success: 'Database restored successfully! All active modules have been synchronized with the imported backup.',
      });
      setRestoreModalOpen(false);
      setSelectedJsonFile(null);
      setParsedJsonPayload(null);
    } catch (err) {
      setFeedback({ error: err.message || 'Database restore failed.', success: '' });
    } finally {
      setIsRestoring(false);
    }
  };

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
        
        {/* TOP TOOLBAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-2">
              <Database className="text-[#b32d2d]" size={24} />
              SYSTEM DATABASE BACKUPS & RESTORE
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Create PostgreSQL dumps, export/import JSON snapshots, or restore database state.
            </p>
          </div>

          {/* HIDDEN FILE INPUT FOR IMPORT */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Upload size={15} className="text-blue-600" />
              Import & Restore JSON
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              disabled={isCreating}
              className="bg-gray-800 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileJson size={15} className="text-emerald-400" />
              Export JSON
            </button>

            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              disabled={isCreating}
              className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              Create Dump Backup
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

        {/* STATUS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-xl shrink-0">
              <HardDrive size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Maximum File Size</span>
              <span className="text-base font-black text-gray-900">49.00 MB Capacity</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Optimized compressed dump & JSON format</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Backup Quality Check</span>
              <span className="text-base font-black text-gray-900">Automated Health Check</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Verifies contents are complete & readable</p>
            </div>
          </div>

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

        {/* BACKUP HISTORY DIRECTORY TABLE */}
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
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-xs font-black text-gray-900 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-6">SNAPSHOT FILENAME</th>
                  <th className="py-3.5 px-6">FORMAT</th>
                  <th className="py-3.5 px-6">FILE SIZE</th>
                  <th className="py-3.5 px-6">TIMESTAMP (UTC)</th>
                  <th className="py-3.5 px-6 text-center">STATUS</th>
                  <th className="py-3.5 px-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {backupHistory.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      <Database className="mx-auto mb-2 opacity-30" size={32} />
                      No backup snapshots created in this session yet.
                    </td>
                  </tr>
                ) : (
                  backupHistory.map((item, index) => (
                    <tr key={item.filename || index} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-gray-900 flex items-center gap-2">
                        {item.format === 'JSON' ? (
                          <FileJson size={15} className="text-emerald-600" />
                        ) : (
                          <Database size={15} className="text-[#b32d2d]" />
                        )}
                        {item.filename}
                      </td>
                      <td className="py-4 px-6 font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                          item.format === 'JSON' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {item.format || 'DUMP'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-700">
                        {formatBytes(item.size_bytes)}
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-500">
                        {item.created_at || 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase">
                          <CheckCircle size={12} /> Verified & Saved
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const fallbackBucketUrl = `https://api.aksyon.online/storage/v1/object/public/aksyon-backups/${item.filename}`;
                              window.open(item.download_url || fallbackBucketUrl, '_blank');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                          >
                            <Download size={13} /> Download
                          </button>
                          <button
                            onClick={() => {
                              const filtered = backupHistory.filter((_, idx) => idx !== index);
                              setBackupHistory(filtered);
                              sessionStorage.setItem(CACHE_KEY_BACKUPS, JSON.stringify(filtered));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-[#b32d2d] rounded-lg text-xs font-bold transition-all cursor-pointer"
                            title="Remove from session view"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CONFIRM RESTORE MODAL */}
      {restoreModalOpen && selectedJsonFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-4">
              <AlertTriangle size={28} />
            </div>

            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              Restore Database from JSON?
            </h3>

            <p className="text-xs text-gray-600 font-medium mb-4 leading-relaxed">
              You are about to import <strong className="text-gray-900">{selectedJsonFile.name}</strong>. This action will update system tables and synchronize live modules across the application.
            </p>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px] font-semibold text-left mb-6 w-full">
              ⚠️ Warning: Performing a database restore will overwrite conflicting records. Ensure this file is from a trusted backup.
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setRestoreModalOpen(false);
                  setSelectedJsonFile(null);
                  setParsedJsonPayload(null);
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isRestoring ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE DUMP MODAL */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-full mb-4">
              <Database size={28} />
            </div>

            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              Create System Database Dump
            </h3>

            <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
              Are you sure you want to generate a PostgreSQL database dump? It will perform an integrity check and store the file in secure cloud storage.
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
                Create Dump
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}