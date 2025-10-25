/**
 * CSV generation utilities
 */

export function generateCSV<T extends Record<string, any>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) {
    return '';
  }

  const keys = headers || Object.keys(data[0]);
  const headerRow = keys.join(',');

  const dataRows = data.map((row) =>
    keys
      .map((key) => {
        const value = row[key];
        if (value === null || value === undefined) {
          return '';
        }
        // Escape double quotes and wrap in quotes if contains comma or newline
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}
