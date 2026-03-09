import { h } from "preact";
import { createPortal } from "preact/compat";
import { useState, useEffect, useRef, useCallback, useMemo } from "preact/hooks";
import { today, formatDate, getDateLabel, addDays } from "../../utils/DateUtils";

interface DatePickerProps {
  value: string | null;
  time: string | null;
  onChange: (date: string | null, time: string | null) => void;
  icon?: string;
  label: string;
  hint?: string;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DAY_HEADERS = ["月", "火", "水", "木", "金", "土", "日"];

export function DatePicker({ value, time, onChange, icon, label, hint, externalOpen, onOpenChange }: DatePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };
  const [viewYear, setViewYear] = useState(0);
  const [viewMonth, setViewMonth] = useState(0);
  const [timeInput, setTimeInput] = useState(time || "");
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize calendar view to current value or today
  useEffect(() => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setTimeInput(time || "");
  }, [value, time, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // Check if click is inside the trigger container or the portal popover
      if (containerRef.current && containerRef.current.contains(target)) return;
      const popover = document.querySelector(".tasklens-datepicker-popover");
      if (popover && popover.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reposition popover on resize/scroll via rAF loop
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let raf: number;
    const reposition = () => {
      const el = popoverRef.current;
      if (!el || !containerRef.current) return;
      const field = containerRef.current.closest(".tasklens-detail-field") || containerRef.current;
      const rect = field.getBoundingClientRect();
      const vh = window.innerHeight;
      const popH = el.offsetHeight;
      let top = rect.bottom + 2;
      const left = rect.left;
      if (top + popH > vh) {
        top = rect.top - popH - 2;
      }
      if (top < 0) top = 4;
      el.style.top = `${top}px`;
      el.style.left = `${left}px`;
      raf = requestAnimationFrame(reposition);
    };
    raf = requestAnimationFrame(reposition);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const handleSelect = useCallback(
    (date: string | null, t: string | null = null) => {
      onChange(date, t);
      setOpen(false);
    },
    [onChange]
  );

  const handleTimeChange = useCallback(
    (newTime: string) => {
      setTimeInput(newTime);
      if (value) {
        // Immediately save time change if date is set
        onChange(value, newTime || null);
      }
    },
    [value, onChange]
  );

  const handleTimeClear = useCallback(() => {
    setTimeInput("");
    if (value) {
      onChange(value, null);
    }
  }, [value, onChange]);

  // Display text
  const displayText = useMemo(() => {
    if (!value) return null;
    const dl = getDateLabel(value);
    const timeStr = time ? ` ${time}` : "";
    return { text: dl.text + timeStr, color: dl.color, raw: value + (time ? ` ${time}` : "") };
  }, [value, time]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    return buildCalendarGrid(viewYear, viewMonth);
  }, [viewYear, viewMonth]);

  const todayStr = today();

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const monthLabel = `${viewYear}年${viewMonth + 1}月`;

  return (
    <div class="tasklens-datepicker" ref={containerRef}>
      {/* Value display (only when date is set) */}
      {displayText && (
        <div
          class="tasklens-datepicker-trigger tasklens-datepicker-trigger--set"
          onClick={() => setOpen(!open)}
        >
          {icon && <span class="tasklens-datepicker-icon">{icon}</span>}
          <span
            class="tasklens-datepicker-value"
            style={{ color: displayText.color }}
          >
            {displayText.text}
          </span>
          <button
            class="tasklens-datepicker-clear"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(null, null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Popover - rendered via portal to escape transform containing block */}
      {open && createPortal(
        <div class="tasklens-datepicker-popover" ref={popoverRef}>
          {/* Quick shortcuts */}
          <div class="tasklens-datepicker-shortcuts">
            <button
              class="tasklens-datepicker-shortcut"
              onClick={() => handleSelect(todayStr, timeInput || null)}
            >
              <span class="tasklens-datepicker-shortcut-icon" style={{ color: "#058527" }}>📅</span>
              <span>今日</span>
              <span class="tasklens-datepicker-shortcut-day">{getDayName(todayStr)}</span>
            </button>
            <button
              class="tasklens-datepicker-shortcut"
              onClick={() => handleSelect(addDays(todayStr, 1), timeInput || null)}
            >
              <span class="tasklens-datepicker-shortcut-icon" style={{ color: "#eb8909" }}>☀️</span>
              <span>明日</span>
              <span class="tasklens-datepicker-shortcut-day">{getDayName(addDays(todayStr, 1))}</span>
            </button>
            <button
              class="tasklens-datepicker-shortcut"
              onClick={() => handleSelect(getNextWeekday(1), timeInput || null)}
            >
              <span class="tasklens-datepicker-shortcut-icon" style={{ color: "#4fc3f7" }}>📆</span>
              <span>来週月曜</span>
              <span class="tasklens-datepicker-shortcut-day">{getNextWeekday(1)}</span>
            </button>
            <button
              class="tasklens-datepicker-shortcut"
              onClick={() => handleSelect(addDays(todayStr, 7), timeInput || null)}
            >
              <span class="tasklens-datepicker-shortcut-icon" style={{ color: "#246fe0" }}>⏭️</span>
              <span>1週間後</span>
              <span class="tasklens-datepicker-shortcut-day">{getDayName(addDays(todayStr, 7))}</span>
            </button>
            <button
              class="tasklens-datepicker-shortcut tasklens-datepicker-shortcut--clear"
              onClick={() => handleSelect(null, null)}
            >
              <span class="tasklens-datepicker-shortcut-icon">🚫</span>
              <span>日付なし</span>
            </button>
          </div>

          <div class="tasklens-datepicker-divider" />

          {/* Time input */}
          <div class="tasklens-datepicker-time">
            <span class="tasklens-datepicker-time-label">🕐 時刻</span>
            <input
              type="time"
              class="tasklens-datepicker-time-input"
              value={timeInput}
              onInput={(e) => handleTimeChange((e.target as HTMLInputElement).value)}
            />
            {timeInput && (
              <button class="tasklens-datepicker-time-clear" onClick={handleTimeClear}>✕</button>
            )}
          </div>

          <div class="tasklens-datepicker-divider" />

          {/* Mini calendar */}
          <div class="tasklens-datepicker-calendar">
            <div class="tasklens-datepicker-cal-header">
              <button class="tasklens-datepicker-cal-nav" onClick={prevMonth}>‹</button>
              <span class="tasklens-datepicker-cal-title">{monthLabel}</span>
              <button class="tasklens-datepicker-cal-nav" onClick={nextMonth}>›</button>
            </div>

            <div class="tasklens-datepicker-cal-grid">
              {/* Day headers */}
              {DAY_HEADERS.map((d) => (
                <div key={d} class="tasklens-datepicker-cal-dayheader">{d}</div>
              ))}

              {/* Day cells */}
              {calendarDays.map((day, i) => {
                if (!day) {
                  return <div key={`e${i}`} class="tasklens-datepicker-cal-empty" />;
                }
                const dateStr = formatDate(new Date(viewYear, viewMonth, day));
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === value;
                const isPast = dateStr < todayStr;

                return (
                  <button
                    key={day}
                    class={[
                      "tasklens-datepicker-cal-day",
                      isToday && "tasklens-datepicker-cal-day--today",
                      isSelected && "tasklens-datepicker-cal-day--selected",
                      isPast && "tasklens-datepicker-cal-day--past",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSelect(dateStr, timeInput || null)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// --- Helpers ---

function buildCalendarGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];

  for (let i = 0; i < startOffset; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  return grid;
}

const DAY_NAMES_SHORT = ["日", "月", "火", "水", "木", "金", "土"];

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES_SHORT[d.getDay()] + "曜日";
}

function getNextWeekday(targetDay: number): string {
  const now = new Date();
  const current = now.getDay();
  let diff = targetDay - current;
  if (diff <= 0) diff += 7;
  const d = new Date();
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}
