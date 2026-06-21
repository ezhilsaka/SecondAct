import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppUserProfile } from "@/server/auth/profile-bootstrap";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-01-01T12:00:00.000Z");
const UPDATED_AT = new Date("2026-06-20T12:00:00.000Z");

const { mockLoadAuthenticatedAppSession } = vi.hoisted(() => ({
  mockLoadAuthenticatedAppSession: vi.fn()
}));

vi.mock("@/server/auth/app-session", () => ({
  loadAuthenticatedAppSession: mockLoadAuthenticatedAppSession
}));

import AppAccountPage, { AccountPageView } from "@/app/app/account/page";

function buildProfile(overrides: Partial<AppUserProfile> = {}): AppUserProfile {
  return {
    id: TEST_USER_ID,
    email: "ada.lovelace@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    investorHandle: "ada-lovelace",
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides
  };
}

describe("AccountPageView", () => {
  it("renders real profile details and the edit-name form", () => {
    const html = renderToStaticMarkup(
      <AccountPageView profile={buildProfile()} notice={null} error={null} />
    );

    expect(html).toContain("Profile");
    expect(html).toContain("Ada");
    expect(html).toContain("Lovelace");
    expect(html).toContain("ada.lovelace@example.com");
    expect(html).toContain("@ada-lovelace");
    expect(html).toContain("Read-only");
    expect(html).toContain("Created");
    expect(html).toContain("Updated");
    expect(html).toContain('name="firstName"');
    expect(html).toContain('name="lastName"');
    expect(html).toContain("Save profile");
    expect(html).not.toContain("Billing");
    expect(html).not.toContain("Payment");
    expect(html).not.toContain("Delete account");
  });

  it("renders save success and validation error states", () => {
    const successHtml = renderToStaticMarkup(
      <AccountPageView profile={buildProfile()} notice="Profile updated." error={null} />
    );
    const errorHtml = renderToStaticMarkup(
      <AccountPageView
        profile={buildProfile()}
        notice={null}
        error="Enter both first and last name."
      />
    );

    expect(successHtml).toContain("Profile updated.");
    expect(successHtml).toContain('role="status"');
    expect(errorHtml).toContain("Enter both first and last name.");
    expect(errorHtml).toContain('role="alert"');
  });
});

describe("AppAccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAuthenticatedAppSession.mockResolvedValue({
      user: {
        id: TEST_USER_ID,
        email: "ada.lovelace@example.com",
        claims: {}
      },
      profile: buildProfile()
    });
  });

  it("loads the authenticated app profile for the account page", async () => {
    const jsx = await AppAccountPage({
      searchParams: Promise.resolve({ notice: "profile_updated" })
    });
    const html = renderToStaticMarkup(jsx);

    expect(mockLoadAuthenticatedAppSession).toHaveBeenCalled();
    expect(html).toContain("Profile updated.");
    expect(html).toContain("ada.lovelace@example.com");
  });
});
