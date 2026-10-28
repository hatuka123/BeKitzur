// Glyph bitmaps and settings, kept in localStorage. Each character has one or
// more variants (PNG data URLs); `sel` is the one used as the main form.
// Storage can be missing or full; the app keeps working in memory and the
// project file is the reliable backup.
(function (KF) {
  'use strict';

  var KEY = 'ktav.glyphs.v2', OLD_KEY = 'ktav.glyphs.v1', SKEY = 'ktav.settings.v1';
  var glyphs = {}, settings = {}, listeners = [];

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function isPng(s) { return typeof s === 'string' && s.indexOf('data:image/png') === 0; }

  // Accepts both the v1 shape ({ch: url}) and v2 ({ch: {v: [url], sel}}).
  function normalize(raw) {
    var out = {};
    Object.keys(raw || {}).forEach(function (ch) {
      var e = raw[ch];
      if (isPng(e)) e = { v: [e], sel: 0 };
      if (!e || !Array.isArray(e.v)) return;
      var v = e.v.filter(isPng);
      if (!v.length) return;
      out[ch] = { v: v, sel: Math.min(Math.max(0, e.sel | 0), v.length - 1) };
    });
    return out;
  }

  glyphs = normalize(read(KEY) || read(OLD_KEY));
  settings = read(SKEY) || {};
  if (!read(KEY) && read(OLD_KEY) && write(KEY, glyphs)) {
    try { localStorage.removeItem(OLD_KEY); } catch (e) { /* keep it */ }
  }

  function changed(ch) { listeners.forEach(function (f) { f(ch); }); }
  function persist() { return write(KEY, glyphs); }

  var store = {
    onChange: function (f) { listeners.push(f); },
    // main form of ch
    get: function (ch) { var e = glyphs[ch]; return e ? e.v[e.sel] : null; },
    has: function (ch) { return !!glyphs[ch]; },
    chars: function () { return Object.keys(glyphs); },
    // variants with the main form first
    variants: function (ch) {
      var e = glyphs[ch];
      if (!e) return [];
      return [e.v[e.sel]].concat(e.v.filter(function (_, i) { return i !== e.sel; }));
    },
    raw: function (ch) { var e = glyphs[ch]; return e ? { v: e.v.slice(), sel: e.sel } : null; },
    // Replace variant i (i == count adds one). Null removes it.
    // Returns false when the browser refused to persist it.
    setVariant: function (ch, i, url) {
      var e = glyphs[ch] || (glyphs[ch] = { v: [], sel: 0 });
      if (url) e.v[i] = url;
      else if (i < e.v.length) {
        e.v.splice(i, 1);
        if (e.sel > i || e.sel >= e.v.length) e.sel = Math.max(0, e.sel - 1);
      }
      e.v = e.v.filter(Boolean);
      if (!e.v.length) delete glyphs[ch];
      var ok = persist();
      changed(ch);
      return ok;
    },
    select: function (ch, i) {
      if (!glyphs[ch] || i >= glyphs[ch].v.length) return;
      glyphs[ch].sel = i;
      persist();
      changed(ch);
    },
    // Main form replaced (as from the printed sheet).
    setMany: function (map) {
      Object.keys(map).forEach(function (ch) {
        var e = glyphs[ch];
        if (e) e.v[e.sel] = map[ch]; else glyphs[ch] = { v: [map[ch]], sel: 0 };
      });
      var ok = persist();
      changed(null);
      return ok;
    },
    // Extra variants appended (as from a photo of free handwriting).
    addMany: function (list) {
      list.forEach(function (it) {
        var e = glyphs[it.ch] || (glyphs[it.ch] = { v: [], sel: 0 });
        e.v.push(it.url);
      });
      var ok = persist();
      changed(null);
      return ok;
    },
    clear: function () { glyphs = {}; persist(); changed(null); },
    exportJSON: function () {
      return JSON.stringify({ app: 'ktav', version: 2, settings: settings, glyphs: glyphs });
    },
    importJSON: function (text) {
      var d = JSON.parse(text);
      if (!d || d.app !== 'ktav' || typeof d.glyphs !== 'object') throw new Error('bad file');
      glyphs = normalize(d.glyphs);
      if (d.settings && typeof d.settings === 'object') settings = d.settings;
      write(SKEY, settings);
      var ok = persist();
      changed(null);
      return ok;
    },
    setting: function (k, v) {
      if (arguments.length < 2) return settings[k];
      settings[k] = v;
      write(SKEY, settings);
    },
  };

  KF.store = store;
})(globalThis.KF = globalThis.KF || {});
