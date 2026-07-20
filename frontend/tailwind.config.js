/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        page: '#FAFAFA',
        card: '#FFFFFF',
        primary: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
        },
        heading: '#0F172A',
        body: '#475569',
        muted: '#94A3B8',
        border: '#E2E8F0',
        status: {
          received: '#94A3B8',
          processing: '#3B82F6',
          awaiting_approval: '#F59E0B',
          approved: '#14B8A6',
          completed: '#22C55E',
          rejected: '#EF4444',
          failed: '#991B1B',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
