import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface ComparisonData {
  metric: string;
  thisMonth: number;
  lastMonth: number;
  unit: string;
}

const PeriodComparison: React.FC<{ data: ComparisonData[] }> = ({ data }) => {
  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Comparação de Períodos</h2>
      <p className="text-muted-foreground">Este mês vs. Mês anterior</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((item, idx) => {
          const change = calculateChange(item.thisMonth, item.lastMonth);
          const isPositive = change >= 0;

          return (
            <div key={idx} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{item.metric}</h3>
                {isPositive ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Este mês</p>
                  <p className="text-lg font-bold">
                    {item.thisMonth.toFixed(2)} {item.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mês anterior</p>
                  <p className="text-lg font-bold text-muted-foreground">
                    {item.lastMonth.toFixed(2)} {item.unit}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/30">
                <p className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{change.toFixed(1)}% em relação ao mês anterior
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PeriodComparison;
