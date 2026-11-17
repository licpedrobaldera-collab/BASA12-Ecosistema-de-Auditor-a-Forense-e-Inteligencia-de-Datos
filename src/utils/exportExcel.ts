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

  // Sheet 1: Complete 22-Column V2 Matrix (Sorted / reconstructed from Fases 1–4)
  const matrixRows = hallazgos.map((h) => ({
    Código: h.idHallazgo,
    'Hallazgo actual': h.titulo,
    'Transcripción íntegra': (h.transcripcionIntegra || h.condicionLiteral || '').slice(0, 32000),
    Condición: h.condicionLiteral,
    Criterio: h.criterioTexto,
    Comparación: h.comparacion || 'Contrastado frente al marco normativo aplicable.',
    Causa: h.causa,
    Efecto: h.efecto,
    Riesgo: h.riesgoDetalle || h.nivelRiesgo || (h.estado === 'Correcto / Cumple' ? 'Bajo (Menor)' : 'Medio (Moderado)'),
    Evidencia: h.evidenciaSoporte || h.origenDocumento || 'Expediente',
    Cuantificación: h.cuantificacion || 'Por determinar según alcance',
    Responsabilidad: h.responsabilidadDetalle || `${h.responsableArea || 'Área auditada'}${h.directorResponsable ? ` (${h.directorResponsable})` : ''}`,
    'Recomendación actual': h.recomendacionSupervisor,
    Deficiencias: h.deficienciasRedaccion || h.planAccionCorrectivo || '',
    Duplicidad:
      typeof h.duplicidadMax === 'number' && h.duplicidadMax > 0
        ? `${Math.round(h.duplicidadMax * 100)}%`
        : h.esDuplicado
        ? 'Detectada'
        : '0%',
    'Hallazgo relacionado': h.hallazgoRelacionado || '',
    'Justificación de conservar/eliminar/consolidar':
      h.justificacionDecision ||
      `${h.estadoRecomendado || h.estado} (${Number(h.puntaje0a10 || 0).toFixed(1)}/10)`,
    'Puntaje 0–10': Number((Number(h.puntaje0a10) || 0).toFixed(1)),
    Nivel:
      h.nivelSolidezV2 ||
      (Number(h.puntaje0a10) <= 3.5
        ? 'DEFICIENTE'
        : Number(h.puntaje0a10) <= 5.5
        ? 'RECONSTRUIR'
        : Number(h.puntaje0a10) <= 7.5
        ? 'ACEPTABLE CON MEJORAS'
        : Number(h.puntaje0a10) <= 9.2
        ? 'BUENO'
        : 'ÓPTIMO'),
    'Qué falta para 10/10': h.queFaltaPara10 || h.planAccionCorrectivo || '',
    'Versión mejorada 10/10': (h.versionMejorada10 || h.condicionLiteral || '').slice(0, 32000),
    'Referencias normativas':
      (h.leyesCitadas || [])
        .map((l) => `${l.norma}${l.articulo ? ` (${l.articulo})` : ''}`)
        .join(' | ') || h.criterioAuditorOriginal || '',
    Ubicación:
      h.ubicacionExacta ||
      h.referenciaExacta ||
      `${h.seccionPadre || '3.x'} | ${HIERARCHY_LABELS[h.jerarquiaCriterio] || h.jerarquiaCriterio}`,
  }));

  const wsMatrix = XLSX.utils.json_to_sheet(
    matrixRows.length > 0
      ? matrixRows
      : [
          {
            Código: 'Sin registros',
            'Hallazgo actual': 'No hay hallazgos 3.01+ extraídos todavía',
          },
        ]
  );
  wsMatrix['!cols'] = [
    { wch: 14 },
    { wch: 32 },
    { wch: 52 },
    { wch: 44 },
    { wch: 44 },
    { wch: 36 },
    { wch: 34 },
    { wch: 34 },
    { wch: 28 },
    { wch: 36 },
    { wch: 28 },
    { wch: 32 },
    { wch: 44 },
    { wch: 36 },
    { wch: 14 },
    { wch: 18 },
    { wch: 42 },
    { wch: 14 },
    { wch: 22 },
    { wch: 44 },
    { wch: 52 },
    { wch: 44 },
    { wch: 32 },
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
