import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cake-accent': '#e07a5f',
        'cake-yellow': '#f4f1de',
        'cake-sage': '#81b29a',
        'cake-coffee': '#3d405b',
        'cake-pink': '#ff6b9d',
        'cake-cream': '#fffbf0',
        'cake-peach': '#ffb8a3',
      },
      fontFamily: {
        quicksand: ['Quicksand', 'Noto Sans TC', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
