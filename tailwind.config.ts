import type { Config } from 'tailwindcss';

/**
 * SSD design tokens — single source of truth.
 * One accent (blue), slate neutrals, an 8px spacing rhythm, one radius ladder,
 * a restrained 3-step shadow ladder. Deliberately no purple/neon "AI" palette.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Single accent — trust + conversion.
        accent: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          soft: '#EFF6FF',
          fg: '#FFFFFF',
        },
        // Neutral ink ramp (slate).
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          faint: '#94A3B8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F8FAFC',
          border: '#E2E8F0',
        },
        success: '#059669',
        danger: '#DC2626',
        warn: '#D97706',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Systematic type scale (not ad-hoc sizes).
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem', { lineHeight: '1.65rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.9rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem', letterSpacing: '-0.01em' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '4xl': ['3rem', { lineHeight: '3.15rem', letterSpacing: '-0.025em' }],
        '5xl': ['3.75rem', { lineHeight: '3.9rem', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        // 3-step ladder, soft and premium — not heavy.
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        md: '0 4px 16px -4px rgb(15 23 42 / 0.08)',
        lg: '0 12px 40px -12px rgb(15 23 42 / 0.14)',
      },
      maxWidth: {
        content: '72rem',
        prose: '44rem',
      },
      transitionTimingFunction: {
        // Named entrance curve for triggered UI (drawers, panels) — steep start,
        // gentle settle. Keeps easing config-driven instead of ad hoc per component.
        enter: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        // Same curve as `enter` above — cubic-bezier(0.22,1,0.36,1) can't be
        // referenced by name inside a raw animation shorthand, so it's spelled
        // out here to stay in sync with it.
        'fade-up': 'fade-up 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
