'use client';

import { useRef, useState } from 'react';
import { FIELDS } from '../../lib/funnel';
import { Check } from '../Icons';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 2000;
// SVG is deliberately absent: blobs are served public with their own
// content-type, so a script-bearing SVG would be stored XSS on the blob origin.
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Downscales client-side before upload so the 5MB server cap never fires.
 * The copy invites owners to photograph their sign, and an iPhone photo of a
 * sign is routinely 6-8MB — without this, we'd be bouncing customers for
 * doing exactly what we told them to do. An 8MB photo lands around 400KB.
 */
async function downscale(file) {
  if (typeof createImageBitmap === 'undefined') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_EDGE && file.size <= MAX_BYTES) return file;

    const scale = Math.min(1, MAX_EDGE / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, hasAlpha ? 'image/png' : 'image/jpeg', 0.86)
    );
    if (!blob) return file;

    const ext = hasAlpha ? 'png' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

export default function LogoUpload({ onChange, error: serverError = null }) {
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);
  const inputRef = useRef(null);

  async function take(file) {
    if (!file) return;
    setError(null);

    if (!OK_TYPES.includes(file.type)) {
      setError(FIELDS.logo.wrongType);
      return;
    }

    setWorking(true);
    const processed = await downscale(file);

    if (processed.size > MAX_BYTES) {
      setWorking(false);
      setError(FIELDS.logo.tooBig);
      return;
    }

    const previewUrl = URL.createObjectURL(processed);
    setPicked({
      name: processed.name,
      size: processed.size,
      shrunk: processed.size < file.size,
      url: previewUrl,
      uploading: true,
    });

    try {
      const form = new FormData();
      form.append('logo', processed);
      const res = await fetch('/api/logo', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPicked(null);
        setError(data.error || 'Logo upload failed. Please try again.');
        return;
      }
      setPicked({
        name: data.name || processed.name,
        size: data.size || processed.size,
        shrunk: processed.size < file.size,
        url: data.logoUrl || previewUrl,
        uploading: false,
      });
      onChange?.(processed);
    } catch {
      setPicked(null);
      setError('Logo upload failed. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);

  return (
    <div>
      <span className="field-label">{FIELDS.logo.label}</span>

      {picked ? (
        <div
          className="flex items-center gap-4 rounded-2xl px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.028)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={picked.url}
            alt=""
            className="h-12 w-12 rounded-xl object-contain"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[0.88rem] text-white/85">
              <span className="text-echo-mint">
                <Check width={13} height={13} />
              </span>
              <span className="truncate">{picked.name}</span>
            </span>
            <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-eyebrow text-white/32">
              {picked.uploading
                ? 'Uploading…'
                : `${kb(picked.size)}${picked.shrunk ? ' · resized for upload' : ''}`}
            </span>
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 text-[0.8rem] text-echo-mint/85 transition-colors duration-300 hover:text-echo-mint"
          >
            {FIELDS.logo.replace}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left transition-all duration-500 ease-haptic"
          style={{
            background: dragging ? 'rgba(127,240,192,0.06)' : 'rgba(255,255,255,0.022)',
            boxShadow: `inset 0 0 0 1px ${
              dragging ? 'rgba(127,240,192,0.5)' : 'rgba(255,255,255,0.09)'
            }`,
          }}
        >
          <span className="text-[0.9rem] text-white/55">
            {working ? 'Uploading…' : FIELDS.logo.drop}
          </span>
          <span className="btn-nib" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.15"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          </span>
        </button>
      )}

      <p className="mt-2 text-[0.78rem] leading-relaxed text-white/32">{FIELDS.logo.hint}</p>

      {(error || serverError) && (
        <p role="alert" className="mt-2 text-[0.82rem] leading-relaxed text-amber-200/85">
          {error || serverError}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}
