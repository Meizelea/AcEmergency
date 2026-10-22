import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, ShieldCheck, MapPin, Clock, CheckCircle2, XCircle } from 'lucide-react';
import AdminLayout from '../components/header';

// api_base_url: api.aksyon.online
const targetHostname = window.location.hostname || '127.0.0.1';
const API_BASE_URL = `http://${targetHostname}:8000`;
const CACHE_KEY_DUPLICATES = 'cache_duplicates_reports_v1';

// DUPLICATE DETECTION METRICS (MATCHING Django duplicate_detection.py)
const MAX_TIME_DIFF_MINUTES = 10;
const MAX_DISTANCE_KM = 0.3; // 300 meters

const DISTANCE_WEIGHT = 0.40;
const TIME_WEIGHT = 0.35;
const JACCARD_WEIGHT = 0.25;
const POTENTIAL_DUPLICATE_THRESHOLD = 0.70;

// HAVERSINE DISTANCE IN KM
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// JACCARD SIMILARITY FOR TEXT
function jaccardSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const setA = new Set(String(str1).toLowerCase().split(/\s+/));
  const setB = new Set(String(str2).toLowerCase().split(/\s+/));
  
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export default function DuplicatesPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('ac_token');

  const [duplicateGroups, setDuplicateGroups] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_DUPLICATES);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(() => duplicateGroups.length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const getAuthHeaders = useCallback((useBearer = false) => {
    const rawToken = token || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    if (!cleanToken) return {};
    const authPrefix = useBearer ? 'Bearer' : 'Token';
    return {
      'Authorization': `${authPrefix} ${cleanToken}`,
      'Content-Type': 'application/json'
    };
  }, [token]);

  // CLIENT-SIDE DUPLICATE DETECTION ALGORITHM MATCHING PYTHON BACKEND
  const detectDuplicatesFromReports = useCallback((reports) => {
    const results = [];
    const seenPairs = new Set();

    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const report = reports[i];
        const candidate = reports[j];

        // Skip if same report ID or pair already evaluated
        if (report.id === candidate.id) continue;
        const pairKey = [report.id, candidate.id].sort().join('-');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        // 1. Barangay Match Check
        const brgy1 = String(report.barangay || report.location || '').toLowerCase();
        const brgy2 = String(candidate.barangay || candidate.location || '').toLowerCase();
        if (brgy1 && brgy2 && brgy1 !== brgy2) continue;

        // 2. Spatial Check (Haversine)
        const lat1 = parseFloat(report.latitude);
        const lon1 = parseFloat(report.longitude);
        const lat2 = parseFloat(candidate.latitude);
        const lon2 = parseFloat(candidate.longitude);

        let distanceKm = 0.1; // Fallback if lat/lng is missing
        if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
          distanceKm = haversine(lat1, lon1, lat2, lon2);
        }

        if (distanceKm > MAX_DISTANCE_KM) continue;

        // 3. Temporal Check (Time Diff)
        const time1 = new Date(report.created_at || Date.now()).getTime();
        const time2 = new Date(candidate.created_at || Date.now()).getTime();
        const timeDiffSeconds = Math.abs(time1 - time2) / 1000;
        const timeDiffMinutes = timeDiffSeconds / 60;

        if (timeDiffMinutes > MAX_TIME_DIFF_MINUTES) continue;

        // 4. Calculate Scores
        const distanceScore = 1 - (distanceKm / MAX_DISTANCE_KM);
        const timeScore = 1 - (timeDiffMinutes / MAX_TIME_DIFF_MINUTES);
        const text1 = report.description || report.short_message || '';
        const text2 = candidate.description || candidate.short_message || '';
        const jaccardScore = jaccardSimilarity(text1, text2);

        const overallScore = (distanceScore * DISTANCE_WEIGHT) + (timeScore * TIME_WEIGHT) + (jaccardScore * JACCARD_WEIGHT);

        if (overallScore >= POTENTIAL_DUPLICATE_THRESHOLD) {
          results.push({
            id: pairKey,
            report: report,
            potential_duplicate: candidate,
            distance_meters: distanceKm * 1000,
            time_difference_seconds: timeDiffSeconds,
            description_similarity: jaccardScore,
            similarity_score: overallScore
          });
        }
      }
    }
    return results;
  }, []);

  // FETCH REPORTS FROM WORKING ADMIN API AND DETECT DUPLICATES
  const fetchDuplicates = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else if (duplicateGroups.length === 0) setIsLoading(true);

    for (const useBearer of [false, true]) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/reports/admin/`, {
          headers: getAuthHeaders(useBearer)
        });

        if (response.status === 401) continue;

        if (response.ok) {
          const data = await response.json();
          const reportsList = Array.isArray(data) ? data : (data.results || []);
          
          const flaggedDuplicates = detectDuplicatesFromReports(reportsList);
          
          setDuplicateGroups(flaggedDuplicates);
          sessionStorage.setItem(CACHE_KEY_DUPLICATES, JSON.stringify(flaggedDuplicates));
          break;
        }
      } catch (err) {
        console.warn('Failed to fetch reports for duplicate calculation:', err);
      }
    }

    setLastRefreshed(new Date());
    setIsLoading(false);
    setIsRefreshing(false);
  }, [getAuthHeaders, detectDuplicatesFromReports, duplicateGroups.length]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchDuplicates(false);
  }, [token, navigate, fetchDuplicates]);

  const handleResolveDuplicate = async (duplicateId, action) => {
    const updatedGroups = duplicateGroups.filter(item => item.id !== duplicateId);
    setDuplicateGroups(updatedGroups);
    sessionStorage.setItem(CACHE_KEY_DUPLICATES, JSON.stringify(updatedGroups));
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
              Automated Jaccard text similarity, spatial (haversine ≤300m), and temporal (≤10m) analysis.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400 font-semibold hidden sm:inline">
              Refreshed: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={() => fetchDuplicates(true)}
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 font-bold text-sm">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-2" />
              Analyzing reports for potential duplicates...
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-200 text-center max-w-md mx-auto my-12 shadow-2xs">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800">No Duplicates Flagged</h3>
              <p className="text-xs text-gray-400 font-medium mt-1">
                All submitted emergency reports are unique within the distance, time, and text similarity thresholds.
              </p>
            </div>
          ) : (
            duplicateGroups.map((dup) => {
              const primary = dup.report || {};
              const candidate = dup.potential_duplicate || {};
              const matchScorePercent = Math.round((dup.similarity_score || 0) * 100);

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
                        onClick={() => handleResolveDuplicate(dup.id, 'dismissed')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleResolveDuplicate(dup.id, 'merged')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Duplicate
                      </button>
                    </div>
                  </div>

                  {/* SIDE BY SIDE COMPARISON */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* ORIGINAL REPORT */}
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="text-[10px] uppercase font-black tracking-wider text-gray-400 mb-1">
                        Primary Report #{primary.id || 'N/A'}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{primary.short_message || primary.description || 'Report Summary'}</h4>
                      <div className="mt-3 space-y-1 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" /> {primary.created_at ? new Date(primary.created_at).toLocaleString() : 'Recent'}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {primary.street ? `${primary.street}, ` : ''}Brgy. {primary.barangay || 'Angeles City'}</div>
                      </div>
                    </div>

                    {/* CANDIDATE DUPLICATE */}
                    <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/30">
                      <div className="text-[10px] uppercase font-black tracking-wider text-amber-700 mb-1">
                        Candidate Duplicate #{candidate.id || 'N/A'}
                      </div>
                      <h4 className="font-bold text-gray-900 text-sm">{candidate.short_message || candidate.description || 'Duplicate Report Summary'}</h4>
                      <div className="mt-3 space-y-1 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> {candidate.created_at ? new Date(candidate.created_at).toLocaleString() : 'Recent'}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-500" /> {candidate.street ? `${candidate.street}, ` : ''}Brgy. {candidate.barangay || 'Angeles City'}</div>
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