-- Run this once in the Supabase SQL Editor to add comment upvotes and downvotes.
-- Existing comments and accounts are preserved.

create table if not exists public.reader_comment_votes (
  comment_id bigint not null references public.reader_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.reader_comment_votes enable row level security;

drop policy if exists "Comment votes are publicly readable" on public.reader_comment_votes;
create policy "Comment votes are publicly readable"
  on public.reader_comment_votes for select to anon, authenticated
  using (true);

drop policy if exists "Readers can cast their own comment votes" on public.reader_comment_votes;
create policy "Readers can cast their own comment votes"
  on public.reader_comment_votes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Readers can change their own comment votes" on public.reader_comment_votes;
create policy "Readers can change their own comment votes"
  on public.reader_comment_votes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Readers can remove their own comment votes" on public.reader_comment_votes;
create policy "Readers can remove their own comment votes"
  on public.reader_comment_votes for delete to authenticated
  using (auth.uid() = user_id);

grant select on public.reader_comment_votes to anon, authenticated;
grant insert, update, delete on public.reader_comment_votes to authenticated;
