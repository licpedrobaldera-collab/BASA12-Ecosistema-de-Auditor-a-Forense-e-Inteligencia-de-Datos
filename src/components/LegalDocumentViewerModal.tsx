import React, { useEffect, useState } from 'react';
import {
  X,
  Scale,
  ExternalLink,
  Loader2,
  FileText,
  Globe,
  ShieldCheck,
  AlertCircle,
  BookOpen,
  Link2,
} from 'lucide-react';
import { LegalReferenceItem, NormativeHierarchyLevel } from '../types/forensic';

interface Props {
  legalRef: LegalReferenceItem | null;
  onClose: () => void;
  onCacheExtractedText?: (id: string, text: string, url?: string) => void;
}

const HIERARCHY_BADGE: Record<NormativeHierarchyLevel, { label: string; cls: string }> = {
  CONSTITUCION: {
    label: 'Nivel 1 • Constitución',
    cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  TRATADOS_ISSAI_NIA: {
    label: 'Nivel 2 • Tratados / ISSAI / NIA',
    cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  LEY: {
    label: 'Nivel 3 • Ley Orgánica / Ordinaria',
    cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  DECRETO: {
    label: 'Nivel 4 • Decreto / Reglamento',
    cls: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  RESOLUCION_NOBACI: {
    label: 'Nivel 5 • Resolución / NOBACI / CGR',
    cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  NORMATIVA_INTERNA: {
    label: 'Nivel 6 • Normativa Interna / Manual',
    cls: 'bg-slate-700/60 text-slate-300 border-slate-600',
  },
};

export const LegalDocumentViewerModal: React.FC<Props> = ({
  legalRef,
  onClose,
  onCacheExtractedText,
}) => {
  const [viewMode, setViewMode] = useState<'texto' | 'portal'>('texto');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [fetchedText, setFetchedText] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');

  useEffect(() => {
    if (!legalRef) return;
    setViewMode('texto');
    setFetchError(null);
    setCustomUrlInput(legalRef.url || '');
    setFetchedText(legalRef.textoExtraido || '');

    if (legalRef.url && !legalRef.textoExtraido) {
      fetchLiveContent(legalRef.url, legalRef.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalRef?.id]);

  const fetchLiveContent = async (targetUrl: string, refId: string) => {
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) return;
    setLoadingUrl(true);
    setFetchError(null);
    try {
      const resp = await fetch('/api/forensic/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'El portal oficial bloqueó la descarga directa de texto.');
      }
      const txt = data.extractedText || data.contentSnippet || 'Documento conectado sin cuerpo textual plano.';
      setFetchedText(txt);
      if (onCacheExtractedText) {
        onCacheExtractedText(refId, txt, targetUrl);
      }
    } catch (err: any) {
      setFetchError(
        err?.message ||
          'No se pudo extraer el texto plano automáticamente desde ese dominio (puede requerir abrir en la pestaña Portal Embebido o Nueva Pestaña).'
      );
    } finally {
      setLoadingUrl(false);
    }
  };

  if (!legalRef) return null;

  const badge = HIERARCHY_BADGE[legalRef.jerarquia] || HIERARCHY_BADGE.LEY;
  const activeUrl = customUrlInput.trim() || legalRef.url || '';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-sky-500/40 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950 gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className="font-mono text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                  {legalRef.numeroNorma}
                </span>
                {legalRef.esDuplicado && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                    Cita Duplicada
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                {legalRef.titulo}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 self-end sm:self-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 text-sky-400" />
            Cerrar y Volver al Expediente
          </button>
        </div>

        {/* Metadata Strip */}
        <div className="px-5 py-3 bg-slate-900/90 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10.5px] uppercase font-semibold">
              Artículos Puntuales Citados
            </span>
            <span className="text-sky-300 font-semibold">
              {legalRef.articulosPuntuales?.length > 0
                ? legalRef.articulosPuntuales.join(' • ')
                : 'Consulta normativa general'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10.5px] uppercase font-semibold">
              Hallazgos Vinculados
            </span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {legalRef.hallazgosVinculados?.length > 0 ? (
                legalRef.hallazgosVinculados.map((hId) => (
                  <span
                    key={hId}
                    className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10.5px]"
                  >
                    {hId}
                  </span>
                ))
              ) : (
                <span className="text-slate-400">Marco transversal del caso</span>
              )}
            </div>
          </div>
          <div>
            <span className="text-slate-400 block text-[10.5px] uppercase font-semibold">
              Ubicación / Custodia SHA-256
            </span>
            <span className="text-slate-300 block truncate">{legalRef.ubicacionFuente || 'Biblioteca del Caso'}</span>
            <span className="text-[10px] font-mono text-emerald-400">
              SHA-256: {legalRef.sha256 ? `${legalRef.sha256.slice(0, 18)}...` : 'En sesión'}
            </span>
          </div>
        </div>

        {/* URL Connector & View Tabs */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('texto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'texto'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Lectura Textual en Línea
            </button>
            <button
              type="button"
              onClick={() => setViewMode('portal')}
              disabled={!activeUrl}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                viewMode === 'portal'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Portal Oficial Embebido (Sin Salir)
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Link2 className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="Pegue o edite URL oficial (Consultoría Jurídica, Congreso, CGR, MAP)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] font-mono text-sky-300 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchLiveContent(customUrlInput, legalRef.id)}
              disabled={!customUrlInput.trim() || loadingUrl}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
            >
              {loadingUrl ? 'Cargando...' : 'Cargar URL'}
            </button>
            {activeUrl && (
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center gap-1 shrink-0"
                title="Abrir en pestaña externa si el portal restringe iframes"
              >
                <ExternalLink className="w-3 h-3" />
                Pestaña
              </a>
            )}
          </div>
        </div>

        {/* Viewer Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950/70 space-y-4">
          {legalRef.resumenAplicacion && (
            <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl p-3.5 text-xs text-sky-100 flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sky-300 block mb-0.5">Aplicación Técnica en el Expediente:</strong>
                <span>{legalRef.resumenAplicacion}</span>
              </div>
            </div>
          )}

          {viewMode === 'texto' ? (
            <div className="space-y-3">
              {loadingUrl && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-300 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  Consultando fuente oficial en línea sin salir de la plataforma...
                </div>
              )}

              {fetchError && (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="block font-semibold">Nota de lectura remota:</span>
                    <span>{fetchError}</span>
                  </div>
                </div>
              )}

              {fetchedText ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Texto Normativo Extraído dentro del Sistema
                    </span>
                    <span className="font-mono text-slate-400">{fetchedText.length.toLocaleString()} caracteres</span>
                  </div>
                  <pre className="text-xs font-sans text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[46vh] overflow-y-auto">
                    {fetchedText}
                  </pre>
                </div>
              ) : (
                !loadingUrl && (
                  <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-6 text-xs text-slate-300 space-y-3">
                    {legalRef.articulosPuntuales && legalRef.articulosPuntuales.length > 0 && (
                      <div className="text-left bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
                        <div className="font-bold text-sky-300">Disposiciones y Artículos de Referencia Registrados:</div>
                        <ul className="list-disc list-inside space-y-1 text-slate-200">
                          {legalRef.articulosPuntuales.map((art, i) => (
                            <li key={i}>{art}</li>
                          ))}
                        </ul>
                        {legalRef.ubicacionFuente && (
                          <div className="text-[11px] text-slate-400 pt-1">
                            Órgano / Fuente: {legalRef.ubicacionFuente}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-center text-slate-400">
                      {activeUrl
                        ? 'Presione "Cargar URL" para descargar el texto completo del portal oficial aquí mismo o seleccione "Portal Oficial Embebido".'
                        : 'Esta referencia normativa aún no tiene una URL oficial adjunta. Puede pegar la URL de Consultoría Jurídica, Congreso Nacional, CGR o MAP en la barra superior y cargarla sin salir de la sesión.'}
                    </p>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="space-y-2 h-full">
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Vista embebida directa sin abandonar el expediente. Si el sitio bloquea iframe, use "Lectura Textual en Línea" o "Pestaña".</span>
              </div>
              <iframe
                src={activeUrl}
                title={legalRef.titulo}
                className="w-full h-[55vh] rounded-xl border border-slate-700 bg-white"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
