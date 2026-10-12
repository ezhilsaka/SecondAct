import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SecondActLanding from "@/components/landing/SecondActLanding";

describe("SecondActLanding", () => {
  it("links report CTAs to the provided auth/app destination", () => {
    const html = renderToStaticMarkup(<SecondActLanding reportCtaHref="/login?next=%2Fapp" />);

    expect(html).toContain('href="/login?next=%2Fapp"');
    expect(html.match(/href="\/login\?next=%2Fapp"/g)).toHaveLength(3);
    expect(html).toContain("Get One-Time Report");
    expect(html).toContain("Generate One-Time Report");
    expect(html).toContain("Generate My Report");
  });

  it("keeps the sample PDF action separate and renders the report preview image", () => {
    const html = renderToStaticMarkup(<SecondActLanding reportCtaHref="/app" />);

    expect(html.match(/href="\/app"/g)).toHaveLength(3);
    expect(html).toContain('href="#sample-report-preview"');
    expect(html).toContain('id="sample-report-preview"');
    expect(html).toContain("View Sample PDF");
    expect(html).toContain("sample-report-preview.png");
  });
});
