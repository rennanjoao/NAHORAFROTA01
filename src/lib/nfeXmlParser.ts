// NF-e XML Parser - Extracts data from Brazilian fiscal documents
import { sanitizeText, sanitizeXmlContent, validateAccessKey, sanitizeMonetaryValue } from './sanitize';

// Maximum allowed XML file size (5MB)
const MAX_XML_SIZE = 5 * 1024 * 1024;

export interface ParsedNFeData {
  accessKey: string;
  nfeNumber: string;
  recipientName: string;
  recipientPhone: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressFull: string;
  totalValue: number;
  totalWeight: number;
  volumeQuantity: number;
  xmlRaw: string;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedNFeData;
  error?: string;
  fileName: string;
}

// Helper to get text content from a tag
function getTagValue(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Helper to get nested tag value within a parent section
function getNestedTagValue(xml: string, parentTag: string, childTag: string): string {
  // Find the parent section
  const parentRegex = new RegExp(`<${parentTag}[^>]*>([\\s\\S]*?)</${parentTag}>`, 'i');
  const parentMatch = xml.match(parentRegex);
  
  if (!parentMatch) return '';
  
  const parentContent = parentMatch[1];
  return getTagValue(parentContent, childTag);
}

// Extract access key from infNFe Id attribute
function extractAccessKey(xml: string): string {
  // Pattern: <infNFe versao="4.00" Id="NFe35...">
  const regex = /<infNFe[^>]*Id="NFe(\d{44})"/i;
  const match = xml.match(regex);
  
  if (match) {
    return match[1];
  }
  
  // Alternative: look for chNFe tag
  const chNFe = getTagValue(xml, 'chNFe');
  if (chNFe && chNFe.length === 44) {
    return chNFe;
  }
  
  return '';
}

// Extract NF-e number
function extractNFeNumber(xml: string): string {
  // Look in ide section
  const ideRegex = /<ide>([\s\S]*?)<\/ide>/i;
  const ideMatch = xml.match(ideRegex);
  
  if (ideMatch) {
    const nNF = getTagValue(ideMatch[1], 'nNF');
    if (nNF) return nNF;
  }
  
  return '';
}

// Format phone number with Brazilian mask
function formatPhoneNumber(phone: string): string {
  if (!phone) return 'Não informado';
  
  // Remove all non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length === 0) return 'Não informado';
  
  // Apply Brazilian phone mask
  if (cleanPhone.length === 11) {
    // Mobile: (00) 00000-0000
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
  } else if (cleanPhone.length === 10) {
    // Landline: (00) 0000-0000
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
  } else if (cleanPhone.length >= 8) {
    // Just the number without area code
    if (cleanPhone.length === 9) {
      return `${cleanPhone.slice(0, 5)}-${cleanPhone.slice(5)}`;
    }
    return `${cleanPhone.slice(0, 4)}-${cleanPhone.slice(4)}`;
  }
  
  return cleanPhone; // Return as-is if doesn't match expected formats
}

// Extract recipient data
function extractRecipientData(xml: string) {
  // Find dest section
  const destRegex = /<dest>([\s\S]*?)<\/dest>/i;
  const destMatch = xml.match(destRegex);
  
  if (!destMatch) {
    return {
      name: '',
      phone: 'Não informado',
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      zip: ''
    };
  }
  
  const destContent = destMatch[1];
  const name = getTagValue(destContent, 'xNome');
  
  // Find enderDest section within dest
  const enderRegex = /<enderDest>([\s\S]*?)<\/enderDest>/i;
  const enderMatch = destContent.match(enderRegex);
  
  // Try to get phone from enderDest first, then from dest directly
  let rawPhone = '';
  
  if (enderMatch) {
    // Primary: dest > enderDest > fone
    rawPhone = getTagValue(enderMatch[1], 'fone');
  }
  
  // Fallback: dest > fone (if not found in enderDest)
  if (!rawPhone) {
    rawPhone = getTagValue(destContent, 'fone');
  }
  
  const phone = formatPhoneNumber(rawPhone);
  
  if (!enderMatch) {
    return {
      name,
      phone,
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: '',
      zip: ''
    };
  }
  
  const enderContent = enderMatch[1];
  
  return {
    name,
    phone,
    street: getTagValue(enderContent, 'xLgr'),
    number: getTagValue(enderContent, 'nro'),
    neighborhood: getTagValue(enderContent, 'xBairro'),
    city: getTagValue(enderContent, 'xMun'),
    state: getTagValue(enderContent, 'UF'),
    zip: getTagValue(enderContent, 'CEP')
  };
}

// Extract total value
function extractTotalValue(xml: string): number {
  // Look in total > ICMSTot > vNF
  const totalRegex = /<total>([\s\S]*?)<\/total>/i;
  const totalMatch = xml.match(totalRegex);
  
  if (!totalMatch) return 0;
  
  const icmsTotRegex = /<ICMSTot>([\s\S]*?)<\/ICMSTot>/i;
  const icmsTotMatch = totalMatch[1].match(icmsTotRegex);
  
  if (!icmsTotMatch) return 0;
  
  const vNF = getTagValue(icmsTotMatch[1], 'vNF');
  return parseFloat(vNF) || 0;
}

// Extract transport/volume data
function extractTransportData(xml: string) {
  // Look in transp > vol
  const transpRegex = /<transp>([\s\S]*?)<\/transp>/i;
  const transpMatch = xml.match(transpRegex);
  
  if (!transpMatch) {
    return { weight: 0, quantity: 1 };
  }
  
  const volRegex = /<vol>([\s\S]*?)<\/vol>/gi;
  const volMatches = transpMatch[1].match(volRegex);
  
  if (!volMatches || volMatches.length === 0) {
    return { weight: 0, quantity: 1 };
  }
  
  let totalWeight = 0;
  let totalQuantity = 0;
  
  volMatches.forEach(volContent => {
    // Try pesoL (peso líquido) first, then pesoB (peso bruto)
    const pesoL = getTagValue(volContent, 'pesoL');
    const pesoB = getTagValue(volContent, 'pesoB');
    const qVol = getTagValue(volContent, 'qVol');
    
    const weight = parseFloat(pesoL) || parseFloat(pesoB) || 0;
    const quantity = parseInt(qVol) || 1;
    
    totalWeight += weight;
    totalQuantity += quantity;
  });
  
  return {
    weight: totalWeight,
    quantity: totalQuantity || 1
  };
}

// Format CEP
function formatCep(cep: string): string {
  if (!cep) return '';
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length === 8) {
    return `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
  }
  return cleanCep;
}

// Build full address
export function buildFullAddress(
  street: string,
  number: string,
  neighborhood: string,
  city: string,
  state: string,
  zip: string
): string {
  const parts = [];
  
  if (street) {
    parts.push(number ? `${street}, ${number}` : street);
  }
  if (neighborhood) parts.push(neighborhood);
  if (city) parts.push(city);
  if (state) parts.push(state);
  if (zip) parts.push(formatCep(zip));
  
  return parts.join(' - ');
}

// Main parser function
export function parseNFeXml(xmlContent: string, fileName: string): ParseResult {
  try {
    // Basic validation
    if (!xmlContent || xmlContent.trim().length === 0) {
      return {
        success: false,
        error: 'Arquivo XML vazio',
        fileName
      };
    }
    
    // Check file size to prevent DoS via large files
    const byteSize = new Blob([xmlContent]).size;
    if (byteSize > MAX_XML_SIZE) {
      return {
        success: false,
        error: `Arquivo muito grande (máximo: ${MAX_XML_SIZE / 1024 / 1024}MB)`,
        fileName
      };
    }
    
    // Sanitize XML content to prevent XXE and entity expansion attacks
    const sanitizedXml = sanitizeXmlContent(xmlContent);
    
    // Check if it's a valid NF-e XML
    if (!sanitizedXml.includes('<NFe') && !sanitizedXml.includes('<nfeProc')) {
      return {
        success: false,
        error: 'Arquivo não é um XML de NF-e válido',
        fileName
      };
    }
    
    // Extract access key
    const accessKey = extractAccessKey(sanitizedXml);
    
    // Validate access key format (must be exactly 44 digits)
    if (!validateAccessKey(accessKey)) {
      return {
        success: false,
        error: 'Chave de acesso não encontrada ou inválida (deve conter 44 dígitos)',
        fileName
      };
    }
    
    // Extract NF-e number
    const nfeNumber = sanitizeText(extractNFeNumber(sanitizedXml));
    
    // Extract recipient data
    const recipient = extractRecipientData(sanitizedXml);
    if (!recipient.name) {
      return {
        success: false,
        error: 'Destinatário não encontrado no XML',
        fileName
      };
    }
    
    // Extract and sanitize values
    const totalValue = sanitizeMonetaryValue(extractTotalValue(sanitizedXml));
    
    // Extract transport data
    const transport = extractTransportData(sanitizedXml);
    
    // Sanitize all extracted text values
    const sanitizedRecipient = {
      name: sanitizeText(recipient.name),
      phone: sanitizeText(recipient.phone),
      street: sanitizeText(recipient.street),
      number: sanitizeText(recipient.number),
      neighborhood: sanitizeText(recipient.neighborhood),
      city: sanitizeText(recipient.city),
      state: sanitizeText(recipient.state),
      zip: sanitizeText(recipient.zip),
    };
    
    // Build full address with sanitized values
    const addressFull = buildFullAddress(
      sanitizedRecipient.street,
      sanitizedRecipient.number,
      sanitizedRecipient.neighborhood,
      sanitizedRecipient.city,
      sanitizedRecipient.state,
      sanitizedRecipient.zip
    );
    
    if (!addressFull) {
      return {
        success: false,
        error: 'Endereço do destinatário não encontrado',
        fileName
      };
    }
    
    const data: ParsedNFeData = {
      accessKey,
      nfeNumber: nfeNumber || `NF-${accessKey.slice(-6)}`,
      recipientName: sanitizedRecipient.name,
      recipientPhone: sanitizedRecipient.phone,
      addressStreet: sanitizedRecipient.street,
      addressNumber: sanitizedRecipient.number,
      addressNeighborhood: sanitizedRecipient.neighborhood,
      addressCity: sanitizedRecipient.city,
      addressState: sanitizedRecipient.state,
      addressZip: formatCep(sanitizedRecipient.zip),
      addressFull,
      totalValue,
      totalWeight: sanitizeMonetaryValue(transport.weight),
      volumeQuantity: Math.max(1, Math.floor(transport.quantity)),
      xmlRaw: sanitizedXml // Store sanitized version
    };
    
    return {
      success: true,
      data,
      fileName
    };
    
  } catch (error) {
    console.error('Error parsing XML:', error);
    return {
      success: false,
      error: `Erro ao processar XML: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      fileName
    };
  }
}

// Parse multiple XML files
export async function parseMultipleXmls(files: File[]): Promise<ParseResult[]> {
  const results: ParseResult[] = [];
  
  for (const file of files) {
    try {
      const content = await file.text();
      const result = parseNFeXml(content, file.name);
      results.push(result);
    } catch (error) {
      results.push({
        success: false,
        error: `Erro ao ler arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        fileName: file.name
      });
    }
  }
  
  return results;
}
