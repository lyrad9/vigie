// JSON-LD (schema.org) describing Vigie for search engines and agents.
import { FAQ } from "./content.ts";
import { site } from "./site.ts";

const a = site.author;
const ids = {
  website: `${site.url}/#website`,
  org: `${site.url}/#organization`,
  app: `${site.url}/#software`,
  source: `${site.url}/#source`,
  author: `${a.url}/#person`,
};

// The open-source project itself. No postal address is published: Vigie has no office, and
// inventing one would be false. Add `address` here once a real one exists.
const contactPoint = {
  "@type": "ContactPoint",
  contactType: "technical support",
  email: a.email,
  url: `${site.url}/contact`,
  availableLanguage: ["fr", "en"],
};

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": ids.website,
        name: site.name,
        url: `${site.url}/`,
        inLanguage: "fr",
        description: "Site officiel de Vigie, superviseur de serveurs de dev locaux pour agents IA.",
        publisher: { "@id": ids.org },
      },
      {
        "@type": "Organization",
        "@id": ids.org,
        name: site.name,
        url: `${site.url}/`,
        logo: `${site.url}/icon.svg`,
        description: "Projet open source qui développe Vigie, le superviseur de serveurs de dev locaux pour agents IA.",
        email: a.email,
        founder: { "@id": ids.author },
        contactPoint,
        sameAs: [site.repo],
      },
      {
        "@type": "SoftwareApplication",
        "@id": ids.app,
        name: site.name,
        alternateName: "Vigie, superviseur de serveurs de dev",
        description:
          "Vigie lance chaque serveur de dev local une seule fois, le surveille et expose un état unique en direct (port, PID, santé) que les agents IA comme Claude Code, Codex et Cursor lisent avant de lancer quoi que ce soit.",
        url: `${site.url}/`,
        applicationCategory: "DeveloperApplication",
        applicationSubCategory: "Superviseur de serveurs de développement",
        operatingSystem: "Windows (macOS et Linux depuis les sources)",
        softwareVersion: site.version,
        downloadUrl: site.download,
        installUrl: site.download,
        releaseNotes: site.releases,
        license: "https://opensource.org/licenses/MIT",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        inLanguage: "fr",
        screenshot: [`${site.url}/screens/app-light.png`, `${site.url}/screens/ports-light.png`],
        featureList: [
          "Lance chaque serveur de dev une seule fois",
          "État en JSON pour les agents : port, PID, santé",
          "Propriétaire de chaque port : Vigie, programme externe ou système",
          "Relance automatique après un crash",
          "Logs persistants par serveur",
          "API HTTP limitée à 127.0.0.1",
        ],
        author: { "@id": ids.author },
        publisher: { "@id": ids.org },
        sameAs: [site.repo],
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": ids.source,
        name: site.name,
        codeRepository: site.repo,
        programmingLanguage: ["JavaScript", "TypeScript"],
        license: "https://opensource.org/licenses/MIT",
        author: { "@id": ids.author },
        targetProduct: { "@id": ids.app },
      },
      {
        "@type": "Person",
        "@id": ids.author,
        name: a.name,
        url: a.url,
        email: `mailto:${a.email}`,
        sameAs: [a.github, a.linkedin, a.x],
      },
      {
        "@type": "FAQPage",
        "@id": `${site.url}/#faq`,
        inLanguage: "fr",
        isPartOf: { "@id": ids.website },
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a.replace(/`/g, "") },
        })),
      },
    ],
  };
}

/** Serialize for a <script type="application/ld+json">, escaping "<" as Next's JSON-LD guide recommends. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
