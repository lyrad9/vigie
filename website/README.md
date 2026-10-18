# Vigie — le site

La landing page de [Vigie](../README.md), en ligne sur https://vigie.lyrad.dev.

Next.js 16 (App Router) + Tailwind CSS v4, entièrement statique. Polices : Satoshi (titres, auto-hébergée) et
DM Sans (paragraphes). Thème tweakcn « Modern Minimal », clair et sombre.

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
