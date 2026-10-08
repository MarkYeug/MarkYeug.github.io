// Fills assets/music/playlist.json from scripts/music-sources.txt.
//   title  = the YouTube video's title,  artist = the channel name  (public oEmbed lookup; no downloading)
//   src    = <videoId>.mp3  -> put your audio file at assets/music/<videoId>.mp3
// Entries already in playlist.json keep their title/artist, so hand edits survive re-runs.
// Run from the repo root:  node scripts/build-playlist.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SOURCES = 'scripts/music-sources.txt', OUT = 'assets/music/playlist.json';
const idOf = u => u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/)?.[1];

const ids = readFileSync(SOURCES, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => [l, idOf(l)]);
const bad = ids.filter(([, id]) => !id);
if (bad.length) { console.error('Could not read a video id from:\n' + bad.map(([l]) => '  ' + l).join('\n')); process.exit(1); }

const prev = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')).tracks || []) : [];
const tracks = [];
for (const [url, id] of ids) {
  const src = `${id}.mp3`, old = prev.find(t => t.src === src);
  if (old) { tracks.push(old); continue; }
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
  if (!r.ok) { console.error(`oEmbed lookup failed for ${url} (HTTP ${r.status}). Fill that entry in by hand instead.`); tracks.push({ title: id, artist: '', src }); continue; }
  const d = await r.json();
  tracks.push({ title: d.title, artist: d.author_name, src });
  console.log(`${id}  ${d.title}  -  ${d.author_name}`);
}
writeFileSync(OUT, JSON.stringify({ tracks }, null, 2) + '\n');
console.log(`\nWrote ${tracks.length} tracks to ${OUT}. Now add the matching audio files, e.g. assets/music/${tracks[0]?.src}`);
