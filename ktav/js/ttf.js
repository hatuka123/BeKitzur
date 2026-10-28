// Minimal TrueType (.ttf) writer: glyf/loca outlines, format 4 cmap, and the
// OS/2 fields Windows looks at (Latin + Hebrew code pages, installable).
(function (KF) {
  'use strict';

  function Buf() { this.b = []; }
  Buf.prototype = {
    u8: function (v) { this.b.push(v & 255); return this; },
    u16: function (v) { this.b.push((v >> 8) & 255, v & 255); return this; },
    i16: function (v) { return this.u16(v < 0 ? v + 65536 : v); },
    u32: function (v) { this.u16((v >>> 16) & 65535); return this.u16(v & 65535); },
    tag: function (s) { for (var i = 0; i < 4; i++) this.u8(s.charCodeAt(i)); return this; },
    bytes: function (a) { for (var i = 0; i < a.length; i++) this.b.push(a[i]); return this; },
    pad4: function () { while (this.b.length % 4) this.b.push(0); return this; },
    get length() { return this.b.length; },
  };

  function checksum(bytes) {
    var sum = 0;
    for (var i = 0; i < bytes.length; i += 4) {
      sum = (sum + (((bytes[i] << 24) | ((bytes[i + 1] || 0) << 16) |
        ((bytes[i + 2] || 0) << 8) | (bytes[i + 3] || 0)) >>> 0)) >>> 0;
    }
    return sum;
  }

  function signedArea(c) {
    var s = 0;
    for (var i = 0, j = c.length - 1; i < c.length; j = i++) {
      s += c[j].x * c[i].y - c[i].x * c[j].y;
    }
    return s / 2;
  }

  // TrueType wants filled contours clockwise (y up) and holes the other way.
  // The tracer keeps fills and holes opposite, so flipping all of them when
  // the biggest contour is counter-clockwise is enough.
  function orient(contours) {
    var big = null, ba = 0;
    contours.forEach(function (c) {
      var a = signedArea(c);
      if (Math.abs(a) > Math.abs(ba)) { ba = a; big = c; }
    });
    if (big && ba > 0) return contours.map(function (c) { return c.slice().reverse(); });
    return contours;
  }

  function encodeGlyph(contours) {
    if (!contours.length) return { data: [], points: 0 };
    var xs = [], ys = [];
    contours.forEach(function (c) { c.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var b = new Buf();
    var box = [Math.min.apply(null, xs), Math.min.apply(null, ys),
      Math.max.apply(null, xs), Math.max.apply(null, ys)];
    b.i16(contours.length).i16(box[0]).i16(box[1]).i16(box[2]).i16(box[3]);
    var end = -1;
    contours.forEach(function (c) { end += c.length; b.u16(end); });
    b.u16(0); // no instructions
    var flags = [], xb = new Buf(), yb = new Buf(), px = 0, py = 0;
    contours.forEach(function (c) {
      c.forEach(function (p) {
        var f = p.on ? 1 : 0, dx = p.x - px, dy = p.y - py;
        if (dx === 0) f |= 0x10;
        else if (Math.abs(dx) < 256) { f |= 0x02 | (dx > 0 ? 0x10 : 0); xb.u8(Math.abs(dx)); }
        else xb.i16(dx);
        if (dy === 0) f |= 0x20;
        else if (Math.abs(dy) < 256) { f |= 0x04 | (dy > 0 ? 0x20 : 0); yb.u8(Math.abs(dy)); }
        else yb.i16(dy);
        flags.push(f);
        px = p.x; py = p.y;
      });
    });
    b.bytes(flags).bytes(xb.b).bytes(yb.b);
    return { data: b.b, points: end + 1, box: box };
  }

  function nameTable(names) {
    var ids = Object.keys(names).map(Number).sort(function (a, b) { return a - b; });
    var recs = [], strings = new Buf();
    // Macintosh Roman (ASCII only), then Windows Unicode BMP.
    ids.forEach(function (id) {
      var s = names[id].replace(/[^\x20-\x7e]/g, '');
      recs.push([1, 0, 0, id, s.length, strings.length]);
      for (var i = 0; i < s.length; i++) strings.u8(s.charCodeAt(i));
    });
    ids.forEach(function (id) {
      var s = names[id];
      recs.push([3, 1, 0x409, id, s.length * 2, strings.length]);
      for (var i = 0; i < s.length; i++) strings.u16(s.charCodeAt(i));
    });
    var b = new Buf().u16(0).u16(recs.length).u16(6 + recs.length * 12);
    recs.forEach(function (r) { r.forEach(function (v) { b.u16(v); }); });
    return b.bytes(strings.b).b;
  }

  function cmapTable(map) { // map: [[code, gid]] sorted by code, BMP only
    var segs = map.map(function (m) { return [m[0], m[0], (m[1] - m[0] + 65536) % 65536]; });
    segs.push([0xffff, 0xffff, 1]);
    var n = segs.length, p = 1;
    while (p * 2 <= n) p *= 2;
    var sub = new Buf().u16(4).u16(16 + n * 8).u16(0)
      .u16(n * 2).u16(p * 2).u16(Math.log2(p)).u16(n * 2 - p * 2);
    segs.forEach(function (s) { sub.u16(s[1]); });
    sub.u16(0);
    segs.forEach(function (s) { sub.u16(s[0]); });
    segs.forEach(function (s) { sub.u16(s[2]); });
    segs.forEach(function () { sub.u16(0); });
    var b = new Buf().u16(0).u16(2)
      .u16(0).u16(3).u32(20)
      .u16(3).u16(1).u32(20);
    return b.bytes(sub.b).b;
  }

  function unicodeRanges(codes) {
    var r = [0, 0, 0, 0];
    function set(bit) { r[bit >> 5] = (r[bit >> 5] | (1 << (bit & 31))) >>> 0; }
    codes.forEach(function (c) {
      if (c < 0x80) set(0);
      else if (c < 0x100) set(1);
      else if (c >= 0x590 && c < 0x600) set(11);
      else if (c >= 0x2000 && c < 0x2070) set(31);
      else if (c >= 0x20a0 && c < 0x20d0) set(33);
    });
    return r;
  }

  function coverage(gids) {
    var b = new Buf().u16(1).u16(gids.length);
    gids.forEach(function (g) { b.u16(g); });
    return b.b;
  }

  // Concatenate a header with child blocks; `head(offsets)` writes the
  // header given each child's offset from the start of the result.
  function pack(headSize, children, head) {
    var offs = [], at = headSize;
    children.forEach(function (c) { offs.push(at); at += c.length; });
    var b = head(offs);
    children.forEach(function (c) { b.bytes(c); });
    return b.b;
  }

  // Contextual alternates: each letter takes the next variant along from the
  // glyph before it, so repeated letters do not look stamped.
  // sets: [[defaultGid, alt1Gid, alt2Gid, ...]] for characters with variants;
  // letters: every default letter gid.
  function gsubTable(sets, letters) {
    var depth = 0;
    sets.forEach(function (s) { depth = Math.max(depth, s.length - 1); });
    var byGid = function (a, b) { return a[0] - b[0]; };
    var sorted = function (a) { return a.slice().sort(function (x, y) { return x - y; }); };
    var lookups = [];

    // lookup 0: chaining context, one subtable per variant level
    var chain = [];
    for (var k = 0; k < depth; k++) {
      var back = k === 0 ? sorted(letters) : sorted(sets.filter(function (s) { return s.length > k; })
        .map(function (s) { return s[k]; }));
      var input = sorted(sets.filter(function (s) { return s.length > k + 1; }).map(function (s) { return s[0]; }));
      chain.push(pack(18, [coverage(back), coverage(input)], function (o) {
        return new Buf().u16(3).u16(1).u16(o[0]).u16(1).u16(o[1]).u16(0).u16(1).u16(0).u16(k + 1);
      }));
    }
    lookups.push(chain);
    // lookups 1..depth: default -> variant k
    for (var j = 1; j <= depth; j++) {
      var pairs = sets.filter(function (s) { return s.length > j; })
        .map(function (s) { return [s[0], s[j]]; }).sort(byGid);
      lookups.push([pack(6 + pairs.length * 2, [coverage(pairs.map(function (p) { return p[0]; }))], function (o) {
        var b = new Buf().u16(2).u16(o[0]).u16(pairs.length);
        pairs.forEach(function (p) { b.u16(p[1]); });
        return b;
      })]);
    }
    var lookupTables = lookups.map(function (subs, i) {
      return pack(6 + subs.length * 2, subs, function (o) {
        var b = new Buf().u16(i === 0 ? 6 : 1).u16(0).u16(subs.length);
        o.forEach(function (x) { b.u16(x); });
        return b;
      });
    });
    var lookupList = pack(2 + lookupTables.length * 2, lookupTables, function (o) {
      var b = new Buf().u16(lookupTables.length);
      o.forEach(function (x) { b.u16(x); });
      return b;
    });
    var featureList = new Buf().u16(1).tag('calt').u16(8).u16(0).u16(1).u16(0).b;
    var langSys = function () { return new Buf().u16(4).u16(0).u16(0).u16(0xffff).u16(1).u16(0).b; };
    var tags = ['DFLT', 'hebr', 'latn'];
    var scriptList = pack(2 + tags.length * 6, tags.map(langSys), function (o) {
      var b = new Buf().u16(tags.length);
      tags.forEach(function (t, i) { b.tag(t).u16(o[i]); });
      return b;
    });
    return pack(10, [scriptList, featureList, lookupList], function (o) {
      return new Buf().u16(1).u16(0).u16(o[0]).u16(o[1]).u16(o[2]);
    });
  }

  // opts: { family, version, glyphs: [{ name, codes, advance, contours }],
  //         alternates, letters (see gsubTable) }
  // glyphs[0] must be .notdef.
  function build(opts) {
    var G = KF.G, glyphs = opts.glyphs;
    var family = opts.family, ps = family.replace(/[^A-Za-z0-9]/g, '') || 'Handwriting';
    var glyf = new Buf(), loca = [], hmtx = new Buf();
    var gx0 = 0, gy0 = 0, gx1 = 0, gy1 = 0, maxPts = 0, maxCtr = 0;
    var advMax = 0, minL = 0, minR = 0, maxExt = 0, advSum = 0, advN = 0, first = true;
    var cmap = [];

    glyphs.forEach(function (g, gid) {
      var contours = orient(g.contours || []);
      var e = encodeGlyph(contours);
      loca.push(glyf.length);
      glyf.bytes(e.data).pad4();
      var lsb = e.box ? e.box[0] : 0;
      hmtx.u16(g.advance).i16(lsb);
      advMax = Math.max(advMax, g.advance);
      if (g.advance > 0) { advSum += g.advance; advN++; }
      if (e.box) {
        if (first) { gx0 = e.box[0]; gy0 = e.box[1]; gx1 = e.box[2]; gy1 = e.box[3]; minL = lsb; minR = g.advance - e.box[2]; maxExt = e.box[2]; first = false; }
        gx0 = Math.min(gx0, e.box[0]); gy0 = Math.min(gy0, e.box[1]);
        gx1 = Math.max(gx1, e.box[2]); gy1 = Math.max(gy1, e.box[3]);
        minL = Math.min(minL, lsb); minR = Math.min(minR, g.advance - e.box[2]);
        maxExt = Math.max(maxExt, e.box[2]);
        maxPts = Math.max(maxPts, e.points); maxCtr = Math.max(maxCtr, contours.length);
      }
      (g.codes || []).forEach(function (c) { cmap.push([c, gid]); });
    });
    loca.push(glyf.length);
    cmap.sort(function (a, b) { return a[0] - b[0]; });
    var codes = cmap.map(function (m) { return m[0]; });

    var winAsc = Math.max(G.ASCENT, gy1), winDesc = Math.max(G.DESCENT, -gy0);
    var now = Math.floor(Date.now() / 1000) + 2082844800; // since 1904

    var head = new Buf().u32(0x10000).u32(0x10000).u32(0).u32(0x5f0f3cf5)
      .u16(0x000b).u16(G.UPM)
      .u32(Math.floor(now / 4294967296)).u32(now >>> 0)
      .u32(Math.floor(now / 4294967296)).u32(now >>> 0)
      .i16(gx0).i16(gy0).i16(gx1).i16(gy1)
      .u16(0).u16(8).i16(2).i16(1).i16(0);

    var hhea = new Buf().u32(0x10000).i16(winAsc).i16(-winDesc).i16(0)
      .u16(advMax).i16(minL).i16(minR).i16(maxExt)
      .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0)
      .u16(glyphs.length);

    var maxp = new Buf().u32(0x10000).u16(glyphs.length).u16(maxPts).u16(maxCtr)
      .u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

    var ur = unicodeRanges(codes);
    var os2 = new Buf().u16(4).i16(Math.round(advSum / (advN || 1))).u16(400).u16(5).u16(0)
      .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350)
      .i16(50).i16(260).i16(0)
      .bytes([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) // panose: any
      .u32(ur[0]).u32(ur[1]).u32(ur[2]).u32(ur[3])
      .tag('KTAV').u16(0x00c0) // REGULAR | USE_TYPO_METRICS
      .u16(codes.length ? Math.min(codes[0], 0xffff) : 0x20)
      .u16(codes.length ? Math.min(codes[codes.length - 1], 0xffff) : 0x20)
      .i16(G.ASCENT).i16(-G.DESCENT).i16(0)
      .u16(winAsc).u16(winDesc)
      .u32((1 << 0) | (1 << 5)).u32(0) // code pages 1252 Latin 1, 1255 Hebrew
      .i16(G.XH).i16(G.CAP).u16(0).u16(32).u16(opts.alternates && opts.alternates.length ? 2 : 1);

    var post = new Buf().u32(0x30000).u32(0).i16(-100).i16(50)
      .u32(0).u32(0).u32(0).u32(0).u32(0);

    var version = opts.version || 'Version 1.000';
    var name = nameTable({
      0: opts.copyright || 'Created with Ktav handwriting font maker',
      1: family, 2: 'Regular', 3: ps + '-Regular;' + now, 4: family,
      5: version, 6: ps + '-Regular',
    });

    var locaB = new Buf();
    loca.forEach(function (o) { locaB.u32(o); });

    var tables = {
      'OS/2': os2.b, cmap: cmapTable(cmap), glyf: glyf.b, head: head.b,
      hhea: hhea.b, hmtx: hmtx.b, loca: locaB.b, maxp: maxp.b, name: name, post: post.b,
    };
    if (opts.alternates && opts.alternates.length) tables.GSUB = gsubTable(opts.alternates, opts.letters);
    var tags = Object.keys(tables).sort();
    var n = tags.length, p = 1;
    while (p * 2 <= n) p *= 2;
    var out = new Buf().u32(0x10000).u16(n).u16(p * 16).u16(Math.log2(p)).u16(n * 16 - p * 16);
    var offset = 12 + n * 16, headOffset = 0;
    tags.forEach(function (t) {
      var data = tables[t];
      out.tag(t).u32(checksum(data)).u32(offset).u32(data.length);
      if (t === 'head') headOffset = offset;
      offset += Math.ceil(data.length / 4) * 4;
    });
    tags.forEach(function (t) { out.bytes(tables[t]).pad4(); });
    var bytes = new Uint8Array(out.b);
    var adj = (0xb1b0afba - checksum(bytes)) >>> 0;
    bytes[headOffset + 8] = adj >>> 24; bytes[headOffset + 9] = (adj >>> 16) & 255;
    bytes[headOffset + 10] = (adj >>> 8) & 255; bytes[headOffset + 11] = adj & 255;
    return bytes;
  }

  KF.ttf = { build: build };
})(globalThis.KF = globalThis.KF || {});
