import { llmsFullTxt } from "@/lib/content.ts";

// Uses no request data, so Cache Components prerenders it at build time.
export function GET() {
  return new Response(llmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
