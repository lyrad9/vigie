// Links and identity used across the site, the Markdown versions, llms.txt and JSON-LD.
const REPO = "https://github.com/lyrad9/vigie";

export const site = {
  name: "Vigie",
  url: "https://vigie.lyrad.dev",
  tagline: "Superviseur de serveurs de dev locaux pour agents IA",
  version: "0.1.2",
  repo: REPO,
  download: `${REPO}/releases/latest`,
  releases: `${REPO}/releases`,
  issues: `${REPO}/issues`,
  skill: `${REPO}/blob/main/skill/SKILL.md`,
  license: `${REPO}/blob/main/LICENSE`,
  installCommand: `git clone ${REPO}.git && cd vigie && npm install && npm run app`,
  // Contact details as already published on lyrad.dev.
  author: {
    name: "Daryl Ngako",
    url: "https://lyrad.dev",
    email: "mbakopngako@gmail.com",
    github: "https://github.com/lyrad9",
    linkedin: "https://www.linkedin.com/in/darylngako/",
    x: "https://x.com/daryl_ngako",
  },
  // Date of the last content change on the site (sitemap lastmod, privacy page).
  updated: "2026-10-18",
};
