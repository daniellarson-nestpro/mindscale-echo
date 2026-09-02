'use client';

import { useEffect, useRef } from 'react';
import { startBroadcast } from '../lib/broadcast';

/**
 * "The Broadcast" — a local signal igniting and propagating through a
 * continental node lattice, throwing arcs to media hubs and lifting four nodes
 * into the AI discovery layer.
 *
 * All animation lives in lib/broadcast.js so the static preview can run the
 * identical code. This component is just the mount point.
 */
export default function BroadcastHero({ className = '' }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return undefined;
    return startBroadcast(canvasRef.current, wrapRef.current);
  }, []);

  return (
    <div
      ref={wrapRef}
      data-broadcast
      className={`relative h-[260px] w-full sm:h-[340px] lg:h-[520px] ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
