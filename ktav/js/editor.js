// The glyph editor: draw with mouse / finger / stylus, erase, undo, nudge,
// or replace the letter with a photo.
(function (KF) {
  'use strict';

  var N, dlg, back, ink, ctx, chars, cur = -1, dirty = false;
  var undo = [], tool = 'pen', drawing = null;
  var $ = function (id) { return document.getElementById(id); };

  function init() {
    N = KF.G.CANVAS;
    dlg = $('editor'); back = $('edBack'); ink = $('edInk');
    ctx = ink.getContext('2d');
    chars = KF.charset.ALL.split('');

    $('edClose').onclick = function () { dlg.close(); };
    dlg.addEventListener('close', function () { save(); cur = -1; });
    $('edPrev').onclick = function () { go(-1); };
    $('edNext').onclick = function () { go(1); };
    $('edPen').onclick = function () { setTool('pen'); };
    $('edEraser').onclick = function () { setTool('eraser'); };
    $('edUndo').onclick = doUndo;
    $('edClear').onclick = function () { snapshot(); ctx.clearRect(0, 0, N, N); dirty = true; };
    $('edGhost').onchange = function () { KF.store.setting('ghost', this.checked); drawBack(); };
    $('edSize').oninput = function () { KF.store.setting('pen', +this.value); };
    var ghost = KF.store.setting('ghost'), pen = KF.store.setting('pen');
    if (ghost === false) $('edGhost').checked = false;
    if (pen) $('edSize').value = pen;
    document.querySelectorAll('[data-move]').forEach(function (b) {
      b.onclick = function () { var d = b.dataset.move.split(',').map(Number); transform(d[0], d[1], 1); };
    });
    document.querySelectorAll('[data-scale]').forEach(function (b) {
      b.onclick = function () { transform(0, 0, +b.dataset.scale); };
    });
    $('edPhoto').onchange = function () {
      var f = this.files[0];
      this.value = '';
      if (f) photo(f);
    };
    dlg.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    });

    ink.addEventListener('pointerdown', down);
    ink.addEventListener('pointermove', move);
    ink.addEventListener('pointerup', up);
    ink.addEventListener('pointercancel', up);
  }

  function setTool(t) {
    tool = t;
    $('edPen').classList.toggle('on', t === 'pen');
    $('edEraser').classList.toggle('on', t === 'eraser');
  }

  function drawBack() {
    var b = back.getContext('2d'), ch = chars[cur], grp = KF.charset.groupOf(ch);
    b.clearRect(0, 0, N, N);
    b.fillStyle = '#fff';
    b.fillRect(0, 0, N, N);
    if ($('edGhost').checked) {
      b.fillStyle = '#eef1f4';
      b.font = '380px sans-serif';
      b.textAlign = 'center';
      b.textBaseline = 'alphabetic';
      b.fillText(ch, N / 2, KF.G.BASE_PX);
    }
    KF.sheet.drawGuides(b, 0, 0, N, grp.guides, 1.5);
  }

  function open(ch) {
    if (!dlg.open) dlg.showModal();
    load(chars.indexOf(ch));
  }

  function load(i) {
    cur = i;
    undo = [];
    dirty = false;
    var ch = chars[cur];
    $('edChar').textContent = ch;
    var rtl = KF.i18n.lang === 'he';
    $('edPrev').textContent = rtl ? '›' : '‹';
    $('edNext').textContent = rtl ? '‹' : '›';
    drawBack();
    ctx.clearRect(0, 0, N, N);
    var url = KF.store.get(ch);
    if (url) {
      var img = new Image();
      img.onload = function () { if (chars[cur] === ch) ctx.drawImage(img, 0, 0); };
      img.src = url;
    }
  }

  function go(d) {
    save();
    load((cur + d + chars.length) % chars.length);
  }

  function isEmpty() {
    var d = ctx.getImageData(0, 0, N, N).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] > 40) return false;
    return true;
  }

  function save() {
    if (cur < 0 || !dirty) return;
    dirty = false;
    var ok = KF.store.set(chars[cur], isEmpty() ? null : ink.toDataURL('image/png'));
    if (!ok) KF.app.warn(KF.i18n.t('storageFull'));
  }

  function snapshot() {
    undo.push(ctx.getImageData(0, 0, N, N));
    if (undo.length > 40) undo.shift();
  }

  function doUndo() {
    if (!undo.length) return;
    ctx.putImageData(undo.pop(), 0, 0);
    dirty = true;
  }

  function pos(e) {
    var r = ink.getBoundingClientRect();
    return [(e.clientX - r.left) * N / r.width, (e.clientY - r.top) * N / r.height];
  }

  function width(e) {
    var s = +$('edSize').value;
    return e.pointerType === 'pen' && e.pressure > 0 ? s * (0.35 + e.pressure * 1.3) : s;
  }

  function stroke(a, b, w) {
    ctx.save();
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = tool === 'eraser' ? w * 2 : w;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0] + 0.01, b[1]);
    ctx.stroke();
    ctx.restore();
  }

  function down(e) {
    if (e.button > 0) return;
    e.preventDefault();
    ink.setPointerCapture(e.pointerId);
    snapshot();
    var p = pos(e);
    drawing = { id: e.pointerId, last: p };
    stroke(p, p, width(e));
    dirty = true;
  }

  function move(e) {
    if (!drawing || e.pointerId !== drawing.id) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    evs.forEach(function (ev) {
      var p = pos(ev);
      stroke(drawing.last, p, width(ev));
      drawing.last = p;
    });
  }

  function up(e) {
    if (drawing && e.pointerId === drawing.id) drawing = null;
  }

  function inkBox() {
    var d = ctx.getImageData(0, 0, N, N).data, x0 = N, y0 = N, x1 = -1, y1 = -1;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        if (d[(y * N + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }

  // Move by (dx, dy) and scale by k around the bottom centre of the ink.
  function transform(dx, dy, k) {
    var box = inkBox();
    if (!box) return;
    snapshot();
    var tmp = document.createElement('canvas');
    tmp.width = tmp.height = N;
    tmp.getContext('2d').drawImage(ink, 0, 0);
    var cx = (box[0] + box[2]) / 2, cy = box[3];
    ctx.clearRect(0, 0, N, N);
    ctx.save();
    ctx.translate(cx + dx, cy + dy);
    ctx.scale(k, k);
    ctx.translate(-cx, -cy);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    dirty = true;
  }

  function photo(file) {
    var img = new Image(), url = URL.createObjectURL(file), ch = chars[cur];
    img.onload = function () {
      URL.revokeObjectURL(url);
      var rgba = KF.scan.singleLetter(img, ch);
      if (!rgba || chars[cur] !== ch) return;
      snapshot();
      ctx.putImageData(new ImageData(rgba, N, N), 0, 0);
      dirty = true;
    };
    img.src = url;
  }

  KF.editor = { init: init, open: open };
})(globalThis.KF = globalThis.KF || {});
