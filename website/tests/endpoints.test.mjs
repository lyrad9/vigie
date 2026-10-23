// End-to-end checks of every public endpoint against the production build (`next start`).
// Run `npm run build` first. node:http is used instead of fetch so a request can omit Accept.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://vigie.lyrad.dev";
let base;
let server;

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

function get(path, headers = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, { method, headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

const md = { Accept: "text/markdown" };
const html = { Accept: "text/html" };
const varies = (res) => (res.headers.vary ?? "").split(",").some((v) => v.trim().toLowerCase() === "accept");
const visibleText = (page) =>
  (page.match(/<main[\s\S]*<\/main>/)?.[0] ?? "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

before(async () => {
  assert.ok(existsSync(join(root, ".next", "BUILD_ID")), "No production build: run `npm run build` first.");
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    try {
      await get("/robots.txt");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("next start did not come up");
});

after(() => server?.kill());

// HTML responses are checked for content type only: `next start` replaces the proxy's
// Vary on prerendered pages (tests/proxy.test.mjs covers the proxy's own header).
describe("homepage negotiation", () => {
  test("browsers get HTML", async () => {
    const res = await get("/", { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" });
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/html/);
  });

  test("Accept: text/markdown gets Markdown with Vary: Accept", async () => {
    const res = await get("/", md);
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/markdown/);
    assert.ok(varies(res));
    assert.match(res.body, /^# Vigie/);
    assert.match(res.headers.link, /<https:\/\/vigie\.lyrad\.dev\/>; rel="canonical"/);
  });

  const cases = [
    ["text/markdown, text/html;q=0.8", "markdown"],
    ["text/html", "html"],
    ["text/markdown;q=0, text/html", "html"],
    ["*/*", "html"],
  ];
  for (const [accept, kind] of cases) {
    test(`${accept} → ${kind}`, async () => {
      const res = await get("/", { Accept: accept });
      assert.equal(res.status, 200);
      assert.match(res.headers["content-type"], kind === "markdown" ? /^text\/markdown/ : /^text\/html/);
      if (kind === "markdown") assert.ok(varies(res));
    });
  }

  test("no Accept header → HTML", async () => {
    const res = await get("/");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/html/);
  });

  test("text/markdown;q=0 → 406 listing the representations", async () => {
    const res = await get("/", { Accept: "text/markdown;q=0" });
    assert.equal(res.status, 406);
    assert.match(res.headers["content-type"], /^text\/plain/);
    assert.ok(varies(res));
    assert.match(res.body, /text\/html/);
    assert.match(res.body, /text\/markdown/);
  });

  test("HEAD returns Markdown headers without a body", async () => {
    const res = await get("/", md, "HEAD");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/markdown/);
    assert.equal(res.body, "");
  });

  test("client-side navigations still get the RSC payload", async () => {
    // What the Next router sends: RSC: 1 and the fetch default Accept. Next first redirects to
    // the same URL with its `_rsc` cache-busting parameter, as the router would have added it.
    const headers = { RSC: "1", Accept: "*/*" };
    let res = await get("/about", headers);
    if (res.status === 307) res = await get(new URL(res.headers.location, base).pathname + new URL(res.headers.location, base).search, headers);
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/x-component/);
  });
});

describe("homepage HTML metadata", () => {
  let page;
  before(async () => (page = (await get("/", html)).body));

  test("lang, title, canonical and the Markdown alternate", () => {
    assert.match(page, /<html lang="fr"/);
    assert.match(page, /<title>Vigie — [^<]+<\/title>/);
    assert.match(page, /<link rel="canonical" href="https:\/\/vigie\.lyrad\.dev\/?"/);
    assert.match(page, /<link rel="alternate" type="text\/markdown" href="https:\/\/vigie\.lyrad\.dev\/index\.md"/);
  });

  test("Open Graph and Twitter share images", () => {
    assert.match(page, /<meta property="og:type" content="website"/);
    assert.match(page, /<meta property="og:image" content="https:\/\/vigie\.lyrad\.dev\/opengraph-image\.png(\?[^"]*)?"/);
    assert.match(page, /<meta property="og:image:alt" content="Vigie : un seul serveur/);
    assert.match(page, /<meta name="twitter:card" content="summary_large_image"/);
    assert.match(page, /<meta name="twitter:image" content="https:\/\/vigie\.lyrad\.dev\/twitter-image\.png(\?[^"]*)?"/);
  });

  test("JSON-LD parses and holds SoftwareApplication and Organization", () => {
    const raw = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(raw, "no JSON-LD script");
    const types = JSON.parse(raw)["@graph"].map((n) => n["@type"]);
    assert.ok(types.includes("SoftwareApplication"));
    assert.ok(types.includes("Organization"));
  });
});

describe("Markdown URLs and 404s", () => {
  for (const path of ["/index.md", "/index.html.md", "/about.md", "/contact.md", "/privacy.md"]) {
    test(`${path} → 200 Markdown`, async () => {
      const res = await get(path);
      assert.equal(res.status, 200);
      assert.match(res.headers["content-type"], /^text\/markdown/);
      assert.match(res.body, /^# /);
    });
  }

  test("unknown page as Markdown → Markdown 404 that points to llms.txt and the sitemap", async () => {
    const res = await get("/this-page-does-not-exist", md);
    assert.equal(res.status, 404);
    assert.match(res.headers["content-type"], /^text\/markdown/);
    assert.ok(res.body.length >= 20);
    assert.match(res.body, /\/llms\.txt/);
    assert.match(res.body, /\/sitemap\.xml/);
  });

  test("unknown .md URL → Markdown 404", async () => {
    const res = await get("/nope.md");
    assert.equal(res.status, 404);
    assert.match(res.headers["content-type"], /^text\/markdown/);
  });

  test("unknown page in a browser → branded HTML 404", async () => {
    const res = await get("/this-page-does-not-exist", html);
    assert.equal(res.status, 404);
    assert.match(res.headers["content-type"], /^text\/html/);
    assert.match(res.body, /introuvable/);
    assert.match(res.body, /href="\/llms\.txt"/);
  });
});

describe("trust pages", () => {
  for (const path of ["/about", "/contact", "/privacy"]) {
    test(`${path} renders 500+ characters with its canonical`, async () => {
      const res = await get(path, html);
      assert.equal(res.status, 200);
      assert.ok(visibleText(res.body).length >= 500, `${path}: ${visibleText(res.body).length} chars`);
      assert.match(res.body, new RegExp(`<link rel="canonical" href="${SITE}${path}"`));
      assert.match(res.body, new RegExp(`type="text/markdown" href="${SITE}${path}\\.md"`));
    });

    test(`${path} negotiates Markdown`, async () => {
      const res = await get(path, md);
      assert.equal(res.status, 200);
      assert.match(res.headers["content-type"], /^text\/markdown/);
    });
  }

  test("contact page lists a way to reach the author", async () => {
    const res = await get("/contact", html);
    assert.match(res.body, /href="mailto:[^"]+@[^"]+"/);
  });
});

describe("machine-readable files", () => {
  test("/llms.txt", async () => {
    const res = await get("/llms.txt");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /^text\/plain/);
    assert.match(res.body, /^# Vigie\n\n> /);
    assert.match(res.body, /^## Optional$/m);
  });

  test("/llms-full.txt", async () => {
    const res = await get("/llms-full.txt");
    assert.equal(res.status, 200);
    assert.match(res.body, /# À propos de Vigie/);
  });

  test("/sitemap.xml lists every page with lastmod", async () => {
    const res = await get("/sitemap.xml");
    assert.equal(res.status, 200);
    assert.match(res.headers["content-type"], /xml/);
    for (const path of ["/", "/about", "/contact", "/privacy"]) {
      assert.match(res.body, new RegExp(`<loc>${SITE}${path === "/" ? "/?" : path}</loc>`), path);
    }
    assert.equal(res.body.match(/<lastmod>/g)?.length, 4);
  });

  test("/robots.txt allows crawling and points to the sitemap", async () => {
    const res = await get("/robots.txt");
    assert.equal(res.status, 200);
    assert.match(res.body, /Allow: \//);
    assert.match(res.body, new RegExp(`Sitemap: ${SITE}/sitemap\\.xml`));
  });
});
