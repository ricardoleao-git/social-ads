/**
 * Página: Admin Clientes
 * Painel de administração para gerenciar clientes cadastrados no sistema de relatórios.
 * Permite criar, editar, ativar/desativar e excluir clientes.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Users, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Mail, Package, Filter, Search, RefreshCw, CheckCircle2, XCircle,
} from "lucide-react";

type Client = {
  id: number;
  name: string;
  product: string;
  email: string;
  adGroupFilter: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const EMPTY_FORM = {
  name: "",
  product: "",
  email: "",
  adGroupFilter: "",
  active: true,
};

export default function AdminClientes() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: clientsData, refetch, isLoading } = trpc.clientReport.listClients.useQuery();
  const clients: Client[] = (clientsData ?? []) as Client[];

  const utils = trpc.useUtils();

  const createMutation = trpc.clientReport.createClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente criado com sucesso");
      utils.clientReport.listClients.invalidate();
      handleCloseForm();
    },
    onError: (err) => toast.error("Erro ao criar cliente", { description: err.message }),
  });

  const updateMutation = trpc.clientReport.updateClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso");
      utils.clientReport.listClients.invalidate();
      handleCloseForm();
    },
    onError: (err) => toast.error("Erro ao atualizar cliente", { description: err.message }),
  });

  const deleteMutation = trpc.clientReport.deleteClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido com sucesso");
      utils.clientReport.listClients.invalidate();
      setDeleteTarget(null);
    },
    onError: (err) => toast.error("Erro ao remover cliente", { description: err.message }),
  });

  const handleOpenCreate = () => {
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowForm(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      product: client.product,
      email: client.email,
      adGroupFilter: client.adGroupFilter,
      active: client.active,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingClient(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Nome é obrigatório";
    if (!form.product.trim()) errors.product = "Produto é obrigatório";
    if (!form.email.trim()) errors.email = "E-mail é obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "E-mail inválido";
    if (!form.adGroupFilter.trim()) errors.adGroupFilter = "Filtro de grupo é obrigatório";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleToggleActive = (client: Client) => {
    updateMutation.mutate(
      { id: client.id, active: !client.active },
      {
        onSuccess: () => {
          toast.success(client.active ? "Cliente desativado" : "Cliente ativado");
          utils.clientReport.listClients.invalidate();
        },
      }
    );
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.product.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = clients.filter(c => c.active).length;
  const inactiveCount = clients.filter(c => !c.active).length;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Administração de Clientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os clientes cadastrados no sistema de relatórios mensais
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          Novo Cliente
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Inativos</p>
                <p className="text-2xl font-bold text-muted-foreground">{inactiveCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-muted-foreground opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de clientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Clientes Cadastrados</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 w-56 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Carregando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{search ? "Nenhum cliente encontrado para a busca" : "Nenhum cliente cadastrado"}</p>
              {!search && (
                <Button variant="outline" size="sm" className="mt-3" onClick={handleOpenCreate}>
                  <Plus className="w-4 h-4 mr-1" />
                  Cadastrar primeiro cliente
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">Cliente</th>
                    <th className="pb-3 pr-4 font-medium">Produto</th>
                    <th className="pb-3 pr-4 font-medium">E-mail</th>
                    <th className="pb-3 pr-4 font-medium">Filtro de Grupo</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Cadastrado em</th>
                    <th className="pb-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-gray-900">{client.name}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Package className="w-3.5 h-3.5 text-muted-foreground" />
                          {client.product}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          {client.email}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{client.adGroupFilter}</code>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge
                          variant={client.active ? "default" : "secondary"}
                          className={client.active ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                        >
                          {client.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">
                        {new Date(client.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(client)}
                            title={client.active ? "Desativar" : "Ativar"}
                            className="h-8 w-8 p-0"
                          >
                            {client.active
                              ? <ToggleRight className="w-4 h-4 text-green-600" />
                              : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            }
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(client)}
                            title="Editar"
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(client)}
                            title="Excluir"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de criação/edição */}
      <Dialog open={showForm} onOpenChange={open => !open && handleCloseForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome do Cliente</Label>
              <Input
                id="name"
                placeholder="Ex: Empresa ABC Ltda"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product">Produto / Serviço</Label>
              <Input
                id="product"
                placeholder="Ex: Wallbox, GuardIA, ZIPY..."
                value={form.product}
                onChange={e => setForm(f => ({ ...f, product: e.target.value }))}
              />
              {formErrors.product && <p className="text-xs text-red-500">{formErrors.product}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail para Envio do Relatório</Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@empresa.com.br"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adGroupFilter">
                Filtro de Grupo de Anúncios
                <span className="text-xs text-muted-foreground ml-1">(palavra-chave para filtrar grupos)</span>
              </Label>
              <Input
                id="adGroupFilter"
                placeholder="Ex: Wallbox, GuardIA, Relógio..."
                value={form.adGroupFilter}
                onChange={e => setForm(f => ({ ...f, adGroupFilter: e.target.value }))}
              />
              {formErrors.adGroupFilter && <p className="text-xs text-red-500">{formErrors.adGroupFilter}</p>}
              <p className="text-xs text-muted-foreground">
                O relatório incluirá apenas grupos de anúncios que contenham essa palavra no nome.
              </p>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <Label className="text-sm">Cliente Ativo</Label>
                <p className="text-xs text-muted-foreground">Clientes inativos não recebem relatórios automáticos</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseForm} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? (
                <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Salvando...</>
              ) : (
                editingClient ? "Salvar alterações" : "Criar cliente"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cliente <strong>{deleteTarget?.name}</strong>?
              Esta ação não pode ser desfeita e todos os relatórios associados serão mantidos no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
