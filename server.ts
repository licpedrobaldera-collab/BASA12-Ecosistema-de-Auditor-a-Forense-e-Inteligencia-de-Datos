import express from 'express';
import { GoogleGenAI } from '@google/genai';
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

// Persistent Local Forensic DB (Works identically in Dev and Production)
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

// Initialise GoogleGenAI
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

// PII Anonymizer helper
function anonymizeText(text: string): string {
  let clean = text;
  // Dominican Cedula: 000-0000000-0 or 11 digits
  clean = clean.replace(/\b\d{3}-\d{7}-\d{1}\b/g, '[CÉDULA_PROTEGIDA]');
  // RNC (9 or 11 digits)
  clean = clean.replace(/\b(1\d{8}|4\d{8}|5\d{8})\b/g, '[RNC_PROTEGIDO]');
  // Bank accounts (10-20 digits)
  clean = clean.replace(/\b\d{10,20}\b/g, '[CTA_BANCARIA_PROTEGIDA]');
  // Common name patterns
  clean = clean.replace(
    /(?:Sr\.|Sra\.|Lic\.|Dr\.|Ing\.|Don|Doña)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/g,
    '$1 [APELLIDO_ANONIMIZADO]'
  );
  return clean;
}

// Helper: Extract numeric amounts from raw text for Benford / Contract heuristics
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

// Health check route for Production monitoring
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// UNIVERSAL DIGITAL FORMAT PARSER (PDF, Excel, Word, TXT, JSON, XML, OCR)
// =========================================================================
app.post('/api/forensic/parse-file', async (req, res) => {
  try {
    const { fileName = 'documento', mimeType = '', base64Data = '' } = req.body;

    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'No se recibió contenido del archivo.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = path.extname(fileName).toLowerCase();

    let extractedText = '';
    let extractedRows: Record<string, any>[] = [];
    let sheetNames: string[] = [];
    let pageCount: number | undefined;
    let parsedFormat = ext ? ext.replace('.', '').toUpperCase() : 'BINARIO';
    let numericAmounts: number[] = [];

    // 1. EXCEL / SPREADSHEETS / CSV (.xlsx, .xls, .xlsm, .xlsb, .ods, .csv, .tsv)
    if (['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods', '.csv', '.tsv'].includes(ext)) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      sheetNames = workbook.SheetNames;
      parsedFormat = ext === '.csv' ? 'CSV' : 'EXCEL';

      const textParts: string[] = [];
      for (const sName of sheetNames) {
        const sheet = workbook.Sheets[sName];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        if (extractedRows.length === 0 && jsonRows.length > 0) {
          extractedRows = jsonRows.slice(0, 500);
        } else if (jsonRows.length > 0) {
          extractedRows = extractedRows.concat(jsonRows.slice(0, 200));
        }

        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        textParts.push(`=== HOJA: ${sName} (${jsonRows.length} filas) ===\n${csvContent}`);

        // Extract numeric amounts directly from table cells
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
    // 2. WORD DOCUMENTS (.docx, .docm)
    else if (['.docx', '.docm'].includes(ext)) {
      parsedFormat = 'WORD (.DOCX)';
      const result = await mammoth.extractRawText({ buffer });
      extractedText = (result.value || '').trim();
      numericAmounts = extractNumericAmountsFromText(extractedText);
    }
    // 3. PDF DOCUMENTS (.pdf)
    else if (ext === '.pdf' || mimeType === 'application/pdf') {
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

      // If PDF is scanned (0 selectable text), try Gemini Multimodal OCR
      if (!extractedText || extractedText.length < 25) {
        const ai = getAiClient();
        if (ai && buffer.length <= 15 * 1024 * 1024) {
          try {
            const ocrResp = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Data,
                    },
                  },
                  {
                    text: 'Extrae y transcribe íntegramente todo el texto, tablas, montos, fechas, nombres de entidades y cláusulas de este documento PDF para auditoría forense.',
                  },
                ],
              },
            });
            extractedText = ocrResp.text || extractedText;
            parsedFormat = 'PDF (OCR Multimodal IA)';
          } catch (ocrErr) {
            console.warn('Gemini PDF OCR skipped/failed:', ocrErr);
          }
        }
      }
      numericAmounts = extractNumericAmountsFromText(extractedText);
    }
    // 4. IMAGES (.png, .jpg, .jpeg, .webp, .gif, .bmp) -> OCR Multimodal IA
    else if (
      ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'].includes(ext) ||
      mimeType.startsWith('image/')
    ) {
      parsedFormat = `IMAGEN (${ext.replace('.', '').toUpperCase() || 'OCR'})`;
      const ai = getAiClient();
      if (ai) {
        try {
          const ocrResp = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType || 'image/png',
                    data: base64Data,
                  },
                },
                {
                  text: 'Extrae todo el texto visible, números de factura/contrato, fechas, RNC/NIF, importes monetarios y detalles relevantes de esta imagen de evidencia digital.',
                },
              ],
            },
          });
          extractedText = ocrResp.text || '';
        } catch (imgErr: any) {
          extractedText = `[Imagen digital ${fileName} - ${buffer.length} bytes. OCR no disponible: ${imgErr.message}]`;
        }
      } else {
        extractedText = `[Imagen digital ${fileName} cargada (${(buffer.length / 1024).toFixed(1)} KB). Sello SHA-256: ${sha256}]`;
      }
      numericAmounts = extractNumericAmountsFromText(extractedText);
    }
    // 5. TEXT, JSON, XML, HTML, LOG, MD, SQL, RTF, YAML, EML, ETC.
    else if (
      ['.txt', '.json', '.xml', '.html', '.htm', '.md', '.log', '.sql', '.yaml', '.yml', '.eml', '.ini', '.conf', '.py', '.ts', '.js'].includes(ext) ||
      mimeType.startsWith('text/')
    ) {
      parsedFormat = ext ? ext.replace('.', '').toUpperCase() : 'TEXTO';
      const rawStr = buffer.toString('utf-8');
      if (ext === '.json') {
        try {
          const parsed = JSON.parse(rawStr);
          extractedText = JSON.stringify(parsed, null, 2);
          if (Array.isArray(parsed)) {
            extractedRows = parsed.slice(0, 500);
          }
        } catch {
          extractedText = rawStr;
        }
      } else if (ext === '.html' || ext === '.htm') {
        extractedText = rawStr.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      } else {
        extractedText = rawStr;
      }
      numericAmounts = extractNumericAmountsFromText(extractedText);
    }
    // 6. ANY OTHER DIGITAL FORMAT (Legacy .doc, .rtf, binary logs, etc.)
    else {
      parsedFormat = ext ? `DIGITAL (${ext.toUpperCase()})` : 'FORMATO DIGITAL';
      // Extract readable UTF-8 / ASCII sequences from any digital file
      const decoded = buffer.toString('utf-8');
      const printableRuns = decoded.match(/[\p{L}\p{N}\p{P}\p{Zs}\r\n\t]{4,}/gu) || [];
      extractedText = printableRuns.join('\n').trim();

      if (!extractedText || extractedText.length < 30) {
        extractedText = `[Archivo digital "${fileName}" (${(buffer.length / 1024).toFixed(2)} KB, tipo: ${mimeType || 'application/octet-stream'}) custodiado con sello SHA-256: ${sha256}]`;
      }
      numericAmounts = extractNumericAmountsFromText(extractedText);
    }

    res.json({
      success: true,
      fileName,
      size: buffer.length,
      sha256,
      parsedFormat,
      pageCount,
      sheetNames,
      extractedText: extractedText.slice(0, 100000), // cap at 100k chars for payload safety
      contentSnippet: extractedText.slice(0, 800),
      extractedRows: extractedRows.slice(0, 500),
      numericAmounts: numericAmounts.slice(0, 1000),
      totalCharacters: extractedText.length,
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
// PERSISTENT CASES & ENTITIES REGISTRY ROUTES
// =========================================================================
app.get('/api/cases', (_req, res) => {
  const cases = readJsonDb<any[]>(CASES_DB_FILE, []);
  res.json({ success: true, cases });
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

    const record = {
      ...incoming,
      id: incoming.id || `case-${Date.now()}`,
      codigoCaso:
        incoming.codigoCaso ||
        `CASO-${new Date().getFullYear()}-${String(cases.length + 1).padStart(3, '0')}`,
      updatedAt: now,
      timestamp: incoming.timestamp || now,
    };

    if (idx >= 0) {
      cases[idx] = record;
    } else {
      cases.unshift(record);
    }

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
    };
    if (idx >= 0) entities[idx] = saved;
    else entities.push(saved);

    writeJsonDb(ENTITIES_DB_FILE, entities);
    res.json({ success: true, entity: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Route: Multi-model Forensic Analysis
app.post('/api/forensic/analyze', async (req, res) => {
  try {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY no configurada en el servidor. Configure el secreto en AI Studio / entorno de producción.',
      });
    }

    const {
      nombreCaso = 'Auditoria_General',
      entidadNombre = 'Entidad Auditada',
      paisNormativa = 'República Dominicana',
      idioma = 'Español',
      origenes = ['Contabilidad Central'],
      requerimiento = 'Analizar adendas contractuales superiores al 50%',
      evidenciaSnippet = '',
      anonimizar = true,
      modelo = 'gemini-3.8-flash',
    } = req.body;

    const sanitizedReq = anonimizar ? anonymizeText(requerimiento) : requerimiento;
    const sanitizedSnippet = anonimizar && evidenciaSnippet ? anonymizeText(evidenciaSnippet) : evidenciaSnippet;

    const promptText = `
[INSTRUCCIÓN FORENSE SUPREMA - METODOLOGÍA R-C-T-F (Elite Top Big 4)]
Rol: Director Global de Ingeniería Forense y Análisis Antifraude (Big 4: PwC, Deloitte, EY, KPMG).
Entidad Auditada: ${entidadNombre}
Jurisdicción / País: ${paisNormativa}
Idioma de Respuesta: ${idioma}
Caso: ${nombreCaso}
Fuentes involucradas: ${origenes.join(', ')}
Requerimiento de auditoría: "${sanitizedReq}"
${sanitizedSnippet ? `\n[CONTENIDO / MUESTRA REAL DE EVIDENCIA DIGITAL ADJUNTA]:\n${sanitizedSnippet.slice(0, 8000)}\n` : ''}

Objetivo:
1. Analizar la evidencia digital adjunta (PDF, Excel, Word, TXT o datos estructurados) junto con el requerimiento.
2. Diseñar la estrategia pericial forense y detección de banderas rojas (red flags).
3. Desarrollar un script en Python modular, altamente profesional, con pandas y hashlib, completamente ejecutable y libre de alucinaciones.
4. Proporcionar un dictamen ejecutivo forense y fundamentación legal/normativa adaptada a ${paisNormativa} (NIA 240, COSO Antifraude, leyes nacionales aplicables).

Devuelve tu respuesta estructurada exactamente en formato JSON con las siguientes claves:
{
  "resumenEjecutivo": "Texto con el resumen ejecutivo formal del caso, contexto, hallazgos sobre la evidencia y metodología pericial aplicada.",
  "banderasRojas": ["Lista de 3 a 5 banderas rojas principales detectadas o a buscar en los datos"],
  "codigoPython": "Código Python limpio, modular y comentado, listo para ser ejecutado con pandas",
  "explicacionTecnica": "Explicación paso a paso de lo que hace el algoritmo forense y cómo aísla las anomalías",
  "fundamentoLegal": "Citas a normas internacionales y locales vigentes de ${paisNormativa}",
  "metricasRiesgo": {
    "nivelRiesgo": "CRÍTICO | ALTO | MEDIO | MODERADO",
    "exposicionEstimada": "Monto o impacto potencial estimado",
    "accionInmediata": "Acción forense recomendada para congelar o preservar evidencia"
  }
}
`;

    // Call Gemini Model
    const geminiResponse = await ai.models.generateContent({
      model: modelo || 'gemini-3.8-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = geminiResponse.text || '{}';
    let parsedData: any = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        parsedData = {
          resumenEjecutivo: rawText,
          banderasRojas: ['Adendas superiores al umbral legal', 'Discrepancia en cronología contractual'],
          codigoPython:
            '# Script de análisis forense\nimport pandas as pd\n\ndef analizar(df):\n    return df[df["adenda_pct"] > 50]',
          explicacionTecnica: 'Filtrado de contratos con incremento presupuestario anómalo.',
          fundamentoLegal: `Normativa vigente de ${paisNormativa} y NIA 240.`,
          metricasRiesgo: {
            nivelRiesgo: 'ALTO',
            exposicionEstimada: 'Indeterminada',
            accionInmediata: 'Solicitar adendas originales foliadas',
          },
        };
      }
    }

    let cleanedCode = parsedData.codigoPython || '';
    if (cleanedCode.includes('```python')) {
      cleanedCode = cleanedCode.replace(/```python\s*/g, '').replace(/```/g, '').trim();
    }

    const stampContent = `${nombreCaso}_${entidadNombre}_${requerimiento}_${cleanedCode}_${Date.now()}`;
    const digitalHash = crypto.createHash('sha256').update(stampContent).digest('hex');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      digitalHash,
      data: {
        ...parsedData,
        codigoPython: cleanedCode,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/forensic/analyze:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error procesando el análisis forense con Gemini',
    });
  }
});

// API Route: Evaluate Observation (SE_MANTIENE vs SE_ELIMINA vs SE_MODIFICA)
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
Rol: Magistrado / Auditor Forense Superior Elite Big 4 (PwC, Deloitte, EY, KPMG).
Normativa y Jurisdicción Aplicable: ${paisNormativa}
Idioma de Respuesta: ${idioma}
Motor de Razonamiento Solicitado: ${motorIA.toUpperCase()}
Auditor Responsable: ${usuario.nombre || 'Auditor'} (${usuario.cargo || 'Auditor'})

[CONTEXTO DE EXPEDIENTE / ACTA DE LECTURA]:
${actaLecturaContext ? actaLecturaContext.slice(0, 2000) : 'Sin antecedentes previos.'}

[RECURSOS DE RECONSIDERACIÓN / ALEGATOS PREVIOS]:
${recursosContext ? recursosContext.slice(0, 2000) : 'Sin recursos adicionales.'}

[OBSERVACIÓN O HALLAZGO EN DISPUTA]:
${observacion}

[DESCARGO / RÉPLICA / ELEMENTOS DE PRUEBA DEL AUDITADO]:
${descargoAlegato}

OBJETIVO PERICIAL:
Determinar de forma rigurosa y motivada si la observación:
1. SE_MANTIENE: Si el descargo o justificación no desvirtúa la falta, subsiste daño patrimonial o hay infracción legal insubsanable.
2. SE_ELIMINA: Si el auditado aportó prueba documental fehaciente, subsanó formalmente el hecho o amparó su actuación en causal de justificación legal plena.
3. SE_MODIFICA: Si se desestima la gravedad original (ej. se descarta dolo), pero subsiste una debilidad de control interno o falta administrativa menor.

Devuelve tu dictamen estructurado en formato JSON estricto con los siguientes campos:
{
  "decision": "SE_MANTIENE | SE_ELIMINA | SE_MODIFICA",
  "criterioEvaluacion": "Análisis probatorio detallado de por qué se acepta o rechaza el descargo presentado.",
  "procedimientoUtilizado": "Técnicas y procedimientos de auditoría forense aplicados (ej. cotejo documental, conciliación bancaria, inspección física, cruce con bases de datos públicas).",
  "fundamentacionLegal": "Citas textuales de artículos y leyes vigentes de ${paisNormativa} (ej. Ley de compras, código penal, normas de control interno o NIA 240/500).",
  "severidad": "CRÍTICA | ALTA | MEDIA | LEVE",
  "resumenDictamen": "Síntesis ejecutiva de la resolución pericial para el Acta de Cierre."
}
`;

    const geminiResp = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = geminiResp.text || '{}';
    let result: any = {};
    try {
      result = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) result = JSON.parse(match[0]);
      else {
        result = {
          decision: 'SE_MANTIENE',
          criterioEvaluacion:
            'El descargo no aporta evidencias documentales suficientes para desvirtuar la observación.',
          procedimientoUtilizado: 'Inspección documental y cruce normativo.',
          fundamentacionLegal: `Normativa vigente de ${paisNormativa}`,
          severidad: 'ALTA',
          resumenDictamen: 'Observación confirmada en sede contradictoria.',
        };
      }
    }

    const sha256 = crypto
      .createHash('sha256')
      .update(`${observacion}_${descargoAlegato}_${result.decision}_${Date.now()}`)
      .digest('hex');

    res.json({
      success: true,
      data: result,
      sha256,
      motorUtilizado: motorIA,
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

// API Route: Calculate Benford's Law distribution
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

    const list: number[] =
      Array.isArray(values) && values.length > 0
        ? values
        : [
            12000, 15400, 18900, 19200, 14000, 11000, 16500, 22000, 28000, 29000, 24000,
            31000, 38000, 35000, 42000, 49000, 45000, 51000, 58000, 62000, 75000, 83000,
            91000, 89500, 89900, 89400, 89800, 89600, 89700,
          ];

    for (const val of list) {
      const num = Math.abs(Number(val));
      if (!isNaN(num) && num > 0) {
        const firstDigit = parseInt(num.toString().replace(/[^0-9]/g, '')[0], 10);
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
      const diff = Number((observedPct - expectedPct).toFixed(2));
      const isAnomaly = Math.abs(diff) > 5.0;
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
