import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, FileText, ExternalLink, ChevronDown, ChevronUp, Zap, Eye } from "lucide-react";

const useCreativeData = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    fetch("/api/trpc/googleAds.getCreativeAnalysis")
      .then(res => res.json())
      .then(d => {
        const result = d?.result?.data?.json ?? d?.result?.data;
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  });

  return { data, loading, error };
};

function StrengthBadge({ strength }: { strength: { label: string; color: string } }) {
  const colors: Record<string, string> = {
    green: "bg-green-600 text-white",
    blue: "bg-blue-600 text-white",
    yellow: "bg-yellow-500 text-black",
    red: "bg-red-600 text-white",
    gray: "bg-gray-600 text-white",
  };
  return <Badge className={colors[strength.color] || colors.gray}>{strength.label}</Badge>;
}

function RSAPreview({ ad }: { ad: any }) {
  // Simula a aparência de um anúncio de pesquisa do Google
  const headline = ad.headlines.slice(0, 3).map((h: any) => h.text).join(" | ");
  const description = ad.descriptions.slice(0, 2).map((d: any) => d.text).join(" ");
  const url = ad.finalUrls?.[0] || "zenitetech.com";

  return (
    <div className="bg-white rounded-lg p-4 max-w-lg border border-gray-200">
      <div className="text-xs text-gray-500 mb-1">Anúncio · {url}</div>
      <div className="text-blue-700 text-base font-medium leading-tight mb-1 hover:underline cursor-default">
        {headline}
      </div>
      <div className="text-sm text-gray-600 leading-snug">
        {description}
      </div>
    </div>
  );
}

export default function CreativeAnalysis() {
  const { data, loading, error } = useCreativeData();
  const [expandedAds, setExpandedAds] = useState<Set<number>>(new Set());
  const [previewAd, setPreviewAd] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-gray-400">Carregando análise de criativos...</span>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-6">
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400">Erro ao carregar criativos: {error || data?.error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ads = data.ads || [];
  const strengthCounts = {
    excellent: ads.filter((a: any) => a.strength.label === "Excelente").length,
    good: ads.filter((a: any) => a.strength.label === "Boa").length,
    average: ads.filter((a: any) => a.strength.label === "Média").length,
    poor: ads.filter((a: any) => a.strength.label === "Ruim").length,
  };

  const toggleExpand = (idx: number) => {
    const next = new Set(expandedAds);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setExpandedAds(next);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-7 h-7 text-purple-400" />
          Análise de Criativos RSA
        </h1>
        <p className="text-gray-400 mt-1">
          Performance de cada anúncio responsivo de pesquisa com preview visual — dados dos últimos 30 dias
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400 uppercase">Total RSAs</p>
            <p className="text-2xl font-bold text-white mt-1">{ads.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-950/30 border-green-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-green-400 uppercase">Excelente</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{strengthCounts.excellent}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-950/30 border-blue-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-400 uppercase">Boa</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{strengthCounts.good}</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-950/30 border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-yellow-400 uppercase">Média</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{strengthCounts.average}</p>
          </CardContent>
        </Card>
        <Card className="bg-red-950/30 border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-red-400 uppercase">Ruim</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{strengthCounts.poor}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ads List */}
      <div className="space-y-4">
        {ads.map((ad: any, idx: number) => (
          <Card key={idx} className="bg-slate-800/50 border-slate-700 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    {ad.campaign} / {ad.adGroup}
                    <StrengthBadge strength={ad.strength} />
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    {ad.headlines.length} headlines · {ad.descriptions.length} descrições
                    {ad.finalUrls?.[0] && (
                      <> · <a href={ad.finalUrls[0]} target="_blank" rel="noopener" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                        {ad.finalUrls[0].replace(/^https?:\/\//, "").slice(0, 40)} <ExternalLink className="w-3 h-3" />
                      </a></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">Impressões</p>
                    <p className="text-white font-medium">{ad.impressions.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">Cliques</p>
                    <p className="text-white font-medium">{ad.clicks.toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">CTR</p>
                    <p className={`font-medium ${ad.ctr >= 10 ? "text-green-400" : ad.ctr >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                      {ad.ctr.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">CPC</p>
                    <p className="text-white font-medium">R$ {ad.cpc.toFixed(2)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">Conv.</p>
                    <p className="text-white font-medium">{ad.conversions}</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2 mb-3">
                <Button variant="ghost" size="sm" onClick={() => setPreviewAd(previewAd === idx ? null : idx)}>
                  <Eye className="w-4 h-4 mr-1" /> Preview
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleExpand(idx)}>
                  <Zap className="w-4 h-4 mr-1" /> Detalhes
                  {expandedAds.has(idx) ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
              </div>

              {/* Preview Google Ad */}
              {previewAd === idx && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2 uppercase">Preview do anúncio (simulação Google)</p>
                  <RSAPreview ad={ad} />
                </div>
              )}

              {/* Expanded Details */}
              {expandedAds.has(idx) && (
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-2">Headlines ({ad.headlines.length})</p>
                    <div className="space-y-1">
                      {ad.headlines.map((h: any, hi: number) => (
                        <div key={hi} className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500 w-5 text-right">{hi + 1}.</span>
                          <span className="text-gray-200">{h.text}</span>
                          {h.pinned && <Badge variant="outline" className="text-xs">Pin {h.pinned}</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-2">Descrições ({ad.descriptions.length})</p>
                    <div className="space-y-1">
                      {ad.descriptions.map((d: any, di: number) => (
                        <div key={di} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-500 w-5 text-right shrink-0">{di + 1}.</span>
                          <span className="text-gray-200">{d.text}</span>
                          {d.pinned && <Badge variant="outline" className="text-xs">Pin {d.pinned}</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
