import { Button } from "@/components/ui/button";
import { Image, Film, Grid3x3 } from "lucide-react";

export type PostTypeFilter = "ALL" | "IMAGE" | "REEL" | "CAROUSEL";

interface PostTypeFilterProps {
  selectedType: PostTypeFilter;
  onTypeChange: (type: PostTypeFilter) => void;
}

export default function PostTypeFilter({
  selectedType,
  onTypeChange,
}: PostTypeFilterProps) {
  const types = [
    { value: "ALL" as PostTypeFilter, label: "Todos", icon: Grid3x3 },
    { value: "IMAGE" as PostTypeFilter, label: "Imagem", icon: Image },
    { value: "REEL" as PostTypeFilter, label: "Reels", icon: Film },
    { value: "CAROUSEL" as PostTypeFilter, label: "Carrossel", icon: Grid3x3 },
  ];

  return (
    <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex-wrap">
      <span className="text-sm font-medium text-gray-700">Tipo de Post:</span>
      <div className="flex gap-2 flex-wrap">
        {types.map((type) => {
          const Icon = type.icon;
          return (
            <Button
              key={type.value}
              onClick={() => onTypeChange(type.value)}
              variant={selectedType === type.value ? "default" : "outline"}
              size="sm"
              className={`text-xs font-medium flex items-center gap-1 ${
                selectedType === type.value
                  ? "bg-blue-600 text-foreground hover:bg-blue-700"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-3 h-3" />
              {type.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
