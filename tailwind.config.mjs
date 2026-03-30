/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#F8F9FC',
          white: '#FFFFFF',
          navy: '#0F1729',
          card: '#FFFFFF',
          border: '#E2E8F0',
          purple: '#6D28D9',
          blue: '#2563EB',
          cyan: '#0EA5E9',
          muted: '#64748B',
          light: '#F1F5F9',
        }
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
