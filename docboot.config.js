/** @type {import('docboot').DocbootConfig} */
export default {
  title: "Docboot",
  description: "Docboot documentation",
  docs: "./docs",
  out: "./dist",
  // repo: "https://github.com/owner/repo",
  theme: {
    preset: "zinc", // "zinc" | "ocean" | "emerald" | "violet" | "amber" | "rose"
    defaultMode: "system" // "system" | "dark" | "light"
  },
  // editLink: {
  //   pattern: 'https://github.com/owner/repo/edit/main/docs/:path'
  // },
  // sourceLink: {
  //   pattern: 'https://github.com/owner/repo/blob/main/:path'
  // },
  search: {
    fuzzy: 0.2,
    prefix: true,
    maxResults: 10
  }
};
