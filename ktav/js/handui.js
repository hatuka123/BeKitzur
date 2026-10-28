// The "photo of handwriting" tab: guess, let the user confirm each line,
// then add the confirmed letters to the font as variants.
(function (KF) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, v) { return KF.i18n.t(k, v); };
  var N = KF.G.CANVAS, page = null, lines = [];

  function ownTemplates() {
    var c = document.createElement('canvas');
    c.width = c.height = N;
    var x = c.getContext('2d', { willReadFrequently: true }), jobs = [];
    KF.store.chars().forEach(function (ch) {
      KF.store.variants(ch).slice(0, 3).forEach(function (url) {
        jobs.push(KF.app.loadImage(url).then(function (img) { return [ch, img]; }));
      });
    });
    return Promise.all(jobs).then(function (list) {
      return list.map(function (e) {
        x.clearRect(0, 0, N, N);
        x.drawImage(e[1], 0, 0);
        return KF.hand.templateFromBox(e[0], x.getImageData(0, 0, N, N).data);
      }).filter(Boolean);
    });
  }

  function usable(gl) { return gl.ch && !gl.off && KF.charset.ALL.indexOf(gl.ch) >= 0; }

  function countReady() {
    var n = 0;
    lines.forEach(function (l) { l.glyphs.forEach(function (gl) { if (usable(gl)) n++; }); });
    $('handAdd').textContent = t('handAdd') + ' (' + n + ')';
    $('handAdd').disabled = !n;
  }

  // Draw part of the photo into canvas c, fitted and centred.
  function crop(c, x0, y0, x1, y1) {
    var g = page.g, w = x1 - x0, h = y1 - y0, s = Math.min(c.width / w, c.height / h);
    var x = c.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(g.canvas, x0, y0, w, h, (c.width - w * s) / 2, (c.height - h * s) / 2, w * s, h * s);
  }

  function renderCells(l) {
    var box = l.cells;
    box.textContent = '';
    l.glyphs.forEach(function (gl) {
      var d = document.createElement('div');
      d.className = 'hwcell' + (usable(gl) ? '' : ' off') + (gl.weak ? ' weak' : '');
      var c = document.createElement('canvas');
      c.width = c.height = 64;
      var pad = Math.round(l.line.H * 0.1);
      crop(c, Math.max(0, gl.x0 - pad), Math.max(0, gl.y0 - pad),
        Math.min(page.g.w, gl.x1 + pad), Math.min(page.g.h, gl.y1 + pad));
      c.onclick = function () {
        gl.off = !gl.off;
        d.classList.toggle('off', !usable(gl));
        countReady();
      };
      var inp = document.createElement('input');
      inp.value = gl.ch;
      inp.maxLength = 2;
      inp.oninput = function () {
        gl.ch = Array.from(inp.value.trim())[0] || '';
        gl.off = !gl.ch;
        d.classList.toggle('off', !usable(gl));
        countReady();
      };
      d.append(c, inp);
      box.appendChild(d);
    });
    l.warn.hidden = l.exact;
    countReady();
  }

  function render() {
    var root = $('handLines');
    root.textContent = '';
    lines.forEach(function (l) {
      var L = l.line, pad = Math.round(L.H * 0.3), g = page.g;
      var x0 = Math.max(0, L.x0 - pad), y0 = Math.max(0, L.y0 - pad);
      var x1 = Math.min(g.w, L.x1 + pad), y1 = Math.min(g.h, L.y1 + pad);
      var div = document.createElement('div');
      div.className = 'hwline';
      var strip = document.createElement('canvas');
      var k = Math.min(2, 1000 / (x1 - x0));
      strip.width = Math.round((x1 - x0) * k);
      strip.height = Math.round((y1 - y0) * k);
      strip.className = 'strip';
      crop(strip, x0, y0, x1, y1);
      var inp = document.createElement('input');
      inp.className = 'hwtext';
      inp.dir = 'auto';
      inp.value = l.text;
      var warn = document.createElement('div');
      warn.className = 'warn';
      warn.textContent = t('handMismatch');
      var cells = document.createElement('div');
      cells.className = 'hwcells';
      cells.dir = 'ltr';
      l.cells = cells;
      l.warn = warn;
      inp.onchange = function () {
        l.text = inp.value;
        realign(l);
        renderCells(l);
      };
      div.append(strip, inp, warn, cells);
      root.appendChild(div);
      renderCells(l);
    });
  }

  // ---- step 1: crop / rotate / invert ----

  var prep = null;

  function rotated() {
    var img = prep.img, w = img.naturalWidth, h = img.naturalHeight;
    var k = Math.min(1, 3200 / Math.max(w, h)), c = document.createElement('canvas');
    var sw = prep.rot % 2 ? h : w, sh = prep.rot % 2 ? w : h;
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    var x = c.getContext('2d');
    x.translate(c.width / 2, c.height / 2);
    x.rotate(prep.rot * Math.PI / 2);
    x.drawImage(img, -w * k / 2, -h * k / 2, w * k, h * k);
    return c;
  }

  function drawPrep() {
    var src = prep.full, c = $('prepCanvas');
    var k = Math.min(1, 1200 / Math.max(src.width, src.height));
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    var x = c.getContext('2d'), r = prep.crop;
    x.drawImage(src, 0, 0, c.width, c.height);
    x.fillStyle = 'rgba(0,0,0,.5)';
    var X0 = r[0] * c.width, Y0 = r[1] * c.height, X1 = r[2] * c.width, Y1 = r[3] * c.height;
    x.fillRect(0, 0, c.width, Y0); x.fillRect(0, Y1, c.width, c.height - Y1);
    x.fillRect(0, Y0, X0, Y1 - Y0); x.fillRect(X1, Y0, c.width - X1, Y1 - Y0);
    x.strokeStyle = '#ff7a00';
    x.lineWidth = Math.max(2, c.width / 300);
    x.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    var hr = Math.max(8, c.width / 60);
    x.fillStyle = '#ff7a00';
    [[X0, Y0], [X1, Y0], [X1, Y1], [X0, Y1]].forEach(function (p) {
      x.beginPath(); x.arc(p[0], p[1], hr, 0, Math.PI * 2); x.fill();
    });
  }

  function darkBackground(c) {
    var k = 64, t = document.createElement('canvas');
    t.width = t.height = k;
    var x = t.getContext('2d', { willReadFrequently: true });
    x.drawImage(c, 0, 0, k, k);
    var d = x.getImageData(0, 0, k, k).data, vals = [];
    for (var i = 0; i < d.length; i += 4) vals.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    vals.sort(function (a, b) { return a - b; });
    return vals[vals.length >> 1] < 100;
  }

  function open(file) {
    $('handMsg').textContent = '';
    $('handWork').hidden = true;
    var url = URL.createObjectURL(file);
    KF.app.loadImage(url).then(function (img) {
      URL.revokeObjectURL(url);
      prep = { img: img, rot: 0, crop: [0.02, 0.02, 0.98, 0.98], drag: -1 };
      prep.full = rotated();
      $('prepInvert').checked = darkBackground(prep.full);
      $('handPrep').hidden = false;
      drawPrep();
    }).catch(function () { $('handMsg').textContent = t('handNone'); });
  }

  function prepPos(e) {
    var c = $('prepCanvas'), r = c.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  function initPrep() {
    var c = $('prepCanvas');
    c.addEventListener('pointerdown', function (e) {
      if (!prep) return;
      var p = prepPos(e), r = prep.crop, pts = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
      var best = -1, bd = 0.08;
      pts.forEach(function (q, i) {
        var d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < bd) { bd = d; best = i; }
      });
      prep.drag = best;
      if (best >= 0) { c.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    c.addEventListener('pointermove', function (e) {
      if (!prep || prep.drag < 0) return;
      var p = prepPos(e), r = prep.crop, m = 0.03;
      p = [Math.max(0, Math.min(1, p[0])), Math.max(0, Math.min(1, p[1]))];
      var i = prep.drag;
      if (i === 0 || i === 3) r[0] = Math.min(p[0], r[2] - m); else r[2] = Math.max(p[0], r[0] + m);
      if (i === 0 || i === 1) r[1] = Math.min(p[1], r[3] - m); else r[3] = Math.max(p[1], r[1] + m);
      drawPrep();
    });
    c.addEventListener('pointerup', function () { if (prep) prep.drag = -1; });
    c.addEventListener('pointercancel', function () { if (prep) prep.drag = -1; });
    $('prepRotate').onclick = function () {
      prep.rot = (prep.rot + 1) % 4;
      prep.full = rotated();
      prep.crop = [0.02, 0.02, 0.98, 0.98];
      drawPrep();
    };
    $('prepGo').onclick = function () {
      var src = prep.full, r = prep.crop;
      var x0 = Math.round(r[0] * src.width), y0 = Math.round(r[1] * src.height);
      var w = Math.round((r[2] - r[0]) * src.width), h = Math.round((r[3] - r[1]) * src.height);
      var c2 = document.createElement('canvas');
      c2.width = w; c2.height = h;
      var x = c2.getContext('2d', { willReadFrequently: true });
      x.drawImage(src, x0, y0, w, h, 0, 0, w, h);
      if ($('prepInvert').checked) {
        var d = x.getImageData(0, 0, w, h);
        for (var i = 0; i < d.data.length; i += 4) {
          d.data[i] = 255 - d.data[i]; d.data[i + 1] = 255 - d.data[i + 1]; d.data[i + 2] = 255 - d.data[i + 2];
        }
        x.putImageData(d, 0, 0);
      }
      analyse(c2);
    };
  }

  // ---- step 2: find letters, read the text ----

  function stripPng(L) {
    var g = page.g, pad = Math.round(L.H * 0.3);
    var x0 = Math.max(0, L.x0 - pad), y0 = Math.max(0, L.y0 - pad);
    var x1 = Math.min(g.w, L.x1 + pad), y1 = Math.min(g.h, L.y1 + pad);
    var k = Math.min(1, 1100 / (x1 - x0)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((x1 - x0) * k)); c.height = Math.max(1, Math.round((y1 - y0) * k));
    c.getContext('2d').drawImage(g.canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
  }

  var templates = [];

  function analyse(canvas) {
    $('handMsg').textContent = t('handWorking');
    $('handWork').hidden = true;
    new Promise(function (r) { setTimeout(r, 30); }).then(ownTemplates).then(function (own) {
      templates = own.concat(KF.hand.printedTemplates());
      page = KF.hand.segment(KF.scan.toGray(canvas));
      lines = page.lines.map(function (L) {
        return { line: L, text: KF.hand.guessLine(page, L, templates) };
      });
      if (!lines.length) throw new Error('none');
      if (!KF.ai.hasKey()) return null;
      $('handMsg').textContent = t('aiReading');
      return KF.ai.readLines(lines.map(function (l) { return stripPng(l.line); })).catch(function (e) {
        $('handMsg').textContent = t('aiFail', { e: e.message });
        return null;
      });
    }).then(function (read) {
      var byAi = read && read.length === lines.length;
      lines.forEach(function (l, i) {
        if (byAi) l.text = read[i];
        realign(l);
      });
      $('handMsg').textContent = t(byAi ? 'handFoundAi' : 'handFound', { n: lines.length });
      $('handPrep').hidden = true;
      $('handWork').hidden = false;
      $('handAddMsg').textContent = '';
      render();
    }).catch(function () { $('handMsg').textContent = t('handNone'); });
  }

  function realign(l) {
    var r = KF.hand.align(page, l.line, l.text);
    l.glyphs = KF.hand.review(page, l.line, r.glyphs, templates);
    l.exact = r.exact;
  }

  function add() {
    var list = [], chars = {};
    lines.forEach(function (l) {
      var m = KF.hand.lineMetrics(l.glyphs, l.line.H);
      l.glyphs.forEach(function (gl) {
        if (!usable(gl)) return;
        var rgba = KF.hand.toBox(page, gl, m), ink = 0;
        for (var i = 3; i < rgba.length; i += 4) if (rgba[i] > 128) ink++;
        if (ink < 30) return;
        list.push({ ch: gl.ch, url: KF.app.rgbaToDataURL(rgba) });
        chars[gl.ch] = 1;
      });
    });
    if (!list.length) return;
    if (!KF.store.addMany(list)) KF.app.warn(t('storageFull'));
    $('handAddMsg').textContent = t('handAdded', { n: list.length, c: Object.keys(chars).length });
    $('handAdd').disabled = true;
  }

  function init() {
    $('handFile').onchange = function () {
      var f = this.files[0];
      this.value = '';
      if (f) open(f);
    };
    $('handAdd').onclick = add;
    var key = $('aiKey');
    key.value = KF.store.setting('apiKey') || '';
    key.addEventListener('change', function () { KF.store.setting('apiKey', key.value.trim()); });
    initPrep();
  }

  KF.handui = { init: init };
})(globalThis.KF = globalThis.KF || {});
