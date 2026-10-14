// standards-watch.mjs: snapshot WebMCP's standards status and report what changed.
// Usage: node standards-watch.mjs [snapshots/last.json]
import { readFile, writeFile } from 'node:fs/promises';

const SOURCES = {
  spec: 'https://webmachinelearning.github.io/webmcp/',
  commits: 'https://github.com/webmachinelearning/webmcp/commits/main.atom',
  chromestatus: 'https://chromestatus.com/api/v0/features/5117755740913664',
  edgeTrial: 'https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials/0b76fe60-b266-458e-a285-04e375c0c31a',
  mozilla: 'https://github.com/mozilla/standards-positions/issues/1412',
  webkit: 'https://github.com/WebKit/standards-positions/issues/670',
  tag: 'https://github.com/w3ctag/design-reviews/issues/1238',
};

export const parse = {
  spec: (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    .match(/(Draft Community Group Report|Final Community Group Report|Working Draft|Editor['’]s Draft)\s*,?\s*(\d{1,2} \w+ \d{4})/)
    ?.slice(1, 3).join(', ') ?? null,
  commits: (xml) => {
    const entry = xml.match(/<entry>[\s\S]*?<\/entry>/)?.[0] ?? '';
    const title = entry.match(/<title>\s*([\s\S]*?)\s*<\/title>/)?.[1]?.replace(/&#39;/g, "'");
    const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1];
    return title ? `${updated} ${title}` : null;
  },
  chromestatus: (text) => {
    const feature = JSON.parse(text.replace(/^\)\]\}'\s*/, ''));
    const trial = feature.stages.find((s) => s.stage_type === 150); // origin trial stage
    if (!trial) return null;
    const lasts = [trial.desktop_last, ...trial.extensions.map((e) => e.desktop_last)];
    return { trialFrom: trial.desktop_first, trialThrough: Math.max(...lasts.filter(Boolean)) };
  },
  edgeTrial: (html) => html.match(/Trial Expiration Date<\/strong>\s*<p>([^<]+)<\/p>/)?.[1] ?? null,
  // Current labels only: the issue's "labels" block, not label events in its timeline.
  labels: (prefixes) => (html) => {
    const block = html.match(/"labels":\{"pageInfo":[\s\S]*?\]\}/)?.[0] ?? '';
    return [...block.matchAll(/"name":"([^"]+)"/g)].map((m) => m[1])
      .filter((name) => prefixes.some((p) => name.startsWith(p))).sort();
  },
};
const PARSERS = {
  spec: parse.spec, commits: parse.commits, chromestatus: parse.chromestatus,
  edgeTrial: parse.edgeTrial,
  mozilla: parse.labels(['position:']), webkit: parse.labels(['position:']),
  tag: parse.labels(['Progress:', 'Missing:', 'Resolution:']),
};

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'webmcp-standards-watch/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function snapshot() {
  const entries = await Promise.all(Object.entries(SOURCES).map(async ([key, url]) => {
    try { return [key, PARSERS[key](await fetchText(url))]; }
    catch (err) { return [key, { error: err.message }]; }
  }));
  return { checkedAt: new Date().toISOString(), ...Object.fromEntries(entries) };
}

export function diff(before, after) {
  return Object.keys(SOURCES)
    .filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ source: k, before: before?.[k] ?? null, after: after[k] }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] ?? 'snapshots/last.json';
  const before = await readFile(file, 'utf8').then(JSON.parse).catch(() => null);
  const after = await snapshot();
  const changes = diff(before, after);
  console.log(JSON.stringify(after, null, 2));
  for (const c of changes) console.log(`CHANGED ${c.source}: ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`);
  await writeFile(file, JSON.stringify(after, null, 2) + '\n');
  process.exitCode = before && changes.length ? 2 : 0;
}
