import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Terminal,
  Shield,
  AlertTriangle,
  Scale,
  Play,
  CheckCircle2,
  Lightbulb,
  BookOpen,
  FileCheck2,
} from 'lucide-react';
import {
  AuditedEntity,
  AuditorProfile,
  AuditPeriodScope,
  CcrdStageStatus,
  ContractEvidenceRow,
  DirectorResponsibility,
  DossierSectionItem,
  DuplicityFinding,
  ForensicAnalysisResult,
  HallazgoMatrizLiteral,
  LegalReferenceItem,
  ObservacionDecision,
  PaymentCycleRow,
} from '../types/forensic';
import { downloadSupervisorWordReport, downloadWordReport } from '../utils/exportWord';
import { formatCurrency } from '../utils/entities';

interface Props {
  resultado: ForensicAnalysisResult;
  nombreCaso: string;
  origenes: string[];
  requerimiento: string;
  contractRows: ContractEvidenceRow[];
  paymentCycleRows?: PaymentCycleRow[];
  simboloMoneda?: string;
  adendaThresholdPct?: number;
  auditor?: AuditorProfile;
  periodo?: AuditPeriodScope;
  paisNormativa?: string;
  observaciones?: ObservacionDecision[];
  actaLectura?: DossierSectionItem;
  recursos?: DossierSectionItem[];
  replicas?: DossierSectionItem[];
  contraReplicas?: DossierSectionItem[];
  directors?: DirectorResponsibility[];
  entity?: AuditedEntity | null;
  hallazgosLiteral?: HallazgoMatrizLiteral[];
  duplicidades?: DuplicityFinding[];
  legalLibrary?: LegalReferenceItem[];
  ccrdStages?: CcrdStageStatus[];
  onOpenLegalViewer?: (ref: LegalReferenceItem) => void;
}

export const ResultsSection: React.FC<Props> = ({
  resultado,
  nombreCaso,
  origenes,
  requerimiento,
  contractRows,
  paymentCycleRows = [],
  simboloMoneda = 'RD$',
  adendaThresholdPct = 50,
  auditor,
  periodo,
  paisNormativa,
  observaciones,
  actaLectura,
  recursos,
  replicas,
  contraReplicas,
  directors,
  entity,
  hallazgosLiteral = [],
  duplicidades = [],
  legalLibrary = [],
  ccrdStages = [],
  onOpenLegalViewer,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [sandboxExecuted, setSandboxExecuted] = useState(false);
  const [sandboxResults, setSandboxResults] = useState<{
    totalEvaluados: number;
    anomaliasDetectadas: number;
    montoTotalExpuesto: number;
    registros: ContractEvidenceRow[];
  } | null>(null);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(resultado.codigoPython);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const runSandboxSimulation = () => {
    const anomalos = contractRows.filter((c) => c.adendaPct > adendaThresholdPct || c.esAnomalo);
    const sumaExposicion = anomalos.reduce((acc, c) => acc + c.montoAdenda, 0);

    setSandboxResults({
      totalEvaluados: contractRows.length,
      anomaliasDetectadas: anomalos.length,
      montoTotalExpuesto: sumaExposicion,
      registros: anomalos,
    });
    setSandboxExecuted(true);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-lg">
            📜
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Dictamen Pericial, Mejoras IA y Código Generado
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Basado en Datos Reales
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Certificación analítica, banderas rojas, mejoras operativas de control interno y reporte Word descargable
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              downloadWordReport({
                nombreCaso,
                origenes,
                requerimiento,
                selloDigital: resultado.digitalHash,
                resultado,
                auditor,
                periodo,
                paisNormativa,
                observaciones,
                paymentCycleRows,
                simboloMoneda,
                actaLectura,
                recursos,
                replicas,
                contraReplicas,
                directors,
                legalLibrary,
              })
            }
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Descargar Informe Técnico (.doc)
          </button>

          <button
            onClick={() =>
              downloadSupervisorWordReport({
                nombreCaso,
                entity,
                auditor,
                periodo,
                paisNormativa,
                selloDigital: resultado.digitalHash,
                hallazgos: hallazgosLiteral,
                duplicidades,
                legalLibrary,
                ccrdStages,
                directors,
                paymentCycleRows,
              })
            }
            className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            title="Informe oficial del Supervisor / Revisor Técnico sin menciones a IA"
          >
            <FileCheck2 className="w-4 h-4" />
            Informe Supervisor CCRD (.doc)
          </button>
        </div>
      </div>

      {/* Sello Digital & Risk Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 mb-1">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            Sello Digital Criptográfico
          </div>
          <div className="font-mono text-emerald-400 text-xs truncate select-all">
            {resultado.digitalHash}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Nivel de Riesgo Evaluado
          </div>
          <div className="text-sm font-bold text-red-400 flex items-center gap-2">
            <span>{resultado.metricasRiesgo?.nivelRiesgo || 'ALTO'}</span>
            <span className="text-[11px] font-normal text-slate-400">
              ({resultado.metricasRiesgo?.exposicionEstimada || 'Según datos cargados'})
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg">
          <div className="text-[11px] text-slate-400 font-semibold uppercase flex items-center gap-1.5 mb-1">
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
            Acción Inmediata
          </div>
          <div className="text-xs text-slate-300 line-clamp-2">
            {resultado.metricasRiesgo?.accionInmediata || 'Preservación de documentos'}
          </div>
        </div>
      </div>

      {/* Resumen Ejecutivo */}
      <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-lg space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Resumen Ejecutivo del Requerimiento
        </h3>
        <p className="text-sm text-slate-200 leading-relaxed font-sans">{resultado.resumenEjecutivo}</p>
      </div>

      {/* Banderas Rojas */}
      {resultado.banderasRojas && resultado.banderasRojas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            Banderas Rojas Identificadas (Red Flags)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {resultado.banderasRojas.map((flag, idx) => (
              <div
                key={idx}
                className="bg-red-950/30 border border-red-900/40 p-2.5 rounded-lg flex items-start gap-2 text-xs text-red-200"
              >
                <span className="font-bold text-red-400 shrink-0">#{idx + 1}</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mejoras de Control Interno IA */}
      {resultado.mejorasControlInterno && resultado.mejorasControlInterno.length > 0 && (
        <div className="space-y-2 bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-emerald-400" />
            Mejoras de Control Interno y Procedimientos Recomendadas por IA
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {resultado.mejorasControlInterno.map((mejora, idx) => (
              <div
                key={idx}
                className="bg-slate-950/70 border border-emerald-900/40 p-2.5 rounded-lg flex items-start gap-2 text-xs text-emerald-100"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{mejora}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Python Code Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Código Python Forense Verificado
          </h3>
          <div className="flex gap-2">
            <button
              onClick={runSandboxSimulation}
              className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Verificar en Matriz Local
            </button>
            <button
              onClick={handleCopyCode}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? '¡Copiado!' : 'Copiar Código'}
            </button>
          </div>
        </div>

        <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-300 overflow-x-auto max-h-[320px] leading-relaxed">
          {resultado.codigoPython}
        </pre>
      </div>

      {/* Sandbox Simulation Results */}
      {sandboxExecuted && sandboxResults && (
        <div className="bg-slate-950 border border-sky-800/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Resultado sobre Matriz Contractual Real
            </div>
            <div className="text-xs text-slate-400">
              Evaluados: <strong className="text-white">{sandboxResults.totalEvaluados}</strong> | Alertas:{' '}
              <strong className="text-red-400">{sandboxResults.anomaliasDetectadas}</strong>
            </div>
          </div>

          <div className="text-xs text-slate-300">
            Monto acumulado en adendas sobre umbral:
            <strong className="text-amber-300 ml-1.5 font-mono text-sm">
              {formatCurrency(sandboxResults.montoTotalExpuesto, simboloMoneda)}
            </strong>
          </div>

          {sandboxResults.registros.length > 0 && (
            <div className="overflow-x-auto rounded border border-slate-800">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead className="bg-slate-900 text-slate-400 uppercase font-mono">
                  <tr>
                    <th className="py-2 px-2.5">Contrato</th>
                    <th className="py-2 px-2.5">Proveedor</th>
                    <th className="py-2 px-2.5 text-right">Adenda</th>
                    <th className="py-2 px-2.5 text-center">% Incremento</th>
                    <th className="py-2 px-2.5">Motivo Pericial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-sans">
                  {sandboxResults.registros.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-800/30">
                      <td className="py-2 px-2.5 font-mono text-slate-200">{reg.contratoId}</td>
                      <td className="py-2 px-2.5 text-slate-300">{reg.proveedor}</td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-200">
                        {formatCurrency(reg.montoAdenda, simboloMoneda)}
                      </td>
                      <td className="py-2 px-2.5 text-center font-mono font-bold text-red-400">
                        +{reg.adendaPct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-2.5 text-red-300">{reg.motivoAlerta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fundamento Legal */}
      <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5 text-sky-400" />
          Fundamentación Normativa y Legal
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed">{resultado.fundamentoLegal}</p>
        {onOpenLegalViewer && legalLibrary.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1 mr-1">
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              Leer Leyes Citadas (Sin Salir del Informe):
            </span>
            {legalLibrary.map((law) => (
              <button
                key={law.id}
                type="button"
                onClick={() => onOpenLegalViewer(law)}
                className="px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 text-[11px] font-semibold cursor-pointer"
              >
                #{law.jerarquiaOrden} • {law.numeroNorma}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
