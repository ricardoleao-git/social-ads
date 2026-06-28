import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Send } from "lucide-react";
import { instagramMCPService } from "@/lib/instagramMCPService";

export default function PostScheduler() {
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([""]);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [bestTimes, setBestTimes] = useState<string[]>([
    "09:00",
    "12:00",
    "18:00",
    "20:00",
  ]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleAddMediaUrl = () => {
    setMediaUrls([...mediaUrls, ""]);
  };

  const handleRemoveMediaUrl = (index: number) => {
    setMediaUrls(mediaUrls.filter((_, i) => i !== index));
  };

  const handleMediaUrlChange = (index: number, value: string) => {
    const newUrls = [...mediaUrls];
    newUrls[index] = value;
    setMediaUrls(newUrls);
  };

  const handleSchedulePost = async () => {
    if (!caption || !selectedTime || mediaUrls.some((url) => !url)) {
      alert("Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);
    try {
      const scheduledTime = new Date();
      const [hours, minutes] = selectedTime.split(":").map(Number);
      scheduledTime.setHours(hours, minutes, 0, 0);

      const result = await instagramMCPService.schedulePost({
        caption,
        mediaUrls: mediaUrls.filter((url) => url),
        scheduledTime: scheduledTime.toISOString(),
      });

      if (result.id) {
        setSuccess(true);
        setCaption("");
        setMediaUrls([""]);
        setSelectedTime("");
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Agendar Post
          </h1>
          <p className="text-gray-600 mt-2">
            Agende seus posts para os melhores horários
          </p>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 font-medium">
              ✓ Post agendado com sucesso!
            </p>
          </div>
        )}

        <Card className="p-6 space-y-6">
          {/* Caption */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Legenda
            </label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Digite a legenda do seu post..."
              className="min-h-24"
            />
          </div>

          {/* Media URLs */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              URLs de Mídia
            </label>
            <div className="space-y-2">
              {mediaUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={url}
                    onChange={(e) => handleMediaUrlChange(index, e.target.value)}
                    placeholder={`URL da imagem/vídeo ${index + 1}`}
                  />
                  {mediaUrls.length > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => handleRemoveMediaUrl(index)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={handleAddMediaUrl}
              className="mt-2"
            >
              + Adicionar Mídia
            </Button>
          </div>

          {/* Best Posting Times */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              <Clock className="w-4 h-4 inline mr-2" />
              Melhores Horários para Postar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {bestTimes.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    selectedTime === time
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-semibold text-gray-900">{time}</div>
                  <div className="text-xs text-gray-600">Hoje</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date/Time */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Ou escolha uma data/hora personalizada
            </label>
            <input
              type="datetime-local"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Schedule Button */}
          <Button
            onClick={handleSchedulePost}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-foreground"
          >
            <Send className="w-4 h-4 mr-2" />
            {loading ? "Agendando..." : "Agendar Post"}
          </Button>
        </Card>

        {/* Tips */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-3">💡 Dicas</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• Poste nos horários com maior engajamento</li>
            <li>• Use hashtags relevantes na legenda</li>
            <li>• Inclua call-to-action para aumentar interação</li>
            <li>• Teste diferentes horários e formatos</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
