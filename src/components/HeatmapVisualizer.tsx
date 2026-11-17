import React, { useMemo } from 'react';
import {
  ArrowDownUp,
  CheckCircle2,
  Filter,
  Flame,
  LayoutGrid,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { HallazgoMatrizLiteral } from '../types/forensic';

export type SeverityFilterBand = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OPTIMAL';

export interface HeatmapStyleInfo {
  band: Exclude<SeverityFilterBand, 'ALL'>;
  label: string;
  cellClass: string;
  badgeClass: string;
  barColor: string;
  hexColor: string;
}

export const getSeverityBand = (scoreRaw: number): Exclude<SeverityFilterBand, 'ALL'> => {
  const score = Number(scoreRaw) || 0;
  if (score < 5.0) return 'CRITICAL';
  if (score < 6.5) return 'HIGH';
  if (score < 8.0) return 'MEDIUM';
  return 'OPTIMAL';
};

export const getHeatmapStyle = (scoreRaw: number): HeatmapStyleInfo => {
  const score = Number(scoreRaw) || 0;
  if (score < 3.0) {
    return {
      band: 'CRITICAL',
      label: 'CRÍTICO EXTREMO',
      cellClass:
        'bg-red-950/90 border-red-500/80 text-red-100 hover:border-red-400',
      badgeClass: 'bg-red-600 text-white',
      barColor: '#ef4444',
      hexColor: '#dc2626',
    };
  }
  if (score < 5.0) {
    return {
      band: 'CRITICAL',
      label: 'CRÍTICO',
      cellClass:
        'bg-red-900/45 border-red-500/60 text-red-100 hover:border-red-400',
      badgeClass: 'bg-red-500/30 text-red-200 border border-red-500/50',
      barColor: '#f87171',
      hexColor: '#ef4444',
    };
  }
  if (score < 6.5) {
    return {
      band: 'HIGH',
      label: 'ALTO',
      cellClass:
        'bg-orange-950/55 border-orange-500/50 text-orange-100 hover:border-orange-400',
      badgeClass: 'bg-orange-500/25 text-orange-200 border border-orange-500/45',
      barColor: '#fb923c',
      hexColor: '#f97316',
    };
  }
  if (score < 8.0) {
    return {
      band: 'MEDIUM',
      label: 'MODERADO',
      cellClass:
        'bg-amber-950/45 border-amber-500/45 text-amber-100 hover:border-amber-400',
      badgeClass: 'bg-amber-500/20 text-amber-200 border border-amber-500/40',
      barColor: '#fbbf24',
      hexColor: '#f59e0b',
    };
  }
  return {
    band: 'OPTIMAL',
    label: 'ÓPTIMO',
    cellClass:
      'bg-emerald-950/45 border-emerald-500/45 text-emerald-100 hover:border-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40',
    barColor: '#34d399',
    hexColor: '#10b981',
  };
};

interface HeatmapVisualizerProps {
  hallazgos: HallazgoMatrizLiteral[];
  severityFilter: SeverityFilterBand;
  onSeverityFilterChange: (band: SeverityFilterBand) => void;
  sortBySeverity: boolean;
  onToggleSortBySeverity: () => void;
  highlightedHallazgoId: string | null;
  onSelectHallazgo: (
    hallazgo: HallazgoMatrizLiteral,
    band: Exclude<SeverityFilterBand, 'ALL'>
  ) => void;
}

export const HeatmapVisualizer: React.FC<HeatmapVisualizerProps> = ({
  hallazgos,
  severityFilter,
  onSeverityFilterChange,
  sortBySeverity,
  onToggleSortBySeverity,
  highlightedHallazgoId,
  onSelectHallazgo,
}) => {
  const { counts, sortedItems, criticalPct, avgScore, spectrumSegments } = useMemo(() => {
    const bandCounts: Record<Exclude<SeverityFilterBand, 'ALL'>, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      OPTIMAL: 0,
    };

    let sumScore = 0;
    hallazgos.forEach((h) => {
      const score = Math.max(0, Math.min(10, Number(h.puntaje0a10) || 0));
      sumScore += score;
      bandCounts[getSeverityBand(score)] += 1;
    });

    const sorted = [...hallazgos].sort((a, b) =>
      sortBySeverity
        ? (Number(a.puntaje0a10) || 0) - (Number(b.puntaje0a10) || 0)
        : 0
    );

    const total = hallazgos.length;
    const critRatio = total > 0 ? Math.round((bandCounts.CRITICAL / total) * 100) : 0;
    const average = total > 0 ? sumScore / total : 0;

    // Stacked distribution ordered from Green (Óptimo / Bajo riesgo) -> Amber -> Orange -> Red (Crítico)
    const orderedBands: Array<{
      key: Exclude<SeverityFilterBand, 'ALL'>;
      count: number;
      color: string;
      label: string;
    }> = [
      { key: 'OPTIMAL', count: bandCounts.OPTIMAL, color: '#10b981', label: 'Óptimo (8.0–10.0)' },
      { key: 'MEDIUM', count: bandCounts.MEDIUM, color: '#f59e0b', label: 'Moderado (6.5–7.9)' },
      { key: 'HIGH', count: bandCounts.HIGH, color: '#f97316', label: 'Alto (5.0–6.4)' },
      { key: 'CRITICAL', count: bandCounts.CRITICAL, color: '#ef4444', label: 'Crítico (0.0–4.9)' },
    ];

    let cursor = 0;
    const segments = orderedBands
      .filter((b) => b.count > 0 && total > 0)
      .map((b) => {
        const width = (b.count / total) * 100;
        const seg = { ...b, x: cursor, width };
        cursor += width;
        return seg;
      });

    return {
      counts: bandCounts,
      sortedItems: sorted,
      criticalPct: critRatio,
      avgScore: average,
      spectrumSegments: segments,
    };
  }, [hallazgos, sortBySeverity]);

  const filterButtons: Array<{
    id: SeverityFilterBand;
    label: string;
    count: number;
    idleCls: string;
    activeCls: string;
  }> = [
    {
      id: 'ALL',
      label: 'Todos',
      count: hallazgos.length,
      idleCls: 'border-slate-700 text-slate-300 bg-slate-900 hover:border-slate-600',
      activeCls: 'bg-sky-600 text-white border-sky-400',
    },
    {
      id: 'OPTIMAL',
      label: 'Óptimo 8.0–10',
      count: counts.OPTIMAL,
      idleCls: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30 hover:border-emerald-400/70',
      activeCls: 'bg-emerald-600 text-white border-emerald-400',
    },
    {
      id: 'MEDIUM',
      label: 'Moderado 6.5–7.9',
      count: counts.MEDIUM,
      idleCls: 'border-amber-500/40 text-amber-300 bg-amber-950/30 hover:border-amber-400/70',
      activeCls: 'bg-amber-600 text-white border-amber-400',
    },
    {
      id: 'HIGH',
      label: 'Alto 5.0–6.4',
      count: counts.HIGH,
      idleCls: 'border-orange-500/40 text-orange-300 bg-orange-950/30 hover:border-orange-400/70',
      activeCls: 'bg-orange-600 text-white border-orange-400',
    },
    {
      id: 'CRITICAL',
      label: 'Crítico < 5.0',
      count: counts.CRITICAL,
      idleCls: 'border-red-500/45 text-red-300 bg-red-950/35 hover:border-red-400/80',
      activeCls: 'bg-red-600 text-white border-red-400',
    },
  ];

  return (
    <section
      aria-label="Mapa de Calor de Severidad Forense"
      className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3.5"
    >
      {/* Header & Critical Priority Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <LayoutGrid className="w-4 h-4 text-rose-400 shrink-0" />
            <h3 className="text-xs font-bold text-slate-100 tracking-tight">
              HeatmapVisualizer — Clasificación de Severidad Forense (0–10)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-mono tabular-nums">
            Total: <span className="text-slate-200 font-semibold">{hallazgos.length}</span>
            {' · '}
            Promedio: <span className="text-slate-200 font-semibold">{avgScore.toFixed(1)}/10</span>
            {' · '}
            Críticos (&lt; 5.0):{' '}
            <span className={counts.CRITICAL > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-semibold'}>
              {counts.CRITICAL} ({criticalPct}%)
            </span>
            {' · '}
            Escala Verde (Bajo) → Rojo (Crítico)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onToggleSortBySeverity}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              sortBySeverity
                ? 'bg-sky-600/20 text-sky-200 border-sky-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            {sortBySeverity ? 'Orden: Críticos Primero (0→10)' : 'Orden: Secuencia del Informe'}
          </button>

          <button
            type="button"
            onClick={() =>
              onSeverityFilterChange(severityFilter === 'CRITICAL' ? 'ALL' : 'CRITICAL')
            }
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 border cursor-pointer transition-all whitespace-nowrap shrink-0 ${
              severityFilter === 'CRITICAL'
                ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/50'
                : 'bg-red-950/40 hover:bg-red-900/50 text-red-200 border-red-500/50'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono tabular-nums">
              {severityFilter === 'CRITICAL'
                ? `Mostrando Críticos (${counts.CRITICAL})`
                : `Priorizar Severidad Crítica (${counts.CRITICAL})`}
            </span>
          </button>

          {severityFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => onSeverityFilterChange('ALL')}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Graphical Green-to-Red Risk Spectrum & Stacked Band Distribution */}
      {hallazgos.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
          {/* Continuous 10.0 (Green / Low Risk) -> 0.0 (Red / Critical) Heat Spectrum with plotted findings */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
              <span className="text-emerald-400 font-semibold">
                10.0 · Bajo Riesgo / Óptimo (Verde)
              </span>
              <span className="hidden sm:inline text-slate-500">
                Espectro Continuo de Solidez Forense (haz clic en un punto)
              </span>
              <span className="text-red-400 font-semibold">
                0.0 · Severidad Crítica (Rojo)
              </span>
            </div>

            <svg
              viewBox="0 0 1000 28"
              className="w-full h-7 overflow-visible"
              role="img"
              aria-label="Espectro gráfico de severidad de verde (10.0 bajo) a rojo (0.0 crítico)"
            >
              <defs>
                <linearGradient id="basaHeatmapScale" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="25%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#f97316" />
                  <stop offset="75%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
              </defs>
              <rect
                x="0"
                y="10"
                width="1000"
                height="8"
                rx="4"
                fill="url(#basaHeatmapScale)"
                opacity="0.85"
              />
              {/* Threshold tick at score 5.0 (x = 500) marking Critical Boundary */}
              <line
                x1="500"
                y1="4"
                x2="500"
                y2="24"
                stroke="#fca5a5"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              {sortedItems.map((h, idx) => {
                const clampedScore = Math.max(0, Math.min(10, Number(h.puntaje0a10) || 0));
                // Map 10.0 (left, green) -> 0.0 (right, red)
                const cx = Math.max(10, Math.min(990, ((10 - clampedScore) / 10) * 1000));
                const style = getHeatmapStyle(clampedScore);
                const isSelected = highlightedHallazgoId === h.id;
                const yOffset = 14 + ((idx % 3) - 1) * 3;
                return (
                  <g
                    key={`dot-${h.id}`}
                    className="cursor-pointer"
                    onClick={() => onSelectHallazgo(h, style.band)}
                  >
                    <title>
                      {`${h.idHallazgo} · ${clampedScore.toFixed(1)}/10 (${style.label}) — ${h.titulo}`}
                    </title>
                    <circle
                      cx={cx}
                      cy={yOffset}
                      r={isSelected ? 6.5 : 4.5}
                      fill={style.hexColor}
                      stroke={isSelected ? '#38bdf8' : '#0f172a'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Stacked Proportional Bar across Severity Bands */}
          <div className="space-y-1">
            <svg
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              className="w-full h-2 rounded-full overflow-hidden bg-slate-900"
              aria-hidden="true"
            >
              {spectrumSegments.map((seg) => (
                <rect
                  key={seg.key}
                  x={seg.x}
                  y="0"
                  width={seg.width}
                  height="6"
                  fill={seg.color}
                />
              ))}
            </svg>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-slate-400">
              <span>Distribución proporcional por banda:</span>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-emerald-300">
                  Óptimo: {counts.OPTIMAL}
                </span>
                <span className="text-amber-300">
                  Moderado: {counts.MEDIUM}
                </span>
                <span className="text-orange-300">
                  Alto: {counts.HIGH}
                </span>
                <span className="text-red-300 font-semibold">
                  Crítico (&lt; 5.0): {counts.CRITICAL}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Band Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 inline-flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Filtrar por severidad:
          </span>
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onSeverityFilterChange(btn.id)}
              className={`px-2.5 py-1 rounded-md border font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums ${
                severityFilter === btn.id ? btn.activeCls : btn.idleCls
              }`}
            >
              {btn.label} ({btn.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
          <span className="text-emerald-400">Verde 10.0</span>
          <span className="w-3 h-2.5 rounded-sm bg-emerald-500/80 border border-emerald-400/50" title="8.0–10.0 Óptimo (Bajo)" />
          <span className="w-3 h-2.5 rounded-sm bg-amber-500/80 border border-amber-400/50" title="6.5–7.9 Moderado" />
          <span className="w-3 h-2.5 rounded-sm bg-orange-500/80 border border-orange-400/50" title="5.0–6.4 Alto" />
          <span className="w-3 h-2.5 rounded-sm bg-red-500/80 border border-red-400/50" title="3.0–4.9 Crítico" />
          <span className="w-3 h-2.5 rounded-sm bg-red-700 border border-red-400/70" title="0.0–2.9 Crítico Extremo" />
          <span className="text-red-400">Rojo 0.0</span>
        </div>
      </div>

      {/* Heatmap Matrix Cells Grid */}
      {sortedItems.length === 0 ? (
        <div className="text-center py-6 px-4 text-[11px] text-slate-400 border border-dashed border-slate-800 rounded-lg space-y-1.5">
          <ShieldAlert className="w-5 h-5 text-slate-500 mx-auto" />
          <p>
            Extraiga o registre hallazgos para visualizar el mapa de calor de severidad (escala verde a rojo, 0–10).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
          {sortedItems.map((h) => {
            const score = Math.max(0, Math.min(10, Number(h.puntaje0a10) || 0));
            const style = getHeatmapStyle(score);
            const isDimmed = severityFilter !== 'ALL' && style.band !== severityFilter;
            const isHighlighted = highlightedHallazgoId === h.id;
            const barWidth = Math.max(6, score * 10);

            return (
              <button
                key={`hm-${h.id}`}
                type="button"
                onClick={() => onSelectHallazgo(h, style.band)}
                title={`${h.idHallazgo} — ${h.titulo} | Puntaje: ${score.toFixed(1)}/10 (${style.label})`}
                className={`text-left rounded-lg border p-2.5 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  style.cellClass
                } ${isDimmed ? 'opacity-25' : 'opacity-100'} ${
                  isHighlighted ? 'ring-2 ring-sky-400' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-[11px] truncate">
                    {h.idHallazgo}
                  </span>
                  <span className="font-mono font-extrabold text-xs tabular-nums">
                    {score.toFixed(1)}
                  </span>
                </div>

                {/* Graphical 0–10 score progress meter inside heatmap cell */}
                <svg
                  viewBox="0 0 100 4"
                  preserveAspectRatio="none"
                  className="w-full h-1 rounded-full overflow-hidden bg-slate-950/70"
                  aria-hidden="true"
                >
                  <rect x="0" y="0" width={barWidth} height="4" fill={style.barColor} />
                </svg>

                <div className="text-[10.5px] font-medium leading-tight line-clamp-2 opacity-90 min-h-[26px]">
                  {h.titulo || 'Sin título'}
                </div>

                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${style.badgeClass}`}
                  >
                    {style.label}
                  </span>
                  {h.esDuplicado ? (
                    <span className="text-[9px] font-mono font-bold text-amber-300">DUP</span>
                  ) : style.band === 'OPTIMAL' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
