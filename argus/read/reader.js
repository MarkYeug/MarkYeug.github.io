import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../data/supabase-config.js";

const $ = (selector) => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const requested = params.get("n");
const chapterNumber = requested && /^\d+(?:\.\d+)?$/.test(requested) ? Number(requested) : 1;
const status = $("#reader-status");
const article = $("#reader-article");
const contentRoot = $("#chapter-content");
const themeToggle = $("#theme-toggle");
let currentChapter = null;
let supabase = null;
let session = null;
let authMode = "signup";
let activeParagraph = null;
let comments = [];
let commentVotes = [];
let progressTimer = null;

const safeText = (value) => String(value ?? "");
const htmlEscape = (value) => safeText(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const titleOf = (chapter) => "#" + chapter.n + ": " + chapter.title;
const chapterUrl = (number) => new URL("./?n=" + encodeURIComponent(number), location.href).href;
const chapterId = (chapter) => String(chapter.id || (chapter.url || "").match(/_(\d+)\/?$/)?.[1] || "");
const dateLabel = (date) => { const d = new Date(date); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}); };

function setTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = next;
  try { localStorage.setItem("argus-reader-theme", next); } catch {}
  const isDark = next === "dark";
  $("#theme-icon").textContent = isDark ? "☾" : "☀";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  themeToggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
}
themeToggle.addEventListener("click", () => setTheme(document.body.dataset.theme === "dark" ? "light" : "dark"));
try { setTheme(localStorage.getItem("argus-reader-theme") || "dark"); } catch { setTheme("dark"); }

function setNavLink(id, chapter, label) {
  const link = $(id);
  if (!chapter) { link.hidden = true; return; }
  link.hidden = false;
  link.href = chapterUrl(chapter.n);
  link.textContent = label;
  link.setAttribute("aria-label", label + ": " + titleOf(chapter));
}
function sanitizeChapterHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = safeText(html);
  const allowed = new Set(["P","BR","STRONG","B","EM","I","U","S","BLOCKQUOTE","H2","H3","HR","UL","OL","LI","SPAN"]);
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowed.has(child.tagName)) {
          child.replaceWith(document.createTextNode(child.textContent || ""));
          return;
        }
        [...child.attributes].forEach((attr) => child.removeAttribute(attr.name));
        walk(child);
      } else if (child.nodeType !== Node.TEXT_NODE) child.remove();
    });
  };
  walk(template.content);
  return template.content;
}
function addParagraphIds() {
  const paragraphs = [...contentRoot.querySelectorAll("p")];
  paragraphs.forEach((paragraph, index) => {
    const id = "p" + (index + 1);
    paragraph.dataset.paragraphId = id;
    paragraph.tabIndex = 0;
    paragraph.setAttribute("role", "button");
    paragraph.setAttribute("aria-label", "Open comments for paragraph " + (index + 1));
    paragraph.addEventListener("click", (event) => {
      if (event.target.closest(".paragraph-comment-count")) { event.preventDefault(); }
      openParagraphThread(id, paragraph);
    });
    paragraph.addEventListener("keydown", (event) => {
      if (event.target === paragraph && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openParagraphThread(id, paragraph);
      }
    });
  });
}
function renderComments() {
  const counts = new Map();
  comments.forEach((comment) => {
    if (comment.paragraph_id) counts.set(comment.paragraph_id, (counts.get(comment.paragraph_id) || 0) + 1);
  });
  contentRoot.querySelectorAll(".paragraph-comment-count").forEach((node) => node.remove());
  contentRoot.querySelectorAll("p[data-paragraph-id]").forEach((paragraph) => {
    const count = counts.get(paragraph.dataset.paragraphId) || 0;
    if (count) {
      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "paragraph-comment-count";
      badge.textContent = "▤ " + count;
      badge.setAttribute("aria-label", count + " comments on this paragraph");
      badge.addEventListener("click", (event) => { event.stopPropagation(); openParagraphThread(paragraph.dataset.paragraphId, paragraph); });
      paragraph.append(badge);
    }
  });
  renderCommentList("#chapter-comment-list", comments.filter((c) => !c.paragraph_id));
}
function createCommentCard(comment) {
  const item = document.createElement("article");
  item.className = "comment-item";
  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const author = document.createElement("strong");
  author.textContent = comment.display_name || "Reader";
  const date = document.createElement("time");
  date.textContent = dateLabel(comment.created_at);
  meta.append(author,date);
  const body = document.createElement("p");
  body.className = "comment-body";
  body.textContent = comment.body || "";
  item.append(meta,body);

  const actions = document.createElement("div");
  actions.className = "comment-actions";
  const vote = commentVotes.filter((row) => String(row.comment_id) === String(comment.id));
  const upCount = vote.filter((row) => row.vote === 1).length;
  const downCount = vote.filter((row) => row.vote === -1).length;
  const ownVote = session ? vote.find((row) => row.user_id === session.user.id)?.vote : null;
  const up = document.createElement("button");
  up.type = "button";
  up.className = "comment-vote" + (ownVote === 1 ? " is-selected" : "");
  up.textContent = "▲ " + upCount;
  up.title = "Upvote comment";
  up.setAttribute("aria-label", "Upvote comment; " + upCount + " upvotes");
  up.setAttribute("aria-pressed", String(ownVote === 1));
  up.addEventListener("click", () => voteOnComment(comment, 1, up, down));
  const down = document.createElement("button");
  down.type = "button";
  down.className = "comment-vote" + (ownVote === -1 ? " is-selected" : "");
  down.textContent = "▼ " + downCount;
  down.title = "Downvote comment";
  down.setAttribute("aria-label", "Downvote comment; " + downCount + " downvotes");
  down.setAttribute("aria-pressed", String(ownVote === -1));
  down.addEventListener("click", () => voteOnComment(comment, -1, up, down));
  actions.append(up,down);
  if (session && session.user.id === comment.user_id) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "comment-delete";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", "Delete your comment");
    remove.addEventListener("click", () => deleteOwnComment(comment, remove));
    actions.append(remove);
  }
  item.append(actions);
  return item;
}
function renderCommentList(selector, list) {
  const root = $(selector);
  root.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "comment-empty";
    empty.textContent = "No comments yet.";
    root.append(empty);
    return;
  }
  list.forEach((comment) => root.append(createCommentCard(comment)));
}
async function voteOnComment(comment, value, upButton, downButton) {
  if (!supabase || !session) { openAuth("Sign in or create an account to vote on comments."); return; }
  const existing = commentVotes.find((row) => String(row.comment_id) === String(comment.id) && row.user_id === session.user.id);
  upButton.disabled = true;
  downButton.disabled = true;
  let result;
  if (existing?.vote === value) {
    result = await supabase.from("reader_comment_votes").delete().eq("comment_id", comment.id).eq("user_id", session.user.id);
  } else {
    result = await supabase.from("reader_comment_votes").upsert(
      {comment_id: comment.id, user_id: session.user.id, vote: value},
      {onConflict: "comment_id,user_id"}
    );
  }
  upButton.disabled = false;
  downButton.disabled = false;
  if (result.error) { alert("Your vote could not be saved. Please try again."); return; }
  await loadComments();
}
async function deleteOwnComment(comment, button) {
  if (!supabase || !session || session.user.id !== comment.user_id) return;
  if (!confirm("Delete your comment? This cannot be undone.")) return;
  button.disabled = true;
  const { error } = await supabase.from("reader_comments").delete().eq("id", comment.id).eq("user_id", session.user.id);
  if (error) { button.disabled = false; alert("Your comment could not be deleted. Please try again."); return; }
  await loadComments();
}
function openParagraphThread(paragraphId, paragraph) {
  const old = paragraph.nextElementSibling;
  if (old?.classList.contains("paragraph-thread") && activeParagraph === paragraphId) {
    old.remove(); activeParagraph = null; return;
  }
  document.querySelectorAll(".paragraph-thread").forEach((thread) => thread.remove());
  activeParagraph = paragraphId;
  const thread = document.createElement("section");
  thread.className = "paragraph-thread";
  const heading = document.createElement("h3");
  heading.textContent = "Paragraph comments";
  const list = document.createElement("div");
  list.className = "comment-list";
  const subset = comments.filter((c) => c.paragraph_id === paragraphId);
  if (!subset.length) {
    const empty = document.createElement("p"); empty.className = "comment-empty"; empty.textContent = "No comments on this paragraph yet."; list.append(empty);
  } else {
    subset.forEach((comment) => list.append(createCommentCard(comment)));
  }
  const form = document.createElement("form");
  form.className = "comment-form";
  const label = document.createElement("label"); label.textContent = "Comment on this paragraph";
  const input = document.createElement("textarea"); input.rows = 3; input.maxLength = 3000; input.required = true; input.placeholder = "Add to the discussion…";
  const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Post comment";
  form.append(label,input,submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await postComment(input.value, paragraphId, submit);
  });
  thread.append(heading,list,form);
  paragraph.insertAdjacentElement("afterend",thread);
  thread.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function postComment(body, paragraphId, button) {
  if (!supabase || !session) { openAuth("Sign in or create an account to post comments."); return; }
  const text = body.trim();
  if (!text) return;
  button.disabled = true;
  const { error } = await supabase.from("reader_comments").insert({
    chapter_number: currentChapter.n,
    paragraph_id: paragraphId || null,
    user_id: session.user.id,
    display_name: session.user.user_metadata?.display_name || session.user.email?.split("@")[0] || "Reader",
    body: text
  });
  button.disabled = false;
  if (error) { alert("Your comment could not be posted. Check the Supabase setup and try again."); return; }
  await loadComments();
}
async function loadComments() {
  if (!supabase || !currentChapter) return;
  const { data, error } = await supabase.from("reader_comments").select("id,chapter_number,paragraph_id,user_id,display_name,body,created_at").eq("chapter_number",currentChapter.n).order("created_at",{ascending:true}).limit(500);
  if (error) { console.warn("Argus reader comments:",error.message); return; }
  comments = data || [];
  const voteResult = await supabase.from("reader_comment_votes").select("comment_id,user_id,vote").in("comment_id", comments.map((comment) => comment.id).length ? comments.map((comment) => comment.id) : [-1]);
  if (voteResult.error) console.warn("Argus reader votes:", voteResult.error.message);
  commentVotes = voteResult.data || [];
  renderComments();
  if (activeParagraph) {
    const p = contentRoot.querySelector('[data-paragraph-id="' + CSS.escape(activeParagraph) + '"]');
    if (p) { const thread = p.nextElementSibling; if (thread?.classList.contains("paragraph-thread")) { thread.remove(); openParagraphThread(activeParagraph,p); } }
  }
}
function openAuth(message) {
  $("#auth-panel").hidden = false;
  if (message) $("#auth-message").textContent = message;
}
function updateAuthUi() {
  $("#account-button").textContent = session ? "●" : "♙";
  $("#account-button").title = session ? "Signed in: " + (session.user.user_metadata?.display_name || session.user.email) : "Reader account";
  $("#auth-name-label").hidden = authMode === "signin" || !!session;
  $("#auth-name").hidden = authMode === "signin" || !!session;
  $("#auth-submit").hidden = !!session;
  $("#auth-mode-toggle").hidden = !!session;
  $("#auth-signout").hidden = !session;
  $("#auth-email").hidden = !!session;
  $("#auth-password").hidden = !!session;
  $("#auth-message").textContent = session
    ? "Signed in as " + (session.user.user_metadata?.display_name || session.user.email) + ". Your progress can now be saved and you can comment."
    : authMode === "signup" ? "Create an account to save reading progress and join chapter discussions." : "Sign in to restore your reading progress and comment.";
}
$("#account-button").addEventListener("click", () => { updateAuthUi(); $("#auth-panel").hidden = !$("#auth-panel").hidden; });
$("#auth-close").addEventListener("click", () => { $("#auth-panel").hidden = true; });
$("#auth-mode-toggle").addEventListener("click", () => {
  authMode = authMode === "signup" ? "signin" : "signup";
  $("#auth-name").value = "";
  $("#auth-mode-toggle").textContent = authMode === "signup" ? "Already have an account? Sign in" : "Need an account? Register";
  $("#auth-submit").textContent = authMode === "signup" ? "Create account" : "Sign in";
  $("#auth-name").required = authMode === "signup";
  $("#auth-password").autocomplete = authMode === "signup" ? "new-password" : "current-password";
  updateAuthUi();
});
$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) { $("#auth-message").textContent = "Account features are not connected yet. Add your Supabase project URL and anon key to argus/data/supabase-config.js after running the setup SQL."; return; }
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const button = $("#auth-submit"); button.disabled = true;
  let result;
  if (authMode === "signup") {
    result = await supabase.auth.signUp({email,password,options:{data:{display_name:$("#auth-name").value.trim()}}});
  } else result = await supabase.auth.signInWithPassword({email,password});
  button.disabled = false;
  if (result.error) { $("#auth-message").textContent = result.error.message; return; }
  session = result.data.session;
  if (!session && authMode === "signup") $("#auth-message").textContent = "Check your email to confirm your account, then sign in.";
  else { updateAuthUi(); await loadProgress(); await loadComments(); }
});
$("#auth-signout").addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
  session = null; updateAuthUi();
});
async function loadProgress() {
  if (!supabase || !session || !currentChapter) return;
  const { data } = await supabase.from("reader_progress").select("scroll_percent").eq("chapter_number",currentChapter.n).maybeSingle();
  if (data && Number.isFinite(data.scroll_percent) && data.scroll_percent > 2 && data.scroll_percent < 96) {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && !window.__argusRestoredProgress) {
      window.__argusRestoredProgress = true;
      scrollTo({top:max * data.scroll_percent / 100,behavior:"smooth"});
    }
  }
}
async function saveProgress() {
  if (!supabase || !session || !currentChapter) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  const percent = max > 0 ? Math.max(0,Math.min(100,Math.round(scrollY / max * 100))) : 0;
  await supabase.from("reader_progress").upsert({user_id:session.user.id,chapter_number:currentChapter.n,scroll_percent:percent,updated_at:new Date().toISOString()},{onConflict:"user_id,chapter_number"});
}
window.addEventListener("scroll", () => {
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = setTimeout(saveProgress,1200);
},{passive:true});
window.addEventListener("pagehide", saveProgress);
$("#chapter-comment-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = $("#chapter-comment-input");
  await postComment(input.value,null,event.submitter || $("#chapter-comment-form button"));
  input.value = "";
});

async function init() {
  try {
    const [catalogResponse, contentResponse, musicResponse] = await Promise.all([
      fetch("../data/chapters.json",{cache:"no-cache"}),
      fetch("../data/chapter-content.json",{cache:"no-cache"}),
      fetch("../data/soundtracks.json",{cache:"no-cache"})
    ]);
    if (!catalogResponse.ok) throw new Error("Could not load chapter catalog.");
    const catalog = await catalogResponse.json();
    const allChapters = (catalog.volumes || []).flatMap((volume) => volume.chapters || []).sort((a,b) => a.n - b.n);
    currentChapter = allChapters.find((chapter) => Number(chapter.n) === chapterNumber);
    if (!currentChapter) throw new Error("That chapter could not be found in the catalog.");
    const index = allChapters.findIndex((chapter) => Number(chapter.n) === Number(currentChapter.n));
    const previous = allChapters[index - 1], next = allChapters[index + 1];
    const title = titleOf(currentChapter);
    document.title = title + " | Argus Directorates";
    $("#reader-current-title").textContent = title;
    $("#chapter-heading").textContent = title;
    setNavLink("#previous-chapter",previous,"← Previous Chapter");
    setNavLink("#previous-chapter-bottom",previous,"← Previous Chapter");
    setNavLink("#next-chapter",next,"Next Chapter →");
    setNavLink("#next-chapter-bottom",next,"Next Chapter →");
    const contentData = contentResponse.ok ? await contentResponse.json() : {chapters:{}};
    const entry = contentData.chapters?.[String(currentChapter.n)];
    article.hidden = false;
    status.hidden = true;
    if (entry && typeof entry.html === "string" && entry.html.trim()) {
      contentRoot.append(sanitizeChapterHtml(entry.html));
      addParagraphIds();
    } else $("#content-missing").hidden = false;
    if (musicResponse.ok) {
      const musicData = await musicResponse.json();
      const soundtrack = musicData.chapters?.[chapterId(currentChapter)];
      const match = soundtrack?.soundtrack === true ? soundtrack.url?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|shorts\/|live\/|watch\?v=))([\w-]{11})/) : null;
      if (match) {
        const frame = document.createElement("iframe");
        frame.title = "Chapter soundtrack";
        frame.allow = "autoplay; encrypted-media";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.src = "https://www.youtube-nocookie.com/embed/" + match[1] + "?autoplay=1&controls=0&disablekb=1&fs=0&loop=1&playlist=" + match[1] + "&playsinline=1&rel=0";
        $("#soundtrack-player").append(frame);
      }
    }
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        supabase = createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
        const { data } = await supabase.auth.getSession();
        session = data.session;
        supabase.auth.onAuthStateChange((_event,nextSession) => { session = nextSession; updateAuthUi(); if (session) { loadProgress(); loadComments(); } });
        updateAuthUi();
        await loadComments();
        await loadProgress();
      } catch (error) { console.warn("Supabase has not been configured yet.",error); }
    } else updateAuthUi();
  } catch (error) {
    status.textContent = error.message || "The reader could not load this chapter.";
  }
}
init();
