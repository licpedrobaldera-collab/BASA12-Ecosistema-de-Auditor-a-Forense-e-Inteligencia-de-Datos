import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Scale,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Cpu,
  Globe,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ObservacionDecision, AuditorProfile, PaisNormativaConfig } from '../types/forensic';
import { PAISES_NORMATIVA } from '../utils/countryNorms';

interface Props {
  observaciones: ObservacionDecision[];
  setObservaciones: React.Dispatch<React.SetStateAction<ObservacionDecision[]>>;
  selectedCountry: string;
  selectedLanguage: string;
  auditor: AuditorProfile;
  actaLecturaContext: string;
  recursosContext: string;
  onLogAction: (accion: string, detalle: string) => void;
}

export const ObservationEvaluatorSection: React.FC<Props> = ({
  observaciones,
  setObservaciones,
  selectedCountry,
  selectedLanguage,
  auditor,
  actaLecturaContext,
  recursosContext,
  onLogAction,
}) => {
  const [selectedMotorIA, setSelectedMotorIA] = useState<'gemini' | 'meta_llama' | 'consenso'>('gemini');
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evaluatingAll, setEvaluatingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(observaciones[0]?.id || null);

  const [showNewObsModal, setShowNewObsModal] = useState(false);
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescPreliminar, setNewDescPreliminar] = useState('');
  const [newDescargo, setNewDescargo] = useState('');
  const [newMonto, setNewMonto] = useState(0);

  const countryConfig = PAISES_NORMATIVA.find((p) => p.codigo === selectedCountry) || PAISES_NORMATIVA[0];

  const evaluateSingleObservation = async (obs: ObservacionDecision) => {
    setEvaluatingId(obs.id);
    try {
      const resp = await fetch('/api/forensic/evaluate-observation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observacion: `${obs.titulo}. ${obs.descripcionPreliminar}`,
          descargoAlegato: obs.descargoAlegato,
          actaLecturaContext,
          recursosContext,
          paisNormativa: countryConfig.nombre,
          idioma: selectedLanguage,
          motorIA: selectedMotorIA,
          usuario: auditor,
        }),
      });

      const resData = await resp.json();
      if (resData.success && resData.data) {
        const d = resData.data;
        setObservaciones((prev) =>
          prev.map((item) =>
            item.id === obs.id
              ? {
                  ...item,
                  decision: d.decision || item.decision,
                  criterioEvaluacion: d.criterioEvaluacion || item.criterioEvaluacion,
                  procedimientoUtilizado: d.procedimientoUtilizado || item.procedimientoUtilizado,
                  fundamentacionLegal: d.fundamentacionLegal || item.fundamentacionLegal,
                  severidad: d.severidad || item.severidad,
                  normativaPais: countryConfig.nombre,
                }
              : item
          )
        );

        onLogAction(
          'Evaluación Pericial IA',
          `Observación ${obs.codigoObservacion} evaluada con ${selectedMotorIA.toUpperCase()} (${countryConfig.nombre}): Resolución -> ${d.decision}`
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEvaluatingId(null);
    }
  };

  const evaluateAllObservations = async () => {
    setEvaluatingAll(true);
    for (const obs of observaciones) {
      await evaluateSingleObservation(obs);
    }
    setEvaluatingAll(false);
  };

  const handleAddNewObservation = () => {
    if (!newTitulo.trim()) return;

    const newObs: ObservacionDecision = {
      id: `obs-${Date.now()}`,
      codigoObservacion: `OBS-${observaciones.length + 1 < 10 ? '0' : ''}${observaciones.length + 1}`,
      titulo: newTitulo,
      descripcionPreliminar: newDescPreliminar,
      descargoAlegato: newDescargo,
      decision: 'SE_MANTIENE',
      criterioEvaluacion: 'Pendiente de evaluación pericial por el auditor.',
      procedimientoUtilizado: 'Análisis de descargo y contrastación documental.',
      fundamentacionLegal: countryConfig.leyContrataciones,
      normativaPais: countryConfig.nombre,
      severidad: 'ALTA',
      montoInvolucrado: Number(newMonto) || 0,
    };

    setObservaciones([...observaciones, newObs]);
    setExpandedId(newObs.id);
    setShowNewObsModal(false);
    setNewTitulo('');
    setNewDescPreliminar('');
    setNewDescargo('');
    setNewMonto(0);
    onLogAction('Nueva Observación', `Se incorporó al pliego: ${newObs.codigoObservacion} - ${newObs.titulo}`);
  };

  // Stats
  const countMantiene = observaciones.filter((o) => o.decision === 'SE_MANTIENE').length;
  const countElimina = observaciones.filter((o) => o.decision === 'SE_ELIMINA').length;
  const countModifica = observaciones.filter((o) => o.decision === 'SE_MODIFICA').length;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Resolución Pericial de Observaciones (¿Se Mantiene o Se Elimina?)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono flex items-center gap-1">
                <span>{countryConfig.bandera}</span> {countryConfig.nombre}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Evaluación motivada con IA basada en descargos, pruebas y normativas del país
            </p>
          </div>
        </div>

        {/* AI Engine & Run All */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Motor IA Selector */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setSelectedMotorIA('gemini')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedMotorIA === 'gemini'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-sky-300" />
              Gemini 3.8
            </button>
            <button
              onClick={() => setSelectedMotorIA('meta_llama')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedMotorIA === 'meta_llama'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3 h-3 text-purple-300" />
              Meta IA / Llama 3
            </button>
            <button
              onClick={() => setSelectedMotorIA('consenso')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedMotorIA === 'consenso'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-300" />
              Consenso Híbrido
            </button>
          </div>

          <button
            onClick={evaluateAllObservations}
            disabled={evaluatingAll}
            className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-sky-950/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluatingAll ? 'animate-spin' : ''}`} />
            {evaluatingAll ? 'Evaluando...' : 'Evaluar Todo con IA'}
          </button>

          <button
            onClick={() => setShowNewObsModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir Observación
          </button>
        </div>
      </div>

      {/* Summary Scoreboard: Se Mantiene / Se Elimina / Se Modifica */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <XCircle className="w-6 h-6 text-red-400" />
            <div>
              <div className="text-xs font-semibold text-red-200">SE MANTIENE (Confirmada)</div>
              <div className="text-[11px] text-red-300/80">Descargo insuficiente / Daño persistente</div>
            </div>
          </div>
          <span className="font-mono text-2xl font-bold text-red-400">{countMantiene}</span>
        </div>

        <div className="bg-emerald-950/40 border border-emerald-900/50 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-xs font-semibold text-emerald-200">SE ELIMINA (Desestimada)</div>
              <div className="text-[11px] text-emerald-300/80">Subsanada / Justificación admitida</div>
            </div>
          </div>
          <span className="font-mono text-2xl font-bold text-emerald-400">{countElimina}</span>
        </div>

        <div className="bg-amber-950/40 border border-amber-900/50 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-amber-200">SE MODIFICA (Atenuada)</div>
              <div className="text-[11px] text-amber-300/80">Falta administrativa / Control interno</div>
            </div>
          </div>
          <span className="font-mono text-2xl font-bold text-amber-400">{countModifica}</span>
        </div>
      </div>

      {/* Accordion List of Observations */}
      <div className="space-y-3">
        {observaciones.map((obs) => {
          const isExpanded = expandedId === obs.id;
          const isEvaluatingThis = evaluatingId === obs.id;

          let badgeDecision = 'bg-red-500/20 text-red-400 border-red-500/30';
          let decisionText = 'SE MANTIENE';
          if (obs.decision === 'SE_ELIMINA') {
            badgeDecision = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            decisionText = 'SE ELIMINA';
          } else if (obs.decision === 'SE_MODIFICA') {
            badgeDecision = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            decisionText = 'SE MODIFICA';
          }

          return (
            <div
              key={obs.id}
              className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden transition-all"
            >
              {/* Card Header Row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : obs.id)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span className="font-mono font-bold text-xs px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sky-300">
                    {obs.codigoObservacion}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight">
                      {obs.titulo}
                    </h3>
                    {obs.montoInvolucrado ? (
                      <span className="text-[11px] font-mono text-amber-400">
                        Monto Involucrado: RD$ {obs.montoInvolucrado.toLocaleString('es-DO')}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full border ${badgeDecision}`}
                  >
                    {decisionText}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details Body */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-slate-800/80 space-y-4 text-xs mt-3">
                  {/* Observation & Defense comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-red-400" />
                        Observación Original de Auditoría:
                      </div>
                      <p className="text-slate-300 leading-relaxed">{obs.descripcionPreliminar}</p>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                        Alegato y Descargo del Auditado (Recurso):
                      </div>
                      <p className="text-slate-300 leading-relaxed">{obs.descargoAlegato}</p>
                    </div>
                  </div>

                  {/* AI Resolution Details */}
                  <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-purple-400" />
                        Dictamen Pericial &amp; Criterio Probatorio ({countryConfig.nombre}):
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-400">Decisión:</label>
                        <select
                          value={obs.decision}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setObservaciones((prev) =>
                              prev.map((o) => (o.id === obs.id ? { ...o, decision: val } : o))
                            );
                            onLogAction('Cambio Manual de Decisión', `${obs.codigoObservacion} -> ${val}`);
                          }}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:border-sky-500"
                        >
                          <option value="SE_MANTIENE">SE MANTIENE</option>
                          <option value="SE_ELIMINA">SE ELIMINA</option>
                          <option value="SE_MODIFICA">SE MODIFICA</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <strong className="text-slate-300">Criterio Pericial: </strong>
                      <span className="text-slate-300 leading-relaxed">{obs.criterioEvaluacion}</span>
                    </div>

                    <div>
                      <strong className="text-slate-300">Procedimiento Utilizado: </strong>
                      <span className="text-slate-400">{obs.procedimientoUtilizado}</span>
                    </div>

                    <div>
                      <strong className="text-sky-300">Fundamentación Legal Aplicada: </strong>
                      <span className="text-sky-200/90 font-mono text-[11px]">
                        {obs.fundamentacionLegal}
                      </span>
                    </div>
                  </div>

                  {/* Single AI Evaluation Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => evaluateSingleObservation(obs)}
                      disabled={isEvaluatingThis}
                      className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isEvaluatingThis ? 'animate-spin text-purple-400' : ''}`} />
                      {isEvaluatingThis ? 'Evaluando con IA...' : 'Re-evaluar con IA'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Observation Modal */}
      {showNewObsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-lg w-full text-slate-100 space-y-4">
            <h3 className="font-bold text-base text-white">Incorporar Nueva Observación al Pliego</h3>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Título de la Observación</label>
              <input
                type="text"
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                placeholder="Ej: Inconsistencia en entregables de consultoría"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Descripción del Hallazgo</label>
              <textarea
                rows={3}
                value={newDescPreliminar}
                onChange={(e) => setNewDescPreliminar(e.target.value)}
                placeholder="Describa el hecho constatado por la auditoría..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Alegato / Descargo Presentado</label>
              <textarea
                rows={3}
                value={newDescargo}
                onChange={(e) => setNewDescargo(e.target.value)}
                placeholder="Argumentos o pruebas aportadas por la entidad..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Monto Involucrado (RD$)</label>
              <input
                type="number"
                value={newMonto}
                onChange={(e) => setNewMonto(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewObsModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddNewObservation}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded cursor-pointer"
              >
                Guardar Observación
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
