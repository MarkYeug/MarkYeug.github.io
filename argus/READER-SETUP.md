# Argus Reader Setup

## What is in place

- The chapter catalog now opens the local Argus reader rather than sending the reader to WebNovel.
- Reader URLs are unique per chapter, for example `/argus/read/?n=12`.
- The reader has a fixed top navigation bar, full chapter labels such as `#12: Hungry`, top and bottom chapter navigation, and a bottom-left moon/sun theme toggle.
- The reader reads formatted manuscript HTML from `data/chapter-content.json`.
- The soundtrack note in the chapter list is now an availability indicator. When a chapter opens, its assigned YouTube soundtrack is requested through a hidden player. Browser autoplay policies may prevent unmuted autoplay until the reader interacts with the page.
- Supabase integration supports email/password accounts, reading progress, chapter comments, and paragraph-specific comment threads.

## Importing chapter prose

The existing catalog file only stores chapter metadata. It does not contain the actual prose. Add each manuscript to `data/chapter-content.json` in this structure:

```json
{
  "schema": 1,
  "chapters": {
    "12": {
      "html": "<p>First paragraph with <em>italic text</em>.</p><p>Second paragraph with <strong>bold text</strong>.</p>"
    }
  }
}
```

Use a proper JSON serializer or escape quotes and newlines correctly. Keep each paragraph in its own `<p>` element. The reader preserves paragraph breaks and supports paragraphs, bold, italics, underlining, strikethrough, blockquotes, headings, lists, and horizontal rules. Paragraph comment IDs are assigned in document order, so avoid inserting or reordering paragraphs after comments have been posted unless you intend those comments to move to the corresponding paragraph index.

## Connecting Supabase

1. Create a project at https://supabase.com/.
2. Open the project's SQL Editor and run all of `supabase-reader-schema.sql`.
3. In the Supabase project's API settings, copy the Project URL and the **anon/public** key.
4. Put those values in `data/supabase-config.js` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. In Supabase Authentication settings, configure the allowed site URL and redirect URLs to include your GitHub Pages site, including `https://markyeug.github.io/argus/read/`.
6. Test registering, email confirmation (if enabled), signing in, progress saving, and posting comments.

Never put a Supabase `service_role` key in this repository or any browser-side file. The schema enables row-level security so readers can only read/write their own progress, while chapter comments are publicly readable and only signed-in users can post them.

## Current limitation and source mapping

The reader framework is in place, but no chapter prose is included in the repository content file yet. I found a Volume I PDF in the project Library; its chapter numbering and titles do not line up one-to-one with the current 53-entry WebNovel catalog (for example, “Hungry” is numbered differently), so it has not been automatically split into reader chapters. That needs a verified chapter mapping or a current manuscript export before import. Until then, chapter pages show an explicit placeholder rather than mismatched, invented, or scraped text.
