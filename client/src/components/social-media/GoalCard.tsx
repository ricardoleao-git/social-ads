import { Card } from "@/components/ui/card";
import { GrowthGoal } from "@/lib/social-media/advancedMockData";
import { Target, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";

interface GoalCardProps {
  goal: GrowthGoal;
}

export default function GoalCard({ goal }: GoalCardProps) {
  const getStatusIcon = () => {
    switch (goal.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "at_risk":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <TrendingUp className="w-5 h-5 text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (goal.status) {
      case "completed":
        return "bg-green-50 border-green-200";
      case "at_risk":
        return "bg-red-50 border-red-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const getStatusText = () => {
    switch (goal.status) {
      case "completed":
        return "Concluído";
      case "at_risk":
        return "Em Risco";
      default:
        return "No Caminho";
    }
  };

  const daysRemaining = Math.ceil(
    (new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className={`p-4 border ${getStatusColor()} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">{goal.name}</h4>
        </div>
        {getStatusIcon()}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Progresso</span>
            <span className="text-sm font-bold text-gray-900">{goal.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Atual</p>
            <p className="font-bold text-gray-900">{goal.currentValue}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Meta</p>
            <p className="font-bold text-gray-900">{goal.targetValue}</p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Prazo</span>
            <span className={`font-semibold ${daysRemaining > 0 ? "text-blue-600" : "text-red-600"}`}>
              {daysRemaining > 0 ? `${daysRemaining} dias` : "Expirado"}
            </span>
          </div>
          <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
            goal.status === "completed"
              ? "bg-green-100 text-green-700"
              : goal.status === "at_risk"
              ? "bg-red-100 text-red-700"
              : "bg-blue-100 text-blue-700"
          }`}>
            {getStatusText()}
          </span>
        </div>
      </div>
    </Card>
  );
}
