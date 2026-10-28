/**
 * Secure password generation utility
 * Uses cryptographically secure random number generation
 */

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
const PASSWORD_LENGTH = 12;

/**
 * Generates a cryptographically secure random password
 * @param length - Password length (default: 12)
 * @returns A secure random password string
 */
export function generateSecurePassword(length: number = PASSWORD_LENGTH): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => CHARSET[byte % CHARSET.length]).join('');
}

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validatePasswordStrength(password: string): { isValid: boolean; error?: string } {
  if (password.length < 8) {
    return { isValid: false, error: 'Senha deve ter pelo menos 8 caracteres' };
  }
  
  if (password.length > 72) {
    return { isValid: false, error: 'Senha deve ter no máximo 72 caracteres' };
  }
  
  // Check for at least one uppercase, one lowercase, and one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return { 
      isValid: false, 
      error: 'Senha deve conter letras maiúsculas, minúsculas e números' 
    };
  }
  
  return { isValid: true };
}
