import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Layers,
  CopyCheck,
  BookOpen,
  Sparkles,
  CheckSquare,
  ListChecks,
  BarChart3,
  LayoutTemplate,
} from 'lucide-react';
import {
  AuditedEntity,
  AuditorProfile,
  AuditPeriodScope,
  CcrdStageStatus,
  ContractEvidenceRow,
  DirectorResponsibility,
  DuplicityFinding,
  HallazgoMatrizLiteral,
  LegalCitationLink,
  LegalReferenceItem,
  NormativeHierarchyLevel,
  ObservacionDecision,
  PaymentCycleRow,
} from '../types/forensic';
import { exportCcrdLiteralMatrixExcel } from '../utils/exportExcel';
import { downloadSupervisorWordReport } from '../utils/exportWord';
import { calculateStringSHA256 } from '../utils/crypto';

interface Props {
  nombreCaso: string;
  activeEntity: AuditedEntity | null;
  auditor: AuditorProfile;
  periodo: AuditPeriodScope;
  paisNormativa: string;
  selloDigital: string;
  rawTextContext: string;
  informePreliminarText: string;
  actaLecturaText: string;
  recursosCount: number;
  replicasCount: number;
  contraReplicasCount: number;
  directors: DirectorResponsibility[];
  contractRows: ContractEvidenceRow[];
  paymentCycleRows: PaymentCycleRow[];
  observaciones: ObservacionDecision[];
  setObservaciones: React.Dispatch<React.SetStateAction<ObservacionDecision[]>>;
  hallazgos: HallazgoMatrizLiteral[];
  setHallazgos: React.Dispatch<React.SetStateAction<HallazgoMatrizLiteral[]>>;
  ccrdStages: CcrdStageStatus[];
  setCcrdStages: React.Dispatch<React.SetStateAction<CcrdStageStatus[]>>;
  duplicidades: DuplicityFinding[];
  setDuplicidades: React.Dispatch<React.SetStateAction<DuplicityFinding[]>>;
  legalLibrary: LegalReferenceItem[];
  onOpenLegalViewer: (ref: LegalReferenceItem) => void;
  onLogAction: (accion: string, detalle: string) => void;
}

const DEFAULT_STAGES: CcrdStageStatus[] = [
  {
    step: 1,
    title: 'Planificación y Análisis',
    description: 'Recepción de credenciales, análisis preliminar, evaluación de controles NOBACI e identificación de titulares.',
    keyActions: ['Acreditación', 'Revisión marco jerárquico', 'Decretos de directores'],
    status: 'Pendiente',
    evidenciaVerificada: 'Pendiente de extracción documental.',
  },
  {
    step: 2,
    title: 'Ejecución',
    description: 'Pruebas sustantivas y extracción literal 3.01+ sobre contratos, ciclo de pagos, RR. HH. e inventarios.',
    keyActions: ['Extracción 3.01+', 'Evaluación NOBACI/Ley 41-08', 'Control de duplicidades'],
    status: 'Pendiente',
    evidenciaVerificada: 'Pendiente de ejecución.',
  },
  {
    step: 3,
    title: 'Comunicación de Hallazgos',
    description: 'Lectura de hallazgos, recursos, réplicas y contra-réplicas garantizando debido proceso (Ley núm. 18-24).',
    keyActions: ['Acta de Lectura', 'Réplicas por período', 'Contra-Réplicas'],
    status: 'Pendiente',
    evidenciaVerificada: 'Pendiente de dossier contradictorio.',
  },
  {
    step: 4,
    title: 'Conclusión e Informe Final',
    description: 'Revisión previa de calidad y emisión del Informe Técnico del Supervisor y Matriz Excel 3.01+.',
    keyActions: ['Control de calidad', 'Aprobación matriz', 'Emisión Word/Excel'],
    status: 'Pendiente',
    evidenciaVerificada: 'Pendiente de cierre.',
  },
];

const HIERARCHY_PYRAMID: {
  key: NormativeHierarchyLevel;
  order: number;
  title: string;
  subtitle: string;
  color: string;
}[] = [
  { key: 'CONSTITUCION', order: 1, title: '1. Constitución', subtitle: 'Carta Magna y supremacía constitucional', color: 'border-purple-500/40 bg-purple-500/10 text-purple-200' },
  { key: 'TRATADOS_ISSAI_NIA', order: 2, title: '2. Tratados / ISSAI / NIA', subtitle: 'Normas internacionales de auditoría', color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200' },
  { key: 'LEY', order: 3, title: '3. Leyes', subtitle: 'Ley 18-24, 41-08, 498-06, 340-06, 10-04', color: 'border-sky-500/40 bg-sky-500/10 text-sky-200' },
  { key: 'DECRETO', order: 4, title: '4. Decretos y Reglamentos', subtitle: 'Decreto 527-09, Decreto 543-12', color: 'border-teal-500/40 bg-teal-500/10 text-teal-200' },
  { key: 'RESOLUCION_NOBACI', order: 5, title: '5. NOBACI / Resoluciones CGR', subtitle: 'ADC-3-006, ADC-03-004.19, ADC-3-001.3', color: 'border-amber-500/40 bg-amber-500/10 text-amber-200' },
  { key: 'NORMATIVA_INTERNA', order: 6, title: '6. Normativa Interna', subtitle: 'Manuales, políticas y procedimientos', color: 'border-slate-600 bg-slate-800/70 text-slate-200' },
];

const CCRD_AREAS_REFERENCIALES: Array<{
  idHallazgo: string;
  titulo: string;
  jerarquiaCriterio: NormativeHierarchyLevel;
  criterioTexto: string;
  responsableArea: string;
  entregable: string;
  leyesCitadas: LegalCitationLink[];
}> = [
  { idHallazgo: '3.1.01', titulo: 'Plan Anual de Compras y Contrataciones (PACC)', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 340-06 (Art. 33), Ley 498-06 (Arts. 24-25.d) y Decreto 543-12 (Art. 31)', responsableArea: 'Compras / Planificación', entregable: 'PACC Aprobado y Publicado en Portal DGCP', leyesCitadas: [{ norma: 'Ley núm. 340-06', articulo: 'Art. 33', jerarquia: 'LEY' }] },
  { idHallazgo: '3.1.02', titulo: 'Procesos de Compras Menores y Umbrales', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 340-06 (Art. 32) y NOBACI ADC-03-004.19', responsableArea: 'Comité de Compras / Adquisiciones', entregable: 'Expedientes con Pluralidad de Cotizaciones y Actas', leyesCitadas: [{ norma: 'Ley núm. 340-06', articulo: 'Art. 32', jerarquia: 'LEY' }] },
  { idHallazgo: '3.1.03', titulo: 'Activos Fijos, Inventarios y Custodia Patrimonial', jerarquiaCriterio: 'RESOLUCION_NOBACI', criterioTexto: 'NOBACI / NOBIS (Componente Activos Fijos) y ADC-3-001.3 (Inventarios)', responsableArea: 'Almacén / Activos Fijos', entregable: 'Inventario Físico Etiquetado y Conciliado', leyesCitadas: [{ norma: 'NOBACI ADC-3-001.3', articulo: 'Inventarios y Activos Fijos', jerarquia: 'RESOLUCION_NOBACI' }] },
  { idHallazgo: '3.1.04', titulo: 'Ejecución de Obras y Actas de Recepción', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 340-06 y Normas de Supervisión de Obras Públicas', responsableArea: 'Ingeniería / Obras / Supervisión', entregable: 'Cubicaciones y Actas de Recepción Definitiva', leyesCitadas: [{ norma: 'Ley núm. 340-06', articulo: 'Supervisión de Obras', jerarquia: 'LEY' }] },
  { idHallazgo: '3.2.01', titulo: 'Conciliaciones Bancarias y Disponibilidades', jerarquiaCriterio: 'RESOLUCION_NOBACI', criterioTexto: 'Normas Básicas de Tesorería Pública y NOBACI Ciclo Financiero', responsableArea: 'Tesorería / Contabilidad', entregable: 'Conciliaciones Mensuales Depuradas', leyesCitadas: [{ norma: 'Normas de Tesorería Pública', articulo: 'Conciliaciones', jerarquia: 'RESOLUCION_NOBACI' }] },
  { idHallazgo: '3.2.02', titulo: 'Nóminas y Pagos Especiales', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 18-24 (Arts. 10 y 38) y Ley núm. 41-08 de Función Pública', responsableArea: 'Tesorería / RR. HH.', entregable: 'Nóminas Visadas con Doble Firma y Control Previo', leyesCitadas: [{ norma: 'Ley núm. 18-24', articulo: 'Art. 10 y 38', jerarquia: 'LEY' }] },
  { idHallazgo: '3.2.03', titulo: 'Viáticos y Viajes Oficiales', jerarquiaCriterio: 'DECRETO', criterioTexto: 'Reglamento General de Viáticos y Rendición de Cuentas', responsableArea: 'Finanzas / Administración', entregable: 'Informes de Misión y Liquidaciones Documentadas', leyesCitadas: [{ norma: 'Reglamento de Viáticos', articulo: 'Liquidación', jerarquia: 'DECRETO' }] },
  { idHallazgo: '3.3.01', titulo: 'Gestión de RR. HH. y Declaraciones Juradas', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 41-08 (Art. 8 num. 12), Decreto 527-09 (Art. 3), Ley 311-14 y NOBACI ADC-3-006', responsableArea: 'Recursos Humanos', entregable: 'Manual de Cargos MAP y Declaraciones Juradas Ley 311-14', leyesCitadas: [{ norma: 'Ley núm. 41-08', articulo: 'Art. 8 num. 12', jerarquia: 'LEY' }, { norma: 'Ley núm. 311-14', articulo: 'Declaración Jurada', jerarquia: 'LEY' }] },
  { idHallazgo: '3.3.02', titulo: 'Evaluaciones de Desempeño del Personal', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 41-08 (Art. 50) y Metodología MAP', responsableArea: 'Recursos Humanos', entregable: 'Registros Anuales de Evaluación de Desempeño', leyesCitadas: [{ norma: 'Ley núm. 41-08', articulo: 'Art. 50', jerarquia: 'LEY' }] },
  { idHallazgo: '3.4.01', titulo: 'Contratos de Servicios y Pólizas de Garantía', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 340-06 y Decreto 543-12 (Garantía de Fiel Cumplimiento)', responsableArea: 'Consultoría Jurídica / Compras', entregable: 'Pólizas y Fianzas Vigentes Custodiadas', leyesCitadas: [{ norma: 'Ley núm. 340-06', articulo: 'Garantías Contractuales', jerarquia: 'LEY' }] },
  { idHallazgo: '3.4.02', titulo: 'Litigios, Demandas y Contingencias Legales', jerarquiaCriterio: 'TRATADOS_ISSAI_NIA', criterioTexto: 'NICSP 19 (Provisiones y Contingencias) / DIGECOG', responsableArea: 'Consultoría Jurídica / Contabilidad', entregable: 'Informe Trimestral de Litigios y Notas a EE. FF.', leyesCitadas: [{ norma: 'NICSP 19', articulo: 'Contingencias Legales', jerarquia: 'TRATADOS_ISSAI_NIA' }] },
  { idHallazgo: '3.5.01', titulo: 'Seguridad de la Información y Respaldos TI', jerarquiaCriterio: 'RESOLUCION_NOBACI', criterioTexto: 'Normas Tecnológicas Gubernamentales (OGTIC / OPTIC) y NORTIC', responsableArea: 'Tecnología de la Información (TI)', entregable: 'Respaldos Externos Cifrados y Plan de Contingencia', leyesCitadas: [{ norma: 'Normas OGTIC / OPTIC', articulo: 'Seguridad TI', jerarquia: 'RESOLUCION_NOBACI' }] },
  { idHallazgo: '3.5.02', titulo: 'Accesos Lógicos a Sistemas Core / ERP', jerarquiaCriterio: 'RESOLUCION_NOBACI', criterioTexto: 'Controles de Acceso Lógico (NOBACI / NOBIS) y Segregación de Funciones', responsableArea: 'Tecnología / Seguridad Informática', entregable: 'Bitácora de Bajas de Usuarios y Revisión de Perfiles', leyesCitadas: [{ norma: 'NOBACI / NOBIS', articulo: 'Accesos Lógicos ERP', jerarquia: 'RESOLUCION_NOBACI' }] },
  { idHallazgo: '3.6.01', titulo: 'Flota Vehicular y Control de Combustibles', jerarquiaCriterio: 'NORMATIVA_INTERNA', criterioTexto: 'Manual de Control de Flota, Combustibles y Activos Institucionales', responsableArea: 'Servicios Generales / Transporte', entregable: 'Bitácora de Kilometraje, Vales y Asignación Formal', leyesCitadas: [{ norma: 'Manual Control de Flota', articulo: 'Bitácora y Combustible', jerarquia: 'NORMATIVA_INTERNA' }] },
  { idHallazgo: '3.7.01', titulo: 'Cumplimiento Ambiental y Gestión de Residuos', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 64-00 sobre Medio Ambiente y Recursos Naturales', responsableArea: 'Gestión Ambiental / Servicios Generales', entregable: 'Permisos Ambientales Vigentes y Manifiestos de Residuos', leyesCitadas: [{ norma: 'Ley núm. 64-00', articulo: 'Permisos Ambientales', jerarquia: 'LEY' }] },
  { idHallazgo: '3.8.01', titulo: 'Seguimiento a Recomendaciones de Auditorías Anteriores', jerarquiaCriterio: 'LEY', criterioTexto: 'Ley núm. 18-24 (Obligaciones de los Titulares y Plan de Acción Correctiva)', responsableArea: 'Despacho Titular / Auditoría Interna', entregable: 'Matriz de Seguimiento y Evidencia de Subsanación', leyesCitadas: [{ norma: 'Ley núm. 18-24', articulo: 'Seguimiento Titulares', jerarquia: 'LEY' }] },
];

export const CcrdNobaciMatrixSection: React.FC<Props> = ({
  nombreCaso,
  activeEntity,
  auditor,
  periodo,
  paisNormativa,
  selloDigital,
  rawTextContext,
  informePreliminarText,
  actaLecturaText,
  recursosCount,
  replicasCount,
  contraReplicasCount,
  directors,
  contractRows,
  paymentCycleRows,
  observaciones,
  setObservaciones,
  hallazgos,
  setHallazgos,
  ccrdStages,
  setCcrdStages,
  duplicidades,
  setDuplicidades,
  legalLibrary,
  onOpenLegalViewer,
  onLogAction,
}) => {
  const [activeTab, setActiveTab] = useState<'observados' | 'correctos' | 'matriz' | 'duplicidades'>('matriz');
  const [extracting, setExtracting] = useState(false);
  const [detectingDups, setDetectingDups] = useState(false);
  const [evaluatingRowId, setEvaluatingRowId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick CGR/NOBACI Situational Evaluator State
  const [quickSituation, setQuickSituation] = useState('');
  const [quickCode, setQuickCode] = useState('3.01');
  const [evaluatingSituation, setEvaluatingSituation] = useState(false);

  const stagesToShow = ccrdStages.length > 0 ? ccrdStages : DEFAULT_STAGES;

  const { correctos, conObservacion, avgScore, riskCounts, blindajeStatus } = useMemo(() => {
    const ok = hallazgos.filter((h) => h.estado === 'Correcto / Cumple');
    const obs = hallazgos.filter((h) => h.estado !== 'Correcto / Cumple');
    const numericAvg =
      hallazgos.length > 0
        ? hallazgos.reduce((acc, h) => acc + (Number(h.puntaje0a10) || 0), 0) / hallazgos.length
        : 0;
    const alto = hallazgos.filter((h) => h.nivelRiesgo === 'Alto (Crítico)').length;
    const medio = hallazgos.filter((h) => h.nivelRiesgo === 'Medio (Moderado)').length;
    const bajo = hallazgos.filter((h) => h.nivelRiesgo === 'Bajo (Menor)').length;
    const status =
      hallazgos.length === 0
        ? 'Pendiente de Extracción'
        : numericAvg >= 8.5 && obs.length === 0
        ? 'Apto para Autoridades (Blindado 10/10)'
        : numericAvg >= 6.5
        ? 'Requiere Ajustes Puntuales'
        : 'Riesgo Crítico — Subsanación Obligatoria';

    return {
      correctos: ok,
      conObservacion: obs,
      avgScore: numericAvg.toFixed(1),
      riskCounts: { alto, medio, bajo },
      blindajeStatus: status,
    };
  }, [hallazgos]);

  // Inline draft for adding punctual articles & norms per finding ("Lo que debe ser")
  const [citationDraft, setCitationDraft] = useState<
    Record<string, { norma: string; articulo: string; jerarquia: NormativeHierarchyLevel }>
  >({});

  const handleLoadReferenceAreas = () => {
    const orderMap: Record<NormativeHierarchyLevel, number> = {
      CONSTITUCION: 1,
      TRATADOS_ISSAI_NIA: 2,
      LEY: 3,
      DECRETO: 4,
      RESOLUCION_NOBACI: 5,
      NORMATIVA_INTERNA: 6,
    };
    const existingCodes = new Set(hallazgos.map((h) => h.idHallazgo.trim().toLowerCase()));
    const newRows: HallazgoMatrizLiteral[] = CCRD_AREAS_REFERENCIALES.filter(
      (d) => !existingCodes.has(d.idHallazgo.toLowerCase())
    ).map((d, idx) => ({
      id: `hz-tpl-${Date.now()}-${idx}`,
      idHallazgo: d.idHallazgo,
      titulo: d.titulo,
      condicionLiteral: '',
      criterioTexto: `Lo que debe ser: ${d.criterioTexto}`,
      criterioAuditorOriginal: '',
      jerarquiaCriterio: d.jerarquiaCriterio,
      jerarquiaOrden: orderMap[d.jerarquiaCriterio] || 3,
      causa: '',
      efecto: '',
      estado: 'Con Observación / Mejora',
      nivelRiesgo: 'Medio (Moderado)',
      referenciaExacta: '',
      puntaje0a10: 0,
      recomendacionSupervisor: '',
      planAccionCorrectivo: '',
      responsableArea: d.responsableArea,
      entregable: d.entregable,
      leyesCitadas: d.leyesCitadas,
      origenDocumento: 'Áreas Referenciales CCRD (Abierto a todos los hallazgos)',
    }));

    if (newRows.length > 0) {
      setHallazgos((prev) => [...prev, ...newRows]);
      setActiveTab('matriz');
      onLogAction(
        'Carga de Áreas Referenciales CCRD',
        `Se incorporaron ${newRows.length} áreas base editables listas para documentar evidencia real sin límite de hallazgos.`
      );
    }
  };

  const handleExtractLiteral301 = async () => {
    setExtracting(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/extract-hallazgos-ccrd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName: activeEntity?.nombre || 'Entidad Auditada',
          paisNormativa,
          periodo,
          rawText: rawTextContext,
          informePreliminarText,
          actaLecturaText,
          recursosCount,
          replicasCount,
          contraReplicasCount,
          directors,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error extrayendo hallazgos literales 3.01+.');
      }

      setHallazgos(data.hallazgos || []);
      if (Array.isArray(data.ccrdStages)) {
        setCcrdStages(data.ccrdStages);
      }
      onLogAction(
        'Extracción Literal CCRD 3.01+',
        `Extraídos ${(data.hallazgos || []).length} acápite(s) literales del expediente real bajo Ley núm. 18-24.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo completar la extracción literal.');
    } finally {
      setExtracting(false);
    }
  };

  const handleEvaluateRowNobaci = async (row: HallazgoMatrizLiteral) => {
    setEvaluatingRowId(row.id);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/evaluate-nobaci-hallazgo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situacion: `${row.titulo}\n${row.condicionLiteral}\nCriterio previo: ${row.criterioTexto}`,
          idHallazgo: row.idHallazgo,
          entityName: activeEntity?.nombre || 'Entidad Pública',
          periodo: `${periodo.fechaDesde} a ${periodo.fechaHasta}`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error aplicando marco NOBACI/CGR.');
      }
      const d = data.data || {};
      const orderMap: Record<string, number> = {
        CONSTITUCION: 1,
        TRATADOS_ISSAI_NIA: 2,
        LEY: 3,
        DECRETO: 4,
        RESOLUCION_NOBACI: 5,
        NORMATIVA_INTERNA: 6,
      };
      const jer = (orderMap[String(d.jerarquiaCriterio)] ? d.jerarquiaCriterio : row.jerarquiaCriterio) as NormativeHierarchyLevel;

      setHallazgos((prev) =>
        prev.map((h) =>
          h.id === row.id
            ? {
                ...h,
                condicionLiteral: d.condicionLiteral || h.condicionLiteral,
                criterioAuditorOriginal: h.criterioAuditorOriginal || h.criterioTexto,
                criterioTexto: d.criterioTexto || h.criterioTexto,
                jerarquiaCriterio: jer,
                jerarquiaOrden: orderMap[jer] || h.jerarquiaOrden,
                causa: d.causa || h.causa,
                efecto: d.efecto || h.efecto,
                recomendacionSupervisor: d.recomendacionSupervisor || h.recomendacionSupervisor,
                planAccionCorrectivo: d.planAccionCorrectivo || h.planAccionCorrectivo,
                responsableArea: d.responsableArea || h.responsableArea,
                entregable: d.entregable || h.entregable,
                leyesCitadas: Array.isArray(d.leyesCitadas) && d.leyesCitadas.length > 0 ? d.leyesCitadas : h.leyesCitadas,
              }
            : h
        )
      );
      onLogAction(
        'Evaluación Supervisor CGR / NOBACI',
        `Evaluado hallazgo ${row.idHallazgo} contra Ley 41-08, Decretos 527-09 / 543-12 y NOBACI 3.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error evaluando hallazgo con NOBACI/CGR.');
    } finally {
      setEvaluatingRowId(null);
    }
  };

  const handleEvaluateQuickSituation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSituation.trim()) return;
    setEvaluatingSituation(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/evaluate-nobaci-hallazgo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situacion: quickSituation.trim(),
          idHallazgo: quickCode.trim() || `3.${String(hallazgos.length + 1).padStart(2, '0')}`,
          entityName: activeEntity?.nombre || 'Entidad Pública',
          periodo: `${periodo.fechaDesde} a ${periodo.fechaHasta}`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error evaluando situación bajo CGR / NOBACI.');
      }
      const d = data.data || {};
      const orderMap: Record<string, number> = {
        CONSTITUCION: 1,
        TRATADOS_ISSAI_NIA: 2,
        LEY: 3,
        DECRETO: 4,
        RESOLUCION_NOBACI: 5,
        NORMATIVA_INTERNA: 6,
      };
      const jer = (orderMap[String(d.jerarquiaCriterio)] ? d.jerarquiaCriterio : 'LEY') as NormativeHierarchyLevel;

      const newRow: HallazgoMatrizLiteral = {
        id: `hz-cgr-${Date.now()}`,
        idHallazgo: quickCode.trim() || `3.${String(hallazgos.length + 1).padStart(2, '0')}`,
        titulo: d.diagnosticoBrechas ? String(d.diagnosticoBrechas).slice(0, 95) : 'Evaluación CGR / NOBACI',
        condicionLiteral: d.condicionLiteral || quickSituation.trim(),
        criterioTexto: d.criterioTexto || 'Ley 41-08, Decreto 527-09, Ley 498-06, Decreto 543-12 y NOBACI 3.',
        jerarquiaCriterio: jer,
        jerarquiaOrden: orderMap[jer] || 3,
        causa: d.causa || '',
        efecto: d.efecto || '',
        estado: 'Con Observación / Mejora',
        puntaje0a10: 6.0,
        recomendacionSupervisor: d.recomendacionSupervisor || '',
        planAccionCorrectivo: d.planAccionCorrectivo || '',
        responsableArea: d.responsableArea || 'RR. HH. / Planificación / Compras',
        entregable: d.entregable || 'Manuales y Evidencia de Control Interno',
        leyesCitadas: Array.isArray(d.leyesCitadas) ? d.leyesCitadas : [],
        origenDocumento: 'Evaluación Técnica CGR / NOBACI',
      };

      setHallazgos((prev) => [...prev, newRow]);
      setQuickSituation('');
      setQuickCode(`3.${String(hallazgos.length + 2).padStart(2, '0')}`);
      onLogAction('Alta Hallazgo CGR / NOBACI', `Acápite ${newRow.idHallazgo} estructurado con Condición, Criterio, Causa, Efecto y Plan Correctivo.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo evaluar la situación.');
    } finally {
      setEvaluatingSituation(false);
    }
  };

  const handleDetectDuplicates = async () => {
    setDetectingDups(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/detect-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hallazgos,
          observaciones,
          legalLibrary,
          contractRows,
          paymentCycleRows,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error ejecutando detector de duplicidades.');
      }
      const found: DuplicityFinding[] = data.duplicates || [];
      setDuplicidades(found);
      setActiveTab('duplicidades');

      // Mark duplicate hallazgos in matrix visually
      const dupLabels = new Set(found.flatMap((d) => d.elementosInvolucrados.map((x) => x.toLowerCase())));
      setHallazgos((prev) =>
        prev.map((h) => {
          const hit = dupLabels.has(`${h.idHallazgo} ${h.titulo}`.toLowerCase());
          return hit ? { ...h, esDuplicado: true, detalleDuplicidad: 'Solapamiento detectado; revisar consolidación.' } : { ...h, esDuplicado: false, detalleDuplicidad: '' };
        })
      );

      onLogAction('Detección de Duplicidades', `Detectadas ${found.length} posible(s) duplicidad(es) en hallazgos, leyes y pagos.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error detectando duplicidades.');
    } finally {
      setDetectingDups(false);
    }
  };

  const handleIncludeDupAsObservation = (dup: DuplicityFinding) => {
    if (dup.incluidoEnObservaciones) return;
    const newObs: ObservacionDecision = {
      id: `obs-dup-${Date.now()}`,
      codigoObservacion: `OBS-DUP-${String(observaciones.length + 1).padStart(2, '0')}`,
      titulo: `Duplicidad Detectada (${dup.tipo}): ${dup.elementosInvolucrados.join(' vs ')}`,
      descripcionPreliminar: dup.descripcion,
      descargoAlegato: 'Pendiente de aclaración o consolidación por la entidad auditada.',
      decision: 'SE_MANTIENE',
      criterioEvaluacion: `${dup.descripcion} Similitud detectada: ${dup.similitudPct}%.`,
      procedimientoUtilizado: 'Cruce programático de consistencia y control de duplicidades de supervisión.',
      fundamentacionLegal: 'Ley núm. 18-24 (CCRD), Normas NOBACI e ISSAI 4000 sobre integridad y no duplicidad de cargos.',
      normativaPais: paisNormativa,
      severidad: dup.tipo === 'CONTRATO_PAGO' ? 'CRÍTICA' : 'ALTA',
    };
    setObservaciones((prev) => [...prev, newObs]);
    setDuplicidades((prev) =>
      prev.map((d) => (d.id === dup.id ? { ...d, incluidoEnObservaciones: true } : d))
    );
    onLogAction('Inclusión de Duplicidad como Observación', `Se registró ${newObs.codigoObservacion} en el pliego oficial.`);
  };

  const handleAddManualRow = () => {
    const nextCode = `3.${String(hallazgos.length + 1).padStart(2, '0')}`;
    const newRow: HallazgoMatrizLiteral = {
      id: `hz-man-${Date.now()}`,
      idHallazgo: nextCode,
      titulo: 'Nuevo Acápite de Verificación',
      condicionLiteral: '',
      criterioTexto: '',
      criterioAuditorOriginal: '',
      jerarquiaCriterio: 'LEY',
      jerarquiaOrden: 3,
      causa: '',
      efecto: '',
      estado: 'Con Observación / Mejora',
      nivelRiesgo: 'Medio (Moderado)',
      referenciaExacta: '',
      puntaje0a10: 7.0,
      recomendacionSupervisor: '',
      planAccionCorrectivo: '',
      responsableArea: '',
      entregable: '',
      leyesCitadas: [],
      origenDocumento: 'Edición Manual en Línea',
    };
    setHallazgos((prev) => [...prev, newRow]);
    setActiveTab('matriz');
  };

  const updateRow = (id: string, patch: Partial<HallazgoMatrizLiteral>) => {
    setHallazgos((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  const deleteRow = (id: string) => {
    setHallazgos((prev) => prev.filter((h) => h.id !== id));
  };

  const handleClickCitation = async (cite: LegalCitationLink, hallazgoCode: string) => {
    const key = cite.norma.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = legalLibrary.find(
      (l) =>
        l.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key) ||
        key.includes(l.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );
    if (existing) {
      onOpenLegalViewer(existing);
      return;
    }
    const sha256 = await calculateStringSHA256(`${cite.norma}_${cite.articulo}_${hallazgoCode}`);
    onOpenLegalViewer({
      id: `law-quick-${Date.now()}`,
      numeroNorma: cite.norma,
      titulo: cite.norma,
      jerarquia: cite.jerarquia || 'LEY',
      jerarquiaOrden: 3,
      articulosPuntuales: cite.articulo ? [cite.articulo] : [],
      hallazgosVinculados: [hallazgoCode],
      url: cite.url || '',
      ubicacionFuente: 'Cita vinculada desde Matriz 3.01+',
      resumenAplicacion: `Norma invocada en el hallazgo ${hallazgoCode}.`,
      sha256,
      fechaRegistro: new Date().toISOString(),
    });
  };

  const displayedRows =
    activeTab === 'correctos' ? correctos : activeTab === 'observados' ? conObservacion : hallazgos;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Verificación Guía CCRD (Ley núm. 18-24) &amp; Matriz Literal Abierta NOBACI / CGR
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Extracción Ilimitada (Todos los Hallazgos) • 100% Editable
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Extracción abierta e ilimitada de todos los hallazgos del informe (3.01 en adelante o cualquier numeración), artículos y normas puntuales como Criterio (Lo que debe ser), control de duplicidades y exportación Excel/Word.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExtractLiteral301}
            disabled={extracting}
            className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
            {extracting ? 'Extrayendo Hallazgos...' : 'Extraer Todos los Hallazgos (Ilimitado)'}
          </button>

          <button
            type="button"
            onClick={handleLoadReferenceAreas}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Incorpora áreas referenciales base editables (sin límite ni datos ficticios) para complementar los hallazgos extraídos"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-sky-400" />
            Áreas Referenciales CCRD
          </button>

          <button
            type="button"
            onClick={handleDetectDuplicates}
            disabled={detectingDups}
            className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {detectingDups ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyCheck className="w-3.5 h-3.5" />}
            Detectar Duplicidades
          </button>

          <button
            type="button"
            onClick={() =>
              exportCcrdLiteralMatrixExcel({
                nombreCaso,
                entity: activeEntity,
                auditor,
                periodo,
                hallazgos,
                duplicidades,
                legalLibrary,
                ccrdStages: stagesToShow,
                paymentCycleRows,
              })
            }
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel 3.01+ (.xlsx)
          </button>

          <button
            type="button"
            onClick={() =>
              downloadSupervisorWordReport({
                nombreCaso,
                entity: activeEntity,
                auditor,
                periodo,
                paisNormativa,
                selloDigital,
                hallazgos,
                duplicidades,
                legalLibrary,
                ccrdStages: stagesToShow,
                directors,
                paymentCycleRows,
              })
            }
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Genera el informe del Supervisor / Revisor sin mención alguna a IA"
          >
            <FileText className="w-3.5 h-3.5" />
            Informe Supervisor (.doc)
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 1. Orden Jerárquico de los Criterios */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
        <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          Orden Jerárquico Estricto de los Criterios de Auditoría (De Mayor a Menor Rango Legal)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
          {HIERARCHY_PYRAMID.map((lvl) => (
            <div key={lvl.key} className={`rounded-lg border p-2.5 ${lvl.color}`}>
              <div className="font-bold">{lvl.title}</div>
              <div className="text-[10px] opacity-85 mt-0.5 leading-snug">{lvl.subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 4 Etapas Guía de Fiscalización CCRD (Ley núm. 18-24) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Etapas de la Guía de Fiscalización CCRD (Ley núm. 18-24)
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-emerald-400">Correctos: {correctos.length}</span>
            <span className="text-amber-300">Con Observación: {conObservacion.length}</span>
            <span className="text-sky-300">Promedio Nota: {avgScore}/10</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stagesToShow.map((st) => (
            <div key={st.step} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[10.5px] text-sky-400">ETAPA {st.step}</span>
                <select
                  value={st.status}
                  onChange={(e) => {
                    const nextVal = e.target.value as CcrdStageStatus['status'];
                    setCcrdStages((prev) => {
                      const base = prev.length > 0 ? prev : DEFAULT_STAGES;
                      return base.map((item) => (item.step === st.step ? { ...item, status: nextVal } : item));
                    });
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer bg-slate-900 ${
                    st.status === 'Completado'
                      ? 'text-emerald-300 border-emerald-500/40'
                      : st.status === 'En Proceso'
                      ? 'text-amber-300 border-amber-500/40'
                      : 'text-slate-400 border-slate-700'
                  }`}
                >
                  <option value="Completado">Completado</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Pendiente">Pendiente</option>
                </select>
              </div>
              <div className="font-bold text-white">{st.title}</div>
              <p className="text-[11px] text-slate-400 leading-snug">{st.description}</p>
              <div className="text-[10.5px] text-emerald-300/90 bg-slate-900/90 rounded p-1.5 border border-slate-800">
                {st.evidenciaVerificada}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2B. Distribución Estadística de Riesgos & Blindaje Institucional CCRD */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Distribución Estadística por Nivel de Riesgo y Resumen de Blindaje (Ley núm. 18-24)
          </div>
          <span className="text-[10.5px] font-mono text-slate-400">
            Total evaluados: {hallazgos.length}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Risk Bars */}
          <div className="lg:col-span-7 space-y-2.5 text-xs">
            {[
              { label: 'Alto (Crítico)', count: riskCounts.alto, bar: 'bg-red-500', text: 'text-red-300' },
              { label: 'Medio (Moderado)', count: riskCounts.medio, bar: 'bg-amber-500', text: 'text-amber-300' },
              { label: 'Bajo (Menor)', count: riskCounts.bajo, bar: 'bg-emerald-500', text: 'text-emerald-300' },
            ].map((item) => {
              const pct = hallazgos.length > 0 ? Math.round((item.count / hallazgos.length) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-semibold ${item.text}`}>{item.label}</span>
                    <span className="font-mono text-slate-300">
                      {item.count} hallazgo(s) ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full ${item.bar} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3 Blindaje KPI Cards */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-2.5 text-center">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Hallazgos</div>
              <div className="text-xl font-bold text-white font-mono mt-0.5">{hallazgos.length}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Promedio 0-10</div>
              <div className="text-xl font-bold text-sky-300 font-mono mt-0.5">{avgScore}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col justify-center">
              <div className="text-[10px] uppercase text-slate-400 font-semibold">Blindaje CCRD</div>
              <div className="text-[11px] font-bold text-emerald-300 leading-tight mt-1">{blindajeStatus}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Evaluador Situacional Senior CGR / NOBACI / Ley 41-08 / MAP / DGCP */}
      <form
        onSubmit={handleEvaluateQuickSituation}
        className="bg-slate-950/90 border border-indigo-500/30 rounded-xl p-4 space-y-3 text-xs"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-bold text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Evaluador Técnico CGR / NOBACI (Ley 41-08, Decreto 527-09, Ley 498-06, Decreto 543-12 y NOBACI 3)
          </div>
          <span className="text-[10.5px] text-slate-400">
            Genera Diagnóstico de Brechas + Redacción CGR + Plan Correctivo (RR. HH., Planificación, Compras, Inventarios)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-2">
            <input
              type="text"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value)}
              placeholder="Código (3.01)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono font-bold"
            />
          </div>
          <div className="md:col-span-8">
            <input
              type="text"
              value={quickSituation}
              onChange={(e) => setQuickSituation(e.target.value)}
              placeholder="Describa la situación o hallazgo real detectado (ej: ausencia de manual de cargos aprobado por MAP, PACC desactualizado, falta de entradas en almacén)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={!quickSituation.trim() || evaluatingSituation}
              className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              {evaluatingSituation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
              Evaluar CGR
            </button>
          </div>
        </div>
      </form>

      {/* 4. Tabs & Matrix Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'matriz', label: `📊 Matriz Completa 3.01+ (${hallazgos.length})` },
            { id: 'correctos', label: `🟢 Componentes Correctos (${correctos.length})` },
            { id: 'observados', label: `🔴 Con Observación / Mejora (${conObservacion.length})` },
            { id: 'duplicidades', label: `🪞 Duplicidades Detectadas (${duplicidades.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === t.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddManualRow}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Añadir Acápite Manual
        </button>
      </div>

      {/* 5. Tab Content */}
      {activeTab === 'duplicidades' ? (
        <div className="space-y-3">
          {duplicidades.length === 0 ? (
            <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
              No hay duplicidades registradas todavía. Presione <strong>"Detectar Duplicidades"</strong> para auditar coincidencias en hallazgos, leyes y pagos.
            </div>
          ) : (
            duplicidades.map((d) => (
              <div key={d.id} className="bg-slate-950 border border-amber-500/40 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-[10.5px]">
                      {d.tipo} • {d.similitudPct}% similitud
                    </span>
                    <strong className="text-white">{d.elementosInvolucrados.join(' vs ')}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleIncludeDupAsObservation(d)}
                    disabled={d.incluidoEnObservaciones}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer ${
                      d.incluidoEnObservaciones
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {d.incluidoEnObservaciones ? 'Incluida en Observaciones' : 'Incluir como Observación Formal'}
                  </button>
                </div>
                <p className="text-slate-300">{d.descripcion}</p>
                <p className="text-emerald-300/90 text-[11px]">
                  <strong>Mejora Recomendada:</strong> {d.recomendacionMejora}
                </p>
              </div>
            ))
          )}
        </div>
      ) : displayedRows.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
          <p>
            No hay acápites en esta vista. Cargue su documento en el Paso 2 o Informe Preliminar en el Paso 4 y presione{' '}
            <strong className="text-sky-300">"Extraer Hallazgos Literales (3.01+)"</strong> o añada uno manualmente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRows.map((h) => (
            <div
              key={h.id}
              className={`bg-slate-950/90 border rounded-xl p-4 space-y-3 text-xs ${
                h.esDuplicado
                  ? 'border-amber-500/60'
                  : h.estado === 'Correcto / Cumple'
                  ? 'border-emerald-700/50'
                  : 'border-slate-800'
              }`}
            >
              {/* Row Top Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <input
                    type="text"
                    value={h.idHallazgo}
                    onChange={(e) => updateRow(h.id, { idHallazgo: e.target.value })}
                    className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono font-bold text-amber-300 text-center"
                  />
                  <input
                    type="text"
                    value={h.titulo}
                    onChange={(e) => updateRow(h.id, { titulo: e.target.value })}
                    className="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-bold text-white"
                  />
                  {h.esDuplicado && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                      Posible Duplicado
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={h.estado}
                    onChange={(e) =>
                      updateRow(h.id, { estado: e.target.value as HallazgoMatrizLiteral['estado'] })
                    }
                    className={`px-2 py-1 rounded border font-bold text-[11px] bg-slate-900 ${
                      h.estado === 'Correcto / Cumple'
                        ? 'text-emerald-300 border-emerald-500/40'
                        : 'text-red-300 border-red-500/40'
                    }`}
                  >
                    <option value="Correcto / Cumple">Correcto / Cumple</option>
                    <option value="Con Observación / Mejora">Con Observación / Mejora</option>
                  </select>

                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-2 py-1">
                    <span className="text-[10px] text-slate-400">Nota:</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={h.puntaje0a10}
                      onChange={(e) =>
                        updateRow(h.id, { puntaje0a10: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })
                      }
                      className="w-12 bg-transparent text-sky-300 font-mono font-bold text-right focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">/10</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEvaluateRowNobaci(h)}
                    disabled={evaluatingRowId === h.id}
                    className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {evaluatingRowId === h.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Scale className="w-3 h-3" />
                    )}
                    Evaluar CGR / NOBACI
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRow(h.id)}
                    className="text-slate-500 hover:text-red-400 p-1 rounded cursor-pointer"
                    title="Eliminar acápite"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Hierarchy, Risk Level, Exact Reference & Responsible Area Strip */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Jerarquía del Criterio</label>
                  <select
                    value={h.jerarquiaCriterio}
                    onChange={(e) => {
                      const k = e.target.value as NormativeHierarchyLevel;
                      const match = HIERARCHY_PYRAMID.find((p) => p.key === k);
                      updateRow(h.id, { jerarquiaCriterio: k, jerarquiaOrden: match?.order || 3 });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sky-300 font-semibold"
                  >
                    {HIERARCHY_PYRAMID.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Nivel de Riesgo</label>
                  <select
                    value={h.nivelRiesgo || 'Medio (Moderado)'}
                    onChange={(e) =>
                      updateRow(h.id, {
                        nivelRiesgo: e.target.value as HallazgoMatrizLiteral['nivelRiesgo'],
                      })
                    }
                    className={`w-full bg-slate-900 border rounded px-2.5 py-1.5 font-semibold ${
                      h.nivelRiesgo === 'Alto (Crítico)'
                        ? 'text-red-300 border-red-500/40'
                        : h.nivelRiesgo === 'Bajo (Menor)'
                        ? 'text-emerald-300 border-emerald-500/40'
                        : 'text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <option value="Alto (Crítico)">Alto (Crítico)</option>
                    <option value="Medio (Moderado)">Medio (Moderado)</option>
                    <option value="Bajo (Menor)">Bajo (Menor)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Referencia Exacta (Pág. / Sección)</label>
                  <input
                    type="text"
                    value={h.referenciaExacta || ''}
                    onChange={(e) => updateRow(h.id, { referenciaExacta: e.target.value })}
                    placeholder="Ej: Pág. 12 | Guía CCRD Etapa 2"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Área Responsable</label>
                  <input
                    type="text"
                    value={h.responsableArea}
                    onChange={(e) => updateRow(h.id, { responsableArea: e.target.value })}
                    placeholder="RR. HH. / Planificación / Compras / Almacén"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Entregable Requerido</label>
                  <input
                    type="text"
                    value={h.entregable}
                    onChange={(e) => updateRow(h.id, { entregable: e.target.value })}
                    placeholder="Manual / PEI / PACC / Formulario de Almacén"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
              </div>

              {/* Original Auditor Criterion Input */}
              <div>
                <label className="text-[10.5px] text-slate-400 block mb-1">
                  Criterio Original del Auditor (Borre o compare frente al Criterio Normativo 10/10)
                </label>
                <input
                  type="text"
                  value={h.criterioAuditorOriginal || ''}
                  onChange={(e) => updateRow(h.id, { criterioAuditorOriginal: e.target.value })}
                  placeholder="Cita textual o genérica empleada originalmente en el borrador / informe preliminar..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300"
                />
              </div>

              {/* Editable CGR Attributes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">
                    Condición Literal (Extraída del Documento Real)
                  </label>
                  <textarea
                    rows={3}
                    value={h.condicionLiteral}
                    onChange={(e) => updateRow(h.id, { condicionLiteral: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-sky-300 font-semibold block mb-1">
                    Criterio (Lo que debe ser) — Artículos y Normas Puntuales en Orden Jerárquico
                  </label>
                  <textarea
                    rows={3}
                    value={h.criterioTexto}
                    onChange={(e) => updateRow(h.id, { criterioTexto: e.target.value })}
                    placeholder="Indique lo que debe ser según la Constitución, Tratados/ISSAI, Leyes (artículo y numeral), Decretos y Normas NOBACI..."
                    className="w-full bg-slate-900 border border-sky-700/50 rounded-lg p-2 text-sky-200 leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Causa Raíz</label>
                  <textarea
                    rows={2}
                    value={h.causa}
                    onChange={(e) => updateRow(h.id, { causa: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-slate-400 block mb-1">Efecto / Riesgo Institucional</label>
                  <textarea
                    rows={2}
                    value={h.efecto}
                    onChange={(e) => updateRow(h.id, { efecto: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-emerald-300 font-semibold block mb-1">
                    Resultado del Análisis del Supervisor / Revisor Técnico
                  </label>
                  <textarea
                    rows={2}
                    value={h.recomendacionSupervisor}
                    onChange={(e) => updateRow(h.id, { recomendacionSupervisor: e.target.value })}
                    className="w-full bg-slate-900 border border-emerald-800/50 rounded-lg p-2 text-emerald-100"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-amber-300 font-semibold block mb-1">
                    Plan de Acción Correctivo (Pasos Concretos)
                  </label>
                  <textarea
                    rows={2}
                    value={h.planAccionCorrectivo}
                    onChange={(e) => updateRow(h.id, { planAccionCorrectivo: e.target.value })}
                    className="w-full bg-slate-900 border border-amber-800/40 rounded-lg p-2 text-amber-100"
                  />
                </div>
              </div>

              {/* Artículos y Normas Puntuales que Aplican como Criterio (Lo que debe ser) */}
              <div className="pt-2.5 border-t border-slate-800/70 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[10.5px] text-sky-300 font-bold flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    Artículos y Normas Puntuales Aplicables como Criterio (Lo que debe ser — Clic para leer):
                  </span>
                </div>

                {h.leyesCitadas && h.leyesCitadas.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {h.leyesCitadas.map((cite, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center rounded-md bg-sky-500/15 border border-sky-500/30 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => handleClickCitation(cite, h.idHallazgo)}
                          className="px-2.5 py-1 hover:bg-sky-500/30 text-sky-300 text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3 text-sky-400" />
                          {cite.norma}
                          {cite.articulo ? ` (${cite.articulo})` : ''}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateRow(h.id, {
                              leyesCitadas: (h.leyesCitadas || []).filter((_, cIdx) => cIdx !== idx),
                            })
                          }
                          className="px-1.5 py-1 text-slate-400 hover:text-red-300 hover:bg-red-950/40 text-[10px] cursor-pointer"
                          title="Quitar artículo/norma"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline Adder for Punctual Norm & Article */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Norma puntual (Ej: Ley núm. 41-08 / NOBACI)"
                    value={citationDraft[h.id]?.norma || ''}
                    onChange={(e) =>
                      setCitationDraft((prev) => ({
                        ...prev,
                        [h.id]: {
                          norma: e.target.value,
                          articulo: prev[h.id]?.articulo || '',
                          jerarquia: prev[h.id]?.jerarquia || 'LEY',
                        },
                      }))
                    }
                    className="sm:col-span-4 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white"
                  />
                  <input
                    type="text"
                    placeholder="Artículo / Numeral exacto (Ej: Art. 8 num. 12)"
                    value={citationDraft[h.id]?.articulo || ''}
                    onChange={(e) =>
                      setCitationDraft((prev) => ({
                        ...prev,
                        [h.id]: {
                          norma: prev[h.id]?.norma || '',
                          articulo: e.target.value,
                          jerarquia: prev[h.id]?.jerarquia || 'LEY',
                        },
                      }))
                    }
                    className="sm:col-span-4 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-sky-200"
                  />
                  <select
                    value={citationDraft[h.id]?.jerarquia || 'LEY'}
                    onChange={(e) =>
                      setCitationDraft((prev) => ({
                        ...prev,
                        [h.id]: {
                          norma: prev[h.id]?.norma || '',
                          articulo: prev[h.id]?.articulo || '',
                          jerarquia: e.target.value as NormativeHierarchyLevel,
                        },
                      }))
                    }
                    className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300"
                  >
                    {HIERARCHY_PYRAMID.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const d = citationDraft[h.id];
                      if (!d || !d.norma.trim()) return;
                      updateRow(h.id, {
                        leyesCitadas: [
                          ...(h.leyesCitadas || []),
                          {
                            norma: d.norma.trim(),
                            articulo: d.articulo.trim(),
                            jerarquia: d.jerarquia,
                          },
                        ],
                      });
                      setCitationDraft((prev) => ({
                        ...prev,
                        [h.id]: { norma: '', articulo: '', jerarquia: 'LEY' },
                      }));
                    }}
                    className="sm:col-span-2 px-2 py-1 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/40 rounded text-[11px] font-semibold cursor-pointer"
                  >
                    + Añadir Criterio
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
