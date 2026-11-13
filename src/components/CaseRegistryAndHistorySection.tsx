import React, { useState } from 'react';
import {
  Archive,
  Search,
  Eye,
  FolderOpen,
  Trash2,
  Save,
  Shield,
  Clock,
  Building2,
  Download,
} from 'lucide-react';
import { AuditedEntity, CaseSession } from '../types/forensic';

interface Props {
  cases: CaseSession[];
  activeEntity: AuditedEntity | null;
  activeCaseId: string;
  onRegisterCase: () => Promise<void>;
  onSelectCaseToLoad: (c: CaseSession) => void;
  onViewCaseOnScreen: (c: CaseSession) => void;
  onDeleteCase: (id: string) => Promise<void>;
  isSaving: boolean;
}

export const CaseRegistryAndHistorySection: React.FC<Props> = ({
  cases,
  activeEntity,
  activeCaseId,
  onRegisterCase,
  onSelectCaseToLoad,
  onViewCaseOnScreen,
  onDeleteCase,
  isSaving,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Strict scoping: show ONLY cases belonging to the currently active entity
  const entityCases = activeEntity
    ? cases.filter((c) => c.entity?.id === activeEntity.id)
    : [];

  const filteredCases = entityCases.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      c.nombreCaso.toLowerCase().includes(q) ||
      (c.codigoCaso || '').toLowerCase().includes(q) ||
      c.requerimiento.toLowerCase().includes(q)
    );
  });

  const exportEntityHistoryJson = () => {
    const blob = new Blob([JSON.stringify(entityCases, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expedientes_${activeEntity?.siglas || 'Entidad'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Expedientes Exclusivos en Pantalla
              {activeEntity ? (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  {activeEntity.siglas} ({entityCases.length} caso(s))
                </span>
              ) : (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Sin entidad seleccionada
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Visualiza, edita y consulta únicamente los casos de la entidad activa actual sin mezclar otras empresas
            </p>
          </div>
        </div>

        {activeEntity && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportEntityHistoryJson}
              disabled={entityCases.length === 0}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Exportar (.json)
            </button>

            <button
              type="button"
              onClick={onRegisterCase}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Guardando...' : `Guardar Caso de ${activeEntity.siglas}`}
            </button>
          </div>
        )}
      </div>

      {/* Search Bar */}
      {activeEntity && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Buscar entre los expedientes de ${activeEntity.nombre}...`}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          />
        </div>
      )}

      {/* Table */}
      {!activeEntity ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-700 rounded-xl p-8 text-center text-xs text-slate-400">
          Registra o selecciona primero una entidad auditada en la barra superior para ver y guardar sus expedientes exclusivos.
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
          No hay casos guardados para <strong>{activeEntity.nombre}</strong>. Pulsa{' '}
          <strong>&quot;Guardar Caso de {activeEntity.siglas}&quot;</strong> para registrar este expediente en pantalla.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10.5px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Código / Caso</th>
                <th className="py-3 px-3">Entidad Exclusiva</th>
                <th className="py-3 px-3">Estado &amp; Alcance</th>
                <th className="py-3 px-3">Fecha / SHA-256</th>
                <th className="py-3 px-3 text-right">Acciones en Pantalla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCases.map((c) => {
                const isActive = c.id === activeCaseId;
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${
                      isActive ? 'bg-sky-950/30' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                          {c.codigoCaso || 'CASO'}
                        </span>
                        {isActive && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                            EN TRABAJO
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-white mt-1">{c.nombreCaso}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                        {c.requerimiento}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span>{c.entity?.siglas}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {c.entity?.nombre}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          c.resultado
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {c.resultado ? 'DICTAMEN EMITIDO' : c.estado || 'EN PROCESO'}
                      </span>
                      <div className="text-[10.5px] text-slate-400 mt-1 font-mono">
                        {c.contractRows?.length || 0} contr. • {c.paymentCycleRows?.length || 0} pagos • {c.observaciones?.length || 0} obs.
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[10.5px]">
                      <div className="text-slate-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(c.updatedAt || c.timestamp).toLocaleString('es-DO')}
                      </div>
                      <div className="text-emerald-400 flex items-center gap-1 mt-1">
                        <Shield className="w-3 h-3" />
                        {(c.selloDigital || 'N/A').substring(0, 14)}...
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewCaseOnScreen(c)}
                          className="px-2.5 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver en Pantalla
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCaseToLoad(c)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                          Cargar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCase(c.id)}
                          className="p-1.5 bg-slate-900 hover:bg-red-950/70 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-800/50 rounded-lg cursor-pointer transition-colors"
                          title="Eliminar expediente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
