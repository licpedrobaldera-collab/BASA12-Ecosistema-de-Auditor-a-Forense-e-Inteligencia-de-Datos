import JSZip from 'jszip';
import {
  ForensicAnalysisResult,
  AuditorProfile,
  AuditPeriodScope,
  ObservacionDecision,
  DossierSectionItem,
  PaymentCycleRow,
  DirectorResponsibility,
  HallazgoMatrizLiteral,
  LegalReferenceItem,
  DuplicityFinding,
  CcrdStageStatus,
  AuditedEntity,
  NormativeHierarchyLevel,
} from '../types/forensic';
import { formatCurrency } from './entities';

const HIERARCHY_LABELS: Record<NormativeHierarchyLevel, string> = {
  CONSTITUCION: '1. Constitución de la República',
  TRATADOS_ISSAI_NIA: '2. Tratados Internacionales / Normas ISSAI / NIA',
  LEY: '3. Leyes Orgánicas y Ordinarias',
  DECRETO: '4. Decretos Presidenciales y Reglamentos',
  RESOLUCION_NOBACI: '5. Resoluciones Administrativas / NOBACI / CGR / DGCP / MAP',
  NORMATIVA_INTERNA: '6. Manuales, Políticas y Procedimientos Internos',
};

function escapeHtml(text: string | undefined): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function downloadWordReport(data: {
  nombreCaso: string;
  origenes: string[];
  requerimiento: string;
  selloDigital: string;
  resultado: ForensicAnalysisResult;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  paisNormativa?: string;
  observaciones?: ObservacionDecision[];
  paymentCycleRows?: PaymentCycleRow[];
  simboloMoneda?: string;
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  replicas?: DossierSectionItem[];
  contraReplicas?: DossierSectionItem[];
  directors?: DirectorResponsibility[];
  legalLibrary?: LegalReferenceItem[];
}) {
  const {
    nombreCaso,
    requerimiento,
    selloDigital,
    resultado,
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
      alcancePericial: 'Auditoría integral de contrataciones y ciclo de pagos.',
    },
    paisNormativa = 'República Dominicana',
    observaciones = [],
    paymentCycleRows = [],
    simboloMoneda = 'RD$',
    actaLectura,
    recursos = [],
    replicas = [],
    contraReplicas = [],
    directors = [],
    legalLibrary = [],
  } = data;

  const fecha = new Date().toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const content = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>DICTAMEN TÉCNICO PERICIAL DE AUDITORÍA FORENSE DIGITAL</title>
  <style>
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }
    h1 { color: #0f172a; font-size: 18pt; border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; }
    h2 { color: #0369a1; font-size: 13pt; margin-top: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 14px; }
    th { background-color: #0f172a; color: #ffffff; padding: 7px 9px; font-weight: bold; text-align: left; font-size: 9.5pt; }
    td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9.5pt; }
    .badge-mantiene { background-color: #fee2e2; color: #991b1b; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .badge-elimina { background-color: #dcfce7; color: #166534; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .badge-modifica { background-color: #fef3c7; color: #92400e; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
    .code-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; font-family: 'Consolas', monospace; font-size: 9pt; color: #0f172a; white-space: pre-wrap; }
    .footer { margin-top: 40px; border-top: 1px solid #94a3b8; padding-top: 15px; font-size: 9pt; color: #64748b; }
    .stamp { font-family: monospace; background-color: #f1f5f9; padding: 3px 6px; border-radius: 3px; font-size: 8.5pt; color: #475569; }
    .signature-box { margin-top: 50px; border-top: 1px solid #334155; width: 320px; text-align: center; padding-top: 8px; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>DICTAMEN TÉCNICO PERICIAL Y RESOLUCIÓN CONTRADICTORIA</h1>
  <p><strong>Fecha de Emisión:</strong> ${fecha}</p>
  <p><strong>Jurisdicción y Normativa Aplicable:</strong> ${escapeHtml(paisNormativa)}</p>

  <table>
    <tr>
      <th colspan="2">1. FICHA TÉCNICA DEL EXPEDIENTE Y AUDITOR ACTUANTE</th>
    </tr>
    <tr>
      <td width="30%"><strong>Caso Técnico:</strong></td>
      <td>${escapeHtml(nombreCaso)}</td>
    </tr>
    <tr>
      <td><strong>Auditor / Perito Responsable:</strong></td>
      <td><strong>${escapeHtml(auditor.nombre)}</strong> (ID/Cédula: ${escapeHtml(auditor.cedulaId)})</td>
    </tr>
    <tr>
      <td><strong>Cargo / Firma:</strong></td>
      <td>${escapeHtml(auditor.cargo)} - ${escapeHtml(auditor.entidad)}</td>
    </tr>
    <tr>
      <td><strong>Rango del Período Auditado:</strong></td>
      <td>Del ${escapeHtml(periodo.fechaDesde)} al ${escapeHtml(periodo.fechaHasta)}</td>
    </tr>
    <tr>
      <td><strong>Alcance Pericial:</strong></td>
      <td>${escapeHtml(periodo.alcancePericial || 'Examen analítico forense.')}</td>
    </tr>
    <tr>
      <td><strong>Sello Criptográfico SHA-256:</strong></td>
      <td><span class="stamp">${escapeHtml(selloDigital)}</span></td>
    </tr>
  </table>

  <h2>2. Resumen Ejecutivo del Dictamen</h2>
  <p>${escapeHtml(resultado.resumenEjecutivo || 'Evaluación forense basada en los datos reales suministrados.')}</p>
  <p><strong>Requerimiento Analítico Pericial:</strong> ${escapeHtml(requerimiento)}</p>

  ${
    resultado.mejorasControlInterno && resultado.mejorasControlInterno.length > 0
      ? `
  <h2>3. Mejoras de Control Interno y Procedimientos Recomendadas</h2>
  <ul>
    ${resultado.mejorasControlInterno.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}
  </ul>`
      : ''
  }

  <h2>4. Fases del Procedimiento Contradictorio Multi-Período</h2>
  <ul>
    <li><strong>Acta de Lectura:</strong> ${escapeHtml(actaLectura?.titulo || 'Sin acta registrada')} (${actaLectura?.archivos.length || 0} archivo(s))</li>
    <li><strong>Recursos de Reconsideración:</strong> ${recursos.length} escrito(s) analizados.</li>
    <li><strong>Réplicas y Descargos:</strong> ${replicas.length} escrito(s) por período y titular.</li>
    <li><strong>Contra-Réplicas Técnicas:</strong> ${contraReplicas.length} escrito(s) registrados.</li>
  </ul>

  ${
    directors.length > 0
      ? `
  <h2>4B. Segregación de Responsabilidad por Directores y Decretos Oficiales</h2>
  <table>
    <tr>
      <th>Director / Titular</th>
      <th>Decreto Oficial</th>
      <th>Período Gestión</th>
      <th>Fuentes y Ubicación de Origen</th>
    </tr>
    ${directors
      .map(
        (d) => `
    <tr>
      <td><strong>${escapeHtml(d.nombre)}</strong><br/><span style="font-size:8.5pt;">${escapeHtml(d.cargo)}</span></td>
      <td>${escapeHtml(d.numeroDecretoNombramiento || 'Por verificar')}</td>
      <td>${escapeHtml(d.fechaInicioGestion || 'N/D')} a ${d.enFuncionesActuales ? 'Actualidad' : escapeHtml(d.fechaFinGestion || 'N/D')}</td>
      <td>${
        d.fuentes && d.fuentes.length > 0
          ? d.fuentes
              .map(
                (f) =>
                  `${escapeHtml(f.ubicacionOrigen)}${
                    f.url ? ` (<a href="${escapeHtml(f.url)}">${escapeHtml(f.url)}</a>)` : ''
                  }`
              )
              .join('<br/>')
          : 'Sin fuente web adjunta'
      }</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  ${
    paymentCycleRows.length > 0
      ? `
  <h2>5. Trazabilidad del Ciclo de Pagos (${paymentCycleRows.length} desembolsos)</h2>
  <table>
    <tr>
      <th>Orden / Contrato</th>
      <th>Beneficiario</th>
      <th>e-CF / Libramiento</th>
      <th>Facturado</th>
      <th>Neto Pagado</th>
      <th>Estado</th>
    </tr>
    ${paymentCycleRows
      .map(
        (p) => `
    <tr>
      <td>${escapeHtml(p.ordenNumero)} / ${escapeHtml(p.contratoId)}</td>
      <td>${escapeHtml(p.beneficiario)}</td>
      <td>${escapeHtml(p.numeroFacturaEcf || 'N/D')} • ${escapeHtml(p.numeroLibramientoPago || 'N/D')}</td>
      <td>${formatCurrency(p.montoFacturado, simboloMoneda)}</td>
      <td>${formatCurrency(p.montoPagadoNeto, simboloMoneda)}</td>
      <td>${escapeHtml(p.estadoCiclo)}</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  <h2>6. Resolución Pericial de Observaciones</h2>
  <table>
    <tr>
      <th width="12%">Código</th>
      <th width="28%">Observación &amp; Descargo</th>
      <th width="15%">Decisión</th>
      <th width="45%">Criterio Pericial y Fundamento Legal</th>
    </tr>
    ${observaciones
      .map(
        (o) => `
    <tr>
      <td style="font-family: monospace; font-weight: bold;">${escapeHtml(o.codigoObservacion)}</td>
      <td>
        <strong>${escapeHtml(o.titulo)}</strong><br/>
        <span style="font-size: 8.5pt; color: #475569;">Descargo: ${escapeHtml((o.descargoAlegato || '').slice(0, 180))}</span>
      </td>
      <td>
        <span class="${
          o.decision === 'SE_MANTIENE'
            ? 'badge-mantiene'
            : o.decision === 'SE_ELIMINA'
            ? 'badge-elimina'
            : 'badge-modifica'
        }">
          ${escapeHtml(o.decision)}
        </span>
      </td>
      <td>
        <p style="margin: 0 0 4px 0;">${escapeHtml(o.criterioEvaluacion)}</p>
        <p style="margin: 0; font-size: 8.5pt; color: #0284c7;"><strong>Normativa:</strong> ${escapeHtml(o.fundamentacionLegal)}</p>
      </td>
    </tr>`
      )
      .join('')}
  </table>

  ${
    legalLibrary.length > 0
      ? `
  <h2>6B. Biblioteca Jurídica Virtual Vinculada al Expediente (${legalLibrary.length} Normas)</h2>
  <table>
    <tr>
      <th>Orden</th>
      <th>Norma / Ley / Decreto</th>
      <th>Artículos Puntuales</th>
      <th>Hallazgos Vinculados</th>
      <th>Fuente Oficial Clicable</th>
    </tr>
    ${legalLibrary
      .map(
        (l) => `
    <tr>
      <td><strong>#${l.jerarquiaOrden}</strong></td>
      <td><strong>${escapeHtml(l.numeroNorma)}</strong><br/><span style="font-size:8.5pt;">${escapeHtml(l.titulo)}</span></td>
      <td>${escapeHtml((l.articulosPuntuales || []).join(', '))}</td>
      <td>${escapeHtml((l.hallazgosVinculados || []).join(', ') || 'General')}</td>
      <td>
        ${
          l.url
            ? `<a href="${escapeHtml(l.url)}">${escapeHtml(l.ubicacionFuente || l.url)}</a>`
            : escapeHtml(l.ubicacionFuente || 'Expediente')
        }
        ${
          l.resumenAplicacion || l.textoExtraido
            ? `<br/><span style="font-size:8pt; color:#475569;"><strong>Fragmento verificado:</strong> ${escapeHtml((l.resumenAplicacion || l.textoExtraido || '').slice(0, 350))}</span>`
            : ''
        }
      </td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  <h2>7. Algoritmo Analítico Certificado (Python)</h2>
  <div class="code-box">${escapeHtml(resultado.codigoPython || '# Algoritmo pericial')}</div>

  <h2>8. Acción Inmediata Recomendada</h2>
  <p><strong>${escapeHtml(resultado.metricasRiesgo?.accionInmediata || 'Preservación de documentos originales.')}</strong></p>

  <div class="signature-box">
    <strong>${escapeHtml(auditor.nombre)}</strong><br/>
    ID/Cédula: ${escapeHtml(auditor.cedulaId)}<br/>
    ${escapeHtml(auditor.cargo)}<br/>
    ${escapeHtml(auditor.entidad)}
  </div>

  <div class="footer">
    <p>Informe conforme a ISO/IEC 27037 y NIA 240 / ISA 500. Sello SHA-256: ${escapeHtml(selloDigital)}</p>
  </div>
</body>
</html>
`;

  const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dictamen_Pericial_${nombreCaso.replace(/\s+/g, '_')}_${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * INFORME TÉCNICO DEL SUPERVISOR / REVISOR (CCRD LEY 18-24 & NOBACI)
 * Regla estricta: NO menciona "IA", "Inteligencia Artificial" ni modelos;
 * Todo se expresa como "Resultado del Análisis del Supervisor / Revisor Técnico"
 * y "Procedimientos de Supervisión y Control de Calidad Aplicados".
 */
export function downloadSupervisorWordReport(params: {
  nombreCaso: string;
  entity?: AuditedEntity | null;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  paisNormativa?: string;
  selloDigital: string;
  hallazgos: HallazgoMatrizLiteral[];
  duplicidades?: DuplicityFinding[];
  legalLibrary?: LegalReferenceItem[];
  ccrdStages?: CcrdStageStatus[];
  directors?: DirectorResponsibility[];
  paymentCycleRows?: PaymentCycleRow[];
}) {
  const {
    nombreCaso,
    entity,
    auditor = {
      nombre: 'Supervisor / Revisor Técnico',
      cedulaId: 'N/D',
      cargo: 'Supervisor de Auditoría Gubernamental',
      entidad: 'Unidad de Supervisión y Control de Calidad',
      pais: 'República Dominicana',
    },
    periodo = {
      fechaDesde: '2025-01-01',
      fechaHasta: '2025-12-31',
      alcancePericial: 'Supervisión integral bajo Guía CCRD (Ley núm. 18-24) y Normas NOBACI.',
    },
    paisNormativa = 'República Dominicana',
    selloDigital,
    hallazgos = [],
    duplicidades = [],
    legalLibrary = [],
    ccrdStages = [],
    directors = [],
    paymentCycleRows = [],
  } = params;

  const fecha = new Date().toLocaleDateString('es-DO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const correctos = hallazgos.filter((h) => h.estado === 'Correcto / Cumple');
  const conObservacion = hallazgos.filter((h) => h.estado !== 'Correcto / Cumple');
  const promedioScore =
    hallazgos.length > 0
      ? (hallazgos.reduce((acc, h) => acc + (Number(h.puntaje0a10) || 0), 0) / hallazgos.length).toFixed(2)
      : '0.00';

  const sortedLibrary = [...legalLibrary].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);

  const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>INFORME DE SUPERVISIÓN Y REVISIÓN TÉCNICA — GUÍA CCRD & NOBACI</title>
  <style>
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; color: #0f172a; line-height: 1.45; }
    .header-box { background-color: #0f172a; color: #ffffff; padding: 16px 20px; border-bottom: 4px solid #0284c7; margin-bottom: 16px; }
    .header-box h1 { margin: 0; font-size: 16pt; color: #ffffff; border: none; }
    .header-box p { margin: 4px 0 0 0; font-size: 9.5pt; color: #cbd5e1; }
    h2 { color: #0369a1; font-size: 12.5pt; margin-top: 20px; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; }
    h3 { color: #1e293b; font-size: 11pt; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 14px; }
    th { background-color: #1e3a8a; color: #ffffff; padding: 7px 8px; font-weight: bold; text-align: left; font-size: 9pt; }
    td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 9pt; vertical-align: top; }
    .ok-badge { background-color: #dcfce7; color: #166534; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 8.5pt; }
    .obs-badge { background-color: #fee2e2; color: #991b1b; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 8.5pt; }
    .box-info { background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 10px 14px; margin: 10px 0; font-size: 9.5pt; }
    .box-dup { background-color: #fffbeb; border-left: 4px solid #d97706; padding: 10px 14px; margin: 10px 0; font-size: 9.5pt; }
    .signature-grid { margin-top: 40px; width: 100%; }
    .signature-cell { border-top: 1px solid #334155; padding-top: 8px; text-align: center; font-size: 9.5pt; width: 45%; }
    .footer { margin-top: 28px; border-top: 1px solid #94a3b8; padding-top: 10px; font-size: 8.5pt; color: #64748b; }
  </style>
</head>
<body>
  <div class="header-box">
    <h1>INFORME DEL SUPERVISOR / REVISOR TÉCNICO — CONTROL DE CALIDAD CCRD &amp; NOBACI</h1>
    <p>Resultado del Análisis del Supervisor / Revisor Técnico • Verificación Documental Literal (3.01 en adelante) • Ley núm. 18-24</p>
  </div>

  <table>
    <tr><th colspan="4">1. DATOS GENERALES DEL EXPEDIENTE Y ALCANCE DE SUPERVISIÓN</th></tr>
    <tr>
      <td width="22%"><strong>Expediente / Caso:</strong></td>
      <td width="28%">${escapeHtml(nombreCaso)}</td>
      <td width="22%"><strong>Fecha de Supervisión:</strong></td>
      <td width="28%">${fecha}</td>
    </tr>
    <tr>
      <td><strong>Entidad Auditada:</strong></td>
      <td>${escapeHtml(entity?.nombre || 'Entidad Auditada')} (${escapeHtml(entity?.siglas || 'N/D')})</td>
      <td><strong>RNC / NIF:</strong></td>
      <td>${escapeHtml(entity?.rncNif || 'N/D')}</td>
    </tr>
    <tr>
      <td><strong>Supervisor / Revisor Técnico:</strong></td>
      <td><strong>${escapeHtml(auditor.nombre)}</strong> (${escapeHtml(auditor.cargo)})</td>
      <td><strong>Jurisdicción:</strong></td>
      <td>${escapeHtml(paisNormativa)}</td>
    </tr>
    <tr>
      <td><strong>Período Auditado:</strong></td>
      <td>Del ${escapeHtml(periodo.fechaDesde)} al ${escapeHtml(periodo.fechaHasta)}</td>
      <td><strong>Calificación Promedio:</strong></td>
      <td><strong>${promedioScore} / 10.00</strong> (${hallazgos.length} acápites 3.01+)</td>
    </tr>
    <tr>
      <td><strong>Sello Criptográfico SHA-256:</strong></td>
      <td colspan="3" style="font-family: monospace; font-size: 8.5pt;">${escapeHtml(selloDigital)}</td>
    </tr>
  </table>

  <div class="box-info">
    <strong>Procedimientos de Supervisión y Revisión Técnica Aplicados:</strong><br/>
    1) Inspección carácter por carácter y extracción literal desde la sección 3.01 en adelante de los documentos aportados al expediente sin alterar hechos ni cifras.<br/>
    2) Validación de etapas procesales conforme a la Guía de Fiscalización de la Cámara de Cuentas (Ley núm. 18-24).<br/>
    3) Evaluación jerárquica estricta de criterios normativos: (1) Constitución → (2) Tratados / ISSAI / NIA → (3) Leyes → (4) Decretos / Reglamentos → (5) Resoluciones / NOBACI (CGR, MAP, DGCP) → (6) Normativa Interna.<br/>
    4) Control de duplicidades entre hallazgos, citas legales y registros del ciclo de pagos (${paymentCycleRows.length} operaciones revisadas).
  </div>

  <h2>2. Cumplimiento de Etapas Procesales (Guía de Fiscalización CCRD — Ley núm. 18-24)</h2>
  <table>
    <tr>
      <th width="12%">Etapa</th>
      <th width="24%">Componente Procesal</th>
      <th width="16%">Estado</th>
      <th width="48%">Evidencia Verificada por Supervisión</th>
    </tr>
    ${ccrdStages
      .map(
        (s) => `
    <tr>
      <td><strong>Etapa ${s.step}</strong></td>
      <td><strong>${escapeHtml(s.title)}</strong><br/><span style="font-size:8pt; color:#475569;">${escapeHtml(s.description)}</span></td>
      <td><strong>${escapeHtml(s.status)}</strong></td>
      <td>${escapeHtml(s.evidenciaVerificada)}</td>
    </tr>`
      )
      .join('')}
  </table>

  <h2>3. Separación de Componentes: Acápites Correctos vs. Con Observación / Mejora</h2>
  <p>
    <strong>Resumen de Verificación Literal:</strong> Del total de <strong>${hallazgos.length}</strong> acápites revisados desde la sección 3.01 en adelante:
    <span class="ok-badge">${correctos.length} Correcto(s) / Cumplen</span> &nbsp; y &nbsp;
    <span class="obs-badge">${conObservacion.length} Con Observación / Oportunidad de Mejora</span>.
  </p>

  ${
    correctos.length > 0
      ? `
  <h3>3A. Acápites / Componentes Correctos (Cumplen Estándares CCRD y NOBACI)</h3>
  <table>
    <tr>
      <th width="10%">Acápite</th>
      <th width="24%">Título</th>
      <th width="10%">Nota</th>
      <th width="32%">Condición Literal Verificada</th>
      <th width="24%">Validación del Supervisor</th>
    </tr>
    ${correctos
      .map(
        (h) => `
    <tr>
      <td><strong>${escapeHtml(h.idHallazgo)}</strong></td>
      <td>${escapeHtml(h.titulo)}</td>
      <td><strong>${Number(h.puntaje0a10).toFixed(1)}/10</strong></td>
      <td>${escapeHtml(h.condicionLiteral)}</td>
      <td>${escapeHtml(h.recomendacionSupervisor)}</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  <h3>3B. Matriz Detallada de Hallazgos con Observación y Oportunidad de Mejora (Estructura CGR / NOBACI)</h3>
  <table>
    <tr>
      <th width="9%">Código &amp; Riesgo</th>
      <th width="18%">Título &amp; Jerarquía</th>
      <th width="24%">Condición Literal (Documento Real)</th>
      <th width="22%">Criterio (Lo que debe ser), Causa y Efecto</th>
      <th width="27%">Resultado del Análisis del Supervisor &amp; Plan Correctivo</th>
    </tr>
    ${(conObservacion.length > 0 ? conObservacion : hallazgos)
      .map(
        (h) => `
    <tr>
      <td>
        <strong>${escapeHtml(h.idHallazgo)}</strong><br/>
        <span>${Number(h.puntaje0a10).toFixed(1)}/10</span><br/>
        <span style="font-size:8pt; color:#991b1b;">${escapeHtml(h.nivelRiesgo || 'Medio (Moderado)')}</span>
      </td>
      <td>
        <strong>${escapeHtml(h.titulo)}</strong><br/>
        <span style="font-size:8pt; color:#0369a1;">${escapeHtml(HIERARCHY_LABELS[h.jerarquiaCriterio] || h.jerarquiaCriterio)}</span><br/>
        ${h.referenciaExacta ? `<span style="font-size:8pt; color:#475569;">Ref.: ${escapeHtml(h.referenciaExacta)}</span><br/>` : ''}
        ${h.directorResponsable ? `<span style="font-size:8pt;">Titular: ${escapeHtml(h.directorResponsable)}</span>` : ''}
      </td>
      <td>${escapeHtml(h.condicionLiteral)}</td>
      <td>
        ${h.criterioAuditorOriginal ? `<strong>Criterio Original:</strong> ${escapeHtml(h.criterioAuditorOriginal)}<br/>` : ''}
        <strong>Criterio (Lo que debe ser):</strong> ${escapeHtml(h.criterioTexto)}<br/>
        ${
          h.leyesCitadas && h.leyesCitadas.length > 0
            ? `<strong>Artículos y Normas Puntuales:</strong> ${escapeHtml(
                h.leyesCitadas.map((l) => `${l.norma}${l.articulo ? ` (${l.articulo})` : ''}`).join('; ')
              )}<br/>`
            : ''
        }
        <strong>Causa:</strong> ${escapeHtml(h.causa)}<br/>
        <strong>Efecto:</strong> ${escapeHtml(h.efecto)}
      </td>
      <td>
        <strong>Análisis del Supervisor:</strong> ${escapeHtml(h.recomendacionSupervisor)}<br/>
        <strong>Plan Correctivo:</strong> ${escapeHtml(h.planAccionCorrectivo)}<br/>
        <strong>Responsable / Entregable:</strong> ${escapeHtml(h.responsableArea)} — ${escapeHtml(h.entregable)}
      </td>
    </tr>`
      )
      .join('')}
  </table>

  ${
    duplicidades.length > 0
      ? `
  <h2>4. Control de Duplicidades Detectadas y Mejoras de Consistencia</h2>
  <div class="box-dup">
    Se identificaron <strong>${duplicidades.length}</strong> posible(s) duplicidad(es) en la revisión técnica cruzada (hallazgos, citas legales o pagos/contratos).
  </div>
  <table>
    <tr>
      <th width="14%">Tipo</th>
      <th width="28%">Elementos Involucrados</th>
      <th width="10%">Similitud</th>
      <th width="48%">Descripción y Recomendación del Supervisor</th>
    </tr>
    ${duplicidades
      .map(
        (d) => `
    <tr>
      <td><strong>${escapeHtml(d.tipo)}</strong></td>
      <td>${escapeHtml(d.elementosInvolucrados.join(' vs '))}</td>
      <td><strong>${d.similitudPct}%</strong></td>
      <td>${escapeHtml(d.descripcion)}<br/><strong>Acción de Mejora:</strong> ${escapeHtml(d.recomendacionMejora)}</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  ${
    directors.length > 0
      ? `
  <h2>5. Individualización de Titulares y Decretos Oficiales de Nombramiento</h2>
  <table>
    <tr>
      <th>Titular / Director</th>
      <th>Decreto de Nombramiento</th>
      <th>Período de Gestión</th>
      <th>Fuentes Oficiales Verificadas</th>
    </tr>
    ${directors
      .map(
        (d) => `
    <tr>
      <td><strong>${escapeHtml(d.nombre)}</strong> (${escapeHtml(d.cargo)})</td>
      <td>${escapeHtml(d.numeroDecretoNombramiento || 'Por verificar')}</td>
      <td>${escapeHtml(d.fechaInicioGestion || 'N/D')} a ${d.enFuncionesActuales ? 'Actualidad' : escapeHtml(d.fechaFinGestion || 'N/D')}</td>
      <td>${
        d.fuentes && d.fuentes.length > 0
          ? d.fuentes
              .map(
                (f) =>
                  `${escapeHtml(f.ubicacionOrigen)}${
                    f.url ? ` — <a href="${escapeHtml(f.url)}">${escapeHtml(f.url)}</a>` : ''
                  }`
              )
              .join('<br/>')
          : 'Fuente documental en expediente'
      }</td>
    </tr>`
      )
      .join('')}
  </table>`
      : ''
  }

  <h2>6. Biblioteca Jurídica Virtual del Expediente (Orden Jerárquico Normativo)</h2>
  ${
    sortedLibrary.length > 0
      ? `
  <table>
    <tr>
      <th width="18%">Orden Jerárquico</th>
      <th width="22%">Ley / Decreto / Norma</th>
      <th width="20%">Artículos y Hallazgos</th>
      <th width="40%">Enlace Oficial y Ubicación</th>
    </tr>
    ${sortedLibrary
      .map(
        (l) => `
    <tr>
      <td><strong>${escapeHtml(HIERARCHY_LABELS[l.jerarquia] || l.jerarquia)}</strong></td>
      <td><strong>${escapeHtml(l.numeroNorma)}</strong><br/><span>${escapeHtml(l.titulo)}</span></td>
      <td>
        <strong>Arts.:</strong> ${escapeHtml((l.articulosPuntuales || []).join(', '))}<br/>
        <strong>Hallazgos:</strong> ${escapeHtml((l.hallazgosVinculados || []).join(', ') || 'General')}
      </td>
      <td>
        ${
          l.url
            ? `<a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a><br/>`
            : ''
        }
        <span>${escapeHtml(l.ubicacionFuente)}</span>
        ${l.resumenAplicacion ? `<br/><span style="font-size:8.5pt; color:#475569;">${escapeHtml(l.resumenAplicacion)}</span>` : ''}
      </td>
    </tr>`
      )
      .join('')}
  </table>`
      : '<p>No se han indexado normas en la Biblioteca Legal de este caso todavía.</p>'
  }

  <table class="signature-grid">
    <tr>
      <td class="signature-cell" style="border-left:none; border-right:none; border-bottom:none;">
        <strong>${escapeHtml(auditor.nombre)}</strong><br/>
        ${escapeHtml(auditor.cargo)}<br/>
        ID/Cédula: ${escapeHtml(auditor.cedulaId)}
      </td>
      <td style="border:none; width:10%;"></td>
      <td class="signature-cell" style="border-left:none; border-right:none; border-bottom:none;">
        <strong>Control de Calidad y Supervisión Técnica</strong><br/>
        ${escapeHtml(auditor.entidad)}<br/>
        Fecha: ${fecha}
      </td>
    </tr>
  </table>

  <div class="footer">
    Documento emitido conforme a la Guía de Fiscalización CCRD (Ley núm. 18-24), Normas NOBACI (CGR), Ley 41-08, ISSAI e ISO/IEC 27037. Sello SHA-256: ${escapeHtml(selloDigital)}
  </div>
</body>
</html>
`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Informe_Supervisor_CCRD_NOBACI_${nombreCaso.replace(/\s+/g, '_')}_${Date.now()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXmlDocx(text: string | undefined): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
}

export async function downloadSupervisorDocxReport(params: {
  nombreCaso: string;
  entity?: AuditedEntity | null;
  auditor: AuditorProfile;
  periodo: AuditPeriodScope;
  paisNormativa: string;
  selloDigital: string;
  hallazgos: HallazgoMatrizLiteral[];
  duplicidades: DuplicityFinding[];
  legalLibrary: LegalReferenceItem[];
  ccrdStages: CcrdStageStatus[];
  directors: DirectorResponsibility[];
  paymentCycleRows?: PaymentCycleRow[];
}) {
  const {
    nombreCaso,
    entity,
    auditor,
    periodo,
    paisNormativa,
    selloDigital,
    hallazgos,
    duplicidades,
    ccrdStages,
  } = params;

  const fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const promedioScore =
    hallazgos.length > 0
      ? (hallazgos.reduce((acc, h) => acc + (Number(h.puntaje0a10) || 0), 0) / hallazgos.length).toFixed(2)
      : '0.00';

  const p = (txt: string, style?: 'Heading1' | 'Heading2' | 'Heading3', boldLabel?: string) => {
    const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
    if (boldLabel) {
      return `<w:p>${pPr}<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXmlDocx(boldLabel)}</w:t></w:r><w:r><w:t xml:space="preserve">${escapeXmlDocx(txt)}</w:t></w:r></w:p>`;
    }
    return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${escapeXmlDocx(txt)}</w:t></w:r></w:p>`;
  };

  const blocks: string[] = [
    p('INFORME DEL SUPERVISOR / REVISOR TÉCNICO — CONTROL DE CALIDAD CCRD & NOBACI', 'Heading1'),
    p(`${entity?.nombre || 'Entidad Auditada'} (${entity?.siglas || 'N/D'}) — Expediente: ${nombreCaso}`, undefined, 'Entidad y Caso: '),
    p(`${fecha} | Jurisdicción: ${paisNormativa} | Período: ${periodo.fechaDesde} al ${periodo.fechaHasta}`, undefined, 'Emisión y Alcance: '),
    p(`${auditor.nombre} (${auditor.cargo}, ID: ${auditor.cedulaId})`, undefined, 'Supervisor Actuante: '),
    p(`${selloDigital}`, undefined, 'Trazabilidad SHA-256: '),
    p(`${hallazgos.length} hallazgos 3.01+ | Promedio de Solidez: ${promedioScore}/10.00 | Duplicidades detectadas: ${duplicidades.length}`, undefined, 'Resumen Cuantitativo: '),
    p('1. Etapas Procesales Verificadas (Ley núm. 18-24)', 'Heading2'),
    ...ccrdStages.map((s) =>
      p(` [${s.status}] ${s.evidenciaVerificada}`, undefined, `Etapa ${s.step} — ${s.title}:`)
    ),
    p('2. Evaluación Íntegra y Transcripción Textual por Hallazgo', 'Heading2'),
  ];

  for (const h of hallazgos) {
    blocks.push(
      p(`${h.idHallazgo} — ${h.titulo} (${Number(h.puntaje0a10 || 0).toFixed(1)}/10 · ${h.nivelSolidezV2 || h.estado})`, 'Heading3'),
      p(h.ubicacionExacta || h.referenciaExacta || h.seccionPadre || 'Ubicación documental general', undefined, '• Ubicación y Sección: '),
      p(h.estadoRecomendado || h.justificacionDecision || h.estado, undefined, '• Decisión / Justificación: '),
      p(h.condicionLiteral, undefined, '• Condición: '),
      p(h.criterioTexto, undefined, '• Criterio Normativo: '),
      p(h.comparacion || 'Contraste condición vs criterio documentado.', undefined, '• Comparación: '),
      p(h.causa, undefined, '• Causa: '),
      p(h.efecto, undefined, '• Efecto: '),
      p(h.riesgoDetalle || h.nivelRiesgo || 'N/D', undefined, '• Riesgo: '),
      p(h.evidenciaSoporte || h.origenDocumento || 'Expediente', undefined, '• Evidencia y Comunicaciones: '),
      p(h.cuantificacion || 'No explicitado en el texto', undefined, '• Cuantificación: '),
      p(h.responsabilidadDetalle || h.responsableArea || 'No explicitado en el texto', undefined, '• Responsabilidad: '),
      p(h.recomendacionSupervisor, undefined, '• Recomendación Técnica: '),
      p(h.deficienciasRedaccion || h.queFaltaPara10 || 'Sin deficiencias críticas.', undefined, '• Deficiencias / Qué falta para 10/10: '),
      p(h.versionMejorada10 || h.planAccionCorrectivo || '', undefined, '• Versión Mejorada 10/10: '),
      p((h.leyesCitadas || []).map((l) => `${l.norma}${l.articulo ? ` (${l.articulo})` : ''}`).join('; ') || 'Ver cuerpo textual', undefined, '• Referencias Normativas: '),
      p((h.transcripcionIntegra || h.condicionLiteral || '').slice(0, 28000), undefined, '• Transcripción Íntegra del Informe: ')
    );
  }

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0F2942"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="0369A1"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="1E293B"/></w:rPr></w:style>
</w:styles>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${blocks.join('\n    ')}
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Informe_Supervisor_BASA12_${nombreCaso.replace(/\s+/g, '_')}_${Date.now()}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
