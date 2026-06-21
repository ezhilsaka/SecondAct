import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuthenticatedAppUser } from "@/server/auth/app-session";
import {
  ReportRunNotFoundError,
  ReportRunService,
  type ReportRunStatusResult
} from "@/server/services/report-run-service";
import { uuidSchema } from "@/server/shared/types";

import { ReportStatusPanel } from "./ReportStatusPanel";
import styles from "./page.module.css";

type ReportStatusPageProps = {
  params: Promise<{ runId: string }>;
};

type ReportStatusPageViewProps = {
  status: ReportRunStatusResult;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report Status | Second Act",
  description: "Track a Second Act report generation run."
};

function getReportPageCopy(status: string): { kicker: string; body: string } {
  if (status === "COMPLETED") {
    return {
      kicker: "Report details",
      body: "This report is ready and can be revisited from your private report library."
    };
  }

  if (status === "FAILED") {
    return {
      kicker: "Report issue",
      body: "Review what happened, retry the report, or remove this failed run from your library."
    };
  }

  return {
    kicker: "Report run",
    body: "Track this report while it moves from request to completion."
  };
}

async function loadReportStatus(runId: string): Promise<ReportRunStatusResult> {
  const parsedRunId = uuidSchema.safeParse(runId);

  if (!parsedRunId.success) {
    notFound();
  }

  const user = await requireAuthenticatedAppUser();

  try {
    return await new ReportRunService().getStatus(parsedRunId.data, user.id);
  } catch (error) {
    if (error instanceof ReportRunNotFoundError) {
      notFound();
    }

    throw error;
  }
}

export function ReportStatusPageView({ status }: ReportStatusPageViewProps) {
  const copy = getReportPageCopy(status.status);

  return (
    <div className={styles.reportPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>{copy.kicker}</p>
          <h1>{status.portfolioName}</h1>
          <p>{copy.body}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/app/reports">Back to Reports</Link>
          <Link href={`/app/portfolios/${status.portfolioId}`}>Back to Portfolio</Link>
        </div>
      </header>

      <ReportStatusPanel initialStatus={status} />
    </div>
  );
}

export default async function ReportStatusPage({ params }: ReportStatusPageProps) {
  const { runId } = await params;
  const status = await loadReportStatus(runId);

  return <ReportStatusPageView status={status} />;
}
