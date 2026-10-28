// Estimates letters the user never wrote, in their style: a printed letter
// is scaled to their proportions, slanted like their writing, thinned to a
// centre line (Zhang-Suen) and redrawn with a round pen of their stroke width.
(function (KF) {
  'use strict';

  var N = KF.G.CANVAS, H = N / 2; // skeleton work at half size
  var HEB = /[א-ת]/;

  function median(a, dflt) {
    if (!a.length) return dflt;
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[s.length >> 1];
  }

  function box(alpha, n) {
    var x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (alpha(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : { x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // Shear of the ink: how far x moves per unit of height (positive leans right).
  function lean(alpha, n) {
    var sx = 0, sy = 0, c = 0, x, y;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (alpha(x, y)) { sx += x; sy += y; c++; }
    if (c < 20) return 0;
    var mx = sx / c, my = sy / c, cov = 0, vy = 0;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      if (alpha(x, y)) { cov += (x - mx) * (my - y); vy += (my - y) * (my - y); }
    }
    return vy ? cov / vy : 0;
  }

  var printedCache = {};
  // A printed letter in the glyph box, sat where it belongs (alpha array).
  function printed(ch) {
    if (printedCache[ch]) return printedCache[ch];
    var c = document.createElement('canvas');
    c.width = c.height = N;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.font = '300px sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    x.fillText(ch, N / 2, KF.G.BASE_PX);
    var d = x.getImageData(0, 0, N, N).data, a = new Uint8Array(N * N);
    for (var i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    return (printedCache[ch] = a);
  }

  // Style numbers from the user's letters: { stroke, slant, heightK, widthK }.
  function measure(bitmaps) {
    var strokes = [], leans = [], hk = { heb: [], lat: [] }, wk = [];
    Object.keys(bitmaps).forEach(function (ch) {
      var rgba = bitmaps[ch][0];
      if (!rgba) return;
      var on = function (x, y) { return rgba[(y * N + x) * 4 + 3] > 128; };
      var area = 0, edge = 0;
      for (var y = 1; y < N - 1; y++) for (var x = 1; x < N - 1; x++) {
        if (!on(x, y)) continue;
        area++;
        if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) edge++;
      }
      if (area < 50 || !edge) return;
      strokes.push(2 * area / edge);
      if (!/[א-תA-Za-z0-9]/.test(ch)) return;
      var p = printed(ch), pon = function (x2, y2) { return p[y2 * N + x2] > 128; };
      var ub = box(on, N), pb = box(pon, N);
      if (!ub || !pb) return;
      leans.push(lean(on, N) - lean(pon, N));
      var hint = KF.charset.sizeHint(ch), want = (hint[1] - hint[0]) / KF.G.UNITS_PER_PX;
      (HEB.test(ch) ? hk.heb : hk.lat).push(ub.h / want);
      wk.push((ub.w / ub.h) / (pb.w / pb.h));
    });
    var heb = median(hk.heb, null), lat = median(hk.lat, null);
    return {
      stroke: Math.max(4, Math.min(40, median(strokes, 14))),
      slant: Math.max(-0.5, Math.min(0.5, median(leans, 0))),
      heightK: { heb: heb || lat || 1, lat: lat || heb || 1 },
      widthK: Math.max(0.6, Math.min(1.6, median(wk, 1))),
    };
  }

  // Zhang-Suen thinning on a binary image (Uint8Array, 1 = ink), in place.
  function thin(b, w, h) {
    var del = [], changed = true;
    function p(x, y) { return x < 0 || y < 0 || x >= w || y >= h ? 0 : b[y * w + x]; }
    for (var pass = 0; changed && pass < 100; pass++) {
      changed = false;
      for (var step = 0; step < 2; step++) {
        del.length = 0;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
          if (!b[y * w + x]) continue;
          var n = [p(x, y - 1), p(x + 1, y - 1), p(x + 1, y), p(x + 1, y + 1), p(x, y + 1), p(x - 1, y + 1), p(x - 1, y), p(x - 1, y - 1)];
          var B = n[0] + n[1] + n[2] + n[3] + n[4] + n[5] + n[6] + n[7];
          if (B < 2 || B > 6) continue;
          var A = 0;
          for (var k = 0; k < 8; k++) if (!n[k] && n[(k + 1) % 8]) A++;
          if (A !== 1) continue;
          if (step === 0 ? (n[0] * n[2] * n[4] || n[2] * n[4] * n[6]) : (n[0] * n[2] * n[6] || n[0] * n[4] * n[6])) continue;
          del.push(y * w + x);
        }
        if (del.length) changed = true;
        for (var d = 0; d < del.length; d++) b[del[d]] = 0;
      }
    }
  }

  // Estimated RGBA bitmap for ch in the given style, or null.
  function make(ch, style) {
    var G = KF.G, src = printed(ch);
    var pon = function (x, y) { return src[y * N + x] > 128; };
    var pb = box(pon, N);
    if (!pb) return null;
    var hint = KF.charset.sizeHint(ch), k = HEB.test(ch) ? style.heightK.heb : style.heightK.lat;
    var tH = (hint[1] - hint[0]) / G.UNITS_PER_PX * k;
    var sy = tH / pb.h, sx = sy * style.widthK;
    var bottom = G.pxY(hint[0]); // where the letter's lowest point goes

    // resample (scale + slant) at half size, binary
    var bin = new Uint8Array(H * H), cx = N / 2;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < H; x++) {
        var X = x * 2 + 1, Y = y * 2 + 1;
        var up = bottom - Y; // height above the letter's bottom
        var ux = (X - cx - style.slant * up) / sx + (pb.x0 + pb.x1) / 2;
        var uy = pb.y1 - up / sy;
        var ix = Math.round(ux), iy = Math.round(uy);
        if (ix >= 0 && iy >= 0 && ix < N && iy < N && src[iy * N + ix] > 128) bin[y * H + x] = 1;
      }
    }
    thin(bin, H, H);

    var c = document.createElement('canvas');
    c.width = c.height = N;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    var r = style.stroke / 2, seed = ch.charCodeAt(0);
    ctx.beginPath();
    for (y = 0; y < H; y++) {
      for (x = 0; x < H; x++) {
        if (!bin[y * H + x]) continue;
        var px = x * 2 + 1 + 1.6 * Math.sin(y * 0.09 + seed), py = y * 2 + 1 + 1.6 * Math.sin(x * 0.08 + seed * 1.7);
        ctx.moveTo(px + r, py);
        ctx.arc(px, py, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    return ctx.getImageData(0, 0, N, N).data;
  }

  KF.synth = { measure: measure, make: make };
})(globalThis.KF = globalThis.KF || {});
