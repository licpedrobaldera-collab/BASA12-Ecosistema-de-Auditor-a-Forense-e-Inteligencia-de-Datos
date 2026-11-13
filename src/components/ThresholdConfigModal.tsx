import React from 'react';
import { X, Sliders, Bell, Volume2, ShieldAlert, Check, RotateCcw, AlertTriangle, Scale } from 'lucide-react';
import { ForensicThresholds, ContractEvidenceRow } from '../types/forensic';
import { playForensicAlertSound } from '../utils/audioAlert';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  thresholds: ForensicThresholds;
  setThresholds: React.Dispatch<React.SetStateAction<ForensicThresholds>>;
  contractRows: ContractEvidenceRow[];
}

export const DEFAULT_THRESHOLDS: ForensicThresholds = {
  adendaMaxPct: 50,
  benfordMaxDeviationPct: 5.0,
  fraccionamientoMontoMax: 200000,
  concentracionProveedorPct: 35,
  alertaSonora: true,
  notificacionesActivas: true,
};

export const ThresholdConfigModal: React.FC<Props> = ({
  isOpen,
  onClose,
  thresholds,
  setThresholds,
  contractRows,
}) => {
  if (!isOpen) return null;

  const currentTriggeredContracts = contractRows.filter(
    (c) => c.adendaPct > thresholds.adendaMaxPct
  ).length;

  const handleTestSound = () => {
    playForensicAlertSound();
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full text-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Configuración de Umbrales de Detección de Fraude
              </h2>
              <p className="text-xs text-slate-400">
                Calibración de límites cuantitativos y parámetros periciales para alertas en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Active Impact Banner */}
          <div className="bg-sky-950/40 border border-sky-800/40 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-sky-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-white">Impacto en la Evidencia Actual</div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Con el umbral de adendas configurado al{' '}
                  <strong className="text-sky-300 font-mono">{thresholds.adendaMaxPct}%</strong>, se activarán{' '}
                  <strong className="text-red-400 font-mono">{currentTriggeredContracts}</strong> alertas de{' '}
                  {contractRows.length} contratos cargados.
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-bold font-mono text-red-400">
                {currentTriggeredContracts}
              </span>
              <span className="text-[10px] text-slate-400 block">Alertas Adendas</span>
            </div>
          </div>

          {/* 1. Umbral de Adendas Contractuales */}
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5 text-sky-400" />
                  1. Umbral Máximo de Adendas y Modificaciones
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Porcentaje de aumento sobre el monto base contractual que dispara alerta de auditoría
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-lg font-bold text-red-400">
                  {thresholds.adendaMaxPct}%
                </span>
              </div>
            </div>

            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={thresholds.adendaMaxPct}
              onChange={(e) =>
                setThresholds((prev) => ({ ...prev, adendaMaxPct: Number(e.target.value) }))
              }
              className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            {/* Presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[10px] text-slate-500 self-center">Estándares legales:</span>
              <button
                type="button"
                onClick={() => setThresholds((prev) => ({ ...prev, adendaMaxPct: 25 }))}
                className={`text-[11px] px-2.5 py-1 rounded border font-medium transition-colors cursor-pointer ${
                  thresholds.adendaMaxPct === 25
                    ? 'bg-sky-600 text-white border-sky-500'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                Ley 340-06 Estándar (25%)
              </button>
              <button
                type="button"
                onClick={() => setThresholds((prev) => ({ ...prev, adendaMaxPct: 50 }))}
                className={`text-[11px] px-2.5 py-1 rounded border font-medium transition-colors cursor-pointer ${
                  thresholds.adendaMaxPct === 50
                    ? 'bg-sky-600 text-white border-sky-500'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                Límite Excepcional / Emergencia (50%)
              </button>
              <button
                type="button"
                onClick={() => setThresholds((prev) => ({ ...prev, adendaMaxPct: 15 }))}
                className={`text-[11px] px-2.5 py-1 rounded border font-medium transition-colors cursor-pointer ${
                  thresholds.adendaMaxPct === 15
                    ? 'bg-sky-600 text-white border-sky-500'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                Auditoría Preventiva Estricta (15%)
              </button>
            </div>
          </div>

          {/* 2. Umbral de Desviación en Ley de Benford */}
          <div className="space-y-3 bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  2. Tolerancia de Desviación en Ley de Benford
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Diferencia porcentual permitida entre la frecuencia observada y la curva teórica (P &lt; 0.05)
                </p>
              </div>
              <span className="font-mono text-lg font-bold text-amber-400">
                ±{thresholds.benfordMaxDeviationPct.toFixed(1)}%
              </span>
            </div>

            <input
              type="range"
              min={1.0}
              max={15.0}
              step={0.5}
              value={thresholds.benfordMaxDeviationPct}
              onChange={(e) =>
                setThresholds((prev) => ({
                  ...prev,
                  benfordMaxDeviationPct: Number(e.target.value),
                }))
              }
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>±1.0% (Alta Sensibilidad / Alertas Tempranas)</span>
              <span>±5.0% (Recomendado Big 4)</span>
              <span>±15.0% (Solo Anomalías Extremas)</span>
            </div>
          </div>

          {/* 3. Umbrales de Fraccionamiento y Concentración */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-200 block">
                3. Monto Máx. Compras Menores (Fraccionamiento)
              </label>
              <p className="text-[11px] text-slate-400">
                Erogaciones continuas a mismo proveedor bajo este umbral
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                  RD$
                </span>
                <input
                  type="number"
                  step={10000}
                  value={thresholds.fraccionamientoMontoMax}
                  onChange={(e) =>
                    setThresholds((prev) => ({
                      ...prev,
                      fraccionamientoMontoMax: Number(e.target.value),
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-200 block">
                4. Concentración de Proveedor
              </label>
              <p className="text-[11px] text-slate-400">
                Porcentaje máximo adjudicado a un solo RNC
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={5}
                  value={thresholds.concentracionProveedorPct}
                  onChange={(e) =>
                    setThresholds((prev) => ({
                      ...prev,
                      concentracionProveedorPct: Number(e.target.value),
                    }))
                  }
                  className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <span className="font-mono text-sm font-bold text-indigo-400 w-12 text-right">
                  {thresholds.concentracionProveedorPct}%
                </span>
              </div>
            </div>
          </div>

          {/* 4. Canales de Notificación y Alerta Sonora */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Canales de Alerta Pericial
            </h3>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-sky-400" />
                <div>
                  <div className="text-xs font-medium text-slate-200">Notificaciones en Tiempo Real</div>
                  <div className="text-[11px] text-slate-400">
                    Banners y avisos inmediatos en pantalla cuando una evidencia rebasa el umbral
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setThresholds((prev) => ({
                    ...prev,
                    notificacionesActivas: !prev.notificacionesActivas,
                  }))
                }
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  thresholds.notificacionesActivas ? 'bg-sky-600' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    thresholds.notificacionesActivas ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-slate-800/80 pt-2">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-medium text-slate-200">Alerta Sonora Cripto-Forense</div>
                  <div className="text-[11px] text-slate-400">
                    Emite un aviso sonoro sutil al detectar banderas rojas críticas
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestSound}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded border border-slate-700 cursor-pointer"
                >
                  Probar Sonido
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setThresholds((prev) => ({
                      ...prev,
                      alertaSonora: !prev.alertaSonora,
                    }))
                  }
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    thresholds.alertaSonora ? 'bg-emerald-600' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      thresholds.alertaSonora ? 'right-1' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restablecer Estándares Big 4
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-lg shadow-sky-950/40 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Guardar y Aplicar Umbrales
          </button>
        </div>
      </div>
    </div>
  );
};
