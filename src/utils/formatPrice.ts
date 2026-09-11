/**
 * Money for display, to two decimal places.
 *
 * Menu rows written before the server validated prices can still hold NULL, and
 * calling `.toFixed()` on one throws — which during a kiosk render means the
 * error boundary swallows the whole screen. Anything that is not a finite
 * number is shown as zero rather than taking the page down.
 */
export const formatPrice = (value: unknown): string => {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toFixed(2);
};
