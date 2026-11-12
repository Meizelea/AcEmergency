import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

// Shared date filter: preset list + "Custom Date Range..." which opens a calendar.
// In the calendar the 1st click is the FROM date and the 2nd click is the TO date.
// Dates are plain local "YYYY-MM-DD" strings (no timezone shifting).

const pad = (n) => String(n).padStart(2, '0');
const fromYMD = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatYMD = (s) =>
  s ? fromYMD(s).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '';

export const formatRange = (from, to) =>
  from && to ? `${formatYMD(from)} – ${formatYMD(to)}` : from ? `From ${formatYMD(from)}` : '';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function DateRangeFilter({
  preset,
  from,
  to,
  presets,
  onChange,
  customLabel = 'Custom Date Range...',
  customValue = 'custom',
  maxDate = '',
  align = 'left',
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('presets'); // 'presets' | 'calendar'
  const [cursor, setCursor] = useState(() => {
    const base = from ? fromYMD(from) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [hover, setHover] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buttonLabel =
    preset === customValue && from
      ? formatRange(from, to)
      : presets.find((p) => p.value === preset)?.label || presets[0]?.label || '';

  const toggleOpen = () => {
    setOpen((o) => !o);
    setView('presets');
  };

  const choosePreset = (value) => {
    onChange({ preset: value, from: '', to: '' });
    setOpen(false);
  };

  const startCustom = () => {
    setDraftFrom('');
    setDraftTo('');
    setHover('');
    setView('calendar');
  };

  const pickDay = (ymd) => {
    if (maxDate && ymd > maxDate) return;
    // First click (or a new pick after a finished range) = FROM
    if (!draftFrom || draftTo) {
      setDraftFrom(ymd);
      setDraftTo('');
      return;
    }
    // Second click = TO (swap if the person clicked an earlier day)
    let a = draftFrom;
    let b = ymd;
    if (b < a) [a, b] = [b, a];
    setDraftFrom(a);
    setDraftTo(b);
    onChange({ preset: customValue, from: a, to: b });
    setOpen(false);
    setView('presets');
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${pad(month + 1)}-${pad(d)}`);

  const awaitingEnd = Boolean(draftFrom) && !draftTo;
  const rangeEnd = draftTo || (awaitingEnd && hover >= draftFrom ? hover : '');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className="bg-white border border-gray-300 rounded-lg flex items-center gap-2 px-3 py-2 shadow-xs text-xs text-gray-600 font-bold cursor-pointer hover:bg-gray-50 w-full"
      >
        <Clock size={14} className="text-gray-400 shrink-0" />
        <span className="whitespace-nowrap">{buttonLabel}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0 ml-auto" />
      </button>

      {open && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-40 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[240px]`}>
          {view === 'presets' ? (
            <div className="py-1.5">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => choosePreset(p.value)}
                  className={`w-full text-left px-4 py-2 text-xs font-bold cursor-pointer hover:bg-gray-50 ${
                    preset === p.value ? 'text-[#b32d2d]' : 'text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={startCustom}
                className={`w-full text-left px-4 py-2 text-xs font-bold cursor-pointer hover:bg-gray-50 border-t border-gray-100 ${
                  preset === customValue ? 'text-[#b32d2d]' : 'text-gray-700'
                }`}
              >
                {customLabel}
              </button>
            </div>
          ) : (
            <div className="p-3 w-[264px]">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className={`rounded-lg border px-2.5 py-1.5 ${!draftFrom || draftTo ? 'border-[#b32d2d] bg-red-50/50' : 'border-gray-200'}`}>
                  <span className="block text-[9px] font-black uppercase text-gray-400">From</span>
                  <span className="text-xs font-bold text-gray-800">{draftFrom ? formatYMD(draftFrom) : 'Select date'}</span>
                </div>
                <div className={`rounded-lg border px-2.5 py-1.5 ${awaitingEnd ? 'border-[#b32d2d] bg-red-50/50' : 'border-gray-200'}`}>
                  <span className="block text-[9px] font-black uppercase text-gray-400">To</span>
                  <span className="text-xs font-bold text-gray-800">{draftTo ? formatYMD(draftTo) : 'Select date'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                  <ChevronLeft size={16} className="text-gray-600" />
                </button>
                <span className="text-xs font-black text-gray-800">
                  {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100 cursor-pointer">
                  <ChevronRight size={16} className="text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-y-0.5 text-center" onMouseLeave={() => setHover('')}>
                {WEEKDAYS.map((w) => (
                  <span key={w} className="text-[10px] font-bold text-gray-400 py-1">{w}</span>
                ))}
                {cells.map((ymd, i) => {
                  if (!ymd) return <span key={`blank-${i}`} />;
                  const isEdge = ymd === draftFrom || ymd === draftTo;
                  const inRange = draftFrom && rangeEnd && ymd > draftFrom && ymd < rangeEnd;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      disabled={Boolean(maxDate) && ymd > maxDate}
                      onClick={() => pickDay(ymd)}
                      onMouseEnter={() => setHover(ymd)}
                      className={`text-xs font-bold py-1.5 cursor-pointer rounded ${
                        isEdge
                          ? 'bg-[#b32d2d] text-white'
                          : inRange
                          ? 'bg-red-100 text-[#8b2323]'
                          : 'text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                      }`}
                    >
                      {Number(ymd.slice(8))}
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-gray-400 font-medium mt-2 text-center">
                {awaitingEnd ? 'Now pick the end date (To).' : 'Pick the start date (From), then the end date (To).'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
