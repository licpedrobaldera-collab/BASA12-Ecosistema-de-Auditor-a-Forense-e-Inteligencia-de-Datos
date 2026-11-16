import express from 'express';
import { GoogleGenAI, GenerateContentParameters } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { extractText as extractPdfText } from 'unpdf';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistent Local Forensic DB
const DB_DIR = path.resolve(__dirname, 'forensic_system_db');
const CASES_DB_FILE = path.join(DB_DIR, 'cases.json');
const ENTITIES_DB_FILE = path.join(DB_DIR, 'entities.json');

function ensureDbFiles() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(CASES_DB_FILE)) {
    fs.writeFileSync(CASES_DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(ENTITIES_DB_FILE)) {
    fs.writeFileSync(ENTITIES_DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readJsonDb<T>(filePath: string, fallback: T): T {
  try {
    ensureDbFiles();
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonDb<T>(filePath: string, data: T): void {
  ensureDbFiles();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

ensureDbFiles();

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransientAiError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.code;
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('rate limit')
  );
}

/**
 * Resilient Gemini caller with exponential backoff + model fallback
 * Resolves transient 503 UNAVAILABLE spikes seamlessly.
 */
async function callGeminiWithResilience(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'>,
  preferredModels: string[] = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
) {
  let lastError: any = null;

  for (const model of preferredModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model,
        });
        return { response, modelUsed: model };
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err || '');
        console.warn(`[Gemini ${model}] attempt ${attempt + 1} failed:`, errMsg);
        if (errMsg.includes('exceeded your current quota') || errMsg.includes('404') || errMsg.includes('NOT_FOUND')) {
          break;
        }
        if (!isTransientAiError(err)) {
          throw err;
        }
        await sleep(900 * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('El motor de IA no respondió tras múltiples reintentos.');
}

function parseJsonSafe<T>(rawText: string, fallback: T): T {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const match = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/) || rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[1] || match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function anonymizeText(text: string): string {
  let clean = text;
  clean = clean.replace(/\b\d{3}-\d{7}-\d{1}\b/g, '[CÉDULA_PROTEGIDA]');
  clean = clean.replace(/\b(1\d{8}|4\d{8}|5\d{8})\b/g, '[RNC_PROTEGIDO]');
  clean = clean.replace(/\b\d{10,20}\b/g, '[CTA_BANCARIA_PROTEGIDA]');
  clean = clean.replace(
    /(?:Sr\.|Sra\.|Lic\.|Dr\.|Ing\.|Don|Doña)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/g,
    '$1 [APELLIDO_ANONIMIZADO]'
  );
  return clean;
}

function extractNumericAmountsFromText(text: string): number[] {
  const matches = text.match(/(?:RD\$|US\$|\$|€)?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g) || [];
  const nums: number[] = [];
  for (const m of matches) {
    const cleaned = m.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    const val = parseFloat(cleaned);
    if (!isNaN(val) && val >= 100 && val < 1e13) {
      nums.push(val);
    }
  }
  return nums.slice(0, 1000);
}

async function parseBufferByType(buffer: Buffer, fileName: string, mimeType: string) {
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const ext = path.extname(fileName.split('?')[0]).toLowerCase();

  let extractedText = '';
  let extractedRows: Record<string, any>[] = [];
  let sheetNames: string[] = [];
  let pageCount: number | undefined;
  let parsedFormat = ext ? ext.replace('.', '').toUpperCase() : 'DIGITAL';
  let numericAmounts: number[] = [];
  let discoveredLinks: { label: string; url: string }[] = [];

  // 1. EXCEL / SPREADSHEETS / CSV
  if (
    ['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods', '.csv', '.tsv'].includes(ext) ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('text/csv')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    sheetNames = workbook.SheetNames;
    parsedFormat = ext === '.csv' || mimeType.includes('csv') ? 'CSV' : 'EXCEL';

    const textParts: string[] = [];
    for (const sName of sheetNames) {
      const sheet = workbook.Sheets[sName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      if (jsonRows.length > 0) {
        extractedRows = extractedRows.concat(jsonRows.slice(0, 500 - extractedRows.length));
      }
      const csvContent = XLSX.utils.sheet_to_csv(sheet);
      textParts.push(`=== HOJA: ${sName} (${jsonRows.length} filas) ===\n${csvContent}`);

      for (const row of jsonRows) {
        for (const val of Object.values(row)) {
          if (typeof val === 'number' && val > 0) {
            numericAmounts.push(val);
          } else if (typeof val === 'string') {
            const cleaned = val.replace(/[^0-9.-]/g, '');
            const num = parseFloat(cleaned);
            if (!isNaN(num) && num >= 100) numericAmounts.push(num);
          }
        }
      }
    }
    extractedText = textParts.join('\n\n');
  }
  // 2. WORD (.docx, .docm)
  else if (['.docx', '.docm'].includes(ext) || mimeType.includes('wordprocessingml')) {
    parsedFormat = 'WORD (.DOCX)';
    const result = await mammoth.extractRawText({ buffer });
    extractedText = (result.value || '').trim();
    numericAmounts = extractNumericAmountsFromText(extractedText);
  }
  // 3. PDF (.pdf)
  else if (ext === '.pdf' || mimeType.includes('application/pdf')) {
    parsedFormat = 'PDF';
    try {
      const pdfResult = await extractPdfText(new Uint8Array(buffer));
      pageCount = pdfResult.totalPages;
      extractedText = Array.isArray(pdfResult.text)
        ? pdfResult.text.join('\n\n')
        : String(pdfResult.text || '');
      extractedText = extractedText.trim();
    } catch (pdfErr) {
      console.warn('unpdf extraction fallback:', pdfErr);
    }

    if (!extractedText || extractedText.length < 25) {
      const ai = getAiClient();
      if (ai && buffer.length <= 15 * 1024 * 1024) {
        try {
          const { response } = await callGeminiWithResilience(ai, {
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: buffer.toString('base64'),
                  },
                },
                {
                  text: 'Extrae y transcribe literalmente todo el texto, tablas, montos, fechas, nombres de entidades y cláusulas de este documento PDF para auditoría forense.',
                },
              ],
            },
          });
          extractedText = response.text || extractedText;
          parsedFormat = 'PDF (OCR IA)';
        } catch (ocrErr) {
          console.warn('Gemini PDF OCR skipped/failed:', ocrErr);
        }
      }
    }
    numericAmounts = extractNumericAmountsFromText(extractedText);
  }
  // 4. IMAGES (OCR IA)
  else if (
    ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'].includes(ext) ||
    mimeType.startsWith('image/')
  ) {
    parsedFormat = `IMAGEN (${ext.replace('.', '').toUpperCase() || 'OCR'})`;
    const ai = getAiClient();
    if (ai) {
      try {
        const { response } = await callGeminiWithResilience(ai, {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/png',
                  data: buffer.toString('base64'),
                },
              },
              {
                text: 'Extrae literalmente todo el texto visible, números de factura/contrato, fechas, RNC/NIF, importes monetarios y detalles relevantes de esta imagen.',
              },
            ],
          },
        });
        extractedText = response.text || '';
      } catch (imgErr: any) {
        extractedText = `[Imagen digital ${fileName} - OCR no disponible temporalmente: ${imgErr.message}]`;
      }
    } else {
      extractedText = `[Imagen digital ${fileName} cargada (${(buffer.length / 1024).toFixed(1)} KB). SHA-256: ${sha256}]`;
    }
    numericAmounts = extractNumericAmountsFromText(extractedText);
  }
  // 5. HTML / WEB PORTAL
  else if (['.html', '.htm'].includes(ext) || mimeType.includes('text/html')) {
    parsedFormat = 'PORTAL HTML';
    const rawHtml = buffer.toString('utf-8');
    // Discover links to documents/portals
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(rawHtml)) !== null && discoveredLinks.length < 40) {
      const href = m[1].trim();
      const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && label) {
        discoveredLinks.push({ label: label.slice(0, 120), url: href });
      }
    }
    extractedText = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|tr|li|h1|h2|h3|h4|td|th)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n')
      .trim();
    numericAmounts = extractNumericAmountsFromText(extractedText);
  }
  // 6. TEXT / JSON / XML / LOG / SQL
  else if (
    ['.txt', '.json', '.xml', '.md', '.log', '.sql', '.yaml', '.yml', '.eml', '.ini', '.conf', '.py', '.ts', '.js'].includes(ext) ||
    mimeType.startsWith('text/') ||
    mimeType.includes('json') ||
    mimeType.includes('xml')
  ) {
    parsedFormat = ext ? ext.replace('.', '').toUpperCase() : 'TEXTO';
    const rawStr = buffer.toString('utf-8');
    if (ext === '.json' || mimeType.includes('json')) {
      try {
        const parsed = JSON.parse(rawStr);
        extractedText = JSON.stringify(parsed, null, 2);
        if (Array.isArray(parsed)) {
          extractedRows = parsed.slice(0, 500);
        }
      } catch {
        extractedText = rawStr;
      }
    } else {
      extractedText = rawStr;
    }
    numericAmounts = extractNumericAmountsFromText(extractedText);
  }
  // 7. ANY OTHER DIGITAL FORMAT
  else {
    parsedFormat = ext ? `DIGITAL (${ext.toUpperCase()})` : 'FORMATO DIGITAL';
    const decoded = buffer.toString('utf-8');
    const printableRuns = decoded.match(/[\p{L}\p{N}\p{P}\p{Zs}\r\n\t]{4,}/gu) || [];
    extractedText = printableRuns.join('\n').trim();
    if (!extractedText || extractedText.length < 25) {
      extractedText = `[Archivo digital "${fileName}" (${(buffer.length / 1024).toFixed(2)} KB) custodiado con sello SHA-256: ${sha256}]`;
    }
    numericAmounts = extractNumericAmountsFromText(extractedText);
  }

  return {
    sha256,
    parsedFormat,
    pageCount,
    sheetNames,
    extractedText: extractedText.slice(0, 120000),
    contentSnippet: extractedText.slice(0, 1000),
    extractedRows: extractedRows.slice(0, 500),
    numericAmounts: numericAmounts.slice(0, 1000),
    discoveredLinks,
  };
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    primaryModel: 'gemini-4-hydrogen',
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// PARSE FILE (PDF, Excel, Word, TXT, JSON, HTML, Images OCR, Digital)
// =========================================================================
app.post('/api/forensic/parse-file', async (req, res) => {
  try {
    const { fileName = 'documento', mimeType = '', base64Data = '' } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No se recibió contenido del archivo.' });
    }
    const buffer = Buffer.from(base64Data, 'base64');
    const parsed = await parseBufferByType(buffer, fileName, mimeType);
    res.json({
      success: true,
      fileName,
      size: buffer.length,
      ...parsed,
      totalCharacters: parsed.extractedText.length,
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/parse-file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al leer y procesar el archivo digital.',
    });
  }
});

// =========================================================================
// FETCH & EXTRACT FROM LIVE URL / TRANSPARENCY PORTAL / ONLINE DOCUMENT
// =========================================================================
app.post('/api/forensic/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Debe proporcionar un enlace o URL válida.' });
    }

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsedUrl = new URL(normalizedUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    const resp = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ForensicAuditExtractor/1.0)',
        Accept: 'text/html,application/pdf,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return res.status(400).json({
        success: false,
        error: `El portal respondió con código HTTP ${resp.status} (${resp.statusText}). Verifique que el enlace sea público.`,
      });
    }

    const arrayBuf = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType = resp.headers.get('content-type') || 'text/html';
    const fileNameFromUrl = path.basename(parsedUrl.pathname) || parsedUrl.hostname;

    const parsed = await parseBufferByType(buffer, fileNameFromUrl, contentType);
    // Resolve relative discovered links to absolute URLs
    const resolvedLinks = (parsed.discoveredLinks || []).map((lnk) => {
      try {
        return { label: lnk.label, url: new URL(lnk.url, parsedUrl.toString()).toString() };
      } catch {
        return lnk;
      }
    });

    res.json({
      success: true,
      url: parsedUrl.toString(),
      fileName: fileNameFromUrl,
      mimeType: contentType,
      size: buffer.length,
      ...parsed,
      discoveredLinks: resolvedLinks,
      totalCharacters: parsed.extractedText.length,
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/fetch-url:', error);
    res.status(500).json({
      success: false,
      error: `No se pudo leer el enlace o portal: ${error.message}`,
    });
  }
});

// =========================================================================
// AI STRUCTURED EXTRACTOR FROM VERBATIM TEXT (Real Contracts, Payments, Entity)
// =========================================================================
app.post('/api/forensic/extract-structured', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY no configurada en el servidor.',
      });
    }

    const { rawText = '', entityName = '', paisNormativa = 'República Dominicana', adendaThresholdPct = 50 } = req.body;
    if (!rawText.trim()) {
      return res.status(400).json({ success: false, error: 'No hay texto extraído para analizar.' });
    }

    const promptText = `
[EXTRACCIÓN FORENSE ESTRICTA DESDE TEXTO REAL DE ORIGEN]
Entidad Auditada: ${entityName || 'Por determinar del documento'}
País / Normativa: ${paisNormativa}

REGLA DE ORO ANTI-ALUCINACIÓN:
Extrae ÚNICAMENTE datos reales que aparezcan literalmente en el TEXTO SUMINISTRADO.
NO inventes nombres de proveedores, contratos, facturas ni montos que no estén en el texto.
Si un campo no aparece en el texto, déjalo vacío "" o en 0.

[TEXTO REAL SUMINISTRADO]:
${rawText.slice(0, 35000)}

Devuelve JSON estricto con esta estructura:
{
  "entidadDetectada": {
    "nombre": "Nombre oficial encontrado en el texto o vacío",
    "rncNif": "RNC/NIF si aparece o vacío",
    "alcanceResumen": "Resumen literal del alcance/antecedentes del documento"
  },
  "contratosDetectados": [
    {
      "contratoId": "Código o proceso real",
      "proveedor": "Nombre real del proveedor/beneficiario",
      "rnc": "RNC/NIF real o N/D",
      "montoOriginal": 0,
      "montoAdenda": 0,
      "fechaContrato": "YYYY-MM-DD",
      "fechaAdenda": "YYYY-MM-DD",
      "objeto": "Descripción literal del bien/servicio/obra"
    }
  ],
  "cicloPagosDetectado": [
    {
      "ordenNumero": "OC / Proceso / Solicitud",
      "contratoId": "Contrato vinculado",
      "beneficiario": "Proveedor o empleado real",
      "rnc": "RNC/Cédula si consta o N/D",
      "fechaSolicitud": "YYYY-MM-DD",
      "numeroFacturaEcf": "NCF / e-CF / Factura si consta",
      "fechaFactura": "YYYY-MM-DD",
      "tieneRecepcionConduce": true,
      "fechaRecepcion": "YYYY-MM-DD",
      "numeroLibramientoPago": "Libramiento / Cheque / Transferencia si consta",
      "fechaPago": "YYYY-MM-DD",
      "bancoCuenta": "Banco o cuenta si consta",
      "montoFacturado": 0,
      "retencionesImpuestos": 0,
      "montoPagadoNeto": 0,
      "observacionPago": "Estado o incidencia literal del pago"
    }
  ],
  "observacionesDetectadas": [
    {
      "codigoObservacion": "OBS-01",
      "titulo": "Título del hallazgo u observación real en el texto",
      "descripcionPreliminar": "Descripción literal extraída del documento",
      "descargoAlegato": "Descargo/justificación si consta en el texto",
      "montoInvolucrado": 0,
      "severidad": "CRÍTICA | ALTA | MEDIA | LEVE"
    }
  ]
}
`;

    const { response, modelUsed } = await callGeminiWithResilience(ai, {
      contents: promptText,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = parseJsonSafe<any>(response.text || '{}', {
      entidadDetectada: {},
      contratosDetectados: [],
      cicloPagosDetectado: [],
      observacionesDetectadas: [],
    });

    // Normalize contracts
    const contracts = (parsed.contratosDetectados || []).map((c: any, idx: number) => {
      const orig = Number(c.montoOriginal) || 0;
      const adenda = Number(c.montoAdenda) || 0;
      const pct = orig > 0 ? Number(((adenda / orig) * 100).toFixed(2)) : 0;
      const anomalo = pct > adendaThresholdPct;
      return {
        id: `EXT-CT-${Date.now()}-${idx}`,
        contratoId: c.contratoId || `DOC-${idx + 1}`,
        proveedor: c.proveedor || 'No especificado en origen',
        rnc: c.rnc || 'N/D',
        montoOriginal: orig,
        montoAdenda: adenda,
        adendaPct: pct,
        fechaContrato: c.fechaContrato || '',
        fechaAdenda: c.fechaAdenda || '',
        origen: 'Extracción Textual Origen',
        objeto: c.objeto || '',
        esAnomalo: anomalo,
        motivoAlerta: anomalo ? `Variación +${pct}% excede umbral ${adendaThresholdPct}%` : 'Extraído de documento real',
      };
    });

    // Normalize payment cycle rows
    const payments = (parsed.cicloPagosDetectado || []).map((p: any, idx: number) => {
      const facturado = Number(p.montoFacturado) || 0;
      const ret = Number(p.retencionesImpuestos) || 0;
      const neto = Number(p.montoPagadoNeto) || Math.max(0, facturado - ret);
      const hasRecepcion = Boolean(p.tieneRecepcionConduce);
      const hasEcf = Boolean(p.numeroFacturaEcf && p.numeroFacturaEcf.trim() !== '' && p.numeroFacturaEcf !== 'N/D');
      let estadoCiclo = 'COMPLETO';
      if (!hasRecepcion) estadoCiclo = 'SIN_RECEPCION';
      else if (!hasEcf) estadoCiclo = 'SIN_COMPROBANTE';

      return {
        id: `PAY-${Date.now()}-${idx}`,
        ordenNumero: p.ordenNumero || `OC-${idx + 1}`,
        contratoId: p.contratoId || '',
        beneficiario: p.beneficiario || 'Beneficiario extraído',
        rnc: p.rnc || 'N/D',
        fechaSolicitud: p.fechaSolicitud || '',
        numeroFacturaEcf: p.numeroFacturaEcf || '',
        fechaFactura: p.fechaFactura || '',
        tieneRecepcionConduce: hasRecepcion,
        fechaRecepcion: p.fechaRecepcion || '',
        numeroLibramientoPago: p.numeroLibramientoPago || '',
        fechaPago: p.fechaPago || '',
        bancoCuenta: p.bancoCuenta || '',
        montoFacturado: facturado,
        retencionesImpuestos: ret,
        montoPagadoNeto: neto,
        estadoCiclo,
        observacionPago: p.observacionPago || 'Extraído del documento fuente',
      };
    });

    res.json({
      success: true,
      modelUsed,
      entidadDetectada: parsed.entidadDetectada || {},
      contratosDetectados: contracts,
      cicloPagosDetectado: payments,
      observacionesDetectadas: parsed.observacionesDetectadas || [],
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/extract-structured:', error);
    res.status(error?.status === 503 ? 503 : 500).json({
      success: false,
      error: error.message || 'Error extrayendo datos estructurados con IA.',
    });
  }
});

// =========================================================================
// AI STEP-BY-STEP GUIDE COACH (Guides user step 1 -> 5 with real data)
// =========================================================================
app.post('/api/forensic/guide-step', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY no configurada en el servidor.',
      });
    }

    const {
      step = 1,
      entity = null,
      caseName = '',
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      evidenceSummary = '',
      contractsCount = 0,
      paymentsCount = 0,
      observationsCount = 0,
      hasFinalResult = false,
    } = req.body;

    const promptText = `
[GUÍA PERICIAL PASO A PASO CON IA]
Eres un Director de Auditoría Forense guiando paso a paso al auditor en tiempo real.
Idioma de respuesta: ${idioma}
País / Normativa: ${paisNormativa}
Paso actual del flujo (1 al 5): PASO ${step}

DATOS REALES ACTUALES DEL EXPEDIENTE EN CURSO:
- Entidad Auditada: ${entity ? `${entity.nombre} (${entity.siglas}, RNC/NIF: ${entity.rncNif})` : 'Aún no registrada'}
- Antecedentes / Alcance de la Entidad: ${entity?.descripcion ? entity.descripcion.slice(0, 1500) : 'Sin descripción'}
- Caso activo: ${caseName || 'Sin nombre'}
- Evidencia textual / archivo / URL cargada: ${evidenceSummary ? evidenceSummary.slice(0, 2500) : 'Aún no cargada'}
- Registros en Matriz Contractual: ${contractsCount}
- Registros en Ciclo de Pagos: ${paymentsCount}
- Observaciones cargadas: ${observationsCount}
- Dictamen Final generado: ${hasFinalResult ? 'Sí' : 'No'}

Devuelve JSON estricto guiando este PASO ${step} y proponiendo mejoras concretas basadas SOLO en los datos reales suministrados:
{
  "estadoPaso": "LISTO | ATENCION | PENDIENTE",
  "diagnostico": "Evaluación clara y breve del estado real del paso actual para esta entidad.",
  "pasosRecomendados": [
    "Acción concreta 1 que el auditor debe verificar o completar ahora",
    "Acción concreta 2",
    "Acción concreta 3"
  ],
  "mejorasSugeridas": [
    "Mejora concreta de procedimiento o control interno aplicable a esta entidad y los datos cargados",
    "Segunda mejora de calidad pericial"
  ],
  "siguientePasoMensaje": "Indicación precisa para avanzar al siguiente paso o concluir el dictamen."
}
`;

    const { response, modelUsed } = await callGeminiWithResilience(ai, {
      contents: promptText,
      config: { responseMimeType: 'application/json' },
    });

    const data = parseJsonSafe<any>(response.text || '{}', {
      estadoPaso: 'ATENCION',
      diagnostico: 'Revise los campos suministrados en este paso antes de continuar.',
      pasosRecomendados: ['Verifique los datos reales ingresados.', 'Guarde el avance del expediente.'],
      mejorasSugeridas: ['Documentar cada fuente con sello SHA-256 y referencia normativa vigente.'],
      siguientePasoMensaje: 'Puede continuar al siguiente paso cuando valide esta información.',
    });

    res.json({ success: true, modelUsed, guide: data });
  } catch (error: any) {
    console.error('Error in /api/forensic/guide-step:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'No se pudo generar la guía IA para este paso.',
    });
  }
});

// =========================================================================
// ANALYZE PAYMENT CYCLE (Ciclo de Pagos Completo)
// =========================================================================
app.post('/api/forensic/analyze-payment-cycle', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY no configurada en el servidor.' });
    }

    const {
      entityName = 'Entidad Auditada',
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      paymentCycleRows = [],
      contractRows = [],
    } = req.body;

    if (!Array.isArray(paymentCycleRows) || paymentCycleRows.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay registros en el Ciclo de Pagos para analizar.' });
    }

    const promptText = `
[AUDITORÍA FORENSE DEL CICLO DE PAGOS - DATOS REALES]
Entidad: ${entityName}
Jurisdicción: ${paisNormativa}
Idioma: ${idioma}

Registros del Ciclo de Pagos (Solicitud -> Contrato -> Recepción -> e-CF -> Libramiento -> Pago Neto):
${JSON.stringify(paymentCycleRows.slice(0, 80), null, 2)}

Contratos de Referencia:
${JSON.stringify(contractRows.slice(0, 40), null, 2)}

Analiza ÚNICAMENTE estos datos reales y detecta:
1. Pagos sin acta de recepción/conduce conforme.
2. Pagos sin comprobante fiscal (e-CF / factura) o con fechas inconsistentes (pago antes de factura o recepción).
3. Posible fraccionamiento de pagos consecutivos al mismo beneficiario.
4. Diferencias entre monto facturado, retenciones y monto pagado neto, o exceso sobre contrato.
5. Mejoras concretas al ciclo de control interno de pagos y tesorería.

Devuelve JSON estricto:
{
  "resumenCiclo": "Diagnóstico forense integral del ciclo de pagos basado en los datos reales.",
  "hallazgosCriticos": ["Hallazgo 1 con datos reales", "Hallazgo 2"],
  "mejorasControlPagos": ["Mejora operativa/normativa 1", "Mejora 2", "Mejora 3"],
  "riesgoCiclo": "CRÍTICO | ALTO | MEDIO | BAJO"
}
`;

    const { response, modelUsed } = await callGeminiWithResilience(ai, {
      contents: promptText,
      config: { responseMimeType: 'application/json' },
    });

    const data = parseJsonSafe<any>(response.text || '{}', {
      resumenCiclo: 'Análisis del ciclo de pagos completado.',
      hallazgosCriticos: [],
      mejorasControlPagos: [],
      riesgoCiclo: 'MEDIO',
    });

    res.json({ success: true, modelUsed, data });
  } catch (error: any) {
    console.error('Error in /api/forensic/analyze-payment-cycle:', error);
    res.status(500).json({ success: false, error: error.message || 'Error analizando el ciclo de pagos.' });
  }
});

// =========================================================================
// PERSISTENT CASES & ENTITIES REGISTRY ROUTES (Active Entity Filtered)
// =========================================================================
app.get('/api/cases', (req, res) => {
  const cases = readJsonDb<any[]>(CASES_DB_FILE, []);
  const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : '';
  const sessionOwnerId = typeof req.query.sessionOwnerId === 'string' ? req.query.sessionOwnerId : '';
  let filtered = entityId ? cases.filter((c) => c.entity?.id === entityId) : cases;
  if (sessionOwnerId) {
    filtered = filtered.filter((c) => !c.sessionOwnerId || c.sessionOwnerId === sessionOwnerId);
  }
  res.json({ success: true, cases: filtered });
});

app.post('/api/cases', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || !incoming.nombreCaso) {
      return res.status(400).json({ success: false, error: 'Datos del caso incompletos.' });
    }
    const cases = readJsonDb<any[]>(CASES_DB_FILE, []);
    const now = new Date().toISOString();
    const idx = cases.findIndex((c) => c.id === incoming.id);
    const existing = idx >= 0 ? cases[idx] : null;
    const prevIterations = Array.isArray(incoming.iterations)
      ? incoming.iterations
      : Array.isArray(existing?.iterations)
      ? existing.iterations
      : [];
    const nextVersion = prevIterations.length + 1;
    const iterHash = crypto
      .createHash('sha256')
      .update(`${incoming.id || incoming.nombreCaso}_${nextVersion}_${now}`)
      .digest('hex');

    const newIteration = {
      id: `iter-${Date.now()}`,
      version: nextVersion,
      timestamp: now,
      autor: incoming.auditor?.nombre || 'Auditor Activo',
      etapa: incoming.estado || 'EN_PROCESO',
      resumenCambio: `Iteración v${nextVersion}: ${incoming.matrizHallazgosLiteral?.length || 0} hallazgos 3.01+, ${incoming.observaciones?.length || 0} obs., ${incoming.legalLibrary?.length || 0} normas.`,
      sha256: iterHash,
    };

    const record = {
      ...incoming,
      id: incoming.id || `case-${Date.now()}`,
      codigoCaso:
        incoming.codigoCaso ||
        `CASO-${new Date().getFullYear()}-${String(cases.length + 1).padStart(3, '0')}`,
      updatedAt: now,
      timestamp: incoming.timestamp || now,
      iterations: [newIteration, ...prevIterations].slice(0, 30),
    };

    if (idx >= 0) cases[idx] = record;
    else cases.unshift(record);

    writeJsonDb(CASES_DB_FILE, cases);
    res.json({ success: true, caseRecord: record, totalCases: cases.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/cases/:id', (req, res) => {
  try {
    const { id } = req.params;
    const cases = readJsonDb<any[]>(CASES_DB_FILE, []);
    const filtered = cases.filter((c) => c.id !== id);
    writeJsonDb(CASES_DB_FILE, filtered);
    res.json({ success: true, totalCases: filtered.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/entities', (_req, res) => {
  const entities = readJsonDb<any[]>(ENTITIES_DB_FILE, []);
  res.json({ success: true, entities });
});

app.post('/api/entities', (req, res) => {
  try {
    const entity = req.body;
    if (!entity || !entity.nombre) {
      return res.status(400).json({ success: false, error: 'Nombre de entidad requerido.' });
    }
    const entities = readJsonDb<any[]>(ENTITIES_DB_FILE, []);
    const idx = entities.findIndex((e) => e.id === entity.id);
    const saved = {
      ...entity,
      id: entity.id || `ent-${Date.now()}`,
      creadaEn: entity.creadaEn || new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
    };
    if (idx >= 0) entities[idx] = saved;
    else entities.unshift(saved);

    writeJsonDb(ENTITIES_DB_FILE, entities);
    res.json({ success: true, entity: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/entities/:id', (req, res) => {
  try {
    const { id } = req.params;
    const entities = readJsonDb<any[]>(ENTITIES_DB_FILE, []);
    const filteredEntities = entities.filter((e) => e.id !== id);
    writeJsonDb(ENTITIES_DB_FILE, filteredEntities);

    const cases = readJsonDb<any[]>(CASES_DB_FILE, []);
    const filteredCases = cases.filter((c) => c.entity?.id !== id);
    writeJsonDb(CASES_DB_FILE, filteredCases);

    res.json({ success: true, totalEntities: filteredEntities.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/reset-clean', (_req, res) => {
  writeJsonDb(CASES_DB_FILE, []);
  writeJsonDb(ENTITIES_DB_FILE, []);
  res.json({ success: true, message: 'Base de datos limpiada para producción.' });
});

// =========================================================================
// MAIN MULTI-MODEL FORENSIC ANALYSIS (Strictly Grounded in Supplied Real Data)
// =========================================================================
app.post('/api/forensic/analyze', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY no configurada en el servidor. Configure el secreto en Settings > Secrets.',
      });
    }

    const {
      nombreCaso = 'Expediente_Forense',
      entidadNombre = 'Entidad Auditada',
      entidadDescripcion = '',
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      origenes = [],
      requerimiento = '',
      evidenciaSnippet = '',
      contractRows = [],
      paymentCycleRows = [],
      observaciones = [],
      directors = [],
      contraReplicas = [],
      replicas = [],
      recursos = [],
      actaLectura = null,
      informePreliminar = null,
      anonimizar = false,
    } = req.body;

    const sanitizedReq = anonimizar ? anonymizeText(requerimiento) : requerimiento;
    const sanitizedSnippet = anonimizar && evidenciaSnippet ? anonymizeText(evidenciaSnippet) : evidenciaSnippet;
    const segregationSnapshot = computeSegregatedResponsibility(
      directors,
      contractRows,
      paymentCycleRows,
      observaciones,
      recursos,
      replicas,
      contraReplicas
    );

    const promptText = `
[INSTRUCCIÓN FORENSE SUPREMA - METODOLOGÍA R-C-T-F (Elite Big 4)]
Rol: Director Global de Auditoría Forense, Ingeniería de Datos y Cumplimiento Normativo.
Entidad Auditada (EXCLUSIVA DEL CASO): ${entidadNombre}
Contexto / Antecedentes / Base Legal de la Entidad: ${entidadDescripcion ? entidadDescripcion.slice(0, 3000) : 'Según evidencia suministrada'}
Jurisdicción / País: ${paisNormativa}
Idioma de Respuesta: ${idioma}
Caso: ${nombreCaso}
Fuentes involucradas: ${origenes.join(', ') || 'Documentos digitales / Portal'}
Requerimiento de auditoría: "${sanitizedReq}"

REGLA ESTRICTA:
Basar TODO el análisis, cifras, hallazgos y mejoras ÚNICAMENTE en los datos reales suministrados a continuación. NO inventar contratos ni cifras ficticias.

[CONTENIDO TEXTUAL LITERAL DESDE ORIGEN]:
${sanitizedSnippet ? sanitizedSnippet.slice(0, 12000) : 'Sin texto adicional adjunto.'}

[CONTRATOS REALES REGISTRADOS (${contractRows.length})]:
${contractRows.length > 0 ? JSON.stringify(contractRows.slice(0, 40), null, 2) : 'Ninguno'}

[CICLO DE PAGOS REAL REGISTRADO (${paymentCycleRows.length})]:
${paymentCycleRows.length > 0 ? JSON.stringify(paymentCycleRows.slice(0, 40), null, 2) : 'Ninguno'}

[OBSERVACIONES REGISTRADAS (${observaciones.length})]:
${observaciones.length > 0 ? JSON.stringify(observaciones.slice(0, 20), null, 2) : 'Ninguna'}

[SEGREGACIÓN DE RESPONSABILIDAD POR DIRECTORES Y DECRETOS (${directors.length})]:
${directors.length > 0 ? JSON.stringify(segregationSnapshot.summaries, null, 2) : 'Sin directores segregados aún'}

[DOSSIER CONTRADICTORIO MULTI-PERÍODO (ACTA / PRELIMINAR / RECURSOS / RÉPLICAS / CONTRA-RÉPLICAS)]:
- Acta de Lectura: ${actaLectura?.titulo || 'No cargada'} (${actaLectura?.fecha || 'N/D'})
- Informe Preliminar: ${informePreliminar?.titulo || 'No cargado'} (${informePreliminar?.fecha || 'N/D'})
- Recursos (${recursos.length}), Réplicas (${replicas.length}), Contra-Réplicas (${contraReplicas.length})
${contraReplicas.length > 0 ? `Detalle Contra-Réplicas:\n${JSON.stringify(contraReplicas.slice(0, 15).map((c: any) => ({ titulo: c.titulo, periodo: c.periodoEtiqueta, fecha: c.fecha, director: c.directorNombre, fuente: c.fuenteOrigen || c.urlOrigen, extracto: (c.contenido || '').slice(0, 350) })), null, 2)}` : ''}

Devuelve JSON estricto con las siguientes claves:
{
  "resumenEjecutivo": "Dictamen ejecutivo detallado basado estrictamente en los datos reales de la entidad.",
  "banderasRojas": ["Lista de banderas rojas reales identificadas o puntos críticos de verificación según el texto/datos"],
  "mejorasControlInterno": ["Recomendación concreta de mejora operativa/legal 1", "Mejora 2", "Mejora 3", "Mejora 4"],
  "codigoPython": "Script Python modular con pandas y hashlib adaptado a los campos reales del caso para reproducir la auditoría",
  "explicacionTecnica": "Explicación técnica del procedimiento forense aplicado sobre los datos suministrados",
  "fundamentoLegal": "Artículos y leyes aplicables de ${paisNormativa} y normas NIA 240 / NIA 500 / ISO 27037",
  "metricasRiesgo": {
    "nivelRiesgo": "CRÍTICO | ALTO | MEDIO | MODERADO",
    "exposicionEstimada": "Exposición monetaria real sumada de los datos o Pendiente de cuantificación",
    "accionInmediata": "Acción forense concreta recomendada"
  }
}
`;

    const { response, modelUsed } = await callGeminiWithResilience(ai, {
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsedData = parseJsonSafe<any>(response.text || '{}', {
      resumenEjecutivo: response.text || 'Análisis completado.',
      banderasRojas: ['Revisar documentación soporte y autorizaciones según normativa aplicable.'],
      mejorasControlInterno: ['Fortalecer conciliación previa entre recepción, factura e-CF y libramiento de pago.'],
      codigoPython: '# Script forense\nimport pandas as pd\n\ndef auditar(df):\n    return df',
      explicacionTecnica: 'Evaluación documental y analítica sobre registros reales.',
      fundamentoLegal: `Normativa vigente de ${paisNormativa} y NIA 240 / NIA 500.`,
      metricasRiesgo: {
        nivelRiesgo: 'ALTO',
        exposicionEstimada: 'Según registros reales cargados',
        accionInmediata: 'Preservación de expedientes originales y validación documental',
      },
    });

    let cleanedCode = parsedData.codigoPython || '';
    if (cleanedCode.includes('```python')) {
      cleanedCode = cleanedCode.replace(/```python\s*/g, '').replace(/```/g, '').trim();
    }

    const stampContent = `${nombreCaso}_${entidadNombre}_${requerimiento}_${cleanedCode}_${Date.now()}`;
    const digitalHash = crypto.createHash('sha256').update(stampContent).digest('hex');

    res.json({
      success: true,
      modelUsed,
      timestamp: new Date().toISOString(),
      digitalHash,
      data: {
        ...parsedData,
        codigoPython: cleanedCode,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/analyze:', error);
    const isOverloaded = isTransientAiError(error);
    res.status(isOverloaded ? 503 : 500).json({
      success: false,
      error: isOverloaded
        ? 'El servicio de IA está experimentando un pico temporal de demanda. Por favor intente nuevamente en unos segundos.'
        : error.message || 'Error procesando el análisis forense con Gemini',
    });
  }
});

// =========================================================================
// EVALUATE CONTRADICTORY OBSERVATION
// =========================================================================
app.post('/api/forensic/evaluate-observation', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY no configurada en el servidor.',
      });
    }

    const {
      observacion = '',
      descargoAlegato = '',
      actaLecturaContext = '',
      recursosContext = '',
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      motorIA = 'gemini',
      usuario = { nombre: 'Auditor Forense', cargo: 'Auditor Jefe' },
    } = req.body;

    const promptText = `
[EVALUACIÓN PERICIAL CONTRADICTORIA DE AUDITORÍA FORENSE]
Normativa y Jurisdicción Aplicable: ${paisNormativa}
Idioma de Respuesta: ${idioma}
Motor Solicitado: ${motorIA.toUpperCase()}
Auditor Responsable: ${usuario.nombre || 'Auditor'} (${usuario.cargo || 'Auditor'})

[CONTEXTO / ACTA DE LECTURA]:
${actaLecturaContext ? actaLecturaContext.slice(0, 2500) : 'Sin antecedentes previos.'}

[RECURSOS / ALEGATOS]:
${recursosContext ? recursosContext.slice(0, 2500) : 'Sin recursos adicionales.'}

[OBSERVACIÓN EN DISPUTA]:
${observacion}

[DESCARGO / PRUEBAS DEL AUDITADO]:
${descargoAlegato}

Devuelve JSON estricto:
{
  "decision": "SE_MANTIENE | SE_ELIMINA | SE_MODIFICA",
  "criterioEvaluacion": "Análisis probatorio detallado basado en los hechos reales.",
  "procedimientoUtilizado": "Técnicas y procedimientos de auditoría forense aplicados.",
  "fundamentacionLegal": "Artículos y leyes vigentes de ${paisNormativa} aplicables.",
  "severidad": "CRÍTICA | ALTA | MEDIA | LEVE",
  "resumenDictamen": "Síntesis ejecutiva de la resolución pericial."
}
`;

    const { response, modelUsed } = await callGeminiWithResilience(ai, {
      contents: promptText,
      config: { responseMimeType: 'application/json' },
    });

    const result = parseJsonSafe<any>(response.text || '{}', {
      decision: 'SE_MANTIENE',
      criterioEvaluacion: 'El descargo no desvirtúa completamente la observación presentada.',
      procedimientoUtilizado: 'Inspección documental y cruce normativo.',
      fundamentacionLegal: `Normativa vigente de ${paisNormativa}`,
      severidad: 'ALTA',
      resumenDictamen: 'Observación evaluada en sede contradictoria.',
    });

    const sha256 = crypto
      .createHash('sha256')
      .update(`${observacion}_${descargoAlegato}_${result.decision}_${Date.now()}`)
      .digest('hex');

    res.json({
      success: true,
      data: result,
      sha256,
      motorUtilizado: modelUsed,
      pais: paisNormativa,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/evaluate-observation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al evaluar la observación pericial',
    });
  }
});

// =========================================================================
// BENFORD'S LAW (Strictly on supplied real values — NO fake fallback numbers)
// =========================================================================
app.post('/api/forensic/benford', (req, res) => {
  try {
    const { values = [] } = req.body;
    const theoretical: Record<number, number> = {
      1: 30.1,
      2: 17.6,
      3: 12.5,
      4: 9.7,
      5: 7.9,
      6: 6.7,
      7: 5.8,
      8: 5.1,
      9: 4.6,
    };

    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    let validCount = 0;

    const list: number[] = Array.isArray(values) ? values : [];

    for (const val of list) {
      const num = Math.abs(Number(val));
      if (!isNaN(num) && num > 0) {
        const firstDigit = parseInt(num.toString().replace(/[^1-9]/g, '')[0] || '0', 10);
        if (firstDigit >= 1 && firstDigit <= 9) {
          counts[firstDigit]++;
          validCount++;
        }
      }
    }

    const results = Object.keys(counts).map((dStr) => {
      const digit = parseInt(dStr, 10);
      const observedCount = counts[digit];
      const observedPct = validCount > 0 ? Number(((observedCount / validCount) * 100).toFixed(2)) : 0;
      const expectedPct = theoretical[digit];
      const diff = validCount > 0 ? Number((observedPct - expectedPct).toFixed(2)) : 0;
      const isAnomaly = validCount >= 10 && Math.abs(diff) > 5.0;
      return {
        digit,
        observedCount,
        observedPct,
        expectedPct,
        diff,
        isAnomaly,
      };
    });

    res.json({
      success: true,
      totalAnalyzed: validCount,
      distribution: results,
      anomalyDetected: results.some((r) => r.isAnomaly),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================================
// DETERMINISTIC RESPONSIBILITY SEGREGATION HELPER
// =========================================================================
function normalizeIsoDate(d: string | undefined): string {
  if (!d) return '';
  const m = String(d).trim().match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const m2 = String(d).trim().match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return '';
}

function dateInTenure(dateStr: string | undefined, startStr: string | undefined, endStr: string | undefined, isCurrent?: boolean): boolean {
  const d = normalizeIsoDate(dateStr);
  const start = normalizeIsoDate(startStr);
  const end = isCurrent ? '9999-12-31' : (normalizeIsoDate(endStr) || '9999-12-31');
  if (!d || !start) return false;
  return d >= start && d <= end;
}

function computeSegregatedResponsibility(
  directors: any[] = [],
  contractRows: any[] = [],
  paymentCycleRows: any[] = [],
  observaciones: any[] = [],
  recursos: any[] = [],
  replicas: any[] = [],
  contraReplicas: any[] = []
) {
  const assignedContractIds = new Set<string>();
  const assignedPaymentIds = new Set<string>();
  const assignedObsIds = new Set<string>();

  const summaries = (Array.isArray(directors) ? directors : []).map((dir: any) => {
    const start = normalizeIsoDate(dir.fechaInicioGestion);
    const end = dir.enFuncionesActuales ? 'Actualidad' : (normalizeIsoDate(dir.fechaFinGestion) || 'Sin fecha cierre');

    const matchedContracts = (Array.isArray(contractRows) ? contractRows : []).filter((c: any) => {
      const targetDate = c.fechaAdenda || c.fechaContrato;
      const match = dateInTenure(targetDate, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales);
      if (match) assignedContractIds.add(c.id);
      return match;
    });

    const matchedPayments = (Array.isArray(paymentCycleRows) ? paymentCycleRows : []).filter((p: any) => {
      const targetDate = p.fechaPago || p.fechaFactura || p.fechaSolicitud;
      const match = dateInTenure(targetDate, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales);
      if (match) assignedPaymentIds.add(p.id);
      return match;
    });

    const matchedObs = (Array.isArray(observaciones) ? observaciones : []).filter((o: any) => {
      const directMatch = o.directorId && o.directorId === dir.id;
      const dateMatch = o.fechaHecho
        ? dateInTenure(o.fechaHecho, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales)
        : false;
      const match = Boolean(directMatch || dateMatch);
      if (match) assignedObsIds.add(o.id);
      return match;
    });

    const matchedReplicas = (Array.isArray(replicas) ? replicas : []).filter(
      (r: any) =>
        (r.directorId && r.directorId === dir.id) ||
        dateInTenure(r.fecha, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales)
    );

    const matchedContraReplicas = (Array.isArray(contraReplicas) ? contraReplicas : []).filter(
      (cr: any) =>
        (cr.directorId && cr.directorId === dir.id) ||
        dateInTenure(cr.fecha, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales)
    );

    const contratosMonto = matchedContracts.reduce((acc: number, c: any) => acc + (Number(c.montoOriginal) || 0), 0);
    const adendasMonto = matchedContracts.reduce((acc: number, c: any) => acc + (Number(c.montoAdenda) || 0), 0);
    const pagosMontoNeto = matchedPayments.reduce((acc: number, p: any) => acc + (Number(p.montoPagadoNeto) || 0), 0);
    const observacionesMonto = matchedObs.reduce((acc: number, o: any) => acc + (Number(o.montoInvolucrado) || 0), 0);

    const anomalousContracts = matchedContracts.filter((c: any) => c.esAnomalo).length;
    const irregularPayments = matchedPayments.filter((p: any) => p.estadoCiclo && p.estadoCiclo !== 'COMPLETO').length;
    const keptObs = matchedObs.filter((o: any) => o.decision === 'SE_MANTIENE').length;

    let riesgoCalculado: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO' = 'BAJO';
    if (anomalousContracts >= 2 || keptObs >= 2 || irregularPayments >= 3) riesgoCalculado = 'CRÍTICO';
    else if (anomalousContracts >= 1 || keptObs >= 1 || irregularPayments >= 1 || adendasMonto > 0) riesgoCalculado = 'ALTO';
    else if (matchedContracts.length > 0 || matchedPayments.length > 0) riesgoCalculado = 'MEDIO';

    return {
      directorId: dir.id,
      directorNombre: dir.nombre || 'Titular sin nombre',
      cargo: dir.cargo || 'Director/a General',
      periodoGestion: `${start || 'N/D'} → ${end}`,
      numeroDecreto: dir.numeroDecretoNombramiento || 'Sin decreto vinculado',
      fuentesCount: Array.isArray(dir.fuentes) ? dir.fuentes.length : 0,
      contratosCount: matchedContracts.length,
      contratosMonto,
      adendasMonto,
      pagosCount: matchedPayments.length,
      pagosMontoNeto,
      observacionesCount: matchedObs.length,
      observacionesMonto,
      replicasCount: matchedReplicas.length,
      contraReplicasCount: matchedContraReplicas.length,
      riesgoCalculado,
      resumenResponsabilidad: `${matchedContracts.length} contrato(s), ${matchedPayments.length} pago(s), ${matchedObs.length} observación(es), ${matchedReplicas.length} réplica(s), ${matchedContraReplicas.length} contra-réplica(s).`,
    };
  });

  const orphanStats = {
    contratosSinDirector: (Array.isArray(contractRows) ? contractRows : []).filter((c: any) => !assignedContractIds.has(c.id)).length,
    pagosSinDirector: (Array.isArray(paymentCycleRows) ? paymentCycleRows : []).filter((p: any) => !assignedPaymentIds.has(p.id)).length,
    observacionesSinDirector: (Array.isArray(observaciones) ? observaciones : []).filter((o: any) => !assignedObsIds.has(o.id)).length,
    totalRecursos: Array.isArray(recursos) ? recursos.length : 0,
  };

  return { summaries, orphanStats };
}

// =========================================================================
// ONLINE AI SEARCH FOR OFFICIAL APPOINTMENT DECREES (Google Search Grounding)
// =========================================================================
app.post('/api/forensic/search-appointment-decrees', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY no configurada en el servidor.',
      });
    }

    const {
      entityName = '',
      entitySiglas = '',
      rncNif = '',
      paisNormativa = 'República Dominicana',
      periodoDesde = '',
      periodoHasta = '',
      directorNameQuery = '',
    } = req.body;

    if (!entityName.trim() && !directorNameQuery.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Debe indicar al menos el nombre de la entidad o de un funcionario para buscar decretos oficiales.',
      });
    }

    const promptText = `
[BÚSQUEDA OFICIAL EN LÍNEA DE DECRETOS DE NOMBRAMIENTO Y RELEVO]
Eres un investigador jurídico y de auditoría gubernamental. Utiliza la búsqueda web oficial disponible para localizar DECRETOS PRESIDENCIALES, RESOLUCIONES O ACTOS ADMINISTRATIVOS OFICIALES DE NOMBRAMIENTO Y SUSTITUCIÓN de los Directores / Titulares de:
- Entidad: "${entityName}" ${entitySiglas ? `(${entitySiglas})` : ''} ${rncNif ? `RNC/NIF: ${rncNif}` : ''}
- País / Jurisdicción: ${paisNormativa}
- Rango de períodos de interés: ${periodoDesde || 'Histórico reciente'} hasta ${periodoHasta || 'Actualidad'}
${directorNameQuery ? `- Funcionario / Director específico consultado: "${directorNameQuery}"` : ''}

REGLAS ESTRICTAS DE RIGOR Y TRAZABILIDAD:
1. Busca exclusivamente en fuentes reales encontradas en la web (Presidencia, Consultoría Jurídica del Poder Ejecutivo, Gaceta Oficial, MAP, portales de transparencia o prensa oficial verificable).
2. NO inventes números de decreto, fechas ni nombres si no aparecen en las fuentes recuperadas. Si un dato no consta claramente, indícalo como "Por verificar en Gaceta".
3. Devuelve ÚNICAMENTE un bloque JSON válido envuelto en \`\`\`json ... \`\`\` con esta estructura exacta:
\`\`\`json
{
  "notaBusqueda": "Resumen breve de los decretos y períodos localizados en línea.",
  "directoresEncontrados": [
    {
      "nombre": "Nombre completo oficial del director/titular",
      "cargo": "Cargo oficial según decreto",
      "numeroDecretoNombramiento": "Ej: Decreto No. 329-20 (o 'Por verificar')",
      "fechaDecretoNombramiento": "YYYY-MM-DD (o vacío si no consta día exacto)",
      "fechaInicioGestion": "YYYY-MM-DD",
      "fechaFinGestion": "YYYY-MM-DD o vacío si sigue en funciones",
      "enFuncionesActuales": false,
      "numeroDecretoSalida": "Decreto de relevo/sustitución si consta o vacío",
      "fechaDecretoSalida": "YYYY-MM-DD o vacío",
      "ubicacionOrigen": "Consultoría Jurídica / Presidencia / Portal Oficial / Diario",
      "extractoLiteral": "Cita o resumen textual del artículo del decreto que dispone la designación.",
      "urlSugerida": "URL de la fuente consultada si se conoce exactamente"
    }
  ]
}
\`\`\`
`;

    let rawText = '';
    let modelUsed = 'gemini-4-hydrogen';
    let groundingMetadata: any = null;
    const nowIso = new Date().toISOString();
    let fallbackWebSources: any[] = [];

    try {
      const result = await callGeminiWithResilience(ai, {
        contents: promptText,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      rawText = result.response.text || '';
      modelUsed = result.modelUsed;
      groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;
    } catch (searchErr: any) {
      console.warn('Google Search Grounding unavailable/quota, activating real public web search fallback:', searchErr?.message || searchErr);

      // Tier 2: Real public web search fallback (DuckDuckGo Lite / Wikipedia API) -> NO fabricated URLs
      const queryStr = `${entityName} ${entitySiglas} decreto nombramiento director ${paisNormativa}`.trim();
      const collectedSnippets: string[] = [];

      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(queryStr)}`;
        const ddgCtrl = new AbortController();
        const ddgTimer = setTimeout(() => ddgCtrl.abort(), 10000);
        const ddgResp = await fetch(ddgUrl, {
          signal: ddgCtrl.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ForensicAuditSearch/1.0)' },
        });
        clearTimeout(ddgTimer);

        if (ddgResp.ok) {
          const html = await ddgResp.text();
          const resultRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
          let m: RegExpExecArray | null;
          let idx = 0;
          while ((m = resultRegex.exec(html)) !== null && idx < 8) {
            let href = m[1];
            if (href.includes('uddg=')) {
              try {
                const u = new URL(href.startsWith('//') ? `https:${href}` : href);
                href = decodeURIComponent(u.searchParams.get('uddg') || href);
              } catch {}
            }
            const title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            const snippet = m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            if (href && /^https?:\/\//i.test(href)) {
              const sha256 = crypto.createHash('sha256').update(`${href}_${title}_${nowIso}`).digest('hex');
              fallbackWebSources.push({
                id: `src-web-fb-${Date.now()}-${idx}`,
                url: href,
                titulo: title,
                ubicacionOrigen: `Búsqueda Web Verificada (${new URL(href).hostname})`,
                fechaConsulta: nowIso,
                sha256,
                verificadoWeb: true,
              });
              collectedSnippets.push(`[FUENTE ${idx + 1}] Título: ${title}\nURL: ${href}\nExtracto: ${snippet}`);
              idx++;
            }
          }
        }
      } catch (ddgErr) {
        console.warn('DuckDuckGo fallback skipped:', ddgErr);
      }

      if (collectedSnippets.length === 0) {
        try {
          const wikiApi = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${entityName} ${directorNameQuery}`.trim())}&format=json&srlimit=5`;
          const wResp = await fetch(wikiApi);
          if (wResp.ok) {
            const wJson: any = await wResp.json();
            const hits = wJson?.query?.search || [];
            hits.forEach((h: any, idx: number) => {
              const pageUrl = `https://es.wikipedia.org/wiki/${encodeURIComponent(String(h.title || '').replace(/\s+/g, '_'))}`;
              const cleanSnippet = String(h.snippet || '').replace(/<[^>]+>/g, '');
              const sha256 = crypto.createHash('sha256').update(`${pageUrl}_${h.title}_${nowIso}`).digest('hex');
              fallbackWebSources.push({
                id: `src-wiki-${Date.now()}-${idx}`,
                url: pageUrl,
                titulo: h.title,
                ubicacionOrigen: 'Wikipedia Pública (Referencia Secundaria)',
                fechaConsulta: nowIso,
                sha256,
                verificadoWeb: true,
              });
              collectedSnippets.push(`[FUENTE ${idx + 1}] Título: ${h.title}\nURL: ${pageUrl}\nExtracto: ${cleanSnippet}`);
            });
          }
        } catch {}
      }

      if (collectedSnippets.length > 0) {
        const extractPrompt = `
[EXTRACCIÓN DE DECRETOS Y DIRECTORES DESDE FUENTES WEB RECUPERADAS]
Entidad: ${entityName} (${entitySiglas})
País: ${paisNormativa}
Rango: ${periodoDesde || 'N/D'} a ${periodoHasta || 'Actualidad'}

FUENTES WEB REALES RECUPERADAS:
${collectedSnippets.join('\n\n')}

REGLA ESTRICTA: Extrae ÚNICAMENTE directores, decretos, fechas y URLs que consten explícitamente en las FUENTES WEB REALES RECUPERADAS arriba. NO inventes decretos ni URLs.
Devuelve JSON estricto con la clave "notaBusqueda" y el arreglo "directoresEncontrados".
`;
        try {
          const fallbackAi = await callGeminiWithResilience(ai, {
            contents: extractPrompt,
            config: { responseMimeType: 'application/json' },
          });
          rawText = fallbackAi.response.text || '';
          modelUsed = `${fallbackAi.modelUsed} (web-fallback)`;
        } catch (aiFbErr: any) {
          rawText = JSON.stringify({
            notaBusqueda: `Se recuperaron ${fallbackWebSources.length} fuentes web reales. Limite de cuota IA alcanzado al estructurar; revise las fuentes abajo y use "Extraer Fuente".`,
            directoresEncontrados: [],
          });
          modelUsed = 'web-sources-only';
        }
      } else {
        const errMsg = String(searchErr?.message || '');
        const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
        return res.status(isQuota ? 429 : 503).json({
          success: false,
          error: isQuota
            ? 'La cuota de Google Search Grounding alcanzó su límite temporal (429). Puede agregar manualmente la URL de Gaceta/Presidencia abajo y usar "Ver Contenido Origen" o subir el decreto.'
            : 'El buscador oficial en línea no pudo recuperar resultados en este momento. Intente nuevamente o ingrese la fuente del decreto manualmente.',
        });
      }
    }

    const parsed = parseJsonSafe<any>(rawText, {
      notaBusqueda: rawText.slice(0, 600),
      directoresEncontrados: [],
    });

    const rawChunks = groundingMetadata?.groundingChunks || [];
    const searchQueries: string[] = groundingMetadata?.webSearchQueries || [];

    const groundedSources = rawChunks
      .filter((c: any) => c?.web?.uri)
      .map((c: any, idx: number) => {
        const uri = String(c.web.uri);
        const title = String(c.web.title || uri);
        const sha256 = crypto
          .createHash('sha256')
          .update(`${uri}_${title}_${nowIso}`)
          .digest('hex');
        return {
          id: `src-web-${Date.now()}-${idx}`,
          url: uri,
          titulo: title,
          ubicacionOrigen: `Google Search Grounding (${title})`,
          fechaConsulta: nowIso,
          sha256,
          verificadoWeb: true,
        };
      });

    const webSources = groundedSources.length > 0 ? groundedSources : fallbackWebSources;

    const directorsNormalized = (Array.isArray(parsed.directoresEncontrados) ? parsed.directoresEncontrados : []).map(
      (d: any, idx: number) => {
        const matchedSource = webSources[idx] || webSources[0] || null;
        const sourceUrl = d.urlSugerida && /^https?:\/\//i.test(d.urlSugerida)
          ? d.urlSugerida
          : matchedSource?.url || '';
        const sourceTitle = matchedSource?.titulo || d.ubicacionOrigen || `Fuente Oficial Decreto ${d.numeroDecretoNombramiento || idx + 1}`;
        const decreeText = d.extractoLiteral || `Designación registrada en ${d.numeroDecretoNombramiento || 'decreto oficial'}.`;
        const srcHash = crypto
          .createHash('sha256')
          .update(`${d.nombre || ''}_${d.numeroDecretoNombramiento || ''}_${sourceUrl}_${nowIso}`)
          .digest('hex');

        return {
          id: `dir-ia-${Date.now()}-${idx}`,
          nombre: d.nombre || 'Por verificar',
          cedulaId: '',
          cargo: d.cargo || 'Director General',
          periodoNumero: idx + 1,
          fechaInicioGestion: normalizeIsoDate(d.fechaInicioGestion) || normalizeIsoDate(d.fechaDecretoNombramiento) || '',
          fechaFinGestion: normalizeIsoDate(d.fechaFinGestion) || normalizeIsoDate(d.fechaDecretoSalida) || '',
          enFuncionesActuales: Boolean(d.enFuncionesActuales),
          numeroDecretoNombramiento: d.numeroDecretoNombramiento || 'Por verificar',
          fechaDecretoNombramiento: normalizeIsoDate(d.fechaDecretoNombramiento) || '',
          numeroDecretoSalida: d.numeroDecretoSalida || '',
          fechaDecretoSalida: normalizeIsoDate(d.fechaDecretoSalida) || '',
          fuentes: [
            {
              id: `dec-src-${Date.now()}-${idx}`,
              url: sourceUrl,
              titulo: sourceTitle,
              ubicacionOrigen: d.ubicacionOrigen || matchedSource?.ubicacionOrigen || 'Búsqueda Oficial en Línea (IA Grounding)',
              numeroDecreto: d.numeroDecretoNombramiento || 'Por verificar',
              fechaDecreto: normalizeIsoDate(d.fechaDecretoNombramiento) || '',
              extractoLiteral: decreeText,
              fechaConsulta: nowIso,
              sha256: srcHash,
              verificadoWeb: Boolean(sourceUrl),
            },
          ],
          responsabilidadObservaciones: `Gestión vinculada al ${d.numeroDecretoNombramiento || 'decreto oficial'} (${d.fechaInicioGestion || 'N/D'} a ${d.enFuncionesActuales ? 'Actualidad' : d.fechaFinGestion || 'N/D'}).`,
          notas: decreeText,
        };
      }
    );

    res.json({
      success: true,
      modelUsed,
      notaBusqueda: parsed.notaBusqueda || 'Búsqueda oficial de decretos completada.',
      searchQueries,
      webSources,
      directoresEncontrados: directorsNormalized,
      timestamp: nowIso,
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/search-appointment-decrees:', error);
    res.status(isTransientAiError(error) ? 503 : 500).json({
      success: false,
      error: error.message || 'Error consultando decretos oficiales en línea.',
    });
  }
});

// =========================================================================
// SEGREGATE RESPONSIBILITY BY DIRECTOR & PERIOD (Cross-Match + AI)
// =========================================================================
app.post('/api/forensic/segregate-responsibility', async (req, res) => {
  try {
    const {
      entityName = 'Entidad Auditada',
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      directors = [],
      contractRows = [],
      paymentCycleRows = [],
      observaciones = [],
      recursos = [],
      replicas = [],
      contraReplicas = [],
      useAiSummary = true,
    } = req.body;

    const { summaries, orphanStats } = computeSegregatedResponsibility(
      directors,
      contractRows,
      paymentCycleRows,
      observaciones,
      recursos,
      replicas,
      contraReplicas
    );

    let aiNarrative = '';
    let modelUsed = 'deterministic-engine';

    const ai = getAiClient();
    if (ai && useAiSummary && summaries.length > 0) {
      try {
        const promptText = `
[DICTAMEN DE SEGREGACIÓN DE RESPONSABILIDAD ADMINISTRATIVA POR PERÍODOS Y DIRECTORES]
Entidad: ${entityName}
Jurisdicción: ${paisNormativa}
Idioma: ${idioma}

Matriz Calculada por Director y Decreto Oficial:
${JSON.stringify(summaries, null, 2)}

Registros Huérfanos / Fuera de Rango de Decreto:
${JSON.stringify(orphanStats, null, 2)}

Redacta una síntesis ejecutiva técnica (máximo 12 líneas) que individualice la responsabilidad de cada Director según las fechas exactas de su decreto de nombramiento y sustitución, advirtiendo sobre cualquier acto sin titular asignado y sobre la trazabilidad entre réplicas y contra-réplicas.
`;
        const aiResp = await callGeminiWithResilience(ai, { contents: promptText });
        aiNarrative = (aiResp.response.text || '').trim();
        modelUsed = aiResp.modelUsed;
      } catch (aiErr) {
        console.warn('AI narrative skipped in segregate-responsibility:', aiErr);
      }
    }

    res.json({
      success: true,
      modelUsed,
      summaries,
      orphanStats,
      aiNarrative,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error segregando responsabilidades.' });
  }
});

// =========================================================================
// INTERACTIVE PRE-REVIEW RUNNER (Acta de Lectura, Informe Preliminar, Final)
// =========================================================================
app.post('/api/forensic/pre-review-document', async (req, res) => {
  try {
    const {
      tipoDocumento = 'ACTA_LECTURA',
      entity = null,
      periodo = null,
      auditor = null,
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      actaLectura = null,
      informePreliminar = null,
      recursos = [],
      replicas = [],
      contraReplicas = [],
      directors = [],
      contractRows = [],
      paymentCycleRows = [],
      observaciones = [],
      resultado = null,
    } = req.body;

    // 1. Deterministic Real-Data QA Gate Checks
    const deterministicChecks: {
      id: string;
      criterio: string;
      estado: 'CUMPLE' | 'ATENCION' | 'CRITICO';
      detalle: string;
      recomendacion: string;
    }[] = [];

    const segregation = computeSegregatedResponsibility(
      directors,
      contractRows,
      paymentCycleRows,
      observaciones,
      recursos,
      replicas,
      contraReplicas
    );

    const hasEntity = Boolean(entity?.nombre);
    const hasAuditor = Boolean(auditor?.nombre && auditor?.cedulaId);
    deterministicChecks.push({
      id: 'chk-identidad',
      criterio: 'Identificación de Entidad, Auditor y Período',
      estado: hasEntity && hasAuditor ? 'CUMPLE' : 'ATENCION',
      detalle: hasEntity
        ? `Entidad: ${entity.nombre}. Auditor: ${auditor?.nombre || 'Sin asignar'} (ID: ${auditor?.cedulaId || 'N/D'}). Período: ${periodo?.fechaDesde || 'N/D'} a ${periodo?.fechaHasta || 'N/D'}.`
        : 'Falta registrar entidad auditada o identificación completa del perito.',
      recomendacion: hasEntity && hasAuditor ? 'Datos de identidad completos.' : 'Complete cédula/ID del auditor y RNC de la entidad antes de emitir.',
    });

    if (tipoDocumento === 'ACTA_LECTURA') {
      const len = (actaLectura?.contenido || '').trim().length;
      const filesCount = actaLectura?.archivos?.length || 0;
      deterministicChecks.push({
        id: 'chk-acta-body',
        criterio: 'Constancia de Lectura, Comparecientes y Plazo Legal',
        estado: len >= 60 ? 'CUMPLE' : len > 0 ? 'ATENCION' : 'CRITICO',
        detalle: `Extensión del acta: ${len} caracteres. Archivos digitales foliados: ${filesCount}.`,
        recomendacion: len >= 60 ? 'Acta documentada con contenido verificable.' : 'Redacte o adjunte el texto íntegro del Acta de Lectura con fecha y firmantes.',
      });
      deterministicChecks.push({
        id: 'chk-acta-dir',
        criterio: 'Notificación Vinculada a Titular / Director del Período',
        estado: actaLectura?.directorNombre || directors.length > 0 ? 'CUMPLE' : 'ATENCION',
        detalle: actaLectura?.directorNombre
          ? `Director vinculado: ${actaLectura.directorNombre}.`
          : `Directores en expediente: ${directors.length}. No se ha asignado titular específico al Acta.`,
        recomendacion: 'Vincule el Acta al Director notificado según su Decreto de nombramiento vigente.',
      });
    } else if (tipoDocumento === 'INFORME_PRELIMINAR') {
      const len = (informePreliminar?.contenido || '').trim().length;
      const obsCount = observaciones.length;
      deterministicChecks.push({
        id: 'chk-prelim-body',
        criterio: 'Pliego Preliminar de Cargos y Evidencia Soporte',
        estado: len >= 60 || obsCount > 0 ? 'CUMPLE' : 'CRITICO',
        detalle: `Texto preliminar: ${len} caracteres. Observaciones estructuradas: ${obsCount}. Contratos: ${contractRows.length}, Pagos: ${paymentCycleRows.length}.`,
        recomendacion: obsCount > 0 ? 'Cargos estructurados listos para contradicción.' : 'Cargue o extraiga al menos una observación formal preliminar.',
      });
      deterministicChecks.push({
        id: 'chk-prelim-seg',
        criterio: 'Segregación Cronológica por Directores y Decretos',
        estado:
          directors.length > 0 && segregation.orphanStats.observacionesSinDirector === 0
            ? 'CUMPLE'
            : directors.length > 0
            ? 'ATENCION'
            : 'CRITICO',
        detalle: `Directores registrados: ${directors.length}. Contratos sin asignar: ${segregation.orphanStats.contratosSinDirector}, Observaciones sin asignar: ${segregation.orphanStats.observacionesSinDirector}.`,
        recomendacion: 'Busque o registre los decretos oficiales de nombramiento para asignar cada hallazgo al director exacto del período.',
      });
    } else {
      // INFORME_FINAL
      const hasDictamen = Boolean(resultado?.resumenEjecutivo);
      const pendingDescargos = replicas.length + contraReplicas.length > 0 && observaciones.length === 0;
      deterministicChecks.push({
        id: 'chk-final-dictamen',
        criterio: 'Dictamen Ejecutivo y Sello Criptográfico SHA-256',
        estado: hasDictamen ? 'CUMPLE' : 'CRITICO',
        detalle: hasDictamen
          ? `Dictamen emitido con hash ${resultado.digitalHash?.slice(0, 14)}...`
          : 'No se ha ejecutado aún el Dictamen IA Integral del Paso 5.',
        recomendacion: hasDictamen ? 'Dictamen generado.' : 'Ejecute el Análisis Forense Final antes de emitir el Informe Final.',
      });
      deterministicChecks.push({
        id: 'chk-final-contradiccion',
        criterio: 'Cobertura de Recursos, Réplicas y Contra-Réplicas Multi-Período',
        estado: pendingDescargos ? 'CRITICO' : 'CUMPLE',
        detalle: `Recursos: ${recursos.length} | Réplicas: ${replicas.length} | Contra-Réplicas: ${contraReplicas.length} | Observaciones resueltas: ${observaciones.length}.`,
        recomendacion: pendingDescargos
          ? 'Existen réplicas/contra-réplicas cargadas sin observaciones evaluadas. Resuelva cada observación en el Paso 4.'
          : 'Ciclo contradictorio debidamente ponderado.',
      });
      deterministicChecks.push({
        id: 'chk-final-directores',
        criterio: 'Individualización de Responsabilidad por Decreto Oficial',
        estado: directors.length > 0 ? 'CUMPLE' : 'ATENCION',
        detalle: `${directors.length} director(es) documentado(s) con fuentes y decretos de nombramiento.`,
        recomendacion: directors.length > 0 ? 'Responsabilidad segregada por período.' : 'Ejecute la búsqueda de decretos oficiales para individualizar responsabilidad.',
      });
    }

    // 2. Deep AI Interactive QA Inspection
    const ai = getAiClient();
    let aiPayload: any = null;
    let modelUsed = 'deterministic-qa-gate';

    if (ai) {
      try {
        const docFocus =
          tipoDocumento === 'ACTA_LECTURA'
            ? actaLectura
            : tipoDocumento === 'INFORME_PRELIMINAR'
            ? informePreliminar
            : {
                resultado,
                observaciones: observaciones.slice(0, 15),
                recursos: recursos.map((r: any) => ({ titulo: r.titulo, fecha: r.fecha, periodo: r.periodoEtiqueta, contenido: (r.contenido || '').slice(0, 500) })),
                replicas: replicas.map((r: any) => ({ titulo: r.titulo, fecha: r.fecha, periodo: r.periodoEtiqueta, director: r.directorNombre, contenido: (r.contenido || '').slice(0, 500) })),
                contraReplicas: contraReplicas.map((r: any) => ({ titulo: r.titulo, fecha: r.fecha, periodo: r.periodoEtiqueta, director: r.directorNombre, contenido: (r.contenido || '').slice(0, 500) })),
              };

        const promptText = `
[EJECUTOR INTERACTIVO DE REVISIÓN PREVIA DE CONTROL DE CALIDAD FORENSE]
Documento bajo Revisión Previa: ${tipoDocumento}
Entidad: ${entity?.nombre || 'Entidad Auditada'} (${entity?.siglas || ''})
País / Normativa: ${paisNormativa}
Idioma: ${idioma}

Chequeos Programáticos Previos:
${JSON.stringify(deterministicChecks, null, 2)}

Segregación de Directores Actual (${directors.length}):
${JSON.stringify(segregation.summaries, null, 2)}

Contenido Real del Documento Evaluado:
${JSON.stringify(docFocus, null, 2).slice(0, 18000)}

Evalúa rigurosamente si este documento (${tipoDocumento}) cumple estándares Big 4, NIA 240/500 e ISO 27037 antes de notificarse o emitirse.
Devuelve JSON estricto:
{
  "puntuacionPreparacion": 82,
  "estadoAprobacion": "APROBADO_REVISION | CON_OBSERVACIONES_PREVIAS | BLOQUEADO",
  "resumenEjecutivo": "Veredicto claro de la revisión previa sobre los datos reales encontrados.",
  "hallazgosAdicionales": [
    {
      "criterio": "Nombre del criterio técnico o legal revisado",
      "estado": "CUMPLE | ATENCION | CRITICO",
      "detalle": "Hallazgo específico en el texto o datos reales",
      "recomendacion": "Corrección concreta antes de firma/emisión"
    }
  ],
  "mejorasSugeridas": ["Mejora puntual 1", "Mejora puntual 2", "Mejora puntual 3"],
  "textoMejoradoSugerido": "Borrador técnico breve o cláusula de refuerzo lista para incorporar al documento evaluado."
}
`;
        const aiResp = await callGeminiWithResilience(ai, {
          contents: promptText,
          config: { responseMimeType: 'application/json' },
        });
        aiPayload = parseJsonSafe<any>(aiResp.response.text || '{}', null);
        modelUsed = aiResp.modelUsed;
      } catch (aiErr) {
        console.warn('AI deep pre-review skipped, using deterministic checks:', aiErr);
      }
    }

    const aiChecks = Array.isArray(aiPayload?.hallazgosAdicionales)
      ? aiPayload.hallazgosAdicionales.map((h: any, idx: number) => ({
          id: `chk-ai-${idx}-${Date.now()}`,
          criterio: h.criterio || 'Criterio Técnico IA',
          estado: ['CUMPLE', 'ATENCION', 'CRITICO'].includes(h.estado) ? h.estado : 'ATENCION',
          detalle: h.detalle || '',
          recomendacion: h.recomendacion || '',
        }))
      : [];

    const allChecks = [...deterministicChecks, ...aiChecks];
    const criticos = allChecks.filter((c) => c.estado === 'CRITICO').length;
    const atenciones = allChecks.filter((c) => c.estado === 'ATENCION').length;

    const computedScore = Math.max(
      10,
      Math.min(100, Number(aiPayload?.puntuacionPreparacion) || (100 - criticos * 25 - atenciones * 10))
    );

    const estadoAprobacion: 'APROBADO_REVISION' | 'CON_OBSERVACIONES_PREVIAS' | 'BLOQUEADO' =
      aiPayload?.estadoAprobacion && ['APROBADO_REVISION', 'CON_OBSERVACIONES_PREVIAS', 'BLOQUEADO'].includes(aiPayload.estadoAprobacion)
        ? aiPayload.estadoAprobacion
        : criticos > 0
        ? 'BLOQUEADO'
        : atenciones > 0
        ? 'CON_OBSERVACIONES_PREVIAS'
        : 'APROBADO_REVISION';

    const nowIso = new Date().toISOString();
    const sha256 = crypto
      .createHash('sha256')
      .update(`${tipoDocumento}_${entity?.id || 'none'}_${computedScore}_${nowIso}`)
      .digest('hex');

    res.json({
      success: true,
      modelUsed,
      report: {
        tipoDocumento,
        puntuacionPreparacion: computedScore,
        estadoAprobacion,
        resumenEjecutivo:
          aiPayload?.resumenEjecutivo ||
          `Revisión previa completada para ${tipoDocumento}. Se verificaron ${allChecks.length} controles (${criticos} críticos, ${atenciones} en atención).`,
        hallazgosRevision: allChecks,
        mejorasSugeridas: Array.isArray(aiPayload?.mejorasSugeridas)
          ? aiPayload.mejorasSugeridas
          : allChecks.filter((c) => c.estado !== 'CUMPLE').map((c) => c.recomendacion),
        textoMejoradoSugerido: aiPayload?.textoMejoradoSugerido || '',
        timestamp: nowIso,
        sha256,
        modelUsed,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/pre-review-document:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error ejecutando la revisión previa interactiva.',
    });
  }
});

// =========================================================================
// NORMATIVE HIERARCHY & CCRD / NOBACI LITERAL 3.01+ EXTRACTOR
// =========================================================================
const HIERARCHY_ORDER: Record<string, number> = {
  CONSTITUCION: 1,
  TRATADOS_ISSAI_NIA: 2,
  LEY: 3,
  DECRETO: 4,
  RESOLUCION_NOBACI: 5,
  NORMATIVA_INTERNA: 6,
};

function inferHierarchy(text: string): { level: string; order: number } {
  const low = String(text || '').toLowerCase();
  if (low.includes('constituc')) return { level: 'CONSTITUCION', order: 1 };
  if (low.includes('issai') || low.includes('nia ') || low.includes('isa ') || low.includes('tratado')) {
    return { level: 'TRATADOS_ISSAI_NIA', order: 2 };
  }
  if (low.includes('ley')) return { level: 'LEY', order: 3 };
  if (low.includes('decreto') || low.includes('reglamento')) return { level: 'DECRETO', order: 4 };
  if (low.includes('nobaci') || low.includes('resoluc') || low.includes('adc-') || low.includes('cgr') || low.includes('dgcp')) {
    return { level: 'RESOLUCION_NOBACI', order: 5 };
  }
  return { level: 'NORMATIVA_INTERNA', order: 6 };
}

function tokenizeForSimilarity(txt: string): Set<string> {
  const stop = new Set(['para', 'sobre', 'como', 'entre', 'desde', 'hacia', 'conforme', 'segun', 'según', 'del', 'las', 'los', 'una', 'unos', 'unas', 'que', 'por', 'con', 'sin']);
  const tokens = String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

app.post('/api/forensic/extract-hallazgos-ccrd', async (req, res) => {
  try {
    const {
      entityName = 'Entidad Auditada',
      paisNormativa = 'República Dominicana',
      periodo = { fechaDesde: '', fechaHasta: '' },
      rawText = '',
      informePreliminarText = '',
      actaLecturaText = '',
      recursosCount = 0,
      replicasCount = 0,
      contraReplicasCount = 0,
      directors = [],
    } = req.body;

    const combinedText = [informePreliminarText, rawText].filter((s) => s && s.trim()).join('\n\n').trim();
    if (!combinedText) {
      return res.status(400).json({
        success: false,
        error: 'No hay texto documental cargado para extraer hallazgos literales (3.01 en adelante).',
      });
    }

    // Programmatic extraction first: capture verbatim headings 3.01+, 3.1.xx, Hallazgo, Observación
    const lines = combinedText.split(/\r?\n/);
    const verbatimBlocks: { idCode: string; title: string; rawBlock: string }[] = [];
    const headingRegex = /^\s*((?:3\.(?:0?\d+(?:\.\d+)*))|(?:hallazgo|observaci[oó]n)\s*(?:n[uú]m\.?|no\.?|#)?\s*\d+(?:\.\d+)*)\b[\s:.-]*(.*)$/i;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(headingRegex);
      if (m) {
        const idCode = m[1].trim();
        const titlePart = m[2].trim();
        const snippetLines: string[] = [lines[i].trim()];
        for (let j = i + 1; j < Math.min(lines.length, i + 18); j++) {
          if (lines[j].match(headingRegex)) break;
          if (lines[j].trim()) snippetLines.push(lines[j].trim());
        }
        verbatimBlocks.push({
          idCode,
          title: titlePart || `Acápite ${idCode}`,
          rawBlock: snippetLines.join('\n'),
        });
      }
    }

    const ai = getAiClient();
    let aiHallazgos: any[] = [];
    let modelUsed = 'deterministic-parser';

    if (ai) {
      try {
        const promptText = `
[EXTRACCIÓN LITERAL DE HALLAZGOS 3.01 EN ADELANTE Y EVALUACIÓN DE SUPERVISIÓN CGR / CCRD / NOBACI]
Entidad Auditada: ${entityName}
Jurisdicción: ${paisNormativa}
Período: ${periodo?.fechaDesde || 'N/D'} al ${periodo?.fechaHasta || 'N/D'}

REGLA ESTRICTA DE INTEGRIDAD DOCUMENTAL:
1. Extrae ÚNICAMENTE acápites/hallazgos que consten REALMENTE en el TEXTO SUMINISTRADO (priorizando numeración desde 3.01, 3.02, 3.1.01 hasta 3.8.01 en adelante; si el texto usa otra numeración real de hallazgos, respétala literalmente).
2. NO inventes ni alteres hechos, cifras, fechas ni normas que no se desprendan del texto real.
3. Redacta las recomendaciones en tono de SUPERVISOR / REVISOR TÉCNICO DE AUDITORÍA GUBERNAMENTAL (NO menciones "IA", "inteligencia artificial" ni "modelo" en ningún campo).
4. Ordena el criterio de cada hallazgo conforme al Orden Jerárquico Normativo:
   1 = CONSTITUCION, 2 = TRATADOS_ISSAI_NIA, 3 = LEY, 4 = DECRETO, 5 = RESOLUCION_NOBACI, 6 = NORMATIVA_INTERNA.
5. Marco técnico aplicable para diagnóstico de brechas (cuando aplique al texto): Ley 18-24 (Arts. 10, 25 y 38 - CCRD), Ley 340-06 (Arts. 32 y 33), Ley 41-08 (Art. 8 num. 12 y Art. 50), Ley 311-14, Decreto 527-09 (Art. 3), Ley 498-06 (Arts. 24 y 25.d), Decreto 543-12 (Art. 31), Normas NOBACI 3 / NOBIS (ADC-3-006 nums. 4, 20, 33, 86; ADC-03-004.19; ADC-3-001.3; Activos Fijos), Ley 10-04 y Ley 64-00.

${verbatimBlocks.length > 0 ? `BLOQUES PRE-DETECTADOS (3.01+):\n${JSON.stringify(verbatimBlocks.slice(0, 30), null, 2)}\n` : ''}

[TEXTO REAL DEL EXPEDIENTE / INFORME]:
${combinedText.slice(0, 36000)}

Devuelve JSON estricto con esta estructura:
{
  "hallazgos": [
    {
      "idHallazgo": "3.1.01",
      "titulo": "Título literal o exacto del acápite",
      "condicionLiteral": "Extracto textual de lo que existe en el documento cargado sin alterar hechos.",
      "criterioAuditorOriginal": "Criterio tal como aparece citado originalmente en el borrador/documento (si existe).",
      "criterioTexto": "Cita textual normativa sugerida y artículos puntuales aplicables según jerarquía.",
      "jerarquiaCriterio": "LEY | DECRETO | RESOLUCION_NOBACI | TRATADOS_ISSAI_NIA | CONSTITUCION | NORMATIVA_INTERNA",
      "nivelRiesgo": "Alto (Crítico) | Medio (Moderado) | Bajo (Menor)",
      "referenciaExacta": "Página, sección o documento origen exacto donde consta",
      "causa": "Causa raíz identificada en el documento",
      "efecto": "Impacto o riesgo institucional/financiero",
      "estado": "Correcto / Cumple | Con Observación / Mejora",
      "puntaje0a10": 7.5,
      "recomendacionSupervisor": "Recomendación técnica del Supervisor/Revisor basada exclusivamente en el hallazgo real para lograr 10/10.",
      "planAccionCorrectivo": "Pasos concretos de subsanación",
      "responsableArea": "RR. HH. / Planificación / Compras / Almacén / Dirección Administrativa",
      "entregable": "Manual, política o formulario requerido",
      "leyesCitadas": [
        { "norma": "Ley núm. 41-08", "articulo": "Art. 8, num. 12", "jerarquia": "LEY" }
      ]
    }
  ]
}
`;
        const resp = await callGeminiWithResilience(ai, {
          contents: promptText,
          config: { responseMimeType: 'application/json' },
        });
        const parsed = parseJsonSafe<any>(resp.response.text || '{}', { hallazgos: [] });
        if (Array.isArray(parsed.hallazgos)) {
          aiHallazgos = parsed.hallazgos;
          modelUsed = resp.modelUsed;
        }
      } catch (aiErr) {
        console.warn('extract-hallazgos-ccrd AI fallback to verbatim parser:', aiErr);
      }
    }

    const rawSourceList = aiHallazgos.length > 0 ? aiHallazgos : verbatimBlocks.map((b) => {
      const isObs = /debilidad|incumplimiento|ausencia|fuera de plazo|error|diferencia|sin\s+|vencid/i.test(b.rawBlock);
      return {
        idHallazgo: b.idCode,
        titulo: b.title,
        condicionLiteral: b.rawBlock,
        criterioAuditorOriginal: 'Verificado en texto original cargado',
        criterioTexto: 'Verificar artículo puntual aplicable en el Orden Jerárquico Normativo.',
        jerarquiaCriterio: inferHierarchy(b.rawBlock).level,
        nivelRiesgo: isObs ? 'Alto (Crítico)' : 'Bajo (Menor)',
        referenciaExacta: `Acápite ${b.idCode}`,
        causa: 'Pendiente de determinación detallada en campo.',
        efecto: 'Exposición operativa o de cumplimiento normativo.',
        estado: isObs ? 'Con Observación / Mejora' : 'Correcto / Cumple',
        puntaje0a10: isObs ? 6.5 : 10,
        recomendacionSupervisor: 'Validar evidencia soporte y documentar plan correctivo conforme a NOBACI y Ley núm. 18-24.',
        planAccionCorrectivo: 'Subsanar brecha documental y actualizar registros institucionales.',
        responsableArea: 'Área Auditada Responsable',
        entregable: 'Informe de cumplimiento y soporte documental',
        leyesCitadas: [],
      };
    });

    // If still empty (no 3.xx pattern in doc), extract paragraph blocks literally so nothing is invented
    const fallbackParagraphs =
      rawSourceList.length === 0
        ? combinedText
            .split(/\n{2,}/)
            .filter((p) => p.trim().length > 40)
            .slice(0, 16)
            .map((p, idx) => {
              const isObs = /debilidad|incumplimiento|ausencia|fuera de plazo|error|diferencia|observa/i.test(p);
              return {
                idHallazgo: `3.${String(idx + 1).padStart(2, '0')}`,
                titulo: p.trim().split(/\n/)[0].slice(0, 90),
                condicionLiteral: p.trim().slice(0, 1200),
                criterioAuditorOriginal: 'Texto literal del documento',
                criterioTexto: 'Ley núm. 18-24 y Normas NOBACI aplicables al acápite.',
                jerarquiaCriterio: inferHierarchy(p).level,
                nivelRiesgo: isObs ? 'Medio (Moderado)' : 'Bajo (Menor)',
                referenciaExacta: `Bloque textual #${idx + 1}`,
                causa: 'Según texto real suministrado.',
                efecto: 'Impacto sujeto a validación de supervisión.',
                estado: isObs ? 'Con Observación / Mejora' : 'Correcto / Cumple',
                puntaje0a10: isObs ? 7.0 : 9.5,
                recomendacionSupervisor: 'Verificar correspondencia con la documentación fuente y sustentar criterio normativo.',
                planAccionCorrectivo: 'Alinear proceso con manuales de control interno NOBACI.',
                responsableArea: 'Dirección Administrativa / Área Técnica',
                entregable: 'Evidencia de verificación',
                leyesCitadas: [],
              };
            })
        : rawSourceList;

    const normalized = fallbackParagraphs.map((h: any, idx: number) => {
      const hLevel = String(h.jerarquiaCriterio || 'LEY').toUpperCase();
      const order = HIERARCHY_ORDER[hLevel] || 3;
      const validRiesgo = ['Alto (Crítico)', 'Medio (Moderado)', 'Bajo (Menor)'].includes(h.nivelRiesgo)
        ? h.nivelRiesgo
        : h.estado === 'Correcto / Cumple'
        ? 'Bajo (Menor)'
        : 'Medio (Moderado)';
      return {
        id: `hz-lit-${Date.now()}-${idx}`,
        idHallazgo: String(h.idHallazgo || `3.${String(idx + 1).padStart(2, '0')}`),
        titulo: String(h.titulo || `Hallazgo ${idx + 1}`),
        condicionLiteral: String(h.condicionLiteral || ''),
        criterioAuditorOriginal: String(h.criterioAuditorOriginal || ''),
        criterioTexto: String(h.criterioTexto || ''),
        jerarquiaCriterio: (HIERARCHY_ORDER[hLevel] ? hLevel : 'LEY') as any,
        jerarquiaOrden: order,
        nivelRiesgo: validRiesgo,
        referenciaExacta: String(h.referenciaExacta || (informePreliminarText ? 'Informe Preliminar' : 'Documento Cargado')),
        causa: String(h.causa || ''),
        efecto: String(h.efecto || ''),
        estado: h.estado === 'Correcto / Cumple' ? 'Correcto / Cumple' : 'Con Observación / Mejora',
        puntaje0a10: Math.max(0, Math.min(10, Number(h.puntaje0a10) || 7.0)),
        recomendacionSupervisor: String(h.recomendacionSupervisor || ''),
        planAccionCorrectivo: String(h.planAccionCorrectivo || ''),
        responsableArea: String(h.responsableArea || ''),
        entregable: String(h.entregable || ''),
        leyesCitadas: Array.isArray(h.leyesCitadas) ? h.leyesCitadas : [],
        origenDocumento: informePreliminarText ? 'Informe Preliminar / Documento Cargado' : 'Evidencia Digital',
      };
    });

    // Dynamic 4-stage CCRD Guía evaluation (Ley núm. 18-24)
    const hasDocs = combinedText.length > 50;
    const hasActa = actaLecturaText.trim().length > 20;
    const hasContradiccion = recursosCount + replicasCount + contraReplicasCount > 0;
    const ccrdStages = [
      {
        step: 1,
        title: 'Planificación y Análisis',
        description: 'Recepción de credenciales, análisis preliminar, identificación de titulares (decretos) y evaluación de riesgos/controles NOBACI.',
        keyActions: ['Acreditación del equipo', 'Revisión marco legal jerárquico', 'Identificación de directores por período'],
        status: hasDocs ? 'Completado' : 'En Proceso',
        evidenciaVerificada: `${directors.length} director(es) registrados; ${combinedText.length} caracteres de expediente procesados.`,
      },
      {
        step: 2,
        title: 'Ejecución',
        description: 'Aplicación de pruebas sustantivas y de cumplimiento sobre contrataciones, ciclo de pagos, RR. HH. e inventarios.',
        keyActions: ['Extracción literal 3.01+', 'Pruebas de cumplimiento NOBACI', 'Detección de duplicidades'],
        status: normalized.length > 0 ? 'Completado' : hasDocs ? 'En Proceso' : 'Pendiente',
        evidenciaVerificada: `${normalized.length} acápite(s)/hallazgo(s) extraídos literalmente.`,
      },
      {
        step: 3,
        title: 'Comunicación de Hallazgos',
        description: 'Lectura de hallazgos y concesión de plazos para recursos, réplicas y contra-réplicas bajo el debido proceso.',
        keyActions: ['Acta de Lectura', 'Recepción de Recursos y Réplicas', 'Ponderación de Contra-Réplicas'],
        status: hasActa && hasContradiccion ? 'Completado' : hasActa || hasContradiccion ? 'En Proceso' : 'Pendiente',
        evidenciaVerificada: `Acta: ${hasActa ? 'Cargada' : 'Pendiente'} | Recursos: ${recursosCount} | Réplicas: ${replicasCount} | Contra-Réplicas: ${contraReplicasCount}.`,
      },
      {
        step: 4,
        title: 'Conclusión e Informe Final',
        description: 'Consolidación de dictamen del Supervisor/Revisor, recomendaciones correctivas y matriz aprobada para remisión oficial.',
        keyActions: ['Revisión previa QA', 'Cierre de hallazgos', 'Emisión Word/Excel oficial'],
        status: normalized.length > 0 && hasContradiccion ? 'En Proceso' : 'Pendiente',
        evidenciaVerificada: 'Listo para revisión previa y emisión de Informe del Supervisor.',
      },
    ];

    res.json({
      success: true,
      modelUsed,
      hallazgos: normalized,
      ccrdStages,
      totalExtraidos: normalized.length,
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/extract-hallazgos-ccrd:', error);
    res.status(500).json({ success: false, error: error.message || 'Error extrayendo hallazgos literales 3.01+.' });
  }
});

// =========================================================================
// SENIOR CGR / NOBACI / LEY 41-08 / MAP / DGCP EVALUATOR
// =========================================================================
app.post('/api/forensic/evaluate-nobaci-hallazgo', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'Servicio de análisis no disponible en el servidor.' });
    }

    const { situacion = '', idHallazgo = '3.01', entityName = 'Entidad Pública', periodo = '' } = req.body;
    if (!situacion.trim()) {
      return res.status(400).json({ success: false, error: 'Debe describir la situación o hallazgo real a evaluar.' });
    }

    const promptText = `
Actúa como un Auditor Gubernamental Senior y Consultor en Administración Pública de la República Dominicana, experto en las Normas Básicas de Control Interno (NOBACI) de la Contraloría General de la República (CGR), la Ley 41-08 de Función Pública y normativas del MAP y la DGCP.
Redacta exclusivamente desde la perspectiva del Supervisor / Revisor Técnico (NUNCA menciones "IA", "inteligencia artificial" ni "Gemini").

Entidad: ${entityName} | Período: ${periodo || 'Ejercicio Fiscal'} | Código: ${idHallazgo}

Marco Normativo Dominicano Obligatorio (respetando Orden Jerárquico: Constitución -> Tratados/ISSAI -> Leyes -> Decretos -> Resoluciones/NOBACI -> Manuales):
1. Ley 41-08 (Art. 8, num. 12) y Decreto 527-09 (Art. 3) sobre estructuras organizativas, manuales de procedimientos y cargos.
2. Ley 498-06 (Arts. 24 y 25.d) sobre Planificación Estratégica Institucional (PEI).
3. Decreto 543-12 (Art. 31) sobre Planes Anuales de Compras y Contrataciones (PACC).
4. Normas NOBACI 3: ADC-3-006 (nums. 4, 20, 33 y 86 para Recursos Humanos), ADC-03-004.19 (Compras) y ADC-3-001.3 (Inventarios).

Situación o hallazgo real a evaluar:
"${situacion}"

Devuelve JSON estricto:
{
  "diagnosticoBrechas": "Normas específicas incumplidas en orden jerárquico y riesgo institucional asociado.",
  "condicionLiteral": "Redacción objetiva del hecho detectado basada estrictamente en la situación descrita.",
  "criterioTexto": "Cita textual y jerárquica de los artículos aplicables (Ley, Decreto, NOBACI).",
  "jerarquiaCriterio": "LEY | DECRETO | RESOLUCION_NOBACI | NORMATIVA_INTERNA",
  "causa": "Causa administrativa/operativa subyacente.",
  "efecto": "Consecuencia o impacto institucional/patrimonial.",
  "recomendacionSupervisor": "Recomendación técnica de supervisión para subsanar el hallazgo.",
  "planAccionCorrectivo": "Pasos concretos enumerados para lograr aprobación del MAP y la CGR.",
  "responsableArea": "RR. HH. | Planificación | Compras | Almacén | Dirección General",
  "entregable": "Manuales, políticas o formularios específicos requeridos",
  "leyesCitadas": [
    { "norma": "Nombre oficial de la norma", "articulo": "Artículo o numeral exacto", "jerarquia": "LEY | DECRETO | RESOLUCION_NOBACI" }
  ]
}
`;

    const { response, modelUsed } = await callGeminiWithResilience(ai, {
      contents: promptText,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = parseJsonSafe<any>(response.text || '{}', {});
    res.json({ success: true, modelUsed, data: parsed });
  } catch (error: any) {
    console.error('Error in /api/forensic/evaluate-nobaci-hallazgo:', error);
    res.status(500).json({ success: false, error: error.message || 'Error evaluando hallazgo bajo marco NOBACI/CGR.' });
  }
});

// =========================================================================
// DUPLICATE DETECTOR ACROSS FINDINGS, LAWS, CONTRACTS & PAYMENTS
// =========================================================================
app.post('/api/forensic/detect-duplicates', async (req, res) => {
  try {
    const {
      hallazgos = [],
      observaciones = [],
      legalLibrary = [],
      contractRows = [],
      paymentCycleRows = [],
    } = req.body;

    const duplicates: any[] = [];

    // 1. Hallazgos & Observaciones similarity check
    const combinedItems = [
      ...hallazgos.map((h: any) => ({ id: h.id, code: h.idHallazgo, label: `${h.idHallazgo} ${h.titulo}`, text: `${h.titulo} ${h.condicionLiteral}` })),
      ...observaciones.map((o: any) => ({ id: o.id, code: o.codigoObservacion, label: `${o.codigoObservacion} ${o.titulo}`, text: `${o.titulo} ${o.descripcionPreliminar}` })),
    ];

    for (let i = 0; i < combinedItems.length; i++) {
      const tokA = tokenizeForSimilarity(combinedItems[i].text);
      for (let j = i + 1; j < combinedItems.length; j++) {
        const tokB = tokenizeForSimilarity(combinedItems[j].text);
        const sim = jaccardSimilarity(tokA, tokB);
        if (sim >= 0.48 || (combinedItems[i].code && combinedItems[i].code === combinedItems[j].code)) {
          duplicates.push({
            id: `dup-h-${i}-${j}-${Date.now()}`,
            tipo: 'HALLAZGO',
            elementosInvolucrados: [combinedItems[i].label, combinedItems[j].label],
            similitudPct: Math.round(Math.max(sim, combinedItems[i].code === combinedItems[j].code ? 0.95 : sim) * 100),
            descripcion: `Posible duplicidad o solapamiento sustantivo entre "${combinedItems[i].label}" y "${combinedItems[j].label}".`,
            recomendacionMejora: 'Consolidar en un único acápite con evidencia unificada o diferenciar expresamente el período/área evaluada para evitar doble imputación.',
            incluidoEnObservaciones: false,
          });
        }
      }
    }

    // 2. Legal citations duplicity check
    for (let i = 0; i < legalLibrary.length; i++) {
      const normA = String(legalLibrary[i].numeroNorma || legalLibrary[i].titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      for (let j = i + 1; j < legalLibrary.length; j++) {
        const normB = String(legalLibrary[j].numeroNorma || legalLibrary[j].titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normA && normB && (normA === normB || normA.includes(normB) || normB.includes(normA))) {
          duplicates.push({
            id: `dup-l-${i}-${j}-${Date.now()}`,
            tipo: 'LEY_CITA',
            elementosInvolucrados: [legalLibrary[i].titulo || legalLibrary[i].numeroNorma, legalLibrary[j].titulo || legalLibrary[j].numeroNorma],
            similitudPct: 92,
            descripcion: `Cita normativa duplicada en la Biblioteca Legal del caso: "${legalLibrary[i].numeroNorma}" vs "${legalLibrary[j].numeroNorma}".`,
            recomendacionMejora: 'Unificar bajo una sola ficha normativa jerárquica vinculando todos sus artículos puntuales.',
            incluidoEnObservaciones: false,
          });
        }
      }
    }

    // 3. Payment e-CF / Libramiento / Contract duplicity check
    const seenEcf = new Map<string, any>();
    paymentCycleRows.forEach((p: any) => {
      const key = String(p.numeroFacturaEcf || '').trim().toUpperCase();
      if (key && key !== 'N/D') {
        if (seenEcf.has(key)) {
          const prev = seenEcf.get(key);
          duplicates.push({
            id: `dup-p-${p.id}-${Date.now()}`,
            tipo: 'CONTRATO_PAGO',
            elementosInvolucrados: [`Orden ${prev.ordenNumero} (${prev.beneficiario})`, `Orden ${p.ordenNumero} (${p.beneficiario})`],
            similitudPct: 100,
            descripcion: `Comprobante fiscal (e-CF/Factura) "${key}" repetido en dos registros del Ciclo de Pagos.`,
            recomendacionMejora: 'Verificar inmediatamente posible doble pago o error de imputación contable e incluir como observación crítica.',
            incluidoEnObservaciones: false,
          });
        } else {
          seenEcf.set(key, p);
        }
      }
    });

    const seenContracts = new Map<string, any>();
    contractRows.forEach((c: any) => {
      const key = String(c.contratoId || '').trim().toUpperCase();
      if (key && seenContracts.has(key)) {
        const prev = seenContracts.get(key);
        duplicates.push({
          id: `dup-c-${c.id}-${Date.now()}`,
          tipo: 'CONTRATO_PAGO',
          elementosInvolucrados: [`${prev.contratoId} (${prev.proveedor})`, `${c.contratoId} (${c.proveedor})`],
          similitudPct: 100,
          descripcion: `Código de contrato "${key}" registrado múltiples veces en la matriz.`,
          recomendacionMejora: 'Consolidar adendas en el registro matriz original o diferenciar sufijos de modificación.',
          incluidoEnObservaciones: false,
        });
      } else if (key) {
        seenContracts.set(key, c);
      }
    });

    res.json({
      success: true,
      duplicates,
      totalDuplicates: duplicates.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error detectando duplicidades.' });
  }
});

// =========================================================================
// VIRTUAL LEGAL LIBRARY BUILDER (Laws, Decrees & Regulations linked to Findings)
// =========================================================================
app.post('/api/forensic/build-legal-library', async (req, res) => {
  try {
    const {
      paisNormativa = 'República Dominicana',
      hallazgos = [],
      observaciones = [],
      directors = [],
      rawText = '',
    } = req.body;

    // 1. Collect citations programmatically from hallazgos, directors, and text
    const textPool = [
      rawText.slice(0, 20000),
      ...hallazgos.map((h: any) => `${h.idHallazgo}: ${h.criterioTexto} ${h.condicionLiteral}`),
      ...observaciones.map((o: any) => `${o.codigoObservacion}: ${o.fundamentacionLegal}`),
      ...directors.map((d: any) => `Decreto ${d.numeroDecretoNombramiento}`),
    ].join('\n');

    const normaRegex = /(?:Ley(?:\s+n[uú]m\.?|\s+No\.?)?\s*\d{1,4}-\d{2,4}|Decreto(?:\s+n[uú]m\.?|\s+No\.?)?\s*\d{1,4}-\d{2,4}|NOBACI(?:\s*3)?(?:\s*ADC-[\d.-]+)?|Resoluci[oó]n\s*(?:n[uú]m\.?|No\.?)?\s*[\d/-]+|Constituci[oó]n(?:\s+de\s+la\s+Rep[uú]blica)?|NIA\s*\d+|ISSAI\s*\d+)/gi;
    const foundNormsSet = new Set<string>();
    const matches = textPool.match(normaRegex) || [];
    matches.forEach((m) => foundNormsSet.add(m.replace(/\s+/g, ' ').trim()));

    const ai = getAiClient();
    const nowIso = new Date().toISOString();
    let structuredNorms: any[] = [];
    let webSources: any[] = [];

    if (ai && (foundNormsSet.size > 0 || hallazgos.length > 0)) {
      const promptText = `
[CONSTRUCCIÓN DE BIBLIOTECA JURÍDICA VIRTUAL Y VINCULACIÓN CON HALLAZGOS]
País / Jurisdicción: ${paisNormativa}
Normas detectadas inicialmente: ${Array.from(foundNormsSet).slice(0, 25).join(', ') || 'Analizar del texto'}

Hallazgos del caso:
${JSON.stringify(hallazgos.slice(0, 25).map((h: any) => ({ idHallazgo: h.idHallazgo, titulo: h.titulo, criterio: h.criterioTexto, leyesCitadas: h.leyesCitadas })), null, 2)}

Decretos de Directores:
${JSON.stringify(directors.map((d: any) => ({ nombre: d.nombre, decreto: d.numeroDecretoNombramiento, fuentes: d.fuentes })), null, 2)}

Usa la búsqueda web oficial si está disponible para encontrar enlaces URL oficiales reales (Consultoría Jurídica del Poder Ejecutivo, Congreso, CGR, DGCP, MAP, Portal Oficial) de cada Ley, Decreto, Reglamento o Norma NOBACI citada, y vincula cada norma a los IDs exactos de hallazgos (ej. "3.01", "3.1.02") y artículos puntuales.
NO inventes URLs ni números de normas.
Orden jerárquico: 1=CONSTITUCION, 2=TRATADOS_ISSAI_NIA, 3=LEY, 4=DECRETO, 5=RESOLUCION_NOBACI, 6=NORMATIVA_INTERNA.

Devuelve JSON dentro de \`\`\`json ... \`\`\`:
\`\`\`json
{
  "normas": [
    {
      "numeroNorma": "Ley núm. 18-24",
      "titulo": "Ley de la Cámara de Cuentas de la República Dominicana",
      "jerarquia": "LEY",
      "articulosPuntuales": ["Art. 36", "Art. 42"],
      "hallazgosVinculados": ["3.01", "3.02"],
      "url": "https://...",
      "ubicacionFuente": "Consultoría Jurídica del Poder Ejecutivo / Congreso Nacional",
      "resumenAplicacion": "Breve explicación técnica de su aplicación a los hallazgos vinculados."
    }
  ]
}
\`\`\`
`;

      try {
        const gResp = await callGeminiWithResilience(ai, {
          contents: promptText,
          config: { tools: [{ googleSearch: {} }] },
        });
        const parsed = parseJsonSafe<any>(gResp.response.text || '{}', { normas: [] });
        structuredNorms = Array.isArray(parsed.normas) ? parsed.normas : [];
        const chunks = gResp.response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        webSources = chunks.filter((c: any) => c?.web?.uri).map((c: any) => ({
          url: String(c.web.uri),
          titulo: String(c.web.title || ''),
        }));
      } catch (searchErr) {
        // Fallback: run without search tool, and attach any official public search fallback URL
        try {
          const fallbackAi = await callGeminiWithResilience(ai, {
            contents: promptText,
            config: { responseMimeType: 'application/json' },
          });
          const parsed = parseJsonSafe<any>(fallbackAi.response.text || '{}', { normas: [] });
          structuredNorms = Array.isArray(parsed.normas) ? parsed.normas : [];
        } catch {}
      }
    }

    // Ensure every programmatically found norm or director decree is represented cleanly
    if (structuredNorms.length === 0) {
      Array.from(foundNormsSet).forEach((norm) => {
        const inf = inferHierarchy(norm);
        const linkedIds = hallazgos
          .filter((h: any) => `${h.criterioTexto} ${h.condicionLiteral}`.toLowerCase().includes(norm.toLowerCase()))
          .map((h: any) => h.idHallazgo);
        structuredNorms.push({
          numeroNorma: norm,
          titulo: norm,
          jerarquia: inf.level,
          articulosPuntuales: ['Por especificar'],
          hallazgosVinculados: linkedIds,
          url: '',
          ubicacionFuente: 'Citada en el expediente cargado',
          resumenAplicacion: `Referencia normativa vinculada en ${linkedIds.join(', ') || 'el expediente'}.`,
        });
      });
    }

    // Deduplicate check & finalize sorted by Hierarchy Order
    const seenKeys = new Map<string, number>();
    const library = structuredNorms
      .map((n: any, idx: number) => {
        const level = HIERARCHY_ORDER[String(n.jerarquia || '').toUpperCase()]
          ? String(n.jerarquia).toUpperCase()
          : inferHierarchy(n.numeroNorma || n.titulo).level;
        const order = HIERARCHY_ORDER[level] || 3;
        const normKey = String(n.numeroNorma || n.titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const prevCount = seenKeys.get(normKey) || 0;
        seenKeys.set(normKey, prevCount + 1);

        // Try matching a grounded web source URL if the entry doesn't have one
        const groundedMatch =
          !n.url && webSources.find((ws) => ws.titulo.toLowerCase().includes(String(n.numeroNorma || '').toLowerCase()));
        const finalUrl = n.url && /^https?:\/\//i.test(n.url)
          ? n.url
          : groundedMatch?.url || '';

        const sha256 = crypto
          .createHash('sha256')
          .update(`${n.numeroNorma}_${finalUrl}_${nowIso}_${idx}`)
          .digest('hex');

        return {
          id: `law-${Date.now()}-${idx}`,
          numeroNorma: String(n.numeroNorma || n.titulo || `Norma ${idx + 1}`),
          titulo: String(n.titulo || n.numeroNorma || 'Referencia Normativa'),
          jerarquia: level,
          jerarquiaOrden: order,
          articulosPuntuales: Array.isArray(n.articulosPuntuales) ? n.articulosPuntuales : [],
          hallazgosVinculados: Array.isArray(n.hallazgosVinculados) ? n.hallazgosVinculados : [],
          url: finalUrl,
          ubicacionFuente: String(n.ubicacionFuente || (finalUrl ? 'Portal Web Oficial' : 'Expediente Auditado')),
          resumenAplicacion: String(n.resumenAplicacion || ''),
          esDuplicado: prevCount > 0,
          detalleDuplicidad: prevCount > 0 ? 'Norma citada múltiples veces en la biblioteca.' : '',
          sha256,
          fechaRegistro: nowIso,
        };
      })
      .sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);

    res.json({
      success: true,
      library,
      totalNormas: library.length,
      timestamp: nowIso,
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/build-legal-library:', error);
    res.status(500).json({ success: false, error: error.message || 'Error construyendo la Biblioteca Virtual Legal.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer();
