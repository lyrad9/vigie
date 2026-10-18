import { TrustPageView } from "@/components/trust-page";
import { trustPage } from "@/lib/content.ts";
import { trustPageMetadata } from "@/lib/metadata.ts";

const page = trustPage("/about");

export const metadata = trustPageMetadata(page);

export default function About() {
  return <TrustPageView page={page} />;
}
