/**
 * Continental-US silhouette, normalized to a 0..1 box.
 *
 * Used only as a fill mask: the outline is NEVER stroked. We rasterize this
 * polygon to an offscreen canvas and sample the interior to build the node
 * lattice, so the country resolves out of dots rather than being drawn. A
 * literal bordered map reads as logistics tracking and implies placements;
 * a dot field is evocative and makes no claim.
 *
 * Coordinates derive from lon/lat via:
 *   x = (lon + 125) / 59
 *   y = (49 - lat) / 25
 */
export const US_OUTLINE = [
  // Pacific coast, north to south
  [0.005, 0.024], [0.014, 0.228], [0.014, 0.344], [0.044, 0.448],
  [0.076, 0.58], [0.115, 0.62], [0.134, 0.66],
  // Southern border
  [0.175, 0.652], [0.237, 0.708], [0.313, 0.688], [0.373, 0.8],
  [0.408, 0.784], [0.452, 0.86], [0.468, 0.924], [0.473, 0.848],
  // Gulf coast
  [0.512, 0.788], [0.556, 0.802], [0.593, 0.8], [0.627, 0.752],
  [0.668, 0.766], [0.7, 0.79],
  // Florida
  [0.716, 0.83], [0.741, 0.9], [0.759, 0.928], [0.752, 0.824],
  [0.739, 0.748],
  // Atlantic coast, south to north
  [0.746, 0.68], [0.764, 0.648], [0.8, 0.6], [0.839, 0.552],
  [0.825, 0.484], [0.847, 0.408], [0.864, 0.332], [0.9, 0.31],
  [0.932, 0.292], [0.929, 0.212], [0.983, 0.164],
  // Northern border / Great Lakes notch
  [0.907, 0.16], [0.86, 0.196], [0.822, 0.228], [0.78, 0.246],
  [0.712, 0.268], [0.69, 0.2], [0.683, 0.12], [0.64, 0.15],
  [0.62, 0.1], [0.593, 0.088], [0.559, 0.088], [0.53, 0.04],
  [0.505, 0.0], [0.34, 0.0], [0.16, 0.0], [0.034, 0.0],
];

/** Metro hubs the wavefront triggers arcs toward. */
/**
 * `ldx` / `ldy` fan the labels away from the dense north-east cluster so they
 * never collide; `align` flips the text anchor. Tuned by eye against the
 * rendered frame — adjust these, not the hub coordinates.
 */
export const HUBS = [
  { id: 'nyc', x: 0.864, y: 0.332, label: 'Business Insider', ldx: 12, ldy: -4, align: 'left' },
  { id: 'sf', x: 0.044, y: 0.448, label: 'Yahoo! Finance', ldx: 12, ldy: 16, align: 'left' },
  { id: 'dc', x: 0.814, y: 0.404, label: 'Associated Press', ldx: 10, ldy: 26, align: 'left' },
  { id: 'chi', x: 0.634, y: 0.284, label: 'Google News', ldx: -12, ldy: -18, align: 'right' },
  { id: 'dfw', x: 0.478, y: 0.648, label: 'Apple News', ldx: -12, ldy: 14, align: 'right' },
  { id: 'det', x: 0.712, y: 0.268, label: 'Benzinga', ldx: -12, ldy: -40, align: 'right' },
  { id: 'sea', x: 0.046, y: 0.056 },
  { id: 'lax', x: 0.115, y: 0.6 },
  { id: 'den', x: 0.339, y: 0.372 },
  { id: 'atl', x: 0.688, y: 0.612 },
  { id: 'mia', x: 0.755, y: 0.9 },
  { id: 'hou', x: 0.502, y: 0.768 },
  { id: 'phx', x: 0.219, y: 0.624 },
  { id: 'msp', x: 0.537, y: 0.16 },
];

/**
 * Origin pin — Columbus, Ohio. Deliberately not a media capital:
 * "local" has to read as somewhere ordinary for the story to land.
 */
export const ORIGIN = { x: 0.712, y: 0.36 };

/** AI discovery surfaces that detach and lift above the plane. */
export const AI_NODES = [
  { id: 'gpt', x: 0.24, label: 'ChatGPT' },
  { id: 'pplx', x: 0.44, label: 'Perplexity' },
  { id: 'gem', x: 0.64, label: 'Gemini' },
  { id: 'cop', x: 0.84, label: 'Copilot' },
];
