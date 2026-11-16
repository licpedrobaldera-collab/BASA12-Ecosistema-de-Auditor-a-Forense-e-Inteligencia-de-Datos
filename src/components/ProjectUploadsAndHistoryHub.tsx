import React, { useMemo, useState } from 'react';
import {
  Database,
  FolderGit2,
  FileUp,
  History,
  Search,
  Eye,
  FolderOpen,
  Trash2,
  Lock,
  ShieldCheck,
  Clock,
  Building2,
  FileText,
  Globe,
  ClipboardType,
  CheckCircle2,
  Download,
  RotateCcw,
} from 'lucide-react';
import {
  AuditedEntity,
  CaseIteration,
  CaseSession,
  EvidenceFile,
  ProjectUploadRecord,
} from '../types/forensic';
import { uploadRecordToEvidenceFile } from '../services/firestoreService';

interface Props {
  entities: AuditedEntity[];
  activeEntity: AuditedEntity | null;
  allProjects: CaseSession[];
  activeCaseId: string;
  activeProjectUploads: ProjectUploadRecord[];
  activeProjectIterations: CaseIteration[];
  isSavingCase: boolean;
  isSavingUpload: boolean;
  onRegisterCase: () => Promise<void>;
  onSelectCaseToLoad: (c: CaseSession) => void;
  onViewCaseOnScreen: (c: CaseSession) => void;
  onCloseProject: (projectId: string) => Promise<void>;
  onDeleteCase: (id: string) => Promise<void>;
  onRestoreUploadToWorkspace: (ev: EvidenceFile) => void;
  onDeleteUpload: (uploadId: string) => Promise<void>;
  onGoToUploadStep: () => void;
}

export const ProjectUploadsAndHistoryHub: React.FC<Props> = ({
  entities,
  activeEntity,
  allProjects,
  activeCaseId,
  activeProjectUploads,
  activeProjectIterations,
  isSavingCase,
  isSavingUpload,
  onRegisterCase,
  onSelectCaseToLoad,
  onViewCaseOnScreen,
  onCloseProject,
  onDeleteCase,
  onRestoreUploadToWorkspace,
  onDeleteUpload,
  onGoToUploadStep,
}) => {
  const [activeTab, setActiveTab] = useState<'proyectos' | 'cargas' | 'iteraciones'>('proyectos');
  const [scopeFilter, setScopeFilter] = useState<'entidad' | 'todos'>('entidad');
  const [searchTerm, setSearchTerm] = useState('');

  const visibleProjects = useMemo(() => {
    const base =
      scopeFilter === 'entidad' && activeEntity
        ? allProjects.filter((p) => p.entity?.id === activeEntity.id)
        : allProjects;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.nombreCaso.toLowerCase().includes(q) ||
        (p.codigoCaso || '').toLowerCase().includes(q) ||
        (p.entity?.nombre || '').toLowerCase().includes(q) ||
        (p.entity?.siglas || '').toLowerCase().includes(q)
    );
  }, [allProjects, activeEntity, scopeFilter, searchTerm]);

  const exportProjectsJson = () => {
    const blob = new Blob([JSON.stringify(visibleProjects, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Historial_Proyectos_${activeEntity?.siglas || 'Global'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderSourceIcon = (sourceType: ProjectUploadRecord['sourceType']) => {
    if (sourceType === 'URL_PORTAL') return <Globe className="w-4 h-4 text-sky-400 shrink-0" />;
    if (sourceType === 'TEXTO_DIRECTO') return <ClipboardType className="w-4 h-4 text-amber-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-emerald-400 shrink-0" />;
  };

  return (
    <section className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header & Cloud Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Base de Carga e Historial de Proyectos (Firestore Cloud)
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Sincronización Real
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {entities.length} entidad(es) • {allProjects.length} proyecto(s) persistidos •{' '}
              {activeProjectUploads.length} carga(s) documental(es) en el proyecto activo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoToUploadStep}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
          >
            <FileUp className="w-3.5 h-3.5" />
            Nueva Carga Real (Paso 2)
          </button>

          {activeEntity && (
            <button
              type="button"
              onClick={onRegisterCase}
              disabled={isSavingCase}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSavingCase ? 'Guardando en Cloud...' : 'Guardar Proyecto en Firestore'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('proyectos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'proyectos'
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            Historial de Proyectos ({allProjects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cargas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'cargas'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            Cargas Reales del Proyecto ({activeProjectUploads.length})
            {isSavingUpload && <span className="text-[10px] font-mono text-amber-200 animate-pulse">• Guardando</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('iteraciones')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'iteraciones'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Versiones / Iteraciones ({activeProjectIterations.length})
          </button>
        </div>

        {activeTab === 'proyectos' && (
          <div className="flex flex-wrap items-center gap-2">
            {activeEntity && (
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setScopeFilter('entidad')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer font-semibold ${
                    scopeFilter === 'entidad' ? 'bg-sky-600/30 text-sky-300' : 'text-slate-400'
                  }`}
                >
                  Solo {activeEntity.siglas}
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter('todos')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer font-semibold ${
                    scopeFilter === 'todos' ? 'bg-sky-600/30 text-sky-300' : 'text-slate-400'
                  }`}
                >
                  Todos ({allProjects.length})
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={exportProjectsJson}
              disabled={visibleProjects.length === 0}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              Exportar (.json)
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: PROJECTS HISTORY */}
      {activeTab === 'proyectos' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar proyecto por código, nombre o entidad..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {visibleProjects.length === 0 ? (
            <div className="bg-slate-950/70 border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">
                Base de datos limpia desde cero — aún no hay proyectos guardados en esta vista.
              </p>
              <p>
                Registra tu primera entidad real arriba, carga tus documentos en el Paso 2 y pulsa{' '}
                <strong>&quot;Guardar Proyecto en Firestore&quot;</strong>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10.5px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Proyecto / Código</th>
                    <th className="py-3 px-3">Entidad</th>
                    <th className="py-3 px-3">Estado &amp; Métricas Reales</th>
                    <th className="py-3 px-3">Actualizado / Sello</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {visibleProjects.map((p) => {
                    const isActive = p.id === activeCaseId;
                    const isClosed = p.estado === 'CERRADO';
                    return (
                      <tr key={p.id} className={isActive ? 'bg-sky-950/30' : 'hover:bg-slate-800/30'}>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                              {p.codigoCaso || 'CASO'}
                            </span>
                            {isActive && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                ACTIVO
                              </span>
                            )}
                            {isClosed && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                CERRADO
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-white mt-1">{p.nombreCaso}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">{p.requerimiento}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>{p.entity?.siglas || 'N/D'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {p.entity?.nombre || ''}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              p.estado === 'CERRADO'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                : p.resultado
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {p.estado || 'EN_PROCESO'}
                          </span>
                          <div className="text-[10.5px] text-slate-400 mt-1 font-mono">
                            {p.contractRows?.length || 0} contr. • {p.paymentCycleRows?.length || 0} pagos •{' '}
                            {p.matrizHallazgosLiteral?.length || 0} hall. 3.01+
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10.5px]">
                          <div className="text-slate-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(p.updatedAt || p.timestamp).toLocaleString('es-DO')}
                          </div>
                          <div className="text-emerald-400 flex items-center gap-1 mt-1">
                            <ShieldCheck className="w-3 h-3" />
                            {(p.selloDigital || 'N/A').slice(0, 14)}...
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onViewCaseOnScreen(p)}
                              className="px-2 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver
                            </button>
                            <button
                              type="button"
                              onClick={() => onSelectCaseToLoad(p)}
                              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                              Abrir
                            </button>
                            {!isClosed && (
                              <button
                                type="button"
                                onClick={() => onCloseProject(p.id)}
                                title="Sellar y cerrar proyecto definitivamente (inmutable)"
                                className="p-1.5 bg-slate-900 hover:bg-purple-950/70 text-slate-400 hover:text-purple-300 border border-slate-800 hover:border-purple-700/50 rounded-lg cursor-pointer"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDeleteCase(p.id)}
                              title="Eliminar proyecto y sus cargas"
                              className="p-1.5 bg-slate-900 hover:bg-red-950/70 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-800/50 rounded-lg cursor-pointer"
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
        </div>
      )}

      {/* TAB 2: REAL DOCUMENT UPLOADS HISTORY */}
      {activeTab === 'cargas' && (
        <div className="space-y-3">
          {activeProjectUploads.length === 0 ? (
            <div className="bg-slate-950/70 border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
              <p>No hay cargas documentales registradas todavía en el proyecto activo.</p>
              <button
                type="button"
                onClick={onGoToUploadStep}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileUp className="w-3.5 h-3.5" />
                Ir al Paso 2 para Cargar Archivo, Link o Texto Real
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeProjectUploads.map((up) => (
                <div
                  key={up.id}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 text-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {renderSourceIcon(up.sourceType)}
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{up.fileName}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {up.parsedFormat} • {up.extractedText.length.toLocaleString('es-DO')} caracteres •{' '}
                          {(up.sizeBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                      {up.sourceType}
                    </span>
                  </div>

                  {up.contentSnippet && (
                    <p className="text-[11px] text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg p-2 line-clamp-3 font-mono">
                      {up.contentSnippet}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                    <span>SHA-256: {up.sha256.slice(0, 14)}...</span>
                    <span>{up.createdAt ? new Date(up.createdAt).toLocaleString('es-DO') : ''}</span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onRestoreUploadToWorkspace(uploadRecordToEvidenceFile(up))}
                      className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Cargar Evidencia en Trabajo
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteUpload(up.id)}
                      className="p-1.5 bg-slate-900 hover:bg-red-950/70 text-slate-500 hover:text-red-400 border border-slate-800 rounded-lg cursor-pointer"
                      title="Eliminar carga del proyecto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: IMMUTABLE ITERATIONS */}
      {activeTab === 'iteraciones' && (
        <div className="space-y-2.5">
          {activeProjectIterations.length === 0 ? (
            <div className="bg-slate-950/70 border border-dashed border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
              Aún no se han guardado versiones en Firestore para este proyecto. Pulsa{' '}
              <strong>&quot;Guardar Proyecto en Firestore&quot;</strong> para registrar la primera iteración v1.
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjectIterations.map((it) => (
                <div
                  key={it.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                        v{it.version}
                      </span>
                      <span className="font-semibold text-white">{it.etapa}</span>
                      <span className="text-slate-400">• {it.autor}</span>
                    </div>
                    <p className="text-slate-300">{it.resumenCambio}</p>
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-500 text-right shrink-0">
                    <div>{new Date(it.timestamp).toLocaleString('es-DO')}</div>
                    <div className="text-emerald-400">SHA-256: {it.sha256.slice(0, 12)}...</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
