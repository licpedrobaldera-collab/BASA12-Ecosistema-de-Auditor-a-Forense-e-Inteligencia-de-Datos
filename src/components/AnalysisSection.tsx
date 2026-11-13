import React, { useState } from 'react';
import { Sparkles, Terminal, ShieldAlert, Cpu, ArrowRight, Bell, BellOff, Sliders } from 'lucide-react';
import { FORENSIC_TEMPLATES } from '../utils/sampleData';
import {
  ContractEvidenceRow,
  DirectorResponsibility,
  DossierSectionItem,
  EvidenceFile,
  ForensicAnalysisResult,
  ForensicThresholds,
  ObservacionDecision,
  PaymentCycleRow,
} from '../types/forensic';

interface Props {
  nombreCaso: string;
  entidadNombre?: string;
  entidadDescripcion?: string;
  paisNormativa?: string;
  idioma?: string;
  origenes: string[];
  requerimiento: string;
  setRequerimiento: (val: string) => void;
  evidenceFile: EvidenceFile | null;
  contractRows?: ContractEvidenceRow[];
  paymentCycleRows?: PaymentCycleRow[];
  observaciones?: ObservacionDecision[];
  directors?: DirectorResponsibility[];
  actaLectura?: DossierSectionItem;
  informePreliminar?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  replicas?: DossierSectionItem[];
  contraReplicas?: DossierSectionItem[];
  anonimizar: boolean;
  onAnalysisComplete: (result: ForensicAnalysisResult) => void;
  thresholds: ForensicThresholds;
  setThresholds: React.Dispatch<React.SetStateAction<ForensicThresholds>>;
  onOpenThresholdSettings: () => void;
  activeAlertsCount?: number;
}

export const AnalysisSection: React.FC<Props> = ({
  nombreCaso,
  entidadNombre = 'Entidad Auditada',
  entidadDescripcion = '',
  paisNormativa = 'República Dominicana',
  idioma = 'Español',
  origenes,
  requerimiento,
  setRequerimiento,
  evidenceFile,
  contractRows = [],
  paymentCycleRows = [],
  observaciones = [],
  directors = [],
  actaLectura,
  informePreliminar,
  recursos = [],
  replicas = [],
  contraReplicas = [],
  anonimizar,
  onAnalysisComplete,
  thresholds,
  setThresholds,
  onOpenThresholdSettings,
  activeAlertsCount = 0,
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleRealtimeNotifications = () => {
    setThresholds((prev) => ({
      ...prev,
      notificacionesActivas: !prev.notificacionesActivas,
    }));
  };

  const applyTemplate = (tId: string) => {
    const tmpl = FORENSIC_TEMPLATES.find((t) => t.id === tId);
    if (tmpl) {
      setRequerimiento(tmpl.requerimiento);
    }
  };

  const executeAnalysis = async () => {
    if (!requerimiento.trim()) {
      setErrorMsg('Por favor ingrese un requerimiento analítico antes de ejecutar.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setProgress(20);
    setStatusMessage('1/4: Sellando evidencias reales y preparando expediente exclusivo...');

    try {
      const t1 = setTimeout(() => {
        setProgress(50);
        setStatusMessage('2/4: Analizando documentos, contratos y ciclo de pagos con Gemini 4...');
      }, 650);

      const t2 = setTimeout(() => {
        setProgress(80);
        setStatusMessage('3/4: Generando mejoras de control interno y script Python auditable...');
      }, 1600);

      const fullEvidence = (evidenceFile?.extractedText || evidenceFile?.contentSnippet || '').slice(0, 12000);

      const response = await fetch('/api/forensic/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCaso,
          entidadNombre,
          entidadDescripcion,
          paisNormativa,
          idioma,
          origenes,
          requerimiento,
          evidenciaSnippet: fullEvidence,
          contractRows,
          paymentCycleRows,
          observaciones,
          directors,
          actaLectura,
          informePreliminar,
          recursos,
          replicas,
          contraReplicas,
          anonimizar,
        }),
      });

      clearTimeout(t1);
      clearTimeout(t2);

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al ejecutar el análisis con IA');
      }

      setProgress(100);
      setStatusMessage(`4/4: Dictamen emitido con éxito (${data.modelUsed || 'gemini-4-hydrogen'}).`);

      const result: ForensicAnalysisResult = {
        resumenEjecutivo: data.data.resumenEjecutivo,
        banderasRojas: data.data.banderasRojas || [],
        mejorasControlInterno: data.data.mejorasControlInterno || [],
        codigoPython: data.data.codigoPython,
        explicacionTecnica: data.data.explicacionTecnica,
        fundamentoLegal: data.data.fundamentoLegal,
        metricasRiesgo: data.data.metricasRiesgo,
        digitalHash: data.digitalHash,
        timestamp: data.timestamp,
        casoNombre: nombreCaso,
      };

      setTimeout(() => {
        onAnalysisComplete(result);
        setLoading(false);
      }, 300);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error en ejecución pericial');
      setLoading(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
            🔬
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Requerimiento Analítico y Dictamen IA Integral
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Metodología R-C-T-F
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Análisis basado estrictamente en los datos reales suministrados para {entidadNombre}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Motor Activo: Gemini 4 Resiliente</span>
        </div>
      </div>

      {/* Real-time Alerts Interruptor & Threshold Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleRealtimeNotifications}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
              thresholds.notificacionesActivas
                ? 'bg-sky-500 shadow-md shadow-sky-500/30'
                : 'bg-slate-800'
            }`}
            title="Activar o desactivar notificaciones de fraude en tiempo real"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                thresholds.notificacionesActivas ? 'right-1' : 'left-1'
              }`}
            />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                {thresholds.notificacionesActivas ? (
                  <Bell className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <BellOff className="w-3.5 h-3.5 text-slate-500" />
                )}
                Notificaciones y Monitoreo en Tiempo Real
              </span>

              {thresholds.notificacionesActivas ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Activo
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  Inactivo
                </span>
              )}

              {activeAlertsCount > 0 && thresholds.notificacionesActivas && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  {activeAlertsCount} Alertas Críticas
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Evalúa contratos reales, ciclo de pagos y desviaciones Benford sobre los datos cargados
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-700/80 text-sky-300">
            Adendas &gt; <strong>{thresholds.adendaMaxPct}%</strong>
          </span>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 border border-slate-700/80 text-amber-300">
            Benford Δ &gt; <strong>±{thresholds.benfordMaxDeviationPct}%</strong>
          </span>

          <button
            type="button"
            onClick={onOpenThresholdSettings}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            Configurar Umbrales
          </button>
        </div>
      </div>

      {/* Templates */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
          Plantillas de Investigación Pericial
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {FORENSIC_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => applyTemplate(tmpl.id)}
              className="text-left p-3 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-slate-700 transition-all cursor-pointer group"
            >
              <div className="text-xs font-semibold text-sky-300 group-hover:text-sky-200 flex items-center justify-between">
                <span>{tmpl.titulo}</span>
                <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{tmpl.requerimiento}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Requirement Text Area */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Definición del Requerimiento Pericial (Editable)
          </label>
          <span className="text-[11px] text-slate-500 font-mono">{requerimiento.length} caracteres</span>
        </div>
        <textarea
          rows={4}
          value={requerimiento}
          onChange={(e) => setRequerimiento(e.target.value)}
          placeholder="Describa el objetivo forense real para esta entidad..."
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-sm text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors leading-relaxed font-sans"
        />
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 p-3 rounded-lg text-xs text-red-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-2 bg-slate-950 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-sky-300 font-medium flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              {statusMessage}
            </span>
            <span className="font-mono text-slate-400 font-semibold">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={executeAnalysis}
          disabled={loading}
          className={`w-full py-3 px-5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
            loading
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-950/50'
          }`}
        >
          <Terminal className="w-4 h-4" />
          {loading ? 'Procesando Análisis y Mejoras con IA...' : '🚀 Ejecutar Análisis Forense Final y Generar Mejoras IA'}
        </button>
      </div>
    </section>
  );
};
