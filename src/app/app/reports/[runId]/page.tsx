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
  return (
    <div className={styles.reportPage}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>Report run</p>
          <h1>{status.portfolioName}</h1>
          <p>Track this report while it moves from request to completion.</p>
        </div>
        <div className={styles.headerActions}>
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
