import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f8f8f8',
        foreground: '#0a0a0a',
        muted: '#767676',
        line: 'rgba(0,0,0,0.07)',
        surface: '#ffffff',
        'surface-warm': '#f8f8f8',
        brand: '#0a0a0a',
        brandSoft: '#f3f3f3',
        panel: '#ffffff',
        success: '#0f766e',
        warning: '#b45309',
        danger: '#b91c1c',
      },
      boxShadow: {
        panel: '0 4px 16px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.04)',
        sm: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        panel: '16px',
        sm: '10px',
      },
    },
  },
  plugins: [],
}

export default config
