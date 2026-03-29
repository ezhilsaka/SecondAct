import type { RenderPdfInput, RenderPdfResult } from "@/server/contracts";

/**
 * Renderer boundary for converting a validated report document into a PDF artifact.
 */
export interface PdfRenderer {
  readonly rendererName: string;
  render(input: RenderPdfInput): Promise<RenderPdfResult>;
}
