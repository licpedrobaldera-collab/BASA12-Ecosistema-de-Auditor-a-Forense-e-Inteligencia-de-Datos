import React, { useState } from 'react';
import {
  Upload,
  FileCheck,
  Shield,
  AlertCircle,
  Database,
  Search,
  CheckCircle2,
  RefreshCw,
  FileText,
  Eye,
  X,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import { ContractEvidenceRow, EvidenceFile } from '../types/forensic';
import { SAMPLE_EDEESTE_SENASE_CONTRACTS } from '../utils/sampleData';
import { parseDigitalFile } from '../utils/fileParser';
import { formatCurrency } from '../utils/entities';

interface Props {
  nombreCaso: string;
  setNombreCaso: (val: string) => void;
  origenesSeleccionados: string[];
  setOrigenesSeleccionados: (val: string[]) => void;
  evidenceFile: EvidenceFile | null;
  setEvidenceFile: (file: EvidenceFile | null) => void;
  contractRows: ContractEvidenceRow[];
  setContractRows: (rows: ContractEvidenceRow[]) => void;
  anonimizar: boolean;
  setAnonimizar: (val: boolean) => void;
  adendaThresholdPct?: number;
  simboloMoneda?: string;
  onFileParsed?: (file: EvidenceFile, detectedCount: number) => void;
}

const AVAILABLE_SOURCES = [
  'Contabilidad Central (SAP / ERP)',
  'Bancos Dominicanos (Banreservas / Popular / BHD)',
  'Licitaciones Públicas (DGCP / Compras Dominicana)',
  'Nóminas del Estado (SASP / Contraloría)',
  'Comprobantes Fiscales y Facturación (DGII / NCF)',
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
  onFileParsed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnomalos, setFilterAnomalos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseStatusMsg, setParseStatusMsg] = useState<string | null>(null);
  const [showFullTextModal, setShowFullTextModal] = useState(false);

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
    setParseStatusMsg(`Leyendo y extrayendo contenido digital de "${file.name}"...`);

    try {
      const originLabel = origenesSeleccionados[0] || 'Evidencia Digital';
      const parsed = await parseDigitalFile(file, originLabel, adendaThresholdPct);
      setEvidenceFile(parsed.evidenceFile);

      if (parsed.detectedContracts.length > 0) {
        setContractRows(parsed.detectedContracts);
        setParseStatusMsg(
          `Formato ${parsed.evidenceFile.parsedFormat} leído con éxito: ${parsed.detectedContracts.length} registros tabulares cargados en matriz.`
        );
      } else {
        setParseStatusMsg(
          `Formato ${parsed.evidenceFile.parsedFormat} leído con éxito (${(parsed.evidenceFile.extractedText || '').length.toLocaleString('es-DO')} caracteres extraídos).`
        );
      }

      if (onFileParsed) {
        onFileParsed(parsed.evidenceFile, parsed.detectedContracts.length);
      }
    } catch (err: any) {
      setParseStatusMsg(`Error leyendo archivo: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const loadSampleDataset = () => {
    setContractRows(SAMPLE_EDEESTE_SENASE_CONTRACTS);
    setNombreCaso('Auditoria_Edeeste_Senase');
    setOrigenesSeleccionados([
      'Licitaciones Públicas (DGCP / Compras Dominicana)',
      'Contabilidad Central (SAP / ERP)',
      'Bancos Dominicanos (Banreservas / Popular / BHD)',
    ]);
    setEvidenceFile({
      name: 'Matriz_Contratos_Adendas_Edeeste_Senase_2024.csv',
      size: 48920,
      type: 'text/csv',
      parsedFormat: 'CSV',
      sha256: '9b7a48d3e21543f06ac2914db9c581a42b918f6d713c7a0d421890e1fe6b8912',
      uploadDate: new Date().toISOString(),
      contentSnippet: 'Muestra contractual de Edeeste / Senase con adendas > 50% verificadas por auditoría pericial.',
      extractedText: SAMPLE_EDEESTE_SENASE_CONTRACTS.map(
        (c) =>
          `${c.contratoId} | ${c.proveedor} | Orig: ${c.montoOriginal} | Adenda: ${c.montoAdenda} (+${c.adendaPct}%)`
      ).join('\n'),
      recordCount: SAMPLE_EDEESTE_SENASE_CONTRACTS.length,
    });
    setParseStatusMsg('Caso ejemplo Edeeste / Senase restaurado en pantalla.');
  };

  const isContractAnomalous = (c: ContractEvidenceRow) => c.adendaPct > adendaThresholdPct;

  const filteredContracts = contractRows.filter((c) => {
    const matchesSearch =
      c.contratoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.rnc.includes(searchTerm);
    if (filterAnomalos) {
      return matchesSearch && isContractAnomalous(c);
    }
    return matchesSearch;
  });

  const anomaloCount = contractRows.filter(isContractAnomalous).length;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-lg">
            📂
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Gestión y Procesamiento Universal de Evidencias
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PDF • Excel • Word • TXT • OCR • Digital
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Lectura automática de cualquier formato digital, extracción tabular, sello SHA-256 y cadena de custodia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadSampleDataset}
            className="px-3.5 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Cargar datos de ejemplo de contratos y adendas de Edeeste"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Cargar Ejemplo: Edeeste / Senase
          </button>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left column: Case Name & Sources */}
        <div className="lg:col-span-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Nombre del Caso Técnico
            </label>
            <input
              type="text"
              value={nombreCaso}
              onChange={(e) => setNombreCaso(e.target.value)}
              placeholder="Ej: Auditoria_Edeeste_Senase"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Carpeta técnica:{' '}
              <span className="font-mono text-slate-400">
                caso_{nombreCaso.toLowerCase().replace(/\s+/g, '_')}_[timestamp]
              </span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Fuentes de Datos Principales
            </label>
            <div className="space-y-2">
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

        {/* Right column: Universal Digital File Upload & Extracted Content Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Lector Universal de Evidencia Digital
              </label>
              <button
                type="button"
                onClick={() => setAnonimizar(!anonimizar)}
                className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 border transition-colors cursor-pointer ${
                  anonimizar
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Shield className="w-3 h-3 text-emerald-400" />
                {anonimizar ? 'Anonimización PII Activa' : 'Anonimización Desactivada'}
              </button>
            </div>

            {/* Drag & drop upload box accepting ANY digital format */}
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
                    Arrastra tu documento aquí o haz clic para explorar
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Lee <strong>PDF, Excel (.xlsx/.xls/.csv), Word (.docx), TXT, JSON, XML, Imágenes (OCR)</strong> y cualquier formato digital
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
                    className="mt-3 inline-block px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold rounded-lg cursor-pointer border border-slate-700 transition-colors"
                  >
                    Seleccionar Cualquier Archivo Digital
                  </label>
                </>
              )}
            </div>

            {parseStatusMsg && !isParsing && (
              <div className="mt-2 text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-800/40 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{parseStatusMsg}</span>
              </div>
            )}
          </div>

          {/* Digital Stamp & Extracted Content Card */}
          {evidenceFile && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{evidenceFile.name}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
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

              {/* Metadata chips */}
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
                <div className="text-slate-400 font-medium mb-0.5 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-sky-400" /> Sello Digital SHA-256 (Inalterable):
                </div>
                <div className="font-mono text-emerald-400 break-all select-all text-[10.5px]">
                  {evidenceFile.sha256}
                </div>
              </div>

              {/* Extracted Content Preview Box */}
              {(evidenceFile.extractedText || evidenceFile.contentSnippet) && (
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-sky-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Contenido Digital Extraído en Pantalla
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFullTextModal(true)}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      Ver Documento Completo
                    </button>
                  </div>
                  <pre className="text-[10.5px] font-mono text-slate-300 whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
                    {(evidenceFile.extractedText || evidenceFile.contentSnippet || '').slice(0, 1200)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contract Data Table Preview */}
      {contractRows.length > 0 && (
        <div className="mt-7 pt-6 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                Matriz de Evidencia Contractual ({contractRows.length} registros cargados)
              </h3>
              {anomaloCount > 0 && (
                <span className="bg-red-950/60 text-red-300 border border-red-800/40 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  {anomaloCount} Adendas &gt; {adendaThresholdPct}%
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar proveedor o contrato..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 w-48 sm:w-60"
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
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10.5px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Contrato ID</th>
                  <th className="py-2.5 px-3">Proveedor / RNC</th>
                  <th className="py-2.5 px-3 text-right">Monto Original</th>
                  <th className="py-2.5 px-3 text-right">Monto Adenda</th>
                  <th className="py-2.5 px-3 text-center">% Adenda</th>
                  <th className="py-2.5 px-3">Origen / Objeto</th>
                  <th className="py-2.5 px-3 text-center">Estado Forense</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredContracts.map((row) => {
                  const isOverThreshold = isContractAnomalous(row);
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isOverThreshold ? 'bg-red-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-200">
                        {row.contratoId}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-200">{row.proveedor}</div>
                        <div className="text-[10px] font-mono text-slate-500">RNC/NIF: {row.rnc}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatCurrency(row.montoOriginal, simboloMoneda)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                        {formatCurrency(row.montoAdenda, simboloMoneda)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            isOverThreshold
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}
                        >
                          +{row.adendaPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <div className="text-[11px] text-slate-400 truncate">{row.objeto}</div>
                        <div className="text-[10px] text-sky-400">{row.origen}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isOverThreshold ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/50">
                            <AlertCircle className="w-3 h-3" />
                            Alerta &gt; {adendaThresholdPct}%
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                            Regular
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Full Extracted Digital Content Viewer */}
      {showFullTextModal && evidenceFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col text-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  Lectura Completa en Pantalla: {evidenceFile.name}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Formato: {evidenceFile.parsedFormat || 'DIGITAL'} • SHA-256: {evidenceFile.sha256}
                </p>
              </div>
              <button
                onClick={() => setShowFullTextModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60">
              <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                {evidenceFile.extractedText || evidenceFile.contentSnippet || 'Sin texto extraíble.'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
