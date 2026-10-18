import { TrustPageView } from "@/components/trust-page";
import { trustPage } from "@/lib/content.ts";
import { trustPageMetadata } from "@/lib/metadata.ts";

const page = trustPage("/privacy");

export const metadata = trustPageMetadata(page);

export default function Privacy() {
  return <TrustPageView page={page} />;
}
