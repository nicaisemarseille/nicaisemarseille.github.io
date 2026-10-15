/* Optimal transport between point clouds, looping on the home page.
   Each cloud is matched to the next by an exact assignment (Hungarian
   algorithm, squared Euclidean cost); points then move along straight
   lines, i.e. McCann's displacement interpolation.
   The loop ends on a dolphin before starting over. */
(function () {
  var box = document.querySelector('.home-ot');
  if (!box) return;
  var canvas = box.querySelector('canvas');
  var ctx = canvas.getContext('2d');

  var N = 72;
  var SIZE = 230;
  var POINT = '#3d5a78';
  var TARGET = '#c27c4e';

  var dpr = window.devicePixelRatio || 1;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  /* ---------- point clouds, in [-1, 1]^2 ---------- */
  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function jitter(s) { return (Math.random() - 0.5) * s; }

  /* N points evenly spaced along an SVG path, fitted into [-0.85, 0.85]^2 */
  function samplePath(d) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    var el = document.createElementNS(ns, 'path');
    el.setAttribute('d', d);
    svg.appendChild(el);
    document.body.appendChild(svg);
    var len = el.getTotalLength(), pts = [];
    for (var i = 0; i < N; i++) {
      var q = el.getPointAtLength((i + 0.5) / N * len);
      pts.push([q.x, -q.y]);
    }
    document.body.removeChild(svg);
    var xs = pts.map(function (q) { return q[0]; }), ys = pts.map(function (q) { return q[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var k = 1.7 / Math.max(x1 - x0, y1 - y0);
    return pts.map(function (q) { return [(q[0] - (x0 + x1) / 2) * k, (q[1] - (y0 + y1) / 2) * k]; });
  }

  var shapes = [
    function blob() {
      var p = [];
      for (var i = 0; i < N; i++) p.push([0.32 * gauss(), 0.32 * gauss()]);
      return p;
    },
    function ring() {
      var p = [];
      for (var i = 0; i < N; i++) {
        var a = 2 * Math.PI * i / N, r = 0.72 + jitter(0.1);
        p.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return p;
    },
    function moons() {
      var p = [];
      for (var i = 0; i < N; i++) {
        var t = Math.PI * (i % (N / 2)) / (N / 2 - 1), up = i < N / 2;
        p.push(up ? [-0.3 + 0.55 * Math.cos(t) + jitter(0.08), 0.2 - 0.55 * Math.sin(t) + jitter(0.08)]
                  : [0.3 - 0.55 * Math.cos(t) + jitter(0.08), -0.2 + 0.55 * Math.sin(t) + jitter(0.08)]);
      }
      return p;
    },
    function spiral() {
      var p = [];
      for (var i = 0; i < N; i++) {
        var t = i / (N - 1), r = 0.1 + 0.75 * t, a = 3.4 * Math.PI * t;
        p.push([r * Math.cos(a) + jitter(0.04), r * Math.sin(a) + jitter(0.04)]);
      }
      return p;
    },
    function dolphin() {
      /* dolphin facing right (beak, rounded melon, curved dorsal fin),
         sampled evenly along its outline */
      return samplePath(
        'M196 66 C190 63 186 62 182 61 C178 52 172 46 160 42 C140 36 120 35 106 37 ' +
        'C100 28 92 18 82 13 C86 22 88 32 92 41 C72 47 54 56 40 66 C32 60 22 54 12 50 ' +
        'C17 58 21 64 25 70 C20 76 15 82 12 90 C24 84 34 78 44 74 C64 78 92 80 118 78 ' +
        'C114 86 108 93 102 100 C114 96 124 88 130 78 C150 76 170 72 184 69 C188 68 192 67 196 66 Z'
      );
    }
  ];

  /* ---------- exact assignment (Hungarian, O(n^3)) ---------- */
  function assign(X, Y) {
    var n = X.length, INF = 1e18;
    var u = new Float64Array(n + 1), v = new Float64Array(n + 1);
    var p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    function cost(i, j) {
      var dx = X[i - 1][0] - Y[j - 1][0], dy = X[i - 1][1] - Y[j - 1][1];
      return dx * dx + dy * dy;
    }
    for (var i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0, minv = new Float64Array(n + 1).fill(INF), used = new Uint8Array(n + 1);
      do {
        used[j0] = 1;
        var i0 = p[j0], delta = INF, j1 = 0;
        for (var j = 1; j <= n; j++) {
          if (used[j]) continue;
          var cur = cost(i0, j) - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else { minv[j] -= delta; }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do { var jp = way[j0]; p[j0] = p[jp]; j0 = jp; } while (j0);
    }
    var match = new Int32Array(n);
    for (j = 1; j <= n; j++) match[p[j] - 1] = j - 1;
    return match;
  }

  /* ---------- drawing ---------- */
  function px(x) { return SIZE / 2 + x * SIZE * 0.42; }
  function py(y) { return SIZE / 2 - y * SIZE * 0.42; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function dot(x, y, color, alpha, hollow) {
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px(x), py(y), 2.4, 0, 2 * Math.PI);
    if (hollow) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); }
    else { ctx.fillStyle = color; ctx.fill(); }
  }

  /* phases, in ms: show plan, move, rest */
  var PLAN = 1100, MOVE = 2400, REST = 1300;

  var shapeIndex = 0;
  var X = shapes[0]();
  var Y, match, start;

  function next() {
    shapeIndex = (shapeIndex + 1) % shapes.length;
    Y = shapes[shapeIndex]();
    match = assign(X, Y);
    start = performance.now();
  }

  function frame(now) {
    var t = now - start;
    ctx.clearRect(0, 0, SIZE, SIZE);
    var i, a, b;

    if (t < PLAN + MOVE) {
      /* transport plan and target cloud */
      var planAlpha = Math.min(1, t / PLAN) * (t < PLAN ? 1 : Math.max(0, 1 - (t - PLAN) / (MOVE * 0.6)));
      ctx.globalAlpha = 0.16 * planAlpha;
      ctx.strokeStyle = POINT;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (i = 0; i < N; i++) {
        a = X[i]; b = Y[match[i]];
        ctx.moveTo(px(a[0]), py(a[1]));
        ctx.lineTo(px(b[0]), py(b[1]));
      }
      ctx.stroke();
      for (i = 0; i < N; i++) dot(Y[i][0], Y[i][1], TARGET, 0.7 * Math.min(1, t / PLAN), true);
    }

    var s = t < PLAN ? 0 : ease(Math.min(1, (t - PLAN) / MOVE));
    for (i = 0; i < N; i++) {
      a = X[i]; b = Y[match[i]];
      dot(a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1]), POINT, 0.85, false);
    }
    ctx.globalAlpha = 1;

    if (t >= PLAN + MOVE + REST) {
      X = Y;
      next();
    }
    rafId = requestAnimationFrame(frame);
  }

  /* ---------- run only while visible ---------- */
  var onScreen = true, rafId = 0, pausedAt = 0;

  function shouldRun() {
    return onScreen && !document.hidden && canvas.offsetParent !== null;
  }

  function update() {
    var now = performance.now();
    if (shouldRun() && !rafId) {
      start += now - pausedAt;
      rafId = requestAnimationFrame(frame);
    } else if (!shouldRun() && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      pausedAt = now;
    }
  }

  var still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  next();

  /* Reduced motion: one still frame showing a transport plan */
  if (still) {
    frame(start + PLAN * 0.99);
    cancelAnimationFrame(rafId);
    return;
  }

  pausedAt = performance.now();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      update();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', update);
  window.addEventListener('resize', update);
  update();
})();
