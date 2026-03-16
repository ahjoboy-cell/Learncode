import * as XLSX from "xlsx";

/**
 * Format a number as USD currency string for display in Excel cells.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Apply currency formatting to specified columns in data rows.
 * Returns a new array with those columns converted to formatted strings.
 */
export function applyCurrencyColumns(
  data: Record<string, unknown>[],
  currencyKeys: string[]
): Record<string, unknown>[] {
  return data.map((row) => {
    const newRow = { ...row };
    for (const key of currencyKeys) {
      if (typeof newRow[key] === "number") {
        newRow[key] = formatCurrency(newRow[key] as number);
      }
    }
    return newRow;
  });
}

/**
 * Export an array of objects to an .xlsx file and trigger a browser download.
 *
 * @param data - Array of flat objects (each key becomes a column header)
 * @param sheetName - Name of the worksheet tab
 * @param fileName - Download file name (without extension)
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string
): void {
  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-column widths: measure header + data lengths
  const headers = Object.keys(data[0]);
  const colWidths = headers.map((header) => {
    let maxLen = header.length;
    for (const row of data) {
      const cellValue = row[header];
      const len = cellValue != null ? String(cellValue).length : 0;
      if (len > maxLen) maxLen = len;
    }
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet["!cols"] = colWidths;

  // Bold headers via cell styling (supported by xlsx-style; basic xlsx keeps
  // them as-is but column widths still apply)
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[addr]) {
      worksheet[addr].s = {
        font: { bold: true },
      };
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger browser download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
