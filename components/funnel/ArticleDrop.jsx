'use client';

import { useRef, useState } from 'react';
import { Check } from '../Icons';

const MIN_PASTE_LENGTH = 100;

/**
 * V1 article intake: PDF upload or pasted text only.
 * URL scraping is not an active path for V1 and is not presented to users.
 * If text is too short we show a truthful error rather than proceeding.
 */
export default function ArticleDrop({ sources, onAdd, onRemove, error }) {
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef(null);
  const areaRef = useRef(null);

  const commit = (raw) => {
    const text = raw.trim();
    if (!text) return;
    if (text.length < MIN_PASTE_LENGTH) {
      setHint(
        `That looks too short for a factual press release (minimum ${MIN_PASTE_LENGTH} characters). Please paste more of the article or upload the full PDF.`
      );
      return;
    }
    setHint(null);
    onAdd({ type: 'text', value: text });
    setDraft('');
    if (areaRef.current) areaRef.current.style.height = 'auto';
  };

  /**
   * The PDF's words are what the release is written from, so the file goes to
   * the server for extraction and the source carries the text back. Attaching
   * the File alone would leave the brief with nothing but a filename.
   */
  const takeFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setHint('That needs to be a PDF. If you have the text, paste it instead.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setHint('PDF must be under 20 MB.');
      return;
    }

    setHint(null);
    setReading(true);
    try {
      const body = new FormData();
      body.append('article', file);
      const res = await fetch('/api/article/upload', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok !== true || !data.text) {
        throw new Error(data.error || 'We could not read that PDF. Please paste the article text instead.');
      }
      onAdd({
        type: 'file',
        value: file.name,
        text: data.text,
        meta: `${data.words.toLocaleString()} words · PDF`,
      });
    } catch (err) {
      setHint(err?.message || 'We could not read that PDF. Please paste the article text instead.');
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = ''; // let the same file be retried
    }
  };

  const grow = (el) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          takeFile(e.dataTransfer.files?.[0]);
        }}
        className="rounded-[1.5rem] p-5 transition-all duration-500 ease-haptic sm:p-6"
        style={{
          background: 'rgba(255,255,255,0.022)',
          boxShadow: dragging
            ? 'inset 0 0 0 1px rgba(127,240,192,0.55)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.09)',
        }}
      >
        <p className="field-label mb-3">News article or announcement</p>
        <p className="mb-4 text-[0.88rem] leading-relaxed text-white/45">
          Paste the article text or attach a PDF. We use this as the factual basis for your
          press release.
        </p>

        <div className="flex items-end gap-2">
          <textarea
            ref={areaRef}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              grow(e.target);
              if (hint) setHint(null);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted && pasted.trim().length >= MIN_PASTE_LENGTH) {
                e.preventDefault();
                commit(pasted);
              }
            }}
            onBlur={() => draft && commit(draft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit(draft);
              }
            }}
            placeholder="Paste article text here…"
            className="field resize-none py-3.5 text-[0.98rem]"
            style={{ minHeight: '3rem' }}
            aria-label="Article text"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={reading}
            aria-label="Attach a PDF"
            aria-busy={reading}
            title={reading ? 'Reading your PDF…' : 'Upload PDF'}
            className="mb-[0.15rem] flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white/55 transition-all duration-500 ease-haptic hover:text-white"
            style={{
              background: 'rgba(255,255,255,0.04)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M20.4 11.6 12.2 19.8a4.6 4.6 0 0 1-6.5-6.5l8.2-8.2a3 3 0 0 1 4.3 4.3l-8.2 8.2a1.4 1.4 0 0 1-2-2l7.5-7.5" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-[0.78rem] leading-relaxed text-white/32">
          PDF or pasted text only. Minimum {MIN_PASTE_LENGTH} characters of article content.
        </p>

        {reading && (
          <p aria-live="polite" className="mt-3 text-[0.82rem] leading-relaxed text-white/55">
            Reading your PDF…
          </p>
        )}

        {!reading && (hint || error) && (
          <p role="alert" className="mt-3 text-[0.82rem] leading-relaxed text-amber-200/80">
            {hint || error}
          </p>
        )}

        {sources.length > 0 && (
          <ul className="mt-4 space-y-2">
            {sources.map((s, i) => (
              <li
                key={`${s.type}-${i}`}
                className="flex items-start justify-between gap-3 rounded-2xl px-4 py-3"
                style={{
                  background: 'rgba(127,240,192,0.06)',
                  boxShadow: 'inset 0 0 0 1px rgba(127,240,192,0.26)',
                }}
              >
                <span className="flex items-start gap-2.5">
                  <span className="mt-[0.15rem] text-echo-mint">
                    <Check width={13} height={13} />
                  </span>
                  <span>
                    <span className="block text-[0.88rem] leading-snug text-white/85">
                      {s.type === 'file' ? s.value : s.value.slice(0, 80) + (s.value.length > 80 ? '…' : '')}
                    </span>
                    {s.meta && (
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                        {s.meta}
                      </span>
                    )}
                    {s.type === 'text' && (
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                        {s.value.length} characters · pasted text
                      </span>
                    )}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label="Remove this source"
                  className="shrink-0 text-white/35 transition-colors duration-300 hover:text-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* This form is never natively submitted — BriefForm persists through
            PATCH /api/brief — so there are deliberately no hidden mirror fields
            here. Earlier ones silently went nowhere. */}
        <input
          ref={fileRef}
          type="file"
          name="articleFile"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => takeFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
