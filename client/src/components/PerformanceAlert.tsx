import React from 'react';
import { AlertCircle, CheckCircle, TrendingDown } from 'lucide-react';

export interface Alert {
  id: string;
  type: 'CTR_DROP' | 'ROI_DROP' | 'SPEND_SPIKE' | 'CONVERSION_DROP';
  severity: 'HIGH' | 'MEDIUM';
  campaign: string;
  message: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  timestamp: Date;
}

interface PerformanceAlertProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
}

const PerformanceAlert: React.FC<PerformanceAlertProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-green-900 dark:text-green-200">Tudo bem!</h3>
          <p className="text-sm text-green-800 dark:text-green-300">Nenhum alerta de performance abaixo da média.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border rounded-lg p-4 flex items-start gap-3 ${
            alert.severity === 'HIGH'
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
          }`}
        >
          <AlertCircle
            className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              alert.severity === 'HIGH' ? 'text-red-600' : 'text-yellow-600'
            }`}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <h3 className={`font-semibold ${
                alert.severity === 'HIGH'
                  ? 'text-red-900 dark:text-red-200'
                  : 'text-yellow-900 dark:text-yellow-200'
              }`}>
                {alert.campaign}
              </h3>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                alert.severity === 'HIGH'
                  ? 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200'
                  : 'bg-yellow-200 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
              }`}>
                {alert.severity === 'HIGH' ? 'CRÍTICO' : 'ATENÇÃO'}
              </span>
            </div>
            <p className={`text-sm mb-2 ${
              alert.severity === 'HIGH'
                ? 'text-red-800 dark:text-red-300'
                : 'text-yellow-800 dark:text-yellow-300'
            }`}>
              {alert.message}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <TrendingDown className="h-3 w-3" />
              <span>
                {alert.metric}: {alert.currentValue.toFixed(2)}{alert.unit} (era {alert.previousValue.toFixed(2)}{alert.unit})
              </span>
            </div>
            <button
              onClick={() => onDismiss(alert.id)}
              className={`text-xs font-medium underline ${
                alert.severity === 'HIGH'
                  ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                  : 'text-yellow-600 hover:text-yellow-700 dark:text-yellow-400'
              }`}
            >
              Descartar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PerformanceAlert;
