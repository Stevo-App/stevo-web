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
    requestAnimationFrame(function () { queued = false; boundTables(document); });
  }).observe(document.body, {childList: true, subtree: true});
  document.documentElement.classList.add('hq-compact');
  function sizeOverview() {
    var foot = document.querySelector('.wrap > .foot');
    var reserved = (foot ? foot.getBoundingClientRect().height : 0) + 26;
    dash.style.setProperty('--hq-available', Math.max(400, window.innerHeight - dash.getBoundingClientRect().top - reserved) + 'px');
  }
  sizeOverview();
  window.addEventListener('resize', sizeOverview);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizeOverview);
})();
