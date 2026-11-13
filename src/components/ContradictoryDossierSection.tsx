import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Upload,
  Download,
  Plus,
  Layers,
  Eye,
  Loader2,
  X,
  FilePlus,
  Trash2,
  Globe,
  ShieldAlert,
} from 'lucide-react';
import { DirectorResponsibility, DossierSectionItem, EvidenceFile } from '../types/forensic';
import { parseDigitalFile } from '../utils/fileParser';
import { calculateStringSHA256 } from '../utils/crypto';

interface Props {
  actaLectura: DossierSectionItem;
  setActaLectura: React.Dispatch<React.SetStateAction<DossierSectionItem>>;
  recursos: DossierSectionItem[];
  setRecursos: React.Dispatch<React.SetStateAction<DossierSectionItem[]>>;
  informePreliminar: DossierSectionItem;
  setInformePreliminar: React.Dispatch<React.SetStateAction<DossierSectionItem>>;
  replicas: DossierSectionItem[];
  setReplicas: React.Dispatch<React.SetStateAction<DossierSectionItem[]>>;
  contraReplicas: DossierSectionItem[];
  setContraReplicas: React.Dispatch<React.SetStateAction<DossierSectionItem[]>>;
  directors: DirectorResponsibility[];
  nombreCaso: string;
  onLogAction: (accion: string, detalle: string) => void;
}

type FolderTab =
  | 'acta_lectura'
  | 'recursos'
  | 'informe_preliminar'
  | 'replicas'
  | 'contra_replicas'
  | 'carpetas_sistema';

type UploadFolderType = 'acta' | 'recurso' | 'informe' | 'replica' | 'contra_replica';

export const ContradictoryDossierSection: React.FC<Props> = ({
  actaLectura,
  setActaLectura,
  recursos,
  setRecursos,
  informePreliminar,
  setInformePreliminar,
  replicas,
  setReplicas,
  contraReplicas,
  setContraReplicas,
  directors,
  nombreCaso,
  onLogAction,
}) => {
  const [activeFolder, setActiveFolder] = useState<FolderTab>('acta_lectura');
  const [activeRecursoIndex, setActiveRecursoIndex] = useState(0);
  const [activeReplicaIndex, setActiveReplicaIndex] = useState(0);
  const [activeContraIndex, setActiveContraIndex] = useState(0);
  const [uploadingFolder, setUploadingFolder] = useState<string | null>(null);
  const [fetchingUrlKey, setFetchingUrlKey] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<EvidenceFile | null>(null);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folderType: UploadFolderType,
    index?: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFolder(folderType);
    try {
      const originLabel =
        folderType === 'acta'
          ? 'Acta de Lectura'
          : folderType === 'recurso'
          ? `Recurso #${(index ?? 0) + 1}`
          : folderType === 'informe'
          ? 'Informe Preliminar'
          : folderType === 'replica'
          ? `Réplica #${(index ?? 0) + 1}`
          : `Contra-Réplica #${(index ?? 0) + 1}`;

      const { evidenceFile } = await parseDigitalFile(file, originLabel);
      const sha256 = evidenceFile.sha256;

      if (folderType === 'acta') {
        setActaLectura((prev) => ({
          ...prev,
          sha256,
          fuenteOrigen: prev.fuenteOrigen || `Archivo Local (${file.name})`,
          archivos: [...prev.archivos, evidenceFile],
        }));
      } else if (folderType === 'recurso' && typeof index === 'number') {
        setRecursos((prev) => {
          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            sha256,
            fuenteOrigen: copy[index].fuenteOrigen || `Archivo Local (${file.name})`,
            archivos: [...copy[index].archivos, evidenceFile],
          };
          return copy;
        });
      } else if (folderType === 'informe') {
        setInformePreliminar((prev) => ({
          ...prev,
          sha256,
          fuenteOrigen: prev.fuenteOrigen || `Archivo Local (${file.name})`,
          archivos: [...prev.archivos, evidenceFile],
        }));
      } else if (folderType === 'replica' && typeof index === 'number') {
        setReplicas((prev) => {
          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            sha256,
            fuenteOrigen: copy[index].fuenteOrigen || `Archivo Local (${file.name})`,
            archivos: [...copy[index].archivos, evidenceFile],
          };
          return copy;
        });
      } else if (folderType === 'contra_replica' && typeof index === 'number') {
        setContraReplicas((prev) => {
          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            sha256,
            fuenteOrigen: copy[index].fuenteOrigen || `Archivo Local (${file.name})`,
            archivos: [...copy[index].archivos, evidenceFile],
          };
          return copy;
        });
      }

      onLogAction(
        'Carga de Documento en Dossier',
        `${originLabel} [${evidenceFile.parsedFormat || 'DIGITAL'}]: ${file.name} (SHA-256: ${sha256.substring(0, 10)}...)`
      );
    } finally {
      setUploadingFolder(null);
      e.target.value = '';
    }
  };

  const handleFetchUrlIntoSection = async (
    url: string | undefined,
    folderType: UploadFolderType,
    index?: number
  ) => {
    if (!url || !url.trim()) return;
    const key = `${folderType}-${index ?? 'single'}`;
    setFetchingUrlKey(key);
    try {
      const resp = await fetch('/api/forensic/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo leer el enlace.');
      }

      const ev: EvidenceFile = {
        name: data.fileName || url,
        size: data.size || 0,
        type: data.mimeType || 'text/html',
        sha256: data.sha256 || (await calculateStringSHA256(url + Date.now())),
        uploadDate: new Date().toISOString(),
        sourceType: 'URL_PORTAL',
        sourceUrl: data.url || url,
        contentSnippet: data.contentSnippet,
        extractedText: data.extractedText,
        parsedFormat: data.parsedFormat || 'PORTAL WEB',
      };

      const appendPatch = (item: DossierSectionItem): DossierSectionItem => ({
        ...item,
        sha256: ev.sha256,
        urlOrigen: ev.sourceUrl,
        fuenteOrigen: item.fuenteOrigen || `Portal Web (${ev.sourceUrl})`,
        archivos: [...item.archivos, ev],
        contenido: item.contenido
          ? `${item.contenido}\n\n--- [FUENTE WEB: ${ev.sourceUrl}] ---\n${(ev.extractedText || '').slice(0, 3500)}`
          : (ev.extractedText || '').slice(0, 4500),
      });

      if (folderType === 'acta') setActaLectura(appendPatch);
      else if (folderType === 'informe') setInformePreliminar(appendPatch);
      else if (folderType === 'recurso' && typeof index === 'number') {
        setRecursos((p) => p.map((it, i) => (i === index ? appendPatch(it) : it)));
      } else if (folderType === 'replica' && typeof index === 'number') {
        setReplicas((p) => p.map((it, i) => (i === index ? appendPatch(it) : it)));
      } else if (folderType === 'contra_replica' && typeof index === 'number') {
        setContraReplicas((p) => p.map((it, i) => (i === index ? appendPatch(it) : it)));
      }

      onLogAction('Extracción Web en Dossier', `Fuente web leída y sellada: ${ev.sourceUrl}`);
    } catch (err: any) {
      onLogAction('Error Lectura URL Dossier', err.message || 'Fallo al leer URL');
    } finally {
      setFetchingUrlKey(null);
    }
  };

  const appendExtractedToSection = (
    evidence: EvidenceFile,
    folderType: UploadFolderType,
    index?: number
  ) => {
    const textToAdd = (evidence.extractedText || evidence.contentSnippet || '').trim();
    if (!textToAdd) return;
    const block = `\n\n--- [EXTRACTO ${evidence.parsedFormat || 'DIGITAL'}: ${evidence.name}] ---\n${textToAdd.slice(0, 4000)}`;

    if (folderType === 'acta') {
      setActaLectura((prev) => ({ ...prev, contenido: (prev.contenido + block).trim() }));
    } else if (folderType === 'recurso' && typeof index === 'number') {
      setRecursos((prev) => prev.map((it, i) => (i === index ? { ...it, contenido: (it.contenido + block).trim() } : it)));
    } else if (folderType === 'informe') {
      setInformePreliminar((prev) => ({ ...prev, contenido: (prev.contenido + block).trim() }));
    } else if (folderType === 'replica' && typeof index === 'number') {
      setReplicas((prev) => prev.map((it, i) => (i === index ? { ...it, contenido: (it.contenido + block).trim() } : it)));
    } else if (folderType === 'contra_replica' && typeof index === 'number') {
      setContraReplicas((prev) => prev.map((it, i) => (i === index ? { ...it, contenido: (it.contenido + block).trim() } : it)));
    }
    onLogAction('Incorporación de Texto Extraído', `Se insertó contenido de ${evidence.name} al escrito.`);
  };

  const handleAddRecurso = () => {
    const num = recursos.length + 1;
    const newItem: DossierSectionItem = {
      id: `rec-${Date.now()}`,
      numero: num,
      tipoEscrito: 'RECURSO',
      titulo: `Recurso de Reconsideración No. ${num}`,
      contenido: '',
      fecha: new Date().toISOString().split('T')[0],
      periodoEtiqueta: '',
      directorId: directors[0]?.id || '',
      directorNombre: directors[0]?.nombre || '',
      fuenteOrigen: '',
      urlOrigen: '',
      sha256: '',
      archivos: [],
    };
    setRecursos([...recursos, newItem]);
    setActiveRecursoIndex(recursos.length);
    onLogAction('Creación de Recurso', `Se añadió Recurso de Reconsideración No. ${num}`);
  };

  const handleAddReplica = () => {
    const num = replicas.length + 1;
    const newItem: DossierSectionItem = {
      id: `rep-${Date.now()}`,
      numero: num,
      tipoEscrito: 'REPLICA',
      titulo: `Réplica / Descargo No. ${num}`,
      contenido: '',
      fecha: new Date().toISOString().split('T')[0],
      periodoEtiqueta: '',
      directorId: directors[0]?.id || '',
      directorNombre: directors[0]?.nombre || '',
      fuenteOrigen: '',
      urlOrigen: '',
      sha256: '',
      archivos: [],
    };
    setReplicas([...replicas, newItem]);
    setActiveReplicaIndex(replicas.length);
    onLogAction('Creación de Réplica', `Se añadió Réplica No. ${num}`);
  };

  const handleAddContraReplica = () => {
    const num = contraReplicas.length + 1;
    const newItem: DossierSectionItem = {
      id: `cre-${Date.now()}`,
      numero: num,
      tipoEscrito: 'CONTRA_REPLICA',
      titulo: `Contra-Réplica Técnica No. ${num}`,
      contenido: '',
      fecha: new Date().toISOString().split('T')[0],
      periodoEtiqueta: '',
      directorId: directors[0]?.id || '',
      directorNombre: directors[0]?.nombre || '',
      fuenteOrigen: '',
      urlOrigen: '',
      sha256: '',
      archivos: [],
    };
    setContraReplicas([...contraReplicas, newItem]);
    setActiveContraIndex(contraReplicas.length);
    onLogAction('Creación de Contra-Réplica', `Se añadió Contra-Réplica No. ${num}`);
  };

  const exportExpedienteManifest = () => {
    const manifest = {
      caso: nombreCaso,
      fechaExportacion: new Date().toISOString(),
      carpetasAutomatizadas: [
        '01_acta_lectura/',
        '02_recursos_reconsideracion/',
        '03_informe_preliminar/',
        '04_replicas_descargos/',
        '05_contra_replicas_multi_periodo/',
        '06_entradas_evidencias/',
        '07_salidas_dictamenes/',
        '08_trazabilidad_decretos_logs/',
      ],
      directoresSegregados: directors,
      actaLectura,
      recursosReconsideracion: recursos,
      informePreliminar,
      replicasDescargos: replicas,
      contraReplicas,
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manifiesto_Expediente_${nombreCaso || 'Forense'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onLogAction('Exportación de Expediente', 'Se descargó el manifiesto completo (incluyendo Contra-Réplicas y Directores).');
  };

  const renderFileAttachmentsList = (
    archivos: EvidenceFile[],
    folderType: UploadFolderType,
    index?: number
  ) => {
    if (archivos.length === 0) return null;
    return (
      <div className="space-y-1.5 pt-2">
        <div className="text-[11px] font-semibold text-slate-400">Archivos Vinculados ({archivos.length}):</div>
        {archivos.map((f, i) => (
          <div key={i} className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-200 truncate font-medium">{f.name}</span>
              <span className="text-emerald-400 font-mono text-[10px] shrink-0">
                {f.parsedFormat || 'DOC'} • {f.sha256.substring(0, 8)}...
              </span>
            </div>
            {(f.extractedText || f.contentSnippet) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewFile(f)}
                  className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" /> Ver en Pantalla
                </button>
                <button
                  type="button"
                  onClick={() => appendExtractedToSection(f, folderType, index)}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 cursor-pointer"
                >
                  <FilePlus className="w-3 h-3" /> Insertar Texto
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Shared Metadata Controls (Fecha, Período, Director, Fuente/Ubicación, URL)
  const renderDossierItemEditor = (
    item: DossierSectionItem,
    onChange: (patch: Partial<DossierSectionItem>) => void,
    folderType: UploadFolderType,
    accentClass: string,
    index?: number
  ) => {
    const urlKey = `${folderType}-${index ?? 'single'}`;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="md:col-span-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-400 block mb-1">Título del Escrito</label>
              <input
                type="text"
                value={item.titulo}
                onChange={(e) => onChange({ titulo: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Fecha Documento</label>
              <input
                type="date"
                value={item.fecha}
                onChange={(e) => onChange({ fecha: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Multi-period & Director Responsibility Tagging */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Período / Ejercicio Aplicable</label>
              <input
                type="text"
                value={item.periodoEtiqueta || ''}
                onChange={(e) => onChange({ periodoEtiqueta: e.target.value })}
                placeholder="Ej: Período 2020-2023"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-400 block mb-1">Director / Titular Responsable</label>
              <select
                value={item.directorId || ''}
                onChange={(e) => {
                  const selected = directors.find((d) => d.id === e.target.value);
                  onChange({
                    directorId: e.target.value,
                    directorNombre: selected ? `${selected.nombre} (${selected.numeroDecretoNombramiento || 'Sin decreto'})` : '',
                  });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="">-- Segregación Automática por Fecha o Sin Asignar --</option>
                {directors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre || 'Sin nombre'} — {d.numeroDecretoNombramiento || 'S/N'} ({d.fechaInicioGestion || '?'} a{' '}
                    {d.enFuncionesActuales ? 'Actualidad' : d.fechaFinGestion || '?'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Source & Origin Location Tracking */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-end">
            <div className="sm:col-span-5">
              <label className="text-[11px] text-slate-400 block mb-1">Ubicación / Fuente Documental de Origen</label>
              <input
                type="text"
                value={item.fuenteOrigen || ''}
                onChange={(e) => onChange({ fuenteOrigen: e.target.value })}
                placeholder="Ej: Expediente Físico Caja #4 / Gaceta / Portal"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="text-[11px] text-slate-400 block mb-1">Enlace URL de Origen (Opcional)</label>
              <input
                type="text"
                value={item.urlOrigen || ''}
                onChange={(e) => onChange({ urlOrigen: e.target.value })}
                placeholder="https://..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-sky-300 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={!item.urlOrigen?.trim() || fetchingUrlKey === urlKey}
                onClick={() => handleFetchUrlIntoSection(item.urlOrigen, folderType, index)}
                className="w-full py-2 px-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sky-300 border border-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
              >
                {fetchingUrlKey === urlKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                Leer URL
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-1">Contenido Literal / Alegatos / Argumentación</label>
            <textarea
              rows={6}
              value={item.contenido}
              onChange={(e) => onChange({ contenido: e.target.value })}
              placeholder="Redacte o inserte el texto extraído desde PDF/Word/Excel/Portal..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs text-slate-400 block">
            Carga Universal (PDF, Word, Excel, TXT o Imagen OCR)
          </label>
          <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-4 text-center space-y-2">
            {uploadingFolder === folderType ? (
              <Loader2 className="w-6 h-6 text-sky-400 mx-auto animate-spin" />
            ) : (
              <Upload className="w-6 h-6 text-slate-400 mx-auto" />
            )}
            <div className="text-[11px] text-slate-300">
              {uploadingFolder === folderType ? 'Extrayendo contenido...' : 'Adjuntar Soporte Digital'}
            </div>
            <input
              type="file"
              id={`upload-${folderType}-${index ?? 'single'}`}
              accept="*/*"
              onChange={(e) => handleFileUpload(e, folderType, index)}
              className="hidden"
            />
            <label
              htmlFor={`upload-${folderType}-${index ?? 'single'}`}
              className={`inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 ${accentClass} text-xs font-semibold rounded cursor-pointer border border-slate-700`}
            >
              Seleccionar Archivo
            </label>
          </div>

          {renderFileAttachmentsList(item.archivos, folderType, index)}
        </div>
      </div>
    );
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg">
            🗂️
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Dossier Contradictorio Multi-Período (Actas, Recursos, Réplicas y Contra-Réplicas)
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Fase Probatoria Integral
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Control ilimitado por período y director para Actas, Recursos, Preliminar, Réplicas y Contra-Réplicas con trazabilidad de fuente/origen.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={exportExpedienteManifest}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          Exportar Manifiesto (.json)
        </button>
      </div>

      {/* 6 Main Folders Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveFolder('acta_lectura')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'acta_lectura'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>1. Acta Lectura</span>
            <FolderOpen className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">{actaLectura.archivos.length} archivo(s)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFolder('recursos')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'recursos'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>2. Recursos</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">{recursos.length} escrito(s)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFolder('informe_preliminar')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'informe_preliminar'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>3. Preliminar</span>
            <FileText className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">{informePreliminar.archivos.length} archivo(s)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFolder('replicas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'replicas'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>4. Réplicas</span>
            <Folder className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">{replicas.length} réplica(s)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFolder('contra_replicas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'contra_replicas'
              ? 'bg-purple-950/60 border-purple-500 text-white shadow-md shadow-purple-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>5. Contra-Réplicas</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">{contraReplicas.length} contra-rép.</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFolder('carpetas_sistema')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'carpetas_sistema'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>6. Directorios</span>
            <Layers className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-1.5 block">8 carpetas ISO</span>
        </button>
      </div>

      {/* Tab 1: Acta de Lectura */}
      {activeFolder === 'acta_lectura' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              1. Acta de Lectura de Hallazgos y Apertura de Plazo Contradictorio
            </h3>
            <span className="text-xs text-slate-400 font-mono">Fecha: {actaLectura.fecha}</span>
          </div>
          {renderDossierItemEditor(
            actaLectura,
            (patch) => setActaLectura((prev) => ({ ...prev, ...patch })),
            'acta',
            'text-sky-400'
          )}
        </div>
      )}

      {/* Tab 2: Recursos de Reconsideración */}
      {activeFolder === 'recursos' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              2. Recursos de Reconsideración (Todos los que apliquen por Período)
            </h3>
            <button
              type="button"
              onClick={handleAddRecurso}
              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir Recurso
            </button>
          </div>

          {recursos.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
              Sin recursos cargados. Haga clic en "Añadir Recurso" para registrar Recursos 1, 2, 3 o Adiciones.
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
                {recursos.map((rec, idx) => (
                  <div key={rec.id} className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveRecursoIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        activeRecursoIndex === idx
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      Recurso #{rec.numero || idx + 1} {rec.periodoEtiqueta ? `(${rec.periodoEtiqueta})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRecursos((p) => p.filter((_, i) => i !== idx));
                        setActiveRecursoIndex(0);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                      title="Eliminar Recurso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {recursos[activeRecursoIndex] &&
                renderDossierItemEditor(
                  recursos[activeRecursoIndex],
                  (patch) =>
                    setRecursos((prev) =>
                      prev.map((it, i) => (i === activeRecursoIndex ? { ...it, ...patch } : it))
                    ),
                  'recurso',
                  'text-amber-400',
                  activeRecursoIndex
                )}
            </>
          )}
        </div>
      )}

      {/* Tab 3: Informe Preliminar */}
      {activeFolder === 'informe_preliminar' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-400" />
              3. Informe Preliminar de Auditoría (Pliego Formal de Observaciones)
            </h3>
            <span className="text-xs text-slate-400 font-mono">Fecha: {informePreliminar.fecha}</span>
          </div>
          {renderDossierItemEditor(
            informePreliminar,
            (patch) => setInformePreliminar((prev) => ({ ...prev, ...patch })),
            'informe',
            'text-red-400'
          )}
        </div>
      )}

      {/* Tab 4: Réplicas */}
      {activeFolder === 'replicas' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-emerald-400" />
              4. Réplicas y Descargos por Período / Titular ({replicas.length})
            </h3>
            <button
              type="button"
              onClick={handleAddReplica}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir Réplica
            </button>
          </div>

          {replicas.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
              Sin réplicas cargadas. Añada todas las réplicas aplicables por período y director.
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
                {replicas.map((rep, idx) => (
                  <div key={rep.id} className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveReplicaIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        activeReplicaIndex === idx
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      Réplica #{rep.numero || idx + 1} {rep.periodoEtiqueta ? `(${rep.periodoEtiqueta})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplicas((p) => p.filter((_, i) => i !== idx));
                        setActiveReplicaIndex(0);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                      title="Eliminar Réplica"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {replicas[activeReplicaIndex] &&
                renderDossierItemEditor(
                  replicas[activeReplicaIndex],
                  (patch) =>
                    setReplicas((prev) =>
                      prev.map((it, i) => (i === activeReplicaIndex ? { ...it, ...patch } : it))
                    ),
                  'replica',
                  'text-emerald-400',
                  activeReplicaIndex
                )}
            </>
          )}
        </div>
      )}

      {/* Tab 5: Contra-Réplicas Multi-Período / Multi-Director */}
      {activeFolder === 'contra_replicas' && (
        <div className="space-y-4 bg-slate-950/70 border border-purple-900/40 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                5. Control y Carga de Contra-Réplicas (Multi-Período / Multi-Director)
              </h3>
              <p className="text-[11px] text-slate-400">
                Registra todas las contra-réplicas aplicables para cada período de gestión y director titular, vinculando su fuente y URL de origen.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddContraReplica}
              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir Contra-Réplica
            </button>
          </div>

          {contraReplicas.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
              No hay contra-réplicas registradas todavía. Haga clic en "Añadir Contra-Réplica" para cargar cada escrito por período y director.
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
                {contraReplicas.map((cr, idx) => (
                  <div key={cr.id} className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveContraIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        activeContraIndex === idx
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      Contra-Rép #{cr.numero || idx + 1} {cr.periodoEtiqueta ? `(${cr.periodoEtiqueta})` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContraReplicas((p) => p.filter((_, i) => i !== idx));
                        setActiveContraIndex(0);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                      title="Eliminar Contra-Réplica"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {contraReplicas[activeContraIndex] &&
                renderDossierItemEditor(
                  contraReplicas[activeContraIndex],
                  (patch) =>
                    setContraReplicas((prev) =>
                      prev.map((it, i) => (i === activeContraIndex ? { ...it, ...patch } : it))
                    ),
                  'contra_replica',
                  'text-purple-400',
                  activeContraIndex
                )}
            </>
          )}
        </div>
      )}

      {/* Tab 6: Estructura Automática de Carpetas */}
      {activeFolder === 'carpetas_sistema' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" />
              6. Estructura Automatizada de 8 Carpetas Periciales (ISO/IEC 27037)
            </h3>
            <span className="text-xs font-mono text-teal-300">
              caso_{(nombreCaso || 'forense').toLowerCase().replace(/\s+/g, '_')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {[
              { code: '01', name: '01_acta_lectura/', desc: 'Acta de apertura y notificación', tipo: 'ENTRADA', color: 'text-sky-400' },
              { code: '02', name: '02_recursos_reconsideracion/', desc: 'Recursos 1, 2, 3 y adiciones', tipo: 'ENTRADA', color: 'text-amber-400' },
              { code: '03', name: '03_informe_preliminar/', desc: 'Pliego de observaciones notificadas', tipo: 'ENTRADA', color: 'text-red-400' },
              { code: '04', name: '04_replicas_descargos/', desc: 'Escritos de réplica por período', tipo: 'ENTRADA', color: 'text-emerald-400' },
              { code: '05', name: '05_contra_replicas/', desc: 'Contra-réplicas multi-período/director', tipo: 'ENTRADA', color: 'text-purple-400' },
              { code: '06', name: '06_entradas_evidencias/', desc: 'PDF, Excel, Word, portales y pagos', tipo: 'ENTRADA', color: 'text-blue-400' },
              { code: '07', name: '07_salidas_dictamenes/', desc: 'Revisión previa y dictamen final .doc', tipo: 'SALIDA', color: 'text-pink-400' },
              { code: '08', name: '08_decretos_y_logs/', desc: 'Decretos online, fuentes y SHA-256', tipo: 'AUDIT', color: 'text-teal-400' },
            ].map((dir) => (
              <div key={dir.code} className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-start gap-2.5">
                <Folder className={`w-5 h-5 shrink-0 mt-0.5 ${dir.color}`} />
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-white">{dir.name}</span>
                    <span className="text-[9px] font-mono px-1.5 rounded bg-slate-800 text-slate-400">{dir.tipo}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{dir.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  Lectura en Pantalla: {previewFile.name}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Formato: {previewFile.parsedFormat || 'DIGITAL'} • SHA-256: {previewFile.sha256}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60">
              <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {previewFile.extractedText || previewFile.contentSnippet || 'Sin contenido textual extraído.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
