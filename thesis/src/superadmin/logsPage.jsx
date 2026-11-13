import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Search, Filter, Tag, MapPin, ArrowUpDown, RefreshCw,
  Loader2, AlertCircle, X, Clock, User, ChevronLeft, ChevronRight, ShieldCheck
} from 'lucide-react';

import AdminLayout from '../components/header';
import DateRangeFilter from '../components/DateRangeFilter';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  return 'https://api.aksyon.online';
};

const API_BASE = getApiBaseUrl();

// GET list of audit log entries (backend: audit_logs.views.AuditLogListView, privileged admins only).
// If the route differs on the backend, change it here: it is the only place it is used.
const AUDIT_LOGS_URL = `${API_BASE}/api/audit-logs/`;

const CACHE_KEY_LOGS = 'cache_admin_audit_logs_v1';
const PAGE_SIZE = 25;
const MAX_PAGES = 50; // safety cap if the backend ever paginates the list

/* ---------------------------------- helpers ---------------------------------- */

const isPrivilegedUser = (user) =>
  Boolean(
    user &&
      (user.is_superuser === true ||
        String(user.role || '').toUpperCase() === 'PRIVILEGED_ADMIN' ||
        String(user.role || '').toUpperCase() === 'SUPERADMIN')
  );

const toTitle = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatRole = (role) => {
  const r = String(role || '').toLowerCase();
  if (r === 'privileged_admin') return 'Privileged Admin';
  if (r === 'admin') return 'Admin';
  return toTitle(role) || '—';
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
};

// Colour-code the action badge by what kind of action it is
const getActionStyle = (action) => {
  const a = String(action || '').toUpperCase();
  if (/DELETED|REMOVED/.test(a)) return 'bg-red-50 text-red-700 border-red-200';
  if (/SUSPEND|DISABLED|DISMISS/.test(a)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (/CREATED|PUBLISHED|REGISTERED|REACTIVATED|ENABLED/.test(a)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (/UPDATED|CHANGED|EDITED/.test(a)) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (/BACKUP|RESTORE/.test(a)) return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-gray-100 text-gray-700 border-gray-300';
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const displayValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// Renders the `changes` JSON. Handles the shapes the backend produces:
//   { field: { old, new } }   emergency units
//   { field: { from, to } }   report status updates
//   { field: value }          created / deleted records
const ChangesView = ({ changes }) => {
  if (!isPlainObject(changes) || Object.keys(changes).length === 0) {
    return <p className="text-xs text-gray-400 font-medium">No field details were recorded for this action.</p>;
  }

  return (
    <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
      {Object.entries(changes).map(([field, value]) => {
        const hasPair =
          isPlainObject(value) &&
          (('old' in value && 'new' in value) || ('from' in value && 'to' in value));
        const before = hasPair ? ('old' in value ? value.old : value.from) : null;
        const after = hasPair ? ('new' in value ? value.new : value.to) : null;

        return (
          <div key={field} className="px-3 py-2.5 text-xs bg-white">
            <div className="font-bold uppercase text-[10px] tracking-wider text-gray-400">{toTitle(field)}</div>
            {hasPair ? (
              <div className="flex flex-wrap items-center gap-2 mt-1 font-semibold">
                <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 line-through break-all">{displayValue(before)}</span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 break-all">{displayValue(after)}</span>
              </div>
            ) : (
              <div className="mt-1 font-semibold text-gray-800 break-words">{displayValue(value)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const DetailRow = ({ label, children, last = false }) => (
  <div className={`flex justify-between gap-4 py-1.5 ${last ? '' : 'border-b border-gray-200/60'}`}>
    <span className="font-bold uppercase text-gray-400">{label}</span>
    <span className="font-bold text-gray-800 text-right break-words max-w-[65%]">{children}</span>
  </div>
);

/* ---------------------------------- page ---------------------------------- */

export default function LogsPage() {
  const navigate = useNavigate();

  const [logs, setLogs] = useState(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY_LOGS);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(() => logs.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');

  // Refs keep fetchLogs stable and prevent overlapping requests
  const hasLogsRef = useRef(logs.length > 0);
  const inFlightRef = useRef(false);

  // Search, filters, sorting, paging
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [barangayFilter, setBarangayFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [dateRangeFilter, setDateRangeFilter] = useState('all_time');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const [selectedLog, setSelectedLog] = useState(null);

  // GET /api/audit-logs/ (follows pagination if the backend ever enables it)
  const fetchLogs = useCallback(async (silent = false) => {
    const token = (localStorage.getItem('ac_token') || '').replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (!silent && !hasLogsRef.current) setIsLoading(true);
    setIsSyncing(true);

    try {
      let url = AUDIT_LOGS_URL;
      const all = [];
      let failedStatus = null;

      for (let i = 0; url && i < MAX_PAGES; i++) {
        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` }
        });

        if (!res.ok) {
          failedStatus = res.status;
          break;
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          all.push(...data);
          url = null;
        } else {
          all.push(...(data.results || []));
          if (data.next) {
            // Rebuild the "next" link on API_BASE to avoid http/https host mismatches
            const next = new URL(data.next, API_BASE);
            url = `${API_BASE}${next.pathname}${next.search}`;
          } else {
            url = null;
          }
        }
      }

      if (failedStatus === 401) {
        setError('Your session has expired. Please log in again.');
      } else if (failedStatus === 403) {
        setError('Only privileged administrators can view the event logs.');
      } else if (failedStatus === 404) {
        setError('The audit log endpoint was not found (404). Check AUDIT_LOGS_URL in logsPage.jsx.');
      } else if (failedStatus) {
        setError(`Could not load the event logs (HTTP ${failedStatus}).`);
      } else {
        hasLogsRef.current = true;
        setLogs(all);
        setError('');
        try {
          sessionStorage.setItem(CACHE_KEY_LOGS, JSON.stringify(all));
        } catch {
          /* storage unavailable or too large - ignore */
        }
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [navigate]);

  // Load once on mount (use the Refresh button to reload; no focus or interval polling)
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
      // Barangay admins must not see this page at all
      navigate('/analytics', { replace: true });
      return;
    }

    fetchLogs(logs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, fetchLogs]);

  // Dropdown options are built from the data itself
  const actionOptions = useMemo(
    () => [...new Set(logs.map((l) => l.action).filter(Boolean))].sort(),
    [logs]
  );
  const barangayOptions = useMemo(
    () => [...new Set(logs.map((l) => l.barangay).filter(Boolean))].sort(),
    [logs]
  );
  const targetOptions = useMemo(
    () => [...new Set(logs.map((l) => l.target_type).filter(Boolean))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();

    return logs
      .filter((log) => {
        if (!log) return false;

        if (q) {
          const haystack = [
            log.actor_username,
            log.action,
            toTitle(log.action),
            log.target_type,
            log.target_id,
            log.description,
            log.barangay,
            log.id
          ]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ');
          if (!haystack.includes(q)) return false;
        }

        if (actionFilter !== 'All' && log.action !== actionFilter) return false;
        if (roleFilter !== 'All' && String(log.actor_role).toLowerCase() !== roleFilter) return false;
        if (barangayFilter !== 'All' && log.barangay !== barangayFilter) return false;
        if (targetFilter !== 'All' && log.target_type !== targetFilter) return false;

        const logTime = new Date(log.created_at).getTime();

        // Custom From/To range (local-time day boundaries)
        if (fromDate || toDate) {
          if (isNaN(logTime)) return true;
          const startMs = fromDate ? new Date(`${fromDate}T00:00:00.000`).getTime() : 0;
          const endMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Infinity;
          return logTime >= startMs && logTime <= endMs;
        }

        // Preset ranges
        if (dateRangeFilter !== 'all_time' && dateRangeFilter !== 'custom' && !isNaN(logTime)) {
          if (dateRangeFilter === 'today') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
            return logTime >= start && logTime < end;
          }
          if (dateRangeFilter === '7_days') return logTime >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
          if (dateRangeFilter === '30_days') return logTime >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
        }

        return true;
      })
      .sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [logs, searchQuery, actionFilter, roleFilter, barangayFilter, targetFilter, dateRangeFilter, fromDate, toDate, sortOrder]);

  // Back to page 1 whenever the filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, actionFilter, roleFilter, barangayFilter, targetFilter, dateRangeFilter, fromDate, toDate, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleLogs = filteredLogs.slice(pageStart, pageStart + PAGE_SIZE);

  const handleRefresh = (e) => {
    e.stopPropagation();
    e.preventDefault();
    fetchLogs(false);
  };

  const selectClass = 'py-2 bg-transparent focus:outline-none cursor-pointer pr-2 w-full';
  const selectWrapClass =
    'bg-white border border-gray-300 rounded-lg flex items-center px-3 shadow-xs text-xs text-gray-600 font-bold';

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] flex flex-col">

        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <ClipboardList className="text-[#b32d2d]" size={24} />
            <div>
              <h1 className="font-black text-xl sm:text-2xl text-gray-900">Event Logs</h1>
              <p className="text-xs text-gray-500 font-medium">Audit trail of administrator activity across the system</p>
            </div>
          </div>
          <span className="text-xs sm:text-sm text-gray-900 font-black">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'Entry' : 'Entries'}
            {filteredLogs.length !== logs.length && (
              <span className="text-gray-400 font-bold"> of {logs.length}</span>
            )}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border bg-red-50 text-red-700 border-red-200 shrink-0">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            {error.includes('expired') && (
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold text-[11px] hover:bg-red-700 transition-all cursor-pointer"
              >
                Log In Again
              </button>
            )}
            <X size={16} className="cursor-pointer shrink-0" onClick={() => setError('')} />
          </div>
        )}

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 mb-6 shrink-0">

          {/* SEARCH */}
          <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-xs w-full sm:w-64 lg:w-72 overflow-hidden">
            <Search size={18} className="text-gray-400 ml-3 shrink-0" />
            <input
              type="text"
              placeholder="Search actor, action, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 px-3 text-xs font-medium text-gray-700 focus:outline-none"
            />
          </div>

          {/* ACTION */}
          <div className={selectWrapClass}>
            <Tag size={14} className="text-gray-400 mr-2 shrink-0" />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={selectClass}>
              <option value="All">All Actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>{toTitle(a)}</option>
              ))}
            </select>
          </div>

          {/* ROLE */}
          <div className={selectWrapClass}>
            <ShieldCheck size={14} className="text-gray-400 mr-2 shrink-0" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={selectClass}>
              <option value="All">All Roles</option>
              <option value="admin">Admin</option>
              <option value="privileged_admin">Privileged Admin</option>
            </select>
          </div>

          {/* BARANGAY */}
          <div className={selectWrapClass}>
            <MapPin size={14} className="text-gray-400 mr-2 shrink-0" />
            <select value={barangayFilter} onChange={(e) => setBarangayFilter(e.target.value)} className={selectClass}>
              <option value="All">All Barangays</option>
              {barangayOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* TARGET TYPE */}
          <div className={selectWrapClass}>
            <Filter size={14} className="text-gray-400 mr-2 shrink-0" />
            <select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)} className={selectClass}>
              <option value="All">All Targets</option>
              {targetOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* DATE FILTER */}
          <DateRangeFilter
            preset={dateRangeFilter}
            from={fromDate}
            to={toDate}
            presets={[
              { value: 'all_time', label: 'All Time' },
              { value: 'today', label: 'Today' },
              { value: '7_days', label: 'This Week (7 Days)' },
              { value: '30_days', label: 'Last 30 Days' }
            ]}
            onChange={({ preset, from, to }) => {
              setDateRangeFilter(preset);
              setFromDate(from || '');
              setToDate(to || '');
            }}
          />

          {/* SORT */}
          <div className={selectWrapClass}>
            <ArrowUpDown size={14} className="text-gray-400 mr-2 shrink-0" />
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={selectClass}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {/* REFRESH */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isSyncing}
            className="sm:ml-auto bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin text-[#b32d2d]' : ''} />
            {isSyncing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* LOG TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-200 bg-[#f8fafc] text-gray-800 text-[11px] font-black uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4 sm:px-5 whitespace-nowrap">Time</th>
                  <th className="py-3.5 px-4 sm:px-5">Actor</th>
                  <th className="py-3.5 px-4 sm:px-5 whitespace-nowrap">Barangay</th>
                  <th className="py-3.5 px-4 sm:px-5">Action</th>
                  <th className="py-3.5 px-4 sm:px-5 whitespace-nowrap">Target</th>
                  <th className="py-3.5 px-4 sm:px-5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-bold">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={18} />
                      Loading event logs...
                    </td>
                  </tr>
                ) : visibleLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      {logs.length === 0 ? 'No activity has been logged yet.' : 'No log entries matched your filters.'}
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 sm:px-5 text-xs font-bold text-gray-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-red-500 shrink-0" />
                          <span>{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                          <User size={13} className="text-gray-400 shrink-0" />
                          {log.actor_username || 'Unknown'}
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5 pl-[19px]">
                          {formatRole(log.actor_role)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-xs font-bold text-gray-800 whitespace-nowrap">
                        {log.barangay ? (
                          <div className="inline-flex items-center gap-1">
                            <MapPin size={13} className="text-red-500 shrink-0" />
                            <span>Brgy. {log.barangay}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${getActionStyle(log.action)}`}>
                          {toTitle(log.action)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-xs font-semibold text-gray-700 whitespace-nowrap">
                        {log.target_type || '—'}
                        {log.target_id ? <span className="text-gray-400"> #{log.target_id}</span> : null}
                      </td>

                      <td className="py-3.5 px-4 sm:px-5 text-xs text-gray-600 font-medium">
                        <div className="truncate max-w-[340px]">{log.description || '—'}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-gray-500 font-bold">
              {filteredLogs.length === 0
                ? 'No entries'
                : `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredLogs.length)} of ${filteredLogs.length}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[11px] font-black text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LOG DETAIL MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh] my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/50 shrink-0">
              <div>
                <h3 className="font-black text-base sm:text-lg text-gray-900 tracking-tight">Log Entry #{selectedLog.id}</h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">{formatTimestamp(selectedLog.created_at)}</p>
              </div>
              <X
                size={20}
                className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
                onClick={() => setSelectedLog(null)}
              />
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-xs">
                <DetailRow label="Action">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getActionStyle(selectedLog.action)}`}>
                    {toTitle(selectedLog.action)}
                  </span>
                </DetailRow>
                <DetailRow label="Actor">{selectedLog.actor_username || 'Unknown'}</DetailRow>
                <DetailRow label="Role">{formatRole(selectedLog.actor_role)}</DetailRow>
                <DetailRow label="Barangay">{selectedLog.barangay ? `Brgy. ${selectedLog.barangay}` : '—'}</DetailRow>
                <DetailRow label="Target Type">{selectedLog.target_type || '—'}</DetailRow>
                <DetailRow label="Target ID" last>{selectedLog.target_id || '—'}</DetailRow>
              </div>

              <div>
                <h4 className="font-black text-sm text-gray-900 mb-2">Description</h4>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed font-medium break-words">
                  {selectedLog.description || 'No description recorded.'}
                </div>
              </div>

              <div>
                <h4 className="font-black text-sm text-gray-900 mb-2">Details</h4>
                <ChangesView changes={selectedLog.changes} />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold px-5 py-2 rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}