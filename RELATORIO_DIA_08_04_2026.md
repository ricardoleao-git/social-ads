# Relatório de Melhorias — Dashboard Avant Charge / Zênite Tech
**Data:** 08 de abril de 2026 | **Versão do checkpoint:** `8ee045af`

---

## Resumo Executivo

Durante o dia 08/04/2026, foram implementadas **25 melhorias** no dashboard de tráfego pago da Zênite Tech, incluindo 8 novos jobs de automação, 3 novos routers tRPC, 3 novas páginas de UI, 5 novas tabelas no banco de dados e uma auditoria completa das integrações. O sistema passou de 14 para **22 jobs agendados** e de 21 para **27 routers tRPC**. O build de produção está passando sem erros.

---

## 1. Implementações Concluídas

### 1.1 Persistência de Dados no Banco (Fase 1 — Manhã)

**Tabelas criadas no banco de dados:**

| Tabela | Finalidade |
|---|---|
| `user_preferences` | Salvar filtros, período, favoritos e estado de UI por usuário |
| `alert_history` | Histórico centralizado de todos os alertas do sistema |
| `auto_pause_proposals` | Propostas de pausa automática de grupos com CTR < 2% |
| `ad_group_scores` | Score de qualidade 0–100 por grupo de anúncios |
| `account_health_scores` | Índice composto semanal de saúde da conta |
| `pagespeed_history` | Histórico de medições PageSpeed mobile e desktop |

**Routers tRPC criados:**

- `userPreferences` — get, upsert, reset
- `alertHistory` — list, create, acknowledge, acknowledgeAll, stats
- `autoPause` — list, approve, reject, pendingCount
- `healthScore` — getLatest, getHistory, getByWeek
- `adGroupScores` — list, history (via job diário)

---

### 1.2 Sistema de Cache Stale-While-Revalidate na Home (B1)

A página principal (`/`) agora carrega instantaneamente com dados do `localStorage` (TTL de 30 minutos) e atualiza em background ao entrar. Um indicador visual "Atualizando..." aparece no header enquanto os dados frescos são buscados da API. As preferências do usuário (período, filtros, favoritos) são carregadas do banco via `trpc.userPreferences.get` e salvas automaticamente a cada mudança.

---

### 1.3 Painel de Aprovação de Pausas Automáticas (B2)

O `AutomationsHub` ganhou uma nova aba **"Propostas de Pausa"** que lista todas as propostas geradas pelo job diário. Cada proposta exibe o grupo afetado, o CTR médio dos últimos 7 dias, o gasto acumulado e os critérios que acionaram a proposta. Os botões **Aprovar** e **Rejeitar** permitem revisão com campo de nota obrigatório. Nenhuma pausa é executada sem aprovação manual.

---

### 1.4 Notificação Push de Proposta de Pausa (B5)

O job `dailyAutoPauseCheck` agora chama `notifyOwner()` sempre que cria uma nova proposta, enviando uma notificação push para o painel do Manus com o nome do grupo, o CTR médio e o gasto acumulado.

---

### 1.5 Novos Jobs de Automação (A2, A3, A4, A5, C1, C2, C3, C4, C5, PageSpeed)

| Job | Frequência | Finalidade |
|---|---|---|
| `budgetAlertCheck.ts` | A cada 2h (8h–18h) | Alerta quando >80% do orçamento diário é consumido antes das 16h |
| `dailyAdGroupScore.ts` | Diário às 8h30 | Calcula score 0–100 por grupo (CTR, CPC, conversão, impressões) |
| `weeklyProductROI.ts` | Sexta às 17h | ROI por produto (Wallbox, GuardIA, ZIPY, etc.) + e-mail comparativo via Gmail MCP |
| `pageSpeedMonitor.ts` | A cada 2h | PageSpeed mobile + desktop para zenitetech.com e zenite.tech; alerta se score < 50 |
| `weeklyHealthScore.ts` | Segunda às 7h30 | Account Health Score composto 0–100 (RSA, negativos, CTR, conversão, orçamento, anomalias) |
| `dailyMetaAdsCheck.ts` | Diário às 9h30 | Anomalias Meta Ads: frequência > 3, CPM acima do histórico, queda de alcance |
| `seasonalCalendarCheck.ts` | Diário às 8h | Alerta 7 dias antes de datas sazonais relevantes (Dia do Condomínio, Semana da Segurança, etc.) |
| `weeklyRSARotation.ts` | Quarta às 10h | Identifica headlines RSA com CTR < média e sugere rotação via LLM; registra em `ab_experiments` |
| `hourlyIntegrationSync.ts` | Horário (minuto 5) | Sincronização com sistemas externos (Instagram Dashboard) |

**Total de jobs agendados:** 22 (eram 14 antes do dia 08/04)

---

### 1.6 Novas Páginas de UI

| Página | Rota | Descrição |
|---|---|---|
| Histórico de Alertas | `/historico-alertas` | Linha do tempo de todos os alertas com filtros por severidade, tipo e status de leitura |
| Comparativo Executivo | `/comparativo-ads` | Google Ads vs Meta Ads com radar, barras, tabela lado a lado, alertas recentes e exportação PDF |
| Account Health Score | `/account-health` | Termômetro de saúde da conta com radar de componentes, histórico semanal e recomendações automáticas |

---

### 1.7 Correção Crítica de Build

O arquivo `AlertHistory.tsx` foi criado com `import { useToast } from "@/hooks/use-toast"`, que não existe neste projeto. O import foi corrigido para `import { toast } from "sonner"`, padrão do projeto. O build de produção passou sem erros após a correção.

---

## 2. Auditoria de Integrações

### 2.1 Integrações com API Real (Conectadas)

| Sistema | Secrets Configurados | Status |
|---|---|---|
| **Google Ads API** | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ✅ Conectado |
| **Google Analytics 4** | `GA4_PROPERTY_ID`, `GA4_SERVICE_ACCOUNT_JSON` | ✅ Conectado |
| **PageSpeed Insights** | Usa API pública do Google (sem key obrigatória para uso básico) | ✅ Conectado |
| **Instagram via MCP** | Configurado via `manus-mcp-cli` (servidor `instagram`) | ✅ Conectado |
| **Gmail via MCP** | Configurado via `manus-mcp-cli` (servidor `gmail`) | ✅ Conectado |
| **Google Calendar via MCP** | Configurado via `manus-mcp-cli` (servidor `google-calendar`) | ✅ Conectado |
| **LLM (invokeLLM)** | `BUILT_IN_FORGE_API_KEY`, `BUILT_IN_FORGE_API_URL` | ✅ Conectado |
| **S3 Storage** | Injetado automaticamente pela plataforma Manus | ✅ Conectado |
| **Notificações (notifyOwner)** | `BUILT_IN_FORGE_API_KEY` | ✅ Conectado |
| **Banco de Dados (MySQL/TiDB)** | `DATABASE_URL` | ✅ Conectado |

### 2.2 Integrações com Dados Simulados (Parcialmente Conectadas)

| Sistema | Situação | O que falta |
|---|---|---|
| **Meta Ads (Facebook Ads)** | Router `metaAds.ts` usa dados reais para métricas principais, mas a série temporal de alcance usa `Math.random()` para variação | Conectar à Graph API do Facebook com `META_ADS_TOKEN` e `META_ADS_ACCOUNT_ID` |
| **Search Console** | Router `searchConsole.ts` existe mas não usa credenciais reais | Vincular conta do Search Console e configurar `SEARCH_CONSOLE_SITE_URL` |
| **WhatsApp (Evolution API)** | Router `whatsappAlerts.ts` existe mas aguarda credenciais | Configurar `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME` |

### 2.3 O que Falta para Concluir Cada Integração

**Meta Ads (prioridade alta):**
1. Criar conta de desenvolvedor no Meta for Developers
2. Gerar `META_ADS_TOKEN` (token de acesso de longa duração) e `META_ADS_ACCOUNT_ID`
3. Adicionar os secrets via painel do Manus
4. Substituir o `Math.random()` na série temporal por chamadas reais à Graph API (`/act_{account_id}/insights`)

**Search Console (prioridade média):**
1. Acessar Google Search Console e vincular a propriedade `zenitetech.com`
2. Adicionar `SEARCH_CONSOLE_SITE_URL=https://zenitetech.com` como secret
3. A service account do GA4 já tem acesso — verificar se também tem permissão no Search Console

**WhatsApp Evolution API (prioridade baixa — aguardando cliente):**
1. Fornecer `EVOLUTION_API_URL` (URL da instância Evolution)
2. Fornecer `EVOLUTION_API_KEY` (chave de autenticação)
3. Fornecer `EVOLUTION_INSTANCE_NAME` (nome da instância WhatsApp)

---

## 3. Estado Atual do Sistema

### 3.1 Jobs Agendados (22 total)

| Job | Horário | API Real? |
|---|---|---|
| `hourlyAutoNegative` | A cada hora | ✅ Google Ads |
| `hourlyIntegrationSync` | Horário (minuto 5) | ✅ REST interno |
| `anomalyAlertCheck` | A cada 4h | ✅ Google Ads |
| `budgetAlertCheck` | A cada 2h (8h–18h) | ✅ Google Ads |
| `dynamicBudget` | A cada 2h comercial | ✅ Google Ads |
| `pageSpeedMonitor` | A cada 2h | ✅ PageSpeed API |
| `dailyCompetitiveIntelligence` | Diário 6h | ✅ Google Ads |
| `dailyGBZeniteDiagnosis` | Diário 7h30 | ✅ Google Ads |
| `dailyInstagramSync` | Diário 8h | ✅ Instagram MCP |
| `seasonalCalendarCheck` | Diário 8h | ✅ Banco local |
| `dailyAdGroupScore` | Diário 8h30 | ✅ Google Ads |
| `dailyAutoPauseCheck` | Diário 9h | ✅ Google Ads |
| `dailyMetaAdsCheck` | Diário 9h30 | ⚠️ Meta Ads (parcial) |
| `dailyVoiceBriefing` | Diário 7h45 | ✅ Google Ads + LLM |
| `weeklyReport` | Domingo 18h | ✅ Google Ads |
| `weeklySearchTermsAlert` | Segunda 8h | ✅ Google Ads |
| `weeklyExecutiveReport` | Segunda 8h | ✅ Google Ads + LLM |
| `weeklyHealthScore` | Segunda 7h30 | ✅ Google Ads |
| `weeklyLeadPrediction` | Sexta 16h | ✅ Google Ads + LLM |
| `weeklyProductROI` | Sexta 17h | ✅ Google Ads + Gmail MCP |
| `weeklyRSARotation` | Quarta 10h | ✅ Google Ads + LLM |
| `monthlyClientReports` | Dia 1 às 9h | ✅ Google Ads |

### 3.2 Routers tRPC (27 total)

`abExperiments`, `aiChat`, `alertHistory`, `autoPause`, `automations`, `clientReport`, `dashboardAuth`, `dynamicBudget`, `ga4`, `ga4Real`, `gbZenite`, `googleAds`, `healthScore`, `impactReports`, `indexing`, `insights`, `insightsHistory`, `instagram`, `leadPrediction`, `metaAds`, `pageSpeed`, `searchConsole`, `userPreferences`, `voiceBriefing`, `whatsappAlerts`, `system`, `auth`

### 3.3 Páginas do Dashboard (sidebar)

| Página | Rota | Status |
|---|---|---|
| Dashboard Principal | `/` | ✅ Dados reais Google Ads |
| Grupos de Anúncios | `/grupos-anuncios` | ✅ Dados reais |
| Grupos Pausados | `/grupos-pausados` | ✅ Dados reais |
| Automações | `/automacoes` | ✅ Com painel de aprovação de pausas |
| Histórico de Alertas | `/historico-alertas` | ✅ Novo |
| Comparativo Ads | `/comparativo-ads` | ✅ Novo |
| Account Health Score | `/account-health` | ✅ Novo |
| PageSpeed | `/pagespeed` | ✅ Com histórico |
| Meta Ads | `/meta-ads` | ⚠️ Parcialmente simulado |
| Relatório de Impacto | `/impact-report` | ✅ Dados reais |
| Painel Executivo | `/painel-executivo` | ✅ Dados reais |
| Briefing de Voz | `/voice-briefing` | ✅ LLM real |
| Previsão de Leads | `/lead-prediction` | ✅ LLM real |

---

## 4. Itens Pendentes (Próximas Ações)

| Prioridade | Item | Esforço |
|---|---|---|
| 🔴 Alta | Conectar Meta Ads à Graph API real (remover Math.random()) | 2h |
| 🔴 Alta | Configurar secrets WhatsApp Evolution API (aguardando cliente) | 30min após receber dados |
| 🟡 Média | Adicionar termômetro de saúde na Home (widget compacto) | 1h |
| 🟡 Média | Exibir top 5 grupos por score na Home | 1h |
| 🟡 Média | Vincular Search Console e ativar router | 1h |
| 🟢 Baixa | Adicionar gráfico de evolução PageSpeed na página /pagespeed | 1h |
| 🟢 Baixa | Criar página dedicada de ROI por produto | 2h |

---

## 5. Checkpoint e Deploy

**Versão atual:** `8ee045af`
**Build:** ✅ Passando sem erros
**Deploy:** Clique em **Publish** na interface para publicar esta versão em produção.

---

*Relatório gerado automaticamente em 08/04/2026 às 02h10 (America/Sao_Paulo)*
