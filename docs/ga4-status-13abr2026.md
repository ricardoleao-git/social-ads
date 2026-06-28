# Base de Conhecimento — Estado do GA4 Zênite Tech

**Data de registro:** 13/04/2026  
**Responsável:** Ricardo Leão — Zênite Tech  
**Domínio rastreado:** zenitetech.com  
**Dashboard:** trafego-google.zenitetech.com

---

## 1. Identificação da Property

| Campo | Valor |
|---|---|
| Property ID (UA/GA4) | G-XN8107LBV6 |
| Property Numérico | 531461479 |
| Tipo | Google Analytics 4 |
| Domínio principal | zenitetech.com |
| Status | ✅ Ativo e rastreando |

---

## 2. Vinculação GA4 ↔ Google Ads

A vinculação entre o Google Analytics 4 e a conta Google Ads da Zênite Tech foi ativada em **07/04/2026** e está operacional.

| Item | Detalhe |
|---|---|
| Data de ativação | 07/04/2026 |
| Conta Google Ads vinculada | Zênite Tech (conta principal) |
| Status da vinculação | ✅ Ativa |
| Dados fluindo | Sim — conversões GA4 visíveis no Google Ads |
| Conversão principal importada | `whatsapp_click` |
| Conversão secundária importada | `generate_lead` |

**Como verificar:** GA4 → Administrador → Vinculações de produtos → Google Ads.

---

## 3. Service Account (GA4 Data API)

A integração automática com a GA4 Data API utiliza uma Service Account configurada no Google Cloud.

| Item | Detalhe |
|---|---|
| Nome da Service Account | ga4-analytics-reader |
| Permissão no GA4 | Editor (elevada manualmente em 13/04/2026) |
| Secret no dashboard | `GA4_SERVICE_ACCOUNT_JSON` |
| Property ID no dashboard | `GA4_PROPERTY_ID` = 531461479 |
| Status | ✅ Operacional |

> **Atenção:** A elevação de permissão para Editor precisou ser feita manualmente no painel do GA4 (Admin → Gerenciamento de acesso → ga4-analytics-reader → Editor → Salvar), pois a automação via browser falhou por incompatibilidade com o Angular Material.

---

## 4. Conversões Configuradas

| Conversão | Origem | Tipo | Primária | Status |
|---|---|---|---|---|
| whatsapp_click | GA4 Custom Event | Importada | ✅ Sim | ✅ Ativa |
| generate_lead | GA4 | Importada | ✅ Sim | ✅ Ativa |
| Botão WhatsApp | Webpage | Direta | ✅ Sim | ✅ Ativa |
| Lead form - Submit | Webpage | Direta | ✅ Sim | ✅ Ativa |
| Zênite Tech (web) formulário | Webpage | Direta | ⚠️ Secundária | ✅ Ativa |

> **Recomendação pendente:** Ativar "Zênite Tech (web) formulário" como primária para fornecer mais sinais ao algoritmo de lances (Maximizar Conversões).

---

## 5. Endpoints GA4 no Dashboard

O router `ga4Real` em `server/routers/ga4Real.ts` expõe os seguintes endpoints:

| Endpoint | Parâmetros | Descrição |
|---|---|---|
| `getSummary` | `period`, `countryFilter` | Sessões, usuários, conversões, engajamento, Brasil vs outros |
| `getTrafficByChannel` | `period`, `countryFilter` | Canais de tráfego com sessões, conversões e CVR |
| `getWeeklyTrend` | `period`, `countryFilter` | Tendência semanal por canal |
| `getTopPages` | `period` | Top páginas por visualizações |
| `getAdPagesPerformance` | `period`, `countryFilter` | Landing pages com sessões pagas, orgânicas, conversões, rejeição |
| `getDeviceBreakdown` | `period`, `countryFilter` | Distribuição por dispositivo (Mobile/Desktop/Tablet) |

Todos os endpoints possuem **fallback com dados estimados** quando a GA4 API não está disponível. O campo `isReal: boolean` indica se os dados são reais ou estimados.

---

## 6. Páginas GA4 no Dashboard

| Rota | Componente | Filtros disponíveis |
|---|---|---|
| `/ga4-abril` | GA4AbrilReport.tsx | Período (7d / 30d / 90d) + País (Global / Brasil / Outros) |
| `/ga4-vs-ads` | GA4vsAds.tsx | Período fixo 30d + País |
| `/monitoramento-diario` | MonitoramentoDiario.tsx | Período fixo 7d |

---

## 7. Score de Saúde da Campanha

O Monitoramento Diário calcula um **Score de Saúde (0–100)** com base em indicadores ponderados:

| Indicador | Peso | Fonte |
|---|---|---|
| CPA ≤ R$65 | 20 | Google Ads API |
| Conversões registradas | 20 | Google Ads API |
| GA4 recebendo sessões | 15 | GA4 API |
| Tráfego pago chegando ao GA4 | 15 | GA4 API |
| SEO orgânico ativo | 10 | GA4 API |
| Sem alertas de anomalia | 10 | Banco de dados |
| CTR acima de 1% | 5 | Google Ads API |
| GA4 vinculado ao Google Ads | 5 | GA4 API |

Quando o score cai abaixo de 70, o sistema envia notificação automática ao owner via `notifyOwner` (a cada 6 horas, com botão de disparo manual disponível).

---

## 8. Histórico de Problemas e Soluções

### Falso positivo do TypeScript watcher

**Sintoma:** O watcher `tsc` reporta `TS2802: Type 'Set<any>' can only be iterated` em `server/routers/leadsSheet.ts` linhas 110–111.

**Causa:** Cache corrompido do TypeScript watcher. O arquivo já usa `.filter()` com `.indexOf()` (sem `Set`), e o `tsconfig.json` já tem `downlevelIteration: true` e `target: ES2020`.

**Solução:** O servidor `tsx` compila corretamente. O erro é falso positivo. Para resolver permanentemente: `rm -f node_modules/typescript/tsbuildinfo` e reiniciar o servidor.

### Permissão da Service Account GA4

**Sintoma:** Endpoints GA4 retornam `isReal: false` mesmo com credenciais configuradas.

**Causa:** Service Account com permissão `Visualizador` insuficiente para a GA4 Data API.

**Solução:** Elevar manualmente para `Editor` no painel do GA4: Admin → Gerenciamento de acesso → ga4-analytics-reader → Editor → Salvar.

---

## 9. Próximas Ações Recomendadas

1. **Ativar "Zênite Tech (web) formulário" como conversão primária** no Google Ads para ampliar os sinais de otimização.
2. **Monitorar o Score de Saúde** diariamente via `/monitoramento-diario` — alvo: manter acima de 80.
3. **Revisar o canal "Não Atribuído"** no GA4 — sessões sem atribuição indicam possível falha de rastreamento em algumas páginas.
4. **Configurar alertas de anomalia** para quedas abruptas de sessões (> 30% em 24h).

---

*Documento gerado automaticamente pelo dashboard trafego-google.zenitetech.com em 13/04/2026.*
