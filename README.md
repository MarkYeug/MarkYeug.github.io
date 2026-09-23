# markyeug.github.io

Static site (plain HTML/CSS/JS). Palette: gold & black.

## Chapter list (automatic)
`argus/data/chapters.json` is rewritten by `.github/workflows/update-chapters.yml`, which reads the WebNovel catalog every few hours (every 30 min around Monday/Friday releases). The Chapters page and the "Latest chapter" line read that file.

- **If the update fails:** the file is left untouched, so the last good list keeps showing, and the workflow run turns red in the repo's Actions tab.
- **If the file can't be loaded/is invalid:** the Chapters page shows "Can't display chapters".
- Run it on demand: Actions → *Update chapter list* → *Run workflow*.
- Repo settings needed once: Settings → Actions → General → Workflow permissions → **Read and write**.
