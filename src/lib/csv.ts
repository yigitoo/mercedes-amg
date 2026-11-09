/**
 * CSV üretimi (sunucu ve tarayıcı ortak). Türkçe Excel uyumu: ";" ayırıcı, UTF-8 BOM, CRLF.
 */
export type CsvCell = string | number | null | undefined;

export const CSV_BOM = "﻿";

export function csvCell(value: CsvCell): string {
  if (value == null) return "";
  const text = String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvRow = (row: CsvCell[]) => row.map(csvCell).join(";");

export function toCsv(rows: CsvCell[][]): string {
  return `${CSV_BOM}${rows.map(csvRow).join("\r\n")}\r\n`;
}
