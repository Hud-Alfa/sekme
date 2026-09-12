/** Turkish-locale formatting helpers. Used everywhere a number reaches the UI. */

const numberFormat = new Intl.NumberFormat('tr-TR');
const currencyFormat = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatCurrency(value: number): string {
  return currencyFormat.format(value);
}

/** Minutes past midnight -> "20:30". */
export function formatTimeOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Turkish plurals do not inflect the noun after a number, so a count reads the
 * same either way — but the unit word still needs a space and no suffix logic.
 */
export function withUnit(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}
