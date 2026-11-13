import { ContractEvidenceRow, EvidenceFile, PaymentCycleRow } from '../types/forensic';
import { calculateSHA256, calculateStringSHA256 } from './crypto';

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

    if (montoOriginal === 0) {
      const numericCols = entries.map(([, v]) => parseNumericValue(v)).filter((n) => n > 100);
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

    const fechaContrato = String(findVal([/fecha_?contrato/, /fecha_?inicio/, /fecha/, /date/]) || '');
    const fechaAdenda = String(findVal([/fecha_?adenda/, /fecha_?mod/]) || fechaContrato);
    const objeto = String(
      findVal([/objeto/, /descripcion/, /concepto/, /detalle/, /description/, /servicio/]) ||
        `Registro extraído (${contratoId})`
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

export function mapRowsToPaymentCycle(rows: Record<string, any>[]): PaymentCycleRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const mapped: PaymentCycleRow[] = [];

  rows.forEach((row, idx) => {
    const entries = Object.entries(row);
    const findVal = (patterns: RegExp[]) => {
      for (const p of patterns) {
        const hit = entries.find(([k]) => p.test(k.toLowerCase()));
        if (hit && hit[1] !== '' && hit[1] !== undefined && hit[1] !== null) return hit[1];
      }
      return undefined;
    };

    const ordenNumero = String(findVal([/orden/, /solicitud/, /oc/, /requerimiento/]) || `OC-${idx + 1}`);
    const contratoId = String(findVal([/contrato/, /proceso/, /expediente/]) || '');
    const beneficiario = String(
      findVal([/beneficiario/, /proveedor/, /suplidor/, /contratista/, /empleado/, /nombre/]) || ''
    );
    const rnc = String(findVal([/rnc/, /cedula/, /nif/, /identificacion/]) || 'N/D');
    const numeroFacturaEcf = String(findVal([/ecf/, /ncf/, /factura/, /comprobante/]) || '');
    const numeroLibramientoPago = String(findVal([/libramiento/, /cheque/, /transferencia/, /pago_?id/, /pago/]) || '');
    const fechaSolicitud = String(findVal([/fecha_?solicitud/, /fecha_?oc/]) || '');
    const fechaFactura = String(findVal([/fecha_?factura/, /fecha_?ecf/, /fecha_?ncf/]) || '');
    const fechaRecepcion = String(findVal([/fecha_?recepcion/, /conduce/]) || '');
    const fechaPago = String(findVal([/fecha_?pago/, /fecha_?desembolso/, /fecha/]) || '');
    const bancoCuenta = String(findVal([/banco/, /cuenta/]) || '');

    const montoFacturado = parseNumericValue(findVal([/facturado/, /monto_?factura/, /bruto/, /monto/, /valor/, /importe/]));
    const retencionesImpuestos = parseNumericValue(findVal([/retencion/, /itbis/, /isr/, /impuesto/, /deduccion/]));
    const montoPagadoNeto =
      parseNumericValue(findVal([/pagado/, /neto/, /desembolso/])) || Math.max(0, montoFacturado - retencionesImpuestos);

    if (!beneficiario && montoFacturado === 0 && montoPagadoNeto === 0) return;

    const tieneRecepcionConduce = Boolean(fechaRecepcion || findVal([/recepcion/, /recibido/, /conduce/]));
    let estadoCiclo: PaymentCycleRow['estadoCiclo'] = 'COMPLETO';
    if (!tieneRecepcionConduce) estadoCiclo = 'SIN_RECEPCION';
    else if (!numeroFacturaEcf) estadoCiclo = 'SIN_COMPROBANTE';

    mapped.push({
      id: `PAY-IMP-${Date.now()}-${idx}`,
      ordenNumero,
      contratoId,
      beneficiario: beneficiario || `Beneficiario ${idx + 1}`,
      rnc,
      fechaSolicitud,
      numeroFacturaEcf,
      fechaFactura,
      tieneRecepcionConduce,
      fechaRecepcion,
      numeroLibramientoPago,
      fechaPago,
      bancoCuenta,
      montoFacturado,
      retencionesImpuestos,
      montoPagadoNeto,
      estadoCiclo,
      observacionPago: String(findVal([/observacion/, /nota/, /concepto/, /detalle/]) || ''),
    });
  });

  return mapped;
}

export interface ParsedDigitalResult {
  evidenceFile: EvidenceFile;
  detectedContracts: ContractEvidenceRow[];
  detectedPayments: PaymentCycleRow[];
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

    const rows = data.extractedRows || [];
    const detectedContracts = mapRowsToContracts(rows, defaultOrigin, adendaThresholdPct);
    const detectedPayments = mapRowsToPaymentCycle(rows);

    const evidenceFile: EvidenceFile = {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      sha256: data.sha256 || sha256,
      uploadDate: new Date().toISOString(),
      sourceType: 'ARCHIVO',
      contentSnippet: data.contentSnippet || `Archivo ${file.name} procesado (${data.parsedFormat})`,
      extractedText: data.extractedText || '',
      extractedRows: rows,
      numericAmounts: data.numericAmounts || [],
      parsedFormat: data.parsedFormat || 'DIGITAL',
      sheetNames: data.sheetNames || [],
      pageCount: data.pageCount,
      recordCount: detectedContracts.length > 0 ? detectedContracts.length : rows.length || 0,
      discoveredLinks: data.discoveredLinks || [],
    };

    return { evidenceFile, detectedContracts, detectedPayments };
  } catch {
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
        sourceType: 'ARCHIVO',
        contentSnippet: fallbackText.slice(0, 600),
        extractedText: fallbackText,
        parsedFormat: file.name.split('.').pop()?.toUpperCase() || 'DIGITAL',
      },
      detectedContracts: [],
      detectedPayments: [],
    };
  }
}

export async function fetchAndParseUrl(
  url: string,
  adendaThresholdPct: number = 50
): Promise<ParsedDigitalResult> {
  const response = await fetch('/api/forensic/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'No se pudo extraer contenido del enlace o portal.');
  }

  const rows = data.extractedRows || [];
  const detectedContracts = mapRowsToContracts(rows, `Portal: ${data.url}`, adendaThresholdPct);
  const detectedPayments = mapRowsToPaymentCycle(rows);

  const evidenceFile: EvidenceFile = {
    name: data.fileName || data.url,
    size: data.size || (data.extractedText || '').length,
    type: data.mimeType || 'text/html',
    sha256: data.sha256,
    uploadDate: new Date().toISOString(),
    sourceType: 'URL_PORTAL',
    sourceUrl: data.url,
    contentSnippet: data.contentSnippet || '',
    extractedText: data.extractedText || '',
    extractedRows: rows,
    numericAmounts: data.numericAmounts || [],
    parsedFormat: data.parsedFormat || 'PORTAL WEB',
    sheetNames: data.sheetNames || [],
    pageCount: data.pageCount,
    recordCount: rows.length,
    discoveredLinks: data.discoveredLinks || [],
  };

  return { evidenceFile, detectedContracts, detectedPayments };
}

export async function createEvidenceFromRawText(rawText: string, label: string = 'Texto Literal Ingresado'): Promise<EvidenceFile> {
  const sha256 = await calculateStringSHA256(rawText);
  const matches = rawText.match(/(?:RD\$|US\$|\$|€)?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g) || [];
  const numericAmounts: number[] = [];
  for (const m of matches) {
    const cleaned = m.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    const v = parseFloat(cleaned);
    if (!isNaN(v) && v >= 100 && v < 1e13) numericAmounts.push(v);
  }

  return {
    name: label,
    size: rawText.length,
    type: 'text/plain',
    sha256,
    uploadDate: new Date().toISOString(),
    sourceType: 'TEXTO_DIRECTO',
    parsedFormat: 'TEXTO LITERAL',
    extractedText: rawText,
    contentSnippet: rawText.slice(0, 800),
    numericAmounts: numericAmounts.slice(0, 1000),
  };
}
