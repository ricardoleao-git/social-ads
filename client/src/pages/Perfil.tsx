/**
 * Página: Perfil do Usuário
 * Permite alterar nome, senha e avatar de acesso.
 */
import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User, Lock, Eye, EyeOff, CheckCircle2, AlertCircle,
  Shield, Mail, Camera, Upload, X,
} from "lucide-react";
import { toast } from "sonner";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(password) },
    { label: "Letra minúscula", ok: /[a-z]/.test(password) },
    { label: "Número", ok: /\d/.test(password) },
    { label: "Caractere especial", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"];
  const labels = ["", "Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? colors[score] : "bg-gray-700"}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${score >= 4 ? "text-green-400" : score >= 3 ? "text-yellow-400" : "text-red-400"}`}>
        {labels[score]}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {checks.map(c => (
          <div key={c.label} className={`flex items-center gap-1 text-xs ${c.ok ? "text-green-400" : "text-muted-foreground"}`}>
            {c.ok ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-600" />}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Perfil() {
  const { user, refetch } = useDashAuth();

  // ── Avatar ────────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<{ base64: string; mimeType: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const uploadAvatar = trpc.dashboardAuth.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setAvatarUploading(false);
      setAvatarFile(null);
      toast.success("Avatar atualizado com sucesso!");
      refetch?.();
    },
    onError: (e) => {
      setAvatarUploading(false);
      toast.error(`Erro ao enviar avatar: ${e.message}`);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setAvatarPreview(result);
      setAvatarFile({ base64: result, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = () => {
    if (!avatarFile) return;
    setAvatarUploading(true);
    uploadAvatar.mutate({ imageBase64: avatarFile.base64, mimeType: avatarFile.mimeType });
  };

  const currentAvatar = avatarPreview ?? (user as any)?.avatarUrl ?? null;
  const initials = (user?.name ?? "U").charAt(0).toUpperCase();

  // ── Nome ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? "");
  const [nameSuccess, setNameSuccess] = useState(false);

  const updateProfile = trpc.dashboardAuth.updateProfile.useMutation({
    onSuccess: () => {
      setNameSuccess(true);
      toast.success("Nome atualizado com sucesso!");
      refetch?.();
      setTimeout(() => setNameSuccess(false), 3000);
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleSaveName = () => {
    if (!name.trim() || name.trim() === user?.name) return;
    updateProfile.mutate({ name: name.trim() });
  };

  // ── Senha ─────────────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const changePassword = trpc.dashboardAuth.changePassword.useMutation({
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada com sucesso!");
      setTimeout(() => setPasswordSuccess(false), 4000);
    },
    onError: (e) => {
      setPasswordError(e.message);
      toast.error(`Erro: ${e.message}`);
    },
  });

  const handleChangePassword = () => {
    setPasswordError("");
    if (!currentPassword) return setPasswordError("Informe a senha atual.");
    if (newPassword.length < 8) return setPasswordError("A nova senha deve ter pelo menos 8 caracteres.");
    if (newPassword !== confirmPassword) return setPasswordError("As senhas não coincidem.");
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="w-6 h-6 text-blue-400" />
          Perfil do Usuário
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas informações de acesso ao dashboard
        </p>
      </div>

      {/* Info do usuário com avatar */}
      <Card className="bg-card border-border">
        <CardContent className="pt-5">
          <div className="flex items-center gap-5">
            {/* Avatar com botão de upload */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-500/40 bg-blue-600/20 flex items-center justify-center">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-blue-400 text-3xl font-bold">{initials}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center border-2 border-gray-900 transition-colors"
                title="Alterar foto"
              >
                <Camera className="w-3.5 h-3.5 text-foreground" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold text-lg">{user?.name ?? "—"}</p>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <Mail className="w-3.5 h-3.5" />
                {user?.email ?? "—"}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-purple-400 font-medium capitalize">
                  {user?.role === "admin" ? "Administrador" : "Visualizador"}
                </span>
              </div>

              {/* Botões de ação do avatar */}
              {avatarFile && (
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleSaveAvatar}
                    disabled={avatarUploading}
                    className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
                  >
                    {avatarUploading ? (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        Salvar foto
                      </span>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setAvatarPreview(null); setAvatarFile(null); }}
                    className="border-border text-muted-foreground h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancelar
                  </Button>
                </div>
              )}
              {!avatarFile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" />
                  {currentAvatar ? "Alterar foto" : "Adicionar foto"}
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alterar nome */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <User className="w-4 h-4 text-blue-400" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Nome de exibição</Label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="bg-muted border-border text-foreground flex-1"
                onKeyDown={e => e.key === "Enter" && handleSaveName()}
              />
              <Button
                onClick={handleSaveName}
                disabled={updateProfile.isPending || !name.trim() || name.trim() === user?.name}
                className="bg-blue-600 hover:bg-blue-700 shrink-0"
              >
                {updateProfile.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            {nameSuccess && (
              <div className="flex items-center gap-1.5 text-green-400 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Nome atualizado com sucesso!
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">E-mail</Label>
            <Input
              value={user?.email ?? ""}
              disabled
              className="bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
            />
            <p className="text-gray-600 text-xs">O e-mail não pode ser alterado por aqui. Entre em contato com o administrador.</p>
          </div>
        </CardContent>
      </Card>

      {/* Alterar senha */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-yellow-400" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordSuccess && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-green-400 text-sm">Senha alterada com sucesso!</p>
            </div>
          )}
          {passwordError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm">{passwordError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Senha atual</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-muted border-border text-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Nova senha</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-muted border-border text-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-sm">Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={`bg-muted border-border text-foreground pr-10 ${
                  confirmPassword && confirmPassword !== newPassword ? "border-red-500/50" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-red-400 text-xs">As senhas não coincidem.</p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-foreground"
          >
            {changePassword.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Alterando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Alterar Senha
              </span>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
