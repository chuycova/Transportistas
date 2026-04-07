// postcss.config.mjs
// Tailwind CSS v4 uses the @tailwindcss/postcss plugin instead of tailwindcss directly.
// This is required for Next.js integration (Turbopack handles it via postcss in build mode).

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
