/* Site Analytics dashboard panel. Renders into <section id="site-analytics"></section>. */
(function () {
  'use strict';
  var root = document.getElementById('site-analytics');
  if (!root) return;
  root.classList.add('sa');

  var RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days']];
  var days = 30, data = null, showTable = false;
  try { days = Number(localStorage.getItem('sa_days')) || 30; } catch (e) {}
  if (!RANGES.some(function (r) { return r[0] === days; })) days = 30;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var num = function (n) { return Number(n || 0).toLocaleString('en-US'); };
  var pct = function (x) { var v = x * 100; return (v > 0 && v < 9.95 ? v.toFixed(1) : Math.round(v)) + '%'; };
  var dayDate = function (d) { return new Date(d + 'T12:00:00'); };
  var shortDay = function (d) { return dayDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  var longDay = function (d) { return dayDate(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); };

  function pageName(p) {
    if (p === '/' || !p) return 'Home page';
    var s = p.replace(/^\//, '').replace(/[-_/]+/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function delta(cur, prev) {
    if (!data.previousAvailable) return '';
    if (!prev) return cur ? 'new this period' : 'same as before';
    var ch = (cur - prev) / prev;
    if (Math.abs(ch) < 0.005) return 'same as prior ' + days + ' days';
    return (ch > 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(ch) * 100) + '% vs prior ' + days + ' days';
  }

  function kpi(label, value, sub, hero) {
    return '<div class="sa-kpi' + (hero ? ' hero' : '') + '"><span>' + label + '</span><b>' + value + '</b><small>' + (sub || '&nbsp;') + '</small></div>';
  }

  function list(rows, label, value, empty) {
    if (!rows.length) return '<ul class="sa-list"><li class="none">' + empty + '</li></ul>';
    var max = Math.max.apply(null, rows.map(value)) || 1;
    return '<ul class="sa-list">' + rows.map(function (r) {
      return '<li style="--w:' + Math.max(3, (value(r) / max) * 100).toFixed(1) + '%"><span class="lbl">' + esc(label(r)) + '</span><span class="val">' + num(value(r)) + '</span></li>';
    }).join('') + '</ul>';
  }

  function chart() {
    var rows = data.daily;
    var total = rows.reduce(function (s, r) { return s + r.pageviews; }, 0);
    if (!total) {
      return '<div class="sa-empty">No visits counted yet for this period.<br>New visits show up here within a minute of someone opening the website.</div>';
    }
    var W = Math.max(280, Math.round(root.clientWidth - 2 * parseFloat(getComputedStyle(root).paddingLeft || 18)));
    var H = W < 520 ? 160 : 190, padL = 34, padB = 22, padT = 8;
    var max = Math.max.apply(null, rows.map(function (r) { return r.visitors; }));
    var step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : max <= 100 ? 20 : max <= 250 ? 50 : Math.ceil(max / 5 / 100) * 100;
    var top = Math.max(step, Math.ceil(max / step) * step);
    var plotW = W - padL, plotH = H - padB - padT;
    var slot = plotW / rows.length, gap = Math.min(6, Math.max(2, slot * 0.18)), bw = Math.max(1, slot - gap);
    var y = function (v) { return padT + plotH - (v / top) * plotH; };
    var svg = '';
    for (var t = 0; t <= top; t += step) {
      svg += '<line class="grid" x1="' + padL + '" x2="' + W + '" y1="' + y(t) + '" y2="' + y(t) + '"/>' +
        '<text class="axis" x="' + (padL - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + t + '</text>';
    }
    var firstTracked = rows.findIndex(function (r) { return r.tracked !== false; });
    if (firstTracked > 0) {
      var shadeW = firstTracked * slot;
      svg += '<rect class="untracked" x="' + padL + '" y="' + padT + '" width="' + shadeW + '" height="' + plotH + '" rx="6"/>';
      if (shadeW > 90) svg += '<text class="axis" x="' + (padL + shadeW / 2) + '" y="' + (padT + plotH / 2 + 4) + '" text-anchor="middle">Not tracked yet</text>';
    }
    var every = rows.length <= 7 ? (W < 420 ? 2 : 1) : rows.length <= 31 ? (W < 520 ? 10 : 7) : (W < 520 ? 30 : 14);
    rows.forEach(function (r, i) {
      var x = padL + i * slot + gap / 2;
      var h = Math.max(0, (r.visitors / top) * plotH);
      var ry = Math.min(4, bw / 2, h);
      var by = padT + plotH - h;
      // Bar with rounded top corners, square at the baseline.
      var path = h > 0
        ? 'M' + x + ',' + (padT + plotH) + 'V' + (by + ry) + 'Q' + x + ',' + by + ' ' + (x + ry) + ',' + by +
          'H' + (x + bw - ry) + 'Q' + (x + bw) + ',' + by + ' ' + (x + bw) + ',' + (by + ry) + 'V' + (padT + plotH) + 'Z'
        : '';
      svg += '<rect class="hit" data-i="' + i + '" x="' + (padL + i * slot) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '"/>';
      svg += '<path class="bar" data-bar="' + i + '" d="' + path + '"/>';
      if ((rows.length - 1 - i) % every === 0) {
        svg += '<text class="axis" x="' + (x + bw / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + shortDay(r.day) + '</text>';
      }
    });
    return '<div class="sa-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Visitors per day">' + svg + '</svg><div class="sa-tip" role="status"></div></div>';
  }

  function table() {
    return '<div class="sa-tablewrap"><table class="sa-table"><thead><tr><th>Day</th><th>Visitors</th><th>Page views</th><th>Call/text taps</th></tr></thead><tbody>' +
      data.daily.slice().reverse().map(function (r) {
        return '<tr><td>' + longDay(r.day) + '</td><td>' + num(r.visitors) + '</td><td>' + num(r.pageviews) + '</td><td>' + num(r.taps) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function render() {
    var c = data.current, p = data.previous;
    var since = new Date(data.trackingSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var dv = data.devices, dTot = dv.mobile + dv.desktop + dv.tablet;
    var devRows = dTot ? [['Phone', dv.mobile], ['Computer', dv.desktop], ['Tablet', dv.tablet]].filter(function (r) { return r[1]; }) : [];

    root.innerHTML =
      '<div class="sa-head"><div><h2>Website traffic</h2><p class="sa-sub">Real people only: bots and your own admin visits aren’t counted. Tracking since ' + since + '.</p></div>' +
        '<div class="sa-range" role="group" aria-label="Date range">' + RANGES.map(function (r) {
          return '<button type="button" data-days="' + r[0] + '" aria-pressed="' + (r[0] === days) + '">' + r[1] + '</button>';
        }).join('') + '</div></div>' +
      '<div class="sa-kpis">' +
        kpi('Visitors', num(c.visitors), delta(c.visitors, p.visitors), true) +
        kpi('Page views', num(c.pageviews), c.visitors ? (c.pageviews / c.visitors).toFixed(1) + ' per visitor' : '') +
        kpi('Call & text taps', num(c.calls + c.texts), c.texts ? num(c.calls) + ' calls · ' + num(c.texts) + ' texts' : delta(c.calls, p.calls)) +
        kpi('Form leads', num(c.leads), delta(c.leads, p.leads)) +
        kpi('Contact rate', c.visitors ? pct(c.contactRate) : '—', 'called, texted or sent a form') +
      '</div>' +
      chart() +
      '<div class="sa-legend"><span>Visitors per day · tap or hover a bar for details</span><button type="button" data-table>' + (showTable ? 'Hide table' : 'Show as table') + '</button></div>' +
      (showTable ? table() : '') +
      '<div class="sa-cols">' +
        '<div class="sa-col"><h3>Where visitors came from</h3>' + list(data.sources, function (r) { return r.source || 'Direct'; }, function (r) { return r.visits; }, 'No visits yet') + '</div>' +
        '<div class="sa-col"><h3>Most viewed pages</h3>' + list(data.pages, function (r) { return pageName(r.path); }, function (r) { return r.views; }, 'No page views yet') + '</div>' +
        '<div class="sa-col"><h3>What they browsed on</h3>' + list(devRows, function (r) { return r[0] + ' · ' + Math.round((r[1] / dTot) * 100) + '%'; }, function (r) { return r[1]; }, 'No visits yet') +
          (data.social.length ? '<h3 style="margin-top:14px">Clicked through to</h3>' + list(data.social, function (r) { return r.label.replace(/\b\w/g, function (ch) { return ch.toUpperCase(); }); }, function (r) { return r.n; }, '') : '') +
        '</div>' +
      '</div>' +
      '<p class="sa-note">“Direct” means they typed the address, used a bookmark, or came from an app that hides where it sent them. Page views are counted per page load; visitors are counted once per day.</p>';
  }

  function load() {
    fetch('/api/admin/analytics?days=' + days, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { data = d; render(); })
      .catch(function () {
        if (!data) root.innerHTML = '<div class="sa-head"><div><h2>Website traffic</h2><p class="sa-sub">Couldn’t load traffic numbers right now. Refresh to try again.</p></div></div>';
      });
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-days],[data-table]');
    if (!b) return;
    if (b.hasAttribute('data-table')) { showTable = !showTable; render(); return; }
    days = Number(b.getAttribute('data-days'));
    try { localStorage.setItem('sa_days', String(days)); } catch (err) {}
    load();
  });

  // Hover tooltip on the daily bars.
  root.addEventListener('mouseover', function (e) {
    var hit = e.target.closest && e.target.closest('.hit');
    var tip = root.querySelector('.sa-tip');
    root.querySelectorAll('.bar.on').forEach(function (b) { b.classList.remove('on'); });
    if (!hit || !tip || !data) { if (tip) tip.classList.remove('on'); return; }
    var i = Number(hit.getAttribute('data-i')), r = data.daily[i];
    var bar = root.querySelector('[data-bar="' + i + '"]'); if (bar) bar.classList.add('on');
    var box = root.querySelector('.sa-chart').getBoundingClientRect(), hb = hit.getBoundingClientRect();
    var barTop = bar && bar.getBoundingClientRect().height ? bar.getBoundingClientRect().top : hb.bottom - 20;
    tip.innerHTML = r.tracked === false ? '<b>' + longDay(r.day) + '</b>Before tracking started' : '<b>' + longDay(r.day) + '</b>' + num(r.visitors) + ' visitor' + (r.visitors === 1 ? '' : 's') + ' · ' + num(r.pageviews) + ' page view' + (r.pageviews === 1 ? '' : 's') +
      (r.taps ? '<br>' + num(r.taps) + ' call/text tap' + (r.taps === 1 ? '' : 's') : '');
    var x = hb.left + hb.width / 2 - box.left;
    var half = tip.offsetWidth / 2;
    tip.style.left = Math.min(Math.max(x, half), box.width - half) + 'px';
    tip.style.top = Math.max(barTop - box.top, 40) + 'px';
    tip.classList.add('on');
  });
  root.addEventListener('mouseleave', function () {
    var tip = root.querySelector('.sa-tip'); if (tip) tip.classList.remove('on');
    root.querySelectorAll('.bar.on').forEach(function (b) { b.classList.remove('on'); });
  });

  var lastW = 0, rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (data && root.clientWidth !== lastW) { lastW = root.clientWidth; render(); } }, 150);
  });

  load();
  setInterval(function () { if (!document.hidden) load(); }, 120000);
})();
