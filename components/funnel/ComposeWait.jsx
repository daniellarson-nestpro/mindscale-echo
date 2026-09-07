'use client';

import { useEffect, useState } from 'react';
import { COMPOSE } from '../../lib/funnel';
import { ArrowUpRight } from '../Icons';

/**
 * The 5–20 seconds after a ten-minute form. This is the highest-stakes loading
 * state in the funnel — the moment they find out whether it was worth it — so
 * it shows a letterhead drawing itself rather than a spinner. Their logo
 * landing in the corner in the first second is the reassuring frame.
 *
 * At ~22s it offers an exit instead of a fourth fake stage: trapped-waiting
 * becomes chosen-waiting.
 */
export default function ComposeWait({ onDone, onCancel }) {
  const [stage, setStage] = useState(0);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failError, setFailError] = useState('');

  useEffect(() => {
    const stages = [
      setTimeout(() => setStage(1), 4000),
      setTimeout(() => setStage(2), 8000),
    ];
    const slowTimer = setTimeout(() => setSlow(true), 22000);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/brief/complete', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        // /api/brief/complete returns a written `message` alongside its error
        // code. Preferring the code meant customers read "insufficient_article".
        if (!res.ok || data.ok !== true) {
          const human = data.message || COMPOSE.errors[data.error] || '';
          const err = new Error(human || 'compose failed');
          err.explained = Boolean(human);
          throw err;
        }
        onDone?.(data.token);
      } catch (err) {
        if (!cancelled) {
          setFailError(err?.explained ? err.message : '');
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      stages.forEach(clearTimeout);
      clearTimeout(slowTimer);
    };
  }, [onDone]);

  if (failed) {
    return (
      <div className="bezel">
        <div className="bezel-core p-8 text-center sm:p-12">
          <h1 className="text-[1.8rem] leading-tight sm:text-[2.2rem]">{COMPOSE.failH}</h1>
          <p className="mx-auto mt-4 max-w-md text-[1rem] leading-relaxed text-white/58">
            {COMPOSE.failSub}
          </p>
          {failError ? (
            <p className="mx-auto mt-3 max-w-md text-[0.9rem] leading-relaxed text-white/45">{failError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setFailError('');
              onCancel?.();
            }}
            className="btn btn-primary mx-auto mt-8"
          >
            {COMPOSE.failCta}
            <span className="btn-nib">
              <ArrowUpRight />
            </span>
          </button>
          <p className="mt-6 text-[0.82rem] text-white/35">{COMPOSE.failHelp}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bezel">
      <div className="bezel-core p-8 sm:p-12">
        <div className="mx-auto max-w-[320px]">
          {/* The sheet, typing itself */}
          <div
            className="relative mx-auto aspect-[8.5/11] w-full overflow-hidden rounded-[3px] p-5"
            style={{
              background: 'linear-gradient(170deg, #fdfbf6, #f2ede4)',
              boxShadow: '0 30px 70px -30px rgba(0,0,0,0.9)',
              animation: 'sheet-in 700ms cubic-bezier(0.16,1,0.3,1) both',
            }}
          >
            <div
              className="h-6 w-6 rounded"
              style={{
                background: 'rgba(28,25,20,0.14)',
                animation: 'logo-drop 600ms cubic-bezier(0.16,1,0.3,1) 250ms both',
              }}
            />
            <div
              className="mt-3 h-px w-full"
              style={{ background: 'rgba(28,25,20,0.14)', transformOrigin: 'left', animation: 'rule-in 500ms ease-out 700ms both' }}
            />
            <div className="mt-4 space-y-2">
              {[92, 68].map((w, i) => (
                <span
                  key={`h-${i}`}
                  className="block h-2 rounded-sm"
                  style={{
                    width: `${w}%`,
                    background: 'rgba(28,25,20,0.3)',
                    transformOrigin: 'left',
                    animation: `line-in 520ms ease-out ${900 + i * 160}ms both`,
                  }}
                />
              ))}
            </div>
            <div className="mt-5 space-y-1.5">
              {[96, 88, 94, 72, 90, 60].map((w, i) => (
                <span
                  key={`b-${i}`}
                  className="block h-1 rounded-sm"
                  style={{
                    width: `${w}%`,
                    background: 'rgba(28,25,20,0.16)',
                    transformOrigin: 'left',
                    animation: `line-in 480ms ease-out ${1350 + i * 190}ms both`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="mt-9 text-center font-display text-[1.3rem] text-white/80" aria-live="polite">
          {COMPOSE.stages[stage]}
        </p>

        {slow && (
          <div className="mx-auto mt-6 max-w-md text-center">
            <p className="text-[0.9rem] leading-relaxed text-white/60">{COMPOSE.slowH}</p>
            <p className="mt-2 text-[0.82rem] leading-relaxed text-white/38">{COMPOSE.slowSub}</p>
          </div>
        )}
      </div>
    </div>
  );
}
