// Node self-test: builds a font from synthetic glyph bitmaps and writes it out.
//   node ktav/tools/selftest.js out.ttf
// Then validate, e.g.:  python -m ots out.ttf  /  ttx -l out.ttf
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

['charset', 'trace', 'ttf', 'fontgen'].forEach(function (m) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', m + '.js'), 'utf8'));
});
var KF = globalThis.KF, N = KF.G.CANVAS;

function bitmap(fn) {
  var a = new Uint8ClampedArray(N * N * 4);
  for (var y = 0; y < N; y++) {
    for (var x = 0; x < N; x++) if (fn(x, y)) a[(y * N + x) * 4 + 3] = 255;
  }
  return a;
}
var base = KF.G.BASE_PX;
var ring = bitmap(function (x, y) {
  var d = Math.hypot(x - 200, y - (base - 110)); return d < 110 && d > 75;
});
var bar = bitmap(function (x, y) { return x > 180 && x < 215 && y > base - 280 && y < base; });
var two = bitmap(function (x, y) {
  return (x > 150 && x < 320 && y > base - 30 && y < base) ||
    (Math.hypot(x - 300, y - 200) < 20) || (x > 100 && x < 130 && y > 280 && y < 300);
});

var bar2 = bitmap(function (x, y) { return x > 170 && x < 225 && y > base - 300 && y < base; });
var bar3 = bitmap(function (x, y) { return x > 190 && x < 205 && y > base - 260 && y < base; });
var out = KF.fontgen.makeFont({ O: [ring], o: [ring], ס: [ring, two], l: [bar, bar2, bar3], ו: [bar, bar2], ':': [two] },
  { family: KF.fontgen.cleanFamily('Self Test'), fillCase: true });
var o = KF.trace.traceGlyph(ring, N, 0);
if (o.length !== 2) throw new Error('ring should trace to 2 contours, got ' + o.length);
var a0 = 0, a1 = 0;
o[0].forEach(function (p, i, c) { var q = c[(i + 1) % c.length]; a0 += p.x * q.y - q.x * p.y; });
o[1].forEach(function (p, i, c) { var q = c[(i + 1) % c.length]; a1 += p.x * q.y - q.x * p.y; });
if (Math.sign(a0) === Math.sign(a1)) throw new Error('outer and hole wind the same way');
var file = process.argv[2] || 'selftest.ttf';
fs.writeFileSync(file, out.bytes);
console.log('ok:', out.count, 'letters +', out.alternates, 'variants,', out.bytes.length, 'bytes ->', file);
