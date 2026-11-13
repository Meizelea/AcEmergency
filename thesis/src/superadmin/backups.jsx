import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/header';
import {
  Database,
  CloudUpload,
  HardDrive,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

const API_BASE = 'https://api.aksyon.online';

// v4: the list items changed shape (description, dump_size_bytes, audit CSV info, legacy flag)
const CACHE_KEY_BACKUPS = 'cache_admin_backups_history_v4';

// Must match the backend (backups/services/database_backup.py and backups/views.py)
const MAX_DESCRIPTION_LENGTH = 150;
const RESTORE_CONFIRMATION_PHRASE = 'RESTORE DATABASE';

// Cache lives in sessionStorage so it is wiped when the tab/session ends.
const saveBackupCache = (list) => {
  try {
    sessionStorage.setItem(CACHE_KEY_BACKUPS, JSON.stringify(list));
  } catch {
    /* storage unavailable - ignore */
  }
};

// Remove copies left behind by older versions of this page.
try {
  localStorage.removeItem('cache_admin_backups_history_v3');
  sessionStorage.removeItem('cache_admin_backups_history_v3');
} catch {
  /* ignore */
}

const isPrivilegedUser = (user) =>
  Boolean(
    user &&
      (user.is_superuser === true ||
        String(user.role || '').toUpperCase() === 'PRIVILEGED_ADMIN' ||
        String(user.role || '').toUpperCase() === 'SUPERADMIN')
  );

// DRF TokenAuthentication only accepts the "Token" keyword, so there is no Bearer retry.
const authHeaders = (json = true) => {
  const token = (localStorage.getItem('ac_token') || '').replace(/^(Token|Bearer)\s+/i, '').trim();
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Token ${token}`;
  return headers;
};

// Maps one item of GET /api/backups/database/list/ to the shape used by this page.
// New backups carry a manifest (dump_size_bytes, audit CSV info); legacy ones only have size_bytes.
const normalizeBackup = (b) => ({
  filename: b.filename,
  description: b.description || '',
  backup_type: b.backup_type || 'full',
  size_bytes: b.dump_size_bytes ?? b.size_bytes ?? 0,
  audit_csv_size_bytes: b.audit_csv_size_bytes ?? null,
  audit_csv_filename: b.audit_csv_filename || null,
  created_at: b.created_at || null,
  legacy: Boolean(b.legacy)
});

const formatBytes = (bytes) => {
  if (!bytes || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
};

export default function BackupsPage() {
  const navigate = useNavigate();

  const [backupHistory, setBackupHistory] = useState(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_BACKUPS);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isFetchingList, setIsFetchingList] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState('');
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  const listInFlightRef = useRef(false);

  // Create backup modal (a description is now required by the backend)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [createDescription, setCreateDescription] = useState('');
  const [createError, setCreateError] = useState('');

  // Restore modal (the backend now requires the admin's password and a typed confirmation phrase)
  const [dumpRestoreModalOpen, setDumpRestoreModalOpen] = useState(false);
  const [selectedDumpFilename, setSelectedDumpFilename] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoreError, setRestoreError] = useState('');

  // GET /api/backups/database/list/
  const fetchServerBackups = useCallback(async () => {
    if (listInFlightRef.current) return;
    listInFlightRef.current = true;
    setIsFetchingList(true);

    try {
      const res = await fetch(`${API_BASE}/api/backups/database/list/`, {
        headers: authHeaders()
      });

      if (res.status === 401) {
        setFeedback({ error: 'Session expired or invalidated. Please log back in.', success: '' });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch server backup list.');

      const serverBackups = (data.backups || []).map(normalizeBackup);
      setBackupHistory(serverBackups);
      saveBackupCache(serverBackups);
    } catch (err) {
      console.warn('Server backup listing error:', err);
      setFeedback({ error: err.message || 'Failed to fetch server backup list.', success: '' });
    } finally {
      listInFlightRef.current = false;
      setIsFetchingList(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ac_token');
    let user = {};
    try {
      user = JSON.parse(localStorage.getItem('ac_user') || '{}');
    } catch {
      user = {};
    }

    if (!token || token === 'undefined' || token === 'null') {
      navigate('/login', { replace: true });
      return;
    }

    if (!isPrivilegedUser(user)) {
      // Regular barangay admins must not see this page at all.
      navigate('/analytics', { replace: true });
      return;
    }

    fetchServerBackups();
  }, [navigate, fetchServerBackups]);

  /* ------------------------------ create backup ------------------------------ */

  const openCreateModal = () => {
    setCreateDescription('');
    setCreateError('');
    setConfirmModalOpen(true);
  };

  // POST /api/backups/database/  body: { description }
  const handleCreateBackup = async () => {
    const description = createDescription.trim();
    if (!description) {
      setCreateError('A backup description is required.');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    setFeedback({ error: '', success: '' });

    try {
      const res = await fetch(`${API_BASE}/api/backups/database/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ description })
      });

      if (res.status === 401) {
        setConfirmModalOpen(false);
        setFeedback({ error: 'Authentication expired. Please log in again to generate backups.', success: '' });
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Backup creation failed.');

      const filename = data.backup?.filename || '';
      setConfirmModalOpen(false);
      setCreateDescription('');
      setFeedback({
        error: '',
        success: `Backup created successfully${filename ? ` (${filename})` : ''}. The audit log CSV was saved with it.`
      });
      fetchServerBackups();
    } catch (err) {
      setCreateError(err.message || 'Server error creating backup.');
    } finally {
      setIsCreating(false);
    }
  };

  /* ------------------------------ restore backup ------------------------------ */

  const openRestoreModal = (filename) => {
    setSelectedDumpFilename(filename);
    setRestorePassword('');
    setShowRestorePassword(false);
    setRestoreConfirmText('');
    setRestoreError('');
    setDumpRestoreModalOpen(true);
  };

  const closeRestoreModal = () => {
    if (isRestoring) return;
    setDumpRestoreModalOpen(false);
    setSelectedDumpFilename('');
    setRestorePassword('');
    setRestoreConfirmText('');
    setRestoreError('');
  };

  const canRestore =
    restorePassword.length > 0 &&
    restoreConfirmText === RESTORE_CONFIRMATION_PHRASE &&
    !isRestoring;

  // POST /api/backups/database/restore/  body: { filename, password, confirmation_phrase }
  const handleExecuteDumpRestore = async () => {
    if (!selectedDumpFilename || !canRestore) return;

    setIsRestoring(true);
    setRestoreError('');
    setFeedback({ error: '', success: '' });

    try {
      const res = await fetch(`${API_BASE}/api/backups/database/restore/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          filename: selectedDumpFilename,
          password: restorePassword,
          confirmation_phrase: restoreConfirmText
        })
      });

      if (res.status === 401) {
        setDumpRestoreModalOpen(false);
        setRestorePassword('');
        setFeedback({
          error: 'Authentication failure: Token was invalidated. Please log back in before restoring.',
          success: ''
        });
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 400 = missing field / wrong phrase / rejected, 403 = incorrect password, 500 = restore failed
        throw new Error(data.detail || data.message || 'Database restoration failed.');
      }

      // The restored database may no longer recognise our token or cached data,
      // so wipe the whole local session and send the admin back to the login page.
      try {
        sessionStorage.clear();
        ['ac_token', 'ac_user', 'user_role', 'is_superuser', 'username'].forEach((k) =>
          localStorage.removeItem(k)
        );
      } catch {
        /* ignore */
      }

      const warning = data.admin_bootstrap_warning ? ` ${data.admin_bootstrap_warning}` : '';
      setFeedback({
        error: '',
        success:
          (data.message || `Database restored successfully from: ${selectedDumpFilename}`) +
          warning +
          ' You will be signed out so you can log in again.'
      });
      setDumpRestoreModalOpen(false);
      setSelectedDumpFilename('');
      setRestorePassword('');
      setRestoreConfirmText('');
      setTimeout(() => navigate('/login', { replace: true }), data.admin_bootstrap_warning ? 6000 : 2500);
    } catch (err) {
      setRestoreError(err.message || 'Database restore failed.');
    } finally {
      setIsRestoring(false);
    }
  };

  /* ------------------------------ audit log CSV ------------------------------ */

  // GET /api/backups/database/audit-logs/<filename>/  (authenticated, returns a CSV attachment)
  const handleDownloadAuditCsv = async (item) => {
    if (!item.audit_csv_filename) return;

    setDownloadingFile(item.filename);
    setFeedback({ error: '', success: '' });

    try {
      const res = await fetch(
        `${API_BASE}/api/backups/database/audit-logs/${encodeURIComponent(item.filename)}/`,
        { headers: authHeaders(false) }
      );

      if (res.status === 401) {
        throw new Error('Session expired or invalidated. Please log back in.');
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not download the audit log export.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.audit_csv_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setFeedback({ error: '', success: `Downloaded audit log export: ${item.audit_csv_filename}` });
    } catch (err) {
      setFeedback({ error: err.message || 'Download failed.', success: '' });
    } finally {
      setDownloadingFile('');
    }
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
              Create PostgreSQL dumps (with an audit log export) or restore server database state.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchServerBackups}
              disabled={isFetchingList}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 p-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Refresh Server Backups List"
            >
              <RefreshCw size={15} className={`text-gray-600 ${isFetchingList ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={openCreateModal}
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold shadow-xs shrink-0">
            <div className="flex items-center gap-3">
              <AlertCircle size={16} className="shrink-0" /> {feedback.error}
            </div>
            {feedback.error.includes('expired') || feedback.error.includes('invalidated') ? (
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 transition-all cursor-pointer"
              >
                Log In Again
              </button>
            ) : null}
          </div>
        )}
        {feedback.success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs shrink-0">
            <CheckCircle size={16} className="shrink-0" /> {feedback.success}
          </div>
        )}

        {/* STATUS CARDS */}
        <div className="w-full">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-xl shrink-0">
              <HardDrive size={24} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Maximum File Size</span>
              <span className="text-base font-black text-gray-900">49.00 MB Capacity</span>
              <p className="text-[10px] text-gray-400 mt-0.5">Optimized compressed dump format</p>
            </div>
          </div>
        </div>

        {/* BACKUP HISTORY DIRECTORY TABLE */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-[#b32d2d]" />
              <h2 className="text-sm font-bold text-gray-900">Generated Backup Log</h2>
            </div>
            <span className="text-xs font-black text-gray-900">
              {backupHistory.length} Total Snapshots Recorded
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50 text-xs font-black text-gray-900 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-6">BACKUP</th>
                  <th className="py-3.5 px-6">TYPE</th>
                  <th className="py-3.5 px-6">FILE SIZE</th>
                  <th className="py-3.5 px-6">CREATED</th>
                  <th className="py-3.5 px-6 text-center">STATUS</th>
                  <th className="py-3.5 px-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {backupHistory.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      <Database className="mx-auto mb-2 opacity-30" size={32} />
                      No backup snapshots generated yet. Click "Create Dump Backup" to start.
                    </td>
                  </tr>
                ) : (
                  backupHistory.map((item, index) => (
                    <tr key={item.filename || index} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 font-bold text-gray-900 break-all">
                          <Database size={15} className="text-[#b32d2d] shrink-0" />
                          {item.filename}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-gray-500 font-medium mt-1 pl-[23px] max-w-md">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-bold">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase bg-red-50 text-red-700 border border-red-200">
                          {item.backup_type || 'full'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-700">
                        <div className="font-bold">{formatBytes(item.size_bytes)}</div>
                        {item.audit_csv_size_bytes != null && (
                          <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                            + {formatBytes(item.audit_csv_size_bytes)} audit CSV
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-500 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {item.legacy ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-black uppercase whitespace-nowrap">
                            <AlertTriangle size={12} /> Legacy Backup
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-black uppercase whitespace-nowrap">
                            <CheckCircle size={12} /> Verified & Saved
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openRestoreModal(item.filename)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Restore PostgreSQL Database from this dump"
                          >
                            <RotateCcw size={13} /> Restore
                          </button>

                          <button
                            onClick={() => handleDownloadAuditCsv(item)}
                            disabled={!item.audit_csv_filename || downloadingFile === item.filename}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              item.audit_csv_filename
                                ? 'Download the audit log export saved with this backup (CSV)'
                                : 'Legacy backups have no audit log export'
                            }
                          >
                            {downloadingFile === item.filename ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                            Audit CSV
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

      {/* CONFIRM SERVER DUMP RESTORE MODAL */}
      {dumpRestoreModalOpen && selectedDumpFilename && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center my-auto">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-full mb-4">
              <AlertTriangle size={28} />
            </div>

            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              Restore Database from Dump?
            </h3>

            <p className="text-xs text-gray-600 font-medium mb-4 leading-relaxed">
              You are about to replace the current database with the backup file: <br/>
              <strong className="text-gray-900 block mt-1 break-all">{selectedDumpFilename}</strong>
            </p>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-[11px] font-semibold text-left mb-4 w-full space-y-1">
              <p>⚠️ <strong>This cannot be undone:</strong></p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                <li>Everything saved after this backup was created will be lost.</li>
                <li>The restore runs in a single transaction, so it is rolled back automatically if it fails.</li>
                <li>You will be signed out afterwards and must log in again.</li>
              </ul>
            </div>

            {restoreError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2 w-full text-left">
                <AlertCircle size={16} className="shrink-0" /> {restoreError}
              </div>
            )}

            <div className="w-full space-y-3 text-left mb-5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Your current password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showRestorePassword ? 'text' : 'password'}
                    value={restorePassword}
                    autoComplete="current-password"
                    onChange={(e) => { setRestorePassword(e.target.value); setRestoreError(''); }}
                    className="w-full p-2.5 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#b32d2d]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRestorePassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showRestorePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Type <span className="font-black text-[#b32d2d]">{RESTORE_CONFIRMATION_PHRASE}</span> to confirm <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={restoreConfirmText}
                  autoComplete="off"
                  onChange={(e) => { setRestoreConfirmText(e.target.value); setRestoreError(''); }}
                  placeholder={RESTORE_CONFIRMATION_PHRASE}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:border-[#b32d2d]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={closeRestoreModal}
                disabled={isRestoring}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteDumpRestore}
                disabled={!canRestore}
                className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isRestoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {isRestoring ? 'Restoring...' : 'Execute Restore'}
              </button>
            </div>

            {isRestoring && (
              <p className="text-[10.5px] text-gray-500 font-medium mt-3">
                Restoring can take a few minutes. Please keep this page open.
              </p>
            )}
          </div>
        </div>
      )}

      {/* CREATE DUMP MODAL */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center my-auto">
            <div className="p-3 bg-red-50 text-[#b32d2d] rounded-full mb-4">
              <Database size={28} />
            </div>

            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              Create System Database Dump
            </h3>

            <p className="text-xs text-gray-500 font-medium mb-4 leading-relaxed">
              This generates a PostgreSQL dump together with an audit log CSV export, runs an integrity check, and stores both in secure cloud storage.
            </p>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2 w-full text-left">
                <AlertCircle size={16} className="shrink-0" /> {createError}
              </div>
            )}

            <div className="w-full text-left mb-5">
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                Backup description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={createDescription}
                disabled={isCreating}
                onChange={(e) => { setCreateDescription(e.target.value); setCreateError(''); }}
                placeholder="e.g. Before restructuring barangay admin accounts"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs leading-relaxed outline-none focus:border-[#b32d2d] resize-none disabled:opacity-60"
              />
              <span className="text-[10px] text-gray-400 block text-right mt-1">
                {createDescription.length}/{MAX_DESCRIPTION_LENGTH} characters
              </span>
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isCreating}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={isCreating || !createDescription.trim()}
                className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {isCreating && <Loader2 size={14} className="animate-spin" />}
                {isCreating ? 'Creating...' : 'Create Dump'}
              </button>
            </div>

            {isCreating && (
              <p className="text-[10.5px] text-gray-500 font-medium mt-3">
                This can take a minute. Please keep this page open.
              </p>
            )}
          </div>
        </div>
      )}

    </AdminLayout>
  );
}