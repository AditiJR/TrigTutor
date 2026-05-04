import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Validation status (kept from original)
        correct: '#16A34A',
        incorrect: '#DC2626',
        equivalent: '#2563EB',
        unparseable: '#ca8a04',

        // Material Design 3 surface & role tokens
        error: '#ba1a1a',
        'surface-tint': '#0053db',
        'on-secondary-fixed-variant': '#38485d',
        'on-tertiary-fixed-variant': '#7d2d00',
        'tertiary-fixed-dim': '#ffb596',
        'on-primary': '#ffffff',
        'outline-variant': '#c3c6d7',
        'surface-container-highest': '#e1e2ed',
        'surface-bright': '#faf8ff',
        'border-subtle': '#E2E8F0',
        'on-primary-fixed-variant': '#003ea8',
        'surface-container-lowest': '#ffffff',
        'primary-fixed': '#dbe1ff',
        outline: '#737686',
        'on-secondary': '#ffffff',
        'bg-base': '#F8FAFC',
        'secondary-container': '#d0e1fb',
        'tertiary-container': '#bc4800',
        'inverse-primary': '#b4c5ff',
        'on-primary-container': '#eeefff',
        'on-error-container': '#93000a',
        tertiary: '#943700',
        'surface-variant': '#e1e2ed',
        warning: '#D97706',
        secondary: '#505f76',
        'on-tertiary': '#ffffff',
        'on-error': '#ffffff',
        'on-surface-variant': '#434655',
        'on-primary-fixed': '#00174b',
        'surface-container-low': '#f3f3fe',
        'on-tertiary-container': '#ffede6',
        'primary-fixed-dim': '#b4c5ff',
        'secondary-fixed-dim': '#b7c8e1',
        'secondary-fixed': '#d3e4fe',
        primary: '#004ac6',
        'surface-container': '#ededf9',
        'on-background': '#191b23',
        surface: '#FFFFFF',
        'on-secondary-fixed': '#0b1c30',
        'inverse-surface': '#2e3039',
        'on-surface': '#191b23',
        'surface-dim': '#d9d9e5',
        'inverse-on-surface': '#f0f0fb',
        'tertiary-fixed': '#ffdbcd',
        'on-secondary-container': '#54647a',
        'error-container': '#ffdad6',
        background: '#faf8ff',
        'on-tertiary-fixed': '#360f00',
        'surface-container-high': '#e7e7f3',
        'primary-container': '#2563eb'
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      spacing: {
        'container-max': '1024px',
        'touch-target': '44px',
        'stack-lg': '2rem',
        'stack-sm': '0.5rem',
        gutter: '1.5rem',
        'stack-md': '1rem'
      },
      fontFamily: {
        h1: ['var(--font-lexend)', 'sans-serif'],
        h2: ['var(--font-lexend)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        'body-sm': ['var(--font-inter)', 'sans-serif'],
        label: ['var(--font-inter)', 'sans-serif'],
        math: ['KaTeX_Main', 'serif']
      },
      fontSize: {
        h1: ['24px', { lineHeight: '32px', fontWeight: '700' }],
        h2: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['16px', { lineHeight: '24px', fontWeight: '400' }],
        math: ['18px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        label: ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }]
      },
      maxWidth: {
        'container-max': '1024px'
      }
    }
  },
  plugins: []
}

export default config
