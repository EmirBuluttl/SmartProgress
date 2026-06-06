// ─── A+D Design Tokens ─────────────────────
export const T = {
  // Renkler
  bg:           '#0D0D0D',
  surface:      '#141414',
  surfaceHigh:  '#1C1C1C',
  border:       'rgba(255,255,255,0.06)',
  borderMid:    'rgba(255,255,255,0.10)',
  accent:       '#3B82F6',
  accentFill:   'rgba(59, 130, 246,0.05)',
  accentBorder: 'rgba(59, 130, 246,0.55)',
  text:         '#FFFFFF',
  sub:          'rgba(255,255,255,0.45)',
  muted:        'rgba(255,255,255,0.22)',
  // Radius
  r:  16,
  rsm: 10,
  // Spacing
  px: 28,
  // Tipografi
  hero:    { fontSize: 44, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: -0.5, lineHeight: 50 },
  title:   { fontSize: 26, fontWeight: '700' as const, color: '#FFFFFF', letterSpacing: -0.3 },
  label:   { fontSize: 11, fontWeight: '600' as const, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' as const },
  bigNum:  { fontSize: 76, fontWeight: '800' as const, color: '#FFFFFF', letterSpacing: -2 },
  body:    { fontSize: 15, fontWeight: '400' as const, color: 'rgba(255,255,255,0.45)', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, color: 'rgba(255,255,255,0.22)' },
} as const;
