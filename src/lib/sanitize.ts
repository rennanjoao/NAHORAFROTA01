import DOMPurify from 'dompurify';

/**
 * Sanitize a string by removing all HTML tags and entities
 * Used for user input that should be plain text only
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  // Remove all HTML tags, keeping only text content
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] }).trim();
}

/**
 * Sanitize XML content by removing potentially dangerous entities
 * and ensuring safe parsing
 */
export function sanitizeXmlContent(xml: string): string {
  if (!xml) return '';
  
  // Remove XML entity declarations that could cause XXE
  let sanitized = xml.replace(/<!ENTITY[^>]*>/gi, '');
  
  // Remove DOCTYPE declarations that could reference external entities
  sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');
  
  // Remove processing instructions that could be malicious
  sanitized = sanitized.replace(/<\?xml[^?]*\?>/gi, '');
  
  // Remove CDATA sections that might contain scripts
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, (match) => {
    // Extract content and escape it
    const content = match.replace(/<!\[CDATA\[/, '').replace(/\]\]>$/, '');
    return escapeXmlEntities(content);
  });
  
  return sanitized;
}

/**
 * Escape XML entities in a string
 */
export function escapeXmlEntities(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validate that a string matches expected format
 */
export function validateFormat(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

/**
 * Validate NF-e access key format (44 digits)
 */
export function validateAccessKey(accessKey: string): boolean {
  return /^\d{44}$/.test(accessKey);
}

/**
 * Validate CEP format (8 digits)
 */
export function validateCep(cep: string): boolean {
  const cleanCep = cep.replace(/\D/g, '');
  return /^\d{8}$/.test(cleanCep);
}

/**
 * Sanitize and validate a monetary value
 */
export function sanitizeMonetaryValue(value: string | number): number {
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.max(0, value);
  }
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : Math.max(0, parsed);
}
