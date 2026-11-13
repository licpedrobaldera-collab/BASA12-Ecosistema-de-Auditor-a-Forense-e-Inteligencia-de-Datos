import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  ShieldCheck,
  Scale,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Cpu,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { ObservacionDecision, AuditorProfile } from '../types/forensic';
import { PAISES_NORMATIVA } from '../utils/countryNorms';
import { formatCurrency } from '../utils/entities';

interface Props {
  observaciones: ObservacionDecision[];
  setObservaciones: React.Dispatch<React.SetStateAction<ObservacionDecision[]>>;
  selectedCountry: string;
  selectedLanguage: string;
  auditor: AuditorProfile;
  actaLecturaContext: string;
  recursosContext: string;
  simboloMoneda?: string;
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
  simboloMoneda = 'RD$',
  onLogAction,
}) => {
  const [selectedMotorIA, setSelectedMotorIA] = useState<'gemini' | 'meta_llama' | 'consenso'>('gemini');
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evaluatingAll, setEvaluatingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(observaciones[0]?.id || null);

  const [showNewObsModal, setShowNewObsModal] = useState(false);
  const [newCodigo, setNewCodigo] = useState('');
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescPreliminar, setNewDescPreliminar] = useState('');
  const [newDescargo, setNewDescargo] = useState('');
  const [newMonto, setNewMonto] = useState(0);

  const countryConfig = PAISES_NORMATIVA.find((p) => p.codigo === selectedCountry) || PAISES_NORMATIVA[0];

  const updateField = <K extends keyof ObservacionDecision>(
    id: string,
    field: K,
    value: ObservacionDecision[K]
  ) => {
    setObservaciones((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const deleteObservation = (id: string) => {
    setObservaciones((prev) => prev.filter((o) => o.id !== id));
    onLogAction('Eliminación de Observación', `Se removió la observación ${id} del pliego.`);
  };

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
    if (observaciones.length === 0) return;
    setEvaluatingAll(true);
    for (const obs of observaciones) {
      await evaluateSingleObservation(obs);
    }
    setEvaluatingAll(false);
  };

  const handleAddNewObservation = () => {
    if (!newTitulo.trim()) return;

    const code =
      newCodigo.trim() || `OBS-${String(observaciones.length + 1).padStart(2, '0')}`;

    const newObs: ObservacionDecision = {
      id: `obs-${Date.now()}`,
      codigoObservacion: code,
      titulo: newTitulo.trim(),
      descripcionPreliminar: newDescPreliminar.trim(),
      descargoAlegato: newDescargo.trim(),
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
    setNewCodigo('');
    setNewTitulo('');
    setNewDescPreliminar('');
    setNewDescargo('');
    setNewMonto(0);
    onLogAction('Nueva Observación', `Se incorporó al pliego: ${newObs.codigoObservacion} - ${newObs.titulo}`);
  };

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
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Resolución Pericial de Observaciones (¿Se Mantiene o Se Elimina?)
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono flex items-center gap-1">
                <span>{countryConfig.bandera}</span> {countryConfig.nombre}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Todos los campos de cada observación son editables; evalúa con IA basada en descargos reales y normativa vigente
            </p>
          </div>
        </div>

        {/* AI Engine & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedMotorIA('gemini')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedMotorIA === 'gemini'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-sky-300" />
              Gemini 4
            </button>
            <button
              type="button"
              onClick={() => setSelectedMotorIA('meta_llama')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedMotorIA === 'meta_llama'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3 h-3 text-purple-300" />
              Criterio Contradictorio
            </button>
            <button
              type="button"
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
            type="button"
            onClick={evaluateAllObservations}
            disabled={evaluatingAll || observaciones.length === 0}
            className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-sky-950/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${evaluatingAll ? 'animate-spin' : ''}`} />
            {evaluatingAll ? 'Evaluando...' : 'Evaluar Todo con IA'}
          </button>

          <button
            type="button"
            onClick={() => setShowNewObsModal(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir Observación
          </button>
        </div>
      </div>

      {/* Summary Scoreboard */}
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

      {/* Empty State or Accordion List of Fully Editable Observations */}
      {observaciones.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-700 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
          <p>
            No hay observaciones registradas en este expediente todavía. Puedes añadirlas con{' '}
            <strong>&quot;Añadir Observación&quot;</strong> o extraerlas automáticamente desde tus documentos en el Paso 2.
          </p>
        </div>
      ) : (
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
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : obs.id)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="font-mono font-bold text-xs px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sky-300">
                      {obs.codigoObservacion}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white leading-tight">{obs.titulo}</h3>
                      {obs.montoInvolucrado ? (
                        <span className="text-[11px] font-mono text-amber-400">
                          Monto Involucrado: {formatCurrency(obs.montoInvolucrado, simboloMoneda)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full border ${badgeDecision}`}>
                      {decisionText}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteObservation(obs.id);
                      }}
                      className="p-1.5 rounded bg-slate-900 hover:bg-red-950/70 text-slate-500 hover:text-red-400 border border-slate-800 cursor-pointer"
                      title="Eliminar observación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Inline Editable Body */}
                {isExpanded && (
                  <div className="p-4 pt-3 border-t border-slate-800/80 space-y-4 text-xs">
                    {/* Row 1: Codigo, Titulo, Severidad, Monto */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-[10.5px] text-slate-400 block mb-1">Código</label>
                        <input
                          type="text"
                          value={obs.codigoObservacion}
                          onChange={(e) => updateField(obs.id, 'codigoObservacion', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-sky-300 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="md:col-span-6">
                        <label className="text-[10.5px] text-slate-400 block mb-1">Título de la Observación</label>
                        <input
                          type="text"
                          value={obs.titulo}
                          onChange={(e) => updateField(obs.id, 'titulo', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10.5px] text-slate-400 block mb-1">Severidad</label>
                        <select
                          value={obs.severidad}
                          onChange={(e) => updateField(obs.id, 'severidad', e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                        >
                          <option value="CRÍTICA">CRÍTICA</option>
                          <option value="ALTA">ALTA</option>
                          <option value="MEDIA">MEDIA</option>
                          <option value="LEVE">LEVE</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10.5px] text-slate-400 block mb-1">Monto ({simboloMoneda})</label>
                        <input
                          type="number"
                          value={obs.montoInvolucrado || 0}
                          onChange={(e) => updateField(obs.id, 'montoInvolucrado', Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 font-mono text-amber-300 text-right"
                        />
                      </div>
                    </div>

                    {/* Row 2: Hallazgo & Descargo Editable */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-red-400" />
                          Observación / Hallazgo Preliminar:
                        </label>
                        <textarea
                          rows={3}
                          value={obs.descripcionPreliminar}
                          onChange={(e) => updateField(obs.id, 'descripcionPreliminar', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 leading-relaxed focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-lg space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                          Alegato y Descargo del Auditado:
                        </label>
                        <textarea
                          rows={3}
                          value={obs.descargoAlegato}
                          onChange={(e) => updateField(obs.id, 'descargoAlegato', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 leading-relaxed focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    {/* Row 3: AI & Auditor Resolution Fields (All Editable) */}
                    <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-lg space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                              updateField(obs.id, 'decision', val);
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
                        <label className="text-[10.5px] font-semibold text-slate-300 block mb-1">
                          Criterio Pericial:
                        </label>
                        <textarea
                          rows={2}
                          value={obs.criterioEvaluacion}
                          onChange={(e) => updateField(obs.id, 'criterioEvaluacion', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10.5px] font-semibold text-slate-300 block mb-1">
                            Procedimiento Utilizado:
                          </label>
                          <input
                            type="text"
                            value={obs.procedimientoUtilizado}
                            onChange={(e) => updateField(obs.id, 'procedimientoUtilizado', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-300"
                          />
                        </div>
                        <div>
                          <label className="text-[10.5px] font-semibold text-sky-300 block mb-1">
                            Fundamentación Legal Aplicada:
                          </label>
                          <input
                            type="text"
                            value={obs.fundamentacionLegal}
                            onChange={(e) => updateField(obs.id, 'fundamentacionLegal', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-sky-200 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => evaluateSingleObservation(obs)}
                        disabled={isEvaluatingThis}
                        className="px-3.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isEvaluatingThis ? 'animate-spin text-purple-400' : ''}`} />
                        {isEvaluatingThis ? 'Evaluando con IA...' : 'Evaluar / Re-evaluar con IA'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Observation Modal */}
      {showNewObsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-lg w-full text-slate-100 space-y-4">
            <h3 className="font-bold text-base text-white">Incorporar Nueva Observación Real al Pliego</h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Código</label>
                <input
                  type="text"
                  value={newCodigo}
                  onChange={(e) => setNewCodigo(e.target.value)}
                  placeholder={`OBS-${String(observaciones.length + 1).padStart(2, '0')}`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-slate-400 block mb-1">Título de la Observación *</label>
                <input
                  type="text"
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value)}
                  placeholder="Ej: Pago sin conduce de recepción conforme"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Descripción del Hallazgo</label>
              <textarea
                rows={3}
                value={newDescPreliminar}
                onChange={(e) => setNewDescPreliminar(e.target.value)}
                placeholder="Describa el hecho constatado en los documentos reales..."
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
              <label className="text-xs text-slate-400 block mb-1">Monto Involucrado ({simboloMoneda})</label>
              <input
                type="number"
                value={newMonto}
                onChange={(e) => setNewMonto(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewObsModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs rounded hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
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
