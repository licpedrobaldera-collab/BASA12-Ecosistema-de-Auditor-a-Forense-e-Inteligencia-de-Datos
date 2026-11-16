import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Cell,
} from 'recharts';
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  Scale,
} from 'lucide-react';
import {
  AuditedEntity,
  AuditPeriodScope,
  CcrdStageStatus,
  ContractEvidenceRow,
  DirectorResponsibility,
  DossierSectionItem,
  DuplicityFinding,
  ForensicThresholds,
  HallazgoMatrizLiteral,
  InteractivePreReviewReport,
  LegalReferenceItem,
  ObservacionDecision,
  PaymentCycleRow,
  PreReviewDocType,
} from '../types/forensic';

interface Props {
  activeEntity: AuditedEntity | null;
  paisNormativa: string;
  periodo: AuditPeriodScope;
  hallazgos: HallazgoMatrizLiteral[];
  setHallazgos: React.Dispatch<React.SetStateAction<HallazgoMatrizLiteral[]>>;
  observaciones: ObservacionDecision[];
  ccrdStages: CcrdStageStatus[];
  setCcrdStages: React.Dispatch<React.SetStateAction<CcrdStageStatus[]>>;
  duplicidades: DuplicityFinding[];
  directors: DirectorResponsibility[];
  legalLibrary: LegalReferenceItem[];
  setLegalLibrary: React.Dispatch<React.SetStateAction<LegalReferenceItem[]>>;
  contractRows: ContractEvidenceRow[];
  paymentCycleRows: PaymentCycleRow[];
  thresholds: ForensicThresholds;
  actaLectura: DossierSectionItem;
  informePreliminar: DossierSectionItem;
  recursos: DossierSectionItem[];
  replicas: DossierSectionItem[];
  contraReplicas: DossierSectionItem[];
  preReviewReports: Partial<Record<PreReviewDocType, InteractivePreReviewReport>>;
  onNavigateStep?: (step: number) => void;
  onLogAction: (accion: string, detalle: string) => void;
}

const STAGE_LABELS: Record<1 | 2 | 3 | 4, { short: string; full: string }> = {
  1: { short: 'Etapa 1: Planificación', full: 'Etapa 1: Planificación y Análisis' },
  2: { short: 'Etapa 2: Ejecución', full: 'Etapa 2: Ejecución Sustantiva' },
  3: { short: 'Etapa 3: Comunicación', full: 'Etapa 3: Comunicación de Hallazgos' },
  4: { short: 'Etapa 4: Conclusión', full: 'Etapa 4: Conclusión e Informe Final' },
};

function resolveHallazgoStage(h: HallazgoMatrizLiteral): 1 | 2 | 3 | 4 {
  if (h.etapaCcrd === 1 || h.etapaCcrd === 2 || h.etapaCcrd === 3 || h.etapaCcrd === 4) {
    return h.etapaCcrd;
  }
  const ref = String(h.referenciaExacta || '').toLowerCase();
  if (/etapa\s*1\b/.test(ref)) return 1;
  if (/etapa\s*2\b/.test(ref)) return 2;
  if (/etapa\s*3\b/.test(ref)) return 3;
  if (/etapa\s*4\b/.test(ref)) return 4;

  const factBlob = `${h.titulo || ''} ${h.condicionLiteral || ''}`.toLowerCase();
  if (/acta de lectura|recurso|r[eé]plica|contra-r[eé]plica|descargo|comunicaci[oó]n de hallazgo|debido proceso/.test(factBlob)) {
    return 3;
  }
  if (/informe final|seguimiento a recomendaci|cierre de auditor|dictamen final|revisi[oó]n previa/.test(factBlob)) {
    return 4;
  }
  if (/planificaci[oó]n estrat|\bpei\b|\bpacc\b|plan anual de compras|manual de cargos|manual de procedimientos|estructura organizativa|organigrama|acreditaci[oó]n|credencial/.test(factBlob)) {
    return 1;
  }
  if (/conciliaci|tesorer|banco|pago|libramiento|orden de compra|recepci[oó]n|almac[eé]n|inventario|activo fijo|n[oó]mina|vi[aá]tico|obra|contrato|adenda|factura|e-cf|combustible|flota|acceso l[oó]gico|respaldo/.test(factBlob)) {
    return 2;
  }
  return 2;
}

export const InstitutionalRiskDashboardSection: React.FC<Props> = ({
  activeEntity,
  paisNormativa,
  periodo,
  hallazgos,
  setHallazgos,
  observaciones,
  ccrdStages,
  setCcrdStages,
  duplicidades,
  directors,
  legalLibrary,
  setLegalLibrary,
  contractRows,
  paymentCycleRows,
  thresholds,
  actaLectura,
  informePreliminar,
  recursos,
  replicas,
  contraReplicas,
  preReviewReports,
  onNavigateStep,
  onLogAction,
}) => {
  const [selectedStageFilter, setSelectedStageFilter] = useState<'ALL' | 1 | 2 | 3 | 4>('ALL');
  const [remediating, setRemediating] = useState(false);
  const [remediationError, setRemediationError] = useState<string | null>(null);
  const [remediationReport, setRemediationReport] = useState<{
    resumen: string;
    correcciones: string[];
    brechas: string[];
    modelUsed: string;
    timestamp: string;
  } | null>(null);

  const metrics = useMemo(() => {
    const hasAnyEvidence =
      hallazgos.length > 0 ||
      contractRows.length > 0 ||
      paymentCycleRows.length > 0 ||
      observaciones.length > 0 ||
      directors.length > 0 ||
      legalLibrary.length > 0;

    // 1. Findings grouped by the 4 CCRD Guía Stages
    const stageData = ([1, 2, 3, 4] as const).map((step) => {
      const items = hallazgos.filter((h) => resolveHallazgoStage(h) === step);
      const correctos = items.filter((h) => h.estado === 'Correcto / Cumple').length;
      const criticos = items.filter(
        (h) => h.estado !== 'Correcto / Cumple' && h.nivelRiesgo === 'Alto (Crítico)'
      ).length;
      const moderados = items.filter(
        (h) => h.estado !== 'Correcto / Cumple' && h.nivelRiesgo !== 'Alto (Crítico)'
      ).length;
      const avgNote =
        items.length > 0
          ? Math.round(
              (items.reduce((acc, i) => acc + (Number(i.puntaje0a10) || 0), 0) / items.length) * 10
            )
          : 0;
      const stageMeta = ccrdStages.find((s) => s.step === step);

      return {
        step,
        name: STAGE_LABELS[step].short,
        fullName: STAGE_LABELS[step].full,
        total: items.length,
        cumple: correctos,
        moderado: moderados,
        critico: criticos,
        cumplimientoEtapaPct: avgNote,
        stageStatus: stageMeta?.status || (items.length > 0 ? 'En Proceso' : 'Pendiente'),
      };
    });

    // 2. Normative Compliance Percentage (Blindaje Institucional 0-100%)
    // Dimension A: Hallazgos CCRD & NOBACI (Puntaje 0-10 + Criterio + Recomendación 60-90)
    let matrizPct = 0;
    if (hallazgos.length > 0) {
      const sumQuality = hallazgos.reduce((acc, h) => {
        const scorePart = Math.min(10, Math.max(0, Number(h.puntaje0a10) || 0)) * 5; // max 50
        const hasCrit = h.criterioTexto?.trim().length > 10 ? 20 : 0;
        const hasRec = h.recomendacionSupervisor?.trim().length > 20 ? 20 : 0;
        const hasLaws = (h.leyesCitadas?.length || 0) > 0 ? 10 : 0;
        return acc + scorePart + hasCrit + hasRec + hasLaws;
      }, 0);
      matrizPct = Math.round(sumQuality / hallazgos.length);
    }

    // Dimension B: Contratos & Ciclo de Pagos
    const totalFinancial = contractRows.length + paymentCycleRows.length;
    let financialPct = 0;
    if (totalFinancial > 0) {
      const cleanContracts = contractRows.filter(
        (c) => !c.esAnomalo && c.adendaPct <= thresholds.adendaMaxPct
      ).length;
      const cleanPayments = paymentCycleRows.filter(
        (p) => p.estadoCiclo === 'COMPLETO' || p.estadoCiclo === 'EN_REVISION'
      ).length;
      financialPct = Math.round(((cleanContracts + cleanPayments) / totalFinancial) * 100);
    } else if (hallazgos.length > 0) {
      // If audit is documentary (no raw contract/payment spreadsheet uploaded), use documentary compliance ratio
      const okCount = hallazgos.filter((h) => h.estado === 'Correcto / Cumple').length;
      financialPct = Math.round((okCount / hallazgos.length) * 100);
    }

    // Dimension C: Etapas Guía CCRD + Revisión Previa + Contradictorio Ley 18-24
    const stagesWeight = ccrdStages.reduce((acc, s) => {
      if (s.status === 'Completado') return acc + 25;
      if (s.status === 'En Proceso') return acc + 12.5;
      return acc;
    }, 0);
    const hasActa = actaLectura.contenido.trim().length >= 25;
    const preRevVals = Object.values(preReviewReports || {}).filter(Boolean);
    const preRevAvg =
      preRevVals.length > 0
        ? Math.round(
            preRevVals.reduce((acc, r) => acc + (r?.puntuacionPreparacion || 0), 0) /
              preRevVals.length
          )
        : 0;
    const etapasPct = Math.min(
      100,
      Math.round(
        (stagesWeight > 0 ? stagesWeight : hallazgos.length > 0 ? 45 : 0) * 0.65 +
          (hasActa ? 15 : 0) +
          preRevAvg * 0.2
      )
    );

    // Dimension D: Directores + Biblioteca Legal + Control Duplicidades
    let legalAndDirPct = 0;
    if (hasAnyEvidence) {
      const dirScore =
        directors.length === 0
          ? 0
          : directors.every((d) => d.fuentes.length > 0)
          ? 40
          : 25;
      const libScore = legalLibrary.length >= 3 ? 40 : legalLibrary.length * 13;
      const unresolvedDups = duplicidades.filter((d) => !d.incluidoEnObservaciones).length;
      const dupScore = unresolvedDups === 0 ? 20 : Math.max(0, 20 - unresolvedDups * 7);
      legalAndDirPct = Math.min(100, dirScore + libScore + dupScore);
    }

    const blindajeGlobalPct = !hasAnyEvidence
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(matrizPct * 0.4 + financialPct * 0.2 + etapasPct * 0.2 + legalAndDirPct * 0.2)
          )
        );

    const dimensionBreakdown = [
      { name: 'Matriz 3.01+ / NOBACI', porcentaje: matrizPct, fill: '#0ea5e9' },
      { name: 'Contratos y Pagos', porcentaje: financialPct, fill: '#10b981' },
      { name: 'Guía CCRD y QA', porcentaje: etapasPct, fill: '#6366f1' },
      { name: 'Directores y Leyes', porcentaje: legalAndDirPct, fill: '#f59e0b' },
    ];

    const gaugeColor =
      blindajeGlobalPct >= 85
        ? '#10b981'
        : blindajeGlobalPct >= 65
        ? '#0ea5e9'
        : blindajeGlobalPct >= 40
        ? '#f59e0b'
        : '#f43f5e';

    const blindajeLabel = !hasAnyEvidence
      ? 'Sin evidencias cargadas'
      : blindajeGlobalPct >= 85
      ? 'Blindaje Óptimo (Apto Remisión CCRD)'
      : blindajeGlobalPct >= 65
      ? 'Blindaje Moderado — Subsanación Recomendada'
      : 'Riesgo Institucional Alto — Requiere Corrección Integral';

    return {
      hasAnyEvidence,
      stageData,
      blindajeGlobalPct,
      gaugeColor,
      blindajeLabel,
      dimensionBreakdown,
    };
  }, [
    hallazgos,
    observaciones,
    ccrdStages,
    duplicidades,
    directors,
    legalLibrary,
    contractRows,
    paymentCycleRows,
    thresholds.adendaMaxPct,
    actaLectura.contenido,
    preReviewReports,
  ]);

  const filteredHallazgos = useMemo(() => {
    if (selectedStageFilter === 'ALL') return hallazgos;
    return hallazgos.filter((h) => resolveHallazgoStage(h) === selectedStageFilter);
  }, [hallazgos, selectedStageFilter]);

  const handleAssignStage = (id: string, nextStage: 1 | 2 | 3 | 4) => {
    setHallazgos((prev) =>
      prev.map((h) => (h.id === id ? { ...h, etapaCcrd: nextStage } : h))
    );
  };

  const handleRunIntegralRemediation = async () => {
    setRemediating(true);
    setRemediationError(null);
    try {
      const resp = await fetch('/api/forensic/remediate-integral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: activeEntity,
          paisNormativa,
          periodo,
          hallazgos,
          observaciones,
          ccrdStages,
          duplicidades,
          directors,
          legalLibrary,
          contractRows,
          paymentCycleRows,
          actaLectura,
          informePreliminar,
          recursos,
          replicas,
          contraReplicas,
          preReviewReports,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'No se pudo ejecutar la corrección integral.');
      }

      if (Array.isArray(data.hallazgos)) {
        setHallazgos(data.hallazgos);
      }
      if (Array.isArray(data.ccrdStages)) {
        setCcrdStages(data.ccrdStages);
      }
      if (Array.isArray(data.newLegalItems) && data.newLegalItems.length > 0) {
        setLegalLibrary((prev) => {
          const existingKeys = new Set(
            prev.map((l) => l.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, ''))
          );
          const uniqueAdditions = data.newLegalItems.filter(
            (n: LegalReferenceItem) =>
              !existingKeys.has(n.numeroNorma.toLowerCase().replace(/[^a-z0-9]/g, ''))
          );
          return [...prev, ...uniqueAdditions].sort((a, b) => a.jerarquiaOrden - b.jerarquiaOrden);
        });
      }

      setRemediationReport({
        resumen: data.resumenEjecutivoIA || 'Corrección técnica integral aplicada.',
        correcciones: Array.isArray(data.correccionesAplicadas) ? data.correccionesAplicadas : [],
        brechas: Array.isArray(data.brechasPendientes) ? data.brechasPendientes : [],
        modelUsed: data.modelUsed || 'gemini-4-hydrogen',
        timestamp: data.timestamp || new Date().toISOString(),
      });

      onLogAction(
        'Corrección Integral IA (Paso 5)',
        `Actualizados ${(data.hallazgos || []).length} hallazgos, 4 etapas Guía CCRD y ${(data.newLegalItems || []).length} norma(s) vinculadas.`
      );
    } catch (err: any) {
      setRemediationError(err.message || 'Error ejecutando la corrección integral IA.');
    } finally {
      setRemediating(false);
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Paso 5</span>
            <span aria-hidden="true">·</span>
            <span>Guía CCRD (Ley núm. 18-24)</span>
            <span aria-hidden="true">·</span>
            <span>{activeEntity ? activeEntity.siglas : 'Entidad Activa'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Dashboard de Riesgos Institucionales
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
            Distribución visual de hallazgos por etapas de la Guía CCRD y porcentaje real de cumplimiento normativo (blindaje institucional).
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunIntegralRemediation}
          disabled={remediating}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-colors"
        >
          {remediating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {remediating
            ? 'Aplicando Corrección Integral...'
            : 'Aplicar IA Integral Full (Corregir Fallas 100/100)'}
        </button>
      </div>

      {remediationError && (
        <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-3.5 text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{remediationError}</span>
        </div>
      )}

      {/* Main Recharts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 cols: BarChart Distribution by CCRD Stages */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Distribución de Hallazgos por Etapas de la Guía CCRD
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                {hallazgos.length} hallazgo(s) distribuidos entre Planificación, Ejecución, Comunicación y Conclusión
              </p>
            </div>
          </div>

          <div className="w-full h-[270px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.stageData}
                margin={{ top: 12, right: 12, left: -12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                <Bar
                  dataKey="cumple"
                  name="Cumple / Correcto"
                  stackId="a"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="moderado"
                  name="Con Observación (Medio/Bajo)"
                  stackId="a"
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="critico"
                  name="Riesgo Alto / Crítico"
                  stackId="a"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Stage Metadata Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
            {metrics.stageData.map((s) => (
              <div key={s.step} className="space-y-0.5">
                <div className="text-slate-300 font-semibold truncate">{s.name}</div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {s.total} hallazgo(s) · {s.stageStatus}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 cols: Normative Compliance Gauge & Breakdown */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 min-w-0">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Porcentaje de Cumplimiento Normativo (Blindaje)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Índice consolidado obtenido en la auditoría sobre datos reales
            </p>
          </div>

          <div className="relative w-full h-[175px] flex items-center justify-center min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="74%"
                innerRadius="72%"
                outerRadius="105%"
                barSize={18}
                data={[{ name: 'Blindaje', value: metrics.blindajeGlobalPct, fill: metrics.gaugeColor }]}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: '#1e293b' }}
                  dataKey="value"
                  cornerRadius={8}
                />
              </RadialBarChart>
            </ResponsiveContainer>

            <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
              <div className="text-4xl font-extrabold font-mono tabular-nums text-white tracking-tight">
                {metrics.blindajeGlobalPct}%
              </div>
              <div className="text-xs font-medium text-slate-300 mt-0.5">
                {metrics.blindajeLabel}
              </div>
            </div>
          </div>

          {/* 4-Dimension Horizontal Breakdown Recharts */}
          <div className="w-full h-[135px] min-w-0 pt-2 border-t border-slate-800/80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.dimensionBreakdown}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 10, bottom: 0 }}
              >
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  tick={{ fill: '#cbd5e1', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, 'Cumplimiento']}
                  contentStyle={{
                    backgroundColor: '#020617',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="porcentaje" radius={[0, 6, 6, 0]} barSize={14}>
                  {metrics.dimensionBreakdown.map((entry, idx) => (
                    <Cell key={`dim-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Remediation Audit Summary (After clicking Aplicar IA Integral) */}
      {remediationReport && (
        <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="font-bold text-emerald-300 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Diagnóstico y Corrección Integral Aplicada
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {remediationReport.modelUsed} · {new Date(remediationReport.timestamp).toLocaleTimeString('es-DO')}
            </div>
          </div>

          <p className="text-slate-200 leading-relaxed">{remediationReport.resumen}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            <div className="space-y-2">
              <div className="font-semibold text-emerald-300">Correcciones Técnicas Aplicadas</div>
              <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                {remediationReport.correcciones.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-amber-300">
                Brechas Documentales Pendientes del Titular / Auditor
              </div>
              {remediationReport.brechas.length === 0 ? (
                <p className="text-emerald-300">
                  Expediente documental completo sin brechas estructurales pendientes.
                </p>
              ) : (
                <ul className="space-y-1.5 text-amber-200/90 list-disc pl-4">
                  {remediationReport.brechas.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Reclassification & Inspection Table */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Scale className="w-4 h-4 text-sky-400" />
            Control de Hallazgos por Etapa Guía CCRD
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg flex-wrap">
            {[
              { id: 'ALL', label: `Todos (${hallazgos.length})` },
              { id: 1, label: 'Etapa 1' },
              { id: 2, label: 'Etapa 2' },
              { id: 3, label: 'Etapa 3' },
              { id: 4, label: 'Etapa 4' },
            ].map((tab) => (
              <button
                key={String(tab.id)}
                type="button"
                onClick={() => setSelectedStageFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  selectedStageFilter === tab.id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHallazgos.length === 0 ? (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400 space-y-2">
            <p>
              No hay hallazgos registrados en esta vista. Extraiga hallazgos reales desde el Paso 2 o Paso 4 (Matriz Literal 3.01+).
            </p>
            {onNavigateStep && (
              <button
                type="button"
                onClick={() => onNavigateStep(4)}
                className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
              >
                Ir al Paso 4 (Matriz CCRD) <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Código</th>
                  <th className="py-2.5 px-3 font-semibold">Acápite / Hallazgo</th>
                  <th className="py-2.5 px-3 font-semibold">Etapa CCRD</th>
                  <th className="py-2.5 px-3 font-semibold">Riesgo / Estado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/50">
                {filteredHallazgos.slice(0, 25).map((h) => {
                  const stageNum = resolveHallazgoStage(h);
                  return (
                    <tr key={h.id} className="hover:bg-slate-900/60">
                      <td className="py-2.5 px-3 font-mono font-semibold text-amber-300 whitespace-nowrap">
                        {h.idHallazgo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-md truncate">
                        {h.titulo}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <select
                          value={stageNum}
                          onChange={(e) =>
                            handleAssignStage(h.id, Number(e.target.value) as 1 | 2 | 3 | 4)
                          }
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-sky-300 cursor-pointer"
                        >
                          <option value={1}>Etapa 1: Planificación</option>
                          <option value={2}>Etapa 2: Ejecución</option>
                          <option value={3}>Etapa 3: Comunicación</option>
                          <option value={4}>Etapa 4: Conclusión</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                        {h.estado} · {h.nivelRiesgo || 'Medio'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-sky-300 font-semibold whitespace-nowrap">
                        {(Number(h.puntaje0a10) || 0).toFixed(1)}/10
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
