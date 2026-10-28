// Glyph bitmaps -> .ttf bytes.
(function (KF) {
  'use strict';

  var MAX_VARIANTS = 8;

  function notdef() {
    var o = [{ x: 60, y: 0, on: true }, { x: 60, y: 700, on: true },
      { x: 440, y: 700, on: true }, { x: 440, y: 0, on: true }];
    var i = [{ x: 110, y: 50, on: true }, { x: 390, y: 50, on: true },
      { x: 390, y: 650, on: true }, { x: 110, y: 650, on: true }];
    return { name: '.notdef', codes: [], advance: 500, contours: [o, i] };
  }

  function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'); }

  // Traced contours -> glyph with side bearings applied, or null if empty.
  function place(contours, side) {
    if (!contours.length) return null;
    var x0 = Infinity, x1 = -Infinity;
    contours.forEach(function (c) {
      c.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); });
    });
    var dx = side - x0;
    return {
      advance: Math.round(x1 - x0 + side * 2),
      contours: contours.map(function (c) {
        return c.map(function (p) { return { x: p.x + dx, y: p.y, on: p.on }; });
      }),
    };
  }

  // bitmaps: { char: [RGBA (CANVAS x CANVAS), ...] }, main form first.
  // opts: { family, weight (-2..2), spacing (side bearing, units),
  //         wordSpace (units), fillCase (true, or 'upper': only capitals
  //         from small letters), variants (bool) }
  function makeFont(bitmaps, opts) {
    var G = KF.G, cs = KF.charset;
    var src = {};
    Object.keys(bitmaps).forEach(function (ch) { if (bitmaps[ch].length) src[ch] = ch; });
    if (opts.fillCase) {
      for (var i = 0; i < cs.UPPER.length; i++) {
        var up = cs.UPPER[i], lo = cs.LOWER[i];
        if (!src[up] && src[lo]) src[up] = lo;
        if (opts.fillCase !== 'upper' && !src[lo] && src[up]) src[lo] = up;
      }
    }
    var side = opts.spacing != null ? opts.spacing : 50;
    var useAlts = opts.variants !== false;
    var glyphs = [notdef(), {
      name: 'space', codes: [0x20, 0xa0], advance: opts.wordSpace || 300, contours: [],
    }];
    var traced = {}, altQueue = [];

    function shapes(from) {
      if (!traced[from]) {
        var list = bitmaps[from].slice(0, useAlts ? MAX_VARIANTS : 1);
        traced[from] = list.map(function (bm) {
          return place(KF.trace.traceGlyph(bm, G.CANVAS, opts.weight || 0), side);
        }).filter(Boolean);
      }
      return traced[from];
    }

    cs.ALL.split('').forEach(function (ch) {
      if (!src[ch]) return;
      var forms = shapes(src[ch]);
      if (!forms.length) return;
      var gid = glyphs.length;
      glyphs.push({ name: 'uni' + hex(ch), codes: [ch.charCodeAt(0)], advance: forms[0].advance, contours: forms[0].contours });
      if (forms.length > 1) altQueue.push({ ch: ch, gid: gid, forms: forms.slice(1) });
    });

    var letters = [];
    for (var g = 2; g < glyphs.length; g++) letters.push(g);
    var alternates = altQueue.map(function (a) {
      var set = [a.gid];
      a.forms.forEach(function (f, k) {
        set.push(glyphs.length);
        glyphs.push({ name: 'uni' + hex(a.ch) + '.alt' + (k + 1), codes: [], advance: f.advance, contours: f.contours });
      });
      return set;
    });

    var bytes = KF.ttf.build({ family: opts.family, glyphs: glyphs, alternates: alternates });
    return { bytes: bytes, count: letters.length, alternates: glyphs.length - 2 - letters.length };
  }

  function cleanFamily(name) {
    var s = String(name || '').replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    return s.slice(0, 31) || 'My Handwriting';
  }

  KF.fontgen = { makeFont: makeFont, cleanFamily: cleanFamily, MAX_VARIANTS: MAX_VARIANTS };
})(globalThis.KF = globalThis.KF || {});
