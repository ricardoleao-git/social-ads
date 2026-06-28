import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function ChangePassword() {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const changeMutation = trpc.dashboardAuth.changePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setError("");
    },
    onError: (e) => {
      setError(e.message);
      setSuccess(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (newPwd !== confirmPwd) {
      setError("A nova senha e a confirmação não coincidem.");
      return;
    }
    if (newPwd.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    changeMutation.mutate({ currentPassword: currentPwd, newPassword: newPwd });
  };

  const strength = () => {
    if (newPwd.length === 0) return null;
    let score = 0;
    if (newPwd.length >= 8) score++;
    if (newPwd.length >= 12) score++;
    if (/[A-Z]/.test(newPwd)) score++;
    if (/[0-9]/.test(newPwd)) score++;
    if (/[^A-Za-z0-9]/.test(newPwd)) score++;
    if (score <= 2) return { label: "Fraca", color: "bg-red-500", width: "w-1/4" };
    if (score <= 3) return { label: "Média", color: "bg-yellow-500", width: "w-2/4" };
    if (score <= 4) return { label: "Forte", color: "bg-blue-500", width: "w-3/4" };
    return { label: "Muito forte", color: "bg-green-500", width: "w-full" };
  };

  const pwdStrength = strength();

  return (
    <>
      <div className="p-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <KeyRound className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Alterar Senha</h1>
            <p className="text-muted-foreground text-sm">Atualize sua senha de acesso ao dashboard</p>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-foreground text-base">Nova senha</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Use uma senha forte com letras maiúsculas, números e símbolos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current password */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Senha atual</Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    required
                    className="bg-muted border-border text-foreground pr-10"
                    placeholder="Sua senha atual"
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    required
                    className="bg-muted border-border text-foreground pr-10"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength indicator */}
                {pwdStrength && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pwdStrength.color} ${pwdStrength.width}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">Força: <span className="text-foreground">{pwdStrength.label}</span></p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    required
                    className={`bg-muted border-border text-foreground pr-10 ${
                      confirmPwd && confirmPwd !== newPwd ? "border-red-500" : ""
                    }`}
                    placeholder="Repita a nova senha"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPwd && confirmPwd !== newPwd && (
                  <p className="text-xs text-red-400">As senhas não coincidem</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Senha alterada com sucesso!
                </div>
              )}

              <Button
                type="submit"
                disabled={changeMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-foreground h-11"
              >
                {changeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Alterando...</>
                ) : "Alterar Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security tips */}
        <div className="mt-4 p-4 bg-card/50 border border-border rounded-lg">
          <p className="text-muted-foreground text-xs font-medium mb-2">Dicas de segurança:</p>
          <ul className="text-slate-500 text-xs space-y-1">
            <li>• Use pelo menos 8 caracteres com letras, números e símbolos</li>
            <li>• Não reutilize senhas de outros serviços</li>
            <li>• Não compartilhe sua senha com ninguém</li>
            <li>• Troque sua senha periodicamente (a cada 90 dias)</li>
          </ul>
        </div>
      </div>
    </>
  );
}
