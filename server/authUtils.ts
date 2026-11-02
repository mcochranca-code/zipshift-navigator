import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MIN_PASSWORD_LENGTH = 12;
export const MIN_LOGICAL_AGE = 0;
export const MAX_LOGICAL_AGE = 120;

/** Hashes a password with a fresh random salt using Node.js scrypt. */
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** Compares a password with a stored `salt:hash` value without timing leaks. */
export function verifyPassword(password: string, storedHash: string) {
  const [salt, stored] = storedHash.split(":");
  if (!salt || !stored) return false;
  const calculated = scryptSync(password, salt, 64).toString("hex");
  return stored.length === calculated.length && timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(calculated, "hex"));
}

/** Returns whether a value is a plausible, bounded email address. */
export function validateEmail(email: unknown) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
}

/** Applies the application's minimum length, maximum length, and complexity rules. */
export function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 128) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

/** Parses a real calendar date in ISO `YYYY-MM-DD` form, or returns `null`. */
export function parseDateOfBirth(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/** Calculates age using UTC calendar dates, avoiding local-time-zone boundaries. */
export function calculateAge(dateOfBirth: Date, asOf = new Date()) {
  let age = asOf.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = asOf.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && asOf.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

/** Validates a date-of-birth value and returns its age or a user-facing error. */
export function validateLogicalAge(value: unknown, asOf = new Date()) {
  const date = parseDateOfBirth(value);
  if (!date) return { valid: false, error: "Enter a valid date of birth in YYYY-MM-DD format." };
  if (date > asOf) return { valid: false, error: "Date of birth cannot be in the future." };
  const age = calculateAge(date, asOf);
  if (age < MIN_LOGICAL_AGE || age > MAX_LOGICAL_AGE) return { valid: false, error: `Age must be between ${MIN_LOGICAL_AGE} and ${MAX_LOGICAL_AGE}.` };
  return { valid: true, age };
}
