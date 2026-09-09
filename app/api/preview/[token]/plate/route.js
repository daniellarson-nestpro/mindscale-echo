import { loadPreviewDraft } from '../../../../../lib/preview-draft';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The letterhead PLATE — the customer sees their release on their own
 * letterhead before paying, but only ever as a flat image. No letterhead HTML,
 * no print stylesheet, and no PDF are reachable before payment; those live on
 * /release/:id behind a 402.
 *
 * ⚠️ STUB: production should be a headless browser render of the real
 * letterhead template at ~900px, returned as PNG (see the backend contract:
 * `GET /preview/:token/plate.png`). This route returns SVG so the screen is
 * reviewable now without a headless dependency in the sandbox.
 *
 * Two deliberate properties to preserve when swapping in the real render:
 *  - modest resolution — it must be useless for printing or sending to an
 *    editor, which is what makes showing it safe
 *  - no watermark — it's the customer's own document; a watermark would
 *    cheapen the exact moment we're trying to create
 */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Naive greedy wrap — enough for a fixed-width plate. */
function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length > max) {
      lines.push(line.trim());
      line = w;
    } else {
      line = `${line} ${w}`;
    }
  });
  if (line.trim()) lines.push(line.trim());
  return lines;
}

export async function GET(_request, { params }) {
  // Saved n8n compose JSON via loadPreviewDraft; no n8n call and no PNG renderer.
  const d = await loadPreviewDraft(params?.token);

  const W = 900;
  const H = 1165; // 8.5:11
  const PAD = 88;
  const COL = 74; // characters per line at 11.5pt-equivalent

  let y = PAD;
  const out = [];

  // Letterhead band
  out.push(
    `<text x="${PAD}" y="${y + 14}" font-family="Georgia, serif" font-size="21" font-variant="small-caps" fill="#111">${esc(
      d.companyName
    )}</text>`
  );
  if (d.website) {
    out.push(
      `<text x="${W - PAD}" y="${y + 14}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#555">${esc(
        d.website
      )}</text>`
    );
  }
  y += 34;
  out.push(`<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="#111" stroke-width="1"/>`);
  y += 30;

  out.push(
    `<text x="${PAD}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="11" letter-spacing="1.1" fill="#111">FOR IMMEDIATE RELEASE</text>`
  );
  y += 44;

  // Headline
  wrap(d.headline, 46).forEach((line) => {
    out.push(
      `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="27" font-weight="bold" fill="#111">${esc(
        line
      )}</text>`
    );
    y += 33;
  });

  y += 6;
  if (d.subhead) {
    wrap(d.subhead, 62).forEach((line) => {
      out.push(
        `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="16" font-style="italic" fill="#333">${esc(
          line
        )}</text>`
      );
      y += 23;
    });
  }

  y += 26;

  // Dateline runs into the first paragraph, AP style.
  const firstPara = Array.isArray(d.bodyParagraphs) ? d.bodyParagraphs[0] || '' : '';
  const first = `${d.dateline} — ${firstPara}`;
  wrap(first, COL).forEach((line, i) => {
    const bold = i === 0;
    out.push(
      `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="15" fill="#111"${
        bold ? ' font-weight="bold"' : ''
      }>${esc(line)}</text>`
    );
    y += 24;
  });

  y += 14;
  (Array.isArray(d.bodyParagraphs) ? d.bodyParagraphs.slice(1) : []).forEach((p) => {
    wrap(p, COL).forEach((line) => {
      out.push(
        `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="15" fill="#111">${esc(
          line
        )}</text>`
      );
      y += 24;
    });
    y += 14;
  });

  // Quote — its own paragraph, no pull-quote treatment. Press releases
  // don't pull-quote.
  if (d.quote) {
    const quoted = d.quoteAttribution ? `“${d.quote}” — ${d.quoteAttribution}` : `“${d.quote}”`;
    wrap(quoted, COL).forEach((line) => {
      out.push(
        `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="15" fill="#111">${esc(
          line
        )}</text>`
      );
      y += 24;
    });
  }

  // End mark — its absence is noticed by exactly the people we send to.
  y += 22;
  out.push(
    `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#111">###</text>`
  );
  y += 34;

  // About
  out.push(
    `<text x="${PAD}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" letter-spacing="1" fill="#111">ABOUT ${esc(
      d.companyName.toUpperCase()
    )}</text>`
  );
  y += 20;
  wrap(d.boilerplate, 84).forEach((line) => {
    out.push(
      `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="13" fill="#333">${esc(
        line
      )}</text>`
    );
    y += 20;
  });

  // Media contact
  y += 18;
  out.push(
    `<text x="${PAD}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="10.5" letter-spacing="1" fill="#111">MEDIA CONTACT</text>`
  );
  y += 20;
  [d.contactName, d.contactEmail, d.phone].filter(Boolean).forEach((line) => {
    out.push(
      `<text x="${PAD}" y="${y}" font-family="Georgia, serif" font-size="13" fill="#333">${esc(
        line
      )}</text>`
    );
    y += 19;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Press release on company letterhead">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${out.join('\n  ')}
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'private, no-store',
    },
  });
}
