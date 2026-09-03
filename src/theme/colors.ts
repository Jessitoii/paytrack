export interface ColorPalette {
  background: string;
  backgroundSecondary: string;
  card: string;
  cardElevated: string;
  cardBorder: string;
  cardBorderLight: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryBg: string;
  blue: string;
  blueBg: string;
  indigo: string;
  indigoBg: string;
  purple: string;
  purpleBg: string;
  amber: string;
  amberBg: string;
  danger: string;
  dangerBg: string;
  dangerDark: string;
}

export const darkPalette: ColorPalette = {
  // Backgrounds
  background: '#0B1120', // Rich Deep Navy/Slate
  backgroundSecondary: '#070C18', // Input / Inner wells

  // Surfaces & Cards
  card: '#131C31', // Elevated Card Surface
  cardElevated: '#1A243B', // Higher elevation
  cardBorder: '#1E293B', // Subtle slate border
  cardBorderLight: '#334155', // Lighter border

  // Text Hierarchy
  textPrimary: '#F8FAFC', // Near-white
  textSecondary: '#94A3B8', // Muted slate
  textTertiary: '#64748B', // Low contrast hints
  textInverse: '#041F14', // Dark text on bright buttons

  // Accents & Actions
  primary: '#10B981', // Emerald 500
  primaryLight: '#34D399', // Emerald 400
  primaryDark: '#064E3B', // Emerald 900
  primaryBg: 'rgba(16, 185, 129, 0.12)', // Emerald pill background

  // State Accents
  blue: '#38BDF8',
  blueBg: 'rgba(56, 189, 248, 0.12)',
  indigo: '#818CF8',
  indigoBg: 'rgba(129, 140, 248, 0.12)',
  purple: '#C084FC',
  purpleBg: 'rgba(192, 132, 252, 0.12)',
  amber: '#FBBF24',
  amberBg: 'rgba(251, 191, 36, 0.12)',
  danger: '#F43F5E',
  dangerBg: 'rgba(244, 63, 94, 0.12)',
  dangerDark: '#4C0519',
};

export const lightPalette: ColorPalette = {
  // Backgrounds
  background: '#F8FAFC', // Slate 50 (Soft, modern, non-glare)
  backgroundSecondary: '#F1F5F9', // Slate 100 (Input wells / inner surfaces)

  // Surfaces & Cards
  card: '#FFFFFF', // Clean White Card Surface
  cardElevated: '#FFFFFF', // Elevated Card Surface
  cardBorder: '#E2E8F0', // Slate 200 (Crisp, subtle card border)
  cardBorderLight: '#CBD5E1', // Slate 300 (Dividers / distinct borders)

  // Text Hierarchy (WCAG AAA / AA compliant)
  textPrimary: '#0F172A', // Slate 900 (High contrast headline & body)
  textSecondary: '#475569', // Slate 600 (Clear secondary / labels)
  textTertiary: '#64748B', // Slate 500 (Subtle hints / dates)
  textInverse: '#FFFFFF', // White text on dark buttons / badges

  // Accents & Actions
  primary: '#059669', // Emerald 600 (Rich, professional green)
  primaryLight: '#047857', // Emerald 700 (High-contrast text highlights)
  primaryDark: '#064E3B', // Emerald 900
  primaryBg: 'rgba(5, 150, 105, 0.10)', // Subtle emerald pill background

  // State Accents
  blue: '#0284C7', // Sky 600
  blueBg: 'rgba(2, 132, 199, 0.10)',
  indigo: '#4F46E5', // Indigo 600
  indigoBg: 'rgba(79, 70, 229, 0.10)',
  purple: '#7E22CE', // Purple 700
  purpleBg: 'rgba(126, 34, 206, 0.10)',
  amber: '#B45309', // Amber 700 (Crisp on white)
  amberBg: 'rgba(180, 83, 9, 0.10)',
  danger: '#E11D48', // Rose 600
  dangerBg: 'rgba(225, 29, 72, 0.10)',
  dangerDark: '#9F1239',
};

// Default export for initial styles & backwards compatibility
export const colors = darkPalette;
