// Bitmap -> TrueType outlines.
//
// The 480 px glyph bitmap is averaged down to 240 px, blurred once, and
// traced with marching squares. Each contour is simplified (Douglas-Peucker)
// and written as TrueType quadratic points: smooth vertices become off-curve
// points (TrueType implies the on-curve midpoints between them), sharp
// corners stay on-curve.
(function (KF) {
  'use strict';

  var F = 2; // downsample factor

  // rgba: RGBA bytes of a CANVAS x CANVAS image; ink = alpha channel.
  function inkGrid(rgba, size) {
    var n = size / F, a = new Float32Array(n * n);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        a[((y / F) | 0) * n + ((x / F) | 0)] += rgba[(y * size + x) * 4 + 3];
      }
    }
    var k = 1 / (255 * F * F);
    for (var i = 0; i < a.length; i++) a[i] *= k;
    return { a: a, n: n };
  }

  function blur(a, n) {
    var t = new Float32Array(a.length), o = new Float32Array(a.length), x, y, i;
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) {
        i = y * n + x;
        t[i] = (a[i] * 2 + (x > 0 ? a[i - 1] : 0) + (x < n - 1 ? a[i + 1] : 0)) / 4;
      }
    }
    for (y = 0; y < n; y++) {
      for (x = 0; x < n; x++) {
        i = y * n + x;
        o[i] = (t[i] * 2 + (y > 0 ? t[i - n] : 0) + (y < n - 1 ? t[i + n] : 0)) / 4;
      }
    }
    return o;
  }

  // Marching squares over pixel centres, padded with an empty border so every
  // contour closes. Returns loops of [x, y] in pixel space (y down); filled
  // shapes and holes come out with opposite winding.
  function march(a, n, iso) {
    var W = n + 2;
    function v(x, y) { return x < 0 || y < 0 || x >= n || y >= n ? 0 : a[y * n + x]; }
    var next = new Map(), pts = new Map();

    function edgePoint(key, ax, ay, bx, by) {
      if (!pts.has(key)) {
        var va = v(ax, ay), vb = v(bx, by), t = (iso - va) / (vb - va);
        pts.set(key, [ax + 0.5 + (bx - ax) * t, ay + 0.5 + (by - ay) * t]);
      }
      return key;
    }

    var cx = [0, 1, 1, 0], cy = [0, 0, 1, 1];
    for (var gy = -1; gy < n; gy++) {
      for (var gx = -1; gx < n; gx++) {
        var vals = [v(gx, gy), v(gx + 1, gy), v(gx + 1, gy + 1), v(gx, gy + 1)];
        var ins = vals.map(function (q) { return q >= iso; });
        if (ins[0] === ins[1] && ins[1] === ins[2] && ins[2] === ins[3]) continue;
        var base = (gy + 1) * W + (gx + 1);
        // Edge keys, clockwise on screen: top, right, bottom, left.
        var keys = [base * 2, (base + 1) * 2 + 1, (base + W) * 2, base * 2 + 1];
        var cross = [];
        for (var k = 0; k < 4; k++) {
          var k2 = (k + 1) % 4;
          if (ins[k] === ins[k2]) continue;
          edgePoint(keys[k], gx + cx[k], gy + cy[k], gx + cx[k2], gy + cy[k2]);
          cross.push({ key: keys[k], entry: !ins[k] });
        }
        var centre = (vals[0] + vals[1] + vals[2] + vals[3]) / 4 >= iso;
        var m = cross.length;
        for (var c = 0; c < m; c++) {
          if (!cross[c].entry) continue;
          // Saddle: join the filled corners through the centre, or keep apart.
          var step = centre && m === 4 ? m - 1 : 1;
          var j = (c + step) % m;
          next.set(cross[c].key, cross[j].key);
        }
      }
    }

    var loops = [], seen = new Set();
    next.forEach(function (_, start) {
      if (seen.has(start)) return;
      var loop = [], k = start;
      while (!seen.has(k)) {
        seen.add(k);
        loop.push(pts.get(k));
        k = next.get(k);
      }
      loops.push(loop);
    });
    return loops;
  }

  function area(p) {
    var s = 0;
    for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
      s += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
    }
    return s / 2;
  }

  function rdp(p, a, b, tol, out) {
    var ax = p[a][0], ay = p[a][1], dx = p[b][0] - ax, dy = p[b][1] - ay;
    var len = Math.hypot(dx, dy) || 1e-9, best = -1, bi = -1;
    for (var i = a + 1; i < b; i++) {
      var d = Math.abs((p[i][0] - ax) * dy - (p[i][1] - ay) * dx) / len;
      if (d > best) { best = d; bi = i; }
    }
    if (best > tol) {
      rdp(p, a, bi, tol, out);
      rdp(p, bi, b, tol, out);
    } else {
      out.push(p[b]);
    }
  }

  function simplify(loop, tol) {
    var far = 0, fd = -1;
    for (var i = 1; i < loop.length; i++) {
      var d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
      if (d > fd) { fd = d; far = i; }
    }
    var p = loop.concat([loop[0]]), out = [];
    rdp(p, 0, far, tol, out);
    rdp(p, far, p.length - 1, tol, out);
    return out; // closed: last point equals loop[0]; drop nothing, it is unique
  }

  // Mark each vertex on-curve (corner) or off-curve (smooth).
  function toQuadPoints(poly) {
    var n = poly.length, out = [];
    for (var i = 0; i < n; i++) {
      var p = poly[(i + n - 1) % n], c = poly[i], q = poly[(i + 1) % n];
      var ax = c[0] - p[0], ay = c[1] - p[1], bx = q[0] - c[0], by = q[1] - c[1];
      var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      var turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb || 1))));
      var corner = turn > 0.75 || (turn > 0.35 && Math.min(la, lb) > 12);
      out.push({ x: c[0], y: c[1], on: corner });
    }
    return out;
  }

  // Trace one glyph bitmap. weight: -2 (thinner) .. +2 (bolder).
  // Returns contours in font units ({x, y, on}), y up, baseline at 0.
  function traceGlyph(rgba, size, weight) {
    var g = inkGrid(rgba, size);
    var a = blur(g.a, g.n);
    var iso = 0.5 - (weight || 0) * 0.1;
    var s = KF.G.UNITS_PER_PX * F, base = KF.G.BASE_PX / F;
    var contours = [];
    march(a, g.n, iso).forEach(function (loop) {
      if (loop.length < 4 || Math.abs(area(loop)) < 3) return; // dust
      var poly = simplify(loop, 0.45);
      if (poly.length < 3) return;
      var pts = toQuadPoints(poly).map(function (q) {
        return { x: Math.round(q.x * s), y: Math.round((base - q.y) * s), on: q.on };
      });
      // drop repeated points produced by rounding
      pts = pts.filter(function (q, i) {
        var r = pts[(i + 1) % pts.length];
        return q.x !== r.x || q.y !== r.y;
      });
      if (pts.length >= 3) contours.push(pts);
    });
    return contours;
  }

  KF.trace = { traceGlyph: traceGlyph, march: march, area: area };
})(globalThis.KF = globalThis.KF || {});
