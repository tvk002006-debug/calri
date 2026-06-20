// ─── Global Design Tokens & Shared Styles ────────────────────────────────────
import { StyleSheet } from 'react-native';

// ── Colour palette ────────────────────────────────────────────────────────────
export const C = {
  cream:    '#FFFDF9',
  surface:  '#FFFFFF',
  surface2: '#F7F5F0',
  surface3: '#F0EDE6',
  border:   '#E8E4DC',
  border2:  '#D6D1C8',
  ink:      '#14120E',
  ink2:     '#5C5952',
  ink3:     '#9A9690',
  ink4:     '#C8C5C0',
  sage:     '#3D6B4F',
  sageL:    '#E8F0EB',
  sageM:    '#A8C4B0',
  amber:    '#C8820A',
  amberL:   '#FEF4E3',
  amberM:   '#F5D28A',
  amber800: '#7A5000',
  error:    '#C0415B',
  errorL:   '#FCEEF1',
};

// ── Shared styles reused across screens ──────────────────────────────────────
export const g = StyleSheet.create({
  // ── Layout
  root:   { flex: 1, backgroundColor: C.cream },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },

  // ── Brand block
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 44 },
  brandMark: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center',
  },
  brandGlyph: { color: '#fff', fontSize: 18, fontWeight: '800' },
  brandName:  { color: C.ink, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  brandTag:   { color: C.sage, fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginTop: 1 },

  // ── Section headings
  eyebrow: {
    color: C.sage, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  headline: {
    color: C.ink, fontSize: 30, fontWeight: '700',
    letterSpacing: -0.6, lineHeight: 36, marginBottom: 10,
  },
  subtitle: { color: C.ink2, fontSize: 14, lineHeight: 22, marginBottom: 32 },

  // ── Field label
  fieldLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', color: C.ink3, marginBottom: 7,
  },

  // ── Text input (single-line, full-width)
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface2, borderWidth: 1.5,
    borderColor: C.border, borderRadius: 13,
    paddingHorizontal: 14, marginBottom: 0,
  },
  inputError: { borderColor: C.error },
  inputValid: { borderColor: C.sage, backgroundColor: C.surface },
  inputField: { flex: 1, height: 46, fontSize: 14, fontWeight: '600', color: C.ink },
  inputCheck: { color: C.sage, fontSize: 16, fontWeight: '700' },
  errorText:  { color: C.error, fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 12, paddingLeft: 4 },
  errorSpacer:{ height: 14 },

  // ── Chips (multi-select pills)
  chipsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  chip:          { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface2 },
  chipActive:    { backgroundColor: C.sageL, borderColor: C.sageM },
  chipText:      { fontSize: 12, fontWeight: '700', color: C.ink3 },
  chipTextActive:{ color: C.sage },

  // ── CTA button
  ctaBtn:  { height: 54, backgroundColor: C.sage, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ctaDim:  { opacity: 0.4 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },

  progressTrack: { height: 3, backgroundColor: C.border },
  progressFill:  { height: 3, backgroundColor: C.sage, borderRadius: 99 },

  stepHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4,
  },
  stepPill: { backgroundColor: C.sageL, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  stepPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: C.sage, textTransform: 'uppercase' },
  stepCount:    { fontSize: 12, fontWeight: '600', color: C.ink3 },

  terms:     { textAlign: 'center', fontSize: 11, color: C.ink3, lineHeight: 18 },
  termsLink: { color: C.sage, fontWeight: '600' },

  orRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { fontSize: 11, color: C.ink3, fontWeight: '500' },

  footer:   { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12, gap: 8, backgroundColor: C.cream, borderTopWidth: 1, borderTopColor: C.border },
  backBtn:  { alignItems: 'center', paddingVertical: 6 },
  backText: { color: C.ink3, fontSize: 13, fontWeight: '600' },
});
