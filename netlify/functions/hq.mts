// Stevo HQ — password-gated, server-rendered dashboard.
// GET /hq      -> public shell (password prompt; no data in it)
// GET /api/hq  -> full dashboard HTML, only with the right x-dash-pass header.
// Data is fetched fresh per request from the stevo-tracker Supabase project
// using its publishable (read-only, public-by-design) key; the bot refreshes
// git/CI/handoff state into stevo_hq_state each cycle. No secrets live here.
const SUPA = "https://jmmtuiwylzgqdstqztkx.supabase.co";
const PK = "sb_publishable_W8tvd0SLZDVUX6RtuIf87w_XxfgyGnW";
const BASE_MS = Date.parse("2026-08-09T00:00:00Z");

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const get = async (p: string) => {
  const r = await fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: PK, Authorization: `Bearer ${PK}` } });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};

function shell(apiPath: string, title: string) {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>__TITLE__</title><style>
body{margin:0;background:#0B0B0F;color:#F2F2F5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.g{background:#131318;border:1px solid #24242C;border-radius:14px;padding:28px;width:min(320px,90vw);text-align:center}
h1{font-size:22px;margin:0 0 4px;letter-spacing:1px}h1 span{color:#7C4DFF}
p{color:#8D8D9C;font-size:13px;margin:0 0 16px}
input{width:100%;box-sizing:border-box;background:#0B0B0F;border:1px solid #24242C;border-radius:8px;color:#F2F2F5;padding:10px;font-size:15px;margin-bottom:10px}
button{width:100%;background:#7C4DFF;color:#12061F;border:none;border-radius:8px;padding:10px;font-size:15px;font-weight:700;cursor:pointer}
.err{color:#FF5C6B;font-size:12px;min-height:16px;margin-top:8px}</style></head><body>
<div class="g"><h1>STEVO <span>HQ</span></h1><p>Enter the shared password</p>
<input id="pw" type="password" autocomplete="current-password"><button id="go">Enter</button><div class="err" id="err"></div></div>
<script>
var PASS=localStorage.getItem('stevo-hq-pass')||'';
function load(){if(!PASS)return;fetch('__API__',{headers:{'x-dash-pass':PASS}}).then(function(r){if(r.status===401)throw 0;return r.text();}).then(function(h){document.open();document.write(h);document.close();}).catch(function(){document.getElementById('err').textContent=PASS?'Wrong password':'';});}
document.getElementById('go').onclick=function(){PASS=document.getElementById('pw').value;localStorage.setItem('stevo-hq-pass',PASS);load();};
document.getElementById('pw').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('go').click();});
load();
</script></body></html>`;
  return page.replace(/__API__/g, apiPath).replace(/__TITLE__/g, title);
}

async function dashboard(): Promise<string> {
  const [bugs, tasks, miles, stateRows] = await Promise.all([
    get("bugs?select=id,title,status,created_at,updated_at&order=updated_at.desc"),
    get("stevo_project_tasks?select=wbs,phase,task,owner,status,priority,start_week,end_week&order=sort_order"),
    get("stevo_milestones?select=name,target_date,status&order=sort_order"),
    get("stevo_hq_state?select=data,updated_at&id=eq.1"),
  ]);
  const st = (stateRows[0]?.data ?? {}) as Record<string, any>;

  // ── metrics ──
  const counts: Record<string, number> = {};
  for (const b of bugs) counts[b.status] = (counts[b.status] || 0) + 1;
  const now = new Date();
  const dayKey = (iso: string) => { const d = new Date(iso); d.setUTCHours(d.getUTCHours() - 6); return d.toISOString().slice(0, 10); };
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(now.getTime() - i * 86400000 - 6 * 3600000); days.push(d.toISOString().slice(0, 10)); }
  const closedBy: Record<string, number> = {}, filedBy: Record<string, number> = {};
  for (const d of days) { closedBy[d] = 0; filedBy[d] = 0; }
  for (const b of bugs) {
    if (b.status === "closed") { const k = dayKey(b.updated_at); if (k in closedBy) closedBy[k]++; }
    const k2 = dayKey(b.created_at); if (k2 in filedBy) filedBy[k2]++;
  }
  const closedToday = closedBy[days[13]] || 0;
  const recent = bugs.filter((b: any) => b.status === "closed").slice(0, 6);

  // ── chart ──
  const W = 660, H = 150, PL = 26, PB = 22, pw = W - PL - 6, ph = H - PB - 8;
  const maxv = Math.max(1, ...days.map(d => Math.max(closedBy[d], filedBy[d])));
  const gw = pw / 14, bw = Math.min(12, (gw - 6) / 2);
  const bar = (x: number, v: number, color: string, label: string) => {
    if (!v) return "";
    const h = Math.max(3, v / maxv * ph), y = 8 + ph - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}"><title>${esc(label)}: ${v}</title></rect>`;
  };
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Filed vs closed, 14 days">`;
  for (const f of [0, 0.5, 1]) { const y = 8 + ph - f * ph; svg += `<line x1="${PL}" y1="${y}" x2="${W - 6}" y2="${y}" stroke="#24242C"/><text x="${PL - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#8D8D9C">${Math.round(f * maxv)}</text>`; }
  days.forEach((d, i) => {
    const gx = PL + i * gw + (gw - 2 * bw - 2) / 2;
    svg += bar(gx, filedBy[d], "#0891B2", `${d} filed`) + bar(gx + bw + 2, closedBy[d], "#7C4DFF", `${d} closed`);
    if (i % 2 === 1 || i === 13) svg += `<text x="${(PL + i * gw + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#8D8D9C">${d.slice(5).replace("-", "/")}</text>`;
  });
  svg += "</svg>";

  // ── week-by-week plan ──
  const curWeek = Math.max(1, Math.floor((Date.now() - BASE_MS) / (7 * 86400000)) + 1);
  const open = tasks.filter((t: any) => t.status !== "done");
  const doneCount = tasks.length - open.length;
  const inWeek = (t: any, w: number) => t.start_week != null && t.end_week != null && t.start_week <= w && t.end_week >= w;
  const thisWeek = open.filter((t: any) => inWeek(t, curWeek));
  const overdue = open.filter((t: any) => t.end_week != null && t.end_week < curWeek);
  const later = open.filter((t: any) => t.start_week != null && t.start_week > curWeek);
  const unscheduled = open.filter((t: any) => t.start_week == null);
  const taskRow = (t: any, extra = "") => `<li class="task p-${esc(t.priority || "medium")}"><span class="towner">${esc((t.owner || "?").slice(0, 6))}</span>${esc(t.task)}${extra}<span class="tphase">${esc((t.phase || "").replace(/^\d+\.\s*/, ""))}</span></li>`;
  const weekGroups = new Map<number, any[]>();
  for (const t of later) { const w = t.start_week; if (!weekGroups.has(w)) weekGroups.set(w, []); weekGroups.get(w)!.push(t); }
  let planHtml = "";
  if (overdue.length) planHtml += `<h3 class="wh late">Slipped from earlier weeks · ${overdue.length}</h3><ul class="tasks">${overdue.map(t => taskRow(t, ` <em>(w${t.end_week})</em>`)).join("")}</ul>`;
  planHtml += `<h3 class="wh now">This week — Week ${curWeek} · ${thisWeek.length} task${thisWeek.length === 1 ? "" : "s"}</h3>`;
  planHtml += thisWeek.length ? `<ul class="tasks">${thisWeek.map(t => taskRow(t)).join("")}</ul>` : `<p class="none">Nothing scheduled for this week.</p>`;
  for (const w of [...weekGroups.keys()].sort((a, b) => a - b)) {
    const monday = new Date(BASE_MS + (w - 1) * 7 * 86400000 + 86400000);
    planHtml += `<h3 class="wh">Week ${w} · from ${monday.toISOString().slice(5, 10).replace("-", "/")}</h3><ul class="tasks">${weekGroups.get(w)!.map(t => taskRow(t)).join("")}</ul>`;
  }
  if (unscheduled.length) planHtml += `<h3 class="wh">Unscheduled · ${unscheduled.length}</h3><ul class="tasks">${unscheduled.map(t => taskRow(t)).join("")}</ul>`;
  planHtml += `<p class="none">${doneCount} of ${tasks.length} plan tasks done.</p>`;

  const mileChip: Record<string, [string, string]> = { done: ["#3DDC85", "Done"], on_track: ["#0891B2", "On track"], at_risk: ["#FFB020", "At risk"], upcoming: ["#8D8D9C", "Upcoming"], missed: ["#FF5C6B", "Missed"] };
  const milesHtml = miles.map((m: any) => {
    const [c, lbl] = mileChip[m.status] || ["#8D8D9C", m.status];
    return `<li class="mile"><span class="mdot" style="background:${c}"></span><span class="mname">${esc(m.name)}</span><span class="mdate">${esc(m.target_date || "")}</span><span class="mchip" style="color:${c}">${esc(lbl)}</span></li>`;
  }).join("");

  const li = (items: string[], empty: string) => items.length ? items.map(t => `<li>${esc(t)}</li>`).join("") : `<li class="empty">${esc(empty)}</li>`;
  const links = [
    ["Bug Board", "https://bug-tracker-virid.vercel.app", "File, triage, review, close"],
    ["Test Plan", "/test-plan", "Device-testing sessions, live from the tracker"],
    ["Handoff Ledger", "https://github.com/Stevo-App/stevo/blob/main/HANDOFF.md", "Who owes whom what"],
    ["GitHub Repo", "https://github.com/Stevo-App/stevo", "Code, history, branches"],
    ["Pull Requests", "https://github.com/Stevo-App/stevo/pulls", "Approval gates"],
    ["CI Runs", "https://github.com/Stevo-App/stevo/actions", "Every push tested"],
    ["Supabase", "https://supabase.com/dashboard/project/cskoqudiumgaquqwowlc", "DB, SQL editor, functions"],
    ["Expo / EAS", "https://expo.dev/accounts/stevoapp", "Builds, OTA, TestFlight"],
    ["Launch Plan Doc", "https://github.com/Stevo-App/stevo/blob/main/LAUNCH-PLAN.md", "High-level phases"],
  ].map(([n, u, d]) => `<a class="link" href="${u}"><span class="lname">${esc(n)}</span><span class="ldesc">${esc(d)}</span></a>`).join("");

  const chips = `<span class="chip">CI <b style="color:${st.ci_color || "#8D8D9C"}">●</b> ${esc(st.ci_state || "?")}</span><span class="chip">${st.commits_24h ?? "?"} commits · 24h</span><span class="chip">live · rendered now</span>`;
  const tile = (n: number | string, l: string, c: string) => `<div class="tile"><div class="num" style="color:${c}">${n}</div><div class="tlbl">${esc(l)}</div></div>`;
  const tiles = tile((counts["open"] || 0) + (counts["features-open"] || 0), "Open queue", "#FFB020") + tile(counts["in-progress"] || 0, "In progress", "#0891B2")
    + tile(counts["in-review"] || 0, "Awaiting device test", "#7C4DFF") + tile(counts["questions"] || 0, "Need a decision", "#FF5C6B")
    + tile(counts["closed"] || 0, "Closed all-time", "#3DDC85") + tile(closedToday, "Closed today", "#3DDC85");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Stevo HQ</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#0B0B0F;--card:#131318;--card2:#1A1A21;--line:#24242C;--text:#F2F2F5;--muted:#8D8D9C;--purple:#7C4DFF;--green:#3DDC85;--amber:#FFB020;--red:#FF5C6B;--cyan:#0891B2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:'Atkinson Hyperlegible',system-ui,sans-serif;line-height:1.5;padding:0 16px 60px}
.wrap{max-width:980px;margin:0 auto}header{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:26px 0 14px;border-bottom:1px solid var(--line)}
h1{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:700;font-size:clamp(30px,6vw,40px);letter-spacing:1px;margin:0;text-transform:uppercase}h1 span{color:var(--purple)}
.chips{display:flex;gap:8px;margin-left:auto;flex-wrap:wrap}.chip{font-family:'IBM Plex Mono',monospace;font-size:11px;padding:3px 9px;border-radius:99px;border:1px solid var(--line);color:var(--muted)}
h2{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:600;font-size:19px;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin:30px 0 10px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:18px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.num{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:700;font-size:34px;line-height:1;font-variant-numeric:tabular-nums}.tlbl{color:var(--muted);font-size:12px;margin-top:5px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:8px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.wh{font-family:'Barlow Condensed',Impact,sans-serif;font-size:16px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin:16px 0 8px}
.wh.now{color:var(--green)}.wh.late{color:var(--red)}
.tasks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.task{font-size:13.5px;background:var(--card2);border-radius:8px;padding:8px 10px;display:flex;gap:9px;align-items:baseline;flex-wrap:wrap;border-left:3px solid var(--line);overflow-wrap:anywhere}
.task.p-critical{border-left-color:var(--red)}.task.p-high{border-left-color:var(--amber)}.task.p-medium{border-left-color:var(--cyan)}.task.p-low{border-left-color:var(--line)}
.towner{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--muted);text-transform:uppercase;flex:none}
.tphase{margin-left:auto;font-size:11px;color:var(--muted)}
.task em{color:var(--red);font-style:normal;font-size:11px}
.none{color:var(--muted);font-size:13px}
.mile{display:flex;gap:10px;align-items:baseline;font-size:13.5px;padding:7px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}.mile:last-child{border-bottom:none}
.mdot{width:8px;height:8px;border-radius:99px;flex:none;align-self:center}.mname{overflow-wrap:anywhere}.mdate{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--muted)}.mchip{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:11px}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.col h3{font-family:'Barlow Condensed',Impact,sans-serif;font-size:16px;letter-spacing:.6px;text-transform:uppercase;margin:0 0 8px}
.col ul,.recent ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.col li,.recent li{font-size:13.5px;background:var(--card2);border-radius:8px;padding:8px 10px;overflow-wrap:anywhere}.col li.empty{color:var(--muted);background:none;padding-left:0}
.links{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.link{display:flex;flex-direction:column;gap:3px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none}
.link:hover{border-color:var(--purple)}.lname{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:600;font-size:17px;letter-spacing:.5px;color:var(--text);text-transform:uppercase}.ldesc{font-size:12px;color:var(--muted)}
.dot{display:inline-block;width:7px;height:7px;border-radius:99px;margin-right:8px}
.foot{color:var(--muted);font-size:12px;border-top:1px solid var(--line);margin-top:36px;padding-top:12px}
</style></head><body><div class="wrap">
<header><h1>Stevo <span>HQ</span></h1><div class="chips">${chips}</div></header>
<div class="tiles">${tiles}</div>
<h2>Flow — filed vs closed, last 14 days</h2>
<div class="panel"><div class="legend"><span><i style="background:#0891B2"></i>Filed</span><span><i style="background:#7C4DFF"></i>Closed</span></div>${svg}</div>
<h2>The plan — week by week</h2>
<div class="panel">${planHtml}</div>
<h2>Milestones</h2>
<div class="panel"><ul style="list-style:none;margin:0;padding:0">${milesHtml}</ul></div>
<h2>Who's on what</h2>
<div class="cols">
<div class="col panel"><h3 style="color:var(--green)">Steve</h3><ul>${li(st.steve_items || [], "Nothing waiting")}<li class="empty">${counts["in-review"] || 0} fixes await device testing</li></ul></div>
<div class="col panel"><h3 style="color:var(--cyan)">Davis</h3><ul>${li(st.davis_items || [], "Nothing waiting")}</ul></div>
<div class="col panel"><h3 style="color:var(--purple)">The bots</h3><ul>${li(st.bot_items || [], "Queue empty — next shift within 2h")}</ul></div>
</div>
<h2>Everything, one tap away</h2>
<div class="links">${links}</div>
<h2>Recent activity</h2>
<div class="panel recent"><ul>${recent.map((b: any) => `<li><span class="dot" style="background:#3DDC85"></span>${esc(b.title)}</li>`).join("")}${(st.last_commits || []).slice(0, 5).map((s: string) => `<li><span class="dot" style="background:#7C4DFF"></span>${esc(s)}</li>`).join("")}</ul></div>
<p class="foot">Rendered live from the tracker on every load · password-gated · green dots = cards closed, purple = commits landed.</p>
</div></body></html>`;
}

// ── Test plan: the device-testing sessions, rendered live ────────────────────
const SESSIONS: [string, string, string, string, string, string[]][] = [
  ["A","Settings & Payment","Solo · one phone · ~20 min","Quick wins on the Settings screens. No second account needed.","",["2e45d329","eff5a54d","7c9cc080","03145951","9117d4d3","d311689e","f33fc3a8","3b3211ea"]],
  ["B","Login, App-Lock & Account Safety","Solo · one phone · ~45 min","Logout/login flows, Face ID, the app lock, password reset. Reinstall tests last.","",["2bcae661","8d64baf3","d7768bf2","b77a16f8","50f6f5ec","60ffd3bd","1be81f37","1bf86456","0e883325","b2c16f47","646d60c5"]],
  ["C","Tour, Navigation & Voice","Solo · one phone · ~30 min","The first-launch tour, walkthroughs, tab navigation, and the dictation mic.","",["15e2acc8","48ff5061","bda4f039","889cce98","7866d12c","030394c1","2ae1556b","b8465256","d093699d","f8ae8252","f61030c4"]],
  ["D","Friends, Crews & Notifications","Two phones · ~45 min","Grab a second device. Friend requests, crew invites, every notification behavior.","",["dd70b305","ae82d88c","7ccb0862","39691ecb","873fc12b","04b88929","5651c181","2255eb21","0ce4b305","69ac4082","e8c6dffe","ce98476d"]],
  ["E","Bets & Money","Two phones · ~45 min","Custom bets, Face Off tabs, settlement math, the Venmo/Cash App handoff.","",["e4cf1b96","ba521105","1639689b","1a773c30","266a824e"]],
  ["F","Poker Night","Two+ phones · ~1 hour · the fun one","Host a real tournament and work the list as the game runs.","",["b333be90","40a6d5fe","94002e91","d8cd28c6","d0f65ab6","0a683e17","2de35849","3b7ff9be","45ce35fe","a6671a9a","7777f88f","df436f93","0a51ebe5","2149570e","f38fc267","e7937e0a"]],
  ["N","New Since The Roadmap","Fresh out of the bot shop","Fixes that reached review after the roadmap was drawn.","",[]],
  ["G","Lines & Live Scores","Needs games flowing into Lines","Real games on the board required. Includes the tied-game Home check.","blocked",["a1490bd1","371dfa6c","b9f0f3c0","5bcb18f1"]],
  ["H","Golf","Deferred — skip unless bored","Golf is on hold; fixes are merged and safe.","deferred",["b616e45c","000560cd","7050573c","0359e93e","2fbd40c2","69c15f98"]],
];
const NOTES: Record<string, string> = {
  "3b3211ea":"Start here; the settle-modal half finishes in Session E once someone owes you money.",
  "60ffd3bd":"Needs a delete + reinstall of the app — save for the end of the session.",
  "646d60c5":"Log out and into a test account on the same phone.",
  "889cce98":"Half of this one needs an Android device.",
  "d093699d":"Dictate with a deliberate mid-sentence pause; watch for duplicated words.",
  "e4cf1b96":"The $1-at-10x test: a losing proposer owes $1, not $10.",
  "1639689b":"Both phones tap a result at the same moment.",
  "d0f65ab6":"Check Tournament Info BEFORE finishing: preview must equal the final payouts.",
  "2149570e":"Turn the volume up — clips should play at blind changes.",
  "5bcb18f1":"During a real TIED game, Home must highlight neither team.",
};

async function testPlan(): Promise<string> {
  const cards = await get("bugs?select=id,title,severity,status,how_to_test&status=in.(in-review,closed)");
  const byShort: Record<string, any> = {};
  for (const c of cards) byShort[c.id.slice(0, 8)] = c;
  const mapped = new Set(SESSIONS.flatMap(s => s[5]));
  const newIds = Object.keys(byShort).filter(k => !mapped.has(k) && byShort[k].status === "in-review").sort();

  const cardHtml = (short: string) => {
    const c = byShort[short];
    if (!c) return "";
    const sev = (c.severity || "Low").toLowerCase();
    const note = NOTES[short] ? `<p class="note">${esc(NOTES[short])}</p>` : "";
    if (c.status === "closed") {
      return `<li class="card verified"><div class="cardrow"><span class="vmark">&#10003;</span><span class="sev sev-${sev}">${esc(c.severity)}</span><span class="ctitle">${esc(c.title)}</span></div><p class="vlabel">Verified &amp; closed on the tracker</p></li>`;
    }
    return `<li class="card"><label class="cardrow"><input type="checkbox" data-id="${short}"><span class="sev sev-${sev}">${esc(c.severity)}</span><span class="ctitle">${esc(c.title)}</span></label><details><summary>How to test</summary>${note}<p class="howto">${esc((c.how_to_test || "").trim())}</p><p class="cid">tracker card ${short}</p></details><button class="closebtn" data-close="${short}">&#10003; Passed &mdash; close on tracker</button></li>`;
  };

  let sections = "";
  for (const [letter, name, meta, blurb, flag, ids0] of SESSIONS) {
    const ids = letter === "N" ? newIds : ids0;
    const body = ids.map(cardHtml).join("");
    if (!body) continue;
    sections += `<section class="session collapsed${flag ? " session-" + flag : ""}" data-s="${letter}"><header class="shead" role="button" tabindex="0" aria-expanded="false"><span class="sletter">${letter}</span><div><h2>${esc(name)}</h2><p class="smeta">${esc(meta)}</p></div><span class="scount"></span><span class="chev">&#9662;</span></header><div class="sbody"><p class="sblurb">${esc(blurb)}</p><ul class="cards">${body}</ul></div></section>`;
  }

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Stevo Test Sessions</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{--bg:#0E0E13;--surface:#17171E;--surface2:#1E1E27;--line:#26262F;--text:#F2F2F5;--muted:#8D8D9C;--accent:#8B63FF;--accent-ink:#12061F;--high:#FF5C6B;--high-ink:#2A0D11;--med:#FFB020;--med-ink:#2A1F05;--low:#3DDC85;--low-ink:#0A2416;--done:#3DDC85}
*{box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:'Atkinson Hyperlegible',system-ui,sans-serif;margin:0;padding:0 16px 80px;line-height:1.5}
.wrap{max-width:720px;margin:0 auto}.top{padding:28px 0 10px;border-bottom:1px solid var(--line);margin-bottom:20px}
h1{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:700;font-size:clamp(34px,7vw,46px);letter-spacing:.5px;margin:0;text-transform:uppercase}
.sub{color:var(--muted);margin:6px 0 14px}.progress{display:flex;align-items:center;gap:12px}
.bar{flex:1;height:8px;background:var(--surface2);border-radius:99px;overflow:hidden;display:flex}.bar i{display:block;height:100%;width:0;background:var(--done)}.bar b{display:block;height:100%;width:0;background:var(--accent)}
.ptext{font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--muted);white-space:nowrap}
.session{margin:14px 0}.shead{display:flex;align-items:center;gap:14px;cursor:pointer;padding:6px 8px;margin:0 -8px;border-radius:12px}.shead:hover{background:var(--surface)}.chev{color:var(--muted);font-size:15px;transition:transform .15s;margin-left:6px}.session.collapsed .chev{transform:rotate(-90deg)}.session.collapsed .sbody{display:none}.sbody{margin-top:4px}
.sletter{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:700;font-size:26px;background:var(--accent);color:var(--accent-ink);width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none}
.session-blocked .sletter,.session-deferred .sletter{background:var(--surface2);color:var(--muted)}
.shead h2{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:600;font-size:24px;letter-spacing:.4px;margin:0;text-transform:uppercase}
.smeta{margin:0;color:var(--muted);font-size:14px}.scount{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--muted)}
.sblurb{color:var(--muted);font-size:15px;margin:10px 0 12px;max-width:62ch}
.cards{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.card.done{opacity:.55}.card.done .ctitle{text-decoration:line-through;text-decoration-color:var(--done)}
.card.verified{border-color:var(--done);opacity:.75}.card.verified .ctitle{text-decoration:line-through;text-decoration-color:var(--done)}
.vmark{color:var(--done);font-weight:700;font-size:18px;width:20px;text-align:center;flex:none}
.vlabel{margin:4px 0 0 30px;font-size:12.5px;color:var(--done);font-family:'IBM Plex Mono',monospace}
.cardrow{display:flex;align-items:flex-start;gap:10px;cursor:pointer}.card.verified .cardrow{cursor:default}
.cardrow input{width:20px;height:20px;margin:2px 0 0;accent-color:var(--done);flex:none}
.sev{font-family:'IBM Plex Mono',monospace;font-size:10.5px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;border-radius:5px;padding:2px 6px;margin-top:3px;flex:none}
.sev-high{background:var(--high);color:var(--high-ink)}.sev-medium{background:var(--med);color:var(--med-ink)}.sev-low{background:var(--low);color:var(--low-ink)}.sev-critical{background:var(--high);color:var(--high-ink)}
.ctitle{font-size:15px;overflow-wrap:anywhere}details{margin:8px 0 2px 30px}summary{color:var(--accent);font-size:13.5px;cursor:pointer}
.howto{font-size:14px;color:var(--text);background:var(--surface2);border-radius:8px;padding:10px 12px;margin:8px 0;white-space:pre-wrap}
.note{font-size:13.5px;color:var(--med);margin:8px 0 0;font-style:italic}
.cid{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted);margin:4px 0 2px}
.foot{color:var(--muted);font-size:13.5px;border-top:1px solid var(--line);margin-top:34px;padding-top:14px}
.closebtn{display:none;margin:8px 0 2px 30px;background:var(--low);color:var(--low-ink);border:none;border-radius:8px;padding:7px 12px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Atkinson Hyperlegible',system-ui,sans-serif}
.card.done .closebtn{display:inline-block}.closebtn:disabled{opacity:.6}
a{color:var(--accent)}
</style></head><body><div class="wrap">
<header class="top"><h1>Stevo Test Sessions</h1>
<p class="sub">Rendered live from the tracker. Checkmarks are private to this device (&ldquo;I ran it&rdquo;); closing a card on the tracker is the shared verify &mdash; green rows show what either tester closed. Tap a section to expand it. <a href="/hq">&larr; back to HQ</a></p>
<div class="progress"><div class="bar"><i id="vbar"></i><b id="pbar"></b></div><span class="ptext" id="ptext"></span></div></header>
${sections}
<p class="foot">Anything that fails: don&rsquo;t close the card &mdash; write what you saw in its feedback box (or tell Claude) and the bots take it from there.</p>
</div>
<script>
(function(){
  var KEY='stevo-test-checks-v1';var state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){state={};}
  var boxes=[].slice.call(document.querySelectorAll('input[type=checkbox]'));
  var verified=document.querySelectorAll('.card.verified').length;
  var total=boxes.length+verified;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
  function refresh(){
    var done=0;
    boxes.forEach(function(b){var li=b.closest('.card');if(b.checked){done++;li.classList.add('done');}else li.classList.remove('done');});
    var v=document.getElementById('vbar');if(v)v.style.width=(100*verified/total)+'%';
    var el=document.getElementById('pbar');if(el)el.style.width=(100*done/total)+'%';
    var t=document.getElementById('ptext');if(t)t.textContent=verified+' verified · '+done+' checked · '+total+' total';
    document.querySelectorAll('.session').forEach(function(s){
      var bs=[].slice.call(s.querySelectorAll('input[type=checkbox]'));
      var vd=s.querySelectorAll('.card.verified').length;
      var d=bs.filter(function(b){return b.checked;}).length;
      var c=s.querySelector('.scount');if(c)c.textContent=(vd+d)+'/'+(bs.length+vd);
    });
  }
  boxes.forEach(function(b){if(state[b.dataset.id])b.checked=true;b.addEventListener('change',function(){state[b.dataset.id]=b.checked?1:0;save();refresh();});});
  var PASS=localStorage.getItem('stevo-hq-pass')||'';
  document.querySelectorAll('.closebtn').forEach(function(btn){
    btn.addEventListener('click',function(){
      if(!confirm('Close this card on the tracker? This is the shared, official verify.'))return;
      btn.disabled=true;btn.textContent='Closing…';
      fetch('/api/close',{method:'POST',headers:{'x-dash-pass':PASS,'content-type':'application/json'},body:JSON.stringify({id:btn.dataset.close})})
        .then(function(r){return r.json().catch(function(){return{};}).then(function(j){if(!r.ok)throw new Error(j.error||r.status);});})
        .then(function(){
          var card=btn.closest('.card');
          card.classList.remove('done');card.classList.add('verified');
          var cb=card.querySelector('input');if(cb){cb.checked=false;cb.disabled=true;}
          btn.textContent='Closed ✓';verified++;refresh();
        })
        .catch(function(e){btn.disabled=false;btn.textContent='Close failed — try again ('+e.message+')';});
    });
  });
  var OKEY='stevo-test-open-v1';var openSet={};
  try{openSet=JSON.parse(localStorage.getItem(OKEY)||'{}')||{};}catch(e){openSet={};}
  document.querySelectorAll('.session').forEach(function(sec){
    var k=sec.dataset.s;
    if(openSet[k]){sec.classList.remove('collapsed');}
    var h=sec.querySelector('.shead');
    function toggle(){
      sec.classList.toggle('collapsed');
      var open=!sec.classList.contains('collapsed');
      h.setAttribute('aria-expanded',open?'true':'false');
      openSet[k]=open?1:0;
      try{localStorage.setItem(OKEY,JSON.stringify(openSet));}catch(e){}
    }
    h.addEventListener('click',toggle);
    h.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}});
  });
  refresh();
})();
</script></body></html>`;
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const html = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" };
  if (url.pathname.startsWith("/api/")) {
    const pass = req.headers.get("x-dash-pass") || "";
    const DASH = Netlify.env.get("DASH_PASSWORD");
    if (!DASH) return new Response("DASH_PASSWORD not set in Netlify env", { status: 500 });
    if (pass !== DASH) return new Response("unauthorized", { status: 401 });
    if (url.pathname === "/api/close" && req.method === "POST") {
      const KEY = Netlify.env.get("TRACKER_SERVICE_KEY");
      if (!KEY) return new Response(JSON.stringify({ error: "TRACKER_SERVICE_KEY not set in Netlify env" }), { status: 500 });
      let short = "";
      try { short = String((await req.json()).id || "").slice(0, 8); } catch { /* noop */ }
      if (!/^[0-9a-f]{8}$/.test(short)) return new Response(JSON.stringify({ error: "bad id" }), { status: 400 });
      const wh = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
      const rows = await (await fetch(`${SUPA}/rest/v1/bugs?select=id,notes,status&status=eq.in-review`, { headers: wh })).json();
      const card = rows.find((c: any) => c.id.startsWith(short));
      if (!card) return new Response(JSON.stringify({ error: "card not found in review" }), { status: 404 });
      const ts = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
      const patch = { status: "closed", notes: (card.notes || "").trimEnd() + `\n\n[${ts}] CLOSED from the password-gated test plan after device testing.` };
      const r = await fetch(`${SUPA}/rest/v1/bugs?id=eq.${card.id}`, { method: "PATCH", headers: wh, body: JSON.stringify(patch) });
      if (!r.ok) return new Response(JSON.stringify({ error: "tracker " + r.status }), { status: 502 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    try {
      const body = url.pathname === "/api/test-plan" ? await testPlan() : await dashboard();
      return new Response(body, { status: 200, headers: html });
    } catch (e) {
      return new Response("data error: " + String((e as Error)?.message || e), { status: 502 });
    }
  }
  if (url.pathname === "/test-plan") return new Response(shell("/api/test-plan", "Stevo Test Sessions"), { status: 200, headers: html });
  return new Response(shell("/api/hq", "Stevo HQ"), { status: 200, headers: html });
};

export const config = { path: ["/hq", "/api/hq", "/test-plan", "/api/test-plan", "/api/close"] };
