/**
 * Format any date string (YYYY-MM-DD, ISO string, timestamps, or date objects) into DD/MM/YYYY format
 */
export function formatDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';

  try {
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return '-';
      const day = String(dateInput.getDate()).padStart(2, '0');
      const month = String(dateInput.getMonth() + 1).padStart(2, '0');
      const year = dateInput.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const str = String(dateInput).trim();

    // If it's already DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }

    // If it's YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-');
      return `${day}/${month}/${year}`;
    }

    // If it's DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      const [day, month, year] = str.split('-');
      return `${day}/${month}/${year}`;
    }

    // If it's YYYYMMDD
    if (/^\d{8}$/.test(str)) {
      const year = str.slice(0, 4);
      const month = str.slice(4, 6);
      const day = str.slice(6, 8);
      return `${day}/${month}/${year}`;
    }

    // Try parsing as Date (e.g. ISO string like 2026-10-12T07:15:00Z)
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return str;
  } catch {
    return String(dateInput);
  }
}

/**
 * Returns today's date formatted as DD/MM/YYYY
 */
export function getTodayFormatted(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

