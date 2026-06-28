import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: string;
}

export default function MetricCard({
  label,
  value,
  unit,
  trend,
  trendLabel,
  icon,
  color = "bg-blue-50",
}: MetricCardProps) {
  const isPositive = trend && trend > 0;

  return (
    <Card className={`p-6 ${color} border-0 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{value}</span>
            {unit && <span className="text-lg text-muted-foreground">{unit}</span>}
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-3">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {isPositive ? "+" : ""}{trend}% {trendLabel || "vs. mês anterior"}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-blue-600 opacity-20">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
