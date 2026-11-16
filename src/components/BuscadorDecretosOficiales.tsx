import React, { useState } from 'react';
import {
  Globe,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookmarkPlus,
  BookOpen,
  UserPlus,
  Link2,
  FileText,
  Sparkles,
} from 'lucide-react';
import {
  AuditedEntity,
  AuditPeriodScope,
  DecreeSource,
  DirectorResponsibility,
  LegalReferenceItem,
} from '../types/forensic';
import { calculateStringSHA256 } from '../utils/crypto';

interface Props {
  activeEntity: AuditedEntity | null;
  paisNormativa: string;
  periodo: AuditPeriodScope;
  legalLibrary: LegalReferenceItem[];
  onSaveDecreeSourceToLegalLibrary: (item: {
    numeroNorma: string;
    titulo: string;
    url: string;
    fragmentoTexto: string;
    ubicacionFuente: string;
    directorNombre?: string;
    fechaPeriodo?: string;
  }) => Promise<void> | void;
  onApplyDirector: (dir: DirectorResponsibility) => void;
  onOpenLegalViewer?: (ref: LegalReferenceItem) => void;
  onLogAction: (accion: string, detalle: string) => void;
}

export const BuscadorDecretosOficiales: React.FC<Props> = ({
  activeEntity,
  paisNormativa,
  periodo,
  legalLibrary,
  onSaveDecreeSourceToLegalLibrary,
  onApplyDirector,
  onOpenLegalViewer,
  onLogAction,
}) => {
  const [searchDirectorQuery, setSearchDirectorQuery] = useState('');
  const [searchFromDate, setSearchFromDate] = useState(periodo.fechaDesde || '2016-01-01');
  const [searchToDate, setSearchToDate] = useState(
    periodo.fechaHasta || new Date().toISOString().split('T')[0]
  );
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState('');
  const [groundedWebSources, setGroundedWebSources] = useState<DecreeSource[]>([]);
  const [foundDirectors, setFoundDirectors] = useState<DirectorResponsibility[]>([]);

  // Per-source editable URL / snippet overrides before saving to Legal Library
  const [editedSnippets, setEditedSnippets] = useState<Record<string, { url: string; fragmento: string; norma: string }>>({});
  const [fetchingUrlId, setFetchingUrlId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Quick manual save bar inside Buscador
  const [showManualSave, setShowManualSave] = useState(false);
  const [manualNorma, setManualNorma] = useState('');
  const [manualDirector, setManualDirector] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualFragmento, setManualFragmento] = useState('');

  const isUrlAlreadyInLibrary = (url: string, norma?: string) => {
    const cleanUrl = (url || '').trim().toLowerCase();
    const cleanNorma = (norma || '').trim().toLowerCase();
    return legalLibrary.some(
      (l) =>
        (cleanUrl && (l.url || '').trim().toLowerCase() === cleanUrl) ||
        (cleanNorma && l.numeroNorma.trim().toLowerCase() === cleanNorma && cleanUrl === (l.url || '').trim().toLowerCase())
    );
  };

  const handleSearchDecreesOnline = async () => {
    const entityTarget = activeEntity?.nombre || '';
    if (!entityTarget && !searchDirectorQuery.trim()) {
      setSearchError(
        'Registre la entidad auditada en el Paso 1 o escriba el nombre de un director/decreto para buscar con Google Search.'
      );
      return;
    }

    setSearchingOnline(true);
    setSearchError(null);
    try {
      const resp = await fetch('/api/forensic/search-appointment-decrees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName: entityTarget,
          entitySiglas: activeEntity?.siglas || '',
          rncNif: activeEntity?.rncNif || '',
          paisNormativa,
          periodoDesde: searchFromDate,
          periodoHasta: searchToDate,
          directorNameQuery: searchDirectorQuery,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error ejecutando el Buscador de Decretos Oficiales.');
      }

      const dirs: DirectorResponsibility[] = Array.isArray(data.directoresEncontrados)
        ? data.directoresEncontrados
        : [];
      const srcs: DecreeSource[] = Array.isArray(data.webSources) ? data.webSources : [];

      setSearchNote(data.notaBusqueda || 'Búsqueda oficial con Google Search finalizada.');
      setFoundDirectors(dirs);
      setGroundedWebSources(srcs);

      // Pre-populate editable buffers for immediate inspection & persistence
      const nextEdits: Record<string, { url: string; fragmento: string; norma: string }> = {};
      dirs.forEach((d) => {
        const s = d.fuentes?.[0];
        nextEdits[d.id] = {
          url: s?.url || '',
          fragmento: s?.extractoLiteral || d.notas || '',
          norma: d.numeroDecretoNombramiento || `Decreto (${d.nombre})`,
        };
      });
      srcs.forEach((ws) => {
        nextEdits[ws.id] = {
          url: ws.url || '',
          fragmento: ws.extractoLiteral || `Fuente web oficial: ${ws.titulo}`,
          norma: ws.numeroDecreto || ws.titulo.slice(0, 60) || 'Decreto Oficial Web',
        };
      });
      setEditedSnippets((prev) => ({ ...prev, ...nextEdits }));

      onLogAction(
        'Buscador de Decretos Oficiales (Google Search)',
        `Consultados ${dirs.length} director(es) y ${srcs.length} fuente(s) web oficiales para ${entityTarget || searchDirectorQuery}.`
      );
    } catch (err: any) {
      setSearchError(err.message || 'No se pudo completar la búsqueda oficial en línea.');
    } finally {
      setSearchingOnline(false);
    }
  };

  const handleExtractLiveSnippet = async (rowId: string, targetUrl: string) => {
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) return;
    setFetchingUrlId(rowId);
    try {
      const resp = await fetch('/api/forensic/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo extraer texto desde esa URL.');
      }
      const textChunk = String(data.extractedText || data.contentSnippet || '').trim().slice(0, 2200);
      if (textChunk) {
        setEditedSnippets((prev) => ({
          ...prev,
          [rowId]: {
            url: targetUrl,
            norma: prev[rowId]?.norma || 'Decreto Oficial',
            fragmento: textChunk,
          },
        }));
      }
    } catch (err: any) {
      setSearchError(`Extracción de fuente (${targetUrl}): ${err.message}`);
    } finally {
      setFetchingUrlId(null);
    }
  };

  const handleSaveEntryToLibrary = async (params: {
    rowId: string;
    defaultNorma: string;
    defaultTitulo: string;
    defaultUrl: string;
    defaultFragmento: string;
    ubicacionFuente: string;
    directorNombre?: string;
    fechaPeriodo?: string;
  }) => {
    const edited = editedSnippets[params.rowId];
    const finalUrl = (edited?.url ?? params.defaultUrl).trim();
    const finalFragmento = (edited?.fragmento ?? params.defaultFragmento).trim();
    const finalNorma = (edited?.norma ?? params.defaultNorma).trim() || 'Decreto Oficial';

    if (!finalUrl && !finalFragmento) return;
    setSavingId(params.rowId);
    try {
      await onSaveDecreeSourceToLegalLibrary({
        numeroNorma: finalNorma,
        titulo: params.defaultTitulo,
        url: finalUrl,
        fragmentoTexto: finalFragmento,
        ubicacionFuente: params.ubicacionFuente,
        directorNombre: params.directorNombre,
        fechaPeriodo: params.fechaPeriodo,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrl.trim() && !manualFragmento.trim()) return;
    await onSaveDecreeSourceToLegalLibrary({
      numeroNorma: manualNorma.trim() || 'Decreto Oficial de Nombramiento',
      titulo: manualDirector.trim()
        ? `Nombramiento Oficial: ${manualDirector.trim()}`
        : `Fuente Verificada (${activeEntity?.siglas || 'Entidad'})`,
      url: manualUrl.trim(),
      fragmentoTexto: manualFragmento.trim(),
      ubicacionFuente: 'Registro Verificado en Buscador de Decretos (Paso 4)',
      directorNombre: manualDirector.trim() || undefined,
    });
    setManualNorma('');
    setManualDirector('');
    setManualUrl('');
    setManualFragmento('');
    setShowManualSave(false);
  };

  return (
    <section className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Component Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Buscador de Decretos Oficiales
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Google Search API • Biblioteca Legal
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Localiza decretos oficiales de nombramiento de directores asociados a{' '}
              <strong className="text-slate-200">{activeEntity?.nombre || 'la entidad auditada'}</strong> y guarda la URL oficial + fragmento textual como fuente verificada en la Biblioteca Legal.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowManualSave(!showManualSave)}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          Guardar URL + Fragmento Manual
        </button>
      </div>

      {/* Search Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs">
        <div className="md:col-span-5">
          <label className="text-[11px] text-slate-400 block mb-1">
            Director / Número de Decreto / Entidad (Opcional)
          </label>
          <input
            type="text"
            value={searchDirectorQuery}
            onChange={(e) => setSearchDirectorQuery(e.target.value)}
            placeholder="Ej: Decreto nombramiento director, o nombre específico..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-slate-400 block mb-1">Desde</label>
          <input
            type="date"
            value={searchFromDate}
            onChange={(e) => setSearchFromDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-slate-400 block mb-1">Hasta</label>
          <input
            type="date"
            value={searchToDate}
            onChange={(e) => setSearchToDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono"
          />
        </div>
        <div className="md:col-span-3 flex items-end">
          <button
            type="button"
            onClick={handleSearchDecreesOnline}
            disabled={searchingOnline}
            className="w-full py-2 px-3 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
          >
            {searchingOnline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {searchingOnline ? 'Buscando en Google...' : 'Buscar Decretos Oficiales'}
          </button>
        </div>
      </div>

      {/* Optional Manual Save Drawer */}
      {showManualSave && (
        <form
          onSubmit={handleSaveManualEntry}
          className="bg-slate-950 border border-sky-500/40 rounded-xl p-4 space-y-3 text-xs"
        >
          <div className="font-bold text-sky-300 flex items-center gap-1.5">
            <BookmarkPlus className="w-4 h-4" />
            Registrar Decreto Oficial y Fragmento Verificado en la Biblioteca Legal
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={manualNorma}
              onChange={(e) => setManualNorma(e.target.value)}
              placeholder="Núm. Decreto (Ej: Decreto núm. 329-20)"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono"
            />
            <input
              type="text"
              value={manualDirector}
              onChange={(e) => setManualDirector(e.target.value)}
              placeholder="Nombre del Director / Titular designado"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
            />
            <input
              type="url"
              required
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="URL Oficial (https://consultoria.gov.do/...)"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sky-300 font-mono"
            />
          </div>
          <textarea
            rows={2}
            required
            value={manualFragmento}
            onChange={(e) => setManualFragmento(e.target.value)}
            placeholder="Pegue aquí el fragmento textual del artículo del decreto o nombramiento oficial..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold cursor-pointer"
            >
              Guardar en Biblioteca Legal
            </button>
          </div>
        </form>
      )}

      {searchError && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Results Display */}
      {(searchNote || foundDirectors.length > 0 || groundedWebSources.length > 0) && (
        <div className="space-y-4 pt-3 border-t border-slate-800">
          {searchNote && (
            <div className="text-xs text-slate-200 bg-slate-950/90 border border-slate-800 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-300">Resultado de Consulta Oficial: </strong>
                {searchNote}
              </div>
            </div>
          )}

          {/* Structured Directors with Decree + Editable URL & Snippet Save */}
          {foundDirectors.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Decretos y Directores Localizados ({foundDirectors.length})
                </span>
                <button
                  type="button"
                  onClick={() => foundDirectors.forEach((d) => onApplyDirector(d))}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-[11px] font-bold cursor-pointer flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Aplicar Todos a Segregación de Períodos
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {foundDirectors.map((fd) => {
                  const firstSrc = fd.fuentes?.[0];
                  const editState = editedSnippets[fd.id] || {
                    url: firstSrc?.url || '',
                    fragmento: firstSrc?.extractoLiteral || fd.notas || '',
                    norma: fd.numeroDecretoNombramiento || `Decreto (${fd.nombre})`,
                  };
                  const saved = isUrlAlreadyInLibrary(editState.url, editState.norma);

                  return (
                    <div key={fd.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-white text-sm">{fd.nombre}</div>
                          <div className="text-[11px] text-sky-300">{fd.cargo}</div>
                          <div className="font-mono text-[11px] text-amber-300 mt-0.5">
                            {fd.numeroDecretoNombramiento} • {fd.fechaInicioGestion || 'N/D'} a{' '}
                            {fd.enFuncionesActuales ? 'Actualidad' : fd.fechaFinGestion || 'N/D'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplyDirector(fd)}
                          className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-semibold cursor-pointer shrink-0"
                        >
                          + Aplicar Director
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10.5px] text-slate-400 block">URL Oficial Encontrada</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editState.url}
                            onChange={(e) =>
                              setEditedSnippets((p) => ({
                                ...p,
                                [fd.id]: { ...editState, url: e.target.value },
                              }))
                            }
                            placeholder="https://..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono text-sky-300"
                          />
                          {editState.url && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleExtractLiveSnippet(fd.id, editState.url)}
                                disabled={fetchingUrlId === fd.id}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] font-semibold cursor-pointer shrink-0"
                              >
                                {fetchingUrlId === fd.id ? 'Leyendo...' : 'Extraer URL'}
                              </button>
                              <a
                                href={editState.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                                title="Abrir enlace en nueva pestaña"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10.5px] text-slate-400 block mb-1">
                          Fragmento de Texto Verídico (Fuente de Verificación)
                        </label>
                        <textarea
                          rows={2}
                          value={editState.fragmento}
                          onChange={(e) =>
                            setEditedSnippets((p) => ({
                              ...p,
                              [fd.id]: { ...editState, fragmento: e.target.value },
                            }))
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-[11px] text-slate-200"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] text-slate-500 truncate">
                          Origen: {firstSrc?.ubicacionOrigen || 'Google Search Grounding'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveEntryToLibrary({
                              rowId: fd.id,
                              defaultNorma: fd.numeroDecretoNombramiento || `Decreto (${fd.nombre})`,
                              defaultTitulo: `Nombramiento Oficial: ${fd.nombre} (${fd.cargo})`,
                              defaultUrl: editState.url,
                              defaultFragmento: editState.fragmento,
                              ubicacionFuente: firstSrc?.ubicacionOrigen || 'Google Search — Decretos Oficiales',
                              directorNombre: fd.nombre,
                              fechaPeriodo: `${fd.fechaInicioGestion || 'N/D'} a ${fd.enFuncionesActuales ? 'Actualidad' : fd.fechaFinGestion || 'N/D'}`,
                            })
                          }
                          disabled={savingId === fd.id || (!editState.url && !editState.fragmento)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                            saved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          {saved ? 'Guardado en Biblioteca Legal' : 'Guardar en Biblioteca Legal'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Grounded Google Search Web Sources (Every source independently saveable with URL + text fragment) */}
          {groundedWebSources.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <Link2 className="w-4 h-4" />
                Fuentes Web Oficiales Recuperadas por Google Search ({groundedWebSources.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {groundedWebSources.map((ws) => {
                  const editState = editedSnippets[ws.id] || {
                    url: ws.url,
                    fragmento: ws.extractoLiteral || ws.titulo,
                    norma: ws.numeroDecreto || ws.titulo.slice(0, 65),
                  };
                  const saved = isUrlAlreadyInLibrary(editState.url);

                  return (
                    <div
                      key={ws.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={editState.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-sky-300 hover:underline flex items-center gap-1 text-[11.5px] leading-snug"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>{ws.titulo}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleExtractLiveSnippet(ws.id, editState.url)}
                          disabled={fetchingUrlId === ws.id}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-[10px] font-semibold shrink-0 cursor-pointer"
                        >
                          {fetchingUrlId === ws.id ? 'Leyendo...' : 'Extraer Texto'}
                        </button>
                      </div>

                      <div className="text-[10.5px] font-mono text-slate-400 truncate">{editState.url}</div>

                      <textarea
                        rows={2}
                        value={editState.fragmento}
                        onChange={(e) =>
                          setEditedSnippets((p) => ({
                            ...p,
                            [ws.id]: { ...editState, fragmento: e.target.value },
                          }))
                        }
                        placeholder="Fragmento textual de verificación..."
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-[11px] text-slate-200"
                      />

                      <div className="flex items-center justify-between gap-2">
                        {onOpenLegalViewer && (
                          <button
                            type="button"
                            onClick={async () => {
                              const sha256 = await calculateStringSHA256(`${editState.url}_${editState.fragmento}`);
                              onOpenLegalViewer({
                                id: `law-preview-${ws.id}`,
                                numeroNorma: editState.norma,
                                titulo: ws.titulo,
                                jerarquia: 'DECRETO',
                                jerarquiaOrden: 4,
                                articulosPuntuales: ['Verificación de Nombramiento / Gaceta Oficial'],
                                hallazgosVinculados: [],
                                url: editState.url,
                                ubicacionFuente: ws.ubicacionOrigen,
                                resumenAplicacion: editState.fragmento,
                                textoExtraido: editState.fragmento,
                                sha256,
                                fechaRegistro: new Date().toISOString(),
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            Leer en Visor
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveEntryToLibrary({
                              rowId: ws.id,
                              defaultNorma: editState.norma,
                              defaultTitulo: ws.titulo,
                              defaultUrl: editState.url,
                              defaultFragmento: editState.fragmento,
                              ubicacionFuente: ws.ubicacionOrigen,
                            })
                          }
                          disabled={savingId === ws.id}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ml-auto ${
                            saved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <BookOpen className="w-3 h-3" />
                          {saved ? 'Guardado en Biblioteca Legal' : 'Guardar Fuente en Biblioteca Legal'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
