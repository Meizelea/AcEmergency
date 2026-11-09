import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, ShieldCheck, MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';
import AdminLayout from '../components/header';

const targetHostname = window.location.hostname || '127.0.0.1';
const API_BASE_URL = 'https://api.aksyon.online';
//const API_BASE_URL = `http://${targetHostname}:8000`;

// Backend endpoints (reports/urls.py)
//   GET   /api/reports/admin/potential-duplicates/        -> list (barangay-scoped)
//   PATCH /api/reports/admin/potential-duplicates/<id>/   -> body: { status: "confirmed" | "dismissed" }
const DUPLICATES_URL = '/api/reports/admin/potential-duplicates/';

const CACHE_KEY_DUPLICATES = 'cache_duplicates_reports_v4';
const MAX_PAGES = 25; // safety limit when following paginated responses

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const readCachedDuplicates = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_DUPLICATES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Tries "Token" auth first, then "Bearer" (only retries on 401).
async function authFetch(url, token, options = {}) {
  const cleanToken = String(token || '').replace(/^(Token|Bearer)\s+/i, '').trim();
  if (!cleanToken) return null;

  let lastResponse = null;
  for (const prefix of ['Token', 'Bearer']) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${prefix} ${cleanToken}`,
        ...(options.headers || {})
      }
    });
    if (res.status !== 401) return res;
    lastResponse = res;
  }
  return lastResponse;
}

export default function DuplicatesPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('ac_token');

  const [duplicateGroups, setDuplicateGroups] = useState(readCachedDuplicates);
  // Only show the full-page spinner when nothing has ever been cached (an empty cached list is still a valid cache)
  const [isLoading, setIsLoading] = useState(() => sessionStorage.getItem(CACHE_KEY_DUPLICATES) === null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [busyIds, setBusyIds] = useState([]); // pair ids with a request in flight
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewedCount, setReviewedCount] = useState(0); // pairs already confirmed/dismissed (hidden from the list)
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  // LOAD SAVED POTENTIAL DUPLICATES (detected by the backend when each report is created)
  const fetchDuplicates = useCallback(async (isManual = false) => {
    if (!token) return;

    if (isManual) setIsRefreshing(true);
    else if (sessionStorage.getItem(CACHE_KEY_DUPLICATES) === null) setIsLoading(true);

    try {
      let url = `${API_BASE_URL}${DUPLICATES_URL}?status=pending`;
      const all = [];
      let failed = null;

      // The backend returns every status, newest first, and may paginate. Follow all pages so a
      // pending pair is never hidden behind newer confirmed/dismissed ones on page 2+.
      for (let page = 0; url && page < MAX_PAGES; page++) {
        const res = await authFetch(url, token);

        if (!res) {
          failed = { status: 'no response', body: {} };
          break;
        }

        if (!res.ok) {
          failed = { status: res.status, body: await res.json().catch(() => ({})) };
          break;
        }

        const data = await res.json();

        if (Array.isArray(data)) {
          all.push(...data);
          url = null;
        } else {
          all.push(...(data.results || []));
          if (data.next) {
            // Rebuild the "next" link on API_BASE_URL to avoid http/https host mismatches.
            const next = new URL(data.next, API_BASE_URL);
            url = `${API_BASE_URL}${next.pathname}${next.search}`;
          } else {
            url = null;
          }
        }
      }

      if (failed) {
        setError(failed.body.detail || `Failed to load potential duplicates (${failed.status}).`);
      } else {
        // Filter here, so this works even though the backend ignores ?status=
        const pending = all.filter((item) => item.status === 'pending');

        setDuplicateGroups(pending);
        setReviewedCount(all.length - pending.length);
        setError('');
        setLastRefreshed(new Date());
        try {
          sessionStorage.setItem(CACHE_KEY_DUPLICATES, JSON.stringify(pending));
        } catch {
          /* storage unavailable - ignore */
        }
      }
    } catch (err) {
      console.warn('Failed to fetch potential duplicates:', err);
      setError('Could not reach the server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  // LOAD ONCE ON MOUNT (no auto-refresh; use the "Refresh List" button to reload)
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchDuplicates(false);
  }, [token, navigate, fetchDuplicates]);

  // action: 'dismissed'  -> not a duplicate, both reports stay untouched
  //         'confirmed'  -> confirmed duplicate; the backend resolves the later report and notifies its owner
  const handleResolveDuplicate = async (dup, action) => {
    if (busyIds.includes(dup.id)) return;

    const original = dup.potential_duplicate || {};
    const later = dup.report || {};

    if (action === 'confirmed') {
      const ok = window.confirm(
        `Mark Report #${later.id} as a duplicate of Report #${original.id}?\n\n` +
        `This will resolve Report #${later.id} and notify its owner.`
      );
      if (!ok) return;
    }

    setBusyIds((ids) => [...ids, dup.id]);
    setError('');
    setNotice('');

    try {
      const res = await authFetch(`${API_BASE_URL}${DUPLICATES_URL}${dup.id}/`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: action })
      });

      if (res && res.ok) {
        setDuplicateGroups((prev) => {
          const updated = prev.filter((item) => item.id !== dup.id);
          try {
            sessionStorage.setItem(CACHE_KEY_DUPLICATES, JSON.stringify(updated));
          } catch {
            /* ignore */
          }
          return updated;
        });
        setNotice(
          action === 'confirmed'
            ? `Report #${later.id} was confirmed as a duplicate and marked resolved.`
            : `Report #${later.id} was kept as a separate report (not a duplicate).`
        );
      } else {
        const body = res ? await res.json().catch(() => ({})) : {};
        const message =
          body.detail ||
          (Array.isArray(body.status) ? body.status[0] : '') ||
          `Could not update this duplicate (${res ? res.status : 'no response'}).`;
        setError(message);
      }
    } catch (err) {
      console.warn('Failed to update potential duplicate:', err);
      setError('Could not reach the server.');
    } finally {
      setBusyIds((ids) => ids.filter((id) => id !== dup.id));
    }
  };

  // Shows which account/server this page is using and what the API actually returns for it.
  const runDiagnostics = async () => {
    setDiagLoading(true);

    try {
      const meRes = await authFetch(`${API_BASE_URL}/api/users/me/`, token);
      const me = meRes && meRes.ok ? await meRes.json().catch(() => null) : null;

      const listRes = await authFetch(`${API_BASE_URL}${DUPLICATES_URL}`, token);
      const listBody = listRes ? await listRes.json().catch(() => null) : null;
      const rows = Array.isArray(listBody) ? listBody : (listBody?.results || []);

      const rawBarangay = me?.assigned_barangay || me?.barangay || me?.residential_barangay;
      const barangay =
        rawBarangay && typeof rawBarangay === 'object'
          ? (rawBarangay.name || rawBarangay.label)
          : rawBarangay;

      const pending = rows.filter((r) => r.status === 'pending').length;

      setDiagnostics({
        api: API_BASE_URL,
        username: me?.username || '',
        role: me?.role || '',
        barangay: barangay || '',
        listStatus: listRes ? listRes.status : 'no response',
        total: Array.isArray(listBody) ? rows.length : (listBody?.count ?? rows.length),
        pending,
        reviewed: rows.length - pending
      });
    } catch (err) {
      console.warn('Diagnostics failed:', err);
      setDiagnostics({
        api: API_BASE_URL,
        username: '',
        role: '',
        barangay: '',
        listStatus: 'network error',
        total: 0,
        pending: 0,
        reviewed: 0
      });
    } finally {
      setDiagLoading(false);
    }
  };

  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting...</div>;
  }

  return (
    <AdminLayout>
      <main className="w-full h-full min-h-0 flex flex-col bg-gray-100 overflow-hidden">
        
        {/* TOP BAR WITH REFRESH BUTTON AND TIMESTAMP */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-2xs">
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Potential Duplicate Reports
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Reports flagged as potential duplicates based on content, location, and submission time.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 font-semibold hidden sm:inline">
              Refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={() => {
                setNotice('');
                fetchDuplicates(true);
              }}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh List'}
            </button>
          </div>
        </header>

        {/* DUPLICATE PAIRS SCROLLABLE LIST */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {error}
            </div>
          )}

          {notice && (
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {notice}
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 font-bold text-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-2" />
              Loading potential duplicates...
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center max-w-md mx-auto my-12 shadow-2xs">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No Duplicates Flagged</h3>
              <p className="text-xs text-gray-400 font-medium mt-1">
                There are no pending potential duplicates for your assigned barangay.
              </p>
              {reviewedCount > 0 && (
                <p className="text-xs text-gray-400 font-medium mt-2">
                  {reviewedCount} already-reviewed pair{reviewedCount === 1 ? '' : 's'} (confirmed or dismissed) hidden.
                </p>
              )}

              <button
                onClick={runDiagnostics}
                disabled={diagLoading}
                className="mt-4 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {diagLoading ? 'Checking...' : "Why isn't my duplicate showing?"}
              </button>

              {diagnostics && (
                <div className="mt-4 text-left text-[11px] text-gray-600 font-medium bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                  <div><span className="font-bold text-gray-800">API server:</span> {diagnostics.api}</div>
                  <div>
                    <span className="font-bold text-gray-800">Signed in as:</span>{' '}
                    {diagnostics.username ? `@${diagnostics.username}` : 'unknown'}
                    {diagnostics.role ? ` (${diagnostics.role})` : ''}
                  </div>
                  <div><span className="font-bold text-gray-800">Assigned barangay:</span> {diagnostics.barangay || 'none found'}</div>
                  <div>
                    <span className="font-bold text-gray-800">Server response:</span> HTTP {diagnostics.listStatus},{' '}
                    {diagnostics.total} pair(s) ({diagnostics.pending} pending, {diagnostics.reviewed} reviewed)
                  </div>
                  <p className="pt-1 text-gray-500">
                    {diagnostics.total === 0
                      ? `The server returned no pairs for this account. Check that this account's assigned barangay exactly matches the newer report's barangay in the database, and that you checked the same database that ${diagnostics.api} uses.`
                      : 'The server returned pairs, but none of them are pending (they were already confirmed or dismissed).'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            duplicateGroups.map((dup) => {
              // In the backend, `report` is the NEWER report that triggered the flag,
              // and `potential_duplicate` is the OLDER report it resembles.
              const primary = dup.potential_duplicate || {};   // earlier = original
              const candidate = dup.report || {};              // later = possible duplicate
              const matchScorePercent = Math.round((dup.similarity_score || 0) * 100);
              const isBusy = busyIds.includes(dup.id);

              return (
                <div key={dup.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs transition-all hover:border-gray-300">
                  
                  {/* SCORE HEADER */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-full text-xs font-black">
                        {matchScorePercent}% Overall Match
                      </span>
                      <span className="text-xs text-gray-400 font-bold">
                        Brgy. {primary.barangay || candidate.barangay || 'Angeles City'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveDuplicate(dup, 'dismissed')}
                        disabled={isBusy}
                        title="Not a duplicate: keep both reports as they are"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleResolveDuplicate(dup, 'confirmed')}
                        disabled={isBusy}
                        title="Confirm duplicate: resolves the later report and notifies its owner"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {isBusy ? 'Saving...' : 'Mark Duplicate'}
                      </button>
                    </div>
                  </div>

                  {/* SIDE BY SIDE COMPARISON */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* ORIGINAL (EARLIER) REPORT */}
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1 flex items-center justify-between">
                        <span>Primary Report #{primary.id || 'N/A'}</span>
                        {primary.status && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 normal-case tracking-normal font-bold">
                            {capitalize(primary.status)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{primary.description || 'Report Summary'}</h4>
                      <div className="mt-3 space-y-1 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" /> {primary.created_at ? new Date(primary.created_at).toLocaleString() : 'Recent'}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> Brgy. {primary.barangay || 'Angeles City'}</div>
                      </div>
                    </div>

                    {/* CANDIDATE DUPLICATE (LATER REPORT) */}
                    <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/30">
                      <div className="text-[10px] uppercase font-black tracking-wider text-amber-700 mb-1 flex items-center justify-between">
                        <span>Candidate Duplicate #{candidate.id || 'N/A'}</span>
                        {candidate.status && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 normal-case tracking-normal font-bold">
                            {capitalize(candidate.status)}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{candidate.description || 'Duplicate Report Summary'}</h4>
                      <div className="mt-3 space-y-1 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> {candidate.created_at ? new Date(candidate.created_at).toLocaleString() : 'Recent'}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-500" /> Brgy. {candidate.barangay || 'Angeles City'}</div>
                      </div>
                    </div>

                  </div>

                  {/* ALGORITHMIC METRIC SCORES */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-100 text-center">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Spatial Distance</span>
                      <span className="text-xs font-black text-gray-800">{Math.round(dup.distance_meters || 0)}m</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Time Gap</span>
                      <span className="text-xs font-black text-gray-800">{Math.round((dup.time_difference_seconds || 0) / 60)} mins</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-[10px] font-bold text-gray-400 block uppercase">Jaccard Text Sim</span>
                      <span className="text-xs font-black text-gray-800">{Math.round((dup.description_similarity || 0) * 100)}%</span>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>

      </main>
    </AdminLayout>
  );
}