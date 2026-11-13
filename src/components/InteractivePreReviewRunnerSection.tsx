import React, { useState } from 'react';
import {
  Play,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Sparkles,
  FileCheck2,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import {
  AuditedEntity,
  AuditorProfile,
  AuditPeriodScope,
  ContractEvidenceRow,
  DirectorResponsibility,
  DossierSectionItem,
  ForensicAnalysisResult,
  InteractivePreReviewReport,
  ObservacionDecision,
  PaymentCycleRow,
  PreReviewDocType,
} from '../types/forensic';
import { calculateStringSHA256 } from '../utils/crypto';

interface Props {
  activeEntity: AuditedEntity | null;
  auditor: AuditorProfile;
  periodo: AuditPeriodScope;
  paisNormativa: string;
  idioma: string;
  actaLectura: DossierSectionItem;
  setActaLectura: React.Dispatch<React.SetStateAction<DossierSectionItem>>;
  informePreliminar: DossierSectionItem;
  setInformePreliminar: React.Dispatch<React.SetStateAction<DossierSectionItem>>;
  recursos: DossierSectionItem[];
  replicas: DossierSectionItem[];
  contraReplicas: DossierSectionItem[];
  directors: DirectorResponsibility[];
  contractRows: ContractEvidenceRow[];
  paymentCycleRows: PaymentCycleRow[];
  observaciones: ObservacionDecision[];
  resultado: ForensicAnalysisResult | null;
  preReviewReports: Partial<Record<PreReviewDocType, InteractivePreReviewReport>>;
  setPreReviewReports: React.Dispatch<
    React.SetStateAction<Partial<Record<PreReviewDocType, InteractivePreReviewReport>>>
  >;
  onLogAction: (accion: string, detalle: string) => void;
}

interface ConsoleLine {
  id: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'INFO';
  rule: string;
  detail: string;
  ms: number;
}

const DOC_META: {
  id: PreReviewDocType;
  label: string;
  subtitle: string;
}[] = [
  {
    id: 'ACTA_LECTURA',
    label: '1. Revisión Previa: Acta de Lectura',
    subtitle: 'Valida comparecientes, fecha legal, notificación al titular y anexos foliados.',
  },
  {
    id: 'INFORME_PRELIMINAR',
    label: '2. Revisión Previa: Informe Preliminar',
    subtitle: 'Valida pliego de cargos, evidencia soporte y segregación por director/decreto.',
  },
  {
    id: 'INFORME_FINAL',
    label: '3. Revisión Previa: Informe Final / Dictamen',
    subtitle: 'Valida resolución de réplicas, contra-réplicas multi-período, base legal y SHA-256.',
  },
];

export const InteractivePreReviewRunnerSection: React.FC<Props> = ({
  activeEntity,
  auditor,
  periodo,
  paisNormativa,
  idioma,
  actaLectura,
  setActaLectura,
  informePreliminar,
  setInformePreliminar,
  recursos,
  replicas,
  contraReplicas,
  directors,
  contractRows,
  paymentCycleRows,
  observaciones,
  resultado,
  preReviewReports,
  setPreReviewReports,
  onLogAction,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<PreReviewDocType>('ACTA_LECTURA');
  const [runningAi, setRunningAi] = useState(false);
  const [runningLocal, setRunningLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);

  // Interactive check toggles
  const [rulesEnabled, setRulesEnabled] = useState({
    identidad: true,
    directoresDecretos: true,
    replicasContra: true,
    cicloPagos: true,
    contenidoYHash: true,
  });

  const activeReport = preReviewReports[selectedDoc] || null;

  const runLiveDynamicExecutor = async () => {
    setRunningLocal(true);
    setErrorMsg(null);
    const lines: ConsoleLine[] = [];
    const t0 = performance.now();

    lines.push({
      id: `ln-start-${Date.now()}`,
      status: 'INFO',
      rule: `INIT [${selectedDoc}]`,
      detail: `Ejecutor interactivo iniciado sobre ${activeEntity?.nombre || 'Entidad sin registrar'} (${paisNormativa})`,
      ms: 1,
    });

    if (rulesEnabled.identidad) {
      const ok = Boolean(activeEntity?.nombre && auditor?.nombre && auditor?.cedulaId);
      lines.push({
        id: 'ln-id',
        status: ok ? 'PASS' : 'WARN',
        rule: 'Identidad & Período',
        detail: ok
          ? `Entidad=${activeEntity?.siglas}, Auditor=${auditor.nombre} (${auditor.cedulaId}), Período ${periodo.fechaDesde}→${periodo.fechaHasta}`
          : 'Complete nombre/cédula del auditor o registro oficial de la entidad.',
        ms: Math.round(performance.now() - t0 + 4),
      });
    }

    if (rulesEnabled.directoresDecretos) {
      const withoutSources = directors.filter((d) => d.fuentes.length === 0).length;
      lines.push({
        id: 'ln-dir',
        status: directors.length === 0 ? 'FAIL' : withoutSources > 0 ? 'WARN' : 'PASS',
        rule: 'Segregación por Decretos de Directores',
        detail:
          directors.length === 0
            ? 'Sin directores registrados. Ejecute "Buscar Decretos Online IA" para segregar responsabilidad por período.'
            : `${directors.length} director(es) cargado(s); ${directors.length - withoutSources} con fuente oficial verificada.`,
        ms: Math.round(performance.now() - t0 + 9),
      });
    }

    if (rulesEnabled.replicasContra) {
      const totalEscritos = recursos.length + replicas.length + contraReplicas.length;
      const missingDir = [...replicas, ...contraReplicas].filter((x) => !x.directorId && !x.periodoEtiqueta).length;
      lines.push({
        id: 'ln-rep',
        status: totalEscritos === 0 && selectedDoc === 'INFORME_FINAL' ? 'WARN' : missingDir > 0 ? 'WARN' : 'PASS',
        rule: 'Control Multi-Período (Recursos / Réplicas / Contra-Réplicas)',
        detail: `Recursos: ${recursos.length} | Réplicas: ${replicas.length} | Contra-Réplicas: ${contraReplicas.length}${missingDir > 0 ? ` (${missingDir} sin período/director)` : ''}.`,
        ms: Math.round(performance.now() - t0 + 13),
      });
    }

    if (rulesEnabled.cicloPagos) {
      const irregularPayments = paymentCycleRows.filter((p) => p.estadoCiclo !== 'COMPLETO').length;
      const anomalousContracts = contractRows.filter((c) => c.esAnomalo).length;
      lines.push({
        id: 'ln-pay',
        status: irregularPayments > 0 || anomalousContracts > 0 ? 'WARN' : paymentCycleRows.length > 0 || contractRows.length > 0 ? 'PASS' : 'INFO',
        rule: 'Consistencia Contratos & Ciclo de Pagos',
        detail: `Contratos: ${contractRows.length} (${anomalousContracts} anomalía/s) | Pagos: ${paymentCycleRows.length} (${irregularPayments} con incidencia en ciclo).`,
        ms: Math.round(performance.now() - t0 + 17),
      });
    }

    if (rulesEnabled.contenidoYHash) {
      let okDoc = false;
      let docDetail = '';
      if (selectedDoc === 'ACTA_LECTURA') {
        okDoc = actaLectura.contenido.trim().length >= 40 || actaLectura.archivos.length > 0;
        docDetail = `Acta: ${actaLectura.contenido.trim().length} caracteres, ${actaLectura.archivos.length} archivo(s).`;
      } else if (selectedDoc === 'INFORME_PRELIMINAR') {
        okDoc = informePreliminar.contenido.trim().length >= 40 || observaciones.length > 0;
        docDetail = `Preliminar: ${informePreliminar.contenido.trim().length} caracteres, ${observaciones.length} observación(es).`;
      } else {
        okDoc = Boolean(resultado?.resumenEjecutivo && resultado?.digitalHash);
        docDetail = okDoc
          ? `Dictamen Final listo con sello SHA-256 ${resultado?.digitalHash.slice(0, 12)}...`
          : 'Aún no se ha ejecutado el Dictamen Final IA en el Paso 5.';
      }
      const runHash = await calculateStringSHA256(`${selectedDoc}_${lines.length}_${Date.now()}`);
      lines.push({
        id: 'ln-doc',
        status: okDoc ? 'PASS' : 'FAIL',
        rule: `Integridad Documental [${selectedDoc}]`,
        detail: `${docDetail} Hash Prueba: ${runHash.slice(0, 14)}...`,
        ms: Math.round(performance.now() - t0 + 22),
      });
    }

    setConsoleLines(lines);
    setRunningLocal(false);
    onLogAction(
      'Ejecutor Interactivo Local',
      `Prueba dinámica sobre ${selectedDoc}: ${lines.filter((l) => l.status === 'PASS').length} PASS, ${lines.filter((l) => l.status === 'WARN').length} WARN, ${lines.filter((l) => l.status === 'FAIL').length} FAIL.`
    );
  };

  const runAiPreReview = async () => {
    setRunningAi(true);
    setErrorMsg(null);
    await runLiveDynamicExecutor();

    try {
      const resp = await fetch('/api/forensic/pre-review-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoDocumento: selectedDoc,
          entity: activeEntity,
          periodo,
          auditor,
          paisNormativa,
          idioma,
          actaLectura,
          informePreliminar,
          recursos,
          replicas,
          contraReplicas,
          directors,
          contractRows,
          paymentCycleRows,
          observaciones,
          resultado,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success || !data.report) {
        throw new Error(data.error || 'No se pudo completar la revisión previa con IA.');
      }

      const report: InteractivePreReviewReport = data.report;
      setPreReviewReports((prev) => ({
        ...prev,
        [selectedDoc]: report,
      }));

      onLogAction(
        `Revisión Previa IA (${selectedDoc})`,
        `Estado: ${report.estadoAprobacion} (${report.puntuacionPreparacion}/100) • SHA-256: ${report.sha256.slice(0, 10)}...`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Error ejecutando la revisión previa IA.');
    } finally {
      setRunningAi(false);
    }
  };

  const applySuggestedDraftToDocument = () => {
    if (!activeReport?.textoMejoradoSugerido) return;
    const block = `\n\n--- [CLÁUSULA / MEJORA REVISIÓN PREVIA IA] ---\n${activeReport.textoMejoradoSugerido}`;
    if (selectedDoc === 'ACTA_LECTURA') {
      setActaLectura((p) => ({ ...p, contenido: (p.contenido + block).trim() }));
      onLogAction('Mejora Aplicada a Acta de Lectura', 'Se incorporó el texto sugerido por el Revisor Previo IA.');
    } else if (selectedDoc === 'INFORME_PRELIMINAR') {
      setInformePreliminar((p) => ({ ...p, contenido: (p.contenido + block).trim() }));
      onLogAction('Mejora Aplicada a Informe Preliminar', 'Se incorporó el texto sugerido por el Revisor Previo IA.');
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Ejecutor Interactivo de Revisión Previa en Línea
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                QA Pre-Emisión Dinámico
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Prueba en vivo y valida requisitos legales, directores segregados y contradicción antes de emitir Acta de Lectura, Informe Preliminar o Informe Final.
            </p>
          </div>
        </div>
      </div>

      {/* Document Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {DOC_META.map((doc) => {
          const saved = preReviewReports[doc.id];
          const isSelected = selectedDoc === doc.id;
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => setSelectedDoc(doc.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                isSelected
                  ? 'bg-teal-950/40 border-teal-400 text-white shadow-lg shadow-teal-950/30'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{doc.label}</span>
                {saved && (
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      saved.estadoAprobacion === 'APROBADO_REVISION'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : saved.estadoAprobacion === 'CON_OBSERVACIONES_PREVIAS'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                    }`}
                  >
                    {saved.puntuacionPreparacion}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{doc.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Interactive Rule Toggles & Execution Controls */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-400" />
          Reglas Dinámicas de Prueba Activas para [{selectedDoc}]:
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { key: 'identidad', label: 'Entidad, Auditor y Período' },
            { key: 'directoresDecretos', label: 'Decretos y Directores Segregados' },
            { key: 'replicasContra', label: 'Recursos, Réplicas y Contra-Réplicas' },
            { key: 'cicloPagos', label: 'Contratos y Ciclo de Pagos' },
            { key: 'contenidoYHash', label: 'Texto Base y Sello SHA-256' },
          ].map((chk) => (
            <label
              key={chk.key}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 text-slate-200"
            >
              <input
                type="checkbox"
                checked={(rulesEnabled as any)[chk.key]}
                onChange={(e) =>
                  setRulesEnabled((prev) => ({ ...prev, [chk.key]: e.target.checked }))
                }
                className="rounded border-slate-700"
              />
              <span>{chk.label}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={runLiveDynamicExecutor}
            disabled={runningLocal}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {runningLocal ? 'Ejecutando...' : 'Ejecutar Prueba Dinámica Local en Vivo'}
          </button>

          <button
            type="button"
            onClick={runAiPreReview}
            disabled={runningAi}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-sky-600 hover:from-teal-500 hover:to-sky-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg"
          >
            {runningAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {runningAi ? 'Auditando Documento con IA...' : 'Ejecutar Revisión Previa Profunda IA'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Interactive Live Execution Console */}
      {consoleLines.length > 0 && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Consola Interactiva de Ejecución en Vivo</span>
            <span className="text-emerald-400">
              {consoleLines.filter((l) => l.status === 'PASS').length} PASS /{' '}
              {consoleLines.filter((l) => l.status === 'WARN').length} WARN /{' '}
              {consoleLines.filter((l) => l.status === 'FAIL').length} FAIL
            </span>
          </div>
          <div className="space-y-1.5 font-mono text-[11px]">
            {consoleLines.map((ln) => (
              <div
                key={ln.id}
                className="flex items-start justify-between gap-2 bg-slate-900/80 border border-slate-800/80 rounded px-2.5 py-1.5"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold shrink-0 ${
                      ln.status === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : ln.status === 'WARN'
                        ? 'bg-amber-500/20 text-amber-300'
                        : ln.status === 'FAIL'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {ln.status}
                  </span>
                  <div>
                    <strong className="text-white">{ln.rule}: </strong>
                    <span className="text-slate-300">{ln.detail}</span>
                  </div>
                </div>
                <span className="text-slate-500 shrink-0">{ln.ms}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Deep Pre-Review Report */}
      {activeReport && (
        <div className="bg-slate-950/90 border border-teal-500/30 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Resultado Revisión Previa: {activeReport.tipoDocumento}
              </div>
              <p className="text-xs text-slate-300 mt-1">{activeReport.resumenEjecutivo}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Preparación</div>
                <div className="text-2xl font-extrabold text-white">{activeReport.puntuacionPreparacion}%</div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  activeReport.estadoAprobacion === 'APROBADO_REVISION'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : activeReport.estadoAprobacion === 'CON_OBSERVACIONES_PREVIAS'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-red-500/20 text-red-300 border-red-500/40'
                }`}
              >
                {activeReport.estadoAprobacion}
              </span>
            </div>
          </div>

          {/* Checklist findings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeReport.hallazgosRevision.map((h) => (
              <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    {h.estado === 'CUMPLE' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {h.estado === 'ATENCION' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                    {h.estado === 'CRITICO' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    {h.criterio}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">{h.estado}</span>
                </div>
                <p className="text-slate-300">{h.detalle}</p>
                {h.recomendacion && (
                  <p className="text-sky-300 text-[11px]">
                    <strong>Acción:</strong> {h.recomendacion}
                  </p>
                )}
              </div>
            ))}
          </div>

          {activeReport.textoMejoradoSugerido && (
            <div className="bg-slate-900 border border-sky-800/40 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" />
                  Borrador / Cláusula de Refuerzo Sugerida por IA
                </span>
                {(selectedDoc === 'ACTA_LECTURA' || selectedDoc === 'INFORME_PRELIMINAR') && (
                  <button
                    type="button"
                    onClick={applySuggestedDraftToDocument}
                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-semibold cursor-pointer"
                  >
                    Insertar al Documento Actual
                  </button>
                )}
              </div>
              <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                {activeReport.textoMejoradoSugerido}
              </p>
            </div>
          )}

          <div className="text-[10px] font-mono text-slate-500 flex justify-between flex-wrap gap-2">
            <span>Modelo: {activeReport.modelUsed || 'gemini-4-hydrogen'}</span>
            <span>SHA-256 Revisión: {activeReport.sha256}</span>
          </div>
        </div>
      )}
    </section>
  );
};
