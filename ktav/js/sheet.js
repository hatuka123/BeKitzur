// The printable sheet (A4 at 300 dpi) and the guide lines shared with the
// editor. Each writing box maps 1:1 onto the glyph box, so a letter written
// on the sheet's baseline lands on the font's baseline.
(function (KF) {
  'use strict';

  var S = {
    W: 2480, H: 3508,
    MARK: 110,
    // marker centres, clockwise from top-left
    MARKS: [[180, 180], [2300, 180], [2300, 3328], [180, 3328]],
    // small square right of the top-left marker: tells which corner is which
    KEY: [330, 180], KEY_SIZE: 44,
    COLS: 6, ROWS: 7, BOX: 300, PX: 340, PY: 420, X0: 240, Y0: 330, LABEL: 70,
  };

  var GUIDE = '#bfe0f2';

  function guideLines(type) {
    var G = KF.G;
    if (type === 'hebrew') return [[G.HEB, [10, 8]], [0, null], [G.DESC, [3, 7]]];
    return [[G.CAP, [10, 8]], [G.XH, [10, 8]], [0, null], [G.DESC, [3, 7]]];
  }

  // Guides for a glyph box drawn at (x, y) with side `size`.
  function drawGuides(ctx, x, y, size, type, lw) {
    var k = size / KF.G.CANVAS;
    ctx.save();
    ctx.strokeStyle = GUIDE;
    guideLines(type).forEach(function (g) {
      var yy = y + KF.G.pxY(g[0]) * k;
      ctx.lineWidth = (g[1] ? 1 : 2) * lw;
      ctx.setLineDash(g[1] ? g[1].map(function (d) { return d * lw; }) : []);
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + size, yy);
      ctx.stroke();
    });
    ctx.restore();
  }

  // Top-left corner of writing box i on a page (Hebrew pages run right to left).
  function boxAt(page, i) {
    var col = i % S.COLS, row = Math.floor(i / S.COLS);
    if (KF.charset.PAGES[page].id === 'hebrew') col = S.COLS - 1 - col;
    return [S.X0 + col * S.PX, S.Y0 + row * S.PY + S.LABEL];
  }

  function renderPage(page) {
    var t = KF.i18n.t, p = KF.charset.PAGES[page];
    var c = document.createElement('canvas');
    c.width = S.W; c.height = S.H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, S.W, S.H);
    ctx.fillStyle = '#000';
    S.MARKS.forEach(function (m) {
      ctx.fillRect(m[0] - S.MARK / 2, m[1] - S.MARK / 2, S.MARK, S.MARK);
    });
    ctx.fillRect(S.KEY[0] - S.KEY_SIZE / 2, S.KEY[1] - S.KEY_SIZE / 2, S.KEY_SIZE, S.KEY_SIZE);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.font = '600 58px sans-serif';
    ctx.direction = KF.i18n.lang === 'he' ? 'rtl' : 'ltr';
    ctx.fillText(t('page') + ' ' + (page + 1) + ' ' + t('of') + ' ' + KF.charset.PAGES.length +
      ' · ' + t('g_' + p.id), S.W / 2, 200);

    p.chars.split('').forEach(function (ch, i) {
      var b = boxAt(page, i);
      ctx.fillStyle = '#555';
      ctx.font = '48px sans-serif';
      ctx.direction = 'ltr';
      ctx.fillText(ch, b[0] + S.BOX / 2, b[1] - 34);
      ctx.strokeStyle = '#cfd8df';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(b[0], b[1], S.BOX, S.BOX);
      drawGuides(ctx, b[0], b[1], S.BOX, p.id === 'hebrew' ? 'hebrew' : 'latin', 2);
    });
    return c;
  }

  KF.sheet = { S: S, boxAt: boxAt, renderPage: renderPage, drawGuides: drawGuides };
})(globalThis.KF = globalThis.KF || {});
