/**
 * Minimal dependency-free markdown renderer for the legal pages. Handles
 * h1/h2/h3, paragraphs, bold, italic, inline code, links, bullet lists, pipe
 * tables, blockquotes, and horizontal rules — everything the documents use.
 */

/* ---------- inline ---------- */

function inline(text, keyPrefix) {
  const nodes = [];
  // Order matters: links, then bold, then italic, then code.
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|(?<!\*)\*([^*]+)\*(?!\*)|`([^`]+)`/g;
  let last = 0;
  let m;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-i${i++}`;

    if (m[1] !== undefined) {
      const href = m[2];
      const external = /^https?:\/\//.test(href);
      nodes.push(
        <a
          key={key}
          href={href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="text-echo-mint underline decoration-echo-mint/30 underline-offset-4 transition-colors duration-500 hover:decoration-echo-mint"
        >
          {m[1]}
        </a>
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <strong key={key} className="font-medium text-white">
          {m[3]}
        </strong>
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <em key={key} className="italic text-white/55">
          {m[4]}
        </em>
      );
    } else if (m[5] !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-echo-mint ring-1 ring-inset ring-white/10"
        >
          {m[5]}
        </code>
      );
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ---------- blocks ---------- */

function splitRow(row) {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function LegalDoc({ markdown }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push(<div key={`k${k++}`} className="rule my-12" />);
      i++;
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = h[2];
      if (level === 1) {
        out.push(
          <h1
            key={`k${k++}`}
            className="font-display text-[2.6rem] leading-[0.98] tracking-[-0.03em] text-white sm:text-[3.2rem]"
          >
            {inline(content, `k${k}`)}
          </h1>
        );
      } else if (level === 2) {
        out.push(
          <h2
            key={`k${k++}`}
            id={slug(content)}
            className="mt-14 scroll-mt-28 font-display text-[1.6rem] leading-tight tracking-[-0.025em] text-white sm:text-[1.85rem]"
          >
            {inline(content, `k${k}`)}
          </h2>
        );
      } else {
        out.push(
          <h3 key={`k${k++}`} className="mt-9 text-[1.05rem] font-medium tracking-[-0.01em] text-white">
            {inline(content, `k${k}`)}
          </h3>
        );
      }
      i++;
      continue;
    }

    if (line.startsWith('> ')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote
          key={`k${k++}`}
          className="my-8 rounded-2xl border-l-2 border-echo-mint/40 bg-white/[0.03] px-6 py-5 text-[0.95rem] leading-relaxed text-white/60"
        >
          {buf
            .filter((b) => b.trim())
            .map((b, n) => (
              <p key={n} className={n ? 'mt-3' : ''}>
                {inline(b, `k${k}-${n}`)}
              </p>
            ))}
        </blockquote>
      );
      continue;
    }

    if (line.trim().startsWith('|') && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? '')) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(
        <div key={`k${k++}`} className="my-8 overflow-x-auto rounded-2xl ring-1 ring-inset ring-white/10">
          <table className="w-full border-collapse text-left text-[0.9rem]">
            <thead>
              <tr className="bg-white/[0.04]">
                {head.map((c, n) => (
                  <th
                    key={n}
                    className="whitespace-nowrap px-5 py-3.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-echo-mint"
                  >
                    {inline(c, `th${n}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n} className="border-t border-white/[0.07]">
                  {r.map((c, m2) => (
                    <td key={m2} className="px-5 py-3.5 align-top text-white/65">
                      {inline(c, `td${n}-${m2}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      out.push(
        <ul key={`k${k++}`} className="mt-5 space-y-2.5">
          {items.map((it, n) => (
            <li key={n} className="relative pl-6 leading-relaxed text-white/65">
              <span className="absolute left-0 top-[0.7em] h-1 w-1 rounded-full bg-echo-mint/70" />
              {inline(it, `li${k}-${n}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph: consume until a blank line or the next block starter.
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|[-*]\s|>\s|---+$)/.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={`k${k++}`} className="mt-5 leading-relaxed text-white/65">
        {inline(para.join(' '), `p${k}`)}
      </p>
    );
  }

  return <div className="text-[1rem]">{out}</div>;
}
