/**
 * Builds a single self-contained HTML preview of a rendered page for review.
 *
 * Inlines the compiled Tailwind CSS, drops the Next.js runtime (so no
 * hydration), then re-attaches the interactive pieces as plain scripts read
 * from the same source modules the app uses — the broadcast animation is not
 * duplicated here, it's inlined verbatim from lib/broadcast.js.
 *
 * Preview/QA tool only. Not part of the production build.
 *
 * Usage: node scripts/make-preview.js [path] [outfile] [origin]
 */
const fs = require('fs');
const path = require('path');

const pagePath = process.argv[2] || '/';
const out = process.argv[3] || 'preview.html';
const origin = process.argv[4] || 'http://localhost:3111';

/** Strip ESM syntax so a module can run inside a plain <script>. */
function toPlainScript(file) {
  return fs
    .readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^\s*import[^;]+;$/gm, '')
    .replace(/^export\s+/gm, '');
}

const BOOTSTRAP = `
(function () {
  document.querySelectorAll('[data-broadcast]').forEach(function (wrap) {
    var c = wrap.querySelector('canvas');
    if (c) startBroadcast(c, wrap);
  });

  // Odometers
  document.querySelectorAll('[data-odometer]').forEach(function (el) {
    var target = parseInt(el.getAttribute('data-odometer'), 10);
    var suffix = el.getAttribute('data-suffix') || '';
    var ran = false;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || ran) return;
      ran = true;
      var t0 = performance.now();
      (function step(now) {
        var p = Math.min((now - t0) / 1100, 1);
        var e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = Math.round(e * target).toLocaleString('en-US') + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(el);
  });

  // Sticky buy bar
  var bar = document.querySelector('.sticky-buy');
  if (bar) {
    var evaluate = function () {
      var max = document.body.scrollHeight - window.innerHeight;
      var past = max > 0 ? window.scrollY / max : 0;
      var pricing = document.getElementById('pricing');
      var visible = false;
      if (pricing) {
        var r = pricing.getBoundingClientRect();
        visible = r.top < window.innerHeight && r.bottom > 0;
      }
      var show = past > 0.12 && past < 0.94 && !visible;
      bar.style.transform = show ? 'translateY(0)' : 'translateY(140%)';
      bar.style.opacity = show ? '1' : '0';
    };
    evaluate();
    window.addEventListener('scroll', evaluate, { passive: true });
  }

  // Scroll reveals
  document.documentElement.classList.add('js');
  var ro = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); ro.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(function (n) {
    if (n.getBoundingClientRect().top < window.innerHeight * 0.92) n.classList.add('is-visible');
    else ro.observe(n);
  });
})();
`;

async function main() {
  const html = await (await fetch(origin + pagePath)).text();

  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)].map(
    (m) => m[1]
  );
  const cssParts = [];
  for (const href of hrefs) {
    const url = href.startsWith('http') ? href : origin + href;
    cssParts.push(await (await fetch(url)).text());
  }

  let doc = html
    .replace(/<link[^>]+rel="stylesheet"[^>]+href="[^"]+\.css"[^>]*\/?>/g, '')
    .replace(/<link[^>]+rel="preload"[^>]+as="script"[^>]*\/?>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');

  const runtime = [toPlainScript('lib/geo.js'), toPlainScript('lib/broadcast.js')].join('\n');

  doc = doc.replace('</head>', `<style>${cssParts.join('\n')}</style></head>`);
  doc = doc.replace('</body>', `<script>${runtime}\n${BOOTSTRAP}</script></body>`);

  fs.writeFileSync(out, doc);
  console.log(`wrote ${out} (${(doc.length / 1024).toFixed(0)} kB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
