import React from 'react';
import { History, X, FolderOpen, Shield, Clock, Eye, Building2 } from 'lucide-react';
import { CaseSession } from '../types/forensic';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseSession[];
  onSelectCase: (c: CaseSession) => void;
  onViewCaseOnScreen?: (c: CaseSession) => void;
}

export const HistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  cases,
  onSelectCase,
  onViewCaseOnScreen,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Histórico de Casos y Expedientes Forenses</h2>
              <p className="text-xs text-slate-400">Base de datos persistente por entidad y sellos criptográficos</p>
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
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {cases.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No hay casos guardados en el histórico todavía.
            </div>
          ) : (
            cases.map((cs) => (
              <div
                key={cs.id}
                className="bg-slate-950 border border-slate-800 hover:border-sky-500/50 p-4 rounded-lg transition-all space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FolderOpen className="w-4 h-4 text-sky-400" />
                    {cs.codigoCaso && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                        {cs.codigoCaso}
                      </span>
                    )}
                    <span className="font-semibold text-sm text-white">{cs.nombreCaso}</span>
                    {cs.entity && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {cs.entity.siglas}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(cs.updatedAt || cs.timestamp).toLocaleString('es-DO')}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">{cs.requerimiento}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">
                      Fuentes: <strong className="text-slate-300">{cs.origenes.join(', ')}</strong>
                    </span>
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {cs.selloDigital.substring(0, 10)}...
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onViewCaseOnScreen && (
                      <button
                        type="button"
                        onClick={() => {
                          onViewCaseOnScreen(cs);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Ver en Pantalla
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCase(cs);
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                      Cargar en Trabajo
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
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
