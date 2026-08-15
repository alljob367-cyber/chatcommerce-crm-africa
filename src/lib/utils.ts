import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Decimal } from "@prisma/client/runtime/library"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert Prisma Decimal (or number/null/undefined) to plain JavaScript number.
 * Use this whenever a Decimal field needs to be used in arithmetic,
 * comparisons with number, or returned as JSON (which serializes to object).
 */
export function toNum(val: Decimal | number | null | undefined): number {
  if (val == null) return 0;
  return typeof val === "number" ? val : Number(val);
}
