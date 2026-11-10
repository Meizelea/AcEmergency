import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, TrendingUp, CalendarDays, X, Download, MapPin, Play, Info
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, PieChart, Pie, Cell, CartesianGrid, BarChart, Bar
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import AdminLayout from '../components/header';

export const ANGELES_BARANGAYS = [
  "Agapito del Rosario",
  "Santo Rosario",
  "Tabun",
  "Cutud",
  "Ninoy Aquino",
  "Santa Trinidad",
  "Sta. Trinidad",
  "San Nicolas",
  "Lourdes NorthWest",
  "Claro M. Recto"
];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.aksyon.online';

// Backend endpoints (analytics/urls.py). Adjust the prefix if your project urls.py mounts them elsewhere.
const ANALYTICS_DASHBOARD_URL = '/api/analytics/dashboard/';        // GET
const ANALYTICS_DBSCAN_URL = '/api/analytics/dashboard/dbscan/';    // POST

const CACHE_KEY_DASHBOARD = 'cache_analytics_dashboard_v6';
const DEFAULT_PERIOD = 'this_week';
const DEFAULT_QUERY = `period=${DEFAULT_PERIOD}`;

const DONUT_COLORS = ['#0284c7', '#0d9488', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899', '#6366f1'];
const CLUSTER_COLORS = ['#dc2626', '#0284c7', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#0d9488', '#ea580c', '#4f46e5', '#65a30d'];
const NOISE_COLOR = '#9ca3af';
const ANGELES_CENTER = [15.145, 120.5887];

// How many cluster rows fit in the PDF's DBSCAN page table
const PRINT_MAX_CLUSTER_ROWS = 14;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---------------------------------- helpers ---------------------------------- */

const pad2 = (n) => String(n).padStart(2, '0');
const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDateKey = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const clusterColor = (label) => (label === -1 ? NOISE_COLOR : CLUSTER_COLORS[label % CLUSTER_COLORS.length]);
const clusterName = (label) => (label === -1 ? 'Noise (unclustered)' : `Cluster ${label + 1}`);

const formatReportIds = (points, max = 12) => {
  const ids = points.slice(0, max).map((p) => `#${p.id}`).join(', ');
  return points.length > max ? `${ids} +${points.length - max} more` : ids;
};

const haversineMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371008.8;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildQuery = (period, from, to) => {
  if (period === 'date_range') {
    if (!from || !to) return null; // backend needs both dates
    return `period=date_range&start_date=${from}&end_date=${to}`;
  }
  return `period=${period}`;
};

const readCachedDashboard = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY_DASHBOARD);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
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

// The backend only returns buckets that have reports. This fills in the empty ones with 0
// so the trend chart has a continuous x-axis.
function buildTrendSeries(trend) {
  if (!trend || !Array.isArray(trend.data)) return [];

  const { interval, start_date, end_date, data } = trend;

  if (!start_date || !end_date) {
    return [{ time: 'No data', reports: 0 }];
  }

  const counts = {};
  data.forEach((item) => {
    counts[item.date] = item.total;
  });

  const start = parseDateKey(start_date);
  const end = parseDateKey(end_date);
  const series = [];

  if (interval === 'hour') {
    const singleDay = start_date === end_date;
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23);

    while (cursor <= last) {
      const h = cursor.getHours();
      const key = `${toDateKey(cursor)}T${pad2(h)}:00`;
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const suffix = h < 12 ? 'AM' : 'PM';
      const label = singleDay
        ? `${hour12} ${suffix}`
        : `${cursor.getMonth() + 1}/${cursor.getDate()} ${hour12}${suffix}`;
      series.push({ time: label, reports: counts[key] || 0 });
      cursor.setHours(cursor.getHours() + 1);
    }
    return series;
  }

  if (interval === 'day') {
    const spanDays = Math.round((end - start) / 86400000);
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = toDateKey(cursor);
      const label =
        spanDays <= 7
          ? WEEKDAYS[cursor.getDay()]
          : `${cursor.getMonth() + 1}/${cursor.getDate()}`;
      series.push({ time: label, reports: counts[key] || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return series;
  }

  if (interval === 'month') {
    const crossesYear = start.getFullYear() !== end.getFullYear();
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`;
      const label = crossesYear
        ? `${MONTHS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`
        : MONTHS[cursor.getMonth()];
      series.push({ time: label, reports: counts[key] || 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return series;
  }

  // yearly
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    series.push({ time: String(y), reports: counts[String(y)] || 0 });
  }
  return series;
}

/* ------------------------------- DBSCAN map UI -------------------------------- */

function FitBounds({ points, animate = true }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 17, { animate });
      return;
    }
    map.fitBounds(points, { padding: [30, 30], maxZoom: 18, animate });
  }, [map, points, animate]);

  return null;
}

function ClusterMap({ groups, selectedCluster, showNoise }) {
  const visibleGroups = useMemo(() => {
    if (selectedCluster !== null) return groups.filter((g) => g.label === selectedCluster);
    return groups.filter((g) => !g.isNoise || showNoise);
  }, [groups, selectedCluster, showNoise]);

  const fitPoints = useMemo(
    () => visibleGroups.flatMap((g) => g.points.map((p) => [p.lat, p.lng])),
    [visibleGroups]
  );

  return (
    <MapContainer center={ANGELES_CENTER} zoom={14} scrollWheelZoom className="h-full w-full rounded-lg">
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={fitPoints} />

      {visibleGroups.map((group) => {
        const color = clusterColor(group.label);
        return (
          <React.Fragment key={group.label}>
            {/* halo around the cluster */}
            {!group.isNoise && (
              <Circle
                center={group.center}
                radius={group.radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
              />
            )}

            {/* each report coordinate */}
            {group.points.map((p) => (
              <CircleMarker
                key={`${group.label}-${p.id}`}
                center={[p.lat, p.lng]}
                radius={group.isNoise ? 4 : 7}
                pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 0.95 }}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-bold">Report #{p.id}</div>
                    <div>{clusterName(group.label)}</div>
                    <div>{p.lat.toFixed(6)}, {p.lng.toFixed(6)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}

// Static copy of the cluster map used only by the PDF page (all clusters + noise, no
// animations or popups so the tiles are fully drawn when the browser prints).
function PrintClusterMap({ groups, onTilesLoading, onTilesLoaded }) {
  const fitPoints = useMemo(
    () => groups.flatMap((g) => g.points.map((p) => [p.lat, p.lng])),
    [groups]
  );

  return (
    <MapContainer
      center={ANGELES_CENTER}
      zoom={14}
      zoomControl={false}
      scrollWheelZoom={false}
      dragging={false}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          loading: () => onTilesLoading && onTilesLoading(),
          load: () => onTilesLoaded && onTilesLoaded()
        }}
      />
      <FitBounds points={fitPoints} animate={false} />

      {groups.map((group) => {
        const color = clusterColor(group.label);
        return (
          <React.Fragment key={`print-${group.label}`}>
            {!group.isNoise && (
              <Circle
                center={group.center}
                radius={group.radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
              />
            )}

            {group.points.map((p) => (
              <CircleMarker
                key={`print-${group.label}-${p.id}`}
                center={[p.lat, p.lng]}
                radius={group.isNoise ? 4 : 7}
                pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 0.95 }}
              />
            ))}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('ac_token');

  // ---- general analytics (GET /dashboard/) ----
  const [dashboard, setDashboard] = useState(() => {
    const cached = readCachedDashboard();
    return cached?.query === DEFAULT_QUERY ? cached.data : null;
  });
  const [isLoading, setIsLoading] = useState(() => dashboard === null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');

  const [timeRange, setTimeRange] = useState(DEFAULT_PERIOD);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const requestIdRef = useRef(0);

  // ---- DBSCAN (POST /dashboard/dbscan/) - separate, on-demand ----
  const [dbscan, setDbscan] = useState(null);
  const [dbscanLoading, setDbscanLoading] = useState(false);
  const [dbscanError, setDbscanError] = useState('');
  const [dbscanRanAt, setDbscanRanAt] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState(null); // null = all clusters
  const [showNoise, setShowNoise] = useState(true);

  // PDF export: runs DBSCAN automatically if needed and waits for the page-2 map tiles
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const printTilesReadyRef = useRef(false);

  const todayKey = toDateKey(new Date());

  const fetchDashboard = useCallback(async () => {
    if (!token) return;

    const query = buildQuery(timeRange, fromDate, toDate);
    if (!query) return; // custom range not complete yet

    const requestId = ++requestIdRef.current;
    setIsSyncing(true);

    try {
      const res = await authFetch(`${API_BASE_URL}${ANALYTICS_DASHBOARD_URL}?${query}`, token);
      if (requestId !== requestIdRef.current) return; // a newer request replaced this one

      if (res && res.ok) {
        const data = await res.json();
        if (requestId !== requestIdRef.current) return;
        setDashboard(data);
        setError('');
        try {
          sessionStorage.setItem(CACHE_KEY_DASHBOARD, JSON.stringify({ query, data }));
        } catch {
          /* storage full or unavailable - ignore */
        }
      } else if (res) {
        const body = await res.json().catch(() => ({}));
        if (requestId !== requestIdRef.current) return;
        setError(body.detail || `Failed to load analytics (${res.status}).`);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.warn('Analytics fetch failed:', err);
      setError('Could not reach the server.');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsSyncing(false);
      }
    }
  }, [token, timeRange, fromDate, toDate]);

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  // Loads on mount and when the selected range changes. No auto-refresh: use "Sync Data" to reload.
  useEffect(() => {
    if (!token) return;
    fetchDashboard();
  }, [token, fetchDashboard]);

  const runDbscan = useCallback(async () => {
    if (!token || dbscanLoading) return;

    setDbscanLoading(true);
    setDbscanError('');

    try {
      const res = await authFetch(`${API_BASE_URL}${ANALYTICS_DBSCAN_URL}`, token, {
        method: 'POST',
        body: JSON.stringify({})
      });

      if (res && res.ok) {
        const data = await res.json();
        setDbscan(data.dbscan_clusters || null);
        setDbscanRanAt(new Date());
        setSelectedCluster(null);
      } else if (res) {
        const body = await res.json().catch(() => ({}));
        setDbscanError(body.detail || `DBSCAN request failed (${res.status}).`);
      }
    } catch (err) {
      console.warn('DBSCAN fetch failed:', err);
      setDbscanError('Could not reach the server.');
    } finally {
      setDbscanLoading(false);
    }
  }, [token, dbscanLoading]);

  /* ------------------------- derived data from the backend ------------------------- */

  const assignedBarangay = dashboard?.barangay || '';
  const totalUsers = dashboard?.totals?.total_users ?? 0;
  const totalReports = dashboard?.totals?.total_reports ?? 0;

  const todayStatuses = dashboard?.today_statuses || {};
  // Pending Overall = every pending report (same source as the Report Status donut), not just today's
  const pendingOverall = dashboard?.total_statuses?.pending ?? 0;
  const inProgressOverall = dashboard?.total_statuses?.ongoing ?? 0;
  const resolvedOverall = dashboard?.total_statuses?.resolved ?? 0;
  const dismissedOverall = dashboard?.total_statuses?.resolved ?? 0;

  const trendData = useMemo(() => buildTrendSeries(dashboard?.report_trend), [dashboard]);

  const hourlyData = useMemo(() => {
    const h = dashboard?.peak_incident_hours || {};
    return [
      { slot: 'Morning (6A-12P)', count: h.morning ?? 0 },
      { slot: 'Afternoon (12P-6P)', count: h.afternoon ?? 0 },
      { slot: 'Night (6P-6A)', count: h.night ?? 0 }
    ];
  }, [dashboard]);

  const statusPieData = useMemo(() => {
    const s = dashboard?.total_statuses || {};
    return [
      { name: 'Pending', value: s.pending ?? 0, color: '#fde68a' },
      { name: 'Ongoing', value: s.ongoing ?? 0, color: '#0284c7' },
      { name: 'Resolved', value: s.resolved ?? 0, color: '#16a34a' },
      { name: 'Dismissed', value: s.dismissed ?? 0, color: '#6b7280' }
    ].filter((d) => d.value > 0);
  }, [dashboard]);

  const incidentTypeData = useMemo(
    () =>
      (dashboard?.emergency_categories || [])
        .filter((c) => c.total > 0)
        .map((c) => ({ name: c.label, value: c.total })),
    [dashboard]
  );

  // ---- DBSCAN: group report coordinates per cluster ----
  const clusterGroups = useMemo(() => {
    if (!dbscan) return [];

    const groups = {};
    (dbscan.reports || []).forEach((r) => {
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      if (!groups[r.cluster]) groups[r.cluster] = [];
      groups[r.cluster].push({ id: r.id, lat, lng });
    });

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => {
        if (a === -1) return 1; // noise last
        if (b === -1) return -1;
        return a - b;
      })
      .map((label) => {
        const points = groups[label];
        const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
        const centerLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
        const radius =
          Math.max(...points.map((p) => haversineMeters(centerLat, centerLng, p.lat, p.lng))) + 40;
        return {
          label,
          isNoise: label === -1,
          points,
          center: [centerLat, centerLng],
          radius
        };
      });
  }, [dbscan]);

  const selectedGroup = useMemo(
    () => clusterGroups.find((g) => g.label === selectedCluster) || null,
    [clusterGroups, selectedCluster]
  );

  const hasNoise = clusterGroups.some((g) => g.isNoise);

  // PDF page 2: rows for the cluster summary table
  const printClusterRows = clusterGroups.slice(0, PRINT_MAX_CLUSTER_ROWS);
  const hiddenClusterCount = Math.max(0, clusterGroups.length - PRINT_MAX_CLUSTER_ROWS);

  const handleDownloadPDF = async () => {
    if (isPreparingPdf) return;
    setIsPreparingPdf(true);

    try {
      // Page 2 needs the DBSCAN result, so run it now if it hasn't been run yet
      if (!dbscan) {
        printTilesReadyRef.current = false;
        await runDbscan();
      }

      // Give React time to mount the page-2 map, then wait (max ~6s) for its tiles to finish loading
      await new Promise((resolve) => setTimeout(resolve, 600));
      const startedAt = Date.now();
      while (!printTilesReadyRef.current && Date.now() - startedAt < 6000) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      // Small buffer so the last tiles are painted
      await new Promise((resolve) => setTimeout(resolve, 300));

      window.print();
    } finally {
      setIsPreparingPdf(false);
    }
  };

  return (
    <AdminLayout>
      <style>{`
        #aksyon-print-root {
          position: fixed;
          left: -10000px;
          top: 0;
          width: 210mm;
          pointer-events: none;
        }

        @media print {
          @page { size: A4 portrait; margin: 0; }

          html, body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            /* app layouts often lock html/body to the viewport height with overflow hidden,
               which makes the browser print only the first sheet */
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
          }

          /* hide the whole app, keep only the print portal */
          body > *:not(#aksyon-print-root) { display: none !important; }

          #aksyon-print-root {
            position: static !important;
            left: auto !important;
            width: 210mm !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            display: block !important;
          }

          /* each .aksyon-print-page is one A4 sheet */
          .aksyon-print-page {
            break-after: page;
            page-break-after: always;
          }
          .aksyon-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          #aksyon-print-root, #aksyon-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* PRINT-ONLY LAYOUT (rendered in a portal, fixed-size charts) */}
      {createPortal(
        <div id="aksyon-print-root">

          {/* ------------------------------ PAGE 1: ANALYTICS ------------------------------ */}
          <div className="aksyon-print-page bg-white box-border flex flex-col justify-between" style={{ width: '210mm', height: '296mm', padding: '10mm', overflow: 'hidden' }}>

            {/* HEADER + CARDS */}
            <div className="space-y-2">
              <div className="bg-[#b32d2d] text-white p-3 rounded-lg flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight">AKSYON</h1>
                  <p className="text-[10px] text-red-100 font-medium">Analytics Report</p>
                </div>
                <div className="text-right text-[10px] font-bold">
                  <div>Jurisdiction: Brgy. {assignedBarangay || 'Santa Trinidad'}</div>
                  <div className="text-[9px] text-red-100 font-normal">
                    Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="border border-gray-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase block">Total System Users</span>
                  <div className="text-xl font-black text-gray-900 my-0.5">{totalUsers}</div>
                  <span className="text-[8px] text-gray-400">Registered residents in this barangay</span>
                </div>
                <div className="border border-gray-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase block">System Reports</span>
                  <div className="text-xl font-black text-gray-900 my-0.5">{totalReports}</div>
                  <span className="text-[8px] text-gray-400">Submissions in Brgy. {assignedBarangay || 'Santa Trinidad'}</span>
                </div>
                <div className="border border-gray-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase block">Covered Jurisdiction</span>
                  <div className="text-sm font-black text-gray-900 my-0.5">Brgy. {assignedBarangay || 'Santa Trinidad'}</div>
                  <span className="text-[8px] text-gray-400">Assigned Station Jurisdiction</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#dc2626] text-white p-2.5 rounded-lg">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-red-100">Pending</span>
                  <div className="text-xl font-black my-0.5">{pendingOverall}</div>
                  <span className="text-[8px] text-red-100">Pending Reports</span>
                </div>
                <div className="bg-[#109EEF] text-white p-2.5 rounded-lg">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white">Ongoing</span>
                  <div className="text-xl font-black my-0.5">{inProgressOverall}</div>
                  <span className="text-[8px] text-blue-100">Active Emergency Units</span>
                </div>
                <div className="bg-[#059669] text-white p-2.5 rounded-lg">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-100">Resolved</span>
                  <div className="text-xl font-black my-0.5">{resolvedOverall}</div>
                  <span className="text-[8px] text-emerald-100">Completed Dispatches</span>
                </div>
                <div className="bg-[#6b7280] text-white p-2.5 rounded-lg">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-100">Dismissed</span>
                  <div className="text-xl font-black my-0.5">{dismissedOverall}</div>
                  <span className="text-[8px] text-gray-100">Dismissed Reports</span>
                </div>
              </div>
            </div>

            {/* REPORT TRENDS (fixed-size chart, ~190mm wide) */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h3 className="font-bold text-xs text-gray-900 mb-1">Report Trends</h3>
              <AreaChart width={690} height={210} data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="printColorReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Area isAnimationActive={false} type="monotone" dataKey="reports" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#printColorReports)" />
              </AreaChart>
            </div>

            {/* DONUTS */}
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-gray-200 rounded-lg p-2.5 flex flex-col items-center">
                <h4 className="font-bold text-[10px] text-gray-900 self-start">Report Status</h4>
                <div className="relative" style={{ width: 320, height: 140 }}>
                  <PieChart width={320} height={140}>
                    <Pie isAnimationActive={false} data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3}>
                      {statusPieData.map((entry, idx) => (
                        <Cell key={`print-cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-black text-gray-900">{totalReports}</span>
                    <span className="text-[7px] uppercase font-bold text-gray-400">Total</span>
                  </div>
                </div>
                <div className="w-full flex justify-around text-[8px] font-bold text-gray-500 border-t border-gray-100 pt-1">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-600"></span> Pending</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span> Ongoing</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> Resolved</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> Dismissed</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-2.5 flex flex-col items-center">
                <h4 className="font-bold text-[10px] text-gray-900 self-start">Emergency Categories</h4>
                <div className="relative" style={{ width: 320, height: 140 }}>
                  {incidentTypeData.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-400">No records</div>
                  ) : (
                    <PieChart width={320} height={140}>
                      <Pie isAnimationActive={false} data={incidentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3}>
                        {incidentTypeData.map((entry, idx) => (
                          <Cell key={`print-cat-${idx}`} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-black text-gray-900">{incidentTypeData.length}</span>
                    <span className="text-[7px] uppercase font-bold text-gray-400">Categories</span>
                  </div>
                </div>
                <div className="w-full flex flex-wrap justify-center gap-1.5 text-[8px] font-bold text-gray-500 border-t border-gray-100 pt-1">
                  {incidentTypeData.map((item, idx) => (
                    <span key={`print-cat-label-${item.name}`} className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span>
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* PEAK INCIDENT HOURS */}
            <div className="border border-gray-200 rounded-lg p-3">
              <h4 className="font-bold text-xs text-gray-900 mb-1">Peak Incident Hours</h4>
              <BarChart width={690} height={140} data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="slot" tick={{ fontSize: 9, fill: '#6b7280', fontWeight: 600 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Bar isAnimationActive={false} dataKey="count" fill="#b32d2d" radius={[2, 2, 0, 0]} maxBarSize={30} />
              </BarChart>
              <div className="text-[8px] text-gray-400 font-medium text-right mt-1">
                Dispatch call density by time of day
              </div>
            </div>

          </div>

          {/* ------------------------------ PAGE 2: DBSCAN (only after DBSCAN has been run) ------------------------------ */}
          {dbscan && (
            <div className="aksyon-print-page bg-white box-border flex flex-col gap-2" style={{ width: '210mm', height: '296mm', padding: '10mm', overflow: 'hidden' }}>

              {/* HEADER */}
              <div className="bg-[#b32d2d] text-white p-3 rounded-lg flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight">AKSYON</h1>
                  <p className="text-[10px] text-red-100 font-medium">DBSCAN Incident Cluster Report</p>
                </div>
                <div className="text-right text-[10px] font-bold">
                  <div>Jurisdiction: Brgy. {assignedBarangay || 'Santa Trinidad'}</div>
                  <div className="text-[9px] text-red-100 font-normal">
                    Generated: {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                    {dbscanRanAt && ` • DBSCAN run: ${dbscanRanAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>
              </div>

              {/* SUMMARY CARDS */}
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-gray-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase block">Clusters Detected</span>
                  <div className="text-xl font-black text-gray-900 my-0.5">{dbscan.summary?.total_clusters ?? 0}</div>
                  <span className="text-[8px] text-gray-400">Geographic hotspots found</span>
                </div>
                <div className="border border-gray-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase block">Clustered Reports</span>
                  <div className="text-xl font-black text-gray-900 my-0.5">{dbscan.summary?.total_clustered_reports ?? 0}</div>
                  <span className="text-[8px] text-gray-400">Reports that belong to a cluster</span>
                </div>
                <div className="border border-gray-200 rounded-lg p-2.5">
                  <span className="text-[9px] font-bold text-gray-500 uppercase block">Noise Reports</span>
                  <div className="text-xl font-black text-gray-900 my-0.5">{dbscan.summary?.total_noise_reports ?? 0}</div>
                  <span className="text-[8px] text-gray-400">Isolated reports (unclustered)</span>
                </div>
              </div>

              {/* CLUSTER MAP */}
              <div className="border border-gray-200 rounded-lg p-3">
                <h3 className="font-bold text-xs text-gray-900 mb-1 flex items-center gap-1">
                  <MapPin size={12} className="text-[#b32d2d]" />
                  Incident Cluster Map
                </h3>
                {clusterGroups.length === 0 ? (
                  <div
                    className="rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-400"
                    style={{ width: 690, height: 120 }}
                  >
                    Not enough geotagged reports to form clusters.
                  </div>
                ) : (
                  <div className="relative isolate rounded-lg overflow-hidden border border-gray-200" style={{ width: 690, height: 380 }}>
                    <PrintClusterMap
                      groups={clusterGroups}
                      onTilesLoading={() => { printTilesReadyRef.current = false; }}
                      onTilesLoaded={() => { printTilesReadyRef.current = true; }}
                    />
                  </div>
                )}
                <div className="text-[8px] text-gray-400 font-medium mt-1">
                  Groups nearby reports (within 500 m, at least 2 reports) into geographic hotspots.
                </div>
              </div>

              {/* CLUSTER SUMMARY TABLE */}
              {clusterGroups.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden flex-1 min-h-0">
                  <div className="px-3 py-1.5 bg-gray-50 text-[9px] font-black uppercase tracking-wider text-gray-500">
                    Cluster Summary
                  </div>
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="px-3 py-1 font-bold">Cluster</th>
                        <th className="px-3 py-1 font-bold">Reports</th>
                        <th className="px-3 py-1 font-bold">Center (Lat, Lng)</th>
                        <th className="px-3 py-1 font-bold">Report IDs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printClusterRows.map((g) => (
                        <tr key={`print-row-${g.label}`} className="border-t border-gray-100 text-gray-700 font-medium align-top">
                          <td className="px-3 py-1 whitespace-nowrap">
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1.5"
                              style={{ backgroundColor: clusterColor(g.label) }}
                            ></span>
                            {clusterName(g.label)}
                          </td>
                          <td className="px-3 py-1">{g.points.length}</td>
                          <td className="px-3 py-1 whitespace-nowrap">
                            {g.isNoise ? '—' : `${g.center[0].toFixed(6)}, ${g.center[1].toFixed(6)}`}
                          </td>
                          <td className="px-3 py-1">{formatReportIds(g.points)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {hiddenClusterCount > 0 && (
                    <div className="px-3 py-1 text-[8px] text-gray-400 border-t border-gray-100">
                      +{hiddenClusterCount} more cluster{hiddenClusterCount > 1 ? 's' : ''} not shown (see the dashboard)
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>,
        document.body
      )}

      {/* WEB DASHBOARD UI */}
      <div className="p-4 sm:p-6 lg:p-8 bg-[#f4f6f8] min-h-screen">

        {/* WEB TOP CONTROLS */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={22} className="text-[#b32d2d] shrink-0" />
              <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight">
                System Analytics
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDownloadPDF}
              disabled={isLoading || !dashboard || isPreparingPdf || dbscanLoading}
              title="Page 1: analytics. Page 2: DBSCAN clusters (runs automatically if you haven't run it yet)"
              className="bg-[#b32d2d] hover:bg-[#8e2323] text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isPreparingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isPreparingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={() => fetchDashboard()}
              disabled={isSyncing}
              title="Reloads the general analytics only (DBSCAN has its own button)"
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} />
              {isSyncing ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        {/* DASHBOARD GRID CONTENT */}
        <div className="space-y-4">

          {/* ROW 1: TOP STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Registered Residents</span>
              <div className="text-3xl font-black text-gray-900 my-1">{totalUsers}</div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">System Reports</span>
              <div className="text-3xl font-black text-gray-900 my-1">{totalReports}</div>
              <span className="text-[10px] text-gray-400 font-medium">
                Submissions in Brgy. {assignedBarangay || 'Unassigned'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Assigned Barangay</span>
              <div className="text-xl font-black text-gray-900 my-1">
                {assignedBarangay ? `Brgy. ${assignedBarangay}` : 'Central Command'}
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                Assigned Station Jurisdiction
              </span>
            </div>
          </div>

          {/* ROW 2: STATUS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#dc2626] text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-100">Pending</span>
              <div className="text-3xl font-black my-1">{pendingOverall}</div>
              <span className="text-[10px] text-red-100 font-medium">Pending Incident Reports</span>
            </div>

            <div className="bg-[#109EEF] text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">Ongoing</span>
              <div className="text-3xl font-black my-1">{inProgressOverall}</div>
              <span className="text-[10px] text-blue-100 font-medium">Ongoing Incident Reports</span>
            </div>

            <div className="bg-[#059669] text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Resolved Today</span>
              <div className="text-3xl font-black my-1">{resolvedOverall}</div>
              <span className="text-[10px] text-emerald-100 font-medium">Resolved Incident Reports</span>
            </div>

            <div className="bg-[#6b7280] text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-100">Dismissed</span>
              <div className="text-3xl font-black my-1">{dismissedOverall}</div>
              <span className="text-[10px] text-gray-100 font-medium">Dismissed Incident Reports</span>
            </div>
          </div>

          {/* ROW 3: REPORT TRENDS LINE CHART */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <h3 className="font-bold text-sm text-gray-900">Report Trends</h3>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={timeRange}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTimeRange(val);
                    if (val !== 'date_range') {
                      setFromDate('');
                      setToDate('');
                    }
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 bg-white shadow-xs focus:outline-none cursor-pointer"
                >
                  <option value="this_week">This Week</option>
                  <option value="today">Today</option>
                  <option value="past_month">Past Month</option>
                  <option value="past_year">Past Year</option>
                  <option value="date_range">Custom Date Range...</option>
                  <option value="all_time">All Time</option>
                </select>

                <div className="bg-white border border-gray-300 rounded-lg flex items-center px-3 py-1 shadow-xs text-xs text-gray-600 font-bold gap-2">
                  <CalendarDays size={14} className="text-gray-400 shrink-0" />

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase">From</span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || todayKey}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setTimeRange('date_range');
                      }}
                      className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold text-gray-700"
                    />
                  </div>

                  <span className="text-gray-300">•</span>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400 uppercase">To</span>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      max={todayKey}
                      onChange={(e) => {
                        setToDate(e.target.value);
                        setTimeRange('date_range');
                      }}
                      className="bg-transparent focus:outline-none cursor-pointer text-xs font-bold text-gray-700"
                    />
                  </div>

                  {(fromDate || toDate) && (
                    <X
                      size={14}
                      className="text-gray-400 hover:text-red-500 cursor-pointer ml-1 shrink-0"
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                        setTimeRange(DEFAULT_PERIOD);
                      }}
                      title="Clear Custom Dates"
                    />
                  )}
                </div>
              </div>
            </div>

            {timeRange === 'date_range' && (!fromDate || !toDate) && (
              <p className="text-[10px] font-bold text-amber-600 mb-2">
                Pick both a start and an end date to load the custom range.
              </p>
            )}

            <div className="h-56 sm:h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="webColorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                  <Area name="Reports" type="monotone" dataKey="reports" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#webColorReports)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROW 4: 3 BREAKDOWN CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-between">
              <h4 className="font-bold text-xs text-gray-900 self-start mb-2">Report Status</h4>
              <div className="h-36 w-full min-w-0 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={50} paddingAngle={4}>
                      {statusPieData.map((entry, idx) => (
                        <Cell key={`web-cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-black text-gray-900">{totalReports}</span>
                  <span className="text-[8px] uppercase font-bold text-gray-400">Total</span>
                </div>
              </div>
              <div className="w-full flex flex-wrap justify-around gap-1 text-[9px] font-bold text-gray-500 border-t border-gray-100 pt-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Pending </span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600"></span> Ongoing </span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600"></span> Resolved</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500"></span> Dismissed</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col items-center justify-between">
              <h4 className="font-bold text-xs text-gray-900 self-start mb-2">Emergency Categories</h4>
              <div className="h-36 w-full min-w-0 flex items-center justify-center relative">
                {incidentTypeData.length === 0 ? (
                  <span className="text-xs font-bold text-gray-400">No records</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={incidentTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={36} outerRadius={50} paddingAngle={4}>
                        {incidentTypeData.map((entry, idx) => (
                          <Cell key={`web-cat-${idx}`} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-base font-black text-gray-900">{incidentTypeData.length}</span>
                  <span className="text-[8px] uppercase font-bold text-gray-400">Categories</span>
                </div>
              </div>
              <div className="w-full flex flex-wrap justify-center gap-1.5 text-[8px] font-bold text-gray-500 border-t border-gray-100 pt-2">
                {incidentTypeData.map((item, idx) => (
                  <span key={`web-cat-label-${item.name}`} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}></span>
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
              <h4 className="font-bold text-xs text-gray-900 mb-2">Peak Incident Hours</h4>
              <div className="h-36 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="slot" tick={{ fontSize: 8, fill: '#6b7280', fontWeight: 600 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} />
                    <Bar name="Reports" dataKey="count" fill="#b32d2d" radius={[3, 3, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-[9px] text-gray-400 font-medium border-t border-gray-100 pt-2 text-right">
                Dispatch call density by time of day
              </div>
            </div>
          </div>

          {/* ROW 5: DBSCAN CLUSTERS (separate, on-demand) */}
          <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <MapPin size={16} className="text-[#b32d2d]" />
                  DBSCAN Incident Clusters
                </h3>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-start gap-1">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  Groups nearby reports (within 500 m, at least 2 reports) into geographic hotspots.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {dbscanRanAt && (
                  <span className="text-[10px] text-gray-400 font-semibold">
                    Last run: {dbscanRanAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={runDbscan}
                  disabled={dbscanLoading || isLoading}
                  className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {dbscanLoading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  {dbscanLoading ? 'Running...' : dbscan ? 'Re-run DBSCAN' : 'Run DBSCAN'}
                </button>
              </div>
            </div>

            {dbscanError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {dbscanError}
              </div>
            )}

            {!dbscan ? (
              <div className="h-48 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-400 text-center px-4">
                {dbscanLoading
                  ? 'Clustering reports...'
                  : 'Click "Run DBSCAN" to detect incident clusters and plot them on the map.'}
              </div>
            ) : (
              <div className="space-y-4">
                {/* SUMMARY */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">Clusters Detected</span>
                    <span className="text-xl font-black text-gray-900">{dbscan.summary?.total_clusters ?? 0}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">Clustered Reports</span>
                    <span className="text-xl font-black text-gray-900">{dbscan.summary?.total_clustered_reports ?? 0}</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <span className="text-[10px] font-bold text-gray-400 block uppercase">Noise Reports</span>
                    <span className="text-xl font-black text-gray-900">{dbscan.summary?.total_noise_reports ?? 0}</span>
                  </div>
                </div>

                {clusterGroups.length === 0 ? (
                  <div className="h-32 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-400 text-center px-4">
                    Not enough geotagged reports to form clusters.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* MAP */}
                    <div className="lg:col-span-2 relative isolate h-80 lg:h-[420px] rounded-lg overflow-hidden border border-gray-200">
                      <ClusterMap groups={clusterGroups} selectedCluster={selectedCluster} showNoise={showNoise} />
                    </div>

                    {/* CLUSTER LIST + COORDINATES */}
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Clusters</span>
                        {selectedCluster !== null && (
                          <button
                            onClick={() => setSelectedCluster(null)}
                            className="text-[10px] font-bold text-[#b32d2d] hover:underline cursor-pointer"
                          >
                            Show all
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {clusterGroups.map((g) => {
                          const active = selectedCluster === g.label;
                          return (
                            <button
                              key={g.label}
                              onClick={() => setSelectedCluster(active ? null : g.label)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                                active ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <span className="flex items-center gap-2 text-gray-800">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: clusterColor(g.label) }}></span>
                                {clusterName(g.label)}
                              </span>
                              <span className="text-gray-500">{g.points.length} reports</span>
                            </button>
                          );
                        })}
                      </div>

                      {hasNoise && (
                        <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showNoise}
                            onChange={(e) => setShowNoise(e.target.checked)}
                          />
                          Show noise points on the map
                        </label>
                      )}

                      {selectedGroup ? (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-gray-50 text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: clusterColor(selectedGroup.label) }}></span>
                            Coordinates - {clusterName(selectedGroup.label)}
                          </div>
                          <div className="max-h-44 overflow-y-auto">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="text-left text-gray-400">
                                  <th className="px-3 py-1 font-bold">Report</th>
                                  <th className="px-3 py-1 font-bold">Latitude</th>
                                  <th className="px-3 py-1 font-bold">Longitude</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedGroup.points.map((p) => (
                                  <tr key={p.id} className="border-t border-gray-100 text-gray-700 font-medium">
                                    <td className="px-3 py-1">#{p.id}</td>
                                    <td className="px-3 py-1">{p.lat.toFixed(6)}</td>
                                    <td className="px-3 py-1">{p.lng.toFixed(6)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 font-medium">
                          Select a cluster to highlight it on the map and list its coordinates.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </AdminLayout>
  );
}