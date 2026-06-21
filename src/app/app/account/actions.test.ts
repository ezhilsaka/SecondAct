import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";

const {
  mockRedirect,
  mockRequireAuthenticatedUser,
  mockRevalidatePath,
  mockUpdateAuthenticatedUserProfile
} = vi.hoisted(() => ({
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  mockRequireAuthenticatedUser: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockUpdateAuthenticatedUserProfile: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect
}));

vi.mock("@/server/auth/supabase-server", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser
}));

vi.mock("@/server/auth/profile-bootstrap", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/auth/profile-bootstrap")>();

  return {
    ...original,
    updateAuthenticatedUserProfile: mockUpdateAuthenticatedUserProfile
  };
});

import { updateProfileNameFromForm } from "@/app/app/account/actions";
import { ProfileCompletionRequiredError } from "@/server/auth/profile-bootstrap";

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => {
    formData.set(key, value);
  });

  return formData;
}

describe("updateProfileNameFromForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthenticatedUser.mockResolvedValue({
      id: TEST_USER_ID,
      email: "ada.lovelace@example.com",
      claims: {}
    });
    mockUpdateAuthenticatedUserProfile.mockResolvedValue({
      id: TEST_USER_ID,
      email: "ada.lovelace@example.com",
      firstName: "Grace",
      lastName: "Hopper",
      investorHandle: "ada-lovelace",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-20T00:00:00.000Z")
    });
  });

  it("updates first and last name, revalidates app surfaces, and redirects", async () => {
    await expect(
      updateProfileNameFromForm(
        buildFormData({
          firstName: "  Grace  ",
          lastName: "  Hopper  "
        })
      )
    ).rejects.toThrow("REDIRECT:/app/account?notice=profile_updated");

    expect(mockRequireAuthenticatedUser).toHaveBeenCalled();
    expect(mockUpdateAuthenticatedUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: TEST_USER_ID }),
      {
        firstName: "Grace",
        lastName: "Hopper"
      }
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app/account");
  });

  it("rejects blank names without loading the authenticated user", async () => {
    await expect(
      updateProfileNameFromForm(
        buildFormData({
          firstName: "",
          lastName: "Lovelace"
        })
      )
    ).rejects.toThrow("REDIRECT:/app/account?error=profile_validation_error");

    expect(mockRequireAuthenticatedUser).not.toHaveBeenCalled();
    expect(mockUpdateAuthenticatedUserProfile).not.toHaveBeenCalled();
  });

  it("maps profile validation failures to a friendly account error", async () => {
    mockUpdateAuthenticatedUserProfile.mockRejectedValue(new ProfileCompletionRequiredError());

    await expect(
      updateProfileNameFromForm(
        buildFormData({
          firstName: "Ada",
          lastName: "Lovelace"
        })
      )
    ).rejects.toThrow("REDIRECT:/app/account?error=profile_validation_error");
  });

  it("maps unexpected profile update failures to a friendly account error", async () => {
    mockUpdateAuthenticatedUserProfile.mockRejectedValue(new Error("database unavailable"));

    await expect(
      updateProfileNameFromForm(
        buildFormData({
          firstName: "Ada",
          lastName: "Lovelace"
        })
      )
    ).rejects.toThrow("REDIRECT:/app/account?error=profile_update_failed");

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
