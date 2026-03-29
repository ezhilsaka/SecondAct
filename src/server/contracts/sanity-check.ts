import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

import { buildContractFixturePayloads } from "@/server/contracts/fixtures";

export function runContractSanityCheck() {
  const {
    marketDataInput,
    marketDataResult,
    analysisOutput,
    narrativeOutput,
    reportDocument,
    renderPdfResult
  } = buildContractFixturePayloads();

  assert.equal(narrativeOutput.sections.length, analysisOutput.sections.length);
  assert.deepEqual(
    narrativeOutput.sections.map((section) => section.sectionKey),
    analysisOutput.sections.map((section) => section.sectionKey)
  );
  assert.equal(reportDocument.metadata.marketDataProvider, marketDataResult.provider);
  assert.equal(renderPdfResult.mimeType, "application/pdf");

  return {
    ok: true,
    tickersValidated: marketDataInput.tickers.length,
    analysisSectionsValidated: analysisOutput.sections.length,
    narrativeSectionsValidated: narrativeOutput.sections.length,
    reportSchemaVersion: reportDocument.schemaVersion
  };
}

function isExecutedAsEntryPoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isExecutedAsEntryPoint()) {
  console.log(JSON.stringify(runContractSanityCheck(), null, 2));
}
