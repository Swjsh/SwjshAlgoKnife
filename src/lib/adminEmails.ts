/**
 * List of authorized admin emails.
 * This file is safe for client-side imports (no server dependencies).
 */
export const ADMIN_EMAILS = ['jack.watergun@gmail.com'];

/**
 * Check if an email is an admin (client-safe)
 */
export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}
