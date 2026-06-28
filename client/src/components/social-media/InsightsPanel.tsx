import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Lightbulb, Target } from "lucide-react";

interface Recommendation {
  id: string;
  type: "content" | "timing" | "hashtag" | "engagement" | "growth";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  impact: string;
  actionItems: string[];
  estimatedImpact?: string;
}

interface InsightsPanelProps {
  recommendations: Recommendation[];
  strengths: string[];
  opportunities: string[];
  trends: string[];
}

export default function InsightsPanel({
  recommendations,
  strengths,
  opportunities,
  trends,
}: InsightsPanelProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "content":
        return "📸";
      case "timing":
        return "⏰";
      case "hashtag":
        return "#️⃣";
      case "engagement":
        return "💬";
      case "growth":
        return "📈";
      default:
        return "💡";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-1" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Forcas</p>
              <ul className="mt-2 space-y-1">
                {strengths.slice(0, 2).map((strength, idx) => (
                  <li key={idx} className="text-xs text-blue-800">
                    • {strength}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-1" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Oportunidades</p>
              <ul className="mt-2 space-y-1">
                {opportunities.slice(0, 2).map((opp, idx) => (
                  <li key={idx} className="text-xs text-amber-800">
                    • {opp}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-purple-600 mt-1" />
            <div>
              <p className="text-sm font-semibold text-purple-900">Tendencias</p>
              <ul className="mt-2 space-y-1">
                {trends.slice(0, 2).map((trend, idx) => (
                  <li key={idx} className="text-xs text-purple-800 line-clamp-1">
                    • {trend}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 border-0 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-900">Recomendacoes Prioritarias</h3>
        </div>

        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-xl">{getTypeIcon(rec.type)}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  </div>
                </div>
                <Badge className={getPriorityColor(rec.priority)}>
                  {rec.priority === "high"
                    ? "Alta"
                    : rec.priority === "medium"
                      ? "Media"
                      : "Baixa"}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                <div className="bg-blue-50 rounded p-2">
                  <p className="text-xs font-semibold text-blue-900">Impacto Estimado:</p>
                  <p className="text-xs text-blue-800">{rec.estimatedImpact || rec.impact}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Acoes Recomendadas:</p>
                  <ul className="space-y-1">
                    {rec.actionItems.map((action, idx) => (
                      <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
