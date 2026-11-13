import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  FileCheck2,
  Lightbulb,
} from 'lucide-react';
import { ContractEvidenceRow, PaymentCycleRow } from '../types/forensic';
import { formatCurrency } from '../utils/entities';

interface Props {
  entityName: string;
  paisNormativa: string;
  idioma: string;
  simboloMoneda: string;
  paymentCycleRows: PaymentCycleRow[];
  setPaymentCycleRows: React.Dispatch<React.SetStateAction<PaymentCycleRow[]>>;
  contractRows: ContractEvidenceRow[];
  onLogAction: (accion: string, detalle: string) => void;
}

export const PaymentCycleSection: React.FC<Props> = ({
  entityName,
  paisNormativa,
  idioma,
  simboloMoneda,
  paymentCycleRows,
  setPaymentCycleRows,
  contractRows,
  onLogAction,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [cycleReport, setCycleReport] = useState<{
    resumenCiclo: string;
    hallazgosCriticos: string[];
    mejorasControlPagos: string[];
    riesgoCiclo: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddRow = () => {
    const newRow: PaymentCycleRow = {
      id: `PAY-${Date.now()}`,
      ordenNumero: `OC-${String(paymentCycleRows.length + 1).padStart(3, '0')}`,
      contratoId: contractRows[0]?.contratoId || '',
      beneficiario: '',
      rnc: '',
      fechaSolicitud: '',
      numeroFacturaEcf: '',
      fechaFactura: '',
      tieneRecepcionConduce: true,
      fechaRecepcion: '',
      numeroLibramientoPago: '',
      fechaPago: '',
      bancoCuenta: '',
      montoFacturado: 0,
      retencionesImpuestos: 0,
      montoPagadoNeto: 0,
      estadoCiclo: 'EN_REVISION',
      observacionPago: '',
    };
    setPaymentCycleRows((prev) => [...prev, newRow]);
    onLogAction('Ciclo de Pagos', 'Se agregó una nueva fila editable al ciclo de pagos.');
  };

  const updateRowField = <K extends keyof PaymentCycleRow>(
    id: string,
    field: K,
    value: PaymentCycleRow[K]
  ) => {
    setPaymentCycleRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === 'montoFacturado' || field === 'retencionesImpuestos') {
          const fact = Number(updated.montoFacturado) || 0;
          const ret = Number(updated.retencionesImpuestos) || 0;
          updated.montoPagadoNeto = Math.max(0, Number((fact - ret).toFixed(2)));
        }
        return updated;
      })
    );
  };

  const deleteRow = (id: string) => {
    setPaymentCycleRows((prev) => prev.filter((r) => r.id !== id));
  };

  const analyzePaymentCycleWithAI = async () => {
    if (paymentCycleRows.length === 0) {
      setErrorMsg('Agrega al menos un pago real o extráelo de tu documento/Excel para analizar el ciclo.');
      return;
    }
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const resp = await fetch('/api/forensic/analyze-payment-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName,
          paisNormativa,
          idioma,
          paymentCycleRows,
          contractRows,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Error analizando el ciclo de pagos.');
      }
      setCycleReport(data.data);
      onLogAction(
        'Auditoría de Ciclo de Pagos IA',
        `Evaluados ${paymentCycleRows.length} desembolsos reales de ${entityName} (Riesgo: ${data.data.riesgoCiclo})`
      );
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Cycle KPI metrics
  const totalFacturado = paymentCycleRows.reduce((s, r) => s + (Number(r.montoFacturado) || 0), 0);
  const totalRetenido = paymentCycleRows.reduce((s, r) => s + (Number(r.retencionesImpuestos) || 0), 0);
  const totalPagadoNeto = paymentCycleRows.reduce((s, r) => s + (Number(r.montoPagadoNeto) || 0), 0);
  const sinRecepcionCount = paymentCycleRows.filter((r) => !r.tieneRecepcionConduce || r.estadoCiclo === 'SIN_RECEPCION').length;
  const sinComprobanteCount = paymentCycleRows.filter((r) => !r.numeroFacturaEcf.trim() || r.estadoCiclo === 'SIN_COMPROBANTE').length;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-wrap">
              Ciclo Completo de Pagos y Trazabilidad de Desembolsos
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {paymentCycleRows.length} Desembolso(s)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Edita o crea cualquier campo del flujo: Solicitud → Contrato → Recepción → Factura/e-CF → Retenciones → Libramiento/Pago Neto
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir Pago Manual
          </button>
          <button
            type="button"
            onClick={analyzePaymentCycleWithAI}
            disabled={analyzing}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
          >
            {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {analyzing ? 'Analizando Ciclo...' : 'Auditar Ciclo de Pagos con IA'}
          </button>
        </div>
      </div>

      {/* Visual 6-stage Payment Cycle Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
        {[
          { step: '1. Solicitud / OC', val: `${paymentCycleRows.length} reg.`, ok: true },
          { step: '2. Contrato Ref.', val: `${paymentCycleRows.filter((r) => r.contratoId).length} vinc.`, ok: true },
          {
            step: '3. Recepción / Conduce',
            val: sinRecepcionCount > 0 ? `${sinRecepcionCount} sin recep.` : '100% conforme',
            ok: sinRecepcionCount === 0,
          },
          {
            step: '4. Factura / e-CF',
            val: sinComprobanteCount > 0 ? `${sinComprobanteCount} sin e-CF` : 'Validado',
            ok: sinComprobanteCount === 0,
          },
          {
            step: '5. Retenciones Imp.',
            val: formatCurrency(totalRetenido, simboloMoneda),
            ok: true,
          },
          {
            step: '6. Pago Neto Tesorería',
            val: formatCurrency(totalPagadoNeto, simboloMoneda),
            ok: true,
          },
        ].map((stage, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border ${
              stage.ok ? 'bg-slate-950/70 border-slate-800' : 'bg-red-950/30 border-red-800/50'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{stage.step}</span>
              {idx < 5 && <ArrowRight className="w-3 h-3 text-slate-600 hidden lg:block" />}
            </div>
            <div className={`font-mono font-bold text-xs mt-1 ${stage.ok ? 'text-white' : 'text-red-300'}`}>
              {stage.val}
            </div>
          </div>
        ))}
      </div>

      {/* Summary totals bar */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">
          Total Facturado: <strong className="text-white font-mono">{formatCurrency(totalFacturado, simboloMoneda)}</strong>
        </span>
        <span className="text-slate-400">
          Total Retenciones: <strong className="text-amber-300 font-mono">{formatCurrency(totalRetenido, simboloMoneda)}</strong>
        </span>
        <span className="text-slate-400">
          Total Desembolsado Neto: <strong className="text-emerald-400 font-mono">{formatCurrency(totalPagadoNeto, simboloMoneda)}</strong>
        </span>
      </div>

      {errorMsg && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-3 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Editable Payment Cycle Table */}
      {paymentCycleRows.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-700 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
          <FileCheck2 className="w-7 h-7 text-slate-500 mx-auto" />
          <p>
            No hay registros en el Ciclo de Pagos todavía. Puedes añadir filas manualmente con <strong>&quot;Añadir Pago Manual&quot;</strong> o importar un Excel/PDF/Link en el Paso 2.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-[11px] text-slate-200">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-2">Orden / Contrato</th>
                <th className="py-2.5 px-2">Beneficiario / RNC</th>
                <th className="py-2.5 px-2">e-CF / Factura &amp; Fecha</th>
                <th className="py-2.5 px-2 text-center">Recepción</th>
                <th className="py-2.5 px-2">Libramiento / Pago &amp; Banco</th>
                <th className="py-2.5 px-2 text-right">Facturado</th>
                <th className="py-2.5 px-2 text-right">Retención</th>
                <th className="py-2.5 px-2 text-right">Neto Pagado</th>
                <th className="py-2.5 px-2">Estado Ciclo</th>
                <th className="py-2.5 px-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {paymentCycleRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/30 align-top">
                  <td className="p-2 space-y-1 min-w-[125px]">
                    <input
                      type="text"
                      value={row.ordenNumero}
                      onChange={(e) => updateRowField(row.id, 'ordenNumero', e.target.value)}
                      placeholder="OC / Solicitud"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                    <input
                      type="text"
                      value={row.contratoId}
                      onChange={(e) => updateRowField(row.id, 'contratoId', e.target.value)}
                      placeholder="Contrato Ref."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-sky-300"
                    />
                  </td>

                  <td className="p-2 space-y-1 min-w-[165px]">
                    <input
                      type="text"
                      value={row.beneficiario}
                      onChange={(e) => updateRowField(row.id, 'beneficiario', e.target.value)}
                      placeholder="Proveedor / Beneficiario"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                    />
                    <input
                      type="text"
                      value={row.rnc}
                      onChange={(e) => updateRowField(row.id, 'rnc', e.target.value)}
                      placeholder="RNC / Cédula"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-400"
                    />
                  </td>

                  <td className="p-2 space-y-1 min-w-[130px]">
                    <input
                      type="text"
                      value={row.numeroFacturaEcf}
                      onChange={(e) => updateRowField(row.id, 'numeroFacturaEcf', e.target.value)}
                      placeholder="e-CF / NCF"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                    <input
                      type="date"
                      value={row.fechaFactura}
                      onChange={(e) => updateRowField(row.id, 'fechaFactura', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-300"
                    />
                  </td>

                  <td className="p-2 space-y-1 text-center min-w-[115px]">
                    <label className="flex items-center justify-center gap-1.5 cursor-pointer bg-slate-950 border border-slate-800 rounded px-2 py-1">
                      <input
                        type="checkbox"
                        checked={row.tieneRecepcionConduce}
                        onChange={(e) => updateRowField(row.id, 'tieneRecepcionConduce', e.target.checked)}
                        className="accent-emerald-500"
                      />
                      <span className={row.tieneRecepcionConduce ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                        {row.tieneRecepcionConduce ? 'Conduce Sí' : 'Sin Conduce'}
                      </span>
                    </label>
                    <input
                      type="date"
                      value={row.fechaRecepcion}
                      onChange={(e) => updateRowField(row.id, 'fechaRecepcion', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-300"
                    />
                  </td>

                  <td className="p-2 space-y-1 min-w-[140px]">
                    <input
                      type="text"
                      value={row.numeroLibramientoPago}
                      onChange={(e) => updateRowField(row.id, 'numeroLibramientoPago', e.target.value)}
                      placeholder="Libramiento / CK"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    />
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={row.fechaPago}
                        onChange={(e) => updateRowField(row.id, 'fechaPago', e.target.value)}
                        className="w-1/2 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 font-mono text-slate-300"
                      />
                      <input
                        type="text"
                        value={row.bancoCuenta}
                        onChange={(e) => updateRowField(row.id, 'bancoCuenta', e.target.value)}
                        placeholder="Banco"
                        className="w-1/2 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-300"
                      />
                    </div>
                  </td>

                  <td className="p-2 min-w-[105px]">
                    <input
                      type="number"
                      value={row.montoFacturado}
                      onChange={(e) => updateRowField(row.id, 'montoFacturado', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white"
                    />
                  </td>

                  <td className="p-2 min-w-[95px]">
                    <input
                      type="number"
                      value={row.retencionesImpuestos}
                      onChange={(e) => updateRowField(row.id, 'retencionesImpuestos', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-amber-300"
                    />
                  </td>

                  <td className="p-2 min-w-[105px]">
                    <input
                      type="number"
                      value={row.montoPagadoNeto}
                      onChange={(e) => updateRowField(row.id, 'montoPagadoNeto', Number(e.target.value))}
                      className="w-full bg-slate-950 border border-emerald-700/50 rounded px-2 py-1 text-right font-mono font-bold text-emerald-400"
                    />
                  </td>

                  <td className="p-2 space-y-1 min-w-[140px]">
                    <select
                      value={row.estadoCiclo}
                      onChange={(e) => updateRowField(row.id, 'estadoCiclo', e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white"
                    >
                      <option value="COMPLETO">COMPLETO</option>
                      <option value="EN_REVISION">EN_REVISION</option>
                      <option value="SIN_RECEPCION">SIN_RECEPCION</option>
                      <option value="SIN_COMPROBANTE">SIN_COMPROBANTE</option>
                      <option value="PAGO_FRACCIONADO">PAGO_FRACCIONADO</option>
                      <option value="EXCEDE_CONTRATO">EXCEDE_CONTRATO</option>
                      <option value="DUPLICADO">DUPLICADO</option>
                    </select>
                    <input
                      type="text"
                      value={row.observacionPago}
                      onChange={(e) => updateRowField(row.id, 'observacionPago', e.target.value)}
                      placeholder="Nota / Hallazgo..."
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300"
                    />
                  </td>

                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(row.id)}
                      className="p-1.5 rounded bg-slate-950 hover:bg-red-950/70 text-slate-400 hover:text-red-400 border border-slate-800 cursor-pointer"
                      title="Eliminar fila de pago"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Payment Cycle Findings & Control Improvements */}
      {cycleReport && (
        <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Dictamen IA sobre el Ciclo de Pagos y Mejoras de Control
            </h3>
            <span className="font-mono font-bold px-2.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
              Riesgo del Ciclo: {cycleReport.riesgoCiclo}
            </span>
          </div>

          <p className="text-slate-200 leading-relaxed">{cycleReport.resumenCiclo}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-red-900/40 rounded-lg p-3.5 space-y-2">
              <div className="font-bold text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Hallazgos Críticos en Pagos:
              </div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                {(cycleReport.hallazgosCriticos || []).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900 border border-emerald-900/40 rounded-lg p-3.5 space-y-2">
              <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" />
                Mejoras Recomendadas para el Ciclo de Pagos:
              </div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                {(cycleReport.mejorasControlPagos || []).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
