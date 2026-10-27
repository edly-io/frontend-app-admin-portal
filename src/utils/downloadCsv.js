// Spreadsheet apps run cells that start with these as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;

const csvCell = (value) => {
  if (value === null || value === undefined) { return ''; }
  let text = String(value);
  if (FORMULA_START.test(text)) { text = `'${text}`; }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Build CSV text from a header row and an array of row arrays. */
export const toCsv = (header, rows) => [header, ...rows]
  .map((row) => row.map(csvCell).join(','))
  .join('\r\n');

/**
 * Hand CSV text to the browser as a download. The file only exists in memory
 * (a Blob URL), so nothing is written to the server or to storage.
 */
export const downloadCsv = (filename, csvText) => {
  // BOM so Excel reads UTF-8 names correctly.
  const url = URL.createObjectURL(new Blob([`${String.fromCharCode(0xFEFF)}${csvText}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
