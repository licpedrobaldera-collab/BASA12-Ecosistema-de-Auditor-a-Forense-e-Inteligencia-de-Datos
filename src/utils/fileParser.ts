import { ContractEvidenceRow, EvidenceFile } from '../types/forensic';
import { calculateSHA256 } from './crypto';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function parseNumericValue(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Smart column mapper: converts arbitrary Excel/CSV/JSON rows into ContractEvidenceRow[]
 */
export function mapRowsToContracts(
  rows: Record<string, any>[],
  defaultOrigin: string = 'Documento Digital Importado',
  adendaThresholdPct: number = 50
): ContractEvidenceRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const mapped: ContractEvidenceRow[] = [];

  rows.forEach((row, idx) => {
    const entries = Object.entries(row);
    const findVal = (patterns: RegExp[]) => {
      for (const p of patterns) {
        const hit = entries.find(([k]) => p.test(k.toLowerCase()));
        if (hit && hit[1] !== '' && hit[1] !== undefined && hit[1] !== null) return hit[1];
      }
      return undefined;
    };

    const contratoId = String(
      findVal([/contrato/, /contract/, /codigo/, /expediente/, /orden/, /id/, /nro/, /numero/, /factura/]) ||
        `DOC-${String(idx + 1).padStart(3, '0')}`
    );
    const proveedor = String(
      findVal([/proveedor/, /suplidor/, /contratista/, /empresa/, /razon/, /beneficiario/, /vendor/, /nombre/]) ||
        'Registro Importado'
    );
    const rnc = String(findVal([/rnc/, /nif/, /tax/, /rfc/, /nit/, /cedula/, /identificacion/]) || 'N/D');

    let montoOriginal = parseNumericValue(
      findVal([/monto_?original/, /monto_?base/, /original/, /adjudicado/, /monto/, /valor/, /importe/, /total/, /amount/])
    );
    let montoAdenda = parseNumericValue(
      findVal([/monto_?adenda/, /adenda/, /modificacion/, /incremento/, /variacion/, /adicional/])
    );

    // If only one numeric amount column exists, infer from any second numeric column or set adenda=0
    if (montoOriginal === 0) {
      const numericCols = entries
        .map(([, v]) => parseNumericValue(v))
        .filter((n) => n > 100);
      if (numericCols.length >= 1) montoOriginal = numericCols[0];
      if (numericCols.length >= 2 && montoAdenda === 0) montoAdenda = numericCols[1];
    }

    const explicitPct = parseNumericValue(findVal([/pct/, /porcentaje/, /%/]));
    const adendaPct =
      explicitPct > 0
        ? explicitPct
        : montoOriginal > 0
        ? Number(((montoAdenda / montoOriginal) * 100).toFixed(2))
        : 0;

    const fechaContrato = String(findVal([/fecha_?contrato/, /fecha_?inicio/, /fecha/, /date/]) || new Date().toISOString().split('T')[0]);
    const fechaAdenda = String(findVal([/fecha_?adenda/, /fecha_?mod/]) || fechaContrato);
    const objeto = String(
      findVal([/objeto/, /descripcion/, /concepto/, /detalle/, /description/, /servicio/]) ||
        `Registro extraído de hoja tabular (${contratoId})`
    );
    const origen = String(findVal([/origen/, /fuente/, /departamento/, /entidad/]) || defaultOrigin);

    const esAnomalo = adendaPct > adendaThresholdPct;
    const motivoAlerta = esAnomalo
      ? `Variación detectada (+${adendaPct.toFixed(1)}%) supera umbral del ${adendaThresholdPct}%`
      : 'Dentro de parámetros ordinarios';

    if (montoOriginal > 0 || montoAdenda > 0 || proveedor !== 'Registro Importado') {
      mapped.push({
        id: `IMP-${Date.now()}-${idx}`,
        contratoId,
        proveedor,
        rnc,
        montoOriginal,
        montoAdenda,
        adendaPct,
        fechaContrato,
        fechaAdenda,
        origen,
        objeto,
        esAnomalo,
        motivoAlerta,
      });
    }
  });

  return mapped;
}

export interface ParsedDigitalResult {
  evidenceFile: EvidenceFile;
  detectedContracts: ContractEvidenceRow[];
}

export async function parseDigitalFile(
  file: File,
  defaultOrigin: string = 'Archivo Digital',
  adendaThresholdPct: number = 50
): Promise<ParsedDigitalResult> {
  const buffer = await file.arrayBuffer();
  const sha256 = await calculateSHA256(buffer);
  const base64Data = arrayBufferToBase64(buffer);

  try {
    const response = await fetch('/api/forensic/parse-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64Data,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error en lectura de documento');
    }

    const detectedContracts = mapRowsToContracts(
      data.extractedRows || [],
      defaultOrigin,
      adendaThresholdPct
    );

    const evidenceFile: EvidenceFile = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      sha256: data.sha256 || sha256,
      uploadDate: new Date().toISOString(),
      contentSnippet: data.contentSnippet || `Archivo ${file.name} procesado (${data.parsedFormat})`,
      extractedText: data.extractedText || '',
      extractedRows: data.extractedRows || [],
      numericAmounts: data.numericAmounts || [],
      parsedFormat: data.parsedFormat || 'DIGITAL',
      sheetNames: data.sheetNames || [],
      pageCount: data.pageCount,
      recordCount: detectedContracts.length > 0 ? detectedContracts.length : data.extractedRows?.length || 0,
    };

    return { evidenceFile, detectedContracts };
  } catch (err) {
    // Graceful local fallback for plain text formats
    let fallbackText = '';
    try {
      fallbackText = new TextDecoder('utf-8', { fatal: false }).decode(buffer).slice(0, 30000);
    } catch {
      fallbackText = `Archivo digital ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    }

    return {
      evidenceFile: {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        sha256,
        uploadDate: new Date().toISOString(),
        contentSnippet: fallbackText.slice(0, 600),
        extractedText: fallbackText,
        parsedFormat: file.name.split('.').pop()?.toUpperCase() || 'DIGITAL',
      },
      detectedContracts: [],
    };
  }
}
