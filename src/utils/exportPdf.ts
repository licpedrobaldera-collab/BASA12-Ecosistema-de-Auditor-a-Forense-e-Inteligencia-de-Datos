import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  AuditedEntity,
  AuditorProfile,
  AuditPeriodScope,
  CcrdStageStatus,
  DirectorResponsibility,
  DossierSectionItem,
  DuplicityFinding,
  ForensicAnalysisResult,
  HallazgoMatrizLiteral,
  LegalReferenceItem,
  ObservacionDecision,
  PaymentCycleRow,
} from '../types/forensic';
import { formatCurrency } from './entities';

export interface TechnicalPdfReportInput {
  nombreCaso: string;
  origenes: string[];
  requerimiento: string;
  selloDigital: string;
  resultado: ForensicAnalysisResult;
  entity?: AuditedEntity | null;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  paisNormativa?: string;
  simboloMoneda?: string;
  observaciones?: ObservacionDecision[];
  hallazgosLiteral?: HallazgoMatrizLiteral[];
  duplicidades?: DuplicityFinding[];
  ccrdStages?: CcrdStageStatus[];
  directors?: DirectorResponsibility[];
  legalLibrary?: LegalReferenceItem[];
  paymentCycleRows?: PaymentCycleRow[];
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  replicas?: DossierSectionItem[];
  contraReplicas?: DossierSectionItem[];
}

function cleanPdfText(value: unknown, fallback = 'N/D'): string {
  const txt = String(value ?? '').replace(/\s+/g, ' ').trim();
  return txt.length > 0 ? txt : fallback;
}

export function downloadTechnicalPdfReport(data: TechnicalPdfReportInput): void {
  const {
    nombreCaso,
    origenes = [],
    requerimiento,
    selloDigital,
    resultado,
    entity,
    auditor = {
      nombre: 'Auditor Responsable',
      cedulaId: 'N/D',
      cargo: 'Auditor Forense',
      entidad: 'Unidad de Auditoría Forense',
      pais: 'República Dominicana',
    },
    periodo = {
      fechaDesde: '2025-01-01',
      fechaHasta: '2025-12-31',
      alcancePericial: 'Auditoría integral de contrataciones y control interno.',
    },
    paisNormativa = 'República Dominicana',
    simboloMoneda = 'RD$',
    observaciones = [],
    hallazgosLiteral = [],
    duplicidades = [],
    ccrdStages = [],
    directors = [],
    legalLibrary = [],
    paymentCycleRows = [],
    actaLectura,
    recursos = [],
    replicas = [],
    contraReplicas = [],
  } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const shaHash = cleanPdfText(resultado?.digitalHash || selloDigital, 'SHA256_PENDIENTE');
  const fechaEmision = new Date(resultado?.timestamp || Date.now()).toLocaleString('es-DO');

  const getLastY = (defaultY: number): number => {
    const finalY = (doc as any).lastAutoTable?.finalY;
    return typeof finalY === 'number' ? finalY : defaultY;
  };

  const ensureSpace = (currentY: number, neededHeight: number): number => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  const drawSectionHeading = (title: string, y: number): number => {
    const nextY = ensureSpace(y, 16);
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, nextY, contentWidth, 7.5, 'F');
    doc.setFillColor(2, 132, 199);
    doc.rect(margin, nextY, 2.5, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 5, nextY + 5.1);
    doc.setTextColor(15, 23, 42);
    return nextY + 10.5;
  };

  const drawWrappedParagraph = (text: string, y: number, fontSize = 9): number => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(cleanPdfText(text, 'Sin detalle registrado.'), contentWidth);
    let cursorY = y;
    for (const line of lines) {
      cursorY = ensureSpace(cursorY, 5.5);
      doc.text(line, margin, cursorY);
      cursorY += 4.5;
    }
    return cursorY + 2;
  };

  // ==================== HEADER BANNER ====================
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 32.5, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('INFORME TÉCNICO FORMAL DE AUDITORÍA FORENSE', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(186, 230, 253);
  doc.text(
    `basa12-ecosistema • Jurisdicción: ${cleanPdfText(paisNormativa)} • Emisión: ${fechaEmision}`,
    margin,
    20
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(110, 231, 183);
  doc.text(`TRAZABILIDAD SHA-256: ${shaHash}`, margin, 27.5);

  let y = 41;

  // ==================== 1. FICHA TÉCNICA DEL EXPEDIENTE ====================
  y = drawSectionHeading('1. FICHA TÉCNICA DEL EXPEDIENTE Y CUSTODIA CRIPTOGRÁFICA', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 46, fillColor: [248, 250, 252] } },
    body: [
      ['Caso / Expediente', cleanPdfText(nombreCaso)],
      [
        'Entidad Auditada',
        entity ? `${entity.nombre} (${entity.siglas}) • RNC/NIF: ${entity.rncNif}` : cleanPdfText(auditor.entidad),
      ],
      [
        'Auditor Responsable',
        `${cleanPdfText(auditor.nombre)} — ${cleanPdfText(auditor.cargo)} (ID/Cédula: ${cleanPdfText(auditor.cedulaId)})`,
      ],
      [
        'Período & Alcance',
        `${cleanPdfText(periodo.fechaDesde)} al ${cleanPdfText(periodo.fechaHasta)} | ${cleanPdfText(periodo.alcancePericial)}`,
      ],
      ['Fuentes / Orígenes', origenes.length > 0 ? origenes.join('; ') : 'Expediente Digital Cargado'],
      ['Requerimiento Analizado', cleanPdfText(requerimiento)],
      ['Sello Digital SHA-256', shaHash],
      [
        'Resumen Cuantitativo',
        `Hallazgos Matriz V2: ${hallazgosLiteral.length} | Observaciones Pliego: ${observaciones.length} | Pagos: ${paymentCycleRows.length} | Leyes: ${legalLibrary.length}`,
      ],
    ],
  });

  y = getLastY(y) + 7;

  // ==================== 2. DICTAMEN FINAL Y MÉTRICAS DE RIESGO ====================
  y = drawSectionHeading('2. DICTAMEN TÉCNICO FINAL Y EVALUACIÓN DE RIESGO', y);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    head: [['Nivel de Riesgo Evaluado', 'Exposición Estimada', 'Acción Inmediata Recomendada']],
    body: [
      [
        cleanPdfText(resultado?.metricasRiesgo?.nivelRiesgo, 'ALTO'),
        cleanPdfText(resultado?.metricasRiesgo?.exposicionEstimada, 'Según datos reales cargados'),
        cleanPdfText(resultado?.metricasRiesgo?.accionInmediata, 'Preservación y subsanación de controles'),
      ],
    ],
  });

  y = getLastY(y) + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  y = ensureSpace(y, 10);
  doc.text('Resumen Ejecutivo del Dictamen:', margin, y);
  y += 5;
  y = drawWrappedParagraph(resultado?.resumenEjecutivo || '', y, 9);

  if (resultado?.explicacionTecnica) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    y = ensureSpace(y, 10);
    doc.text('Explicación Técnica Pericial:', margin, y);
    y += 5;
    y = drawWrappedParagraph(resultado.explicacionTecnica, y, 8.8);
  }

  // ==================== 3. BANDERAS ROJAS Y MEJORAS DE CONTROL ====================
  if ((resultado?.banderasRojas?.length || 0) > 0 || (resultado?.mejorasControlInterno?.length || 0) > 0) {
    y = drawSectionHeading('3. BANDERAS ROJAS (RED FLAGS) Y MEJORAS DE CONTROL INTERNO', y + 2);

    const maxLen = Math.max(
      resultado?.banderasRojas?.length || 0,
      resultado?.mejorasControlInterno?.length || 0
    );
    const flagRows: string[][] = [];
    for (let i = 0; i < maxLen; i++) {
      flagRows.push([
        String(i + 1),
        resultado?.banderasRojas?.[i] || '—',
        resultado?.mejorasControlInterno?.[i] || '—',
      ]);
    }

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.3 },
      headStyles: { fillColor: [127, 29, 29], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
      head: [['#', 'Bandera Roja Identificada', 'Mejora de Control Interno Recomendada']],
      body: flagRows,
    });
    y = getLastY(y) + 7;
  }

  // ==================== 4. HALLAZGOS LITERALES V2 (MATRIZ COMPLETA) ====================
  if (hallazgosLiteral.length > 0) {
    y = drawSectionHeading(
      `4. MATRIZ DE HALLAZGOS EVALUADOS (${hallazgosLiteral.length} ACÁPITES — REVISIÓN INTEGRAL V2)`,
      y
    );

    const avgScore =
      hallazgosLiteral.reduce((acc, h) => acc + (Number(h.puntaje0a10) || 0), 0) / hallazgosLiteral.length;
    y = drawWrappedParagraph(
      `Solidez Técnica Promedio: ${avgScore.toFixed(2)}/10 | Conservados/Cumplen: ${
        hallazgosLiteral.filter((h) => h.estado === 'Correcto / Cumple').length
      } | Con Observación/Mejora: ${hallazgosLiteral.filter((h) => h.estado !== 'Correcto / Cumple').length}.`,
      y,
      8.5
    );

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 34 },
        2: { cellWidth: 44 },
        3: { cellWidth: 40 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 32 },
      },
      head: [
        [
          'Código / Ubic.',
          'Título & Sección',
          'Condición / Evidencia / Cuantificación',
          'Criterio Real, Causa y Efecto',
          'Nota / Estado',
          'Recomendación y Mejora 10/10',
        ],
      ],
      body: hallazgosLiteral.map((h) => [
        `${h.idHallazgo}\n${cleanPdfText(h.ubicacionExacta || h.referenciaExacta, 'N/D')}`,
        `${h.titulo}${h.seccionPadre ? `\n[Sección: ${h.seccionPadre}]` : ''}\nRiesgo: ${cleanPdfText(h.nivelRiesgo, 'Medio')}`,
        `${cleanPdfText(h.condicionLiteral, h.transcripcionIntegra || '')}\n\nEvidencia: ${cleanPdfText(h.evidenciaSoporte, 'Ver expediente')}\nCuantif.: ${cleanPdfText(h.cuantificacion, 'No especificada')}`,
        `Criterio: ${cleanPdfText(h.criterioTexto)}\nCausa: ${cleanPdfText(h.causa)}\nEfecto: ${cleanPdfText(h.efecto)}`,
        `${Number(h.puntaje0a10 || 0).toFixed(1)}/10\n${cleanPdfText(h.estadoRecomendado || h.estado)}`,
        `Rec.: ${cleanPdfText(h.recomendacionSupervisor)}\nFalta 10/10: ${cleanPdfText(h.queFaltaPara10, h.planAccionCorrectivo)}`,
      ]),
    });
    y = getLastY(y) + 7;
  }

  // ==================== 5. PLIEGO DE OBSERVACIONES DEL CONTRADICTORIO ====================
  if (observaciones.length > 0) {
    y = drawSectionHeading(`5. DECISIONES SOBRE OBSERVACIONES (${observaciones.length})`, y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.8, cellPadding: 2.2 },
      headStyles: { fillColor: [3, 105, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
      head: [['Código', 'Observación y Monto', 'Decisión', 'Evaluación y Base Legal']],
      body: observaciones.map((o) => [
        `${o.codigoObservacion}\n(${o.severidad})`,
        `${o.titulo}\nMonto: ${formatCurrency(o.montoInvolucrado || 0, simboloMoneda)}`,
        o.decision,
        `${cleanPdfText(o.criterioEvaluacion)}\nBase: ${cleanPdfText(o.fundamentacionLegal)}`,
      ]),
    });
    y = getLastY(y) + 7;
  }

  // ==================== 6. ETAPAS GUÍA CCRD Y SEGREGACIÓN DE DIRECTORES ====================
  if (ccrdStages.length > 0) {
    y = drawSectionHeading('6. CUMPLIMIENTO PROCESAL — GUÍA DE FISCALIZACIÓN CCRD (LEY 18-24)', y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      head: [['Etapa', 'Componente', 'Estado', 'Evidencia Verificada']],
      body: ccrdStages.map((s) => [
        `Etapa ${s.step}`,
        s.title,
        s.status,
        `${s.evidenciaVerificada} | Acta: ${actaLectura?.contenido?.trim() ? 'Sí' : 'No'} | Rec.: ${recursos.length} | Rép.: ${replicas.length} | C-Rép.: ${contraReplicas.length}`,
      ]),
    });
    y = getLastY(y) + 7;
  }

  if (directors.length > 0) {
    y = drawSectionHeading('7. SEGREGACIÓN DE TITULARES Y DECRETOS OFICIALES', y);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
      head: [['Período', 'Titular / Cargo', 'Decreto de Nombramiento', 'Vigencia y Responsabilidad']],
      body: directors.map((d) => [
        `P-${d.periodoNumero}`,
        `${d.nombre}\n${d.cargo}`,
        cleanPdfText(d.numeroDecretoNombramiento),
        `${d.fechaInicioGestion || 'N/D'} al ${d.enFuncionesActuales ? 'Actualidad' : d.fechaFinGestion || 'N/D'}\n${cleanPdfText(d.responsabilidadObservaciones, 'Sin observaciones')}`,
      ]),
    });
    y = getLastY(y) + 7;
  }

  // ==================== 8. FUNDAMENTO LEGAL & DUPLICIDADES & BIBLIOTECA ====================
  y = drawSectionHeading('8. FUNDAMENTO LEGAL Y BIBLIOTECA JURÍDICA VERIFICADA', y);
  y = drawWrappedParagraph(resultado?.fundamentoLegal || '', y, 8.8);

  if (duplicidades.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.8, cellPadding: 2 },
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255] },
      head: [['Tipo Duplicidad', 'Elementos Involucrados', 'Similitud', 'Recomendación de Mejora']],
      body: duplicidades.map((d) => [
        d.tipo,
        d.elementosInvolucrados.join(' vs '),
        `${d.similitudPct}%`,
        `${d.descripcion} -> ${d.recomendacionMejora}`,
      ]),
    });
    y = getLastY(y) + 6;
  }

  if (legalLibrary.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7.6, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      head: [['Jerarquía', 'Norma / Decreto', 'Artículos & Hallazgos', 'Fuente y SHA-256']],
      body: legalLibrary.map((l) => [
        `#${l.jerarquiaOrden} ${l.jerarquia}`,
        `${l.numeroNorma}\n${l.titulo}`,
        `Arts.: ${(l.articulosPuntuales || []).join(', ') || 'N/D'}\nHallazgos: ${(l.hallazgosVinculados || []).join(', ') || 'General'}`,
        `${l.ubicacionFuente}${l.url ? `\n${l.url}` : ''}\nSHA-256: ${l.sha256.slice(0, 20)}...`,
      ]),
    });
  }

  // ==================== FOOTER ON ALL PAGES ====================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `basa12-ecosistema | Expediente: ${cleanPdfText(nombreCaso).slice(0, 42)} | SHA-256: ${shaHash.slice(0, 24)}...`,
      margin,
      pageHeight - 8.5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 8.5, { align: 'right' });
  }

  const safeFile = (nombreCaso || 'Informe_Tecnico_Forense').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Informe_Tecnico_Forense_${safeFile}_${shaHash.slice(0, 8)}.pdf`);
}
