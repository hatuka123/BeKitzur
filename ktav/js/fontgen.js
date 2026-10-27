// Glyph bitmaps -> .ttf bytes.
(function (KF) {
  'use strict';

  function notdef() {
    var o = [{ x: 60, y: 0, on: true }, { x: 60, y: 700, on: true },
      { x: 440, y: 700, on: true }, { x: 440, y: 0, on: true }];
    var i = [{ x: 110, y: 50, on: true }, { x: 390, y: 50, on: true },
      { x: 390, y: 650, on: true }, { x: 110, y: 650, on: true }];
    return { name: '.notdef', codes: [], advance: 500, contours: [o, i] };
  }

  // bitmaps: { char: Uint8ClampedArray RGBA (CANVAS x CANVAS) }
  // opts: { family, weight (-2..2), spacing (side bearing, units),
  //         wordSpace (units), fillCase (bool) }
  function makeFont(bitmaps, opts) {
    var G = KF.G, cs = KF.charset;
    var src = {};
    Object.keys(bitmaps).forEach(function (ch) { src[ch] = ch; });
    if (opts.fillCase) {
      for (var i = 0; i < cs.UPPER.length; i++) {
        var up = cs.UPPER[i], lo = cs.LOWER[i];
        if (!src[up] && src[lo]) src[up] = lo;
        if (!src[lo] && src[up]) src[lo] = up;
      }
    }
    var side = opts.spacing != null ? opts.spacing : 50;
    var glyphs = [notdef(), {
      name: 'space', codes: [0x20, 0xa0], advance: opts.wordSpace || 300, contours: [],
    }];
    var traced = {};
    var order = cs.ALL.split('').filter(function (ch) { return src[ch]; });
    order.forEach(function (ch) {
      var from = src[ch];
      if (!traced[from]) traced[from] = KF.trace.traceGlyph(bitmaps[from], G.CANVAS, opts.weight || 0);
      var contours = traced[from];
      if (!contours.length) return;
      var x0 = Infinity, x1 = -Infinity;
      contours.forEach(function (c) {
        c.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); });
      });
      var dx = side - x0;
      glyphs.push({
        name: 'uni' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'),
        codes: [ch.charCodeAt(0)],
        advance: Math.round(x1 - x0 + side * 2),
        contours: contours.map(function (c) {
          return c.map(function (p) { return { x: p.x + dx, y: p.y, on: p.on }; });
        }),
      });
    });
    var bytes = KF.ttf.build({ family: opts.family, glyphs: glyphs });
    return { bytes: bytes, count: glyphs.length - 2 };
  }

  function cleanFamily(name) {
    var s = String(name || '').replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    return s.slice(0, 31) || 'My Handwriting';
  }

  KF.fontgen = { makeFont: makeFont, cleanFamily: cleanFamily };
})(globalThis.KF = globalThis.KF || {});
