import SecondActLanding from "@/components/landing/SecondActLanding";
import { DEFAULT_AUTH_REDIRECT_PATH } from "@/lib/auth/redirect";

export function getLandingReportCtaHref(): string {
  return DEFAULT_AUTH_REDIRECT_PATH;
}

export default function MarketingHomePage() {
  return <SecondActLanding reportCtaHref={getLandingReportCtaHref()} />;
}
