# Argus Reader Setup

## What is in place

- The chapter catalog now opens the local Argus reader rather than sending the reader to WebNovel.
- Reader URLs are unique per chapter, for example `/argus/read/?n=12`.
- The reader has a fixed top navigation bar, full chapter labels such as `#12: Hungry`, top and bottom chapter navigation, and a bottom-left moon/sun theme toggle.
- The reader reads formatted manuscript HTML from `data/chapter-content.json`.
- The soundtrack note in the chapter list is now an availability indicator. When a chapter opens, its assigned YouTube soundtrack is requested through a hidden player. Browser autoplay policies may prevent unmuted autoplay until the reader interacts with the page.
- Supabase integration supports email/password accounts, reading progress, chapter comments, and paragraph-specific comment threads.
- Signed-in readers can upvote or downvote each comment (one vote per reader per comment), change or remove their vote, and delete their own comments. Row-level security enforces vote ownership and comment deletion ownership.

## Automatic WebNovel chapter text sync

The GitHub Actions workflow now runs `scripts/sync-chapter-content.mjs` after refreshing the chapter catalog. It opens the published WebNovel chapter pages in Chromium, reads the public chapter text, sanitizes the HTML, and stores paragraph and inline formatting in `data/chapter-content.json`. The workflow commits catalog and prose updates to the repository, which GitHub Pages then serves to the reader.

- On the first successful run, it attempts to sync every chapter missing text.
- On scheduled runs, it refreshes the newest three chapters and retries any missing chapters.
- Use **Actions → Update chapter list → Run workflow** to request a full refresh of all cataloged chapters.
- If WebNovel returns a block page, HTTP error, or changed markup, the sync logs the chapter as unavailable and keeps any previously saved text. It does not log in, unlock paid chapters, or bypass access challenges. Missing chapters are retried on later runs.
- The extractor keeps paragraph boundaries and supported inline formatting such as bold, italics, underlining, and line breaks. The reader removes unsupported markup before display.

The existing catalog scraper has previously received HTTP 403 from WebNovel, so the sync may not populate every chapter until ordinary page access works in GitHub Actions. Check the workflow run logs to see which chapters were retrieved. The content file starts empty and is populated by the workflow; you should not have to manually paste chapter prose into it.

## Connecting Supabase

1. Create a project at https://supabase.com/.
2. Open the project's SQL Editor and run all of `supabase-reader-schema.sql` for a fresh setup. If the original schema is already installed, run `supabase-comment-votes-migration.sql` to add the voting table and policies without changing existing comments.
3. In the Supabase project's API settings, copy the Project URL and the **anon/public** key.
4. Put those values in `data/supabase-config.js` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. In Supabase Authentication settings, configure the allowed site URL and redirect URLs to include your GitHub Pages site, including `https://markyeug.github.io/argus/read/`.
6. Test registering, email confirmation (if enabled), signing in, progress saving, posting comments, voting, and deleting a comment owned by the signed-in account.

Never put a Supabase `service_role` key in this repository or any browser-side file. The schema enables row-level security so readers can only read/write their own progress, while chapter comments are publicly readable and only signed-in users can post them.

## Current limitation and source mapping

The reader framework is in place, but no chapter prose is included in the repository content file yet. I found a Volume I PDF in the project Library; its chapter numbering and titles do not line up one-to-one with the current 53-entry WebNovel catalog (for example, “Hungry” is numbered differently), so it has not been automatically split into reader chapters. That needs a verified chapter mapping or a current manuscript export before import. Until then, chapter pages show an explicit placeholder rather than mismatched, invented, or scraped text.
