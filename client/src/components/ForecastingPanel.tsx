/**
 * Forecasting Panel Component
 * 
 * Componente para exibir previsões de performance baseado em dados históricos
 * Utiliza análise de tendências simples (linear regression)
 */

import React from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';

export interface ForecastData {
  date: string;
  value: number;
}

export interface Forecast {
  metric: string;
  currentValue: number;
  forecastedValue: number;
  confidence: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
}

export interface ForecastingPanelProps {
  forecasts: Forecast[];
  historicalData?: ForecastData[];
}

/**
 * Função para calcular previsão simples usando regressão linear
 */
export function calculateLinearForecast(data: ForecastData[]): number {
  if (data.length < 2) return data[data.length - 1]?.value || 0;

  const n = data.length;
  const sumX = data.reduce((sum, _, i) => sum + i, 0);
  const sumY = data.reduce((sum, d) => sum + d.value, 0);
  const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
  const sumX2 = data.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Previsão para o próximo período
  const nextValue = intercept + slope * (n + 1);
  return Math.max(0, nextValue); // Evitar valores negativos
}

/**
 * Função para calcular confiança da previsão (baseado na consistência dos dados)
 */
export function calculateConfidence(data: ForecastData[]): number {
  if (data.length < 3) return 50;

  const mean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
  const variance = data.reduce((sum, d) => sum + Math.pow(d.value - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean; // Coefficient of Variation

  // Quanto menor o CV, maior a confiança (dados mais consistentes)
  return Math.max(30, Math.min(95, 100 - cv * 100));
}

export function ForecastingPanel({ forecasts, historicalData }: ForecastingPanelProps) {
  const getTrendColor = (trend: 'up' | 'down' | 'stable'): string => {
    switch (trend) {
      case 'up':
        return 'text-green-600 bg-green-50';
      case 'down':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'down':
        return <TrendingUp className="w-5 h-5 text-red-500 rotate-180" />;
      default:
        return <TrendingUp className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getConfidenceBadge = (confidence: number): string => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Previsões de Performance</h2>
        <p className="text-sm text-gray-600 mt-1">
          Baseado em análise de dados históricos dos últimos 30 dias
        </p>
      </div>

      {/* Forecasts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {forecasts.map((forecast, idx) => (
          <div
            key={idx}
            className={`p-4 border rounded-lg ${getTrendColor(forecast.trend)}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{forecast.metric}</h3>
              {getTrendIcon(forecast.trend)}
            </div>

            {/* Values */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Valor Atual</span>
                <span className="font-bold">{forecast.currentValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Previsão</span>
                <span className="font-bold text-lg">{forecast.forecastedValue.toFixed(2)}</span>
              </div>
            </div>

            {/* Confidence */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-current border-opacity-20">
              <span className="text-xs text-gray-600">Confiança:</span>
              <div className={`px-2 py-1 rounded text-xs font-semibold ${getConfidenceBadge(forecast.confidence)}`}>
                {forecast.confidence.toFixed(0)}%
              </div>
            </div>

            {/* Recommendation */}
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{forecast.recommendation}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Insights */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Insights de Previsão</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• {forecasts.filter(f => f.trend === 'up').length} métricas com tendência de melhora</li>
          <li>• {forecasts.filter(f => f.trend === 'down').length} métricas com tendência de queda</li>
          <li>
            • Confiança média:{' '}
            {(forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length).toFixed(0)}%
          </li>
        </ul>
      </div>

      {/* Metodologia */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Metodologia</h3>
        <p className="text-sm text-gray-700">
          As previsões são calculadas usando regressão linear dos dados históricos. A confiança
          indica a consistência dos dados: valores altos indicam padrões estáveis, valores baixos
          indicam volatilidade. Recomenda-se usar essas previsões como indicador de tendência,
          não como previsão absoluta.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook para gerar previsões automáticas
 */
export function useForecastData(historicalData: Record<string, ForecastData[]>): Forecast[] {
  return React.useMemo(() => {
    return Object.entries(historicalData).map(([metric, data]) => {
      const forecastedValue = calculateLinearForecast(data);
      const confidence = calculateConfidence(data);
      const currentValue = data[data.length - 1]?.value || 0;
      const variation = ((forecastedValue - currentValue) / currentValue) * 100;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (variation > 5) trend = 'up';
      if (variation < -5) trend = 'down';

      let recommendation = '';
      switch (trend) {
        case 'up':
          recommendation = `Tendência positiva. ${metric} deve aumentar ${variation.toFixed(1)}% no próximo período.`;
          break;
        case 'down':
          recommendation = `Tendência negativa. ${metric} deve cair ${Math.abs(variation).toFixed(1)}%. Considere revisar estratégia.`;
          break;
        default:
          recommendation = `${metric} deve se manter estável no próximo período.`;
      }

      return {
        metric,
        currentValue,
        forecastedValue,
        confidence,
        trend,
        recommendation,
      };
    });
  }, [historicalData]);
}

export default ForecastingPanel;
