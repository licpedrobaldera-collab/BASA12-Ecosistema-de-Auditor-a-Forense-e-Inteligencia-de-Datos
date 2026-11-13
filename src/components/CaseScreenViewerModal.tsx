import React, { useState } from 'react';
import {
  X,
  FolderOpen,
  Shield,
  Clock,
  Building2,
  UserCheck,
  FileText,
  Scale,
  Terminal,
  Printer,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  CreditCard,
  Lightbulb,
} from 'lucide-react';
import { CaseSession } from '../types/forensic';
import { formatCurrency } from '../utils/entities';

interface Props {
  caseData: CaseSession | null;
  onClose: () => void;
  onLoadIntoWorkspace: (c: CaseSession) => void;
}

export const CaseScreenViewerModal: React.FC<Props> = ({
  caseData,
  onClose,
  onLoadIntoWorkspace,
}) => {
  const [activeTab, setActiveTab] = useState<
    'resumen' | 'documentos' | 'observaciones' | 'codigo' | 'trazabilidad'
  >('resumen');

  if (!caseData) return null;

  const currency = caseData.entity?.simboloMoneda || 'RD$';
  const obsList = caseData.observaciones || caseData.resultado?.observacionesDecididas || [];
  const contracts = caseData.contractRows || [];
  const payments = caseData.paymentCycleRows || [];
  const directorsList = caseData.directors || [];
  const contraReplicasList = caseData.contraReplicas || [];
  const logs = caseData.traceabilityLogs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                  {caseData.codigoCaso || 'EXPEDIENTE'}
                </span>
                <h2 className="text-lg font-bold text-white">{caseData.nombreCaso}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    caseData.estado === 'CERRADO'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : caseData.estado === 'DICTAMEN_EMITIDO'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {caseData.estado || 'EN_PROCESO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Entidad Exclusiva: <strong className="text-slate-200">{caseData.entity?.nombre || 'Entidad Auditada'}</strong> •
                Registrado: {new Date(caseData.timestamp).toLocaleString('es-DO')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-sky-400" />
              Imprimir Pantalla
            </button>
            <button
              onClick={() => {
                onLoadIntoWorkspace(caseData);
                onClose();
              }}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              Cargar y Editar en Trabajo
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-slate-800 bg-slate-900/70 px-6 pt-2.5 gap-2 shrink-0">
          {[
            { id: 'resumen', label: '1. Ficha General, Dictamen & Mejoras' },
            { id: 'documentos', label: `2. Evidencia, Contratos (${contracts.length}) & Pagos (${payments.length})` },
            { id: 'observaciones', label: `3. Observaciones (${obsList.length})` },
            { id: 'codigo', label: '4. Algoritmo Python IA' },
            { id: 'trazabilidad', label: `5. Trazabilidad (${logs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-950 text-sky-400 border-t-2 border-sky-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-950/50">
          {activeTab === 'resumen' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase text-sky-400 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" /> Entidad Auditada
                  </div>
                  <div className="text-sm font-bold text-white">
                    {caseData.entity?.nombre || 'No especificada'}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    RNC/NIF: {caseData.entity?.rncNif || 'N/D'} • Sector: {caseData.entity?.sector || 'N/D'}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" /> Auditor Responsable
                  </div>
                  <div className="text-sm font-bold text-white">
                    {caseData.auditor?.nombre || 'Auditor Forense'}
                  </div>
                  <div className="text-xs text-slate-400">
                    ID: {caseData.auditor?.cedulaId || 'N/D'} • {caseData.auditor?.cargo || 'Auditor Jefe'}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase text-amber-400 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Sello Digital SHA-256
                  </div>
                  <div className="text-xs font-mono text-emerald-400 break-all">
                    {caseData.selloDigital}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Período: {caseData.periodo?.fechaDesde || 'N/D'} al {caseData.periodo?.fechaHasta || 'N/D'}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Requerimiento Pericial del Caso
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed">{caseData.requerimiento}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {caseData.origenes.map((o, i) => (
                    <span
                      key={i}
                      className="text-[11px] px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-sky-300"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>

              {caseData.resultado ? (
                <div className="bg-slate-900 border border-emerald-800/40 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                      <Scale className="w-4 h-4" /> Dictamen Ejecutivo Generado por IA
                    </h3>
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                      Riesgo: {caseData.resultado.metricasRiesgo?.nivelRiesgo || 'ALTO'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {caseData.resultado.resumenEjecutivo}
                  </p>
                  {caseData.resultado.banderasRojas?.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-red-300">Banderas Rojas Detectadas:</div>
                      <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                        {caseData.resultado.banderasRojas.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {caseData.resultado.mejorasControlInterno &&
                    caseData.resultado.mejorasControlInterno.length > 0 && (
                      <div className="space-y-1.5 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-3">
                        <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4" /> Mejoras Recomendadas de Control Interno IA:
                        </div>
                        <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                          {caseData.resultado.mejorasControlInterno.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  <div className="text-xs text-sky-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <strong>Fundamento Legal: </strong>
                    {caseData.resultado.fundamentoLegal}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
                  Este caso aún no tiene un dictamen IA ejecutado. Cárgalo en el espacio de trabajo y ejecuta el análisis en el Paso 5.
                </div>
              )}
            </div>
          )}

          {activeTab === 'documentos' && (
            <div className="space-y-5">
              {caseData.evidenceFile && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-400" />
                      Evidencia Digital Principal: {caseData.evidenceFile.name}
                    </h3>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                      {caseData.evidenceFile.parsedFormat || 'DIGITAL'}
                    </span>
                  </div>
                  {caseData.evidenceFile.sourceUrl && (
                    <div className="text-xs font-mono text-sky-400 break-all">
                      Enlace Origen: {caseData.evidenceFile.sourceUrl}
                    </div>
                  )}
                  {caseData.evidenceFile.extractedText && (
                    <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                      {caseData.evidenceFile.extractedText}
                    </pre>
                  )}
                </div>
              )}

              {contracts.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Matriz Contractual Registrada ({contracts.length})
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Contrato</th>
                          <th className="py-2 px-3">Proveedor</th>
                          <th className="py-2 px-3 text-right">Original</th>
                          <th className="py-2 px-3 text-right">Adenda</th>
                          <th className="py-2 px-3 text-center">% Var.</th>
                          <th className="py-2 px-3">Motivo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {contracts.map((c) => (
                          <tr key={c.id} className={c.esAnomalo ? 'bg-red-950/20' : ''}>
                            <td className="py-2 px-3 font-mono">{c.contratoId}</td>
                            <td className="py-2 px-3">{c.proveedor}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(c.montoOriginal, currency)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(c.montoAdenda, currency)}</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-amber-300">+{c.adendaPct.toFixed(1)}%</td>
                            <td className="py-2 px-3 text-[11px]">{c.motivoAlerta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {payments.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-sky-400" />
                    Ciclo de Pagos Registrado ({payments.length} desembolsos)
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="py-2 px-3">Orden / Contrato</th>
                          <th className="py-2 px-3">Beneficiario</th>
                          <th className="py-2 px-3">e-CF / Libramiento</th>
                          <th className="py-2 px-3 text-right">Facturado</th>
                          <th className="py-2 px-3 text-right">Neto Pagado</th>
                          <th className="py-2 px-3">Estado Ciclo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {payments.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 font-mono">{p.ordenNumero} / {p.contratoId}</td>
                            <td className="py-2 px-3">{p.beneficiario}</td>
                            <td className="py-2 px-3 font-mono text-[11px]">
                              {p.numeroFacturaEcf || 'N/D'} • {p.numeroLibramientoPago || 'N/D'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(p.montoFacturado, currency)}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">{formatCurrency(p.montoPagadoNeto, currency)}</td>
                            <td className="py-2 px-3 font-mono text-[11px]">{p.estadoCiclo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {caseData.actaLectura?.contenido && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1.5">
                    <div className="text-xs font-bold text-sky-300">1. {caseData.actaLectura.titulo}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{caseData.actaLectura.contenido}</p>
                  </div>
                )}
                {caseData.informePreliminar?.contenido && (
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1.5">
                    <div className="text-xs font-bold text-red-300">3. {caseData.informePreliminar.titulo}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{caseData.informePreliminar.contenido}</p>
                  </div>
                )}
              </div>

              {directorsList.length > 0 && (
                <div className="bg-slate-900 border border-indigo-800/40 rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-indigo-300">
                    Directores y Decretos Oficiales de Nombramiento ({directorsList.length})
                  </h3>
                  <div className="space-y-2">
                    {directorsList.map((d) => (
                      <div key={d.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex justify-between gap-2 flex-wrap">
                          <strong className="text-white">{d.nombre} ({d.cargo})</strong>
                          <span className="font-mono text-amber-300">{d.numeroDecretoNombramiento}</span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          Período: {d.fechaInicioGestion || 'N/D'} a {d.enFuncionesActuales ? 'Actualidad' : d.fechaFinGestion || 'N/D'}
                        </div>
                        {d.fuentes?.map((f) => (
                          <div key={f.id} className="text-[11px] text-sky-400 break-all">
                            Origen: {f.ubicacionOrigen} {f.url ? `• ${f.url}` : ''}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {contraReplicasList.length > 0 && (
                <div className="bg-slate-900 border border-purple-800/40 rounded-xl p-5 space-y-2.5">
                  <h3 className="text-sm font-bold text-purple-300">
                    Contra-Réplicas Multi-Período ({contraReplicasList.length})
                  </h3>
                  {contraReplicasList.map((cr) => (
                    <div key={cr.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between gap-2 flex-wrap">
                        <strong className="text-white">{cr.titulo}</strong>
                        <span className="text-[11px] font-mono text-purple-300">
                          {cr.periodoEtiqueta || cr.fecha} • {cr.directorNombre || 'General'}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">{cr.contenido}</p>
                      {(cr.fuenteOrigen || cr.urlOrigen) && (
                        <div className="text-[10.5px] font-mono text-sky-400 break-all">
                          Fuente: {cr.fuenteOrigen || ''} {cr.urlOrigen ? `(${cr.urlOrigen})` : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'observaciones' && (
            <div className="space-y-3">
              {obsList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No hay observaciones registradas en este caso.
                </div>
              ) : (
                obsList.map((o) => (
                  <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white flex items-center gap-2">
                        {o.decision === 'SE_MANTIENE' && <XCircle className="w-4 h-4 text-red-400" />}
                        {o.decision === 'SE_ELIMINA' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                        {o.decision === 'SE_MODIFICA' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        {o.codigoObservacion}: {o.titulo}
                      </span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-700">
                        {o.decision}
                      </span>
                    </div>
                    <p className="text-slate-300"><strong>Criterio:</strong> {o.criterioEvaluacion}</p>
                    <p className="text-sky-300 font-mono text-[11px]"><strong>Base Legal:</strong> {o.fundamentacionLegal}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'codigo' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Script Forense Certificado (Python)
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-emerald-300 overflow-x-auto max-h-96">
                {caseData.resultado?.codigoPython || '# No se ha generado script Python para este caso todavía.'}
              </pre>
            </div>
          )}

          {activeTab === 'trazabilidad' && (
            <div className="space-y-2.5">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">Sin eventos de trazabilidad registrados aún.</div>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <strong className="text-white">{l.accion}</strong>
                      <span className="font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {l.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-300">{l.detalle}</p>
                    <div className="text-[10px] font-mono text-teal-400">
                      Usuario: {l.usuario} • Hash: {l.sha256}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
