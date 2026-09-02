/**
 * Builds a single self-contained HTML preview of the rendered landing page.
 * Inlines the compiled Tailwind CSS, drops the Next.js runtime scripts, and
 * relies on the no-JS reveal fallback so every section renders visible.
 *
 * Usage: node scripts/make-preview.js [origin] [outfile]
 */
const fs = require('fs');

const origin = process.argv[2] || 'http://localhost:3111';
const out = process.argv[3] || 'preview.html';

async function main() {
  const html = await (await fetch(origin + '/')).text();

  const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/g)].map(
    (m) => m[1]
  );
  const cssParts = [];
  for (const href of hrefs) {
    const url = href.startsWith('http') ? href : origin + href;
    cssParts.push(await (await fetch(url)).text());
  }

  let doc = html
    // strip Next's own stylesheet links (now inlined) and all runtime scripts
    .replace(/<link[^>]+rel="stylesheet"[^>]+href="[^"]+\.css"[^>]*\/?>/g, '')
    .replace(/<link[^>]+rel="preload"[^>]+as="script"[^>]*\/?>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');

  doc = doc.replace('</head>', `<style>${cssParts.join('\n')}</style></head>`);

  fs.writeFileSync(out, doc);
  console.log(`wrote ${out} (${(doc.length / 1024).toFixed(0)} kB, ${cssParts.length} stylesheet(s))`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
