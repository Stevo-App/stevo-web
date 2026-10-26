/* HQ World: the same dashboard as a clickable 3D campus at night (Three.js, loaded on demand).
   Every building is one HQ section; clicking it opens that section's live panel through the
   same Expand overlay the flat page uses, so tables, charts and refresh buttons keep working.
   The road along the front is the launch road: one pylon per milestone, tap one for its tasks.
   Nothing here is rendered twice: the signs read their one-line status from the page itself. */
(function () {
  if (window.StevoWorld) return;
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js';
  var AREAS = {
    launch:  {label: 'Act & launch',          body: 0x273463, win: '#F3C744', accent: '#F3C744'},
    product: {label: 'Product & operations',  body: 0x1c3552, win: '#9fd8ff', accent: '#7cc5ec'},
    finance: {label: 'Money',                 body: 0x1b3b36, win: '#a9f1d4', accent: '#85cdb4'},
    growth:  {label: 'Growth & marketing',    body: 0x2c2f58, win: '#cfc0ff', accent: '#b9a6ff'}
  };
  // The campus plan: where each section stands, how big it is, which block it belongs to.
  var PLAN = [
    {slug: 'do-this-next',     area: 'launch',  pos: [-20, -7],   size: [6, 5.5, 5]},
    {slug: 'on-pace',          area: 'launch',  pos: [-20, 4],    size: [5, 7, 5]},
    {slug: 'team',             area: 'launch',  pos: [-10, -13],  size: [5, 4, 4.5]},
    {slug: 'app-health',       area: 'product', pos: [18, -9],    size: [6, 8, 5.5]},
    {slug: 'testers-on-stevo', area: 'product', pos: [20, 3],     size: [5.5, 6, 5]},
    {slug: 'odds-api-credits', area: 'product', pos: [10, -14],   size: [3.6, 9.5, 3.6]},
    {slug: 'money',            area: 'finance', pos: [-10, 9],    size: [6, 6.5, 5]},
    {slug: 'vendors-orders',   area: 'finance', pos: [-21, 14],   size: [7, 3.2, 5]},
    {slug: 'marketing-social', area: 'growth',  pos: [10, 9],     size: [5.5, 7.5, 5]},
    {slug: 'web-traffic-links',area: 'growth',  pos: [21, 13.5],  size: [5.5, 4.2, 4.5]}
  ];
  var TOOLS = {slug: 'tools', area: 'launch', pos: [0, 8], size: [2.6, 2, 2.6], title: 'Tools & links', stat: 'Every service, one tap away'};

  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function clip(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
  function kpiLine(kpi) { return kpi ? text(kpi.querySelector('.klbl')) + ' ' + text(kpi.querySelector('.knum')) : ''; }

  // One line per section, read from what the page already shows.
  function statFor(section, slug) {
    var q = function (sel) { return section.querySelector(sel); };
    var all = function (sel) { return Array.prototype.slice.call(section.querySelectorAll(sel)); };
    var kpis = all('.kpi'), s = '';
    if (slug === 'app-health' && kpis.length >= 3) s = text(kpis[0].querySelector('.knum')) + ' user reports · ' + text(kpis[2].querySelector('.knum')).split('/')[0].trim() + ' crash reports';
    else if (slug === 'team' && q('.hbar')) s = all('.hbar').slice(0, 3).map(function (b) { return text(b.querySelector('.hname')) + ' ' + text(b.querySelector('.hval b, .hval')).split(' ').slice(0, 2).join(' '); }).join(' · ');
    else if (slug === 'on-pace' && q('.pace-stat')) s = text(q('.pace-stat'));
    else if (slug === 'do-this-next' && q('.lane')) s = all('.lane').map(function (l) { return text(l.querySelector('.lane-head b')) + ': ' + text(l.querySelector('.lane-tag')).toLowerCase(); }).join(' · ');
    else if (slug === 'the-road') {
      var items = all('.tl-item'), late = items.filter(function (i) { return i.classList.contains('late'); })[0];
      s = items.filter(function (i) { return i.classList.contains('done'); }).length + ' of ' + items.length + ' milestones done' + (late ? ' · ' + text(late.querySelector('.tl-name')) + ' is late' : '');
    }
    else if (slug === 'marketing-social' && q('.soc-card')) s = all('.soc-card').map(function (c) { return text(c.querySelector('.soc-name')) + ' ' + text(c.querySelector('.soc-num')); }).join(' · ');
    else if (slug === 'web-traffic-links' && q('#traffic-summary')) s = text(q('#traffic-summary'));
    if (!s && kpis.length) s = kpis.slice(0, 2).map(kpiLine).join(' · ');
    if (!s) s = text(q('.mlead, .pace-stat, .mnone, .cnote, p'));
    s = s.replace(/\s*[↻]\s*Refresh.*$/, '').replace(/Loading[^·]*$/, '').trim();
    return clip(s || 'Tap for the live numbers', 72);
  }
  function titleOf(heading) { return heading && heading.firstChild ? heading.firstChild.textContent.trim() : ''; }

  // The sections on the page, as the world shows them. Reads the DOM every time it is asked.
  function catalog() {
    var out = [];
    PLAN.forEach(function (p) {
      var heading = document.querySelector('h2[data-sec="' + p.slug + '"]');
      var section = heading && heading.closest('section');
      if (!section) return;
      out.push({kind: 'section', slug: p.slug, area: p.area, pos: p.pos, size: p.size, title: titleOf(heading), stat: statFor(section, p.slug)});
    });
    var road = document.querySelector('h2[data-sec="the-road"]');
    if (road) out.push({kind: 'section', slug: 'the-road', area: 'launch', pos: [0, 21], size: [0, 0, 0], title: titleOf(road), stat: statFor(road.closest('section'), 'the-road')});
    if (document.querySelector('.hq-tools-button')) out.push({kind: 'tools', slug: 'tools', area: 'launch', pos: TOOLS.pos, size: TOOLS.size, title: TOOLS.title, stat: TOOLS.stat});
    return out;
  }
  function milestones() {
    return Array.prototype.slice.call(document.querySelectorAll('.tl-item')).map(function (item) {
      var state = ['done', 'late', 'now', 'active', 'future'].filter(function (c) { return item.classList.contains(c); })[0] || 'future';
      return {kind: 'modal', modal: item.getAttribute('data-modal'), state: state, date: text(item.querySelector('.tl-date')), title: text(item.querySelector('.tl-name')), stat: text(item.querySelector('.tl-meta'))};
    });
  }
  function kpis() {
    return Array.prototype.slice.call(document.querySelectorAll('.wrap > .kpis > .kpi')).slice(0, 4).map(function (k) {
      var value = text(k.querySelector('.knum')), sub = text(k.querySelector('.ksub'));
      if (!value || value === '—') { value = sub.split(' · ')[0]; sub = sub.slice(value.length).replace(/^\s*·\s*/, ''); }
      return {label: text(k.querySelector('.klbl')), value: value, sub: sub};
    });
  }
  // What a click does. Always the page's own controls, never a copy of the content.
  function activate(target) {
    if (!target) return false;
    if (target.kind === 'modal') {
      var el = document.querySelector('[data-modal="' + target.modal + '"]');
      if (el) { el.click(); return true; }
      return false;
    }
    if (target.kind === 'tools') {
      var tools = document.querySelector('.hq-tools-button');
      if (tools) { tools.click(); return true; }
      return false;
    }
    if (target.kind === 'kpis') { close(); return true; }
    var section = document.querySelector('.hq-section[data-topic="' + target.slug + '"]');
    var button = section && section.querySelector('.hq-expand-button');
    if (button) { button.click(); return true; }
    var heading = document.querySelector('h2[data-sec="' + target.slug + '"]');
    if (heading) { close(); heading.scrollIntoView({block: 'start'}); return true; }
    return false;
  }

  // ── the scene ──────────────────────────────────────────────────────────────
  var root = null, state = null, threeP = null;
  function loadThree() { return threeP || (threeP = import(THREE_URL)); }

  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var x = seed || 1; return function () { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }

  function windowTexture(THREE, cols, rows, lit, seed) {
    var c = document.createElement('canvas'); c.width = 64 * cols; c.height = 64 * rows;
    var g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#0a1733'; g.fillRect(0, 0, c.width, c.height);
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var on = r() < 0.58, a = on ? 0.75 + r() * 0.25 : 0.12;
      g.globalAlpha = a; g.fillStyle = on ? lit : '#5b6f99';
      g.fillRect(x * 64 + 14, y * 64 + 12, 36, 30);
    }
    g.globalAlpha = 1;
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function signTexture(THREE, title, stat, accent, small) {
    var W = small ? 512 : 768, H = small ? 150 : 240;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(8,20,44,0.92)'; roundRect(g, 4, 4, W - 8, H - 8, 22); g.fill();
    g.lineWidth = 6; g.strokeStyle = accent; roundRect(g, 4, 4, W - 8, H - 8, 22); g.stroke();
    g.fillStyle = '#ffffff'; g.font = '700 ' + (small ? 40 : 52) + 'px Geist, system-ui, sans-serif'; g.textBaseline = 'middle';
    fitText(g, title, 28, small ? 50 : 78, W - 56);
    g.fillStyle = accent; g.font = '500 ' + (small ? 28 : 34) + 'px Geist, system-ui, sans-serif';
    fitText(g, stat, 28, small ? 104 : 164, W - 56);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function fitText(g, s, x, y, max) { while (s.length > 2 && g.measureText(s).width > max) s = s.slice(0, -2).replace(/\s+$/, '') + '…'; g.fillText(s, x, y); }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function kpiTexture(THREE, tiles) {
    var W = 2048, H = 800, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#0b1d3f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#F3C744'; g.fillRect(0, 0, W, 10);
    var n = Math.max(1, tiles.length), tw = (W - 40) / n;
    tiles.forEach(function (t, i) {
      var x = 20 + i * tw;
      g.fillStyle = '#122a55'; roundRect(g, x + 10, 40, tw - 20, H - 80, 18); g.fill();
      g.textBaseline = 'middle';
      g.fillStyle = '#F3C744'; g.font = '700 34px Geist, system-ui, sans-serif'; fitText(g, t.label.toUpperCase(), x + 36, 110, tw - 72);
      g.fillStyle = '#ffffff'; g.font = '700 ' + (t.value.length > 9 ? 84 : 112) + 'px Geist, system-ui, sans-serif'; fitText(g, t.value, x + 36, 290, tw - 72);
      g.fillStyle = '#c9d6ea'; g.font = '500 36px Geist, system-ui, sans-serif';
      wrap(g, t.sub, x + 36, 470, tw - 72, 50, 4);
    });
    var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  }
  function wrap(g, s, x, y, max, lh, lines) {
    var words = (s || '').split(' '), line = '', n = 0;
    for (var i = 0; i < words.length && n < lines; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(test).width > max && line) { g.fillText(line, x, y + n * lh); line = words[i]; n++; }
      else line = test;
    }
    if (line && n < lines) g.fillText(line, x, y + n * lh);
  }
  function roadTexture(THREE) {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#121c33'; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = '#0869E4'; g.fillRect(0, 0, 1024, 6); g.fillRect(0, 122, 1024, 6);
    g.fillStyle = '#F3C744'; for (var x = 0; x < 1024; x += 128) g.fillRect(x + 20, 60, 72, 8);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(10, 1); return t;
  }

  function build(THREE) {
    var s = state;
    var scene = new THREE.Scene(); scene.background = new THREE.Color(0x061634); scene.fog = new THREE.Fog(0x061634, 48, 140);
    var camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
    var renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    root.insertBefore(renderer.domElement, root.firstChild);
    s.scene = scene; s.camera = camera; s.renderer = renderer; s.pick = []; s.pulse = [];

    scene.add(new THREE.HemisphereLight(0x2a4f8f, 0x04091a, 0.9));
    var moon = new THREE.DirectionalLight(0xcfd9ff, 1.1); moon.position.set(24, 38, 14); scene.add(moon);
    var plazaLight = new THREE.PointLight(0xF3C744, 260, 60, 1.6); plazaLight.position.set(0, 9, 2); scene.add(plazaLight);
    var backLight = new THREE.PointLight(0x4f8dff, 180, 70, 1.6); backLight.position.set(0, 10, -27); scene.add(backLight);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({color: 0x08204a, roughness: 1}));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var grid = new THREE.GridHelper(160, 80, 0x1b4b9a, 0x133a7a); grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.32; scene.add(grid);
    var plaza = new THREE.Mesh(new THREE.CircleGeometry(6.5, 48), new THREE.MeshStandardMaterial({color: 0x0869E4, emissive: 0x0869E4, emissiveIntensity: 0.35, roughness: 0.8}));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.03; scene.add(plaza);
    var path = new THREE.Mesh(new THREE.PlaneGeometry(3, 15), new THREE.MeshStandardMaterial({color: 0x0a4fb0, emissive: 0x0a4fb0, emissiveIntensity: 0.25}));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.03, 13); scene.add(path);

    // Stars
    var starGeo = new THREE.BufferGeometry(), pts = [], r = rng(7);
    for (var i = 0; i < 1400; i++) { var th = r() * Math.PI * 2, ph = r() * Math.PI * 0.45, R = 150 + r() * 40; pts.push(R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) + 2, R * Math.sin(ph) * Math.sin(th)); }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xdfe8ff, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.85, fog: false})));

    // Buildings
    catalog().forEach(function (item) {
      if (item.slug === 'the-road') { addRoad(THREE, item); return; }
      var area = AREAS[item.area], w = item.size[0], h = item.size[1], d = item.size[2];
      var seed = hash(item.slug);
      var wide = windowTexture(THREE, Math.max(2, Math.round(w * 1.3)), Math.max(1, Math.round(h * 1.6)), area.win, seed);
      var deep = windowTexture(THREE, Math.max(2, Math.round(d * 1.3)), Math.max(1, Math.round(h * 1.6)), area.win, seed + 7);
      var side = function (map) { return new THREE.MeshStandardMaterial({color: area.body, map: map, emissiveMap: map, emissive: new THREE.Color(area.win), emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.15}); };
      var roof = new THREE.MeshStandardMaterial({color: area.body, roughness: 0.9});
      var mats = [side(deep), side(deep), roof, roof, side(wide), side(wide)];
      var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      body.position.set(item.pos[0], h / 2, item.pos[1]); body.userData = item; scene.add(body); s.pick.push(body);
      var trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), new THREE.MeshStandardMaterial({color: area.accent, emissive: new THREE.Color(area.accent), emissiveIntensity: 1.4}));
      trim.position.set(item.pos[0], h + 0.08, item.pos[1]); scene.add(trim);
      var base = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.12, d + 1.2), new THREE.MeshStandardMaterial({color: 0x0d2b5e, emissive: new THREE.Color(area.accent), emissiveIntensity: 0.18}));
      base.position.set(item.pos[0], 0.06, item.pos[1]); scene.add(base);
      var sign = new THREE.Sprite(new THREE.SpriteMaterial({map: signTexture(THREE, item.title, item.stat, area.accent, false), transparent: true, depthWrite: false}));
      sign.scale.set(6.8, 2.1, 1); sign.position.set(item.pos[0], h + 1.6, item.pos[1]); sign.userData = item; scene.add(sign); s.pick.push(sign);
    });

    // The billboard: today's four numbers, with the wordmark above.
    var tiles = kpis();
    var board = new THREE.Mesh(new THREE.BoxGeometry(20, 7.8, 0.5), [
      new THREE.MeshStandardMaterial({color: 0x0b1d3f}), new THREE.MeshStandardMaterial({color: 0x0b1d3f}), new THREE.MeshStandardMaterial({color: 0x0b1d3f}), new THREE.MeshStandardMaterial({color: 0x0b1d3f}),
      new THREE.MeshStandardMaterial({map: kpiTexture(THREE, tiles), emissiveMap: kpiTexture(THREE, tiles), emissive: 0xffffff, emissiveIntensity: 0.9}), new THREE.MeshStandardMaterial({color: 0x0b1d3f})]);
    board.position.set(0, 7.2, -24); board.userData = {kind: 'kpis', title: 'Today at a glance', stat: 'Click to go back to the dashboard'}; scene.add(board); s.pick.push(board);
    [-8, 8].forEach(function (x) { var post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 12), new THREE.MeshStandardMaterial({color: 0x7f8aa6, metalness: 0.6, roughness: 0.4})); post.position.set(x, 1.7, -24); scene.add(post); });
    var mark = document.querySelector('.hq-wordmark');
    if (mark && mark.src) {
      var img = new Image(); img.onload = function () {
        if (!state || state.scene !== scene) return;
        var c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(64, Math.round(1024 * img.height / Math.max(1, img.width)));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        var logo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9 * c.height / c.width), new THREE.MeshBasicMaterial({map: t, transparent: true}));
        logo.position.set(0, 11.2 + (9 * c.height / c.width) / 2 + 0.4, -23.72); scene.add(logo);
      }; img.src = mark.src;
    }

    // Lamp posts along the road
    for (var lx = -30; lx <= 30; lx += 12) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 8), new THREE.MeshStandardMaterial({color: 0x8a94ad})); pole.position.set(lx, 1.5, 18.4); scene.add(pole);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshStandardMaterial({color: 0xF3C744, emissive: 0xF3C744, emissiveIntensity: 2.2})); bulb.position.set(lx, 3.05, 18.4); scene.add(bulb);
    }
    fit(); place(0);
  }
  function addRoad(THREE, item) {
    var s = state, scene = s.scene;
    var road = new THREE.Mesh(new THREE.PlaneGeometry(64, 4.2), new THREE.MeshStandardMaterial({map: roadTexture(THREE), roughness: 0.95}));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.04, 21); road.userData = item; scene.add(road); s.pick.push(road);
    var sign = new THREE.Sprite(new THREE.SpriteMaterial({map: signTexture(THREE, item.title, item.stat, '#F3C744', false), transparent: true, depthWrite: false}));
    sign.scale.set(6.8, 2.1, 1); sign.position.set(-28, 3.4, 21); sign.userData = item; scene.add(sign); s.pick.push(sign);
    var list = milestones(), n = Math.max(1, list.length);
    list.forEach(function (m, i) {
      var x = -24 + (48 * i) / Math.max(1, n - 1);
      var col = m.state === 'done' ? 0xF3C744 : m.state === 'late' ? 0xff6b6b : m.state === 'future' ? 0x3b4a6b : 0x3a8dff;
      var mat = new THREE.MeshStandardMaterial({color: col, emissive: col, emissiveIntensity: m.state === 'future' ? 0.15 : 0.7, roughness: 0.5, metalness: 0.2});
      var pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, m.state === 'done' ? 2.4 : 2.0, 20), mat);
      pylon.position.set(x, (m.state === 'done' ? 2.4 : 2.0) / 2, 21); pylon.userData = m; scene.add(pylon); s.pick.push(pylon);
      if (m.state === 'late' || m.state === 'now' || m.state === 'active') s.pulse.push(mat);
      var tag = new THREE.Sprite(new THREE.SpriteMaterial({map: signTexture(THREE, m.title, m.date + (m.stat ? ' · ' + m.stat : ''), m.state === 'late' ? '#ff8a8a' : '#F3C744', true), transparent: true, depthWrite: false}));
      tag.scale.set(4.4, 1.3, 1); tag.position.set(x, 3.5 + (i % 2) * 1.5, 21); tag.userData = m; scene.add(tag); s.pick.push(tag);
    });
  }

  // ── camera, input, loop ────────────────────────────────────────────────────
  function fit() {
    var s = state; if (!s || !s.renderer) return;
    var w = root.clientWidth, h = root.clientHeight;
    s.camera.aspect = w / h; s.camera.updateProjectionMatrix(); s.renderer.setSize(w, h, false);
  }
  function place(t) {
    var s = state, ease = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    var radius = s.radius + (1 - ease) * 34;
    var phi = s.phi, th = s.theta;
    s.camera.position.set(radius * Math.sin(phi) * Math.sin(th), radius * Math.cos(phi) + 1.5, radius * Math.sin(phi) * Math.cos(th));
    s.camera.lookAt(0, 1.5, 0);
  }
  function frame(now) {
    var s = state; if (!s || !s.renderer) return;
    s.raf = requestAnimationFrame(frame);
    if (!s.t0) s.t0 = now;
    var t = s.reduced ? 1 : Math.min(1, (now - s.t0) / 1500);
    // A slow drift until the first touch (one turn in about nine minutes), by the clock, not the frame rate.
    if (!s.touched && !s.reduced && s.last) s.theta += 0.012 * Math.min(0.1, (now - s.last) / 1000);
    s.last = now;
    place(t);
    var k = 0.55 + 0.45 * Math.sin(now / 350);
    s.pulse.forEach(function (m) { m.emissiveIntensity = 0.35 + k * 0.9; });
    s.renderer.render(s.scene, s.camera);
  }
  function ndc(e) {
    var r = root.getBoundingClientRect();
    return {x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1};
  }
  function pickAt(THREE, e) {
    var s = state; if (!s.ray) s.ray = new THREE.Raycaster();
    var p = ndc(e); s.ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera);
    var hit = s.ray.intersectObjects(s.pick, false)[0];
    return hit ? hit.object : null;
  }
  function hover(obj) {
    var s = state; if (s.hovered === obj) return;
    if (s.hovered) setGlow(s.hovered, false);
    s.hovered = obj;
    if (obj) setGlow(obj, true);
    s.renderer.domElement.classList.toggle('pick', !!obj);
    var label = root.querySelector('.hq-world-label');
    if (obj) { label.innerHTML = '<b></b><span></span>'; label.firstChild.textContent = obj.userData.title; label.lastChild.textContent = (obj.userData.stat || '') + (obj.userData.kind === 'kpis' ? '' : ' · tap to open'); label.classList.add('on'); }
    else label.classList.remove('on');
  }
  function setGlow(obj, on) {
    var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(function (m) {
      if (m.isSpriteMaterial) { m.opacity = on ? 1 : 0.96; return; }
      if (m.userData.base === undefined) m.userData.base = m.emissiveIntensity;
      m.emissiveIntensity = on ? m.userData.base * 1.9 + 0.25 : m.userData.base;
    });
  }
  function bindInput(THREE) {
    var s = state, el = s.renderer.domElement, pointers = {}, down = null, moved = false, pinch = 0;
    function count() { return Object.keys(pointers).length; }
    function dist() { var k = Object.keys(pointers); if (k.length < 2) return 0; var a = pointers[k[0]], b = pointers[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    el.addEventListener('pointerdown', function (e) {
      pointers[e.pointerId] = {x: e.clientX, y: e.clientY}; el.setPointerCapture(e.pointerId); s.touched = true;
      if (count() === 1) { down = {x: e.clientX, y: e.clientY}; moved = false; } else pinch = dist();
    });
    el.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId] && e.pointerType !== 'touch' && e.buttons === 0) { delete pointers[e.pointerId]; down = null; moved = false; pinch = 0; }
      if (pointers[e.pointerId]) {
        var prev = pointers[e.pointerId]; pointers[e.pointerId] = {x: e.clientX, y: e.clientY};
        if (count() === 2) { var d = dist(); if (pinch && d && e.pointerType === 'touch') zoom(pinch / d); pinch = d; return; }
        if (count() > 1) return;
        var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) moved = true;
        if (moved) { s.touched = true; s.theta -= dx * 0.005; s.phi = Math.min(1.42, Math.max(0.32, s.phi - dy * 0.004)); }
        return;
      }
      if (e.pointerType !== 'touch') hover(pickAt(THREE, e));
    });
    function up(e) {
      var wasDown = !!pointers[e.pointerId]; delete pointers[e.pointerId];
      if (count() < 2) pinch = 0;
      if (wasDown && down && !moved && count() === 0) { var obj = pickAt(THREE, e); hover(obj); if (obj) activate(obj.userData); }
      if (count() === 0) down = null;
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', function (e) { if (pointers[e.pointerId]) { delete pointers[e.pointerId]; if (count() === 0) { down = null; moved = false; pinch = 0; } } });
    el.addEventListener('pointerleave', function (e) { if (!pointers[e.pointerId]) hover(null); });
    function zoom(f) { s.radius = Math.min(110, Math.max(18, s.radius * f)); s.touched = true; }
    el.addEventListener('wheel', function (e) { e.preventDefault(); zoom(1 + Math.max(-60, Math.min(60, e.deltaY)) * 0.0022); }, {passive: false});
    s.onResize = fit; window.addEventListener('resize', fit);
    s.onKey = function (e) {
      if (e.key !== 'Escape') return;
      var mask = document.getElementById('mask');
      if (document.querySelector('.hq-expand-mask') || (mask && !mask.hidden) || document.querySelector('dialog[open]')) return;
      close();
    };
    document.addEventListener('keydown', s.onKey, true);
  }

  // ── open / close ───────────────────────────────────────────────────────────
  function shell() {
    root = document.createElement('div'); root.id = 'hq-world'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Stevo HQ as a 3D world');
    var hud = document.createElement('div'); hud.className = 'hq-world-hud';
    var mark = document.querySelector('.hq-wordmark');
    if (mark) { var m = mark.cloneNode(true); m.removeAttribute('id'); hud.appendChild(m); }
    var title = document.createElement('span'); title.className = 'hq-world-title'; title.textContent = 'HQ WORLD'; hud.appendChild(title);
    var hint = document.createElement('span'); hint.className = 'hq-world-hint'; hint.textContent = 'Drag to look around · scroll or pinch to zoom · click a building or a milestone to open it'; hud.appendChild(hint);
    var back = document.createElement('button'); back.type = 'button'; back.className = 'hq-world-back'; back.textContent = 'Dashboard'; back.addEventListener('click', close); hud.appendChild(back);
    root.appendChild(hud);
    var legend = document.createElement('div'); legend.className = 'hq-world-legend';
    Object.keys(AREAS).forEach(function (k) { var row = document.createElement('span'); var i = document.createElement('i'); i.style.background = AREAS[k].accent; row.appendChild(i); row.appendChild(document.createTextNode(AREAS[k].label)); legend.appendChild(row); });
    var road = document.createElement('span'); var ri = document.createElement('i'); ri.style.background = '#ff6b6b'; road.appendChild(ri); road.appendChild(document.createTextNode('The road: milestones, red is late')); legend.appendChild(road);
    root.appendChild(legend);
    var label = document.createElement('div'); label.className = 'hq-world-label'; root.appendChild(label);
    var status = document.createElement('div'); status.className = 'hq-world-status'; status.innerHTML = 'Building the campus<b>…</b>'; root.appendChild(status);
    document.body.appendChild(root);
    return status;
  }
  function open() {
    if (state) return;
    state = {theta: 0.42, phi: 0.98, radius: 40, touched: false, reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches};
    var status = shell();
    document.body.classList.add('hq-world-open');
    if (history.replaceState) history.replaceState(null, '', '#world');
    loadThree().then(function (THREE) {
      if (!state) return;
      try { build(THREE); } catch (err) { status.innerHTML = ''; status.appendChild(document.createTextNode('This browser could not draw the world (WebGL). The dashboard is one click away.')); return; }
      status.remove(); bindInput(THREE); state.raf = requestAnimationFrame(frame);
    }).catch(function () {
      status.innerHTML = ''; status.appendChild(document.createTextNode('Three.js did not load (offline?). The dashboard is one click away.'));
    });
  }
  function close() {
    var s = state; if (!s) return; state = null;
    if (s.raf) cancelAnimationFrame(s.raf);
    if (s.onResize) window.removeEventListener('resize', s.onResize);
    if (s.onKey) document.removeEventListener('keydown', s.onKey, true);
    if (s.scene) s.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach(function (m) { if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); });
    });
    if (s.renderer) s.renderer.dispose();
    if (root) root.remove(); root = null;
    document.body.classList.remove('hq-world-open');
    if (location.hash === '#world' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    var button = document.querySelector('.hq-world-button'); if (button) button.focus();
  }

  // The header button, next to Tools & links.
  var header = document.querySelector('.wrap > header');
  if (header && !header.querySelector('.hq-world-button')) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'hq-world-button'; button.textContent = 'World';
    button.title = 'See HQ as a 3D campus. Every building opens its section.';
    button.addEventListener('click', open); header.appendChild(button);
  }
  window.StevoWorld = {catalog: catalog, milestones: milestones, kpis: kpis, activate: activate, open: open, close: close,
    camera: function () { return state ? {theta: state.theta, phi: state.phi, radius: state.radius} : null; }};
  if (location.hash === '#world') open();
})();
