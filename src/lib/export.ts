export interface ExcelSheet {
  name: string;
  rows: Array<Record<string, string | number | null>>;
}

/**
 * Build an .xlsx workbook in the browser. Numeric values stay numeric so the
 * exported report can be summed/sorted directly in Excel.
 */
export async function exportToExcel(
  fileName: string,
  sheets: ExcelSheet[]
): Promise<void> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = Object.keys(sheet.rows[0] ?? {});
    const rows = sheet.rows.length ? sheet.rows : [{ "": "داده‌ای وجود ندارد" }];
    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = headers.map((header) => ({
      wch: Math.max(14, Math.min(36, header.length + 8)),
    }));

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
