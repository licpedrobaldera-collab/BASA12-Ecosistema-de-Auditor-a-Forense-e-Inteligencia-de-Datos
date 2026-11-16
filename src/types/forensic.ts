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
  urlPortal?: string;
  creadaEn?: string;
  actualizadaEn?: string;
}

export interface EvidenceFile {
  name: string;
  size: number;
  type: string;
  sha256: string;
  uploadDate: string;
  sourceType?: 'ARCHIVO' | 'URL_PORTAL' | 'TEXTO_DIRECTO';
  sourceUrl?: string;
  contentSnippet?: string;
  extractedText?: string;
  extractedRows?: Record<string, any>[];
  numericAmounts?: number[];
  parsedFormat?: string;
  sheetNames?: string[];
  pageCount?: number;
  recordCount?: number;
  discoveredLinks?: { label: string; url: string }[];
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

export interface PaymentCycleRow {
  id: string;
  ordenNumero: string;
  contratoId: string;
  beneficiario: string;
  rnc: string;
  fechaSolicitud: string;
  numeroFacturaEcf: string;
  fechaFactura: string;
  tieneRecepcionConduce: boolean;
  fechaRecepcion: string;
  numeroLibramientoPago: string;
  fechaPago: string;
  bancoCuenta: string;
  montoFacturado: number;
  retencionesImpuestos: number;
  montoPagadoNeto: number;
  estadoCiclo:
    | 'COMPLETO'
    | 'SIN_RECEPCION'
    | 'SIN_COMPROBANTE'
    | 'PAGO_FRACCIONADO'
    | 'EXCEDE_CONTRATO'
    | 'DUPLICADO'
    | 'EN_REVISION';
  observacionPago: string;
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
  tipo: 'ADENDA_EXCESIVA' | 'BENFORD_ANOMALIA' | 'FRACCIONAMIENTO' | 'CONCENTRACION' | 'CICLO_PAGO' | 'DUPLICIDAD';
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

export interface DecreeSource {
  id: string;
  url: string;
  titulo: string;
  ubicacionOrigen: string;
  numeroDecreto: string;
  fechaDecreto: string;
  extractoLiteral: string;
  fechaConsulta: string;
  sha256: string;
  verificadoWeb?: boolean;
}

export interface DirectorResponsibility {
  id: string;
  nombre: string;
  cedulaId?: string;
  cargo: string;
  periodoNumero: number;
  fechaInicioGestion: string;
  fechaFinGestion: string;
  enFuncionesActuales?: boolean;
  numeroDecretoNombramiento: string;
  fechaDecretoNombramiento: string;
  numeroDecretoSalida?: string;
  fechaDecretoSalida?: string;
  fuentes: DecreeSource[];
  responsabilidadObservaciones: string;
  montoResponsabilidadEstimado?: number;
  notas?: string;
}

export interface DirectorSegregationSummary {
  directorId: string;
  directorNombre: string;
  cargo: string;
  periodoGestion: string;
  numeroDecreto: string;
  fuentesCount: number;
  contratosCount: number;
  contratosMonto: number;
  adendasMonto: number;
  pagosCount: number;
  pagosMontoNeto: number;
  observacionesCount: number;
  observacionesMonto: number;
  replicasCount: number;
  contraReplicasCount: number;
  riesgoCalculado: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO';
  resumenResponsabilidad: string;
}

export interface DossierSectionItem {
  id: string;
  numero?: number;
  tipoEscrito?: 'ACTA' | 'RECURSO' | 'INFORME_PRELIMINAR' | 'REPLICA' | 'CONTRA_REPLICA';
  titulo: string;
  contenido: string;
  fecha: string;
  periodoEtiqueta?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  directorId?: string;
  directorNombre?: string;
  fuenteOrigen?: string;
  urlOrigen?: string;
  sha256: string;
  archivos: EvidenceFile[];
}

export interface PreReviewIssue {
  id: string;
  criterio: string;
  estado: 'CUMPLE' | 'ATENCION' | 'CRITICO';
  detalle: string;
  recomendacion: string;
}

export type PreReviewDocType = 'ACTA_LECTURA' | 'INFORME_PRELIMINAR' | 'INFORME_FINAL';

export interface InteractivePreReviewReport {
  tipoDocumento: PreReviewDocType;
  puntuacionPreparacion: number;
  estadoAprobacion: 'APROBADO_REVISION' | 'CON_OBSERVACIONES_PREVIAS' | 'BLOQUEADO';
  resumenEjecutivo: string;
  hallazgosRevision: PreReviewIssue[];
  mejorasSugeridas: string[];
  textoMejoradoSugerido?: string;
  timestamp: string;
  sha256: string;
  modelUsed?: string;
}

export type NormativeHierarchyLevel =
  | 'CONSTITUCION'
  | 'TRATADOS_ISSAI_NIA'
  | 'LEY'
  | 'DECRETO'
  | 'RESOLUCION_NOBACI'
  | 'NORMATIVA_INTERNA';

export interface LegalCitationLink {
  norma: string;
  articulo: string;
  jerarquia?: NormativeHierarchyLevel;
  url?: string;
}

export interface LegalReferenceItem {
  id: string;
  numeroNorma: string;
  titulo: string;
  jerarquia: NormativeHierarchyLevel;
  jerarquiaOrden: number;
  articulosPuntuales: string[];
  hallazgosVinculados: string[];
  url: string;
  ubicacionFuente: string;
  resumenAplicacion: string;
  textoExtraido?: string;
  esDuplicado?: boolean;
  detalleDuplicidad?: string;
  sha256: string;
  fechaRegistro: string;
}

export interface HallazgoMatrizLiteral {
  id: string;
  idHallazgo: string;
  titulo: string;
  condicionLiteral: string;
  criterioTexto: string;
  jerarquiaCriterio: NormativeHierarchyLevel;
  jerarquiaOrden: number;
  causa: string;
  efecto: string;
  estado: 'Correcto / Cumple' | 'Con Observación / Mejora';
  nivelRiesgo?: 'Alto (Crítico)' | 'Medio (Moderado)' | 'Bajo (Menor)';
  puntaje0a10: number;
  criterioAuditorOriginal?: string;
  referenciaExacta?: string;
  recomendacionSupervisor: string;
  planAccionCorrectivo: string;
  responsableArea: string;
  entregable: string;
  leyesCitadas: LegalCitationLink[];
  esDuplicado?: boolean;
  detalleDuplicidad?: string;
  origenDocumento?: string;
  directorResponsable?: string;
}

export interface DuplicityFinding {
  id: string;
  tipo: 'HALLAZGO' | 'LEY_CITA' | 'CONTRATO_PAGO';
  elementosInvolucrados: string[];
  similitudPct: number;
  descripcion: string;
  recomendacionMejora: string;
  incluidoEnObservaciones: boolean;
}

export interface CcrdStageStatus {
  step: number;
  title: string;
  description: string;
  keyActions: string[];
  status: 'Completado' | 'En Proceso' | 'Pendiente';
  evidenciaVerificada: string;
}

export interface CaseIteration {
  id: string;
  version: number;
  timestamp: string;
  autor: string;
  etapa: string;
  resumenCambio: string;
  sha256: string;
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
  directorId?: string;
  directorNombre?: string;
  fechaHecho?: string;
  periodoEtiqueta?: string;
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
  mejorasControlInterno?: string[];
  codigoPython: string;
  explicacionTecnica: string;
  fundamentoLegal: string;
  metricasRiesgo: ForensicRiskMetrics;
  digitalHash: string;
  timestamp: string;
  casoNombre: string;
  observacionesDecididas?: ObservacionDecision[];
}

export interface StepGuideResponse {
  estadoPaso: 'LISTO' | 'ATENCION' | 'PENDIENTE';
  diagnostico: string;
  pasosRecomendados: string[];
  mejorasSugeridas: string[];
  siguientePasoMensaje: string;
}

export interface CaseSession {
  id: string;
  codigoCaso?: string;
  nombreCaso: string;
  sessionOwnerId?: string;
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
  paymentCycleRows?: PaymentCycleRow[];
  observaciones?: ObservacionDecision[];
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  informePreliminar?: DossierSectionItem;
  replicas?: DossierSectionItem[];
  contraReplicas?: DossierSectionItem[];
  directors?: DirectorResponsibility[];
  preReviewReports?: Partial<Record<PreReviewDocType, InteractivePreReviewReport>>;
  matrizHallazgosLiteral?: HallazgoMatrizLiteral[];
  legalLibrary?: LegalReferenceItem[];
  duplicidades?: DuplicityFinding[];
  ccrdStages?: CcrdStageStatus[];
  iterations?: CaseIteration[];
  traceabilityLogs?: TraceabilityLog[];
  resultado?: ForensicAnalysisResult | null;
}
