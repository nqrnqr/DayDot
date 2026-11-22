import { useState } from 'react';
import type { ResolvedPalette } from '../constants/theme';
import type { BarDatum } from '../utils/stats';
import { formatCleanNumber } from '../utils/stats';

interface BarChartCardProps {
  bars: BarDatum[];
  color: ResolvedPalette;
  mode: 'count' | 'value';
  unit: string;
}

export function BarChartCard({ bars, color, mode, unit }: BarChartCardProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const values = bars.map((b) => (mode === 'value' ? b.value : b.count));
  const maxVal = Math.max(1, ...values);
  const activeBar = bars.find((b) => b.key === activeKey) ?? null;

  if (bars.length === 0) {
    return (
      <div className="daydot-card flex h-44 items-center justify-center rounded-[22px] bg-[var(--bg-surface)] p-4 text-sm text-[var(--fg-muted)]">
        当前时间范围暂无记录
      </div>
    );
  }

  const dense = bars.length > 15;

  return (
    <div className="daydot-card rounded-[22px] bg-[var(--bg-surface)] p-4">
      <div className="mb-2 flex min-h-6 items-center justify-between text-xs">
        <span className="font-medium text-[var(--fg-muted)]">
          {mode === 'value' ? `趋势分布 (${unit})` : '记录次数趋势'}
        </span>
        {activeBar ? (
          <span
            className="rounded-full px-2.5 py-0.5 font-semibold"
            style={{ backgroundColor: color.soft, color: color.ink }}
          >
            {activeBar.label} ·{' '}
            {mode === 'value'
              ? `${formatCleanNumber(activeBar.value)} ${unit} (${activeBar.count}次)`
              : `${activeBar.count} 次`}
          </span>
        ) : (
          <span className="font-medium text-[var(--fg-muted)]">
            峰值 {formatCleanNumber(maxVal)} {mode === 'value' ? unit : '次'}
          </span>
        )}
      </div>

      <div className="relative flex h-40 items-end gap-[2px] border-b border-[var(--border-color)] pt-3">
        {bars.map((bar) => {
          const v = mode === 'value' ? bar.value : bar.count;
          const pct = v > 0 ? Math.max(6, (v / maxVal) * 100) : 0;
          const isActive = activeKey === bar.key;
          const showGridLine = !dense || Boolean(bar.shortLabel);

          return (
            <button
              key={bar.key}
              type="button"
              onClick={() => setActiveKey(isActive ? null : bar.key)}
              aria-label={`${bar.label}: ${v}`}
              className="group relative flex h-full flex-1 flex-col items-center justify-end focus:outline-none"
            >
              {showGridLine && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-[var(--border-color)] opacity-75"
                />
              )}
              {v > 0 && (
                <span
                  className={`relative z-10 rounded-t-[4px] transition-all duration-200 ${
                    dense ? 'w-[70%] max-w-[10px]' : 'w-[56%] max-w-[22px]'
                  } ${isActive ? 'scale-y-105 brightness-95' : ''}`}
                  style={{
                    height: `${pct}%`,
                    backgroundColor: color.solid,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* X Axis labels */}
      <div className="mt-1.5 flex items-center gap-[2px] px-1">
        {bars.map((bar) => (
          <div
            key={bar.key}
            className="relative flex h-4 flex-1 items-center justify-center overflow-visible"
          >
            {bar.shortLabel && (
              <span className="text-[10px] font-medium whitespace-nowrap text-[var(--fg-muted)]">
                {bar.shortLabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
