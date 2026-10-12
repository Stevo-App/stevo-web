/* Compact HQ: move existing nodes, preserving every report, chart and handler. */
(function () {
  var dash = document.querySelector('.dash');
  if (!dash || dash.dataset.compact) return;
  dash.dataset.compact = 'true';
  var groups = [
    {label: 'Act & launch', area: 'launch', sections: ['do-this-next', 'on-pace', 'the-road', 'team']},
    {label: 'Product & operations', area: 'product', sections: ['app-health', 'testers-on-stevo', 'odds-api-credits']},
    {label: 'Money & growth', area: 'finance', sections: ['money', 'vendors-orders', 'marketing-social', 'web-traffic-links']}
  ];
  var sections = {};
  dash.querySelectorAll('h2[data-sec]').forEach(function (heading) {
    var section = heading.closest('section');
    if (section) sections[heading.dataset.sec] = section;
  });
  groups.forEach(function (group) {
    var column = document.createElement('div');
    column.className = 'hq-column';
    column.setAttribute('aria-label', group.label);
    var label = document.createElement('div');
    label.className = 'hq-column-label'; label.textContent = group.label;
    column.appendChild(label);
    group.sections.forEach(function (slug) {
      var section = sections[slug];
      if (!section) return;
      section.classList.add('hq-section');
      section.dataset.area = /marketing|web-traffic/.test(slug) ? 'growth' : group.area;
      section.dataset.topic = slug;
      var heading = section.querySelector('h2');
      var content = document.createElement('div');
      content.className = 'hq-section-body';
      content.tabIndex = 0; content.setAttribute('role', 'region');
      content.setAttribute('aria-label', heading.firstChild.textContent.trim() + ' — scroll for details');
      Array.from(section.childNodes).forEach(function (node) {
        if (node !== heading) content.appendChild(node);
      });
      section.appendChild(content);
      column.appendChild(section);
    });
    dash.appendChild(column);
  });
  // Move the live section into an overlay; never clone charts or refresh controls.
  var expanded = null;
  function collapseSection() {
    if (!expanded) return;
    var current = expanded; expanded = null;
    current.placeholder.replaceWith(current.section);
    current.section.classList.remove('hq-expanded');
    current.section.removeAttribute('role');
    current.section.removeAttribute('aria-modal');
    current.section.removeAttribute('aria-labelledby');
    current.button.textContent = 'Expand';
    current.button.setAttribute('aria-label', 'Expand ' + current.section.querySelector('h2').firstChild.textContent.trim());
    current.button.setAttribute('aria-expanded', 'false');
    current.folds.forEach(function (fold) { fold.open = false; });
    current.mask.remove();
    document.body.classList.remove('hq-expansion-open');
    current.button.focus();
  }
  function expandSection(section, button) {
    if (expanded) { collapseSection(); return; }
    var placeholder = section.cloneNode(false);
    placeholder.removeAttribute('id'); placeholder.setAttribute('aria-hidden', 'true');
    placeholder.classList.add('hq-section-placeholder');
    section.before(placeholder);
    var mask = document.createElement('div'); mask.className = 'hq-expand-mask';
    var folds = Array.from(section.querySelectorAll('details:not([open])'));
    expanded = {section:section, button:button, placeholder:placeholder, mask:mask, folds:folds};
    section.classList.add('hq-expanded');
    section.setAttribute('role', 'dialog'); section.setAttribute('aria-modal', 'true');
    section.setAttribute('aria-labelledby', section.querySelector('h2').id);
    button.textContent = 'Close'; button.setAttribute('aria-label', 'Close expanded section'); button.setAttribute('aria-expanded', 'true');
    folds.forEach(function (fold) { fold.open = true; });
    mask.appendChild(section); document.body.appendChild(mask);
    document.body.classList.add('hq-expansion-open');
    mask.addEventListener('click', function (e) { if (e.target === mask) collapseSection(); });
    button.focus();
  }
  dash.querySelectorAll('.hq-section').forEach(function (section) {
    var heading = section.querySelector('h2'), button = document.createElement('button');
    button.type = 'button'; button.className = 'hq-expand-button'; button.textContent = 'Expand';
    button.setAttribute('aria-label', 'Expand ' + heading.firstChild.textContent.trim());
    button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-haspopup', 'dialog');
    heading.appendChild(button); heading.classList.add('hq-expand-heading');
    heading.addEventListener('click', function () { expandSection(section, button); });
    // Empty space in a card also opens it; existing links and drill-downs win.
    section.addEventListener('click', function (e) {
      if (expanded || e.target.closest('h2,a,button,input,select,textarea,summary,[data-modal],svg,table')) return;
      expandSection(section, button);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (!expanded) return;
    var detail = document.getElementById('mask');
    if (detail && !detail.hidden) return; // Keep the existing detail dialog above this one.
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); collapseSection(); }
    if (e.key === 'Tab') {
      var nodes = Array.from(expanded.section.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"],summary'))
        .filter(function (node) { return !node.disabled && node.getClientRects().length; });
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  // Tools remain the original live links; a native dialog keeps them one click away.
  var tools = sections['everything-one-tap-away'];
  if (tools) {
    var dialog = document.createElement('dialog');
    dialog.className = 'hq-tools-dialog'; dialog.setAttribute('aria-label', 'Services & links');
    var close = document.createElement('button');
    close.type = 'button'; close.className = 'hq-tools-close'; close.textContent = 'Close';
    close.addEventListener('click', function () { dialog.close(); });
    dialog.appendChild(close); dialog.appendChild(tools);
    document.body.appendChild(dialog);
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'hq-tools-button'; button.textContent = 'Tools & links';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', function () { dialog.showModal(); });
    document.querySelector('.wrap > header').appendChild(button);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    // The old navigation anchor remains functional on narrow screens too.
    var anchor = document.querySelector('.jump a[href="#sec-everything-one-tap-away"]');
    if (anchor) anchor.addEventListener('click', function () { dialog.showModal(); });
  }
  // Remove only empty layout wrappers, never content we did not recognise.
  Array.from(dash.children).forEach(function (node) {
    if (!node.classList.contains('hq-column') && !node.querySelector('h2')) node.remove();
  });
  // Summarise platform cards as rows; retain the original cards, sparklines and
  // reading timestamps under a disclosure, and keep all existing detail ids.
  var socialCards = dash.querySelector('.soc-cards');
  if (socialCards) {
    var summary = document.createElement('table');
    summary.className = 'hq-social-summary';
    var head = document.createElement('thead'), headRow = document.createElement('tr');
    ['Platform', 'Followers', 'Change', 'Posts / views / likes'].forEach(function (label) {
      var th = document.createElement('th'); th.textContent = label; headRow.appendChild(th);
    });
    head.appendChild(headRow); summary.appendChild(head);
    var body = document.createElement('tbody');
    socialCards.querySelectorAll('.soc-card').forEach(function (card) {
      var row = document.createElement('tr');
      row.dataset.modal = card.dataset.modal; row.tabIndex = 0;
      row.className = 'opens'; row.setAttribute('role', 'button');
      var stats = Array.from(card.querySelectorAll('.soc-stats b')).slice(0,3).map(function (n) { return n.textContent; }).join(' / ');
      ['.soc-name', '.soc-num', '.soc-delta', null].forEach(function (selector) {
        var td = document.createElement('td'), node = selector && card.querySelector(selector);
        td.textContent = selector ? (node ? node.textContent : '—') : stats;
        row.appendChild(td);
      });
      body.appendChild(row);
    });
    summary.appendChild(body);
    var fold = document.createElement('details'), label = document.createElement('summary');
    label.textContent = 'Platform cards, trends & reading dates'; fold.appendChild(label);
    socialCards.parentNode.insertBefore(summary, socialCards);
    socialCards.parentNode.insertBefore(fold, socialCards); fold.appendChild(socialCards);
  }
  function foldNodes(nodes, label) {
    if (!nodes.length) return;
    var fold = document.createElement('details'); fold.className = 'hq-report-details';
    var summary = document.createElement('summary'); summary.textContent = label;
    nodes[0].before(fold); fold.appendChild(summary);
    nodes.forEach(function (node) { fold.appendChild(node); });
  }
  function foldTesterHistory() {
    var testerPanel = sections['testers-on-stevo'].querySelector('.panel');
    var firstLog = testerPanel && testerPanel.querySelector('h3');
    if (firstLog && !firstLog.closest('details')) {
      var history = [], next = firstLog;
      while (next) { history.push(next); next = next.nextElementSibling; }
      foldNodes(history, 'Build changes & tester activity');
    }
  }
  foldTesterHistory();
  var healthPanel = sections['app-health'].querySelector('.health');
  if (healthPanel) foldNodes(Array.from(healthPanel.children).slice(1), 'User reports & crash details');
  var oddsPanel = sections['odds-api-credits'].querySelector('.odds-compact');
  if (oddsPanel) foldNodes(Array.from(oddsPanel.children).filter(function (node) { return node.matches('.odds-two,.cnote'); }), 'Usage charts & reading details');
  var ordersPanel = sections['vendors-orders'].querySelector('.panel');
  var waiting = ordersPanel && ordersPanel.querySelector('.todo');
  if (waiting) {
    var waitingBlock = document.createElement('div'); waitingBlock.className = 'hq-orders-waiting';
    var title = waiting.previousElementSibling; title.before(waitingBlock);
    waitingBlock.appendChild(title); waitingBlock.appendChild(waiting);
    ordersPanel.classList.add('hq-orders-panel');
  }
  // A bounded region around tables keeps all rows accessible, including live refreshes.
  function boundTables(root) {
    root.querySelectorAll('.hq-section-body table').forEach(function (table) {
      if (table.closest('.hq-table-scroll')) return;
      var wrap = document.createElement('div');
      wrap.className = 'hq-table-scroll'; wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      var heading = table.closest('.hq-section').querySelector('h2');
      wrap.setAttribute('aria-label', heading.firstChild.textContent.trim() + ' table');
      table.parentNode.insertBefore(wrap, table); wrap.appendChild(table);
    });
  }
  boundTables(document);
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; foldTesterHistory(); boundTables(document); });
  }).observe(document.body, {childList: true, subtree: true});
  document.documentElement.classList.add('hq-compact');
  function sizeOverview() {
    var foot = document.querySelector('.wrap > .foot');
    var reserved = (foot ? foot.getBoundingClientRect().height : 0) + 26;
    dash.style.setProperty('--hq-available', Math.max(400, window.innerHeight - dash.getBoundingClientRect().top - reserved) + 'px');
  }
  // Separate URLs keep each monitor's view independent, with no saved global mode.
  var viewNav = document.createElement('nav'); viewNav.className = 'hq-view-nav';
  viewNav.setAttribute('aria-label', 'HQ views');
  [['all','Overview'],['run','Run Stevo'],['operations','Operations'],['money','Money'],['orders','Orders'],['marketing','Marketing'],['traffic','Web Traffic']].forEach(function (item) {
    var link = document.createElement('a'); link.href = '#view-' + item[0];
    link.dataset.view = item[0]; link.textContent = item[1]; viewNav.appendChild(link);
  });
  document.querySelector('.wrap > header').after(viewNav);
  var attention = document.createElement('div'); attention.className = 'hq-attention';
  attention.setAttribute('aria-label', 'Morning attention'); viewNav.after(attention);
  var stash = document.createElement('div'); stash.hidden = true; document.body.appendChild(stash);
  var layouts = {
    all: groups,
    run: [{label:'Launch & next actions', sections:['the-road','do-this-next','on-pace']}],
    operations: [{label:'Product & operations', sections:['testers-on-stevo','app-health','odds-api-credits','team']}],
    money: [{label:'Company finances', sections:['money']}],
    orders: [{label:'Vendors & deliveries', sections:['vendors-orders']}],
    marketing: [{label:'Marketing & social', sections:['marketing-social']}],
    traffic: [{label:'Website & campaign traffic', sections:['web-traffic-links']}],
    growth: [
      {label:'Money & orders', sections:['money','vendors-orders']},
      {label:'Marketing & reach', sections:['marketing-social','web-traffic-links']}
    ]
  };
  function attentionItem(label, value, slug) {
    var button = document.createElement('button'); button.type = 'button';
    var title = document.createElement('span'); title.textContent = label;
    var content = document.createElement('strong'); content.textContent = value;
    button.appendChild(title); button.appendChild(content);
    button.addEventListener('click', function () { expandSection(sections[slug], sections[slug].querySelector('.hq-expand-button')); });
    attention.appendChild(button);
  }
  function textOf(section, selector, fallback) {
    var node = sections[section] && sections[section].querySelector(selector);
    return node ? node.textContent.trim() : fallback;
  }
  function applyView() {
    var hash = location.hash, requested = hash.replace('#view-', '');
    var known = Object.prototype.hasOwnProperty.call(layouts, requested);
    var view = known ? requested : hash ? 'all' : 'run';
    if (hash && !known && document.documentElement.dataset.hqView) return;
    collapseSection();
    Object.keys(sections).forEach(function (slug) {
      if (slug !== 'everything-one-tap-away') stash.appendChild(sections[slug]);
    });
    dash.querySelectorAll(':scope > .hq-column').forEach(function (column) { column.remove(); });
    layouts[view].forEach(function (group) {
      var column = document.createElement('div'); column.className = 'hq-column';
      column.setAttribute('aria-label', group.label);
      var label = document.createElement('div'); label.className = 'hq-column-label'; label.textContent = group.label;
      column.appendChild(label);
      group.sections.forEach(function (slug) { if (sections[slug]) column.appendChild(sections[slug]); });
      dash.appendChild(column);
    });
    document.documentElement.dataset.hqView = view;
    var activeLink = viewNav.querySelector('[data-view="' + view + '"]');
    document.title = (activeLink ? activeLink.textContent : 'Money & Growth') + ' — Stevo Headquarters';
    viewNav.querySelectorAll('a').forEach(function (link) {
      if (link.dataset.view === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    attention.replaceChildren(); attention.hidden = !['run','operations','money','orders','marketing','growth'].includes(view);
    if (view === 'run') {
      attentionItem('Next actions', sections['do-this-next'].querySelectorAll('.lane.late').length + ' overdue next actions', 'do-this-next');
    }
    if (view === 'operations') {
      attentionItem('App health', textOf('app-health', '.knum', '—') + ' open user reports', 'app-health');
    }
    if (view === 'money' || view === 'growth') {
      attentionItem('Due in 30 days', textOf('money', '.money-grid .odds-tile:nth-child(2) .knum', 'See payment schedule'), 'money');
    }
    if (view === 'orders' || view === 'growth') {
      attentionItem('Orders needing attention', textOf('vendors-orders', '.mlead', 'See open orders'), 'vendors-orders');
    }
    if (view === 'marketing' || view === 'growth') {
      var schedule = sections['marketing-social'].querySelector('.pgrid');
      var scheduleText = schedule && schedule.closest('.panel').querySelector('.csub');
      if (scheduleText && scheduleText.textContent.includes('next:')) {
        attentionItem('Next marketing post', scheduleText.textContent.split('next:')[1].trim(), 'marketing-social');
      }
    }
    sizeOverview();
  }
  window.addEventListener('hashchange', applyView);
  applyView();
  sizeOverview();
  window.addEventListener('resize', sizeOverview);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeOverview);
})();
