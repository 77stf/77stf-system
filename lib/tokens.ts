/**
 * Design tokens — "Carbon Pro" theme.
 * Philosophy: warm dark-gray base (#111114), crisp white text hierarchy,
 * gold strictly for brand identity (logo + revenue + primary CTA),
 * zero decorative color — professional C-suite tool.
 *
 * Import everywhere: import { t } from '@/lib/tokens'
 */

export const t = {
  // ─── Backgrounds ────────────────────────────────────────────────
  bg: {
    page:      '#111114',                      // warm charcoal gray — deliberate, not void
    topbar:    'rgba(10,10,13,0.94)',           // glass topbar — slightly darker than page
    sidebar:   'rgba(8,8,11,0.97)',             // sidebar drawer — deepest surface
    card:      'rgba(255,255,255,0.05)',         // glass card — more visible on gray
    cardSolid: '#1A1A1E',                       // elevated solid: tooltips, palette, dropdowns
    cardHover: 'rgba(255,255,255,0.08)',
    muted:     'rgba(255,255,255,0.04)',
    input:     'rgba(255,255,255,0.07)',
    overlay:   'rgba(255,255,255,0.06)',
  },

  // ─── Borders ────────────────────────────────────────────────────
  border: {
    default:    'rgba(255,255,255,0.09)',        // slightly more visible on gray
    hover:      'rgba(255,255,255,0.20)',
    subtle:     'rgba(255,255,255,0.055)',
    strong:     'rgba(255,255,255,0.26)',
    gold:       'rgba(196,154,46,0.42)',
    goldStrong: 'rgba(196,154,46,0.62)',
    error:      'rgba(248,113,113,0.24)',
    success:    'rgba(74,222,128,0.24)',
  },

  // ─── Text ────────────────────────────────────────────────────────
  text: {
    primary:     '#F2F2F4',                     // warm white — crisp on dark gray
    secondary:   'rgba(242,242,244,0.58)',
    muted:       'rgba(242,242,244,0.35)',
    placeholder: 'rgba(242,242,244,0.22)',
    inverted:    '#111114',
    gold:        '#C9A84C',
  },

  // ─── Brand / Accent ─────────────────────────────────────────────
  // Gold ONLY: logo 77STF, Revenue KPI value, primary CTA button.
  // Nothing else gets brand color — restraint is the brand signal.
  brand: {
    gold:       '#C49A2E',
    goldDark:   '#A07820',
    goldLight:  'rgba(196,154,46,0.10)',
    goldMid:    'rgba(196,154,46,0.18)',
    gradient:   'linear-gradient(135deg, #B8890A 0%, #E2B84A 45%, #C49A2E 100%)',
  },

  // ─── Semantic — informational only (error / success / warning) ──
  semantic: {
    success:       '#4ade80',
    successBg:     'rgba(74,222,128,0.09)',
    successBorder: 'rgba(74,222,128,0.22)',
    error:         '#f87171',
    errorBg:       'rgba(248,113,113,0.09)',
    errorBorder:   'rgba(248,113,113,0.22)',
    warning:       '#fbbf24',
    warningBg:     'rgba(251,191,36,0.09)',
    warningBorder: 'rgba(251,191,36,0.22)',
    info:          '#818CF8',
    infoBg:        'rgba(129,140,248,0.09)',
    infoBorder:    'rgba(129,140,248,0.22)',
  },

  // ─── Shadows — lighter than pure-black theme ─────────────────────
  shadow: {
    sm:     '0 1px 3px rgba(0,0,0,0.45)',
    card:   '0 1px 2px rgba(0,0,0,0.40), 0 4px 16px rgba(0,0,0,0.22)',
    cardMd: '0 4px 24px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30)',
    cardLg: '0 12px 48px rgba(0,0,0,0.60), 0 2px 8px rgba(0,0,0,0.30)',
    gold:   '0 0 0 3px rgba(196,154,46,0.12)',
    btn:    '0 1px 8px rgba(196,154,46,0.35)',
  },

  // ─── Radii ───────────────────────────────────────────────────────
  radius: {
    xs:   4,
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    xxl:  28,
    full: 9999,
  },

  // ─── Status badges ───────────────────────────────────────────────
  statusBadge: {
    lead: {
      color:           '#fbbf24',
      backgroundColor: 'rgba(251,191,36,0.09)',
      border:          '1px solid rgba(251,191,36,0.22)',
    },
    active: {
      color:           'rgba(242,242,244,0.85)',
      backgroundColor: 'rgba(255,255,255,0.08)',
      border:          '1px solid rgba(255,255,255,0.15)',
    },
    partner: {
      color:           '#4ade80',
      backgroundColor: 'rgba(74,222,128,0.09)',
      border:          '1px solid rgba(74,222,128,0.22)',
    },
    closed: {
      color:           'rgba(242,242,244,0.28)',
      backgroundColor: 'rgba(255,255,255,0.04)',
      border:          '1px solid rgba(255,255,255,0.07)',
    },
  },
} as const
