// Glyph bitmaps (PNG data URLs, keyed by character) and settings, kept in
// localStorage. Storage can be missing or full; the app keeps working in
// memory and the project file is the reliable backup.
(function (KF) {
  'use strict';

  var KEY = 'ktav.glyphs.v1', SKEY = 'ktav.settings.v1';
  var glyphs = {}, settings = {}, listeners = [];

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  glyphs = read(KEY);
  settings = read(SKEY);

  function changed(ch) { listeners.forEach(function (f) { f(ch); }); }

  var store = {
    onChange: function (f) { listeners.push(f); },
    get: function (ch) { return glyphs[ch] || null; },
    has: function (ch) { return !!glyphs[ch]; },
    chars: function () { return Object.keys(glyphs); },
    // Returns false when the browser refused to persist it.
    set: function (ch, dataUrl) {
      if (dataUrl) glyphs[ch] = dataUrl; else delete glyphs[ch];
      var ok = write(KEY, glyphs);
      changed(ch);
      return ok;
    },
    setMany: function (map) {
      Object.keys(map).forEach(function (ch) { glyphs[ch] = map[ch]; });
      var ok = write(KEY, glyphs);
      changed(null);
      return ok;
    },
    clear: function () { glyphs = {}; write(KEY, glyphs); changed(null); },
    exportJSON: function () {
      return JSON.stringify({ app: 'ktav', version: 1, settings: settings, glyphs: glyphs });
    },
    importJSON: function (text) {
      var d = JSON.parse(text);
      if (!d || d.app !== 'ktav' || typeof d.glyphs !== 'object') throw new Error('bad file');
      glyphs = {};
      Object.keys(d.glyphs).forEach(function (ch) {
        if (typeof d.glyphs[ch] === 'string' && d.glyphs[ch].indexOf('data:image/png') === 0) glyphs[ch] = d.glyphs[ch];
      });
      if (d.settings && typeof d.settings === 'object') settings = d.settings;
      write(SKEY, settings);
      var ok = write(KEY, glyphs);
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
