import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  ExternalLink,
  Loader2,
  FileSearch,
  Sparkles,
  Calendar,
  Scale,
} from 'lucide-react';
import {
  AuditedEntity,
  AuditPeriodScope,
  ContractEvidenceRow,
  DecreeSource,
  DirectorResponsibility,
  DirectorSegregationSummary,
  DossierSectionItem,
  LegalReferenceItem,
  ObservacionDecision,
  PaymentCycleRow,
} from '../types/forensic';
import { formatCurrency } from '../utils/entities';
import { calculateStringSHA256 } from '../utils/crypto';

interface Props {
  activeEntity: AuditedEntity | null;
  paisNormativa: string;
  idioma: string;
  periodo: AuditPeriodScope;
  simboloMoneda: string;
  directors: DirectorResponsibility[];
  setDirectors: React.Dispatch<React.SetStateAction<DirectorResponsibility[]>>;
  contractRows: ContractEvidenceRow[];
  paymentCycleRows: PaymentCycleRow[];
  observaciones: ObservacionDecision[];
  recursos: DossierSectionItem[];
  replicas: DossierSectionItem[];
  contraReplicas: DossierSectionItem[];
  onAddDecreeToLegalLibrary?: (dir: DirectorResponsibility) => void;
  onOpenLegalViewer?: (ref: LegalReferenceItem) => void;
  onLogAction: (accion: string, detalle: string) => void;
}

function normalizeDate(d?: string): string {
  if (!d) return '';
  const m = d.trim().match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const m2 = d.trim().match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return '';
}

function inRange(dateStr: string | undefined, startStr: string | undefined, endStr: string | undefined, isCurrent?: boolean): boolean {
  const d = normalizeDate(dateStr);
  const start = normalizeDate(startStr);
  const end = isCurrent ? '9999-12-31' : normalizeDate(endStr) || '9999-12-31';
  if (!d || !start) return false;
  return d >= start && d <= end;
}

export const DirectorResponsibilitySection: React.FC<Props> = ({
  activeEntity,
  paisNormativa,
  idioma,
  periodo,
  simboloMoneda,
  directors,
  setDirectors,
  contractRows,
  paymentCycleRows,
  observaciones,
  recursos,
  replicas,
  contraReplicas,
  onAddDecreeToLegalLibrary,
  onOpenLegalViewer,
  onLogAction,
}) => {
  const [fetchingSourceUrl, setFetchingSourceUrl] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<{ title: string; url: string; text: string } | null>(null);

  const [segregatingAi, setSegregatingAi] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [newSourceDraft, setNewSourceDraft] = useState<Record<string, { url: string; ubicacion: string; decreto: string }>>({});

  // Live deterministic segregation per director
  const localSegregation = useMemo(() => {
    const assignedContracts = new Set<string>();
    const assignedPayments = new Set<string>();
    const assignedObs = new Set<string>();

    const summaries: DirectorSegregationSummary[] = directors.map((dir) => {
      const mContracts = contractRows.filter((c) => {
        const hit = inRange(c.fechaAdenda || c.fechaContrato, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales);
        if (hit) assignedContracts.add(c.id);
        return hit;
      });
      const mPayments = paymentCycleRows.filter((p) => {
        const hit = inRange(p.fechaPago || p.fechaFactura || p.fechaSolicitud, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales);
        if (hit) assignedPayments.add(p.id);
        return hit;
      });
      const mObs = observaciones.filter((o) => {
        const hit =
          o.directorId === dir.id ||
          inRange(o.fechaHecho, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales);
        if (hit) assignedObs.add(o.id);
        return hit;
      });
      const mReplicas = replicas.filter(
        (r) => r.directorId === dir.id || inRange(r.fecha, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales)
      );
      const mContra = contraReplicas.filter(
        (cr) => cr.directorId === dir.id || inRange(cr.fecha, dir.fechaInicioGestion, dir.fechaFinGestion, dir.enFuncionesActuales)
      );

      const contratosMonto = mContracts.reduce((a, c) => a + (Number(c.montoOriginal) || 0), 0);
      const adendasMonto = mContracts.reduce((a, c) => a + (Number(c.montoAdenda) || 0), 0);
      const pagosMontoNeto = mPayments.reduce((a, p) => a + (Number(p.montoPagadoNeto) || 0), 0);
      const observacionesMonto = mObs.reduce((a, o) => a + (Number(o.montoInvolucrado) || 0), 0);

      const anom = mContracts.filter((c) => c.esAnomalo).length;
      const irreg = mPayments.filter((p) => p.estadoCiclo !== 'COMPLETO').length;
      const kept = mObs.filter((o) => o.decision === 'SE_MANTIENE').length;

      let riesgoCalculado: 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO' = 'BAJO';
      if (anom >= 2 || kept >= 2 || irreg >= 3) riesgoCalculado = 'CRÍTICO';
      else if (anom >= 1 || kept >= 1 || irreg >= 1 || adendasMonto > 0) riesgoCalculado = 'ALTO';
      else if (mContracts.length > 0 || mPayments.length > 0) riesgoCalculado = 'MEDIO';

      return {
        directorId: dir.id,
        directorNombre: dir.nombre || 'Titular sin nombre',
        cargo: dir.cargo || 'Director/a',
        periodoGestion: `${dir.fechaInicioGestion || 'N/D'} → ${dir.enFuncionesActuales ? 'Actualidad' : dir.fechaFinGestion || 'Sin fin'}`,
        numeroDecreto: dir.numeroDecretoNombramiento || 'Sin decreto',
        fuentesCount: dir.fuentes.length,
        contratosCount: mContracts.length,
        contratosMonto,
        adendasMonto,
        pagosCount: mPayments.length,
        pagosMontoNeto,
        observacionesCount: mObs.length,
        observacionesMonto,
        replicasCount: mReplicas.length,
        contraReplicasCount: mContra.length,
        riesgoCalculado,
        resumenResponsabilidad: `${mContracts.length} contrato(s) | ${mPayments.length} pago(s) | ${mObs.length} obs | ${mReplicas.length} réplica(s) | ${mContra.length} contra-réplica(s)`,
      };
    });

    return {
      summaries,
      orphanContracts: contractRows.filter((c) => !assignedContracts.has(c.id)).length,
      orphanPayments: paymentCycleRows.filter((p) => !assignedPayments.has(p.id)).length,
      orphanObs: observaciones.filter((o) => !assignedObs.has(o.id)).length,
    };
  }, [directors, contractRows, paymentCycleRows, observaciones, replicas, contraReplicas]);

  const handleAddManualDirector = () => {
    const nextNum = directors.length + 1;
    const newDir: DirectorResponsibility = {
      id: `dir-man-${Date.now()}`,
      nombre: '',
      cedulaId: '',
      cargo: 'Director/a General',
      periodoNumero: nextNum,
      fechaInicioGestion: periodo.fechaDesde || '',
      fechaFinGestion: periodo.fechaHasta || '',
      enFuncionesActuales: false,
      numeroDecretoNombramiento: '',
      fechaDecretoNombramiento: '',
      numeroDecretoSalida: '',
      fechaDecretoSalida: '',
      fuentes: [],
      responsabilidadObservaciones: '',
      notas: '',
    };
    setDirectors((prev) => [...prev, newDir]);
    onLogAction('Alta Manual de Director', `Se añadió ficha de titular período #${nextNum} para segregación.`);
  };

  const updateDirector = (id: string, patch: Partial<DirectorResponsibility>) => {
    setDirectors((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDirector = (id: string) => {
    setDirectors((prev) => prev.filter((d) => d.id !== id));
    onLogAction('Eliminación de Director', `Se removió el titular ${id} de la matriz de segregación.`);
  };

  const handleAddSourceToDirector = async (dirId: string) => {
    const draft = newSourceDraft[dirId];
    if (!draft || (!draft.url.trim() && !draft.ubicacion.trim())) return;
    const nowIso = new Date().toISOString();
    const sha256 = await calculateStringSHA256(`${dirId}_${draft.url}_${draft.ubicacion}_${nowIso}`);
    const newSrc: DecreeSource = {
      id: `src-man-${Date.now()}`,
      url: draft.url.trim(),
      titulo: draft.decreto.trim() || 'Fuente Oficial / Decreto Adjunto',
      ubicacionOrigen: draft.ubicacion.trim() || 'Archivo / Portal Institucional',
      numeroDecreto: draft.decreto.trim() || 'S/N',
      fechaDecreto: '',
      extractoLiteral: 'Fuente documental registrada y sellada por el auditor.',
      fechaConsulta: nowIso,
      sha256,
      verificadoWeb: Boolean(draft.url.trim()),
    };
    setDirectors((prev) =>
      prev.map((d) => (d.id === dirId ? { ...d, fuentes: [...d.fuentes, newSrc] } : d))
    );
    setNewSourceDraft((prev) => ({ ...prev, [dirId]: { url: '', ubicacion: '', decreto: '' } }));
    onLogAction('Registro de Fuente de Decreto', `Fuente guardada (${newSrc.ubicacionOrigen}) con hash ${sha256.slice(0, 10)}...`);
  };

  const handleInspectSourceUrl = async (url: string, title: string) => {
    if (!url) return;
    setFetchingSourceUrl(url);
    try {
      const resp = await fetch('/api/forensic/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo leer el contenido público del enlace.');
      }
      setSourcePreview({
        title: title || data.fileName || url,
        url,
        text: data.extractedText || data.contentSnippet || 'Contenido leído sin texto visible.',
      });
    } catch (err: any) {
      setSourcePreview({
        title: title || url,
        url,
        text: `No se pudo descargar el contenido directo desde servidor (${err.message}). Puede abrir el enlace oficial directamente en nueva pestaña.`,
      });
    } finally {
      setFetchingSourceUrl(null);
    }
  };

  const handleRunAiSegregation = async () => {
    if (directors.length === 0) return;
    setSegregatingAi(true);
    try {
      const resp = await fetch('/api/forensic/segregate-responsibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName: activeEntity?.nombre || 'Entidad Auditada',
          paisNormativa,
          idioma,
          directors,
          contractRows,
          paymentCycleRows,
          observaciones,
          recursos,
          replicas,
          contraReplicas,
          useAiSummary: true,
        }),
      });
      const data = await resp.json();
      if (data.success && data.aiNarrative) {
        setAiNarrative(data.aiNarrative);
        onLogAction('Segregación de Responsabilidad IA', `Análisis ejecutado sobre ${directors.length} director(es).`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSegregatingAi(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Segregación de Responsabilidad por Directores y Períodos
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Fuentes Guardadas &amp; Contratos/Pagos
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Administre múltiples períodos de gestión y segrega contratos, pagos, observaciones, réplicas y contra-réplicas por cada director o titular.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleAddManualDirector}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            Añadir Director Manual
          </button>
          <button
            type="button"
            onClick={handleRunAiSegregation}
            disabled={directors.length === 0 || segregatingAi}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {segregatingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
            Cruzar y Dictaminar Responsabilidad
          </button>
        </div>
      </div>

      {/* Editable Multi-Period Directors List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Directores / Titulares Registrados por Período ({directors.length})
          </h3>
          {(localSegregation.orphanContracts > 0 || localSegregation.orphanPayments > 0 || localSegregation.orphanObs > 0) && (
            <span className="text-[11px] px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
              Fuera de rango / Sin Director: {localSegregation.orphanContracts} ct(s), {localSegregation.orphanPayments} pago(s),{' '}
              {localSegregation.orphanObs} obs
            </span>
          )}
        </div>

        {directors.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400 space-y-2">
            <p>
              No hay directores cargados todavía. Use el <strong className="text-indigo-300">Buscador de Decretos Oficiales</strong> superior para localizar decretos de nombramiento o agregue un período manualmente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {directors.map((dir, idx) => {
              const seg = localSegregation.summaries.find((s) => s.directorId === dir.id);
              const draft = newSourceDraft[dir.id] || { url: '', ubicacion: '', decreto: '' };
              return (
                <div key={dir.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold text-[11px]">
                        Período #{idx + 1}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {dir.nombre || 'Director sin nombre asignado'}
                      </span>
                      {seg && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            seg.riesgoCalculado === 'CRÍTICO'
                              ? 'bg-red-500/20 text-red-300 border-red-500/40'
                              : seg.riesgoCalculado === 'ALTO'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          Riesgo Período: {seg.riesgoCalculado}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {onAddDecreeToLegalLibrary && (
                        <button
                          type="button"
                          onClick={() => onAddDecreeToLegalLibrary(dir)}
                          className="text-sky-300 hover:text-sky-200 px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                        >
                          + Biblioteca Legal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeDirector(dir.id)}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40 cursor-pointer flex items-center gap-1 text-[11px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>

                  {/* Editable Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        value={dir.nombre}
                        onChange={(e) => updateDirector(dir.id, { nombre: e.target.value })}
                        placeholder="Nombre del Director"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Cargo Oficial</label>
                      <input
                        type="text"
                        value={dir.cargo}
                        onChange={(e) => updateDirector(dir.id, { cargo: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Decreto de Nombramiento</label>
                      <input
                        type="text"
                        value={dir.numeroDecretoNombramiento}
                        onChange={(e) => updateDirector(dir.id, { numeroDecretoNombramiento: e.target.value })}
                        placeholder="Ej: Decreto No. 329-20"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Decreto de Relevo / Salida</label>
                      <input
                        type="text"
                        value={dir.numeroDecretoSalida || ''}
                        onChange={(e) => updateDirector(dir.id, { numeroDecretoSalida: e.target.value })}
                        placeholder="Opcional si cesó funciones"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Inicio de Gestión *</label>
                      <input
                        type="date"
                        value={dir.fechaInicioGestion}
                        onChange={(e) => updateDirector(dir.id, { fechaInicioGestion: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Fin de Gestión</label>
                      <input
                        type="date"
                        disabled={Boolean(dir.enFuncionesActuales)}
                        value={dir.fechaFinGestion}
                        onChange={(e) => updateDirector(dir.id, { fechaFinGestion: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer py-1.5">
                        <input
                          type="checkbox"
                          checked={Boolean(dir.enFuncionesActuales)}
                          onChange={(e) => updateDirector(dir.id, { enFuncionesActuales: e.target.checked })}
                          className="rounded border-slate-700"
                        />
                        En Funciones Actuales
                      </label>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Cédula / ID (Opcional)</label>
                      <input
                        type="text"
                        value={dir.cedulaId || ''}
                        onChange={(e) => updateDirector(dir.id, { cedulaId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Segregated Metrics Strip */}
                  {seg && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Contratos</span>
                        <strong className="text-white">
                          {seg.contratosCount} ({formatCurrency(seg.contratosMonto, simboloMoneda)})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Adendas Período</span>
                        <strong className="text-amber-300">{formatCurrency(seg.adendasMonto, simboloMoneda)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Pagos Netos</span>
                        <strong className="text-emerald-400">
                          {seg.pagosCount} ({formatCurrency(seg.pagosMontoNeto, simboloMoneda)})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Observaciones</span>
                        <strong className="text-red-300">{seg.observacionesCount}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Réplicas / Contra-Rép.</span>
                        <strong className="text-sky-300">
                          {seg.replicasCount} / {seg.contraReplicasCount}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Saved Sources & Origin Locations */}
                  <div className="space-y-2 bg-slate-900/70 border border-slate-800 rounded-lg p-3">
                    <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5">
                      <FileSearch className="w-3.5 h-3.5" />
                      Fuentes y Ubicación de Origen del Decreto ({dir.fuentes.length})
                    </div>
                    {dir.fuentes.map((src) => (
                      <div key={src.id} className="bg-slate-950 border border-slate-800 rounded p-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-semibold text-white">{src.titulo}</span>
                          <span className="font-mono text-[10px] text-emerald-400">
                            SHA-256: {src.sha256.slice(0, 12)}...
                          </span>
                        </div>
                        <div className="text-slate-400">
                          <strong>Ubicación / Origen:</strong> {src.ubicacionOrigen} •{' '}
                          <strong>Consulta:</strong> {src.fechaConsulta?.slice(0, 10)}
                        </div>
                        {src.url && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-400 hover:underline flex items-center gap-1 break-all"
                            >
                              <ExternalLink className="w-3 h-3 shrink-0" />
                              {src.url}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleInspectSourceUrl(src.url, src.titulo)}
                              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] cursor-pointer"
                            >
                              {fetchingSourceUrl === src.url ? 'Leyendo...' : 'Ver Contenido Origen'}
                            </button>
                            {onOpenLegalViewer && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenLegalViewer({
                                    id: `law-dec-${src.id}`,
                                    numeroNorma: src.numeroDecreto || dir.numeroDecretoNombramiento || 'Decreto Oficial',
                                    titulo: src.titulo || `Nombramiento ${dir.nombre}`,
                                    jerarquia: 'DECRETO',
                                    jerarquiaOrden: 4,
                                    articulosPuntuales: ['Designación / Nombramiento'],
                                    hallazgosVinculados: [],
                                    url: src.url,
                                    ubicacionFuente: src.ubicacionOrigen,
                                    resumenAplicacion: src.extractoLiteral || `Decreto oficial correspondiente a ${dir.nombre}.`,
                                    sha256: src.sha256,
                                    fechaRegistro: src.fechaConsulta,
                                  })
                                }
                                className="px-2 py-0.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 rounded text-[10px] cursor-pointer"
                              >
                                Visor Interno
                              </button>
                            )}
                          </div>
                        )}
                        {src.extractoLiteral && (
                          <p className="text-slate-300 italic">{src.extractoLiteral}</p>
                        )}
                      </div>
                    ))}

                    {/* Add source URL/origin manually */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="URL Oficial del Decreto / Gaceta"
                        value={draft.url}
                        onChange={(e) =>
                          setNewSourceDraft((p) => ({ ...p, [dir.id]: { ...draft, url: e.target.value } }))
                        }
                        className="sm:col-span-5 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-[11px] text-white"
                      />
                      <input
                        type="text"
                        placeholder="Ubicación / Carpeta o Portal Origen"
                        value={draft.ubicacion}
                        onChange={(e) =>
                          setNewSourceDraft((p) => ({ ...p, [dir.id]: { ...draft, ubicacion: e.target.value } }))
                        }
                        className="sm:col-span-4 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-[11px] text-white"
                      />
                      <input
                        type="text"
                        placeholder="No. Decreto"
                        value={draft.decreto}
                        onChange={(e) =>
                          setNewSourceDraft((p) => ({ ...p, [dir.id]: { ...draft, decreto: e.target.value } }))
                        }
                        className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-[11px] text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSourceToDirector(dir.id)}
                        className="sm:col-span-1 bg-sky-600 hover:bg-sky-500 text-white rounded px-2 py-1.5 text-[11px] font-bold cursor-pointer"
                        title="Guardar fuente y sello SHA-256"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Responsibility Segregation Table */}
      {localSegregation.summaries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            Matriz Comparativa de Responsabilidad Segregada por Período y Titular
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Director / Titular</th>
                  <th className="py-2.5 px-3">Decreto Oficial</th>
                  <th className="py-2.5 px-3">Período Gestión</th>
                  <th className="py-2.5 px-3 text-right">Contratos + Adendas</th>
                  <th className="py-2.5 px-3 text-right">Pagos Netos</th>
                  <th className="py-2.5 px-3 text-center">Obs / Rép / Contra-R</th>
                  <th className="py-2.5 px-3 text-center">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {localSegregation.summaries.map((s) => (
                  <tr key={s.directorId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {s.directorNombre}
                      <span className="block text-[10px] text-slate-400 font-normal">{s.cargo}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-amber-300">
                      {s.numeroDecreto}
                      <span className="block text-[10px] text-slate-400">{s.fuentesCount} fuente(s)</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">{s.periodoGestion}</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatCurrency(s.contratosMonto, simboloMoneda)}
                      <span className="block text-[10px] text-amber-300">
                        Adendas: {formatCurrency(s.adendasMonto, simboloMoneda)} ({s.contratosCount} ct)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                      {formatCurrency(s.pagosMontoNeto, simboloMoneda)}
                      <span className="block text-[10px] text-slate-400">{s.pagosCount} pago(s)</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {s.observacionesCount} / {s.replicasCount} / {s.contraReplicasCount}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">{s.riesgoCalculado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aiNarrative && (
        <div className="bg-indigo-950/30 border border-indigo-500/40 rounded-xl p-4 space-y-1.5">
          <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Dictamen IA de Segregación de Responsabilidad Administrativa
          </div>
          <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">{aiNarrative}</p>
        </div>
      )}

      {sourcePreview && (
        <div className="bg-slate-950 border border-sky-500/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold text-sky-300">{sourcePreview.title}</div>
              <div className="text-[10px] font-mono text-slate-400 break-all">{sourcePreview.url}</div>
            </div>
            <button
              type="button"
              onClick={() => setSourcePreview(null)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] cursor-pointer"
            >
              Cerrar Vista
            </button>
          </div>
          <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto bg-slate-900 p-3 rounded border border-slate-800">
            {sourcePreview.text}
          </pre>
        </div>
      )}
    </section>
  );
};
