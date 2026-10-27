// Photo of a printed sheet -> glyph bitmaps: find the corner markers, map the
// page with a homography, and cut out each writing box.
(function (KF) {
  'use strict';

  var MAX = 2400;

  // image -> { lum: Float32Array (0..1), w, h } at most MAX px on a side
  function toGray(img) {
    var k = Math.min(1, MAX / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    var w = Math.round((img.naturalWidth || img.width) * k), h = Math.round((img.naturalHeight || img.height) * k);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var d = ctx.getImageData(0, 0, w, h).data, lum = new Float32Array(w * h);
    for (var i = 0; i < lum.length; i++) {
      lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    }
    return { lum: lum, w: w, h: h, canvas: c };
  }

  function otsu(vals) {
    var hist = new Float64Array(256), n = vals.length, i;
    for (i = 0; i < n; i++) hist[Math.min(255, (vals[i] * 255) | 0)]++;
    var sum = 0;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 0, thr = 128;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = n - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i; }
    }
    return thr / 255;
  }

  function percentile(vals, p) {
    var hist = new Uint32Array(256), i, n = 0, want = vals.length * p;
    for (i = 0; i < vals.length; i++) hist[Math.min(255, (vals[i] * 255) | 0)]++;
    for (i = 0; i < 256; i++) { n += hist[i]; if (n >= want) break; }
    return (i + 0.5) / 255;
  }

  function sample(g, x, y) {
    if (x < 0 || y < 0 || x > g.w - 1 || y > g.h - 1) return 1;
    var x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, g.w - 1), y1 = Math.min(y0 + 1, g.h - 1);
    var fx = x - x0, fy = y - y0, L = g.lum, w = g.w;
    return (L[y0 * w + x0] * (1 - fx) + L[y0 * w + x1] * fx) * (1 - fy) +
      (L[y1 * w + x0] * (1 - fx) + L[y1 * w + x1] * fx) * fy;
  }

  function quadArea(q) {
    var s = 0;
    for (var i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s / 2);
  }

  // Order 4 points clockwise on screen, starting top-left.
  function order(pts) {
    var cx = 0, cy = 0;
    pts.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    var s = pts.slice().sort(function (a, b) {
      return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx);
    });
    var tl = 0;
    s.forEach(function (p, i) { if (p[0] + p[1] < s[tl][0] + s[tl][1]) tl = i; });
    return s.slice(tl).concat(s.slice(0, tl));
  }

  function isConvex(q) {
    var sign = 0;
    for (var i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      var z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (!sign) sign = Math.sign(z);
      else if (Math.sign(z) !== sign) return false;
    }
    return true;
  }

  // Find the four corner markers. Returns [TL, TR, BR, BL] in g's pixels, or null.
  function detect(g) {
    var k = Math.min(1, 900 / Math.max(g.w, g.h));
    var w = Math.round(g.w * k), h = Math.round(g.h * k), small = new Float32Array(w * h), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) small[y * w + x] = sample(g, x / k, y / k);
    var thr = otsu(small);
    var label = new Int32Array(w * h), comps = [], stack = [];
    for (var i0 = 0; i0 < w * h; i0++) {
      if (label[i0] || small[i0] >= thr) continue;
      var id = comps.length + 1, n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      label[i0] = id;
      stack.push(i0);
      while (stack.length) {
        var i = stack.pop();
        x = i % w; y = (i / w) | 0;
        n++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        var nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
        for (var j = 0; j < 4; j++) {
          var q = nb[j];
          if (q >= 0 && !label[q] && small[q] < thr) { label[q] = id; stack.push(q); }
        }
      }
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      comps.push({ n: n, cx: sx / n, cy: sy / n, fill: n / (bw * bh), aspect: bw / bh });
    }
    var cands = comps.filter(function (c) {
      return c.n >= w * h * 0.00015 && c.fill > 0.45 && c.aspect > 0.4 && c.aspect < 2.5;
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 12);

    var best = null, bestA = 0, m = cands.length;
    for (var a = 0; a < m; a++) for (var b = a + 1; b < m; b++) for (var c = b + 1; c < m; c++) for (var d = c + 1; d < m; d++) {
      var set = [cands[a], cands[b], cands[c], cands[d]];
      var ns = set.map(function (s) { return s.n; });
      if (Math.max.apply(null, ns) > 3.5 * Math.min.apply(null, ns)) continue;
      var q = order(set.map(function (s) { return [s.cx, s.cy]; }));
      if (!isConvex(q)) continue;
      var ar = quadArea(q);
      if (ar > bestA) { bestA = ar; best = q; }
    }
    if (!best || bestA < w * h * 0.1) return null;
    return orient(g, best.map(function (p) { return [(p[0] + 0.5) / k, (p[1] + 0.5) / k]; }));
  }

  // Rotate the corner order so the corner with the small key square comes first.
  function orient(g, q) {
    var S = KF.sheet.S, f = (S.KEY[0] - S.MARKS[0][0]) / (S.MARKS[1][0] - S.MARKS[0][0]);
    var dark = q.map(function (p, i) {
      var n = q[(i + 1) % 4], x = p[0] + (n[0] - p[0]) * f, y = p[1] + (n[1] - p[1]) * f, s = 0;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) s += sample(g, x + dx, y + dy);
      return s;
    });
    var i = dark.indexOf(Math.min.apply(null, dark));
    return q.slice(i).concat(q.slice(0, i));
  }

  // 3x3 homography (row-major, h33 = 1) mapping src points onto dst points.
  function homography(src, dst) {
    var A = [], i, j, r;
    for (i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (i = 0; i < 8; i++) {
      var p = i;
      for (r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      var tmp = A[i]; A[i] = A[p]; A[p] = tmp;
      for (r = 0; r < 8; r++) {
        if (r === i) continue;
        var f = A[r][i] / A[i][i];
        for (j = i; j < 9; j++) A[r][j] -= f * A[i][j];
      }
    }
    var h = [];
    for (i = 0; i < 8; i++) h.push(A[i][8] / A[i][i]);
    h.push(1);
    return h;
  }

  function project(h, x, y) {
    var z = h[6] * x + h[7] * y + h[8];
    return [(h[0] * x + h[1] * y + h[2]) / z, (h[3] * x + h[4] * y + h[5]) / z];
  }

  // Cut every box of `page` out of the photo. corners: [TL, TR, BR, BL].
  // Returns [{ ch, rgba }] for boxes that contain writing.
  function extract(g, corners, page) {
    var S = KF.sheet.S, N = KF.G.CANVAS, H = homography(S.MARKS, corners);
    var chars = KF.charset.PAGES[page].chars.split(''), out = [];
    var lum = new Float32Array(N * N), margin = 10;
    chars.forEach(function (ch, idx) {
      var b = KF.sheet.boxAt(page, idx), step = S.BOX / N, x, y, i;
      for (y = 0; y < N; y++) {
        for (x = 0; x < N; x++) {
          var p = project(H, b[0] + (x + 0.5) * step, b[1] + (y + 0.5) * step);
          lum[y * N + x] = sample(g, p[0], p[1]);
        }
      }
      var paper = Math.max(0.15, percentile(lum, 0.9));
      var rgba = new Uint8ClampedArray(N * N * 4), ink = 0;
      for (y = margin; y < N - margin; y++) {
        for (x = margin; x < N - margin; x++) {
          i = y * N + x;
          var a = (0.66 * paper - lum[i]) / (0.22 * paper);
          rgba[i * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
        }
      }
      // A printed guide line that came out dark spans the whole box: drop it.
      for (y = 0; y < N; y++) {
        var run = 0;
        for (x = 0; x < N; x++) if (rgba[(y * N + x) * 4 + 3] > 128) run++;
        if (run > (N - 2 * margin) * 0.8) for (x = 0; x < N; x++) rgba[(y * N + x) * 4 + 3] = 0;
      }
      for (i = 0; i < N * N; i++) if (rgba[i * 4 + 3] > 128) ink++;
      if (ink >= 60) out.push({ ch: ch, rgba: rgba });
    });
    return out;
  }

  // A photo of one letter -> glyph bitmap, scaled to where that letter sits.
  function singleLetter(img, ch) {
    var g = toGray(img), N = KF.G.CANVAS, G = KF.G;
    var thr = otsu(g.lum), x, y, i;
    var paper = Math.max(0.15, percentile(g.lum, 0.9));
    var cut = Math.min(thr, paper * 0.7);
    var bx0 = g.w, by0 = g.h, bx1 = -1, by1 = -1;
    for (y = 0; y < g.h; y++) {
      for (x = 0; x < g.w; x++) {
        if (g.lum[y * g.w + x] < cut) {
          if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        }
      }
    }
    if (bx1 < 0) return null;
    var hint = KF.charset.sizeHint(ch);
    var tH = (hint[1] - hint[0]) / G.UNITS_PER_PX, tW = hint[2] / G.UNITS_PER_PX;
    var k = Math.min(tH / (by1 - by0 + 1), tW / (bx1 - bx0 + 1));
    var ox = N / 2 - (bx0 + bx1) / 2 * k, oy = G.pxY(hint[0]) - (by1 + 1) * k;
    var rgba = new Uint8ClampedArray(N * N * 4);
    for (y = 0; y < N; y++) {
      for (x = 0; x < N; x++) {
        var l = sample(g, (x + 0.5 - ox) / k, (y + 0.5 - oy) / k);
        var a = (cut * 1.05 - l) / (cut * 0.35);
        i = (y * N + x) * 4;
        rgba[i + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
      }
    }
    return rgba;
  }

  KF.scan = { toGray: toGray, detect: detect, extract: extract, singleLetter: singleLetter, homography: homography, project: project };
})(globalThis.KF = globalThis.KF || {});
