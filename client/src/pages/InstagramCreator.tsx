import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Instagram,
  Sparkles,
  Save,
  Trash2,
  RefreshCw,
  Image,
  Film,
  BookOpen,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Plus,
  LayoutGrid,
  PenLine,
  Upload,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

type ContentType = "post" | "story" | "reels";
type Account = "zenitetech" | "avantclube";

const TYPE_ICONS: Record<ContentType, React.ReactNode> = {
  post: <LayoutGrid className="w-4 h-4" />,
  story: <BookOpen className="w-4 h-4" />,
  reels: <Film className="w-4 h-4" />,
};

const TYPE_LABELS: Record<ContentType, string> = {
  post: "Post",
  story: "Story",
  reels: "Reels",
};

const STATUS_CONFIG = {
  draft: { label: "Rascunho", icon: <PenLine className="w-3 h-3" />, className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
  scheduled: { label: "Agendado", icon: <Clock className="w-3 h-3" />, className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  published: { label: "Publicado", icon: <CheckCircle className="w-3 h-3" />, className: "bg-green-500/10 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelado", icon: <XCircle className="w-3 h-3" />, className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InstagramCreator() {
  const [account, setAccount] = useState<Account>("zenitetech");
  const [activeTab, setActiveTab] = useState<"create" | "drafts">("create");

  // Form state
  const [type, setType] = useState<ContentType>("post");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([""]);
  const [mediaTypes, setMediaTypes] = useState<("image" | "video")[]>(["image"]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiTone, setAiTone] = useState<"profissional" | "descontraído" | "técnico" | "comercial">("profissional");
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Queries
  const { data: draftsData, refetch: refetchDrafts } = trpc.instagramCreator.listDrafts.useQuery({ account });
  const { data: stats } = trpc.instagramCreator.getStats.useQuery();

  // Mutations
  const saveDraft = trpc.instagramCreator.saveDraft.useMutation({
    onSuccess: () => {
      toast.success("Rascunho salvo!", { description: "O conteúdo foi salvo como rascunho." });
      refetchDrafts();
      resetForm();
    },
    onError: (e) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const deleteDraft = trpc.instagramCreator.deleteDraft.useMutation({
    onSuccess: () => { toast.success("Rascunho excluído"); refetchDrafts(); },
  });

  const updateStatus = trpc.instagramCreator.updateDraftStatus.useMutation({
    onSuccess: () => refetchDrafts(),
  });

  const publishDraft = trpc.instagramCreator.publishDraft.useMutation({
    onSuccess: (data) => {
      toast.success("Post publicado no Instagram!", { description: `ID da mídia: ${data.igMediaId}` });
      refetchDrafts();
    },
    onError: (e) => toast.error("Erro ao publicar", { description: e.message }),
  });

  const uploadMedia = trpc.instagramCreator.uploadMedia.useMutation({
    onError: (e) => toast.error("Erro no upload", { description: e.message }),
  });

  async function handleFileUpload(index: number, file: File) {
    if (file.size > 16 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "Máximo 16 MB por arquivo." });
      return;
    }
    setUploadingIndex(index);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadMedia.mutateAsync({
        fileBase64: base64,
        mimeType: file.type,
        fileName: file.name,
      });
      const updated = [...mediaUrls];
      updated[index] = result.url;
      setMediaUrls(updated);
      // Detecta automaticamente se é vídeo
      if (file.type.startsWith("video/")) {
        const updatedTypes = [...mediaTypes];
        updatedTypes[index] = "video";
        setMediaTypes(updatedTypes);
      }
      toast.success("Upload concluído!", { description: "URL preenchida automaticamente." });
    } catch (e: any) {
      toast.error("Erro no upload", { description: e.message });
    } finally {
      setUploadingIndex(null);
    }
  }

  const generateCaption = trpc.instagramCreator.generateCaption.useMutation({
    onSuccess: (data) => {
      setCaption(data.caption);
      setHashtags(data.hashtags);
      toast.success("Legenda gerada com IA!", { description: "Revise e ajuste conforme necessário." });
    },
    onError: (e) => toast.error("Erro ao gerar", { description: e.message }),
  });

  function resetForm() {
    setCaption(""); setHashtags(""); setMediaUrls([""]); setMediaTypes(["image"]);
    setScheduledFor(""); setNotes(""); setAiTopic("");
  }

  function handleSaveDraft() {
    const validUrls = mediaUrls.filter((u) => u.trim().length > 0);
    if (!validUrls.length) {
      toast.error("Adicione pelo menos uma URL de mídia");
      return;
    }
    saveDraft.mutate({
      account,
      type,
      caption: caption || undefined,
      hashtags: hashtags || undefined,
      mediaUrls: validUrls,
      mediaTypes: mediaTypes.slice(0, validUrls.length),
      scheduledFor: scheduledFor || undefined,
      notes: notes || undefined,
    });
  }

  const drafts = draftsData?.drafts ?? [];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                <Instagram className="w-4 h-4 text-pink-400" />
              </div>
              <h1 className="text-xl font-semibold">Criador Instagram</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie rascunhos de posts, stories e reels
            </p>
          </div>
          {/* Account selector */}
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
            {(["zenitetech", "avantclube"] as Account[]).map((acc) => (
              <Button
                key={acc}
                variant={account === acc ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAccount(acc)}
              >
                @{acc}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Total Rascunhos</p>
              <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Rascunhos</p>
              <p className="text-2xl font-bold text-zinc-400">{(stats?.byStatus as any)?.draft ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Agendados</p>
              <p className="text-2xl font-bold text-blue-400">{(stats?.byStatus as any)?.scheduled ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1">Publicados</p>
              <p className="text-2xl font-bold text-green-400">{(stats?.byStatus as any)?.published ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "create" ? "border-pink-500 text-pink-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("create")}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />
            Criar Conteúdo
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "drafts" ? "border-pink-500 text-pink-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("drafts")}
          >
            <PenLine className="w-3.5 h-3.5 inline mr-1.5" />
            Rascunhos ({drafts.length})
          </button>
        </div>

        {/* Create Tab */}
        {activeTab === "create" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Tipo de conteúdo</label>
                <div className="flex gap-2">
                  {(["post", "story", "reels"] as ContentType[]).map((t) => (
                    <Button
                      key={t}
                      variant={type === t ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setType(t)}
                    >
                      {TYPE_ICONS[t]}
                      <span className="ml-1.5">{TYPE_LABELS[t]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* AI Caption Generator */}
              <Card className="border-border bg-gradient-to-br from-pink-500/5 to-purple-500/5">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    Gerar legenda com IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-3">
                  <Input
                    placeholder="Tema do post (ex: Wallbox para empresas)"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value as "profissional" | "descontraído" | "técnico" | "comercial")}
                      className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-2"
                    >
                      <option value="profissional">Profissional</option>
                      <option value="informal">Informal</option>
                      <option value="técnico">Técnico</option>
                      <option value="motivacional">Motivacional</option>
                    </select>
                    <Button
                      size="sm"
                      className="h-8 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                      disabled={!aiTopic || generateCaption.isPending}
                      onClick={() => generateCaption.mutate({ topic: aiTopic, type, tone: aiTone })}
                    >
                      {generateCaption.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span className="ml-1.5">Gerar</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Caption */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Legenda</label>
                <Textarea
                  placeholder="Escreva a legenda do post..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{caption.length}/2200</p>
              </div>

              {/* Hashtags */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Hashtags</label>
                <Input
                  placeholder="#zenitetech #tecnologia #inovacao"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Media URLs */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Mídia (upload ou URL)</label>
                <div className="space-y-2">
                  {mediaUrls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Cole uma URL ou faça upload abaixo"
                          value={url}
                          onChange={(e) => {
                            const updated = [...mediaUrls];
                            updated[i] = e.target.value;
                            setMediaUrls(updated);
                          }}
                          className="text-sm pr-8"
                        />
                        {uploadingIndex === i && (
                          <RefreshCw className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-pink-400" />
                        )}
                      </div>
                      <label
                        className="h-9 w-9 flex items-center justify-center rounded-md border border-input bg-background cursor-pointer hover:bg-muted/50 shrink-0"
                        title="Fazer upload de arquivo"
                      >
                        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(i, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <select
                        value={mediaTypes[i] ?? "image"}
                        onChange={(e) => {
                          const updated = [...mediaTypes];
                          updated[i] = e.target.value as "image" | "video";
                          setMediaTypes(updated);
                        }}
                        className="h-9 text-xs rounded-md border border-input bg-background px-2 w-20"
                      >
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                      </select>
                      {mediaUrls.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => {
                            setMediaUrls(mediaUrls.filter((_, j) => j !== i));
                            setMediaTypes(mediaTypes.filter((_, j) => j !== i));
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {mediaUrls.length < 10 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => { setMediaUrls([...mediaUrls, ""]); setMediaTypes([...mediaTypes, "image"]); }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Adicionar mídia
                    </Button>
                  )}
                </div>
              </div>

              {/* Schedule */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Agendar para (opcional)</label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Notas internas</label>
                <Input
                  placeholder="Observações para a equipe..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                />
              </div>

              <Button
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                disabled={saveDraft.isPending}
                onClick={handleSaveDraft}
              >
                {saveDraft.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Rascunho
              </Button>
            </div>

            {/* Right: Preview */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Pré-visualização</label>
              <Card className="border-border bg-card/50">
                <CardContent className="pt-4 pb-4">
                  {/* Mock Instagram post */}
                  <div className="max-w-xs mx-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                        <Instagram className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">@{account}</p>
                        <p className="text-xs text-muted-foreground">{TYPE_LABELS[type]}</p>
                      </div>
                    </div>
                    {/* Media placeholder */}
                    <div className="aspect-square bg-muted/30 rounded-lg mb-3 flex items-center justify-center border border-border">
                      {mediaUrls[0] && mediaUrls[0].startsWith("http") ? (
                        <img src={mediaUrls[0]} alt="preview" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Image className="w-8 h-8 mx-auto mb-1 opacity-30" />
                          <p className="text-xs">Adicione uma URL de mídia</p>
                        </div>
                      )}
                    </div>
                    {/* Caption preview */}
                    {(caption || hashtags) && (
                      <div className="text-xs space-y-1">
                        <p className="font-semibold">@{account}</p>
                        <p className="text-foreground whitespace-pre-wrap line-clamp-4">{caption}</p>
                        {hashtags && <p className="text-blue-400">{hashtags}</p>}
                      </div>
                    )}
                    {!caption && !hashtags && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        A legenda aparecerá aqui
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Info box */}
              <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-300">
                    <p className="font-medium mb-1">Publicação via Meta Graph API</p>
                    <p>Salve o rascunho e clique em <strong>Publicar agora</strong> na aba Rascunhos. Requer token com permissão <code className="font-mono bg-blue-500/20 px-1 rounded">instagram_content_publishing</code>.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drafts Tab */}
        {activeTab === "drafts" && (
          <div className="space-y-3">
            {drafts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <PenLine className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum rascunho salvo para @{account}</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setActiveTab("create")}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Criar primeiro rascunho
                </Button>
              </div>
            ) : (
              drafts.map((draft: any) => {
                const statusCfg = STATUS_CONFIG[draft.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
                return (
                  <Card key={draft.id} className="border-border hover:border-pink-500/30 transition-colors">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        {/* Thumbnail da primeira mídia ou ícone genérico */}
                        {(() => {
                          let firstUrl = '';
                          try { firstUrl = JSON.parse(draft.mediaUrls || '[]')[0] || ''; } catch {}
                          return firstUrl ? (
                            <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-border bg-zinc-800">
                              <img
                                src={firstUrl}
                                alt="preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  el.style.display = 'none';
                                  const parent = el.parentElement;
                                  if (parent) parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-lg">${draft.type === 'reels' ? '🎥' : '🖼️'}</div>`;
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                              {TYPE_ICONS[draft.type as ContentType]}
                            </div>
                          );
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <Badge variant="outline" className="text-xs">
                              {TYPE_LABELS[draft.type as ContentType]}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                              {statusCfg.icon}
                              <span className="ml-1">{statusCfg.label}</span>
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">{formatDate(draft.createdAt)}</span>
                          </div>
                          {draft.caption && (
                            <p className="text-sm text-foreground line-clamp-2 mb-2">{draft.caption}</p>
                          )}
                          {draft.scheduledFor && (
                            <p className="text-xs text-blue-400 flex items-center gap-1 mb-2">
                              <Clock className="w-3 h-3" />
                              Agendado: {draft.scheduledFor}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {draft.status === "draft" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs"
                                onClick={() => updateStatus.mutate({ draftId: draft.id, status: "scheduled" })}
                              >
                                <Clock className="w-3 h-3 mr-1" />
                                Agendar
                              </Button>
                            )}
                            {draft.status !== "published" && draft.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs text-green-400 border-green-500/30"
                                disabled={publishDraft.isPending && publishDraft.variables?.draftId === draft.id}
                                onClick={() => publishDraft.mutate({ draftId: draft.id })}
                              >
                                {publishDraft.isPending && publishDraft.variables?.draftId === draft.id ? (
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                )}
                                Publicar agora
                              </Button>
                            )}
                            {draft.publishError && (
                              <span
                                className="text-xs text-red-400 truncate max-w-[180px]"
                                title={draft.publishError}
                              >
                                ⚠️ {draft.publishError.slice(0, 45)}…
                              </span>
                            )}
                            {draft.status === "published" && draft.igMediaId && (
                              <a
                                href={`https://www.instagram.com/p/${draft.igMediaId}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Ver no Instagram
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs text-red-400 hover:text-red-300 ml-auto"
                              onClick={() => deleteDraft.mutate({ draftId: draft.id })}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
