/** Portal-local payment formatting helpers shared by StudentPayments and PaymentsReview. */

/** Formats a money amount with the currency's symbol ($ for USD, L$ for LRD). */
export function money(amount: number, currency: "USD" | "LRD"): string {
  const symbol = currency === "USD" ? "$" : "L$";
  return `${symbol}${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
