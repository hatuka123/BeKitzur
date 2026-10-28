// Optional: ask Claude to read the handwriting. The user supplies their own
// Anthropic API key (kept in this browser only). This is a plain-script app
// with no bundler that also runs offline inside the Android WebView, so it
// calls the Messages API with fetch instead of the SDK.
(function (KF) {
  'use strict';

  var URL_ = 'https://api.anthropic.com/v1/messages';
  var MODEL = 'claude-opus-5-5';

  var PROMPT = [
    'Each image above is one line cut from a photo of handwriting, in order.',
    'Transcribe exactly what is written on each line: Hebrew, English, digits and punctuation, as written.',
    'Keep the writer\'s spelling and spacing; do not correct or translate anything.',
    'If a line is not readable handwriting (a smudge, a drawing, printed noise), return an empty string for it.',
    'Return one string per image, in the same order.',
  ].join(' ');

  function key() { return KF.store.setting('apiKey') || ''; }

  // strips: base64 PNGs (no data: prefix). Resolves to an array of strings.
  function readLines(strips) {
    var content = [];
    strips.forEach(function (b64, i) {
      content.push({ type: 'text', text: 'Line ' + (i + 1) + ':' });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } });
    });
    content.push({ type: 'text', text: PROMPT });
    var body = {
      model: MODEL,
      max_tokens: 16000,
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { lines: { type: 'array', items: { type: 'string' } } },
            required: ['lines'],
            additionalProperties: false,
          },
        },
      },
      messages: [{ role: 'user', content: content }],
    };
    return fetch(URL_, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key(),
        'anthropic-version': '2026-10-21',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (j) {
      if (j.stop_reason === 'refusal') throw new Error('refused');
      var text = (j.content || []).filter(function (b) { return b.type === 'text'; })
        .map(function (b) { return b.text; }).join('');
      var lines = JSON.parse(text).lines;
      if (!Array.isArray(lines)) throw new Error('bad answer');
      return lines.map(function (s) { return String(s || ''); });
    });
  }

  KF.ai = { readLines: readLines, hasKey: function () { return !!key(); } };
})(globalThis.KF = globalThis.KF || {});
