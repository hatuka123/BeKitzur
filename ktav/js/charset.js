// Character set, glyph-box geometry and per-character sizing hints.
(function (KF) {
  'use strict';

  // The glyph box. Every glyph bitmap (drawn, photographed or cut from the
  // printed sheet) is a CANVAS x CANVAS square covering 1200 font units:
  // y = +900 at the top edge, 0 at the baseline, -300 at the bottom edge.
  var G = {
    CANVAS: 480,
    UPM: 1000,
    UNITS_PER_PX: 2.5,
    BASE_PX: 360,
    ASCENT: 900,
    DESCENT: 300,
    CAP: 700,
    XH: 480,
    HEB: 620,
    DESC: -220,
  };
  G.pxY = function (units) { return G.BASE_PX - units / G.UNITS_PER_PX; };

  var HEBREW = 'אבגדהוזחטיכלמנסעפצקרשת';
  var FINALS = 'ךםןףץ';
  var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var LOWER = 'abcdefghijklmnopqrstuvwxyz';
  var DIGITS = '0123456789';
  var PUNCT = '.,!?-\'"():;/@&+=₪';

  var GROUPS = [
    { id: 'hebrew', chars: HEBREW + FINALS, guides: 'hebrew' },
    { id: 'upper', chars: UPPER, guides: 'latin' },
    { id: 'lower', chars: LOWER, guides: 'latin' },
    { id: 'digits', chars: DIGITS, guides: 'latin' },
    { id: 'punct', chars: PUNCT, guides: 'latin' },
  ];

  // Pages of the printable sheet: 6 x 7 cells each.
  var PAGES = [
    { id: 'hebrew', chars: HEBREW + FINALS },
    { id: 'upper', chars: UPPER + DIGITS },
    { id: 'lower', chars: LOWER + PUNCT },
  ];

  var ALL = GROUPS.map(function (g) { return g.chars; }).join('');

  function groupOf(ch) {
    for (var i = 0; i < GROUPS.length; i++) {
      if (GROUPS[i].chars.indexOf(ch) >= 0) return GROUPS[i];
    }
    return GROUPS[GROUPS.length - 1];
  }

  // Where a character normally sits, in font units: [bottom, top, maxWidth].
  // Used to place a photographed single letter in the glyph box.
  function sizeHint(ch) {
    if (FINALS.indexOf(ch) >= 0 || ch === 'ק') return [G.DESC, G.HEB, 600];
    if (ch === 'ל') return [0, 820, 600];
    if (ch === 'י') return [320, G.HEB, 250];
    if (HEBREW.indexOf(ch) >= 0) return [0, G.HEB, 650];
    if (UPPER.indexOf(ch) >= 0 || DIGITS.indexOf(ch) >= 0) return [0, G.CAP, 750];
    if ('bdfhklt'.indexOf(ch) >= 0) return [0, G.CAP, 550];
    if ('gjpqy'.indexOf(ch) >= 0) return [G.DESC, G.XH, 550];
    if (LOWER.indexOf(ch) >= 0) return [0, G.XH, 650];
    switch (ch) {
      case '.': return [0, 90, 90];
      case ',': return [-150, 100, 100];
      case '-': return [230, 300, 300];
      case '=': return [150, 400, 400];
      case '+': return [80, 520, 450];
      case '\'': return [450, G.CAP, 120];
      case '"': return [450, G.CAP, 250];
      case ':': return [0, G.XH, 100];
      case ';': return [-150, G.XH, 120];
      case '(': case ')': return [-150, 780, 250];
      case '/': return [-100, 750, 400];
      case '@': return [-150, 650, 750];
      default: return [0, G.CAP, 650];
    }
  }

  KF.G = G;
  KF.charset = {
    GROUPS: GROUPS, PAGES: PAGES, ALL: ALL, groupOf: groupOf, sizeHint: sizeHint,
    UPPER: UPPER, LOWER: LOWER,
  };
})(globalThis.KF = globalThis.KF || {});
