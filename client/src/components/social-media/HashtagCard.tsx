import { Card } from "@/components/ui/card";
import { Hashtag } from "@/lib/social-media/advancedMockData";
import { TrendingUp, TrendingDown, Minus, Eye, Heart, BarChart3 } from "lucide-react";

interface HashtagCardProps {
  hashtag: Hashtag;
}

export default function HashtagCard({ hashtag }: HashtagCardProps) {
  const getTrendIcon = () => {
    switch (hashtag.trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case "stable":
      default:
        return <Minus className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    switch (hashtag.trend) {
      case "up":
        return "text-green-600 bg-green-50";
      case "down":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <Card className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-gray-900 text-lg">{hashtag.tag}</h4>
          <p className="text-xs text-muted-foreground mt-1">{hashtag.posts} posts</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded ${getTrendColor()}`}>
          {getTrendIcon()}
          <span className="text-xs font-semibold">
            {hashtag.trendPercentage ?? 0 > 0 ? "+" : ""}{hashtag.trendPercentage ?? 0}%
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-blue-50 p-2 rounded">
            <Eye className="w-4 h-4 text-blue-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Alcance</p>
            <p className="font-bold text-gray-900 text-sm">
              {(hashtag.totalReach ?? hashtag.reach / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-red-50 p-2 rounded">
            <Heart className="w-4 h-4 text-red-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Engajamento</p>
            <p className="font-bold text-gray-900 text-sm">
              {hashtag.totalEngagement}
            </p>
          </div>
          <div className="bg-purple-50 p-2 rounded">
            <BarChart3 className="w-4 h-4 text-purple-600 mx-auto mb-1" />
            <p className="text-xs text-gray-600">Média</p>
            <p className="font-bold text-gray-900 text-sm">
              {hashtag.avgEngagement.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            Tendência: <span className="font-semibold text-gray-900">
              {hashtag.trend === "up" ? "Crescendo" : hashtag.trend === "down" ? "Caindo" : "Estável"}
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}
