/**
 * Works out whether a business is open RIGHT NOW from the weekly schedule
 * Google Places gives us.
 *
 * Why not just use the `is_open` flag: that is a snapshot taken at scan time.
 * By the time you are looking at the lead it can be days old, so it answers
 * "was this place open when I found it", which is not the question.
 *
 * Input format is Places' `weekdayDescriptions`, joined with "; ":
 *   "Monday: 9:00 AM - 5:00 PM; Tuesday: Closed; Wednesday: Open 24 hours"
 * Real data also contains split shifts ("9:00 AM - 12:00 PM, 1:00 - 5:00 PM"),
 * overnight ranges ("6:00 PM - 2:00 AM"), en/em dashes, and start times that
 * omit AM/PM when it matches the end time.
 */

export type OpenState = 'open' | 'closed' | 'unknown';

export interface HoursStatus {
  state: OpenState;
  /** e.g. "9:00 AM - 5:00 PM", "Closed", "Open 24 hours", or '' if unknown. */
  todayLabel: string;
  /** Short line for a badge: "Open until 5:00 PM", "Closed - opens 9:00 AM Mon". */
  detail: string;
}

interface Interval { start: number; end: number } // minutes from midnight

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "9:00 AM" / "9 AM" / "14:30" -> minutes from midnight, or null. */
function parseTime(raw: string, fallbackMeridiem?: string): number | null {
  const m = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i);
  if (m) {
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toLowerCase() === 'p') h += 12;
    return h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  }
  // No meridiem of its own. Common in split shifts: "1:00 - 5:00 PM".
  const bare = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (bare && fallbackMeridiem) {
    let h = parseInt(bare[1], 10) % 12;
    if (fallbackMeridiem.toLowerCase() === 'p') h += 12;
    return h * 60 + (bare[2] ? parseInt(bare[2], 10) : 0);
  }
  if (bare) {
    // 24-hour clock.
    const h = parseInt(bare[1], 10);
    if (h <= 23) return h * 60 + (bare[2] ? parseInt(bare[2], 10) : 0);
  }
  return null;
}

function parseDayLine(text: string): Interval[] | null {
  const t = text.trim();
  if (!t) return null;
  if (/closed/i.test(t)) return [];
  if (/open\s*24\s*hours/i.test(t)) return [{ start: 0, end: 1440 }];

  const out: Interval[] = [];
  for (const chunk of t.split(',')) {
    // Google uses an en dash; hand-typed hours use a hyphen or "to".
    const parts = chunk.split(/\s*(?:[-‒–—―]|\bto\b)\s*/i);
    if (parts.length < 2) continue;
    const endMeridiem = (parts[1].match(/([ap])\.?m\.?/i) || [])[1];
    const start = parseTime(parts[0], endMeridiem);
    const end = parseTime(parts[1]);
    if (start === null || end === null) continue;
    out.push({ start, end });
  }
  return out.length ? out : null;
}

/** Parses the whole week. Missing days stay undefined rather than "closed". */
export function parseHours(hours?: string | null): (Interval[] | undefined)[] {
  const week: (Interval[] | undefined)[] = new Array(7);
  if (!hours) return week;
  for (const line of hours.split(';')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const day = DAYS.indexOf(line.slice(0, idx).trim().toLowerCase());
    if (day === -1) continue;
    const parsed = parseDayLine(line.slice(idx + 1));
    if (parsed) week[day] = parsed;
  }
  return week;
}

function fmt(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(m % 60).padStart(2, '0');
  return `${h}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
}

function labelFor(intervals: Interval[] | undefined): string {
  if (!intervals) return '';
  if (!intervals.length) return 'Closed';
  if (intervals.length === 1 && intervals[0].start === 0 && intervals[0].end === 1440) return 'Open 24 hours';
  return intervals.map((i) => `${fmt(i.start)} - ${fmt(i.end)}`).join(', ');
}

/**
 * @param utcOffsetMinutes the BUSINESS's offset from UTC, from Places. Without
 *   it we fall back to this device's clock, which is wrong by an hour or more
 *   for any lead in another timezone - the exact mistake this feature exists
 *   to prevent - so callers should pass it whenever they have it.
 */
export function getHoursStatus(
  hours?: string | null,
  utcOffsetMinutes?: number | null,
  now: Date = new Date()
): HoursStatus {
  const week = parseHours(hours);
  if (week.every((d) => d === undefined)) return { state: 'unknown', todayLabel: '', detail: '' };

  // Shift into the business's own timezone when we know it.
  const local =
    utcOffsetMinutes == null
      ? now
      : new Date(now.getTime() + (utcOffsetMinutes + now.getTimezoneOffset()) * 60000);

  const day = local.getDay();
  const mins = local.getHours() * 60 + local.getMinutes();
  const todayLabel = labelFor(week[day]);

  // An overnight range started yesterday can still be running.
  const yesterday = week[(day + 6) % 7];
  if (yesterday) {
    for (const i of yesterday) {
      if (i.end <= i.start && mins < i.end) {
        return { state: 'open', todayLabel, detail: `Open until ${fmt(i.end)}` };
      }
    }
  }

  for (const i of week[day] ?? []) {
    const open = i.end <= i.start ? mins >= i.start : mins >= i.start && mins < i.end;
    if (open) {
      const detail =
        i.start === 0 && i.end === 1440 ? 'Open 24 hours' : `Open until ${fmt(i.end)}`;
      return { state: 'open', todayLabel, detail };
    }
  }

  // Closed. Find the next opening so the badge can say when to call back.
  for (let step = 0; step < 8; step++) {
    const d = (day + step) % 7;
    for (const i of week[d] ?? []) {
      if (step === 0 && i.start <= mins) continue;
      const when = step === 0 ? fmt(i.start) : `${fmt(i.start)} ${DAY_ABBR[d]}`;
      return { state: 'closed', todayLabel, detail: `Closed - opens ${when}` };
    }
  }
  return { state: 'closed', todayLabel, detail: 'Closed' };
}
