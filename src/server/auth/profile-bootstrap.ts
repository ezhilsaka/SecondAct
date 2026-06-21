import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient, type UserProfile } from "@prisma/client";

import { prisma } from "@/db/prisma/client";
import type { AuthenticatedUser } from "@/server/auth/authenticated-user";
import type { Uuid } from "@/server/shared/types";

const DEFAULT_HANDLE_BASE = "investor";
const MAX_HANDLE_ATTEMPTS = 6;

type ProfileMetadata = Record<string, unknown>;

export type AppUserProfile = Pick<
  UserProfile,
  "id" | "email" | "firstName" | "lastName" | "investorHandle" | "createdAt" | "updatedAt"
>;

export type ProfileBootstrapResult = {
  profile: AppUserProfile;
  created: boolean;
};

export type CreateUserProfileInput = {
  id: Uuid;
  email: string;
  firstName: string;
  lastName: string;
  investorHandle: string;
};

export type CompleteUserProfileInput = {
  firstName: string;
  lastName: string;
};

export type ProfileBootstrapRepository = {
  findProfileById(userId: Uuid): Promise<AppUserProfile | null>;
  findProfileByEmail(email: string): Promise<AppUserProfile | null>;
  createProfile(input: CreateUserProfileInput): Promise<AppUserProfile>;
  updateProfileNames(userId: Uuid, input: CompleteUserProfileInput): Promise<AppUserProfile>;
  ensureUserUsage(userId: Uuid): Promise<void>;
};

export type ProfileBootstrapLogger = {
  info(message: string, context: Record<string, unknown>): void;
  error(message: string, context: Record<string, unknown>): void;
};

export type ProfileBootstrapOptions = {
  repository?: ProfileBootstrapRepository;
  logger?: ProfileBootstrapLogger;
  handleSuffixGenerator?: () => string;
};

export class ProfileBootstrapError extends Error {
  readonly code: string = "PROFILE_BOOTSTRAP_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "ProfileBootstrapError";
  }
}

export class ProfileBootstrapMissingEmailError extends ProfileBootstrapError {
  readonly code = "PROFILE_BOOTSTRAP_MISSING_EMAIL";

  constructor() {
    super("Authenticated user is missing an email address.");
    this.name = "ProfileBootstrapMissingEmailError";
  }
}

export class ProfileCompletionRequiredError extends ProfileBootstrapError {
  readonly code = "PROFILE_COMPLETION_REQUIRED";

  constructor() {
    super("Authenticated user must complete first and last name before entering the app.");
    this.name = "ProfileCompletionRequiredError";
  }
}

export class ProfileEmailAlreadyLinkedError extends ProfileBootstrapError {
  readonly code = "PROFILE_EMAIL_ALREADY_LINKED";

  constructor() {
    super("A user profile already exists for this email under a different auth user ID.");
    this.name = "ProfileEmailAlreadyLinkedError";
  }
}

export class InvestorHandleCollisionError extends Error {
  readonly code = "INVESTOR_HANDLE_COLLISION";

  constructor(message = "Investor handle already exists.") {
    super(message);
    this.name = "InvestorHandleCollisionError";
  }
}

export class PrismaProfileBootstrapRepository implements ProfileBootstrapRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  findProfileById(userId: Uuid): Promise<AppUserProfile | null> {
    return this.prismaClient.userProfile.findUnique({
      where: {
        id: userId
      }
    });
  }

  findProfileByEmail(email: string): Promise<AppUserProfile | null> {
    return this.prismaClient.userProfile.findUnique({
      where: {
        email
      }
    });
  }

  async createProfile(input: CreateUserProfileInput): Promise<AppUserProfile> {
    try {
      return await this.prismaClient.userProfile.create({
        data: input
      });
    } catch (error) {
      if (isEmailUniqueConstraintError(error)) {
        throw new ProfileEmailAlreadyLinkedError();
      }

      if (isInvestorHandleUniqueConstraintError(error)) {
        throw new InvestorHandleCollisionError();
      }

      throw error;
    }
  }

  updateProfileNames(
    userId: Uuid,
    input: CompleteUserProfileInput
  ): Promise<AppUserProfile> {
    return this.prismaClient.userProfile.update({
      where: {
        id: userId
      },
      data: {
        firstName: input.firstName,
        lastName: input.lastName
      }
    });
  }

  async ensureUserUsage(userId: Uuid): Promise<void> {
    try {
      await this.prismaClient.userUsage.upsert({
        where: {
          userId
        },
        update: {},
        create: {
          userId
        }
      });
    } catch (error) {
      if (isUserUsageUniqueConstraintError(error)) {
        return;
      }

      throw error;
    }
  }
}

function isPrismaUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isInvestorHandleUniqueConstraintError(error: unknown): boolean {
  if (!isPrismaUniqueConstraintError(error)) {
    return false;
  }

  const target = error.meta?.target;

  if (!Array.isArray(target)) {
    return false;
  }

  return target.includes("investor_handle") || target.includes("investorHandle");
}

function isEmailUniqueConstraintError(error: unknown): boolean {
  if (!isPrismaUniqueConstraintError(error)) {
    return false;
  }

  const target = error.meta?.target;

  if (!Array.isArray(target)) {
    return false;
  }

  return target.includes("email");
}

function isUserUsageUniqueConstraintError(error: unknown): boolean {
  return isPrismaUniqueConstraintError(error);
}

function readMetadataValue(metadata: ProfileMetadata | undefined, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata?.[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateProfileField(value: string): string {
  return normalizeWhitespace(value).slice(0, 120);
}

function deriveProfileNames(user: AuthenticatedUser): CompleteUserProfileInput | null {
  const metadata = user.claims.user_metadata as ProfileMetadata | undefined;
  const firstName = readMetadataValue(metadata, ["first_name", "given_name", "firstName"]);
  const lastName = readMetadataValue(metadata, ["last_name", "family_name", "lastName"]);

  if (firstName && lastName) {
    return {
      firstName: truncateProfileField(firstName),
      lastName: truncateProfileField(lastName)
    };
  }

  const fullName = readMetadataValue(metadata, ["full_name", "name", "display_name"]);

  if (fullName) {
    const [first, ...rest] = normalizeWhitespace(fullName).split(" ");
    const parsedLastName = rest.join(" ");

    if (!first || !parsedLastName) {
      return null;
    }

    return {
      firstName: truncateProfileField(first),
      lastName: truncateProfileField(parsedLastName)
    };
  }

  return null;
}

function buildInvestorHandleBase(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const normalized = localPart
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return normalized || DEFAULT_HANDLE_BASE;
}

function defaultHandleSuffixGenerator(): string {
  return randomUUID().replace(/-/g, "").slice(0, 6);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown profile bootstrap error.";
}

async function createProfileWithHandleRetry({
  repository,
  user,
  profileNames,
  handleSuffixGenerator
}: {
  repository: ProfileBootstrapRepository;
  user: AuthenticatedUser;
  profileNames: CompleteUserProfileInput;
  handleSuffixGenerator: () => string;
}): Promise<AppUserProfile> {
  if (!user.email) {
    throw new ProfileBootstrapMissingEmailError();
  }

  const baseHandle = buildInvestorHandleBase(user.email);

  for (let attempt = 0; attempt < MAX_HANDLE_ATTEMPTS; attempt += 1) {
    const investorHandle =
      attempt === 0 ? baseHandle : `${baseHandle}-${handleSuffixGenerator()}`;

    try {
      return await repository.createProfile({
        id: user.id,
        email: user.email,
        firstName: profileNames.firstName,
        lastName: profileNames.lastName,
        investorHandle
      });
    } catch (error) {
      if (error instanceof InvestorHandleCollisionError) {
        continue;
      }

      throw error;
    }
  }

  throw new ProfileBootstrapError("Could not generate a unique investor handle.");
}

async function findConflictingProfileByEmail({
  repository,
  user
}: {
  repository: ProfileBootstrapRepository;
  user: AuthenticatedUser;
}): Promise<AppUserProfile | null> {
  if (!user.email) {
    throw new ProfileBootstrapMissingEmailError();
  }

  const profile = await repository.findProfileByEmail(user.email);

  if (!profile) {
    return null;
  }

  if (profile.id !== user.id) {
    throw new ProfileEmailAlreadyLinkedError();
  }

  return profile;
}

function normalizeProfileCompletionInput(input: CompleteUserProfileInput): CompleteUserProfileInput {
  const firstName = truncateProfileField(input.firstName);
  const lastName = truncateProfileField(input.lastName);

  if (!firstName || !lastName) {
    throw new ProfileCompletionRequiredError();
  }

  return {
    firstName,
    lastName
  };
}

export async function bootstrapAuthenticatedUserProfile(
  user: AuthenticatedUser,
  options: ProfileBootstrapOptions = {}
): Promise<ProfileBootstrapResult> {
  const repository = options.repository ?? new PrismaProfileBootstrapRepository();
  const logger = options.logger ?? console;
  const handleSuffixGenerator = options.handleSuffixGenerator ?? defaultHandleSuffixGenerator;

  try {
    const existingProfile = await repository.findProfileById(user.id);

    if (existingProfile) {
      logger.info("User profile loaded.", {
        event: "user_profile.loaded",
        userId: user.id,
        profileId: existingProfile.id,
        investorHandle: existingProfile.investorHandle
      });

      return {
        profile: existingProfile,
        created: false
      };
    }

    const existingProfileByEmail = await findConflictingProfileByEmail({
      repository,
      user
    });

    if (existingProfileByEmail) {
      logger.info("User profile loaded.", {
        event: "user_profile.loaded",
        userId: user.id,
        profileId: existingProfileByEmail.id,
        investorHandle: existingProfileByEmail.investorHandle
      });

      return {
        profile: existingProfileByEmail,
        created: false
      };
    }

    const profileNames = deriveProfileNames(user);

    if (!profileNames) {
      throw new ProfileCompletionRequiredError();
    }

    const profile = await createProfileWithHandleRetry({
      repository,
      user,
      profileNames,
      handleSuffixGenerator
    });

    await repository.ensureUserUsage(user.id);
    logger.info("User profile created.", {
      event: "user_profile.created",
      userId: user.id,
      profileId: profile.id,
      investorHandle: profile.investorHandle
    });

    return {
      profile,
      created: true
    };
  } catch (error) {
    if (error instanceof ProfileCompletionRequiredError) {
      throw error;
    }

    logger.error("User profile bootstrap failed.", {
      event: "user_profile.bootstrap_failed",
      userId: user.id,
      errorCode: error instanceof ProfileBootstrapError ? error.code : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      error: getErrorMessage(error)
    });

    throw error;
  }
}

export async function completeAuthenticatedUserProfile(
  user: AuthenticatedUser,
  input: CompleteUserProfileInput,
  options: ProfileBootstrapOptions = {}
): Promise<ProfileBootstrapResult> {
  const repository = options.repository ?? new PrismaProfileBootstrapRepository();
  const logger = options.logger ?? console;
  const handleSuffixGenerator = options.handleSuffixGenerator ?? defaultHandleSuffixGenerator;
  const profileNames = normalizeProfileCompletionInput(input);

  try {
    const existingProfile = await repository.findProfileById(user.id);

    if (existingProfile) {
      logger.info("User profile loaded.", {
        event: "user_profile.loaded",
        userId: user.id,
        profileId: existingProfile.id,
        investorHandle: existingProfile.investorHandle
      });

      return {
        profile: existingProfile,
        created: false
      };
    }

    const existingProfileByEmail = await findConflictingProfileByEmail({
      repository,
      user
    });

    if (existingProfileByEmail) {
      logger.info("User profile loaded.", {
        event: "user_profile.loaded",
        userId: user.id,
        profileId: existingProfileByEmail.id,
        investorHandle: existingProfileByEmail.investorHandle
      });

      return {
        profile: existingProfileByEmail,
        created: false
      };
    }

    const profile = await createProfileWithHandleRetry({
      repository,
      user,
      profileNames,
      handleSuffixGenerator
    });

    await repository.ensureUserUsage(user.id);
    logger.info("User profile created.", {
      event: "user_profile.created",
      userId: user.id,
      profileId: profile.id,
      investorHandle: profile.investorHandle
    });

    return {
      profile,
      created: true
    };
  } catch (error) {
    logger.error("User profile completion failed.", {
      event: "user_profile.completion_failed",
      userId: user.id,
      errorCode: error instanceof ProfileBootstrapError ? error.code : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      error: getErrorMessage(error)
    });

    throw error;
  }
}

export async function updateAuthenticatedUserProfile(
  user: AuthenticatedUser,
  input: CompleteUserProfileInput,
  options: ProfileBootstrapOptions = {}
): Promise<AppUserProfile> {
  const repository = options.repository ?? new PrismaProfileBootstrapRepository();
  const logger = options.logger ?? console;
  const profileNames = normalizeProfileCompletionInput(input);

  try {
    const profile = await repository.updateProfileNames(user.id, profileNames);

    logger.info("User profile updated.", {
      event: "user_profile.updated",
      userId: user.id,
      profileId: profile.id
    });

    return profile;
  } catch (error) {
    if (error instanceof ProfileCompletionRequiredError) {
      throw error;
    }

    logger.error("User profile update failed.", {
      event: "user_profile.update_failed",
      userId: user.id,
      errorCode: error instanceof ProfileBootstrapError ? error.code : undefined,
      errorName: error instanceof Error ? error.name : undefined,
      error: getErrorMessage(error)
    });

    throw error;
  }
}
