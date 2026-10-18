// Markdown for agents, HTML for browsers, on the same URLs.
// - Accept negotiation on every page (acceptmarkdown.com): Markdown when the client prefers
//   text/markdown, HTML otherwise, 406 when neither is acceptable. Every negotiated response
//   carries Vary: Accept.
// - Explicit Markdown URLs as llmstxt.org suggests: /index.md, /index.html.md, /about.md…
// - Unknown pages requested as Markdown get a Markdown 404 that points to llms.txt and the sitemap.
import { NextResponse, type NextRequest } from "next/server";
import { markdownFor, markdownTarget, notFoundMarkdown, PAGE_PATHS } from "./lib/content.ts";
import { negotiate, notAcceptableBody } from "./lib/negotiate.ts";
import { site } from "./lib/site.ts";

const KNOWN = new Set<string>(PAGE_PATHS);

function pagePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function withVary(headers: Headers): Headers {
  const existing = headers.get("Vary");
  const values = existing ? existing.split(",").map((v) => v.trim()) : [];
  if (!values.some((v) => v.toLowerCase() === "accept")) values.push("Accept");
  headers.set("Vary", values.join(", "));
  return headers;
}

function markdownResponse(request: NextRequest, body: string, status: number, canonicalPath?: string): NextResponse {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": status === 200 ? "public, max-age=0, must-revalidate" : "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (canonicalPath) headers.set("Link", `<${site.url}${canonicalPath === "/" ? "/" : canonicalPath}>; rel="canonical"`);
  withVary(headers);
  return new NextResponse(request.method === "HEAD" ? null : body, { status, headers });
}

export function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  // Next hides its RSC headers from the proxy, but the router's fetches send no Accept of their
  // own (so */*), which negotiates to HTML and falls through to Next untouched.

  const { pathname } = request.nextUrl;

  const explicit = markdownTarget(pathname);
  if (explicit !== null) {
    const body = markdownFor(explicit);
    return body ? markdownResponse(request, body, 200, explicit) : markdownResponse(request, notFoundMarkdown(pathname), 404);
  }

  const accept = request.headers.get("accept");
  const choice = negotiate(accept);
  const path = pagePath(pathname);

  if (choice === null) {
    const headers = withVary(new Headers({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }));
    return new NextResponse(request.method === "HEAD" ? null : notAcceptableBody(accept ?? ""), { status: 406, headers });
  }

  if (choice === "text/markdown") {
    const body = KNOWN.has(path) ? markdownFor(path) : null;
    return body ? markdownResponse(request, body, 200, path) : markdownResponse(request, notFoundMarkdown(pathname), 404);
  }

  // `next start` replaces this Vary with its own on prerendered pages; Vercel keeps the proxy's.
  const response = NextResponse.next();
  withVary(response.headers);
  return response;
}

export const config = {
  // Pages only: skip Next internals and files with an extension other than .md.
  matcher: ["/((?!_next/|api/|.*\\.(?!md$)[^/.]+$).*)"],
};
