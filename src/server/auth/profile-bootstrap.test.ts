import { Prisma } from "@prisma/client";
import type { JwtPayload } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { AuthenticatedUser } from "@/server/auth/authenticated-user";
import {
  bootstrapAuthenticatedUserProfile,
  completeAuthenticatedUserProfile,
  InvestorHandleCollisionError,
  ProfileCompletionRequiredError,
  ProfileEmailAlreadyLinkedError,
  ProfileBootstrapMissingEmailError,
  PrismaProfileBootstrapRepository,
  type AppUserProfile,
  type CreateUserProfileInput,
  type ProfileBootstrapRepository
} from "@/server/auth/profile-bootstrap";

const TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
const CREATED_AT = new Date("2026-01-01T00:00:00Z");
const UPDATED_AT = new Date("2026-01-01T00:00:00Z");

function buildClaims(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    iss: "https://project.supabase.co/auth/v1",
    sub: TEST_USER_ID,
    aud: "authenticated",
    exp: 4_102_444_800,
    iat: 1_704_067_200,
    role: "authenticated",
    aal: "aal1",
    session_id: "22222222-2222-4222-8222-222222222222",
    email: "ada.lovelace@example.com",
    ...overrides
  };
}

function buildAuthenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  const claims = buildClaims();

  return {
    id: TEST_USER_ID,
    email: "ada.lovelace@example.com",
    claims,
    ...overrides
  };
}

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

function buildRepository(
  overrides: Partial<ProfileBootstrapRepository> = {}
): ProfileBootstrapRepository {
  return {
    findProfileById: vi.fn().mockResolvedValue(null),
    findProfileByEmail: vi.fn().mockResolvedValue(null),
    createProfile: vi.fn(async (input: CreateUserProfileInput) =>
      buildProfile({
        ...input,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT
      })
    ),
    ensureUserUsage: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function buildLogger() {
  return {
    info: vi.fn(),
    error: vi.fn()
  };
}

function buildPrismaKnownRequestError(
  code: string,
  meta?: Record<string, unknown>
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Prisma request failed.", {
    code,
    clientVersion: "test",
    meta
  });
}

describe("bootstrapAuthenticatedUserProfile", () => {
  it("loads an existing profile without rewriting usage or profile fields", async () => {
    const existingProfile = buildProfile({
      firstName: "Existing",
      lastName: "Name",
      investorHandle: "existing-handle"
    });
    const repository = buildRepository({
      findProfileById: vi.fn().mockResolvedValue(existingProfile)
    });
    const logger = buildLogger();

    const result = await bootstrapAuthenticatedUserProfile(buildAuthenticatedUser(), {
      repository,
      logger
    });

    expect(result).toEqual({
      profile: existingProfile,
      created: false
    });
    expect(repository.createProfile).not.toHaveBeenCalled();
    expect(repository.ensureUserUsage).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "User profile loaded.",
      expect.objectContaining({
        event: "user_profile.loaded",
        userId: TEST_USER_ID,
        investorHandle: "existing-handle"
      })
    );
  });

  it("fails when the authenticated email already belongs to a different profile id", async () => {
    const existingProfile = buildProfile({
      id: "33333333-3333-4333-8333-333333333333"
    });
    const repository = buildRepository({
      findProfileByEmail: vi.fn().mockResolvedValue(existingProfile)
    });
    const logger = buildLogger();

    await expect(
      bootstrapAuthenticatedUserProfile(buildAuthenticatedUser(), {
        repository,
        logger
      })
    ).rejects.toBeInstanceOf(ProfileEmailAlreadyLinkedError);

    expect(repository.createProfile).not.toHaveBeenCalled();
    expect(repository.ensureUserUsage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "User profile bootstrap failed.",
      expect.objectContaining({
        event: "user_profile.bootstrap_failed",
        userId: TEST_USER_ID,
        errorCode: "PROFILE_EMAIL_ALREADY_LINKED",
        errorName: "ProfileEmailAlreadyLinkedError"
      })
    );
  });

  it("creates a profile using Google name metadata and a normalized email handle", async () => {
    const repository = buildRepository();
    const logger = buildLogger();
    const user = buildAuthenticatedUser({
      claims: buildClaims({
        user_metadata: {
          given_name: "Ada",
          family_name: "Lovelace"
        }
      })
    });

    const result = await bootstrapAuthenticatedUserProfile(user, {
      repository,
      logger
    });

    expect(repository.createProfile).toHaveBeenCalledWith({
      id: TEST_USER_ID,
      email: "ada.lovelace@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      investorHandle: "ada-lovelace"
    });
    expect(repository.ensureUserUsage).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result.created).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      "User profile created.",
      expect.objectContaining({
        event: "user_profile.created",
        userId: TEST_USER_ID,
        investorHandle: "ada-lovelace"
      })
    );
  });

  it("creates a profile using available email auth name metadata", async () => {
    const repository = buildRepository();
    const user = buildAuthenticatedUser({
      email: "new.email@example.com",
      claims: buildClaims({
        email: "new.email@example.com",
        user_metadata: {
          first_name: "Priya",
          last_name: "Raman"
        }
      })
    });

    await bootstrapAuthenticatedUserProfile(user, {
      repository,
      logger: buildLogger()
    });

    expect(repository.createProfile).toHaveBeenCalledWith({
      id: TEST_USER_ID,
      email: "new.email@example.com",
      firstName: "Priya",
      lastName: "Raman",
      investorHandle: "new-email"
    });
  });

  it("requires profile completion for email OTP users without profile metadata", async () => {
    const repository = buildRepository();
    const user = buildAuthenticatedUser({
      email: "new.investor@example.com",
      claims: buildClaims({
        email: "new.investor@example.com",
        user_metadata: {}
      })
    });

    await expect(
      bootstrapAuthenticatedUserProfile(user, {
        repository,
        logger: buildLogger()
      })
    ).rejects.toBeInstanceOf(ProfileCompletionRequiredError);

    expect(repository.createProfile).not.toHaveBeenCalled();
  });

  it("retries investor handle generation when the readable base collides", async () => {
    const repository = buildRepository({
      createProfile: vi
        .fn()
        .mockRejectedValueOnce(new InvestorHandleCollisionError())
        .mockImplementation(async (input: CreateUserProfileInput) =>
          buildProfile({
            ...input,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT
          })
        )
    });

    await bootstrapAuthenticatedUserProfile(
      buildAuthenticatedUser({
        claims: buildClaims({
          user_metadata: {
            given_name: "Ada",
            family_name: "Lovelace"
          }
        })
      }),
      {
      repository,
      logger: buildLogger(),
      handleSuffixGenerator: () => "abc123"
      }
    );

    expect(repository.createProfile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        investorHandle: "ada-lovelace"
      })
    );
    expect(repository.createProfile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        investorHandle: "ada-lovelace-abc123"
      })
    );
  });

  it("rejects authenticated users without an email address", async () => {
    const repository = buildRepository();
    const logger = buildLogger();

    await expect(
      bootstrapAuthenticatedUserProfile(
        buildAuthenticatedUser({
          email: null,
          claims: buildClaims({ email: undefined })
        }),
        {
          repository,
          logger
        }
      )
    ).rejects.toBeInstanceOf(ProfileBootstrapMissingEmailError);

    expect(repository.createProfile).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "User profile bootstrap failed.",
      expect.objectContaining({
        event: "user_profile.bootstrap_failed",
        userId: TEST_USER_ID
      })
    );
  });
});

describe("completeAuthenticatedUserProfile", () => {
  it("creates a missing profile using submitted profile names", async () => {
    const repository = buildRepository();

    const result = await completeAuthenticatedUserProfile(
      buildAuthenticatedUser({
        email: "email.only@example.com",
        claims: buildClaims({
          email: "email.only@example.com",
          user_metadata: {}
        })
      }),
      {
        firstName: "  Maya  ",
        lastName: "  Singh  "
      },
      {
        repository,
        logger: buildLogger()
      }
    );

    expect(repository.createProfile).toHaveBeenCalledWith({
      id: TEST_USER_ID,
      email: "email.only@example.com",
      firstName: "Maya",
      lastName: "Singh",
      investorHandle: "email-only"
    });
    expect(repository.ensureUserUsage).toHaveBeenCalledWith(TEST_USER_ID);
    expect(result.created).toBe(true);
  });

  it("preserves an existing profile during profile completion", async () => {
    const existingProfile = buildProfile({
      firstName: "Existing",
      lastName: "Person"
    });
    const repository = buildRepository({
      findProfileById: vi.fn().mockResolvedValue(existingProfile)
    });

    const result = await completeAuthenticatedUserProfile(
      buildAuthenticatedUser(),
      {
        firstName: "New",
        lastName: "Name"
      },
      {
        repository,
        logger: buildLogger()
      }
    );

    expect(result).toEqual({
      profile: existingProfile,
      created: false
    });
    expect(repository.createProfile).not.toHaveBeenCalled();
    expect(repository.ensureUserUsage).not.toHaveBeenCalled();
  });

  it("rejects blank submitted profile names", async () => {
    await expect(
      completeAuthenticatedUserProfile(
        buildAuthenticatedUser(),
        {
          firstName: " ",
          lastName: "Name"
        },
        {
          repository: buildRepository(),
          logger: buildLogger()
        }
      )
    ).rejects.toBeInstanceOf(ProfileCompletionRequiredError);
  });
});

describe("PrismaProfileBootstrapRepository", () => {
  it("treats user usage unique-constraint races as already ensured", async () => {
    const prismaClient = {
      userUsage: {
        upsert: vi.fn().mockRejectedValue(
          buildPrismaKnownRequestError("P2002", {
            modelName: "UserUsage"
          })
        )
      }
    };
    const repository = new PrismaProfileBootstrapRepository(
      prismaClient as unknown as ConstructorParameters<typeof PrismaProfileBootstrapRepository>[0]
    );

    await expect(repository.ensureUserUsage(TEST_USER_ID)).resolves.toBeUndefined();
  });

  it("rethrows non-unique user usage failures", async () => {
    const prismaClient = {
      userUsage: {
        upsert: vi.fn().mockRejectedValue(buildPrismaKnownRequestError("P1001"))
      }
    };
    const repository = new PrismaProfileBootstrapRepository(
      prismaClient as unknown as ConstructorParameters<typeof PrismaProfileBootstrapRepository>[0]
    );

    await expect(repository.ensureUserUsage(TEST_USER_ID)).rejects.toMatchObject({
      code: "P1001"
    });
  });
});
