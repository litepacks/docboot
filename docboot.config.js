/** @type {import('docboot').DocbootConfig} */
export default {
  title: "Docboot",
  description: "Ultra-fast zero-config Markdown documentation generator with client search, soft SPA navigation, and modern developer aesthetics",
  docs: "./docs",
  out: "./dist",
  repo: "https://github.com/litepacks/docboot",
  theme: {
    preset: "zinc", // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system" // "system" | "dark" | "light"
  },
  editLink: {
    pattern: 'https://github.com/litepacks/docboot/edit/main/docs/:path'
  },
  sourceLink: {
    pattern: 'https://github.com/litepacks/docboot/blob/main/docs/:path'
  },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10
  }
};
