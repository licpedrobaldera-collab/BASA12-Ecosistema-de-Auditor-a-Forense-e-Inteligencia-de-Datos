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
  Filter,
  Download,
} from 'lucide-react';
import { AuditedEntity, CaseSession } from '../types/forensic';

interface Props {
  cases: CaseSession[];
  entities: AuditedEntity[];
  activeCaseId: string;
  onRegisterCase: () => Promise<void>;
  onSelectCaseToLoad: (c: CaseSession) => void;
  onViewCaseOnScreen: (c: CaseSession) => void;
  onDeleteCase: (id: string) => Promise<void>;
  isSaving: boolean;
}

export const CaseRegistryAndHistorySection: React.FC<Props> = ({
  cases,
  entities,
  activeCaseId,
  onRegisterCase,
  onSelectCaseToLoad,
  onViewCaseOnScreen,
  onDeleteCase,
  isSaving,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');

  const filteredCases = cases.filter((c) => {
    const matchesEntity =
      entityFilter === 'ALL' || c.entity?.id === entityFilter || c.entity?.siglas === entityFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      c.nombreCaso.toLowerCase().includes(q) ||
      (c.codigoCaso || '').toLowerCase().includes(q) ||
      (c.entity?.nombre || '').toLowerCase().includes(q) ||
      c.requerimiento.toLowerCase().includes(q);
    return matchesEntity && matchesSearch;
  });

  const exportAllHistoryJson = () => {
    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Historial_Casos_Forenses_${new Date().toISOString().split('T')[0]}.json`;
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
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Registro e Historial de Casos en Pantalla
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {cases.length} Guardado(s)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Persistencia en servidor de expedientes por entidad, consulta inmediata en pantalla y cambio rápido de caso
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportAllHistoryJson}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            Respaldar Historial (.json)
          </button>

          <button
            type="button"
            onClick={onRegisterCase}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Guardando...' : 'Registrar Caso Actual en Historial'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código de caso, entidad, nombre o requerimiento..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">Todas las Entidades ({cases.length})</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.siglas} — {ent.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* On-screen Table of Registered Cases */}
      {filteredCases.length === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
          No se encontraron casos registrados con los filtros actuales. Pulsa &quot;Registrar Caso Actual en Historial&quot; para guardar el expediente activo.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10.5px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Código / Caso</th>
                <th className="py-3 px-3">Entidad Auditada</th>
                <th className="py-3 px-3">Estado &amp; Evidencia</th>
                <th className="py-3 px-3">Fecha / Sello SHA-256</th>
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
                            ACTIVO
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
                        <span>{c.entity?.siglas || 'GENERAL'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {c.entity?.nombre || 'Entidad no especificada'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          c.estado === 'DICTAMEN_EMITIDO' || c.resultado
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {c.resultado ? 'DICTAMEN EMITIDO' : c.estado || 'EN PROCESO'}
                      </span>
                      <div className="text-[10.5px] text-slate-400 mt-1 font-mono">
                        {c.contractRows?.length || 0} reg. • {c.observaciones?.length || 0} obs.
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
                          title="Ver todo el expediente completo en pantalla"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver en Pantalla
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCaseToLoad(c)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Cargar este caso en el área de trabajo"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                          Cargar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCase(c.id)}
                          className="p-1.5 bg-slate-900 hover:bg-red-950/70 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-800/50 rounded-lg cursor-pointer transition-colors"
                          title="Eliminar caso del historial"
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
