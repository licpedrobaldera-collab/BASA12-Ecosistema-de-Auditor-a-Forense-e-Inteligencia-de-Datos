export interface AuditedEntity {
  id: string;
  nombre: string;
  siglas: string;
  rncNif: string;
  sector: string;
  paisCodigo: string;
  moneda: string;
  simboloMoneda: string;
  descripcion?: string;
  creadaEn?: string;
}

export interface EvidenceFile {
  name: string;
  size: number;
  type: string;
  sha256: string;
  uploadDate: string;
  contentSnippet?: string;
  extractedText?: string;
  extractedRows?: Record<string, any>[];
  numericAmounts?: number[];
  parsedFormat?: string;
  sheetNames?: string[];
  pageCount?: number;
  recordCount?: number;
}

export interface ContractEvidenceRow {
  id: string;
  contratoId: string;
  proveedor: string;
  rnc: string;
  montoOriginal: number;
  montoAdenda: number;
  adendaPct: number;
  fechaContrato: string;
  fechaAdenda: string;
  origen: string;
  objeto: string;
  esAnomalo: boolean;
  motivoAlerta: string;
}

export interface BenfordDigitResult {
  digit: number;
  observedCount: number;
  observedPct: number;
  expectedPct: number;
  diff: number;
  isAnomaly: boolean;
}

export interface ForensicRiskMetrics {
  nivelRiesgo: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'MODERADO';
  exposicionEstimada: string;
  accionInmediata: string;
}

export interface ForensicThresholds {
  adendaMaxPct: number;
  benfordMaxDeviationPct: number;
  fraccionamientoMontoMax: number;
  concentracionProveedorPct: number;
  alertaSonora: boolean;
  notificacionesActivas: boolean;
}

export interface RealtimeAlert {
  id: string;
  timestamp: string;
  tipo: 'ADENDA_EXCESIVA' | 'BENFORD_ANOMALIA' | 'FRACCIONAMIENTO' | 'CONCENTRACION';
  severidad: 'CRÍTICA' | 'ALTA' | 'MEDIA';
  titulo: string;
  descripcion: string;
  valorDetectado: string;
  umbralLimite: string;
  referencia?: string;
}

export interface AuditorProfile {
  nombre: string;
  cedulaId: string;
  cargo: string;
  entidad: string;
  pais: string;
  colegiatura?: string;
}

export interface AuditPeriodScope {
  fechaDesde: string;
  fechaHasta: string;
  alcancePericial: string;
}

export interface DossierSectionItem {
  id: string;
  numero?: number;
  titulo: string;
  contenido: string;
  fecha: string;
  sha256: string;
  archivos: EvidenceFile[];
}

export interface ObservacionDecision {
  id: string;
  codigoObservacion: string;
  titulo: string;
  descripcionPreliminar: string;
  descargoAlegato: string;
  decision: 'SE_MANTIENE' | 'SE_ELIMINA' | 'SE_MODIFICA';
  criterioEvaluacion: string;
  procedimientoUtilizado: string;
  fundamentacionLegal: string;
  normativaPais: string;
  severidad: 'CRÍTICA' | 'ALTA' | 'MEDIA' | 'LEVE';
  montoInvolucrado?: number;
}

export interface TraceabilityLog {
  id: string;
  timestamp: string;
  accion: string;
  usuario: string;
  detalle: string;
  sha256: string;
  etapa: 'ENTRADA' | 'EVALUACION' | 'DICTAMEN' | 'SALIDA';
}

export interface PaisNormativaConfig {
  codigo: string;
  nombre: string;
  bandera: string;
  leyContrataciones: string;
  leyControlInterno: string;
  organoFiscalizador: string;
  normasAuditoria: string;
  idiomasDisponibles: string[];
}

export interface ForensicAnalysisResult {
  resumenEjecutivo: string;
  banderasRojas: string[];
  codigoPython: string;
  explicacionTecnica: string;
  fundamentoLegal: string;
  metricasRiesgo: ForensicRiskMetrics;
  digitalHash: string;
  timestamp: string;
  casoNombre: string;
  observacionesDecididas?: ObservacionDecision[];
}

export interface CaseSession {
  id: string;
  codigoCaso?: string;
  nombreCaso: string;
  estado?: 'EN_PROCESO' | 'DICTAMEN_EMITIDO' | 'CERRADO';
  timestamp: string;
  updatedAt?: string;
  raizCaso: string;
  origenes: string[];
  requerimiento: string;
  selloDigital: string;
  entity?: AuditedEntity;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  paisNormativa?: string;
  idioma?: string;
  evidenceFile?: EvidenceFile | null;
  contractRows?: ContractEvidenceRow[];
  observaciones?: ObservacionDecision[];
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  informePreliminar?: DossierSectionItem;
  replicas?: DossierSectionItem[];
  traceabilityLogs?: TraceabilityLog[];
  resultado?: ForensicAnalysisResult | null;
}
