import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Mic, Play, Pause, Volume2, RefreshCw, Settings, History, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { toast } from "sonner";

function AudioPlayer({ url, text, onListened }: { url: string | null; text: string; onListened?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    if (!audioRef.current || !url) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      onListened?.();
    }
  };

  return (
    <div className="space-y-2">
      {url ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center shrink-0"
          >
            {playing ? <Pause className="w-4 h-4 text-foreground" /> : <Play className="w-4 h-4 text-foreground ml-0.5" />}
          </button>
          <div className="flex-1">
            <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <audio
            ref={audioRef}
            src={url}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
            }}
            onEnded={() => setPlaying(false)}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-muted-foreground text-sm">
          <Mic className="w-4 h-4" />
          Áudio não disponível — VoxForge não configurado
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-muted-foreground text-xs hover:text-muted-foreground"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Ocultar transcrição" : "Ver transcrição completa"}
      </button>
      {expanded && (
        <div className="p-3 rounded-lg bg-muted/30 text-muted-foreground text-sm leading-relaxed">
          {text}
        </div>
      )}
    </div>
  );
}

export default function Briefings() {
  const [showConfig, setShowConfig] = useState(false);
  const [voxforgeUrl, setVoxforgeUrl] = useState("");
  const [voice, setVoice] = useState("pt-BR-Ricardo");
  const [genHour, setGenHour] = useState(7);
  const [genMinute, setGenMinute] = useState(45);

  const { data: latest, refetch: refetchLatest } = trpc.voiceBriefing.getLatest.useQuery();
  const { data: history, refetch: refetchHistory } = trpc.voiceBriefing.getHistory.useQuery({ limit: 30 });
  const { data: config, refetch: refetchConfig } = trpc.voiceBriefing.getConfig.useQuery();

  const generateNow = trpc.voiceBriefing.generateNow.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Briefing gerado para ${result.date}${result.hasAudio ? " com áudio" : " (apenas texto — VoxForge indisponível)"}`);
        refetchLatest();
        refetchHistory();
      }
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const markListened = trpc.voiceBriefing.markAsListened.useMutation({
    onSuccess: () => refetchLatest(),
  });

  const updateConfig = trpc.voiceBriefing.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva");
      setShowConfig(false);
      refetchConfig();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleSaveConfig = () => {
    updateConfig.mutate({
      voxforgeUrl: voxforgeUrl || undefined,
      voice: voice || undefined,
      generationHour: genHour,
      generationMinute: genMinute,
    });
  };

  const handleConfigEdit = () => {
    if (config) {
      setVoxforgeUrl(config.voxforgeUrl ?? "");
      setVoice(config.voice ?? "pt-BR-Ricardo");
      setGenHour(config.generationHour ?? 7);
      setGenMinute(config.generationMinute ?? 45);
    }
    setShowConfig(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radio className="w-7 h-7 text-blue-400" />
            Briefing Diário
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Resumo em áudio de ~60 segundos gerado às 7h45 com os 3 alertas mais importantes do dia
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleConfigEdit} className="border-border text-muted-foreground">
            <Settings className="w-4 h-4 mr-2" />
            Configurar
          </Button>
          <Button
            size="sm"
            onClick={() => generateNow.mutate()}
            disabled={generateNow.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {generateNow.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Gerando...</>
            ) : (
              <><Mic className="w-4 h-4 mr-2" />Gerar Agora</>
            )}
          </Button>
        </div>
      </div>

      {/* Briefing mais recente */}
      {latest ? (
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-base flex items-center gap-2">
                <Mic className="w-4 h-4 text-blue-400" />
                Briefing de Hoje
                {!latest.listenedAt && (
                  <Badge className="bg-blue-500/20 text-blue-400 text-xs">Novo</Badge>
                )}
              </CardTitle>
              <span className="text-muted-foreground text-sm">
                {new Date(latest.createdAt).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <AudioPlayer
              url={latest.audioUrl ?? null}
              text={latest.text}
              onListened={() => {
                if (!latest.listenedAt) markListened.mutate({ id: latest.id });
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card/50 border-border">
          <CardContent className="py-12 text-center">
            <Radio className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-muted-foreground">Nenhum briefing gerado ainda.</p>
            <p className="text-slate-500 text-sm mt-1">Clique em "Gerar Agora" para criar o primeiro briefing.</p>
          </CardContent>
        </Card>
      )}

      {/* Configuração */}
      {showConfig && (
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-muted-foreground" />
              Configuração do Briefing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-muted-foreground text-sm">Ativar briefing diário automático</Label>
                <p className="text-slate-500 text-xs">Gerado automaticamente às {genHour}h{String(genMinute).padStart(2, "0")}</p>
              </div>
              <Switch
                checked={config?.enabled ?? false}
                onCheckedChange={(v) => updateConfig.mutate({ enabled: v })}
              />
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">URL do VoxForge TTS</Label>
              <Input
                value={voxforgeUrl}
                onChange={(e) => setVoxforgeUrl(e.target.value)}
                placeholder="http://localhost:8000 ou https://tts.seudominio.com"
                className="bg-muted border-border text-foreground mt-1"
              />
              <p className="text-slate-500 text-xs mt-1">Deixe em branco para usar a variável de ambiente VOXFORGE_URL</p>
            </div>
            <div>
              <Label className="text-muted-foreground text-sm">Voz</Label>
              <Input
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="pt-BR-Ricardo"
                className="bg-muted border-border text-foreground mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-sm">Hora de geração</Label>
                <Input type="number" min={0} max={23} value={genHour} onChange={(e) => setGenHour(Number(e.target.value))} className="bg-muted border-border text-foreground mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Minuto</Label>
                <Input type="number" min={0} max={59} value={genMinute} onChange={(e) => setGenMinute(Number(e.target.value))} className="bg-muted border-border text-foreground mt-1" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSaveConfig} disabled={updateConfig.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {updateConfig.isPending ? "Salvando..." : "Salvar Configuração"}
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)} className="border-border text-muted-foreground">
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card className="bg-card/50 border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Histórico dos Últimos 30 Dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">Nenhum briefing no histórico.</p>
          ) : (
            <div className="space-y-3">
              {history.map((b: any) => (
                <div key={b.id} className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-sm font-medium">
                        {new Date(b.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                      </span>
                      {b.audioUrl && <Badge className="bg-blue-500/20 text-blue-400 text-xs">Com áudio</Badge>}
                      {b.listenedAt && <Badge className="bg-green-500/20 text-green-400 text-xs">Ouvido</Badge>}
                    </div>
                    <span className="text-slate-500 text-xs">
                      {new Date(b.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <AudioPlayer url={b.audioUrl ?? null} text={b.text} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota sobre VoxForge */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="pt-4">
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">Nota sobre o VoxForge TTS:</span> O sistema gera o briefing em texto via IA independentemente do VoxForge. O áudio só é gerado se o VoxForge estiver acessível na URL configurada. Em produção, configure a variável de ambiente <code className="text-blue-400">VOXFORGE_URL</code> com a URL pública da sua instância XTTS v2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
