import type { MetadataRoute } from "next";
import { PAGE_PATHS } from "@/lib/content.ts";
import { site } from "@/lib/site.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGE_PATHS.map((path) => ({
    url: `${site.url}${path}`,
    lastModified: site.updated,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
