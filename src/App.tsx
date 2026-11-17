/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import {
  History,
  Sparkles,
  Sliders,
  UserCheck,
  Calendar,
  Clock,
  Save,
  Building2,
  Eye,
  LayoutList,
  Layers,
  CheckCircle2,
  Plus,
  Database,
  LogIn,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { EvidenceSection, StructuredExtractionPayload } from './components/EvidenceSection';
import { AnalysisSection } from './components/AnalysisSection';
import { ResultsSection } from './components/ResultsSection';
import { BenfordChart } from './components/BenfordChart';
import { HistoryModal } from './components/HistoryModal';
import { ThresholdConfigModal, DEFAULT_THRESHOLDS } from './components/ThresholdConfigModal';
import { RealtimeAlertBanner } from './components/RealtimeAlertBanner';
import { RiskDashboard } from './components/RiskDashboard';
import { InstitutionalRiskDashboardSection } from './components/InstitutionalRiskDashboardSection';
import { ContradictoryDossierSection } from './components/ContradictoryDossierSection';
import { ObservationEvaluatorSection } from './components/ObservationEvaluatorSection';
import { UserProfileAndScopeModal } from './components/UserProfileAndScopeModal';
import { TraceabilityTimelineModal } from './components/TraceabilityTimelineModal';
import { EntitySwitcherBar } from './components/EntitySwitcherBar';
import { CaseRegistryAndHistorySection } from './components/CaseRegistryAndHistorySection';
import { ProjectUploadsAndHistoryHub } from './components/ProjectUploadsAndHistoryHub';
import { CaseScreenViewerModal } from './components/CaseScreenViewerModal';
import { PaymentCycleSection } from './components/PaymentCycleSection';
import { AiStepCoach } from './components/AiStepCoach';
import { DirectorResponsibilitySection } from './components/DirectorResponsibilitySection';
import { BuscadorDecretosOficiales } from './components/BuscadorDecretosOficiales';
import { InteractivePreReviewRunnerSection } from './components/InteractivePreReviewRunnerSection';
import { CcrdNobaciMatrixSection } from './components/CcrdNobaciMatrixSection';
import { LegalLibrarySection } from './components/LegalLibrarySection';
import { LegalDocumentViewerModal } from './components/LegalDocumentViewerModal';
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from './firebase';
import {
  closeProjectInFirestore,
  deleteEntityAndProjectsFromFirestore,
  deleteProjectCascadeFromFirestore,
  deleteUploadFromFirestore,
  loadUserPrivateProfile,
  saveEntityToFirestore,
  saveProjectToFirestore,
  saveUploadToFirestore,
  subscribeToEntities,
  subscribeToProjectIterations,
  subscribeToProjectUploads,
  subscribeToUserProjects,
  syncUserProfileToFirestore,
  uploadRecordToEvidenceFile,
} from './services/firestoreService';
import {
  AuditedEntity,
  CaseIteration,
  CaseSession,
  CcrdStageStatus,
  ContractEvidenceRow,
  DirectorResponsibility,
  DuplicityFinding,
  EvidenceFile,
  ForensicAnalysisResult,
  ForensicThresholds,
  HallazgoMatrizLiteral,
  InteractivePreReviewReport,
  LegalReferenceItem,
  PreReviewDocType,
  ProjectUploadRecord,
  RealtimeAlert,
  AuditorProfile,
  AuditPeriodScope,
  DossierSectionItem,
  ObservacionDecision,
  TraceabilityLog,
  PaymentCycleRow,
} from './types/forensic';
import { PAISES_NORMATIVA } from './utils/countryNorms';
import { playForensicAlertSound } from './utils/audioAlert';
import { calculateStringSHA256 } from './utils/crypto';

const STEP_META: { step: number; short: string; title: string; subtitle: string }[] = [
  {
    step: 1,
    short: 'Entidad y Alcance',
    title: 'Registro de Entidad Real, Perito y Alcance del Caso',
    subtitle:
      'Registra o edita la entidad exclusiva a auditar, el período fiscal y la jurisdicción normativa aplicable.',
  },
  {
    step: 2,
    short: 'Evidencia Real (Archivo/Link)',
    title: 'Carga y Extracción Literal desde Documento, Enlace o Texto',
    subtitle:
      'Sube archivos digitales (PDF, Excel, Word, CSV, Imagen), conecta un portal web o pega texto real para extraer datos con IA.',
  },
  {
    step: 3,
    short: 'Ciclo de Pagos y Benford',
    title: 'Ciclo Completo de Pagos, Contratos y Análisis Estadístico Real',
    subtitle:
      'Edita o audita cada etapa del desembolso (Solicitud → Contrato → Recepción → e-CF → Retenciones → Pago Neto) y Ley de Benford.',
  },
  {
    step: 4,
    short: 'Directores, Dossier y Obs.',
    title: 'Segregación por Directores (Decretos Online), Réplicas, Contra-Réplicas y Observaciones',
    subtitle:
      'Busca decretos oficiales en línea con IA, segrega contratos/pagos por período/director y gestiona Actas, Recursos, Réplicas y Contra-Réplicas.',
  },
  {
    step: 5,
    short: 'Ejecutor Pre-Revisión y Dictamen',
    title: 'Ejecutor Interactivo de Revisión Previa (Acta, Preliminar, Final) y Dictamen IA',
    subtitle:
      'Ejecuta controles interactivos pre-emisión, emite el dictamen integral y descarga el informe técnico con trazabilidad completa.',
  },
];

function createEmptyDossierItem(id: string, defaultTitle: string): DossierSectionItem {
  return {
    id,
    titulo: defaultTitle,
    contenido: '',
    fecha: new Date().toISOString().split('T')[0],
    sha256: '',
    archivos: [],
  };
}

export default function App() {
  // Guided Workflow Navigation
  const [activeStep, setActiveStep] = useState<number>(1);
  const [showAllSteps, setShowAllSteps] = useState<boolean>(false);

  // Entities (Zero demo presets; loaded strictly from DB or created by user)
  const [entities, setEntities] = useState<AuditedEntity[]>([]);
  const [activeEntity, setActiveEntity] = useState<AuditedEntity | null>(null);

  // Inline quick entity registration form when no entity exists
  const [quickNombre, setQuickNombre] = useState('');
  const [quickSiglas, setQuickSiglas] = useState('');
  const [quickRnc, setQuickRnc] = useState('');
  const [quickSector, setQuickSector] = useState('Sector Público / Contrataciones');
  const [quickPais, setQuickPais] = useState('DO');
  const [quickPortal, setQuickPortal] = useState('');
  const [quickDescripcion, setQuickDescripcion] = useState('');

  // Active Case Identity (Clean)
  const [activeCaseId, setActiveCaseId] = useState<string>(() => `case-${Date.now()}`);
  const [activeCaseCode, setActiveCaseCode] = useState<string>(() => `CASO-${new Date().getFullYear()}-001`);
  const [nombreCaso, setNombreCaso] = useState('');
  const [origenesSeleccionados, setOrigenesSeleccionados] = useState<string[]>([
    'Portal de Compras y Contrataciones Públicas',
    'Contabilidad Central (SAP / ERP)',
  ]);
  const [requerimiento, setRequerimiento] = useState('');
  const [anonimizar, setAnonimizar] = useState(false);

  // Auditor Profile (Clean production storage)
  const [auditor, setAuditor] = useState<AuditorProfile>(() => {
    const saved = localStorage.getItem('forensic_prod_auditor_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      nombre: '',
      cedulaId: '',
      cargo: 'Auditor Forense',
      entidad: '',
      pais: 'República Dominicana',
      colegiatura: '',
    };
  });

  // Country, Language & Period Scope
  const [selectedCountry, setSelectedCountry] = useState<string>('DO');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Español (DO)');
  const [periodo, setPeriodo] = useState<AuditPeriodScope>({
    fechaDesde: `${new Date().getFullYear()}-01-01`,
    fechaHasta: `${new Date().getFullYear()}-12-31`,
    alcancePericial: '',
  });

  // Dossier Contradictorio (Clean)
  const [actaLectura, setActaLectura] = useState<DossierSectionItem>(() =>
    createEmptyDossierItem('acta-01', 'Acta de Lectura')
  );
  const [recursos, setRecursos] = useState<DossierSectionItem[]>([]);
  const [informePreliminar, setInformePreliminar] = useState<DossierSectionItem>(() =>
    createEmptyDossierItem('inf-prelim-01', 'Informe Preliminar de Auditoría')
  );
  const [replicas, setReplicas] = useState<DossierSectionItem[]>([]);
  const [contraReplicas, setContraReplicas] = useState<DossierSectionItem[]>([]);
  const [directors, setDirectors] = useState<DirectorResponsibility[]>([]);
  const [preReviewReports, setPreReviewReports] = useState<Partial<Record<PreReviewDocType, InteractivePreReviewReport>>>({});

  // Multi-user session isolation ID
  const [sessionOwnerId] = useState<string>(() => {
    const existing = localStorage.getItem('forensic_session_owner_v1');
    if (existing) return existing;
    const created = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem('forensic_session_owner_v1', created);
    return created;
  });

  // Real Observations, Evidence, Contracts, Payment Cycle, CCRD 3.01+ Matrix, Legal Library, Traceability & Final Result (Clean)
  const [observaciones, setObservaciones] = useState<ObservacionDecision[]>([]);
  const [matrizHallazgosLiteral, setMatrizHallazgosLiteral] = useState<HallazgoMatrizLiteral[]>([]);
  const [legalLibrary, setLegalLibrary] = useState<LegalReferenceItem[]>([]);
  const [duplicidades, setDuplicidades] = useState<DuplicityFinding[]>([]);
  const [ccrdStages, setCcrdStages] = useState<CcrdStageStatus[]>([]);
  const [iterations, setIterations] = useState<CaseIteration[]>([]);
  const [traceabilityLogs, setTraceabilityLogs] = useState<TraceabilityLog[]>([]);
  const [evidenceFile, setEvidenceFile] = useState<EvidenceFile | null>(null);
  const [contractRows, setContractRows] = useState<ContractEvidenceRow[]>([]);
  const [paymentCycleRows, setPaymentCycleRows] = useState<PaymentCycleRow[]>([]);
  const [currentResult, setCurrentResult] = useState<ForensicAnalysisResult | null>(null);

  // Firebase Auth & Cloud Firestore Session
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<CaseSession[]>([]);
  const [activeProjectUploads, setActiveProjectUploads] = useState<ProjectUploadRecord[]>([]);
  const [isSavingUpload, setIsSavingUpload] = useState(false);

  // Fraud Thresholds & Modals
  const [thresholds, setThresholds] = useState<ForensicThresholds>(DEFAULT_THRESHOLDS);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showTraceabilityModal, setShowTraceabilityModal] = useState(false);
  const [realtimeAlerts, setRealtimeAlerts] = useState<RealtimeAlert[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingCaseOnScreen, setViewingCaseOnScreen] = useState<CaseSession | null>(null);
  const [viewingLegalRef, setViewingLegalRef] = useState<LegalReferenceItem | null>(null);
  const [isSavingCase, setIsSavingCase] = useState(false);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  // Cases exclusively scoped to the activeEntity
  const entityCases = useMemo(() => {
    if (!activeEntity) return [];
    return allProjects.filter((c) => c.entity?.id === activeEntity.id);
  }, [allProjects, activeEntity]);

  // Listen to Firebase Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      setAuthError(null);
      if (user) {
        try {
          const savedPriv = await loadUserPrivateProfile(user.uid);
          const mergedProfile: AuditorProfile = {
            nombre: savedPriv?.nombre || auditor.nombre || user.displayName || '',
            cedulaId: savedPriv?.cedulaId || auditor.cedulaId || '',
            cargo: savedPriv?.cargo || auditor.cargo || 'Auditor Forense',
            entidad: savedPriv?.entidad || auditor.entidad || '',
            pais: savedPriv?.pais || auditor.pais || 'República Dominicana',
            colegiatura: savedPriv?.colegiatura || auditor.colegiatura || '',
          };
          setAuditor(mergedProfile);
          await syncUserProfileToFirestore(user, mergedProfile);
        } catch (err: any) {
          console.warn('Sync profile:', err?.message || err);
        }
      } else {
        setEntities([]);
        setActiveEntity(null);
        setAllProjects([]);
        setActiveProjectUploads([]);
        setIterations([]);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to Firestore Entities & Projects once authenticated
  useEffect(() => {
    if (!firebaseUser) return;
    setFirestoreError(null);

    const unsubEntities = subscribeToEntities(
      firebaseUser.uid,
      (loadedEntities) => {
        setEntities(loadedEntities);
        setActiveEntity((prev) => {
          if (prev && loadedEntities.some((e) => e.id === prev.id)) {
            return loadedEntities.find((e) => e.id === prev.id) || prev;
          }
          if (!prev && loadedEntities.length > 0) {
            return loadedEntities[0];
          }
          return prev;
        });
      },
      (err) => setFirestoreError(`Error leyendo entidades en Firestore: ${err.message}`)
    );

    const unsubProjects = subscribeToUserProjects(
      firebaseUser.uid,
      (loadedProjects) => {
        setAllProjects(loadedProjects);
      },
      (err) => setFirestoreError(`Error leyendo proyectos en Firestore: ${err.message}`)
    );

    return () => {
      unsubEntities();
      unsubProjects();
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!activeEntity) return;
    setSelectedCountry((cur) => cur || activeEntity.paisCodigo || 'DO');
    setNombreCaso((cur) => cur || `Auditoria_${activeEntity.siglas}_${new Date().getFullYear()}`);
  }, [activeEntity]);

  // Subscribe to Real Uploads & Version Iterations for the active project
  useEffect(() => {
    if (!firebaseUser || !activeCaseId) {
      setActiveProjectUploads([]);
      setIterations([]);
      return;
    }

    const unsubUploads = subscribeToProjectUploads(
      activeCaseId,
      firebaseUser.uid,
      (uploads) => {
        setActiveProjectUploads(uploads);
        if (uploads.length > 0) {
          setEvidenceFile((cur) => {
            if (!cur) return cur;
            const match = uploads.find((u) => u.sha256 === cur.sha256);
            if (match && match.extractedText.length > (cur.extractedText?.length || 0)) {
              return uploadRecordToEvidenceFile(match);
            }
            return cur;
          });
        }
      },
      () => setActiveProjectUploads([])
    );

    const unsubIters = subscribeToProjectIterations(
      activeCaseId,
      firebaseUser.uid,
      (iters) => setIterations(iters),
      () => setIterations([])
    );

    return () => {
      unsubUploads();
      unsubIters();
    };
  }, [firebaseUser, activeCaseId]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(
        err?.code === 'auth/popup-closed-by-user'
          ? 'Inicio de sesión cancelado. Pulsa el botón para autorizar tu cuenta.'
          : err?.message || 'No se pudo iniciar sesión con Google.'
      );
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      setAuthError(err?.message || 'Error cerrando sesión.');
    }
  };

  // Persist auditor profile locally
  useEffect(() => {
    try {
      localStorage.setItem('forensic_prod_auditor_v2', JSON.stringify(auditor));
    } catch {}
  }, [auditor]);

  const logTraceabilityAction = async (
    accion: string,
    detalle: string,
    etapa: 'ENTRADA' | 'EVALUACION' | 'DICTAMEN' | 'SALIDA' = 'EVALUACION'
  ) => {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const actor = auditor.nombre || 'Auditor Activo';
    const hash = await calculateStringSHA256(`${accion}_${detalle}_${ts}_${actor}`);
    const newLog: TraceabilityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: ts,
      accion,
      usuario: `${actor}${auditor.cargo ? ` (${auditor.cargo})` : ''}`,
      detalle,
      sha256: hash,
      etapa,
    };
    setTraceabilityLogs((prev) => [newLog, ...prev]);
  };

  // Real-time monitoring strictly on real contracts and real payment cycle rows
  useEffect(() => {
    if (!thresholds.notificacionesActivas) {
      setRealtimeAlerts([]);
      return;
    }

    const alerts: RealtimeAlert[] = [];

    contractRows.forEach((row) => {
      if (row.adendaPct > thresholds.adendaMaxPct) {
        alerts.push({
          id: `alert-adenda-${row.id}-${row.adendaPct}-${thresholds.adendaMaxPct}`,
          timestamp: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
          tipo: 'ADENDA_EXCESIVA',
          severidad: row.adendaPct > thresholds.adendaMaxPct * 1.3 ? 'CRÍTICA' : 'ALTA',
          titulo: `Adenda Excesiva en ${row.contratoId}`,
          descripcion: `${row.proveedor || 'Proveedor'}: Aumento contractual del ${row.adendaPct.toFixed(1)}% supera el umbral (${thresholds.adendaMaxPct}%).`,
          valorDetectado: `+${row.adendaPct.toFixed(1)}%`,
          umbralLimite: `Máx. ${thresholds.adendaMaxPct}%`,
          referencia: 'Control Contractual',
        });
      }
    });

    paymentCycleRows.forEach((p) => {
      if (p.estadoCiclo === 'SIN_RECEPCION' || p.estadoCiclo === 'SIN_COMPROBANTE' || p.estadoCiclo === 'EXCEDE_CONTRATO' || p.estadoCiclo === 'DUPLICADO') {
        alerts.push({
          id: `alert-pay-${p.id}-${p.estadoCiclo}`,
          timestamp: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
          tipo: 'CICLO_PAGO',
          severidad: p.estadoCiclo === 'DUPLICADO' || p.estadoCiclo === 'EXCEDE_CONTRATO' ? 'CRÍTICA' : 'ALTA',
          titulo: `Incidencia Ciclo de Pago (${p.ordenNumero})`,
          descripcion: `${p.beneficiario || 'Beneficiario'}: Estado ${p.estadoCiclo}. ${p.observacionPago || ''}`,
          valorDetectado: p.estadoCiclo,
          umbralLimite: 'Ciclo Completo',
          referencia: 'Ciclo de Pagos',
        });
      }
    });

    setRealtimeAlerts(alerts);

    if (alerts.length > 0 && thresholds.alertaSonora) {
      playForensicAlertSound();
    }
  }, [
    contractRows,
    paymentCycleRows,
    thresholds.adendaMaxPct,
    thresholds.notificacionesActivas,
    thresholds.alertaSonora,
  ]);

  const resetWorkspaceForEntity = (entity: AuditedEntity, casesCount: number) => {
    const newId = `case-${Date.now()}`;
    const newCode = `CASO-${new Date().getFullYear()}-${String(casesCount + 1).padStart(3, '0')}`;
    setActiveCaseId(newId);
    setActiveCaseCode(newCode);
    setNombreCaso(`Auditoria_${entity.siglas}_${new Date().getFullYear()}`);
    setRequerimiento(
      `Auditoría forense integral de ${entity.nombre} (${entity.siglas}) sobre evidencias, contrataciones y ciclo de pagos reales del período.`
    );
    setEvidenceFile(null);
    setContractRows([]);
    setPaymentCycleRows([]);
    setObservaciones([]);
    setMatrizHallazgosLiteral([]);
    setLegalLibrary([]);
    setDuplicidades([]);
    setCcrdStages([]);
    setIterations([]);
    setCurrentResult(null);
    setActaLectura(createEmptyDossierItem('acta-01', `Acta de Lectura — ${entity.siglas}`));
    setRecursos([]);
    setInformePreliminar(createEmptyDossierItem('inf-prelim-01', `Informe Preliminar — ${entity.siglas}`));
    setReplicas([]);
    setContraReplicas([]);
    setDirectors([]);
    setPreReviewReports({});
  };

  const handleSwitchEntity = async (entity: AuditedEntity) => {
    setActiveEntity(entity);
    const matchingCountry = PAISES_NORMATIVA.find((p) => p.codigo === entity.paisCodigo);
    if (matchingCountry) {
      setSelectedCountry(matchingCountry.codigo);
    }
    const loadedCases = allProjects.filter((c) => c.entity?.id === entity.id);
    if (loadedCases.length > 0) {
      handleSelectCaseFromHistory(loadedCases[0]);
      setLastSavedMessage(
        `Entidad cambiada a ${entity.siglas}. Mostrando sus ${loadedCases.length} proyecto(s) en Firestore.`
      );
    } else {
      resetWorkspaceForEntity(entity, 0);
      setLastSavedMessage(`Entidad activa: ${entity.siglas} (${entity.nombre}). Lista para cargas reales.`);
    }
    logTraceabilityAction(
      'Selección de Entidad Exclusiva',
      `Espacio de trabajo aislado en ${entity.nombre} (RNC/NIF: ${entity.rncNif})`,
      'ENTRADA'
    );
  };

  const handleSaveEntity = async (savedEnt: AuditedEntity, isNew: boolean) => {
    if (!firebaseUser) return;
    setFirestoreError(null);
    try {
      const persisted = await saveEntityToFirestore(savedEnt, firebaseUser.uid);

      setEntities((prev) => {
        const exists = prev.some((e) => e.id === persisted.id);
        return exists ? prev.map((e) => (e.id === persisted.id ? persisted : e)) : [persisted, ...prev];
      });
      setActiveEntity(persisted);
      const matchingCountry = PAISES_NORMATIVA.find((p) => p.codigo === persisted.paisCodigo);
      if (matchingCountry) setSelectedCountry(matchingCountry.codigo);

      if (isNew) {
        resetWorkspaceForEntity(persisted, 0);
        setLastSavedMessage(
          `Primera entidad real ${persisted.siglas} guardada en Firestore. Avanza al Paso 2 para realizar cargas reales.`
        );
      } else {
        setLastSavedMessage(`Datos de la entidad ${persisted.siglas} actualizados en Firestore.`);
      }

      logTraceabilityAction(
        isNew ? 'Registro de Entidad Real (Firestore)' : 'Edición de Entidad (Firestore)',
        `${persisted.nombre} (${persisted.siglas}, RNC/NIF: ${persisted.rncNif})`,
        'ENTRADA'
      );
    } catch (err: any) {
      console.error('Error guardando entidad en Firestore:', err);
      setFirestoreError(err?.message || 'Error guardando entidad en Firestore.');
    }
  };

  const handleDeleteEntity = async (entityId: string) => {
    if (!firebaseUser) return;
    setFirestoreError(null);
    try {
      await deleteEntityAndProjectsFromFirestore(entityId, firebaseUser.uid);
    } catch (err: any) {
      setFirestoreError(err?.message || 'No se pudo eliminar la entidad en Firestore.');
    }
    const remaining = entities.filter((e) => e.id !== entityId);
    setEntities(remaining);
    if (remaining.length > 0) {
      await handleSwitchEntity(remaining[0]);
    } else {
      setActiveEntity(null);
      setEvidenceFile(null);
      setContractRows([]);
      setPaymentCycleRows([]);
      setObservaciones([]);
      setMatrizHallazgosLiteral([]);
      setLegalLibrary([]);
      setDuplicidades([]);
      setCcrdStages([]);
      setIterations([]);
      setReplicas([]);
      setContraReplicas([]);
      setDirectors([]);
      setPreReviewReports({});
      setCurrentResult(null);
      setNombreCaso('');
      setRequerimiento('');
      setLastSavedMessage('Entidad eliminada de Firestore. Registra una nueva entidad real para iniciar.');
    }
  };

  const handleQuickCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNombre.trim()) return;
    const cleanSiglas =
      quickSiglas.trim().toUpperCase() ||
      quickNombre
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 8);

    const newEnt: AuditedEntity = {
      id: `ent-${Date.now()}`,
      nombre: quickNombre.trim(),
      siglas: cleanSiglas,
      rncNif: quickRnc.trim() || 'N/D',
      sector: quickSector,
      paisCodigo: quickPais,
      moneda: quickPais === 'US' ? 'USD' : quickPais === 'ES' ? 'EUR' : quickPais === 'MX' ? 'MXN' : quickPais === 'CO' ? 'COP' : 'DOP',
      simboloMoneda: quickPais === 'US' ? 'US$' : quickPais === 'ES' ? '€' : quickPais === 'MX' ? 'MX$' : quickPais === 'CO' ? 'COP$' : 'RD$',
      urlPortal: quickPortal.trim(),
      descripcion: quickDescripcion.trim(),
      creadaEn: new Date().toISOString(),
    };
    await handleSaveEntity(newEnt, true);
    setQuickNombre('');
    setQuickSiglas('');
    setQuickRnc('');
    setQuickPortal('');
    setQuickDescripcion('');
  };

  const handleNewCase = () => {
    if (!activeEntity) return;
    resetWorkspaceForEntity(activeEntity, entityCases.length);
    setLastSavedMessage(`Nuevo proyecto limpio iniciado para ${activeEntity.siglas}.`);
    logTraceabilityAction(
      'Nuevo Proyecto Exclusivo',
      `Apertura de expediente limpio para ${activeEntity.nombre}`,
      'ENTRADA'
    );
  };

  const persistCaseToServer = async (casePayload: CaseSession) => {
    if (!firebaseUser) return casePayload;
    const saved = await saveProjectToFirestore(casePayload, firebaseUser.uid);
    if (Array.isArray(saved.iterations)) {
      setIterations(saved.iterations);
    }
    return saved;
  };

  const buildActiveCaseSnapshot = async (): Promise<CaseSession> => {
    const effectiveName = nombreCaso.trim() || `Caso_${activeEntity?.siglas || 'General'}`;
    const seal =
      currentResult?.digitalHash ||
      evidenceFile?.sha256 ||
      (await calculateStringSHA256(`${activeCaseId}_${effectiveName}_${activeEntity?.id || 'none'}_${Date.now()}`));

    return {
      id: activeCaseId,
      codigoCaso: activeCaseCode,
      nombreCaso: effectiveName,
      sessionOwnerId: firebaseUser?.uid || sessionOwnerId,
      estado: currentResult ? 'DICTAMEN_EMITIDO' : 'EN_PROCESO',
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      raizCaso: `caso_${effectiveName.toLowerCase().replace(/\s+/g, '_')}`,
      origenes: origenesSeleccionados,
      requerimiento,
      selloDigital: seal,
      entity: activeEntity || undefined,
      auditor,
      periodo,
      paisNormativa: selectedCountry,
      idioma: selectedLanguage,
      evidenceFile,
      contractRows,
      paymentCycleRows,
      observaciones,
      actaLectura,
      recursos,
      informePreliminar,
      replicas,
      contraReplicas,
      directors,
      preReviewReports,
      matrizHallazgosLiteral,
      legalLibrary,
      duplicidades,
      ccrdStages,
      iterations,
      traceabilityLogs,
      resultado: currentResult,
    };
  };

  const handleRegisterCurrentCase = async () => {
    if (!firebaseUser) {
      setLastSavedMessage('Inicia sesión con Google para guardar en Firestore.');
      return;
    }
    if (!activeEntity) {
      setLastSavedMessage('Primero registra una entidad auditada en el Paso 1.');
      return;
    }
    setIsSavingCase(true);
    setFirestoreError(null);
    try {
      const payload = await buildActiveCaseSnapshot();
      const saved = await persistCaseToServer(payload);
      setLastSavedMessage(`Proyecto ${saved.codigoCaso} guardado en Firestore bajo ${activeEntity.siglas}.`);
      logTraceabilityAction(
        'Guardado de Proyecto (Firestore)',
        `Proyecto ${saved.codigoCaso} persistido para ${activeEntity.siglas}`,
        'SALIDA'
      );
    } catch (err: any) {
      console.error('Error registrando proyecto en Firestore:', err);
      setFirestoreError(err?.message || 'No se pudo guardar el proyecto en Firestore.');
      setLastSavedMessage('Error al guardar el proyecto en Firestore.');
    } finally {
      setIsSavingCase(false);
    }
  };

  const handleCloseProject = async (projectId: string) => {
    if (!firebaseUser) return;
    try {
      await closeProjectInFirestore(projectId, firebaseUser.uid);
      setLastSavedMessage(`Proyecto sellado y cerrado definitivamente (${projectId}).`);
      logTraceabilityAction('Cierre Definitivo de Proyecto', `Proyecto ${projectId} sellado en estado CERRADO.`, 'SALIDA');
    } catch (err: any) {
      setFirestoreError(err?.message || 'Error cerrando el proyecto.');
    }
  };

  const handleDeleteCase = async (id: string) => {
    if (!firebaseUser) return;
    try {
      await deleteProjectCascadeFromFirestore(id, firebaseUser.uid);
      logTraceabilityAction('Eliminación de Proyecto', `Se eliminó el proyecto ${id} y sus cargas de Firestore.`, 'SALIDA');
    } catch (err: any) {
      setFirestoreError(err?.message || 'Error eliminando proyecto.');
    }
  };

  const handleDeleteUpload = async (uploadId: string) => {
    if (!activeCaseId) return;
    try {
      await deleteUploadFromFirestore(activeCaseId, uploadId);
      setLastSavedMessage('Carga documental eliminada del historial del proyecto.');
    } catch (err: any) {
      setFirestoreError(err?.message || 'No se pudo eliminar la carga documental.');
    }
  };

  const handleStructuredExtracted = async (payload: StructuredExtractionPayload) => {
    if (payload.cicloPagosDetectado?.length > 0) {
      setPaymentCycleRows((prev) => [...prev, ...payload.cicloPagosDetectado]);
    }
    if (payload.observacionesDetectadas?.length > 0) {
      setObservaciones((prev) => [...prev, ...payload.observacionesDetectadas]);
    }
    if (payload.entidadDetectada && activeEntity) {
      const updatedEnt: AuditedEntity = {
        ...activeEntity,
        rncNif:
          (!activeEntity.rncNif || activeEntity.rncNif === 'N/D') && payload.entidadDetectada.rncNif
            ? payload.entidadDetectada.rncNif
            : activeEntity.rncNif,
        descripcion:
          !activeEntity.descripcion && payload.entidadDetectada.alcanceResumen
            ? payload.entidadDetectada.alcanceResumen
            : activeEntity.descripcion,
      };
      if (updatedEnt.rncNif !== activeEntity.rncNif || updatedEnt.descripcion !== activeEntity.descripcion) {
        await handleSaveEntity(updatedEnt, false);
      }
    }
  };

  const handleAnalysisComplete = async (result: ForensicAnalysisResult) => {
    const enriched = {
      ...result,
      observacionesDecididas: observaciones,
    };
    setCurrentResult(enriched);

    if (activeEntity) {
      const snapshot = await buildActiveCaseSnapshot();
      snapshot.estado = 'DICTAMEN_EMITIDO';
      snapshot.selloDigital = result.digitalHash;
      snapshot.resultado = enriched;
      await persistCaseToServer(snapshot);
      setLastSavedMessage(`Dictamen emitido y autoguardado para ${activeEntity.siglas} (${activeCaseCode}).`);
    }
    logTraceabilityAction(
      'Emisión de Dictamen IA',
      `Dictamen emitido para ${activeEntity?.siglas || 'Entidad'} (SHA-256: ${result.digitalHash.substring(0, 12)}...)`,
      'DICTAMEN'
    );
  };

  const handleSelectCaseFromHistory = (c: CaseSession) => {
    setActiveCaseId(c.id);
    setActiveCaseCode(c.codigoCaso || 'CASO-RECUPERADO');
    setNombreCaso(c.nombreCaso);
    setOrigenesSeleccionados(c.origenes || []);
    setRequerimiento(c.requerimiento);
    if (c.auditor) setAuditor(c.auditor);
    if (c.periodo) setPeriodo(c.periodo);
    if (c.paisNormativa) setSelectedCountry(c.paisNormativa);
    if (c.idioma) setSelectedLanguage(c.idioma);
    setEvidenceFile(c.evidenceFile ?? null);
    setContractRows(c.contractRows || []);
    setPaymentCycleRows(c.paymentCycleRows || []);
    setObservaciones(c.observaciones || []);
    setActaLectura(c.actaLectura || createEmptyDossierItem('acta-01', 'Acta de Lectura'));
    setRecursos(c.recursos || []);
    setInformePreliminar(c.informePreliminar || createEmptyDossierItem('inf-prelim-01', 'Informe Preliminar'));
    setReplicas(c.replicas || []);
    setContraReplicas(c.contraReplicas || []);
    setDirectors(c.directors || []);
    setPreReviewReports(c.preReviewReports || {});
    setMatrizHallazgosLiteral(c.matrizHallazgosLiteral || []);
    setLegalLibrary(c.legalLibrary || []);
    setDuplicidades(c.duplicidades || []);
    setCcrdStages(c.ccrdStages || []);
    setIterations(c.iterations || []);
    setTraceabilityLogs(c.traceabilityLogs || []);
    setCurrentResult(c.resultado || null);
    setLastSavedMessage(`Expediente ${c.codigoCaso || c.nombreCaso} cargado en pantalla para edición.`);
  };

  const handleAddDecreeToLegalLibrary = async (dir: DirectorResponsibility) => {
    const decreeCode = dir.numeroDecretoNombramiento || `Decreto (${dir.nombre})`;
    const firstSource = dir.fuentes?.[0];
    const now = new Date().toISOString();
    const sha =
      firstSource?.sha256 ||
      (await calculateStringSHA256(`${decreeCode}_${dir.nombre}_${firstSource?.url || ''}_${now}`));
    const entry: LegalReferenceItem = {
      id: `law-dec-${dir.id}-${Date.now()}`,
      numeroNorma: decreeCode,
      titulo: `Nombramiento Oficial: ${dir.nombre} (${dir.cargo})`,
      jerarquia: 'DECRETO',
      jerarquiaOrden: 4,
      articulosPuntuales: [
        `Gestión ${dir.fechaInicioGestion || 'N/D'} a ${dir.enFuncionesActuales ? 'Actualidad' : dir.fechaFinGestion || 'N/D'}`,
      ],
      hallazgosVinculados: [],
      url: firstSource?.url || '',
      ubicacionFuente: firstSource?.ubicacionOrigen || 'Búsqueda Oficial de Decretos',
      resumenAplicacion:
        firstSource?.extractoLiteral || `Acto oficial de designación para delimitación de responsabilidad administrativa.`,
      textoExtraido:
        firstSource?.extractoLiteral ||
        `${decreeCode} — ${dir.nombre} (${dir.cargo}). Período: ${dir.fechaInicioGestion || 'N/D'} a ${dir.enFuncionesActuales ? 'Actualidad' : dir.fechaFinGestion || 'N/D'}.`,
      sha256: sha,
      fechaRegistro: now,
    };
    setLegalLibrary((prev) => {
      const exists = prev.some(
        (l) => l.numeroNorma.toLowerCase() === entry.numeroNorma.toLowerCase() && l.url === entry.url
      );
      if (exists) return prev;
      return [...prev, entry].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);
    });
    logTraceabilityAction(
      'Vinculación Decreto a Biblioteca Legal',
      `${entry.numeroNorma} (${dir.nombre}) añadido a la Biblioteca Jurídica del Caso.`,
      'ENTRADA'
    );
  };

  const handleSaveDecreeSourceToLegalLibrary = async (item: {
    numeroNorma: string;
    titulo: string;
    url: string;
    fragmentoTexto: string;
    ubicacionFuente: string;
    directorNombre?: string;
    fechaPeriodo?: string;
  }) => {
    const now = new Date().toISOString();
    const sha = await calculateStringSHA256(`${item.numeroNorma}_${item.url}_${item.fragmentoTexto}_${now}`);
    const entry: LegalReferenceItem = {
      id: `law-dec-src-${Date.now()}`,
      numeroNorma: item.numeroNorma,
      titulo: item.titulo,
      jerarquia: 'DECRETO',
      jerarquiaOrden: 4,
      articulosPuntuales: [
        ...(item.directorNombre ? [`Titular: ${item.directorNombre}`] : []),
        ...(item.fechaPeriodo ? [`Período: ${item.fechaPeriodo}`] : []),
        'Fuente Verificada de Nombramiento Oficial',
      ],
      hallazgosVinculados: [],
      url: item.url,
      ubicacionFuente: item.ubicacionFuente,
      resumenAplicacion: item.fragmentoTexto,
      textoExtraido: item.fragmentoTexto,
      sha256: sha,
      fechaRegistro: now,
    };

    setLegalLibrary((prev) => {
      const normUrl = (item.url || '').trim().toLowerCase();
      const normNum = item.numeroNorma.trim().toLowerCase();
      const idx = prev.findIndex(
        (l) =>
          (normUrl && (l.url || '').trim().toLowerCase() === normUrl) ||
          (l.numeroNorma.trim().toLowerCase() === normNum && normUrl === (l.url || '').trim().toLowerCase())
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          resumenAplicacion: item.fragmentoTexto || updated[idx].resumenAplicacion,
          textoExtraido: item.fragmentoTexto || updated[idx].textoExtraido,
          ubicacionFuente: item.ubicacionFuente || updated[idx].ubicacionFuente,
        };
        return updated;
      }
      return [...prev, entry].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);
    });

    logTraceabilityAction(
      'Fuente Oficial Guardada en Biblioteca Legal',
      `${item.numeroNorma} (${item.url || 'Fragmento textual'}) verificada y almacenada con sello SHA-256.`,
      'ENTRADA'
    );
  };

  const handleApplyDirectorFromSearch = (dir: DirectorResponsibility) => {
    setDirectors((prev) => {
      const exists = prev.some(
        (p) =>
          p.nombre.trim().toLowerCase() === dir.nombre.trim().toLowerCase() &&
          p.numeroDecretoNombramiento.trim().toLowerCase() === dir.numeroDecretoNombramiento.trim().toLowerCase()
      );
      if (exists) return prev;
      return [...prev, { ...dir, periodoNumero: prev.length + 1 }];
    });
    logTraceabilityAction(
      'Aplicación de Director desde Buscador Oficial',
      `Director aplicado: ${dir.nombre} (${dir.numeroDecretoNombramiento}) con ${dir.fuentes.length} fuente(s).`,
      'EVALUACION'
    );
  };

  const handleCacheLegalText = (id: string, text: string, url?: string) => {
    setLegalLibrary((prev) =>
      prev.map((l) => (l.id === id ? { ...l, textoExtraido: text, url: url || l.url } : l))
    );
    setViewingLegalRef((prev) => (prev && prev.id === id ? { ...prev, textoExtraido: text, url: url || prev.url } : prev));
  };

  const currentCountryConfig = PAISES_NORMATIVA.find((p) => p.codigo === selectedCountry) || PAISES_NORMATIVA[0];
  const currentStepMeta = STEP_META.find((s) => s.step === activeStep) || STEP_META[0];
  const activeCurrencySymbol = activeEntity?.simboloMoneda || 'RD$';

  const openCurrentCaseOnScreen = async () => {
    const snap = await buildActiveCaseSnapshot();
    setViewingCaseOnScreen(snap);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-sm text-slate-300 font-medium">Conectando con la base de datos Firestore en la nube...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-lg w-full bg-slate-900 border border-sky-500/30 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
            <Database className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Base de Datos Original Desde Cero • Firestore + Auth
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              basa12-ecosistema — Auditoría Forense CCRD &amp; Big-4
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Inicia sesión con tu cuenta oficial de Google para habilitar tu espacio privado de{' '}
              <strong className="text-slate-200">Entidades Reales</strong>,{' '}
              <strong className="text-slate-200">Cargas Documentales SHA-256</strong>,{' '}
              <strong className="text-slate-200">Historial de Proyectos</strong> y análisis completo con{' '}
              <strong className="text-sky-300">IA Gemini 4</strong>.
            </p>
          </div>

          {authError && (
            <div className="bg-red-950/50 border border-red-700/60 rounded-xl p-3 text-xs text-red-200 flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-sky-950/50 cursor-pointer transition-all"
          >
            <LogIn className="w-4 h-4" />
            Iniciar Sesión con Google y Abrir Base de Datos
          </button>

          <p className="text-[11px] text-slate-500">
            Cero datos demo precargados • Aislamiento estricto por usuario autenticado • Ley núm. 18-24 &amp; NOBACI
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Status Strip */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-sky-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
            {activeCaseCode} {iterations.length > 0 ? `• v${iterations[0].version}` : ''}
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10.5px] flex items-center gap-1">
            <Database className="w-3 h-3" />
            Firestore: {firebaseUser.email}
          </span>
          <span className="font-medium text-slate-200">
            Entidad: <strong>{activeEntity ? `${activeEntity.siglas} (${activeEntity.nombre})` : 'Sin registrar'}</strong> |{' '}
            Jurisdicción: <strong>{currentCountryConfig.bandera} {currentCountryConfig.nombre}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowAllSteps(!showAllSteps)}
            className={`text-xs px-2.5 py-1 rounded border flex items-center gap-1.5 font-medium cursor-pointer ${
              showAllSteps
                ? 'bg-sky-600/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {showAllSteps ? <Layers className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
            {showAllSteps ? 'Modo Guiado Paso a Paso' : 'Ver Todos los Pasos'}
          </button>

          <button
            onClick={openCurrentCaseOnScreen}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver Expediente en Pantalla
          </button>

          <button
            onClick={() => setShowUserProfileModal(true)}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Auditor &amp; Normativa
          </button>

          <button
            onClick={() => setShowTraceabilityModal(true)}
            className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            Trazabilidad ({traceabilityLogs.length})
          </button>

          <button
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-red-300 flex items-center gap-1 font-medium cursor-pointer"
            title="Cerrar sesión de Firebase"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </div>

      {firestoreError && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-xs text-red-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            {firestoreError}
          </span>
          <button
            type="button"
            onClick={() => setFirestoreError(null)}
            className="text-red-300 hover:text-white underline cursor-pointer"
          >
            Ocultar
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Sidebar */}
        <aside className="w-full lg:w-72 bg-slate-900/90 border-r border-slate-800 p-5 flex flex-col justify-between shrink-0">
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold">
                🔬
              </div>
              <div>
                <h1 className="font-bold text-sm text-white tracking-tight">basa12-ecosistema</h1>
                <span className="text-[10px] text-emerald-400 font-mono">PRODUCCIÓN • DATOS REALES</span>
              </div>
            </div>

            {/* Active Entity Card */}
            <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Entidad Exclusiva en Curso
              </div>
              {activeEntity ? (
                <>
                  <div className="text-xs font-bold text-white leading-snug">{activeEntity.nombre}</div>
                  <div className="text-[10.5px] text-slate-400 font-mono">
                    {activeEntity.siglas} • RNC/NIF: {activeEntity.rncNif}
                  </div>
                  <div className="text-[10.5px] text-emerald-400 font-mono">
                    Moneda: {activeEntity.moneda} ({activeEntity.simboloMoneda})
                  </div>
                </>
              ) : (
                <div className="text-xs text-amber-300">
                  Pendiente de registrar entidad real en Paso 1.
                </div>
              )}
            </div>

            {/* Stepper Vertical Quick Nav */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Flujo Guiado con IA (5 Pasos)
              </div>
              {STEP_META.map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    setActiveStep(s.step);
                    setShowAllSteps(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeStep === s.step && !showAllSteps
                      ? 'bg-sky-600/20 border-sky-500/50 text-white font-semibold'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      activeStep === s.step && !showAllSteps
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {s.step}
                  </span>
                  <span className="truncate">{s.short}</span>
                </button>
              ))}
            </div>

            {/* Auditor & Period Quick Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                  Perito
                </span>
                <button
                  onClick={() => setShowUserProfileModal(true)}
                  className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                >
                  Editar
                </button>
              </div>
              <div className="font-bold text-white leading-tight">
                {auditor.nombre || 'Sin nombre asignado'}
              </div>
              <div className="text-[10.5px] text-slate-400 font-mono">
                <Calendar className="w-3 h-3 inline mr-1 text-amber-400" />
                {periodo.fechaDesde} a {periodo.fechaHasta}
              </div>
            </div>

            {/* Thresholds */}
            <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-lg space-y-1 text-[11px] font-mono">
              <div className="flex items-center justify-between text-slate-300 pb-1 border-b border-slate-800">
                <span className="flex items-center gap-1 font-sans font-semibold text-xs">
                  <Sliders className="w-3 h-3 text-sky-400" /> Umbrales
                </span>
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(true)}
                  className="text-[10px] text-sky-400 hover:underline font-sans cursor-pointer"
                >
                  Ajustar
                </button>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Adendas:</span>
                <strong className="text-red-400">&gt; {thresholds.adendaMaxPct}%</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Benford:</span>
                <strong className="text-amber-400">±{thresholds.benfordMaxDeviationPct}%</strong>
              </div>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-5 border-t border-slate-800 space-y-2">
            <button
              onClick={openCurrentCaseOnScreen}
              className="w-full py-2 px-3 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver Expediente en Pantalla
            </button>

            <button
              onClick={() => setShowHistory(true)}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              Casos de {activeEntity?.siglas || 'Entidad'} ({entityCases.length})
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Entorno Limpio de Producción • Cero Datos Demo • Flujo Pericial IA Paso a Paso
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                basa12-ecosistema · Auditoría Forense e Inteligencia de Datos
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
                Registra tu entidad real, extrae documentos o portales web literalmente, audita el Ciclo de Pagos y edita cualquier campo con asistencia paso a paso de IA.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRegisterCurrentCase}
              disabled={!activeEntity || isSavingCase}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-lg"
            >
              <Save className="w-4 h-4" />
              {isSavingCase ? 'Guardando...' : 'Guardar Avance del Caso'}
            </button>
          </div>

          {/* Entity Switcher & Registration Bar */}
          <EntitySwitcherBar
            entities={entities}
            activeEntity={activeEntity}
            onSwitchEntity={handleSwitchEntity}
            onSaveEntity={handleSaveEntity}
            onDeleteEntity={handleDeleteEntity}
            onRegisterCurrentCase={handleRegisterCurrentCase}
            onNewCase={handleNewCase}
            isSavingCase={isSavingCase}
            lastSavedMessage={lastSavedMessage}
            activeCaseCode={activeCaseCode}
          />

          {/* Top 5-Step Progress Strip */}
          {!showAllSteps && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STEP_META.map((s) => {
                const isCurrent = activeStep === s.step;
                const isPast = activeStep > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setActiveStep(s.step)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-sky-600/20 border-sky-400 text-white shadow-lg shadow-sky-950/40'
                        : isPast
                        ? 'bg-emerald-950/20 border-emerald-700/40 text-emerald-200 hover:border-emerald-500/60'
                        : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase">
                      <span>Paso {s.step}</span>
                      {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-xs font-bold mt-1 truncate">{s.short}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* AI Step Coach guiding current step */}
          {!showAllSteps && (
            <AiStepCoach
              currentStep={currentStepMeta.step}
              totalSteps={STEP_META.length}
              stepTitle={currentStepMeta.title}
              stepSubtitle={currentStepMeta.subtitle}
              onPrevStep={() => setActiveStep((p) => Math.max(1, p - 1))}
              onNextStep={() => setActiveStep((p) => Math.min(5, p + 1))}
              activeEntity={activeEntity}
              caseName={nombreCaso}
              paisNormativa={currentCountryConfig.nombre}
              idioma={selectedLanguage}
              evidenceSummary={evidenceFile?.extractedText || evidenceFile?.contentSnippet || ''}
              contractsCount={contractRows.length}
              paymentsCount={paymentCycleRows.length}
              observationsCount={observaciones.length}
              hasFinalResult={Boolean(currentResult)}
            />
          )}

          {/* ==================== STEP 1: ENTIDAD, PERITO, ALCANCE & EXPEDIENTES EXCLUSIVOS ==================== */}
          {(showAllSteps || activeStep === 1) && (
            <div className="space-y-6">
              {!activeEntity ? (
                <form
                  onSubmit={handleQuickCreateEntity}
                  className="bg-slate-900 border border-sky-500/40 rounded-2xl p-6 shadow-xl space-y-4"
                >
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        Paso 1: Registra la Entidad o Empresa Real a Auditar
                      </h2>
                      <p className="text-xs text-slate-400">
                        Base de datos limpia para pruebas reales en producción. Todos los campos pueden editarse después.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="md:col-span-2">
                      <label className="text-slate-300 font-semibold block mb-1">Nombre Oficial de la Entidad *</label>
                      <input
                        type="text"
                        required
                        value={quickNombre}
                        onChange={(e) => setQuickNombre(e.target.value)}
                        placeholder="Ej: Instituto Nacional del Cáncer (INCART)"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Siglas</label>
                      <input
                        type="text"
                        value={quickSiglas}
                        onChange={(e) => setQuickSiglas(e.target.value)}
                        placeholder="Ej: INCART"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">RNC / NIF / Identificación</label>
                      <input
                        type="text"
                        value={quickRnc}
                        onChange={(e) => setQuickRnc(e.target.value)}
                        placeholder="Ej: 430130712"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Sector</label>
                      <input
                        type="text"
                        value={quickSector}
                        onChange={(e) => setQuickSector(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">País / Normativa</label>
                      <select
                        value={quickPais}
                        onChange={(e) => setQuickPais(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                      >
                        {PAISES_NORMATIVA.map((p) => (
                          <option key={p.codigo} value={p.codigo}>
                            {p.bandera} {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="text-slate-300 font-semibold block mb-1">
                      Enlace / Portal Web Oficial (Opcional)
                    </label>
                    <input
                      type="text"
                      value={quickPortal}
                      onChange={(e) => setQuickPortal(e.target.value)}
                      placeholder="https://portal.comprasdominicana.gob.do/..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="text-xs">
                    <label className="text-slate-300 font-semibold block mb-1">
                      Antecedentes, Base Legal o Alcance Real (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={quickDescripcion}
                      onChange={(e) => setQuickDescripcion(e.target.value)}
                      placeholder="Pegue antecedentes, marco legal, alcance u observaciones iniciales de la entidad..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Entidad y Continuar al Paso 2
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    Datos Editables del Auditor, Período y Jurisdicción para {activeEntity.siglas}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Auditor Responsable</label>
                      <input
                        type="text"
                        value={auditor.nombre}
                        onChange={(e) => setAuditor((p) => ({ ...p, nombre: e.target.value }))}
                        placeholder="Nombre del auditor"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Cédula / ID</label>
                      <input
                        type="text"
                        value={auditor.cedulaId}
                        onChange={(e) => setAuditor((p) => ({ ...p, cedulaId: e.target.value }))}
                        placeholder="001-0000000-0"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Período Desde</label>
                      <input
                        type="date"
                        value={periodo.fechaDesde}
                        onChange={(e) => setPeriodo((p) => ({ ...p, fechaDesde: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Período Hasta</label>
                      <input
                        type="date"
                        value={periodo.fechaHasta}
                        onChange={(e) => setPeriodo((p) => ({ ...p, fechaHasta: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <ProjectUploadsAndHistoryHub
                entities={entities}
                activeEntity={activeEntity}
                allProjects={allProjects}
                activeCaseId={activeCaseId}
                activeProjectUploads={activeProjectUploads}
                activeProjectIterations={iterations}
                isSavingCase={isSavingCase}
                isSavingUpload={isSavingUpload}
                onRegisterCase={handleRegisterCurrentCase}
                onSelectCaseToLoad={handleSelectCaseFromHistory}
                onViewCaseOnScreen={(c) => setViewingCaseOnScreen(c)}
                onCloseProject={handleCloseProject}
                onDeleteCase={handleDeleteCase}
                onRestoreUploadToWorkspace={(ev) => {
                  setEvidenceFile(ev);
                  setActiveStep(2);
                  setLastSavedMessage(`Evidencia "${ev.name}" restaurada desde Firestore al Paso 2.`);
                }}
                onDeleteUpload={handleDeleteUpload}
                onGoToUploadStep={() => setActiveStep(2)}
              />
            </div>
          )}

          {/* ==================== STEP 2: EVIDENCIA REAL (ARCHIVO / LINK / TEXTO) ==================== */}
          {(showAllSteps || activeStep === 2) && (
            <EvidenceSection
              nombreCaso={nombreCaso}
              setNombreCaso={setNombreCaso}
              origenesSeleccionados={origenesSeleccionados}
              setOrigenesSeleccionados={setOrigenesSeleccionados}
              evidenceFile={evidenceFile}
              setEvidenceFile={setEvidenceFile}
              contractRows={contractRows}
              setContractRows={setContractRows}
              anonimizar={anonimizar}
              setAnonimizar={setAnonimizar}
              adendaThresholdPct={thresholds.adendaMaxPct}
              simboloMoneda={activeCurrencySymbol}
              entityName={activeEntity?.nombre || ''}
              entityUrlPortal={activeEntity?.urlPortal || ''}
              paisNormativa={currentCountryConfig.nombre}
              onFileParsed={async (parsedFile, detectedCount, paymentsCount) => {
                logTraceabilityAction(
                  'Ingesta de Evidencia Real',
                  `Fuente ${parsedFile.name} [${parsedFile.parsedFormat || 'DIGITAL'}] (${detectedCount} contratos, ${paymentsCount} pagos, SHA-256: ${parsedFile.sha256.substring(0, 10)}...)`,
                  'ENTRADA'
                );
                if (firebaseUser && activeEntity) {
                  setIsSavingUpload(true);
                  try {
                    const snap = await buildActiveCaseSnapshot();
                    snap.evidenceFile = parsedFile;
                    await saveUploadToFirestore({
                      caseSnapshot: snap,
                      evidenceFile: parsedFile,
                      ownerUid: firebaseUser.uid,
                    });
                    setLastSavedMessage(
                      `Carga real "${parsedFile.name}" guardada en Firestore (${activeCaseCode}).`
                    );
                  } catch (err: any) {
                    console.warn('Error guardando carga en Firestore:', err?.message || err);
                  } finally {
                    setIsSavingUpload(false);
                  }
                }
              }}
              onStructuredExtracted={handleStructuredExtracted}
              onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'ENTRADA')}
            />
          )}

          {/* ==================== STEP 3: CICLO DE PAGOS Y LEY DE BENFORD ==================== */}
          {(showAllSteps || activeStep === 3) && (
            <div className="space-y-6">
              <PaymentCycleSection
                entityName={activeEntity?.nombre || 'Entidad en Curso'}
                paisNormativa={currentCountryConfig.nombre}
                idioma={selectedLanguage}
                simboloMoneda={activeCurrencySymbol}
                paymentCycleRows={paymentCycleRows}
                setPaymentCycleRows={setPaymentCycleRows}
                contractRows={contractRows}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              <BenfordChart
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                adendaThresholdPct={thresholds.adendaMaxPct}
                benfordMaxDeviationPct={thresholds.benfordMaxDeviationPct}
                evidenceNumericAmounts={evidenceFile?.numericAmounts}
              />
            </div>
          )}

          {/* ==================== STEP 4: DIRECTORES, DOSSIER Y OBSERVACIONES ==================== */}
          {(showAllSteps || activeStep === 4) && (
            <div className="space-y-6">
              <BuscadorDecretosOficiales
                activeEntity={activeEntity}
                paisNormativa={currentCountryConfig.nombre}
                periodo={periodo}
                legalLibrary={legalLibrary}
                onSaveDecreeSourceToLegalLibrary={handleSaveDecreeSourceToLegalLibrary}
                onApplyDirector={handleApplyDirectorFromSearch}
                onOpenLegalViewer={(ref) => setViewingLegalRef(ref)}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              <DirectorResponsibilitySection
                activeEntity={activeEntity}
                paisNormativa={currentCountryConfig.nombre}
                idioma={selectedLanguage}
                periodo={periodo}
                simboloMoneda={activeCurrencySymbol}
                directors={directors}
                setDirectors={setDirectors}
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                observaciones={observaciones}
                recursos={recursos}
                replicas={replicas}
                contraReplicas={contraReplicas}
                onAddDecreeToLegalLibrary={handleAddDecreeToLegalLibrary}
                onOpenLegalViewer={(ref) => setViewingLegalRef(ref)}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              <ContradictoryDossierSection
                actaLectura={actaLectura}
                setActaLectura={setActaLectura}
                recursos={recursos}
                setRecursos={setRecursos}
                informePreliminar={informePreliminar}
                setInformePreliminar={setInformePreliminar}
                replicas={replicas}
                setReplicas={setReplicas}
                contraReplicas={contraReplicas}
                setContraReplicas={setContraReplicas}
                directors={directors}
                nombreCaso={nombreCaso}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'ENTRADA')}
              />

              <CcrdNobaciMatrixSection
                nombreCaso={nombreCaso || `Caso_${activeEntity?.siglas || 'Forense'}`}
                activeEntity={activeEntity}
                auditor={auditor}
                periodo={periodo}
                paisNormativa={currentCountryConfig.nombre}
                selloDigital={currentResult?.digitalHash || evidenceFile?.sha256 || 'PENDIENTE_SELLO'}
                rawTextContext={evidenceFile?.extractedText || evidenceFile?.contentSnippet || ''}
                informePreliminarText={informePreliminar.contenido}
                actaLecturaText={actaLectura.contenido}
                recursosCount={recursos.length}
                replicasCount={replicas.length}
                contraReplicasCount={contraReplicas.length}
                directors={directors}
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                observaciones={observaciones}
                setObservaciones={setObservaciones}
                hallazgos={matrizHallazgosLiteral}
                setHallazgos={setMatrizHallazgosLiteral}
                ccrdStages={ccrdStages}
                setCcrdStages={setCcrdStages}
                duplicidades={duplicidades}
                setDuplicidades={setDuplicidades}
                legalLibrary={legalLibrary}
                onOpenLegalViewer={(ref) => setViewingLegalRef(ref)}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              <ObservationEvaluatorSection
                observaciones={observaciones}
                setObservaciones={setObservaciones}
                selectedCountry={selectedCountry}
                selectedLanguage={selectedLanguage}
                auditor={auditor}
                actaLecturaContext={actaLectura.contenido}
                recursosContext={[...recursos, ...replicas, ...contraReplicas]
                  .map((r) => `${r.titulo} [${r.periodoEtiqueta || r.fecha}]: ${r.contenido}`)
                  .join('\n\n')}
                simboloMoneda={activeCurrencySymbol}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />
            </div>
          )}

          {/* ==================== STEP 5: EJECUTOR PRE-REVISIÓN, DICTAMEN FINAL, MEJORAS IA ==================== */}
          {(showAllSteps || activeStep === 5) && (
            <div className="space-y-6">
              <InteractivePreReviewRunnerSection
                activeEntity={activeEntity}
                auditor={auditor}
                periodo={periodo}
                paisNormativa={currentCountryConfig.nombre}
                idioma={selectedLanguage}
                actaLectura={actaLectura}
                setActaLectura={setActaLectura}
                informePreliminar={informePreliminar}
                setInformePreliminar={setInformePreliminar}
                recursos={recursos}
                replicas={replicas}
                contraReplicas={contraReplicas}
                directors={directors}
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                observaciones={observaciones}
                resultado={currentResult}
                preReviewReports={preReviewReports}
                setPreReviewReports={setPreReviewReports}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              <RiskDashboard
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                thresholds={thresholds}
                realtimeAlerts={realtimeAlerts}
                onOpenThresholds={() => setShowThresholdModal(true)}
                currentResult={currentResult}
                simboloMoneda={activeCurrencySymbol}
              />

              <InstitutionalRiskDashboardSection
                activeEntity={activeEntity}
                paisNormativa={currentCountryConfig.nombre}
                periodo={periodo}
                hallazgos={matrizHallazgosLiteral}
                setHallazgos={setMatrizHallazgosLiteral}
                observaciones={observaciones}
                ccrdStages={ccrdStages}
                setCcrdStages={setCcrdStages}
                duplicidades={duplicidades}
                directors={directors}
                legalLibrary={legalLibrary}
                setLegalLibrary={setLegalLibrary}
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                thresholds={thresholds}
                actaLectura={actaLectura}
                informePreliminar={informePreliminar}
                recursos={recursos}
                replicas={replicas}
                contraReplicas={contraReplicas}
                preReviewReports={preReviewReports}
                onNavigateStep={(step) => {
                  setActiveStep(step);
                  setShowAllSteps(false);
                }}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              <AnalysisSection
                nombreCaso={nombreCaso || `Caso_${activeEntity?.siglas || 'Forense'}`}
                entidadNombre={activeEntity ? `${activeEntity.nombre} (${activeEntity.siglas})` : 'Entidad Auditada'}
                entidadDescripcion={activeEntity?.descripcion || ''}
                paisNormativa={currentCountryConfig.nombre}
                idioma={selectedLanguage}
                origenes={origenesSeleccionados}
                requerimiento={requerimiento}
                setRequerimiento={setRequerimiento}
                evidenceFile={evidenceFile}
                contractRows={contractRows}
                paymentCycleRows={paymentCycleRows}
                observaciones={observaciones}
                directors={directors}
                actaLectura={actaLectura}
                informePreliminar={informePreliminar}
                recursos={recursos}
                replicas={replicas}
                contraReplicas={contraReplicas}
                anonimizar={anonimizar}
                onAnalysisComplete={handleAnalysisComplete}
                thresholds={thresholds}
                setThresholds={setThresholds}
                onOpenThresholdSettings={() => setShowThresholdModal(true)}
                activeAlertsCount={realtimeAlerts.length}
              />

              <LegalLibrarySection
                paisNormativa={currentCountryConfig.nombre}
                legalLibrary={legalLibrary}
                setLegalLibrary={setLegalLibrary}
                hallazgos={matrizHallazgosLiteral}
                observaciones={observaciones}
                directors={directors}
                rawTextContext={[
                  evidenceFile?.extractedText || '',
                  informePreliminar.contenido,
                  actaLectura.contenido,
                ].join('\n\n')}
                onOpenViewer={(item) => setViewingLegalRef(item)}
                onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
              />

              {currentResult && (
                <ResultsSection
                  resultado={currentResult}
                  nombreCaso={nombreCaso || `Caso_${activeEntity?.siglas || 'Forense'}`}
                  origenes={origenesSeleccionados}
                  requerimiento={requerimiento}
                  contractRows={contractRows}
                  paymentCycleRows={paymentCycleRows}
                  simboloMoneda={activeCurrencySymbol}
                  adendaThresholdPct={thresholds.adendaMaxPct}
                  auditor={auditor}
                  periodo={periodo}
                  paisNormativa={currentCountryConfig.nombre}
                  observaciones={observaciones}
                  actaLectura={actaLectura}
                  recursos={recursos}
                  replicas={replicas}
                  contraReplicas={contraReplicas}
                  directors={directors}
                  entity={activeEntity}
                  hallazgosLiteral={matrizHallazgosLiteral}
                  duplicidades={duplicidades}
                  legalLibrary={legalLibrary}
                  ccrdStages={ccrdStages}
                  onOpenLegalViewer={(ref) => setViewingLegalRef(ref)}
                />
              )}

              <CaseRegistryAndHistorySection
                cases={entityCases}
                activeEntity={activeEntity}
                activeCaseId={activeCaseId}
                onRegisterCase={handleRegisterCurrentCase}
                onSelectCaseToLoad={handleSelectCaseFromHistory}
                onViewCaseOnScreen={(c) => setViewingCaseOnScreen(c)}
                onDeleteCase={handleDeleteCase}
                isSaving={isSavingCase}
              />
            </div>
          )}

          {/* Footer */}
          <footer className="text-center py-6 border-t border-slate-900 text-xs text-slate-500 space-y-1">
            <p>
              Ecosistema de Auditoría Forense • Entidad Activa: {activeEntity?.siglas || 'Pendiente'} • Auditor:{' '}
              {auditor.nombre || 'Por asignar'}
            </p>
            <p className="text-[11px] text-slate-600">
              ISO/IEC 27037 • NIA 240 / ISA 500 • Procesamiento exclusivo sobre datos reales suministrados.
            </p>
          </footer>
        </main>
      </div>

      {/* Real-time Alert Toast Banner */}
      <RealtimeAlertBanner
        alerts={realtimeAlerts}
        onDismissAlert={(id) => setRealtimeAlerts((prev) => prev.filter((a) => a.id !== id))}
        onClearAll={() => setRealtimeAlerts([])}
        onOpenSettings={() => setShowThresholdModal(true)}
      />

      {/* Full On-Screen Case Viewer Modal */}
      <CaseScreenViewerModal
        caseData={viewingCaseOnScreen}
        onClose={() => setViewingCaseOnScreen(null)}
        onLoadIntoWorkspace={handleSelectCaseFromHistory}
        onOpenLegalViewer={(ref) => setViewingLegalRef(ref)}
      />

      {/* Clickable In-App Legal Document Viewer Modal */}
      <LegalDocumentViewerModal
        legalRef={viewingLegalRef}
        onClose={() => setViewingLegalRef(null)}
        onCacheExtractedText={handleCacheLegalText}
      />

      {/* Auditor Profile & Normative Scope Modal */}
      <UserProfileAndScopeModal
        isOpen={showUserProfileModal}
        onClose={() => setShowUserProfileModal(false)}
        auditor={auditor}
        setAuditor={setAuditor}
        periodo={periodo}
        setPeriodo={setPeriodo}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        onSave={async () => {
          if (firebaseUser) {
            try {
              await syncUserProfileToFirestore(firebaseUser, auditor);
            } catch (err) {
              console.warn('Error sincronizando perfil:', err);
            }
          }
          logTraceabilityAction(
            'Actualización de Perfil y Alcance',
            `Auditor: ${auditor.nombre || 'N/D'}, Jurisdicción: ${selectedCountry}, Período: ${periodo.fechaDesde} a ${periodo.fechaHasta}`,
            'ENTRADA'
          );
        }}
      />

      {/* Traceability Timeline Modal */}
      <TraceabilityTimelineModal
        isOpen={showTraceabilityModal}
        onClose={() => setShowTraceabilityModal(false)}
        logs={traceabilityLogs}
        nombreCaso={nombreCaso || 'Expediente Actual'}
      />

      {/* Threshold Configuration Modal */}
      <ThresholdConfigModal
        isOpen={showThresholdModal}
        onClose={() => setShowThresholdModal(false)}
        thresholds={thresholds}
        setThresholds={setThresholds}
        contractRows={contractRows}
      />

      {/* Entity-Scoped & Global History Modal */}
      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        cases={entityCases}
        allCases={allProjects}
        activeEntity={activeEntity}
        onSelectCase={handleSelectCaseFromHistory}
        onViewCaseOnScreen={(c) => setViewingCaseOnScreen(c)}
      />
    </div>
  );
}
