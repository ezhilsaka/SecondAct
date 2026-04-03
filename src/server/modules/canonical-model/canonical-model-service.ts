import { Prisma, type PrismaClient, type ReportRunStatus } from "@prisma/client";

import { prisma } from "@/db/prisma/client";
import type { CanonicalPortfolioSnapshot } from "@/server/contracts";
import { createMarketDataAdapterProvider } from "@/server/providers/market-data-adapter-provider";
import type { MarketDataProvider } from "@/server/providers/market-data-provider";

import {
  buildCanonicalSnapshot,
  type BuildCanonicalSnapshotResult
} from "./build-canonical-snapshot";

type ReportRunWithPortfolioAndHoldings = Prisma.ReportRunGetPayload<{
  include: {
    portfolio: {
      include: {
        holdings: true;
      };
    };
  };
}>;

export class ReportRunNotFoundError extends Error {
  override name = "ReportRunNotFoundError";
}

export class CanonicalSnapshotInputError extends Error {
  override name = "CanonicalSnapshotInputError";
}

export class CanonicalSnapshotUnusableError extends Error {
  override name = "CanonicalSnapshotUnusableError";
}

export type PersistCanonicalSnapshotInput = {
  reportRunId: string;
  snapshot: CanonicalPortfolioSnapshot;
  marketDataProvider: string;
  valuationAsOf: Date | null;
};

export interface CanonicalModelRepository {
  getReportRunWithPortfolio(reportRunId: string): Promise<ReportRunWithPortfolioAndHoldings | null>;
  persistCanonicalSnapshot(input: PersistCanonicalSnapshotInput): Promise<void>;
}

export class PrismaCanonicalModelRepository implements CanonicalModelRepository {
  constructor(private readonly prismaClient: PrismaClient = prisma) {}

  async getReportRunWithPortfolio(reportRunId: string) {
    // This repository is currently used by background-worker-style flows where the
    // caller already owns job dispatch. If a user-facing route reuses this path,
    // it must enforce report-run ownership before calling into the repository.
    return this.prismaClient.reportRun.findUnique({
      where: {
        id: reportRunId
      },
      include: {
        portfolio: {
          include: {
            holdings: true
          }
        }
      }
    });
  }

  async persistCanonicalSnapshot(input: PersistCanonicalSnapshotInput) {
    const canonicalSnapshotJson = JSON.parse(
      JSON.stringify(input.snapshot)
    ) as Prisma.InputJsonValue;

    await this.prismaClient.reportRun.update({
      where: {
        id: input.reportRunId
      },
      data: {
        canonicalSnapshot: canonicalSnapshotJson,
        schemaVersion: input.snapshot.schemaVersion,
        marketDataProvider: input.marketDataProvider,
        valuationAsOf: input.valuationAsOf
      }
    });
  }
}

export type CanonicalModelServiceDependencies = {
  repository?: CanonicalModelRepository;
  marketDataProvider?: MarketDataProvider;
  now?: () => Date;
};

export type CanonicalModelBuildResult = BuildCanonicalSnapshotResult & {
  status: ReportRunStatus;
};

export class CanonicalModelService {
  private readonly repository: CanonicalModelRepository;
  private readonly marketDataProvider: MarketDataProvider;
  private readonly now: () => Date;

  constructor(dependencies: CanonicalModelServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PrismaCanonicalModelRepository();
    this.marketDataProvider = dependencies.marketDataProvider ?? createMarketDataAdapterProvider();
    this.now = dependencies.now ?? (() => new Date());
  }

  async buildForReportRun(reportRunId: string): Promise<CanonicalModelBuildResult> {
    const reportRun = await this.repository.getReportRunWithPortfolio(reportRunId);

    if (!reportRun) {
      throw new ReportRunNotFoundError(`Report run ${reportRunId} was not found.`);
    }

    if (reportRun.portfolio.holdings.length === 0) {
      throw new CanonicalSnapshotInputError(
        `Portfolio ${reportRun.portfolioId} has no holdings to build a canonical snapshot.`
      );
    }

    const marketData = await this.marketDataProvider.getSecurities({
      tickers: reportRun.portfolio.holdings.map((holding) => holding.ticker),
      reportingCurrency: reportRun.reportingCurrency
    });

    const canonicalResult = buildCanonicalSnapshot({
      reportRunId: reportRun.id,
      userId: reportRun.userId,
      portfolioId: reportRun.portfolioId,
      portfolioName: reportRun.portfolio.name,
      portfolioDescription: reportRun.portfolio.description,
      portfolioBaseCurrency: reportRun.portfolio.baseCurrency,
      reportingCurrency: reportRun.reportingCurrency,
      generatedAt: this.now(),
      holdings: reportRun.portfolio.holdings,
      marketData
    });

    if (!canonicalResult.hasPricedHoldings) {
      throw new CanonicalSnapshotUnusableError(
        `Report run ${reportRun.id} does not have any priced holdings after market-data enrichment.`
      );
    }

    await this.repository.persistCanonicalSnapshot({
      reportRunId: reportRun.id,
      snapshot: canonicalResult.snapshot,
      marketDataProvider: marketData.provider,
      valuationAsOf: canonicalResult.valuationAsOf ? new Date(canonicalResult.valuationAsOf) : null
    });

    return {
      ...canonicalResult,
      status: reportRun.status
    };
  }
}
