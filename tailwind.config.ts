import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f6f8fb',
        foreground: '#0f172a',
        muted: '#64748b',
        line: '#dbe4f0',
        brand: '#1d4ed8',
        brandSoft: '#dbeafe',
        panel: '#ffffff',
        success: '#0f766e',
        warning: '#b45309',
        danger: '#b91c1c',
      },
      boxShadow: {
        panel: '0 18px 45px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        panel: '24px',
      },
    },
  },
  plugins: [],
}

export default config
