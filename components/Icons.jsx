/* Ultra-light hairline icon set (1px strokes, rounded caps). */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.15,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function ArrowUpRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function ArrowRight(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowDown(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v16M6 14l6 6 6-6" />
    </svg>
  );
}

export function Check(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  );
}

export function Spark(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.2 6.2l2.8 2.8M15 15l2.8 2.8M17.8 6.2 15 9M9 15l-2.8 2.8" />
    </svg>
  );
}

export function Broadcast(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.8 4.8a10 10 0 0 0 0 14.4M19.2 19.2a10 10 0 0 0 0-14.4" />
    </svg>
  );
}

export function Document(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H7a1.6 1.6 0 0 0-1.6 1.6v14.8A1.6 1.6 0 0 0 7 21h10a1.6 1.6 0 0 0 1.6-1.6V7.6z" />
      <path d="M14 3v4.6h4.6M8.6 12.6h6.8M8.6 16.2h4.4" />
    </svg>
  );
}

export function Shield(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />
      <path d="M9.2 12.2 11.3 14.4 15 10.6" />
    </svg>
  );
}

export function Chart(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h16M7.5 20v-6M12 20V6M16.5 20v-9" />
    </svg>
  );
}

export function Lock(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.8" y="10.4" width="14.4" height="9.6" rx="2.2" />
      <path d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8" />
    </svg>
  );
}
