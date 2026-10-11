/**
 * Dot-matrix text, drawn as SVG dots from a 5x7 font, so it looks the same
 * on every device without loading a font. Unlit dots are drawn faintly for
 * the "LED panel" look.
 */

const GLYPHS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['0', '0', '0', '0', '0', '0', '1'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ' ': ['00', '00', '00', '00', '00', '00', '00'],
};

/**
 * @param text   string of 0-9 . % x - + and spaces
 * @param dot    dot diameter in px
 * @param color  lit dot colour
 */
export default function DotMatrix({ text, dot = 6, gap = 2, color = '#fff', dim = 'rgba(255,255,255,0.07)', className = '', label }) {
  const pitch = dot + gap;
  const chars = String(text).split('');
  let x = 0;
  const dots = [];
  chars.forEach((ch, ci) => {
    const g = GLYPHS[ch] || GLYPHS[' '];
    const w = g[0].length;
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < w; c += 1) {
        const on = g[r][c] === '1';
        dots.push(<circle key={`${ci}-${r}-${c}`} cx={x + c * pitch + dot / 2} cy={r * pitch + dot / 2} r={dot / 2} fill={on ? color : dim} />);
      }
    }
    x += w * pitch + pitch; // one-dot space between characters
  });
  const width = Math.max(0, x - pitch);
  const height = 7 * pitch - gap;
  return (
    // max-width + auto height: scales down inside narrow cards instead of
    // forcing the card (and its grid column) wider.
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={`h-auto max-w-full shrink ${className}`} role="img" aria-label={label ?? String(text)}>
      {dots}
    </svg>
  );
}
