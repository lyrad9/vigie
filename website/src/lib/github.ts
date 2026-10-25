// The one live number on the site: how many people have starred the repo.
// The public API is enough (60 calls/h per IP) because "use cache" keeps the answer for an hour,
// so every page of a deploy shares a single call. A rate-limited or failed call returns null and
// the repo links simply render without a count.
import { cacheLife } from "next/cache";
import { site } from "./site.ts";

function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause;
  return cause instanceof Error ? `${err.message} (${cause.message})` : err.message;
}

export async function starCount(): Promise<number | null> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(`https://api.github.com/repos/${site.repoSlug}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
      console.warn(`[github] ${site.repoSlug}: the API answered ${res.status} ${res.statusText}, rendering without the star count`);
      return null;
    }
    const { stargazers_count: count } = (await res.json()) as { stargazers_count?: unknown };
    return typeof count === "number" ? count : null;
  } catch (err) {
    console.warn(`[github] ${site.repoSlug}: ${describe(err)}, rendering without the star count`);
    return null;
  }
}
