'use client';

import { useRef, useState } from 'react';
import { STEP_ARTICLE } from '../../lib/funnel';
import { Check } from '../Icons';

const URLISH = /^(https?:\/\/|www\.)\S+$/i;
const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

/**
 * One box that accepts a link, a PDF, or pasted text and works out which it
 * got. A segmented control would force the owner to classify their situation
 * before acting — they don't know whether the thing in their inbox is "a PDF"
 * or "a link". So: one target, detection, then a confirmation chip.
 *
 * All three named inputs exist in the DOM at all times; two are hidden.
 */
export default function ArticleDrop({ sources, onAdd, onRemove, resolving, error }) {
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const areaRef = useRef(null);

  const classify = (raw) => {
    const text = raw.trim();
    if (!text) return null;
    if (URLISH.test(text) || BARE_DOMAIN.test(text)) return 'url';
    if (text.length > 200) return 'text';
    return 'ambiguous';
  };

  const commit = (raw) => {
    const kind = classify(raw);
    if (!kind) return;
    if (kind === 'ambiguous') {
      setHint(STEP_ARTICLE.ambiguous);
      return;
    }
    setHint(null);
    onAdd(kind === 'url' ? { type: 'url', value: raw.trim() } : { type: 'text', value: raw.trim() });
    setDraft('');
    if (areaRef.current) areaRef.current.style.height = 'auto';
  };

  const takeFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setHint('That needs to be a PDF. If it’s a photo of the clipping, paste the text instead.');
      return;
    }
    setHint(null);
    onAdd({ type: 'file', value: file.name, file });
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
        <p className="field-label mb-3">{STEP_ARTICLE.label}</p>
        <p className="mb-4 text-[0.88rem] leading-relaxed text-white/45">
          {STEP_ARTICLE.dropHint}
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
              if (pasted && pasted.trim().length > 200) {
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
            placeholder={STEP_ARTICLE.placeholder}
            className="field resize-none py-3.5 text-[0.98rem]"
            style={{ minHeight: '3rem' }}
            aria-label={STEP_ARTICLE.label}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a PDF"
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

        <p className="mt-3 text-[0.78rem] leading-relaxed text-white/32">{STEP_ARTICLE.hint}</p>

        {(hint || error) && (
          <p role="alert" className="mt-3 text-[0.82rem] leading-relaxed text-amber-200/80">
            {hint || error}
          </p>
        )}

        {resolving && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-eyebrow text-echo-mint">
            Looking it up…
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
                      {s.display || s.value}
                    </span>
                    {s.meta && (
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-eyebrow text-white/35">
                        {s.meta}
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

        {sources.length > 0 && (
          <button
            type="button"
            onClick={() => areaRef.current?.focus()}
            className="mt-3 text-[0.8rem] text-echo-mint/80 transition-colors duration-300 hover:text-echo-mint"
          >
            {STEP_ARTICLE.addAnother}
          </button>
        )}

        {/* Locked field names. Two are always hidden; all three are submitted. */}
        <input
          type="hidden"
          name="articleUrl"
          value={sources.find((s) => s.type === 'url')?.value || ''}
        />
        <textarea
          name="articleText"
          hidden
          readOnly
          value={sources.find((s) => s.type === 'text')?.value || ''}
        />
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
