/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#5B8DEF',
          50: '#F1F6FF',
          100: '#E8F1FF',
          200: '#CBDCFF',
          300: '#A6C4FF',
          400: '#81ACFF',
          500: '#5B8DEF',
          600: '#3F72D6',
          700: '#2E5BB8',
          800: '#244A93',
          900: '#1B376C',
        },
        success: '#4ADE80',
        warning: '#FEA500',
        danger: '#FF5A5F',
        surface: '#F7F9FC',
        card: '#FFFFFF',
      },
      fontFamily: {
        sans: ['var(--hi-font-kr)', 'var(--hi-font-en)', 'Noto Sans KR', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.08)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        lg: '12px',
      },
    },
  },
  plugins: [],
};
