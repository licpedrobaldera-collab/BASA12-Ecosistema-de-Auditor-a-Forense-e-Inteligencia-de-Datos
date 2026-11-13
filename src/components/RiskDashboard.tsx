import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  DollarSign,
  Activity,
  Scale,
  Sliders,
  TrendingUp,
  FileWarning,
  CheckCircle2,
} from 'lucide-react';
import {
  ContractEvidenceRow,
  ForensicThresholds,
  RealtimeAlert,
  ForensicAnalysisResult,
  PaymentCycleRow,
} from '../types/forensic';
import { formatCurrency } from '../utils/entities';

interface Props {
  contractRows: ContractEvidenceRow[];
  paymentCycleRows?: PaymentCycleRow[];
  thresholds: ForensicThresholds;
  realtimeAlerts: RealtimeAlert[];
  onOpenThresholds: () => void;
  currentResult?: ForensicAnalysisResult | null;
  simboloMoneda?: string;
}

export const RiskDashboard: React.FC<Props> = ({
  contractRows,
  paymentCycleRows = [],
  thresholds,
  realtimeAlerts,
  onOpenThresholds,
  currentResult,
  simboloMoneda = 'RD$',
}) => {
  const hasRecords = contractRows.length > 0 || paymentCycleRows.length > 0;

  const anomalousContracts = contractRows.filter(
    (c) => c.adendaPct > thresholds.adendaMaxPct || c.esAnomalo
  );
  const anomalousPayments = paymentCycleRows.filter(
    (p) => p.estadoCiclo !== 'COMPLETO' && p.estadoCiclo !== 'EN_REVISION'
  );

  const totalOriginalBudget = contractRows.reduce((acc, c) => acc + c.montoOriginal, 0);
  const totalAdendasAmount = contractRows.reduce((acc, c) => acc + c.montoAdenda, 0);
  const totalPaymentsAmount = paymentCycleRows.reduce((acc, p) => acc + (p.montoPagadoNeto || 0), 0);

  const totalExposedFinancialRisk =
    anomalousContracts.reduce((acc, c) => acc + c.montoAdenda, 0) +
    anomalousPayments.reduce((acc, p) => acc + (p.montoPagadoNeto || p.montoFacturado || 0), 0);

  const highestExposureContract = [...anomalousContracts].sort(
    (a, b) => b.montoAdenda - a.montoAdenda
  )[0];

  const criticalCount = realtimeAlerts.filter((a) => a.severidad === 'CRÍTICA').length;
  const highCount = realtimeAlerts.filter((a) => a.severidad === 'ALTA').length;
  const mediumCount = realtimeAlerts.filter((a) => a.severidad === 'MEDIA').length;

  let riskScore = 0;
  if (hasRecords) {
    const totalCount = contractRows.length + paymentCycleRows.length;
    const totalAnom = anomalousContracts.length + anomalousPayments.length;
    const ratioAnomalous = totalCount > 0 ? totalAnom / totalCount : 0;
    const basePool = totalOriginalBudget + totalPaymentsAmount;
    const ratioFinancialExposure = basePool > 0 ? totalExposedFinancialRisk / basePool : 0;

    if (totalAnom === 0 && criticalCount === 0 && highCount === 0) {
      riskScore = 8;
    } else {
      const rawScore = Math.round(
        ratioAnomalous * 50 + ratioFinancialExposure * 35 + (criticalCount > 0 ? 15 : 5)
      );
      riskScore = Math.min(98, Math.max(15, rawScore));
    }
  }

  let riskLevel: 'SIN DATOS' | 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO' = !hasRecords ? 'SIN DATOS' : 'BAJO';
  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  let meterColor = 'from-slate-600 to-slate-500';

  if (hasRecords) {
    if (riskScore >= 75) {
      riskLevel = 'CRÍTICO';
      badgeColor = 'bg-red-500/20 text-red-400 border-red-500/40';
      meterColor = 'from-red-600 via-rose-500 to-amber-500';
    } else if (riskScore >= 50) {
      riskLevel = 'ALTO';
      badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      meterColor = 'from-amber-500 to-orange-400';
    } else if (riskScore >= 25) {
      riskLevel = 'MEDIO';
      badgeColor = 'bg-sky-500/20 text-sky-400 border-sky-500/40';
      meterColor = 'from-sky-500 to-indigo-400';
    } else {
      riskLevel = 'BAJO';
      badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      meterColor = 'from-emerald-500 to-teal-400';
    }
  }

  const formatVal = (val: number) => formatCurrency(val, simboloMoneda);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold text-lg shadow-inner">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Tablero de Riesgo Forense Integral
              </h2>
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}
              >
                {riskLevel}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cálculo en tiempo real sobre contratos ({contractRows.length}) y ciclo de pagos ({paymentCycleRows.length}) de la entidad activa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 hidden md:inline">
            Corte Adendas: <strong className="text-sky-300">&gt;{thresholds.adendaMaxPct}%</strong>
          </span>
          <button
            type="button"
            onClick={onOpenThresholds}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            Calibrar Umbrales
          </button>
        </div>
      </div>

      {/* 4 Key Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Widget 1: Score */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Score de Riesgo
            </span>
            <span className="text-[10px] font-mono text-slate-500">Escala 0-100</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
              {riskScore}
            </span>
            <span className="text-xs font-mono text-slate-500">/ 100</span>
            <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
              {riskLevel}
            </span>
          </div>

          <div className="space-y-1">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${meterColor} transition-all duration-500`}
                style={{ width: `${riskScore}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 (Limpio)</span>
              <span>50 (Moderado)</span>
              <span>100 (Crítico)</span>
            </div>
          </div>
        </div>

        {/* Widget 2: Financial Exposure */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Exposición Detectada
            </span>
            <span className="text-[10px] font-mono text-red-400 font-semibold">
              {anomalousContracts.length + anomalousPayments.length} reg.
            </span>
          </div>

          <div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-amber-400 tracking-tight">
              {formatVal(totalExposedFinancialRisk)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Adendas &gt;{thresholds.adendaMaxPct}% y pagos observados
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex justify-between">
            <span>Volumen auditado:</span>
            <strong className="text-slate-200 font-mono">
              {formatVal(totalOriginalBudget + totalAdendasAmount + totalPaymentsAmount)}
            </strong>
          </div>
        </div>

        {/* Widget 3: Alerts */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-sky-400" />
              Alertas Activas
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
              {realtimeAlerts.length}
            </span>
            <span className="text-xs text-slate-400">alertas sobre datos reales</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
            <div className="bg-red-950/50 border border-red-900/50 rounded py-1 text-red-300">
              <div className="font-bold text-xs text-red-400">{criticalCount}</div>
              <span>Críticas</span>
            </div>
            <div className="bg-amber-950/50 border border-amber-900/50 rounded py-1 text-amber-300">
              <div className="font-bold text-xs text-amber-400">{highCount}</div>
              <span>Altas</span>
            </div>
            <div className="bg-sky-950/50 border border-sky-900/50 rounded py-1 text-sky-300">
              <div className="font-bold text-xs text-sky-400">{mediumCount}</div>
              <span>Medias</span>
            </div>
          </div>
        </div>

        {/* Widget 4: Normative status */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-purple-400" />
              Control Normativo
            </span>
            <span className="text-[10px] font-mono text-purple-400">NIA 240</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1">
                <FileWarning className="w-3 h-3 text-red-400" /> Adendas Contractuales:
              </span>
              <span
                className={`font-semibold font-mono ${
                  !hasRecords
                    ? 'text-slate-500'
                    : anomalousContracts.length > 0
                    ? 'text-red-400'
                    : 'text-emerald-400'
                }`}
              >
                {!hasRecords ? 'SIN DATOS' : anomalousContracts.length > 0 ? 'VULNERADA' : 'CONFORME'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-amber-400" /> Ciclo de Pagos:
              </span>
              <span
                className={`font-semibold font-mono ${
                  paymentCycleRows.length === 0
                    ? 'text-slate-500'
                    : anomalousPayments.length > 0
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {paymentCycleRows.length === 0
                  ? 'SIN DATOS'
                  : anomalousPayments.length > 0
                  ? `${anomalousPayments.length} ALERTA(S)`
                  : 'CONFORME'}
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Cadena de Custodia:
              </span>
              <span className="font-semibold text-emerald-400 font-mono">ISO 27037</span>
            </div>
          </div>
        </div>
      </div>

      {anomalousContracts.length > 0 && highestExposureContract && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Alerta Principal:</strong> El contrato{' '}
              <span className="font-mono font-bold text-red-300">
                {highestExposureContract.contratoId}
              </span>{' '}
              ({highestExposureContract.proveedor}) acumula adendas por{' '}
              <strong className="text-white font-mono">
                {formatVal(highestExposureContract.montoAdenda)}
              </strong>{' '}
              (+{highestExposureContract.adendaPct.toFixed(1)}%).
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-800/50 px-2.5 py-1 rounded-md">
              {currentResult?.metricasRiesgo?.accionInmediata || 'Verificación Documental en Sitio'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
