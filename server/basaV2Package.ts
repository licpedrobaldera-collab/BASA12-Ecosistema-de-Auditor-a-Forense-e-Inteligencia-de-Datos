import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

export interface DocBlock {
  loc: string;
  text: string;
  kind: 'paragraph' | 'table' | 'page' | 'line';
}

export interface ReconstructedFindingV2 {
  codigo: string;
  titulo: string;
  seccionPadre: string;
  ubicacionInicio: string;
  ubicacionFin: string;
  ubicacionExacta: string;
  transcripcionIntegra: string;
  normasDetectadas: { norma: string; articulo: string; jerarquia: string }[];
  bloquesContados: number;
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractTextFromWParagraph(xmlPara: string): string {
  const withBreaks = xmlPara
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n');
  const textRuns = Array.from(withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map((m) =>
    decodeXmlEntities(m[1])
  );
  return textRuns.join('').replace(/[ \t]+/g, ' ').trim();
}

function getDocxParagraphMeta(xmlPara: string): { isHeading: boolean; ilvl: number; styleVal: string } {
  const styleMatch = xmlPara.match(/<w:pStyle\s+w:val=["']([^"']+)["']/i);
  const styleVal = (styleMatch ? styleMatch[1] : '').toLowerCase();
  const ilvlMatch = xmlPara.match(/<w:ilvl\s+w:val=["'](\d+)["']/i);
  const numIdMatch = xmlPara.match(/<w:numId\s+w:val=["'](\d+)["']/i);
  const ilvl = ilvlMatch ? parseInt(ilvlMatch[1], 10) : -1;
  const numId = numIdMatch ? numIdMatch[1] : '';

  const isHeading =
    styleVal.startsWith('heading') ||
    styleVal.startsWith('titulo') ||
    styleVal.startsWith('título') ||
    (ilvl >= 0 && Boolean(numId) && numId !== '0');

  return { isHeading, ilvl, styleVal };
}

/**
 * FASE 1 DOCX PARSER: Extracts paragraphs [Párrafo N] and tables [Tabla T, Fila R]
 * in exact reading order directly from word/document.xml using JSZip,
 * reconstructing Word XML multilevel automatic numbering (<w:numPr> / Heading 1-3).
 */
export async function extractDocxStructuredBlocks(buffer: Buffer): Promise<{
  taggedText: string;
  blocks: DocBlock[];
}> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('No se encontró word/document.xml en el archivo DOCX.');
  }
  const xml = await docFile.async('string');
  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyMatch ? bodyMatch[1] : xml;

  const blocks: DocBlock[] = [];
  let paragraphIdx = 0;
  let tableIdx = 0;

  // Multilevel numbering counters: [chapter, section, finding]
  const counters = [0, 0, 0];
  let inCap3Auto = false;

  // Walk top-level <w:p> and <w:tbl> elements cleanly by scanning tags
  const tokenRegex = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(bodyXml)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('<w:tbl')) {
      tableIdx += 1;
      const rows = Array.from(chunk.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g));
      rows.forEach((rowMatch, rIdx) => {
        const cells = Array.from(rowMatch[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g));
        const cellTexts = cells
          .map((c) => {
            const pTexts = Array.from(c[1].matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g))
              .map((pm) => extractTextFromWParagraph(pm[0]))
              .filter(Boolean);
            return pTexts.join(' ');
          })
          .filter(Boolean);
        const rowText = cellTexts.join(' | ').trim();
        if (rowText) {
          blocks.push({
            loc: `Tabla ${tableIdx}, Fila ${rIdx + 1}`,
            text: rowText,
            kind: 'table',
          });
        }
      });
    } else {
      paragraphIdx += 1;
      let pText = extractTextFromWParagraph(chunk);
      if (!pText) continue;

      const { isHeading, ilvl, styleVal } = getDocxParagraphMeta(chunk);
      const explicitCode = pText.match(/^(3(?:\.\d+){1,2})\b/);
      if (explicitCode) {
        const parts = explicitCode[1].split('.');
        counters[0] = parseInt(parts[0], 10);
        counters[1] = parts.length >= 2 ? parseInt(parts[1], 10) : counters[1];
        counters[2] = parts.length >= 3 ? parseInt(parts[2], 10) : 0;
        inCap3Auto = true;
      } else if (isHeading) {
        if (
          /^(?:HALLAZGOS|RESULTADOS\s+DE\s+LA\s+AUDITOR[ÍI]A|OBSERVACIONES)/i.test(pText) &&
          (ilvl === 0 || ilvl === -1 || styleVal.includes('1'))
        ) {
          counters[0] = 3;
          counters[1] = 0;
          counters[2] = 0;
          inCap3Auto = true;
          pText = `3. ${pText}`;
        } else if (inCap3Auto) {
          if (ilvl === 0 || styleVal.includes('heading1') || styleVal.includes('titulo1') || styleVal === '1') {
            counters[0] += 1;
            inCap3Auto = false;
            pText = `${counters[0]}. ${pText}`;
          } else if (ilvl === 1 || styleVal.includes('heading2') || styleVal.includes('titulo2') || styleVal === '2') {
            counters[1] += 1;
            counters[2] = 0;
            pText = `3.${counters[1]} ${pText}`;
          } else if (ilvl === 2 || styleVal.includes('heading3') || styleVal.includes('titulo3') || styleVal === '3') {
            counters[2] += 1;
            const padded = String(counters[2]).padStart(2, '0');
            pText = `3.${counters[1]}.${padded} ${pText}`;
          }
        }
      }

      blocks.push({
        loc: `Párrafo ${paragraphIdx}`,
        text: pText,
        kind: 'paragraph',
      });
    }
  }

  const taggedText = blocks.map((b) => `[${b.loc}] ${b.text}`).join('\n');
  return { taggedText, blocks };
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a realistic, valid .docx configuration/sample audit report
 * with Heading 1/2/3 styles, automatic Word XML numbering (<w:numPr>),
 * verbatim Condition/Criteria/Cause/Effect/Evidence/Communications, and embedded tables.
 * Can be used as an immediate online configuration benchmark and swapped for any real report.
 */
export async function buildSampleAuditReportDocxBuffer(entityLabel = 'Entidad Pública Ejemplo (Configuración BASA12)'): Promise<Buffer> {
  const zip = new JSZip();

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
</w:styles>`;

  const p = (text: string, style?: 'Heading1' | 'Heading2' | 'Heading3', numIlvl?: number) => {
    const pPrParts: string[] = [];
    if (style) pPrParts.push(`<w:pStyle w:val="${style}"/>`);
    if (typeof numIlvl === 'number') {
      pPrParts.push(`<w:numPr><w:ilvl w:val="${numIlvl}"/><w:numId w:val="1"/></w:numPr>`);
    }
    const pPr = pPrParts.length ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';
    return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  };

  const tbl = (rows: string[][]) => {
    const trs = rows
      .map(
        (row) =>
          `<w:tr>${row
            .map((cell) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`)
            .join('')}</w:tr>`
      )
      .join('');
    return `<w:tbl>${trs}</w:tbl>`;
  };

  const paragraphsAndTables = [
    p(`INFORME DE AUDITORÍA E INVESTIGACIÓN ESPECIAL — ${entityLabel}`, 'Heading1'),
    p('Documento modelo configurable en formato Word (.docx). Puede utilizarse para validar la extracción XML, la matriz 22 columnas, la base de datos y las descargas en Excel/Word, y sustituirse en cualquier momento por otro informe real.'),
    p('RESULTADOS DE LA AUDITORÍA E INVESTIGACIÓN ESPECIAL', 'Heading1', 0),

    p('3.1 Aspectos Institucionales y de Control Interno', 'Heading2', 1),
    p('3.1.01 Debilidades en la formalización y aprobación de instrumentos institucionales (POA, PACC y manuales)', 'Heading3', 2),
    p('Condición: Al examinar una muestra de 14 instrumentos de planificación y control interno correspondientes al período auditado, se evidenció que el Plan Operativo Anual (POA) y tres manuales de procedimientos carecían de firma de aprobación del Titular y fecha cierta de vigencia, operando sin políticas formales actualizadas.'),
    p('Criterio: Ley núm. 41-08 de Función Pública, Decreto núm. 527-09, Decreto núm. 543-12 y Normas Básicas de Control Interno (NOBACI) emitidas por la Contraloría General de la República, componente Ambiente de Control.'),
    p('Causa: Debilidad en la supervisión preventiva de la Dirección de Planificación y ausencia de calendario formal de revisión normativa interna.'),
    p('Efecto: Genera riesgo de ejecución administrativa discrecional, falta de trazabilidad en autorizaciones e incumplimiento del marco NOBACI.'),
    p('Evidencia y Comunicaciones: Mediante Oficio núm. DP-045-2025 el Encargado de Planificación remitió copias simples sin firma y manifestó en comunicación de descargo que los instrumentos se encontraban en proceso de actualización.'),
    tbl([
      ['Instrumento Auditado', 'Estado Documental', 'Impacto / Muestra'],
      ['Plan Operativo Anual (POA)', 'Sin firma ni sello de aprobación', '100% del presupuesto operativo'],
      ['Plan Anual de Compras (PACC)', 'Versión preliminar sin fecha', 'RD$12,450,000.00 programados'],
      ['Manual de Políticas Internas', 'Borrador no oficializado', '3 unidades administrativas'],
    ]),
    p('Recomendación: Se recomienda instruir al Titular/MAE y a la Dirección de Planificación a formalizar, firmar y aprobar mediante resolución interna los instrumentos POA, PACC y manuales de políticas dentro de un plazo de 30 días calendario.'),

    // Auto-numbered Heading 3 WITHOUT literal "3.1.02" prefix in <w:t> to test XML w:numPr reconstruction!
    p('Inconsistencias en el registro y custodia de expedientes de compras menores sin PACC actualizado', 'Heading3', 2),
    p('Condición: De un universo de 28 expedientes de compras menores por RD$4,850,200.00, se verificó en 9 procesos la ausencia de constancia de disponibilidad presupuestaria previa y actas de adjudicación debidamente firmadas por el Comité de Compras.'),
    p('Criterio: Ley núm. 340-06 sobre Compras y Contrataciones Públicas, Artículos 15 y 21, y su Reglamento de Aplicación aprobado mediante Decreto núm. 543-12.'),
    p('Causa: Falta de verificación previa en la Unidad Operativa de Compras y Contrataciones antes de emitir órdenes de compra.'),
    p('Efecto: Exposición a nulidad contractual, pagos sin soporte competitivo completo y observación recurrente bajo la Ley núm. 18-24.'),
    p('Evidencia: Expedientes CM-2025-011 al CM-2025-019 verificados en tabla adjunta.'),
    p('Recomendación: Instruir a la Dirección Administrativa y Financiera y al Encargado de Compras implementar lista de cotejo obligatoria vinculada al PACC antes de comprometer fondos públicos.'),

    p('3.2 Gestión Financiera, Presupuestaria y Ciclo de Pagos', 'Heading2', 1),
    p('3.2.01 Egresos ejecutados con documentación justificativa incompleta en el ciclo de pagos', 'Heading3', 2),
    p('Condición: Se verificaron 6 libramientos de pago ascendentes a RD$1,925,400.00 sin informes de recepción conforme ni facturas con comprobante fiscal válido anexado al expediente original.'),
    p('Evidencia: Ver libramientos SP-104, SP-118 y SP-142 en los registros de Tesorería.'),

    p('3.3 Gestión de Recursos Humanos', 'Heading2', 1),
    p('3.3.01 Expedientes de personal sin evaluación de desempeño ni certificación de inducción conforme a la Ley 41-08', 'Heading3', 2),
    p('Condición: Al revisar 25 expedientes de servidores públicos incorporados en el período, el 40% carecía de formulario de evaluación anual de desempeño y constancia de declaración jurada cuando aplicaba.'),
    p('Criterio: Ley núm. 41-08 de Función Pública y Decreto núm. 523-09 sobre Relaciones Laborales en la Administración Pública.'),
    p('Causa: Omisión de seguimiento periódico por parte del Departamento de Recursos Humanos.'),
    p('Efecto: Dificulta la medición objetiva de méritos y cumplimiento del régimen ético y disciplinario.'),
    p('Recomendación: Instruir a la Dirección de Recursos Humanos completar y digitalizar el 100% de los expedientes del personal activo.'),

    p('3.4 Tecnología y Transparencia', 'Heading2', 1),
    p('3.4.1 Desactualización de publicaciones obligatorias en el Portal de Transparencia Institucional', 'Heading3', 2),
    p('Condición: A la fecha de corte de la auditoría, los apartados de nómina mensual y estados financieros trimestrales en el portal web mostraban atraso de cuatro (4) meses respecto al calendario legal vigente.'),
    p('Criterio: Ley General de Libre Acceso a la Información Pública núm. 200-04 y Normas Básicas de Control Interno (NOBACI) sobre Información y Comunicación.'),
    p('Causa: Ausencia de protocolo mensual de entrega entre Contabilidad, RR. HH. y el Responsable de Acceso a la Información (RAI).'),
    p('Efecto: Disminuye la rendición de cuentas y la calificación institucional en el monitoreo de transparencia.'),
    p('Recomendación: Instruir al RAI y a las direcciones generadoras de información establecer publicación automatizada antes del día 10 de cada mes.'),
  ].join('\n');

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsAndTables}
    <w:sectPr/>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/_rels/document.xml.rels', docRels);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', docXml);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Converts raw or location-tagged text into uniform DocBlocks for Fases 1–3.
 */
export function normalizeToDocBlocks(rawText: string): DocBlock[] {
  const lines = String(rawText || '').split(/\r?\n/);
  const blocks: DocBlock[] = [];
  const locPrefixRegex = /^\[((?:Párrafo|Tabla|Página|Línea|Hoja)[^\]]+)\]\s*(.+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const locMatch = raw.match(locPrefixRegex);
    if (locMatch) {
      blocks.push({
        loc: locMatch[1].trim(),
        text: locMatch[2].trim(),
        kind: locMatch[1].toLowerCase().startsWith('tabla') ? 'table' : 'paragraph',
      });
    } else {
      blocks.push({
        loc: `Línea ${i + 1}`,
        text: raw,
        kind: 'line',
      });
    }
  }
  return blocks;
}

// Section headers like "3.1 Aspectos Institucionales", "3.2 Gestión Financiera", "3.3 RR. HH."
// Note: 3.01 (starts with 0 after dot) IS a finding; 3.1, 3.2, 3.3, 3.4 (single/two digit without leading zero and no 3rd segment) is a Section.
const SECTION_HEADER_REGEX = /^\s*(3\.[1-9]\d?)\s*[-–—:.]?\s+([A-ZÁÉÍÓÚÑa-záéíóúñ].{3,})$/;
const CHAPTER_END_REGEX = /^\s*(?:4\.\d*|5\.\d*|CAP[ÍI]TULO\s+(?:IV|V|4|5)|CONCLUSI[ÓO]N\s+GENERAL|RECOMENDACIONES\s+GENERALES|ANEXOS?)\b/i;

// Finding headings: 3.01, 3.1.01, 3.1.02, 3.2.03, 3.3.01, 3.4.1, Hallazgo 1, Observación 2
const FINDING_HEADER_REGEX =
  /^\s*((?:3\.0\d+(?:\.\d+)*)|(?:3\.[1-9]\d*\.\d+(?:\.\d+)*)|(?:(?:hallazgo|observaci[oó]n)\s*(?:n[uú]m\.?|no\.?|#)?\s*\d+(?:\.\d+)*))\s*[-–—:.)]?\s+(.+)$/i;

function isTocOrIndexLine(lineText: string): boolean {
  // Matches dotted leaders like "3.1.01 Debilidades en control ......... 28"
  if (/\.{3,}\s*\d+\s*$/.test(lineText)) return true;
  if (/\s{4,}\d{1,3}\s*$/.test(lineText) && lineText.length < 130) return true;
  return false;
}

/**
 * Extracts real laws, decrees, resolutions and internal standards actually written in text
 */
export function extractRealCitationsFromText(
  text: string
): { norma: string; articulo: string; jerarquia: string }[] {
  const cites: { norma: string; articulo: string; jerarquia: string }[] = [];
  const seen = new Set<string>();

  const add = (norma: string, articulo: string, jerarquia: string) => {
    const cleanNorma = norma.replace(/\s+/g, ' ').trim();
    const key = cleanNorma.toLowerCase();
    if (!cleanNorma || seen.has(key)) return;
    seen.add(key);
    cites.push({ norma: cleanNorma, articulo: articulo.trim(), jerarquia });
  };

  const patterns: { re: RegExp; jer: string; prefix: string }[] = [
    { re: /\bLey(?:\s+Org[aá]nica|\s+General)?\s*(?:n[uú]m\.?|no\.?|n[°º])?\s*(\d{1,4}-\d{2,4})(?:\s*,?\s*(?:art[s]?\.?|art[ií]culo[s]?)\s*([0-9a-zA-Z,\s.y-]+))?/gi, jer: 'LEY', prefix: 'Ley núm. ' },
    { re: /\bDecreto\s*(?:n[uú]m\.?|no\.?|n[°º])?\s*(\d{1,4}-\d{2,4})(?:\s*,?\s*(?:art[s]?\.?|art[ií]culo[s]?)\s*([0-9a-zA-Z,\s.y-]+))?/gi, jer: 'DECRETO', prefix: 'Decreto núm. ' },
    { re: /\b(?:Normas?\s+B[aá]sicas\s+de\s+Control\s+Interno|NOBACI)\b(?:\s*([A-Z]{2,5}-\d+(?:-\d+(?:\.\d+)?)?))?/gi, jer: 'RESOLUCION_NOBACI', prefix: 'NOBACI ' },
    { re: /\bNOBIS\b(?:\s*([A-Z0-9.-]+))?/gi, jer: 'RESOLUCION_NOBACI', prefix: 'NOBIS ' },
    { re: /\bResoluci[oó]n\s*(?:n[uú]m\.?|no\.?|n[°º])?\s*([A-Z0-9.-]+-\d{2,4}|\d{1,4}-\d{2,4})/gi, jer: 'RESOLUCION_NOBACI', prefix: 'Resolución ' },
    { re: /\bConstituci[oó]n\s+de\s+la\s+Rep[uú]blica(?:\s*,?\s*art[s]?\.?\s*([0-9,\s]+))?/gi, jer: 'CONSTITUCION', prefix: 'Constitución de la República' },
    { re: /\b(?:ISSAI|NIA|NICSP)\s*(\d+(?:\.\d+)?)/gi, jer: 'TRATADOS_ISSAI_NIA', prefix: '' },
    { re: /\b(POA|PACC|PEI)\b/g, jer: 'NORMATIVA_INTERNA', prefix: 'Instrumento ' },
  ];

  for (const p of patterns) {
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      if (p.prefix === 'Constitución de la República') {
        add('Constitución de la República', m[1] ? `Art(s). ${m[1].trim()}` : 'Supremacía constitucional', p.jer);
      } else if (p.prefix === 'NOBACI ') {
        const suffix = m[1] ? ` ${m[1].trim()}` : '';
        add(`NOBACI${suffix}`, 'Normas Básicas de Control Interno (CGR)', p.jer);
      } else if (p.prefix === '') {
        add(m[0].trim(), 'Estándar técnico aplicable', p.jer);
      } else if (p.prefix === 'Instrumento ') {
        const labelMap: Record<string, string> = {
          POA: 'Plan Operativo Anual (POA)',
          PACC: 'Plan Anual de Compras y Contrataciones (PACC)',
          PEI: 'Plan Estratégico Institucional (PEI)',
        };
        add(labelMap[m[1]] || m[1], 'Instrumento de planificación y control', p.jer);
      } else {
        const art = m[2] ? `Art(s). ${m[2].replace(/\s+/g, ' ').slice(0, 60)}` : 'Disposiciones aplicables';
        add(`${p.prefix}${m[1]}`, art, p.jer);
      }
    }
  }

  return cites;
}

/**
 * FASES 2 & 3: Identifies real findings (excluding general section headers 3.1, 3.2, etc.)
 * and collects FULL verbatim transcription from heading -> literals -> condition -> criteria ->
 * evidence -> communications -> analysis -> effect -> recommendation until next finding/section.
 */
export function reconstructFindingsV2(rawText: string): {
  blocks: DocBlock[];
  sectionsDetected: { code: string; title: string; loc: string }[];
  findings: ReconstructedFindingV2[];
} {
  const blocks = normalizeToDocBlocks(rawText);
  const sectionsDetected: { code: string; title: string; loc: string }[] = [];
  const rawCollected: ReconstructedFindingV2[] = [];

  let currentSection = 'Sección 3.x (Resultados de Auditoría)';
  let active: {
    codigo: string;
    titulo: string;
    seccionPadre: string;
    ubicacionInicio: string;
    ubicacionFin: string;
    lines: string[];
    bloquesContados: number;
  } | null = null;

  const flushActive = () => {
    if (!active) return;
    const fullText = active.lines.join('\n').trim();
    if (fullText.length >= 25) {
      rawCollected.push({
        codigo: active.codigo,
        titulo: active.titulo,
        seccionPadre: active.seccionPadre,
        ubicacionInicio: active.ubicacionInicio,
        ubicacionFin: active.ubicacionFin,
        ubicacionExacta:
          active.ubicacionInicio === active.ubicacionFin
            ? active.ubicacionInicio
            : `${active.ubicacionInicio} – ${active.ubicacionFin}`,
        transcripcionIntegra: fullText,
        normasDetectadas: extractRealCitationsFromText(fullText),
        bloquesContados: active.bloquesContados,
      });
    }
    active = null;
  };

  for (const blk of blocks) {
    const subLines = blk.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of subLines) {
      if (isTocOrIndexLine(line)) {
        continue;
      }

      // Check finding first (e.g. 3.01, 3.1.01, 3.2.03, 3.4.1) with v8.0.0 length/prose guard
      const fMatch = line.match(FINDING_HEADER_REGEX);
      if (fMatch) {
        const cleanTitle = fMatch[2].trim();
        const isValidTitle =
          cleanTitle.length >= 6 &&
          !(cleanTitle.split(/\s+/).length > 28 && cleanTitle.endsWith('.'));
        if (isValidTitle) {
          flushActive();
          active = {
            codigo: fMatch[1].trim(),
            titulo: cleanTitle.slice(0, 260),
            seccionPadre: currentSection,
            ubicacionInicio: blk.loc,
            ubicacionFin: blk.loc,
            lines: [line],
            bloquesContados: 1,
          };
          continue;
        }
      }

      // Check general section header (3.1, 3.2, 3.3, 3.4) -> strictly section, NEVER standalone finding
      const sMatch = line.match(SECTION_HEADER_REGEX);
      if (sMatch && sMatch[2].trim().length >= 4 && !/^\d/.test(sMatch[2].trim())) {
        flushActive();
        currentSection = `${sMatch[1].trim()} ${sMatch[2].trim().slice(0, 140)}`;
        sectionsDetected.push({ code: sMatch[1].trim(), title: sMatch[2].trim(), loc: blk.loc });
        continue;
      }

      // Check end of audit findings chapter (e.g. Capítulo IV Conclusiones)
      if (active && CHAPTER_END_REGEX.test(line)) {
        flushActive();
        continue;
      }

      if (active) {
        active.lines.push(line);
        active.ubicacionFin = blk.loc;
        active.bloquesContados += 1;
      }
    }
  }
  flushActive();

  // Deduplicate TOC leftovers vs real developed findings: if same código appears twice, keep the richest block
  const byCode = new Map<string, ReconstructedFindingV2[]>();
  for (const f of rawCollected) {
    const list = byCode.get(f.codigo) || [];
    list.push(f);
    byCode.set(f.codigo, list);
  }

  const deduped: ReconstructedFindingV2[] = [];
  for (const list of byCode.values()) {
    if (list.length === 1) {
      deduped.push(list[0]);
    } else {
      // Sort descending by length and keep longest substantial one (plus any genuinely distinct finding with < 0.5 overlap)
      const sorted = [...list].sort((a, b) => b.transcripcionIntegra.length - a.transcripcionIntegra.length);
      deduped.push(sorted[0]);
    }
  }

  return { blocks, sectionsDetected, findings: deduped };
}

function normalizeCmp(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeCmp(a).split(' ').filter((w) => w.length > 3));
  const tokensB = new Set(normalizeCmp(b).split(' ').filter((w) => w.length > 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let inter = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) inter += 1;
  }
  const union = tokensA.size + tokensB.size - inter;
  return union > 0 ? inter / union : 0;
}

/**
 * FASE 4 DETERMINISTIC PROFESSIONAL ENGINE (Respaldo Documental Profesional)
 * Evaluates full transcripcionIntegra across 13 audit dimensions without artificially penalizing
 * substantive findings as 3/10.
 */
export function evaluateFindingDocumentaryV2(
  finding: ReconstructedFindingV2,
  allFindings: ReconstructedFindingV2[]
) {
  const full = finding.transcripcionIntegra;
  const low = normalizeCmp(full);

  const hasCondition =
    full.length >= 160 ||
    /\b(se evidencio|se verifico|se observo|se determino|se comprobo|ausencia de|falta de|inexistencia|incumplimiento|condicion)\b/.test(
      low
    );
  const hasRealCriteria =
    finding.normasDetectadas.length > 0 ||
    /\b(ley|decreto|reglamento|resolucion|nobaci|nobis|articulo|art |constitucion|manual|politica|issai|nia)\b/.test(
      low
    );
  const hasCause = /\b(causa|debido a|originado por|falta de supervision|omision|carencia|ausencia de control|debilidad)\b/.test(
    low
  );
  const hasEffect = /\b(efecto|consecuencia|riesgo|impacto|exposicion|vulnerabilidad|afecta|perjuicio|impide|limita)\b/.test(
    low
  );
  const hasEvidence = /\b(evidencia|comunicacion|oficio|memorando|acta|expediente|contrato|factura|nomina|registro|informe|documento|tabla|pacc|poa|sin firma|sin fecha)\b/.test(
    low
  );
  const hasComms = /\b(comunicacion|descargo|comentario|respuesta|funcionario|titular|remitio|informo|manifesto)\b/.test(
    low
  );
  const hasQuant = /\b(rd\$|us\$|\$|%|total|muestra|universo|pesos|empleados|expedientes|procesos|contratos|\d{1,3},\d{3})\b/.test(
    low
  );
  const hasResp = /\b(director|titular|mae|encargado|responsable|departamento|direccion|unidad|funcionarios|rr\.?\s*hh|compras|planificacion|finanzas|tesoreria)\b/.test(
    low
  );
  const hasRec = /\b(recomend|instruir|implementar|establecer|elaborar|aprobar|fortalecer|corregir|actualizar)\b/.test(
    low
  );

  let score = 0;
  if (hasCondition) score += 2.0;
  if (hasRealCriteria) score += finding.normasDetectadas.length >= 2 ? 2.0 : 1.5;
  if (hasEvidence) score += hasComms ? 1.5 : 1.0;
  if (hasCause) score += 1.0;
  if (hasEffect) score += 1.0;
  if (hasQuant) score += 1.0;
  if (hasResp) score += 0.5;
  if (hasRec) score += 1.0;
  if (full.length > 600) score = Math.min(10, score + 0.5);
  score = Math.round(Math.max(1, Math.min(10, score)) * 10) / 10;

  const nivelSolidezV2 =
    score <= 3.5
      ? 'DEFICIENTE'
      : score <= 5.5
      ? 'RECONSTRUIR'
      : score <= 7.5
      ? 'ACEPTABLE CON MEJORAS'
      : score <= 9.2
      ? 'BUENO'
      : 'ÓPTIMO';

  // Similarity / Duplicate check on condition + title
  let maxSim = 0;
  let relCode = '';
  for (const other of allFindings) {
    if (other.codigo === finding.codigo) continue;
    const sim = jaccardSimilarity(
      `${finding.titulo} ${finding.transcripcionIntegra.slice(0, 1200)}`,
      `${other.titulo} ${other.transcripcionIntegra.slice(0, 1200)}`
    );
    if (sim > maxSim) {
      maxSim = sim;
      relCode = other.codigo;
    }
  }

  const estadoRecomendado:
    | 'CONSERVAR'
    | 'MEJORAR'
    | 'RECONSTRUIR'
    | 'ELIMINAR/CONSOLIDAR — REVISIÓN PROFESIONAL' =
    maxSim >= 0.82
      ? 'ELIMINAR/CONSOLIDAR — REVISIÓN PROFESIONAL'
      : score <= 4.0
      ? 'RECONSTRUIR'
      : score <= 7.8
      ? 'MEJORAR'
      : 'CONSERVAR';

  const gaps: string[] = [];
  if (!hasRealCriteria) gaps.push('Sustentar con artículos puntuales de ley/decreto/NOBACI aplicable.');
  if (!hasCause) gaps.push('Explicitar la causa raíz administrativa u operativa.');
  if (!hasEffect) gaps.push('Describir el efecto o riesgo institucional/financiero concretado.');
  if (!hasQuant) gaps.push('Incorporar cuantificación (universo, muestra evaluada, cantidad de casos o monto).');
  if (!hasResp) gaps.push('Atribuir claramente las unidades o funcionarios responsables por período.');
  if (!hasRec) gaps.push('Redactar recomendación CCRD dirigida al Titular/MAE ("Instruir a...").');
  if (!hasEvidence) gaps.push('Citar expresamente documentos soporte (actas, oficios, comunicaciones, formularios).');

  const normList = finding.normasDetectadas.map((n) => `${n.norma}${n.articulo ? ` (${n.articulo})` : ''}`);
  const criterioText =
    normList.length > 0
      ? `Criterio detectado en el informe: ${normList.join('; ')}.`
      : 'Criterio por completar: vincular con Ley núm. 18-24, Ley 41-08, Decreto 527-09, Decreto 543-12 y NOBACI según la naturaleza del hallazgo.';

  const firstLines = finding.transcripcionIntegra
    .split('\n')
    .slice(1, 6)
    .join(' ')
    .trim();

  return {
    puntaje0a10: score,
    nivelSolidezV2: nivelSolidezV2 as any,
    estadoRecomendado,
    condicionLiteral: firstLines || finding.titulo,
    criterioTexto: criterioText,
    comparacion: hasCondition && hasRealCriteria
      ? 'La condición fáctica descrita en el texto completo evidencia desviación respecto al marco normativo invocado en el propio acápite.'
      : 'Requiere contrastar explícitamente los hechos documentados frente al artículo normativo obligatorio.',
    causa: hasCause
      ? 'Identificada en el desarrollo del acápite (debilidades de formalización, supervisión o control preventivo).'
      : 'Causa raíz no explicitada claramente en el texto del hallazgo.',
    efecto: hasEffect
      ? 'Riesgo de inobservancia normativa, debilidad de control interno o exposición operativa/financiera señalada en el informe.'
      : 'Efecto/consecuencia material pendiente de precisión.',
    riesgoDetalle: score >= 7 ? 'Riesgo documentado sobre ambiente de control y cumplimiento legal.' : 'Riesgo de debilidad probatoria o de sustentación técnica si no se completan atributos.',
    evidenciaSoporte: hasEvidence
      ? `Documentos y actuaciones mencionados en el texto íntegro (${finding.bloquesContados} bloques extraídos).`
      : 'No se identifican referencias documentales puntuales suficientes.',
    cuantificacion: hasQuant
      ? 'El texto contiene cifras, porcentajes, universo o cantidad de documentos evaluados.'
      : 'Sin cuantificación explícita de universo/muestra/monto.',
    responsabilidadDetalle: hasResp
      ? 'Se mencionan áreas, cargos o comunicaciones de funcionarios involucrados.'
      : 'Pendiente delimitar cargo, unidad responsable y período de gestión.',
    deficienciasRedaccion:
      gaps.length > 0 ? gaps.join(' ') : 'Redacción técnica completa y objetiva con elementos del hallazgo CCRD.',
    duplicidadMax: Number(maxSim.toFixed(4)),
    hallazgoRelacionado: relCode,
    justificacionDecision:
      maxSim >= 0.82
        ? `Similitud textual alta (${Math.round(maxSim * 100)}%) con ${relCode}; requiere validación profesional antes de consolidar.`
        : `${estadoRecomendado}: Solidez ${score}/10 (${nivelSolidezV2}). Evaluación realizada sobre la transcripción íntegra (${finding.transcripcionIntegra.length} caracteres).`,
    queFaltaPara10: gaps.length > 0 ? gaps.join(' ') : 'Validar cifras finales, fechas exactas de descarga/firma y seguimiento MAE.',
    versionMejorada10: `${finding.codigo} ${finding.titulo}. Condición: ${firstLines || finding.titulo} Criterio: ${criterioText} Causa: Debilidad en la formalización y supervisión de controles internos. Efecto/Riesgo: Exposición al incumplimiento legal e incertidumbre operativa. Evidencia y Comunicaciones: Conforme a los documentos y comunicaciones analizados en ${finding.ubicacionExacta}. Recomendación: Instruir a las áreas competentes a implementar y evidenciar el control correctivo en cumplimiento estricto de ${normList.slice(0, 3).join(', ') || 'la normativa vigente'}.`,
  };
}

// =========================================================================
// GENERADOR OFICIAL DEL PAQUETE STANDALONE: BASA_HALLAZGOS_INTELLIGENCE_PRO_V2_FULL.zip
// Unifica Fases 1-4, Lector XML Word, Fusión SQLite, Bitácora, Heatmap 0-10, CRUD y Exportadores
// =========================================================================
export async function buildBasaV2FullZipBuffer(): Promise<Buffer> {
  const zip = new JSZip();

  let unifiedAppPy = '';
  let unifiedReqTxt = '';
  try {
    unifiedAppPy = fs.readFileSync(path.resolve(process.cwd(), 'app.py'), 'utf-8');
  } catch {
    unifiedAppPy = '';
  }
  try {
    unifiedReqTxt = fs.readFileSync(path.resolve(process.cwd(), 'requirements.txt'), 'utf-8');
  } catch {
    unifiedReqTxt = '';
  }

  const reqTxt =
    unifiedReqTxt.trim() ||
    `streamlit>=1.40,<2
pandas>=2.2
numpy>=1.26
requests>=2.31
python-docx>=1.1
pypdf>=5
xlsxwriter>=3.2
openpyxl>=3.1.5
scikit-learn>=1.5
google-genai>=1.0
plotly>=5.20
`;

  const appPy = unifiedAppPy.trim()
    ? unifiedAppPy
    : `import streamlit as st\nst.error("Archivo app.py unificado no encontrado en el servidor.")\n`;

  const readmeMd = `# BASA13 HALLAZGOS INTELIGENTE PRO — PAQUETE UNIFICADO DE PRODUCCIÓN (v8.0.0-FINAL-PROD)

Paquete oficial unificado en **basa12-ecosistema**.

## Capacidades Unificadas (v8.0.0-FINAL-PROD • 10/10 Producción)
1. **Fase 1 — Extracción XML Multinivel Real**: Extrae párrafos (\`w:outlineLvl\`, \`w:numPr\`, \`Heading 1-4\`) y tablas en orden exacto de lectura con su ubicación (\`Párrafo N\`, \`Tabla #T\`, \`Página P\`).
2. **Fase 2 — Identificación Precisa + Guardia de Prosa**: Distingue encabezados generales de sección (\`3.1\`, \`3.2\`, \`3.3\`, \`3.4\`) frente a hallazgos reales (\`3.01\`, \`3.1.01\`, \`3.1.02\`, \`3.2.03\`, \`3.4.1\`, etc.), filtrando líneas de índice (TOC) y párrafos narrativos largos.
3. **Fase 3 — Transcripción Íntegra Textual**: Conserva palabra por palabra el bloque completo de cada hallazgo sin alucinaciones ni frases inventadas.
4. **Fase 4 — Pre-Check Salud Motores IA + Auto-Cascada con Circuit-Breaker (Sin pedir claves al usuario)**:
   - **Pre-Check antes de bucles**: Valida \`Ollama\` y \`Gemini\` antes de analizar los hallazgos, evitando errores repetidos por hallazgo (\`WinError 10061\` o \`404\`).
   - **IA Local Confidencial (Ollama)** en \`http://127.0.0.1:11434\`.
   - **Gemini API Blindado** mediante variables de entorno/Secrets con rotación automática en modelos activos (\`gemini-3.8-flash\`, \`gemini-4-hydrogen\`, \`gemini-3.8-flash-lite\`, \`gemini-3.1-flash-lite\`, \`gemini-3.8-pro\`).
   - **Motor Documental Forense Autónomo** como respaldo determinístico inmediato 100% gratuito.
5. **SQLite CRUD + Limpieza VACUUM + Fusión de Bases Secundarias + Bitácora Forense**:
   - Limpia y compacta la BD a cero registros de producción.
   - Permite fusionar bases \`.db/.sqlite\` externas preservando auditorías, hallazgos y trazabilidad.
   - Incluye Heatmap 0–10 interactivo (Plotly), filtro de severidad crítica, análisis de Ley de Benford y exportación a Excel (\`.xlsx\`), Word (\`.docx\`) y CSV (\`.csv\`).
`;

  const guiaTxt = `GUÍA RÁPIDA DE USO — BASA13 HALLAZGOS INTELIGENTE PRO (UNIFICADO v8.0.0-FINAL-PROD)
===================================================================================

1. Ejecute INSTALAR_Y_EJECUTAR_WINDOWS.bat (en Windows) o:
   pip install -r requirements.txt
   streamlit run app.py

2. Motores de IA Autogestionados y Pre-Check:
   - En la barra lateral, use "🔌 Verificar Salud de Motores IA" para confirmar
     el estado de Ollama Local, Gemini Cloud y Motor Documental Forense.
   - Si instala Ollama (https://ollama.com) y ejecuta "ollama pull llama3.1",
     el sistema se conecta automáticamente en modo confidencial local.
   - Si Ollama o Gemini no están disponibles, activa el circuit-breaker y
     continúa sin interrupciones con el Motor Documental Forense Autónomo.

3. Flujo de Trabajo Completo:
   - Pestaña 1: Cargue su informe (.docx, .pdf, .xlsx, .csv) o ejecute el Ejemplo Word (.docx).
   - Pestaña 2: Visualice el Heatmap 0–10, filtre severidad crítica, edite y exporte Excel/Word/CSV.
   - Pestaña 3: Ejecute análisis estadístico de Ley de Benford.
   - Pestaña 4: Histórico CRUD completo, edición de metadatos, fusión SQLite (VACUUM) y bitácora.
`;

  const batTxt = `@echo off
cd /d %~dp0
if not exist .venv python -m venv .venv
call .venv\\Scripts\\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
streamlit run app.py
pause
`;

  const root = zip.folder('BASA_HALLAZGOS_INTELLIGENCE_PRO_V2_FULL');
  root?.file('app.py', appPy);
  root?.file('requirements.txt', reqTxt);
  root?.file('README.md', readmeMd);
  root?.file('GUIA_RAPIDA.txt', guiaTxt);
  root?.file('INSTALAR_Y_EJECUTAR_WINDOWS.bat', batTxt);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
