import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontSize: {
        xs: ["var(--fs-xs)", { lineHeight: "1.6" }],
        sm: ["var(--fs-sm)", { lineHeight: "1.75" }],
        base: ["var(--fs-md)", { lineHeight: "1.6" }],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
          },
        },
      },
    },
  },
  plugins: [typography],
}
export default config
