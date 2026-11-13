/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  FolderTree,
  History,
  Sparkles,
  HelpCircle,
  Sliders,
  UserCheck,
  Calendar,
  Clock,
  Save,
  Building2,
  Eye,
} from 'lucide-react';
import { EvidenceSection } from './components/EvidenceSection';
import { AnalysisSection } from './components/AnalysisSection';
import { ResultsSection } from './components/ResultsSection';
import { BenfordChart } from './components/BenfordChart';
import { StreamlitFixModal } from './components/StreamlitFixModal';
import { HistoryModal } from './components/HistoryModal';
import { ThresholdConfigModal, DEFAULT_THRESHOLDS } from './components/ThresholdConfigModal';
import { RealtimeAlertBanner } from './components/RealtimeAlertBanner';
import { RiskDashboard } from './components/RiskDashboard';
import { ContradictoryDossierSection } from './components/ContradictoryDossierSection';
import { ObservationEvaluatorSection } from './components/ObservationEvaluatorSection';
import { UserProfileAndScopeModal } from './components/UserProfileAndScopeModal';
import { TraceabilityTimelineModal } from './components/TraceabilityTimelineModal';
import { EntitySwitcherBar } from './components/EntitySwitcherBar';
import { CaseRegistryAndHistorySection } from './components/CaseRegistryAndHistorySection';
import { CaseScreenViewerModal } from './components/CaseScreenViewerModal';
import {
  AuditedEntity,
  CaseSession,
  ContractEvidenceRow,
  EvidenceFile,
  ForensicAnalysisResult,
  ForensicThresholds,
  RealtimeAlert,
  AuditorProfile,
  AuditPeriodScope,
  DossierSectionItem,
  ObservacionDecision,
  TraceabilityLog,
} from './types/forensic';
import { SAMPLE_EDEESTE_SENASE_CONTRACTS } from './utils/sampleData';
import { INITIAL_OBSERVACIONES_SAMPLE, PAISES_NORMATIVA } from './utils/countryNorms';
import { PRESET_ENTITIES, getEntityPresetContracts } from './utils/entities';
import { playForensicAlertSound } from './utils/audioAlert';
import { calculateStringSHA256 } from './utils/crypto';

export default function App() {
  // Multi-Entity Management
  const [entities, setEntities] = useState<AuditedEntity[]>(PRESET_ENTITIES);
  const [activeEntity, setActiveEntity] = useState<AuditedEntity>(PRESET_ENTITIES[0]);

  // Active Case Identity
  const [activeCaseId, setActiveCaseId] = useState<string>('case-001');
  const [activeCaseCode, setActiveCaseCode] = useState<string>('CASO-2026-001');
  const [nombreCaso, setNombreCaso] = useState('Auditoria_Edeeste_Senase');
  const [origenesSeleccionados, setOrigenesSeleccionados] = useState<string[]>([
    'Licitaciones Públicas (DGCP / Compras Dominicana)',
    'Contabilidad Central (SAP / ERP)',
  ]);
  const [requerimiento, setRequerimiento] = useState(
    'Analizar adendas contractuales superiores al 50% del monto original. Identificar contratos fraccionados, incrementos desproporcionados e incumplimiento del Art. 31 de la Ley 340-06.'
  );
  const [anonimizar, setAnonimizar] = useState(true);

  // 1. Datos del Usuario / Perito Auditor
  const [auditor, setAuditor] = useState<AuditorProfile>(() => {
    const saved = localStorage.getItem('forensic_auditor_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      nombre: 'Lic. Pedro Baldera',
      cedulaId: '001-1234567-8',
      cargo: 'Auditor Superior Forense Big 4',
      entidad: 'Dirección de Auditoría Forense e Inteligencia de Datos',
      pais: 'República Dominicana',
      colegiatura: 'CP-10492-RD',
    };
  });

  // 2. País, Normativa e Idioma
  const [selectedCountry, setSelectedCountry] = useState<string>('DO');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Español (DO)');

  // 3. Alcance y Rango del Período
  const [periodo, setPeriodo] = useState<AuditPeriodScope>({
    fechaDesde: '2024-01-01',
    fechaHasta: '2024-12-31',
    alcancePericial:
      'Fiscalización integral de adendas contractuales superiores al 50%, fraccionamiento de pagos menores y erogaciones correspondientes al período fiscal 2024.',
  });

  // 4. Dossier Contradictorio
  const [actaLectura, setActaLectura] = useState<DossierSectionItem>({
    id: 'acta-01',
    titulo: 'Acta de Lectura Notificada de Hallazgos Preliminares',
    contenido:
      'En fecha 15 de agosto de 2024, se dio lectura formal al pliego de observaciones preliminares ante el comité de compras y la dirección financiera de la entidad auditada, concediendo el plazo legal de 15 días laborables para la interposición de recursos de reconsideración y aportación de pruebas documentales.',
    fecha: '2024-08-15',
    sha256: '4f9b2d88c1a93b45120e8d71249b671a53928190deaf41829013c7a918e47201',
    archivos: [],
  });

  const [recursos, setRecursos] = useState<DossierSectionItem[]>([
    {
      id: 'rec-01',
      numero: 1,
      titulo: 'Recurso de Reconsideración No. 1 (Alegatos Adendas Edeeste)',
      contenido:
        'La entidad sostiene que la Adenda No. 1 al contrato CT-EDE-2024-041 respondió a eventos de fuerza mayor derivados del colapso de transformadores en la subestación San Pedro, aportando bitácora de incidencias técnicas.',
      fecha: '2024-08-28',
      sha256: '7b2a99148d21c3b4a5690e1f78921a43bc912384910248ab12e94719283e1024',
      archivos: [],
    },
    {
      id: 'rec-02',
      numero: 2,
      titulo: 'Recurso de Reconsideración No. 2 (Descargos Comprobantes e-CF)',
      contenido:
        'Se anexa copia electrónica de los comprobantes fiscales validados con Registro Nacional del Contribuyente y constancia de pago de impuestos retenidos.',
      fecha: '2024-09-05',
      sha256: '3189a0f4819c4d28e71b29a103847291a2839401823904812930481928374619',
      archivos: [],
    },
  ]);

  const [informePreliminar, setInformePreliminar] = useState<DossierSectionItem>({
    id: 'inf-prelim-01',
    titulo: 'Informe Preliminar de Auditoría Forense No. INF-2024-088',
    contenido:
      'El equipo auditor constató indicios de sobrecostos presupuestarios, posibles adendas en violación al límite del 50% de la Ley 340-06 y debilidades graves en la supervisión de obras eléctricas.',
    fecha: '2024-08-10',
    sha256: 'a918b27346192837401928374610293847192038471029384710293847102938',
    archivos: [],
  });

  const [replicas, setReplicas] = useState<DossierSectionItem[]>([
    {
      id: 'rep-01',
      numero: 1,
      titulo: 'Réplica No. 1 a las Excepciones de Emergencia',
      contenido:
        'La firma auditora ratifica que para acogerse a la causal de emergencia del Art. 31, era mandatorio contar con declaratoria formal previa emitida por el Poder Ejecutivo y no meras certificaciones internas de la dirección técnica.',
      fecha: '2024-09-12',
      sha256: '9182736450192837461029384710293847102938471029384710293847102938',
      archivos: [],
    },
  ]);

  // 5. Resoluciones Contradictorias de Observaciones
  const [observaciones, setObservaciones] = useState<ObservacionDecision[]>(() => {
    const saved = localStorage.getItem('forensic_observaciones_decididas');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return INITIAL_OBSERVACIONES_SAMPLE;
  });

  // 6. Trazabilidad Histórica y Cadena de Custodia
  const [traceabilityLogs, setTraceabilityLogs] = useState<TraceabilityLog[]>([
    {
      id: 'log-01',
      timestamp: '2026-10-02 08:30:15',
      accion: 'Apertura de Expediente Criptográfico',
      usuario: 'Lic. Pedro Baldera',
      detalle: 'Inicialización de caso Auditoria_Edeeste_Senase y estructura de 7 carpetas conforme a ISO/IEC 27037.',
      sha256: '8b7a48d3e21543f06ac2914db9c581a42b918f6d713c7a0d421890e1fe6b8912',
      etapa: 'ENTRADA',
    },
    {
      id: 'log-02',
      timestamp: '2026-10-02 09:12:40',
      accion: 'Carga de Evidencia Contractual',
      usuario: 'Lic. Pedro Baldera',
      detalle: 'Carga de 7 contratos y adendas de Edeeste / Senase con sello SHA-256 verificado.',
      sha256: '9b7a48d3e21543f06ac2914db9c581a42b918f6d713c7a0d421890e1fe6b8912',
      etapa: 'ENTRADA',
    },
  ]);

  const [evidenceFile, setEvidenceFile] = useState<EvidenceFile | null>({
    name: 'Matriz_Contratos_Adendas_Edeeste_Senase_2024.csv',
    size: 48920,
    type: 'text/csv',
    parsedFormat: 'CSV',
    sha256: '9b7a48d3e21543f06ac2914db9c581a42b918f6d713c7a0d421890e1fe6b8912',
    uploadDate: new Date().toISOString(),
    contentSnippet: 'Muestra contractual de Edeeste / Senase con adendas > 50% verificadas por auditoría pericial.',
    extractedText: SAMPLE_EDEESTE_SENASE_CONTRACTS.map(
      (c) => `${c.contratoId} | ${c.proveedor} | Orig: ${c.montoOriginal} | Adenda: ${c.montoAdenda} (+${c.adendaPct}%)`
    ).join('\n'),
    recordCount: SAMPLE_EDEESTE_SENASE_CONTRACTS.length,
  });
  const [contractRows, setContractRows] = useState<ContractEvidenceRow[]>(SAMPLE_EDEESTE_SENASE_CONTRACTS);

  const [currentResult, setCurrentResult] = useState<ForensicAnalysisResult | null>(null);

  // Fraud Detection Thresholds State
  const [thresholds, setThresholds] = useState<ForensicThresholds>(DEFAULT_THRESHOLDS);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showTraceabilityModal, setShowTraceabilityModal] = useState(false);
  const [realtimeAlerts, setRealtimeAlerts] = useState<RealtimeAlert[]>([]);

  // Modals & Registry State
  const [showStreamlitFix, setShowStreamlitFix] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingCaseOnScreen, setViewingCaseOnScreen] = useState<CaseSession | null>(null);
  const [isSavingCase, setIsSavingCase] = useState(false);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);

  const [historyList, setHistoryList] = useState<CaseSession[]>([
    {
      id: 'case-001',
      codigoCaso: 'CASO-2026-001',
      nombreCaso: 'Auditoria_Edeeste_Senase',
      estado: 'EN_PROCESO',
      timestamp: new Date().toISOString(),
      raizCaso: 'caso_auditoria_edeeste_senase_20261002',
      origenes: ['Licitaciones Públicas', 'Contabilidad Central'],
      requerimiento: 'Adendas contractuales que superan el 50% del valor inicial contratado.',
      selloDigital: '9b7a48d3e21543f06ac2914db9c581a42b918f6d713c7a0d421890e1fe6b8912',
      entity: PRESET_ENTITIES[0],
      contractRows: SAMPLE_EDEESTE_SENASE_CONTRACTS,
      observaciones: INITIAL_OBSERVACIONES_SAMPLE,
    },
  ]);

  // Load persisted entities and cases from backend DB on startup
  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const [entRes, casesRes] = await Promise.all([fetch('/api/entities'), fetch('/api/cases')]);
        if (entRes.ok) {
          const entData = await entRes.json();
          if (entData.success && Array.isArray(entData.entities) && entData.entities.length > 0) {
            const customIds = new Set(PRESET_ENTITIES.map((e) => e.id));
            const extras = entData.entities.filter((e: AuditedEntity) => !customIds.has(e.id));
            setEntities([...PRESET_ENTITIES, ...extras]);
          }
        }
        if (casesRes.ok) {
          const caseData = await casesRes.json();
          if (caseData.success && Array.isArray(caseData.cases) && caseData.cases.length > 0) {
            setHistoryList(caseData.cases);
          } else {
            // Seed initial case in backend DB if empty
            const seedCase: CaseSession = {
              id: 'case-001',
              codigoCaso: 'CASO-2026-001',
              nombreCaso: 'Auditoria_Edeeste_Senase',
              estado: 'EN_PROCESO',
              timestamp: new Date().toISOString(),
              raizCaso: 'caso_auditoria_edeeste_senase_20261002',
              origenes: ['Licitaciones Públicas (DGCP / Compras Dominicana)', 'Contabilidad Central (SAP / ERP)'],
              requerimiento:
                'Analizar adendas contractuales superiores al 50% del monto original. Identificar contratos fraccionados, incrementos desproporcionados e incumplimiento del Art. 31 de la Ley 340-06.',
              selloDigital: '9b7a48d3e21543f06ac2914db9c581a42b918f6d713c7a0d421890e1fe6b8912',
              entity: PRESET_ENTITIES[0],
              auditor,
              periodo,
              paisNormativa: 'DO',
              idioma: 'Español (DO)',
              contractRows: SAMPLE_EDEESTE_SENASE_CONTRACTS,
              observaciones: INITIAL_OBSERVACIONES_SAMPLE,
              actaLectura,
              recursos,
              informePreliminar,
              replicas,
              traceabilityLogs,
            };
            await fetch('/api/cases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(seedCase),
            });
          }
        }
      } catch (err) {
        console.warn('No se pudo sincronizar historial inicial con el servidor:', err);
      }
    };
    loadPersistedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log Traceability Action Helper
  const logTraceabilityAction = async (
    accion: string,
    detalle: string,
    etapa: 'ENTRADA' | 'EVALUACION' | 'DICTAMEN' | 'SALIDA' = 'EVALUACION'
  ) => {
    const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const hash = await calculateStringSHA256(`${accion}_${detalle}_${ts}_${auditor.nombre}`);
    const newLog: TraceabilityLog = {
      id: `log-${Date.now()}`,
      timestamp: ts,
      accion,
      usuario: `${auditor.nombre} (${auditor.cargo})`,
      detalle,
      sha256: hash,
      etapa,
    };
    setTraceabilityLogs((prev) => [newLog, ...prev]);
  };

  // Autoguardado local
  useEffect(() => {
    try {
      localStorage.setItem('forensic_auditor_profile', JSON.stringify(auditor));
      localStorage.setItem('forensic_observaciones_decididas', JSON.stringify(observaciones));
    } catch {}
  }, [auditor, observaciones]);

  // Real-time Threshold Monitoring Engine
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
          descripcion: `${row.proveedor}: Aumento contractual del ${row.adendaPct.toFixed(1)}% viola el umbral configurado de ${thresholds.adendaMaxPct}%.`,
          valorDetectado: `+${row.adendaPct.toFixed(1)}%`,
          umbralLimite: `Máx. ${thresholds.adendaMaxPct}%`,
          referencia: 'Ley 340-06 / Art. 31',
        });
      }
    });

    const benfordDigit8Deviation = 15.9;
    if (benfordDigit8Deviation > thresholds.benfordMaxDeviationPct) {
      alerts.push({
        id: `alert-benford-8-${thresholds.benfordMaxDeviationPct}`,
        timestamp: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
        tipo: 'BENFORD_ANOMALIA',
        severidad: 'ALTA',
        titulo: 'Anomalía Benford en Primer Dígito (8)',
        descripcion: `Frecuencia observada del 21.0% difiere de la curva teórica (5.1%) por +${benfordDigit8Deviation.toFixed(1)}%, sobrepasando la tolerancia ±${thresholds.benfordMaxDeviationPct}%.`,
        valorDetectado: `Δ +${benfordDigit8Deviation.toFixed(1)}%`,
        umbralLimite: `Tolerancia ±${thresholds.benfordMaxDeviationPct}%`,
        referencia: 'NIA 240 / Prueba de Dígitos',
      });
    }

    setRealtimeAlerts(alerts);

    if (alerts.length > 0 && thresholds.alertaSonora) {
      playForensicAlertSound();
    }
  }, [
    contractRows,
    thresholds.adendaMaxPct,
    thresholds.benfordMaxDeviationPct,
    thresholds.notificacionesActivas,
    thresholds.alertaSonora,
  ]);

  const handleDismissAlert = (id: string) => {
    setRealtimeAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleClearAllAlerts = () => {
    setRealtimeAlerts([]);
  };

  // Switch active entity & prepare clean workspace for that entity
  const handleSwitchEntity = (entity: AuditedEntity) => {
    setActiveEntity(entity);
    const matchingCountry = PAISES_NORMATIVA.find((p) => p.codigo === entity.paisCodigo);
    if (matchingCountry) {
      setSelectedCountry(matchingCountry.codigo);
    }
    const newId = `case-${Date.now()}`;
    const newCode = `CASO-${new Date().getFullYear()}-${String(historyList.length + 1).padStart(3, '0')}`;
    setActiveCaseId(newId);
    setActiveCaseCode(newCode);
    setNombreCaso(`Auditoria_${entity.siglas}_${new Date().getFullYear()}`);
    setRequerimiento(
      `Auditoría forense integral sobre ${entity.nombre} (${entity.siglas}). Evaluar adendas superiores al ${thresholds.adendaMaxPct}%, desviaciones de Ley de Benford y cumplimiento normativo.`
    );
    const presetRows = getEntityPresetContracts(entity);
    setContractRows(presetRows);
    setEvidenceFile(null);
    setCurrentResult(null);
    setLastSavedMessage(`Análisis cambiado a la entidad ${entity.siglas} (${entity.nombre}).`);
    logTraceabilityAction(
      'Cambio de Entidad Auditada',
      `Se transfirió el espacio de análisis a ${entity.nombre} (RNC/NIF: ${entity.rncNif})`,
      'ENTRADA'
    );
  };

  const handleCreateEntity = async (newEnt: AuditedEntity) => {
    try {
      await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEnt),
      });
    } catch {}
    setEntities((prev) => [...prev, newEnt]);
    handleSwitchEntity(newEnt);
  };

  const handleNewCase = () => {
    const newId = `case-${Date.now()}`;
    const newCode = `CASO-${new Date().getFullYear()}-${String(historyList.length + 1).padStart(3, '0')}`;
    setActiveCaseId(newId);
    setActiveCaseCode(newCode);
    setNombreCaso(`Expediente_${activeEntity.siglas}_${Date.now().toString().slice(-4)}`);
    setCurrentResult(null);
    setEvidenceFile(null);
    setContractRows([]);
    setLastSavedMessage(`Nuevo caso limpio ${newCode} iniciado para ${activeEntity.siglas}. Carga un PDF, Excel, Word o TXT.`);
    logTraceabilityAction(
      'Apertura de Nuevo Caso',
      `Se creó el expediente ${newCode} para la entidad ${activeEntity.nombre}`,
      'ENTRADA'
    );
  };

  const persistCaseToServer = async (casePayload: CaseSession) => {
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(casePayload),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.caseRecord) {
        setHistoryList((prev) => {
          const exists = prev.some((c) => c.id === data.caseRecord.id);
          if (exists) {
            return prev.map((c) => (c.id === data.caseRecord.id ? data.caseRecord : c));
          }
          return [data.caseRecord, ...prev];
        });
        return data.caseRecord as CaseSession;
      }
    }
    return casePayload;
  };

  const handleRegisterCurrentCase = async () => {
    setIsSavingCase(true);
    try {
      const seal =
        currentResult?.digitalHash ||
        evidenceFile?.sha256 ||
        (await calculateStringSHA256(`${activeCaseId}_${nombreCaso}_${activeEntity.id}_${Date.now()}`));

      const casePayload: CaseSession = {
        id: activeCaseId,
        codigoCaso: activeCaseCode,
        nombreCaso,
        estado: currentResult ? 'DICTAMEN_EMITIDO' : 'EN_PROCESO',
        timestamp: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        raizCaso: `caso_${nombreCaso.toLowerCase().replace(/\s+/g, '_')}`,
        origenes: origenesSeleccionados,
        requerimiento,
        selloDigital: seal,
        entity: activeEntity,
        auditor,
        periodo,
        paisNormativa: selectedCountry,
        idioma: selectedLanguage,
        evidenceFile,
        contractRows,
        observaciones,
        actaLectura,
        recursos,
        informePreliminar,
        replicas,
        traceabilityLogs,
        resultado: currentResult,
      };

      const saved = await persistCaseToServer(casePayload);
      setLastSavedMessage(`Caso ${saved.codigoCaso || activeCaseCode} (${saved.nombreCaso}) registrado y guardado en el historial.`);
      logTraceabilityAction(
        'Registro de Caso en Historial',
        `Se guardó el expediente ${saved.codigoCaso} de ${activeEntity.siglas} en base de datos persistente.`,
        'SALIDA'
      );
    } catch (err) {
      console.error('Error registrando caso:', err);
      setLastSavedMessage('No se pudo conectar con el servidor; guardado en sesión activa.');
    } finally {
      setIsSavingCase(false);
    }
  };

  const handleDeleteCase = async (id: string) => {
    try {
      await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {}
    setHistoryList((prev) => prev.filter((c) => c.id !== id));
    logTraceabilityAction('Eliminación de Historial', `Se eliminó el registro ${id} del historial.`, 'SALIDA');
  };

  const handleAnalysisComplete = async (result: ForensicAnalysisResult) => {
    const enriched = {
      ...result,
      observacionesDecididas: observaciones,
    };
    setCurrentResult(enriched);

    const newCase: CaseSession = {
      id: activeCaseId,
      codigoCaso: activeCaseCode,
      nombreCaso,
      estado: 'DICTAMEN_EMITIDO',
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      raizCaso: `caso_${nombreCaso.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      origenes: origenesSeleccionados,
      requerimiento,
      selloDigital: result.digitalHash,
      entity: activeEntity,
      auditor,
      periodo,
      paisNormativa: selectedCountry,
      idioma: selectedLanguage,
      evidenceFile,
      contractRows,
      observaciones,
      actaLectura,
      recursos,
      informePreliminar,
      replicas,
      traceabilityLogs,
      resultado: enriched,
    };
    await persistCaseToServer(newCase);
    setLastSavedMessage(`Dictamen IA emitido y autoguardado en el expediente ${activeCaseCode}.`);
    logTraceabilityAction(
      'Emisión de Dictamen',
      `Análisis forense completado para ${activeEntity.siglas} con sello: ${result.digitalHash.substring(0, 12)}...`,
      'DICTAMEN'
    );
  };

  const handleSelectCaseFromHistory = (c: CaseSession) => {
    setActiveCaseId(c.id);
    setActiveCaseCode(c.codigoCaso || 'CASO-RECUPERADO');
    setNombreCaso(c.nombreCaso);
    setOrigenesSeleccionados(c.origenes || []);
    setRequerimiento(c.requerimiento);
    if (c.entity) {
      setActiveEntity(c.entity);
      setEntities((prev) => (prev.some((e) => e.id === c.entity!.id) ? prev : [...prev, c.entity!]));
    }
    if (c.auditor) setAuditor(c.auditor);
    if (c.periodo) setPeriodo(c.periodo);
    if (c.paisNormativa) setSelectedCountry(c.paisNormativa);
    if (c.idioma) setSelectedLanguage(c.idioma);
    if (c.evidenceFile !== undefined) setEvidenceFile(c.evidenceFile);
    if (c.contractRows) setContractRows(c.contractRows);
    if (c.observaciones) setObservaciones(c.observaciones);
    if (c.actaLectura) setActaLectura(c.actaLectura);
    if (c.recursos) setRecursos(c.recursos);
    if (c.informePreliminar) setInformePreliminar(c.informePreliminar);
    if (c.replicas) setReplicas(c.replicas);
    if (c.traceabilityLogs) setTraceabilityLogs(c.traceabilityLogs);
    setCurrentResult(c.resultado || null);
    setLastSavedMessage(`Caso ${c.codigoCaso || c.nombreCaso} cargado en pantalla para edición.`);
  };

  const currentCountryConfig = PAISES_NORMATIVA.find((p) => p.codigo === selectedCountry) || PAISES_NORMATIVA[0];

  const activeCaseSnapshot: CaseSession = {
    id: activeCaseId,
    codigoCaso: activeCaseCode,
    nombreCaso,
    estado: currentResult ? 'DICTAMEN_EMITIDO' : 'EN_PROCESO',
    timestamp: new Date().toISOString(),
    raizCaso: `caso_${nombreCaso.toLowerCase().replace(/\s+/g, '_')}`,
    origenes: origenesSeleccionados,
    requerimiento,
    selloDigital: currentResult?.digitalHash || evidenceFile?.sha256 || 'EN_CUSTODIA',
    entity: activeEntity,
    auditor,
    periodo,
    paisNormativa: selectedCountry,
    idioma: selectedLanguage,
    evidenceFile,
    contractRows,
    observaciones,
    actaLectura,
    recursos,
    informePreliminar,
    replicas,
    traceabilityLogs,
    resultado: currentResult,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Bar */}
      <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-800/40 px-4 py-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
            {activeCaseCode}
          </span>
          <span className="font-medium text-slate-200">
            Entidad: <strong>{activeEntity.siglas}</strong> | Perito: <strong>{auditor.nombre}</strong> | Jurisdicción:{' '}
            <strong>{currentCountryConfig.bandera} {currentCountryConfig.nombre}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setViewingCaseOnScreen(activeCaseSnapshot)}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver Expediente en Pantalla
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setShowUserProfileModal(true)}
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Configurar Auditor &amp; Normativa
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setShowTraceabilityModal(true)}
            className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            Trazabilidad ({traceabilityLogs.length})
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setShowStreamlitFix(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Solución Streamlit
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar + Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Sidebar */}
        <aside className="w-full lg:w-72 bg-slate-900/90 border-r border-slate-800 p-5 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {/* System Branding */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 font-bold">
                  🔬
                </div>
                <div>
                  <h1 className="font-bold text-sm text-white tracking-tight">ECOSISTEMA FORENSE</h1>
                  <span className="text-[10px] text-sky-400 font-mono">SUPREMO PRODUCCIÓN</span>
                </div>
              </div>
            </div>

            {/* Active Entity Sidebar Card */}
            <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                Entidad en Análisis
              </div>
              <div className="text-xs font-bold text-white leading-snug">{activeEntity.nombre}</div>
              <div className="text-[10.5px] text-slate-400 font-mono">
                {activeEntity.siglas} • RNC/NIF: {activeEntity.rncNif}
              </div>
              <div className="text-[10.5px] text-emerald-400 font-mono">
                Moneda: {activeEntity.moneda} ({activeEntity.simboloMoneda})
              </div>
            </div>

            {/* Auditor Details Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                  Perito Asignado
                </span>
                <button
                  onClick={() => setShowUserProfileModal(true)}
                  className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                >
                  Editar
                </button>
              </div>
              <div className="text-xs font-bold text-white leading-tight">{auditor.nombre}</div>
              <div className="text-[10.5px] text-slate-400 font-mono">ID: {auditor.cedulaId}</div>
              <div className="text-[10.5px] text-slate-500 truncate">{auditor.cargo}</div>

              <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-400">Jurisdicción:</span>
                <span className="text-slate-200 font-medium">
                  {currentCountryConfig.bandera} {currentCountryConfig.codigo}
                </span>
              </div>
            </div>

            {/* Periodo Auditado Quick Info */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Período Fiscal
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-200">
                {periodo.fechaDesde} al {periodo.fechaHasta}
              </div>
              <div className="text-[10px] text-slate-500 line-clamp-1">
                {periodo.alcancePericial}
              </div>
            </div>

            {/* Threshold Quick Status Card */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  <span>Umbrales Activos</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(true)}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                >
                  Ajustar
                </button>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg space-y-1.5 text-[11px] font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Alerta Adenda:</span>
                  <strong className="text-red-400">&gt; {thresholds.adendaMaxPct}%</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tolerancia Benford:</span>
                  <strong className="text-amber-400">±{thresholds.benfordMaxDeviationPct}%</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Monitoreo en Vivo:</span>
                  <strong className={thresholds.notificacionesActivas ? 'text-emerald-400' : 'text-slate-500'}>
                    {thresholds.notificacionesActivas ? 'ACTIVO' : 'PAUSADO'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Carpetas Automatizadas del Caso */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-sky-400" />
                  Carpetas de Expediente
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <Save className="w-3 h-3" /> Auto
                </span>
              </div>
              <ul className="text-xs font-mono space-y-1 text-slate-400">
                <li className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50">
                  <span className="text-sky-400 text-xs">01</span> acta_lectura/
                </li>
                <li className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50">
                  <span className="text-amber-400 text-xs">02</span> recursos_reconsideracion/
                </li>
                <li className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50">
                  <span className="text-red-400 text-xs">03</span> informe_preliminar/
                </li>
                <li className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50">
                  <span className="text-emerald-400 text-xs">04</span> replicas_descargos/
                </li>
                <li className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50">
                  <span className="text-purple-400 text-xs">05</span> entradas_evidencias/
                </li>
                <li className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50">
                  <span className="text-blue-400 text-xs">06</span> salidas_dictamenes/
                </li>
              </ul>
            </div>
          </div>

          {/* Sidebar Footer Buttons */}
          <div className="pt-6 border-t border-slate-800 space-y-2">
            <button
              onClick={() => setViewingCaseOnScreen(activeCaseSnapshot)}
              className="w-full py-2 px-3 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver Caso en Pantalla
            </button>

            <button
              onClick={() => setShowTraceabilityModal(true)}
              className="w-full py-2 px-3 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              Trazabilidad y Cadena de Custodia
            </button>

            <button
              onClick={() => setShowHistory(true)}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              Histórico de Casos ({historyList.length})
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {/* Main Title Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Sistema Soberano Multi-Entidad • PDF/Excel/Word/TXT • ISO/IEC 27037 &amp; NIA 240
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                  🔬 Ecosistema de Auditoría Forense e Inteligencia de Datos
                </h1>
                <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
                  Lectura universal de evidencias digitales (PDF, Excel, Word, TXT, OCR), cambio instantáneo de entidad auditada,
                  registro persistente de casos en pantalla y evaluación contradictoria IA adaptada a {currentCountryConfig.nombre}.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setShowUserProfileModal(true)}
                  className="px-4 py-2.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 text-sky-400" />
                  Auditor &amp; Jurisdicción
                </button>

                <button
                  onClick={() => setShowThresholdModal(true)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Umbrales de Fraude
                </button>
              </div>
            </div>
          </div>

          {/* Multi-Entity Switcher & Case Registration Bar */}
          <EntitySwitcherBar
            entities={entities}
            activeEntity={activeEntity}
            onSwitchEntity={handleSwitchEntity}
            onCreateEntity={handleCreateEntity}
            onRegisterCurrentCase={handleRegisterCurrentCase}
            onNewCase={handleNewCase}
            isSavingCase={isSavingCase}
            lastSavedMessage={lastSavedMessage}
            activeCaseCode={activeCaseCode}
          />

          {/* Risk Dashboard */}
          <RiskDashboard
            contractRows={contractRows}
            thresholds={thresholds}
            realtimeAlerts={realtimeAlerts}
            onOpenThresholds={() => setShowThresholdModal(true)}
            currentResult={currentResult}
            simboloMoneda={activeEntity.simboloMoneda}
          />

          {/* On-Screen Case Registry & Persistent History Table */}
          <CaseRegistryAndHistorySection
            cases={historyList}
            entities={entities}
            activeCaseId={activeCaseId}
            onRegisterCase={handleRegisterCurrentCase}
            onSelectCaseToLoad={handleSelectCaseFromHistory}
            onViewCaseOnScreen={(c) => setViewingCaseOnScreen(c)}
            onDeleteCase={handleDeleteCase}
            isSaving={isSavingCase}
          />

          {/* Section: Gestión y Procesamiento Universal de Evidencias */}
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
            simboloMoneda={activeEntity.simboloMoneda}
            onFileParsed={(parsedFile, detectedCount) => {
              logTraceabilityAction(
                'Lectura de Evidencia Digital',
                `Archivo ${parsedFile.name} [${parsedFile.parsedFormat || 'DIGITAL'}] procesado (${detectedCount} registros tabulares, SHA-256: ${parsedFile.sha256.substring(0, 10)}...)`,
                'ENTRADA'
              );
            }}
          />

          {/* Contradictory Dossier */}
          <ContradictoryDossierSection
            actaLectura={actaLectura}
            setActaLectura={setActaLectura}
            recursos={recursos}
            setRecursos={setRecursos}
            informePreliminar={informePreliminar}
            setInformePreliminar={setInformePreliminar}
            replicas={replicas}
            setReplicas={setReplicas}
            nombreCaso={nombreCaso}
            onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'ENTRADA')}
          />

          {/* Observation Evaluator */}
          <ObservationEvaluatorSection
            observaciones={observaciones}
            setObservaciones={setObservaciones}
            selectedCountry={selectedCountry}
            selectedLanguage={selectedLanguage}
            auditor={auditor}
            actaLecturaContext={actaLectura.contenido}
            recursosContext={recursos.map((r) => `${r.titulo}: ${r.contenido}`).join('\n\n')}
            onLogAction={(accion, detalle) => logTraceabilityAction(accion, detalle, 'EVALUACION')}
          />

          {/* Section: Requerimiento Analítico Forense & Consenso IA */}
          <AnalysisSection
            nombreCaso={nombreCaso}
            entidadNombre={`${activeEntity.nombre} (${activeEntity.siglas})`}
            paisNormativa={currentCountryConfig.nombre}
            idioma={selectedLanguage}
            origenes={origenesSeleccionados}
            requerimiento={requerimiento}
            setRequerimiento={setRequerimiento}
            evidenceFile={evidenceFile}
            anonimizar={anonimizar}
            onAnalysisComplete={handleAnalysisComplete}
            thresholds={thresholds}
            setThresholds={setThresholds}
            onOpenThresholdSettings={() => setShowThresholdModal(true)}
            activeAlertsCount={realtimeAlerts.length}
          />

          {/* Section: Dictamen Pericial y Código Generado */}
          {currentResult && (
            <ResultsSection
              resultado={currentResult}
              nombreCaso={nombreCaso}
              origenes={origenesSeleccionados}
              requerimiento={requerimiento}
              contractRows={contractRows}
              simboloMoneda={activeEntity.simboloMoneda}
              adendaThresholdPct={thresholds.adendaMaxPct}
              auditor={auditor}
              periodo={periodo}
              paisNormativa={currentCountryConfig.nombre}
              observaciones={observaciones}
              actaLectura={actaLectura}
              recursos={recursos}
              replicas={replicas}
            />
          )}

          {/* Section: Análisis Estadístico y Ley de Benford */}
          <BenfordChart
            contractRows={contractRows}
            adendaThresholdPct={thresholds.adendaMaxPct}
            benfordMaxDeviationPct={thresholds.benfordMaxDeviationPct}
            evidenceNumericAmounts={evidenceFile?.numericAmounts}
          />

          {/* Footer Note */}
          <footer className="text-center py-6 border-t border-slate-900 text-xs text-slate-500 space-y-1">
            <p>
              Ecosistema de Auditoría Forense e Inteligencia de Datos • Entidad: {activeEntity.siglas} • Perito:{' '}
              {auditor.nombre} ({auditor.cedulaId})
            </p>
            <p className="text-[11px] text-slate-600">
              Cumplimiento estricto con estándares ISO/IEC 27037 para el tratamiento de evidencia digital y normas NIA 240 /
              ISA 500.
            </p>
          </footer>
        </main>
      </div>

      {/* Real-time Alert Toast Banner */}
      <RealtimeAlertBanner
        alerts={realtimeAlerts}
        onDismissAlert={handleDismissAlert}
        onClearAll={handleClearAllAlerts}
        onOpenSettings={() => setShowThresholdModal(true)}
      />

      {/* Full On-Screen Case Viewer Modal */}
      <CaseScreenViewerModal
        caseData={viewingCaseOnScreen}
        onClose={() => setViewingCaseOnScreen(null)}
        onLoadIntoWorkspace={handleSelectCaseFromHistory}
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
        onSave={() =>
          logTraceabilityAction(
            'Actualización de Perfil y Alcance',
            `Auditor: ${auditor.nombre}, Jurisdicción: ${selectedCountry}, Período: ${periodo.fechaDesde} a ${periodo.fechaHasta}`,
            'ENTRADA'
          )
        }
      />

      {/* Traceability Timeline Modal */}
      <TraceabilityTimelineModal
        isOpen={showTraceabilityModal}
        onClose={() => setShowTraceabilityModal(false)}
        logs={traceabilityLogs}
        nombreCaso={nombreCaso}
      />

      {/* Threshold Configuration Modal */}
      <ThresholdConfigModal
        isOpen={showThresholdModal}
        onClose={() => setShowThresholdModal(false)}
        thresholds={thresholds}
        setThresholds={setThresholds}
        contractRows={contractRows}
      />

      {/* Streamlit Fix Diagnosis Modal */}
      <StreamlitFixModal
        isOpen={showStreamlitFix}
        onClose={() => setShowStreamlitFix(false)}
      />

      {/* Case History Modal */}
      <HistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        cases={historyList}
        onSelectCase={handleSelectCaseFromHistory}
        onViewCaseOnScreen={(c) => setViewingCaseOnScreen(c)}
      />
    </div>
  );
}
