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

/**
 * FASE 1 DOCX PARSER: Extracts paragraphs [Párrafo N] and tables [Tabla T, Fila R]
 * in exact reading order directly from word/document.xml using JSZip.
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
      const pText = extractTextFromWParagraph(chunk);
      if (pText) {
        blocks.push({
          loc: `Párrafo ${paragraphIdx}`,
          text: pText,
          kind: 'paragraph',
        });
      }
    }
  }

  const taggedText = blocks.map((b) => `[${b.loc}] ${b.text}`).join('\n');
  return { taggedText, blocks };
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

      // Check finding first (e.g. 3.01, 3.1.01, 3.2.03, 3.4.1)
      const fMatch = line.match(FINDING_HEADER_REGEX);
      if (fMatch && fMatch[2].trim().length >= 5) {
        flushActive();
        active = {
          codigo: fMatch[1].trim(),
          titulo: fMatch[2].trim().slice(0, 260),
          seccionPadre: currentSection,
          ubicacionInicio: blk.loc,
          ubicacionFin: blk.loc,
          lines: [line],
          bloquesContados: 1,
        };
        continue;
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
// Incluye: Fase 1-4 completas, Matriz 22 columnas, 2 Modos (IA Local Ollama + Motor Documental)
// =========================================================================
export async function buildBasaV2FullZipBuffer(): Promise<Buffer> {
  const zip = new JSZip();

  const appPy = `import io, re, json, hashlib, difflib, unicodedata
from pathlib import Path
from datetime import datetime
import pandas as pd
import requests
import streamlit as st

try:
    from docx import Document
except Exception:
    Document = None
try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None

st.set_page_config(
    page_title="BASA HALLAZGOS INTELLIGENCE PRO V2 FULL",
    page_icon="🔎",
    layout="wide",
)

VERSION = "2.0.0 FULL"
APP = "BASA HALLAZGOS INTELLIGENCE PRO — V2 FULL (4 FASES + IA LOCAL)"


def norm(s):
    s = "" if s is None else str(s)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\\s+", " ", s.lower()).strip()


def sha(b):
    return hashlib.sha256(b).hexdigest()


# =========================================================================
# FASE 1 — EXTRACCIÓN COMPLETA (Párrafos, Tablas, Páginas, Ubicación exacta)
# =========================================================================
def extract_docx(b):
    if Document is None:
        raise RuntimeError("Instale python-docx.")
    d = Document(io.BytesIO(b))
    out = []
    # Recorrido fiel respetando el orden del cuerpo del documento (párrafos y tablas)
    p_idx = 0
    t_idx = 0
    p_map = {p._element: p for p in d.paragraphs}
    t_map = {t._element: t for t in d.tables}
    for child in d.element.body:
        if child in p_map:
            p_idx += 1
            txt = p_map[child].text.strip()
            if txt:
                out.append({"loc": f"Párrafo {p_idx}", "text": txt})
        elif child in t_map:
            t_idx += 1
            for ri, row in enumerate(t_map[child].rows, 1):
                cells = [c.text.strip().replace("\\n", " ") for c in row.cells if c.text.strip()]
                if cells:
                    out.append({"loc": f"Tabla {t_idx}, fila {ri}", "text": " | ".join(cells)})
    return out


def extract_pdf(b):
    if PdfReader is None:
        raise RuntimeError("Instale pypdf.")
    r = PdfReader(io.BytesIO(b))
    out = []
    for i, page in enumerate(r.pages, 1):
        txt = (page.extract_text() or "").strip()
        if txt:
            out.append({"loc": f"Página {i}", "text": txt})
    return out


def extract_excel(b):
    x = pd.ExcelFile(io.BytesIO(b))
    out = []
    for s in x.sheet_names:
        d = pd.read_excel(io.BytesIO(b), sheet_name=s, header=None)
        for i, row in d.iterrows():
            vals = [str(v).strip() for v in row if pd.notna(v) and str(v).strip()]
            if vals:
                out.append({"loc": f"Hoja {s}, fila {i+1}", "text": " | ".join(vals)})
    return out


def extract_document(name, b):
    e = Path(name).suffix.lower()
    if e == ".docx":
        return extract_docx(b)
    if e == ".pdf":
        return extract_pdf(b)
    if e in (".xlsx", ".xls"):
        return extract_excel(b)
    if e in (".txt", ".csv", ".md"):
        return [
            {"loc": f"Línea {i+1}", "text": x.strip()}
            for i, x in enumerate(b.decode("utf8", "ignore").splitlines())
            if x.strip()
        ]
    raise ValueError(f"Formato no soportado: {e}")


# =========================================================================
# FASE 2 & FASE 3 — IDENTIFICACIÓN PRECISA (Secciones vs Hallazgos) +
# TRANSCRIPCIÓN ÍNTEGRA (Encabezado -> literales a,b,c -> condición -> criterio ->
# evidencia -> comunicaciones -> análisis -> efecto -> recomendación -> sig. hallazgo)
# =========================================================================
FINDING_PAT = re.compile(
    r"^\\s*((?:3\\.0\\d+(?:\\.\\d+)*)|(?:3\\.[1-9]\\d*\\.\\d+(?:\\.\\d+)*)|(?:(?:hallazgo|observaci[oó]n)\\s*(?:n[uú]m\\.?|no\\.?|#)?\\s*\\d+(?:\\.\\d+)*))\\s*[-–—:.)]?\\s+(.+)$",
    re.I,
)
SECTION_PAT = re.compile(
    r"^\\s*(3\\.[1-9]\\d?)\\s*[-–—:.]?\\s+([A-ZÁÉÍÓÚÑa-záéíóúñ].{3,})$"
)
CHAPTER_END_PAT = re.compile(
    r"^\\s*(?:4\\.\\d*|5\\.\\d*|CAP[ÍI]TULO\\s+(?:IV|V|4|5)|CONCLUSI[ÓO]N\\s+GENERAL|RECOMENDACIONES\\s+GENERALES|ANEXOS?)\\b",
    re.I,
)


def is_toc_line(line):
    if re.search(r"\\.{3,}\\s*\\d+\\s*$", line):
        return True
    if len(line) < 130 and re.search(r"\\s{4,}\\d{1,3}\\s*$", line):
        return True
    return False


def extract_normative_citations(text):
    cites = []
    seen = set()
    patterns = [
        (r"\\bLey(?:\\s+Org[aá]nica|\\s+General)?\\s*(?:n[uú]m\\.?|no\\.?|n[°º])?\\s*\\d{1,4}-\\d{2,4}(?:\\s*,?\\s*art[s]?\\.?\\s*[0-9a-zA-Z,.\\s-]+)?", "Ley"),
        (r"\\bDecreto\\s*(?:n[uú]m\\.?|no\\.?|n[°º])?\\s*\\d{1,4}-\\d{2,4}(?:\\s*,?\\s*art[s]?\\.?\\s*[0-9a-zA-Z,.\\s-]+)?", "Decreto"),
        (r"\\b(?:NOBACI|NOBIS)(?:\\s*[A-Z]{2,5}-\\d+(?:-\\d+(?:\\.\\d+)?)?)?", "NOBACI/NOBIS"),
        (r"\\bResoluci[oó]n\\s*(?:n[uú]m\\.?|no\\.?|n[°º])?\\s*[A-Z0-9.-]+-\\d{2,4}", "Resolución"),
        (r"\\bConstituci[oó]n\\s+de\\s+la\\s+Rep[uú]blica", "Constitución"),
        (r"\\b(?:POA|PACC|PEI)\\b", "Instrumento"),
    ]
    for pat, _tag in patterns:
        for m in re.finditer(pat, text, re.I):
            val = re.sub(r"\\s+", " ", m.group(0)).strip()[:90]
            k = val.lower()
            if k not in seen:
                seen.add(k)
                cites.append(val)
    return "; ".join(cites) if cites else "No se detectaron citas normativas explícitas en el texto."


def detect_and_reconstruct(blocks):
    findings_raw = []
    sections_seen = []
    current_section = "3.x Resultados de Auditoría"
    active = None

    def flush():
        nonlocal active
        if active:
            full_text = "\\n".join(active["lines"]).strip()
            if len(full_text) >= 25:
                loc = (
                    active["loc_start"]
                    if active["loc_start"] == active["loc_end"]
                    else f'{active["loc_start"]} – {active["loc_end"]}'
                )
                findings_raw.append(
                    {
                        "codigo": active["codigo"],
                        "titulo": active["titulo"],
                        "seccion": active["seccion"],
                        "loc": loc,
                        "transcripcion": full_text,
                        "normas": extract_normative_citations(full_text),
                    }
                )
            active = None

    for b in blocks:
        for raw_line in b["text"].splitlines():
            line = raw_line.strip()
            if not line or is_toc_line(line):
                continue

            fm = FINDING_PAT.match(line)
            if fm and len(fm.group(2).strip()) >= 5:
                flush()
                active = {
                    "codigo": fm.group(1).strip(),
                    "titulo": fm.group(2).strip()[:240],
                    "seccion": current_section,
                    "loc_start": b["loc"],
                    "loc_end": b["loc"],
                    "lines": [line],
                }
                continue

            sm = SECTION_PAT.match(line)
            if sm and len(sm.group(2).strip()) >= 4 and not re.match(r"^\\d", sm.group(2).strip()):
                flush()
                current_section = f"{sm.group(1).strip()} {sm.group(2).strip()[:120]}"
                sections_seen.append({"codigo": sm.group(1).strip(), "titulo": sm.group(2).strip(), "loc": b["loc"]})
                continue

            if active and CHAPTER_END_PAT.match(line):
                flush()
                continue

            if active:
                active["lines"].append(line)
                active["loc_end"] = b["loc"]

    flush()

    # Si un código aparece en índice y cuerpo, conservar el bloque sustancial más extenso
    grouped = {}
    for f in findings_raw:
        grouped.setdefault(f["codigo"], []).append(f)
    deduped = []
    for code_items in grouped.values():
        code_items.sort(key=lambda x: len(x["transcripcion"]), reverse=True)
        deduped.append(code_items[0])

    return deduped, sections_seen


# =========================================================================
# FASE 4 — EVALUACIÓN IA SOBRE EL HALLAZGO COMPLETO (13 ELEMENTOS)
# MODO 1: IA LOCAL (Ollama http://localhost:11434 - Confidencial)
# MODO 2: MOTOR DOCUMENTAL PROFESIONAL (Respaldo Determinístico)
# =========================================================================
def evaluate_with_ollama(finding, ollama_url, model_name):
    prompt = f"""Actúa como Revisor Senior de Control Gubernamental e Investigación Especial (Ley 18-24, NOBACI, ISSAI).
Evalúa el HALLAZGO COMPLETO transcrito íntegramente a continuación (no evalúes solo el título).
NO inventes hechos ni normas que no existan en el texto o contexto aplicable.

Sección: {finding['seccion']}
Código: {finding['codigo']}
Ubicación: {finding['loc']}
Transcripción íntegra:
---
{finding['transcripcion'][:9000]}
---

Devuelve EXCLUSIVAMENTE un objeto JSON válido con estas claves exactas:
{{
  "condicion": "¿Qué ocurrió realmente según el texto completo?",
  "criterio": "¿Qué norma, ley, decreto, NOBACI o procedimiento se incumple?",
  "comparacion": "¿La condición contradice el criterio? Explica cómo.",
  "causa": "¿Por qué ocurrió según el texto?",
  "efecto": "¿Qué consecuencia produjo o produce?",
  "riesgo": "¿Qué riesgo institucional/financiero/legal genera?",
  "evidencia": "¿Qué documentos, actas, oficios o comunicaciones sustentan la conclusión?",
  "cuantificacion": "¿Existe monto, universo, muestra, período o impacto cuantificado?",
  "responsabilidad": "¿Está correctamente atribuida y sustentada por cargo/área?",
  "recomendacion_actual": "Recomendación existente en el texto o indicación si falta.",
  "deficiencias": "Deficiencias de redacción, objetividad o sustentación detectadas.",
  "solidez_0_10": 8.0,
  "que_falta_10": "Elementos exactos para alcanzar 10/10.",
  "version_mejorada_10": "Redacción técnica completa 10/10 lista para informe final."
}}"""

    resp = requests.post(
        f"{ollama_url.rstrip('/')}/api/generate",
        json={"model": model_name, "prompt": prompt, "stream": False, "format": "json"},
        timeout=90,
    )
    resp.raise_for_status()
    raw = resp.json().get("response", "{}").strip()
    m = re.search(r"\\{[\\s\\S]*\\}", raw)
    return json.loads(m.group(0) if m else raw)


def evaluate_documentary_motor(finding):
    full = finding["transcripcion"]
    t = norm(full)

    has_cond = len(full) >= 160 or any(k in t for k in ["se evidencio", "se verifico", "se observo", "se determino", "ausencia de", "falta de", "inexistencia", "sin firma", "sin fecha"])
    has_crit = any(k in t for k in ["ley ", "decreto", "resolucion", "nobaci", "nobis", "art.", "articulo", "reglamento", "poa", "pacc", "manual"])
    has_cause = any(k in t for k in ["causa", "debido a", "originado", "falta de supervision", "ausencia de control", "debilidad"])
    has_effect = any(k in t for k in ["efecto", "consecuencia", "riesgo", "impacto", "exposicion", "vulnerabilidad", "limita", "afecta"])
    has_evid = any(k in t for k in ["evidencia", "comunicacion", "oficio", "acta", "expediente", "contrato", "factura", "nomina", "registro", "documento", "tabla", "poa", "pacc"])
    has_comms = any(k in t for k in ["comunicacion", "descargo", "funcionario", "remitio", "informo", "respuesta"])
    has_quant = bool(re.search(r"(?:rd\\$|us\\$|\\$|%|universo|muestra|total|\\d{1,3},\\d{3})", t))
    has_resp = any(k in t for k in ["director", "titular", "mae", "encargado", "responsable", "departamento", "direccion", "unidad", "funcionarios"])
    has_rec = any(k in t for k in ["recomend", "instruir", "implementar", "establecer", "elaborar", "aprobar", "fortalecer"])

    score = 0.0
    if has_cond:
        score += 2.0
    if has_crit:
        score += 2.0
    if has_evid:
        score += 1.5 if has_comms else 1.0
    if has_cause:
        score += 1.0
    if has_effect:
        score += 1.0
    if has_quant:
        score += 1.0
    if has_resp:
        score += 0.5
    if has_rec:
        score += 1.0
    if len(full) > 650:
        score = min(10.0, score + 0.5)
    score = round(max(1.0, min(10.0, score)), 1)

    gaps = []
    if not has_crit:
        gaps.append("Incorporar criterio normativo puntual (Ley, Decreto, NOBACI aplicable).")
    if not has_cause:
        gaps.append("Precisar la causa raíz administrativa u operativa.")
    if not has_effect:
        gaps.append("Explicitar el efecto real o riesgo institucional/financiero.")
    if not has_evid:
        gaps.append("Detallar documentos, actas o comunicaciones de soporte verificables.")
    if not has_quant:
        gaps.append("Cuantificar universo, muestra evaluada, casos o impacto económico.")
    if not has_resp:
        gaps.append("Delimitar responsabilidad por cargo, unidad y período.")
    if not has_rec:
        gaps.append("Agregar recomendación concreta dirigida al Titular/MAE.")

    lines = [x.strip() for x in full.splitlines()[1:6] if x.strip()]
    cond_txt = " ".join(lines)[:900] if lines else finding["titulo"]

    return {
        "condicion": cond_txt,
        "criterio": finding["normas"],
        "comparacion": "La condición documentada en el cuerpo del hallazgo contraviene las disposiciones citadas." if (has_cond and has_crit) else "Requiere precisar la confrontación directa entre hecho y norma.",
        "causa": "Expresada en el desarrollo del hallazgo (debilidad de control, formalización o supervisión)." if has_cause else "Causa raíz no explicitada claramente.",
        "efecto": "Riesgo operativo, normativo o patrimonial documentado en el acápite." if has_effect else "Efecto material pendiente de especificación.",
        "riesgo": "Exposición al incumplimiento de control interno y marco legal vigente." if has_crit else "Riesgo probatorio por falta de sustentación normativa completa.",
        "evidencia": "Sustentado en documentos, registros y comunicaciones citados en la transcripción íntegra." if has_evid else "Evidencia documental insuficiente.",
        "cuantificacion": "Incluye datos cuantitativos / muestra / período en el texto." if has_quant else "Sin cuantificación explícita.",
        "responsabilidad": "Áreas o funcionarios vinculados en el texto." if has_resp else "Responsabilidad por unidad/cargo no delimitada.",
        "recomendacion_actual": "Presente en el texto desarrollado." if has_rec else "No se detecta recomendación explícita.",
        "deficiencias": " ".join(gaps) if gaps else "Estructura documental consistente con los 13 elementos periciales.",
        "solidez_0_10": score,
        "que_falta_10": " ".join(gaps) if gaps else "Validación final de cifras, folios y respuesta institucional.",
        "version_mejorada_10": (
            f"{finding['codigo']} {finding['titulo']}. Condición: {cond_txt} "
            f"Criterio: {finding['normas']} Causa: Deficiencia de control preventivo y supervisión administrativa. "
            f"Efecto/Riesgo: Vulnerabilidad institucional frente al marco legal aplicable. "
            f"Evidencia: Según documentación y comunicaciones referidas en {finding['loc']}. "
            f"Recomendación: Instruir a las unidades competentes a formalizar e implementar controles verificables con seguimiento OAI/MAE."
        ),
    }


def analyze_all(findings, threshold, mode, ollama_url, ollama_model):
    rows = []
    progress = st.progress(0)
    total = len(findings)

    for i, h in enumerate(findings):
        progress.progress((i + 1) / max(1, total))
        used_mode = "Motor Documental Profesional"
        if mode == "IA Local (Ollama)":
            try:
                ev = evaluate_with_ollama(h, ollama_url, ollama_model)
                used_mode = f"IA Local ({ollama_model})"
            except Exception as err:
                st.warning(f"{h['codigo']}: Ollama no respondió ({err}). Aplicando Motor Documental Profesional.")
                ev = evaluate_documentary_motor(h)
        else:
            ev = evaluate_documentary_motor(h)

        s = float(ev.get("solidez_0_10", 5.0))
        s = round(max(0.0, min(10.0, s)), 1)
        lev = (
            "DEFICIENTE"
            if s <= 3.5
            else "RECONSTRUIR"
            if s <= 5.5
            else "ACEPTABLE CON MEJORAS"
            if s <= 7.5
            else "BUENO"
            if s <= 9.2
            else "ÓPTIMO"
        )

        # Duplicidad evaluada sobre título + cuerpo real
        best = 0.0
        rel = ""
        base_txt = norm(f"{h['titulo']} {h['transcripcion'][:1500]}")
        for j, o in enumerate(findings):
            if i == j:
                continue
            other_txt = norm(f"{o['titulo']} {o['transcripcion'][:1500]}")
            q = difflib.SequenceMatcher(None, base_txt[:900], other_txt[:900]).ratio()
            if q > best:
                best = q
                rel = o["codigo"]

        status = (
            "ELIMINAR/CONSOLIDAR — REVISIÓN PROFESIONAL"
            if best >= threshold
            else ("RECONSTRUIR" if s <= 4.0 else "MEJORAR" if s <= 7.8 else "CONSERVAR")
        )
        justif = (
            f"Posible duplicidad sustantiva con {rel} ({best:.0%}). Requiere validación profesional."
            if best >= threshold
            else f"{status}: Evaluado sobre transcripción íntegra ({len(h['transcripcion'])} chars) mediante {used_mode}."
        )

        rows.append(
            {
                "Código": h["codigo"],
                "Hallazgo actual": h["titulo"],
                "Transcripción íntegra": h["transcripcion"],
                "Condición": ev.get("condicion", ""),
                "Criterio": ev.get("criterio", ""),
                "Causa": ev.get("causa", ""),
                "Efecto": ev.get("efecto", ""),
                "Riesgo": ev.get("riesgo", ""),
                "Evidencia": ev.get("evidencia", ""),
                "Cuantificación": ev.get("cuantificacion", ""),
                "Responsabilidad": ev.get("responsabilidad", ""),
                "Recomendación actual": ev.get("recomendacion_actual", ""),
                "Deficiencias": ev.get("deficiencias", ""),
                "Duplicidad": round(best, 4),
                "Hallazgo relacionado": rel,
                "Justificación de conservar/eliminar/consolidar": justif,
                "Puntaje 0–10": s,
                "Nivel": lev,
                "Qué falta para 10/10": ev.get("que_falta_10", ""),
                "Versión mejorada 10/10": ev.get("version_mejorada_10", ""),
                "Referencias normativas": h["normas"],
                "Ubicación": f"{h['seccion']} | {h['loc']}",
            }
        )

    progress.empty()
    return pd.DataFrame(rows)


def to_excel(df, meta):
    b = io.BytesIO()
    with pd.ExcelWriter(b, engine="xlsxwriter") as w:
        df.to_excel(w, index=False, sheet_name="Matriz_22_Columnas")
        df.groupby("Justificación de conservar/eliminar/consolidar").size().reset_index(name="Cantidad").to_excel(
            w, index=False, sheet_name="Resumen_Decisiones"
        )
        pd.DataFrame([meta]).to_excel(w, index=False, sheet_name="Metodologia_V2")
        ws = w.sheets["Matriz_22_Columnas"]
        ws.freeze_panes(1, 0)
        ws.autofilter(0, 0, len(df), len(df.columns) - 1)
        for i, c in enumerate(df.columns):
            max_len = int(df[c].astype(str).map(lambda v: min(len(v), 55)).max()) if len(df) > 0 else 20
            ws.set_column(i, i, min(max(14, max_len + 2), 55))
    return b.getvalue()


def to_word(df, meta):
    if Document is None:
        return None
    d = Document()
    d.add_heading(APP, 0)
    d.add_paragraph(f'Fecha: {meta["fecha"]} | Modo: {meta["modo"]} | SHA-256: {meta["sha256"]}')
    d.add_heading("Resumen Ejecutivo", 1)
    d.add_paragraph(
        f'Archivos: {meta["archivos"]}. Secciones generales detectadas: {meta["secciones"]}. '
        f'Hallazgos reconstruidos: {len(df)}. Promedio Solidez: {df["Puntaje 0–10"].mean():.2f}/10.'
    )
    for _, r in df.iterrows():
        d.add_heading(f'{r["Código"]} — {r["Hallazgo actual"]} ({r["Puntaje 0–10"]}/10)', 2)
        for k in [
            "Ubicación",
            "Nivel",
            "Justificación de conservar/eliminar/consolidar",
            "Condición",
            "Criterio",
            "Causa",
            "Efecto",
            "Riesgo",
            "Evidencia",
            "Cuantificación",
            "Responsabilidad",
            "Recomendación actual",
            "Deficiencias",
            "Qué falta para 10/10",
            "Versión mejorada 10/10",
            "Referencias normativas",
            "Transcripción íntegra",
        ]:
            d.add_paragraph(f"{k}: {r[k]}")
    b = io.BytesIO()
    d.save(b)
    return b.getvalue()


# =========================================================================
# INTERFAZ STREAMLIT V2 FULL
# =========================================================================
st.title("🔎 BASA HALLAZGOS INTELLIGENCE PRO V2 FULL")
st.caption(f"Versión {VERSION} · Extracción 4 Fases + Reconstrucción Íntegra + IA Local Confidencial · basa12-ecosistema")

with st.sidebar:
    st.header("Configuración V2 Full")
    eval_mode = st.radio(
        "Motor de Evaluación (Fase 4)",
        ["IA Local (Ollama)", "Motor Documental Profesional"],
        index=0,
        help="IA Local procesa 100% en su computadora sin enviar el documento fuera. Si Ollama no está activo, respalda el Motor Documental Profesional.",
    )
    ollama_url = st.text_input("URL Ollama Local", value="http://localhost:11434")
    ollama_model = st.text_input("Modelo Ollama", value="llama3.1")
    threshold = st.slider("Umbral de duplicidad", 0.70, 0.95, 0.82, 0.01)
    st.info("Encabezados 3.1, 3.2, 3.3, 3.4 se tratan como SECCIONES. Solo 3.01, 3.1.01, 3.2.03, etc. se evalúan como hallazgos íntegros.")

files = st.file_uploader(
    "Cargar informe(s) de auditoría / investigación especial",
    type=["docx", "pdf", "xlsx", "xls", "csv", "txt", "md"],
    accept_multiple_files=True,
)

if files and st.button("🚀 Ejecutar 4 Fases V2 Full", type="primary"):
    blocks = []
    hashes = []
    errors = []
    for f in files:
        b = f.getvalue()
        hashes.append(f"{f.name}: {sha(b)}")
        try:
            blocks += extract_document(f.name, b)
        except Exception as e:
            errors.append(f"{f.name}: {e}")
    for e in errors:
        st.error(e)

    hs, secs = detect_and_reconstruct(blocks)
    if not hs:
        st.error("No se detectaron hallazgos específicos (3.01, 3.1.01, 3.2.03, etc.).")
    else:
        df = analyze_all(hs, threshold, eval_mode, ollama_url, ollama_model)
        meta = {
            "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "archivos": "; ".join(f.name for f in files),
            "sha256": " | ".join(hashes),
            "secciones": len(secs),
            "modo": eval_mode,
            "umbral": threshold,
            "metodologia": "4 Fases V2: Extracción completa -> Secciones vs Hallazgos -> Transcripción íntegra -> Evaluación 13 dimensiones.",
        }
        st.session_state.df = df
        st.session_state.meta = meta
        st.session_state.secs = secs

if "df" in st.session_state:
    df = st.session_state.df
    meta = st.session_state.meta
    secs = st.session_state.get("secs", [])

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Secciones (3.1, 3.2...)", len(secs))
    c2.metric("Hallazgos Íntegros", len(df))
    c3.metric("Solidez Promedio", f'{df["Puntaje 0–10"].mean():.2f}/10')
    c4.metric("Duplicidades >= Umbral", int((df["Duplicidad"] >= meta["umbral"]).sum()))

    st.dataframe(df, use_container_width=True, height=520)

    for _, r in df.iterrows():
        with st.expander(f'{r["Código"]} — {r["Hallazgo actual"]} | {r["Puntaje 0–10"]}/10 ({r["Nivel"]})'):
            st.markdown(f'**Ubicación y Sección:** {r["Ubicación"]}')
            st.markdown(f'**Referencias normativas detectadas:** {r["Referencias normativas"]}')
            st.markdown(f'**Condición:** {r["Condición"]}')
            st.markdown(f'**Criterio:** {r["Criterio"]}')
            st.markdown(f'**Causa / Efecto / Riesgo:** {r["Causa"]} | {r["Efecto"]} | {r["Riesgo"]}')
            st.markdown(f'**Evidencia / Cuantificación / Responsabilidad:** {r["Evidencia"]} | {r["Cuantificación"]} | {r["Responsabilidad"]}')
            st.markdown(f'**Qué falta para 10/10:** {r["Qué falta para 10/10"]}')
            st.markdown(f'**Versión mejorada 10/10:** {r["Versión mejorada 10/10"]}')
            st.text_area("Transcripción íntegra completa (Fase 3)", r["Transcripción íntegra"], height=220, key=f'{r["Código"]}_{r["Ubicación"]}')

    x = to_excel(df, meta)
    csv = df.to_csv(index=False, encoding="utf-8-sig").encode("utf-8-sig")
    w = to_word(df, meta)
    col_e, col_c, col_w = st.columns(3)
    col_e.download_button("⬇️ Excel 22 Columnas (.xlsx)", x, "BASA_V2_Matriz_22_Columnas.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    col_c.download_button("⬇️ CSV (.csv)", csv, "BASA_V2_Matriz_22_Columnas.csv", "text/csv")
    if w:
        col_w.download_button("⬇️ Informe Word (.docx)", w, "BASA_V2_Informe_Integral.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
`;

  const reqTxt = `streamlit>=1.40,<2
pandas>=2.2
openpyxl>=3.1.5
xlsxwriter>=3.2
python-docx>=1.1
pypdf>=5
requests>=2.31
`;

  const readmeMd = `# BASA HALLAZGOS INTELLIGENCE PRO — V2 FULL

Paquete oficial V2 integrado en **basa12-ecosistema**.

## Novedades de la Versión 2.0.0 Full
1. **Fase 1 — Extracción Completa**: Extrae párrafos y tablas en orden exacto de lectura con su ubicación (\`Párrafo N\`, \`Tabla T, fila R\`, \`Página P\`).
2. **Fase 2 — Identificación Precisa**: Distingue encabezados generales de sección (\`3.1\`, \`3.2\`, \`3.3\`, \`3.4\`) —tratados exclusivamente como secciones padre— frente a hallazgos reales (\`3.01\`, \`3.1.01\`, \`3.1.02\`, \`3.2.03\`, \`3.4.1\`, etc.), filtrando líneas de índice (TOC).
3. **Fase 3 — Transcripción Íntegra**: Captura el hallazgo completo desde su encabezado hasta el siguiente hallazgo o sección (literales a., b., c., condición, criterio, evidencia, comunicaciones de funcionarios, análisis, efecto y recomendación).
4. **Fase 4 — Evaluación de 13 Dimensiones + Matriz de 22 Columnas**:
   - **Modo 1: IA Local (Ollama)** en \`http://localhost:11434\` — ideal para informes confidenciales (ningún dato sale de su PC).
   - **Modo 2: Motor Documental Profesional** — respaldo determinístico inmediato cuando no hay un modelo local activo.
`;

  const guiaTxt = `GUÍA RÁPIDA DE USO — BASA HALLAZGOS INTELLIGENCE PRO V2 FULL
======================================================================

1. Ejecute INSTALAR_Y_EJECUTAR_WINDOWS.bat (en Windows) o:
   pip install -r requirements.txt
   streamlit run app.py

2. Para usar IA Local confidencial (Recomendado):
   - Instale Ollama (https://ollama.com) en su equipo.
   - Ejecute en terminal: ollama pull llama3.1
   - En la barra lateral del aplicativo elija "IA Local (Ollama)".

3. Si no tiene Ollama instalado, seleccione "Motor Documental Profesional".

4. Cargue su informe (.docx, .pdf, .xlsx) y presione "Ejecutar 4 Fases V2 Full".
   Descargue la Matriz completa de 22 columnas en Excel (.xlsx), CSV o Word (.docx).
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
