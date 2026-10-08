// Builds an iCalendar (.ics) feed that Google Calendar, Apple Calendar and Outlook can subscribe to.

export type FeedEvent = {
  id: string;
  title: string;
  start: string; // ISO timestamp, or YYYY-MM-DD when allDay
  end: string; // ISO timestamp, or YYYY-MM-DD (the last day) when allDay
  allDay?: boolean;
  tentative?: boolean;
  updated?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
};

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// All-day events end on the day AFTER the last day (exclusive), per RFC 5545.
function dayAfter(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const compactDate = (ymd: string) => ymd.replace(/-/g, '');

// RFC 5545: lines longer than 75 bytes continue on the next line, which starts with a space.
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8');
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function buildIcs(calendarName: string, events: FeedEvent[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ideal Events Hire//Ideal Invoicing//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Australia/Melbourne',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@ideal-invoicing`,
      `DTSTAMP:${utcStamp(e.updated || now.toISOString())}`,
      ...(e.allDay
        ? [`DTSTART;VALUE=DATE:${compactDate(e.start)}`, `DTEND;VALUE=DATE:${compactDate(dayAfter(e.end))}`]
        : [`DTSTART:${utcStamp(e.start)}`, `DTEND:${utcStamp(e.end)}`]),
      `SUMMARY:${escapeText(e.title)}`
    );
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push(e.tentative ? 'STATUS:TENTATIVE' : 'STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
