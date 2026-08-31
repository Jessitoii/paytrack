import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/**
 * Creates a Decimal instance safely from number, string, or existing Decimal.
 */
export function toDecimal(value: Decimal | number | string): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Rounds a Decimal to standard 2 currency decimal places (HALF_UP).
 */
export function roundCurrency(value: Decimal | number | string): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Formats a Decimal / number as EUR currency string (e.g., "€ 16,35" or "€ 589,90").
 */
export function formatEUR(value: Decimal | number | string): string {
  const dec = roundCurrency(value);
  const formattedNumber = dec.toFixed(2).replace('.', ',');
  return `€ ${formattedNumber}`;
}
