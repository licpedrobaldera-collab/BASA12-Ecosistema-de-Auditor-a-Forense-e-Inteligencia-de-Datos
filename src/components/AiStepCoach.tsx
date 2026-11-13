import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Loader2,
  ListChecks,
} from 'lucide-react';
import { AuditedEntity, StepGuideResponse } from '../types/forensic';

interface Props {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepSubtitle: string;
  onPrevStep?: () => void;
  onNextStep?: () => void;
  activeEntity: AuditedEntity | null;
  caseName: string;
  paisNormativa: string;
  idioma: string;
  evidenceSummary: string;
  contractsCount: number;
  paymentsCount: number;
  observationsCount: number;
  hasFinalResult: boolean;
}

export const AiStepCoach: React.FC<Props> = ({
  currentStep,
  totalSteps,
  stepTitle,
  stepSubtitle,
  onPrevStep,
  onNextStep,
  activeEntity,
  caseName,
  paisNormativa,
  idioma,
  evidenceSummary,
  contractsCount,
  paymentsCount,
  observationsCount,
  hasFinalResult,
}) => {
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState<StepGuideResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clear stale guide when step or entity changes
  useEffect(() => {
    setGuide(null);
    setErrorMsg(null);
  }, [currentStep, activeEntity?.id]);

  const requestAiGuide = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/guide-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: currentStep,
          entity: activeEntity,
          caseName,
          paisNormativa,
          idioma,
          evidenceSummary,
          contractsCount,
          paymentsCount,
          observationsCount,
          hasFinalResult,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo obtener la guía IA.');
      }
      setGuide(data.guide);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error consultando guía IA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-slate-900 via-sky-950/30 to-slate-900 border border-sky-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center font-extrabold text-sm shrink-0">
            P{currentStep}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                Paso {currentStep} de {totalSteps}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">{stepTitle}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{stepSubtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={requestAiGuide}
            disabled={loading}
            className="px-3.5 py-2 bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 border border-sky-400/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-sky-300" />}
            {loading ? 'Analizando paso...' : 'Guiar y Sugerir Mejoras con IA'}
          </button>

          {onPrevStep && currentStep > 1 && (
            <button
              type="button"
              onClick={onPrevStep}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
          )}

          {onNextStep && currentStep < totalSteps && (
            <button
              type="button"
              onClick={onNextStep}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
            >
              Siguiente Paso
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {guide && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-sky-300">
              <Compass className="w-4 h-4" />
              Diagnóstico del Asistente Pericial IA
            </div>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                guide.estadoPaso === 'LISTO'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : guide.estadoPaso === 'ATENCION'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}
            >
              {guide.estadoPaso}
            </span>
          </div>

          <p className="text-slate-200 leading-relaxed">{guide.diagnostico}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {guide.pasosRecomendados?.length > 0 && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
                <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" />
                  Acciones Recomendadas en este Paso:
                </div>
                <ul className="space-y-1 text-slate-300">
                  {guide.pasosRecomendados.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {guide.mejorasSugeridas?.length > 0 && (
              <div className="bg-slate-900/80 border border-emerald-800/40 rounded-lg p-3 space-y-1.5">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Mejoras Sugeridas sobre tus Datos Reales:
                </div>
                <ul className="space-y-1 text-slate-300">
                  {guide.mejorasSugeridas.map((m, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {guide.siguientePasoMensaje && (
            <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
              <strong>Siguiente acción: </strong>
              {guide.siguientePasoMensaje}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
