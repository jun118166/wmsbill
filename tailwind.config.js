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
        primary: {
          DEFAULT: '#0fc6c2',
          dark: '#0bada9',
          darker: '#0b6e6e',
          light: '#e8fafa',
          lighter: '#d0e8e8',
        },
      },
    },
  },
  plugins: [],
};
