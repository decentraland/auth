/**
 * Retrieves the user's email from localStorage, checking both Thirdweb and Magic keys.
 * Returns null if no email is stored or if localStorage is unavailable.
 */
export function getStoredEmail(): string | null {
  try {
    return localStorage.getItem('dcl_thirdweb_user_email') || localStorage.getItem('dcl_magic_user_email')
  } catch {
    return null
  }
}
