# Vigie — le site

La landing page de [Vigie](../README.md), en ligne sur https://vigie.lyrad.dev.

Next.js 16 (App Router) + Tailwind CSS v4, entièrement statique. Polices : Plus Jakarta Sans (titres) et DM Sans
(paragraphes), sans italique. Thème tweakcn « Modern Minimal », clair et sombre.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production (export statique)
```

- [PRODUCT.md](PRODUCT.md) : ce qu'est le produit, pour qui, et ce que le site ne doit jamais inventer.
- [DESIGN.md](DESIGN.md) : le système visuel (couleurs, typographie, formes, règles).
- Les captures de l'app sont dans `public/screens/`.
- Les liens (dépôt, téléchargement, auteur) sont centralisés dans `src/lib/site.ts`.

Fait par [Daryl Ngako](https://lyrad.dev).

## La vidéo de la hero

Elle est servie par Mux avec un identifiant de lecture signé. Les jetons de lecture (valables 2 ans) sont dans
`src/lib/video-tokens.ts` et se régénèrent avec `npm run mux:tokens`, à partir de la clé de signature Mux placée dans
`.env.local` (`MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE`). Ce fichier n'est jamais commité.
