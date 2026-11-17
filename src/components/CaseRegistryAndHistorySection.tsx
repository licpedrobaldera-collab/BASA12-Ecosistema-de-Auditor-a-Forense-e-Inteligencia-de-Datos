import React, { useEffect, useRef, useState } from 'react';
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
  Edit3,
  Upload,
  ScrollText,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AuditedEntity, BitacoraEntry, CaseSession } from '../types/forensic';

export type CaseReviewStatus = 'EN REVISIÓN' | 'VERIFICADA' | 'APROBADA SUPERVISIÓN' | 'ARCHIVADA';

interface Props {
  cases: CaseSession[];
  activeEntity: AuditedEntity | null;
  activeCaseId: string;
  onRegisterCase: () => Promise<void>;
  onSelectCaseToLoad: (c: CaseSession) => void;
  onViewCaseOnScreen: (c: CaseSession) => void;
  onDeleteCase: (id: string) => Promise<void>;
  onUpdateCaseMetadata?: (
    id: string,
    payload: {
      nombreCaso: string;
      estadoRevision: CaseReviewStatus;
      observacionesGenerales: string;
    }
  ) => Promise<void>;
  onMergeCasesJson?: (importedCases: CaseSession[]) => Promise<{ inserted: number; message: string }>;
  bitacoraRefreshTrigger?: number;
  isSaving: boolean;
}

const REVIEW_STATUS_OPTIONS: CaseReviewStatus[] = [
  'EN REVISIÓN',
  'VERIFICADA',
  'APROBADA SUPERVISIÓN',
  'ARCHIVADA',
];

export const CaseRegistryAndHistorySection: React.FC<Props> = ({
  cases,
  activeEntity,
  activeCaseId,
  onRegisterCase,
  onSelectCaseToLoad,
  onViewCaseOnScreen,
  onDeleteCase,
  onUpdateCaseMetadata,
  onMergeCasesJson,
  bitacoraRefreshTrigger = 0,
  isSaving,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCase, setEditingCase] = useState<CaseSession | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editEstadoRev, setEditEstadoRev] = useState<CaseReviewStatus>('EN REVISIÓN');
  const [editObservaciones, setEditObservaciones] = useState('');
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  const [mergeStatus, setMergeStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const mergeInputRef = useRef<HTMLInputElement | null>(null);

  const [showBitacora, setShowBitacora] = useState(false);
  const [bitacora, setBitacora] = useState<BitacoraEntry[]>([]);
  const [loadingBitacora, setLoadingBitacora] = useState(false);

  // Strict scoping: show ONLY cases belonging to the currently active entity
  const entityCases = activeEntity ? cases.filter((c) => c.entity?.id === activeEntity.id) : [];

  const filteredCases = entityCases.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      c.nombreCaso.toLowerCase().includes(q) ||
      (c.codigoCaso || '').toLowerCase().includes(q) ||
      c.requerimiento.toLowerCase().includes(q) ||
      (c.observacionesGenerales || '').toLowerCase().includes(q)
    );
  });

  const fetchBitacora = async () => {
    setLoadingBitacora(true);
    try {
      const resp = await fetch('/api/bitacora');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.bitacora)) {
          setBitacora(data.bitacora);
        }
      }
    } catch {
      // silent network retry available via button
    } finally {
      setLoadingBitacora(false);
    }
  };

  useEffect(() => {
    if (showBitacora) {
      fetchBitacora();
    }
  }, [showBitacora, bitacoraRefreshTrigger]);

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

  const openEditor = (c: CaseSession) => {
    setEditingCase(c);
    setEditNombre(c.nombreCaso || '');
    const defaultStatus: CaseReviewStatus =
      c.estadoRevision ||
      (c.estado === 'CERRADO'
        ? 'ARCHIVADA'
        : c.resultado || c.estado === 'DICTAMEN_EMITIDO'
        ? 'VERIFICADA'
        : 'EN REVISIÓN');
    setEditEstadoRev(defaultStatus);
    setEditObservaciones(c.observacionesGenerales || '');
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase || !onUpdateCaseMetadata) return;
    setIsSavingMeta(true);
    try {
      await onUpdateCaseMetadata(editingCase.id, {
        nombreCaso: editNombre.trim() || editingCase.nombreCaso,
        estadoRevision: editEstadoRev,
        observacionesGenerales: editObservaciones,
      });
      setEditingCase(null);
      setMergeStatus({
        ok: true,
        msg: `Metadatos de "${editNombre.trim() || editingCase.nombreCaso}" actualizados (${editEstadoRev}).`,
      });
      if (showBitacora) fetchBitacora();
    } catch (err: any) {
      setMergeStatus({
        ok: false,
        msg: err?.message || 'Error al guardar metadatos del expediente.',
      });
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleMergeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onMergeCasesJson) return;
    setIsMerging(true);
    setMergeStatus(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: CaseSession[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.cases)
        ? parsed.cases
        : [parsed];
      const valid = list.filter((item) => item && typeof item === 'object' && item.nombreCaso);
      if (valid.length === 0) {
        throw new Error('El archivo JSON no contiene expedientes válidos con nombreCaso.');
      }
      const res = await onMergeCasesJson(valid);
      setMergeStatus({ ok: true, msg: res.message });
      if (showBitacora) fetchBitacora();
    } catch (err: any) {
      setMergeStatus({
        ok: false,
        msg: err?.message || 'Error leyendo o fusionando el paquete JSON.',
      });
    } finally {
      setIsMerging(false);
      if (mergeInputRef.current) mergeInputRef.current.value = '';
    }
  };

  const getStatusLabel = (c: CaseSession) => {
    if (c.estadoRevision) return c.estadoRevision;
    if (c.estado === 'CERRADO') return 'ARCHIVADA';
    if (c.resultado || c.estado === 'DICTAMEN_EMITIDO') return 'VERIFICADA';
    return 'EN REVISIÓN';
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
              Expedientes Exclusivos, Fusión CRUD y Bitácora
              {activeEntity ? (
                <span className="text-xs font-mono text-sky-300">
                  • {activeEntity.siglas} ({entityCases.length} caso(s))
                </span>
              ) : (
                <span className="text-xs font-mono text-amber-300">• Sin entidad seleccionada</span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Gestiona estados de supervisión, fusiona paquetes JSON sin sobrescribir y audita la bitácora del sistema
            </p>
          </div>
        </div>

        {activeEntity && (
          <div className="flex flex-wrap items-center gap-2">
            {onMergeCasesJson && (
              <>
                <input
                  ref={mergeInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleMergeFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => mergeInputRef.current?.click()}
                  disabled={isMerging}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  {isMerging ? 'Fusionando...' : 'Fusionar (.json)'}
                </button>
              </>
            )}

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

      {/* Feedback Banner */}
      {mergeStatus && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            mergeStatus.ok
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/50 border-red-500/40 text-red-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {mergeStatus.msg}
          </span>
          <button
            type="button"
            onClick={() => setMergeStatus(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metadata Editor Drawer */}
      {editingCase && onUpdateCaseMetadata && (
        <form
          onSubmit={handleSaveMetadata}
          className="bg-slate-950 border border-sky-500/40 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />
              Editar Metadatos del Expediente ({editingCase.codigoCaso || editingCase.id})
            </div>
            <button
              type="button"
              onClick={() => setEditingCase(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Nombre del Expediente / Caso
              </label>
              <input
                type="text"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Estado de Supervisión y Control
              </label>
              <select
                value={editEstadoRev}
                onChange={(e) => setEditEstadoRev(e.target.value as CaseReviewStatus)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {REVIEW_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Observaciones Generales / Notas del Supervisor
            </label>
            <textarea
              rows={2}
              value={editObservaciones}
              onChange={(e) => setEditObservaciones(e.target.value)}
              placeholder="Criterio de supervisión, observaciones de calidad o seguimiento..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingCase(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSavingMeta}
              className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingMeta ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      )}

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
                <th className="py-3 px-3 text-right">Acciones CRUD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCases.map((c) => {
                const isActive = c.id === activeCaseId;
                const statusLabel = getStatusLabel(c);
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${isActive ? 'bg-sky-950/30' : 'hover:bg-slate-800/30'}`}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-bold">
                          {c.codigoCaso || 'CASO'}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold text-emerald-400">● EN TRABAJO</span>
                        )}
                      </div>
                      <div className="font-semibold text-white mt-1">{c.nombreCaso}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                        {c.observacionesGenerales || c.requerimiento}
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
                        className={`text-[11px] font-bold ${
                          statusLabel === 'APROBADA SUPERVISIÓN' || statusLabel === 'VERIFICADA'
                            ? 'text-emerald-400'
                            : statusLabel === 'ARCHIVADA'
                            ? 'text-slate-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <div className="text-[10.5px] text-slate-400 mt-1 font-mono tabular-nums">
                        {c.matrizHallazgosLiteral?.length || 0} hall. • {c.contractRows?.length || 0} contr. •{' '}
                        {c.paymentCycleRows?.length || 0} pagos
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-[10.5px] tabular-nums">
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
                        {onUpdateCaseMetadata && (
                          <button
                            type="button"
                            onClick={() => openEditor(c)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Editar nombre, estado y notas de supervisión"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Metadatos
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onViewCaseOnScreen(c)}
                          className="px-2.5 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
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

      {/* Collapsible System Operations Bitácora */}
      <div className="border-t border-slate-800 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowBitacora((v) => !v)}
            className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer"
          >
            <ScrollText className="w-4 h-4 text-sky-400" />
            Bitácora de Operaciones y Auditoría de Cambios
            {showBitacora ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showBitacora && (
            <button
              type="button"
              onClick={fetchBitacora}
              disabled={loadingBitacora}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingBitacora ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          )}
        </div>

        {showBitacora && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 max-h-64 overflow-y-auto">
            {bitacora.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                {loadingBitacora
                  ? 'Consultando bitácora del servidor...'
                  : 'No hay eventos registrados aún en la bitácora.'}
              </div>
            ) : (
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Fecha / Hora</th>
                    <th className="py-2 px-3">Operación</th>
                    <th className="py-2 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {bitacora.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-mono text-slate-400 whitespace-nowrap tabular-nums">
                        {new Date(b.fecha).toLocaleString('es-DO')}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-sky-300 whitespace-nowrap">
                        {b.operacion}
                      </td>
                      <td className="py-2 px-3 text-slate-300">{b.detalle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
