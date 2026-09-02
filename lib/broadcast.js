/**
 * Framework-free broadcast animation.
 *
 * Single source of truth: the React component (components/BroadcastHero.jsx)
 * and the static preview generator (scripts/make-preview.js) both run this.
 * Keep it free of framework imports so the preview can inline it verbatim.
 */
import { US_OUTLINE, HUBS, ORIGIN, AI_NODES } from './geo';

const LOOP = 6.5;

const easeOutQuart = (p) => 1 - Math.pow(1 - p, 4);
const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Rasterize the silhouette once and sample its interior for node positions. */
function sampleNodes(step) {
  const W = 300;
  const H = 190;
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const g = off.getContext('2d', { willReadFrequently: true });

  g.fillStyle = '#fff';
  g.beginPath();
  US_OUTLINE.forEach(([x, y], i) => {
    const px = x * W;
    const py = y * H;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
  g.fill();

  const { data } = g.getImageData(0, 0, W, H);
  const nodes = [];
  for (let y = 2; y < H; y += step) {
    for (let x = 2; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) {
        const nx = (x + (Math.random() - 0.5) * 2.6) / W;
        const ny = (y + (Math.random() - 0.5) * 2.6) / H;
        nodes.push({
          x: nx,
          y: ny,
          d: Math.hypot(nx - ORIGIN.x, ny - ORIGIN.y),
          delay: Math.random() * 0.12, // ragged front = word of mouth, not radar
          r: 1.1 + Math.random() * 0.5,
          at: -1,
        });
      }
    }
  }
  return nodes;
}

/** Mounts the loop. Returns a teardown function. */
export function startBroadcast(canvas, wrap) {

  if (!canvas || !wrap) return undefined;

  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let compact = window.innerWidth < 768;
  let nodes = sampleNodes(compact ? 9 : 6);
  let hubs = (compact ? HUBS.slice(0, 5) : HUBS).map((h) => ({
    ...h,
    d: Math.hypot(h.x - ORIGIN.x, h.y - ORIGIN.y),
    at: -1,
  }));

  let W = 0;
  let H = 0;
  let raf = 0;
  let start = performance.now();
  let running = true;
  let lastLoop = 0;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = wrap.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nextCompact = window.innerWidth < 768;
    if (nextCompact !== compact) {
      compact = nextCompact;
      nodes = sampleNodes(compact ? 9 : 6);
      hubs = (compact ? HUBS.slice(0, 5) : HUBS).map((h) => ({
        ...h,
        d: Math.hypot(h.x - ORIGIN.x, h.y - ORIGIN.y),
        at: -1,
      }));
    }
  };

  // Map occupies the lower band; the top is reserved for the AI lift.
  const rect = () => {
    const top = compact ? 0.16 : 0.26;
    return { x: W * 0.03, y: H * top, w: W * 0.94, h: H * (0.97 - top) };
  };
  const px = (nx) => rect().x + nx * rect().w;
  const py = (ny) => rect().y + ny * rect().h;

  const drawArc = (from, to, progress, alpha, color) => {
    const x1 = px(from.x);
    const y1 = py(from.y);
    const x2 = px(to.x);
    const y2 = py(to.y);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const chord = Math.hypot(x2 - x1, y2 - y1);
    // Lift the control point perpendicular so arcs bow up off the plane.
    const cx = mx;
    const cy = my - chord * 0.22;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (progress >= 1) {
      ctx.quadraticCurveTo(cx, cy, x2, y2);
    } else {
      // Walk the curve to the current progress point.
      const steps = 24;
      const end = Math.max(1, Math.round(steps * progress));
      for (let i = 1; i <= end; i += 1) {
        const s = i / steps;
        const ix = (1 - s) * (1 - s) * x1 + 2 * (1 - s) * s * cx + s * s * x2;
        const iy = (1 - s) * (1 - s) * y1 + 2 * (1 - s) * s * cy + s * s * y2;
        ctx.lineTo(ix, iy);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  /**
   * Draws an outlet label with a hairline leader back to its node.
   * opts: { dx, dy, align } — explicit placement, so labels in the dense
   * north-east cluster fan out instead of stacking on each other.
   */
  const label = (text, x, y, alpha, color, opts = {}) => {
    if (alpha <= 0.01) return;
    let align = opts.align || (x > W * 0.72 ? 'right' : 'left');
    let dx = opts.dx != null ? opts.dx : align === 'right' ? -10 : 10;
    const dy = opts.dy != null ? opts.dy : 0;

    ctx.save();
    ctx.font = '500 10px ui-monospace, "JetBrains Mono", monospace';
    ctx.letterSpacing = '0.14em';

    // Keep labels inside the canvas: flip the anchor rather than clipping.
    const textW = ctx.measureText(text.toUpperCase()).width + 6;
    if (align === 'left' && x + dx + textW > W - 4) {
      align = 'right';
      dx = -Math.abs(dx);
    } else if (align === 'right' && x + dx - textW < 4) {
      align = 'left';
      dx = Math.abs(dx);
    }

    const tx = x + dx;
    const ty = y + dy;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), tx, ty);

    // Leader: node → a short elbow at the label.
    ctx.globalAlpha = alpha * 0.42;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (align === 'center') {
      ctx.moveTo(x, y - 4);
      ctx.lineTo(tx, ty + 6);
    } else {
      ctx.moveTo(x + (align === 'right' ? -3 : 3), y);
      ctx.lineTo(tx + (align === 'right' ? 4 : -4), ty);
    }
    ctx.stroke();
    ctx.restore();
  };

  const frame = (t) => {
    ctx.clearRect(0, 0, W, H);
    const r = rect();

    // Wavefront radius
    let R = 0;
    if (t >= 0.35) R = easeOutQuart(clamp01((t - 0.35) / 2.85)) * 1.32;

    // ---- nodes ----
    nodes.forEach((n) => {
      if (n.at < 0 && R > n.d) n.at = t + n.delay;
      let intensity = 0;
      if (n.at >= 0 && t >= n.at) {
        intensity = 1 - easeOutCubic(clamp01((t - n.at) / 0.9));
      }
      const settle = t > 4.6 ? 1 - clamp01((t - 4.6) / 1.4) : 1;
      intensity *= settle;

      const alpha = 0.13 + intensity * 0.82;
      const radius = n.r * (1 + intensity * 1.2);
      ctx.beginPath();
      ctx.fillStyle =
        intensity > 0.45
          ? `rgba(180, 252, 220, ${alpha})`
          : `rgba(127, 240, 192, ${alpha})`;
      ctx.arc(px(n.x), py(n.y), radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // ---- arcs + outlet labels ----
    hubs.forEach((h, i) => {
      if (h.at < 0 && R > h.d) h.at = t + 0.05 * i;
      if (h.at < 0 || t < h.at) return;
      const p = clamp01((t - h.at) / 0.55);
      const fade = t > 4.6 ? 1 - clamp01((t - 4.6) / 1.5) : 1;
      drawArc(ORIGIN, h, p, 0.5 * fade, 'rgba(127, 240, 192, 1)');

      if (p >= 1) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(210, 255, 235, ${0.9 * fade})`;
        ctx.arc(px(h.x), py(h.y), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (h.label && p >= 1 && !compact) {
        const la = clamp01((t - h.at - 0.55) / 0.35);
        const hold = t > 4.6 ? Math.max(0.4, 1 - (t - 4.6) / 2) : 1;
        label(h.label, px(h.x), py(h.y), la * 0.68 * hold, 'rgba(214, 245, 232, 1)', {
          dx: h.ldx,
          dy: h.ldy,
          align: h.align,
        });
      }
    });

    // ---- AI discovery layer lift ----
    if (!compact && t > 3.4) {
      const lift = easeOutExpo(clamp01((t - 3.4) / 1.2));
      const fade = t > 5.2 ? Math.max(0.35, 1 - (t - 5.2) / 1.3) : 1;
      AI_NODES.forEach((a, i) => {
        const baseY = r.y - 6;
        const y = baseY - lift * (r.y * 0.52) - i * 2;
        const x = r.x + a.x * r.w;
        drawArc(
          ORIGIN,
          { x: (x - r.x) / r.w, y: (y - r.y) / r.h },
          lift,
          0.42 * lift * fade,
          'rgba(167, 139, 250, 1)'
        );
        ctx.beginPath();
        ctx.fillStyle = `rgba(196, 181, 253, ${0.9 * lift * fade})`;
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
        label(a.label, x, y, lift * 0.72 * fade, 'rgba(196, 181, 253, 1)', {
          dx: 0,
          dy: -14,
          align: 'center',
        });
      });
    }

    // ---- origin pin ----
    const ignite =
      t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : t > 6.2 ? (t - 6.2) / 0.3 : 0;
    const ox = px(ORIGIN.x);
    const oy = py(ORIGIN.y);

    ctx.beginPath();
    ctx.strokeStyle = `rgba(127, 240, 192, ${0.3 + ignite * 0.5})`;
    ctx.lineWidth = 1;
    ctx.arc(ox, oy, 7 + ignite * 5, 0, Math.PI * 2);
    ctx.stroke();

    if (R > 0 && R < 1.32) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(127, 240, 192, ${0.16 * (1 - R / 1.32)})`;
      ctx.lineWidth = 1;
      ctx.arc(ox, oy, R * r.w * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = ignite > 0.05 ? '#ffffff' : 'rgba(180, 252, 220, 0.95)';
    ctx.arc(ox, oy, 3 + ignite * 2.4, 0, Math.PI * 2);
    ctx.fill();
  };

  const still = () => {
    // Reduced motion: render the payoff frame, not the empty resting state.
    nodes.forEach((n) => (n.at = 0));
    hubs.forEach((h) => (h.at = 0));
    frame(4.4);
  };

  const tick = (now) => {
    if (!running) return;
    const t = ((now - start) / 1000) % LOOP;
    if (t < lastLoop) {
      nodes.forEach((n) => (n.at = -1));
      hubs.forEach((h) => (h.at = -1));
    }
    lastLoop = t;
    frame(t);
    raf = requestAnimationFrame(tick);
  };

  resize();
  if (reduced) {
    still();
  } else {
    raf = requestAnimationFrame(tick);
  }

  const onResize = () => {
    resize();
    if (reduced) still();
  };
  window.addEventListener('resize', onResize);

  const io = new IntersectionObserver(
    ([entry]) => {
      if (reduced) return;
      if (entry.isIntersecting && !running) {
        running = true;
        start = performance.now();
        lastLoop = 0;
        raf = requestAnimationFrame(tick);
      } else if (!entry.isIntersecting && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    },
    { threshold: 0 }
  );
  io.observe(wrap);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    io.disconnect();
  };
}
