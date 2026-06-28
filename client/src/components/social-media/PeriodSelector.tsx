import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export type PeriodType = "week" | "month" | "quarter" | "custom";

interface PeriodSelectorProps {
  selectedPeriod: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
}

export default function PeriodSelector({
  selectedPeriod,
  onPeriodChange,
}: PeriodSelectorProps) {
  const periods = [
    { value: "week" as PeriodType, label: "Semana" },
    { value: "month" as PeriodType, label: "Mês" },
    { value: "quarter" as PeriodType, label: "Trimestre" },
    { value: "custom" as PeriodType, label: "Personalizado" },
  ];

  return (
    <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
      <Calendar className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-medium text-gray-700">Período:</span>
      <div className="flex gap-2">
        {periods.map((period) => (
          <Button
            key={period.value}
            onClick={() => onPeriodChange(period.value)}
            variant={selectedPeriod === period.value ? "default" : "outline"}
            size="sm"
            className={`text-xs font-medium ${
              selectedPeriod === period.value
                ? "bg-blue-600 text-foreground hover:bg-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {period.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
