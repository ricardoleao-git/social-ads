import { Card } from "@/components/ui/card";
import { Eye, MessageCircle, Share2 } from "lucide-react";
import { InstagramStory } from "@/lib/social-media/expandedMockData";

interface StoryCardProps {
  story: InstagramStory;
}

export default function StoryCard({ story }: StoryCardProps) {
  const date = new Date(story.timestamp ?? story.date);
  const formattedDate = date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-lg transition-shadow">
      <div className="relative bg-gray-100 aspect-video overflow-hidden">
        <img
          src={story.mediaUrl}
          alt="Story"
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 text-foreground text-xs font-medium">
          {formattedDate}
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Eye className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">{story.views}</p>
            <p className="text-xs text-muted-foreground">Visualizações</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MessageCircle className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">{story.replies}</p>
            <p className="text-xs text-muted-foreground">Respostas</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Share2 className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-gray-900">{story.shares}</p>
            <p className="text-xs text-muted-foreground">Compartilhamentos</p>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            Engajamento: <span className="font-semibold text-blue-600">{(story.engagement ?? 0).toFixed(1)}%</span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {story.impressions} impressões
          </span>
        </div>
      </div>
    </Card>
  );
}
