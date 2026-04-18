/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#f0f4f2',
          100: '#dce3de',
          200: '#b8ccbf',
          300: '#8eb59d',
          400: '#7ca390',
          500: '#5c7a6e', 
          600: '#2d463d', 
          700: '#1f332c',
          800: '#15241f',
          900: '#0e1714',
        },
        teal: {
           50: '#f9fbe9',
           100: '#f2f7d3',
           200: '#e1eeb0',
           300: '#bfd68c',
           400: '#9dbf67',
           500: '#8eb563', 
           600: '#648f3b',
           700: '#4d692f',
           800: '#3e5228',
           900: '#344524',
        },
        gray: {
          50: '#f4f6f4',
          100: '#eaecea',
          200: '#dce3de',
          300: '#bdc4be',
          400: '#9ba8a1',
          500: '#718079',
          600: '#55645c', 
          700: '#424f48',
          800: '#2e3833',
          900: '#162723',
        }
      }
    },
  },
  plugins: [],
}

