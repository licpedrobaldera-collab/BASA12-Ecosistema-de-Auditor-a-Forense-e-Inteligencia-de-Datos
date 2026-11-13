/**
 * Cryptographic helpers and PII Anonymization for Forensic Evidence
 */

export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function calculateStringSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  return calculateSHA256(data.buffer as ArrayBuffer);
}

export function anonymizeForensicText(text: string): string {
  let clean = text;
  // Dominican Cédula: 000-0000000-0 or 11 consecutive digits
  clean = clean.replace(/\b\d{3}-\d{7}-\d{1}\b/g, '[CÉDULA_PROTEGIDA]');
  // RNC (9 or 11 digits)
  clean = clean.replace(/\b(1\d{8}|4\d{8}|5\d{8})\b/g, '[RNC_PROTEGIDO]');
  // Bank accounts (10-20 digits)
  clean = clean.replace(/\b\d{10,20}\b/g, '[CTA_BANCARIA_PROTEGIDA]');
  // Common Name Patterns
  clean = clean.replace(/(?:Sr\.|Sra\.|Lic\.|Dr\.|Ing\.|Don|Doña)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/g, '$1 [APELLIDO_ANONIMIZADO]');
  return clean;
}
