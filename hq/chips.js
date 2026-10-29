/* The chip rack (Steve, 2026-10-25): the KPI row becomes a rack of poker chips, one per section, in the
   brand coin's look. The face carries the section's one number; the stack height is how many things in
   that section are waiting on Steve; the color is urgency (Steve, 2026-10-25): blue nothing waiting,
   gold something waiting on him, red overdue, late, behind pace or over a limit. Hover (or
   focus) floats the summary, a click flips the chip and presses the section's own Expand button, so the
   panel that opens is the live one. The Stevo coin in the middle carries App Review; clicking it shows
   the real KPI row. Every number here is read from the page, never rendered a second time.
   Three.js (UMD 0.158) is fetched from cdnjs; until it renders, the KPI row stays. */
(function () {
  if (window.StevoChips) return;
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.158.0/three.min.js';
  var URGENCY = ['#2b63d9', '#F3C744', '#ff6b6b']; // nothing waiting · waiting on Steve · overdue, late, behind or over
  // Rack order, left to right, with the coin in the middle (after the sixth).
  var ORDER = ['do-this-next', 'on-pace', 'the-road', 'team', 'app-health', 'testers-on-stevo', 'who-uses-what', 'odds-api-credits', 'money', 'vendors-orders', 'marketing-social', 'web-traffic-links', 'tools'];
  var AREAS = {'do-this-next': 'launch', 'on-pace': 'launch', 'the-road': 'launch', 'team': 'launch', 'app-health': 'product', 'testers-on-stevo': 'product', 'who-uses-what': 'product', 'odds-api-credits': 'product', 'money': 'finance', 'vendors-orders': 'finance', 'marketing-social': 'growth', 'web-traffic-links': 'growth', 'tools': 'launch'};
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function num(s) { var m = String(s || '').match(/-?\d[\d,]*/); return m ? parseInt(m[0].replace(/,/g, ''), 10) : null; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function sectionOf(slug) { var h = document.querySelector('h2[data-sec="' + slug + '"]'); return h ? h.closest('section') : null; }
  function kpiTiles() { return Array.prototype.slice.call(document.querySelectorAll('.wrap > .kpis > .kpi')); }
  function kpiByLabel(re) { return kpiTiles().filter(function (k) { return re.test(text(k.querySelector('.klbl'))); })[0] || null; }

  // One chip's face, stack and reason, read from the section as it is right now.
  function read(slug) {
    var section = sectionOf(slug);
    if (!section && slug !== 'tools') return null;
    var q = function (sel) { return section ? section.querySelector(sel) : null; };
    var all = function (sel) { return section ? Array.prototype.slice.call(section.querySelectorAll(sel)) : []; };
    var r = {slug: slug, area: AREAS[slug] || 'launch', title: slug === 'tools' ? 'Tools & links' : text(q('h2')).replace(/Expand$|Close$/, '').trim(), blurb: text(q('h2 em')), value: '·', label: '', waiting: 0, why: '', sub: ''};
    if (section) { var h = section.querySelector('h2'); r.title = h && h.firstChild ? h.firstChild.textContent.trim() : r.title; }
    var m, ml, k, late, items;
    switch (slug) {
      case 'do-this-next':
        items = all('.lane'); late = all('.lane.late');
        r.value = String(late.length || items.length); r.label = late.length ? 'overdue' : 'next moves';
        r.waiting = late.length; r.why = late.length ? plural(late.length, 'overdue next move') : '';
        break;
      case 'on-pace':
        m = text(q('.pace-stat')).match(/(\d+)\s*\/\s*(\d+)/); r.value = m ? m[1] + '/' + m[2] : clip(text(q('.pace-stat')), 9); r.label = 'tasks';
        k = kpiByLabel(/launch plan/i); m = k ? text(k.querySelector('.ksub')).match(/behind by (\d+)/i) : null;
        r.waiting = m ? +m[1] : 0; r.why = m ? 'behind the pace by ' + plural(+m[1], 'task') : (k ? text(k.querySelector('.ksub')) : '');
        break;
      case 'the-road':
        items = all('.tl-item'); late = all('.tl-item.late');
        r.value = all('.tl-item.done').length + '/' + items.length; r.label = 'milestones';
        r.waiting = late.length; r.why = late.length ? text(late[0].querySelector('.tl-name')).replace(/\s*LATE$/i, '') + ' is late' : '';
        k = kpiByLabel(/next milestone/i); r.sub = k ? clip(text(k.querySelector('.ksub')) || text(k.querySelector('.knum')), 28) : '';
        break;
      case 'team':
        k = q('.hbar'); if (k) { r.value = clip(text(k.querySelector('.hval')).split(' ').slice(0, 2).join(' '), 9); r.label = text(k.querySelector('.hname')) + ' this week'; }
        break;
      case 'app-health':
        items = all('.kpi'); var reports = items[0] ? num(text(items[0].querySelector('.knum'))) || 0 : 0; var crashes = items[2] ? num(text(items[2].querySelector('.knum'))) || 0 : 0;
        r.value = String(reports); r.label = reports === 1 ? 'open report' : 'open reports'; r.waiting = reports + crashes;
        r.why = [reports ? plural(reports, 'user report') : '', crashes ? plural(crashes, 'crash report') : ''].filter(Boolean).join(' · ');
        break;
      case 'testers-on-stevo':
        ml = text(q('.mlead')); r.value = num(ml) !== null ? String(num(ml)) : '·'; m = ml.match(/(\d+) opened today/); r.label = 'testers' + (m ? ' · ' + m[1] + ' today' : '');
        var wl = text(q('.warnlead')); var names = wl ? wl.replace(/^[^:]*:\s*/, '').split(/,\s*/).filter(Boolean) : [];
        r.waiting = names.length; r.why = names.length ? names.length + ' idle or on an old build' : '';
        break;
      case 'who-uses-what':
        items = all('.odds-tile'); k = items[2] || items[0];
        if (k) { r.value = clip(text(k.querySelector('.knum')), 9); r.label = 'active this week'; }
        break;
      case 'marketing-social':
        var total = 0, any = false; all('.soc-num').forEach(function (e) { var n = num(text(e)); if (n !== null) { total += n; any = true; } });
        r.value = any ? String(total) : '·'; r.label = 'followers';
        break;
      case 'web-traffic-links':
        var s = text(q('#traffic-summary')); var n = /loading|unavailable|not answering/i.test(s) ? null : num(s);
        r.value = n !== null ? String(n) : 'live'; r.label = n !== null ? clip(s.replace(/^[^a-z]*/i, ''), 22) : 'tap for numbers';
        break;
      case 'tools':
        var links = document.querySelectorAll('.hq-tools-dialog a[href]').length; r.value = links ? String(links) : '·'; r.label = 'links'; r.blurb = 'every service, one tap away';
        break;
      case 'vendors-orders':
        ml = text(q('.mlead')); var open = num(ml); m = ml.match(/(\d+) waiting on you/); late = ml.match(/(\d+) due/);
        r.value = open !== null ? String(open) : '•••'; r.label = open !== null ? (open === 1 ? 'open order' : 'open orders') : 'gated page';
        r.waiting = m ? +m[1] : 0; r.why = [m && +m[1] ? m[1] + ' waiting on you' : '', late ? late[1] + ' due' : ''].filter(Boolean).join(' · ');
        break;
      case 'money':
      case 'odds-api-credits':
        k = q('.odds-tile'); if (k) { r.value = clip(text(k.querySelector('.knum')), 9); r.label = clip(text(k.querySelector('.klbl')), 22); }
        else if (slug === 'money') { r.value = '•••'; r.label = 'gated page'; }
        var warns = all('.tflag.warn'); r.waiting = warns.length; r.why = warns.length ? warns.slice(0, 2).map(text).join(' · ') : '';
        break;
    }
    if (r.value === '·') { k = q('.kpi, .odds-tile'); if (k) { r.value = clip(text(k.querySelector('.knum')), 9); r.label = clip(text(k.querySelector('.klbl')), 22); } }
    r.waiting = Math.max(0, r.waiting | 0);
    r.urgency = !r.waiting ? 0 : /overdue|late|behind|report|over the|declined|frozen|does not add up| due/i.test(r.why) ? 2 : 1;
    if (!r.sub) r.sub = r.why || r.label;
    return r;
  }
  function catalog() { return ORDER.map(read).filter(Boolean); }
  function coinInfo() {
    var k = kpiByLabel(/app review/i);
    return {slug: 'kpis', title: 'Today at a glance', value: k ? text(k.querySelector('.knum')) : 'HQ', sub: k ? clip(text(k.querySelector('.ksub')).split(' · ').slice(0, 2).join(' · '), 30) : '', tiles: kpiTiles().map(function (t) { return {label: text(t.querySelector('.klbl')), value: text(t.querySelector('.knum')), sub: text(t.querySelector('.ksub'))}; })};
  }

  // What a click does: the page's own controls. The coin shows the real KPI row in a sheet.
  var kpiMask = null;
  function showKpis() {
    var kpis = document.querySelector('.wrap > .kpis'); if (!kpis || kpiMask) return false;
    var mask = document.createElement('div'); mask.className = 'hq-kpi-mask';
    var sheet = document.createElement('div'); sheet.className = 'hq-kpi-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Today at a glance');
    var head = document.createElement('div'); head.className = 'kh'; var b = document.createElement('b'); b.textContent = 'Today at a glance'; head.appendChild(b);
    var close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close'; head.appendChild(close); sheet.appendChild(head);
    var placeholder = document.createComment('kpis'); kpis.parentNode.insertBefore(placeholder, kpis);
    kpis.hidden = false; sheet.appendChild(kpis); mask.appendChild(sheet); document.body.appendChild(mask);
    kpiMask = {mask: mask, kpis: kpis, placeholder: placeholder};
    function done() { if (!kpiMask) return; kpiMask.placeholder.parentNode.replaceChild(kpiMask.kpis, kpiMask.placeholder); kpiMask.kpis.hidden = rackShown; kpiMask.mask.remove(); document.removeEventListener('keydown', onKey, true); kpiMask = null; var coin = document.querySelector('.hq-slot.coin'); if (coin) coin.focus(); }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); done(); } }
    close.addEventListener('click', done); mask.addEventListener('click', function (e) { if (e.target === mask) done(); });
    document.addEventListener('keydown', onKey, true); close.focus();
    return true;
  }
  function activate(slug) {
    if (slug === 'kpis') return showKpis();
    if (slug === 'tools') { var t = document.querySelector('.hq-tools-button'); if (t) { t.click(); return true; } return false; }
    var section = document.querySelector('.hq-section[data-topic="' + slug + '"]');
    var button = section && section.querySelector('.hq-expand-button');
    if (button) { button.click(); return true; }
    var heading = document.querySelector('h2[data-sec="' + slug + '"]');
    if (heading) { heading.scrollIntoView({block: 'start'}); return true; }
    return false;
  }

  // ── the rack: slots, captions, hover card ─────────────────────────────────
  var rack = null, card = null, rackShown = false, objects = [], renderer, scene, camera, raf = 0, running = false, t0 = 0;
  function makeSlot(info, isCoin) {
    var s = document.createElement('button'); s.type = 'button'; s.className = 'hq-slot' + (isCoin ? ' coin' : '') + (info.urgency === 2 ? ' late' : info.urgency === 1 ? ' due' : '');
    s.dataset.slug = info.slug; s.setAttribute('aria-label', info.title + ': ' + (isCoin ? info.value : info.value + ' ' + info.label) + (info.why ? ', ' + info.why : '') + '. Opens the panel.');
    var cap = document.createElement('span'); cap.className = 'cap';
    var b = document.createElement('b'); b.textContent = isCoin ? 'App Review' : info.title; cap.appendChild(b);
    var small = document.createElement('small'); small.textContent = isCoin ? info.value + (info.sub ? ' · ' + info.sub : '') : info.sub; cap.appendChild(small);
    s.appendChild(cap);
    s.addEventListener('mouseenter', function () { hover(s, true); }); s.addEventListener('mouseleave', function () { hover(s, false); });
    s.addEventListener('focus', function () { hover(s, true); }); s.addEventListener('blur', function () { hover(s, false); });
    s.addEventListener('click', function () { hideCard(); var o = objectFor(s); if (o && o.chips && !reduced) { o.flip = 0; o.flipping = true; setTimeout(function () { activate(info.slug); }, 600); } else activate(info.slug); });
    return s;
  }
  function objectFor(slot) { for (var i = 0; i < objects.length; i++) if (objects[i].slot === slot) return objects[i]; return null; }
  function hover(slot, on) {
    var o = objectFor(slot); if (o) o.hover = on;
    if (!on) { hideCard(); return; }
    var info = slot.dataset.slug === 'kpis' ? coinInfo() : read(slot.dataset.slug); if (!info) return;
    card.innerHTML = ''; var b = document.createElement('b'); b.textContent = info.title; card.appendChild(b);
    if (info.tiles) info.tiles.forEach(function (t) { var d = document.createElement('div'); d.textContent = t.label + ': ' + t.value + (t.sub ? ' · ' + t.sub : ''); card.appendChild(d); });
    else {
      card.appendChild(document.createTextNode(info.value + ' ' + info.label));
      if (info.why) { var w = document.createElement('div'); w.className = 'w'; w.textContent = info.why; card.appendChild(w); }
      if (info.blurb) { var m = document.createElement('div'); m.className = 'm'; m.textContent = info.blurb; card.appendChild(m); }
    }
    var hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Click to open'; card.appendChild(hint);
    card.classList.add('on');
    var r = slot.getBoundingClientRect(), w = Math.min(280, window.innerWidth - 24);
    var x = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)), y = r.bottom + 34;
    if (y + 130 > window.innerHeight) y = Math.max(8, r.top - 140);
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }
  function hideCard() { if (card) card.classList.remove('on'); }

  // ── the 3D: one transparent canvas, chips pinned to their slots ──────────
  function tex(c, quarter) { var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (quarter) { t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; } return t; }
  function fitText(g, s, max) { while (s.length > 2 && g.measureText(s).width > max) s = s.slice(0, -2) + '…'; return s; }
  function faceTexture(color, value, label) {
    var S = 512, c = document.createElement('canvas'); c.width = S; c.height = S; var g = c.getContext('2d'), cx = S / 2;
    g.fillStyle = color; g.beginPath(); g.arc(cx, cx, 250, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f6fb';
    for (var i = 0; i < 6; i++) { g.save(); g.translate(cx, cx); g.rotate(i * Math.PI / 3); g.beginPath(); g.arc(0, 0, 250, -0.26, 0.26); g.arc(0, 0, 200, 0.26, -0.26, true); g.closePath(); g.fill(); g.restore(); }
    g.strokeStyle = '#0d1c3a'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cx, 250, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#0f1f44'; g.beginPath(); g.arc(cx, cx, 198, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e4b53a'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cx, 186, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffffff'; g.font = '800 ' + (value.length > 6 ? 68 : value.length > 4 ? 88 : 118) + 'px Geist, system-ui, sans-serif';
    g.fillText(fitText(g, value, 300), cx, cx - 14);
    g.fillStyle = color; g.font = '700 32px Geist, system-ui, sans-serif'; g.fillText(fitText(g, label.toUpperCase(), 290), cx, cx + 74);
    return tex(c, true);
  }
  function edgeTexture(color) {
    var c = document.createElement('canvas'); c.width = 1536; c.height = 128; var g = c.getContext('2d');
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f4f6fb'; for (var i = 0; i < 6; i++) g.fillRect(i * 256 + 40, 14, 176, 100);
    g.fillStyle = '#0d1c3a99'; g.fillRect(0, 0, c.width, 6); g.fillRect(0, 122, c.width, 6);
    var t = tex(c, false); t.wrapS = THREE.RepeatWrapping; return t;
  }
  function disposeObject(o) { scene.remove(o.group); o.group.traverse(function (m) { if (m.geometry) m.geometry.dispose(); var mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []; mats.forEach(function (mt) { if (mt.map) mt.map.dispose(); mt.dispose(); }); }); }
  function chipStack(info) {
    var color = URGENCY[info.urgency || 0], n = 1 + Math.min(6, info.waiting), g = new THREE.Group(), h = 0.17, chips = [];
    var edge = new THREE.MeshStandardMaterial({map: edgeTexture(color), roughness: 0.55, metalness: 0.05});
    var face = new THREE.MeshStandardMaterial({map: faceTexture(color, info.value, info.label), roughness: 0.5, metalness: 0.08});
    var blank = new THREE.MeshStandardMaterial({color: 0x0f1f44, roughness: 0.6});
    for (var i = 0; i < n; i++) {
      var m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h, 64), [edge, i === n - 1 ? face : blank, blank]);
      m.position.y = i * h * 1.02; m.rotation.y = i === n - 1 ? 0 : (i * 0.37) % (Math.PI * 2); g.add(m); chips.push(m);
    }
    var tilt = new THREE.Group(); tilt.add(g); tilt.rotation.x = 1.05;
    return {group: tilt, inner: g, chips: chips, key: info.value + '|' + info.label + '|' + info.waiting + '|' + info.urgency};
  }
  function makeCoin() {
    var g = new THREE.Group(), face;
    if (window.STEVO_COIN) { var img = new THREE.TextureLoader().load(window.STEVO_COIN); img.colorSpace = THREE.SRGBColorSpace; img.center.set(0.5, 0.5); img.rotation = Math.PI / 2; face = new THREE.MeshStandardMaterial({map: img, transparent: true, roughness: 0.4, metalness: 0.2}); }
    else face = new THREE.MeshStandardMaterial({map: faceTexture('#F3C744', 'S', 'STEVO'), roughness: 0.5});
    var edge = new THREE.MeshStandardMaterial({map: edgeTexture('#1f4fb8'), roughness: 0.5});
    var m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.18, 72), [edge, face, face]); g.add(m);
    var tilt = new THREE.Group(); tilt.add(g); tilt.rotation.x = 1.05;
    return {group: tilt, inner: g, chips: [m], coin: true, key: 'coin'};
  }
  function ensureGL() {
    if (renderer) return true;
    if (!window.THREE) return false;
    try {
      var canvas = document.createElement('canvas'); canvas.id = 'hq-chips-gl'; canvas.setAttribute('aria-hidden', 'true'); document.body.appendChild(canvas);
      renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true, alpha: true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(34, 1, 1, 20000);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3f7a, 1.2));
      var key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-300, 500, 800); scene.add(key);
      var rim = new THREE.DirectionalLight(0xF3C744, 0.8); rim.position.set(400, 200, 300); scene.add(rim);
      window.addEventListener('resize', fitCamera); fitCamera();
      return true;
    } catch (e) { if (renderer) { renderer.dispose(); renderer = null; } var c = document.getElementById('hq-chips-gl'); if (c) c.remove(); return false; }
  }
  function fitCamera() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.position.set(0, 0, (h / 2) / Math.tan(camera.fov * Math.PI / 360)); camera.lookAt(0, 0, 0);
  }
  function frame(now) {
    raf = running ? requestAnimationFrame(frame) : 0;
    if (!renderer) return;
    var dt = t0 ? Math.min(0.05, (now - t0) / 1000) : 0; t0 = now;
    var rr = rack.getBoundingClientRect();
    objects.forEach(function (o) {
      var r = o.slot.getBoundingClientRect();
      var vis = r.width > 0 && r.bottom > -40 && r.top < window.innerHeight + 40 && r.right > rr.left - 4 && r.left < rr.right + 4;
      o.group.visible = vis; if (!vis) return;
      var size = Math.min(r.width, r.height), rad = size * (o.coin ? 0.47 : 0.45);
      o.group.position.set(r.left + r.width / 2 - window.innerWidth / 2, window.innerHeight / 2 - (r.top + r.height / 2) - (o.coin ? 0 : size * 0.08), 0);
      o.group.scale.setScalar(rad);
      o.lift = o.lift === undefined ? 0 : o.lift + ((o.hover ? 1 : 0) - o.lift) * Math.min(1, dt * 10);
      o.group.rotation.x = 1.05 - o.lift * 0.35;
      var top = o.chips[o.chips.length - 1];
      top.position.y = (o.chips.length - 1) * 0.17 * 1.02 + o.lift * 0.35;
      if (o.coin && !reduced) o.inner.rotation.y += dt * 0.6;
      if (o.flipping) { o.flip += dt * 1.7; top.rotation.x = Math.sin(Math.min(1, o.flip) * Math.PI) * Math.PI; if (o.flip >= 1) { o.flipping = false; top.rotation.x = 0; } }
    });
    renderer.render(scene, camera);
  }
  function setRunning(on) { if (on === running) return; running = on; if (on && !raf) { t0 = 0; raf = requestAnimationFrame(frame); } }

  // Numbers change while the page is open (traffic loads, the tester refresh, a sheet closing): re-read
  // every chip now and then, and rebuild only the ones whose face or stack changed.
  function refresh() {
    if (!renderer) return;
    objects.forEach(function (o, i) {
      if (o.coin) return;
      var info = read(o.slot.dataset.slug); if (!info) return;
      var key = info.value + '|' + info.label + '|' + info.waiting + '|' + info.urgency;
      if (key === o.key) return;
      disposeObject(o); var n = chipStack(info); n.slot = o.slot; n.hover = o.hover; scene.add(n.group); objects[i] = n;
      o.slot.classList.toggle('late', info.urgency === 2); o.slot.classList.toggle('due', info.urgency === 1); o.slot.querySelector('.cap small').textContent = info.sub;
    });
  }

  function mount() {
    var kpis = document.querySelector('.wrap > .kpis'); if (!kpis || rackShown) return false;
    if (!ensureGL()) return false;
    var items = catalog(); if (!items.length) return false;
    rack = document.createElement('div'); rack.className = 'hq-rack'; rack.setAttribute('aria-label', 'The chip rack: one chip per section; the stack is what is waiting on you, red is overdue');
    card = document.createElement('div'); card.className = 'hq-chip-card'; card.setAttribute('role', 'status'); document.body.appendChild(card);
    items.forEach(function (info, i) {
      if (i === 6) { var ci = coinInfo(); var cs = makeSlot(ci, true); rack.appendChild(cs); var coin = makeCoin(); coin.slot = cs; scene.add(coin.group); objects.push(coin); }
      var s = makeSlot(info, false); rack.appendChild(s); var o = chipStack(info); o.slot = s; scene.add(o.group); objects.push(o);
    });
    kpis.parentNode.insertBefore(rack, kpis); kpis.hidden = true; rackShown = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) { setRunning(entries[0].isIntersecting && !document.hidden); }, {rootMargin: '80px'}).observe(rack);
    else setRunning(true);
    document.addEventListener('visibilitychange', function () { setRunning(!document.hidden); });
    setRunning(true);
    setInterval(refresh, 15000);
    return true;
  }
  function loadThree(cb) {
    if (window.THREE) { cb(true); return; }
    var s = document.createElement('script'); s.src = THREE_URL; s.async = true;
    s.onload = function () { cb(!!window.THREE); }; s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }
  function start() { loadThree(function (ok) { if (ok) mount(); }); }

  window.StevoChips = {catalog: catalog, read: read, coinInfo: coinInfo, activate: activate, mount: mount, refresh: refresh, shown: function () { return rackShown; }};
  if (document.querySelector('.wrap > .kpis')) start();
})();
