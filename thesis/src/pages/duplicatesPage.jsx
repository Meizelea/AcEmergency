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

  // LOAD SAVED POTENTIAL DUPLICATES (detected by the backend when each report is created)
  const fetchDuplicates = useCallback(async (isManual = false) => {
    if (!token) return;

    if (isManual) setIsRefreshing(true);
    else if (sessionStorage.getItem(CACHE_KEY_DUPLICATES) === null) setIsLoading(true);

    try {
      const res = await authFetch(`${API_BASE_URL}${DUPLICATES_URL}?status=pending`, token);

      if (res && res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        // Also filter here, so this works even if the backend ignores ?status=
        const pending = list.filter((item) => item.status === 'pending');

        setDuplicateGroups(pending);
        setError('');
        setLastRefreshed(new Date());
        try {
          sessionStorage.setItem(CACHE_KEY_DUPLICATES, JSON.stringify(pending));
        } catch {
          /* storage unavailable - ignore */
        }
      } else if (res) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || `Failed to load potential duplicates (${res.status}).`);
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
                There are no pending potential duplicates for your barangay.
              </p>
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