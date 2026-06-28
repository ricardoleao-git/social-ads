import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Calendar, Plus, ChevronLeft, ChevronRight, Instagram, Facebook,
  CheckCircle2, Clock, XCircle, Loader2, Eye, Trash2, Edit3,
  Heart, MessageCircle, Share2, Bookmark, BarChart3
} from "lucide-react";

type Platform = "instagram" | "facebook" | "both";
type ContentType = "post" | "story" | "reels" | "carousel";
type PostStatus = "planned" | "ready" | "published" | "cancelled";

const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  both: "Ambos",
};

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  post: "Post",
  story: "Story",
  reels: "Reels",
  carousel: "Carrossel",
};

const STATUS_CONFIG: Record<PostStatus, { label: string; color: string; icon: any }> = {
  planned: { label: "Planejado", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Clock },
  ready: { label: "Pronto", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: CheckCircle2 },
  published: { label: "Publicado", color: "bg-green-500/20 text-green-300 border-green-500/30", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: XCircle },
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

export default function EditorialCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDay, setCreateDay] = useState<string>("");

  const [form, setForm] = useState({
    title: "", platform: "instagram" as Platform, contentType: "post" as ContentType,
    caption: "", hashtags: "", scheduledDate: "", scheduledTime: "09:00",
    status: "planned" as PostStatus, assignedTo: "", notes: "",
    instagramDraftId: "" as string,
  });

  const utils = trpc.useUtils();

  const { data: posts = [], isLoading } = trpc.editorialCalendar.listByMonth.useQuery({ year, month });
  const { data: stats } = trpc.editorialCalendar.getStats.useQuery({ year, month });
  const { data: drafts = [] } = trpc.editorialCalendar.listAvailableDrafts.useQuery();
  const { data: postDetail } = trpc.editorialCalendar.getById.useQuery(
    { id: selectedPost! },
    { enabled: !!selectedPost }
  );

  const createMutation = trpc.editorialCalendar.create.useMutation({
    onSuccess: () => {
      utils.editorialCalendar.listByMonth.invalidate();
      utils.editorialCalendar.getStats.invalidate();
      setShowCreateModal(false);
      setForm({ title: "", platform: "instagram", contentType: "post", caption: "", hashtags: "", scheduledDate: "", scheduledTime: "09:00", status: "planned", assignedTo: "", notes: "", instagramDraftId: "" });
      toast.success("Post adicionado ao calendário!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateMutation = trpc.editorialCalendar.update.useMutation({
    onSuccess: () => {
      utils.editorialCalendar.listByMonth.invalidate();
      utils.editorialCalendar.getStats.invalidate();
      if (selectedPost) utils.editorialCalendar.getById.invalidate({ id: selectedPost });
      toast.success("Post atualizado!");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteMutation = trpc.editorialCalendar.delete.useMutation({
    onSuccess: () => {
      utils.editorialCalendar.listByMonth.invalidate();
      utils.editorialCalendar.getStats.invalidate();
      setSelectedPost(null);
      toast.success("Post removido do calendário.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const getPostsForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return posts.filter((p: any) => p.scheduledDate === dateStr);
  };

  const openCreateForDay = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setForm(f => ({ ...f, scheduledDate: dateStr }));
    setCreateDay(dateStr);
    setShowCreateModal(true);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-pink-400" />
            Calendário Editorial
          </h1>
          <p className="text-gray-400 text-sm mt-1">Planejamento e acompanhamento de posts Instagram e Facebook</p>
        </div>
        <Button onClick={() => { setForm(f => ({ ...f, scheduledDate: "" })); setShowCreateModal(true); }} className="bg-pink-600 hover:bg-pink-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Novo Post
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Total no mês</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Publicados</p>
              <p className="text-2xl font-bold text-green-400">{stats.byStatus.published}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Alcance Total</p>
              <p className="text-2xl font-bold text-blue-400">{stats.performance.totalReach.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Curtidas Total</p>
              <p className="text-2xl font-bold text-pink-400">{stats.performance.totalLikes.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth} className="border-gray-700 text-gray-300 hover:text-white">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-semibold text-white">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <Button variant="outline" size="sm" onClick={nextMonth} className="border-gray-700 text-gray-300 hover:text-white">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-800">
          {DAY_NAMES.map(d => (
            <div key={d} className="p-2 text-center text-gray-500 text-xs font-medium">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-800/50 bg-gray-950/30" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayPosts = getPostsForDay(day);
            const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();

            return (
              <div
                key={day}
                className={`min-h-[80px] border-b border-r border-gray-800/50 p-1.5 cursor-pointer hover:bg-gray-800/30 transition-colors ${isToday ? "bg-blue-500/5" : ""}`}
                onClick={() => openCreateForDay(day)}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-blue-500 text-white" : "text-gray-400"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map((post: any) => {
                    const statusCfg = STATUS_CONFIG[post.status as PostStatus];
                    return (
                      <div
                        key={post.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedPost(post.id); }}
                        className={`text-xs px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80 ${statusCfg.color}`}
                        title={post.title}
                      >
                        {post.platform === "instagram" ? "📸" : post.platform === "facebook" ? "👍" : "📱"} {post.title}
                      </div>
                    );
                  })}
                  {dayPosts.length > 3 && (
                    <div className="text-xs text-gray-500 px-1">+{dayPosts.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded border ${cfg.color}`} />
            <span className="text-gray-400 text-xs">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Post Detail Modal */}
      {selectedPost && postDetail && (
        <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
          <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>{postDetail.post.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded border ${STATUS_CONFIG[postDetail.post.status as PostStatus].color}`}>
                  {STATUS_CONFIG[postDetail.post.status as PostStatus].label}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                  {PLATFORM_LABELS[postDetail.post.platform as Platform]}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                  {CONTENT_TYPE_LABELS[postDetail.post.contentType as ContentType]}
                </span>
              </div>

              <div className="text-sm text-gray-400">
                📅 {postDetail.post.scheduledDate} às {postDetail.post.scheduledTime}
              </div>

              {postDetail.post.caption && (
                <div>
                  <p className="text-gray-500 text-xs mb-1">Legenda</p>
                  <p className="text-gray-300 text-sm bg-gray-800 rounded p-2">{postDetail.post.caption}</p>
                </div>
              )}

              {postDetail.post.hashtags && (
                <p className="text-blue-400 text-xs">{postDetail.post.hashtags}</p>
              )}

              {/* Performance metrics if published */}
              {postDetail.post.status === "published" && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-gray-800 rounded p-2 text-center">
                    <Eye className="w-3 h-3 text-gray-400 mx-auto mb-0.5" />
                    <p className="text-white text-sm font-bold">{(postDetail.post.reach || 0).toLocaleString("pt-BR")}</p>
                    <p className="text-gray-500 text-xs">Alcance</p>
                  </div>
                  <div className="bg-gray-800 rounded p-2 text-center">
                    <Heart className="w-3 h-3 text-pink-400 mx-auto mb-0.5" />
                    <p className="text-white text-sm font-bold">{(postDetail.post.likes || 0).toLocaleString("pt-BR")}</p>
                    <p className="text-gray-500 text-xs">Curtidas</p>
                  </div>
                  <div className="bg-gray-800 rounded p-2 text-center">
                    <MessageCircle className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
                    <p className="text-white text-sm font-bold">{(postDetail.post.comments || 0).toLocaleString("pt-BR")}</p>
                    <p className="text-gray-500 text-xs">Comentários</p>
                  </div>
                  <div className="bg-gray-800 rounded p-2 text-center">
                    <Bookmark className="w-3 h-3 text-yellow-400 mx-auto mb-0.5" />
                    <p className="text-white text-sm font-bold">{(postDetail.post.saves || 0).toLocaleString("pt-BR")}</p>
                    <p className="text-gray-500 text-xs">Salvamentos</p>
                  </div>
                </div>
              )}

              {/* Status change */}
              <div>
                <p className="text-gray-500 text-xs mb-1">Alterar status:</p>
                <div className="flex flex-wrap gap-2">
                  {(["planned", "ready", "published", "cancelled"] as PostStatus[]).filter(s => s !== postDetail.post.status).map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: postDetail.post.id, status: s })}
                      disabled={updateMutation.isPending}
                      className="border-gray-700 text-gray-300 hover:text-white text-xs"
                    >
                      {STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteMutation.mutate({ id: postDetail.post.id })}
                disabled={deleteMutation.isPending}
                className="border-red-800 text-red-400 hover:text-red-300 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Remover
              </Button>
              <Button variant="outline" onClick={() => setSelectedPost(null)} className="border-gray-700 text-gray-300">
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Post Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Post no Calendário</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">Título interno *</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Ex: Post produto Wallbox — Semana 3" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Plataforma</Label>
              <Select value={form.platform} onValueChange={(v) => setForm(f => ({ ...f, platform: v as Platform }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Tipo de conteúdo</Label>
              <Select value={form.contentType} onValueChange={(v) => setForm(f => ({ ...f, contentType: v as ContentType }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="post">Post</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="reels">Reels</SelectItem>
                  <SelectItem value="carousel">Carrossel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Data *</Label>
              <Input type="date" value={form.scheduledDate} onChange={(e) => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Horário</Label>
              <Input type="time" value={form.scheduledTime} onChange={(e) => setForm(f => ({ ...f, scheduledTime: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as PostStatus }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="planned">Planejado</SelectItem>
                  <SelectItem value="ready">Pronto</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400 text-xs">Responsável</Label>
              <Input value={form.assignedTo} onChange={(e) => setForm(f => ({ ...f, assignedTo: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Nome do responsável" />
            </div>
            {drafts.length > 0 && (
              <div className="col-span-2">
                <Label className="text-gray-400 text-xs">Vincular rascunho Instagram</Label>
                <Select value={form.instagramDraftId} onValueChange={(v) => setForm(f => ({ ...f, instagramDraftId: v }))}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                    <SelectValue placeholder="Selecionar rascunho (opcional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="">Nenhum</SelectItem>
                    {drafts.map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        [{d.type}] {d.caption ? d.caption.slice(0, 40) + "..." : `Rascunho #${d.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">Legenda / Copy</Label>
              <Textarea value={form.caption} onChange={(e) => setForm(f => ({ ...f, caption: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1 resize-none" rows={3} placeholder="Texto do post..." />
            </div>
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">Hashtags</Label>
              <Input value={form.hashtags} onChange={(e) => setForm(f => ({ ...f, hashtags: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="#zenitetech #wallbox #mobilidadeeletrica" />
            </div>
            <div className="col-span-2">
              <Label className="text-gray-400 text-xs">Notas internas</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-gray-800 border-gray-700 text-white mt-1 resize-none" rows={2} placeholder="Observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} className="border-gray-700 text-gray-300">
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate({
                title: form.title,
                platform: form.platform,
                contentType: form.contentType,
                caption: form.caption || undefined,
                hashtags: form.hashtags || undefined,
                instagramDraftId: form.instagramDraftId ? parseInt(form.instagramDraftId) : undefined,
                scheduledDate: form.scheduledDate,
                scheduledTime: form.scheduledTime,
                status: form.status,
                assignedTo: form.assignedTo || undefined,
                notes: form.notes || undefined,
              })}
              disabled={createMutation.isPending || !form.title.trim() || !form.scheduledDate}
              className="bg-pink-600 hover:bg-pink-700 text-white"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Adicionar ao Calendário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
