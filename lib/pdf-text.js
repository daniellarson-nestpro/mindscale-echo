/**
 * Minimal, dependency-free PDF text extraction.
 *
 * Customers upload the PDF of a news article and we need its words. That is a
 * narrow job: digitally-generated article PDFs keep their text in Flate-encoded
 * content streams, and Node ships zlib, so the whole feature is a stream walk
 * plus a text-operator parse. A PDF library would be several megabytes of
 * dependency for a fraction of its surface — and could not be verified here at
 * all, since this repo has no installed node_modules.
 *
 * What this does NOT do, deliberately: scanned/photographed PDFs have no text
 * layer and no amount of parsing invents one, and CID-keyed fonts with custom
 * CMaps encode glyph ids rather than characters. Both are detected and reported
 * as `no_text_layer` so the customer is told to paste instead — an honest
 * failure, never a page of mojibake handed to the press-release writer.
 *
 * Server-only (uses node:zlib).
 */

import { inflateSync } from 'node:zlib';

/** A single stream this large is already far past any real article. */
const MAX_STREAM_BYTES = 16 * 1024 * 1024;
/**
 * Extraction cap. LIMITS.articleText in lib/leads.js clips storage at 50k, so
 * there is no point shipping more than that across the wire; the headroom just
 * avoids truncating before the clip does.
 */
const MAX_TEXT_CHARS = 60_000;

/** TJ kerning more negative than this reads as a word gap rather than tracking. */
const WORD_GAP_THRESHOLD = -150;

export function isPdf(buffer) {
  if (!buffer || buffer.length < 5) return false;
  // The header is allowed a little leading junk by every real-world reader.
  const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
  return head.includes('%PDF-');
}

/**
 * Pull out every `stream ... endstream` payload, inflating the ones that are
 * Flate-encoded. The filter dictionary is not parsed: trying to inflate and
 * falling back to the raw bytes handles `/FlateDecode`, `[/FlateDecode]` and
 * uncompressed streams identically, and cleanly ignores image codecs.
 */
function rawStreams(buffer) {
  const out = [];
  const STREAM = Buffer.from('stream', 'latin1');
  const ENDSTREAM = Buffer.from('endstream', 'latin1');

  let at = 0;
  while (at < buffer.length) {
    const start = buffer.indexOf(STREAM, at);
    if (start === -1) break;

    // Skip `endstream`, which contains `stream` as a substring.
    if (start >= 3 && buffer.subarray(start - 3, start).toString('latin1') === 'end') {
      at = start + 6;
      continue;
    }

    let from = start + STREAM.length;
    if (buffer[from] === 0x0d) from += 1; // CR
    if (buffer[from] === 0x0a) from += 1; // LF

    const end = buffer.indexOf(ENDSTREAM, from);
    if (end === -1) break;
    at = end + ENDSTREAM.length;

    const body = buffer.subarray(from, end);
    if (!body.length || body.length > MAX_STREAM_BYTES) continue;

    try {
      const inflated = inflateSync(body);
      if (inflated.length <= MAX_STREAM_BYTES) out.push(inflated);
    } catch {
      out.push(body); // not Flate — an uncompressed content stream, or an image
    }
  }
  return out;
}

/** Content streams are the only ones worth parsing; images and fonts are not. */
function looksLikeContent(stream) {
  const head = stream.subarray(0, Math.min(stream.length, 4096)).toString('latin1');
  return /\bBT\b/.test(head) || /\bTJ?\b/.test(head);
}

/**
 * Read a PDF literal string starting at the opening `(`.
 * Returns [text, indexAfterClosingParen].
 */
function readLiteral(src, open) {
  let i = open + 1;
  let depth = 1;
  let out = '';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      if (next === undefined) break;
      if (next >= '0' && next <= '7') {
        let oct = '';
        let k = i + 1;
        while (k < src.length && oct.length < 3 && src[k] >= '0' && src[k] <= '7') {
          oct += src[k];
          k += 1;
        }
        out += String.fromCharCode(parseInt(oct, 8));
        i = k;
        continue;
      }
      if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 't') out += '\t';
      else if (next === 'b') out += '\b';
      else if (next === 'f') out += '\f';
      else if (next === '\n') { /* line continuation */ }
      else if (next === '\r') {
        if (src[i + 2] === '\n') i += 1;
      } else out += next;
      i += 2;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return [out, i + 1];
    }
    out += ch;
    i += 1;
  }
  return [out, src.length];
}

/** Read a PDF hex string starting at `<`. Returns [text, indexAfterClose]. */
function readHex(src, open) {
  const close = src.indexOf('>', open + 1);
  const end = close === -1 ? src.length : close;
  const digits = src.slice(open + 1, end).replace(/[^0-9a-fA-F]/g, '');
  const padded = digits.length % 2 ? `${digits}0` : digits;
  let out = '';
  for (let i = 0; i < padded.length; i += 2) {
    out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
  }
  return [out, end + 1];
}

/**
 * Walk one content stream, emitting the strings that text operators show.
 * `Tj`/`'`/`"` draw the pending string; `TJ` draws an array of strings with
 * kerning between them; `Td`/`TD`/`T*`/`'`/`"` begin a new line.
 */
function textFromContent(stream) {
  const src = stream.toString('latin1');
  let out = '';
  let pending = [];
  let token = '';

  const flush = () => {
    if (pending.length) out += pending.join('');
    pending = [];
  };

  for (let i = 0; i < src.length; ) {
    const ch = src[i];

    if (ch === '(') {
      const [text, next] = readLiteral(src, i);
      pending.push(text);
      i = next;
      token = '';
      continue;
    }
    if (ch === '<' && src[i + 1] !== '<') {
      const [text, next] = readHex(src, i);
      pending.push(text);
      i = next;
      token = '';
      continue;
    }
    // A large negative kern inside a TJ array is how PDFs render a space.
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let k = i;
      let num = '';
      while (k < src.length && /[-0-9.]/.test(src[k])) {
        num += src[k];
        k += 1;
      }
      if (pending.length && Number(num) <= WORD_GAP_THRESHOLD) pending.push(' ');
      i = k;
      token = '';
      continue;
    }

    if (/[A-Za-z*'"]/.test(ch)) {
      token += ch;
      i += 1;
      const after = src[i];
      if (after !== undefined && /[A-Za-z*'"]/.test(after)) continue;

      if (token === 'Tj' || token === 'TJ') flush();
      else if (token === "'" || token === '"') {
        out += '\n';
        flush();
      } else if (token === 'Td' || token === 'TD' || token === 'T*') {
        flush();
        out += '\n';
      } else if (token === 'ET' || token === 'BT') {
        flush();
        out += '\n';
      }
      token = '';
      continue;
    }

    token = '';
    i += 1;
  }
  flush();
  return out;
}

/** Collapse the ragged whitespace that per-operator emission produces. */
function tidy(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * True when the decoded bytes are glyph ids rather than characters — the
 * signature of a CID font we cannot map without its embedded CMap.
 */
function looksLikeMojibake(text) {
  if (!text) return true;
  let readable = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    // Letters, digits, punctuation, whitespace, and Latin-1 accented forms.
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126) || (c >= 160 && c <= 255)) {
      readable += 1;
    }
  }
  return readable / text.length < 0.8;
}

/**
 * Extract readable text from a PDF buffer.
 * Returns { ok: true, text } or { ok: false, reason } where reason is one of
 * `not_pdf` | `no_text_layer` | `unreadable`.
 */
export function extractPdfText(buffer) {
  if (!isPdf(buffer)) return { ok: false, reason: 'not_pdf' };

  let collected = '';
  try {
    for (const stream of rawStreams(buffer)) {
      if (!looksLikeContent(stream)) continue;
      collected += `${textFromContent(stream)}\n`;
      if (collected.length > MAX_TEXT_CHARS) break;
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const text = tidy(collected).slice(0, MAX_TEXT_CHARS);
  // A press release needs prose. A handful of stray glyphs is a scan, not text.
  if (text.replace(/\s/g, '').length < 40) return { ok: false, reason: 'no_text_layer' };
  if (looksLikeMojibake(text)) return { ok: false, reason: 'no_text_layer' };

  return { ok: true, text };
}
