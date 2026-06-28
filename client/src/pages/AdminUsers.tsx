import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Pencil,
  Trash2,
  KeyRound,
  Loader2,
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "viewer";
  active: number;
  createdAt: Date;
  lastLoginAt: Date | null;
};

export default function AdminUsers() {
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.dashboardUsers.list.useQuery();

  // Create user dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [showNewPwd, setShowNewPwd] = useState(false);

  // Edit user dialog
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "viewer">("viewer");

  // Reset password dialog
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [showResetPwd, setShowResetPwd] = useState(false);

  const createMutation = trpc.dashboardUsers.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.dashboardUsers.list.invalidate();
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("viewer");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.dashboardUsers.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado!");
      utils.dashboardUsers.list.invalidate();
      setEditUser(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const resetPwdMutation = trpc.dashboardUsers.resetUserPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setResetUser(null);
      setResetPwd("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.dashboardUsers.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário removido.");
      utils.dashboardUsers.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = (user: UserRow) => {
    updateMutation.mutate({ id: user.id, active: user.active === 1 ? 0 : 1 });
  };

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  };

  return (
    <>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Gerenciar Usuários</h1>
              <p className="text-muted-foreground text-sm">Controle de acesso ao dashboard</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-foreground gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </div>

        {/* Users Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground text-base">
              {users?.length ?? 0} usuário(s) cadastrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-2">Nome</th>
                      <th className="text-left py-3 px-2">E-mail</th>
                      <th className="text-left py-3 px-2">Perfil</th>
                      <th className="text-left py-3 px-2">Status</th>
                      <th className="text-left py-3 px-2">Último acesso</th>
                      <th className="text-right py-3 px-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((user) => (
                      <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-2 text-foreground font-medium">{user.name}</td>
                        <td className="py-3 px-2 text-muted-foreground">{user.email}</td>
                        <td className="py-3 px-2">
                          {user.role === "admin" ? (
                            <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30 gap-1">
                              <ShieldCheck className="w-3 h-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-600/20 text-muted-foreground border-border/30">
                              Visualizador
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <button onClick={() => toggleActive(user as UserRow)} className="flex items-center gap-1">
                            {user.active === 1 ? (
                              <span className="flex items-center gap-1 text-green-400 text-xs">
                                <CheckCircle className="w-3 h-3" /> Ativo
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400 text-xs">
                                <XCircle className="w-3 h-3" /> Inativo
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground text-xs">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleString("pt-BR")
                            : "Nunca"}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(user as UserRow)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setResetUser(user as UserRow); setResetPwd(""); }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-yellow-400"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Excluir ${user.name}?`)) deleteMutation.mutate({ id: user.id });
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)}
                className="bg-muted border-border text-foreground" placeholder="Nome completo" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                className="bg-muted border-border text-foreground" placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Senha inicial</Label>
              <div className="relative">
                <Input type={showNewPwd ? "text" : "password"} value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-muted border-border text-foreground pr-10" placeholder="Mínimo 8 caracteres" />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Perfil</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "viewer")}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  <SelectItem value="viewer">Visualizador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-muted-foreground">Cancelar</Button>
            <Button onClick={() => createMutation.mutate({ name: newName, email: newEmail, password: newPassword, role: newRole })}
              disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">E-mail</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Perfil</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "admin" | "viewer")}>
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  <SelectItem value="viewer">Visualizador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)} className="text-muted-foreground">Cancelar</Button>
            <Button onClick={() => editUser && updateMutation.mutate({ id: editUser.id, name: editName, email: editEmail, role: editRole })}
              disabled={updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha — {resetUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Nova senha</Label>
              <div className="relative">
                <Input type={showResetPwd ? "text" : "password"} value={resetPwd}
                  onChange={(e) => setResetPwd(e.target.value)}
                  className="bg-muted border-border text-foreground pr-10" placeholder="Mínimo 8 caracteres" />
                <button type="button" onClick={() => setShowResetPwd(!showResetPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showResetPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetUser(null)} className="text-muted-foreground">Cancelar</Button>
            <Button onClick={() => resetUser && resetPwdMutation.mutate({ id: resetUser.id, newPassword: resetPwd })}
              disabled={resetPwdMutation.isPending || resetPwd.length < 8}
              className="bg-yellow-600 hover:bg-yellow-700">
              {resetPwdMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Redefinir Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
