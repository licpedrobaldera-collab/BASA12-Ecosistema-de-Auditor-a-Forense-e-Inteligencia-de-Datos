import React, { useEffect, useMemo, useState } from 'react';
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
  Copy,
  Check,
  PenLine,
  Download,
  ChevronDown,
  ChevronUp,
  Flame,
  X,
  Activity,
  Cpu,
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
import { downloadSupervisorDocxReport, downloadSupervisorWordReport } from '../utils/exportWord';
import { calculateStringSHA256 } from '../utils/crypto';
import {
  HeatmapVisualizer,
  SeverityFilterBand,
  getHeatmapStyle,
  getSeverityBand,
} from './HeatmapVisualizer';

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
  const [activeTab, setActiveTab] = useState<'observados' | 'correctos' | 'matriz' | 'duplicidades' | 'recomendacion_ccrd'>('matriz');
  const [extracting, setExtracting] = useState(false);
  const [detectingDups, setDetectingDups] = useState(false);
  const [evaluatingRowId, setEvaluatingRowId] = useState<string | null>(null);
  const [generatingCcrdRowId, setGeneratingCcrdRowId] = useState<string | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [loadingSampleWord, setLoadingSampleWord] = useState(false);
  const [sampleModelNotice, setSampleModelNotice] = useState<string | null>(null);
  const [expandedTranscriptions, setExpandedTranscriptions] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilterBand>('ALL');
  const [heatmapSortBySeverity, setHeatmapSortBySeverity] = useState(true);
  const [highlightedHallazgoId, setHighlightedHallazgoId] = useState<string | null>(null);

  // Quick CGR/NOBACI Situational Evaluator State
  const [quickSituation, setQuickSituation] = useState('');
  const [quickCode, setQuickCode] = useState('3.01');
  const [evaluatingSituation, setEvaluatingSituation] = useState(false);

  // CCRD Recommendation Generator State (60-90 words, 1 paragraph, MAE + "Instruir a...")
  const [ccrdForm, setCcrdForm] = useState({
    targetHallazgoId: '',
    entidad: '',
    condicion: '',
    criterio: '',
    causaComentario: '',
    efecto: '',
    conclusion: '',
  });
  const [ccrdDraftResult, setCcrdDraftResult] = useState('');
  const [generatingCcrd, setGeneratingCcrd] = useState(false);
  const [copiedCcrd, setCopiedCcrd] = useState(false);
  const [appliedCcrdFeedback, setAppliedCcrdFeedback] = useState<string | null>(null);
  const [checkingAiHealth, setCheckingAiHealth] = useState(false);
  const [aiHealth, setAiHealth] = useState<{
    version: string;
    recommendedMode: string;
    ollama: { available: boolean; message: string; models: string[] };
    geminiCloud: { configured: boolean; active: boolean; modelUsed: string; message: string };
    documentaryEngine: { active: boolean; message: string };
  } | null>(null);

  const handleCheckAiHealth = async (probeCloud = true) => {
    setCheckingAiHealth(true);
    try {
      const resp = await fetch(`/api/forensic/ai-health?probe=${probeCloud ? '1' : '0'}`);
      const data = await resp.json();
      if (resp.ok && data.success) {
        setAiHealth(data);
        if (probeCloud) {
          onLogAction('Pre-Check Motores IA', `Modo activo verificado: ${data.recommendedMode}`);
        }
      }
    } catch {
      // Fail gracefully; autonomous documentary engine remains available
    } finally {
      setCheckingAiHealth(false);
    }
  };

  useEffect(() => {
    handleCheckAiHealth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ccrdWordCount = useMemo(() => {
    const trimmed = ccrdDraftResult.trim();
    return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  }, [ccrdDraftResult]);

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

  const handleLoadSampleWordReport = async () => {
    setLoadingSampleWord(true);
    setErrorMsg(null);
    setSampleModelNotice(null);
    try {
      const entityLabel = activeEntity?.nombre || 'Entidad Pública Modelo (Configuración BASA12)';
      const sampleResp = await fetch(`/api/forensic/sample-word-report?format=json&entity=${encodeURIComponent(entityLabel)}`);
      const sampleData = await sampleResp.json();
      if (!sampleResp.ok || !sampleData.success) {
        throw new Error(sampleData.error || 'No se pudo generar el informe modelo Word (.docx).');
      }

      const extractResp = await fetch('/api/forensic/extract-hallazgos-ccrd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName: entityLabel,
          paisNormativa,
          periodo,
          rawText: sampleData.extractedText,
          informePreliminarText: sampleData.extractedText,
          actaLecturaText,
          recursosCount,
          replicasCount,
          contraReplicasCount,
          directors,
        }),
      });
      const extractData = await extractResp.json();
      if (!extractResp.ok || !extractData.success) {
        throw new Error(extractData.error || 'Error ejecutando la auditoría sobre el informe modelo Word.');
      }

      setHallazgos(extractData.hallazgos || []);
      if (Array.isArray(extractData.ccrdStages)) {
        setCcrdStages(extractData.ccrdStages);
      }
      setActiveTab('matriz');
      setSampleModelNotice(
        `Informe Word modelo "${sampleData.fileName}" procesado en línea (SHA-256: ${String(sampleData.sha256 || '').slice(0, 16)}... · ${(extractData.hallazgos || []).length} hallazgos 3.01+ via ${extractData.modelUsed || 'Motor Autogestionado'}). Puede sustituirlo por cualquier otro archivo en el Paso 2/4.`
      );
      onLogAction(
        'Ejecución Modelo Word (.docx)',
        `Configurado y procesado informe Word modelo (${(extractData.hallazgos || []).length} hallazgos 3.01+ verificados).`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo procesar el informe modelo Word.');
    } finally {
      setLoadingSampleWord(false);
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

  const handleGenerateRowCcrdRecommendation = async (row: HallazgoMatrizLiteral) => {
    setGeneratingCcrdRowId(row.id);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/generate-ccrd-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idHallazgo: row.idHallazgo,
          entidad: activeEntity?.nombre || 'Entidad Pública Auditada',
          condicion: row.condicionLiteral || row.titulo,
          criterio: row.criterioTexto || row.criterioAuditorOriginal || '',
          causaComentario: row.causa || 'Deficiencia de supervisión operativa y falta de controles preventivos documentados.',
          efecto: row.efecto || 'Riesgo institucional de incumplimiento normativo y vulnerabilidad en el control interno.',
          conclusion: `${row.titulo}${row.responsableArea ? `. Área vinculada: ${row.responsableArea}` : ''}`,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error redactando recomendación estilo CCRD.');
      }
      const texto = String(data.recomendacion || '').trim();
      if (texto) {
        updateRow(row.id, { recomendacionSupervisor: texto });
        onLogAction(
          'Recomendación CCRD Generada',
          `Hallazgo ${row.idHallazgo}: redactada recomendación CCRD (${data.wordCount || texto.split(/\s+/).length} palabras) dirigida al Titular/MAE.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo redactar la recomendación CCRD para el hallazgo.');
    } finally {
      setGeneratingCcrdRowId(null);
    }
  };

  const handleLoadHallazgoIntoCcrdForm = (hallazgoId: string) => {
    const found = hallazgos.find((h) => h.id === hallazgoId);
    if (!found) {
      setCcrdForm((prev) => ({ ...prev, targetHallazgoId: '' }));
      return;
    }
    setCcrdForm({
      targetHallazgoId: found.id,
      entidad: activeEntity?.nombre || '',
      condicion: found.condicionLiteral || '',
      criterio: found.criterioTexto || found.criterioAuditorOriginal || '',
      causaComentario: found.causa || '',
      efecto: found.efecto || '',
      conclusion: found.titulo || '',
    });
    if (found.recomendacionSupervisor) {
      setCcrdDraftResult(found.recomendacionSupervisor);
    }
    setAppliedCcrdFeedback(null);
  };

  const handleGenerateStandaloneCcrdRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingCcrd(true);
    setErrorMsg(null);
    setAppliedCcrdFeedback(null);
    try {
      const resp = await fetch('/api/forensic/generate-ccrd-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entidad: ccrdForm.entidad.trim() || activeEntity?.nombre || 'Entidad Pública Auditada',
          condicion: ccrdForm.condicion,
          criterio: ccrdForm.criterio,
          causaComentario: ccrdForm.causaComentario,
          efecto: ccrdForm.efecto,
          conclusion: ccrdForm.conclusion,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo redactar la recomendación estilo CCRD.');
      }
      const texto = String(data.recomendacion || '').trim();
      setCcrdDraftResult(texto);
      onLogAction(
        'Redacción Recomendación CCRD',
        `Generada recomendación estilo CCRD (${data.wordCount || texto.split(/\s+/).length} palabras) para ${ccrdForm.entidad.trim() || activeEntity?.nombre || 'la entidad'}.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generando recomendación estilo CCRD.');
    } finally {
      setGeneratingCcrd(false);
    }
  };

  const handleCopyCcrdRecommendation = async () => {
    if (!ccrdDraftResult.trim()) return;
    try {
      await navigator.clipboard.writeText(ccrdDraftResult.trim());
      setCopiedCcrd(true);
      setTimeout(() => setCopiedCcrd(false), 2000);
    } catch {
      // Fallback noop if clipboard unavailable
    }
  };

  const handleApplyCcrdRecommendationToMatrix = () => {
    if (!ccrdDraftResult.trim()) return;
    if (ccrdForm.targetHallazgoId) {
      const target = hallazgos.find((h) => h.id === ccrdForm.targetHallazgoId);
      updateRow(ccrdForm.targetHallazgoId, {
        recomendacionSupervisor: ccrdDraftResult.trim(),
      });
      setAppliedCcrdFeedback(
        `Aplicada al acápite ${target?.idHallazgo || ''} en la Matriz 3.01+ y lista para exportar a Word/Excel.`
      );
      onLogAction(
        'Aplicación Recomendación CCRD',
        `Se actualizó el acápite ${target?.idHallazgo || ''} con la recomendación estilo CCRD (${ccrdWordCount} palabras).`
      );
    } else {
      const nextCode = `3.${String(hallazgos.length + 1).padStart(2, '0')}`;
      const newRow: HallazgoMatrizLiteral = {
        id: `hz-ccrd-${Date.now()}`,
        idHallazgo: nextCode,
        titulo: (ccrdForm.conclusion || ccrdForm.condicion || 'Hallazgo con Recomendación CCRD').slice(0, 95),
        condicionLiteral: ccrdForm.condicion.trim(),
        criterioTexto: ccrdForm.criterio.trim(),
        criterioAuditorOriginal: '',
        jerarquiaCriterio: 'LEY',
        jerarquiaOrden: 3,
        causa: ccrdForm.causaComentario.trim(),
        efecto: ccrdForm.efecto.trim(),
        estado: 'Con Observación / Mejora',
        nivelRiesgo: 'Medio (Moderado)',
        referenciaExacta: '',
        puntaje0a10: 6.5,
        recomendacionSupervisor: ccrdDraftResult.trim(),
        planAccionCorrectivo: '',
        responsableArea: 'MAE / Unidades Competentes',
        entregable: 'Evidencia de Cumplimiento de Recomendación CCRD',
        leyesCitadas: [],
        origenDocumento: 'Redactor de Recomendación CCRD',
      };
      setHallazgos((prev) => [...prev, newRow]);
      setCcrdForm((prev) => ({ ...prev, targetHallazgoId: newRow.id }));
      setAppliedCcrdFeedback(
        `Creado acápite ${nextCode} en la Matriz 3.01+ con la recomendación estilo CCRD.`
      );
      onLogAction(
        'Alta Hallazgo con Recomendación CCRD',
        `Se registró ${nextCode} en la Matriz 3.01+ (${ccrdWordCount} palabras).`
      );
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

  const handleDownloadBasaV2Zip = async () => {
    setDownloadingZip(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/download-basa-v2-zip');
      if (!resp.ok) {
        throw new Error('No se pudo generar el archivo ZIP V2 Full.');
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'BASA_HALLAZGOS_INTELLIGENCE_PRO_V2_FULL.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onLogAction(
        'Descarga BASA V2 Full ZIP',
        'Descargado paquete standalone BASA_HALLAZGOS_INTELLIGENCE_PRO_V2_FULL.zip (4 Fases + Modo Ollama Local + 22 Columnas).'
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error descargando el paquete ZIP V2 Full.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleExportCsv22 = () => {
    const headers = [
      'Código',
      'Hallazgo actual',
      'Transcripción íntegra',
      'Condición',
      'Criterio',
      'Comparación',
      'Causa',
      'Efecto',
      'Riesgo',
      'Evidencia',
      'Cuantificación',
      'Responsabilidad',
      'Recomendación actual',
      'Deficiencias',
      'Duplicidad',
      'Hallazgo relacionado',
      'Justificación de conservar/eliminar/consolidar',
      'Puntaje 0–10',
      'Nivel',
      'Qué falta para 10/10',
      'Versión mejorada 10/10',
      'Referencias normativas',
      'Ubicación',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = hallazgos.map((h) => [
      h.idHallazgo,
      h.titulo,
      h.transcripcionIntegra || h.condicionLiteral,
      h.condicionLiteral,
      h.criterioTexto,
      h.comparacion || '',
      h.causa,
      h.efecto,
      h.riesgoDetalle || h.nivelRiesgo || '',
      h.evidenciaSoporte || '',
      h.cuantificacion || '',
      h.responsabilidadDetalle || h.responsableArea,
      h.recomendacionSupervisor,
      h.deficienciasRedaccion || '',
      typeof h.duplicidadMax === 'number' ? `${Math.round(h.duplicidadMax * 100)}%` : h.esDuplicado ? 'Alta' : '0%',
      h.hallazgoRelacionado || '',
      h.justificacionDecision || h.estadoRecomendado || h.estado,
      Number(h.puntaje0a10 || 0).toFixed(1),
      h.nivelSolidezV2 || '',
      h.queFaltaPara10 || h.planAccionCorrectivo,
      h.versionMejorada10 || '',
      (h.leyesCitadas || []).map((l) => `${l.norma}${l.articulo ? ` (${l.articulo})` : ''}`).join(' | '),
      h.ubicacionExacta || h.referenciaExacta || h.seccionPadre || '',
    ]);
    const csvContent = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BASA_V2_Matriz_22_Columnas_${(nombreCaso || 'Caso').replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const baseTabRows =
    activeTab === 'correctos' ? correctos : activeTab === 'observados' ? conObservacion : hallazgos;

  const displayedRows = useMemo(() => {
    if (severityFilter === 'ALL') return baseTabRows;
    return baseTabRows.filter((h) => getSeverityBand(h.puntaje0a10) === severityFilter);
  }, [baseTabRows, severityFilter]);

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
            onClick={handleExportCsv22}
            className="px-3 py-2 bg-teal-600/20 hover:bg-teal-600/30 text-teal-200 border border-teal-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV 22 Cols (.csv)
          </button>

          <button
            type="button"
            onClick={handleDownloadBasaV2Zip}
            disabled={downloadingZip}
            title="Descarga el paquete Python/Streamlit V2 Full (Fases 1–4 + Modo IA Local Ollama + Motor Documental + Matriz 22 columnas)"
            className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            {downloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            BASA V2 Full (.zip)
          </button>

          <button
            type="button"
            onClick={handleLoadSampleWordReport}
            disabled={loadingSampleWord}
            title="Genera y ejecuta en línea un informe de auditoría modelo en Word (.docx) para configuración y pruebas, reemplazable luego por cualquier otro informe real"
            className="px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 disabled:bg-slate-800 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {loadingSampleWord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loadingSampleWord ? 'Procesando Word...' : 'Ejemplo Word (.docx)'}
          </button>

          <a
            href="/api/forensic/sample-word-report"
            download="Informe_Auditoria_Modelo_Configuracion_BASA12.docx"
            title="Descarga el archivo Word (.docx) de ejemplo para inspeccionarlo, adaptarlo o usarlo como plantilla"
            className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Plantilla .docx
          </a>

          <button
            type="button"
            onClick={() =>
              downloadSupervisorDocxReport({
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
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            title="Genera y descarga el Informe del Supervisor en formato Word nativo (.docx)"
          >
            <FileText className="w-3.5 h-3.5" />
            Word (.docx)
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
            title="Genera el informe del Supervisor / Revisor en formato clásico (.doc)"
          >
            <FileText className="w-3.5 h-3.5" />
            Informe (.doc)
          </button>
        </div>
      </div>

      {sampleModelNotice && (
        <div className="bg-cyan-950/35 border border-cyan-500/30 rounded-lg p-3 text-xs text-cyan-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{sampleModelNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSampleModelNotice(null)}
            className="text-cyan-400 hover:text-cyan-200 cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 0. Pre-Check Salud de Motores IA Autogestionados (v8.0.0-FINAL-PROD — Sin pedir claves) */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2 flex-wrap">
              <span>Motores Analíticos Autogestionados (Auto-Cascada v8.0.0)</span>
              {aiHealth && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Activo: {aiHealth.recommendedMode}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                Cloud Multi-Modelo:{' '}
                <strong className={aiHealth?.geminiCloud.active ? 'text-emerald-300' : 'text-amber-300'}>
                  {aiHealth ? aiHealth.geminiCloud.message : 'Verificando...'}
                </strong>
              </span>
              <span>•</span>
              <span>
                Ollama Local:{' '}
                <strong className={aiHealth?.ollama.available ? 'text-emerald-300' : 'text-slate-300'}>
                  {aiHealth ? aiHealth.ollama.message : 'Comprobando...'}
                </strong>
              </span>
              <span>•</span>
              <span className="text-sky-300 font-medium">Motor Documental Forense: 100% Operativo</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleCheckAiHealth(true)}
          disabled={checkingAiHealth}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-violet-200 border border-violet-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 self-start lg:self-center"
        >
          {checkingAiHealth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-violet-400" />}
          {checkingAiHealth ? 'Verificando Motores...' : 'Verificar Salud Motores IA'}
        </button>
      </div>

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

      {/* 2C. HeatmapVisualizer — Mapa de Calor de Severidad Forense por Puntaje 0–10 */}
      <HeatmapVisualizer
        hallazgos={hallazgos}
        severityFilter={severityFilter}
        onSeverityFilterChange={(band) => {
          setSeverityFilter(band);
          if (activeTab === 'duplicidades' || activeTab === 'recomendacion_ccrd') {
            setActiveTab('matriz');
          }
        }}
        sortBySeverity={heatmapSortBySeverity}
        onToggleSortBySeverity={() => setHeatmapSortBySeverity((prev) => !prev)}
        highlightedHallazgoId={highlightedHallazgoId}
        onSelectHallazgo={(h, band) => {
          if (activeTab !== 'matriz') setActiveTab('matriz');
          if (severityFilter !== 'ALL' && band !== severityFilter) {
            setSeverityFilter('ALL');
          }
          setHighlightedHallazgoId(h.id);
          setTimeout(() => {
            document.getElementById(`hallazgo-card-${h.id}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 80);
        }}
      />

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
            { id: 'recomendacion_ccrd', label: '✍️ Recomendación CCRD (60–90 pal.)' },
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
      {activeTab === 'recomendacion_ccrd' ? (
        <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <PenLine className="w-4 h-4 text-emerald-400" />
                Redactor Técnico de Recomendación de Auditoría — Estilo CCRD (60 a 90 palabras)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Genera 1 solo párrafo corto (60–90 palabras), dirigido al Titular/MAE, iniciando con <strong>&quot;Instruir a...&quot;</strong>, señalando departamentos responsables, acción concreta de control y cerrando exclusivamente con la base legal del criterio suministrado.
              </p>
            </div>
            <div className="min-w-[240px]">
              <label className="text-[10px] text-slate-400 block mb-1">Precargar insumos desde Matriz 3.01+</label>
              <select
                value={ccrdForm.targetHallazgoId}
                onChange={(e) => handleLoadHallazgoIntoCcrdForm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sky-200 font-medium"
              >
                <option value="">-- Nuevo hallazgo / Redacción libre --</option>
                {hallazgos.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.idHallazgo} — {h.titulo.slice(0, 55)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <form onSubmit={handleGenerateStandaloneCcrdRecommendation} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] text-slate-300 font-semibold block mb-1">Entidad (Nombre de la institución)</label>
                <input
                  type="text"
                  value={ccrdForm.entidad || activeEntity?.nombre || ''}
                  onChange={(e) => setCcrdForm((p) => ({ ...p, entidad: e.target.value }))}
                  placeholder="Ej: Ministerio / Ayuntamiento / Dirección General..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-[10.5px] text-slate-300 font-semibold block mb-1">Conclusión del hallazgo</label>
                <input
                  type="text"
                  value={ccrdForm.conclusion}
                  onChange={(e) => setCcrdForm((p) => ({ ...p, conclusion: e.target.value }))}
                  placeholder="Síntesis concluyente del auditor sobre la deficiencia..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-[10.5px] text-slate-300 font-semibold block mb-1">Condición (Hecho detectado)</label>
                <textarea
                  rows={3}
                  value={ccrdForm.condicion}
                  onChange={(e) => setCcrdForm((p) => ({ ...p, condicion: e.target.value }))}
                  placeholder="Pegar texto exacto de la condición detectada..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10.5px] text-sky-300 font-semibold block mb-1">Criterio (Leyes, decretos, resoluciones o NOBACI)</label>
                <textarea
                  rows={3}
                  value={ccrdForm.criterio}
                  onChange={(e) => setCcrdForm((p) => ({ ...p, criterio: e.target.value }))}
                  placeholder="Pegar artículos, leyes, decretos o resoluciones citadas en el criterio..."
                  className="w-full bg-slate-900 border border-sky-700/50 rounded-lg p-2.5 text-sky-200"
                />
              </div>
              <div>
                <label className="text-[10.5px] text-slate-300 font-semibold block mb-1">Causa / Comentario de la entidad</label>
                <textarea
                  rows={2}
                  value={ccrdForm.causaComentario}
                  onChange={(e) => setCcrdForm((p) => ({ ...p, causaComentario: e.target.value }))}
                  placeholder="Pegar causa origen y/o comentario presentado por la entidad..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300"
                />
              </div>
              <div>
                <label className="text-[10.5px] text-slate-300 font-semibold block mb-1">Efecto (Impacto / Riesgo)</label>
                <textarea
                  rows={2}
                  value={ccrdForm.efecto}
                  onChange={(e) => setCcrdForm((p) => ({ ...p, efecto: e.target.value }))}
                  placeholder="Pegar efecto institucional, financiero o administrativo..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="text-[11px] text-slate-400">
                Regla CCRD: Máximo 1 párrafo corto (60–90 palabras) • Tono imperativo • Sin normas inventadas.
              </div>
              <button
                type="submit"
                disabled={generatingCcrd || (!ccrdForm.condicion.trim() && !ccrdForm.criterio.trim())}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {generatingCcrd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generatingCcrd ? 'Redactando (60–90 palabras)...' : 'Generar Recomendación CCRD'}
              </button>
            </div>
          </form>

          {ccrdDraftResult && (
            <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Recomendación de Auditoría Generada (Editable)
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded font-mono font-bold text-[11px] border ${
                      ccrdWordCount >= 60 && ccrdWordCount <= 90
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {ccrdWordCount} palabras {ccrdWordCount >= 60 && ccrdWordCount <= 90 ? '• Rango CCRD OK (60–90)' : '• Meta: 60–90'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCcrdRecommendation}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCcrd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCcrd ? 'Copiado' : 'Copiar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCcrdRecommendationToMatrix}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {ccrdForm.targetHallazgoId ? 'Aplicar al Hallazgo Seleccionado' : 'Añadir a Matriz 3.01+'}
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={ccrdDraftResult}
                onChange={(e) => setCcrdDraftResult(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 text-xs leading-relaxed"
              />
              {appliedCcrdFeedback && (
                <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {appliedCcrdFeedback}
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'duplicidades' ? (
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
          {severityFilter !== 'ALL' && baseTabRows.length > 0 ? (
            <div className="space-y-2">
              <p>
                No hay hallazgos con severidad{' '}
                <strong className="text-red-300">{severityFilter}</strong> en esta pestaña.
              </p>
              <button
                type="button"
                onClick={() => setSeverityFilter('ALL')}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Mostrar todos los hallazgos ({baseTabRows.length})
              </button>
            </div>
          ) : (
            <p>
              No hay acápites en esta vista. Cargue su documento en el Paso 2 o Informe Preliminar en el Paso 4 y presione{' '}
              <strong className="text-sky-300">&quot;Extraer Hallazgos Literales (3.01+)&quot;</strong> o añada uno manualmente.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {severityFilter !== 'ALL' && (
            <div className="flex items-center justify-between gap-2 bg-red-950/30 border border-red-500/40 rounded-lg px-3.5 py-2 text-xs text-red-200">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  Filtro Heatmap activo: mostrando <strong>{displayedRows.length}</strong> de{' '}
                  <strong>{baseTabRows.length}</strong> hallazgo(s) ({severityFilter === 'CRITICAL' ? 'Severidad Crítica: puntaje 0.0–4.9' : severityFilter}).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSeverityFilter('ALL')}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Limpiar filtro
              </button>
            </div>
          )}

          {displayedRows.map((h) => {
            const hmStyle = getHeatmapStyle(h.puntaje0a10);
            return (
            <div
              id={`hallazgo-card-${h.id}`}
              key={h.id}
              className={`bg-slate-950/90 border rounded-xl p-4 space-y-3 text-xs transition-all ${
                highlightedHallazgoId === h.id
                  ? 'border-sky-400 ring-2 ring-sky-500/40'
                  : h.esDuplicado
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

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${hmStyle.badgeClass}`}>
                    {hmStyle.label}
                  </span>

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
                    onClick={() => handleGenerateRowCcrdRecommendation(h)}
                    disabled={generatingCcrdRowId === h.id}
                    title="Redacta 1 párrafo corto (60-90 palabras) dirigido al Titular/MAE iniciando con 'Instruir a...'"
                    className="px-2.5 py-1 bg-emerald-600/25 hover:bg-emerald-600/45 text-emerald-200 border border-emerald-500/40 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {generatingCcrdRowId === h.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <PenLine className="w-3 h-3" />
                    )}
                    Recomendación CCRD (60–90)
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

              {/* Hierarchy, CCRD Stage, Risk Level, Exact Reference & Responsible Area Strip */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
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
                  <label className="text-[10.5px] text-slate-400 block mb-1">Etapa Guía CCRD</label>
                  <select
                    value={h.etapaCcrd || 2}
                    onChange={(e) =>
                      updateRow(h.id, {
                        etapaCcrd: Number(e.target.value) as 1 | 2 | 3 | 4,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-300 font-semibold"
                  >
                    <option value={1}>Etapa 1: Planificación</option>
                    <option value={2}>Etapa 2: Ejecución</option>
                    <option value={3}>Etapa 3: Comunicación</option>
                    <option value={4}>Etapa 4: Conclusión</option>
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
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="text-[10.5px] text-emerald-300 font-semibold">
                      Recomendación CCRD / Resultado del Supervisor
                    </label>
                    {h.recomendacionSupervisor.trim() && (
                      <span className="text-[10px] font-mono text-emerald-400/90">
                        {h.recomendacionSupervisor.trim().split(/\s+/).filter(Boolean).length} palabras
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={3}
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

              {/* Evaluación V2 Full (13 Dimensiones + Sección Padre + Transcripción Íntegra + Mejora 10/10) */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 space-y-2.5 text-[11px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {h.seccionPadre && (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                        Sección: {h.seccionPadre}
                      </span>
                    )}
                    {h.ubicacionExacta && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        📍 {h.ubicacionExacta}
                      </span>
                    )}
                    {h.nivelSolidezV2 && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold">
                        Nivel: {h.nivelSolidezV2}
                      </span>
                    )}
                    {h.estadoRecomendado && (
                      <span
                        className={`px-2 py-0.5 rounded font-bold border ${
                          h.estadoRecomendado === 'CONSERVAR'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : h.estadoRecomendado.startsWith('ELIMINAR')
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-sky-500/15 text-sky-200 border-sky-500/30'
                        }`}
                      >
                        Decisión: {h.estadoRecomendado}
                      </span>
                    )}
                    {typeof h.duplicidadMax === 'number' && h.duplicidadMax > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono">
                        Similitud máx.: {Math.round(h.duplicidadMax * 100)}%
                        {h.hallazgoRelacionado ? ` (${h.hallazgoRelacionado})` : ''}
                      </span>
                    )}
                  </div>

                  {h.transcripcionIntegra && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTranscriptions((prev) => ({ ...prev, [h.id]: !prev[h.id] }))
                      }
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {expandedTranscriptions[h.id] ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      {expandedTranscriptions[h.id]
                        ? 'Ocultar Transcripción Íntegra'
                        : `Ver Transcripción Íntegra (${h.transcripcionIntegra.length} chars)`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-slate-300">
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                    <strong className="text-sky-300 block mb-0.5">Comparación (Condición vs Criterio)</strong>
                    <span>{h.comparacion || 'Pendiente de contrastación normativa.'}</span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                    <strong className="text-sky-300 block mb-0.5">Evidencia y Cuantificación</strong>
                    <span>
                      {h.evidenciaSoporte || 'Ver documento.'}{' '}
                      {h.cuantificacion ? `| Cuantif.: ${h.cuantificacion}` : ''}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2">
                    <strong className="text-amber-300 block mb-0.5">Qué falta para 10/10 y Deficiencias</strong>
                    <span>{h.queFaltaPara10 || h.deficienciasRedaccion || 'Validar evidencias de cierre.'}</span>
                  </div>
                </div>

                {h.versionMejorada10 && (
                  <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-lg p-2.5">
                    <strong className="text-emerald-300 block mb-1">Versión Propuesta 10/10 (Editable):</strong>
                    <textarea
                      rows={2}
                      value={h.versionMejorada10}
                      onChange={(e) => updateRow(h.id, { versionMejorada10: e.target.value })}
                      className="w-full bg-slate-950 border border-emerald-900/50 rounded p-2 text-emerald-100 text-[11px]"
                    />
                  </div>
                )}

                {expandedTranscriptions[h.id] && h.transcripcionIntegra && (
                  <div className="bg-slate-950 border border-sky-800/40 rounded-lg p-2.5 space-y-1">
                    <div className="text-[10.5px] font-bold text-sky-300">
                      Transcripción Íntegra Completa (Fase 3 — Base de Evaluación Real):
                    </div>
                    <textarea
                      rows={8}
                      value={h.transcripcionIntegra}
                      onChange={(e) => updateRow(h.id, { transcripcionIntegra: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-2 font-mono text-[10.5px] text-slate-200 leading-relaxed"
                    />
                  </div>
                )}
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
          );
          })}
        </div>
      )}
    </section>
  );
};
