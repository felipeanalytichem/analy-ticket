import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extracts username from email address (part before @)
 * @param email - The email address to extract username from
 * @returns The username portion of the email, or empty string if invalid
 */
export function extractUsernameFromEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }
  
  const atIndex = email.indexOf('@');
  if (atIndex === -1) {
    return '';
  }
  
  return email.substring(0, atIndex);
}

/**
 * Transforms user name data with intelligent fallback logic
 * Priority order:
 * 1. Use full_name if available and not empty
 * 2. Extract username from email address
 * 3. Return "No name provided" as final fallback
 * 
 * @param fullName - The full name from database
 * @param email - The user's email address
 * @returns Transformed name string
 */
export function transformUserName(fullName?: string | null, email?: string): string {
  // Priority 1: Use full_name if available and not empty
  if (fullName && typeof fullName === 'string' && fullName.trim().length > 0) {
    return fullName.trim();
  }
  
  // Priority 2: Extract username from email
  if (email && typeof email === 'string') {
    const username = extractUsernameFromEmail(email);
    if (username.length > 0) {
      return username;
    }
  }
  
  // Priority 3: Final fallback
  return 'No name provided';
}
