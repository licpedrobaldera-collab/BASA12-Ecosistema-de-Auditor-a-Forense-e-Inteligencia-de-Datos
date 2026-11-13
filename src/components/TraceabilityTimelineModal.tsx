import React from 'react';
import { X, Clock, ShieldCheck, Download, Activity, User, FileText } from 'lucide-react';
import { TraceabilityLog } from '../types/forensic';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: TraceabilityLog[];
  nombreCaso: string;
}

export const TraceabilityTimelineModal: React.FC<Props> = ({ isOpen, onClose, logs, nombreCaso }) => {
  if (!isOpen) return null;

  const exportLogs = () => {
    const text = JSON.stringify(logs, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trazabilidad_Forense_${nombreCaso}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full text-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Trazabilidad Histórica y Cadena de Custodia (Audit Trail)
              </h2>
              <p className="text-xs text-slate-400">
                Registro inmutable de acciones periciales bajo normas ISO/IEC 27037 y NIA 240
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
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <span>
              Total de eventos registrados en el expediente: <strong className="text-white font-mono">{logs.length}</strong>
            </span>
            <button
              onClick={exportLogs}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar Log Criptográfico
            </button>
          </div>

          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {logs.map((log) => (
              <div key={log.id} className="relative group">
                {/* Dot */}
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-teal-400 ring-4 ring-slate-950" />

                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <span className="font-semibold text-white flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-950 text-teal-400 border border-teal-800/50 uppercase">
                        {log.etapa}
                      </span>
                      {log.accion}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {log.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{log.detalle}</p>

                  <div className="flex flex-wrap items-center justify-between pt-1 border-t border-slate-900 text-[10.5px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" /> {log.usuario}
                    </span>
                    <span className="flex items-center gap-1 text-teal-400">
                      <ShieldCheck className="w-3 h-3" /> Hash: {log.sha256.substring(0, 16)}...
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
