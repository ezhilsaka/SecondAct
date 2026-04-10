import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";
import type { ReportDocument } from "@/server/contracts";

import { PlaywrightPdfRenderer } from "./playwright-pdf-renderer";

// ---------------------------------------------------------------------------
// Hoisted mocks — these must be created via vi.hoisted so they are available
// inside the vi.mock factory which gets hoisted above variable declarations.
// ---------------------------------------------------------------------------

const { mockPdf, mockSetContent, mockCloseContext, mockCloseBrowser } = vi.hoisted(() => ({
    mockPdf: vi.fn(),
    mockSetContent: vi.fn(),
    mockCloseContext: vi.fn(),
    mockCloseBrowser: vi.fn()
}));

vi.mock("playwright", () => ({
    chromium: {
        launch: vi.fn().mockResolvedValue({
            newContext: vi.fn().mockResolvedValue({
                newPage: vi.fn().mockResolvedValue({
                    setContent: mockSetContent,
                    pdf: mockPdf
                }),
                close: mockCloseContext
            }),
            close: mockCloseBrowser
        })
    }
}));

vi.mock("node:fs/promises", async (importOriginal) => {
    const original = (await importOriginal()) as Record<string, unknown>;
    return {
        ...original,
        mkdir: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockResolvedValue({ size: 42_000 }),
        readFile: vi.fn().mockResolvedValue(Buffer.from("mock-pdf-bytes"))
    };
});

// ---------------------------------------------------------------------------

function getFixtureReport(): ReportDocument {
    return buildContractFixturePayloads().reportDocument;
}

describe("PlaywrightPdfRenderer", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("exposes a renderer name", () => {
        const renderer = new PlaywrightPdfRenderer();
        expect(renderer.rendererName).toBe("playwright-chromium");
    });

    it("creates the output directory with the run ID", async () => {
        const report = getFixtureReport();
        const renderer = new PlaywrightPdfRenderer();

        await renderer.render(report);

        expect(mkdir).toHaveBeenCalledWith(expect.stringContaining(report.metadata.runId), {
            recursive: true
        });
    });

    it("sets HTML content on the Playwright page", async () => {
        const report = getFixtureReport();
        const renderer = new PlaywrightPdfRenderer();

        await renderer.render(report);

        expect(mockSetContent).toHaveBeenCalledOnce();
        const [html, options] = mockSetContent.mock.calls[0]!;
        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("Second Act");
        expect(options).toEqual({ waitUntil: "networkidle" });
    });

    it("generates A4 PDF with correct margins", async () => {
        const renderer = new PlaywrightPdfRenderer();

        await renderer.render(getFixtureReport());

        expect(mockPdf).toHaveBeenCalledOnce();
        const pdfOptions = mockPdf.mock.calls[0]![0];
        expect(pdfOptions.format).toBe("A4");
        expect(pdfOptions.printBackground).toBe(true);
        expect(pdfOptions.margin).toEqual({
            top: "24mm",
            bottom: "24mm",
            left: "20mm",
            right: "20mm"
        });
    });

    it("writes to the correct output path", async () => {
        const report = getFixtureReport();
        const renderer = new PlaywrightPdfRenderer();

        await renderer.render(report);

        const pdfOptions = mockPdf.mock.calls[0]![0];
        expect(pdfOptions.path).toBe(path.join("/tmp/secondact", report.metadata.runId, "report.pdf"));
    });

    it("returns a valid RenderPdfResult", async () => {
        const report = getFixtureReport();
        const renderer = new PlaywrightPdfRenderer();

        const result = await renderer.render(report);

        expect(result.filePath).toBe(path.join("/tmp/secondact", report.metadata.runId, "report.pdf"));
        expect(result.mimeType).toBe("application/pdf");
        expect(result.byteSize).toBe(42_000);
        expect(result.checksumSha256).toBe(
            createHash("sha256").update(Buffer.from("mock-pdf-bytes")).digest("hex")
        );
    });

    it("closes the browser context and browser after rendering", async () => {
        const renderer = new PlaywrightPdfRenderer();

        await renderer.render(getFixtureReport());

        expect(mockCloseContext).toHaveBeenCalledOnce();
        expect(mockCloseBrowser).toHaveBeenCalledOnce();
    });

    it("closes the browser even if PDF generation fails", async () => {
        mockPdf.mockRejectedValueOnce(new Error("PDF render failed"));
        const renderer = new PlaywrightPdfRenderer();

        await expect(renderer.render(getFixtureReport())).rejects.toThrow("PDF render failed");
        expect(mockCloseBrowser).toHaveBeenCalledOnce();
    });

    it("computes the SHA-256 checksum from the written PDF bytes", async () => {
        const renderer = new PlaywrightPdfRenderer();
        const result = await renderer.render(getFixtureReport());

        expect(readFile).toHaveBeenCalled();
        expect(result.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    });

    it("rejects a malformed runId to prevent path traversal", async () => {
        const report = getFixtureReport();
        (report.metadata as Record<string, unknown>).runId = "../../etc";
        const renderer = new PlaywrightPdfRenderer();

        await expect(renderer.render(report)).rejects.toThrow();
        expect(mockPdf).not.toHaveBeenCalled();
    });
});
