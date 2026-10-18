// Unit tests for content negotiation and the agent-facing text (no server needed).
// Node 24 strips the TypeScript types, so the sources are imported as they are.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { homeJsonLd, serializeJsonLd } from "../src/lib/jsonld.ts";
import { llmsTxt, markdownFor, markdownTarget, notFoundMarkdown, PAGE_PATHS, TRUST_PAGES, trustPageMarkdown } from "../src/lib/content.ts";
import { negotiate, notAcceptableBody, parseAccept, quality } from "../src/lib/negotiate.ts";

describe("negotiate (acceptmarkdown.com vectors)", () => {
  const vectors = [
    ["text/markdown", "text/markdown"],
    ["text/markdown, text/html;q=0.8", "text/markdown"],
    ["text/html", "text/html"],
    ["text/markdown;q=0, text/html", "text/html"],
    ["text/markdown;q=0", null],
    [null, "text/html"],
    ["*/*", "text/html"],
  ];
  for (const [accept, expected] of vectors) {
    test(`${accept ?? "(no Accept)"} → ${expected ?? "406"}`, () => assert.equal(negotiate(accept), expected));
  }

  test("ties go to HTML", () => {
    assert.equal(negotiate("text/markdown, text/html"), "text/html");
    assert.equal(negotiate("text/*"), "text/html");
  });

  test("a more specific range overrides a wildcard", () => {
    assert.equal(negotiate("*/*;q=0.1, text/markdown"), "text/markdown");
    assert.equal(negotiate("text/*;q=0.9, text/html;q=0"), "text/markdown");
  });

  test("browser Accept headers get HTML", () => {
    assert.equal(negotiate("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"), "text/html");
  });

  test("blank Accept is treated as absent", () => assert.equal(negotiate("  "), "text/html"));

  test("nothing acceptable → null", () => assert.equal(negotiate("application/json"), null));

  test("parseAccept reads q-values and clamps them", () => {
    assert.deepEqual(parseAccept("text/markdown;q=0.5, TEXT/HTML;q=2"), [
      { type: "text", subtype: "markdown", q: 0.5 },
      { type: "text", subtype: "html", q: 1 },
    ]);
    assert.equal(quality("text/html", parseAccept("text/markdown")), 0);
  });

  test("406 body lists both representations", () => {
    const body = notAcceptableBody("application/json");
    assert.match(body, /- text\/html/);
    assert.match(body, /- text\/markdown/);
    assert.match(body, /application\/json/);
  });
});

describe("Markdown URLs", () => {
  test("markdownTarget maps .md URLs to page paths", () => {
    assert.equal(markdownTarget("/index.md"), "/");
    assert.equal(markdownTarget("/index.html.md"), "/");
    assert.equal(markdownTarget("/about.md"), "/about");
    assert.equal(markdownTarget("/about"), null);
    assert.equal(markdownTarget("/"), null);
  });

  test("every page has a Markdown version starting with an H1", () => {
    for (const path of PAGE_PATHS) assert.match(markdownFor(path) ?? "", /^# \S/, path);
    assert.equal(markdownFor("/nope"), null);
  });

  test("the homepage Markdown names the brand and links absolutely", () => {
    const md = markdownFor("/");
    assert.match(md, /^# Vigie/);
    assert.doesNotMatch(md, /\]\(\//, "relative links must be absolutized");
  });

  test("trust pages carry at least 500 characters", () => {
    for (const page of TRUST_PAGES) assert.ok(trustPageMarkdown(page).length >= 500, page.path);
  });

  test("Markdown 404 is useful to an agent", () => {
    const md = notFoundMarkdown("/missing");
    assert.ok(md.length >= 20);
    assert.match(md, /`\/missing`/);
    assert.match(md, /https:\/\/vigie\.lyrad\.dev\/llms\.txt/);
    assert.match(md, /https:\/\/vigie\.lyrad\.dev\/sitemap\.xml/);
  });
});

describe("llms.txt (llmstxt.org format)", () => {
  const txt = llmsTxt();
  const lines = txt.split("\n");

  test("starts with the H1 then a blockquote summary", () => {
    assert.equal(lines[0], "# Vigie");
    assert.equal(lines[1], "");
    assert.match(lines[2], /^> \S/);
  });

  test("details before the first H2 use no headings", () => {
    const firstH2 = lines.findIndex((l) => l.startsWith("## "));
    assert.ok(firstH2 > 3);
    assert.ok(lines.slice(1, firstH2).every((l) => !l.startsWith("#")));
    assert.match(txt, /When to use Vigie:/);
  });

  test("H2 sections are link lists, ending with Optional", () => {
    const sections = txt.split(/^## /m).slice(1);
    assert.deepEqual(
      sections.map((s) => s.split("\n")[0]),
      ["Docs", "Download", "Optional"],
    );
    for (const s of sections) {
      const items = s.split("\n").slice(1).filter(Boolean);
      assert.ok(items.length > 0);
      for (const item of items) assert.match(item, /^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/, item);
    }
  });
});

describe("JSON-LD", () => {
  const graph = homeJsonLd()["@graph"];
  const byType = (t) => graph.find((n) => n["@type"] === t);

  test("describes the site, the app, its source, the project and its author", () => {
    for (const t of ["WebSite", "SoftwareApplication", "SoftwareSourceCode", "Organization", "Person", "FAQPage"]) assert.ok(byType(t), t);
  });

  test("SoftwareApplication is complete", () => {
    const app = byType("SoftwareApplication");
    assert.equal(app.name, "Vigie");
    assert.equal(app.applicationCategory, "DeveloperApplication");
    assert.equal(app.offers.price, "0");
    assert.match(app.downloadUrl, /^https:\/\/github\.com\/lyrad9\/vigie\/releases/);
  });

  test("Organization has a contactPoint with email and contactType", () => {
    const org = byType("Organization");
    assert.equal(org.contactPoint["@type"], "ContactPoint");
    assert.match(org.contactPoint.email, /@/);
    assert.ok(org.contactPoint.contactType);
  });

  test("every @id reference resolves inside the graph", () => {
    const ids = new Set(graph.map((n) => n["@id"]));
    const refs = JSON.stringify(graph).match(/\{"@id":"[^"]+"\}/g) ?? [];
    for (const ref of refs) assert.ok(ids.has(JSON.parse(ref)["@id"]), ref);
  });

  test("serialization escapes < so it cannot close the script tag", () => {
    assert.equal(serializeJsonLd({ a: "</script>" }), '{"a":"\\u003c/script>"}');
  });
});
