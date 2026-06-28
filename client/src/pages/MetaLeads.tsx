import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  FileText,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle,
  Archive,
  AlertCircle,
  Facebook,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFieldValue(fieldData: { name: string; values: string[] }[], key: string): string {
  const field = fieldData.find((f) => f.name === key || f.name.includes(key));
  return field?.values?.[0] ?? "—";
}

function exportLeadsCSV(leads: any[], formName: string) {
  if (!leads.length) return;
  const allKeys = Array.from(new Set(leads.flatMap((l) => l.field_data.map((f: any) => f.name))));
  const headers = ["Data", ...allKeys];
  const rows = leads.map((l) => {
    const row: string[] = [formatDate(l.created_time)];
    allKeys.forEach((k) => {
      const f = l.field_data.find((fd: any) => fd.name === k);
      row.push(f?.values?.[0] ?? "");
    });
    return row;
  });
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${formName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
}

interface MetaLead {
  id: string;
  created_time: string;
  field_data: { name: string; values: string[] }[];
}

function LeadsTable({ formId, formName }: { formId: string; formName: string }) {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = trpc.metaLeads.getLeads.useQuery({ formId, limit: 50 });

  const leads: MetaLead[] = (data?.leads ?? []) as MetaLead[];
  const filtered: MetaLead[] = search
    ? leads.filter((l) =>
        l.field_data.some((f) => f.values?.some((v: string) => v.toLowerCase().includes(search.toLowerCase())))
      )
    : leads;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Carregando leads...
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="py-6 text-center text-muted-foreground text-sm">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhum lead encontrado neste formulário
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => exportLeadsCSV(leads, formName)}>
          <Download className="w-3.5 h-3.5 mr-1" />
          CSV
        </Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {data?.isSimulated && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Dados simulados — leads reais serão exibidos quando houver preenchimentos
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((lead) => (
          <div key={lead.id} className="border border-border rounded-lg p-3 bg-card/50 hover:bg-card transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs text-muted-foreground">{formatDate(lead.created_time)}</span>
              <Badge variant="outline" className="text-xs shrink-0">Lead</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {lead.field_data.map((field: any) => (
                <div key={field.name} className="text-xs">
                  <span className="text-muted-foreground capitalize">{field.name.replace(/_/g, " ")}: </span>
                  <span className="text-foreground font-medium">{field.values?.[0] ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormCard({ form }: { form: any }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    form.status === "ACTIVE"
      ? "bg-green-500/10 text-green-400 border-green-500/30"
      : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate">{form.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(form.createdTime)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`text-xs ${statusColor}`}>
              {form.status === "ACTIVE" ? (
                <CheckCircle className="w-3 h-3 mr-1" />
              ) : (
                <Archive className="w-3 h-3 mr-1" />
              )}
              {form.status === "ACTIVE" ? "Ativo" : "Arquivado"}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {form.leadsCount} leads
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs h-7"
          onClick={() => setExpanded(!expanded)}
        >
          <span>Ver leads</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </Button>
        {expanded && (
          <div className="mt-3 border-t border-border pt-3">
            <LeadsTable formId={form.id} formName={form.name} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MetaLeads() {
  const [showArchived, setShowArchived] = useState(false);

  const { data: summary, isLoading: loadingSummary, refetch } = trpc.metaLeads.getSummary.useQuery();
  const { data: formsData, isLoading: loadingForms } = trpc.metaLeads.getLeadForms.useQuery();

  const allForms = formsData?.forms ?? summary?.forms ?? [];
  const activeForms = allForms.filter((f: any) => f.status === "ACTIVE");
  const archivedForms = allForms.filter((f: any) => f.status !== "ACTIVE");
  const displayForms = showArchived ? allForms : activeForms;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Facebook className="w-4 h-4 text-blue-400" />
              </div>
              <h1 className="text-xl font-semibold">Leads Meta Ads</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Formulários de captação de leads da página Zênite Tech no Facebook
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">Total Formulários</span>
              </div>
              <p className="text-2xl font-bold">{loadingSummary ? "—" : (summary?.totalForms ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-foreground">Ativos</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{loadingSummary ? "—" : (summary?.activeForms ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-foreground">Total Leads</span>
              </div>
              <p className="text-2xl font-bold">{loadingSummary ? "—" : (summary?.totalLeads ?? 0)}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Archive className="w-4 h-4 text-zinc-400" />
                <span className="text-xs text-muted-foreground">Arquivados</span>
              </div>
              <p className="text-2xl font-bold text-muted-foreground">{archivedForms.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Forms List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Formulários {showArchived ? "— Todos" : "— Ativos"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? "Ocultar arquivados" : `Mostrar arquivados (${archivedForms.length})`}
            </Button>
          </div>

          {loadingForms ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Carregando formulários...
            </div>
          ) : displayForms.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum formulário ativo encontrado</p>
              <p className="text-xs mt-1">Crie formulários de lead no Meta Ads Manager</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {displayForms.map((form: any) => (
                <FormCard key={form.id} form={form} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
