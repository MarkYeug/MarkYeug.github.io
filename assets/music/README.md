# Site music

The player reads `playlist.json` in this folder. Each track is:

```json
{ "title": "Song name", "artist": "Creator", "src": "song-file.mp3" }
```

`src` is relative to this folder. Order in the file = order in the player. Add, remove or reorder
tracks by editing the file; no code changes needed. Audio is played straight from these files
(no embeds, so no ads).

Quick start for the seven starter songs:

1. `node scripts/build-playlist.mjs` fills in titles/artists from the video links in `scripts/music-sources.txt`.
2. Save each audio file here as `<videoId>.mp3` (the id is the part after `youtu.be/`).

Tips: 128-192 kbps keeps files small (GitHub Pages sites should stay well under 1 GB). Only host audio
you have the rights or permission to publish.
