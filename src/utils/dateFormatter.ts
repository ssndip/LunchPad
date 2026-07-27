/**
 * Formats a date as dd.mm.yyyy.
 */
export const formatDate = (date: Date | string | number): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Formats a date and time as dd.mm.yyyy, HH:MM.
 */
export const formatDateTime = (date: Date | string | number, includeSeconds = false): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const datePart = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${datePart}, ${hours}:${minutes}:${seconds}`;
  }
  return `${datePart}, ${hours}:${minutes}`;
};
