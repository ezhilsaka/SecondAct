import SecondActLanding from "@/components/landing/SecondActLanding";
import { DEFAULT_AUTH_REDIRECT_PATH } from "@/lib/auth/redirect";
import { getAuthenticatedUser } from "@/server/auth/supabase-server";

const UNAUTHENTICATED_REPORT_CTA_HREF = "/login?next=%2Fapp";

export const dynamic = "force-dynamic";

export function getLandingReportCtaHref(isAuthenticated: boolean): string {
  return isAuthenticated ? DEFAULT_AUTH_REDIRECT_PATH : UNAUTHENTICATED_REPORT_CTA_HREF;
}

export default async function MarketingHomePage() {
  const user = await getAuthenticatedUser();

  return <SecondActLanding reportCtaHref={getLandingReportCtaHref(user !== null)} />;
}
