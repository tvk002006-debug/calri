// ─── Global Design Tokens & Shared Styles ────────────────────────────────────
import { StyleSheet } from 'react-native';

// ── Colour palette ────────────────────────────────────────────────────────────
export const C = {
  // ── Backgrounds
  cream:    '#F9F8F8',   // warm off-white
  surface:  '#FFFFFF',
  surface2: '#F3F2F4',  // subtle grey for inputs
  surface3: '#EBEBEF',  // slightly deeper grey

  // ── Borders
  border:   '#E4E2E8',  // soft grey
  border2:  '#CCCAD2',  // medium grey

  // ── Text
  ink:      '#1A1625',  // near-black with purple tint
  ink2:     '#4A4558',  // muted dark
  ink3:     '#8A8599',  // soft grey-purple
  ink4:     '#C2BFCC',  // light grey

  // ── Dusty rose (primary accent — muted, not neon)
  primary:  '#C2607A',  // dusty rose
  sage:     '#C2607A',  // alias
  sageL:    '#F5EAED',  // very pale rose tint
  sageM:    '#E8C4CC',  // soft rose

  // ── Muted sage green (secondary accent)
  mint:     '#6BAE8E',  // muted sage green
  mintL:    '#E2F2EB',  // pale green tint

  // ── Alerts
  amber:    '#C98A2A',
  amberL:   '#FDF3DC',
  amberM:   '#F0D080',
  amber800: '#7A5000',
  error:    '#C94060',
  errorL:   '#FCE8EC',
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
  brandName:  { color: C.ink, fontSize: 26, fontWeight: '900', letterSpacing: -0.2 },
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
  inputValid: { borderColor: '#6BAE8E', backgroundColor: '#F2FAF6' }, // muted sage green valid
  inputField: { flex: 1, height: 46, fontSize: 14, fontWeight: '600', color: C.ink },
  inputCheck: { color: '#6BAE8E', fontSize: 16, fontWeight: '700' }, // muted sage green checkmark
  errorText:  { color: C.error, fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 12, paddingLeft: 4 },
  errorSpacer:{ height: 14 },

  // ── Chips (multi-select pills)
  chipsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  chip:          { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface2 },
  chipActive:    { backgroundColor: C.sageL, borderColor: C.sageM },
  chipText:      { fontSize: 12, fontWeight: '700', color: C.ink3 },
  chipTextActive:{ color: C.sage },

  // ── CTA button
  ctaBtn:  { height: 54, backgroundColor: '#C2607A', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ctaDim:  { opacity: 0.4 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.1 },

  progressTrack: { height: 4, backgroundColor: C.border },
  progressFill:  { height: 4, backgroundColor: '#6BAE8E', borderRadius: 99 }, // muted sage green progress

  stepHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 4,
  },
  stepPill: { backgroundColor: '#E2F2EB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  stepPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: '#4A8A6A', textTransform: 'uppercase' },
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
