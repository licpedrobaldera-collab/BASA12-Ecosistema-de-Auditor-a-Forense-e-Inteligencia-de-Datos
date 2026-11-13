import React, { useState } from 'react';
import {
  Upload,
  FileCheck,
  Shield,
  AlertCircle,
  Database,
  Search,
  CheckCircle2,
  FileText,
  Eye,
  X,
  Loader2,
  FileSpreadsheet,
  Globe,
  ClipboardType,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import {
  ContractEvidenceRow,
  EvidenceFile,
  PaymentCycleRow,
  ObservacionDecision,
} from '../types/forensic';
import {
  parseDigitalFile,
  fetchAndParseUrl,
  createEvidenceFromRawText,
} from '../utils/fileParser';
import { formatCurrency } from '../utils/entities';

export interface StructuredExtractionPayload {
  entidadDetectada?: {
    nombre?: string;
    rncNif?: string;
    alcanceResumen?: string;
  };
  contratosDetectados: ContractEvidenceRow[];
  cicloPagosDetectado: PaymentCycleRow[];
  observacionesDetectadas: ObservacionDecision[];
}

interface Props {
  nombreCaso: string;
  setNombreCaso: (val: string) => void;
  origenesSeleccionados: string[];
  setOrigenesSeleccionados: (val: string[]) => void;
  evidenceFile: EvidenceFile | null;
  setEvidenceFile: (file: EvidenceFile | null) => void;
  contractRows: ContractEvidenceRow[];
  setContractRows: React.Dispatch<React.SetStateAction<ContractEvidenceRow[]>>;
  anonimizar: boolean;
  setAnonimizar: (val: boolean) => void;
  adendaThresholdPct?: number;
  simboloMoneda?: string;
  entityName?: string;
  entityUrlPortal?: string;
  paisNormativa?: string;
  onFileParsed?: (file: EvidenceFile, detectedCount: number, paymentsCount: number) => void;
  onStructuredExtracted?: (payload: StructuredExtractionPayload) => void;
  onLogAction?: (accion: string, detalle: string) => void;
}

const AVAILABLE_SOURCES = [
  'Contabilidad Central (SAP / ERP)',
  'Bancos y Tesorería (Libramientos / Transferencias)',
  'Portal de Compras y Contrataciones Públicas',
  'Nóminas y Recursos Humanos',
  'Comprobantes Fiscales (NCF / e-CF)',
];

export const EvidenceSection: React.FC<Props> = ({
  nombreCaso,
  setNombreCaso,
  origenesSeleccionados,
  setOrigenesSeleccionados,
  evidenceFile,
  setEvidenceFile,
  contractRows,
  setContractRows,
  anonimizar,
  setAnonimizar,
  adendaThresholdPct = 50,
  simboloMoneda = 'RD$',
  entityName = '',
  entityUrlPortal = '',
  paisNormativa = 'República Dominicana',
  onFileParsed,
  onStructuredExtracted,
  onLogAction,
}) => {
  const [sourceTab, setSourceTab] = useState<'archivo' | 'url' | 'texto'>('archivo');
  const [urlInput, setUrlInput] = useState(entityUrlPortal || '');
  const [rawTextTitle, setRawTextTitle] = useState('Documento Literal / Oficio');
  const [rawTextBody, setRawTextBody] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnomalos, setFilterAnomalos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [parseStatusMsg, setParseStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFullTextModal, setShowFullTextModal] = useState(false);
  const [editingExtractedText, setEditingExtractedText] = useState(false);

  const toggleSource = (source: string) => {
    if (origenesSeleccionados.includes(source)) {
      if (origenesSeleccionados.length > 1) {
        setOrigenesSeleccionados(origenesSeleccionados.filter((s) => s !== source));
      }
    } else {
      setOrigenesSeleccionados([...origenesSeleccionados, source]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const processFile = async (file: File) => {
    setIsParsing(true);
    setErrorMsg(null);
    setParseStatusMsg(`Leyendo y extrayendo contenido literal de "${file.name}"...`);

    try {
      const originLabel = origenesSeleccionados[0] || 'Evidencia Digital';
      const parsed = await parseDigitalFile(file, originLabel, adendaThresholdPct);
      setEvidenceFile(parsed.evidenceFile);

      if (parsed.detectedContracts.length > 0) {
        setContractRows(parsed.detectedContracts);
        setParseStatusMsg(
          `Formato ${parsed.evidenceFile.parsedFormat} leído: ${parsed.detectedContracts.length} contratos y ${parsed.detectedPayments.length} pagos detectados.`
        );
      } else {
        setParseStatusMsg(
          `Formato ${parsed.evidenceFile.parsedFormat} extraído literalmente (${(parsed.evidenceFile.extractedText || '').length.toLocaleString('es-DO')} caracteres). Puedes pulsar "Extraer Datos Reales con IA".`
        );
      }

      if (onFileParsed) {
        onFileParsed(parsed.evidenceFile, parsed.detectedContracts.length, parsed.detectedPayments.length);
      }
      if (parsed.detectedPayments.length > 0 && onStructuredExtracted) {
        onStructuredExtracted({
          contratosDetectados: [],
          cicloPagosDetectado: parsed.detectedPayments,
          observacionesDetectadas: [],
        });
      }
    } catch (err: any) {
      setErrorMsg(`Error leyendo archivo: ${err.message}`);
      setParseStatusMsg(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFetchUrl = async (targetUrl?: string) => {
    const cleanUrl = (targetUrl || urlInput).trim();
    if (!cleanUrl) {
      setErrorMsg('Ingrese una URL o enlace público válido para extraer información.');
      return;
    }
    setUrlInput(cleanUrl);
    setIsParsing(true);
    setErrorMsg(null);
    setParseStatusMsg(`Conectando y extrayendo contenido textual desde ${cleanUrl}...`);
    try {
      const parsed = await fetchAndParseUrl(cleanUrl, adendaThresholdPct);
      setEvidenceFile(parsed.evidenceFile);
      if (parsed.detectedContracts.length > 0) {
        setContractRows(parsed.detectedContracts);
      }
      setParseStatusMsg(
        `Enlace extraído (${parsed.evidenceFile.parsedFormat}): ${(parsed.evidenceFile.extractedText || '').length.toLocaleString('es-DO')} caracteres y ${(parsed.evidenceFile.discoveredLinks || []).length} sub-enlaces encontrados.`
      );
      if (onFileParsed) {
        onFileParsed(parsed.evidenceFile, parsed.detectedContracts.length, parsed.detectedPayments.length);
      }
      if (parsed.detectedPayments.length > 0 && onStructuredExtracted) {
        onStructuredExtracted({
          contratosDetectados: [],
          cicloPagosDetectado: parsed.detectedPayments,
          observacionesDetectadas: [],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo extraer contenido del enlace.');
      setParseStatusMsg(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleProcessRawText = async () => {
    if (!rawTextBody.trim()) {
      setErrorMsg('Pegue o escriba texto real del documento u oficio para procesarlo.');
      return;
    }
    setIsParsing(true);
    setErrorMsg(null);
    try {
      const ev = await createEvidenceFromRawText(rawTextBody.trim(), rawTextTitle.trim() || 'Texto Literal');
      setEvidenceFile(ev);
      setParseStatusMsg(
        `Texto literal registrado (${rawTextBody.trim().length.toLocaleString('es-DO')} caracteres) con sello SHA-256.`
      );
      if (onFileParsed) {
        onFileParsed(ev, 0, 0);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExtractStructuredWithAI = async () => {
    const raw = (evidenceFile?.extractedText || evidenceFile?.contentSnippet || '').trim();
    if (!raw) {
      setErrorMsg('Primero cargue un archivo, extraiga un enlace o ingrese texto literal para analizar.');
      return;
    }

    setIsExtractingAI(true);
    setErrorMsg(null);
    setParseStatusMsg('Extrayendo entidades, contratos, ciclo de pagos y hallazgos reales con IA...');
    try {
      const resp = await fetch('/api/forensic/extract-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: raw,
          entityName,
          paisNormativa,
          adendaThresholdPct,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error extrayendo datos estructurados con IA.');
      }

      const contracts: ContractEvidenceRow[] = data.contratosDetectados || [];
      const payments: PaymentCycleRow[] = data.cicloPagosDetectado || [];
      const obsRaw: any[] = data.observacionesDetectadas || [];
      const observaciones: ObservacionDecision[] = obsRaw.map((o, idx) => ({
        id: `OBS-EXT-${Date.now()}-${idx}`,
        codigoObservacion: o.codigoObservacion || `OBS-${String(idx + 1).padStart(2, '0')}`,
        titulo: o.titulo || 'Hallazgo detectado en documento',
        descripcionPreliminar: o.descripcionPreliminar || '',
        descargoAlegato: o.descargoAlegato || '',
        decision: 'SE_MANTIENE',
        criterioEvaluacion: 'Extraído textualmente del documento fuente para evaluación.',
        procedimientoUtilizado: 'Extracción pericial literal verificada.',
        fundamentacionLegal: paisNormativa,
        normativaPais: paisNormativa,
        severidad: o.severidad || 'ALTA',
        montoInvolucrado: Number(o.montoInvolucrado) || 0,
      }));

      if (contracts.length > 0) {
        setContractRows((prev) => [...prev, ...contracts]);
      }

      if (onStructuredExtracted) {
        onStructuredExtracted({
          entidadDetectada: data.entidadDetectada,
          contratosDetectados: contracts,
          cicloPagosDetectado: payments,
          observacionesDetectadas: observaciones,
        });
      }

      setParseStatusMsg(
        `IA extrajo de datos reales (${data.modelUsed}): ${contracts.length} contrato(s), ${payments.length} registro(s) de ciclo de pagos y ${observaciones.length} hallazgo(s).`
      );
      if (onLogAction) {
        onLogAction(
          'Extracción Estructurada IA',
          `Contratos: ${contracts.length}, Pagos: ${payments.length}, Hallazgos: ${observaciones.length}`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo completar la extracción IA.');
    } finally {
      setIsExtractingAI(false);
    }
  };

  // Contract Matrix CRUD (100% Editable)
  const addBlankContractRow = () => {
    const newRow: ContractEvidenceRow = {
      id: `CT-${Date.now()}`,
      contratoId: `CT-${String(contractRows.length + 1).padStart(3, '0')}`,
      proveedor: '',
      rnc: '',
      montoOriginal: 0,
      montoAdenda: 0,
      adendaPct: 0,
      fechaContrato: '',
      fechaAdenda: '',
      origen: origenesSeleccionados[0] || 'Manual',
      objeto: '',
      esAnomalo: false,
      motivoAlerta: 'Registro manual editable',
    };
    setContractRows((prev) => [...prev, newRow]);
  };

  const updateContractField = <K extends keyof ContractEvidenceRow>(
    id: string,
    field: K,
    value: ContractEvidenceRow[K]
  ) => {
    setContractRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === 'montoOriginal' || field === 'montoAdenda') {
          const orig = Number(updated.montoOriginal) || 0;
          const adenda = Number(updated.montoAdenda) || 0;
          const pct = orig > 0 ? Number(((adenda / orig) * 100).toFixed(2)) : 0;
          updated.adendaPct = pct;
          updated.esAnomalo = pct > adendaThresholdPct;
          updated.motivoAlerta = updated.esAnomalo
            ? `Variación (+${pct.toFixed(1)}%) excede umbral del ${adendaThresholdPct}%`
            : 'Dentro de parámetros ordinarios';
        }
        return updated;
      })
    );
  };

  const deleteContractRow = (id: string) => {
    setContractRows((prev) => prev.filter((r) => r.id !== id));
  };

  const isContractAnomalous = (c: ContractEvidenceRow) => c.adendaPct > adendaThresholdPct;

  const filteredContracts = contractRows.filter((c) => {
    const matchesSearch =
      c.contratoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.rnc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.objeto.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterAnomalos) {
      return matchesSearch && isContractAnomalous(c);
    }
    return matchesSearch;
  });

  const anomaloCount = contractRows.filter(isContractAnomalous).length;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg">
            📂
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Ingesta Real de Evidencias (Archivo, Link/Portal o Texto Literal)
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                100% Editable • Datos Reales
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Extrae textualmente información de PDF, Excel, Word, portales web o textos pegados y edita cualquier campo libremente
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAnonimizar(!anonimizar)}
          className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 border transition-colors cursor-pointer self-start md:self-auto ${
            anonimizar
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          {anonimizar ? 'Anonimización PII Activa' : 'Anonimización Desactivada'}
        </button>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Case Name & Data Sources */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Nombre del Caso / Expediente Real
            </label>
            <input
              type="text"
              value={nombreCaso}
              onChange={(e) => setNombreCaso(e.target.value)}
              placeholder="Ej: Auditoria_Compras_2025"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Fuentes de Origen Asociadas
            </label>
            <div className="space-y-1.5">
              {AVAILABLE_SOURCES.map((source) => {
                const isSelected = origenesSeleccionados.includes(source);
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => toggleSource(source)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-950/40 border-sky-500/50 text-sky-200'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{source}</span>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded border border-slate-600 block shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: 3 Source Tabs (File | URL/Portal | Raw Text) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setSourceTab('archivo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                sourceTab === 'archivo'
                  ? 'bg-sky-600/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              1. Subir Archivo Digital
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('url')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                sourceTab === 'url'
                  ? 'bg-sky-600/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              2. Link / Portal Web
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('texto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                sourceTab === 'texto'
                  ? 'bg-sky-600/20 text-sky-300 border-sky-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <ClipboardType className="w-3.5 h-3.5" />
              3. Texto Literal / Oficio
            </button>
          </div>

          {/* Tab 1: Archivo */}
          {sourceTab === 'archivo' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) {
                  await processFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                isDragging
                  ? 'border-sky-400 bg-sky-950/30'
                  : 'border-slate-700 bg-slate-950/60 hover:border-slate-600'
              }`}
            >
              {isParsing ? (
                <div className="py-3 space-y-2">
                  <Loader2 className="w-8 h-8 text-sky-400 mx-auto animate-spin" />
                  <p className="text-xs font-semibold text-sky-300">{parseStatusMsg}</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-200">
                    Arrastra tu documento real aquí o selecciona desde tu equipo
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Soporta <strong>PDF, Excel (.xlsx/.csv), Word (.docx), TXT, JSON, HTML e Imágenes (OCR)</strong>
                  </p>
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleFileUpload}
                    accept="*/*"
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload"
                    className="mt-3 inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold rounded-lg cursor-pointer border border-slate-700 transition-colors"
                  >
                    Seleccionar Archivo Real
                  </label>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Link / URL / Portal Web */}
          {sourceTab === 'url' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-sky-400" />
                  Enlace de Portal de Transparencia, Compra Pública o Documento en Línea
                </label>
                {entityUrlPortal && urlInput !== entityUrlPortal && (
                  <button
                    type="button"
                    onClick={() => setUrlInput(entityUrlPortal)}
                    className="text-[11px] text-sky-400 hover:underline cursor-pointer"
                  >
                    Usar portal de la entidad
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://portal.comprasdominicana.gob.do/... o enlace directo a PDF/Excel/Web"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => handleFetchUrl()}
                  disabled={isParsing}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Extraer desde Enlace
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Extrae el texto literal de páginas públicas, portales de transparencia o archivos PDF/Excel alojados en la web y detecta enlaces internos descargables.
              </p>
            </div>
          )}

          {/* Tab 3: Texto Literal Directo */}
          {sourceTab === 'texto' && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <input
                type="text"
                value={rawTextTitle}
                onChange={(e) => setRawTextTitle(e.target.value)}
                placeholder="Título del documento u oficio..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
              />
              <textarea
                rows={5}
                value={rawTextBody}
                onChange={(e) => setRawTextBody(e.target.value)}
                placeholder="Pegue aquí el texto literal copiado de un contrato, portal, factura, reporte o certificación..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-sky-500 font-sans leading-relaxed"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleProcessRawText}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Cargar Texto Literal con Sello SHA-256
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="text-xs text-red-200 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parseStatusMsg && !isParsing && (
            <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{parseStatusMsg}</span>
            </div>
          )}

          {/* Evidence Preview + Editable Extracted Text + AI Extractor */}
          {evidenceFile && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 truncate max-w-md">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{evidenceFile.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  {evidenceFile.parsedFormat && (
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono text-[10px] font-bold">
                      {evidenceFile.parsedFormat}
                    </span>
                  )}
                  <span className="text-slate-500 font-mono text-[11px]">
                    {(evidenceFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              {(evidenceFile.pageCount || (evidenceFile.sheetNames && evidenceFile.sheetNames.length > 0)) && (
                <div className="flex flex-wrap gap-2 text-[10.5px] font-mono text-slate-400">
                  {evidenceFile.pageCount && (
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Páginas PDF: <strong className="text-white">{evidenceFile.pageCount}</strong>
                    </span>
                  )}
                  {evidenceFile.sheetNames && evidenceFile.sheetNames.length > 0 && (
                    <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                      Hojas: <strong className="text-white">{evidenceFile.sheetNames.join(', ')}</strong>
                    </span>
                  )}
                </div>
              )}

              <div className="text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 font-medium">SHA-256: </span>
                <span className="font-mono text-emerald-400 break-all select-all">{evidenceFile.sha256}</span>
              </div>

              {/* Discovered portal links (clickable to extract deeper!) */}
              {evidenceFile.discoveredLinks && evidenceFile.discoveredLinks.length > 0 && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                  <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Enlaces Detectados en el Portal ({evidenceFile.discoveredLinks.length}) — Haz clic para extraer uno:
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {evidenceFile.discoveredLinks.slice(0, 18).map((lnk, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleFetchUrl(lnk.url)}
                        className="text-[10.5px] px-2 py-1 rounded bg-slate-950 hover:bg-sky-950/60 text-sky-300 border border-slate-700 hover:border-sky-500/40 truncate max-w-[230px] cursor-pointer"
                        title={lnk.url}
                      >
                        {lnk.label || lnk.url}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Verbatim Extracted Text (Editable + AI Structured Extraction) */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Texto Extraído Literalmente desde Origen
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingExtractedText(!editingExtractedText)}
                      className="text-amber-300 hover:text-amber-200 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      {editingExtractedText ? 'Ver Solo Lectura' : 'Editar Texto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFullTextModal(true)}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      Ampliar
                    </button>
                  </div>
                </div>

                {editingExtractedText ? (
                  <textarea
                    rows={7}
                    value={evidenceFile.extractedText || ''}
                    onChange={(e) =>
                      setEvidenceFile({
                        ...evidenceFile,
                        extractedText: e.target.value,
                        contentSnippet: e.target.value.slice(0, 800),
                      })
                    }
                    className="w-full bg-slate-950 border border-sky-500/40 rounded-lg p-2.5 text-[11px] font-mono text-slate-200 focus:outline-none leading-relaxed"
                  />
                ) : (
                  <pre className="text-[10.5px] font-mono text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed">
                    {(evidenceFile.extractedText || evidenceFile.contentSnippet || '').slice(0, 1800)}
                  </pre>
                )}

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleExtractStructuredWithAI}
                    disabled={isExtractingAI}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
                  >
                    {isExtractingAI ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {isExtractingAI
                      ? 'Extrayendo datos reales...'
                      : 'Extraer Contratos, Ciclo de Pagos y Hallazgos Reales con IA'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editable Contract Matrix */}
      <div className="pt-6 border-t border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              Matriz de Contratos y Adendas ({contractRows.length} registros)
            </h3>
            {anomaloCount > 0 && (
              <span className="bg-red-950/60 text-red-300 border border-red-800/40 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-red-400" />
                {anomaloCount} Adendas &gt; {adendaThresholdPct}%
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar proveedor o contrato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-44 sm:w-56"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterAnomalos(!filterAnomalos)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer ${
                filterAnomalos
                  ? 'bg-red-950/80 border-red-500 text-red-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Solo Alertas (&gt;{adendaThresholdPct}%)
            </button>

            <button
              type="button"
              onClick={addBlankContractRow}
              className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Contrato Manual
            </button>
          </div>
        </div>

        {contractRows.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-700 rounded-xl p-6 text-center text-xs text-slate-400">
            Sin contratos cargados todavía. Sube un Excel/CSV/PDF, extrae con IA desde el documento/enlace arriba, o pulsa{' '}
            <strong>&quot;Añadir Contrato Manual&quot;</strong> para ingresar filas editables.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-[11px] text-slate-200">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-2">Contrato ID</th>
                  <th className="py-2.5 px-2">Proveedor / RNC</th>
                  <th className="py-2.5 px-2 text-right">Monto Original ({simboloMoneda})</th>
                  <th className="py-2.5 px-2 text-right">Monto Adenda ({simboloMoneda})</th>
                  <th className="py-2.5 px-2 text-center">% Adenda</th>
                  <th className="py-2.5 px-2">Objeto &amp; Fechas</th>
                  <th className="py-2.5 px-2 text-center">Estado / Borrar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredContracts.map((row) => {
                  const isOverThreshold = isContractAnomalous(row);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-800/30 align-top ${
                        isOverThreshold ? 'bg-red-950/15' : ''
                      }`}
                    >
                      <td className="p-2 min-w-[125px]">
                        <input
                          type="text"
                          value={row.contratoId}
                          onChange={(e) => updateContractField(row.id, 'contratoId', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                        />
                        <input
                          type="text"
                          value={row.origen}
                          onChange={(e) => updateContractField(row.id, 'origen', e.target.value)}
                          placeholder="Origen"
                          className="w-full mt-1 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[10px] text-sky-300"
                        />
                      </td>
                      <td className="p-2 min-w-[170px] space-y-1">
                        <input
                          type="text"
                          value={row.proveedor}
                          onChange={(e) => updateContractField(row.id, 'proveedor', e.target.value)}
                          placeholder="Nombre del proveedor"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                        <input
                          type="text"
                          value={row.rnc}
                          onChange={(e) => updateContractField(row.id, 'rnc', e.target.value)}
                          placeholder="RNC / NIF"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-0.5 font-mono text-slate-400"
                        />
                      </td>
                      <td className="p-2 min-w-[120px]">
                        <input
                          type="number"
                          value={row.montoOriginal}
                          onChange={(e) =>
                            updateContractField(row.id, 'montoOriginal', Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white"
                        />
                        <div className="text-[10px] text-slate-500 text-right mt-0.5 font-mono">
                          {formatCurrency(row.montoOriginal, simboloMoneda)}
                        </div>
                      </td>
                      <td className="p-2 min-w-[120px]">
                        <input
                          type="number"
                          value={row.montoAdenda}
                          onChange={(e) =>
                            updateContractField(row.id, 'montoAdenda', Number(e.target.value))
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white"
                        />
                        <div className="text-[10px] text-slate-500 text-right mt-0.5 font-mono">
                          {formatCurrency(row.montoAdenda, simboloMoneda)}
                        </div>
                      </td>
                      <td className="p-2 text-center min-w-[90px]">
                        <span
                          className={`inline-block font-mono font-bold px-2 py-1 rounded text-xs ${
                            isOverThreshold
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          +{row.adendaPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2 min-w-[190px] space-y-1">
                        <input
                          type="text"
                          value={row.objeto}
                          onChange={(e) => updateContractField(row.id, 'objeto', e.target.value)}
                          placeholder="Objeto contractual..."
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200"
                        />
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={row.fechaContrato}
                            onChange={(e) => updateContractField(row.id, 'fechaContrato', e.target.value)}
                            className="w-1/2 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-slate-400"
                          />
                          <input
                            type="date"
                            value={row.fechaAdenda}
                            onChange={(e) => updateContractField(row.id, 'fechaAdenda', e.target.value)}
                            className="w-1/2 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-slate-400"
                          />
                        </div>
                      </td>
                      <td className="p-2 text-center min-w-[110px]">
                        <div className="flex flex-col items-center gap-1.5">
                          {isOverThreshold ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/50">
                              Alerta &gt;{adendaThresholdPct}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                              Regular
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteContractRow(row.id)}
                            className="p-1 rounded bg-slate-950 hover:bg-red-950/70 text-slate-400 hover:text-red-400 border border-slate-800 cursor-pointer"
                            title="Eliminar contrato"
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

      {/* Modal: Full Extracted Digital Content Viewer (Editable) */}
      {showFullTextModal && evidenceFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  Contenido Completo en Pantalla (Editable): {evidenceFile.name}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Formato: {evidenceFile.parsedFormat || 'DIGITAL'} • SHA-256: {evidenceFile.sha256}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullTextModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60">
              <textarea
                rows={18}
                value={evidenceFile.extractedText || evidenceFile.contentSnippet || ''}
                onChange={(e) =>
                  setEvidenceFile({
                    ...evidenceFile,
                    extractedText: e.target.value,
                    contentSnippet: e.target.value.slice(0, 800),
                  })
                }
                className="w-full h-full min-h-[380px] bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
