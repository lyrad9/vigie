// Unit tests for src/proxy.ts: the response it hands back to Next, before Next renders anything.
// This is the only place the HTML branch's Vary: Accept is observable locally, because
// `next start` overwrites Vary on prerendered pages (Vercel keeps the proxy's header).
import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, test } from "node:test";

// next has no "exports" map, so plain Node needs the extension that Next's bundler adds itself.
const hook = 'export async function resolve(s, c, next) { return next(s === "next/server" ? "next/server.js" : s, c); }';
register(`data:text/javascript,${encodeURIComponent(hook)}`, import.meta.url);

const { proxy, config } = await import("../src/proxy.ts");
const { NextRequest } = await import("next/server.js");

const call = (path, headers = {}, method = "GET") => proxy(new NextRequest(`https://vigie.lyrad.dev${path}`, { headers, method }));
const passesThrough = (res) => res.headers.get("x-middleware-next") === "1";
const varies = (res) => (res.headers.get("vary") ?? "").split(",").some((v) => v.trim().toLowerCase() === "accept");

describe("proxy", () => {
  test("HTML requests pass through to Next with Vary: Accept", () => {
    for (const accept of ["text/html", "*/*", "text/html,application/xhtml+xml,*/*;q=0.8"]) {
      const res = call("/", { accept });
      assert.ok(passesThrough(res), accept);
      assert.ok(varies(res), accept);
    }
  });

  test("no Accept header passes through as HTML", () => {
    assert.ok(passesThrough(call("/")));
  });

  test("Markdown is answered by the proxy itself", async () => {
    const res = call("/about", { accept: "text/markdown" });
    assert.equal(res.status, 200);
    assert.ok(!passesThrough(res));
    assert.match(res.headers.get("content-type"), /^text\/markdown/);
    assert.ok(varies(res));
    assert.equal(res.headers.get("link"), '<https://vigie.lyrad.dev/about>; rel="canonical"');
    assert.match(await res.text(), /^# À propos de Vigie/);
  });

  test("a trailing slash still finds the page", () => {
    assert.equal(call("/contact/", { accept: "text/markdown" }).status, 200);
  });

  test("unknown pages get a Markdown 404", async () => {
    const res = call("/missing", { accept: "text/markdown" });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(await res.text(), /llms\.txt/);
  });

  test("406 when neither representation is acceptable", async () => {
    const res = call("/", { accept: "text/markdown;q=0" });
    assert.equal(res.status, 406);
    assert.ok(varies(res));
    assert.match(await res.text(), /text\/html/);
  });

  test("non-GET methods are never negotiated", () => {
    assert.ok(passesThrough(call("/", { accept: "text/markdown" }, "POST")));
  });

  test("the matcher covers pages and .md URLs, not assets or machine files", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    for (const p of ["/", "/about", "/index.md", "/index.html.md", "/nope/deep"]) assert.ok(re.test(p), p);
    for (const p of ["/llms.txt", "/sitemap.xml", "/robots.txt", "/icon.svg", "/_next/static/x.js", "/screens/app-light.png"]) {
      assert.ok(!re.test(p), p);
    }
  });
});
