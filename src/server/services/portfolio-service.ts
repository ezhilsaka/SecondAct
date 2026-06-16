import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/db/prisma/client";
import {
  assetClassSchema,
  supportedCurrencySchema,
  uuidSchema
} from "@/server/shared/types";

const PORTFOLIO_READY_STATUS = "READY_FOR_REPORT" as const;
const PORTFOLIO_NEEDS_HOLDINGS_STATUS = "NEEDS_HOLDINGS" as const;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function nullableTextSchema(maxLength: number) {
  return z
    .preprocess((value) => {
      if (typeof value === "string") {
        return normalizeWhitespace(value);
      }

      return value;
    }, z.union([z.string().max(maxLength), z.null(), z.undefined()]))
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null || value.length === 0) {
        return null;
      }

      return value;
    });
}

const portfolioNameSchema = z
  .string()
  .transform(normalizeWhitespace)
  .pipe(z.string().min(1).max(80));

const tickerSchema = z
  .string()
  .transform((value) => value.trim().toUpperCase())
  .pipe(
    z
      .string()
      .min(1)
      .max(15)
      .regex(/^[A-Z0-9.-]+$/, "Ticker can only contain letters, numbers, dots, and hyphens.")
  );

function decimalStringSchema(maxDecimalPlaces: number) {
  return z
    .string()
    .trim()
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/, "Expected a positive decimal string.")
    .refine((value) => {
      const [, fractional = ""] = value.split(".");
      return fractional.length <= maxDecimalPlaces;
    }, `Expected no more than ${maxDecimalPlaces} decimal places.`)
    .refine((value) => new Prisma.Decimal(value).gt(0), "Expected a value greater than 0.");
}

function hasAtLeastOneDefinedValue(values: Record<string, unknown>): boolean {
  return Object.values(values).some((value) => value !== undefined);
}

const createPortfolioInputSchema = z.object({
  userId: uuidSchema,
  name: portfolioNameSchema,
  description: nullableTextSchema(500).optional(),
  baseCurrency: supportedCurrencySchema
});

const updatePortfolioInputSchema = z
  .object({
    userId: uuidSchema,
    portfolioId: uuidSchema,
    name: portfolioNameSchema.optional(),
    description: nullableTextSchema(500).optional(),
    baseCurrency: supportedCurrencySchema.optional()
  })
  .refine(
    ({ name, description, baseCurrency }) =>
      hasAtLeastOneDefinedValue({ name, description, baseCurrency }),
    "At least one portfolio field must be provided."
  );

const portfolioIdentityInputSchema = z.object({
  userId: uuidSchema,
  portfolioId: uuidSchema
});

const holdingInputFieldsSchema = z.object({
  ticker: tickerSchema,
  securityName: nullableTextSchema(120).optional(),
  securityCurrency: supportedCurrencySchema,
  quantity: decimalStringSchema(10),
  averageCost: decimalStringSchema(8),
  notes: nullableTextSchema(500).optional()
});

const addHoldingInputSchema = holdingInputFieldsSchema.extend({
  userId: uuidSchema,
  portfolioId: uuidSchema
});

const updateHoldingInputSchema = z
  .object({
    userId: uuidSchema,
    portfolioId: uuidSchema,
    holdingId: uuidSchema,
    ticker: tickerSchema.optional(),
    securityName: nullableTextSchema(120).optional(),
    securityCurrency: supportedCurrencySchema.optional(),
    quantity: decimalStringSchema(10).optional(),
    averageCost: decimalStringSchema(8).optional(),
    notes: nullableTextSchema(500).optional()
  })
  .refine(
    ({ ticker, securityName, securityCurrency, quantity, averageCost, notes }) =>
      hasAtLeastOneDefinedValue({
        ticker,
        securityName,
        securityCurrency,
        quantity,
        averageCost,
        notes
      }),
    "At least one holding field must be provided."
  );

const holdingIdentityInputSchema = z.object({
  userId: uuidSchema,
  portfolioId: uuidSchema,
  holdingId: uuidSchema
});

export type CreatePortfolioInput = z.input<typeof createPortfolioInputSchema>;
export type UpdatePortfolioInput = z.input<typeof updatePortfolioInputSchema>;
export type PortfolioIdentityInput = z.input<typeof portfolioIdentityInputSchema>;
export type AddHoldingInput = z.input<typeof addHoldingInputSchema>;
export type UpdateHoldingInput = z.input<typeof updateHoldingInputSchema>;
export type HoldingIdentityInput = z.input<typeof holdingIdentityInputSchema>;

export type PortfolioReadiness = {
  status: typeof PORTFOLIO_READY_STATUS | typeof PORTFOLIO_NEEDS_HOLDINGS_STATUS;
  label: "Ready for report" | "Needs holdings";
  isReadyForReport: boolean;
};

export type PortfolioHoldingResult = {
  id: string;
  portfolioId: string;
  ticker: string;
  securityName: string | null;
  assetClass: "EQUITY";
  securityCurrency: "USD" | "CAD";
  quantity: string;
  averageCost: string;
  estimatedCostBasis: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioSummaryResult = {
  id: string;
  name: string;
  description: string | null;
  baseCurrency: "USD" | "CAD";
  sourceType: "MANUAL" | "IMPORTED";
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  holdingCount: number;
  readiness: PortfolioReadiness;
};

export type PortfolioDetailResult = PortfolioSummaryResult & {
  holdings: PortfolioHoldingResult[];
};

export type ArchivePortfolioResult = {
  portfolioId: string;
  archivedAt: string;
};

export type RemoveHoldingResult = {
  holdingId: string;
  removed: true;
};

export class PortfolioNotFoundError extends Error {
  override name = "PortfolioNotFoundError";
}

export class PortfolioArchivedError extends Error {
  override name = "PortfolioArchivedError";
}

export class HoldingNotFoundError extends Error {
  override name = "HoldingNotFoundError";
}

export class DuplicateHoldingTickerError extends Error {
  override name = "DuplicateHoldingTickerError";
}

type PortfolioSummaryRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  baseCurrency: "USD" | "CAD";
  sourceType: "MANUAL" | "IMPORTED";
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    holdings: number;
  };
};

type PortfolioStatusRow = {
  id: string;
  archivedAt: Date | null;
};

type HoldingRow = {
  id: string;
  userId: string;
  portfolioId: string;
  ticker: string;
  securityName: string | null;
  assetClass: "EQUITY";
  securityCurrency: "USD" | "CAD";
  quantity: Prisma.Decimal;
  averageCost: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PortfolioDetailRow = Omit<PortfolioSummaryRow, "_count"> & {
  holdings: HoldingRow[];
};

export type CreatePortfolioRecordInput = {
  userId: string;
  name: string;
  description: string | null;
  baseCurrency: "USD" | "CAD";
};

export type UpdatePortfolioRecordInput = {
  portfolioId: string;
  name?: string;
  description?: string | null;
  baseCurrency?: "USD" | "CAD";
};

export type CreateHoldingRecordInput = {
  userId: string;
  portfolioId: string;
  ticker: string;
  securityName: string | null;
  securityCurrency: "USD" | "CAD";
  quantity: string;
  averageCost: string;
  notes: string | null;
};

export type UpdateHoldingRecordInput = {
  holdingId: string;
  ticker?: string;
  securityName?: string | null;
  securityCurrency?: "USD" | "CAD";
  quantity?: string;
  averageCost?: string;
  notes?: string | null;
};

export interface PortfolioRepository {
  listActivePortfolios(userId: string): Promise<PortfolioSummaryRow[]>;
  getPortfolioStatusByIdAndUser(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioStatusRow | null>;
  getActivePortfolioDetail(userId: string, portfolioId: string): Promise<PortfolioDetailRow | null>;
  createPortfolio(input: CreatePortfolioRecordInput): Promise<PortfolioDetailRow>;
  updatePortfolio(input: UpdatePortfolioRecordInput): Promise<PortfolioDetailRow>;
  archivePortfolio(portfolioId: string, archivedAt: Date): Promise<PortfolioStatusRow>;
  findHoldingByTicker(
    userId: string,
    portfolioId: string,
    ticker: string
  ): Promise<HoldingRow | null>;
  findHoldingById(
    userId: string,
    portfolioId: string,
    holdingId: string
  ): Promise<HoldingRow | null>;
  createHolding(input: CreateHoldingRecordInput): Promise<HoldingRow>;
  updateHolding(input: UpdateHoldingRecordInput): Promise<HoldingRow>;
  removeHolding(holdingId: string): Promise<void>;
}

const portfolioSummarySelect = {
  id: true,
  userId: true,
  name: true,
  description: true,
  baseCurrency: true,
  sourceType: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      holdings: true
    }
  }
} satisfies Prisma.PortfolioSelect;

const holdingSelect = {
  id: true,
  userId: true,
  portfolioId: true,
  ticker: true,
  securityName: true,
  assetClass: true,
  securityCurrency: true,
  quantity: true,
  averageCost: true,
  notes: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.PortfolioHoldingSelect;

export class PrismaPortfolioRepository implements PortfolioRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async listActivePortfolios(userId: string): Promise<PortfolioSummaryRow[]> {
    return this.prismaClient.portfolio.findMany({
      where: {
        userId,
        archivedAt: null
      },
      orderBy: {
        updatedAt: "desc"
      },
      select: portfolioSummarySelect
    });
  }

  async getPortfolioStatusByIdAndUser(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioStatusRow | null> {
    return this.prismaClient.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId
      },
      select: {
        id: true,
        archivedAt: true
      }
    });
  }

  async getActivePortfolioDetail(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioDetailRow | null> {
    return this.prismaClient.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId,
        archivedAt: null
      },
      include: {
        holdings: {
          orderBy: {
            ticker: "asc"
          },
          select: holdingSelect
        }
      }
    });
  }

  async createPortfolio(input: CreatePortfolioRecordInput): Promise<PortfolioDetailRow> {
    return this.prismaClient.portfolio.create({
      data: {
        userId: input.userId,
        name: input.name,
        description: input.description,
        baseCurrency: input.baseCurrency,
        sourceType: "MANUAL"
      },
      include: {
        holdings: {
          select: holdingSelect
        }
      }
    });
  }

  async updatePortfolio(input: UpdatePortfolioRecordInput): Promise<PortfolioDetailRow> {
    return this.prismaClient.portfolio.update({
      where: {
        id: input.portfolioId
      },
      data: {
        name: input.name,
        description: input.description,
        baseCurrency: input.baseCurrency
      },
      include: {
        holdings: {
          orderBy: {
            ticker: "asc"
          },
          select: holdingSelect
        }
      }
    });
  }

  async archivePortfolio(portfolioId: string, archivedAt: Date): Promise<PortfolioStatusRow> {
    return this.prismaClient.portfolio.update({
      where: {
        id: portfolioId
      },
      data: {
        archivedAt
      },
      select: {
        id: true,
        archivedAt: true
      }
    });
  }

  async findHoldingByTicker(
    userId: string,
    portfolioId: string,
    ticker: string
  ): Promise<HoldingRow | null> {
    return this.prismaClient.portfolioHolding.findFirst({
      where: {
        userId,
        portfolioId,
        ticker
      },
      select: holdingSelect
    });
  }

  async findHoldingById(
    userId: string,
    portfolioId: string,
    holdingId: string
  ): Promise<HoldingRow | null> {
    return this.prismaClient.portfolioHolding.findFirst({
      where: {
        id: holdingId,
        userId,
        portfolioId
      },
      select: holdingSelect
    });
  }

  async createHolding(input: CreateHoldingRecordInput): Promise<HoldingRow> {
    return this.prismaClient.portfolioHolding.create({
      data: {
        userId: input.userId,
        portfolioId: input.portfolioId,
        ticker: input.ticker,
        securityName: input.securityName,
        assetClass: "EQUITY",
        securityCurrency: input.securityCurrency,
        quantity: input.quantity,
        averageCost: input.averageCost,
        notes: input.notes
      },
      select: holdingSelect
    });
  }

  async updateHolding(input: UpdateHoldingRecordInput): Promise<HoldingRow> {
    return this.prismaClient.portfolioHolding.update({
      where: {
        id: input.holdingId
      },
      data: {
        ticker: input.ticker,
        securityName: input.securityName,
        securityCurrency: input.securityCurrency,
        quantity: input.quantity,
        averageCost: input.averageCost,
        notes: input.notes
      },
      select: holdingSelect
    });
  }

  async removeHolding(holdingId: string): Promise<void> {
    await this.prismaClient.portfolioHolding.delete({
      where: {
        id: holdingId
      }
    });
  }
}

export function buildPortfolioReadiness(holdingCount: number): PortfolioReadiness {
  if (holdingCount > 0) {
    return {
      status: PORTFOLIO_READY_STATUS,
      label: "Ready for report",
      isReadyForReport: true
    };
  }

  return {
    status: PORTFOLIO_NEEDS_HOLDINGS_STATUS,
    label: "Needs holdings",
    isReadyForReport: false
  };
}

function formatDecimal(value: Prisma.Decimal | string, decimalPlaces: number): string {
  return new Prisma.Decimal(value).toFixed(decimalPlaces);
}

function mapHolding(row: HoldingRow): PortfolioHoldingResult {
  const quantity = formatDecimal(row.quantity, 10);
  const averageCost = formatDecimal(row.averageCost, 8);
  const estimatedCostBasis = new Prisma.Decimal(row.quantity).mul(row.averageCost).toFixed(8);

  return {
    id: row.id,
    portfolioId: row.portfolioId,
    ticker: row.ticker,
    securityName: row.securityName,
    assetClass: assetClassSchema.parse(row.assetClass),
    securityCurrency: supportedCurrencySchema.parse(row.securityCurrency),
    quantity,
    averageCost,
    estimatedCostBasis,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapPortfolioSummary(row: PortfolioSummaryRow): PortfolioSummaryResult {
  const holdingCount = row._count.holdings;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    baseCurrency: supportedCurrencySchema.parse(row.baseCurrency),
    sourceType: row.sourceType,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    holdingCount,
    readiness: buildPortfolioReadiness(holdingCount)
  };
}

function mapPortfolioDetail(row: PortfolioDetailRow): PortfolioDetailResult {
  const holdings = row.holdings.map(mapHolding);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    baseCurrency: supportedCurrencySchema.parse(row.baseCurrency),
    sourceType: row.sourceType,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    holdingCount: holdings.length,
    readiness: buildPortfolioReadiness(holdings.length),
    holdings
  };
}

function isDuplicateHoldingConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (!Array.isArray(target)) {
    return false;
  }

  return target.includes("portfolio_id") || target.includes("ticker");
}

export type PortfolioServiceDependencies = {
  repository?: PortfolioRepository;
  now?: () => Date;
};

export class PortfolioService {
  private readonly repository: PortfolioRepository;
  private readonly now: () => Date;

  constructor(dependencies: PortfolioServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaPortfolioRepository();
    this.now = dependencies.now ?? (() => new Date());
  }

  async listPortfolios(userId: string): Promise<{ portfolios: PortfolioSummaryResult[] }> {
    const parsedUserId = uuidSchema.parse(userId);
    const portfolios = await this.repository.listActivePortfolios(parsedUserId);

    return {
      portfolios: portfolios.map(mapPortfolioSummary)
    };
  }

  async getPortfolioDetail(input: PortfolioIdentityInput): Promise<PortfolioDetailResult> {
    const parsed = portfolioIdentityInputSchema.parse(input);
    const portfolio = await this.loadActivePortfolioDetail(parsed.userId, parsed.portfolioId);

    return mapPortfolioDetail(portfolio);
  }

  async createPortfolio(input: CreatePortfolioInput): Promise<PortfolioDetailResult> {
    const parsed = createPortfolioInputSchema.parse(input);
    const portfolio = await this.repository.createPortfolio({
      userId: parsed.userId,
      name: parsed.name,
      description: parsed.description ?? null,
      baseCurrency: parsed.baseCurrency
    });

    return mapPortfolioDetail(portfolio);
  }

  async updatePortfolio(input: UpdatePortfolioInput): Promise<PortfolioDetailResult> {
    const parsed = updatePortfolioInputSchema.parse(input);
    await this.assertActivePortfolio(parsed.userId, parsed.portfolioId);

    const portfolio = await this.repository.updatePortfolio({
      portfolioId: parsed.portfolioId,
      name: parsed.name,
      description: parsed.description,
      baseCurrency: parsed.baseCurrency
    });

    return mapPortfolioDetail(portfolio);
  }

  async archivePortfolio(input: PortfolioIdentityInput): Promise<ArchivePortfolioResult> {
    const parsed = portfolioIdentityInputSchema.parse(input);
    await this.assertActivePortfolio(parsed.userId, parsed.portfolioId);

    const archivedPortfolio = await this.repository.archivePortfolio(parsed.portfolioId, this.now());

    if (!archivedPortfolio.archivedAt) {
      throw new PortfolioNotFoundError(`Portfolio ${parsed.portfolioId} was not archived.`);
    }

    return {
      portfolioId: archivedPortfolio.id,
      archivedAt: archivedPortfolio.archivedAt.toISOString()
    };
  }

  async addHolding(input: AddHoldingInput): Promise<PortfolioHoldingResult> {
    const parsed = addHoldingInputSchema.parse(input);
    await this.assertActivePortfolio(parsed.userId, parsed.portfolioId);
    await this.assertTickerIsAvailable(parsed.userId, parsed.portfolioId, parsed.ticker);

    try {
      const holding = await this.repository.createHolding({
        userId: parsed.userId,
        portfolioId: parsed.portfolioId,
        ticker: parsed.ticker,
        securityName: parsed.securityName ?? null,
        securityCurrency: parsed.securityCurrency,
        quantity: parsed.quantity,
        averageCost: parsed.averageCost,
        notes: parsed.notes ?? null
      });

      return mapHolding(holding);
    } catch (error) {
      if (isDuplicateHoldingConstraintError(error)) {
        throw new DuplicateHoldingTickerError(
          "This ticker is already in the portfolio. Edit the existing holding instead."
        );
      }

      throw error;
    }
  }

  async updateHolding(input: UpdateHoldingInput): Promise<PortfolioHoldingResult> {
    const parsed = updateHoldingInputSchema.parse(input);
    await this.assertActivePortfolio(parsed.userId, parsed.portfolioId);

    const currentHolding = await this.repository.findHoldingById(
      parsed.userId,
      parsed.portfolioId,
      parsed.holdingId
    );

    if (!currentHolding) {
      throw new HoldingNotFoundError(`Holding ${parsed.holdingId} was not found.`);
    }

    if (parsed.ticker && parsed.ticker !== currentHolding.ticker) {
      await this.assertTickerIsAvailable(parsed.userId, parsed.portfolioId, parsed.ticker);
    }

    try {
      const holding = await this.repository.updateHolding({
        holdingId: parsed.holdingId,
        ticker: parsed.ticker,
        securityName: parsed.securityName,
        securityCurrency: parsed.securityCurrency,
        quantity: parsed.quantity,
        averageCost: parsed.averageCost,
        notes: parsed.notes
      });

      return mapHolding(holding);
    } catch (error) {
      if (isDuplicateHoldingConstraintError(error)) {
        throw new DuplicateHoldingTickerError(
          "This ticker is already in the portfolio. Edit the existing holding instead."
        );
      }

      throw error;
    }
  }

  async removeHolding(input: HoldingIdentityInput): Promise<RemoveHoldingResult> {
    const parsed = holdingIdentityInputSchema.parse(input);
    await this.assertActivePortfolio(parsed.userId, parsed.portfolioId);

    const holding = await this.repository.findHoldingById(
      parsed.userId,
      parsed.portfolioId,
      parsed.holdingId
    );

    if (!holding) {
      throw new HoldingNotFoundError(`Holding ${parsed.holdingId} was not found.`);
    }

    await this.repository.removeHolding(parsed.holdingId);

    return {
      holdingId: parsed.holdingId,
      removed: true
    };
  }

  private async assertActivePortfolio(userId: string, portfolioId: string): Promise<void> {
    const status = await this.repository.getPortfolioStatusByIdAndUser(userId, portfolioId);

    if (!status) {
      throw new PortfolioNotFoundError(`Portfolio ${portfolioId} was not found.`);
    }

    if (status.archivedAt) {
      throw new PortfolioArchivedError(`Portfolio ${portfolioId} has been archived.`);
    }
  }

  private async loadActivePortfolioDetail(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioDetailRow> {
    const portfolio = await this.repository.getActivePortfolioDetail(userId, portfolioId);

    if (portfolio) {
      return portfolio;
    }

    await this.assertActivePortfolio(userId, portfolioId);

    throw new PortfolioNotFoundError(`Portfolio ${portfolioId} was not found.`);
  }

  private async assertTickerIsAvailable(
    userId: string,
    portfolioId: string,
    ticker: string
  ): Promise<void> {
    const duplicate = await this.repository.findHoldingByTicker(userId, portfolioId, ticker);

    if (duplicate) {
      throw new DuplicateHoldingTickerError(
        "This ticker is already in the portfolio. Edit the existing holding instead."
      );
    }
  }
}
