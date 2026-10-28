// Free handwriting photo -> lines -> letters, matched to the text the user
// confirms. There is no general handwriting OCR here: the app guesses each
// letter by comparing it with printed letters and with the user's own saved
// letters, then the user fixes the text and the letters are aligned to it.
(function (KF) {
  'use strict';

  var N = KF.G.CANVAS, FEAT = 20, REF = 600;
  var HEB = /[א-ת]/, LAT = /[A-Za-z]/, LTR = /[A-Za-z0-9]/;
  var MIRROR = { '(': ')', ')': '(' };

  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; });
    return s[s.length >> 1];
  }

  // ---- segmentation ----

  // Local-background threshold, so shadows across the page do not matter.
  function binarize(g) {
    var w = g.w, h = g.h, L = g.lum, W = w + 1, x, y;
    var I = new Float64Array(W * (h + 1));
    for (y = 0; y < h; y++) {
      var row = 0;
      for (x = 0; x < w; x++) {
        row += L[y * w + x];
        I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row;
      }
    }
    var r = Math.max(8, Math.round(Math.max(w, h) / 40));
    var mean = new Float32Array(w * h), ink = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
        var m = (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((y1 - y0) * (x1 - x0));
        var i = y * w + x;
        mean[i] = m;
        ink[i] = L[i] < m * 0.8 && m - L[i] > 0.07 ? 1 : 0;
      }
    }
    return { ink: ink, mean: mean };
  }

  // 8-connected components. Returns { label, comps }.
  function components(ink, w, h) {
    var label = new Int32Array(w * h), comps = [null], stack = [];
    for (var s = 0; s < w * h; s++) {
      if (!ink[s] || label[s]) continue;
      var id = comps.length, c = { id: id, x0: w, y0: h, x1: 0, y1: 0, n: 0 };
      label[s] = id;
      stack.push(s);
      while (stack.length) {
        var i = stack.pop(), x = i % w, y = (i / w) | 0;
        c.n++;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
        if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (var dy = -1; dy <= 1; dy++) {
          var yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (var dx = -1; dx <= 1; dx++) {
            var xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            var j = yy * w + xx;
            if (ink[j] && !label[j]) { label[j] = id; stack.push(j); }
          }
        }
      }
      c.x1++; c.y1++; // exclusive
      comps.push(c);
    }
    comps.shift();
    return { label: label, comps: comps };
  }

  function height(c) { return c.y1 - c.y0; }
  function width(c) { return c.x1 - c.x0; }
  function cx(c) { return (c.x0 + c.x1) / 2; }
  function cy(c) { return (c.y0 + c.y1) / 2; }

  // Remove ruled lines: horizontal ink runs far longer than a letter.
  function dropRules(ink, w, h, H) {
    var limit = Math.max(40, 5 * H), hit = false;
    for (var y = 0; y < h; y++) {
      var run = 0;
      for (var x = 0; x <= w; x++) {
        if (x < w && ink[y * w + x]) { run++; continue; }
        if (run > limit) { hit = true; for (var k = x - run; k < x; k++) ink[y * w + k] = 0; }
        run = 0;
      }
    }
    return hit;
  }

  function newGlyph(c) {
    return { members: [c.id], x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, clip: null, ch: '', off: false };
  }
  function absorb(gl, c) {
    gl.members.push(c.id);
    gl.x0 = Math.min(gl.x0, c.x0); gl.y0 = Math.min(gl.y0, c.y0);
    gl.x1 = Math.max(gl.x1, c.x1); gl.y1 = Math.max(gl.y1, c.y1);
  }
  function overlap(a0, a1, b0, b1) { return Math.min(a1, b1) - Math.max(a0, b0); }

  // g: gray image from KF.scan.toGray. Returns a page: { g, label, mean, lines }.
  function segment(g) {
    var w = g.w, h = g.h, b = binarize(g);
    var cc = components(b.ink, w, h);
    var H = median(cc.comps.filter(function (c) { return c.n >= 15; }).map(height)) || 20;
    if (dropRules(b.ink, w, h, H)) {
      cc = components(b.ink, w, h);
      H = median(cc.comps.filter(function (c) { return c.n >= 15; }).map(height)) || H;
    }
    var comps = cc.comps.filter(function (c) {
      var big = Math.max(width(c), height(c));
      if (big < Math.max(3, 0.1 * H)) return false; // dust
      if (height(c) > 4 * H || width(c) > 14 * H) return false; // shadows, edges
      if (c.x0 <= 1 || c.y0 <= 1 || c.x1 >= w - 1 || c.y1 >= h - 1) return false;
      return true;
    });
    var major = comps.filter(function (c) { return height(c) >= 0.4 * H; })
      .sort(function (a, b2) { return cy(a) - cy(b2); });
    var minor = comps.filter(function (c) { return height(c) < 0.4 * H; });

    // lines: follow the nearest letter so slanted lines still hold together
    var lines = [];
    major.forEach(function (c) {
      var best = null, bd = Infinity;
      lines.forEach(function (L) {
        var ref = null, rd = Infinity;
        L.comps.forEach(function (o) {
          var d = Math.abs(cx(o) - cx(c));
          if (d < rd) { rd = d; ref = o; }
        });
        var dy = Math.abs(cy(ref) - cy(c));
        if (dy < 0.55 * Math.max(H, height(ref)) && dy < bd) { bd = dy; best = L; }
      });
      if (best) best.comps.push(c); else lines.push({ comps: [c] });
    });
    lines.forEach(function (L) {
      L.H = median(L.comps.map(height));
      L.top = Math.min.apply(null, L.comps.map(function (c) { return c.y0; }));
      L.bottom = Math.max.apply(null, L.comps.map(function (c) { return c.y1; }));
    });
    minor.forEach(function (c) {
      var best = null, bd = Infinity;
      lines.forEach(function (L) {
        if (cx(c) < Math.min.apply(null, L.comps.map(function (o) { return o.x0; })) - 3 * L.H) return;
        if (cx(c) > Math.max.apply(null, L.comps.map(function (o) { return o.x1; })) + 3 * L.H) return;
        var d = cy(c) < L.top ? L.top - cy(c) : cy(c) > L.bottom ? cy(c) - L.bottom : 0;
        if (d < bd) { bd = d; best = L; }
      });
      if (best && bd < 0.9 * best.H) (best.minor = best.minor || []).push(c);
    });
    lines.sort(function (a, b2) { return median(a.comps.map(cy)) - median(b2.comps.map(cy)); });

    lines = lines.map(function (L) {
      var glyphs = [];
      L.comps.sort(function (a, b2) { return a.x0 - b2.x0; }).forEach(function (c) {
        var into = null;
        glyphs.slice(-3).forEach(function (gl) {
          if (overlap(gl.x0, gl.x1, c.x0, c.x1) >= 0.5 * Math.min(width(c), gl.x1 - gl.x0)) into = gl;
        });
        if (into) absorb(into, c); else glyphs.push(newGlyph(c));
      });
      (L.minor || []).forEach(function (c) {
        var into = null, bo = -0.15 * L.H;
        glyphs.forEach(function (gl) {
          var o = overlap(gl.x0, gl.x1, c.x0, c.x1);
          if (o > bo) { bo = o; into = gl; }
        });
        if (into) absorb(into, c); else glyphs.push(newGlyph(c));
      });
      glyphs.sort(function (a, b2) { return a.x0 - b2.x0; });
      return { H: L.H, glyphs: glyphs, x0: Math.min.apply(null, glyphs.map(function (q) { return q.x0; })),
        x1: Math.max.apply(null, glyphs.map(function (q) { return q.x1; })),
        y0: Math.min.apply(null, glyphs.map(function (q) { return q.y0; })),
        y1: Math.max.apply(null, glyphs.map(function (q) { return q.y1; })) };
    });

    return { g: g, label: cc.label, mean: b.mean, lines: lines };
  }

  // Is pixel (x, y) part of glyph gl?
  function inGlyph(page, gl, x, y) {
    var w = page.g.w;
    if (x < 0 || y < 0 || x >= w || y >= page.g.h) return false;
    if (gl.clip && (x < gl.clip[0] || x >= gl.clip[1])) return false;
    return gl.members.indexOf(page.label[y * w + x]) >= 0;
  }

  function refit(page, gl) {
    var x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    var a = gl.clip ? Math.max(gl.x0, gl.clip[0]) : gl.x0, b = gl.clip ? Math.min(gl.x1, gl.clip[1]) : gl.x1;
    for (var y = gl.y0; y < gl.y1; y++) {
      for (var x = a; x < b; x++) {
        if (!inGlyph(page, gl, x, y)) continue;
        if (x < x0) x0 = x; if (x >= x1) x1 = x + 1; if (y < y0) y0 = y; if (y >= y1) y1 = y + 1;
      }
    }
    if (x1 < 0) return false;
    gl.x0 = x0; gl.y0 = y0; gl.x1 = x1; gl.y1 = y1;
    return true;
  }

  // Split a glyph at its thinnest column near the middle.
  function split(page, gl) {
    var w = gl.x1 - gl.x0, cols = new Float32Array(w);
    for (var y = gl.y0; y < gl.y1; y++) {
      for (var x = gl.x0; x < gl.x1; x++) if (inGlyph(page, gl, x, y)) cols[x - gl.x0]++;
    }
    var best = -1, bv = Infinity;
    for (var i = Math.floor(w * 0.25); i < Math.ceil(w * 0.75); i++) {
      var v = cols[i] + Math.abs(i - w / 2) / w; // prefer the middle on ties
      if (v < bv) { bv = v; best = i; }
    }
    if (best <= 0) return null;
    var cut = gl.x0 + best, base = gl.clip || [-Infinity, Infinity];
    var left = Object.assign({}, gl, { members: gl.members.slice(), clip: [base[0], cut] });
    var right = Object.assign({}, gl, { members: gl.members.slice(), clip: [cut, base[1]] });
    if (!refit(page, left) || !refit(page, right)) return null;
    return [left, right];
  }

  function mergeTwo(a, b) {
    var m = { members: a.members.concat(b.members.filter(function (id) { return a.members.indexOf(id) < 0; })),
      x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
      clip: null, ch: '', off: false };
    if (a.clip || b.clip) m.clip = [Math.min(a.clip ? a.clip[0] : a.x0, b.clip ? b.clip[0] : b.x0),
      Math.max(a.clip ? a.clip[1] : a.x1, b.clip ? b.clip[1] : b.x1)];
    return m;
  }

  // Make `glyphs` (left to right) exactly n long by merging close pairs and
  // splitting wide letters. Returns the new list (may stay short if it cannot).
  function fit(page, glyphs, n, H) {
    glyphs = glyphs.slice();
    while (glyphs.length > n && glyphs.length > 1) {
      var bi = 0, bg = Infinity;
      for (var i = 0; i < glyphs.length - 1; i++) {
        var gap = glyphs[i + 1].x0 - glyphs[i].x1;
        if (gap < bg) { bg = gap; bi = i; }
      }
      glyphs.splice(bi, 2, mergeTwo(glyphs[bi], glyphs[bi + 1]));
    }
    var guard = 0;
    while (glyphs.length < n && guard++ < 50) {
      var wi = -1, ww = 0.45 * H;
      glyphs.forEach(function (gl, k) {
        var r = (gl.x1 - gl.x0);
        if (r > ww) { ww = r; wi = k; }
      });
      if (wi < 0) break;
      var parts = split(page, glyphs[wi]);
      if (!parts) break;
      glyphs.splice(wi, 1, parts[0], parts[1]);
    }
    return glyphs;
  }

  function words(glyphs, H) {
    var gaps = [];
    for (var i = 1; i < glyphs.length; i++) gaps.push(glyphs[i].x0 - glyphs[i - 1].x1);
    var thr = Math.max(0.4 * H, 2.2 * median(gaps.filter(function (g) { return g > 0; })));
    var out = [[]];
    glyphs.forEach(function (gl, k) {
      if (k && gaps[k - 1] > thr) out.push([]);
      out[out.length - 1].push(gl);
    });
    return out;
  }

  // ---- text order ----

  // Logical text -> characters in left-to-right visual order (a small bidi:
  // Hebrew runs right to left, Latin/digit runs left to right inside them).
  // Applied to a visual string with the same base it gives the logical one.
  function visual(text, rtl) {
    var chars = Array.from(text), n = chars.length;
    var type = chars.map(function (c) { return HEB.test(c) ? 'R' : LTR.test(c) ? 'L' : 'N'; });
    var lv = new Array(n);
    for (var i = 0; i < n; i++) {
      var t = type[i];
      if (t === 'N') {
        var p = i - 1, q = i + 1;
        while (p >= 0 && type[p] === 'N') p--;
        while (q < n && type[q] === 'N') q++;
        var a = p >= 0 ? type[p] : (rtl ? 'R' : 'L'), b = q < n ? type[q] : (rtl ? 'R' : 'L');
        t = a === b ? a : (rtl ? 'R' : 'L');
      }
      lv[i] = rtl ? (t === 'R' ? 1 : 2) : (t === 'R' ? 1 : 0);
    }
    var order = chars.map(function (c, k) { return k; });
    for (var lev = 2; lev >= 1; lev--) {
      for (var s = 0; s < n;) {
        if (lv[order[s]] < lev) { s++; continue; }
        var e = s;
        while (e < n && lv[order[e]] >= lev) e++;
        var seg = order.slice(s, e).reverse();
        for (var k = 0; k < seg.length; k++) order[s + k] = seg[k];
        s = e;
      }
    }
    return order.map(function (k) { return lv[k] % 2 && MIRROR[chars[k]] ? MIRROR[chars[k]] : chars[k]; }).join('');
  }

  function isRtlText(text) {
    var h = (text.match(/[א-ת]/g) || []).length, l = (text.match(/[A-Za-z]/g) || []).length;
    return h >= l && h > 0;
  }

  // ---- letter guessing ----

  function featureFrom(get, w, h) { // get(x, y) -> 0..1 over a w x h box
    var f = new Float32Array(FEAT * FEAT), s = (FEAT - 2) / Math.max(w, h);
    var ox = (FEAT - w * s) / 2, oy = (FEAT - h * s) / 2;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var v = get(x, y);
        if (!v) continue;
        var fx = Math.min(FEAT - 1, Math.floor(ox + x * s)), fy = Math.min(FEAT - 1, Math.floor(oy + y * s));
        f[fy * FEAT + fx] += v;
      }
    }
    var b = new Float32Array(f.length), norm = 0;
    for (y = 0; y < FEAT; y++) {
      for (x = 0; x < FEAT; x++) {
        var sum = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < FEAT && yy < FEAT) sum += f[yy * FEAT + xx] * (dx || dy ? 1 : 2);
        }
        b[y * FEAT + x] = sum;
        norm += sum * sum;
      }
    }
    norm = Math.sqrt(norm) || 1;
    for (var i = 0; i < b.length; i++) b[i] /= norm;
    return b;
  }

  // Template from an RGBA glyph-box bitmap (the user's own letters).
  function templateFromBox(ch, rgba) {
    var x0 = N, y0 = N, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      if (rgba[(y * N + x) * 4 + 3] > 100) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    var w = x1 - x0 + 1, h = y1 - y0 + 1, u = KF.G.UNITS_PER_PX;
    return {
      ch: ch, own: true,
      f: featureFrom(function (xx, yy) { return rgba[((y0 + yy) * N + x0 + xx) * 4 + 3] / 255; }, w, h),
      aspect: Math.log(w / h),
      top: (KF.G.BASE_PX - y0) * u / REF, bottom: (KF.G.BASE_PX - y1 - 1) * u / REF,
    };
  }

  var printed = null;
  function printedTemplates() {
    if (printed) return printed;
    printed = [];
    var S = 96, c = document.createElement('canvas');
    c.width = c.height = S;
    var x = c.getContext('2d', { willReadFrequently: true });
    ['sans-serif', 'serif'].forEach(function (fam) {
      KF.charset.ALL.split('').forEach(function (ch) {
        x.clearRect(0, 0, S, S);
        x.font = '64px ' + fam;
        x.textAlign = 'center';
        x.textBaseline = 'alphabetic';
        x.fillText(ch, S / 2, 70);
        var d = x.getImageData(0, 0, S, S).data, x0 = S, y0 = S, x1 = -1, y1 = -1;
        for (var yy = 0; yy < S; yy++) for (var xx = 0; xx < S; xx++) {
          if (d[(yy * S + xx) * 4 + 3] > 100) {
            if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
          }
        }
        if (x1 < 0) return;
        var w = x1 - x0 + 1, h = y1 - y0 + 1, hint = KF.charset.sizeHint(ch);
        printed.push({
          ch: ch,
          f: featureFrom(function (a, b) { return d[((y0 + b) * S + x0 + a) * 4 + 3] / 255; }, w, h),
          aspect: Math.log(w / h), top: hint[1] / REF, bottom: hint[0] / REF,
        });
      });
    });
    return printed;
  }

  function glyphFeature(page, gl, baseline, H) {
    var w = gl.x1 - gl.x0, h = gl.y1 - gl.y0;
    return {
      f: featureFrom(function (x, y) { return inGlyph(page, gl, gl.x0 + x, gl.y0 + y) ? 1 : 0; }, w, h),
      aspect: Math.log(w / h),
      top: (baseline - gl.y0) / H, bottom: (baseline - gl.y1) / H,
    };
  }

  function distance(feat, t) {
    var d = 0;
    for (var i = 0; i < feat.f.length; i++) { var q = feat.f[i] - t.f[i]; d += q * q; }
    var da = feat.aspect - t.aspect;
    d += 0.35 * da * da + 0.25 * ((feat.top - t.top) * (feat.top - t.top) + (feat.bottom - t.bottom) * (feat.bottom - t.bottom));
    return t.own ? d * 0.8 : d;
  }

  function classify(feat, templates, allow) {
    var best = null, bd = Infinity;
    templates.forEach(function (t) {
      if (allow && !allow.test(t.ch)) return;
      var d = distance(feat, t);
      if (d < bd) { bd = d; best = t; }
    });
    return best ? best.ch : '';
  }

  function lineBase(line) {
    return median(line.glyphs.filter(function (q) { return q.y1 - q.y0 >= 0.4 * line.H; }).map(function (q) { return q.y1; }));
  }

  // Flag letters that look little like the character they were given (a bad
  // cut, a smudge, a misread): such a letter is skipped unless the user
  // turns it back on.
  function review(page, line, glyphs, templates) {
    var base = lineBase(line), script = null;
    glyphs.forEach(function (gl) {
      gl.weak = false;
      if (!gl.ch || gl.off) return;
      script = script || (HEB.test(gl.ch) ? 'heb' : LAT.test(gl.ch) ? 'lat' : null);
    });
    glyphs.forEach(function (gl) {
      if (!gl.ch || gl.off || !/[\u05d0-\u05eaA-Za-z0-9]/.test(gl.ch)) return;
      var f = glyphFeature(page, gl, base, line.H), best = {};
      templates.forEach(function (t) {
        if (script === 'heb' ? LAT.test(t.ch) : script === 'lat' ? HEB.test(t.ch) : false) return;
        var d = distance(f, t);
        if (!(t.ch in best) || d < best[t.ch]) best[t.ch] = d;
      });
      var mine = best[gl.ch];
      if (mine == null) return;
      var rank = 0;
      Object.keys(best).forEach(function (c) { if (best[c] < mine) rank++; });
      var tooSmall = gl.y1 - gl.y0 < 0.25 * line.H && !/[.,'\-:;"]/.test(gl.ch);
      if (rank > 14 || tooSmall || (gl.clip && rank > 7)) { gl.weak = true; gl.off = true; }
    });
    return glyphs;
  }

  // Guess the text of a line, in logical order.
  function guessLine(page, line, templates) {
    var base = lineBase(line);
    var feats = line.glyphs.map(function (gl) { return glyphFeature(page, gl, base, line.H); });
    var first = feats.map(function (f) { return classify(f, templates); }).join('');
    var rtl = isRtlText(first);
    var allow = rtl ? /[א-ת0-9.,!?\-'"():;/@&+=₪]/ : /[A-Za-z0-9.,!?\-'"():;/@&+=₪]/;
    var chars = feats.map(function (f) { return classify(f, templates, allow); });
    var ws = words(line.glyphs, line.H), k = 0;
    var vis = ws.map(function (wd) { return wd.map(function () { return chars[k++]; }).join(''); }).join(' ');
    return visual(vis, rtl);
  }

  // Assign the confirmed text to the line's letters.
  function align(page, line, text) {
    var rtl = isRtlText(text);
    var vis = visual(text.trim(), rtl);
    var vWords = vis.split(/\s+/).filter(Boolean);
    var gWords = words(line.glyphs, line.H);
    var out = [];
    if (vWords.length === gWords.length) {
      gWords.forEach(function (gw, i) {
        var chars = Array.from(vWords[i]), fitted = fit(page, gw, chars.length, line.H);
        fitted.forEach(function (gl, k) { out.push(Object.assign({}, gl, { ch: chars[k] || '', off: !chars[k] })); });
      });
    } else {
      var chars = Array.from(vWords.join('')), fitted = fit(page, line.glyphs, chars.length, line.H);
      fitted.forEach(function (gl, k) { out.push(Object.assign({}, gl, { ch: chars[k] || '', off: !chars[k] })); });
    }
    var used = out.filter(function (q) { return q.ch; }).length;
    return { glyphs: out, exact: used === Array.from(vWords.join('')).length && used === out.length };
  }

  // ---- into the glyph box ----

  // Baseline (y = a + b * x) and scale (font units per photo pixel) for a
  // line, from where its letters normally sit.
  function lineMetrics(glyphs, H) {
    var ks = [], pts = [];
    glyphs.forEach(function (gl) {
      if (!gl.ch || gl.off || !/[א-תA-Za-z0-9]/.test(gl.ch)) return;
      var hint = KF.charset.sizeHint(gl.ch), hp = gl.y1 - gl.y0;
      if (hp > 2) ks.push((hint[1] - hint[0]) / hp);
      if (hint[0] === 0) pts.push([(gl.x0 + gl.x1) / 2, gl.y1]);
    });
    var k = ks.length ? median(ks) : REF / H;
    var a, b = 0;
    if (pts.length >= 3) {
      var mx = 0, my = 0;
      pts.forEach(function (p) { mx += p[0] / pts.length; my += p[1] / pts.length; });
      var sxx = 0, sxy = 0;
      pts.forEach(function (p) { sxx += (p[0] - mx) * (p[0] - mx); sxy += (p[0] - mx) * (p[1] - my); });
      b = sxx ? Math.max(-0.2, Math.min(0.2, sxy / sxx)) : 0;
      a = my - b * mx;
    } else {
      a = pts.length ? median(pts.map(function (p) { return p[1]; })) : median(glyphs.map(function (q) { return q.y1; }));
    }
    return { k: k, a: a, b: b };
  }

  function lumAt(g, x, y) {
    var x0 = Math.max(0, Math.min(g.w - 2, Math.floor(x))), y0 = Math.max(0, Math.min(g.h - 2, Math.floor(y)));
    var fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0)), L = g.lum, w = g.w;
    return (L[y0 * w + x0] * (1 - fx) + L[y0 * w + x0 + 1] * fx) * (1 - fy) +
      (L[(y0 + 1) * w + x0] * (1 - fx) + L[(y0 + 1) * w + x0 + 1] * fx) * fy;
  }

  function toBox(page, gl, m) {
    var g = page.g, u = KF.G.UNITS_PER_PX, rgba = new Uint8ClampedArray(N * N * 4);
    var gx = (gl.x0 + gl.x1) / 2, base = m.a + m.b * gx;
    for (var v = 0; v < N; v++) {
      var y = base - (KF.G.BASE_PX - v - 0.5) * u / m.k;
      if (y < gl.y0 - 2 || y > gl.y1 + 2) continue;
      for (var q = 0; q < N; q++) {
        var x = gx + (q + 0.5 - N / 2) * u / m.k;
        if (x < gl.x0 - 2 || x > gl.x1 + 2) continue;
        var xi = Math.round(x), yi = Math.round(y);
        if (!(inGlyph(page, gl, xi, yi) || inGlyph(page, gl, xi + 1, yi) || inGlyph(page, gl, xi - 1, yi) ||
          inGlyph(page, gl, xi, yi + 1) || inGlyph(page, gl, xi, yi - 1))) continue;
        var mean = page.mean[Math.min(g.h - 1, Math.max(0, yi)) * g.w + Math.min(g.w - 1, Math.max(0, xi))];
        var a = (0.88 * mean - lumAt(g, x, y)) / (0.3 * mean);
        rgba[(v * N + q) * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
      }
    }
    return rgba;
  }

  KF.hand = {
    segment: segment, guessLine: guessLine, align: align, review: review, lineMetrics: lineMetrics, toBox: toBox,
    printedTemplates: printedTemplates, templateFromBox: templateFromBox, visual: visual, isRtlText: isRtlText,
  };
})(globalThis.KF = globalThis.KF || {});
