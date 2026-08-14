import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        surface: '#F7F6F5',
        card: '#FFFFFF',
        border: '#E9E9E7',
        divider: '#E9E9E7',
        textPrimary: '#37352F',
        textMuted: '#787774',
        accent: '#2383E2',
        rowHover: '#F7F6F5',

        // Status badge fills & text
        highBg: '#DDF3DD',
        highText: '#0F7B0F',
        mediumBg: '#FBF0DD',
        mediumText: '#9C6500',
        lowBg: '#FBE4E4',
        lowText: '#C4331D',
        neutralBg: '#F1F1EF',
        neutralText: '#787774',
      },

      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"Space Mono"',
          '"SFMono-Regular"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },

      fontSize: {
        // page title
        'display': ['24px', { fontWeight: '600', lineHeight: '1.3' }],
        // section headers
        'heading': ['15px', { fontWeight: '600', lineHeight: '1.4' }],
        // table body
        'body': ['14px', { fontWeight: '400', lineHeight: '1.5' }],
        // captions / labels
        'caption': ['12px', { fontWeight: '400', lineHeight: '1.4' }],
      },

      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
      },

      spacing: {
        '4.5': '18px',
        '18': '72px',
      },
    },
  },
  plugins: [],
};

export default config;
