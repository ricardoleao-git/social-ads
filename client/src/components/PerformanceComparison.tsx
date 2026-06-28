/**
 * Performance Comparison Component
 * 
 * Componente para comparar performance entre dois períodos diferentes
 * (ex: este mês vs. mês anterior, semana atual vs. semana anterior)
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ComparisonMetric {
  name: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  icon?: React.ReactNode;
}

export interface PerformanceComparisonProps {
  currentPeriod: string;
  previousPeriod: string;
  metrics: ComparisonMetric[];
}

export function PerformanceComparison({
  currentPeriod,
  previousPeriod,
  metrics,
}: PerformanceComparisonProps) {
  const calculateVariation = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIcon = (variation: number) => {
    if (variation > 0) {
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    } else if (variation < 0) {
      return <TrendingDown className="w-5 h-5 text-red-500" />;
    }
    return <Minus className="w-5 h-5 text-muted-foreground" />;
  };

  const getTrendColor = (variation: number): string => {
    if (variation > 0) return 'text-green-600';
    if (variation < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Comparação de Períodos</h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>{currentPeriod}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded"></div>
            <span>{previousPeriod}</span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => {
          const variation = calculateVariation(metric.currentValue, metric.previousValue);
          const isPositive = variation > 0;

          return (
            <div
              key={idx}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Metric Name */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700">{metric.name}</h3>
                {metric.icon}
              </div>

              {/* Values */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Período Atual</span>
                  <span className="text-lg font-bold text-blue-600">
                    {metric.currentValue.toFixed(2)} {metric.unit}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Período Anterior</span>
                  <span className="text-lg font-gray-400">
                    {metric.previousValue.toFixed(2)} {metric.unit}
                  </span>
                </div>
              </div>

              {/* Variation */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                {getTrendIcon(variation)}
                <span className={`font-semibold ${getTrendColor(variation)}`}>
                  {isPositive ? '+' : ''}{variation.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {isPositive ? 'Melhora' : variation < 0 ? 'Queda' : 'Sem mudanças'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Resumo da Comparação</h3>
        <p className="text-sm text-blue-800">
          {metrics.filter(m => calculateVariation(m.currentValue, m.previousValue) > 0).length} de{' '}
          {metrics.length} métricas melhoraram em relação ao período anterior.
        </p>
      </div>
    </div>
  );
}
