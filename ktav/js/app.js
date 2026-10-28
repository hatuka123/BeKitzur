// Page wiring: tabs, the letter grid, the printed-sheet scanner, and export.
(function (KF) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, v) { return KF.i18n.t(k, v); };
  var N = KF.G.CANVAS, tiles = {}, imgCache = {};

  var android = window.Android && typeof window.Android.saveFile === 'function';

  function download(blob, name) {
    if (android) {
      var r = new FileReader();
      r.onload = function () {
        window.Android.saveFile(name, String(r.result).split(',')[1], blob.type || 'application/octet-stream');
      };
      r.readAsDataURL(blob);
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function warn(msg) { alert(msg); }

  function loadImage(url) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = url;
    });
  }

  function rgbaToDataURL(rgba) {
    var c = document.createElement('canvas');
    c.width = c.height = N;
    c.getContext('2d').putImageData(new ImageData(rgba, N, N), 0, 0);
    return c.toDataURL('image/png');
  }

  // ---- tabs & language ----

  function initTabs() {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); });
        document.querySelectorAll('.tab').forEach(function (s) { s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab); });
        if (b.dataset.tab === 'write') KF.write.show();
      };
    });
    $('lang').onclick = function () {
      setLang(KF.i18n.lang === 'he' ? 'en' : 'he');
    };
  }

  function setLang(l) {
    var prevDefault = t('previewText');
    KF.i18n.set(l);
    KF.store.setting('lang', l);
    $('lang').textContent = l === 'he' ? 'English' : 'עברית';
    buildGrid();
    fillPages();
    if (!$('previewText').value || $('previewText').value === prevDefault) $('previewText').value = t('previewText');
  }

  // ---- letter grid ----

  function drawTile(ch) {
    var c = tiles[ch];
    if (!c) return;
    var x = c.getContext('2d'), s = c.width, url = KF.store.get(ch);
    x.clearRect(0, 0, s, s);
    c.parentNode.classList.toggle('done', !!url);
    var k = KF.store.variants(ch).length;
    c.parentNode.querySelector('.count').textContent = k > 1 ? '×' + k : '';
    if (!url) return;
    var img = imgCache[url];
    if (!img) {
      img = imgCache[url] = new Image();
      img.onload = function () { drawTile(ch); };
      img.src = url;
      return;
    }
    if (img.complete) x.drawImage(img, 0, 0, s, s);
  }

  function buildGrid() {
    var grid = $('grid');
    grid.textContent = '';
    tiles = {};
    KF.charset.GROUPS.forEach(function (g) {
      var h = document.createElement('h3');
      h.textContent = t('g_' + g.id);
      var box = document.createElement('div');
      box.className = 'tiles';
      box.dir = g.id === 'hebrew' ? 'rtl' : 'ltr';
      g.chars.split('').forEach(function (ch) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tile';
        var c = document.createElement('canvas');
        c.width = c.height = 96;
        var l = document.createElement('span');
        l.textContent = ch;
        var n = document.createElement('i');
        n.className = 'count';
        b.append(c, l, n);
        b.onclick = function () { KF.editor.open(ch); };
        box.appendChild(b);
        tiles[ch] = c;
        drawTile(ch);
      });
      grid.append(h, box);
    });
    progress();
  }

  function progress() {
    var total = KF.charset.ALL.length;
    var n = KF.charset.ALL.split('').filter(function (ch) { return KF.store.has(ch); }).length;
    $('progress').textContent = t('progress', { n: n, t: total });
  }

  // ---- printable sheet & scanning ----

  function fillPages() {
    var sel = $('scanPage'), v = sel.value;
    sel.textContent = '';
    KF.charset.PAGES.forEach(function (p, i) {
      var o = document.createElement('option');
      o.value = i;
      o.textContent = t('page') + ' ' + (i + 1) + ' · ' + t('g_' + p.id);
      sel.appendChild(o);
    });
    if (v) sel.value = v;
  }

  function printSheets() {
    var area = $('printArea') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'printArea' }));
    area.textContent = '';
    KF.charset.PAGES.forEach(function (_, i) {
      var img = document.createElement('img');
      img.src = KF.sheet.renderPage(i).toDataURL('image/png');
      area.appendChild(img);
    });
    setTimeout(function () {
      if (android) window.Android.print(); else window.print();
    }, 300);
  }

  function pngSheets() {
    KF.charset.PAGES.forEach(function (p, i) {
      setTimeout(function () {
        KF.sheet.renderPage(i).toBlob(function (b) { download(b, 'ktav-sheet-' + (i + 1) + '-' + p.id + '.png'); });
      }, i * 600);
    });
  }

  var scan = { g: null, corners: null, drag: -1, cells: null };

  function scanView() {
    var c = $('scanCanvas'), g = scan.g;
    var k = Math.min(1, 1400 / Math.max(g.w, g.h));
    c.width = Math.round(g.w * k); c.height = Math.round(g.h * k);
    var x = c.getContext('2d');
    x.drawImage(g.canvas, 0, 0, c.width, c.height);
    var r = Math.max(8, c.width / 70);
    x.lineWidth = r / 3;
    x.strokeStyle = '#ff7a00';
    x.beginPath();
    scan.corners.forEach(function (p, i) { x[i ? 'lineTo' : 'moveTo'](p[0] * k, p[1] * k); });
    x.closePath();
    x.stroke();
    scan.corners.forEach(function (p) {
      x.fillStyle = 'rgba(255,122,0,.85)';
      x.beginPath();
      x.arc(p[0] * k, p[1] * k, r, 0, Math.PI * 2);
      x.fill();
    });
    scan.k = k;
  }

  function scanPos(e) {
    var c = $('scanCanvas'), r = c.getBoundingClientRect();
    return [(e.clientX - r.left) * c.width / r.width / scan.k, (e.clientY - r.top) * c.height / r.height / scan.k];
  }

  function initScan() {
    fillPages();
    $('sheetPrint').onclick = printSheets;
    $('sheetPng').onclick = pngSheets;
    if (android) $('sheetPng').hidden = true; // print → "Save as PDF" covers it
    $('scanFile').onchange = function () {
      var f = this.files[0];
      this.value = '';
      if (!f) return;
      var url = URL.createObjectURL(f);
      loadImage(url).then(function (img) {
        URL.revokeObjectURL(url);
        scan.g = KF.scan.toGray(img);
        var found = KF.scan.detect(scan.g), w = scan.g.w, h = scan.g.h;
        scan.corners = found || [[w * 0.1, h * 0.1], [w * 0.9, h * 0.1], [w * 0.9, h * 0.9], [w * 0.1, h * 0.9]];
        $('scanWork').hidden = false;
        $('scanResult').hidden = true;
        scanView();
        if (!found) warn(t('detectFail'));
      });
    };
    var c = $('scanCanvas');
    c.addEventListener('pointerdown', function (e) {
      var p = scanPos(e), best = -1, bd = Infinity;
      scan.corners.forEach(function (q, i) {
        var d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < bd) { bd = d; best = i; }
      });
      if (bd * scan.k > c.width / 12) return;
      scan.drag = best;
      c.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    c.addEventListener('pointermove', function (e) {
      if (scan.drag < 0) return;
      scan.corners[scan.drag] = scanPos(e);
      scanView();
    });
    c.addEventListener('pointerup', function () { scan.drag = -1; });
    c.addEventListener('pointercancel', function () { scan.drag = -1; });

    $('scanCut').onclick = function () {
      var page = +$('scanPage').value;
      scan.cells = KF.scan.extract(scan.g, scan.corners, page);
      var box = $('scanCells');
      box.textContent = '';
      box.dir = KF.charset.PAGES[page].id === 'hebrew' ? 'rtl' : 'ltr';
      scan.cells.forEach(function (cell) {
        var d = document.createElement('div');
        d.className = 'tile done';
        var cv = document.createElement('canvas');
        cv.width = cv.height = N;
        cv.getContext('2d').putImageData(new ImageData(cell.rgba, N, N), 0, 0);
        var l = document.createElement('span');
        l.textContent = cell.ch;
        d.append(cv, l);
        box.appendChild(d);
      });
      $('scanResult').hidden = false;
      $('scanSave').disabled = !scan.cells.length;
      $('scanMsg').textContent = scan.cells.length ? t('cutFound', { n: scan.cells.length }) : t('cutNone');
    };

    $('scanSave').onclick = function () {
      var cells = scan.cells || [];
      var existing = cells.filter(function (c) { return KF.store.has(c.ch); }).length;
      if (existing && !confirm(t('confirmOverwrite', { n: existing }))) return;
      var map = {};
      cells.forEach(function (c) { map[c.ch] = rgbaToDataURL(c.rgba); });
      if (!KF.store.setMany(map)) warn(t('storageFull'));
      $('scanMsg').textContent = t('saved', { n: cells.length });
      $('scanSave').disabled = true;
      var sel = $('scanPage');
      if (+sel.value < KF.charset.PAGES.length - 1) sel.value = +sel.value + 1;
    };
  }

  // ---- font ----

  function fontOpts() {
    return {
      family: KF.fontgen.cleanFamily($('fName').value),
      weight: +$('fWeight').value,
      spacing: +$('fSpacing').value,
      wordSpace: +$('fWord').value,
      fillCase: $('fCase').checked,
      variants: $('fVariants').checked,
    };
  }

  function bitmaps() {
    var chars = KF.store.chars(), out = {};
    var c = document.createElement('canvas');
    c.width = c.height = N;
    var x = c.getContext('2d', { willReadFrequently: true });
    var jobs = [];
    chars.forEach(function (ch) {
      KF.store.variants(ch).slice(0, KF.fontgen.MAX_VARIANTS).forEach(function (url) {
        jobs.push(loadImage(url).then(function (img) { return [ch, img]; }));
      });
    });
    return Promise.all(jobs).then(function (list) {
      list.forEach(function (e) {
        x.clearRect(0, 0, N, N);
        x.drawImage(e[1], 0, 0);
        (out[e[0]] = out[e[0]] || []).push(x.getImageData(0, 0, N, N).data);
      });
      return out;
    });
  }

  var building = false, previewN = 0;

  function build(msg) {
    msg = msg || $('fMsg');
    if (building) return Promise.reject(new Error('busy'));
    if (!KF.store.chars().length) { msg.textContent = t('noGlyphs'); return Promise.reject(new Error('empty')); }
    building = true;
    msg.textContent = t('building');
    var opts = fontOpts();
    return new Promise(function (r) { setTimeout(r, 30); }).then(bitmaps).then(function (bm) {
      var res = KF.fontgen.makeFont(bm, opts);
      msg.textContent = t('built', { n: res.count, a: res.alternates });
      res.opts = opts;
      return res;
    }).finally(function () { building = false; });
  }

  function preview(res) {
    var name = 'KtavPreview' + (++previewN);
    var face = new FontFace(name, res.bytes.buffer);
    return face.load().then(function (f) {
      document.fonts.add(f);
      $('previewText').style.fontFamily = '"' + name + '", sans-serif';
    });
  }

  function initFont() {
    ['fName', 'fWeight', 'fSpacing', 'fWord', 'fCase', 'fVariants'].forEach(function (id) {
      var el = $(id), v = KF.store.setting(id);
      if (v != null) { if (el.type === 'checkbox') el.checked = v; else el.value = v; }
      el.addEventListener('change', function () {
        KF.store.setting(id, el.type === 'checkbox' ? el.checked : el.value);
      });
    });
    $('previewText').value = t('previewText');
    $('fPreview').onclick = function () { build().then(preview).catch(function () {}); };
    $('fDownload').onclick = function () {
      build().then(function (res) {
        download(new Blob([res.bytes], { type: 'font/ttf' }), res.opts.family.replace(/\s+/g, '') + '.ttf');
        return preview(res);
      }).catch(function () {});
    };
    $('projSave').onclick = function () {
      download(new Blob([KF.store.exportJSON()], { type: 'application/json' }), 'ktav-project.json');
    };
    $('projLoad').onchange = function () {
      var f = this.files[0];
      this.value = '';
      if (!f) return;
      f.text().then(function (txt) {
        try {
          if (!KF.store.importJSON(txt)) warn(t('storageFull'));
        } catch (e) { warn(t('loadFail')); }
      });
    };
    $('projClear').onclick = function () {
      if (confirm(t('confirmClear'))) KF.store.clear();
    };
  }

  function init() {
    KF.editor.init();
    KF.handui.init();
    KF.write.init();
    initTabs();
    initScan();
    initFont();
    KF.store.onChange(function (ch) {
      if (ch) drawTile(ch); else KF.charset.ALL.split('').forEach(drawTile);
      progress();
    });
    setLang(KF.store.setting('lang') || 'he');
  }

  KF.app = { warn: warn, download: download, loadImage: loadImage, rgbaToDataURL: rgbaToDataURL, build: build };
  init();
})(globalThis.KF = globalThis.KF || {});
