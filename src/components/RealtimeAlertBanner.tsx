import React from 'react';
import { Bell, AlertTriangle, ShieldAlert, X, ChevronRight } from 'lucide-react';
import { RealtimeAlert } from '../types/forensic';

interface Props {
  alerts: RealtimeAlert[];
  onDismissAlert: (id: string) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
}

export const RealtimeAlertBanner: React.FC<Props> = ({
  alerts,
  onDismissAlert,
  onClearAll,
  onOpenSettings,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 max-w-md w-full space-y-2 pointer-events-none">
      <div className="bg-slate-900/95 border border-red-500/40 rounded-xl p-4 shadow-2xl backdrop-blur-md pointer-events-auto text-slate-100 space-y-3">
        {/* Banner Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              Alertas de Fraude en Tiempo Real ({alerts.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
            >
              Ajustar Umbrales
            </button>
            <button
              onClick={onClearAll}
              className="text-[11px] text-slate-400 hover:text-white cursor-pointer px-1"
              title="Descartar todas las alertas"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {alerts.slice(0, 3).map((al) => (
            <div
              key={al.id}
              className="bg-slate-950 border border-red-900/50 rounded-lg p-2.5 flex items-start justify-between gap-2 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9.5px] uppercase ${
                      al.severidad === 'CRÍTICA'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {al.severidad}
                  </span>
                  <span className="font-semibold text-slate-200">{al.titulo}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">{al.descripcion}</p>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                  <span>
                    Detectado: <strong className="text-red-400">{al.valorDetectado}</strong>
                  </span>
                  <span>
                    Límite: <strong className="text-slate-400">{al.umbralLimite}</strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDismissAlert(al.id)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {alerts.length > 3 && (
          <div className="text-[11px] text-slate-400 text-center font-mono">
            +{alerts.length - 3} alertas adicionales activas
          </div>
        )}
      </div>
    </div>
  );
};
