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

function shell() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Stevo HQ</title><style>
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
function load(){if(!PASS)return;fetch('/api/hq',{headers:{'x-dash-pass':PASS}}).then(function(r){if(r.status===401)throw 0;return r.text();}).then(function(h){document.open();document.write(h);document.close();}).catch(function(){document.getElementById('err').textContent=PASS?'Wrong password':'';});}
document.getElementById('go').onclick=function(){PASS=document.getElementById('pw').value;localStorage.setItem('stevo-hq-pass',PASS);load();};
document.getElementById('pw').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('go').click();});
load();
</script></body></html>`;
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
    ["Test Plan", "https://claude.ai/code/artifacts", "Device sessions (private artifact for now)"],
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

export default async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname === "/api/hq") {
    const pass = req.headers.get("x-dash-pass") || "";
    const DASH = Netlify.env.get("DASH_PASSWORD");
    if (!DASH) return new Response("DASH_PASSWORD not set in Netlify env", { status: 500 });
    if (pass !== DASH) return new Response("unauthorized", { status: 401 });
    try {
      return new Response(await dashboard(), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    } catch (e) {
      return new Response("data error: " + String((e as Error)?.message || e), { status: 502 });
    }
  }
  return new Response(shell(), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export const config = { path: ["/hq", "/api/hq"] };
