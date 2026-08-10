// ─────────────────────────────────────────────────────────────
// ChatCommerce CRM Africa — Multi-Devise (Multi-Currency)
// Supports XAF (BEAC), XOF (BCEAO), EUR, USD
// ─────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  /** Exchange rate relative to XAF (base = 1) */
  rate: number;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  XAF: { code: "XAF", name: "FCFA (BEAC)", symbol: "FCFA", locale: "fr-FR", rate: 1 },
  XOF: { code: "XOF", name: "FCFA (BCEAO)", symbol: "FCFA", locale: "fr-FR", rate: 1 },
  EUR: { code: "EUR", name: "Euro", symbol: "\u20AC", locale: "fr-FR", rate: 655.957 },
  USD: { code: "USD", name: "Dollar US", symbol: "$", locale: "en-US", rate: 599.25 },
};

/** All available currency codes */
export const CURRENCY_CODES = Object.keys(CURRENCIES);

/**
 * Format an amount using Intl.NumberFormat with the proper locale.
 *
 * @example
 * formatCurrency(5000, "XAF")  → "5 000 FCFA"
 * formatCurrency(7.62, "EUR")   → "7,62 \u20AC"
 * formatCurrency(100, "USD")   → "$100"
 */
export function formatCurrency(amount: number, currency: string): string {
  const info = CURRENCIES[currency];
  if (!info) {
    // Fallback: treat as XAF
    return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
  }

  // For FCFA currencies, we display integer values with space-separated thousands
  if (info.code === "XAF" || info.code === "XOF") {
    return new Intl.NumberFormat(info.locale).format(Math.round(amount)) + " " + info.symbol;
  }

  // For EUR / USD use the standard Intl formatter which places the symbol correctly
  const formatted = new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: info.code,
    minimumFractionDigits: info.code === "EUR" ? 2 : 0,
    maximumFractionDigits: info.code === "EUR" ? 2 : 0,
  }).format(amount);

  return formatted;
}

/**
 * Convert an amount from one currency to another.
 * All rates are relative to XAF (base currency = 1).
 *
 * @example
 * convertCurrency(655.957, "XAF", "EUR") → 1
 * convertCurrency(1, "EUR", "XAF")       → 655.957
 */
export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount;

  const fromInfo = CURRENCIES[from];
  const toInfo = CURRENCIES[to];

  if (!fromInfo || !toInfo) return amount;

  // Convert to XAF first, then to target currency
  const amountInXAF = amount * fromInfo.rate;
  return amountInXAF / toInfo.rate;
}

/**
 * Return the default currency code for a given country.
 *
 * CEMAC (XAF): Cameroun, Gabon, Congo, Guinée Équatoriale, Tchad, Centrafrique
 * UEMOA (XOF): Sénégal, Mali, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Niger, Togo, Bénin
 * Others: EUR or USD as fallback
 */
export function getCurrencyForCountry(country: string): string {
  const c = (country || "").trim().toLowerCase();

  // CEMAC zone → XAF
  const xafCountries = [
    "cameroun", "cameroon", "gabon", "congo", "guinée équatoriale",
    "guinee equatoriale", "equatorial guinea", "tchad", "chad",
    "centrafrique", "central african republic", "rca",
  ];
  if (xafCountries.some((name) => c === name.toLowerCase())) return "XAF";

  // UEMOA zone → XOF
  const xofCountries = [
    "sénégal", "senegal", "mali", "burkina faso", "côte d'ivoire",
    "cote d'ivoire", "guinée-bissau", "guinee-bissau", "niger",
    "togo", "bénin", "benin",
  ];
  if (xofCountries.some((name) => c === name.toLowerCase())) return "XOF";

  // Francophone Europe → EUR
  const eurCountries = ["france", "belgique", "belgium", "luxembourg"];
  if (eurCountries.some((name) => c === name.toLowerCase())) return "EUR";

  // Default fallback
  return "XAF";
}

/** Get currency info (throws if not found) */
export function getCurrencyInfo(code: string): CurrencyInfo {
  const info = CURRENCIES[code];
  if (!info) throw new Error(`Devise inconnue: ${code}`);
  return info;
}
