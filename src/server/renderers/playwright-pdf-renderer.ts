import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser } from "playwright";

import type { RenderPdfInput, RenderPdfResult } from "@/server/contracts";
import type { PdfRenderer } from "@/server/renderers/pdf-renderer";
import { uuidSchema } from "@/server/shared/types";

import { buildReportHtml } from "./build-report-html";

const PDF_TEMP_ROOT = "/tmp/secondact";

export class PlaywrightPdfRenderer implements PdfRenderer {
  readonly rendererName = "playwright-chromium";

  async render(input: RenderPdfInput): Promise<RenderPdfResult> {
    const validatedRunId = uuidSchema.parse(input.metadata.runId);
    const outputDir = path.join(PDF_TEMP_ROOT, validatedRunId);
    const outputPath = path.join(outputDir, "report.pdf");

    await mkdir(outputDir, { recursive: true });

    const html = buildReportHtml(input);

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      await context.route("**/*", (route) => route.abort());
      const page = await context.newPage();

      await page.setContent(html, { waitUntil: "networkidle" });

      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: {
          top: "24mm",
          bottom: "24mm",
          left: "20mm",
          right: "20mm"
        }
      });

      await context.close();
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    const fileInfo = await stat(outputPath);
    const byteSize = Number(fileInfo.size);

    const pdfBuffer = await readFile(outputPath);
    const checksumSha256 = createHash("sha256").update(pdfBuffer).digest("hex");

    return {
      filePath: outputPath,
      mimeType: "application/pdf",
      byteSize,
      checksumSha256
    };
  }
}
