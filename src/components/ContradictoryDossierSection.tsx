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
} from 'lucide-react';
import { DossierSectionItem, EvidenceFile } from '../types/forensic';
import { parseDigitalFile } from '../utils/fileParser';

interface Props {
  actaLectura: DossierSectionItem;
  setActaLectura: React.Dispatch<React.SetStateAction<DossierSectionItem>>;
  recursos: DossierSectionItem[];
  setRecursos: React.Dispatch<React.SetStateAction<DossierSectionItem[]>>;
  informePreliminar: DossierSectionItem;
  setInformePreliminar: React.Dispatch<React.SetStateAction<DossierSectionItem>>;
  replicas: DossierSectionItem[];
  setReplicas: React.Dispatch<React.SetStateAction<DossierSectionItem[]>>;
  nombreCaso: string;
  onLogAction: (accion: string, detalle: string) => void;
}

export const ContradictoryDossierSection: React.FC<Props> = ({
  actaLectura,
  setActaLectura,
  recursos,
  setRecursos,
  informePreliminar,
  setInformePreliminar,
  replicas,
  setReplicas,
  nombreCaso,
  onLogAction,
}) => {
  const [activeFolder, setActiveFolder] = useState<
    'acta_lectura' | 'recursos' | 'informe_preliminar' | 'replicas' | 'carpetas_sistema'
  >('acta_lectura');

  const [activeRecursoIndex, setActiveRecursoIndex] = useState(0);
  const [activeReplicaIndex, setActiveReplicaIndex] = useState(0);
  const [uploadingFolder, setUploadingFolder] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<EvidenceFile | null>(null);

  // Universal File Upload Handler (PDF, Excel, Word, TXT, Images OCR, Any Digital Format)
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    folderType: 'acta' | 'recurso' | 'informe' | 'replica',
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
          : `Réplica #${(index ?? 0) + 1}`;

      const { evidenceFile } = await parseDigitalFile(file, originLabel);
      const sha256 = evidenceFile.sha256;

      if (folderType === 'acta') {
        setActaLectura((prev) => ({
          ...prev,
          sha256,
          archivos: [...prev.archivos, evidenceFile],
        }));
        onLogAction(
          'Carga de Documento',
          `Acta de Lectura [${evidenceFile.parsedFormat || 'DIGITAL'}]: ${file.name} (SHA-256: ${sha256.substring(0, 10)}...)`
        );
      } else if (folderType === 'recurso' && typeof index === 'number') {
        setRecursos((prev) => {
          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            sha256,
            archivos: [...copy[index].archivos, evidenceFile],
          };
          return copy;
        });
        onLogAction(
          'Carga de Documento',
          `Recurso de Reconsideración #${index + 1} [${evidenceFile.parsedFormat || 'DIGITAL'}]: ${file.name}`
        );
      } else if (folderType === 'informe') {
        setInformePreliminar((prev) => ({
          ...prev,
          sha256,
          archivos: [...prev.archivos, evidenceFile],
        }));
        onLogAction(
          'Carga de Documento',
          `Informe Preliminar [${evidenceFile.parsedFormat || 'DIGITAL'}]: ${file.name}`
        );
      } else if (folderType === 'replica' && typeof index === 'number') {
        setReplicas((prev) => {
          const copy = [...prev];
          copy[index] = {
            ...copy[index],
            sha256,
            archivos: [...copy[index].archivos, evidenceFile],
          };
          return copy;
        });
        onLogAction(
          'Carga de Documento',
          `Réplica / Descargo #${index + 1} [${evidenceFile.parsedFormat || 'DIGITAL'}]: ${file.name}`
        );
      }
    } finally {
      setUploadingFolder(null);
      e.target.value = '';
    }
  };

  const appendExtractedToSection = (
    evidence: EvidenceFile,
    folderType: 'acta' | 'recurso' | 'informe' | 'replica',
    index?: number
  ) => {
    const textToAdd = (evidence.extractedText || evidence.contentSnippet || '').trim();
    if (!textToAdd) return;
    const block = `\n\n--- [EXTRACTO ${evidence.parsedFormat || 'DIGITAL'}: ${evidence.name}] ---\n${textToAdd.slice(0, 4000)}`;

    if (folderType === 'acta') {
      setActaLectura((prev) => ({ ...prev, contenido: (prev.contenido + block).trim() }));
    } else if (folderType === 'recurso' && typeof index === 'number') {
      setRecursos((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], contenido: (copy[index].contenido + block).trim() };
        return copy;
      });
    } else if (folderType === 'informe') {
      setInformePreliminar((prev) => ({ ...prev, contenido: (prev.contenido + block).trim() }));
    } else if (folderType === 'replica' && typeof index === 'number') {
      setReplicas((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], contenido: (copy[index].contenido + block).trim() };
        return copy;
      });
    }
    onLogAction('Incorporación de Texto Extraído', `Se insertó contenido de ${evidence.name} al expediente.`);
  };

  const handleAddRecurso = () => {
    const num = recursos.length + 1;
    const newItem: DossierSectionItem = {
      id: `rec-${Date.now()}`,
      numero: num,
      titulo: `Recurso de Reconsideración No. ${num} (Escrito de Descargo)`,
      contenido: `Alegato y pruebas correspondientes al Recurso No. ${num}.`,
      fecha: new Date().toISOString().split('T')[0],
      sha256: 'calc_sha256...',
      archivos: [],
    };
    setRecursos([...recursos, newItem]);
    setActiveRecursoIndex(recursos.length);
    onLogAction('Creación de Carpeta', `Se añadió el Recurso de Reconsideración No. ${num}`);
  };

  const handleAddReplica = () => {
    const num = replicas.length + 1;
    const newItem: DossierSectionItem = {
      id: `rep-${Date.now()}`,
      numero: num,
      titulo: `Réplica / Descargo No. ${num} (Contra-alegatos)`,
      contenido: `Escrito de réplica formal o adiciones sobre el informe preliminar.`,
      fecha: new Date().toISOString().split('T')[0],
      sha256: 'calc_sha256...',
      archivos: [],
    };
    setReplicas([...replicas, newItem]);
    setActiveReplicaIndex(replicas.length);
    onLogAction('Creación de Carpeta', `Se añadió la Réplica No. ${num}`);
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
        '05_entradas_evidencias/',
        '06_salidas_dictamenes/',
        '07_trazabilidad_logs/',
      ],
      actaLectura,
      recursosReconsideracion: recursos,
      informePreliminar,
      replicasDescargos: replicas,
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manifiesto_Expediente_${nombreCaso}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onLogAction('Exportación de Expediente', 'Se descargó el manifiesto estructurado de carpetas de entrada y salida.');
  };

  const renderFileAttachmentsList = (
    archivos: EvidenceFile[],
    folderType: 'acta' | 'recurso' | 'informe' | 'replica',
    index?: number
  ) => {
    if (archivos.length === 0) return null;
    return (
      <div className="space-y-1.5 pt-2">
        <div className="text-[11px] font-semibold text-slate-400">Archivos Vinculados ({archivos.length}):</div>
        {archivos.map((f, i) => (
          <div
            key={i}
            className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px] space-y-1.5"
          >
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
                  <Eye className="w-3 h-3" />
                  Ver en Pantalla
                </button>
                <button
                  type="button"
                  onClick={() => appendExtractedToSection(f, folderType, index)}
                  className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 cursor-pointer"
                >
                  <FilePlus className="w-3 h-3" />
                  Insertar Texto al Escrito
                </button>
              </div>
            )}
          </div>
        ))}
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
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Dossier Contradictorio y Gestión de Expediente
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Fase Probatoria
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Actas de lectura, pliego preliminar, recursos (1, 2, 3), réplicas y lectura universal (PDF, Word, Excel, TXT)
            </p>
          </div>
        </div>

        <button
          onClick={exportExpedienteManifest}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          Exportar Estructura de Carpetas (.json)
        </button>
      </div>

      {/* 5 Main Folders Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveFolder('acta_lectura')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'acta_lectura'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>1. Acta de Lectura</span>
            <FolderOpen className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            {actaLectura.archivos.length} archivo(s)
          </span>
        </button>

        <button
          onClick={() => setActiveFolder('recursos')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'recursos'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>2. Recursos (1,2,3)</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            {recursos.length} escrito(s)
          </span>
        </button>

        <button
          onClick={() => setActiveFolder('informe_preliminar')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'informe_preliminar'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>3. Informe Preliminar</span>
            <FileText className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            Pliego de cargos
          </span>
        </button>

        <button
          onClick={() => setActiveFolder('replicas')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            activeFolder === 'replicas'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>4. Réplicas / Descargos</span>
            <Folder className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            {replicas.length} réplica(s)
          </span>
        </button>

        <button
          onClick={() => setActiveFolder('carpetas_sistema')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between col-span-2 sm:col-span-1 ${
            activeFolder === 'carpetas_sistema'
              ? 'bg-sky-950/60 border-sky-500 text-white shadow-md shadow-sky-950/40'
              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>5. Carpetas Entrada/Salida</span>
            <FolderTree className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-[11px] text-slate-500 mt-2 block">
            7 directorios
          </span>
        </button>
      </div>

      {/* Tab 1: Acta de Lectura */}
      {activeFolder === 'acta_lectura' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              1. Acta de Lectura de Hallazgos y Apertura de Plazo Contradictorio
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Fecha de Notificación: {actaLectura.fecha}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Título del Acta</label>
                <input
                  type="text"
                  value={actaLectura.titulo}
                  onChange={(e) => setActaLectura((prev) => ({ ...prev, titulo: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Contenido / Constancia del Acta de Lectura
                </label>
                <textarea
                  rows={5}
                  value={actaLectura.contenido}
                  onChange={(e) => setActaLectura((prev) => ({ ...prev, contenido: e.target.value }))}
                  placeholder="Detalle la reunión formal de lectura, representantes de la entidad auditada presentes y concesión de plazo para reconsideración..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-400 block">
                Carga de Acta (PDF, Word, Excel, TXT o Imagen)
              </label>
              <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-4 text-center space-y-2">
                {uploadingFolder === 'acta' ? (
                  <Loader2 className="w-6 h-6 text-sky-400 mx-auto animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                )}
                <div className="text-[11px] text-slate-300">
                  {uploadingFolder === 'acta' ? 'Extrayendo contenido...' : 'Adjuntar Acta Digital'}
                </div>
                <input
                  type="file"
                  id="upload-acta"
                  accept="*/*"
                  onChange={(e) => handleFileUpload(e, 'acta')}
                  className="hidden"
                />
                <label
                  htmlFor="upload-acta"
                  className="inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold rounded cursor-pointer border border-slate-700"
                >
                  Seleccionar Archivo
                </label>
              </div>

              {renderFileAttachmentsList(actaLectura.archivos, 'acta')}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Recursos de Reconsideración 1, 2, 3 */}
      {activeFolder === 'recursos' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                2. Recursos de Reconsideración (1, 2, 3 y Adiciones de Prueba)
              </h3>
            </div>

            <button
              onClick={handleAddRecurso}
              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Recurso / Adición
            </button>
          </div>

          {/* Sub-tabs for Recursos */}
          <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
            {recursos.map((rec, idx) => (
              <button
                key={rec.id}
                onClick={() => setActiveRecursoIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeRecursoIndex === idx
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Recurso #{rec.numero || idx + 1}
              </button>
            ))}
          </div>

          {/* Selected Recurso Form */}
          {recursos[activeRecursoIndex] && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Título del Recurso</label>
                  <input
                    type="text"
                    value={recursos[activeRecursoIndex].titulo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRecursos((prev) => {
                        const copy = [...prev];
                        copy[activeRecursoIndex] = { ...copy[activeRecursoIndex], titulo: val };
                        return copy;
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Alegatos y Argumentos de Descargo de la Entidad
                  </label>
                  <textarea
                    rows={6}
                    value={recursos[activeRecursoIndex].contenido}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRecursos((prev) => {
                        const copy = [...prev];
                        copy[activeRecursoIndex] = { ...copy[activeRecursoIndex], contenido: val };
                        return copy;
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs text-slate-400 block">
                  Anexos del Recurso #{activeRecursoIndex + 1} (PDF/Excel/Word/TXT)
                </label>
                <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-4 text-center space-y-2">
                  {uploadingFolder === 'recurso' ? (
                    <Loader2 className="w-6 h-6 text-amber-400 mx-auto animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                  )}
                  <div className="text-[11px] text-slate-300">
                    {uploadingFolder === 'recurso' ? 'Extrayendo pruebas...' : 'Cargar Pruebas Anexas'}
                  </div>
                  <input
                    type="file"
                    id={`upload-rec-${activeRecursoIndex}`}
                    accept="*/*"
                    onChange={(e) => handleFileUpload(e, 'recurso', activeRecursoIndex)}
                    className="hidden"
                  />
                  <label
                    htmlFor={`upload-rec-${activeRecursoIndex}`}
                    className="inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded cursor-pointer border border-slate-700"
                  >
                    Adjuntar Prueba Digital
                  </label>
                </div>

                {renderFileAttachmentsList(recursos[activeRecursoIndex].archivos, 'recurso', activeRecursoIndex)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Informe Preliminar */}
      {activeFolder === 'informe_preliminar' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-400" />
              3. Informe Preliminar de Auditoría (Observaciones Formales Notificadas)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Fecha: {informePreliminar.fecha}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Título del Informe Preliminar</label>
                <input
                  type="text"
                  value={informePreliminar.titulo}
                  onChange={(e) => setInformePreliminar((prev) => ({ ...prev, titulo: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Texto del Informe Preliminar y Hallazgos Base
                </label>
                <textarea
                  rows={6}
                  value={informePreliminar.contenido}
                  onChange={(e) => setInformePreliminar((prev) => ({ ...prev, contenido: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-slate-400 block">
                Carga del Informe Preliminar (PDF/DOCX/TXT/Excel)
              </label>
              <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-4 text-center space-y-2">
                {uploadingFolder === 'informe' ? (
                  <Loader2 className="w-6 h-6 text-red-400 mx-auto animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                )}
                <div className="text-[11px] text-slate-300">
                  {uploadingFolder === 'informe' ? 'Extrayendo informe...' : 'Informe Firmado (Cualquier Formato)'}
                </div>
                <input
                  type="file"
                  id="upload-informe"
                  accept="*/*"
                  onChange={(e) => handleFileUpload(e, 'informe')}
                  className="hidden"
                />
                <label
                  htmlFor="upload-informe"
                  className="inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 text-xs font-semibold rounded cursor-pointer border border-slate-700"
                >
                  Subir Documento
                </label>
              </div>

              {renderFileAttachmentsList(informePreliminar.archivos, 'informe')}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Réplicas y Descargos 1, 2, 3 */}
      {activeFolder === 'replicas' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Folder className="w-4 h-4 text-emerald-400" />
              4. Réplicas, Contra-Alegatos y Nuevas Pruebas Sobrevenidas
            </h3>

            <button
              onClick={handleAddReplica}
              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Réplica / Escrito
            </button>
          </div>

          {/* Sub-tabs for Replicas */}
          <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">
            {replicas.map((rep, idx) => (
              <button
                key={rep.id}
                onClick={() => setActiveReplicaIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeReplicaIndex === idx
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                Réplica #{rep.numero || idx + 1}
              </button>
            ))}
          </div>

          {replicas[activeReplicaIndex] && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Título de la Réplica</label>
                  <input
                    type="text"
                    value={replicas[activeReplicaIndex].titulo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReplicas((prev) => {
                        const copy = [...prev];
                        copy[activeReplicaIndex] = { ...copy[activeReplicaIndex], titulo: val };
                        return copy;
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Contenido del Escrito de Réplica
                  </label>
                  <textarea
                    rows={6}
                    value={replicas[activeReplicaIndex].contenido}
                    onChange={(e) => {
                      const val = e.target.value;
                      setReplicas((prev) => {
                        const copy = [...prev];
                        copy[activeReplicaIndex] = { ...copy[activeReplicaIndex], contenido: val };
                        return copy;
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 leading-relaxed font-sans"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs text-slate-400 block">
                  Carga de Pruebas Sobrevenidas (PDF/Word/Excel/TXT)
                </label>
                <div className="border border-dashed border-slate-700 bg-slate-900/50 rounded-xl p-4 text-center space-y-2">
                  {uploadingFolder === 'replica' ? (
                    <Loader2 className="w-6 h-6 text-emerald-400 mx-auto animate-spin" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-400 mx-auto" />
                  )}
                  <div className="text-[11px] text-slate-300">
                    {uploadingFolder === 'replica' ? 'Extrayendo archivo...' : 'Cargar Pruebas de Réplica'}
                  </div>
                  <input
                    type="file"
                    id={`upload-rep-${activeReplicaIndex}`}
                    accept="*/*"
                    onChange={(e) => handleFileUpload(e, 'replica', activeReplicaIndex)}
                    className="hidden"
                  />
                  <label
                    htmlFor={`upload-rep-${activeReplicaIndex}`}
                    className="inline-block px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold rounded cursor-pointer border border-slate-700"
                  >
                    Adjuntar Archivo
                  </label>
                </div>

                {renderFileAttachmentsList(replicas[activeReplicaIndex].archivos, 'replica', activeReplicaIndex)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Estructura Automática de Carpetas de Entrada y Salida */}
      {activeFolder === 'carpetas_sistema' && (
        <div className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-purple-400" />
              5. Estructura Automatizada de Carpetas de Entrada y Salida (ISO/IEC 27037)
            </h3>
            <span className="text-xs font-mono text-purple-300">
              caso_{nombreCaso.toLowerCase().replace(/\s+/g, '_')}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            El sistema genera, custodia y sella automáticamente las 7 carpetas periciales estandarizadas para preservar la inalterabilidad de los expedientes:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {[
              {
                code: '01',
                name: 'acta_lectura/',
                desc: 'Actas de apertura y notificación foliadas',
                tipo: 'ENTRADA',
                color: 'text-sky-400',
              },
              {
                code: '02',
                name: 'recursos_reconsideracion/',
                desc: 'Recursos 1, 2 y 3 interpuestos con anexos',
                tipo: 'ENTRADA',
                color: 'text-amber-400',
              },
              {
                code: '03',
                name: 'informe_preliminar/',
                desc: 'Pliego de observaciones y cargos notificados',
                tipo: 'ENTRADA',
                color: 'text-red-400',
              },
              {
                code: '04',
                name: 'replicas_descargos/',
                desc: 'Escritos de réplica, descargos y alegatos',
                tipo: 'ENTRADA',
                color: 'text-emerald-400',
              },
              {
                code: '05',
                name: 'entradas_evidencias/',
                desc: 'PDF, Excel, Word, TXT, libros mayores y contratos',
                tipo: 'ENTRADA',
                color: 'text-blue-400',
              },
              {
                code: '06',
                name: 'salidas_dictamenes/',
                desc: 'Informes técnicos definitivos (.doc/.docx/.pdf)',
                tipo: 'SALIDA',
                color: 'text-purple-400',
              },
              {
                code: '07',
                name: 'trazabilidad_logs/',
                desc: 'Cadena de custodia inmutable y hashes SHA-256',
                tipo: 'AUDIT',
                color: 'text-teal-400',
              },
            ].map((dir) => (
              <div
                key={dir.code}
                className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-start gap-2.5"
              >
                <Folder className={`w-5 h-5 shrink-0 mt-0.5 ${dir.color}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{dir.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {dir.tipo}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{dir.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On-screen preview modal for attached digital files */}
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

function FolderTree(props: any) {
  return <Layers {...props} />;
}
