import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, X } from "lucide-react";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface AdvancedDateFilterProps {
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
  onClose?: () => void;
}

export default function AdvancedDateFilter({
  onDateRangeChange,
  onClose,
}: AdvancedDateFilterProps) {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const handleApply = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      alert("A data inicial não pode ser maior que a data final!");
      return;
    }

    onDateRangeChange(start, end);
  };

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
    onDateRangeChange(start, end);
  };

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Filtro de Período Avançado</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Presets rápidos */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Períodos Rápidos
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handlePreset(7)}
              variant="outline"
              className="text-sm"
            >
              Últimos 7 dias
            </Button>
            <Button
              onClick={() => handlePreset(30)}
              variant="outline"
              className="text-sm"
            >
              Últimos 30 dias
            </Button>
            <Button
              onClick={() => handlePreset(90)}
              variant="outline"
              className="text-sm"
            >
              Últimos 90 dias
            </Button>
            <Button
              onClick={() => handlePreset(365)}
              variant="outline"
              className="text-sm"
            >
              Último ano
            </Button>
          </div>
        </div>

        {/* Data personalizada */}
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">
            Data Personalizada
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">
                Data Inicial
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">
                Data Final
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Resumo do período */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Período selecionado:</span>{" "}
            {new Date(startDate).toLocaleDateString("pt-BR")} a{" "}
            {new Date(endDate).toLocaleDateString("pt-BR")}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Total de dias:{" "}
            {Math.ceil(
              (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )}
          </p>
        </div>

        {/* Botão aplicar */}
        <Button
          onClick={handleApply}
          className="w-full bg-blue-600 hover:bg-blue-700 text-foreground"
        >
          Aplicar Filtro
        </Button>
      </div>
    </Card>
  );
}
