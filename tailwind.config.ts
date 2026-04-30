import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        correct: '#16a34a',
        incorrect: '#dc2626',
        equivalent: '#2563eb',
        unparseable: '#ca8a04'
      }
    }
  },
  plugins: []
}

export default config
