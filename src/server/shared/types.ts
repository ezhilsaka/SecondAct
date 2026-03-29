import { z } from "zod";

/**
 * Shared backend primitives used across report-pipeline contracts.
 */
export const uuidSchema = z.uuid();
export const nonEmptyStringSchema = z.string().trim().min(1);
export const nullableNonEmptyStringSchema = nonEmptyStringSchema.nullable();
export const isoTimestampStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid ISO 8601 timestamp."
  });
export const decimalStringSchema = z.string().regex(/^-?(0|[1-9]\d*)(\.\d+)?$/, {
  message: "Expected a decimal string."
});
export const nullableDecimalStringSchema = decimalStringSchema.nullable();
export const dataQualityFlagSchema = nonEmptyStringSchema;
export const supportedCurrencySchema = z.enum(["USD", "CAD"]);
export const assetClassSchema = z.enum(["EQUITY"]);

export type Uuid = z.infer<typeof uuidSchema>;
export type NonEmptyString = z.infer<typeof nonEmptyStringSchema>;
export type NullableNonEmptyString = z.infer<typeof nullableNonEmptyStringSchema>;
export type IsoTimestampString = z.infer<typeof isoTimestampStringSchema>;
export type DecimalString = z.infer<typeof decimalStringSchema>;
export type NullableDecimalString = z.infer<typeof nullableDecimalStringSchema>;
export type DataQualityFlag = z.infer<typeof dataQualityFlagSchema>;
export type SupportedCurrency = z.infer<typeof supportedCurrencySchema>;
export type AssetClass = z.infer<typeof assetClassSchema>;
