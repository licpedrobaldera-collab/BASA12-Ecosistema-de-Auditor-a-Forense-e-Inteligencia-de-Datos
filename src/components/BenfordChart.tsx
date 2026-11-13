import React, { useState, useEffect } from 'react';
import { BarChart3, AlertTriangle, TrendingUp } from 'lucide-react';
import { BenfordDigitResult, ContractEvidenceRow } from '../types/forensic';

interface Props {
  contractRows: ContractEvidenceRow[];
  adendaThresholdPct?: number;
  benfordMaxDeviationPct?: number;
  evidenceNumericAmounts?: number[];
}

export const BenfordChart: React.FC<Props> = ({
  contractRows,
  adendaThresholdPct = 50,
  benfordMaxDeviationPct = 5.0,
  evidenceNumericAmounts = [],
}) => {
  const [benfordData, setBenfordData] = useState<BenfordDigitResult[]>([]);
  const [totalAnalyzed, setTotalAnalyzed] = useState<number>(0);
  const [loadingBenford, setLoadingBenford] = useState(false);

  useEffect(() => {
    fetchBenfordAnalysis();
  }, [contractRows, evidenceNumericAmounts]);

  const fetchBenfordAnalysis = async () => {
    setLoadingBenford(true);
    try {
      const contractAmounts = contractRows
        .map((c) => c.montoOriginal)
        .concat(contractRows.map((c) => c.montoAdenda))
        .filter((n) => n > 0);

      const combined =
        evidenceNumericAmounts && evidenceNumericAmounts.length >= 10
          ? [...evidenceNumericAmounts, ...contractAmounts]
          : contractAmounts;

      const res = await fetch('/api/forensic/benford', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: combined }),
      });
      const data = await res.json();
      if (data.success) {
        setBenfordData(data.distribution);
        setTotalAnalyzed(data.totalAnalyzed || combined.length);
      }
    } catch (e) {
      console.error('Error fetching Benford:', e);
    } finally {
      setLoadingBenford(false);
    }
  };

  const adendasOverThreshold = contractRows.filter((c) => c.adendaPct > adendaThresholdPct).length;
  const pctAnomalousContracts = contractRows.length > 0 ? (adendasOverThreshold / contractRows.length) * 100 : 0;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
            📊
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Análisis Estadístico y Prueba de Ley de Benford
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Frecuencia de Primer Dígito
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Evaluación biométrica de datos contables para detectar fabricación de cifras
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Benford Chart */}
        <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              Comparativa: Frecuencia Observada vs Teórica (Ley de Benford)
            </h3>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-3 h-3 bg-sky-500 rounded-sm" /> Observado
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-3 h-0.5 bg-amber-400 rounded-sm" /> Teórico Benford
              </span>
            </div>
          </div>

          {loadingBenford ? (
            <div className="py-12 text-center text-xs text-slate-400">Calculando frecuencias...</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-9 gap-2 items-end h-44 pt-4 border-b border-slate-800">
                {benfordData.map((d) => {
                  const maxBarHeight = 130; // max px
                  const observedHeight = (d.observedPct / 40) * maxBarHeight;
                  const theoreticalHeight = (d.expectedPct / 40) * maxBarHeight;
                  const isAnomaly = Math.abs(d.diff) > benfordMaxDeviationPct;

                  return (
                    <div key={d.digit} className="flex flex-col items-center h-full justify-end group">
                      <div className="text-[10px] font-mono text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.observedPct}%
                      </div>
                      <div className="w-full flex items-end justify-center relative">
                        {/* Observed bar */}
                        <div
                          className={`w-4/5 rounded-t transition-all ${
                            isAnomaly ? 'bg-red-500 shadow-sm shadow-red-500/50' : 'bg-sky-500'
                          }`}
                          style={{ height: `${Math.min(maxBarHeight, Math.max(8, observedHeight))}px` }}
                          title={`Dígito ${d.digit}: Observado ${d.observedPct}% (Dif: ${d.diff > 0 ? '+' : ''}${d.diff}% vs límite ±${benfordMaxDeviationPct}%)`}
                        />
                        {/* Theoretical benchmark line */}
                        <div
                          className="absolute w-full border-t-2 border-amber-400 border-dashed"
                          style={{ bottom: `${Math.min(maxBarHeight, theoreticalHeight)}px` }}
                          title={`Teórico Benford: ${d.expectedPct}%`}
                        />
                      </div>
                      <div className="mt-2 text-xs font-mono font-bold text-slate-300">
                        {d.digit}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Dígitos del 1 al 9 ({totalAnalyzed} valores financieros analizados)</span>
                <span className="text-amber-400 font-medium">Línea discontinua = Distribución esperada (Tolerancia: ±{benfordMaxDeviationPct}%)</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Contract adendas summary */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Riesgo de Adendas Críticas (&gt;{adendaThresholdPct}%)
            </h3>

            <div className="text-center py-4 bg-slate-900 rounded-lg border border-slate-800">
              <div className="text-3xl font-extrabold font-mono text-red-400">
                {pctAnomalousContracts.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-400 mt-1">
                de los contratos auditados violan el umbral configurado del {adendaThresholdPct}%
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>Total contratos analizados:</span>
                <strong className="text-white font-mono">{contractRows.length}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>Adendas &gt; {adendaThresholdPct}% detectadas:</span>
                <strong className="text-red-400 font-mono">{adendasOverThreshold}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
                <span>Límite Legal (Ley 340-06):</span>
                <strong className="text-amber-300 font-mono">Máx. 25% / 50%</strong>
              </div>
            </div>
          </div>

          <div className="bg-red-950/40 border border-red-900/50 p-3 rounded text-[11px] text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>
              La concentración de adendas superiores al {adendaThresholdPct}% constituye indicio de colusión o deficiencia estructural en los pliegos de condiciones iniciales.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
