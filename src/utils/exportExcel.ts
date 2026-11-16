import * as XLSX from 'xlsx';
import {
  AuditedEntity,
  AuditorProfile,
  AuditPeriodScope,
  CcrdStageStatus,
  DuplicityFinding,
  HallazgoMatrizLiteral,
  LegalReferenceItem,
  NormativeHierarchyLevel,
  PaymentCycleRow,
} from '../types/forensic';

const HIERARCHY_LABELS: Record<NormativeHierarchyLevel, string> = {
  CONSTITUCION: '1. Constitución',
  TRATADOS_ISSAI_NIA: '2. Tratados / ISSAI / NIA',
  LEY: '3. Leyes Orgánicas / Ordinarias',
  DECRETO: '4. Decretos / Reglamentos',
  RESOLUCION_NOBACI: '5. Resoluciones / NOBACI / CGR',
  NORMATIVA_INTERNA: '6. Manuales / Políticas Internas',
};

export function exportCcrdLiteralMatrixExcel(params: {
  nombreCaso: string;
  entity?: AuditedEntity | null;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  hallazgos: HallazgoMatrizLiteral[];
  duplicidades?: DuplicityFinding[];
  legalLibrary?: LegalReferenceItem[];
  ccrdStages?: CcrdStageStatus[];
  paymentCycleRows?: PaymentCycleRow[];
}) {
  const {
    nombreCaso,
    entity,
    auditor,
    periodo,
    hallazgos = [],
    duplicidades = [],
    legalLibrary = [],
    ccrdStages = [],
    paymentCycleRows = [],
  } = params;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Complete 3.01+ Literal Matrix (Sorted by idHallazgo / hierarchy)
  const matrixRows = hallazgos.map((h) => ({
    'ID Acápite / Hallazgo': h.idHallazgo,
    'Título del Hallazgo': h.titulo,
    'Estado de Verificación': h.estado,
    'Nivel de Riesgo': h.nivelRiesgo || (h.estado === 'Correcto / Cumple' ? 'Bajo (Menor)' : 'Medio (Moderado)'),
    'Calificación (0-10)': Number(h.puntaje0a10.toFixed(1)),
    'Referencia Exacta': h.referenciaExacta || h.origenDocumento || 'Expediente',
    'Nivel Jerárquico Criterio': HIERARCHY_LABELS[h.jerarquiaCriterio] || h.jerarquiaCriterio,
    'Condición Literal (Documento Real)': h.condicionLiteral,
    'Criterio Original del Auditor': h.criterioAuditorOriginal || '',
    'Criterio Normativo Sugerido (10/10)': h.criterioTexto,
    'Causa Raíz': h.causa,
    'Efecto / Riesgo Institucional': h.efecto,
    'Resultado del Análisis del Supervisor / Revisor': h.recomendacionSupervisor,
    'Plan de Acción Correctivo': h.planAccionCorrectivo,
    'Área Responsable': h.responsableArea,
    'Entregable Requerido': h.entregable,
    'Leyes / Normas Citadas': (h.leyesCitadas || [])
      .map((l) => `${l.norma}${l.articulo ? ` (${l.articulo})` : ''}`)
      .join(' | '),
    'Director / Titular Período': h.directorResponsable || 'Por asignar',
    'Alerta Duplicidad': h.esDuplicado ? `SÍ: ${h.detalleDuplicidad || 'Revisar'}` : 'No',
    'Origen Documental': h.origenDocumento || 'Expediente',
  }));

  const wsMatrix = XLSX.utils.json_to_sheet(
    matrixRows.length > 0
      ? matrixRows
      : [
          {
            'ID Acápite / Hallazgo': 'Sin registros',
            'Título del Hallazgo': 'No hay hallazgos 3.01+ extraídos todavía',
          },
        ]
  );
  wsMatrix['!cols'] = [
    { wch: 16 },
    { wch: 30 },
    { wch: 24 },
    { wch: 14 },
    { wch: 26 },
    { wch: 50 },
    { wch: 45 },
    { wch: 35 },
    { wch: 35 },
    { wch: 45 },
    { wch: 45 },
    { wch: 22 },
    { wch: 26 },
    { wch: 34 },
    { wch: 22 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Matriz_3_01_Literal');

  // Sheet 2: Componentes Correctos vs Con Observación Summary
  const correctosRows = hallazgos
    .filter((h) => h.estado === 'Correcto / Cumple')
    .map((h) => ({
      'ID Acápite': h.idHallazgo,
      Título: h.titulo,
      'Calificación (0-10)': h.puntaje0a10,
      'Condición Verificada': h.condicionLiteral,
      'Base Normativa': h.criterioTexto,
      'Validación del Supervisor': h.recomendacionSupervisor,
    }));
  const wsCorrectos = XLSX.utils.json_to_sheet(
    correctosRows.length > 0
      ? correctosRows
      : [{ 'ID Acápite': 'N/A', Título: 'Sin componentes marcados como Correcto / Cumple' }]
  );
  wsCorrectos['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 50 }, { wch: 40 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsCorrectos, 'Componentes_Correctos');

  // Sheet 3: Duplicidades Detectadas
  const dupRows = duplicidades.map((d) => ({
    Tipo: d.tipo,
    'Elementos Involucrados': d.elementosInvolucrados.join(' vs '),
    'Similitud (%)': d.similitudPct,
    Descripción: d.descripcion,
    'Recomendación de Mejora': d.recomendacionMejora,
    'Incluido en Observaciones': d.incluidoEnObservaciones ? 'SÍ' : 'No',
  }));
  const wsDups = XLSX.utils.json_to_sheet(
    dupRows.length > 0 ? dupRows : [{ Tipo: 'N/A', Descripción: 'No se detectaron duplicidades en la ejecución actual.' }]
  );
  wsDups['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 48 }, { wch: 45 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsDups, 'Duplicidades_Detectadas');

  // Sheet 4: Biblioteca Jurídica Virtual por Caso
  const libRows = [...legalLibrary]
    .sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden)
    .map((l) => ({
      'Orden Jerárquico': l.jerarquiaOrden,
      Nivel: HIERARCHY_LABELS[l.jerarquia] || l.jerarquia,
      'Número / Norma': l.numeroNorma,
      Título: l.titulo,
      'Artículos Puntuales': (l.articulosPuntuales || []).join(', '),
      'Hallazgos Vinculados': (l.hallazgosVinculados || []).join(', '),
      'URL Fuente Oficial': l.url || 'Sin enlace web registrado',
      'Ubicación / Origen': l.ubicacionFuente,
      'Aplicación Técnica': l.resumenAplicacion,
      'Cita Duplicada': l.esDuplicado ? `SÍ: ${l.detalleDuplicidad || ''}` : 'No',
      'Sello SHA-256': l.sha256,
    }));
  const wsLib = XLSX.utils.json_to_sheet(
    libRows.length > 0
      ? libRows
      : [{ 'Orden Jerárquico': '-', 'Número / Norma': 'Biblioteca Legal aún no indexada para este caso.' }]
  );
  wsLib['!cols'] = [
    { wch: 16 },
    { wch: 26 },
    { wch: 24 },
    { wch: 36 },
    { wch: 28 },
    { wch: 24 },
    { wch: 45 },
    { wch: 28 },
    { wch: 42 },
    { wch: 18 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLib, 'Biblioteca_Legal_Caso');

  // Sheet 5: Etapas Guía CCRD (Ley núm. 18-24) & Ficha
  const stageRows = [
    {
      Etapa: 'EXPEDIENTE',
      Título: `${nombreCaso} — ${entity?.nombre || 'Entidad Auditada'}`,
      Estado: 'ACTIVO',
      Descripción: `Período: ${periodo?.fechaDesde || 'N/D'} al ${periodo?.fechaHasta || 'N/D'} | Supervisor/Auditor: ${auditor?.nombre || 'Asignado'}`,
      'Evidencia Verificada': `RNC/NIF: ${entity?.rncNif || 'N/D'} | Pagos cargados: ${paymentCycleRows.length}`,
    },
    ...ccrdStages.map((s) => ({
      Etapa: `Etapa ${s.step}`,
      Título: s.title,
      Estado: s.status,
      Descripción: s.description,
      'Evidencia Verificada': s.evidenciaVerificada,
    })),
  ];
  const wsStages = XLSX.utils.json_to_sheet(stageRows);
  wsStages['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 16 }, { wch: 52 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsStages, 'Etapas_Guia_CCRD');

  const safeName = (nombreCaso || 'Auditoria_CCRD').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Matriz_CCRD_3_01_${safeName}_${Date.now()}.xlsx`);
}
