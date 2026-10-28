// The "write" tab: type with the font you made, save or share it as a picture.
(function (KF) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, v) { return KF.i18n.t(k, v); };
  var family = null, stale = true, n = 0, pending = null;

  // Build the font if letters changed since the last build.
  function ensureFont() {
    if (!stale && family) return Promise.resolve(family);
    if (pending) return pending;
    pending = KF.app.build($('wMsg')).then(function (res) {
      var name = 'KtavWrite' + (++n);
      return new FontFace(name, res.bytes.buffer).load().then(function (f) {
        document.fonts.add(f);
        family = name;
        stale = false;
        $('wMsg').textContent = '';
        style();
        return name;
      });
    }).finally(function () { pending = null; });
    return pending;
  }

  function style() {
    var ta = $('wText');
    ta.style.fontFamily = family ? '"' + family + '", sans-serif' : '';
    ta.style.fontSize = $('wSize').value + 'px';
    ta.style.color = $('wColor').value;
    ta.classList.toggle('lined', $('wLines').checked);
  }

  function wrap(ctx, para, maxW) {
    var out = [], line = '';
    para.split(/(\s+)/).forEach(function (w) {
      var next = line + w;
      if (line && ctx.measureText(next.trimEnd()).width > maxW) { out.push(line.trimEnd()); line = w.trimStart(); }
      else line = next;
    });
    out.push(line.trimEnd());
    return out;
  }

  function image() {
    ensureFont().then(function (fam) {
      var text = $('wText').value || ' ', px = +$('wSize').value * 2, lh = Math.round(px * 1.5);
      var W = 1080, pad = 72, c = document.createElement('canvas'), ctx = c.getContext('2d');
      ctx.font = px + 'px "' + fam + '"';
      var rows = [];
      text.split('\n').forEach(function (p) {
        var rtl = KF.hand.isRtlText(p);
        ctx.direction = rtl ? 'rtl' : 'ltr';
        wrap(ctx, p, W - pad * 2).forEach(function (s) { rows.push({ s: s, rtl: rtl }); });
      });
      c.width = W;
      c.height = pad * 2 + rows.length * lh;
      ctx = c.getContext('2d');
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(0, 0, c.width, c.height);
      if ($('wLines').checked) {
        ctx.strokeStyle = '#cfe3f3';
        ctx.lineWidth = 2;
        for (var y = pad + lh * 0.8; y < c.height - pad / 2; y += lh) {
          ctx.beginPath(); ctx.moveTo(pad / 2, y + px * 0.08); ctx.lineTo(W - pad / 2, y + px * 0.08); ctx.stroke();
        }
      }
      ctx.font = px + 'px "' + fam + '"';
      ctx.fillStyle = $('wColor').value;
      ctx.textBaseline = 'alphabetic';
      rows.forEach(function (r, i) {
        ctx.direction = r.rtl ? 'rtl' : 'ltr';
        ctx.textAlign = r.rtl ? 'right' : 'left';
        ctx.fillText(r.s, r.rtl ? W - pad : pad, pad + lh * 0.8 + i * lh);
      });
      c.toBlob(function (b) { KF.app.download(b, 'ktav-text.png'); });
    }).catch(function () {});
  }

  function init() {
    var saved = KF.store.setting('wText');
    $('wText').value = saved != null ? saved : t('writeSample');
    ['wSize', 'wColor', 'wLines'].forEach(function (id) {
      var el = $(id), v = KF.store.setting(id);
      if (v != null) { if (el.type === 'checkbox') el.checked = v; else el.value = v; }
      el.addEventListener('input', function () {
        KF.store.setting(id, el.type === 'checkbox' ? el.checked : el.value);
        style();
      });
    });
    var timer = null;
    $('wText').addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { KF.store.setting('wText', $('wText').value); }, 400);
    });
    $('wImage').onclick = image;
    $('wClear').onclick = function () { $('wText').value = ''; KF.store.setting('wText', ''); };
    KF.store.onChange(function () { stale = true; });
    ['fName', 'fWeight', 'fSpacing', 'fWord', 'fCase', 'fVariants', 'fFill'].forEach(function (id) {
      $(id).addEventListener('change', function () { stale = true; });
    });
    style();
  }

  function show() { ensureFont().catch(function () {}); }

  KF.write = { init: init, show: show };
})(globalThis.KF = globalThis.KF || {});
