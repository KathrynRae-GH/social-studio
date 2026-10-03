/* Social Studio 1.0.0: content library, calendar, asset library, ideas and Ask Claude for one brand.
   Brand settings, pieces and events load from the page's db (settings/brand, pieces/*, events/*). */
(() => {
  const host = document.getElementById("app");
  const MARKUP = "<header class=\"top\">\n  <div class=\"top-in\">\n    <nav class=\"pages\" aria-label=\"Pages\">\n      <button class=\"pg\" type=\"button\" data-view=\"chat\" aria-current=\"false\">Ask Claude</button>\n      <button class=\"pg\" type=\"button\" data-view=\"library\" aria-current=\"page\">Content Library</button>\n      <button class=\"pg\" type=\"button\" data-view=\"calendar\" aria-current=\"false\">Calendar</button>\n      <button class=\"pg\" type=\"button\" data-view=\"assets\" aria-current=\"false\">Asset Library</button>\n      <button class=\"pg\" type=\"button\" data-view=\"ideas\" aria-current=\"false\">Ideas</button>\n    </nav>\n    <div class=\"row\">\n      <div class=\"grow\">\n        <div class=\"brand\" id=\"brand\">Content Library</div>\n        <h1 id=\"h1\">Content Library</h1>\n      </div>\n      <button class=\"btn\" id=\"dl-all\" type=\"button\" disabled>Download all finals</button>\n      <span class=\"ax\" id=\"hdr-assets-btn\" hidden><input type=\"file\" id=\"a-file\" accept=\"image/*,video/*\" multiple hidden>\n      <button class=\"btn\" id=\"a-upload\" type=\"button\" hidden title=\"Photos: JPG, PNG, WebP, GIF or iPhone HEIC. Video: MP4, WebM or iPhone MOV, up to about 4 minutes. Big videos and MOV/HEIC files are converted here before they upload, so keep the tab open until they finish.\">Upload photos or video</button></span>\n    </div>\n    <div id=\"hdr-lib\" class=\"hdrlib\">\n      <div class=\"row\">\n        <div class=\"bar\" aria-hidden=\"true\"><i class=\"f\" id=\"bar-f\" style=\"width:0\"></i><i class=\"d\" id=\"bar-d\" style=\"width:0\"></i></div>\n        <div class=\"counts\" id=\"counts\"></div>\n      </div>\n    </div>\n    <div class=\"ax hdrlib\" id=\"hdr-assets\" hidden>\n    <div class=\"row\">\n      <label class=\"search\" for=\"a-q\">\n        <svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" aria-hidden=\"true\"><circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-3.5-3.5\"/></svg>\n        <input id=\"a-q\" type=\"search\" placeholder=\"Search: subject, color, #12, room, name…\" autocomplete=\"off\">\n      </label>\n      <button class=\"btn ghost fbtn\" id=\"a-openf\" type=\"button\">Filters</button>\n      <select id=\"a-sort\" aria-label=\"Sort\" class=\"btn ghost\" style=\"padding:9px 10px\">\n        <option value=\"num\">Sort: library number</option>\n        <option value=\"new\">Sort: newest first</option>\n        <option value=\"title\">Sort: name A–Z</option>\n      </select>\n    </div>\n    <div class=\"row\"><span class=\"count\" id=\"a-count\">Loading assets…</span><div class=\"active-f\" id=\"a-activef\"></div></div>\n</div>\n  </div>\n</header>\n\n<div class=\"bwrap\"><div class=\"banner\" id=\"banner\" hidden></div><div class=\"setup-note\" id=\"setup-note\" hidden></div></div>\n<div class=\"boot\" id=\"boot\"><span class=\"spin\" aria-hidden=\"true\"></span><p id=\"boot-msg\">Loading your studio…</p></div>\n\n<main class=\"wrap\" id=\"view-lib\">\n  <p class=\"intro\">Everything is sorted by type. Pick one, then narrow it down by where it is. Mark each piece <b>Final</b> or <b>Draft</b> on its card (and each caption inside <b>Captions</b>). Once everything is Final it's <b>ready to post</b>. On the <b>Calendar</b>, Claude's slots start as <b>Suggested</b> until you <b>Lock</b> them. Leave notes on drafts and tell Claude in chat.</p>\n  <div class=\"ltabs\" id=\"ltabs\" role=\"tablist\" aria-label=\"Content type\"></div>\n  <div class=\"lfilters\">\n    <div class=\"chips\" id=\"sfilter\" role=\"radiogroup\" aria-label=\"Show\"></div>\n    <label class=\"themesel\" id=\"themewrap\">Theme <select id=\"themesel\"></select></label>\n  </div>\n  <section class=\"group thsec\" id=\"threads-sec\" aria-labelledby=\"h-threads\" hidden></section>\n  <div id=\"groups\"></div>\n</main>\n\n<main class=\"wrap\" id=\"view-cal\" hidden>\n  <section class=\"best-sec cal-hero\" aria-labelledby=\"strat-h\">\n    <span class=\"shape burst\" aria-hidden=\"true\"></span><span class=\"shape flower\" aria-hidden=\"true\"></span>\n    <p class=\"hero-kick\">What posts when</p>\n    <h2 class=\"sh\" id=\"strat-h\">Strategy</h2>\n    <details class=\"notices strat\" id=\"best-d\">\n      <summary><span class=\"nt\">Best times to post</span><span class=\"nhint\" id=\"best-hint\"></span></summary>\n      <div class=\"dbody\"><div class=\"best\" id=\"best\"></div><p class=\"bnote\" id=\"bnote\"></p></div>\n    </details>\n    <details class=\"notices strat\" id=\"strat\">\n      <summary><span class=\"nt\">Posting rules</span><span class=\"ncount\" id=\"strat-n\"></span><span class=\"nhint\">What the calendar checks every week</span></summary>\n      <ul class=\"rules\" id=\"rules\"></ul>\n    </details>\n  </section>\n  <section class=\"rules-sec\" aria-labelledby=\"rules-h\">\n    <h2 class=\"sh\" id=\"rules-h\">Posting plan</h2>\n    <ol class=\"flow\" id=\"flow\" aria-label=\"How a post goes out\"></ol>\n    <div class=\"planbar\" id=\"planbar\"></div>\n    <div class=\"weeks\" id=\"weeks\" aria-label=\"Next six weeks\"></div>\n    <div class=\"issues\" id=\"issues\"></div>\n  </section>\n  <div class=\"calwrap\">\n    <section aria-labelledby=\"cal-title\">\n      <div class=\"caltool\">\n        <button class=\"iconbtn\" id=\"cal-prev\" type=\"button\" aria-label=\"Previous month\">‹</button>\n        <h2 id=\"cal-title\" aria-live=\"polite\"></h2>\n        <button class=\"iconbtn\" id=\"cal-next\" type=\"button\" aria-label=\"Next month\">›</button>\n        <button class=\"btn ghost small\" id=\"cal-today\" type=\"button\">Today</button>\n        <button class=\"btn ghost small\" id=\"cal-text\" type=\"button\">+ Threads post</button>\n        <span class=\"tz\" id=\"tz\"></span>\n        <div class=\"seg vt\" id=\"vt\" role=\"radiogroup\" aria-label=\"Calendar view\"><button type=\"button\" role=\"radio\" data-m=\"month\" aria-checked=\"true\">MONTH</button><button type=\"button\" role=\"radio\" data-m=\"list\" aria-checked=\"false\">LIST</button></div>\n      </div>\n      <div id=\"calbody\"></div>\n      <div class=\"legend\" id=\"legend\" aria-label=\"Key\"></div>\n    </section>\n    <div class=\"rcol\">\n      <aside class=\"queue\" aria-label=\"Pieces to plan\">\n        <div class=\"tabs\" role=\"tablist\" id=\"qtabs\" aria-label=\"Pieces\"></div>\n        <div class=\"qlist\" id=\"qlist\"></div>\n      </aside>\n      <section class=\"igcard\" id=\"igcard\" aria-labelledby=\"ig-h\"></section>\n    </div>\n  </div>\n</main>\n<main class=\"wrap\" id=\"view-chat\" hidden>\n  <section class=\"chat\" aria-label=\"Chat with Claude\">\n    <div class=\"hero hero-chat\">\n      <span class=\"shape burst\" aria-hidden=\"true\"></span><span class=\"shape dot\" aria-hidden=\"true\"></span>\n      <div class=\"hero-in\"><p class=\"hero-kick\">Your planning partner</p>\n        <p class=\"hero-text\">Ask for ideas, captions, a better week, or changes to the plan. Claude reads the library, the calendar and the Ideas list. Changes show up as a card you apply with one tap.</p></div>\n      <button class=\"btn small hero-btn\" id=\"chatnew\" type=\"button\">New chat</button>\n    </div>\n    <div class=\"chatlog\" id=\"chatlog\"></div>\n    <div class=\"chatstarts\" id=\"chatstarts\" role=\"group\" aria-label=\"Ideas to start with\"></div>\n    <form class=\"composer\" id=\"composer\">\n      <label class=\"sr\" for=\"chatin\">Message Claude</label>\n      <textarea id=\"chatin\" rows=\"2\" placeholder=\"Ask Claude for ideas, captions or changes…\"></textarea>\n      <div class=\"cbtns\"><button class=\"btn ghost small\" id=\"chatstop\" type=\"button\" hidden>Stop</button><button class=\"btn\" id=\"chatsend\" type=\"submit\">Send</button></div>\n    </form>\n    <p class=\"chatnote\" id=\"chatnote\"></p>\n  </section>\n</main>\n\n<main class=\"wrap\" id=\"view-ideas\" hidden>\n  <div class=\"hero hero-ideas\">\n    <span class=\"shape flower\" aria-hidden=\"true\"></span><span class=\"shape burst\" aria-hidden=\"true\"></span>\n    <div class=\"hero-in\"><p class=\"hero-kick\">What to make next</p>\n      <p class=\"hero-text\"><b>Make now</b> is what Claude can build from photos and video already in the Asset Library. <b>Ideas for later</b> is the big list: open an idea, then approve or decline it. Approved ideas put their shots on the <b>Shot list</b>; check them off as you get them. Built ideas move to <b>Built</b>.</p></div>\n  </div>\n  <div class=\"chips\" role=\"radiogroup\" aria-label=\"Ideas view\" id=\"ideas-tabs\"></div>\n  <div id=\"ideas-body\"></div>\n</main>\n<div id=\"view-assets\" class=\"ax\" hidden>\n<div class=\"banner\" id=\"a-banner\" hidden></div>\n\n<div class=\"layout\">\n  <aside class=\"rail\" id=\"a-rail\" aria-label=\"Filters\">\n    <div class=\"railclose\"><h3 style=\"font-size:26px\">Filters</h3><button class=\"btn small\" id=\"a-closef\" type=\"button\">Show results</button></div>\n    <div class=\"fg\" id=\"a-fg-type\"></div>\n    <div class=\"fg\" id=\"a-fg-people\"></div>\n    <div class=\"fg\" id=\"a-fg-colors\"></div>\n    <div class=\"fg\" id=\"a-fg-categories\"></div>\n    <div class=\"fg\" id=\"a-fg-room\"></div>\n    <div class=\"fg\" id=\"a-fg-subjects\"></div>\n    <div class=\"fg\" id=\"a-fg-orientation\"></div>\n    <div class=\"fg\" id=\"a-fg-source\"></div>\n  </aside>\n  <main>\n    <div class=\"grid\" id=\"a-grid\" aria-label=\"Assets\"></div>\n    <div class=\"empty\" id=\"a-empty\" hidden></div>\n  </main>\n</div>\n\n<div class=\"tray\" id=\"a-tray\" hidden>\n  <div class=\"thumbs\" id=\"a-traythumbs\"></div>\n  <b id=\"a-traycount\"></b>\n  <button class=\"btn small\" id=\"a-traycopy\" type=\"button\">Copy for Claude</button>\n  <button class=\"btn ghost small\" id=\"a-trayview\" type=\"button\">Show</button>\n  <button class=\"btn ghost small\" id=\"a-trayclear\" type=\"button\">Clear</button>\n</div>\n<div class=\"uplist\" id=\"a-uplist\" hidden></div>\n<div class=\"toast\" id=\"a-toast\" role=\"status\" aria-live=\"polite\" hidden></div>\n\n<div class=\"scrim\" id=\"a-scrim\" hidden>\n  <aside class=\"panel\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"a-p-title\">\n    <div class=\"phead\">\n      <button class=\"btn small\" id=\"a-p-pick\" type=\"button\">Add to Reel shortlist</button>\n      <button class=\"btn ghost small\" id=\"a-p-dl\" type=\"button\">Download</button>\n      <button class=\"pclose\" id=\"a-p-close\" type=\"button\" aria-label=\"Close\">×</button>\n    </div>\n    <div class=\"pbody\">\n      <div class=\"preview\" id=\"a-p-preview\"></div>\n      <div class=\"pinfo\">\n        <div class=\"field\"><label for=\"a-p-title\" class=\"vh\" hidden>Name</label><input class=\"ptitle\" id=\"a-p-title\"></div>\n        <div class=\"idrow\"><span>ID</span><code id=\"a-p-id\"></code><button class=\"btn ghost small\" id=\"a-p-copyid\" type=\"button\">Copy ID</button><span id=\"a-p-saved\" class=\"saved\"></span></div>\n        <div class=\"rule\" id=\"a-p-rule\"></div>\n        <div class=\"caution\" id=\"a-p-caution\" hidden></div>\n        <div class=\"field\"><label for=\"a-p-desc\">Description</label><textarea id=\"a-p-desc\"></textarea></div>\n        <div class=\"two\">\n          <div class=\"field\"><label for=\"a-p-room\" id=\"a-p-roomlab\">Room</label><select id=\"a-p-room\"></select></div>\n          <div class=\"field\"><label for=\"a-p-people\">People in it</label><select id=\"a-p-people\"></select></div>\n        </div>\n        <div class=\"field\"><span>Categories</span><div class=\"chips\" id=\"a-p-cats\"></div></div>\n        <div class=\"field\"><label for=\"a-p-subjects\">Subjects (comma-separated)</label><input id=\"a-p-subjects\"></div>\n        <div class=\"field\"><label for=\"a-p-notes\">Notes and cautions</label><textarea id=\"a-p-notes\" placeholder=\"Logos to crop, who's in it, anything Claude should know\"></textarea></div>\n        <div class=\"swrow\" id=\"a-p-colors\"></div>\n        <div class=\"meta\" id=\"a-p-meta\"></div>\n        <div class=\"pacts\" id=\"a-p-upacts\" hidden>\n          <button class=\"btn ghost small\" id=\"a-p-suggest\" type=\"button\" hidden>Suggest tags with Claude</button>\n          <button class=\"btn ghost small\" id=\"a-p-del\" type=\"button\">Delete upload</button>\n        </div>\n        <div class=\"confirm\" id=\"a-p-confirm\" hidden><span>Delete this upload for good?</span><button class=\"btn small\" id=\"a-p-delyes\" type=\"button\">Delete</button><button class=\"btn ghost small\" id=\"a-p-delno\" type=\"button\">Keep it</button></div>\n      </div>\n    </div>\n  </aside>\n</div>\n</div>\n<div class=\"lb\" id=\"lb\" hidden role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"lb-title\">\n  <div class=\"lb-top\"><span class=\"t\" id=\"lb-title\"></span><span class=\"n\" id=\"lb-count\"></span><button class=\"lb-close\" id=\"lb-close\" type=\"button\" aria-label=\"Close preview\">×</button></div>\n  <div class=\"lb-stage\" id=\"lb-stage\"><button class=\"lb-nav prev\" id=\"lb-prev\" type=\"button\" aria-label=\"Previous slide\">‹</button><div class=\"lb-media\" id=\"lb-media\"></div><button class=\"lb-nav next\" id=\"lb-next\" type=\"button\" aria-label=\"Next slide\">›</button></div>\n</div>\n<div class=\"mscrim\" id=\"mscrim\" hidden><div class=\"modal\" id=\"modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"m-title\"></div></div>\n<div class=\"toast\" id=\"toast\" role=\"status\" aria-live=\"polite\" hidden></div>\n<div class=\"scrim\" id=\"scrim\" hidden>\n  <aside class=\"drawer\" id=\"drawer\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"dr-title\">\n    <div class=\"dhead\">\n      <div class=\"dthumb\" id=\"dr-thumb\"></div>\n      <div class=\"dtitle\"><div class=\"kick\" id=\"dr-kick\"></div><h2 id=\"dr-title\"></h2><p class=\"sub\" id=\"dr-sub\"></p></div>\n      <button class=\"dclose\" id=\"dr-close\" type=\"button\" aria-label=\"Close captions\">×</button>\n    </div>\n    <div class=\"dstatus\">\n      <span class=\"slabel\" id=\"dr-mlabel\">Reel</span>\n      <div class=\"seg\" role=\"radiogroup\" aria-label=\"Media status\"><button type=\"button\" role=\"radio\" data-s=\"draft\" id=\"dr-draft\" aria-checked=\"false\">DRAFT</button><button type=\"button\" role=\"radio\" data-s=\"final\" id=\"dr-final\" aria-checked=\"false\">FINAL</button></div>\n    </div>\n    <div class=\"tabs\" role=\"tablist\" id=\"dr-tabs\" aria-label=\"Platform\"></div>\n    <div class=\"dpanel\" role=\"tabpanel\" id=\"dr-panel\">\n      <p class=\"tip\" id=\"dr-tip\"></p>\n      <textarea id=\"cap-text\" aria-label=\"Caption text\"></textarea>\n      <div class=\"capst\" id=\"dr-capst\">\n        <span class=\"slabel\" id=\"dr-caplabel\">This caption</span>\n        <div class=\"seg\" role=\"radiogroup\" aria-label=\"Caption status\"><button type=\"button\" role=\"radio\" data-s=\"draft\" id=\"dc-draft\" aria-checked=\"false\">DRAFT</button><button type=\"button\" role=\"radio\" data-s=\"final\" id=\"dc-final\" aria-checked=\"false\">FINAL</button></div>\n      </div>\n      <div class=\"dfoot\">\n        <span class=\"meter\" id=\"dr-meter\"></span>\n        <span id=\"dr-saved\"></span>\n        <button class=\"btn ghost small\" id=\"dr-restore\" type=\"button\">Restore Claude's version</button>\n        <button class=\"btn small\" id=\"dr-copy\" type=\"button\">Copy</button>\n      </div>\n      <div class=\"dfoot\"><button class=\"btn ghost small\" id=\"dr-txt\" type=\"button\">Download all captions (.txt)</button></div>\n    </div>\n  </aside>\n</div>\n";
  if (host) host.innerHTML = MARKUP; else document.body.insertAdjacentHTML("afterbegin", MARKUP);
})();
(() => {
// ===== Social Studio =====
// One brand's content library, calendar, asset library, ideas and Ask Claude page. Nothing brand-specific lives in this file:
// the brand comes from the page's db. settings/brand holds the name, palette, fonts, platforms, posting rules and voice;
// pieces/* are the graphics and videos to review (media in the page's asset store); events/* are the dated things posts point
// to (classes, launches, shows). Claude fills those from the brand's project in Claude; the page writes review marks, captions,
// the calendar, Threads drafts, ideas and asset tags back to the same db.
const STUDIO_VERSION = "1.0.0";
const DATA = { items: [], teach: {}, teachAsOf: "", workshops: [] };
const CAPS0 = {};             // Claude's captions for each piece (each piece doc's `captions`), used until an edited copy exists
const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 50"><rect width="40" height="50" fill="#3a3431"/><path d="M16 18v14l11-7z" fill="#bdb3aa"/></svg>');
const arr = v => Array.isArray(v) ? v : [];
const cap1 = s => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const an = w => (/^[aeiou]/i.test(String(w || "")) ? "an " : "a ") + w;
const listJoin = l => l.length < 2 ? (l[0] || "") : l.slice(0, -1).join(", ") + " and " + l[l.length - 1];
const slugify = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Every platform the studio knows. A brand turns on the ones it uses in settings.platforms.
const PDEFS = {
  ig: { name: "Instagram", short: "IG", chip: "IG", limit: 2200, tags: true, tip: "A short story, a soft call to action, and a few hashtags at the end. Links go in your bio." },
  fb: { name: "Facebook", short: "FB", chip: "FB", limit: 63206, tags: false, tip: "Details first, a direct link, no hashtags." },
  li: { name: "LinkedIn", short: "LI", chip: "LINKEDIN", limit: 3000, tags: true, tip: "Lead with the point in the first two lines, then the story. Two or three hashtags at most." },
  pi: { name: "Pinterest", short: "PI", chip: "PINTEREST", limit: 500, tags: false, tip: "A searchable first line that says what it is, then what someone gets from it. Add the link when you post." },
  tt: { name: "TikTok", short: "TT", chip: "TIKTOK", limit: 4000, tags: true, videoOnly: true, tip: "Short and searchable, with a few hashtags. Links go in your bio." },
  yt: { name: "YouTube Shorts", short: "YT", chip: "YOUTUBE", limit: 5000, tags: true, videoOnly: true, tip: "The first line is the title (under 100 characters), then a line or two of description." },
  th: { name: "Threads", short: "TH", chip: "THREADS", limit: 500, tags: false, tip: "Conversational, no hashtags, ends on an invitation. Leave it empty to skip Threads for this piece." },
  st: { name: "Stories", short: "ST", story: true },
};
const P_ORDER = ["ig", "fb", "li", "pi", "tt", "yt", "th", "st"];
const ALT_TIP = "Describes what's visible for people using screen readers. On Instagram: Advanced settings, then Accessibility. On Facebook: Edit, then Alt text.";
const START_WHY = "A general starting point. Claude swaps in your own numbers once a few weeks of posts are in.";
const BEST_DEF = {
  ig: { time: "09:00", days: [1, 2, 3, 4, 5], dayText: "Weekdays", why: START_WHY, src: "Starting point" },
  fb: { time: "12:00", days: [1, 2, 3, 4, 5], dayText: "Same days as Instagram", why: START_WHY, src: "Starting point" },
  li: { time: "08:30", days: [2, 3, 4], dayText: "Tue–Thu mornings", why: START_WHY, src: "Starting point" },
  pi: { time: "20:00", days: [0, 5, 6], dayText: "Fri–Sun evenings", why: START_WHY, src: "Starting point" },
  tt: { time: "15:00", days: [1, 2, 3, 4, 5], dayText: "Video only · weekdays", why: START_WHY, src: "Starting point" },
  yt: { time: "14:00", days: [1, 2, 3, 4, 5], dayText: "Video only · weekdays", why: START_WHY, src: "Starting point" },
  th: { time: "12:30", days: [0, 1, 2, 3, 4, 5, 6], dayText: "Every day", why: START_WHY, src: "Starting point" },
  st: { time: "10:00", days: [1, 3], dayText: "Mon + Wed", why: "Stories go up from your phone so you can add link, poll and countdown stickers.", src: "Posting rule" },
};
const DEF = {
  name: "", owner: "", slug: "", tz: "Central", about: "",
  platforms: ["ig", "fb", "tt", "th", "st"], optionalPlatforms: ["th"],
  postStart: "", best: {}, perWeek: { ig: 3, fb: 3, li: 2, pi: 3, tt: 2, yt: 1, th: 7, st: 2 },
  reels: 1, leadDays: 10, shortLead: 2, extraDays: [], thSlots: null, ruleText: null, bestNote: "",
  contentTypes: ["Promotion", "Behind the scenes", "Community", "How-to"], themes: [],
  events: null, hosts: null, eventsAsOf: "", scheduler: null, storyLink: "", flags: [],
  voice: [], facts: [], photoRules: [], threadKinds: null, shotGroups: null, captionTips: {},
  assets: {}, palette: {}, fonts: {}, style: {}, chatStarts: null,
};
const DEFAULT_COLORS = ["#EBBA5C", "#DD583F", "#EBB7C3", "#4768AC", "#ADCDCE", "#E78E51", "#AF80B1", "#507C57", "#E187B0", "#AFBEDB"];

let SET = { ...DEF }, NAME = "", OWNER = "", SLUG = "studio", PFX = "st", TZ = "Central", LEAD = "ig", EV = null, HOST = null, SCHED = null;
let PK = [], CAPK = [], PLAT = [], PNAME = {}, PSHORT = {}, OPTIONAL = new Set(), BEST = {}, RULES = {}, TH_SLOTS = [], EXTRA_DAYS = [];
let RULE_TEXT = [], CTYPES = [], BNOTE = "", THEMES = [], THEME_NAME = {}, POST_START = "", FLAGS = [], TH_KIND = {}, TH_KIND_KEYS = [];
let WHEN_ORDER = [], WHEN_NOTE = {}, VIEWS = {}, ROUTE = {}, ROUTE_WHY = {};
const evw = () => EV ? EV.word : "event";
const evp = () => EV ? EV.plural : "events";
const hostw = () => HOST ? HOST.word : "host";
const DEFAULT_WHEN = () => WHEN_ORDER[1] || WHEN_ORDER[0] || "Any day";
const handoffWhere = () => `the ${NAME || "brand"} project in Claude`;
const dayNames = days => arr(days).map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
const flagOf = t => { for (const f of FLAGS) { f.re.lastIndex = 0; if (f.re.test(String(t || ""))) return f.why; } return null; };
const okDays = v => arr(v).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
const okHM = v => /^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : null;

function applySettings(raw) {
  const s = { ...DEF, ...(raw && typeof raw === "object" ? raw : {}) };
  SET = s;
  NAME = String(s.name || "").trim(); OWNER = String(s.owner || "").trim();
  SLUG = slugify(s.slug || NAME) || "studio";
  PFX = SLUG.split("-").filter(Boolean).map(w => w[0]).join("").slice(0, 4) || "st";
  TZ = String(s.tz || "Central");
  PK = P_ORDER.filter(k => arr(s.platforms).includes(k)); if (!PK.length) PK = [...DEF.platforms];
  LEAD = ["ig", "fb", "li", "pi"].find(k => PK.includes(k)) || PK.find(k => k !== "st" && k !== "th") || PK[0];
  CAPK = PK.filter(k => k !== "st");
  OPTIONAL = new Set(arr(s.optionalPlatforms));
  const tips = s.captionTips && typeof s.captionTips === "object" ? s.captionTips : {};
  PLAT = [...CAPK.map(k => ({ k, ...PDEFS[k], tip: String(tips[k] || PDEFS[k].tip) })), { k: "alt", name: "Alt text", limit: 250, tags: false, tip: String(tips.alt || ALT_TIP) }];
  PNAME = Object.fromEntries(P_ORDER.map(k => [k, PDEFS[k].name])); PSHORT = Object.fromEntries(P_ORDER.map(k => [k, PDEFS[k].short]));
  BEST = {};
  for (const k of P_ORDER) {
    const b = { ...BEST_DEF[k], ...((s.best && s.best[k]) || {}) };
    b.time = okHM(b.time) || BEST_DEF[k].time; b.days = okDays(b.days); if (!b.days.length) b.days = [...BEST_DEF[k].days];
    BEST[k] = b;
  }
  const pw = { ...DEF.perWeek, ...((s.perWeek && typeof s.perWeek === "object") ? s.perWeek : {}) };
  RULES = { ...Object.fromEntries(Object.entries(pw).map(([k, v]) => [k, Math.max(0, Number(v) || 0)])),
    reels: Math.max(0, Number(s.reels) || 0), leadDays: Math.max(1, Number(s.leadDays) || 10), shortLead: Math.max(0, Number(s.shortLead ?? 2)) };
  EXTRA_DAYS = okDays(s.extraDays).filter(d => !BEST[LEAD].days.includes(d));
  EV = s.events && typeof s.events === "object" ? { word: String(s.events.word || "event"), plural: String(s.events.plural || (s.events.word || "event") + "s"), reminders: !!s.events.reminderStories } : null;
  HOST = s.hosts && typeof s.hosts === "object" ? { word: String(s.hosts.word || "host"), plural: String(s.hosts.plural || (s.hosts.word || "host") + "s"), hold: s.hosts.hold !== false } : null;
  SCHED = s.scheduler && typeof s.scheduler === "object" && s.scheduler.name ? { name: String(s.scheduler.name), platforms: new Set(arr(s.scheduler.platforms).length ? arr(s.scheduler.platforms) : CAPK), videoByPhone: s.scheduler.videoByPhone !== false, claude: !!s.scheduler.claude, steps: arr(s.scheduler.steps).map(String) } : null;
  const slots = arr(s.thSlots);
  if (slots.length === 7 && slots.every(l => Array.isArray(l))) TH_SLOTS = slots.map(l => l.map(okHM).filter(Boolean).sort());
  else {
    const per = Math.max(1, Math.ceil((RULES.th || 7) / 7)), pool = [BEST.th.time, "09:00", "15:30", "11:00", "17:00", "08:00", "19:00"];
    const day = [...new Set(pool)].slice(0, per).sort();
    TH_SLOTS = Array.from({ length: 7 }, () => [...day]);
  }
  CTYPES = arr(s.contentTypes).map(String).filter(Boolean); if (!CTYPES.length) CTYPES = [...DEF.contentTypes];
  THEMES = arr(s.themes).filter(t => t && t.id && t.name).map(t => ({ id: String(t.id), name: String(t.name), desc: String(t.desc || "") }));
  THEME_NAME = Object.fromEntries(THEMES.map(t => [t.id, t.name]));
  POST_START = /^\d{4}-\d{2}-\d{2}$/.test(s.postStart || "") ? s.postStart : "";
  DATA.teachAsOf = String(s.eventsAsOf || "");
  BNOTE = String(s.bestNote || "");
  FLAGS = [];
  for (const f of arr(s.flags)) { try { if (f && f.pattern && f.why) FLAGS.push({ re: new RegExp(String(f.pattern), "i"), why: String(f.why) }); } catch (e) {} }
  const kinds = s.threadKinds && typeof s.threadKinds === "object" ? s.threadKinds : null;
  TH_KIND = kinds && Object.keys(kinds).length ? { ...Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, String(v)])) }
    : { question: "Question", invite: EV ? cap1(EV.word) : "Invitation", inside: "Behind the scenes", take: "Hot take or poll", tip: "Tip", community: "Community", news: "News" };
  if (!TH_KIND.post) TH_KIND.post = "Threads post";
  TH_KIND_KEYS = Object.keys(TH_KIND).filter(k => k !== "post");
  const groups = arr(s.shotGroups).filter(g => g && g.name);
  const defGroups = [
    { name: EV ? `During ${an(EV.word)}` : "During an event", note: arr(s.photoRules)[0] || "Hands, objects and process. Check who's in frame before using faces." },
    { name: "On site, any day", note: "Vertical (9:16) video or photos, good daylight." },
    { name: "Out and about", note: "No other brands' logos in frame." },
    { name: "From you", note: "Facts and lists Claude needs. Type them in chat or into the shot." }];
  WHEN_ORDER = (groups.length ? groups : defGroups).map(g => String(g.name));
  WHEN_NOTE = Object.fromEntries((groups.length ? groups : defGroups).map(g => [String(g.name), String(g.note || "")]));
  const pre = NAME ? NAME + " · " : "";
  VIEWS = {
    chat: { h1: "Ask Claude", brand: pre + "Your planning partner", title: pre + "Ask Claude" },
    library: { h1: "Content Library", brand: pre + "Reels + posts", title: (NAME + " Content Library").trim() },
    calendar: { h1: "Content Calendar", brand: pre + "What posts when", title: (NAME + " Content Calendar").trim() },
    assets: { h1: "Asset Library", brand: pre + "Photos + video", title: (NAME + " Asset Library").trim() },
    ideas: { h1: "Ideas", brand: pre + "What to make next", title: pre + "Ideas" },
  };
  ROUTE = { ghl: SCHED ? SCHED.name : "Scheduler", phone: "Phone" };
  ROUTE_WHY = {
    ghl: SCHED ? `Goes out through ${SCHED.name}. Once it's Locked, it's in the week's ${SCHED.name} pack${SCHED.claude ? " and Claude sets it up there" : ""}.` : "",
    phone: "Posted from your phone. Once it's Locked, it's in the week's Phone pack.",
  };
  const rt = arr(s.ruleText).filter(r => Array.isArray(r) && r[0]);
  RULE_TEXT = rt.length ? rt.map(r => [String(r[0]), String(r[1] || "")]) : autoRules();
  LTABS = [...(PK.includes("th") ? [{ id: "threads", name: "Threads" }] : []), ...TYPES.map(t => ({ id: t.id, name: t.name }))];
  if (!LTABS.some(x => x.id === ltab)) ltab = LTABS[0].id;
  if (ltheme !== "all" && !THEME_NAME[ltheme]) ltheme = "all";
  applyLook(s);
}
// Posting rules in plain words, built from the numbers when settings.ruleText isn't given.
function autoRules() {
  const out = [], feedKs = PK.filter(k => k !== "st" && k !== "th" && !PDEFS[k].videoOnly), vids = PK.filter(k => PDEFS[k].videoOnly);
  if (feedKs.includes(LEAD) && RULES[LEAD]) out.push([`At least ${RULES[LEAD]} posts a week on ${listJoin(feedKs.map(k => PNAME[k]))}`,
    `${dayNames(BEST[LEAD].days)}${feedKs.length > 1 ? ", the same piece on each" : ""}.${EXTRA_DAYS.length ? ` These are minimums: ${dayNames(EXTRA_DAYS)} take extra posts when there's more to share.` : ""}`]);
  if (RULES.reels) out.push([`At least ${RULES.reels} of them ${RULES.reels === 1 ? "is a Reel" : "are Reels"}`, vids.length ? `Reels also go to ${listJoin(vids.map(k => PNAME[k]))}, which ${vids.length === 1 ? "takes" : "take"} video only.` : "Video usually reaches the most people."]);
  if (PK.includes("st") && RULES.st) out.push([EV && EV.reminders ? `${cap1(EV.word)} reminder Stories every ${dayNames(BEST.st.days)}` : `At least ${RULES.st} Stories a week`,
    `${EV && EV.reminders ? `That week's ${EV.plural} with link stickers, ${fmtTime(BEST.st.time)}. ` : ""}Post Stories from your phone so you can add stickers.`]);
  if (PK.includes("th") && RULES.th) out.push([`At least ${RULES.th} Threads posts a week`, `Pieces with Threads copy go at ${fmtTime(BEST.th.time)}; the Threads drafts in the Content Library fill the other slots.`]);
  if (EV) out.push([`${cap1(EV.plural)} post ${RULES.leadDays}+ days ahead`, `If that window has passed, a short-notice post can still go up as late as ${RULES.shortLead} days before. The calendar flags anything under ${RULES.leadDays}.`]);
  if (CTYPES.length > 1) out.push(["Spread the mix out", `${listJoin(CTYPES)} posts never run two posting days in a row.`]);
  if (HOST && HOST.hold) out.push([`${cap1(HOST.plural)} post only with ${an(evw())} coming up`, `${cap1(an(HOST.word))} post goes out before that ${HOST.word}'s next ${evw()}. ${cap1(HOST.plural)} with nothing on the schedule wait in Held.`]);
  return out;
}

// ----- look: palette and fonts from settings, with readable text on every brand color -----
const hexOk = c => /^#[0-9a-f]{6}$/i.test(String(c || ""));
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hexOf = a => "#" + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mixHex = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b); return hexOf(A.map((v, i) => v + (B[i] - v) * t)); };
const lumOf = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; const [r, g, b] = rgbOf(c).map(f); return .2126 * r + .7152 * g + .0722 * b; };
const contrastOf = (a, b) => { const x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const onOf = (bg, light, dark) => contrastOf(bg, dark) >= contrastOf(bg, light) ? dark : light;
function applyLook(s) {
  const P = s.palette && typeof s.palette === "object" ? s.palette : {};
  let light = hexOk(P.light) ? P.light : "#F6F3EB", dark = hexOk(P.dark) ? P.dark : "#2D2926";
  if (lumOf(light) < lumOf(dark)) [light, dark] = [dark, light];
  // Ten color slots feed the page's colored blocks. By default the brand's colors are sorted by lightness: the deeper ones go to
  // the big hero blocks (slots 4, 8) and the brighter ones to highlights (slots 1, 5), so text stays readable whatever the order.
  // palette.assign = "order" uses the colors exactly in the order given instead.
  const given = arr(P.colors).filter(hexOk), pool0 = given.length ? [...given] : [...DEFAULT_COLORS];
  let base;
  if (P.assign === "order" || !given.length) {
    base = [...pool0];
    for (let i = pool0.length; i < 10; i++) base.push(mixHex(pool0[i % pool0.length], Math.floor(i / pool0.length) % 2 ? dark : light, .38));
  } else {
    const sorted = [...pool0].sort((a, b) => lumOf(a) - lumOf(b)), nd = Math.ceil(sorted.length / 2);
    const deep = sorted.slice(0, nd), bright = sorted.slice(nd).length ? sorted.slice(nd) : sorted.slice(-1);
    base = new Array(10);
    const fill = (slots, pool) => slots.forEach((slot, i) => { const c = pool[i % pool.length], round = Math.floor(i / pool.length); base[slot - 1] = round ? mixHex(c, round % 2 ? light : dark, .32) : c; });
    fill([4, 8, 2, 7], deep); fill([1, 5, 3, 10, 9, 6], bright);
  }
  const sat = c => { const [r, g, b] = rgbOf(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
  const accent = hexOk(P.accent) ? P.accent : [...pool0].sort((a, b) => sat(b) - sat(a))[0];
  let root = `--b-light:${light};--b-dark:${dark};`;
  base.slice(0, 10).forEach((c, i) => { root += `--b-${i + 1}:${c};--b-${i + 1}-on:${onOf(c, light, dark)};--b-${i + 1}-soft:${mixHex(c, "#ffffff", .78)};`; });
  const L = `--bg:${light};--surface:${mixHex(light, "#ffffff", .6)};--ink:${dark};--muted:${mixHex(dark, light, .32)};--line:${mixHex(dark, light, .84)};--tile:${mixHex(dark, light, .87)};--soft:${mixHex(dark, light, .91)};--coral:${accent};--coral-ink:${onOf(accent, light, dark)};`;
  const dBg = mixHex(dark, "#000000", .15), acD = mixHex(accent, "#ffffff", .15);
  const D = `--bg:${dBg};--surface:${mixHex(dark, light, .035)};--ink:${light};--muted:${mixHex(light, dark, .28)};--line:${mixHex(dark, light, .14)};--tile:${mixHex(dark, light, .09)};--soft:${mixHex(dark, light, .09)};--coral:${acD};--coral-ink:${onOf(acD, light, dBg)};`;
  const F = s.fonts && typeof s.fonts === "object" ? s.fonts : {};
  const fam = v => String(v || "").replace(/["\\<>;{}]/g, "").trim();
  let fonts = "", face = "";
  if (F.displayAsset && /^[0-9a-f]{32}$/.test(String(F.displayAsset))) {
    face = `@font-face { font-family: "BrandDisplay"; src: url(/_blob/${F.displayAsset}); font-display: swap; }`;
    fonts += `--display:"BrandDisplay",${fam(F.display) ? `"${fam(F.display)}",` : ""}Georgia,serif;`;
  } else if (fam(F.display)) fonts += `--display:"${fam(F.display)}",Georgia,serif;`;
  if (fam(F.body)) fonts += `--ui:"${fam(F.body)}",system-ui,-apple-system,"Segoe UI",sans-serif;`;
  if (Number(F.displayWeight)) fonts += `--display-w:${Number(F.displayWeight)};`;
  const css = `${face}\n:root{${root}${L}${fonts}}\n@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${D}color-scheme:dark;}}\n:root[data-theme="dark"]{${D}color-scheme:dark;}`;
  let st = document.getElementById("ss-look"); if (!st) { st = document.createElement("style"); st.id = "ss-look"; }
  document.body.append(st); st.textContent = css;
  const g = String(F.google || "").trim();
  if (g && /^[A-Za-z0-9:;@,+=&._-]+$/.test(g)) {
    const href = "https://fonts.googleapis.com/css2?" + g + (/display=/.test(g) ? "" : "&display=swap");
    let ln = document.getElementById("ss-fonts");
    if (!ln) { ln = document.createElement("link"); ln.id = "ss-fonts"; ln.rel = "stylesheet"; document.head.append(ln); }
    if (ln.getAttribute("href") !== href) ln.setAttribute("href", href);
  }
  document.body.classList.toggle("no-checker", !!(s.style && s.style.checker === false));
  document.body.classList.toggle("no-shapes", !!(s.style && s.style.shapes === false));
}

const caps = {};              // id -> saved captions doc
const byId = {};             // id -> piece (built from pieces/* in the db)
const state = {};           // id -> { status, note, claude, claudeAt, updatedAt }
let db = null, dl = null, filter = "all", canWrite = true;
const writes = {};          // per-document write chain (one write at a time)
const capOf = (id, k) => { const d = caps[id]; if (d && typeof d[k] === "string") return d[k]; return (CAPS0[id] || {})[k] || ""; };
const claudeOf = (id, k) => { const d = caps[id]; if (d && d.claude && typeof d.claude[k] === "string") return d.claude[k]; return (CAPS0[id] || {})[k] || ""; };
const capSt = (id, k) => (caps[id] && caps[id].st && caps[id].st[k]) || "review";
const isStory = id => byId[id] && byId[id].kind === "story";
const isArchived = id => !!(state[id] && state[id].archived);
const neededCaps = id => isStory(id) ? [] : CAPK.filter(k => (!OPTIONAL.has(k) || capOf(id, k).trim()) && (!PDEFS[k].videoOnly || isVideo(byId[id])));
const isReady = id => (state[id] && state[id].status) === "final" && neededCaps(id).every(k => capSt(id, k) === "final");
const LAB = { review: "TO REVIEW", draft: "DRAFT", final: "FINAL" };
function captionsText(id) {
  const it = byId[id];
  const parts = [`${it.title} — ${it.sub}`, ""];
  for (const p of PLAT) {
    const v = capOf(id, p.k).trim(); if (!v) continue;
    if (p.k !== "alt" && !relevant(id, p.k)) continue;
    parts.push(p.k === "alt" ? p.name.toUpperCase() : `${p.name.toUpperCase()} (${LAB[capSt(id, p.k)]})`, v, "");
  }
  return parts.join("\n");
}
const els = {};

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const statusOf = id => (state[id] && state[id].status) || "review";
const LABEL = { review: "TO REVIEW", draft: "DRAFT", final: "FINAL" };

function kickFor(it) {
  if (it.kind === "reel") return `Reel · 9:16${it.dur ? ` · ${it.dur}s` : ""}`;
  if (it.kind === "wide") return `Video · 16:9${it.dur ? ` · ${it.dur}s` : ""}`;
  if (it.kind === "carousel") return `Carousel · 4:5 · ${it.slides.length} slides`;
  if (it.kind === "story") return `Story · 9:16 · ${it.slides.length} frame${it.slides.length === 1 ? "" : "s"}`;
  return "Post · 4:5";
}
function dlLabel(it) {
  if (it.kind === "carousel") return "Download slides (.zip)";
  if (it.kind === "story") return it.slides.length > 1 ? "Download frames (.zip)" : "Download frame";
  if (it.kind === "post") return "Download image";
  return "Download video";
}

const XICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
function xbtn(label, fn) { const b = h("button", { class: "xbtn", type: "button", "aria-label": label, title: "Open a larger preview" }); b.innerHTML = XICON; b.addEventListener("click", e => { e.stopPropagation(); fn(b); }); return b; }
function frameFor(it) {
  if (it.kind === "reel" || it.kind === "wide") {
    const v = h("video", { controls: true, playsinline: true, muted: true, preload: it.poster ? "none" : "metadata", poster: it.poster, src: it.file, "aria-label": it.title });
    return h("div", { class: "frame " + (it.kind === "wide" ? "r169" : "r916") }, v, xbtn("Larger preview of " + it.title, b => { v.pause(); openItemPreview(it, 0, b); }));
  }
  if (it.kind === "post") {
    const img = h("img", { class: "zoom", src: it.preview, alt: it.title + " post", loading: "lazy" });
    img.addEventListener("click", () => openItemPreview(it, 0, img));
    return h("div", { class: "frame r45" }, img, xbtn("Larger preview of " + it.title, b => openItemPreview(it, 0, b)));
  }
  // carousel
  const track = h("div", { class: "track", tabindex: "0", "aria-label": it.title + " slides" },
    it.slides.map((s, i) => { const im = h("img", { src: s.preview, alt: `${it.title}, slide ${i + 1}`, loading: "lazy" }); im.addEventListener("click", () => openItemPreview(it, i, im)); return im; }));
  const count = h("div", { class: "ccount", text: `1 / ${it.slides.length}` });
  const prev = h("button", { class: "cnav prev", type: "button", "aria-label": "Previous slide", disabled: true, text: "‹" });
  const next = h("button", { class: "cnav next", type: "button", "aria-label": "Next slide", text: "›" });
  const idx = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
  const sync = () => { const i = idx(); count.textContent = `${i + 1} / ${it.slides.length}`; prev.disabled = i === 0; next.disabled = i >= it.slides.length - 1; };
  prev.addEventListener("click", () => track.scrollTo({ left: (idx() - 1) * track.clientWidth, behavior: "smooth" }));
  next.addEventListener("click", () => track.scrollTo({ left: (idx() + 1) * track.clientWidth, behavior: "smooth" }));
  track.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
  return h("div", { class: "frame " + (it.kind === "story" ? "r916" : "r45") }, track, prev, next, count, xbtn("Larger preview of " + it.title, b => openItemPreview(it, idx(), b)));
}

// ---------- lightbox (used by all three tabs) ----------
const lb = { open: false, slides: [], i: 0, title: "", opener: null };
function itemMedia(it) {
  if (it.kind === "reel" || it.kind === "wide") return [{ type: "video", src: it.file, poster: it.poster }];
  if (it.kind === "post") return [{ type: "img", src: it.file, alt: it.title }];
  return it.slides.map((s, i) => ({ type: "img", src: s.file, alt: `${it.title}, slide ${i + 1}` }));
}
function openItemPreview(it, i, opener) { openLightbox(itemMedia(it), it.title, i, opener); }
function openLightbox(media, title, start, opener) {
  if (!media || !media.length) return;
  lb.slides = media; lb.i = Math.min(Math.max(start || 0, 0), media.length - 1); lb.title = title || ""; lb.opener = opener || document.activeElement; lb.open = true;
  $("#lb").hidden = false; document.body.style.overflow = "hidden";
  renderLb(); $("#lb-close").focus();
}
window.msLightbox = openLightbox;
function renderLb() {
  const s = lb.slides[lb.i];
  const el = s.type === "video"
    ? h("video", { src: s.src, poster: s.poster || null, controls: true, playsinline: true, autoplay: true, muted: true, loop: true, "aria-label": lb.title })
    : h("img", { src: s.src, alt: s.alt || lb.title });
  $("#lb-media").replaceChildren(el);
  $("#lb-title").textContent = lb.title;
  const multi = lb.slides.length > 1;
  $("#lb-prev").hidden = $("#lb-next").hidden = !multi;
  $("#lb-count").textContent = multi ? `${lb.i + 1} / ${lb.slides.length}` : "";
  $("#lb-prev").disabled = lb.i === 0; $("#lb-next").disabled = lb.i >= lb.slides.length - 1;
}
function lbGo(d) { const n = lb.i + d; if (n < 0 || n >= lb.slides.length) return; lb.i = n; renderLb(); }
function closeLightbox() {
  lb.open = false; $("#lb").hidden = true; $("#lb-media").replaceChildren();
  const under = (typeof md !== "undefined" && md.open) || !$("#scrim").hidden || (document.getElementById("a-scrim") && !document.getElementById("a-scrim").hidden);
  document.body.style.overflow = under ? "hidden" : "";
  const o = lb.opener; lb.opener = null; if (o && document.contains(o)) o.focus();
}
function wireLightbox() {
  $("#lb-close").addEventListener("click", closeLightbox);
  $("#lb-prev").addEventListener("click", () => lbGo(-1));
  $("#lb-next").addEventListener("click", () => lbGo(1));
  $("#lb").addEventListener("click", e => { if (e.target.id === "lb-stage" || e.target.id === "lb-media") closeLightbox(); });
  window.addEventListener("keydown", e => {
    if (!lb.open) return;
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeLightbox(); }
    else if (e.key === "ArrowLeft") { e.stopPropagation(); lbGo(-1); }
    else if (e.key === "ArrowRight") { e.stopPropagation(); lbGo(1); }
    else if (e.key === "Tab") {
      const f = [...$("#lb").querySelectorAll("button:not([hidden]):not([disabled]), video")];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  }, true);
  let x0 = null;
  $("#lb-stage").addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  $("#lb-stage").addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) lbGo(dx < 0 ? 1 : -1); });
}

function buildCard(it) {
  const badge = h("div", { class: "badge review", text: LABEL.review });
  const frame = frameFor(it); frame.prepend(badge);
  const segD = h("button", { type: "button", role: "radio", "data-s": "draft", "aria-checked": "false", text: "DRAFT" });
  const segF = h("button", { type: "button", role: "radio", "data-s": "final", "aria-checked": "false", text: "FINAL" });
  const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": "Status for " + it.title }, segD, segF);
  [segD, segF].forEach(b => b.addEventListener("click", () => {
    const s = b.dataset.s; setStatus(it.id, statusOf(it.id) === s ? "review" : s);
  }));
  const saved = h("span", { class: "saved" });
  const ta = h("textarea", { id: "note-" + it.id, placeholder: "What should change?", rows: "2" });
  let t = null;
  ta.addEventListener("input", () => { saved.textContent = ""; clearTimeout(t); t = setTimeout(() => saveNote(it.id, ta.value, saved), 1100); });
  ta.addEventListener("blur", () => { clearTimeout(t); if ((state[it.id]?.note || "") !== ta.value) saveNote(it.id, ta.value, saved); });
  const notes = h("div", { class: "notes" }, h("label", { for: "note-" + it.id }, h("span", { text: "Notes for Claude" }), saved), ta);
  const claude = h("p", { class: "claude", hidden: true });
  const dlb = h("button", { class: "btn", type: "button", disabled: true, text: dlLabel(it) });
  dlb.addEventListener("click", () => downloadItem(it, dlb));
  const hint = h("span", { class: "hint", text: "Mark Final to download" });
  const chips = Object.fromEntries(PLAT.filter(p => p.k !== "alt" && (!p.videoOnly || isVideo(it))).map(p => [p.k, h("span", { class: "capchip", text: p.chip })]));
  const capBtn = h("button", { class: "btn ghost small", type: "button", text: it.kind === "story" ? "Alt text" : "Captions" });
  capBtn.addEventListener("click", () => openDrawer(it.id, capBtn));
  const readyEl = h("span", { class: "ready", text: "READY TO POST", hidden: true });
  const caprow = h("div", { class: "caprow" }, it.kind === "story" ? h("span", { class: "muted", style: "font-size:12.5px;max-width:30ch", text: "Posted from your phone, so no captions. Alt text is in here." }) : h("div", { class: "capchips", "aria-label": "Captions" }, Object.values(chips)), capBtn);
  const ubadge = h("div", { class: "ubadge", text: "USED", hidden: true });
  const abadge = h("div", { class: "abadge", text: "ARCHIVED", hidden: true });
  const archBtn = h("button", { class: "linkbtn", type: "button", text: "Archive for later" });
  archBtn.addEventListener("click", () => setArchived(it.id, !isArchived(it.id)));
  frame.append(ubadge, abadge);
  const useline = h("div", { class: "useline", hidden: true });
  const planBtn = h("button", { class: "btn small", type: "button", text: "Plan", hidden: true });
  planBtn.addEventListener("click", () => {
    const nx = nextPlanned(it.id);
    if (nx && !isUsed(it.id)) openGroup(it.id, nx.date, planBtn); else openPlanner(it.id, null, planBtn);
  });
  const holdEl = h("span", { class: "held", hidden: true });
  const planrow = h("div", { class: "planrow" }, readyEl, holdEl, planBtn);
  const body = h("div", { class: "body" },
    h("div", { class: "kick", text: kickFor(it) + (THEME_NAME[it.theme] ? " · " + THEME_NAME[it.theme] : "") }),
    h("h3", { text: it.title }),
    h("p", { class: "sub", text: it.sub }),
    it.heads ? h("p", { class: "warn", text: it.heads }) : null,
    seg, notes, claude, h("div", { class: "dlrow" }, dlb, hint), caprow, useline, planrow, h("div", { class: "archrow" }, archBtn));
  const card = h("article", { class: "card" + (it.kind === "wide" ? " wide" : ""), "data-id": it.id, "data-s": "review" }, frame, body);
  els[it.id] = { card, badge, segD, segF, ta, claude, dlb, hint, chips, readyEl, holdEl, ubadge, abadge, archBtn, useline, planBtn, planrow };
  return card;
}

// ----- library: one tab per content type, then a status filter and an optional theme -----
const TYPES = [
  { id: "t-video", name: "Reels + video", desc: "Vertical Reels and horizontal video.", has: it => it.kind === "reel" || it.kind === "wide" },
  { id: "t-post", name: "Static posts", desc: "Single 4:5 graphics.", has: it => it.kind === "post" },
  { id: "t-carousel", name: "Carousels", desc: "4:5 slides. Swipe or use the arrows to see every slide.", has: it => it.kind === "carousel" },
  { id: "t-story", name: "Stories", desc: "9:16 frames, posted from your phone so you can add link, poll, question or countdown stickers.", has: it => it.kind === "story" },
];
// Tabs: Threads (when the brand is on Threads), Reels + video, Static posts, Carousels, Stories.
let LTABS = [{ id: "threads", name: "Threads" }, ...TYPES.map(t => ({ id: t.id, name: t.name }))];
const SFILTERS = [["all", "All"], ["review", "To review"], ["draft", "Draft"], ["final", "Final"], ["ready", "Ready to post"], ["planned", "On calendar"], ["used", "Scheduled or posted"], ["archived", "Archived"]];
let ltab = "threads", ltheme = "all";
try {
  const a = localStorage.getItem("ss-ltab"); if (a) ltab = a;   // checked against the brand's tabs once settings load
  const f = localStorage.getItem("ss-lfilter"); if (SFILTERS.some(x => x[0] === f)) filter = f;
  const th = localStorage.getItem("ss-ltheme"); if (th) ltheme = th;
} catch (e) {}
// Does a piece show under the current status filter?
const itemShows = it => filter === "archived" ? isArchived(it.id)
  : isArchived(it.id) ? false
  : filter === "all" ? true
  : filter === "ready" ? isAvailable(it.id)
  : filter === "planned" ? isPlanned(it.id) && !isUsed(it.id)
  : filter === "used" ? isUsed(it.id)
  : statusOf(it.id) === filter;
const themeOk = it => ltheme === "all" || it.theme === ltheme;
let layoutSig = "";
function layout(force) {
  const plan = TYPES.map(sd => ({ sd, items: DATA.items.filter(sd.has) }));
  const sig = plan.map(x => x.items.map(it => it.id).join(",")).join("|");
  if (!force && sig === layoutSig) return false;
  layoutSig = sig;
  const root = $("#groups");
  root.replaceChildren();
  els.secs = plan.map(({ sd, items }) => {
    const gdl = h("button", { class: "btn ghost", type: "button", disabled: true, text: "Download finals" });
    gdl.addEventListener("click", () => downloadZip(items.filter(it => statusOf(it.id) === "final" && !isArchived(it.id) && themeOk(it)), `${SLUG}-${sd.id}-finals.zip`, gdl, false));
    const gc = h("span", { class: "gcount" });
    const empty = h("p", { class: "lempty", hidden: true });
    const sec = h("section", { class: "group", id: sd.id, "aria-labelledby": "h-" + sd.id },
      h("div", { class: "ghead" },
        h("div", { class: "grow" }, h("h2", { id: "h-" + sd.id, text: sd.name }), h("p", { text: sd.desc })), gc, gdl),
      h("div", { class: "grid" }, items.map(it => els[it.id].card)), empty);
    root.append(sec);
    return { id: sd.id, sec, gdl, gc, items, empty };
  });
  return true;
}
// Counts for a tab under a given status filter (pieces, or Threads drafts).
function tabCount(tab, f) {
  if (tab === "threads") return thFiltered(f).length;
  const sd = TYPES.find(x => x.id === tab); if (!sd) return 0;
  const keep = filter; filter = f;
  const n = DATA.items.filter(it => sd.has(it) && themeOk(it) && itemShows(it)).length;
  filter = keep; return n;
}
function setLtab(id, focus) {
  ltab = id; try { localStorage.setItem("ss-ltab", id); } catch (e) {}
  applyFilter(); updateSummary();
  if (focus) { const b = $(`#ltabs [data-t="${id}"]`); if (b) b.focus(); }
}
function updateTabs() {
  const box = $("#ltabs"); if (!box) return;
  if (!box.children.length) {
    $("#sfilter").replaceChildren();
    for (const x of LTABS) {
      const b = h("button", { class: "ltab", type: "button", role: "tab", "data-t": x.id, id: "lt-" + x.id }, h("span", { class: "ln", text: x.name }), h("span", { class: "lm" }));
      b.addEventListener("click", () => setLtab(x.id));
      box.append(b);
    }
    if (!box.dataset.wired) {
      box.dataset.wired = "1";
      box.addEventListener("keydown", e => {
        const i = LTABS.findIndex(x => x.id === ltab), n = LTABS.length;
        const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
        if (j >= 0) { e.preventDefault(); setLtab(LTABS[j].id, true); }
      });
    }
    const sf = $("#sfilter");
    for (const [f, label] of SFILTERS) {
      const b = h("button", { class: "chip", type: "button", role: "radio", "data-f": f }, label, h("span", { class: "n" }));
      b.addEventListener("click", () => { filter = f; try { localStorage.setItem("ss-lfilter", f); } catch (e) {} applyFilter(); updateSummary(); });
      sf.append(b);
    }
    const sel = $("#themesel");
    sel.replaceChildren(h("option", { value: "all", text: "All themes" }), ...THEMES.map(x => h("option", { value: x.id, text: x.name })));
    sel.value = ltheme;
    if (!sel.dataset.wired) { sel.dataset.wired = "1"; sel.addEventListener("change", () => { ltheme = sel.value; try { localStorage.setItem("ss-ltheme", ltheme); } catch (e) {} applyFilter(); updateSummary(); }); }
  }
  for (const b of box.children) {
    const id = b.dataset.t, on = id === ltab, all = tabCount(id, "all"), rv = tabCount(id, "review");
    b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
    b.querySelector(".lm").replaceChildren(`${all}`, rv ? h("b", { text: ` · ${rv} to review` }) : "");
  }
  for (const b of $("#sfilter").children) {
    const f = b.dataset.f, n = tabCount(ltab, f);
    b.setAttribute("aria-checked", String(f === filter));
    b.querySelector(".n").textContent = String(n);
    b.hidden = !n && f !== filter && f !== "all";
  }
  $("#themewrap").hidden = ltab === "threads" || !THEMES.length;
}
function build() {
  DATA.items.forEach(buildCard);
  layout(true);
  $("#dl-all").addEventListener("click", e => downloadZip(DATA.items.filter(it => statusOf(it.id) === "final" && !isArchived(it.id)), `${SLUG}-all-finals.zip`, e.currentTarget, true));
}

function updateCard(id) {
  const e = els[id], s = statusOf(id), st = state[id] || {};
  e.card.dataset.s = s;
  e.badge.className = "badge " + s; e.badge.textContent = LABEL[s];
  e.segD.setAttribute("aria-checked", String(s === "draft"));
  e.segF.setAttribute("aria-checked", String(s === "final"));
  e.segD.disabled = e.segF.disabled = !canWrite; e.ta.disabled = !canWrite;
  if (document.activeElement !== e.ta) e.ta.value = st.note || "";
  if (st.claude) { e.claude.hidden = false; e.claude.replaceChildren(h("b", { text: "Claude: " }), st.claude); } else e.claude.hidden = true;
  for (const [k, chip] of Object.entries(e.chips)) {
    const v = capOf(id, k).trim();
    const cs = capSt(id, k);
    chip.classList.toggle("on", !!v);
    chip.classList.toggle("st-final", !!v && cs === "final");
    chip.classList.toggle("st-draft", !!v && cs === "draft");
    chip.title = v ? `${LAB[cs].toLowerCase()}${v !== claudeOf(id, k).trim() ? ", edited" : ""}` : "none yet";
  }
  e.readyEl.hidden = !isAvailable(id);
  const ok = s === "final" && !!dl;
  e.dlb.disabled = !ok; e.dlb.hidden = !dl; e.hint.hidden = s === "final" || !dl;
  // calendar usage
  const used = usedEntries(id), planned = plannedEntries(id);
  e.ubadge.hidden = !used.length;
  if (used.length) e.useline.replaceChildren(h("span", { class: "utag used", text: "USED" }), usageText(used));
  else if (planned.length) e.useline.replaceChildren(h("span", { class: "utag planned", text: "ON CALENDAR" }), usageText(planned));
  e.useline.hidden = !used.length && !planned.length;
  const canPlan = !!db && canWrite;
  e.planBtn.textContent = used.length ? "Plan again" : planned.length ? "Open in calendar" : "Plan";
  const arch = isArchived(id);
  e.abadge.hidden = !arch; e.card.classList.toggle("archived", arch);
  e.archBtn.textContent = arch ? "Restore from archive" : "Archive for later"; e.archBtn.disabled = !canWrite; e.archBtn.hidden = !db;
  const holding = !arch && isHeld(id) && !used.length && !planned.length;
  e.holdEl.hidden = !holding;
  if (holding) e.holdEl.replaceChildren(h("b", { text: "ON HOLD" }), ` · no ${evw()} coming up for ${shortName(instrOf(id))}`);
  e.planBtn.hidden = !canPlan || holding || arch || !(isReady(id) || used.length || planned.length);
  e.planrow.hidden = e.readyEl.hidden && e.planBtn.hidden && e.holdEl.hidden;
}

function updateSummary() {
  const n = { review: 0, draft: 0, final: 0 };
  const live = DATA.items.filter(it => !isArchived(it.id));
  live.forEach(it => n[statusOf(it.id)]++);
  const tot = live.length || 1;
  $("#bar-f").style.width = (100 * n.final / tot) + "%";
  $("#bar-d").style.width = (100 * n.draft / tot) + "%";
  $("#counts").replaceChildren(
    h("span", {}, h("i", { class: "dot", style: "background:var(--final)" }), h("b", { text: n.final }), " final"),
    h("span", {}, h("i", { class: "dot", style: "background:var(--draft)" }), h("b", { text: n.draft }), " draft"),
    h("span", {}, h("i", { class: "dot", style: "background:var(--review)" }), h("b", { text: n.review }), " to review"));
  const nReady = DATA.items.filter(it => isAvailable(it.id)).length;
  const nPlanned = live.filter(it => isPlanned(it.id) && !isUsed(it.id)).length;
  const nUsed = live.filter(it => isUsed(it.id)).length;
  $("#counts").append(h("span", {}, h("b", { text: nReady }), " ready to post"), h("span", {}, h("b", { text: nPlanned }), " on calendar"), h("span", {}, h("b", { text: nUsed }), " used"));
  $("#dl-all").disabled = !dl || n.final === 0; $("#dl-all").hidden = !dl || cv.view !== "library";
  $("#dr-txt").hidden = !dl;
  for (const e of els.secs || []) {
    const lv = e.items.filter(it => themeOk(it) && (filter === "archived" ? isArchived(it.id) : !isArchived(it.id))), f = lv.filter(it => statusOf(it.id) === "final").length;
    e.gc.textContent = `${f} of ${lv.length} final`;
    e.gdl.disabled = !dl || f === 0; e.gdl.hidden = !dl;
  }
}

function applyFilter() {
  for (const e of els.secs || []) {
    let shown = 0;
    for (const it of e.items) {
      const vis = e.id === ltab && themeOk(it) && itemShows(it);
      els[it.id].card.hidden = !vis; if (vis) shown++;
    }
    e.sec.hidden = e.id !== ltab;
    e.empty.hidden = shown > 0;
    if (!shown) e.empty.textContent = !e.items.length ? `No ${TYPES.find(t => t.id === e.id).name.toLowerCase()} yet. When Claude makes some in ${handoffWhere()}, they land here for you to review.`
      : `Nothing ${filter === "all" ? "here" : "under " + SFILTERS.find(x => x[0] === filter)[1]}${ltheme === "all" ? "" : " in " + THEME_NAME[ltheme]} yet.`;
  }
  renderThreads();
}
function refreshAll() { DATA.items.forEach(it => updateCard(it.id)); updateSummary(); applyFilter(); }

let toastT = null;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200); }
function banner(msg) { const b = $("#banner"); b.textContent = msg; b.hidden = !msg; }

function write(id, body, col = "items") {
  if (!db) return Promise.resolve();
  const key = col + "/" + id;
  const run = () => db.collection(col).doc(id).set(body);
  writes[key] = (writes[key] || Promise.resolve()).catch(() => {}).then(run);
  return writes[key];
}
function remove(id, col) {
  if (!db) return Promise.resolve();
  const key = col + "/" + id;
  const run = () => db.collection(col).doc(id).delete();
  writes[key] = (writes[key] || Promise.resolve()).catch(() => {}).then(run);
  return writes[key];
}
async function setStatus(id, s) {
  if (!canWrite) return;
  const next = { ...(state[id] || {}), status: s, updatedAt: new Date().toISOString() };
  state[id] = next; updateCard(id); updateSummary(); applyFilter(); syncDrawerStatus();
  try { await write(id, next); }
  catch (e) { onWriteError(e); }
}
async function setArchived(id, on) {
  if (!canWrite) return;
  const next = { ...(state[id] || {}), status: statusOf(id), archived: on, updatedAt: new Date().toISOString() };
  if (on) next.archivedAt = next.updatedAt; else delete next.archivedAt;
  state[id] = next;
  const drop = on ? plannedEntries(id).map(e => e.key) : [];
  if (drop.length) dropEntries(drop); else { refreshAll(); if (cv.view === "calendar") renderCal(); }
  toast(on ? (drop.length ? `Archived. Took ${drop.length} planned post${drop.length === 1 ? "" : "s"} off the calendar.` : "Archived. Find it under the Archived filter.") : "Back in the library.");
  try { await write(id, next); } catch (e) { onWriteError(e); }
}
async function saveNote(id, note, savedEl) {
  if (!canWrite) return;
  const next = { ...(state[id] || {}), note, status: statusOf(id), updatedAt: new Date().toISOString() };
  state[id] = next;
  savedEl.textContent = db ? "Saving…" : "";
  try { await write(id, next); savedEl.textContent = db ? "Saved" : ""; }
  catch (e) { savedEl.textContent = ""; onWriteError(e); }
}
function onWriteError(e) {
  const code = e && e.code;
  if (code === "permission_denied" || code === "not_granted") { canWrite = false; refreshAll(); banner(`You can view this library but not change it. Ask ${OWNER || "the owner"} for edit access to mark pieces.`); }
  else toast("That change didn't save. Try again in a moment.");
}

async function blobOf(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("fetch " + r.status);
  return r.blob();
}
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const ext = p => { const m = /\.([a-z0-9]{2,4})$/i.exec(String(p || "")); return m ? m[1].toLowerCase() : ""; };
const extOf = (b, p) => EXT[String((b && b.type) || "").split(";")[0]] || ext(p) || "bin";
async function downloadItem(it, btn) {
  if (!dl) return;
  const label = btn.textContent;
  btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), " Preparing…");
  try {
    let data, filename;
    if (it.slides && it.slides.length === 1) { data = await blobOf(it.slides[0].file); filename = `${SLUG}-${it.id}.${extOf(data, it.slides[0].file)}`; }
    else if (it.slides) {
      const zip = new JSZip();
      for (let i = 0; i < it.slides.length; i++) { const b = await blobOf(it.slides[i].file); zip.file(`${it.id}-${String(i + 1).padStart(2, "0")}.${extOf(b, it.slides[i].file)}`, b); }
      zip.file(`${it.id}-captions.txt`, captionsText(it.id));
      data = await zip.generateAsync({ type: "blob", compression: "STORE" });
      filename = `${SLUG}-${it.id}-slides.zip`;
    } else { data = await blobOf(it.file); filename = `${SLUG}-${it.id}.${extOf(data, it.file)}`; }
    await dl.save({ filename, data }); toast("Downloaded " + filename);
  } catch (e) { reportDl(e); }
  finally { btn.textContent = label; btn.disabled = statusOf(it.id) !== "final"; }
}
async function downloadZip(items, filename, btn, byGroup) {
  if (!dl || !items.length) return;
  const label = btn.textContent;
  btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), ` Zipping ${items.length}…`);
  try {
    const zip = new JSZip();
    for (const it of items) {
      const dir = byGroup ? zip.folder((TYPES.find(t => t.has(it)) || { name: "Other" }).name) : zip;
      if (it.slides) {
        const sub = dir.folder(it.id);
        for (let i = 0; i < it.slides.length; i++) { const b = await blobOf(it.slides[i].file); sub.file(`${it.id}-${String(i + 1).padStart(2, "0")}.${extOf(b, it.slides[i].file)}`, b); }
        sub.file(`${it.id}-captions.txt`, captionsText(it.id));
      } else {
        const b = await blobOf(it.file);
        dir.file(`${SLUG}-${it.id}.${extOf(b, it.file)}`, b);
        dir.file(`${SLUG}-${it.id}-captions.txt`, captionsText(it.id));
      }
    }
    const data = await zip.generateAsync({ type: "blob", compression: "STORE" });
    await dl.save({ filename, data }); toast("Downloaded " + filename);
  } catch (e) { reportDl(e); }
  finally { btn.textContent = label; updateSummary(); }
}
function reportDl(e) {
  const code = e && e.code;
  if (code === "declined") toast("Download cancelled");
  else if (code === "rate_limited") toast("A download is already waiting for you to confirm.");
  else if (code === "too_large") toast("That file is too big to save here. Try downloading one piece at a time.");
  else toast("That download didn't work. Try again.");
}

// ---------- captions drawer ----------
const dr = { id: null, k: "ig", timer: null, opener: null };
const $ta = () => $("#cap-text");
function thumbFor(it) {
  const src = thumbSrc(it);
  const hgt = it.kind === "reel" || it.kind === "story" ? 114 : it.kind === "wide" ? 36 : 80;
  const box = $("#dr-thumb"); box.style.height = hgt + "px";
  const im = h("img", { src, alt: "Larger preview of " + it.title, role: "button", tabindex: "0" });
  im.addEventListener("click", () => openItemPreview(it, 0, im));
  im.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openItemPreview(it, 0, im); } });
  box.replaceChildren(im);
}
function buildTabs() {
  const tabs = $("#dr-tabs");
  tabs.replaceChildren(...PLAT.map(p => {
    const b = h("button", { class: "tab", type: "button", role: "tab", id: "tab-" + p.k, "aria-controls": "dr-panel", "aria-selected": "false" }, p.name);
    b.addEventListener("click", () => showTab(p.k));
    return b;
  }));
  if (tabs.dataset.wired) return;
  tabs.dataset.wired = "1";
  tabs.addEventListener("keydown", e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = PLAT.findIndex(p => p.k === dr.k), n = PLAT.length;
    const k = PLAT[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n].k; showTab(k); $("#tab-" + k).focus();
  });
}
function markTabs() {
  for (const p of PLAT) {
    const b = $("#tab-" + p.k); if (!b || !dr.id) continue;
    b.setAttribute("aria-selected", String(p.k === dr.k));
    b.tabIndex = p.k === dr.k ? 0 : -1;
    const edited = capOf(dr.id, p.k).trim() !== claudeOf(dr.id, p.k).trim();
    b.replaceChildren(p.name);
    if (p.k !== "alt" && capOf(dr.id, p.k).trim()) {
      const cs = capSt(dr.id, p.k);
      if (cs !== "review") b.append(h("span", { class: "sdot", title: LAB[cs], style: `background:var(--${cs})` }));
    }
    if (edited) b.append(h("span", { class: "mark", title: "Edited", text: "•" }));
  }
}
function meter() {
  const p = PLAT.find(x => x.k === dr.k), v = $ta().value;
  const tags = (v.match(/#[\w]+/g) || []).length;
  const m = $("#dr-meter");
  let txt = `${v.length.toLocaleString()} characters`;
  if (p.limit < 10000) txt += ` of ${p.limit.toLocaleString()}`;
  if (p.tags) txt += ` · ${tags} hashtag${tags === 1 ? "" : "s"}`;
  if (p.k === "alt") txt += " · aim for 100–150";
  m.textContent = txt; m.classList.toggle("over", v.length > p.limit);
  $("#dr-restore").disabled = !canWrite || v.trim() === claudeOf(dr.id, dr.k).trim();
}
function showTab(k) {
  flushCap();
  dr.k = k;
  const p = PLAT.find(x => x.k === k), ta = $ta();
  ta.value = capOf(dr.id, k);
  ta.placeholder = OPTIONAL.has(k) ? `No ${p.name} post planned for this piece. Write one here to add it.` : "";
  ta.readOnly = !canWrite;
  $("#dr-tip").textContent = p.tip;
  $("#dr-saved").textContent = "";
  markTabs(); meter(); syncCapStatus();
}
function syncCapStatus() {
  if (!dr.id) return;
  const show = dr.k !== "alt";
  $("#dr-capst").hidden = !show;
  if (!show) return;
  const cs = capSt(dr.id, dr.k), empty = !capOf(dr.id, dr.k).trim();
  $("#dr-caplabel").textContent = `This ${PLAT.find(p => p.k === dr.k).name} caption`;
  $("#dc-draft").setAttribute("aria-checked", String(cs === "draft"));
  $("#dc-final").setAttribute("aria-checked", String(cs === "final"));
  $("#dc-draft").disabled = $("#dc-final").disabled = !canWrite || empty;
}
function syncDrawerStatus() {
  if (!dr.id) return;
  const s = statusOf(dr.id);
  const it = byId[dr.id];
  $("#dr-mlabel").textContent = { reel: "Reel", wide: "Video", post: "Graphic", carousel: "Slides", story: "Frames" }[it.kind];
  $("#dr-draft").setAttribute("aria-checked", String(s === "draft"));
  $("#dr-final").setAttribute("aria-checked", String(s === "final"));
  $("#dr-draft").disabled = $("#dr-final").disabled = !canWrite;
}
function openDrawer(id, opener) {
  const it = byId[id];
  dr.id = id; dr.opener = opener; dr.k = it.kind === "story" ? "alt" : (CAPK.find(k => relevant(id, k)) || "alt");
  $("#dr-kick").textContent = kickFor(it);
  $("#dr-title").textContent = it.title;
  $("#dr-sub").textContent = it.sub;
  thumbFor(it); syncDrawerStatus();
  PLAT.forEach(p => { const tb = $("#tab-" + p.k); if (tb) tb.hidden = !(p.k === "alt" || relevant(id, p.k)); });
  $("#scrim").hidden = false;
  document.body.style.overflow = "hidden";
  showTab(dr.k);
  $ta().focus();
}
function closeDrawer() {
  flushCap();
  $("#scrim").hidden = true; document.body.style.overflow = "";
  const o = dr.opener; dr.id = null; if (o) o.focus();
}
function saveCap(id, k, val) { savePatch(id, { [k]: val }, k); }
function setCapStatus(id, k, s) {
  const base = caps[id] || {};
  savePatch(id, { st: { ...(base.st || {}), [k]: s } }, k);
  syncCapStatus(); updateSummary(); applyFilter();
}
function savePatch(id, patch, k) {
  if (!canWrite) return;
  const base = caps[id] || { ...(CAPS0[id] || {}), claude: { ...(CAPS0[id] || {}) } };
  const next = { ...base, ...patch, editedAt: new Date().toISOString() };
  caps[id] = next;
  if (els[id]) updateCard(id);
  if (dr.id === id) markTabs();
  const saved = $("#dr-saved");
  if (!db) return;
  if (dr.id === id && dr.k === k) saved.textContent = "Saving…";
  write(id, next, "captions").then(() => { if (dr.id === id && dr.k === k) saved.textContent = "Saved"; })
    .catch(e => { saved.textContent = ""; onWriteError(e); });
}
function flushCap() {
  if (!dr.id || !dr.timer) return;
  clearTimeout(dr.timer); dr.timer = null;
  const v = $ta().value;
  if (v !== capOf(dr.id, dr.k)) saveCap(dr.id, dr.k, v);
}
function wireDrawer() {
  buildTabs();
  const ta = $ta();
  ta.addEventListener("input", () => {
    meter(); $("#dr-saved").textContent = "";
    clearTimeout(dr.timer);
    const id = dr.id, k = dr.k;
    dr.timer = setTimeout(() => { dr.timer = null; saveCap(id, k, ta.value); }, 900);
  });
  ta.addEventListener("blur", flushCap);
  $("#dr-close").addEventListener("click", closeDrawer);
  $("#scrim").addEventListener("click", e => { if (e.target === e.currentTarget) closeDrawer(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#scrim").hidden) closeDrawer(); });
  $("#dr-restore").addEventListener("click", () => {
    const v = claudeOf(dr.id, dr.k); clearTimeout(dr.timer); dr.timer = null;
    $ta().value = v; saveCap(dr.id, dr.k, v); meter(); toast("Restored Claude's version");
  });
  $("#dr-copy").addEventListener("click", () => {
    const v = $ta().value;
    const done = () => toast(PLAT.find(p => p.k === dr.k).name + " caption copied");
    const fallback = () => { $ta().focus(); $ta().select(); toast("Selected. Press Ctrl+C or Cmd+C to copy."); };
    try { navigator.clipboard.writeText(v).then(done, fallback); } catch (e) { fallback(); }
  });
  $("#dr-txt").addEventListener("click", async () => {
    if (!dl) { toast("Downloads aren't available in this view."); return; }
    flushCap();
    try { await dl.save({ filename: `${SLUG}-${dr.id}-captions.txt`, data: captionsText(dr.id) }); toast("Captions downloaded"); }
    catch (e) { reportDl(e); }
  });
  ["draft", "final"].forEach(s => $("#dr-" + s).addEventListener("click", () => setStatus(dr.id, statusOf(dr.id) === s ? "review" : s)));
  ["draft", "final"].forEach(s => $("#dc-" + s).addEventListener("click", () => { flushCap(); setCapStatus(dr.id, dr.k, capSt(dr.id, dr.k) === s ? "review" : s); }));
}

// ---------- calendar ----------
const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const isVideo = it => it.kind === "reel" || it.kind === "wide";

const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pday = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = pday(s); d.setDate(d.getDate() + n); return ymd(d); };
const dowOf = s => pday(s).getDay();
const today = () => ymd(new Date());
const monthOf = s => s.slice(0, 7) + "-01";
const fmtDay = s => pday(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtMD = s => pday(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtTime = t => { const [H, M] = t.split(":").map(Number); return `${H % 12 || 12}:${pad(M)} ${H < 12 ? "AM" : "PM"}`; };
const fmtT = t => { const [H, M] = t.split(":").map(Number); return `${H % 12 || 12}${M ? ":" + pad(M) : ""}${H < 12 ? "a" : "p"}`; };
const okDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const okTime = s => /^\d{2}:\d{2}/.test(s || "");
// Video-only platforms (TikTok, YouTube Shorts) post on their own days: a date that isn't one moves to the next one that is.
const laterDate = (k, s) => { const d = BEST[k] && BEST[k].days; if (!PDEFS[k] || !PDEFS[k].videoOnly || !d || !d.length) return s; for (let i = 0; i < 7; i++) { if (d.includes(dowOf(s))) return s; s = addDays(s, 1); } return s; };
const thumbSrc = it => it.poster || it.preview || (it.slides && it.slides[0] && it.slides[0].preview) || PLACEHOLDER;
const hasCap = (id, k) => !!capOf(id, k).trim();
// Stories only take Stories; video-only platforms only take video; everything else goes to every feed platform.
const relevant = (id, k) => isStory(id) ? k === "st" : k === "st" ? false : PDEFS[k] && PDEFS[k].videoOnly ? isVideo(byId[id]) : true;
const canPost = (id, k) => relevant(id, k) && (k === "st" || hasCap(id, k));
const weekOf = id => (byId[id] && byId[id].week) || null;

const cal = {};                // entry id -> { item, plat, date, time, status, source }
let calByItem = {}, calByDate = {}, calByDraft = {};
const cv = { view: "library", mode: "month", month: monthOf(today()), qtab: "ready", touched: false, nOpen: false, wOpen: new Set(), mClosed: new Set() };
try { cv.nOpen = localStorage.getItem("ss-notices") === "1"; const wo = JSON.parse(localStorage.getItem("ss-wopen") || "[]"); if (Array.isArray(wo)) wo.filter(okDate).forEach(d => cv.wOpen.add(d)); const mc = JSON.parse(localStorage.getItem("ss-mclosed") || "[]"); if (Array.isArray(mc)) mc.filter(okDate).forEach(d => cv.mClosed.add(d)); } catch (e) {}
// Posting flow: Claude places posts as Suggested, the owner Locks them in, then they're Scheduled (scheduler or phone) and Posted.
const POST_ST = ["suggested", "locked", "scheduled", "posted"];
const STLAB = { suggested: "Suggested", locked: "Locked", scheduled: "Scheduled", posted: "Posted" };
const okStatus = x => POST_ST.includes(x);
const isPending = s => s === "suggested" || s === "locked";
const normEntry = e => (e && e.status === "planned") ? { ...e, status: e.source === "planner" ? "locked" : "suggested" } : e;
// Where a post goes out: through the brand's scheduler (settings.scheduler) for the platforms it's connected to, or from the
// phone (Stories for stickers, video when it needs in-app audio, and everything when there's no scheduler).
const routeOf = e => {
  if (!SCHED) return "phone";
  if (isText(e)) return SCHED.platforms.has("th") ? "ghl" : "phone";
  if (e.plat === "st" || !SCHED.platforms.has(e.plat)) return "phone";
  if (e.plat !== "th" && SCHED.videoByPhone && isVideo(byId[e.item])) return "phone";
  return "ghl";
};
const isText = e => e && e.kind === "text";
const validEntry = e => e && okDate(e.date) && okTime(e.time) && okStatus(e.status) &&
  (isText(e) ? e.plat === "th" && typeof e.text === "string" : !!byId[e.item] && PK.includes(e.plat));
const byWhen = (a, b) => (a.date + a.time).localeCompare(b.date + b.time) || PK.indexOf(a.plat) - PK.indexOf(b.plat);
function reindex() {
  calByItem = {}; calByDate = {}; calByDraft = {};
  for (const [key, e] of Object.entries(cal)) {
    if (!validEntry(e)) continue;
    const x = { key, ...e };
    if (isText(e)) { ((calByDate[e.date] ||= {})["t:" + key] ||= []).push(x); if (e.draft) calByDraft[e.draft] = x; continue; }
    (calByItem[e.item] ||= []).push(x);
    ((calByDate[e.date] ||= {})[e.item] ||= []).push(x);
  }
  Object.values(calByItem).forEach(l => l.sort(byWhen));
  Object.values(calByDate).forEach(m => Object.values(m).forEach(l => l.sort(byWhen)));
}
const entriesOf = id => calByItem[id] || [];
const usedEntries = id => entriesOf(id).filter(e => !isPending(e.status));
const plannedEntries = id => entriesOf(id).filter(e => isPending(e.status));
const isUsed = id => usedEntries(id).length > 0;
const isPlanned = id => plannedEntries(id).length > 0;
// Host rule (settings.hosts.hold): a host's posts only go out while that host has an event coming up.
let TEACH = {};
const instrOf = id => (byId[id] && byId[id].instr) || null;
const shortName = n => n.replace(/^Dr\.\s+/, "").split(" ")[0];
const nextClass = (id, date) => (TEACH[instrOf(id)] || []).find(d => d > date) || null;
const isHeld = (id, date) => !!HOST && HOST.hold && !!instrOf(id) && !nextClass(id, date || today());
const heldWhy = (id, date) => `${instrOf(id)} has no ${evw()} on the schedule after ${fmtMD(date || today())}`;
const isAvailable = id => isReady(id) && !isUsed(id) && !isPlanned(id) && !isHeld(id) && !isArchived(id);
const nextPlanned = id => plannedEntries(id)[0] || null;
const lastUsed = id => { const u = usedEntries(id); return u.length ? u[u.length - 1].date : ""; };
const hasIgOn = s => Object.values(calByDate[s] || {}).some(l => l.some(e => e.plat === LEAD && !isText(e)));
function nextOpenIg(from) {
  let s = from;
  for (let i = 0; i < 120; i++) { if (BEST[LEAD].days.includes(dowOf(s)) && !hasIgOn(s)) return s; s = addDays(s, 1); }
  return from;
}
function usageText(list) {
  const byD = {};
  list.forEach(e => (byD[e.date] ||= []).push(PSHORT[e.plat]));
  return Object.entries(byD).sort().map(([d, ps]) => `${fmtMD(d)} ${ps.join(" ")}`).join(" · ");
}
const newKey = (id, k) => `${id}__${k}__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const mkEntry = (id, k, date, time, status, source) => { const t = new Date().toISOString(); return { item: id, plat: k, date, time: time.slice(0, 5), status, source, createdAt: t, updatedAt: t }; };
function calChanged() { refreshAll(); renderCal(); }
function putEntries(pairs) {
  pairs.forEach(([key, data]) => { cal[key] = data; });
  reindex(); calChanged();
  return Promise.all(pairs.map(([key, data]) => write(key, data, "cal").catch(onWriteError)));
}
function patchEntry(key, patch) { if (cal[key]) return putEntries([[key, { ...cal[key], ...patch, updatedAt: new Date().toISOString() }]]); }
function dropEntries(keys) {
  keys.forEach(k => delete cal[k]); reindex(); calChanged();
  keys.forEach(k => remove(k, "cal").catch(onWriteError));
}
function copyText(v, msg) {
  const fail = () => toast("Couldn't copy here. Use Edit caption to select the text.");
  try { navigator.clipboard.writeText(v).then(() => toast(msg), fail); } catch (e) { fail(); }
}

// ----- posting-rule checks -----
const daysBetween = (a, b) => Math.round((pday(b) - pday(a)) / 864e5);
const nextThDay = from => { let x = from; for (let i = 0; i < 8; i++) { if (BEST.th.days.includes(dowOf(x))) return x; x = addDays(x, 1); } return from; };
function leadIssue(id, date) {
  const ev = (byId[id] && byId[id].events) || [];
  if (!ev.length) return null;
  const after = ev.filter(d => d >= date);
  if (!after.length) return `posts after its last ${evw()} (${fmtMD(ev[ev.length - 1])})`;
  if (after.some(d => daysBetween(date, d) >= RULES.leadDays)) return null;
  const n = daysBetween(date, after[0]);
  return `posts ${n} day${n === 1 ? "" : "s"} before the ${fmtMD(after[0])} ${evw()} (${n >= RULES.shortLead ? "short notice; " : ""}aim for ${RULES.leadDays}+)`;
}
function leadHint(id) {
  const ev = (byId[id] && byId[id].events) || [];
  const ok = ev.filter(d => addDays(d, -RULES.leadDays) >= today());
  if (!ev.length) return null;
  if (!ok.length) return `Too late to post ${RULES.leadDays}+ days before ${an(evw())} (the last one is ${fmtMD(ev[ev.length - 1])}).`;
  return `${cap1(evw())} ${ok.map(fmtMD).slice(0, 3).join(", ")}${ok.length > 3 ? "…" : ""} · post by ${fmtDay(addDays(ok[ok.length - 1], -RULES.leadDays))} to stay ${RULES.leadDays}+ days ahead.`;
}
function igSeq() {
  return Object.entries(cal).filter(([, e]) => validEntry(e) && !isText(e) && e.plat === LEAD).map(([k, e]) => ({ key: k, ...e })).sort(byWhen);
}
function adjAt(id, date) {
  const ct = byId[id].ctype, seq = igSeq().filter(e => e.item !== id), out = [];
  const prev = seq.filter(e => e.date < date).pop(), next = seq.find(e => e.date > date);
  if (prev && byId[prev.item].ctype === ct) out.push(`Comes right after another ${ct.toLowerCase()} post (${byId[prev.item].title}, ${fmtMD(prev.date)}).`);
  if (next && byId[next.item].ctype === ct) out.push(`Comes right before another ${ct.toLowerCase()} post (${byId[next.item].title}, ${fmtMD(next.date)}).`);
  if (seq.some(e => e.date === date)) out.push(`There's already ${an(PNAME[LEAD])} post on ${fmtDay(date)}.`);
  return out;
}
function weekStats(ws) {
  const we = addDays(ws, 6);
  const es = Object.entries(cal).filter(([, e]) => validEntry(e) && e.date >= ws && e.date <= we).map(([k, e]) => ({ key: k, ...e }));
  const n = { th: 0, wst: 0, ost: 0 };
  for (const k of PK) {
    if (k === "th") n.th = es.filter(e => e.plat === "th").length;
    else if (k === "st") { n.wst = es.filter(e => e.plat === "st" && weekOf(e.item)).length; n.ost = es.filter(e => e.plat === "st" && !weekOf(e.item)).length; }
    else n[k] = new Set(es.filter(e => !isText(e) && e.plat === k && (!PDEFS[k].videoOnly || isVideo(byId[e.item]))).map(e => e.item)).size;
  }
  const lead = new Set(es.filter(e => !isText(e) && e.plat === LEAD).map(e => e.item));
  const mix = {}; lead.forEach(id => { const c = byId[id].ctype; mix[c] = (mix[c] || 0) + 1; });
  return { ws, we, ...n, thText: es.filter(isText).length, mix };
}
function issuesIn(from, to) {
  const out = [], seq = igSeq(), seen = new Set();
  const es = Object.entries(cal).filter(([, e]) => validEntry(e) && e.date >= from && e.date <= to).map(([k, e]) => ({ key: k, ...e })).sort(byWhen);
  for (const e of es) {
    if (isText(e)) {
      if ((e.textSt || "review") !== "final") out.push({ date: e.date, key: e.key, text: "Threads text post isn't Final yet." });
      const fl = flagOf(e.text); if (fl) out.push({ date: e.date, key: e.key, text: `Threads text post ${fl}.` });
      if (isPending(e.status) && okDate(e.classDate)) { const n = daysBetween(e.date, e.classDate); if (n < RULES.leadDays) out.push({ date: e.date, key: e.key, text: n < 0 ? `Threads post goes out after its ${fmtMD(e.classDate)} ${evw()}.` : `Threads post for the ${fmtMD(e.classDate)} ${evw()} goes out ${n} day${n === 1 ? "" : "s"} ahead (aim for ${RULES.leadDays}+).` }); }
      continue;
    }
    const cfl = e.plat !== "st" && isPending(e.status) ? flagOf(capOf(e.item, e.plat)) : null;
    if (cfl) out.push({ date: e.date, id: e.item, text: `${byId[e.item].title}: the ${PNAME[e.plat]} caption ${cfl}.` });
    if (e.plat === "st") {
      const itS = byId[e.item], wk = weekOf(e.item);
      if (!isStory(e.item)) out.push({ date: e.date, id: e.item, text: `${itS.title}: Stories are for the Story frames only.` });
      if (wk && (e.date < wk[0] || e.date > wk[1])) out.push({ date: e.date, id: e.item, text: `${itS.title} covers ${fmtMD(wk[0])}–${fmtMD(wk[1])} but is set for ${fmtMD(e.date)}.` });
      if (isPending(e.status) && !isReady(e.item)) out.push({ date: e.date, id: e.item, text: `${itS.title} is still waiting on your review.` });
      continue;
    }
    const it = byId[e.item];
    if (PDEFS[e.plat].videoOnly && !isVideo(it)) out.push({ date: e.date, id: e.item, text: `${it.title}: ${PNAME[e.plat]} is set, but it isn't a Reel.` });
    if (e.plat !== LEAD || seen.has(e.item + e.date)) continue;
    seen.add(e.item + e.date);
    const li = leadIssue(e.item, e.date); if (li) out.push({ date: e.date, id: e.item, text: `${it.title} ${li}.` });
    if (it.soldout) out.push({ date: e.date, id: e.item, text: `${it.title}: ${it.soldout}.` });
    if (isArchived(e.item)) out.push({ date: e.date, id: e.item, text: `${it.title} is archived but still on the calendar.` });
    if (isHeld(e.item, e.date)) out.push({ date: e.date, id: e.item, text: `${it.title}: ${heldWhy(e.item, e.date)}. Hold it until one is.` });
    if (isPending(e.status) && !isReady(e.item)) out.push({ date: e.date, id: e.item, text: `${it.title} is still waiting on your review.` });
    const i = seq.findIndex(x => x.key === e.key), prev = i > 0 ? seq[i - 1] : null;
    if (prev && prev.item !== e.item) {
      if (prev.date === e.date) out.push({ date: e.date, id: e.item, text: `Two ${PNAME[LEAD]} posts on ${fmtDay(e.date)}.` });
      else if (byId[prev.item].ctype === it.ctype) out.push({ date: e.date, id: e.item, text: `Two ${it.ctype.toLowerCase()} posts in a row: ${byId[prev.item].title} (${fmtMD(prev.date)}), then ${it.title}.` });
    }
  }
  return out;
}
// ----- week hand-off: lock a week, then download its scheduler and Phone packs -----
function weekEntries(ws, from) {
  const we = addDays(ws, 6), lo = from && from > ws ? from : ws;
  return Object.entries(cal).filter(([, e]) => validEntry(e) && e.date >= lo && e.date <= we).map(([k, e]) => ({ key: k, ...e })).sort(byWhen);
}
function weekActions(ws, t) {
  const es = weekEntries(ws, t);
  if (!es.length) return null;
  const n = st => es.filter(e => e.status === st).length;
  const ro = !db || !canWrite;
  const counts = h("span", { class: "stc" }, ...POST_ST.filter(st => n(st)).flatMap((st, i) => [i ? " · " : "", h("b", { text: String(n(st)) }), " " + STLAB[st].toLowerCase()]));
  const sug = n("suggested"), lockedOnly = n("locked");
  const lock = h("button", { class: "btn small" + (sug ? "" : " ghost"), type: "button", text: sug ? `Lock week (${sug})` : "Unlock week", disabled: ro || (!sug && !lockedOnly),
    title: sug ? "Lock every Suggested post this week" : "Put this week's Locked posts back to Suggested" });
  lock.addEventListener("click", () => lockWeek(ws, t, !!sug));
  const ghl = packList(ws, t, "ghl"), ph = packList(ws, t, "phone");
  const gb = !SCHED ? null : h("button", { class: "btn ghost small", type: "button", text: `${SCHED.name} pack (${ghl.length})`, disabled: !dl || !ghl.length, title: dl ? `Images and videos for ${SCHED.name}, named so Claude can find them` : "Downloads work when the page is open in Claude" });
  if (gb) gb.addEventListener("click", () => ghlPack(ws, t, gb));
  const pb = h("button", { class: "btn ghost small", type: "button", text: `Phone pack (${ph.length})`, disabled: !dl || !ph.length, title: dl ? "Files and a posting sheet for everything you post from your phone" : "Downloads work when the page is open in Claude" });
  pb.addEventListener("click", () => phonePack(ws, t, pb));
  // Later stages: mark phone posts Scheduled once they're set up, then mark the week Done once it has gone out.
  const phLocked = es.filter(e => routeOf(e) === "phone" && e.status === "locked");
  const mps = phLocked.length ? h("button", { class: "btn ghost small", type: "button", text: `Mark phone posts Scheduled (${phLocked.length})`, disabled: ro, title: "Once the Reels and Stories are set up or ready on your phone" }) : null;
  if (mps) mps.addEventListener("click", () => bumpWeek(phLocked, "scheduled", `${phLocked.length} phone post${phLocked.length === 1 ? "" : "s"} marked Scheduled`));
  const sched = es.filter(e => e.status === "scheduled"), allSched = es.every(e => RANK[e.status] >= 2);
  const doneB = allSched && sched.length ? h("button", { class: "btn small", type: "button", text: `Mark week Done (${sched.length})`, disabled: ro, title: "Mark every Scheduled post this week as Posted" }) : null;
  if (doneB) doneB.addEventListener("click", () => bumpWeek(sched, "posted", `Week of ${fmtMD(ws)} marked Done`));
  return h("div", { class: "wact" }, counts, sug || lockedOnly ? lock : null, gb, pb, mps, doneB);
}
function bumpWeek(list, status, msg) {
  const now = new Date().toISOString();
  putEntries(list.map(e => [e.key, { ...cal[e.key], status, updatedAt: now }]));
  toast(msg);
}
function lockWeek(ws, t, on) {
  const from = on ? "suggested" : "locked", to = on ? "locked" : "suggested", now = new Date().toISOString();
  const es = weekEntries(ws, t).filter(e => e.status === from);
  if (!es.length) return;
  putEntries(es.map(e => { const d = { ...cal[e.key], status: to, updatedAt: now }; if (on) d.lockedAt = now; else delete d.lockedAt; return [e.key, d]; }));
  const notReady = [...new Set(es.filter(e => !isText(e) && !isReady(e.item)).map(e => byId[e.item].title))];
  toast(on ? `Locked ${es.length} post${es.length === 1 ? "" : "s"} for ${fmtMD(ws)}–${fmtMD(addDays(ws, 6))}` + (notReady.length ? `. Not Final yet: ${notReady.slice(0, 2).join(", ")}${notReady.length > 2 ? "…" : ""}` : "")
    : `${es.length} post${es.length === 1 ? " is" : "s are"} back to Suggested`);
}
// Only Locked posts go in a pack (Scheduled phone posts stay in, in case you re-download).
function packList(ws, t, route) {
  return weekEntries(ws, t).filter(e => routeOf(e) === route && (e.status === "locked" || (route === "phone" && e.status === "scheduled")));
}
const mmdd = s => s.slice(5, 7) + s.slice(8, 10);
const DOW3 = s => pday(s).toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
const hhmm = t => t.replace(":", "");
async function jpegOf(path) {
  const src = await blobOf(path);
  if (src.type === "image/jpeg" || (!src.type && /\.jpe?g$/i.test(path))) return src;
  const bmp = await createImageBitmap(src);
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("jpeg")), "image/jpeg", 0.92));
}
const nn = i => String(i + 1).padStart(2, "0");
const thFile = e => `${PFX}-${mmdd(e.date)}-threads-${hhmm(e.time)}.jpg`;
const entryLine = e => `${fmtTime(e.time).padEnd(8)}  ${PNAME[e.plat]}${isText(e) ? (e.photo ? " · text + photo (" + thFile(e) + ")" : " · text-only post") : " · " + byId[e.item].title}`;
async function packRun(btn, fn) {
  if (!dl) return;
  const label = btn.textContent;
  btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), " Packing…");
  try { const { filename, data } = await fn(); await dl.save({ filename, data }); toast("Downloaded " + filename); }
  catch (e) { reportDl(e); }
  finally { btn.textContent = label; btn.disabled = false; }
}
function ghlPack(ws, t, btn) {
  return packRun(btn, async () => {
    const we = addDays(ws, 6), es = packList(ws, t, "ghl"), zip = new JSZip(), files = [], seen = new Set();
    for (const e of es) {
      if (isText(e)) { if (e.photo && e.photo.blob) { zip.file(thFile(e), await jpegOf(blobUrl(e.photo))); files.push(thFile(e)); } continue; }
      if (seen.has(e.item)) continue;
      seen.add(e.item);
      const it = byId[e.item], base = `${PFX}-${mmdd(e.date)}-${it.id}`;
      if (isVideo(it)) { const b = await blobOf(it.file), f = base + "." + extOf(b, it.file); zip.file(f, b); files.push(f); }
      else if (it.slides) for (let i = 0; i < it.slides.length; i++) { zip.file(`${base}-${nn(i)}.jpg`, await jpegOf(it.slides[i].file)); files.push(`${base}-${nn(i)}.jpg`); }
      else { zip.file(base + ".jpg", await jpegOf(it.file)); files.push(base + ".jpg"); }
    }
    const sug = weekEntries(ws, t).filter(e => routeOf(e) === "ghl" && e.status === "suggested").length;
    const byDay = {}; es.forEach(e => (byDay[e.date] ||= []).push(e));
    const range = `${fmtMD(ws)}–${fmtMD(we)}`;
    const steps = SCHED.steps.length ? SCHED.steps : SCHED.name === "GHL" ? [
      "In GHL, open Media Library and make a folder called: Social " + range,
      "Drag every file from this folder into it (don't rename them).",
      SCHED.claude ? `Tell Claude: "the ${fmtMD(ws)} GHL pack is uploaded." Claude sets up these posts in the Social Planner at the times below and marks them Scheduled.` : "Set up each post below in the Social Planner at its time, then mark the week Scheduled in the calendar."]
      : [`Upload every file in this folder to ${SCHED.name} (don't rename them).`,
        SCHED.claude ? `Tell Claude: "the ${fmtMD(ws)} ${SCHED.name} pack is uploaded." Claude sets up these posts at the times below and marks them Scheduled.` : `Set up each post below in ${SCHED.name} at its time, then mark the week Scheduled in the calendar.`];
    const readme = [
      `${(NAME || "STUDIO").toUpperCase()} · ${SCHED.name.toUpperCase()} PACK · ${range}`, "",
      ...steps.map((x, i) => `${i + 1}. ${x}`), "",
      `POSTS IN THIS PACK (times are ${TZ})`, "",
      ...Object.keys(byDay).sort().flatMap(d => [fmtDay(d).toUpperCase(), ...byDay[d].map(entryLine), ""]),
      files.length ? `${files.length} file${files.length === 1 ? "" : "s"}. Threads posts with a photo use the file named next to them; text-only Threads posts don't need a file.` : "Only text-only posts this week, so there's nothing to upload.",
      sug ? `\nNot included: ${sug} post${sug === 1 ? " is" : "s are"} still Suggested. Lock ${sug === 1 ? "it" : "them"} and download the pack again.` : "",
    ].join("\n");
    zip.file("READ ME FIRST.txt", readme);
    return { filename: `${SLUG}-${slugify(SCHED.name) || "scheduler"}-pack-${ws}.zip`, data: await zip.generateAsync({ type: "blob", compression: "STORE" }) };
  });
}
function phonePack(ws, t, btn) {
  return packRun(btn, async () => {
    const we = addDays(ws, 6), es = packList(ws, t, "phone"), zip = new JSZip(), got = {};
    const fileFor = async e => {
      if (got[e.item]) return got[e.item];
      const it = byId[e.item], base = `${mmdd(e.date)}-${DOW3(e.date)}-${hhmm(e.time)}-${it.id}`, out = [];
      if (it.slides) for (let i = 0; i < it.slides.length; i++) { const b = await blobOf(it.slides[i].file), f = `${base}-${nn(i)}.${extOf(b, it.slides[i].file)}`; zip.file(f, b); out.push(f); }
      else { const b = await blobOf(it.file), f = base + "." + extOf(b, it.file); zip.file(f, b); out.push(f); }
      return (got[e.item] = out);
    };
    const lines = [`${(NAME || "STUDIO").toUpperCase()} · PHONE POSTS · ${fmtMD(ws)}–${fmtMD(we)}`, `Times are ${TZ}. Save the files to your phone, post at these times, then mark each one Posted in the calendar.`, ""];
    const byDay = {}; es.forEach(e => (byDay[e.date] ||= []).push(e));
    for (const d of Object.keys(byDay).sort()) {
      lines.push("━━━ " + fmtDay(d).toUpperCase() + " ━━━", "");
      for (const e of byDay[d]) {
        if (isText(e)) {
          const f = e.photo && e.photo.blob ? thFile(e) : null;
          if (f && !got[f]) { zip.file(f, await jpegOf(blobUrl(e.photo))); got[f] = [f]; }
          lines.push(`${fmtTime(e.time)} · Threads · ${f ? "text + photo" : "text post"}${e.status === "scheduled" ? "  (already marked Scheduled)" : ""}`);
          if (f) lines.push("File: " + f);
          lines.push("", e.text || "", "", "");
          continue;
        }
        const it = byId[e.item], files = await fileFor(e);
        lines.push(`${fmtTime(e.time)} · ${PNAME[e.plat]}${e.plat === "st" ? "" : isVideo(it) ? " Reel" : ""} · ${it.title}${e.status === "scheduled" ? "  (already marked Scheduled)" : ""}`);
        lines.push("File" + (files.length > 1 ? "s" : "") + ": " + files.join(", "));
        if (e.plat === "st") {
          lines.push(PK.includes("fb") ? "Post to Instagram Stories, then share to Facebook." : "Post to Instagram Stories.");
          if (it.heads) lines.push("Sticker: " + it.heads);
          if (weekOf(e.item) && SET.storyLink) lines.push("Link sticker: " + SET.storyLink);
        } else {
          if (isVideo(it)) lines.push(e.plat === "fb" && PK.includes("ig") ? "Add audio in Facebook, or turn on \"Share to Facebook\" when you post the Instagram Reel and skip this one." : `Add a sound in ${PNAME[e.plat]} if it needs one.`);
          const c = capOf(e.item, e.plat).trim();
          lines.push("", "Caption:", c || "(no caption yet)");
          const alt = capOf(e.item, "alt").trim(); if (alt && !PDEFS[e.plat].videoOnly) lines.push("", "Alt text: " + alt);
        }
        lines.push("", "");
      }
    }
    const gh = weekEntries(ws, t).filter(e => routeOf(e) === "ghl" && e.status !== "suggested");
    if (gh.length && SCHED) lines.push(`━━━ GOING OUT THROUGH ${SCHED.name.toUpperCase()} (nothing to do on your phone) ━━━`, "", ...gh.map(e => `${fmtDay(e.date)}  ${entryLine(e)}  [${STLAB[e.status]}]`), "");
    const sug = weekEntries(ws, t).filter(e => e.status === "suggested").length;
    if (sug) lines.push(`Not included: ${sug} post${sug === 1 ? " is" : "s are"} still Suggested this week.`);
    zip.file("00-posting-sheet.txt", lines.join("\n"));
    return { filename: `${SLUG}-phone-pack-${ws}.zip`, data: await zip.generateAsync({ type: "blob", compression: "STORE" }) };
  });
}

// Week stages: Unlocked -> Locked -> Scheduled -> Done, set by the least-far-along post that week.
const RANK = { suggested: 0, locked: 1, scheduled: 2, posted: 3 };
const STAGE = ["Unlocked", "Locked", "Scheduled", "Done"], NEXTV = ["locked", "scheduled", "posted"];
const IC_UNLOCK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 1 5 5 1 1 0 1 1-2 0 3 3 0 0 0-6 0v3h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5z"/></svg>';
const IC_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function stageChip(st) {
  const c = h("span", { class: "wchip " + (st < 0 ? "sx" : "s" + st), text: st < 0 ? "Nothing planned" : STAGE[st] });
  const ic = [IC_UNLOCK, IC_LOCK, IC_CHECK, IC_CHECK][st];
  if (ic) c.insertAdjacentHTML("afterbegin", ic);
  return c;
}
function weekRow(ws, t) {
  const w = weekStats(ws), past = w.we < t, cur = ws <= t && !past;
  const left = days => { let n = 0; for (let d = t; d <= w.we; d = addDays(d, 1)) if (days.includes(dowOf(d))) n++; return n; };
  const tgt = (full, days) => cur ? Math.min(full, left(days)) : full;
  const sc = (label, n, target) => h("span", { class: "sc" + (n >= target ? " ok" : " short"), text: `${label} ${n}/${target}` });
  const remind = EV && EV.reminders;
  const mix = ([...CTYPES, ...Object.keys(w.mix).filter(c => !CTYPES.includes(c))].filter(c => w.mix[c]).map(c => `${w.mix[c]} ${c.toLowerCase()}`).join(" · ") || "nothing planned") + (remind && w.ost ? ` · ${w.ost} other ${w.ost === 1 ? "Story" : "Stories"}` : "");
  const cards = PK.map(k => k === "st" ? [remind ? `${cap1(EV.word)} Stories` : "Stories", remind ? w.wst : w.wst + w.ost, tgt(RULES.st || 0, BEST.st.days)]
    : k === "th" ? ["Threads", w.th, tgt(RULES.th || 0, [0, 1, 2, 3, 4, 5, 6])]
    : [PDEFS[k].videoOnly ? `Reels on ${PNAME[k]}` : PSHORT[k], w[k] || 0, tgt(RULES[k] || 0, BEST[k].days)]).filter(c => c[2] > 0);
  const es = weekEntries(ws, cur ? t : null);
  const stage = es.length ? Math.min(...es.map(e => RANK[e.status])) : -1;
  const goal = stage >= 0 && stage < 3 ? stage + 1 : 3, reached = e => RANK[e.status] >= goal;
  const got = es.filter(reached).length;
  const plats = PK.map(k => { const l = es.filter(e => e.plat === k); return l.length ? { k, n: l.length, d: l.filter(reached).length } : null; }).filter(Boolean);
  const short = cards.filter(([, n, target]) => n < target).map(([label]) => label);
  const word = NEXTV[goal - 1];
  const det = h("details", { class: "wk wkd", open: cv.wOpen.has(ws) ? true : null },
    h("summary", {},
      h("span", { class: "wl", text: `${fmtMD(w.ws)} – ${fmtMD(w.we)}${cur ? " · this week" : ""}` }),
      stageChip(stage),
      es.length ? h("span", { class: "wstt", text: stage === 3 ? `All ${es.length} posted` : `${got} of ${es.length} ${word}` }) : null,
      stage >= 0 && stage < 3 ? h("span", { class: "wplats" }, plats.map(x => h("span", { class: "wpl " + (x.d === x.n ? "ok" : "no"), title: `${PNAME[x.k]}: ${x.d} of ${x.n} ${word}`, "aria-label": `${PNAME[x.k]} ${x.d} of ${x.n} ${word}`, text: `${PSHORT[x.k]} ${x.d}/${x.n}` }))) : null,
      short.length ? h("span", { class: "wshort", text: "Plan short: " + short.join(", ") }) : null),
    h("div", { class: "wbody" },
      h("div", { class: "wcards" }, h("span", { class: "fl", text: "Plan" }), cards.map(([label, n, target]) => sc(label, n, target)), h("span", { class: "mix", text: mix })),
      weekActions(ws, cur ? t : null)));
  det.addEventListener("toggle", () => {
    if (det.open) cv.wOpen.add(ws); else cv.wOpen.delete(ws);
    try { localStorage.setItem("ss-wopen", JSON.stringify([...cv.wOpen])); } catch (e) {}
  });
  return { el: det, stage, n: es.length };
}

function renderRules() {
  renderPlanBar();
  $("#rules").replaceChildren(...RULE_TEXT.map(([a, b]) => h("li", {}, h("b", { text: a }), h("span", { text: b }))));
  $("#strat-n").textContent = String(RULE_TEXT.length); $("#strat-n").setAttribute("aria-label", RULE_TEXT.length + " rules");
  // The Posting plan always shows the next six weeks from today, grouped by month, each week a dropdown.
  const t = today(), sun = d => addDays(d, -dowOf(d));
  let ws0 = sun(t); if (addDays(ws0, 6) < POST_START) ws0 = sun(POST_START);
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(ws0, i * 7));
  const byMonth = {};
  const weekRows = weeks.map(ws => { const r = weekRow(ws, t); (byMonth[monthOf(ws)] ||= []).push(r); return r; });
  const months = Object.keys(byMonth).sort().map(m => {
    const rs = byMonth[m], withPosts = rs.filter(r => r.n);
    const st = withPosts.length ? Math.min(...withPosts.map(r => r.stage)) : -1;
    const tally = [0, 1, 2, 3].map(k => [k, withPosts.filter(r => r.stage === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${STAGE[k].toLowerCase()}`).join(" · ");
    const open = !cv.mClosed.has(m);
    const det = h("details", { class: "wmonth", open: open ? true : null },
      h("summary", {}, h("span", { class: "mname", text: pday(m).toLocaleDateString("en-US", { month: "long" }) }), stageChip(st),
        h("span", { class: "mcount", text: `${rs.length} week${rs.length === 1 ? "" : "s"}${tally ? " · " + tally : ""}` })),
      h("div", { class: "mweeks" }, rs.map(r => r.el)));
    det.addEventListener("toggle", () => {
      if (det.open) cv.mClosed.delete(m); else cv.mClosed.add(m);
      try { localStorage.setItem("ss-mclosed", JSON.stringify([...cv.mClosed])); } catch (e) {}
    });
    return det;
  });
  const last = addDays(weeks[5], 6);
  $("#weeks").replaceChildren(
    h("div", { class: "wkhead" }, h("b", { text: "Next six weeks" }), h("span", { text: `${fmtMD(weeks[0])} – ${fmtMD(last)}${t < POST_START ? " · posting starts " + fmtDay(POST_START) : ""}` })),
    ...months);
  const from = t > weeks[0] ? t : weeks[0], to = last;
  const iss = from <= to ? issuesIn(from, to) : [];
  // Notices collapse into one row with a count; the open/closed state is remembered on this device.
  if (!iss.length) { $("#issues").replaceChildren(h("p", { class: "allgood", text: "No notices. This month follows the posting plan." })); return; }
  const list = h("div", { class: "nlist" }, iss.map(x => {
    const b = h("button", { class: "issue", type: "button" }, h("b", { text: fmtMD(x.date) }), x.text);
    b.addEventListener("click", () => x.key ? openText(x.key, null, b) : openGroup(x.id, x.date, b));
    return b;
  }));
  const det = h("details", { class: "notices", open: cv.nOpen ? true : null },
    h("summary", {}, h("span", { class: "nt", text: "Notices" }), h("span", { class: "ncount", "aria-label": `${iss.length} notice${iss.length === 1 ? "" : "s"}`, text: String(iss.length) }),
      h("span", { class: "nhint", text: cv.nOpen ? "Tap one to open it" : `${fmtMD(from)} – ${fmtMD(to)} · tap to see them` })),
    list);
  det.addEventListener("toggle", () => {
    cv.nOpen = det.open; try { localStorage.setItem("ss-notices", det.open ? "1" : "0"); } catch (e) {}
    det.querySelector(".nhint").textContent = det.open ? "Tap one to open it" : `${fmtMD(from)} – ${fmtMD(to)} · tap to see them`;
  });
  $("#issues").replaceChildren(det);
}

const scrollAt = {};
function setView(v) {
  if (!VIEWS[v]) v = "library";
  if (cv.view && cv.view !== v) scrollAt[cv.view] = window.scrollY;
  const changed = cv.view !== v;
  cv.view = v; document.body.dataset.view = v;
  $("#view-lib").hidden = v !== "library"; $("#view-cal").hidden = v !== "calendar"; $("#view-assets").hidden = v !== "assets"; $("#view-ideas").hidden = v !== "ideas"; $("#view-chat").hidden = v !== "chat";
  $("#hdr-lib").hidden = v !== "library"; $("#hdr-assets").hidden = v !== "assets"; $("#hdr-assets-btn").hidden = v !== "assets";
  $("#dl-all").hidden = v !== "library" || !dl;
  $("#h1").textContent = VIEWS[v].h1; $("#brand").textContent = VIEWS[v].brand; document.title = VIEWS[v].title;
  document.querySelectorAll(".pg[data-view]").forEach(b => b.setAttribute("aria-current", b.dataset.view === v ? "page" : "false"));
  try { localStorage.setItem("ss-view", v); } catch (e) {}
  if (v === "calendar") renderCal();
  if (v === "ideas") renderIdeas();
  if (v === "chat") renderChat(true);
  if (changed) requestAnimationFrame(() => window.scrollTo(0, scrollAt[v] || 0));
}
function trackHeader() {
  const top = $("header.top"), set = () => document.documentElement.style.setProperty("--hdr-h", top.offsetHeight + "px");
  set();
  try { new ResizeObserver(set).observe(top); } catch (e) { window.addEventListener("resize", set); }
}

function renderBest() {
  $("#best").replaceChildren(...PK.filter(k => k !== "st").map(k => {
    const b = BEST[k];
    return h("div", { class: "bcard p-" + k },
      h("div", { class: "bname", text: PNAME[k] }),
      h("div", { class: "btime", text: fmtTime(b.time) }),
      h("div", { class: "bdays", text: b.dayText }),
      h("p", { class: "bwhy", text: b.why }),
      h("div", { class: "bsrc", text: b.src }));
  }));
  $("#bnote").textContent = BNOTE; $("#bnote").hidden = !BNOTE;
  $("#best-hint").textContent = PK.filter(k => k !== "st").map(k => `${PSHORT[k]} ${fmtT(BEST[k].time)}`).join(" · ");
}

function tags(list, withTime) {
  return h("span", { class: "ptags" }, list.map(e => h("i", { class: `pt p-${e.plat} ${e.status}`, text: withTime ? `${PSHORT[e.plat]} ${fmtT(e.time)}` : PSHORT[e.plat] })));
}
const groupLabel = (id, list, date) => `${fmtDay(date)}, ${byId[id].title}: ` + list.map(e => `${PNAME[e.plat]} ${fmtTime(e.time)}, ${e.status}`).join("; ");
function dayGroups(s) { return Object.entries(calByDate[s] || {}).sort((a, b) => a[1][0].time.localeCompare(b[1][0].time)); }
const slotOk = (s, groups) => !!db && canWrite && s >= today() && BEST[LEAD].days.includes(dowOf(s)) && !groups.some(([, l]) => l.some(e => e.plat === LEAD));

function monthGrid() {
  const first = pday(cv.month), start = addDays(cv.month, -first.getDay());
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((first.getDay() + dim) / 7) * 7, t = today(), m = cv.month.slice(0, 7);
  const grid = h("div", { class: "month" }, DOWS.map(d => h("div", { class: "dow", "aria-hidden": "true", text: d })));
  for (let i = 0; i < cells; i++) {
    const s = addDays(start, i), w = dowOf(s), inM = s.startsWith(m), groups = dayGroups(s);
    const best = [...new Set([LEAD, PK.find(k => PDEFS[k].videoOnly)])].filter(k => k && BEST[k].days.includes(w));
    const dots = h("span", { class: "bestdots", title: best.length ? "Best day for " + best.map(k => PNAME[k]).join(" and ") : "" }, best.map(k => h("i", { class: "p-" + k })));
    const cell = h("div", { class: "day" + (inM ? "" : " out") + (s === t ? " today" : "") },
      h("div", { class: "dtop" }, h("span", { class: "dnum", text: String(pday(s).getDate()), "aria-label": fmtDay(s) + (s === t ? ", today" : "") }), dots));
    for (const [id, list] of groups) {
      if (id.startsWith("t:")) {
        const e = list[0];
        const b = h("button", { class: "ev tx" + (e.photo ? " ph" : ""), type: "button", "aria-label": `${fmtDay(s)}, Threads ${e.photo ? "post with a photo" : "text post"}, ${fmtTime(e.time)}, ${e.status}` },
          h("span", { class: "evt" }, h("b", { text: fmtT(e.time) }), " " + (e.text || "Threads post").slice(0, 40)), tags([e]));
        b.addEventListener("click", () => openText(e.key, null, b));
        cell.append(b); continue;
      }
      const b = h("button", { class: "ev", type: "button", "aria-label": groupLabel(id, list, s) },
        h("span", { class: "evt" }, h("b", { text: fmtT(list[0].time) }), " " + byId[id].title), tags(list));
      b.addEventListener("click", () => openGroup(id, s, b));
      cell.append(b);
    }
    if (inM && slotOk(s, groups)) {
      const b = h("button", { class: "slot", type: "button", text: `+ ${PSHORT[LEAD]} ${fmtT(BEST[LEAD].time)}`, "aria-label": `Plan a piece for ${PNAME[LEAD]} on ${fmtDay(s)} at ${fmtTime(BEST[LEAD].time)}` });
      b.addEventListener("click", () => openPicker(s, b));
      cell.append(b);
    }
    grid.append(cell);
  }
  return grid;
}

function agenda() {
  const first = pday(cv.month), dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const m = cv.month.slice(0, 7), t = today();
  const wrap = h("div", { class: "agenda" });
  for (let d = 1; d <= dim; d++) {
    const s = `${m}-${pad(d)}`, groups = dayGroups(s), open = slotOk(s, groups);
    if (!groups.length && !open) continue;
    const list = h("div", { class: "list" }, groups.map(([id, l]) => {
      if (id.startsWith("t:")) {
        const e = l[0];
        const b = h("button", { class: "arow", type: "button" }, e.photo ? h("img", { src: blobUrl(e.photo), alt: "", loading: "lazy" }) : h("span", { class: "txbox", text: "TH" }),
          h("div", {}, h("div", { class: "t", text: (e.text || "Threads post").slice(0, 90) }), h("div", { class: "s", text: "Threads · " + (e.photo ? "text + photo" : "text only") + ((e.textSt || "review") === "final" ? "" : " · not Final yet") }), tags(l, true)));
        b.addEventListener("click", () => openText(e.key, null, b));
        return b;
      }
      const it = byId[id];
      const b = h("button", { class: "arow", type: "button", "aria-label": groupLabel(id, l, s) },
        h("img", { src: thumbSrc(it), alt: "", loading: "lazy" }),
        h("div", {}, h("div", { class: "t", text: it.title }), h("div", { class: "s", text: kickFor(it) + " · " + it.ctype }), tags(l, true)));
      b.addEventListener("click", () => openGroup(id, s, b));
      return b;
    }));
    if (open) {
      const b = h("button", { class: "slot", type: "button", text: `+ Open ${PNAME[LEAD]} slot · ${fmtTime(BEST[LEAD].time)}` });
      b.addEventListener("click", () => openPicker(s, b));
      list.append(b);
    }
    wrap.append(h("div", { class: "aday" + (s === t ? " today" : "") }, h("h3", { text: fmtDay(s) + (s === t ? " · Today" : "") }), list));
  }
  if (!wrap.children.length) wrap.append(h("p", { class: "empty-cal", text: "Nothing on the calendar this month. Plan a piece from the Ready list." }));
  return wrap;
}

function renderQueue() {
  const CAL = DATA.items.filter(it => !isArchived(it.id));
  const avail = CAL.filter(it => isAvailable(it.id));
  const planned = CAL.filter(it => isPlanned(it.id) && !isUsed(it.id)).sort((a, b) => nextPlanned(a.id).date.localeCompare(nextPlanned(b.id).date));
  const used = CAL.filter(it => isUsed(it.id)).sort((a, b) => lastUsed(b.id).localeCompare(lastUsed(a.id)));
  const held = CAL.filter(it => isHeld(it.id) && !isPlanned(it.id) && !isUsed(it.id));
  const T = [["ready", "Ready", avail], ["planned", "On calendar", planned], ["used", "Used", used], ...(HOST && HOST.hold ? [["held", "Held", held]] : [])];
  if (!T.some(x => x[0] === cv.qtab)) cv.qtab = "ready";
  $("#qtabs").replaceChildren(...T.map(([k, name, l]) => {
    const b = h("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(cv.qtab === k), tabindex: cv.qtab === k ? "0" : "-1" }, name + " ", h("span", { class: "n", text: String(l.length) }));
    b.addEventListener("click", () => { cv.qtab = k; renderQueue(); $("#qtabs [aria-selected='true']").focus(); });
    return b;
  }));
  const ro = !db || !canWrite;
  const rows = T.find(x => x[0] === cv.qtab)[2].map(it => {
    let sub, label, act;
    if (cv.qtab === "ready") { sub = kickFor(it) + " · " + it.ctype; label = "Plan"; act = b => openPlanner(it.id, null, b); }
    else if (cv.qtab === "planned") {
      const nx = nextPlanned(it.id);
      sub = "Next: " + fmtDay(nx.date) + " · " + plannedEntries(it.id).filter(e => e.date === nx.date).map(e => PSHORT[e.plat]).join(" ");
      label = "Open"; act = b => { cv.month = monthOf(nx.date); cv.touched = true; renderCal(); openGroup(it.id, nx.date, b); };
    } else if (cv.qtab === "held") { sub = `${shortName(instrOf(it.id))}: no ${evw()} coming up · ${isReady(it.id) ? "ready" : LAB[statusOf(it.id)].toLowerCase()}`; label = "Plan anyway"; act = b => openPlanner(it.id, null, b); }
    else { sub = "Used " + usageText(usedEntries(it.id)); label = "Plan again"; act = b => openPlanner(it.id, null, b); }
    const btn = h("button", { class: "btn small" + (cv.qtab === "ready" ? "" : " ghost"), type: "button", text: label, disabled: ro && cv.qtab !== "planned" });
    btn.addEventListener("click", () => act(btn));
    const qt = h("button", { class: "qthumb", type: "button", "aria-label": "Larger preview of " + it.title }, h("img", { src: thumbSrc(it), alt: "", loading: "lazy" }));
    qt.addEventListener("click", () => openItemPreview(it, 0, qt));
    return h("div", { class: "qitem" }, qt,
      h("div", { style: "min-width:0" }, h("div", { class: "t", text: it.title }), h("div", { class: "s", text: sub })), btn);
  });
  const empty = { ready: "Nothing waiting. Pieces land here once the graphic and every caption are Final.", planned: "Nothing planned yet.", used: "Nothing marked Scheduled or Posted yet.", held: `Nothing on hold. Every ${hostw()} with a post has ${an(evw())} coming up.` }[cv.qtab];
  const nearly = DATA.items.filter(it => statusOf(it.id) === "final" && !isReady(it.id) && !entriesOf(it.id).length).length;
  const extra = cv.qtab === "ready" && nearly ? [h("p", { class: "qnote", text: `${nearly} more ${nearly === 1 ? "piece is" : "pieces are"} Final but still ${nearly === 1 ? "has" : "have"} a caption to mark Final.` })] : [];
  const heldNote = cv.qtab === "held" ? [h("p", { class: "qnote", text: `${cap1(hostw())} posts wait here until that ${hostw()} has ${an(evw())} on the schedule (list as of ${DATA.teachAsOf || "the last check"}). Tell Claude when a new one is added.` })] : [];
  const planAll = cv.qtab === "ready" && avail.length && !ro ? (() => { const b = h("button", { class: "btn small qplan", type: "button", text: `Plan all ${avail.length} for me` }); b.addEventListener("click", () => openAutoPlan(b)); return [b]; })() : [];
  $("#qlist").replaceChildren(...heldNote, ...planAll, ...(rows.length ? rows : [h("p", { class: "qnote", text: empty })]), ...extra);
}

// ----- Threads drafts: Claude drafts Threads posts into the Content Library ("threads" in the db). The owner marks each one
// Final or Draft (with a note), then adds the Final ones to the calendar, where they go on as Suggested text posts (with the photo, if any)
// at the day and time on the card. Once a draft is on the calendar, the calendar entry holds its text. -----
const thd = {};
const thEls = {};
const thv = { open: new Set(), shut: new Set(), sig: "", weeks: {} };
try { const o = JSON.parse(localStorage.getItem("ss-thweeks") || "{}"); (o.open || []).filter(okDate).forEach(d => thv.open.add(d)); (o.shut || []).filter(okDate).forEach(d => thv.shut.add(d)); } catch (e) {}
const blobUrl = p => p && p.blob ? "/_blob/" + p.blob : null;
const thOn = id => calByDraft[id] || null;
const thText = id => { const on = thOn(id); return on ? on.text : ((thd[id] && thd[id].text) || ""); };
const thStatus = id => (thd[id] && thd[id].status) || "review";
const thLive = () => Object.keys(thd).filter(id => !thd[id].archived);
function thFiltered(f) {
  return Object.keys(thd).filter(id => {
    const d = thd[id], on = thOn(id), s = thStatus(id);
    if (f === "archived") return !!d.archived;
    if (d.archived) return false;
    if (f === "all") return true;
    if (f === "ready") return s === "final" && !on;
    if (f === "planned") return !!on && isPending(on.status);
    if (f === "used") return !!on && !isPending(on.status);
    return s === f;
  });
}
const thAddable = id => { const d = thd[id]; return !!d && !d.archived && !thOn(id) && thStatus(id) === "final" && okDate(d.date) && d.date >= today() && okTime(d.time) && thText(id).trim().length > 0 && thText(id).length <= TH_MAX; };
function thIssues(id) {
  const d = thd[id], out = [], on = thOn(id), date = on ? on.date : d.date;
  if (thText(id).length > TH_MAX) out.push(`Over ${TH_MAX} characters, so Threads won't take it.`);
  const fl = flagOf(thText(id)); if (fl) out.push(cap1(fl) + ".");
  if (d.classDate && okDate(date)) {
    const n = daysBetween(date, d.classDate);
    if (n < 0) out.push(`Posts after the ${fmtMD(d.classDate)} ${evw()}.`);
    else if (n < RULES.leadDays) out.push(`Posts ${n} day${n === 1 ? "" : "s"} before the ${fmtMD(d.classDate)} ${evw()} (aim for ${RULES.leadDays}+).`);
  }
  if (!on && okDate(d.date) && d.date < today()) out.push("This day has passed. Pick a new date to add it.");
  return out;
}
function thSave(id, patch, drop) {
  if (!thd[id] || !canWrite) return;
  const next = { ...thd[id], ...patch, updatedAt: new Date().toISOString() };
  (drop || []).forEach(k => delete next[k]);
  thd[id] = next;
  write(id, next, "threads").catch(onWriteError);
}
function thSetStatus(id, s) {
  thSave(id, { status: s });
  const on = thOn(id);
  if (on && isPending(on.status)) patchEntry(on.key, { textSt: s }); else renderThreads();
}
function thSetText(id, text) {
  const on = thOn(id);
  thSave(id, { text });
  if (on && cal[on.key] && cal[on.key].text !== text) patchEntry(on.key, { text });
}
function thAdd(ids, opener) {
  if (!db || !canWrite) return;
  const now = new Date().toISOString(), pairs = [], late = [];
  for (const id of ids) {
    const d = thd[id];
    if (!d || d.archived || thOn(id) || thStatus(id) !== "final") continue;
    if (!thAddable(id)) { late.push(id); continue; }
    const e = { kind: "text", plat: "th", text: thText(id), textSt: "final", date: d.date, time: d.time, status: "suggested", source: "draft", draft: id, createdAt: now, updatedAt: now };
    if (d.photo) e.photo = { ...d.photo };
    if (d.classDate) e.classDate = d.classDate;
    pairs.push([`text__th__${id}`, e]);
  }
  if (pairs.length) putEntries(pairs);
  const n = pairs.length;
  toast(n ? `Added ${n} Threads post${n === 1 ? "" : "s"} to the calendar as Suggested` + (late.length ? `. ${late.length} need a new date first.` : ".")
    : late.length ? "Check the date and text first: that day has passed or the post is too long." : "Mark posts Final to add them.");
}
function thArchive(id, on) {
  const e = thOn(id);
  if (on && e && isPending(e.status)) dropEntries([e.key]);
  thSave(id, on ? { archived: true, archivedAt: new Date().toISOString() } : { archived: false }, on ? [] : ["archivedAt"]);
  toast(on ? "Archived. Find it under the Archived filter." : "Back with the Threads drafts.");
  renderThreads();
}
function thDropPhoto(id) {
  thSave(id, {}, ["photo"]);
  const e = thOn(id);
  if (e && cal[e.key] && cal[e.key].photo) { const n = { ...cal[e.key], updatedAt: new Date().toISOString() }; delete n.photo; putEntries([[e.key, n]]); }
  else renderThreads();
  toast("Photo removed. It posts as text only.");
}
function thCard(id) {
  const kind = h("span", { class: "thkind" }), slot = h("span", { class: "thslot" }), badge = h("span", { class: "thbadge" });
  const ph = h("div", { class: "thph" });
  const ta = h("textarea", { class: "thtext", id: "tht-" + id, rows: "6", "aria-label": "Threads post text" });
  const meter = h("span", { class: "meter" }), saved = h("span", { class: "saved muted" });
  const upd = () => { const n = ta.value.length; meter.textContent = `${n} / ${TH_MAX}`; meter.classList.toggle("over", n > TH_MAX); };
  let tmr = null;
  const flush = () => { if (!tmr) return; clearTimeout(tmr); tmr = null; if (ta.value !== thText(id)) { thSetText(id, ta.value); saved.textContent = "Saved"; } };
  ta.addEventListener("input", () => { upd(); saved.textContent = ""; clearTimeout(tmr); tmr = setTimeout(() => { tmr = null; thSetText(id, ta.value); saved.textContent = "Saved"; }, 800); });
  ta.addEventListener("blur", flush);
  const warn = h("p", { class: "warn", hidden: true }), claude = h("p", { class: "claude", hidden: true });
  const segD = h("button", { type: "button", role: "radio", "data-s": "draft", "aria-checked": "false", text: "DRAFT" });
  const segF = h("button", { type: "button", role: "radio", "data-s": "final", "aria-checked": "false", text: "FINAL" });
  [segD, segF].forEach(b => b.addEventListener("click", () => { flush(); thSetStatus(id, thStatus(id) === b.dataset.s ? "review" : b.dataset.s); }));
  const seg = h("div", { class: "seg", role: "radiogroup", "aria-label": "Status for this Threads post" }, segD, segF);
  const note = h("textarea", { id: "thn-" + id, rows: "2", placeholder: "What should change?" });
  const nsaved = h("span", { class: "saved" });
  let nt = null;
  const nflush = () => { clearTimeout(nt); nt = null; if ((thd[id].note || "") !== note.value) { thSave(id, { note: note.value }); nsaved.textContent = db ? "Saved" : ""; } };
  note.addEventListener("input", () => { nsaved.textContent = ""; clearTimeout(nt); nt = setTimeout(nflush, 1100); });
  note.addEventListener("blur", nflush);
  const notes = h("div", { class: "notes" }, h("label", { for: "thn-" + id }, h("span", { text: "Notes for Claude" }), nsaved), note);
  const di = h("input", { type: "date", "aria-label": "Post date" }), ti = h("input", { type: "time", "aria-label": `Post time, ${TZ}` });
  di.addEventListener("change", () => { if (okDate(di.value)) { thSave(id, { date: di.value }); renderThreads(); } });
  ti.addEventListener("change", () => { if (okTime(ti.value)) { thSave(id, { time: ti.value.slice(0, 5) }); renderThreads(); } });
  const when = h("div", { class: "thwhen", hidden: true }, di, ti);
  const whenB = h("button", { class: "linkbtn", type: "button", text: "Change day or time" });
  whenB.addEventListener("click", () => { when.hidden = !when.hidden; whenB.hidden = !when.hidden; if (!when.hidden) di.focus(); });
  const add = h("button", { class: "btn small", type: "button", text: "Add to calendar" });
  add.addEventListener("click", () => { flush(); thAdd([id], add); });
  const hint = h("span", { class: "hint", text: "Mark Final to add" });
  const calline = h("div", { class: "thcal", hidden: true });
  const foot = h("div", { class: "thfoot" }, add, hint, whenB, when, calline);
  const rmPh = h("button", { class: "linkbtn", type: "button", text: "Remove photo" });
  rmPh.addEventListener("click", () => thDropPhoto(id));
  const arch = h("button", { class: "linkbtn", type: "button", text: "Archive" });
  arch.addEventListener("click", () => thArchive(id, !thd[id].archived));
  const card = h("article", { class: "thcard", "data-id": id, "data-s": "review" },
    h("div", { class: "thtop" }, kind, slot, badge), ph, ta, h("div", { class: "thmeter" }, meter, saved), warn, claude, seg, notes, foot,
    h("div", { class: "archrow" }, rmPh, arch));
  thEls[id] = { card, kind, slot, badge, ph, ta, upd, warn, claude, segD, segF, note, di, ti, when, whenB, add, hint, calline, rmPh, arch, phKey: null };
  return card;
}
function updThCard(id) {
  const d = thd[id], x = thEls[id]; if (!d || !x) return;
  const on = thOn(id), s = thStatus(id), ro = !db || !canWrite;
  x.card.dataset.s = s; x.card.classList.toggle("oncal", !!on); x.card.classList.toggle("archived", !!d.archived);
  x.kind.textContent = TH_KIND[d.kind] || TH_KIND.post; x.kind.className = "thkind " + (TH_KIND_KEYS.includes(d.kind) ? "k" + (TH_KIND_KEYS.indexOf(d.kind) % 8) : "k-post");
  const date = on ? on.date : d.date, time = on ? on.time : d.time;
  x.slot.textContent = okDate(date) ? `${fmtDay(date)} · ${okTime(time) ? fmtTime(time) : ""}` : "No date yet";
  x.badge.className = "thbadge " + s; x.badge.textContent = LABEL[s];
  const pk = d.photo ? d.photo.blob : "";
  if (pk !== x.phKey) {
    x.phKey = pk;
    if (d.photo) {
      const img = h("img", { src: blobUrl(d.photo), alt: d.photo.title || "Photo for this post", loading: "lazy" });
      const b = h("button", { class: "thphb", type: "button", "aria-label": "Larger photo" }, img);
      b.addEventListener("click", () => openLightbox([{ type: "img", src: blobUrl(d.photo), alt: d.photo.title || "" }], d.photo.title || "Photo", 0, b));
      x.ph.replaceChildren(b, h("span", { class: "phn", text: (d.photo.num != null ? "#" + d.photo.num + " · " : "") + "Asset Library" }));
    } else x.ph.replaceChildren();
  }
  x.ph.hidden = !d.photo; x.rmPh.hidden = !d.photo || ro || (on && !isPending(on.status));
  if (document.activeElement !== x.ta) { x.ta.value = thText(id); x.upd(); x.ta.rows = Math.min(16, x.ta.value.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 34)), 0) + 1); }
  x.ta.disabled = ro || (on && !isPending(on.status));
  if (document.activeElement !== x.note) x.note.value = d.note || "";
  x.note.disabled = ro;
  x.segD.setAttribute("aria-checked", String(s === "draft")); x.segF.setAttribute("aria-checked", String(s === "final"));
  x.segD.disabled = x.segF.disabled = ro;
  const iss = thIssues(id);
  x.warn.hidden = !iss.length; x.warn.textContent = iss.join(" ");
  x.claude.hidden = !d.claude; if (d.claude) x.claude.replaceChildren(h("b", { text: "Claude: " }), d.claude);
  if (document.activeElement !== x.di) x.di.value = d.date || "";
  if (document.activeElement !== x.ti) x.ti.value = d.time || "";
  x.di.disabled = x.ti.disabled = ro;
  if (on) x.when.hidden = true;
  x.whenB.hidden = !!on || !!d.archived || ro || !x.when.hidden;
  x.add.hidden = !!on || !!d.archived; x.add.disabled = ro || !thAddable(id);
  x.hint.hidden = !!on || !!d.archived || s === "final";
  x.calline.hidden = !on;
  if (on) {
    const open = h("button", { class: "linkbtn", type: "button", text: "Open in calendar" });
    open.addEventListener("click", () => openText(on.key, null, open));
    x.calline.replaceChildren(h("span", { class: "utag planned", text: "ON CALENDAR" }), ` ${STLAB[on.status]} · `, open);
  }
  x.arch.textContent = d.archived ? "Restore" : "Archive"; x.arch.disabled = ro; x.arch.hidden = !db;
}
function thWeekToggle(ws, open) {
  if (open) { thv.open.add(ws); thv.shut.delete(ws); } else { thv.shut.add(ws); thv.open.delete(ws); }
  try { localStorage.setItem("ss-thweeks", JSON.stringify({ open: [...thv.open], shut: [...thv.shut] })); } catch (e) {}
}
function renderThreads() { renderThreadsSec(); updateTabs(); }
function renderThreadsSec() {
  const root = $("#threads-sec"); if (!root) return;
  if (ltab !== "threads") { root.hidden = true; return; }
  const arch = filter === "archived";
  const ids = thFiltered(filter)
    .sort((a, b) => ((thOn(a) || thd[a]).date + (thOn(a) || thd[a]).time).localeCompare((thOn(b) || thd[b]).date + (thOn(b) || thd[b]).time) || a.localeCompare(b));
  const live = thLive();
  root.hidden = false;
  ids.forEach(id => { if (!thEls[id]) thCard(id); });
  const wsOf = id => sunOf((thOn(id) || thd[id]).date || today());
  const weeks = {}; ids.forEach(id => (weeks[wsOf(id)] ||= []).push(id));
  const sig = filter + "|" + Object.entries(weeks).map(([w, l]) => w + ":" + l.join(",")).join("|");
  const n = s => live.filter(id => thStatus(id) === s && !thOn(id)).length, onCal = live.filter(thOn).length;
  const addable = live.filter(thAddable);
  const addAll = h("button", { class: "btn", type: "button", text: addable.length ? `Add ${addable.length} Final post${addable.length === 1 ? "" : "s"} to the calendar` : "Add Final posts to the calendar", disabled: !addable.length || !db || !canWrite });
  addAll.addEventListener("click", () => thAdd(addable, addAll));
  const head = h("div", { class: "ghead" },
    h("div", { class: "grow" }, h("h2", { id: "h-threads", text: arch ? "Threads · archived" : "Threads" }),
      h("p", { text: arch ? "Threads drafts you archived. Restore one to bring it back." : "Text and photo posts written for open Threads slots, around the Threads posts already on the calendar. Mark each one Final, or Draft with a note, then add the Final ones. They go on the calendar as Suggested at the day and time shown." })),
    h("span", { class: "gcount", text: arch ? `${ids.length} archived` : `${n("review")} to review · ${n("draft")} draft · ${n("final")} final · ${onCal} on calendar` }), arch ? null : addAll);
  if (sig !== thv.sig || !root.firstChild) {
    thv.sig = sig; thv.weeks = {};
    const blocks = !ids.length ? [h("p", { class: "lempty", text: Object.keys(thd).length ? `No Threads posts under ${SFILTERS.find(x => x[0] === filter)[1]} right now.` : "No Threads drafts yet. Ask Claude to write some." })] : Object.keys(weeks).sort().map(ws => {
      const meta = h("span", { class: "thmeta" }), goal = h("span", { class: "thgoal" }), wadd = h("button", { class: "btn small ghost", type: "button" });
      wadd.addEventListener("click", e => { e.preventDefault(); thAdd(weeks[ws].filter(thAddable), wadd); });
      const needs = weeks[ws].some(id => !thOn(id) && thStatus(id) !== "final");
      const open = thv.open.has(ws) || (!thv.shut.has(ws) && (needs || filter !== "all"));
      const det = h("details", { class: "thweek", open: open ? true : null },
        h("summary", {}, h("span", { class: "wl", text: `${fmtMD(ws)} – ${fmtMD(addDays(ws, 6))}` }), meta, goal, wadd, h("span", { class: "chev", "aria-hidden": "true", text: "›" })),
        h("div", { class: "thgrid" }, weeks[ws].map(id => thEls[id].card)));
      let first = true;
      det.addEventListener("toggle", () => { if (first && det.open === open) { first = false; return; } first = false; thWeekToggle(ws, det.open); });
      thv.weeks[ws] = { meta, goal, wadd };
      return det;
    });
    root.replaceChildren(head, ...blocks);
  } else root.replaceChild(head, root.firstChild);
  for (const [ws, w] of Object.entries(thv.weeks)) {
    const l = weeks[ws] || [], fin = l.filter(id => thStatus(id) === "final").length, oc = l.filter(thOn).length;
    w.meta.textContent = `${l.length} post${l.length === 1 ? "" : "s"} · ${fin} final · ${oc} on calendar`;
    const now = weekStats(ws).th, pend = arch ? 0 : l.filter(id => !thOn(id)).length;
    w.goal.textContent = arch ? "" : `Threads this week: ${now} on the calendar${pend ? `, ${now + pend} with these` : ""} · minimum ${RULES.th}`;
    w.goal.className = "thgoal " + (now >= RULES.th ? "ok" : now + pend >= RULES.th ? "near" : "short");
    const wa = l.filter(thAddable);
    w.wadd.hidden = arch || !wa.length || !db || !canWrite; w.wadd.textContent = `Add ${wa.length} Final`;
  }
  ids.forEach(updThCard);
}

// ----- Instagram grid preview: newest first like the profile; tap two posts (or drag one onto another) to swap their days -----
const IC_REEL = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>';
const IC_CAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 3h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-5 5a1 1 0 0 1 1 1v10a1 1 0 0 0 1 1h10a1 1 0 1 1 0 2H5a3 3 0 0 1-3-3V9a1 1 0 0 1 1-1z"/></svg>';
const IC_LOCK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3z"/></svg>';
const gv = { sel: null, label: "dates", undo: null, moved: [] };
try { const l = localStorage.getItem("ss-iglabel"); if (["dates", "types", "off"].includes(l)) gv.label = l; } catch (e) {}
const igCover = it => thumbSrc(it);
function igFeed() {
  return Object.entries(cal).filter(([, e]) => validEntry(e) && !isText(e) && e.plat === "ig").map(([k, e]) => ({ key: k, ...e }))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
function igIssues(e, feed) {
  const it = byId[e.item], out = [];
  const li = leadIssue(e.item, e.date); if (li) out.push(`Posts ${li.replace(/^posts /, "")}.`);
  if (isHeld(e.item, e.date)) out.push(heldWhy(e.item, e.date) + ".");
  if (it.soldout) out.push(it.soldout + ".");
  const i = feed.findIndex(x => x.key === e.key), older = feed[i + 1], newer = feed[i - 1];
  if (older && byId[older.item].ctype === it.ctype) out.push(`Right after another ${it.ctype.toLowerCase()} post (${byId[older.item].title}).`);
  if (newer && byId[newer.item].ctype === it.ctype) out.push(`Right before another ${it.ctype.toLowerCase()} post (${byId[newer.item].title}).`);
  if (isPending(e.status) && !isReady(e.item)) out.push("The graphic or a caption isn't Final yet.");
  const fl = isPending(e.status) ? flagOf(capOf(e.item, "ig")) : null; if (fl) out.push(`The caption ${fl}.`);
  return out;
}
// Everything that goes out with this Instagram post: its other feed, Threads and video-platform entries (those can sit a few days later).
const igGroup = e => entriesOf(e.item).filter(x => x.plat !== "st" && x.date >= e.date && daysBetween(e.date, x.date) <= 3);
function swapIg(aKey, bKey) {
  const a = cal[aKey] && { key: aKey, ...cal[aKey] }, b = cal[bKey] && { key: bKey, ...cal[bKey] };
  if (!a || !b || aKey === bKey) return;
  const ga = igGroup(a), gb = igGroup(b), stuck = [...ga, ...gb].find(x => !isPending(x.status));
  if (stuck) { toast(`${byId[stuck.item].title} is already ${STLAB[stuck.status].toLowerCase()} on ${PNAME[stuck.plat]}. Only Suggested and Locked posts can move.`); return; }
  const d = daysBetween(a.date, b.date), now = new Date().toISOString(), mine = new Set([...ga, ...gb].map(x => x.key));
  const taken = {};
  Object.entries(cal).filter(([k, x]) => validEntry(x) && PDEFS[x.plat].videoOnly && !mine.has(k)).forEach(([, x]) => (taken[x.plat] ||= new Set()).add(x.date));
  const move = (x, delta) => {
    let nd = addDays(x.date, delta);
    if (PDEFS[x.plat].videoOnly) { const tk = (taken[x.plat] ||= new Set()); nd = laterDate(x.plat, nd); for (let i = 0; i < 4 && tk.has(nd); i++) nd = laterDate(x.plat, addDays(nd, 1)); tk.add(nd); }
    return [x.key, { ...cal[x.key], date: nd, updatedAt: now }];
  };
  gv.undo = { pairs: [...ga, ...gb].map(x => [x.key, { ...cal[x.key] }]), text: `${byId[a.item].title} and ${byId[b.item].title}` };
  gv.moved = [aKey, bKey]; gv.sel = null;
  putEntries([...ga.map(x => move(x, d)), ...gb.map(x => move(x, -d))]);
  toast(`Swapped: ${byId[a.item].title} is now ${fmtMD(b.date)}, ${byId[b.item].title} is now ${fmtMD(a.date)}`);
}
function renderIgCard() {
  const host = $("#igcard"), prevScroll = (host.querySelector(".igscroll") || {}).scrollTop || 0;
  const feed = igFeed(), ro = !db || !canWrite;
  const selE = gv.sel && cal[gv.sel] ? { key: gv.sel, ...cal[gv.sel] } : (gv.sel = null);
  const grid = h("div", { class: "iggrid", role: "list", "aria-label": "Instagram grid, newest first" });
  for (const e of feed) {
    const it = byId[e.item], iss = igIssues(e, feed);
    const lab = gv.label === "off" ? null : h("span", { class: "dc " + e.status }, gv.label === "types" ? it.ctype : fmtMD(e.date));
    if (lab && e.status === "locked") lab.insertAdjacentHTML("afterbegin", IC_LOCK);
    const ic = it.kind === "reel" || it.kind === "wide" ? IC_REEL : it.kind === "carousel" ? IC_CAR : "";
    const t = h("button", { class: "igt" + (gv.moved.includes(e.key) ? " moved" : ""), type: "button", role: "listitem", draggable: ro ? null : "true", "aria-pressed": String(gv.sel === e.key),
      "aria-label": `${fmtDay(e.date)}: ${it.title}, ${it.ctype.toLowerCase()}, ${STLAB[e.status].toLowerCase()}${iss.length ? ". " + iss.join(" ") : ""}`, title: `${fmtDay(e.date)} · ${it.title}${iss.length ? "\n⚠ " + iss.join("\n⚠ ") : ""}` },
      h("img", { src: igCover(it), alt: "", loading: "lazy" }), lab, iss.length ? h("span", { class: "wn", "aria-hidden": "true", text: "!" }) : null);
    if (ic) { const s = h("span", { class: "ic" }); s.innerHTML = ic; t.append(s); }
    t.addEventListener("click", () => {
      if (gv.sel && gv.sel !== e.key) { if (ro) return; swapIg(gv.sel, e.key); return; }
      gv.sel = gv.sel === e.key ? null : e.key; gv.moved = []; renderIgCard();
      const again = document.querySelector(`.igt[aria-pressed="true"]`); if (again) again.focus();
    });
    t.addEventListener("dragstart", ev => { ev.dataTransfer.setData("text/plain", e.key); ev.dataTransfer.effectAllowed = "move"; });
    t.addEventListener("dragover", ev => { ev.preventDefault(); t.classList.add("over"); });
    t.addEventListener("dragleave", () => t.classList.remove("over"));
    t.addEventListener("drop", ev => { ev.preventDefault(); t.classList.remove("over"); const k = ev.dataTransfer.getData("text/plain"); if (k && k !== e.key) swapIg(k, e.key); });
    grid.append(t);
  }
  if (!feed.length) grid.append(h("p", { class: "empty-cal", style: "grid-column:1/-1;margin:12px", text: "No Instagram posts on the calendar yet." }));
  const first = feed.length ? feed[feed.length - 1].date : null, last = feed.length ? feed[0].date : null;
  const labSeg = h("div", { class: "seg iglab", role: "radiogroup", "aria-label": "Labels on the grid" });
  [["dates", "DATES"], ["types", "TYPES"], ["off", "OFF"]].forEach(([k, txt]) => {
    const b = h("button", { type: "button", role: "radio", "aria-checked": String(gv.label === k), text: txt });
    b.addEventListener("click", () => { gv.label = k; try { localStorage.setItem("ss-iglabel", k); } catch (e) {} renderIgCard(); });
    labSeg.append(b);
  });
  let box;
  if (selE) {
    const it = byId[selE.item], iss = igIssues(selE, feed);
    const open = h("button", { class: "btn ghost small", type: "button", text: "Open post" });
    open.addEventListener("click", () => openGroup(selE.item, selE.date, open));
    const cancel = h("button", { class: "linkbtn", type: "button", text: "Cancel" });
    cancel.addEventListener("click", () => { gv.sel = null; renderIgCard(); });
    box = h("div", { class: "igsel", "aria-live": "polite" },
      h("div", { class: "t", text: it.title }),
      h("div", { text: `${fmtDay(selE.date)} · ${it.ctype} · ${STLAB[selE.status]}` }),
      ...iss.map(x => h("p", { class: "warn", style: "margin:0", text: x })),
      h("div", { style: "font-weight:700", text: ro ? "You can view the grid but not move posts." : "Now tap the post to swap it with, or drag this one onto it." }),
      h("div", { class: "row" }, open, cancel));
  } else if (gv.undo) {
    const u = h("button", { class: "btn ghost small", type: "button", text: "Undo swap" });
    u.addEventListener("click", () => { const pairs = gv.undo.pairs; gv.moved = pairs.filter(([, v]) => v.plat === "ig").map(([k]) => k); gv.undo = null; putEntries(pairs); toast("Swap undone"); });
    box = h("div", { class: "igsel", "aria-live": "polite" }, h("div", { text: "Swapped " + gv.undo.text + "." }), h("div", { class: "row" }, u));
  } else {
    box = h("div", { class: "igsel", "aria-live": "polite" },
      h("div", { text: ro ? "Tap a post to see its details." : `Tap a post, then tap another to swap their days (or drag one onto another).${PK.filter(k => k !== "ig" && k !== "st").length ? ` ${listJoin(PK.filter(k => k !== "ig" && k !== "st").map(k => PNAME[k]))} move with it.` : ""}` }));
  }
  const nWarn = feed.filter(e => igIssues(e, feed).length).length;
  const scroller = h("div", { class: "igscroll" }, grid);
  host.replaceChildren(
    h("div", {}, h("h3", { id: "ig-h", text: "Instagram grid" }), h("p", { class: "igsub", text: feed.length ? `Newest first, like your profile · ${feed.length} posts, ${fmtMD(first)} – ${fmtMD(last)}` : "Newest first, like your profile" })),
    labSeg, box, scroller,
    h("p", { class: "igfoot", text: (nWarn ? `${nWarn} post${nWarn === 1 ? " has" : "s have"} a flag (the yellow !). ` : "") + "Tiles are cropped to Instagram's 3:4 grid. Only Suggested and Locked posts can move." }));
  scroller.scrollTop = prevScroll;
}

// ----- Ideas page: make-now list, ideas-for-later with a checkable shot list; all rows live in the db -----
const ideas = {}, shots = {};
const iv = { tab: "now", showDone: false, open: new Set(), showDeclined: false };
// Ideas for later wait for the owner's approval. Only approved ideas put their shots on the Shot list.
const approvalOf = d => (d && d.approval) || "pending";
const catCls = d => { const m = /^([A-H])/i.exec(String((d && d.num) || "")); return m ? " cat-" + m[1].toLowerCase() : ""; };
function setApproval(id, a) {
  if (!ideas[id] || !db || !canWrite) return;
  const now = new Date().toISOString(), d = { ...ideas[id], approval: a, updatedAt: now };
  if (a === "approved") d.approvedAt = now; else if (a === "declined") d.declinedAt = now;
  ideas[id] = d; if (a === "approved") iv.open.add(id); renderIdeas();
  write(id, d, "ideas").catch(onWriteError);
  const n = shotsOf(id).length;
  toast(a === "approved" ? (n ? `Approved. ${n} shot${n === 1 ? " is" : "s are"} on your Shot list now.` : "Approved. Add the shots it needs in the open card.") : a === "declined" ? "Declined. It's under Show declined at the bottom." : "Back to waiting on you. Its shots left the Shot list.");
}
function ideaRow(d) {
  const ro = !db || !canWrite, list = shotsOf(d.id), done = list.filter(x => x.done).length, ap = approvalOf(d);
  const ready = ap === "approved" && list.length && done === list.length;
  const stTxt = ap === "pending" ? "Waiting on you" : ap === "declined" ? "Declined" : ready ? "Ready to build" : list.length ? `Approved · ${done} of ${list.length}` : "Approved";
  const body = [];
  if (d.pitch) body.push(h("p", { text: d.pitch }));
  if (d.needs) body.push(h("p", { class: "needs", text: "Needs: " + d.needs }));
  // The idea row only lists what the idea needs; shots get checked off on the Shot list tab.
  const reqList = l => h("ul", { class: "ireq" }, l.map(x => h("li", { class: x.done ? "got" : null }, x.kind === "input" ? h("span", { class: "skind", text: "Info" }) : null, x.text, x.done ? h("span", { class: "gotmark", text: " · got it" }) : null, x.tip ? h("span", { class: "stip", text: x.tip }) : null)));
  if (ap === "approved") {
    body.push(h("h4", { class: "ish", text: list.length ? `On your Shot list · ${done} of ${list.length} done` : "Shot list" }));
    if (list.length) {
      body.push(h("div", { class: "iprog", "aria-hidden": "true" }, h("i", { style: `width:${Math.round(done / list.length * 100)}%` })), reqList(list));
      const gs = h("button", { class: "linkbtn", type: "button", text: "Check them off on the Shot list" });
      gs.addEventListener("click", () => { iv.tab = "shots"; try { localStorage.setItem("ss-ideastab", "shots"); } catch (e) {} renderIdeas(); window.scrollTo(0, 0); });
      body.push(h("p", { class: "needs" }, gs));
    } else body.push(h("p", { class: "needs", text: "No shots yet. Add what you'd need to shoot or find." }));
    if (!ro) {
      const inp = h("input", { type: "text", placeholder: "Add another shot this idea needs", "aria-label": "Add a shot to " + d.title });
      const add = h("button", { class: "btn ghost small", type: "button", text: "Add" });
      const go = () => {
        const text = inp.value.trim(); if (!text) return;
        const id = `${d.id}__k${Date.now().toString(36)}`, now = new Date().toISOString();
        shots[id] = { idea: d.id, text, kind: "shot", when: DEFAULT_WHEN(), done: false, order: 900 + list.length, source: "katy", createdAt: now, updatedAt: now };
        write(id, shots[id], "shots").catch(onWriteError); inp.value = ""; renderIdeas();
      };
      add.addEventListener("click", go); inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      body.push(h("div", { class: "sadd" }, inp, add));
    }
    if (ready) body.push(h("p", { class: "needs", style: "color:var(--ink);font-weight:700", text: "Everything's checked. Tell Claude this one is ready to build." }));
  } else if (list.length) {
    body.push(h("h4", { class: "ish", text: ap === "declined" ? "It would have needed" : `What it would take · ${list.length} shot${list.length === 1 ? "" : "s"}` }), reqList(list));
    if (ap === "pending") body.push(h("p", { class: "needs", text: "Approve the idea and all of these go on your Shot list together." }));
  }
  const acts = [];
  if (!ro) {
    const btn = (label, cls, a) => { const b = h("button", { class: "btn small" + cls, type: "button", text: label }); b.addEventListener("click", () => setApproval(d.id, a)); return b; };
    if (ap === "pending") acts.push(btn("Approve idea", "", "approved"), btn("Decline idea", " ghost", "declined"));
    else if (ap === "approved") acts.push(btn("Decline idea", " ghost", "declined"), btn("Undo approval", " ghost", "pending"));
    else acts.push(btn("Restore", " ghost", "pending"));
  }
  if (acts.length) body.push(h("div", { class: "iacts" }, acts));
  const det = h("details", { class: "irow " + ap + (ready ? " ready" : "") + catCls(d), open: iv.open.has(d.id) ? true : null },
    h("summary", {}, d.num ? h("span", { class: "num", text: d.num }) : null, h("span", { class: "ititle", text: d.title }),
      d.format ? h("span", { class: "fmt", text: d.format }) : null, h("span", { class: "ist " + (ready ? "ready" : ap), text: stTxt }), h("span", { class: "chev", "aria-hidden": "true", text: "›" })),
    h("div", { class: "ibody" }, body));
  det.addEventListener("toggle", () => { if (det.open) iv.open.add(d.id); else iv.open.delete(d.id); });
  return det;
}
try { const t = localStorage.getItem("ss-ideastab"); if (["now", "later", "shots", "built"].includes(t)) iv.tab = t; } catch (e) {}
const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.title || a.text).localeCompare(String(b.title || b.text));
const ideaList = st => Object.entries(ideas).map(([id, d]) => ({ id, ...d })).filter(d => st.includes(d.status)).sort(byOrder);
const shotsOf = id => Object.entries(shots).map(([k, d]) => ({ id: k, ...d })).filter(x => x.idea === id).sort(byOrder);
function setShot(id, done) {
  const now = new Date().toISOString(), d = { ...shots[id], done, updatedAt: now };
  if (done) d.doneAt = now; else delete d.doneAt;
  shots[id] = d; renderIdeas();
  write(id, d, "shots").catch(onWriteError);
}
function shotRow(x, withIdea) {
  const ro = !db || !canWrite;
  const cb = h("input", { type: "checkbox", checked: x.done ? true : null, disabled: ro ? true : null, "aria-label": x.text });
  cb.addEventListener("change", () => setShot(x.id, cb.checked));
  const idea = ideas[x.idea];
  return h("li", { class: "sitem" + (x.done ? " done" : "") }, cb,
    h("label", {}, h("span", { class: "stext" }, x.kind === "input" ? h("span", { class: "skind", text: "Info" }) : null, x.text),
      x.tip ? h("span", { class: "stip", text: x.tip }) : null,
      withIdea && idea ? h("span", { class: "sfor", text: "For: " + (idea.num ? idea.num + " · " : "") + idea.title }) : null));
}
function ideaCard(d) {
  const ro = !db || !canWrite, list = shotsOf(d.id), done = list.filter(x => x.done).length;
  const ready = d.status === "later" && list.length && done === list.length;
  const stTxt = d.status === "built" ? "Built" : d.status === "done" ? "Posted" : d.status === "now" ? "Next up" : ready ? "Ready to build" : `${done} of ${list.length} done`;
  const card = h("article", { class: "icard" + catCls(d) },
    h("div", { class: "itop" }, d.num ? h("span", { class: "num", text: d.num }) : null, h("span", { class: "fmt", text: d.format || "" }),
      h("span", { class: "ist " + (ready ? "ready" : d.status), text: stTxt })),
    h("h3", { text: d.title }), d.pitch ? h("p", { text: d.pitch }) : null,
    d.needs ? h("p", { class: "needs", text: (d.status === "later" ? "Needs: " : "") + d.needs }) : null);
  if (d.status === "built" && d.item && byId[d.item]) {
    const b = h("button", { class: "btn ghost small", type: "button", text: "Preview" });
    b.addEventListener("click", () => openItemPreview(byId[d.item], 0, b));
    const g = h("button", { class: "linkbtn", type: "button", text: "Open in the library" });
    g.addEventListener("click", () => { setView("library"); requestAnimationFrame(() => { const el = els[d.item] && els[d.item].card; if (el && !el.hidden) el.scrollIntoView({ block: "center" }); }); });
    card.append(h("div", { class: "row", style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" }, b, g));
  }
  if (d.status === "later") {
    card.append(h("div", { class: "iprog", "aria-hidden": "true" }, h("i", { style: `width:${list.length ? Math.round(done / list.length * 100) : 0}%` })));
    card.append(h("ul", { class: "slist" }, list.map(x => shotRow(x, false))));
    if (!ro) {
      const inp = h("input", { type: "text", placeholder: "Add another shot this idea needs", "aria-label": "Add a shot to " + d.title });
      const add = h("button", { class: "btn ghost small", type: "button", text: "Add" });
      const go = () => {
        const text = inp.value.trim(); if (!text) return;
        const id = `${d.id}__k${Date.now().toString(36)}`, now = new Date().toISOString();
        shots[id] = { idea: d.id, text, kind: "shot", when: DEFAULT_WHEN(), done: false, order: 900 + list.length, source: "katy", createdAt: now, updatedAt: now };
        write(id, shots[id], "shots").catch(onWriteError); inp.value = ""; renderIdeas();
      };
      add.addEventListener("click", go); inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
      card.append(h("div", { class: "sadd" }, inp, add));
    }
    if (ready) card.append(h("p", { class: "needs", style: "color:var(--ink);font-weight:700", text: "Everything's checked. Tell Claude this one is ready to build." }));
  }
  return card;
}
function newIdeaForm() {
  if (!db || !canWrite) return null;
  const t = h("input", { type: "text", placeholder: "Idea name", "aria-label": "Idea name" });
  const n = h("textarea", { placeholder: "What is it? What would you need to shoot or find?", "aria-label": "Idea notes" });
  const b = h("button", { class: "btn small", type: "button", text: "Add idea" });
  b.addEventListener("click", () => {
    const title = t.value.trim(); if (!title) { toast("Give the idea a name first"); t.focus(); return; }
    const id = "k" + Date.now().toString(36), now = new Date().toISOString();
    ideas[id] = { title, pitch: n.value.trim(), status: "later", approval: "approved", approvedAt: now, format: "", order: 900, source: "katy", createdAt: now, updatedAt: now };
    iv.open.add(id); write(id, ideas[id], "ideas").catch(onWriteError); toast("Added and approved. Add its shots in the open card."); renderIdeas();
  });
  return h("div", { class: "newidea" }, h("b", { text: "Add your own idea" }), t, n, h("div", {}, b));
}
function renderIdeas() {
  if (cv.view !== "ideas") return;
  // Built ideas leave Make now for the Built archive.
  const now = ideaList(["now"]), built = ideaList(["built", "done"]), later = ideaList(["later"]);
  const open = Object.values(shots).filter(x => !x.done && ideas[x.idea] && ideas[x.idea].status === "later" && approvalOf(ideas[x.idea]) === "approved").length;
  const T = [["now", "Make now", now.length], ["later", "Ideas for later", later.length], ["shots", "Shot list", open], ["built", "Built", built.length]];
  $("#ideas-tabs").replaceChildren(...T.map(([k, name, n]) => {
    const b = h("button", { class: "chip", type: "button", role: "radio", "aria-checked": String(iv.tab === k) }, name, h("span", { class: "n", text: String(n) }));
    b.addEventListener("click", () => { iv.tab = k; try { localStorage.setItem("ss-ideastab", k); } catch (e) {} renderIdeas(); });
    return b;
  }));
  const body = $("#ideas-body");
  if (!Object.keys(ideas).length) { body.replaceChildren(h("p", { class: "empty-cal", text: db ? "No ideas yet. Claude adds them here." : "Open this page in Claude to see the idea list." }), ...(newIdeaForm() ? [h("div", { style: "margin-top:14px" }, newIdeaForm())] : [])); return; }
  if (iv.tab === "now") body.replaceChildren(now.length ? h("div", { class: "igrid2" }, now.map(ideaCard)) : h("p", { class: "empty-cal", text: "Nothing waiting to be made. Built ideas move to the Built tab." }));
  else if (iv.tab === "built") body.replaceChildren(h("p", { class: "qnote", style: "margin:0 0 12px", text: "Ideas Claude has made. Each one is in the Content Library; open it there to review or plan it." }), built.length ? h("div", { class: "igrid2" }, built.map(ideaCard)) : h("p", { class: "empty-cal", text: "Nothing built yet." }));
  else if (iv.tab === "later") {
    const grp = a => later.filter(d => approvalOf(d) === a);
    const wait = grp("pending"), ok = grp("approved"), no = grp("declined");
    const dtog = h("button", { class: "linkbtn", type: "button", text: iv.showDeclined ? "Hide declined" : `Show declined (${no.length})` });
    dtog.addEventListener("click", () => { iv.showDeclined = !iv.showDeclined; renderIdeas(); });
    body.replaceChildren(...[
      h("p", { class: "gnote", style: "margin:0 0 12px", text: "Tap an idea to see what it would take. Approve it to put its shots on the Shot list; decline it to clear it away." }),
      h("section", { class: "isec" }, h("h3", { text: `Waiting on you · ${wait.length}` }), wait.length ? h("div", { class: "ilist" }, wait.map(ideaRow)) : h("p", { class: "needs", text: "Nothing waiting. Ask Claude for more ideas on the Ask Claude page." })),
      h("section", { class: "isec s-ok" }, h("h3", { text: `Approved · ${ok.length}` }), ok.length ? h("div", { class: "ilist" }, ok.map(ideaRow)) : h("p", { class: "needs", text: "Nothing approved yet." })),
      no.length ? h("section", { class: "isec" }, h("p", { class: "gnote", style: "margin:0" }, dtog), iv.showDeclined ? h("div", { class: "ilist" }, no.map(ideaRow)) : null) : null,
      newIdeaForm()].filter(Boolean));
  }
  else {
    const all = Object.entries(shots).map(([k, d]) => ({ id: k, ...d })).filter(x => ideas[x.idea] && ideas[x.idea].status === "later" && approvalOf(ideas[x.idea]) === "approved" && (iv.showDone || !x.done));
    const groups = [...WHEN_ORDER, ...new Set(all.map(x => x.when).filter(w => !WHEN_ORDER.includes(w)))];
    const tog = h("button", { class: "linkbtn", type: "button", text: iv.showDone ? "Hide checked" : "Show checked" });
    tog.addEventListener("click", () => { iv.showDone = !iv.showDone; renderIdeas(); });
    const secs = groups.map(g => {
      const l = all.filter(x => (x.when || DEFAULT_WHEN()) === g).sort((a, b) => String(a.idea).localeCompare(String(b.idea)) || byOrder(a, b));
      if (!l.length) return null;
      return h("section", { class: "igroup g" + (WHEN_ORDER.indexOf(g) + 1) }, h("h3", { text: g }), WHEN_NOTE[g] ? h("p", { class: "gnote", text: WHEN_NOTE[g] }) : null,
        h("ul", { class: "slist" }, l.map(x => h("li", { class: "slrow" }, h("ul", { class: "slist" }, shotRow(x, true))))));
    }).filter(Boolean);
    body.replaceChildren(h("p", { class: "gnote", style: "margin:0 0 12px" }, `${open} open, from approved ideas only. Grouped by where you'll get them. `, tog), ...(secs.length ? secs : [h("p", { class: "allgood", text: Object.values(ideas).some(d => d.status === "later" && approvalOf(d) === "approved") ? "Everything on the shot list is checked." : "Nothing here yet. Approve an idea under Ideas for later to add its shots." })]));
  }
}

function renderCal() {
  if (cv.view !== "calendar") return;
  const narrow = matchMedia("(max-width: 700px)").matches, mode = narrow ? "list" : cv.mode === "list" ? "list" : "month";
  document.querySelectorAll("#vt button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.m === mode)));
  $("#cal-title").textContent = pday(cv.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  $("#calbody").replaceChildren(mode === "month" ? monthGrid() : agenda());
  renderRules();
  renderQueue();
  $("#igcard").hidden = !PK.includes("ig");
  if (PK.includes("ig")) renderIgCard();
}

// ----- modal -----
const md = { open: false, opener: null, render: null, onClose: null };
function openModal(render, opener) {
  md.onClose = null; md.open = true; md.opener = opener || document.activeElement; md.render = render;
  $("#modal").classList.remove("wide");
  $("#mscrim").hidden = false; document.body.style.overflow = "hidden";
  render();
  const f = $("#modal").querySelector("button, input"); if (f) f.focus();
}
function rerenderModal() { if (md.open && md.render) md.render(); }
function closeModal() {
  const oc = md.onClose; md.onClose = null; if (oc) oc();
  md.open = false; md.render = null;
  $("#mscrim").hidden = true; document.body.style.overflow = "";
  const o = md.opener; md.opener = null;
  if (o && document.contains(o)) o.focus();
}
function closeBtn() { const b = h("button", { class: "dclose", type: "button", "aria-label": "Close", text: "×" }); b.addEventListener("click", closeModal); return b; }
function mHead(it, kick) {
  const tb = h("button", { class: "thumbbtn", type: "button", "aria-label": "Larger preview of " + it.title, title: "Larger preview" }, h("img", { src: thumbSrc(it), alt: "" }));
  tb.addEventListener("click", () => openItemPreview(it, 0, tb));
  return h("div", { class: "mhead" }, tb,
    h("div", { class: "dtitle" }, h("div", { class: "kick", text: kick }), h("h2", { id: "m-title", text: it.title }), h("p", { class: "sub", text: it.sub })), closeBtn());
}
function statusSeg(cur, onPick, opts, label, ro) {
  const seg = h("div", { class: "seg" + (opts.length === 3 ? " seg3" : opts.length === 4 ? " seg4" : ""), role: "radiogroup", "aria-label": label });
  for (const s of opts) {
    const b = h("button", { type: "button", role: "radio", "data-s": s, "aria-checked": String(cur === s), text: s.toUpperCase(), disabled: ro });
    b.addEventListener("click", () => { seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b))); onPick(s); });
    seg.append(b);
  }
  return seg;
}

function previewPane(it, plats) {
  const media = h("div", { class: "gmedia" + (it.kind === "reel" || it.kind === "story" ? " v" : "") }, frameFor(it));
  const pane = h("div", { class: "gprev" }, media);
  const ps = [...new Set(plats)].filter(k => k !== "st" && relevant(it.id, k) && capOf(it.id, k).trim());
  if (ps.length) {
    let cur = ps[0];
    const box = h("pre", { class: "gcap", tabindex: "0", "aria-label": "Caption preview" });
    const tabs = h("div", { class: "gtabs", role: "tablist", "aria-label": "Caption for" });
    const sync = () => { box.textContent = capOf(it.id, cur); tabs.querySelectorAll("button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.k === cur))); };
    ps.forEach(k => { const b = h("button", { class: "pt p-" + k, type: "button", role: "tab", "data-k": k, title: PNAME[k] + " caption", text: PSHORT[k] }); b.addEventListener("click", () => { cur = k; sync(); }); tabs.append(b); });
    sync();
    pane.append(tabs, box);
  } else if (isStory(it.id)) pane.append(h("p", { class: "muted", style: "font-size:12.5px;margin:0", text: "Swipe through the frames. Stickers get added in the Instagram app." }));
  return pane;
}
function openGroup(id, date, opener) {
  const keys = ((calByDate[date] || {})[id] || []).map(e => e.key);
  if (!keys.length) return;
  openModal(() => renderGroup(id, keys), opener);
}
function renderGroup(id, keys) {
  $("#modal").classList.add("wide");
  const it = byId[id], ro = !db || !canWrite;
  const list = keys.filter(k => cal[k]).map(k => ({ key: k, ...cal[k] })).sort((a, b) => PK.indexOf(a.plat) - PK.indexOf(b.plat));
  if (!list.length) { closeModal(); return; }
  const notes = [];
  if (!isReady(id)) notes.push(h("p", { class: "warn", text: "Heads-up: the graphic or a caption isn't Final right now. Finish it before this goes out." }));
  if (it.heads) notes.push(h("p", { class: "warn", text: it.heads }));
  if (it.soldout) notes.push(h("p", { class: "warn", text: it.title + ": " + it.soldout + "." }));
  const igE = list.find(e => e.plat === LEAD) || list[0];
  const li = leadIssue(id, igE.date); if (li) notes.push(h("p", { class: "warn", text: `This ${li}.` }));
  if (isArchived(id)) notes.push(h("p", { class: "warn", text: "This piece is archived. Remove it here, or restore it in the Content Library." }));
  if (isHeld(id, igE.date)) notes.push(h("p", { class: "warn", text: `${heldWhy(id, igE.date)}, so the ${hostw()} rule says hold this one.` }));
  else if (HOST && instrOf(id) && nextClass(id, igE.date)) notes.push(h("p", { class: "mnote", text: `${shortName(instrOf(id))}\u2019s next ${evw()} after this: ${fmtDay(nextClass(id, igE.date))}.` }));
  if (list.some(e => e.plat === LEAD)) adjAt(id, igE.date).forEach(x => notes.push(h("p", { class: "warn", text: x })));
  const vidOn = list.filter(e => PDEFS[e.plat].videoOnly).map(e => PNAME[e.plat]);
  if (vidOn.length && !isVideo(it)) notes.push(h("p", { class: "warn", text: `${listJoin(vidOn)} ${vidOn.length === 1 ? "is" : "are"} for Reels. This one is a static post.` }));
  const earlier = usedEntries(id).filter(e => !keys.includes(e.key));
  if (earlier.length) notes.push(h("p", { class: "mnote", text: "Used before: " + usageText(earlier) }));
  for (const k of [...new Set(list.filter(e => e.plat !== "st").map(e => e.plat))]) { const fl = flagOf(capOf(id, k)); if (fl) notes.push(h("p", { class: "warn", text: `The ${PNAME[k]} caption ${fl}. Edit it before this goes out.` })); }
  if (list.some(e => e.status === "suggested")) notes.push(h("p", { class: "mnote", text: "Suggested by Claude from your best times. Change the dates or times if you like, then Lock it in. Nothing goes out while it's Suggested." }));
  if (isVideo(it) && SCHED && SCHED.videoByPhone) notes.push(h("p", { class: "mnote", text: `Reels go out from your phone so you can add audio${PK.includes("th") && SCHED.platforms.has("th") ? `; the Threads copy goes through ${SCHED.name}` : ""}.` }));
  if (isStory(id)) notes.push(h("p", { class: "mnote", text: `Post Stories from your phone${PK.includes("fb") ? " (IG, then share to FB)" : ""} so you can add the sticker. Then mark it Posted.` }));
  if (list.some(e => e.ghl || e.sched)) notes.push(h("p", { class: "mnote", text: `Set up in ${SCHED ? SCHED.name : "the scheduler"}: ` + list.filter(e => e.ghl || e.sched).map(e => PNAME[e.plat]).join(", ") + "." }));
  const rows = list.map(e => {
    const di = h("input", { type: "date", value: e.date, "aria-label": PNAME[e.plat] + " date", disabled: ro });
    di.addEventListener("change", () => { if (okDate(di.value)) patchEntry(e.key, { date: di.value }); });
    const ti = h("input", { type: "time", value: e.time, "aria-label": PNAME[e.plat] + " time", disabled: ro });
    ti.addEventListener("change", () => { if (okTime(ti.value)) patchEntry(e.key, { time: ti.value.slice(0, 5) }); });
    const copy = h("button", { class: "linkbtn", type: "button", text: "Copy caption" });
    copy.addEventListener("click", () => copyText(capOf(id, e.plat), PNAME[e.plat] + " caption copied"));
    const edit = h("button", { class: "linkbtn", type: "button", text: "Edit caption" });
    edit.addEventListener("click", () => { closeModal(); openDrawer(id, null); showTab(e.plat); });
    const rm = h("button", { class: "linkbtn", type: "button", text: "Remove", disabled: ro });
    rm.addEventListener("click", () => { dropEntries([e.key]); rerenderModal(); });
    const cs = capSt(id, e.plat), stp = e.plat === "st";
    const rt = routeOf(e);
    return h("div", { class: "prow p-" + e.plat },
      h("div", { class: "pn col" }, PNAME[e.plat], h("span", { class: "route " + rt, title: ROUTE_WHY[rt], text: ROUTE[rt] })), di, ti,
      h("div", { class: "full" },
        statusSeg(e.status, s => patchEntry(e.key, { status: s }), POST_ST, PNAME[e.plat] + " status", ro),
        stp ? null : copy, stp ? null : edit, rm, !stp && cs !== "final" ? h("span", { class: "muted", text: "Caption: " + LAB[cs].toLowerCase() }) : null));
  });
  const adds = PK.filter(k => canPost(id, k) && !list.some(e => e.plat === k)).map(k => {
    const b = h("button", { class: "btn ghost small", type: "button", text: "+ " + PNAME[k], disabled: ro });
    b.addEventListener("click", () => {
      const key = newKey(id, k); keys.push(key);
      putEntries([[key, mkEntry(id, k, laterDate(k, list[0].date), BEST[k].time, isPending(list[0].status) ? list[0].status : "locked", "planner")]]);
      rerenderModal();
    });
    return b;
  });
  const rmAll = h("button", { class: "btn ghost small", type: "button", text: "Remove all", disabled: ro });
  rmAll.addEventListener("click", () => { dropEntries(list.map(e => e.key)); closeModal(); toast("Removed from the calendar"); });
  const nSug = list.filter(e => e.status === "suggested").length, nLock = list.filter(e => e.status === "locked").length;
  const step = nSug ? ["locked", "Lock it in", "suggested"] : nLock ? ["scheduled", "Mark all Scheduled", "locked"] : null;
  const allSched = h("button", { class: "btn small" + (nSug ? "" : " ghost"), type: "button", text: step ? step[1] : "Mark all Scheduled", disabled: ro || !step });
  allSched.addEventListener("click", () => {
    const t = new Date().toISOString();
    putEntries(list.filter(e => e.status === step[2]).map(e => [e.key, { ...cal[e.key], status: step[0], updatedAt: t, ...(step[0] === "locked" ? { lockedAt: t } : {}) }]));
    rerenderModal();
    toast(step[0] === "locked" ? (isReady(id) ? `${it.title} is locked in` : `${it.title} is locked in. It still has a graphic or caption that isn't Final.`) : it.title + " is marked Used");
  });
  const dlb = h("button", { class: "btn ghost small", type: "button", text: dlLabel(it), hidden: !dl || statusOf(id) !== "final" });
  dlb.addEventListener("click", () => downloadItem(it, dlb));
  const done = h("button", { class: "btn small" + (step ? " ghost" : ""), type: "button", text: "Done" });
  done.addEventListener("click", closeModal);
  $("#modal").replaceChildren(
    mHead(it, `${kickFor(it)} · ${it.ctype} · ${fmtDay(list[0].date)}`),
    h("div", { class: "gbody" }, previewPane(it, list.map(e => e.plat)),
      h("div", { class: "mbody" }, notes, rows, adds.length ? h("div", { class: "qdates" }, h("span", { class: "fl", text: "Add" }), adds) : null)),
    h("div", { class: "mfoot" }, h("div", { class: "left" }, rmAll, dlb), done, allSched));
}

function storyDefault(id) {
  const wk = weekOf(id), t = today();
  if (wk) { for (let d = wk[0]; d <= wk[1]; d = addDays(d, 1)) if (d > t && BEST.st.days.includes(dowOf(d))) return d; return wk[0] > t ? wk[0] : addDays(t, 1); }
  let d = addDays(t, 1);
  for (let i = 0; i < 14; i++) { if (!Object.values(calByDate[d] || {}).some(l => l.some(e => e.plat === "st"))) return d; d = addDays(d, 1); }
  return addDays(t, 1);
}
function openPlanner(id, date, opener) {
  const story = isStory(id);
  const from = POST_START && POST_START > today() ? POST_START : today();
  const pl = { id, date: date || (story ? storyDefault(id) : nextOpenIg(from)), status: "locked", rows: {}, keys: PK.filter(k => relevant(id, k)) };
  for (const k of pl.keys) pl.rows[k] = { on: canPost(id, k), date: laterDate(k, pl.date), time: BEST[k].time, plat: k, label: PNAME[k] };
  const wk = weekOf(id);
  if (wk) {   // weekly reminder Story: on each Story day of its week
    const wed = (() => { for (let d = addDays(pl.date, 1); d <= wk[1]; d = addDays(d, 1)) if (BEST.st.days.includes(dowOf(d))) return d; return null; })();
    if (wed) { pl.keys.push("st2"); pl.rows.st2 = { on: true, date: wed, time: BEST.st.time, plat: "st", label: "Stories again" }; }
  }
  openModal(() => renderPlanner(pl), opener);
}
function renderPlanner(pl) {
  $("#modal").classList.add("wide");
  const it = byId[pl.id], ro = !db || !canWrite;
  const notes = [];
  if (!isReady(pl.id)) notes.push(h("p", { class: "warn", text: isStory(pl.id) ? "These frames aren't Final yet. You can still plan them." : "The graphic or a caption isn't Final yet. You can still plan it." }));
  if (weekOf(pl.id)) notes.push(h("p", { class: "mnote", text: `${EV ? cap1(EV.word) : "Weekly"} reminder for ${fmtMD(weekOf(pl.id)[0])}–${fmtMD(weekOf(pl.id)[1])}: post on ${dayNames(BEST.st.days)}.` }));
  if (it.heads) notes.push(h("p", { class: "warn", text: it.heads }));
  if (isUsed(pl.id)) notes.push(h("p", { class: "mnote", text: "Used before: " + usageText(usedEntries(pl.id)) }));
  if (isPlanned(pl.id)) notes.push(h("p", { class: "mnote", text: "Already on the calendar: " + usageText(plannedEntries(pl.id)) }));
  if (it.soldout) notes.push(h("p", { class: "warn", text: it.title + ": " + it.soldout + "." }));
  const hint = leadHint(pl.id); if (hint) notes.push(h("p", { class: "mnote", text: hint }));
  if (HOST && instrOf(pl.id)) {
    if (isHeld(pl.id)) notes.push(h("p", { class: "warn", text: `On hold: ${heldWhy(pl.id)} (list as of ${DATA.teachAsOf || "the last check"}). Plan it only if a new ${evw()} is coming.` }));
    else if (nextClass(pl.id, today())) notes.push(h("p", { class: "mnote", text: `${shortName(instrOf(pl.id))}\u2019s next ${evw()}: ${fmtDay(nextClass(pl.id, today()))}. Post before then.` }));
  }
  const warnBox = h("div", { class: "qdates", style: "display:grid;gap:6px" });
  const updWarn = () => {
    const d = pl.rows[LEAD] && pl.rows[LEAD].on ? pl.rows[LEAD].date : pl.date, w = [];
    const li = leadIssue(pl.id, d); if (li) w.push(`This ${li}.`);
    if (instrOf(pl.id) && !isHeld(pl.id) && isHeld(pl.id, d)) w.push(`${heldWhy(pl.id, d)}. Pick an earlier date.`);
    if (!isStory(pl.id)) adjAt(pl.id, d).forEach(x => w.push(x));
    warnBox.replaceChildren(...w.map(x => h("p", { class: "warn", text: x })));
  };
  const rowEls = {};
  const syncDates = () => { pl.keys.forEach(k => { if (k === "st2") return; pl.rows[k].date = laterDate(k, pl.date); rowEls[k].di.value = pl.rows[k].date; }); updWarn(); };
  const main = h("input", { type: "date", value: pl.date, id: "pl-date" });
  const quick = [];
  let s = today();
  if (weekOf(pl.id)) { const wk = weekOf(pl.id); for (let d = wk[0]; d <= wk[1]; d = addDays(d, 1)) if (d > s && BEST.st.days.includes(dowOf(d))) quick.push(d); }
  else if (isStory(pl.id)) { s = addDays(s, 1); for (let i = 0; i < 6; i++) { quick.push(s); s = addDays(s, 1); } }
  else for (let i = 0; i < 6; i++) { s = nextOpenIg(s); quick.push(s); s = addDays(s, 1); }
  const qwrap = h("div", { class: "qdates", role: "group", "aria-label": isStory(pl.id) ? "Next days" : `Open ${PNAME[LEAD]} days` });
  const markQuick = () => qwrap.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.d === pl.date)));
  quick.forEach(d => {
    const b = h("button", { class: "chip", type: "button", "data-d": d, "aria-pressed": String(d === pl.date), text: fmtDay(d) });
    b.addEventListener("click", () => { pl.date = d; main.value = d; syncDates(); markQuick(); });
    qwrap.append(b);
  });
  main.addEventListener("change", () => { if (okDate(main.value)) { pl.date = main.value; syncDates(); markQuick(); } });
  const rows = pl.keys.map(k => {
    const r = pl.rows[k], has = canPost(pl.id, r.plat);
    const cb = h("input", { type: "checkbox", checked: r.on && has, disabled: !has, "aria-label": "Post to " + r.label });
    const di = h("input", { type: "date", value: r.date, "aria-label": r.label + " date", disabled: !has });
    const ti = h("input", { type: "time", value: r.time, "aria-label": r.label + " time", disabled: !has });
    const row = h("div", { class: "prow p-" + r.plat + (r.on && has ? "" : " off") },
      h("label", { class: "pn" }, cb, r.label), di, ti,
      !has ? h("div", { class: "full" }, h("span", { class: "muted", text: `No ${PNAME[k]} copy for this piece. Add it in Captions to post there.` }))
        : PDEFS[r.plat].videoOnly && BEST[r.plat].days.length < 7 ? h("div", { class: "full" }, h("span", { class: "muted", text: `${PNAME[r.plat]} posts on ${dayNames(BEST[r.plat].days)}, so other dates move to the next one.` }))
        : r.plat === "st" ? h("div", { class: "full" }, h("span", { class: "muted", text: `Posted from your phone: IG Stories${PK.includes("fb") ? ", then share to FB" : ""}.` })) : null);
    cb.addEventListener("change", () => { r.on = cb.checked; row.classList.toggle("off", !r.on); });
    di.addEventListener("change", () => { if (okDate(di.value)) { r.date = di.value; if (k === LEAD) updWarn(); } });
    ti.addEventListener("change", () => { if (okTime(ti.value)) r.time = ti.value.slice(0, 5); });
    rowEls[k] = { di };
    return row;
  });
  const cancel = h("button", { class: "btn ghost small", type: "button", text: "Cancel" });
  cancel.addEventListener("click", closeModal);
  const add = h("button", { class: "btn small", type: "button", text: "Add to calendar", disabled: ro });
  add.addEventListener("click", () => {
    const on = pl.keys.filter(k => pl.rows[k].on && canPost(pl.id, pl.rows[k].plat));
    if (!on.length) { toast("Pick at least one platform"); return; }
    const bad = on.find(k => !okDate(pl.rows[k].date) || !okTime(pl.rows[k].time));
    if (bad) { toast(`Check the ${pl.rows[bad].label} date and time`); return; }
    putEntries(on.map(k => [newKey(pl.id, pl.rows[k].plat) + (k === "st2" ? "b" : ""), mkEntry(pl.id, pl.rows[k].plat, pl.rows[k].date, pl.rows[k].time, pl.status, "planner")]));
    const first = on.map(k => pl.rows[k].date).sort()[0];
    closeModal();
    toast(`${it.title}: ${pl.status === "scheduled" ? "scheduled and marked Used" : pl.status === "locked" ? "locked in" : "suggested"} for ${fmtDay(first)}`);
    if (cv.view === "calendar") { cv.month = monthOf(first); cv.touched = true; renderCal(); }
  });
  $("#modal").replaceChildren(
    mHead(it, (isUsed(pl.id) ? "Plan again" : "Plan this piece") + " · " + it.ctype),
    h("div", { class: "gbody" }, previewPane(it, pl.keys.map(k => pl.rows[k].plat)),
      h("div", { class: "mbody" }, notes,
        h("label", { class: "fl", for: "pl-date" }, "Post date", main), qwrap, warnBox,
        h("div", { class: "fl", text: `Platforms · times are ${TZ}` }), rows,
        h("div", { class: "fl" }, "Add as", statusSeg(pl.status, v => { pl.status = v; }, ["suggested", "locked", "scheduled"], "Add as", ro)))),
    h("div", { class: "mfoot" }, cancel, add));
}

// ----- Threads text posts -----
const TH_MAX = 500;
function openText(key, date, opener) {
  if (key && !cal[key]) return;
  const tx = key ? { key, isNew: false }
    : { key: null, isNew: true, kind: "text", plat: "th", text: "", textSt: "draft", date: date || nextThDay(addDays(today(), 1)), time: BEST.th.time, status: "locked" };
  openModal(() => renderText(tx), opener);
}
function renderText(tx) {
  const ro = !db || !canWrite;
  const e = tx.isNew ? tx : cal[tx.key];
  if (!e) { closeModal(); return; }
  const ta = h("textarea", { id: "tx-text", "aria-label": "Threads post text", disabled: ro, placeholder: "One real detail, then an invitation." });
  ta.value = e.text || "";
  const meter = h("span", { class: "meter" }), saved = h("span", { class: "muted" });
  const upd = () => { const n = ta.value.length; meter.textContent = `${n} / ${TH_MAX}`; meter.classList.toggle("over", n > TH_MAX); };
  upd();
  let tmr = null;
  // Drafts from the Content Library keep their card in step with the calendar entry.
  const syncDraft = patch => { const id = !tx.isNew && cal[tx.key] && cal[tx.key].draft; if (!id || !thd[id]) return; const p = {}; if ("text" in patch) p.text = patch.text; if ("textSt" in patch) p.status = patch.textSt; if (Object.keys(p).length) thSave(id, p); };
  const flush = () => { if (tmr) { clearTimeout(tmr); tmr = null; if (cal[tx.key] && cal[tx.key].text !== ta.value) { syncDraft({ text: ta.value }); patchEntry(tx.key, { text: ta.value }); } } };
  ta.addEventListener("input", () => {
    upd();
    if (tx.isNew) { tx.text = ta.value; return; }
    saved.textContent = ""; clearTimeout(tmr);
    tmr = setTimeout(() => { tmr = null; syncDraft({ text: ta.value }); patchEntry(tx.key, { text: ta.value }); saved.textContent = "Saved"; }, 700);
  });
  if (!tx.isNew) md.onClose = flush;
  const set = (patch) => { if (tx.isNew) Object.assign(tx, patch); else { syncDraft(patch); patchEntry(tx.key, patch); } };
  const di = h("input", { type: "date", value: e.date, id: "tx-date", disabled: ro });
  di.addEventListener("change", () => { if (okDate(di.value)) set({ date: di.value }); });
  const ti = h("input", { type: "time", value: e.time, id: "tx-time", disabled: ro });
  ti.addEventListener("change", () => { if (okTime(ti.value)) set({ time: ti.value.slice(0, 5) }); });
  const notes = [];
  const tfl = flagOf(e.text); if (tfl) notes.push(h("p", { class: "warn", text: `This post ${tfl}. Edit it before it goes out.` }));
  if (e.source === "claude" && (e.textSt || "review") === "review") notes.push(h("p", { class: "mnote", text: "Claude drafted this from facts you've shared. Change anything that doesn't sound like you, then mark it Final." }));
  if (e.draft) notes.push(h("p", { class: "mnote", text: "From the Threads drafts in the Content Library. Edits here show on its card there too." }));
  let photoEl = null;
  if (e.photo && e.photo.blob) {
    const img = h("img", { src: blobUrl(e.photo), alt: e.photo.title || "Photo for this post" });
    const big = h("button", { class: "thphb", type: "button", "aria-label": "Larger photo" }, img);
    big.addEventListener("click", () => openLightbox([{ type: "img", src: blobUrl(e.photo), alt: e.photo.title || "" }], e.photo.title || "Photo", 0, big));
    const rmp = h("button", { class: "linkbtn", type: "button", text: "Remove photo", disabled: ro || !isPending(e.status) });
    rmp.addEventListener("click", () => { const n = { ...cal[tx.key], updatedAt: new Date().toISOString() }; delete n.photo; putEntries([[tx.key, n]]); if (e.draft && thd[e.draft]) thSave(e.draft, {}, ["photo"]); rerenderModal(); });
    photoEl = h("div", { class: "txph" }, h("div", { class: "thph" }, big, h("span", { class: "phn", text: (e.photo.num != null ? "#" + e.photo.num + " · " : "") + `goes in the ${routeOf(e) === "ghl" ? SCHED.name : "Phone"} pack` })), rmp);
  }
  const copy = h("button", { class: "btn ghost small", type: "button", text: "Copy text" });
  copy.addEventListener("click", () => copyText(ta.value, "Threads text copied"));
  let foot;
  if (tx.isNew) {
    const cancel = h("button", { class: "btn ghost small", type: "button", text: "Cancel" });
    cancel.addEventListener("click", closeModal);
    const add = h("button", { class: "btn small", type: "button", text: "Add to calendar", disabled: ro });
    add.addEventListener("click", () => {
      const text = ta.value.trim();
      if (!text) { toast("Write the post first"); ta.focus(); return; }
      if (text.length > TH_MAX) { toast(`Threads posts stop at ${TH_MAX} characters`); ta.focus(); return; }
      if (!okDate(tx.date) || !okTime(tx.time)) { toast("Check the date and time"); return; }
      const t = new Date().toISOString();
      const key = `text__th__${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      putEntries([[key, { kind: "text", plat: "th", text, textSt: tx.textSt, date: tx.date, time: tx.time, status: tx.status, source: "planner", createdAt: t, updatedAt: t }]]);
      closeModal(); toast("Threads post added for " + fmtDay(tx.date));
      if (cv.view === "calendar") { cv.month = monthOf(tx.date); cv.touched = true; renderCal(); }
    });
    foot = h("div", { class: "mfoot" }, h("div", { class: "left" }, copy), cancel, add);
  } else {
    const rm = h("button", { class: "btn ghost small", type: "button", text: "Remove", disabled: ro });
    rm.addEventListener("click", () => { md.onClose = null; const fromDraft = cal[tx.key] && cal[tx.key].draft; dropEntries([tx.key]); closeModal(); toast(fromDraft ? "Taken off the calendar. It's back with the Threads drafts in the Content Library." : "Threads post removed"); });
    const done = h("button", { class: "btn small", type: "button", text: "Done" });
    done.addEventListener("click", closeModal);
    foot = h("div", { class: "mfoot" }, h("div", { class: "left" }, rm, copy), saved, done);
  }
  $("#modal").replaceChildren(
    h("div", { class: "mhead" }, h("span", { class: "txbox", text: "TH", "aria-hidden": "true" }),
      h("div", { class: "dtitle" }, h("div", { class: "kick", text: e.photo ? "Threads · text + photo" : "Threads · text only" }), h("h2", { id: "m-title", text: tx.isNew ? "New Threads post" : "Threads post · " + fmtDay(e.date) })), closeBtn()),
    h("div", { class: "mbody" }, notes, photoEl,
      h("label", { class: "fl", for: "tx-text" }, "Post"), ta,
      h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" }, meter, h("span", { class: "muted", style: "font-size:12.5px", text: "No hashtags on Threads. Bare links are fine." })),
      h("div", { class: "fl", text: "Copy" }), statusSeg(e.textSt || "review", s => set({ textSt: s }), ["review", "draft", "final"], "Copy status", ro),
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px" },
        h("label", { class: "fl", for: "tx-date" }, "Date", di), h("label", { class: "fl", for: "tx-time" }, `Time · ${TZ}`, ti)),
      h("div", { class: "fl", text: routeOf({ kind: "text", plat: "th" }) === "ghl" ? `Posting · goes out through ${SCHED.name}` : "Posting · from your phone" }), statusSeg(e.status, s => set({ status: s }), tx.isNew ? ["suggested", "locked", "scheduled"] : POST_ST, "Posting status", ro)),
    foot);
}

function openPicker(date, opener) {
  let showUsed = false;
  openModal(function render() {
    const pool = DATA.items.filter(it => !isArchived(it.id) && (isAvailable(it.id) || (showUsed && isUsed(it.id))));
    const rows = pool.map(it => {
      const b = h("button", { class: "arow", type: "button" }, h("img", { src: thumbSrc(it), alt: "", loading: "lazy" }),
        h("div", {}, h("div", { class: "t", text: it.title }), h("div", { class: "s", text: isUsed(it.id) ? "Used " + usageText(usedEntries(it.id)) : kickFor(it) })));
      b.addEventListener("click", () => { closeModal(); openPlanner(it.id, date, opener); });
      return b;
    });
    const tog = h("button", { class: "linkbtn", type: "button", text: showUsed ? "Hide used pieces" : "Show used pieces too" });
    tog.addEventListener("click", () => { showUsed = !showUsed; render(); });
    $("#modal").replaceChildren(
      h("div", { class: "mhead" }, h("div", { class: "dtitle" }, h("div", { class: "kick", text: `${PNAME[LEAD]} · ` + fmtTime(BEST[LEAD].time) }), h("h2", { id: "m-title", text: "Plan " + fmtDay(date) })), closeBtn()),
      h("div", { class: "mbody" }, rows.length ? h("div", { class: "pick" }, rows) : h("p", { class: "qnote", text: "No pieces are ready right now. Mark a graphic and its captions Final in the Content Library." }), tog));
  }, opener);
}

// ----- Plan ready posts: one button places every Ready piece. Claude picks dates from the event schedule, the season and the
// posting rules; the page checks every date against those rules before anything is saved. Suggested posts may move; Locked,
// Scheduled and Posted posts never do. Nothing is written until the owner reviews the plan and taps "Add to calendar". -----
let sampleFn = null;
const AP_WEEKS = [4, 6, 8, 12];
const ap = { undo: null, weeks: 6, move: true, ctl: null, res: null, step: "setup", err: null };
const sunOf = d => addDays(d, -dowOf(d));
const STICKER = [["countdown", /countdown/i], ["quiz", /quiz/i], ["slider", /slider/i], ["addyours", /add yours/i], ["mention", /mention/i], ["question", /question/i], ["poll", /poll|would you rather/i]];
const stickerOf = id => { const it = byId[id], s = (it.sub || "") + " " + (it.heads || ""); const m = STICKER.find(([, re]) => re.test(s)); return m ? m[0] : "other"; };
function apWindow(weeks) {
  let s = addDays(today(), 1); if (s < POST_START) s = POST_START;
  return { start: s, end: addDays(sunOf(s), weeks * 7 - 1) };
}
// Which pieces go into a plan: Ready pieces not on the calendar yet, plus pieces whose every entry is still Suggested (if allowed).
function apPool(win, move) {
  const fresh = [], moving = [], weekly = [], left = [];
  for (const it of DATA.items) {
    const id = it.id;
    if (isArchived(id)) continue;
    const es = plannedEntries(id);
    if (es.length) {
      const feedDates = new Set(es.filter(e => !PDEFS[e.plat].videoOnly).map(e => e.date));
      const ok = move && isReady(id) && !isUsed(id) && !weekOf(id) && es.every(e => e.status === "suggested" && e.date >= win.start && e.date <= win.end)
        && (isStory(id) ? es.length === 1 && es[0].plat === "st" : feedDates.size === 1);
      if (ok) moving.push({ id, story: isStory(id), short: apLate(id, win.start), from: isStory(id) ? es[0].date : [...feedDates][0], keys: es.map(e => e.key), plats: es.map(e => e.plat) });
      continue;
    }
    if (!isReady(id) || isUsed(id)) continue;
    if (it.soldout) { left.push({ id, why: it.soldout }); continue; }
    if (isHeld(id)) continue;
    const short = apLate(id, win.start);
    if (short && !it.events.some(c => daysBetween(win.start, c) >= RULES.shortLead)) { left.push({ id, why: `Its ${evw()} (${it.events.map(fmtMD).join(", ")}) is too close to post, even on short notice. Archive it.`, late: true }); continue; }
    if (weekOf(id)) { if (weekOf(id)[1] >= win.start && weekOf(id)[0] <= win.end) weekly.push({ id }); continue; }
    fresh.push({ id, story: isStory(id), short, plats: isStory(id) ? (PK.includes("st") ? ["st"] : []) : PK.filter(k => k !== "st" && canPost(id, k)) });
  }
  return { fresh, moving, weekly, left };
}
// Days already taken by posts that stay put.
function apFixed(movingIds) {
  const occ = { ig: new Set(), st: new Set(), vid: {}, seq: [], sts: [] };   // "ig" holds the lead feed platform's days
  for (const e of Object.values(cal)) {
    if (!validEntry(e) || isText(e) || movingIds.has(e.item)) continue;
    if (e.plat === LEAD) { occ.ig.add(e.date); occ.seq.push({ date: e.date, id: e.item }); }
    else if (e.plat === "st") { occ.st.add(e.date); if (!weekOf(e.item)) occ.sts.push({ date: e.date, id: e.item }); }
    else if (PDEFS[e.plat].videoOnly) (occ.vid[e.plat] ||= new Set()).add(e.date);
  }
  return occ;
}
const apLate = (id, from) => { const ev = byId[id].events || []; return ev.length > 0 && !ev.some(c => addDays(c, -RULES.leadDays) >= from); };
const apUses = (p, d) => {
  const ev = byId[p.id].events || [];
  if (!ev.length || !leadIssue(p.id, d)) return true;
  return !!p.short && ev.some(c => daysBetween(d, c) >= RULES.shortLead);   // short notice: only when 10+ days was already impossible
};
function apOk(p, d, occ, win, strict = true) {
  if (d < win.start || d > win.end) return false;
  if (strict && ((p.lo && d < p.lo) || (p.hi && d > p.hi))) return false;
  const w = dowOf(d);
  if (p.story ? ((EV && EV.reminders && BEST.st.days.includes(w)) || occ.st.has(d)) : ((!BEST[LEAD].days.includes(w) && !EXTRA_DAYS.includes(w)) || occ.ig.has(d))) return false;
  if (!apUses(p, d)) return false;
  if (HOST && HOST.hold && instrOf(p.id) && !nextClass(p.id, d)) return false;
  return true;
}
function apOcc(base, assign, P, skip) {
  const o = { ig: new Set(base.ig), st: new Set(base.st) };
  for (const p of P) { if (p === skip || !assign.has(p.id)) continue; (p.story ? o.st : o.ig).add(assign.get(p.id)); }
  return o;
}
function apNearest(p, pref, occ, win) {
  const span = daysBetween(win.start, win.end);
  for (const strict of [true, false]) {
    for (let k = 0; k <= span + 1; k++) {
      for (const d of k ? [addDays(pref, k), addDays(pref, -k)] : [pref]) if (apOk(p, d, occ, win, strict)) return d;
    }
    if (!p.lo && !p.hi) break;
  }
  return null;
}
function apDefault(p, win, occ) {
  if (p.from) return p.from;
  if (p.short) return win.start;
  const ev = (byId[p.id].events || []).filter(d => addDays(d, -RULES.leadDays) >= win.start);
  if (ev.length) { const d = addDays(ev[0], -14); return d < win.start ? win.start : d; }
  return win.start;
}
// Rule score for a plan (lower is better): same content type on back-to-back feed days, weeks under 2 Reels, same Story sticker two days running.
function apScore(assign, P, base, win) {
  const seq = [...base.seq, ...P.filter(p => !p.story && assign.has(p.id)).map(p => ({ date: assign.get(p.id), id: p.id }))].sort((a, b) => a.date.localeCompare(b.date));
  let s = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i].date >= win.start && byId[seq[i].id].ctype === byId[seq[i - 1].id].ctype) s += 3;
  for (const p of P) if (!p.story && assign.has(p.id) && EXTRA_DAYS.includes(dowOf(assign.get(p.id)))) s += 2;
  for (let ws = sunOf(win.start); ws <= win.end; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6), n = seq.filter(x => x.date >= ws && x.date <= we && isVideo(byId[x.id])).length;
    s += 2 * Math.max(0, RULES.reels - n);
  }
  const sts = [...base.sts, ...P.filter(p => p.story && assign.has(p.id)).map(p => ({ date: assign.get(p.id), id: p.id }))].sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < sts.length; i++) if (sts[i].date >= win.start && daysBetween(sts[i - 1].date, sts[i].date) === 1 && stickerOf(sts[i].id) === stickerOf(sts[i - 1].id)) s += 1;
  return s;
}
function apPolish(P, assign, base, win, ALL) {
  const all = ALL || P;
  let best = apScore(assign, all, base, win);
  for (let round = 0; round < 8 && best > 0; round++) {
    let better = false;
    for (const a of P) for (const b of P) {
      if (a === b || a.story !== b.story || !assign.has(a.id) || !assign.has(b.id)) continue;
      const da = assign.get(a.id), dB = assign.get(b.id); if (da >= dB || daysBetween(da, dB) > 21) continue;
      const o = apOcc(base, assign, all, a); (a.story ? o.st : o.ig).delete(dB);
      if (!apOk(a, dB, o, win) || !apOk(b, da, o, win)) continue;
      assign.set(a.id, dB); assign.set(b.id, da);
      const s = apScore(assign, all, base, win);
      if (s < best) { best = s; better = true; } else { assign.set(a.id, da); assign.set(b.id, dB); }
    }
    for (const a of P) {
      if (!assign.has(a.id)) continue;
      const da = assign.get(a.id), o = apOcc(base, assign, all, a);
      for (let d = win.start; d <= win.end; d = addDays(d, 1)) {
        if (d === da || Math.abs(daysBetween(da, d)) > 10 || !apOk(a, d, o, win)) continue;
        assign.set(a.id, d);
        const s = apScore(assign, all, base, win);
        if (s < best) { best = s; better = true; break; } else assign.set(a.id, da);
      }
    }
    if (!better) break;
  }
  return best;
}
// Turn Claude's picks (or none) into a plan that passes every hard rule.
function apSolve(pool, win, picks, skips) {
  const P = [...pool.fresh, ...pool.moving].map(p => ({ ...p, lo: null, hi: null }));
  const movingIds = new Set(pool.moving.map(p => p.id));
  const base = apFixed(movingIds);
  const stays = [], skipped = [];
  for (const p of P) {
    const pk = picks.get(p.id);
    if (pk) { if (okDate(pk.lo)) p.lo = pk.lo; if (okDate(pk.hi)) p.hi = pk.hi; if (p.lo && p.hi && p.lo > p.hi) p.lo = p.hi = null; }
  }
  // Pieces Claude left out: Suggested ones stay where they are, new ones wait.
  const live = P.filter(p => {
    if (picks.has(p.id) || !skips.has(p.id)) return true;
    if (p.from) { stays.push(p); (p.story ? base.st : base.ig).add(p.from); if (p.story) base.sts.push({ date: p.from, id: p.id }); else base.seq.push({ date: p.from, id: p.id }); }
    else skipped.push({ p, why: skips.get(p.id) });
    return false;
  });
  const slack = p => { let n = 0; for (let d = win.start; d <= win.end; d = addDays(d, 1)) if (apOk(p, d, base, win, false)) n++; return n; };
  live.forEach(p => { p.slack = slack(p); if (p.from && !(picks.get(p.id) && okDate(picks.get(p.id).date))) picks.set(p.id, { ...(picks.get(p.id) || {}), date: p.from }); });
  live.sort((a, b) => a.slack - b.slack || (a.story ? 1 : 0) - (b.story ? 1 : 0));
  const assign = new Map(), fixedUp = new Map(), unplaced = [];
  const pickOf = p => { const pk = picks.get(p.id); return pk && okDate(pk.date) ? pk.date : null; };
  // Pass 1: every pick that already fits the rules, Suggested posts that stay put first. Pass 2: repair the rest.
  const first = [...live.filter(p => p.from && pickOf(p) === p.from), ...live.filter(p => !(p.from && pickOf(p) === p.from))];
  for (const p of first) { const d = pickOf(p); if (d && apOk(p, d, apOcc(base, assign, live), win)) assign.set(p.id, d); }
  for (const p of live) {
    if (assign.has(p.id)) continue;
    const o = apOcc(base, assign, live), pk = pickOf(p);
    const d = apNearest(p, pk || apDefault(p, win, o), o, win);
    if (d) { assign.set(p.id, d); if (pk && d !== pk && !(p.from && pk === p.from)) fixedUp.set(p.id, pk); }
    else if (p.from && !o[p.story ? "st" : "ig"].has(p.from)) assign.set(p.id, p.from);
    else unplaced.push(p);
  }
  const bumped = new Map();
  for (const p of [...unplaced]) {
    for (let d = win.start; d <= win.end; d = addDays(d, 1)) {
      const q = live.find(x => x !== p && x.story === p.story && assign.get(x.id) === d);
      if (!q) continue;
      const o2 = apOcc(base, assign, live, q);
      if (!apOk(p, d, o2, win)) continue;
      o2[p.story ? "st" : "ig"].add(d);
      const nd = apNearest(q, d, o2, win);
      if (!nd) continue;
      assign.set(q.id, nd); assign.set(p.id, d); bumped.set(q.id, p.id); unplaced.splice(unplaced.indexOf(p), 1);
      break;
    }
  }
  const before = apScore(assign, live, base, win);
  const score = apPolish(live.filter(p => !(p.from && assign.get(p.id) === p.from)), assign, base, win, live);
  // weekly reminder Stories: the Story days of their own week
  const weekly = [];
  for (const w of pool.weekly) {
    const wk = weekOf(w.id), days = [];
    for (let d = wk[0]; d <= wk[1]; d = addDays(d, 1)) if (d >= win.start && BEST.st.days.includes(dowOf(d))) days.push(d);
    if (days.length) weekly.push({ id: w.id, days });
  }
  // Video-only platforms (TikTok, YouTube Shorts): on their own days, one a day
  const vidAt = {};
  for (const k of PK.filter(k => PDEFS[k].videoOnly)) {
    const taken = new Set(base.vid[k] || []), at = new Map();
    for (const p of live.filter(p => assign.has(p.id) && p.plats.includes(k)).sort((a, b) => assign.get(a.id).localeCompare(assign.get(b.id)))) {
      let d = laterDate(k, assign.get(p.id));
      for (let i = 0; i < 6 && (taken.has(d) || !BEST[k].days.includes(dowOf(d))); i++) d = addDays(d, 1);
      taken.add(d); at.set(p.id, d);
    }
    vidAt[k] = at;
  }
  return { win, P: live, assign, vidAt, stays, skipped, unplaced, weekly, fixedUp, bumped, score, before, base, left: pool.left };
}
function apWhyNot(p, win) {
  const it = byId[p.id];
  if ((it.events || []).length && ![...Array(daysBetween(win.start, win.end) + 1).keys()].some(i => apUses(p, addDays(win.start, i)))) return `Its ${it.events.length === 1 ? evw() + " is" : evp() + " are"} too soon to post ${RULES.leadDays}+ days ahead.`;
  if (HOST && HOST.hold && instrOf(p.id) && !nextClass(p.id, win.start)) return heldWhy(p.id, win.start) + ".";
  return `No open ${p.story ? "Story" : "feed"} day left before ${fmtMD(win.end)}. Plan further out to fit it.`;
}
function apPrompt(pool, win) {
  const P = [...pool.fresh, ...pool.moving];
  const base = apFixed(new Set(pool.moving.map(p => p.id)));
  const D = d => `${d} ${DOWS[dowOf(d)]}`;
  const remind = EV && EV.reminders && PK.includes("st");
  const feedOpen = [], stOpen = [];
  for (let d = win.start; d <= win.end; d = addDays(d, 1)) {
    if ((BEST[LEAD].days.includes(dowOf(d)) || EXTRA_DAYS.includes(dowOf(d))) && !base.ig.has(d) && !pool.moving.some(p => !p.story && p.from === d)) feedOpen.push(D(d) + (EXTRA_DAYS.includes(dowOf(d)) ? " (extra)" : ""));
    if (!(remind && BEST.st.days.includes(dowOf(d))) && !base.st.has(d) && !pool.moving.some(p => p.story && p.from === d)) stOpen.push(D(d));
  }
  const lo = addDays(win.start, -7), fixed = [];
  for (const e of Object.values(cal).filter(e => validEntry(e) && e.date >= lo && e.date <= win.end).sort(byWhen)) {
    if (isText(e)) continue;
    const it = byId[e.item]; if (!it || pool.moving.some(p => p.id === e.item)) continue;
    if (e.plat === LEAD) fixed.push(`${D(e.date)} · feed · ${it.ctype} · ${it.title} (${isVideo(it) ? "Reel" : it.kind})${e.status !== "suggested" ? " · " + e.status : ""}`);
    if (e.plat === "st") fixed.push(`${D(e.date)} · Story · ${it.title}${weekOf(e.item) ? ` (weekly ${evw()} reminder)` : ""}`);
  }
  const ws = (DATA.workshops || []).filter(w => w.date >= today() && w.date <= addDays(win.end, 28)).map(w => `${D(w.date)} · ${w.title}${w.instr ? " (" + w.instr + ")" : ""}`);
  const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const lines = P.map(p => {
    const it = byId[p.id], f = [`id: ${p.id}`, p.story ? `Story (${stickerOf(p.id)} sticker)` : `${isVideo(it) ? "Reel" : it.kind} for the feed`, it.ctype, `"${it.title}" (${clip(it.sub, 90)})`];
    if ((it.events || []).length) f.push(`${evw()} dates: ${it.events.join(", ")}${p.short ? " (short notice)" : ""}`);
    if (HOST && instrOf(p.id)) f.push(`${hostw()} ${instrOf(p.id)}, ${evp()}: ${(TEACH[instrOf(p.id)] || []).filter(d => d >= today()).join(", ") || "none"}`);
    if (it.heads) f.push(`note: ${clip(it.heads, 160)}`);
    if (p.from) f.push(`now suggested for ${p.from}`);
    f.push(`about: ${clip(p.story ? capOf(p.id, "alt") : capOf(p.id, CAPK.find(k => !PDEFS[k].videoOnly) || CAPK[0]), 170)}`);
    return "- " + f.join(" | ");
  });
  const who = OWNER || "the owner";
  const feedNames = [LEAD, ...PK.filter(k => k !== LEAD && k !== "st" && k !== "th" && !PDEFS[k].videoOnly)].map(k => PNAME[k]);
  const hard = [
    `- Feed pieces go to ${listJoin(feedNames)} the same day. Use only open feed days (listed below) or days held by "now suggested" feed pieces, one piece per day.`,
    `- Stories use only open Story days (listed below) or days held by "now suggested" Stories, one per day.${remind ? ` ${dayNames(BEST.st.days)} belong to the weekly ${EV.word} reminder Stories.` : ""}`,
    EV ? `- A piece with ${EV.word} dates must post at least ${RULES.leadDays} days before one of them. ${RULES.leadDays} to ${RULES.leadDays + 11} days before is best. A piece marked "short notice" has already missed that window: post it as early as you can, at least ${RULES.shortLead} days before its ${EV.word}.` : "",
    HOST && HOST.hold ? `- ${cap1(an(HOST.word))} piece must post before that ${HOST.word}'s next ${evw()}.` : "",
  ].filter(Boolean);
  const good = [
    CTYPES.length > 1 ? `- ${listJoin(CTYPES)} feed posts shouldn't land on two feed days in a row (check the fixed posts too).` : "",
    RULES.reels ? `- At least ${RULES.reels} Reel${RULES.reels === 1 ? "" : "s"} on the feed each week (Sunday to Saturday).` : "",
    `- ${RULES[LEAD] || BEST[LEAD].days.length} feed posts a week on ${dayNames(BEST[LEAD].days)} is the goal.${EXTRA_DAYS.length ? ` Days marked "(extra)" (${dayNames(EXTRA_DAYS)}) are for extra posts: use them when a piece can't wait or there are more pieces than main days, not just to fill space.` : ""}`,
    "- Fill the earliest weeks first, up to one feed post per open day, but hold seasonal pieces for their season (holidays, back to school, end-of-year and so on).",
    `- If a piece clearly belongs after ${win.end}, put it in "skip" and say when it fits.`,
    "- Put a Story on the same day as (or the day after) a feed post on a related subject when you can, and don't run the same sticker kind two days in a row.",
    "- Follow each piece's note (some suit a certain weekday or window).",
    `- Pieces marked "now suggested for" are already on the calendar. Keep them on that date unless another day is clearly better.`,
  ].filter(Boolean);
  return `You're planning social posts for ${NAME || "a small brand"}.${SET.about ? " " + clip(SET.about, 500) : ""} Today is ${D(today())}. Give each piece below one date between ${win.start} and ${win.end}.

Hard rules (the page rejects dates that break them):
${hard.join("\n")}

What makes a good plan:
${good.join("\n")}
${EV ? `\nUpcoming ${EV.plural}:\n${ws.join("\n") || "(none listed)"}\n` : ""}
Fixed posts (these don't move):
${fixed.join("\n") || "(none)"}

Open feed days: ${feedOpen.join(", ") || "(none)"}
Open Story days: ${stOpen.join(", ") || "(none)"}
(A day held by a "now suggested" piece also opens up if you move that piece.)

Pieces to place:
${lines.join("\n")}

Reply with only JSON in this shape:
{"summary": "two or three short sentences for ${who} about the plan", "plan": [{"id": "piece id", "date": "YYYY-MM-DD", "earliest": "YYYY-MM-DD or null", "latest": "YYYY-MM-DD or null", "why": "one short plain sentence for ${who}"}], "skip": [{"id": "piece id", "why": "one short sentence"}]}
List every piece exactly once, in "plan" or "skip". Use "earliest" and "latest" only when the season or ${an(evw())} date limits when the piece makes sense; otherwise null.`;
}
function apPlanCount() {
  const win = apWindow(ap.weeks), pool = apPool(win, ap.move);
  return { win, pool, n: pool.fresh.length + pool.weekly.length, m: pool.moving.length, late: pool.left.filter(x => x.late).length, sold: pool.left.filter(x => !x.late).length };
}
async function apRun() {
  const { win, pool } = apPlanCount();
  ap.err = null;
  const picks = new Map(), skips = new Map(), whys = new Map();
  let summary = "", source = "rules";
  if (sampleFn && (pool.fresh.length + pool.moving.length)) {
    ap.step = "thinking"; ap.ctl = new AbortController(); ap.typing = false; rerenderModal();
    try {
      const r = await sampleFn.json(apPrompt(pool, win), { signal: ap.ctl.signal, cache: false, onText: () => { if (!ap.typing) { ap.typing = true; const s = $("#ap-stage"); if (s) s.textContent = "Writing the plan…"; } } });
      const ids = new Set([...pool.fresh, ...pool.moving].map(p => p.id));
      for (const x of (r && Array.isArray(r.plan) ? r.plan : [])) {
        if (!x || !ids.has(String(x.id))) continue;
        picks.set(String(x.id), { date: String(x.date || ""), lo: x.earliest ? String(x.earliest) : null, hi: x.latest ? String(x.latest) : null });
        if (x.why) whys.set(String(x.id), String(x.why).slice(0, 220));
      }
      for (const x of (r && Array.isArray(r.skip) ? r.skip : [])) if (x && ids.has(String(x.id)) && !picks.has(String(x.id))) skips.set(String(x.id), String(x.why || "Claude held this one for later.").slice(0, 220));
      summary = r && typeof r.summary === "string" ? r.summary.slice(0, 600) : "";
      source = picks.size ? "claude" : "rules";
    } catch (e) {
      if (e && e.code === "cancelled") { ap.step = "setup"; rerenderModal(); return; }
      ap.err = e && e.code;
      if (["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(ap.err)) sampleFn = null;
    } finally { ap.ctl = null; }
  }
  ap.res = { ...apSolve(pool, win, picks, skips), whys, summary, source };
  ap.step = "review"; rerenderModal();
}
function apChanges(R) {
  const newP = R.P.filter(p => !p.from && R.assign.has(p.id));
  const moved = R.P.filter(p => p.from && R.assign.has(p.id) && R.assign.get(p.id) !== p.from);
  const same = R.P.filter(p => p.from && R.assign.get(p.id) === p.from).length + R.stays.length + R.unplaced.filter(p => p.from).length;
  return { newP, moved, same };
}
function apApply(R) {
  const pairs = [], added = [], before = [], now = new Date().toISOString();
  const { newP, moved } = apChanges(R);
  for (const p of newP) {
    const d = R.assign.get(p.id);
    for (const k of p.plats) { const key = newKey(p.id, k); added.push(key); pairs.push([key, mkEntry(p.id, k, PDEFS[k].videoOnly ? (R.vidAt[k] && R.vidAt[k].get(p.id)) || laterDate(k, d) : d, BEST[k].time, "suggested", "autoplan")]); }
  }
  for (const w of R.weekly) w.days.forEach((d, i) => { const key = newKey(w.id, "st") + (i ? "b" : ""); added.push(key); pairs.push([key, mkEntry(w.id, "st", d, BEST.st.time, "suggested", "autoplan")]); });
  for (const p of moved) {
    const d = R.assign.get(p.id);
    for (const key of p.keys) {
      const e = cal[key]; if (!e || e.status !== "suggested") continue;
      const nd = PDEFS[e.plat].videoOnly ? (R.vidAt[e.plat] && R.vidAt[e.plat].get(p.id)) || laterDate(e.plat, d) : d;
      if (nd === e.date) continue;
      before.push([key, { ...e }]); pairs.push([key, { ...e, date: nd, updatedAt: now }]);
    }
  }
  if (!pairs.length) { closeModal(); toast("Nothing to change. Everything is already where it fits."); return; }
  ap.undo = { added, before };
  putEntries(pairs);
  closeModal();
  toast(`Added ${newP.length + R.weekly.length} and moved ${moved.length}. Undo is under Posting plan.`);
}
function apUndo() {
  const u = ap.undo; if (!u) return;
  const back = u.before.filter(([k]) => cal[k] && cal[k].status === "suggested").map(([k, d]) => [k, { ...d, updatedAt: new Date().toISOString() }]);
  const drop = u.added.filter(k => cal[k] && cal[k].status === "suggested");
  ap.undo = null;
  if (back.length) putEntries(back);
  if (drop.length) dropEntries(drop);
  if (!back.length && !drop.length) renderCal();
  toast("Plan undone. Anything you locked since stayed put.");
}
function renderPlanBar() {
  const el = $("#planbar"); if (!el) return;
  const { n, m, late, sold } = apPlanCount(), ro = !db || !canWrite;
  const b = h("button", { class: "btn", type: "button", disabled: ro || !(n + m) ? true : null, text: "Plan ready posts" });
  b.addEventListener("click", () => openAutoPlan(b));
  const kids = [b, h("span", { class: "pbtext", text: (n + m ? `${n} ready to place${m ? ` · ${m} Suggested can move` : ""}` : "Nothing waiting. Mark pieces and captions Final to plan them.") + (late ? ` · ${late} too close to post` : "") + (sold ? ` · ${sold} sold out` : "") })];
  if (ap.undo && !ro) { const u = h("button", { class: "btn ghost small", type: "button", text: "Undo last plan" }); u.addEventListener("click", apUndo); kids.push(u); }
  el.replaceChildren(...kids);
}
function openAutoPlan(opener) {
  ap.step = "setup"; ap.res = null; ap.err = null;
  openModal(renderAutoPlan, opener);
  md.onClose = () => { if (ap.ctl) ap.ctl.abort(); };
}
function apRow(p, R, kind) {
  const it = byId[p.id], d = R.assign.get(p.id);
  const plats = p.story ? "Story" : p.plats.filter(k => !PDEFS[k].videoOnly).map(k => PSHORT[k]).join(" ") + p.plats.filter(k => PDEFS[k].videoOnly).map(k => ` · ${PSHORT[k]} ${fmtMD((R.vidAt[k] && R.vidAt[k].get(p.id)) || laterDate(k, d))}`).join("");
  const tb = h("button", { class: "qthumb", type: "button", "aria-label": "Larger preview of " + it.title }, h("img", { src: thumbSrc(it), alt: "", loading: "lazy" }));
  tb.addEventListener("click", () => openItemPreview(it, 0, tb));
  const why = R.whys.get(p.id), fx = R.fixedUp.get(p.id), bq = R.bumped && R.bumped.get(p.id);
  const ev = (it.events || []).find(c => c >= d), short = ev && daysBetween(d, ev) < RULES.leadDays;
  return h("div", { class: "aprow" }, tb,
    h("div", { style: "min-width:0" },
      h("div", { class: "aptop" }, h("b", { text: fmtDay(d) }), h("span", { class: "apbadge " + kind, text: kind === "new" ? "New" : "Moved from " + fmtMD(p.from) }),
        short ? h("span", { class: "apbadge short", text: `Short notice · ${daysBetween(d, ev)} days before the ${evw()}` }) : null,
        !p.story && EXTRA_DAYS.includes(dowOf(d)) ? h("span", { class: "apbadge extra", text: "Extra post" }) : null),
      h("div", { class: "t", text: it.title }),
      h("div", { class: "s", text: `${plats} · ${it.ctype}` }),
      why ? h("p", { class: "apwhy", text: why }) : null,
      fx ? h("p", { class: "apfix", text: `Claude picked ${fmtMD(fx)}, but that day was taken or broke a posting rule, so it went to the nearest open day.` }) : null,
      bq ? h("p", { class: "apfix", text: `Moved to make room for ${byId[bq].title}, which has ${an(evw())} coming up.` }) : null));
}
function renderAutoPlan() {
  const M = $("#modal"); M.classList.add("wide");
  const head = kick => h("div", { class: "mhead" }, h("div", { class: "dtitle" }, h("div", { class: "kick", text: kick }), h("h2", { id: "m-title", text: "Plan ready posts" })), closeBtn());
  if (ap.step === "thinking") {
    const stop = h("button", { class: "btn ghost small", type: "button", text: "Stop" });
    stop.addEventListener("click", () => { if (ap.ctl) ap.ctl.abort(); });
    M.replaceChildren(head("Working on it"), h("div", { class: "mbody apthink" }, h("span", { class: "spin", "aria-hidden": "true" }),
      h("p", { id: "ap-stage", role: "status", text: `Claude is reading ${EV ? `the ${EV.word} schedule` : "the library"} and your calendar…` }),
      h("p", { class: "muted", text: "This usually takes under a minute. Nothing is saved until you review the plan." })),
      h("div", { class: "mfoot" }, stop));
    return;
  }
  if (ap.step === "review" && ap.res) {
    const R = ap.res, { newP, moved, same } = apChanges(R), nWeekly = R.weekly.length;
    const rows = [...newP.map(p => [p, "new"]), ...moved.map(p => [p, "moved"])].sort((a, b) => R.assign.get(a[0].id).localeCompare(R.assign.get(b[0].id)));
    const byWk = {};
    rows.forEach(r => (byWk[sunOf(R.assign.get(r[0].id))] ||= []).push(r));
    R.weekly.forEach(w => (byWk[sunOf(w.days[0])] ||= []).push([w, "weekly"]));
    const weeks = Object.keys(byWk).sort().map(ws => h("section", { class: "apweek" }, h("h3", { text: `${fmtMD(ws)} – ${fmtMD(addDays(ws, 6))}` }),
      byWk[ws].map(([p, kind]) => kind === "weekly"
        ? h("div", { class: "aprow" }, h("span", { class: "qthumb" }, h("img", { src: thumbSrc(byId[p.id]), alt: "" })), h("div", {}, h("div", { class: "aptop" }, h("b", { text: p.days.map(fmtDay).join(" + ") }), h("span", { class: "apbadge new", text: "New" })), h("div", { class: "t", text: byId[p.id].title }), h("div", { class: "s", text: `${EV ? cap1(EV.word) : "Weekly"} reminder Story · ${dayNames(BEST.st.days)} of its week` })))
        : apRow(p, R, kind))));
    // what the rules check says after this plan
    const seqAll = [...R.base.seq, ...R.P.filter(p => !p.story && R.assign.has(p.id)).map(p => ({ date: R.assign.get(p.id), id: p.id }))].sort((a, b) => a.date.localeCompare(b.date));
    let b2b = 0; for (let i = 1; i < seqAll.length; i++) if (seqAll[i].date >= R.win.start && seqAll[i].date <= R.win.end && byId[seqAll[i].id].ctype === byId[seqAll[i - 1].id].ctype) b2b++;
    const shortW = [];
    for (let ws = sunOf(R.win.start); ws <= R.win.end; ws = addDays(ws, 7)) { const we = addDays(ws, 6), l = seqAll.filter(x => x.date >= ws && x.date <= we); if (l.length && l.filter(x => isVideo(byId[x.id])).length < RULES.reels) shortW.push(fmtMD(ws)); }
    const checks = [b2b ? `${b2b} back-to-back pair${b2b === 1 ? "" : "s"} of the same content type` : "No same-type posts on back-to-back days",
      ...(RULES.reels ? [shortW.length ? `Under ${RULES.reels} Reel${RULES.reels === 1 ? "" : "s"} the week of ${shortW.join(", ")}` : `${RULES.reels}+ Reel${RULES.reels === 1 ? "" : "s"} every week that has posts`] : [])];
    const out = [...R.skipped.map(x => [x.p.id, x.why]), ...R.unplaced.filter(p => !p.from).map(p => [p.id, apWhyNot(p, R.win)]), ...R.left.map(x => [x.id, x.why])];
    const src = R.source === "claude" ? null
      : h("p", { class: "warn", text: ap.err === "not_granted" ? "You didn't allow Claude here, so this plan follows the posting rules only (no seasonal judgment)."
        : ap.err ? "Claude couldn't answer just now, so this plan follows the posting rules only. Try again for Claude's plan." : sampleFn ? "This plan follows the posting rules only." : "Claude isn't available in this view, so this plan follows the posting rules only." });
    const total = newP.length + nWeekly + moved.length;
    const back = h("button", { class: "btn ghost small", type: "button", text: "Back" });
    back.addEventListener("click", () => { ap.step = "setup"; rerenderModal(); });
    const again = h("button", { class: "btn ghost small", type: "button", text: "Try again" });
    again.addEventListener("click", apRun);
    const go = h("button", { class: "btn small", type: "button", text: total ? `Add to calendar (${total})` : "Nothing to add", disabled: !total || !db || !canWrite ? true : null });
    go.addEventListener("click", () => apApply(R));
    M.replaceChildren(head(`Plan through ${fmtDay(R.win.end)}`),
      h("div", { class: "mbody" },
        src, R.summary ? h("p", { class: "mnote", text: R.summary }) : null,
        h("div", { class: "apstats" }, h("span", {}, h("b", { text: String(newP.length + nWeekly) }), " new"), h("span", {}, h("b", { text: String(moved.length) }), " moved"), h("span", {}, h("b", { text: String(same) }), " stay put"), out.length ? h("span", {}, h("b", { text: String(out.length) }), " not planned") : null),
        h("ul", { class: "apchecks" }, checks.map(c => h("li", { text: c }))),
        weeks.length ? weeks : h("p", { class: "muted", text: "No changes. Everything is already on a day that fits." }),
        out.length ? h("section", { class: "apweek" }, h("h3", { text: "Not planned" }), out.map(([id, why]) => h("div", { class: "aprow out" }, h("span", { class: "qthumb" }, h("img", { src: thumbSrc(byId[id]), alt: "" })), h("div", {}, h("div", { class: "t", text: byId[id].title }), h("p", { class: "apwhy", text: why }))))) : null,
        h("p", { class: "muted", text: "Everything goes on as Suggested. Lock what you like on the calendar, or tap Plan ready posts again later." })),
      h("div", { class: "mfoot" }, h("div", { class: "left" }, back, R.source === "claude" || ap.err ? again : null), go));
    return;
  }
  // setup
  const { win, pool, n, m } = apPlanCount();
  const wseg = h("div", { class: "seg seg4", role: "radiogroup", "aria-label": "Plan through" });
  AP_WEEKS.forEach(k => { const b = h("button", { type: "button", role: "radio", "aria-checked": String(ap.weeks === k), text: `${k} WEEKS` }); b.addEventListener("click", () => { ap.weeks = k; rerenderModal(); }); wseg.append(b); });
  const mv = h("input", { type: "checkbox", id: "ap-move", checked: ap.move ? true : null });
  mv.addEventListener("change", () => { ap.move = mv.checked; rerenderModal(); });
  const thumbs = [...pool.fresh, ...pool.weekly].slice(0, 14).map(p => h("img", { src: thumbSrc(byId[p.id]), alt: byId[p.id].title, title: byId[p.id].title }));
  const more = pool.fresh.length + pool.weekly.length - thumbs.length;
  const cancel = h("button", { class: "btn ghost small", type: "button", text: "Cancel" }); cancel.addEventListener("click", closeModal);
  const go = h("button", { class: "btn small", type: "button", text: sampleFn ? "Make a plan" : "Make a plan from the rules", disabled: !(n + m) || !db || !canWrite ? true : null });
  go.addEventListener("click", apRun);
  M.replaceChildren(head("Claude places your Ready pieces"),
    h("div", { class: "mbody" },
      h("p", { text: `Claude puts each Ready piece on an open day, using ${EV ? `the ${EV.word} schedule, ` : ""}the season and your posting rules. Locked, Scheduled and Posted posts stay where they are. You'll see the plan before anything changes.` }),
      n ? h("div", { class: "fl" }, `${n} ready to place`, h("div", { class: "apthumbs" }, thumbs, more > 0 ? h("span", { class: "apmore", text: "+" + more }) : null)) : h("p", { class: "muted", text: "No new pieces are Ready. Claude can still rearrange the Suggested ones." }),
      h("div", { class: "fl" }, `Plan through ${fmtDay(win.end)}`, wseg),
      h("label", { class: "apmove", for: "ap-move" }, mv, h("span", {}, h("b", { text: `Let Claude move Suggested posts${m ? ` (${m})` : ""}` }), h("span", { class: "muted", text: " Only ones in this window. Weekly reminder Stories stay put." }))),
      sampleFn ? null : h("p", { class: "warn", text: "Claude isn't available in this view, so the plan will follow the posting rules only (no seasonal judgment)." })),
    h("div", { class: "mfoot" }, cancel, go));
}

// ----- Ask Claude: a chat page that reads the library, calendar and ideas. Claude suggests changes as cards the owner applies
// with one tap; nothing changes without that tap. New graphics and Reels are handed off to the brand's project in Claude. -----
const ch = { turns: [], busy: false, ctl: null, uid: null, loaded: false, tools: null };
function chatRules() {
  const who = OWNER || "the owner", brand = NAME || "this brand";
  const L = [`You're Claude, working inside ${brand}'s content planner with ${who}.${SET.about ? " " + SET.about : ""}`];
  const voice = arr(SET.voice).map(String).filter(Boolean);
  L.push("", `How to write for ${brand}:`, ...voice.map(v => "- " + v));
  if (PK.includes("th")) L.push("- Threads posts: no hashtags, end on a warm invitation.");
  L.push("- Never invent facts, prices, dates, quotes or scenes. Use only facts you find in the library (look them up with get_piece) or in the brand facts below. If you don't know something, say so and ask.");
  const facts = arr(SET.facts).map(String).filter(Boolean); if (facts.length) L.push("", "Brand facts:", ...facts.map(f => "- " + f));
  const photo = arr(SET.photoRules).map(String).filter(Boolean); if (photo.length) L.push("", "Photos:", ...photo.map(f => "- " + f));
  if (HOST && HOST.hold) L.push("", `${cap1(HOST.word)} posts only go out while that ${HOST.word} has ${an(evw())} coming up.`);
  L.push("", `What you can do here: read the library, calendar and Ideas list with your tools; draft captions${PK.includes("th") ? ", Threads posts" : ""} and ideas; suggest changes with propose_changes (${who} reviews a card and taps Apply). Only Suggested posts can move; Locked, Scheduled and Posted ones stay put unless ${who} unlocks them.`,
    `What you can't do here: make new graphics or Reels, edit designs, check websites or schedule posts. For those, use handoff to write a clear request ${who} can paste into ${handoffWhere()}, where the design tools live.`,
    "", `Keep replies short and easy to skim. Call pieces by their titles, never by ids. Times are ${TZ}.`);
  return L.join("\n");
}
const chatRef = () => db && ch.uid ? db.collection("data/users/" + ch.uid).doc("chat") : null;
function chatSave() {
  const r = chatRef(); if (!r) return;
  const turns = ch.turns.slice(-40).map(t => ({ role: t.role, text: String(t.text || "").slice(0, 12000), at: t.at, cards: (t.cards || []).map(c => ({ ...c })) }));
  r.set({ turns, updatedAt: new Date().toISOString() }).catch(() => {});
}
async function chatLoad(userNs) {
  try { ch.uid = userNs && typeof userNs.id === "function" ? await userNs.id() : null; } catch (e) { ch.uid = null; }
  const r = chatRef();
  if (r) { try { const d = await r.get(); const v = d && d.exists ? d.data() : null; if (v && Array.isArray(v.turns)) ch.turns = v.turns; } catch (e) {} }
  ch.loaded = true; if (cv.view === "chat") renderChat();
}
// The page's own summary for each request (Claude looks up the rest with tools).
function chatSnapshot() {
  const t = today(), D = d => `${d} ${DOWS[dowOf(d)]}`;
  const items = DATA.items.filter(it => !isArchived(it.id));
  const cnt = s => items.filter(it => statusOf(it.id) === s).length;
  const ready = items.filter(it => isAvailable(it.id)).map(it => `${it.title} (${it.kind}, ${it.ctype})`);
  const cal2 = Object.values(cal).filter(e => validEntry(e) && e.date >= t && e.date <= addDays(t, 13)).sort(byWhen)
    .map(e => `${D(e.date)} ${e.time} ${PNAME[e.plat]} · ${isText(e) ? "text post: " + String(e.text).slice(0, 60) : byId[e.item].title} · ${e.status}`);
  const ws = (DATA.workshops || []).filter(w => w.date >= t && w.date <= addDays(t, 42)).map(w => `${D(w.date)} · ${w.title}${w.instr ? " (" + w.instr + ")" : ""}`);
  const idn = Object.values(ideas).filter(d => d.status === "now").map(d => d.title), idl = Object.values(ideas).filter(d => d.status === "later").length;
  const th = PK.includes("th") ? `\nThreads slots: ${TH_SLOTS.map((l, i) => DOWS[i] + " " + l.join("/")).join(", ")} (pieces with Threads copy take ${BEST.th.time}).
Threads drafts in the Content Library: ${(() => { const l = thLive(); const c = s => l.filter(id => thStatus(id) === s && !thOn(id)).length; return `${c("review")} to review, ${c("draft")} draft, ${c("final")} final and waiting, ${l.filter(thOn).length} on the calendar`; })()}.` : "";
  return `Today is ${D(t)}.${POST_START ? ` Posting starts or started ${POST_START}.` : ""} Platforms: ${PK.map(k => PNAME[k]).join(", ")}.
Posting rules: ${RULE_TEXT.map(([a, b]) => a + " (" + b + ")").join("; ")}. Best times: ${PK.map(k => `${PNAME[k]} ${fmtTime(BEST[k].time)} (${dayNames(BEST[k].days)})`).join(", ")}.${th}
Library: ${items.length} pieces · ${cnt("review")} to review · ${cnt("draft")} draft · ${cnt("final")} final.
Ready to plan but not on the calendar (${ready.length}): ${ready.join("; ") || "none"}.
Calendar, next 14 days:
${cal2.join("\n") || "(nothing planned)"}${EV ? `\n${cap1(EV.plural)} on the schedule (list as of ${DATA.teachAsOf || "the last check"}):\n${ws.join("\n") || "(none listed)"}` : ""}
Ideas to make now: ${idn.join("; ") || "none"}. Ideas for later: ${idl}.`;
}
const pieceRow = it => ({ id: it.id, title: it.title, kind: it.kind, type: it.ctype, theme: it.theme, status: statusOf(it.id), ready: isReady(it.id), archived: isArchived(it.id),
  on_calendar: plannedEntries(it.id).map(e => `${e.date} ${PSHORT[e.plat]} ${e.status}`), used: usedEntries(it.id).map(e => `${e.date} ${PSHORT[e.plat]}`) });
const findPiece = q => { q = String(q || "").trim(); if (!q) return null; if (byId[q]) return byId[q]; const l = q.toLowerCase(); return DATA.items.find(it => it.title.toLowerCase() === l) || DATA.items.find(it => it.title.toLowerCase().includes(l)) || null; };
function chatTools(turn) {
  return [
    { name: "search_library", description: "Find pieces in the Content Library. Returns up to 30 pieces with id, title, kind (post, carousel, reel, story), content type, status (review, draft, final), whether it's ready, and its calendar dates.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "Words from the title or subtitle; empty for all" }, status: { type: "string", enum: ["review", "draft", "final", "any"] }, kind: { type: "string", enum: ["post", "carousel", "reel", "story", "any"] }, include_archived: { type: "boolean" } } },
      execute(i) {
        const q = String(i.query || "").toLowerCase(), st = String(i.status || "any"), k = String(i.kind || "any");
        return DATA.items.filter(it => (i.include_archived || !isArchived(it.id)) && (st === "any" || statusOf(it.id) === st) && (k === "any" || it.kind === k || (k === "reel" && it.kind === "wide"))
          && (!q || (it.title + " " + (it.sub || "") + " " + it.ctype + " " + it.theme).toLowerCase().includes(q))).slice(0, 30).map(pieceRow);
      } },
    { name: "get_piece", description: `Everything about one piece: its captions (${[...CAPK.map(k => PNAME[k]), "alt text"].join(", ")}) with their statuses, notes, ${evw()} dates, ${hostw()} and calendar entries. Pass the id or exact title.`,
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute(i) {
        const it = findPiece(i.id); if (!it) throw new Error("No piece by that id or title. Try search_library.");
        const c = {}; [...CAPK, "alt"].forEach(k => { const v = capOf(it.id, k); if (v) c[k] = { text: v.slice(0, 2200), status: k === "alt" ? undefined : capSt(it.id, k) }; });
        return { ...pieceRow(it), subtitle: it.sub, note_for_claude: it.heads || null, owner_note: (state[it.id] || {}).note || null, event_dates: it.events || [], host: instrOf(it.id), host_dates: instrOf(it.id) ? (TEACH[instrOf(it.id)] || []) : [], captions: c };
      } },
    { name: "get_calendar", description: "Calendar entries between two dates (YYYY-MM-DD), including any text-only Threads posts. Each has date, time, platform, piece title, status (suggested, locked, scheduled, posted).",
      inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"] },
      execute(i) {
        const a = okDate(i.from) ? i.from : today(), b = okDate(i.to) ? i.to : addDays(a, 13);
        return Object.values(cal).filter(e => validEntry(e) && e.date >= a && e.date <= b).sort(byWhen).slice(0, 250)
          .map(e => ({ date: e.date, day: DOWS[dowOf(e.date)], time: e.time, platform: PNAME[e.plat], piece: isText(e) ? "Threads text post" : byId[e.item].title, id: isText(e) ? null : e.item, type: isText(e) ? null : byId[e.item].ctype, text: isText(e) ? e.text : undefined, status: e.status }));
      } },
    ...(PK.includes("th") ? [{ name: "list_threads_drafts", description: `The Threads drafts in the Content Library: date, time, kind, status (review, draft, final), whether it's on the calendar, ${OWNER || "the owner"}'s note and the text. Use it before suggesting new Threads posts so you don't repeat one.`,
      inputSchema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } } },
      execute(i) {
        const a = okDate(i.from) ? i.from : "0000-00-00", b = okDate(i.to) ? i.to : "9999-12-31";
        return thLive().map(id => ({ id, ...thd[id] })).filter(d => d.date >= a && d.date <= b).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time)).slice(0, 120)
          .map(d => ({ date: d.date, day: okDate(d.date) ? DOWS[dowOf(d.date)] : null, time: d.time, kind: TH_KIND[d.kind] || "Threads post", status: thStatus(d.id), on_calendar: !!thOn(d.id), photo: d.photo ? d.photo.title : null, owner_note: d.note || null, text: thText(d.id) }));
      } }] : []),
    { name: "list_ideas", description: `The Ideas page: ideas to make now, ideas for later (each waiting on ${OWNER || "the owner"}'s approval, approved or declined, with shot-list progress) and built ideas. New ideas you add wait for approval; only approved ideas put shots on the Shot list.`,
      inputSchema: { type: "object", properties: {} },
      execute() { return Object.entries(ideas).map(([id, d]) => { const l = shotsOf(id); return { title: d.title, format: d.format, status: d.status, approval: d.status === "later" ? approvalOf(d) : undefined, pitch: d.pitch, needs: d.needs, shots_done: `${l.filter(x => x.done).length}/${l.length}`, open_shots: l.filter(x => !x.done).map(x => x.text).slice(0, 8) }; }); } },
    { name: "propose_changes", description: `Show ${OWNER || "the owner"} a card of changes to apply with one tap. Actions: move (a Suggested post to a new date), lock (approve a piece's Suggested posts), archive (take a piece out of use), caption (replace one caption: platform ${CAPK.join(", ")}), note (leave a note on a piece), idea (add an idea, optionally with shots), ${PK.includes("th") ? "threads_post (add a Threads draft for a date and time; it waits in the Content Library until it's marked Final and added), " : ""}plan (open Plan ready posts). Nothing changes until Apply is tapped.`,
      inputSchema: { type: "object", properties: { summary: { type: "string", description: "One line describing the change set" },
        changes: { type: "array", items: { type: "object", properties: {
          action: { type: "string", enum: ["move", "lock", "archive", "caption", "note", "idea", ...(PK.includes("th") ? ["threads_post"] : []), "plan"] },
          piece: { type: "string", description: "Piece id or title (move, lock, archive, caption, note)" },
          date: { type: "string", description: "YYYY-MM-DD (move, threads_post)" }, time: { type: "string", description: "HH:MM, optional" },
          platform: { type: "string", enum: [...CAPK] }, text: { type: "string", description: "Caption, note or Threads text" },
          title: { type: "string" }, pitch: { type: "string" }, format: { type: "string" }, when: { type: "string", enum: ["now", "later"] }, shots: { type: "array", items: { type: "string" } } }, required: ["action"] } } },
        required: ["summary", "changes"] },
      execute(i) {
        const changes = Array.isArray(i.changes) ? i.changes.slice(0, 25) : [];
        if (!changes.length) throw new Error("No changes given.");
        turn.cards = turn.cards || []; turn.cards.push({ type: "changes", summary: String(i.summary || "Suggested changes").slice(0, 200), changes, status: "open" });
        renderChat();
        return "Shown as a card with an Apply button. Don't repeat the list; say in a sentence what you suggested.";
      } },
    { name: "handoff", description: `For work this page can't do (new graphics, carousels or Reels, design edits, checking the website, scheduling): write the request ${OWNER || "the owner"} will paste into ${handoffWhere()}. Include every detail that chat needs.`,
      inputSchema: { type: "object", properties: { request: { type: "string" } }, required: ["request"] },
      execute(i) {
        turn.cards = turn.cards || []; turn.cards.push({ type: "handoff", text: String(i.request || "").slice(0, 4000), status: "open" });
        renderChat();
        return `Shown with a Copy button. Say briefly to paste it into ${handoffWhere()}.`;
      } },
  ];
}
function describeChange(c) {
  const it = c.piece ? findPiece(c.piece) : null, t = it ? it.title : c.piece;
  switch (c.action) {
    case "move": return { text: `Move ${t} to ${okDate(c.date) ? fmtDay(c.date) : c.date}`, bad: !it ? "Can't find that piece." : !plannedEntries(it.id).length ? "It isn't on the calendar." : plannedEntries(it.id).some(e => e.status !== "suggested") ? "It's Locked, so it stays put. Unlock it first." : !okDate(c.date) || c.date < today() ? "That date doesn't work." : null };
    case "lock": return { text: `Lock in ${t}`, bad: !it ? "Can't find that piece." : !plannedEntries(it.id).some(e => e.status === "suggested") ? "Nothing Suggested to lock." : null };
    case "archive": return { text: `Archive ${t}`, bad: !it ? "Can't find that piece." : null };
    case "caption": return { text: `New ${PNAME[c.platform] || c.platform} caption for ${t}: “${String(c.text || "").slice(0, 140)}${String(c.text || "").length > 140 ? "…" : ""}”`, bad: !it ? "Can't find that piece." : !CAPK.includes(c.platform) || !String(c.text || "").trim() ? "Needs a platform and text." : null };
    case "note": return { text: `Note on ${t}: ${String(c.text || "").slice(0, 160)}`, bad: !it ? "Can't find that piece." : null };
    case "idea": return { text: `Add idea: ${c.title || "(untitled)"}${(c.shots || []).length ? ` with ${c.shots.length} shot${c.shots.length === 1 ? "" : "s"}` : ""}`, bad: !String(c.title || "").trim() ? "Needs a title." : null };
    case "threads_post": return { text: `Threads draft for ${okDate(c.date) ? fmtDay(c.date) : c.date}${okTime(c.time) ? " at " + fmtTime(c.time.slice(0, 5)) : ""} (waits in the Content Library): “${String(c.text || "").slice(0, 140)}”`, bad: !okDate(c.date) || c.date < today() ? "That date doesn't work." : !String(c.text || "").trim() ? "Needs text." : String(c.text).length > TH_MAX ? `Over ${TH_MAX} characters.` : null };
    case "plan": return { text: "Open Plan ready posts", bad: null };
    default: return { text: String(c.action), bad: "Not something this page can do." };
  }
}
function applyChange(c) {
  const it = c.piece ? findPiece(c.piece) : null, now = new Date().toISOString();
  if (describeChange(c).bad) return false;
  if (c.action === "move") {
    const pairs = plannedEntries(it.id).map(e => [e.key, { ...cal[e.key], date: laterDate(e.plat, c.date), time: okTime(c.time) && (e.plat === LEAD || e.plat === "th" || e.plat === "st") ? c.time.slice(0, 5) : cal[e.key].time, updatedAt: now }]);
    putEntries(pairs);
  } else if (c.action === "lock") {
    putEntries(plannedEntries(it.id).filter(e => e.status === "suggested").map(e => [e.key, { ...cal[e.key], status: "locked", lockedAt: now, updatedAt: now }]));
  } else if (c.action === "archive") { setArchived(it.id, true);
  } else if (c.action === "caption") { savePatch(it.id, { [c.platform]: String(c.text).trim() }, c.platform); setCapStatus(it.id, c.platform, "review");
  } else if (c.action === "note") { const next = { ...(state[it.id] || {}), note: String(c.text || "").trim(), status: statusOf(it.id), updatedAt: now }; state[it.id] = next; write(it.id, next).catch(onWriteError); refreshAll();
  } else if (c.action === "idea") {
    const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    ideas[id] = { title: String(c.title).trim(), pitch: String(c.pitch || "").trim(), format: String(c.format || ""), status: c.when === "now" ? "now" : "later", approval: "pending", order: 900, source: "chat", createdAt: now, updatedAt: now };
    write(id, ideas[id], "ideas").catch(onWriteError);
    (c.shots || []).slice(0, 12).forEach((txt, j) => { const k = `${id}__s${j + 1}`; shots[k] = { idea: id, text: String(txt), kind: "shot", when: DEFAULT_WHEN(), done: false, order: j, source: "chat", createdAt: now, updatedAt: now }; write(k, shots[k], "shots").catch(onWriteError); });
    renderIdeas();
  } else if (c.action === "threads_post") {
    const id = "th-c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const slots = TH_SLOTS[dowOf(c.date)] || [BEST.th.time];
    thd[id] = { date: c.date, time: okTime(c.time) ? c.time.slice(0, 5) : slots[0], kind: "post", text: String(c.text).trim(), status: "review", source: "chat", order: 999, createdAt: now, updatedAt: now };
    write(id, thd[id], "threads").catch(onWriteError); renderThreads();
  } else if (c.action === "plan") { openAutoPlan(document.activeElement); }
  return true;
}
// Small, safe Markdown: paragraphs, bullet and numbered lists, ### headings, **bold**.
function mdLite(text) {
  const frag = document.createDocumentFragment();
  const inline = (el, s) => { String(s).split(/(\*\*[^*]+\*\*)/g).forEach(part => { if (/^\*\*[^*]+\*\*$/.test(part)) el.append(h("b", { text: part.slice(2, -2) })); else if (part) el.append(document.createTextNode(part)); }); return el; };
  let list = null;
  for (const raw of String(text).split("\n")) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)$/), ol = line.match(/^\s*\d+[.)]\s+(.*)$/), hd = line.match(/^#{1,4}\s+(.*)$/);
    if (ul || ol) { const tag = ul ? "ul" : "ol"; if (!list || list.tagName.toLowerCase() !== tag) { list = h(tag); frag.append(list); } list.append(inline(h("li"), (ul || ol)[1])); continue; }
    list = null;
    if (!line.trim()) continue;
    if (hd) { frag.append(inline(h("h4"), hd[1])); continue; }
    frag.append(inline(h("p"), line));
  }
  return frag;
}
function cardEl(c, turn) {
  const ro = !db || !canWrite;
  if (c.type === "handoff") {
    const copy = h("button", { class: "btn small", type: "button", text: "Copy request" });
    copy.addEventListener("click", () => copyText(c.text, `Copied. Paste it into ${handoffWhere()}.`));
    return h("div", { class: "ccard handoff" }, h("h5", { text: `For ${handoffWhere()}` }), h("pre", { text: c.text }), h("div", { class: "row" }, copy));
  }
  const rows = c.changes.map(x => describeChange(x));
  const ok = rows.filter(r => !r.bad).length;
  const body = [h("h5", { text: "Suggested changes" }), h("b", { text: c.summary }),
    h("ul", {}, rows.map(r => h("li", {}, r.text, r.bad ? h("span", { class: "bad", text: " " + r.bad }) : null)))];
  if (c.status === "applied") body.push(h("p", { class: "done", text: `Applied${c.appliedAt ? " " + new Date(c.appliedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}.` }));
  else if (c.status === "dismissed") body.push(h("p", { class: "done", text: "Dismissed." }));
  else {
    const ap = h("button", { class: "btn small", type: "button", text: ok === rows.length ? "Apply" : `Apply ${ok} of ${rows.length}`, disabled: ro || !ok ? true : null });
    ap.addEventListener("click", () => {
      let n = 0; c.changes.forEach(x => { if (applyChange(x)) n++; });
      c.status = "applied"; c.appliedAt = new Date().toISOString(); chatSave(); renderChat();
      toast(`Applied ${n} change${n === 1 ? "" : "s"}.`);
    });
    const dm = h("button", { class: "btn ghost small", type: "button", text: "Dismiss" });
    dm.addEventListener("click", () => { c.status = "dismissed"; chatSave(); renderChat(); });
    body.push(h("div", { class: "row" }, ap, dm));
  }
  return h("div", { class: "ccard" }, body);
}
const chatStarts = () => arr(SET.chatStarts).length ? arr(SET.chatStarts).map(String).slice(0, 6)
  : ["What should I post this week?", "Give me 5 fresh post ideas for next month", ...(PK.includes("th") ? ["Write three Threads posts for this week"] : []), "What's Ready but not on the calendar?", "Is anything on the calendar breaking a posting rule?"];
function renderChat(focus) {
  if (cv.view !== "chat") return;
  const log = $("#chatlog");
  log.replaceChildren(...ch.turns.map(t => {
    if (t.role === "user") return h("div", { class: "msg user", text: t.text });
    const m = h("div", { class: "msg bot" });
    if (t.pending && !t.text) m.append(h("div", { class: "thinking" }, h("span", { class: "spin", "aria-hidden": "true" }), "Thinking…"));
    else m.append(mdLite(t.text));
    if (t.error) m.append(h("p", { class: "err", text: t.error }));
    (t.cards || []).forEach(c => m.append(cardEl(c, t)));
    return m;
  }));
  if (!ch.turns.length) {
    log.append(h("div", { class: "msg bot" }, mdLite(sampleFn ? `Hi${OWNER ? " " + OWNER : ""}. Ask me for post ideas, a caption, a better week, or a change to the calendar. I'll show any change as a card first.` : (ch.loaded ? "Ask Claude needs this page open in Claude while you're signed in. It isn't available in this view." : "Getting ready…"))));
  }
  $("#chatstarts").replaceChildren(...(ch.turns.length ? [] : chatStarts().map(q => { const b = h("button", { class: "chip", type: "button", text: q }); b.addEventListener("click", () => { $("#chatin").value = q; chatSend(); }); return b; })));
  $("#chatsend").disabled = ch.busy || !sampleFn;
  $("#chatstop").hidden = !ch.busy;
  $("#chatin").disabled = !sampleFn;
  if (focus && sampleFn && matchMedia("(min-width: 700px)").matches) $("#chatin").focus();
  const last = log.lastElementChild; if (last && ch.busy) last.scrollIntoView({ block: "end" });
}
const CHAT_ERR = { not_granted: "You haven't allowed Claude on this page. Allow it when asked to use this chat.", sampling_disabled: "Claude isn't available for this account here.", rate_limited: "That's a lot of requests at once. Try again in a minute.", session_expired: "Sign in to Claude again, then try once more.", refused: "Claude couldn't help with that one. Try asking another way.", prompt_too_large: "That conversation got too long. Start a new chat.", empty_completion: "Claude didn't answer. Try asking another way." };
async function chatSend() {
  const box = $("#chatin"), q = box.value.trim();
  if (!q || ch.busy || !sampleFn) return;
  box.value = ""; box.style.height = "";
  ch.turns.push({ role: "user", text: q, at: new Date().toISOString() });
  const turn = { role: "assistant", text: "", pending: true, at: new Date().toISOString(), cards: [] };
  ch.turns.push(turn); ch.busy = true; renderChat();
  const hist = ch.turns.slice(0, -1).slice(-24).map(t => ({ role: t.role, content: (t.text || "") + ((t.cards || []).length ? "\n[" + t.cards.map(c => c.type === "handoff" ? "Handoff request shown" : `Change card: ${c.summary} (${c.status})`).join("; ") + "]" : "") || "(no text)" }));
  while (hist.length && hist[0].role !== "user") hist.shift();
  const input = [{ role: "user", content: chatRules() + "\n\nWhere things stand right now:\n" + chatSnapshot() }, { role: "assistant", content: "Got it. What would you like to work on?" }, ...hist];
  ch.ctl = new AbortController();
  try {
    if (ch.tools === null) { try { ch.tools = !!(await sampleFn.limits()).tools; } catch (e) { ch.tools = false; } }
    const opts = { signal: ch.ctl.signal, cache: false, onText: ({ text }) => { turn.text = text; renderChat(); } };
    if (ch.tools) opts.tools = chatTools(turn);
    const r = await sampleFn(input, opts);
    turn.text = r.text;
    if (r.truncated) turn.error = "This answer was cut short. Ask for less at a time.";
  } catch (e) {
    if (e && e.text) turn.text = e.text;
    if (e && e.code === "cancelled") { if (!turn.text) turn.text = "(Stopped.)"; }
    else turn.error = CHAT_ERR[e && e.code] || "Claude couldn't answer just now. Try again in a moment.";
    if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e.code)) { sampleFn = null; renderPlanBar(); }
  } finally {
    turn.pending = false; ch.busy = false; ch.ctl = null;
    if (!turn.text && !(turn.cards || []).length && !turn.error) turn.text = "(No answer.)";
    chatSave(); renderChat();
  }
}
function wireChat() {
  $("#composer").addEventListener("submit", e => { e.preventDefault(); chatSend(); });
  $("#chatin").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); chatSend(); } });
  $("#chatin").addEventListener("input", e => { const t = e.target; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 220) + "px"; });
  $("#chatstop").addEventListener("click", () => { if (ch.ctl) ch.ctl.abort(); });
  $("#chatnew").addEventListener("click", () => { if (ch.busy) return; ch.turns = []; chatSave(); renderChat(true); });
}

function wireCal() {
  renderBest();
  document.querySelectorAll(".pg[data-view]").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#cal-prev").addEventListener("click", () => { cv.month = monthOf(addDays(cv.month, -1)); cv.touched = true; renderCal(); });
  $("#cal-next").addEventListener("click", () => { cv.month = monthOf(addDays(cv.month, 32)); cv.touched = true; renderCal(); });
  $("#cal-today").addEventListener("click", () => { cv.month = monthOf(today()); cv.touched = true; renderCal(); });
  $("#cal-text").addEventListener("click", e => openText(null, null, e.currentTarget));
  for (const [id, keyName] of [["#strat", "ss-strat"], ["#best-d", "ss-best"]]) {
    try { $(id).open = localStorage.getItem(keyName) === "1"; } catch (e) {}
    $(id).addEventListener("toggle", () => { try { localStorage.setItem(keyName, $(id).open ? "1" : "0"); } catch (e) {} });
  }
  document.querySelectorAll("#vt button").forEach(b => b.addEventListener("click", () => {
    cv.mode = b.dataset.m; try { localStorage.setItem("ss-calmode", cv.mode); } catch (e) {}
    renderCal();
  }));
  $("#mscrim").addEventListener("click", e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && md.open) closeModal(); });
  try { matchMedia("(max-width: 700px)").addEventListener("change", renderCal); } catch (e) {}
  let v = "library";
  try { v = localStorage.getItem("ss-view") || v; const m = localStorage.getItem("ss-calmode"); if (m === "list" || m === "month") cv.mode = m; } catch (e) {}
  const hv = location.hash.slice(1); if (VIEWS[hv]) v = hv;
  trackHeader();
  cv.view = null; setView(VIEWS[v] ? v : "library");
}

// ----- settings-driven bits of the static page -----
function renderFlow() {
  const k = LEAD, sched = SCHED;
  const schedTxt = sched
    ? `${listJoin([...sched.platforms].filter(x => PK.includes(x)).map(x => PNAME[x]))}: upload the week's ${sched.name} pack to ${sched.name}${sched.claude ? " and tell Claude, who sets them up there" : " and schedule them there"}. ${sched.videoByPhone ? "Reels, Stories and anything else: the Phone pack." : "Stories and anything else: the Phone pack."}`
    : "Download the week's Phone pack: files, captions and times for everything, ready to post from your phone.";
  const rows = [["fl-sug", "suggested", "Suggested", "Claude placed it. Claude only moves posts that are still Suggested."],
    ["fl-lock", "locked", "Locked", "You approved the day, time and caption. Lock one post, or a whole week below."],
    ["fl-sch", "scheduled", "Scheduled", schedTxt],
    ["fl-post", "posted", "Posted", sched && sched.claude ? `${sched.name} posts are marked when Claude checks ${sched.name}. Mark phone posts yourself.` : "Mark each post Posted once it's up."]];
  $("#flow").replaceChildren(...rows.map(([c, st, b, t]) => h("li", { class: c }, h("i", { class: `pt p-${k} ${st}`, text: PSHORT[k] }), h("b", { text: b }), h("span", { text: t }))));
}
function renderLegend() {
  const k = LEAD;
  $("#legend").replaceChildren(
    ...[["suggested", "Suggested"], ["locked", "Locked"], ["scheduled", "Scheduled (Used)"], ["posted", "Posted (Used)"]].map(([st, t]) => h("span", {}, h("i", { class: `pt p-${k} ${st}`, text: PSHORT[k] }), " " + t)),
    h("span", {}, ...PK.map(x => h("i", { class: "pt p-" + x, text: PSHORT[x] })), " " + PK.map(x => PNAME[x]).join(" · ")));
}
function assetCfg() {
  const A = SET.assets && typeof SET.assets === "object" ? SET.assets : {};
  const who = OWNER || "the owner";
  const hostL = HOST ? cap1(HOST.word) : "Team";
  const people = arr(A.people).filter(x => x && x.label).map(x => ({ label: String(x.label), level: ["ok", "warn", "stop"].includes(x.level) ? x.level : "warn", text: String(x.text || "") }));
  return {
    name: NAME, slug: SLUG, about: String(SET.about || "").slice(0, 400), placeWord: String(A.placeWord || "Room"),
    categories: arr(A.categories).length ? arr(A.categories).map(String) : ["Products", "People + team", "Place", "Events", "Behind the scenes", "Details + textures"],
    places: arr(A.places).map(String),
    people: people.length ? people : [
      { label: "No people", level: "ok", text: "No people in it." },
      { label: hostL, level: "ok", text: `${hostL}: faces are OK to show.` },
      { label: "Photo shoot (released)", level: "ok", text: "From a photo shoot where everyone signed releases: faces are OK." },
      { label: `Cleared by ${who}`, level: "ok", text: `${cap1(who)} got the OK from the people in it, so faces are fine to show.` },
      { label: "Staff", level: "warn", text: "Staff: check with them before showing faces." },
      { label: "Customers or guests", level: "stop", text: "Customers or guests: show hands, backs and process only, not faces." },
      { label: "Under 18", level: "stop", text: "Under 18: never show faces." },
      { label: "Check", level: "warn", text: "Not checked yet: look for faces and logos before using." }],
  };
}
function uiSettings() {
  $("#tz").textContent = TZ + " time";
  $("#cal-text").hidden = !PK.includes("th");
  $("#chatnote").textContent = `New graphics and Reels are made in ${handoffWhere()}. When you ask for one here, Claude writes the request for you to paste there.`;
  renderFlow(); renderLegend(); renderBest(); buildTabs();
  $("#ltabs").replaceChildren();
  window.__studioAssetCfg = assetCfg();
  if (window.__assetsConfig) window.__assetsConfig(window.__studioAssetCfg);
}
function settingsChanged(raw) {
  applySettings(raw);
  uiSettings();
  DATA.items.forEach(buildCard); layout(true);
  reindex(); refreshAll();
  setView(cv.view || "library");
}
// ----- pieces and events from the db -----
const blobRef = v => !v ? null : typeof v === "object" ? blobRef(v.file || v.id) : /[/:.]/.test(String(v)) ? String(v) : "/_blob/" + v;
function toItem(id, d) {
  const kind = ["reel", "wide", "post", "carousel", "story"].includes(d.kind) ? d.kind : "post";
  const it = { id, kind, title: String(d.title || "Untitled"), sub: String(d.sub || ""), heads: String(d.note || d.heads || ""), ctype: String(d.ctype || CTYPES[0] || "Post"),
    theme: String(d.theme || ""), events: arr(d.events).filter(okDate).sort(), soldout: d.soldout ? String(d.soldout) : null, instr: d.host ? String(d.host) : null,
    week: Array.isArray(d.week) && d.week.length === 2 && d.week.every(okDate) ? [...d.week] : null, order: typeof d.order === "number" ? d.order : 9999, created: String(d.createdAt || "") };
  if (kind === "carousel" || kind === "story") {
    it.slides = arr(d.slides).map(x => x && typeof x === "object" ? { file: blobRef(x.file), preview: blobRef(x.preview || x.file) } : { file: blobRef(x), preview: blobRef(x) }).filter(x => x.file);
    if (!it.slides.length) it.slides = [{ file: PLACEHOLDER, preview: PLACEHOLDER }];
  } else if (kind === "post") { it.file = blobRef(d.file) || PLACEHOLDER; it.preview = blobRef(d.preview) || it.file; }
  else { it.file = blobRef(d.file); it.poster = blobRef(d.poster); it.dur = Math.round(Number(d.dur) || 0); }
  return it;
}
function piecesChanged(changes) {
  const touched = [];
  for (const c of changes) {
    const id = c.doc.id;
    if (c.type === "removed") { delete CAPS0[id]; delete byId[id]; delete els[id]; continue; }
    const d = c.doc.data() || {};
    CAPS0[id] = d.captions && typeof d.captions === "object" ? { ...d.captions } : {};
    byId[id] = toItem(id, d); touched.push(id);
  }
  DATA.items = Object.values(byId).sort((a, b) => a.order - b.order || a.created.localeCompare(b.created) || a.title.localeCompare(b.title));
  touched.forEach(id => buildCard(byId[id]));
  reindex(); layout(true); refreshAll();
  if (cv.view === "calendar") renderCal();
}
const evDocs = {};
function eventsChanged() {
  const list = Object.entries(evDocs).map(([id, e]) => ({ id, ...e })).filter(e => okDate(e.date) && !e.canceled)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  DATA.workshops = list.map(e => ({ date: e.date, title: String(e.title || ""), instr: e.host ? String(e.host) : null }));
  const teach = {};
  for (const e of list) for (const n of [e.host, e.cohost]) if (n) (teach[n] ||= new Set()).add(e.date);
  TEACH = Object.fromEntries(Object.entries(teach).map(([k, v]) => [k, [...v].sort()]));
  DATA.teach = TEACH;
  refreshAll(); if (cv.view === "calendar") renderCal();
}
function setupNote(show) {
  const n = $("#setup-note"); n.hidden = !show; if (!show) return;
  n.replaceChildren(h("b", { text: "This studio isn't set up yet." }),
    h("span", {}, "Open your brand's project in Claude and say ", h("code", { text: "Set up my social studio" }), ". Claude asks about the brand, then fills in this page: colors, fonts, platforms, posting times and your first pieces."));
}
function booted() { document.body.classList.remove("booting"); $("#boot").hidden = true; }

document.body.classList.add("booting");
applySettings({}); uiSettings();
build(); wireDrawer(); wireChat(); wireCal(); wireLightbox(); refreshAll();

(async () => {
  const use = window.claude && window.claude.use ? n => window.claude.use(n) : async () => null;
  const [dbNs, dlNs, userNs, smNs] = await Promise.all([use("db"), use("downloads"), use("user"), use("sample")]);
  dl = dlNs; sampleFn = smNs && typeof smNs.json === "function" ? smNs : null;
  if (cv.view === "chat") renderChat();
  if (userNs && typeof userNs.can === "function") { try { if (userNs.can("data.write") === false) canWrite = false; } catch (e) {} }
  if (window.STUDIO_TEMPLATE) {
    ch.loaded = true; booted();
    const n = $("#setup-note"); n.hidden = false;
    n.replaceChildren(h("b", { text: "This is the Social Studio template." }),
      h("span", {}, "Each brand gets its own copy of this page with its own colors, fonts, platforms, posting rules and library. To make one, open the brand's project in Claude and say ", h("code", { text: "Set up my social studio" }), "."));
    return;
  }
  if (!dbNs) {
    ch.loaded = true; booted(); if (cv.view === "chat") renderChat();
    banner("This view can't load or save the studio. Open it in Claude while signed in.");
    refreshAll(); return;
  }
  db = dbNs;
  chatLoad(userNs);
  let first = true;
  const bootT = setTimeout(() => { if (first) { first = false; booted(); banner("The brand settings are taking a while to load. Reload the page if it stays like this."); } }, 9000);
  db.collection("settings").doc("brand").onSnapshot(snap => {
    const d = snap && snap.exists ? snap.data() : null;
    settingsChanged(d || {});
    setupNote(!d);
    if (!canWrite) banner(`You can view this studio but not change it. Ask ${OWNER || "the owner"} for edit access to mark pieces.`);
    if (first) { first = false; clearTimeout(bootT); booted(); }
  }, () => { if (first) { first = false; clearTimeout(bootT); booted(); } banner("Live updates stopped. Reload the page to see the latest settings."); });
  db.collection("pieces").onSnapshot(snap => piecesChanged(snap.docChanges()), () => banner("Live updates stopped. Reload the page to see the latest pieces."));
  db.collection("events").onSnapshot(snap => {
    for (const c of snap.docChanges()) { if (c.type === "removed") delete evDocs[c.doc.id]; else evDocs[c.doc.id] = { ...c.doc.data() }; }
    eventsChanged();
  }, () => {});
  db.collection("captions").onSnapshot(snap => {
    for (const c of snap.docChanges()) {
      const id = c.doc.id;
      if (c.type === "removed") delete caps[id]; else caps[id] = { ...c.doc.data() };
      if (!els[id]) continue;
      updateCard(id);
      if (dr.id === id) {
        markTabs(); syncCapStatus();
        if (document.activeElement !== $ta() && !dr.timer) { $ta().value = capOf(id, dr.k); meter(); }
      }
    }
    updateSummary(); applyFilter();
  }, () => banner("Live updates stopped. Reload the page to see the latest captions."));
  db.collection("items").onSnapshot(snap => {
    for (const c of snap.docChanges()) {
      if (c.type === "removed") delete state[c.doc.id];
      else state[c.doc.id] = { ...c.doc.data() };
    }
    refreshAll();
  }, () => banner("Live updates stopped. Reload the page to see the latest marks."));
  db.collection("ideas").onSnapshot(snap => {
    for (const c of snap.docChanges()) { if (c.type === "removed") delete ideas[c.doc.id]; else ideas[c.doc.id] = { ...c.doc.data() }; }
    renderIdeas();
  }, () => {});
  db.collection("shots").onSnapshot(snap => {
    for (const c of snap.docChanges()) { if (c.type === "removed") delete shots[c.doc.id]; else shots[c.doc.id] = { ...c.doc.data() }; }
    renderIdeas();
  }, () => {});
  db.collection("threads").onSnapshot(snap => {
    for (const c of snap.docChanges()) { if (c.type === "removed") delete thd[c.doc.id]; else thd[c.doc.id] = { ...c.doc.data() }; }
    renderThreads();
  }, () => banner("Live updates stopped. Reload the page to see the latest Threads drafts."));
  db.collection("cal").onSnapshot(snap => {
    for (const c of snap.docChanges()) {
      if (c.type === "removed") delete cal[c.doc.id]; else cal[c.doc.id] = normEntry({ ...c.doc.data() });
    }
    reindex();
    if (!cv.touched) {
      const nx = Object.values(cal).filter(e => validEntry(e) && e.date >= today()).map(e => e.date).sort()[0];
      if (nx) cv.month = monthOf(nx);
    }
    calChanged();
  }, () => banner("Live updates stopped. Reload the page to see the latest calendar."));
  refreshAll(); renderCal();
})();

})();
(() => {
const SPR = { sprites: [], cols: 1 };
// Categories, places and the people rules come from the brand's settings (the main script calls configure()).
let CATEGORIES = [], ROOMS = [], PEOPLE = ["Check"], PEOPLE_RULE = { Check: ["warn", "Not checked yet: look for faces and logos before using."] }, PEOPLE_OK = new Set(), CFG = { slug: "studio", name: "", about: "" };
const COLORS = { pink: "#EBA4BE", magenta: "#C2266E", red: "#D03A2F", orange: "#E8812F", yellow: "#EBC23A", green: "#5E9A5A", teal: "#2FA7A3", blue: "#3F86D1", lilac: "#B79AD6", purple: "#6E4AA0", tan: "#D9B48A", brown: "#7A5236", cream: "#F2E9D6", white: "#FAFAF7", gray: "#9A948E", black: "#231F1D" };

const S = { assets: {}, list: [], filters: { type: new Set(), people: new Set(), colors: new Set(), categories: new Set(), room: new Set(), subjects: new Set(), orientation: new Set(), source: new Set() }, q: "", sort: "num", picks: [], cur: null, faceOk: false };
let db = null, assetsNs = null, dl = null, sample = null, canWrite = true;
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else if (k === "style") e.setAttribute("style", v);
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
let toastT; function toast(m) { const t = $("#a-toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3000); }
function banner(m) { $("#a-banner").textContent = m || ""; $("#a-banner").hidden = !m; }
const fileUrl = a => a.assetId ? "/_blob/" + a.assetId : a.file;
const arr = v => Array.isArray(v) ? v : [];
function configure(c) {
  if (!c) return;
  CFG = { ...CFG, ...c };
  CATEGORIES = arr(c.categories).map(String); ROOMS = arr(c.places).map(String);
  const ppl = arr(c.people).filter(x => x && x.label);
  PEOPLE = ppl.map(x => x.label); PEOPLE_RULE = Object.fromEntries(ppl.map(x => [x.label, [x.level, x.text]]));
  if (!PEOPLE_RULE.Check) { PEOPLE.push("Check"); PEOPLE_RULE.Check = ["warn", "Not checked yet: look for faces and logos before using."]; }
  PEOPLE_OK = new Set(ppl.filter(x => x.level === "ok").map(x => x.label));
  const place = String(c.placeWord || "Room");
  const f = FIELDS.find(x => x[0] === "room"); if (f) f[1] = place;
  const lab = document.getElementById("a-p-roomlab"); if (lab) lab.textContent = place;
  for (const a of Object.values(S.assets)) a._hs = null;
  refresh();
}

// ---------- thumbnails ----------
function thumbEl(a, cls = "th") {
  if (a.thumbId) return h("img", { class: cls, src: "/_blob/" + a.thumbId, alt: "", loading: "lazy" });
  if (a.assetId && a.type !== "video") return h("img", { class: cls, src: "/_blob/" + a.assetId, alt: "", loading: "lazy" });
  const t = a.thumb, sp = t && SPR.sprites[t.sprite];
  if (!sp) return h("span", { class: cls });
  const cols = SPR.cols, rows = sp.rows;
  const x = cols > 1 ? (t.col / (cols - 1)) * 100 : 0, y = rows > 1 ? (t.row / (rows - 1)) * 100 : 0;
  return h("span", { class: cls, style: `background-image:url(${sp.file});background-size:${cols * 100}% ${rows * 100}%;background-position:${x}% ${y}%` });
}

// ---------- search + filters ----------
const FIELDS = [
  ["type", "Type", a => [a.type === "video" ? "Videos" : "Photos"]],
  ["people", "People", a => [a.people || "Check"]],
  ["colors", "Colors", a => arr(a.colors)],
  ["categories", "Category", a => arr(a.categories)],
  ["room", "Room", a => a.room ? [a.room] : []],
  ["subjects", "Subject", a => arr(a.subjects)],
  ["orientation", "Shape", a => a.orientation ? [a.orientation[0].toUpperCase() + a.orientation.slice(1)] : []],
  ["source", "Source", a => a.source ? [a.source] : []],
];
const valuesOf = (k, a) => FIELDS.find(f => f[0] === k)[2](a);
function haystack(a) {
  return [a.id, a.num != null ? "#" + a.num : "", a.title, a.desc, a.room, a.people, a.source, a.shot, a.caution, a.notes, a.instructor, a.type,
    ...arr(a.categories), ...arr(a.subjects), ...arr(a.colors), a.orientation].filter(Boolean).join(" ").toLowerCase();
}
function matches(a, skip) {
  if (S.faceOk && !PEOPLE_OK.has(a.people)) return false;
  for (const [k] of FIELDS) {
    if (k === skip) continue;
    const sel = S.filters[k]; if (!sel.size) continue;
    const vals = valuesOf(k, a);
    if (!vals.some(v => sel.has(v))) return false;
  }
  const q = S.q.trim().toLowerCase(); if (!q) return true;
  const hs = a._hs || (a._hs = haystack(a));
  return q.split(/\s+/).every(tok => {
    if (/^#?\d+$/.test(tok)) return a.num === parseInt(tok.replace("#", ""), 10) || hs.includes(tok);
    return hs.includes(tok);
  });
}
function sorted(list) {
  const l = [...list];
  if (S.sort === "new") l.sort((a, b) => (b.added || "").localeCompare(a.added || "") || (a.num ?? 9999) - (b.num ?? 9999));
  else if (S.sort === "title") l.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  else l.sort((a, b) => (a.origin === "upload") - (b.origin === "upload") || (a.num ?? 9999) - (b.num ?? 9999) || a.id.localeCompare(b.id));
  return l;
}

function renderFilters() {
  const all = Object.values(S.assets);
  for (const [k, label] of FIELDS) {
    const box = $("#a-fg-" + k); if (!box) continue;
    const counts = new Map();
    for (const a of all) if (matches(a, k)) for (const v of valuesOf(k, a)) counts.set(v, (counts.get(v) || 0) + 1);
    let opts;
    if (k === "people") opts = PEOPLE; else if (k === "categories") opts = CATEGORIES; else if (k === "room") opts = ROOMS;
    else if (k === "colors") opts = Object.keys(COLORS);
    else { const every = new Map(); for (const a of all) for (const v of valuesOf(k, a)) every.set(v, (every.get(v) || 0) + 1); opts = [...every.keys()].sort((x, y) => every.get(y) - every.get(x)); }
    const sel = S.filters[k];
    const head = h("h4", {}, label, sel.size ? h("button", { type: "button", text: "Clear", onclick: () => { sel.clear(); refresh(); } }) : null);
    let body;
    if (k === "colors") {
      body = h("div", { class: "chips" }, opts.filter(c => (counts.get(c) || 0) || sel.has(c)).map(c => h("button", {
        class: "sw", type: "button", title: `${c} (${counts.get(c) || 0})`, "aria-label": `${c}, ${counts.get(c) || 0}`, "aria-pressed": String(sel.has(c)),
        style: `background:${COLORS[c]}`, onclick: () => { sel.has(c) ? sel.delete(c) : sel.add(c); refresh(); } })));
    } else {
      body = h("div", { class: "chips" }, opts.filter(v => (counts.get(v) || 0) || sel.has(v) || k === "people").map(v => h("button", {
        class: "chip" + ((counts.get(v) || 0) ? "" : " zero"), type: "button", "aria-pressed": String(sel.has(v)),
        onclick: () => { sel.has(v) ? sel.delete(v) : sel.add(v); refresh(); } },
        k === "people" ? h("i", { class: "dot", style: `background:var(--${(PEOPLE_RULE[v] || ["warn"])[0] === "ok" ? "ok" : (PEOPLE_RULE[v] || ["warn"])[0]})` }) : null,
        v, h("span", { class: "n", text: counts.get(v) || 0 }))));
    }
    const extra = k === "people" ? [
      h("label", { class: "chip", style: "display:inline-flex;gap:6px;align-items:center;margin-bottom:6px" },
        h("input", { type: "checkbox", id: "a-faceok", checked: S.faceOk, onchange: e => { S.faceOk = e.target.checked; refresh(); } }), "Only ones OK to post with faces"),
    ] : [];
    box.replaceChildren(head, ...extra, body);
  }
}

function renderActive() {
  const box = $("#a-activef"); const out = [];
  for (const [k] of FIELDS) for (const v of S.filters[k]) out.push(h("button", { class: "af", type: "button", title: "Remove filter", onclick: () => { S.filters[k].delete(v); refresh(); } }, v + " ×"));
  if (S.faceOk) out.push(h("button", { class: "af", type: "button", onclick: () => { S.faceOk = false; refresh(); } }, "OK with faces ×"));
  box.replaceChildren(...out);
}

function renderGrid() {
  const list = sorted(Object.values(S.assets).filter(a => matches(a)));
  S.list = list;
  const total = Object.keys(S.assets).length;
  $("#a-count").textContent = total ? `${list.length} of ${total} assets` : (db ? "No assets yet" : "");
  const grid = $("#a-grid");
  const frag = document.createDocumentFragment();
  for (const a of list) {
    const rule = (PEOPLE_RULE[a.people] || PEOPLE_RULE.Check)[0];
    const b = h("button", { class: "tile" + (S.picks.includes(a.id) ? " picked" : ""), type: "button", "data-id": a.id, "aria-label": `${a.title || a.id}${a.type === "video" ? ", video" : ""}` },
      thumbEl(a),
      a.num != null ? h("span", { class: "num", text: "#" + a.num }) : (a.origin === "upload" ? h("span", { class: "num", text: "NEW" }) : null),
      rule !== "ok" ? h("span", { class: "flag", title: PEOPLE_RULE[a.people] ? PEOPLE_RULE[a.people][1] : "", style: `background:var(--${rule})` }) : null,
      a.type === "video" ? h("span", { class: "vid", text: `▶ ${a.duration ? a.duration + "s" : "video"}` }) : null,
      h("span", { class: "cap", text: a.title || a.id }));
    b.addEventListener("click", () => openPanel(a.id, b));
    frag.append(b);
  }
  grid.replaceChildren(frag);
  const empty = $("#a-empty");
  if (!total) {
    empty.hidden = false;
    empty.replaceChildren(h("h3", { text: db ? "No assets yet" : "Your photos and video show up here" }),
      h("p", { text: db ? "Upload photos or video to start the library." : "Open this page in Claude while signed in to load the library. Every photo and clip gets a thumbnail here, searchable by name, subject, color, room and category." }));
  } else if (!list.length) {
    empty.hidden = false;
    empty.replaceChildren(h("h3", { text: "Nothing matches" }), h("p", { text: "Try fewer filters or a different word." }), h("button", { class: "btn ghost small", type: "button", text: "Clear search and filters", onclick: clearAll }));
  } else empty.hidden = true;
}
function clearAll() { for (const k in S.filters) S.filters[k].clear(); S.q = ""; $("#a-q").value = ""; S.faceOk = false; refresh(); }
function refresh() { renderFilters(); renderActive(); renderGrid(); renderTray(); }

// ---------- shortlist ----------
function renderTray() {
  const picks = S.picks.filter(id => S.assets[id]);
  $("#a-tray").hidden = !picks.length;
  $("#a-traycount").textContent = `${picks.length} for the next Reel`;
  $("#a-traythumbs").replaceChildren(...picks.slice(0, 8).map(id => thumbEl(S.assets[id], "")));
}
async function savePicks() {
  renderTray(); renderGrid(); syncPick();
  if (!db) return;
  try { await queue("lists", "reel", () => db.collection("lists").doc("reel").set({ ids: S.picks, updatedAt: new Date().toISOString() })); }
  catch (e) { writeErr(e); }
}
function togglePick(id) { S.picks = S.picks.includes(id) ? S.picks.filter(x => x !== id) : [...S.picks, id]; savePicks(); }
function shortlistText() {
  const lines = S.picks.filter(id => S.assets[id]).map(id => { const a = S.assets[id]; return `- ${id}${a.title ? " — " + a.title : ""}`; });
  return `Make a Reel${CFG.name ? " for " + CFG.name : ""} from these assets in my Asset Library:\n${lines.join("\n")}`;
}

// ---------- writes ----------
const chains = {};
function queue(col, id, fn) { const k = col + "/" + id; chains[k] = (chains[k] || Promise.resolve()).catch(() => {}).then(fn); return chains[k]; }
function writeErr(e) {
  const c = e && e.code;
  if (c === "permission_denied" || c === "not_granted") { canWrite = false; banner("You can browse this library but not change it."); }
  else toast("That change didn't save. Try again in a moment.");
}
function saveFields(id, patch) {
  const a = S.assets[id]; if (!a || !canWrite) return;
  Object.assign(a, patch); a._hs = null;
  $("#a-p-saved").textContent = db ? "Saving…" : "";
  if (!db) return;
  queue("assets", id, () => db.collection("assets").doc(id).update({ ...patch, editedAt: new Date().toISOString() }))
    .then(() => { if (S.cur === id) $("#a-p-saved").textContent = "Saved"; })
    .catch(e => { $("#a-p-saved").textContent = ""; writeErr(e); });
}

// ---------- detail panel ----------
function openPanel(id, opener) {
  const a = S.assets[id]; if (!a) return;
  S.cur = id; S.opener = opener;
  const pv = $("#a-p-preview");
  const big = el => window.msLightbox && window.msLightbox([{ type: a.type === "video" ? "video" : "img", src: fileUrl(a), alt: a.desc || a.title || a.id }], a.title || a.id, 0, el);
  const xb = h("button", { class: "xbtn", type: "button", "aria-label": "Larger preview of " + (a.title || a.id), title: "Open a larger preview" });
  xb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
  xb.addEventListener("click", () => { const v = pv.querySelector("video"); if (v) v.pause(); big(xb); });
  if (a.type === "video") pv.replaceChildren(h("video", { src: fileUrl(a), controls: true, playsinline: true, preload: "metadata", muted: true }), xb);
  else {
    const im = h("img", { src: fileUrl(a), alt: a.desc || a.title || a.id, class: "zoomable" });
    im.addEventListener("click", () => big(im));
    pv.replaceChildren(im, xb);
  }
  $("#a-p-title").value = a.title || ""; $("#a-p-id").textContent = a.id; $("#a-p-saved").textContent = "";
  $("#a-p-desc").value = a.desc || ""; $("#a-p-subjects").value = arr(a.subjects).join(", "); $("#a-p-notes").value = a.notes || a.caution || "";
  const roomSel = $("#a-p-room"); roomSel.replaceChildren(h("option", { value: "", text: "Not set" }), ...ROOMS.map(r => h("option", { value: r, text: r })));
  roomSel.value = a.room || "";
  const pSel = $("#a-p-people"); pSel.replaceChildren(...PEOPLE.map(p => h("option", { value: p, text: p === "Check" ? "Not checked yet" : p })));
  pSel.value = a.people || "Check";
  syncRule(a);
  $("#a-p-caution").hidden = !(a.caution && !a.notes); $("#a-p-caution").textContent = a.caution || "";
  $("#a-p-cats").replaceChildren(...CATEGORIES.map(c => h("button", { class: "chip", type: "button", "aria-pressed": String(arr(a.categories).includes(c)),
    onclick: e => { const cur = new Set(arr(S.assets[id].categories)); cur.has(c) ? cur.delete(c) : cur.add(c); e.currentTarget.setAttribute("aria-pressed", String(cur.has(c))); saveFields(id, { categories: [...cur] }); refreshSoon(); } }, c)));
  $("#a-p-colors").replaceChildren(h("span", { text: "Colors:" }), ...arr(a.colors).map(c => h("span", { style: "display:inline-flex;gap:5px;align-items:center" }, h("i", { style: `background:${COLORS[c] || "#ccc"}` }), c)),
    ...(arr(a.swatches).length ? [h("span", { text: " · palette" }), ...arr(a.swatches).map(x => h("i", { style: `background:${x}`, title: x }))] : []));
  const mb = a.bytes ? (a.bytes / 1e6).toFixed(1) + " MB" : "";
  $("#a-p-meta").textContent = [a.type === "video" ? `Video · ${a.duration || "?"}s` : "Photo", a.w && a.h ? `${a.w}×${a.h}` : "", a.orientation, mb, a.source, a.shot, a.added ? "added " + a.added.slice(0, 10) : ""].filter(Boolean).join(" · ");
  const up = a.origin === "upload";
  $("#a-p-upacts").hidden = !up || !canWrite; $("#a-p-confirm").hidden = true;
  $("#a-p-suggest").hidden = !(up && sample && S.canImages && a.type === "photo");
  $("#a-p-dl").hidden = !dl;
  [$("#a-p-title"), $("#a-p-desc"), $("#a-p-subjects"), $("#a-p-notes"), roomSel, pSel].forEach(el => el.disabled = !canWrite);
  syncPick();
  $("#a-scrim").hidden = false; document.body.style.overflow = "hidden";
  $("#a-p-close").focus();
}
function syncRule(a) {
  const [lvl, txt] = PEOPLE_RULE[a.people] || PEOPLE_RULE.Check;
  const r = $("#a-p-rule"); r.className = "rule" + (lvl === "ok" ? "" : " " + lvl); r.textContent = txt;
}
function syncPick() { if (!S.cur) return; const on = S.picks.includes(S.cur); $("#a-p-pick").textContent = on ? "On the Reel shortlist ✓" : "Add to Reel shortlist"; $("#a-p-pick").className = on ? "btn ghost small" : "btn small"; }
function closePanel() {
  flushText();
  $("#a-scrim").hidden = true; document.body.style.overflow = ""; $("#a-p-preview").replaceChildren();
  const o = S.opener; S.cur = null; refresh(); if (o && document.body.contains(o)) o.focus();
}
let refreshT; function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(() => { if (!S.cur) refresh(); }, 300); }
const textFields = { "a-p-title": "title", "a-p-desc": "desc", "a-p-notes": "notes" };
let textT = null, textPending = null;
function flushText() { if (!textPending) return; clearTimeout(textT); const [id, patch] = textPending; textPending = null; saveFields(id, patch); }
function wirePanel() {
  for (const [elId, key] of Object.entries(textFields)) {
    const el = $("#" + elId);
    el.addEventListener("input", () => { if (!S.cur) return; textPending = [S.cur, { [key]: el.value }]; clearTimeout(textT); textT = setTimeout(flushText, 900); $("#a-p-saved").textContent = ""; });
    el.addEventListener("blur", flushText);
  }
  $("#a-p-subjects").addEventListener("change", e => { const v = e.target.value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean); saveFields(S.cur, { subjects: [...new Set(v)] }); });
  $("#a-p-room").addEventListener("change", e => saveFields(S.cur, { room: e.target.value }));
  $("#a-p-people").addEventListener("change", e => { saveFields(S.cur, { people: e.target.value }); syncRule(S.assets[S.cur]); });
  $("#a-p-close").addEventListener("click", closePanel);
  $("#a-scrim").addEventListener("click", e => { if (e.target === e.currentTarget) closePanel(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#a-scrim").hidden) closePanel(); });
  $("#a-p-pick").addEventListener("click", () => togglePick(S.cur));
  $("#a-p-copyid").addEventListener("click", () => copy(S.cur, "ID copied"));
  $("#a-p-dl").addEventListener("click", () => download(S.cur));
  $("#a-p-del").addEventListener("click", () => { $("#a-p-confirm").hidden = false; });
  $("#a-p-delno").addEventListener("click", () => { $("#a-p-confirm").hidden = true; });
  $("#a-p-delyes").addEventListener("click", deleteUpload);
  $("#a-p-suggest").addEventListener("click", suggest);
}
function copy(text, msg) {
  const fallback = () => toast("Couldn't copy here. Select the text and copy it instead.");
  try { navigator.clipboard.writeText(text).then(() => toast(msg), fallback); } catch (e) { fallback(); }
}
async function download(id) {
  const a = S.assets[id]; if (!a || !dl) return;
  const btn = $("#a-p-dl"); btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), " Preparing…");
  try {
    const r = await fetch(fileUrl(a)); if (!r.ok) throw new Error("fetch");
    const blob = await r.blob();
    const ext = (a.fileName || a.file || "").split(".").pop() || (a.type === "video" ? "mp4" : "jpg");
    await dl.save({ filename: `${CFG.slug || "studio"}-${a.id}.${ext.toLowerCase()}`, data: blob }); toast("Downloaded");
  } catch (e) { toast(e && e.code === "declined" ? "Download cancelled" : "That download didn't work. Try again."); }
  finally { btn.disabled = false; btn.textContent = "Download"; }
}

// ---------- uploads ----------
function colorName(r, g, b) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, v = mx, s = mx ? (mx - mn) / mx : 0;
  let hh = 0; const d = mx - mn;
  if (d) { const R = r / 255, G = g / 255, B = b / 255; hh = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; hh *= 60; if (hh < 0) hh += 360; }
  if (v < 0.2) return "black";
  if (s < 0.12) return v > 0.85 ? "white" : v > 0.3 ? "gray" : "black";
  if (hh >= 15 && hh < 50 && (v < 0.6 || s < 0.68)) return v >= 0.6 ? "tan" : "brown";
  if (s < 0.2 && !(hh >= 255 && hh < 345)) return (hh >= 20 && hh <= 60 && v > 0.8) ? "cream" : v > 0.85 ? "white" : "gray";
  if (hh < 12 || hh >= 345) return s > 0.6 ? "red" : "pink";
  if (hh < 40) return "orange"; if (hh < 70) return "yellow"; if (hh < 165) return "green"; if (hh < 195) return "teal"; if (hh < 255) return "blue";
  if (hh < 315) return s < 0.5 ? "lilac" : "purple";
  return (s < 0.6 && v > 0.65) ? "pink" : "magenta";
}
const NEUTRAL = new Set(["black", "white", "gray", "cream", "tan", "brown"]);
function colorsFrom(canvas) {
  const c = document.createElement("canvas"); c.width = c.height = 48;
  c.getContext("2d").drawImage(canvas, 0, 0, 48, 48);
  const px = c.getContext("2d").getImageData(0, 0, 48, 48).data, tally = {};
  for (let i = 0; i < px.length; i += 4) { const n = colorName(px[i], px[i + 1], px[i + 2]); tally[n] = (tally[n] || 0) + 1; }
  const tot = px.length / 4, ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  return [...ranked.filter(([n, c]) => !NEUTRAL.has(n) && c / tot >= 0.05).slice(0, 3).map(x => x[0]), ...ranked.filter(([n, c]) => NEUTRAL.has(n) && c / tot >= 0.35).slice(0, 1).map(x => x[0])];
}
function loadImage(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res([im, u]); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("decode")); }; im.src = u; }); }
function loadVideoFrame(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = u;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) * 0.3); };
    v.onseeked = () => res([v, u]); v.onerror = () => { URL.revokeObjectURL(u); rej(new Error("decode")); };
  });
}
function squareThumb(src, w, h, size = 360) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const s = Math.min(w, h); c.getContext("2d").drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  return c;
}
const toBlob = (c, q = 0.82) => new Promise(r => c.toBlob(r, "image/jpeg", q));
function slug(s) { return s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "upload"; }
// ---------- convert before upload ----------
// The asset store takes MP4 or WebM video and PNG, JPEG, GIF or WebP images, 20 MB per file. iPhone videos are .mov and
// usually much bigger, and iPhone photos can be HEIC, so the page converts those here first: video is re-recorded to
// MP4 (WebM where the browser can't make MP4) at a bitrate that lands under the cap; photos become JPEG.
const MAX_UP = 20 * 1024 * 1024, TARGET_UP = 18 * 1024 * 1024;
const OK_IMG = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]), OK_VID = new Set(["video/mp4", "video/webm"]);
let actx = null;
function warmAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch (e) { actx = null; } }
function recType() {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) return null;
  const c = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return c.find(x => { try { return MediaRecorder.isTypeSupported(x); } catch (e) { return false; } }) || null;
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function convErr(message) { const e = new Error(message); e.conv = true; return e; }
async function convertVideo(file, onProgress, squeeze = 1) {
  const mime = recType(); if (!mime) throw convErr("norec");
  const url = URL.createObjectURL(file), v = document.createElement("video");
  v.src = url; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
  try {
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(convErr("decode")); setTimeout(() => rej(convErr("decode")), 20000); });
    const dur = v.duration;
    if (!isFinite(dur) || dur <= 0 || !v.videoWidth) throw convErr("decode");
    const audioBps = 96000, total = (TARGET_UP * 8 / dur) * squeeze, vbps = Math.min(6e6, total - audioBps);
    if (vbps < 450000) throw convErr("long");
    const longEdge = vbps >= 3e6 ? 1920 : vbps >= 1.4e6 ? 1280 : 960;
    const sc = Math.min(1, longEdge / Math.max(v.videoWidth, v.videoHeight));
    const cw = Math.max(2, Math.round(v.videoWidth * sc / 2) * 2), ch = Math.max(2, Math.round(v.videoHeight * sc / 2) * 2);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const g = cv.getContext("2d");
    const stream = cv.captureStream(30);
    let src = null, dest = null, withSound = false;
    try {
      warmAudio();
      if (actx && actx.state === "running") { src = actx.createMediaElementSource(v); dest = actx.createMediaStreamDestination(); src.connect(dest); dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr)); withSound = true; }
    } catch (e) { withSound = false; }
    if (!withSound) v.muted = true;
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(vbps), audioBitsPerSecond: audioBps });
    const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    let live = true, snap = null;
    const draw = () => { if (!live) return; g.drawImage(v, 0, 0, cw, ch);
      if (!snap && v.currentTime >= Math.min(1, dur * 0.3)) { snap = document.createElement("canvas"); snap.width = cw; snap.height = ch; snap.getContext("2d").drawImage(cv, 0, 0); }
      onProgress && onProgress(v.currentTime, dur); if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw); else requestAnimationFrame(draw); };
    const ended = new Promise(res => { v.onended = res; });
    g.drawImage(v, 0, 0, cw, ch);
    rec.start(1000);
    try { await v.play(); }
    catch (e) { if (withSound || !v.muted) { v.muted = true; await v.play(); withSound = false; } else throw e; }
    draw();
    await ended;
    live = false;
    await new Promise(r => setTimeout(r, 250));
    rec.stop(); await stopped;
    try { if (src) src.disconnect(); } catch (e) {}
    stream.getTracks().forEach(tr => tr.stop());
    const type = mime.split(";")[0];
    const blob = new Blob(chunks, { type });
    if (blob.size > MAX_UP && squeeze > 0.5) return convertVideo(file, onProgress, squeeze * 0.65);
    if (blob.size > MAX_UP) throw convErr("toobig");
    if (!snap) { snap = document.createElement("canvas"); snap.width = cw; snap.height = ch; snap.getContext("2d").drawImage(cv, 0, 0); }
    return { blob, type, ext: type === "video/mp4" ? "mp4" : "webm", withSound, w: cw, h: ch, dur, snap };
  } finally { URL.revokeObjectURL(url); v.removeAttribute("src"); v.load(); }
}
async function convertImage(file) {
  const [im, url] = await loadImage(file); URL.revokeObjectURL(url);
  const sc = Math.min(1, 4096 / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
  c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
  for (const q of [0.9, 0.8, 0.68]) { const b = await toBlob(c, q); if (b && b.size <= MAX_UP) return { blob: b, type: "image/jpeg", ext: "jpg" }; }
  throw convErr("toobig");
}
const CONV_MSG = {
  decode: "This browser can't open that file. On your phone: Settings, Camera, Formats, Most Compatible. Or send it to Claude in chat.",
  long: "Too long for one upload: trim it to about 4 minutes or less, or send it to Claude in chat.",
  toobig: "Still over 20 MB after converting. Trim it, or send it to Claude in chat.",
  norec: "This browser can't convert video. Try the Claude desktop app or Chrome, or send it to Claude in chat.",
};
async function uploadFiles(files) {
  if (!assetsNs || !db) { toast("Uploads aren't available in this view."); return; }
  const box = $("#a-uplist"); box.hidden = false;
  const rows = [...files].map(f => { const st = h("span", { class: "st", text: "Waiting" }); box.append(h("div", { class: "it" }, h("b", { text: f.name }), st)); return [f, st]; });
  let firstId = null;
  for (const [f, st] of rows) {
    const ext0 = (f.name.split(".").pop() || "").toLowerCase();
    const isVid = f.type.startsWith("video/") || ["mov", "m4v", "mp4", "webm", "hevc"].includes(ext0);
    const isImg = !isVid && (f.type.startsWith("image/") || ["heic", "heif", "jpg", "jpeg", "png", "webp", "gif"].includes(ext0));
    if (!isVid && !isImg) { st.textContent = "Not a photo or video"; st.classList.add("err"); continue; }
    try {
      // Convert first when the store won't take the file as it is (format or size).
      let up = f, upType = f.type, conv = null;
      const needs = isVid ? (!OK_VID.has(f.type) || f.size > MAX_UP) : (!OK_IMG.has(f.type) || f.size > MAX_UP);
      if (needs) {
        if (isVid) {
          st.replaceChildren(h("span", { class: "spin" }), " Converting for upload… keep this tab open");
          conv = await convertVideo(f, (t, d) => { st.replaceChildren(h("span", { class: "spin" }), ` Converting ${mmss(t)} / ${mmss(d)} · keep this tab open`); });
        } else {
          st.replaceChildren(h("span", { class: "spin" }), " Converting to JPG");
          conv = await convertImage(f);
        }
        up = conv.blob; upType = conv.type;
      }
      st.replaceChildren(h("span", { class: "spin" }), " Reading");
      let src, url, w, hgt, dur = null;
      if (isVid && conv && conv.snap) { src = conv.snap; w = conv.w; hgt = conv.h; dur = Math.round(conv.dur * 10) / 10; url = null; }
      else if (isVid) { [src, url] = await loadVideoFrame(up); w = src.videoWidth; hgt = src.videoHeight; dur = Math.round((src.duration || 0) * 10) / 10; }
      else { [src, url] = await loadImage(up); w = src.naturalWidth; hgt = src.naturalHeight; }
      const tc = squareThumb(src, w, hgt); if (url) URL.revokeObjectURL(url);
      const colors = colorsFrom(tc), thumbBlob = await toBlob(tc);
      st.replaceChildren(h("span", { class: "spin" }), " Uploading");
      const main = await assetsNs.upload(up, { type: upType });
      const th = await assetsNs.upload(thumbBlob);
      const id = "up-" + Date.now().toString(36) + "-" + slug(f.name);
      const doc = { id, type: isVid ? "video" : "photo", title: f.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), desc: "", categories: [], room: "", subjects: [],
        people: "Check", source: "Upload", colors, swatches: [], w, h: hgt, orientation: w / hgt < 0.9 ? "vertical" : w / hgt > 1.1 ? "horizontal" : "square",
        bytes: up.size, fileName: conv ? f.name.replace(/\.[^.]+$/, "") + "." + conv.ext : f.name, assetId: main.id, thumbId: th.id, origin: "upload", added: new Date().toISOString(), caution: "", notes: "" };
      if (dur) doc.duration = dur;
      if (conv) { doc.converted = { from: f.type || ext0, bytes: f.size, sound: conv.withSound !== false }; if (isVid && conv.withSound === false) doc.caution = "Converted without sound (the browser blocked audio). Send the original to Claude in chat if the sound matters."; }
      await db.collection("assets").doc(id).set(doc);
      S.assets[id] = doc; firstId = firstId || id;
      st.textContent = conv ? (isVid ? "Converted and added" : "Converted to JPG and added") : "Added";
    } catch (e) {
      st.classList.add("err");
      st.textContent = e && e.conv ? CONV_MSG[e.message] || CONV_MSG.decode : e && e.code === "unsupported_type" ? "This format can't upload. Send it to Claude in chat." : e && e.message === "decode" ? CONV_MSG.decode : e && e.code === "too_large" ? CONV_MSG.toobig : "Didn't upload. Try again.";
    }
  }
  refresh();
  // Keep problems on screen longer so there's time to read them.
  setTimeout(() => { box.hidden = true; box.replaceChildren(); }, box.querySelector(".st.err") ? 30000 : 6000);
  if (firstId) { toast("Uploaded. Add a room, subjects and who's in it."); openPanel(firstId, null); }
}
async function deleteUpload() {
  const id = S.cur, a = S.assets[id]; if (!a || a.origin !== "upload") return;
  try {
    if (assetsNs) { if (a.assetId) await assetsNs.delete(a.assetId).catch(() => {}); if (a.thumbId) await assetsNs.delete(a.thumbId).catch(() => {}); }
    await db.collection("assets").doc(id).delete();
    delete S.assets[id]; S.picks = S.picks.filter(x => x !== id); closePanel(); savePicks(); toast("Upload deleted");
  } catch (e) { writeErr(e); }
}
async function suggest() {
  const id = S.cur, a = S.assets[id]; if (!a || !sample) return;
  const btn = $("#a-p-suggest"); btn.disabled = true; btn.replaceChildren(h("span", { class: "spin" }), " Looking…");
  try {
    const r = await fetch("/_blob/" + (a.thumbId || a.assetId)); const img = await r.blob();
    const out = await sample.json(`You are tagging a photo for ${CFG.name || "a small brand"}'s asset library.${CFG.about ? " About the brand: " + CFG.about : ""}
Look at the image and answer with JSON only: {"title": short name (max 6 words), "desc": one plain sentence describing what is visible, "subjects": 2-6 short lowercase subject tags, "categories": any of ${JSON.stringify(CATEGORIES)}, "room": one of ${JSON.stringify(ROOMS)} or "" if unsure}.
Describe only what is visible. Do not guess names of people.`, { images: [img], modelTier: "quick" });
    const patch = {};
    if (out.title && !a.title?.trim().length || (out.title && a.title === (a.fileName || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "))) patch.title = String(out.title).slice(0, 80);
    if (out.desc && !a.desc) patch.desc = String(out.desc).slice(0, 300);
    if (Array.isArray(out.subjects)) patch.subjects = [...new Set([...arr(a.subjects), ...out.subjects.map(s => String(s).toLowerCase().slice(0, 30))])].slice(0, 10);
    if (Array.isArray(out.categories)) patch.categories = [...new Set([...arr(a.categories), ...out.categories.filter(c => CATEGORIES.includes(c))])];
    if (out.room && ROOMS.includes(out.room) && !a.room) patch.room = out.room;
    saveFields(id, patch); openPanel(id, S.opener); toast("Tags added. Check them over.");
  } catch (e) { toast(e && e.code === "not_granted" ? "Claude suggestions aren't available here." : "Couldn't get suggestions. Try again later."); }
  finally { btn.disabled = false; btn.textContent = "Suggest tags with Claude"; }
}

// ---------- wiring ----------
function wire() {
  let qt; $("#a-q").addEventListener("input", e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value; refresh(); }, 120); });
  $("#a-sort").addEventListener("change", e => { S.sort = e.target.value; renderGrid(); });
  $("#a-openf").addEventListener("click", () => $("#a-rail").classList.add("open"));
  $("#a-closef").addEventListener("click", () => $("#a-rail").classList.remove("open"));
  $("#a-upload").addEventListener("click", () => { warmAudio(); $("#a-file").click(); });
  $("#a-file").addEventListener("change", e => { if (e.target.files.length) uploadFiles(e.target.files); e.target.value = ""; });
  $("#a-traycopy").addEventListener("click", () => copy(shortlistText(), "Shortlist copied. Paste it to Claude with what the Reel is for."));
  $("#a-trayclear").addEventListener("click", () => { S.picks = []; savePicks(); });
  $("#a-trayview").addEventListener("click", () => { const sel = new Set(S.picks); clearAll(); S.q = ""; renderGrid(); const els = [...document.querySelectorAll("#view-assets .tile")].filter(t => sel.has(t.dataset.id)); if (els[0]) els[0].scrollIntoView({ behavior: "smooth", block: "center" }); });
  wirePanel();
}
window.__assetsConfig = configure;
wire();
if (window.__studioAssetCfg) configure(window.__studioAssetCfg); else refresh();

(async () => {
  const use = window.claude && window.claude.use ? n => window.claude.use(n) : async () => null;
  const [dbNs, aNs, dlNs, smp, userNs] = await Promise.all([use("db"), use("assets"), use("downloads"), use("sample"), use("user")]);
  assetsNs = aNs; dl = dlNs; sample = smp;
  if (userNs && typeof userNs.can === "function") { try { if (userNs.can("data.write") === false) canWrite = false; } catch (e) {} }
  if (sample && sample.limits) { try { const l = await sample.limits(); S.canImages = !!(l && l.images); } catch (e) { S.canImages = false; } }
  $("#a-upload").hidden = !(assetsNs && dbNs && canWrite);
  if (!dbNs) { banner("This view can't load the library. Open it in Claude while signed in."); refresh(); return; }
  db = dbNs;
  db.collection("assets").onSnapshot(snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === "removed") delete S.assets[ch.doc.id];
      else { const d = { ...ch.doc.data() }; d.id = d.id || ch.doc.id; S.assets[ch.doc.id] = d; }
    }
    if (S.cur) { renderTray(); } else refresh();
  }, () => banner("Live updates stopped. Reload to see the latest."));
  db.collection("lists").doc("reel").onSnapshot(snap => {
    const ids = snap.exists ? arr(snap.data().ids) : [];
    if (JSON.stringify(ids) !== JSON.stringify(S.picks)) { S.picks = ids; renderTray(); if (!S.cur) renderGrid(); syncPick(); }
  });
})();
})();
