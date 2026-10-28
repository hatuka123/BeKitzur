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
      d.className = 'hwcell' + (usable(gl) ? '' : ' off');
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
        var r = KF.hand.align(page, L, l.text);
        l.glyphs = r.glyphs;
        l.exact = r.exact;
        renderCells(l);
      };
      div.append(strip, inp, warn, cells);
      root.appendChild(div);
      renderCells(l);
    });
  }

  function open(file) {
    $('handMsg').textContent = t('handWorking');
    $('handWork').hidden = true;
    var url = URL.createObjectURL(file);
    KF.app.loadImage(url).then(function (img) {
      URL.revokeObjectURL(url);
      return new Promise(function (r) { setTimeout(r, 30); }).then(function () {
        return ownTemplates().then(function (own) { return [img, own]; });
      });
    }).then(function (e) {
      page = KF.hand.segment(KF.scan.toGray(e[0]));
      var templates = e[1].concat(KF.hand.printedTemplates());
      lines = page.lines.map(function (L) {
        var guess = KF.hand.guessLine(page, L, templates);
        var r = KF.hand.align(page, L, guess);
        return { line: L, text: guess, glyphs: r.glyphs, exact: r.exact };
      });
      if (!lines.length) { $('handMsg').textContent = t('handNone'); return; }
      $('handMsg').textContent = t('handFound', { n: lines.length });
      $('handWork').hidden = false;
      $('handAddMsg').textContent = '';
      render();
    }).catch(function () { $('handMsg').textContent = t('handNone'); });
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
  }

  KF.handui = { init: init };
})(globalThis.KF = globalThis.KF || {});
