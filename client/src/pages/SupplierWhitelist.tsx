import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Building2,
  Search,
} from "lucide-react";

export default function SupplierWhitelist() {
  
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ term: "", supplierName: "", reason: "" });

  const { data, refetch, isLoading } = trpc.supplierWhitelist.list.useQuery();
  const createMut = trpc.supplierWhitelist.create.useMutation({
    onSuccess: () => { refetch(); setShowAdd(false); setForm({ term: "", supplierName: "", reason: "" }); toast.success("Fornecedor adicionado com sucesso"); },
    onError: (e) => toast.error("Erro ao adicionar: " + e.message),
  });
  const updateMut = trpc.supplierWhitelist.update.useMutation({
    onSuccess: () => { refetch(); setEditItem(null); toast.success("Fornecedor atualizado"); },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });
  const deleteMut = trpc.supplierWhitelist.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Fornecedor removido"); },
    onError: (e) => toast.error("Erro ao remover: " + e.message),
  });
  const toggleMut = trpc.supplierWhitelist.toggle.useMutation({
    onSuccess: () => refetch(),
  });

  const filtered = (data ?? []).filter(
    (s) =>
      s.term.toLowerCase().includes(search.toLowerCase()) ||
      s.supplierName.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: Record<string, typeof filtered>, item) => {
    if (!acc[item.supplierName]) acc[item.supplierName] = [];
    acc[item.supplierName].push(item);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-green-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fornecedores Protegidos</h1>
            <p className="text-sm text-muted-foreground">
              Termos desses fornecedores <strong>nunca serão negativados</strong> automaticamente
            </p>
          </div>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Adicionar Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Fornecedor Protegido</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Nome do Fornecedor</Label>
                <Input
                  placeholder="ex: Intelbras"
                  value={form.supplierName}
                  onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                />
              </div>
              <div>
                <Label>Termo de Pesquisa Protegido</Label>
                <Input
                  placeholder="ex: intelbras camera"
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Qualquer busca que contenha este termo será ignorada pelo sistema de negativação
                </p>
              </div>
              <div>
                <Label>Motivo (opcional)</Label>
                <Textarea
                  placeholder="ex: Fornecedor de câmeras de segurança parceiro"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
                <Button
                  onClick={() => createMut.mutate(form)}
                  disabled={!form.term || !form.supplierName || createMut.isPending}
                >
                  {createMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Aviso */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-600 dark:text-amber-400">Regra de Proteção Ativa</p>
          <p className="text-muted-foreground mt-1">
            Control ID, Intelbras, Hikvision, Topdata e Henry são fornecedores de equipamentos da Zênite Tech.
            Termos relacionados a eles indicam <strong>intenção de compra relevante</strong> e nunca devem ser negativados.
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por fornecedor ou termo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">{data?.filter(s => s.active).length ?? 0}</div>
            <div className="text-sm text-muted-foreground">Termos Ativos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">{Object.keys(grouped).length}</div>
            <div className="text-sm text-muted-foreground">Fornecedores</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-muted-foreground">{data?.filter(s => !s.active).length ?? 0}</div>
            <div className="text-sm text-muted-foreground">Termos Inativos</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista agrupada por fornecedor */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([supplierName, items]) => (
            <Card key={supplierName}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  {supplierName}
                  <Badge variant="secondary" className="ml-auto">
                    {items.length} {items.length === 1 ? "termo" : "termos"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                    >
                      <Switch
                        checked={item.active === 1}
                        onCheckedChange={(checked) =>
                          toggleMut.mutate({ id: item.id, active: checked ? 1 : 0 })
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <code className="text-sm font-mono text-foreground">{item.term}</code>
                        {item.reason && (
                          <p className="text-xs text-muted-foreground truncate">{item.reason}</p>
                        )}
                      </div>
                      {item.active === 0 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => { setEditItem(item); setForm({ term: item.term, supplierName: item.supplierName, reason: item.reason ?? "" }); }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remover "${item.term}"?`)) deleteMut.mutate({ id: item.id });
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum fornecedor encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de edição */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome do Fornecedor</Label>
              <Input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} />
            </div>
            <div>
              <Label>Termo Protegido</Label>
              <Input value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
            </div>
            <div>
              <Label>Motivo</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
              <Button
                onClick={() => updateMut.mutate({ id: editItem.id, ...form })}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
