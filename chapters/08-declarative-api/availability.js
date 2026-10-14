// availability.js: Fjord Table's fake booking backend (demo only, not from the book).
// Copied from fjord-table/availability.js; Chapter 8 adds searchNow() (see below).
// Everything lives in memory and resets on reload. The UI and the agent tools call
// the same functions, which is the point the chapters make: tools wrap code you already have.

const OPENING = { first: '17:00', last: '21:30', stepMinutes: 30 };   // closed on Mondays
const AREAS = { window: 8, indoor: 30, terrace: 12 };                    // seats per sitting
const LATENCY_MS = 250;
const bookings = [];   // { reference, date, time, partySize, seating, notes, guest }

const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00'));
const isTime = (s) => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
const isParty = (n) => Number.isInteger(n) && n >= 1 && n <= 12;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A stable pseudo-random "already booked" share per area and sitting, so the same
// date always looks the same and some sittings are genuinely full.
function preBooked(date, time, area) {
  let h = 2166136261;
  for (const c of `${date}|${time}|${area}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const share = ((h >>> 0) % 100) / 100;               // 0.00 – 0.99
  return Math.floor(AREAS[area] * Math.min(1, share * 1.15));
}

function seatsLeft(date, time, area) {
  const taken = bookings
    .filter((b) => b.date === date && b.time === time && (b.seating === area))
    .reduce((sum, b) => sum + b.partySize, 0);
  return Math.max(0, AREAS[area] - preBooked(date, time, area) - taken);
}

function sittings(date) {
  if (!isDate(date) || date < todayISO()) return [];
  if (new Date(date + 'T12:00:00').getDay() === 1) return [];          // Monday: closed
  const out = [];
  for (let m = toMinutes(OPENING.first); m <= toMinutes(OPENING.last); m += OPENING.stepMinutes) out.push(toHHMM(m));
  return out;
}

function slotFor(date, time, partySize) {
  const seating = Object.keys(AREAS).filter((area) =>
    seatsLeft(date, time, area) >= partySize && (partySize <= 8 || area === 'indoor'));
  return seating.length ? { date, time, partySize, seating } : null;
}

function wait(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, LATENCY_MS);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
}

export const availability = {
  // Up to five open sittings nearest the preferred time (or from opening time).
  // Bad input gives an empty list rather than an exception.
  async search({ date, time, partySize, signal } = {}) {
    await wait(signal);
    return availability.searchNow({ date, time, partySize });
  },

  // The same search with no simulated latency. Chapter 8 addition: results.html
  // uses it to put its JSON-LD in the page before parsing ends, the way a
  // server-rendered results page would.
  searchNow({ date, time, partySize } = {}) {
    if (!isParty(partySize)) return [];
    const target = isTime(time) ? toMinutes(time) : toMinutes(OPENING.first);
    return sittings(date)
      .map((t) => slotFor(date, t, partySize))
      .filter(Boolean)
      .sort((a, b) => Math.abs(toMinutes(a.time) - target) - Math.abs(toMinutes(b.time) - target)
                      || toMinutes(a.time) - toMinutes(b.time))
      .slice(0, 5)
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  },

  // The exact sitting, if it is open for this party (and seating, if one was asked for).
  async find({ date, time, partySize, seating }, { signal } = {}) {
    await wait(signal);
    if (!sittings(date).includes(time)) return null;
    const slot = slotFor(date, time, partySize);
    if (!slot) return null;
    if (seating && seating !== 'no preference' && !slot.seating.includes(seating)) return null;
    return slot;
  },

  // Commit a booking. Called by the booking panel once the user has confirmed.
  async book({ date, time, partySize, seating, notes, guest }) {
    await wait();
    const slot = slotFor(date, time, partySize);
    const area = seating && seating !== 'no preference' ? seating : slot?.seating[0];
    if (!slot || !slot.seating.includes(area)) throw new Error('That sitting is no longer available.');
    const reference = `FT-${1041 + bookings.length + 1}`;
    bookings.push({ reference, date, time, partySize, seating: area, notes: notes ?? '', guest });
    return { reference, seating: area };
  },

  // For the demo UI and tests.
  get bookings() { return bookings.map((b) => ({ ...b })); }
};
