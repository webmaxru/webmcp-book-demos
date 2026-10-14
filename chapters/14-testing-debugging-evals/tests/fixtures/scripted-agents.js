// Deterministic stand-ins for a model (support code, not a listing).
// "careful" does what a good agent should; "sloppy" makes the classic mistakes:
// a European date format and children left out of the party size.
const MONTHS = { november: '11' };

function parse(text) {
  const m = text.match(/(\d{1,2}) (November) (\d{4})/i);
  const date = m ? `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}` : null;
  const words = { two: 2, three: 3, four: 4, five: 5 };
  let partySize = 0;
  for (const [, n, who] of text.matchAll(/\b(two|three|four|five)\b ?(adults|kids|children)?/gi))
    partySize = who ? partySize + words[n.toLowerCase()] : Math.max(partySize, words[n.toLowerCase()]);
  const time = text.match(/\b(\d{2}:\d{2})\b/)?.[1] ?? (/7 in the evening/.test(text) ? '19:00' : undefined);
  const seating = /window/.test(text) ? 'window' : undefined;
  const notes = /birthday/.test(text) ? text.match(/[^.]*birthday[^.]*/)[0].trim() : undefined;
  const wantsBooking = /\bbook\b|please/i.test(text);
  return { date, partySize, time, seating, notes, wantsBooking, m };
}

export function scriptedAgent(style = 'careful') {
  return {
    async next({ messages }) {
      const user = messages.find((m) => m.role === 'user').content;
      const done = messages.filter((m) => m.role === 'tool').map((m) => m.name);
      const p = parse(user);
      if (style === 'sloppy') {
        p.date = `${p.m[1]}/11/${p.m[3]}`;                       // 20/11/2026
        if (/kids/.test(user)) p.partySize = 2;                  // forgot the children
      }
      if (!done.includes('search_availability'))
        return { call: { functionName: 'search_availability',
                         arguments: clean({ date: p.date, partySize: p.partySize, time: p.time }) } };
      if (p.wantsBooking && !done.includes('book_table'))
        return { call: { functionName: 'book_table',
                         arguments: clean({ date: p.date, time: p.time, partySize: p.partySize,
                                            seating: p.seating, notes: p.notes }) } };
      return { call: null };
    }
  };
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
