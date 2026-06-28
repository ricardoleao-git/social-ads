# Manual Completo — Dashboard de Tráfego Pago Zênite Tech

**Versão:** 2.0 — Abril 2026 (Rodada 20)  
**URL de produção:** https://trafego-google.zenitetech.com  
**Responsável:** Ricardo Leão — Zênite Tech  
**Última atualização:** 14 de abril de 2026

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Acesso e Autenticação](#2-acesso-e-autenticação)
3. [Mapa de Páginas](#3-mapa-de-páginas)
4. [Módulos Detalhados](#4-módulos-detalhados)
5. [Automações e Jobs](#5-automações-e-jobs)
6. [Integrações Externas](#6-integrações-externas)
7. [Banco de Dados](#7-banco-de-dados)
8. [Arquitetura Técnica](#8-arquitetura-técnica)
9. [Configuração de Conversões (GA4 + Google Ads)](#9-configuração-de-conversões-ga4--google-ads)
10. [Integração Bidirecional com Instagram Dashboard](#10-integração-bidirecional-com-instagram-dashboard)
11. [Erros Conhecidos e Soluções](#11-erros-conhecidos-e-soluções)
12. [Roadmap e Próximas Ações](#12-roadmap-e-próximas-ações)

---

## 1. Visão Geral

O **Dashboard Avant Charge** é a central de inteligência de tráfego pago da Zênite Tech. Construído em 20 rodadas incrementais entre março e abril de 2026, o sistema integra dados reais do Google Ads, Google Analytics 4 (GA4), Instagram e automações de IA para oferecer visibilidade completa das campanhas B2B da empresa.

O objetivo central é reduzir o CPL (Custo por Lead), aumentar conversões e automatizar decisões operacionais de mídia paga, liberando o time para foco estratégico.

### Indicadores de Performance Atuais (metas)

| KPI | Meta Atual | Meta 90 dias |
|---|---|---|
| CTR médio das campanhas | > 10% | > 14% |
| CPL (Custo por Lead) | < R$ 50 | < R$ 35 |
| Conversões/mês | > 20 | > 40 |
| Orçamento mensal | R$ 2.000 | R$ 3.000 |
| Taxa de anomalias detectadas | 100% | 100% |
| Tempo de resposta a anomalias | < 4h | < 30min (WhatsApp) |

---

## 2. Acesso e Autenticação

O dashboard utiliza autenticação própria com e-mail e senha. O sistema de autenticação inclui:

- Login com e-mail e senha (hash bcrypt)
- "Lembrar por 30 dias" via cookie JWT
- Recuperação de senha por e-mail (token com expiração de 1h)
- Controle de acesso por papel: `admin` e `user`
- Bloqueio automático após 5 tentativas falhas (15 minutos)

**Acesso admin:** Apenas usuários com `role = admin` acessam as rotas `/admin/*`. Para promover um usuário a admin, altere o campo `role` diretamente no banco via painel de banco de dados do Manus.

**Configuração de e-mails de alerta:** Acesse `/admin/email-alertas` para cadastrar os destinatários que receberão notificações automáticas de anomalias, discrepâncias e falhas de jobs.

---

## 3. Mapa de Páginas

### 3.1 Análise de Campanhas

| Página | Rota | Dados | Descrição |
|---|---|---|---|
| Dashboard Principal | `/` | Google Ads API | Métricas agregadas, heatmap de grupos, gráficos de tendência, insights de IA, cache stale-while-revalidate |
| Grupos de Anúncios | `/grupos-anuncios` | Google Ads API | Tabela com CTR, CPC, conversões, score de performance por grupo |
| Grupos Pausados | `/grupos-pausados` | Google Ads API | Grupos com status PAUSED, análise de reativação |
| Análise de Keywords | `/keywords` | Google Ads API | Palavras-chave com CTR, CPC, conversões, tipo de correspondência |
| Palavras Negativas | `/negativos` | Google Ads API | Gerenciamento de negativos com histórico e adição via API |
| RSA Optimizer | `/rsa` | Google Ads API | Anúncios responsivos com Ad Strength, headlines, URLs e histórico de verificações |
| Relatório de Ads | `/relatorio-ads` | Google Ads API | Relatório detalhado por campanha com exportação CSV |

### 3.2 Analytics e GA4

| Página | Rota | Dados | Descrição |
|---|---|---|---|
| GA4 Analytics | `/ga4-analytics` | GA4 Data API | Tráfego por canal, páginas, países, dispositivos, correlação pago vs orgânico |
| GA4 Abril 2026 | `/ga4-abril` | GA4 Data API | Relatório mensal com filtro de país (Global / Brasil / Outros) |
| GA4 vs Ads | `/ga4-vs-ads` | GA4 + Google Ads | Comparação entre dados do GA4 e Google Ads com análise de discrepâncias |
| Relatório GA4 × Ads | `/ga4-ads-report` | GA4 + Google Ads | Relatório cruzado completo: funil de conversão, discrepâncias, keywords, log de alertas |
| Conversões GA4 | `/ga4-conversoes` | GA4 Data API | Status das conversões configuradas (WhatsApp, formulário, generate_lead) |
| Monitoramento Diário | `/monitoramento-diario` | GA4 + Google Ads | Score de saúde da campanha (0–100) com indicadores ponderados |

### 3.3 Performance e Comparativos

| Página | Rota | Dados | Descrição |
|---|---|---|---|
| Relatório de Impacto | `/impact-report` | Banco local | Relatório de impacto das otimizações com comparativo entre períodos, anotações e exportação PDF |
| Painel Executivo | `/painel-executivo` | Google Ads + LLM | Visão executiva consolidada com narrativa gerada por IA |
| Comparativo Ads | `/comparativo-ads` | Google Ads + Meta Ads | Google Ads vs Meta Ads com radar, barras e exportação PDF |
| Account Health Score | `/account-health` | Google Ads | Termômetro de saúde da conta com radar de componentes e histórico semanal |
| PageSpeed | `/pagespeed` | PageSpeed API | Core Web Vitals para zenitetech.com e zenite.tech com histórico |
| Concorrência | `/concorrencia` | Google Ads | Análise de share of voice e posicionamento competitivo |

### 3.4 Automações e IA

| Página | Rota | Descrição |
|---|---|---|
| Central de Automações | `/automacoes` | Hub de todos os jobs com status, logs e painel de aprovação de pausas |
| Briefing de Voz | `/voice-briefing` | Resumo diário em áudio gerado por LLM às 7h45 |
| Previsão de Leads | `/lead-prediction` | Ranking de grupos por probabilidade de conversão (LLM) |
| Orçamento Dinâmico | `/orcamento-dinamico` | Realocação automática de verba entre grupos (modo simulação/real) |
| Alertas WhatsApp | `/alertas-whatsapp` | Configuração de alertas via WhatsApp (Evolution API) |
| Histórico de Alertas | `/historico-alertas` | Linha do tempo de todos os alertas com filtros |

### 3.5 Redes Sociais

| Página | Rota | Dados | Descrição |
|---|---|---|---|
| Instagram Analytics | `/instagram` | Instagram MCP | Métricas de posts, engajamento, alcance e crescimento de seguidores |
| Meta Ads | `/meta-ads` | Meta Ads (parcial) | Campanhas do Facebook/Instagram Ads (série temporal parcialmente simulada) |

### 3.6 Relatórios e Documentos

| Página | Rota | Descrição |
|---|---|---|
| Relatórios para Clientes | `/relatorios-clientes` | Geração automática de relatórios mensais por cliente |
| Documentos | `/documentos` | Central de downloads: plano estratégico, guia RSA, exportações |

### 3.7 Administração

| Página | Rota | Acesso | Descrição |
|---|---|---|---|
| Painel de Saúde do Sistema | `/admin/status` | Admin | Status de todos os jobs com gráfico de taxa de sucesso, filtro de falhas e alertas de falhas consecutivas |
| Configuração de E-mails | `/admin/email-alertas` | Admin | Cadastro de destinatários para alertas automáticos |
| Gerenciamento de Usuários | `/admin/users` | Admin | CRUD de usuários do dashboard |
| Negativação Automática | `/admin/negativos-auto` | Admin | Propostas de negativação com aprovação/rejeição |

---

## 4. Módulos Detalhados

### 4.1 Dashboard Principal (`/`)

O dashboard principal exibe as métricas consolidadas das campanhas Google Ads com dados reais via API. Funcionalidades:

- **Cache stale-while-revalidate:** carrega instantaneamente com dados do `localStorage` (TTL 30 min) e atualiza em background
- **Filtro de período:** 7d, 30d, 90d e intervalo customizado (data inicial + data final)
- **Filtro por campanha:** dropdown com campanhas ativas da conta
- **Heatmap de grupos:** visualização colorida por faixa de CTR (verde ≥ 12%, amarelo ≥ 8%, vermelho < 8%)
- **Insights de IA:** análise automática gerada por LLM com recomendações acionáveis
- **Exportação CSV:** inclui período, gasto total e taxa de conversão
- **Alerta de CPC:** notificação visual quando CPC ultrapassa R$ 5,00

### 4.2 Relatório GA4 × Ads (`/ga4-ads-report`)

Página de análise cruzada entre Google Ads e GA4, implementada nas Rodadas 18–20. Seções:

**KPIs lado a lado:**
- Google Ads: impressões, cliques, CTR, CPC, gasto, conversões
- GA4: sessões totais, sessões pagas, conversões, taxa de engajamento

**Discrepâncias automáticas:**
- Alerta visual quando diferença entre cliques Ads e sessões pagas GA4 ultrapassa 30%
- Alerta visual quando diferença entre conversões Ads e GA4 ultrapassa 20%
- Botão "Alertar" envia e-mail automático para destinatários cadastrados quando discrepância > 20%

**Funil de conversão (Recharts FunnelChart):**
- 5 etapas: Impressões → Cliques → Sessões Pagas → Leads → Conversões
- Tabela complementar com % de cada etapa em relação à etapa 1 (Impressões)
- Linha de referência em 80% no gráfico

**Gráfico comparativo:**
- Barras Google Ads × GA4 (canal pago)
- Pizza de canais GA4 (Pago, Orgânico, Direto, Social)

**Tabela de campanhas:**
- Gasto, CTR, CPC, CPL por campanha
- Exportação CSV individual

**Top páginas de destino:**
- Sessões, conversões, CVR, bounce rate

**Top palavras-chave:**
- Filtro por campanha (dropdown com campanhas ativas)
- Tipo de correspondência com badge colorido (Exata / Frase / Ampla)
- Impressões, Cliques, CTR, CPC, Gasto, Conversões
- Exportação CSV

**Log de alertas de discrepância:**
- Histórico de todos os alertas enviados (data, período, % de discrepância, destinatários)
- Persistido na tabela `discrepancy_alert_logs`
- Seção colapsável na página

### 4.3 RSA Optimizer (`/rsa`)

Gerenciamento de anúncios responsivos (RSA) com dados reais da API:

- Ad Strength por grupo (EXCELLENT, GOOD, AVERAGE, POOR)
- Headlines e descrições ativas com CTR individual
- Histórico de verificações de URL (detecta URLs quebradas)
- Alertas de Ad Strength baixo
- Sugestão de rotação de headlines via LLM (job semanal)

### 4.4 Palavras Negativas (`/negativos`)

- Visualização de todos os negativos por grupo e campanha
- Adição de novos negativos via API (endpoint `addNegativeKeyword`)
- Histórico de alterações com data, usuário e motivo
- Filtro por data e grupo
- Job horário `hourlyAutoNegative` que detecta e propõe novos negativos automaticamente

### 4.5 Painel de Saúde do Sistema (`/admin/status`)

Implementado na Rodada 17. Funcionalidades:

- **Gráfico de linha:** taxa de sucesso dos jobs nas últimas 24h (agrupado por hora)
- **Linha de referência:** 80% (meta mínima de sucesso)
- **Filtro de falhas:** botão toggle que exibe apenas jobs com erro no dia atual
- **Verificação de falhas consecutivas:** botão que detecta jobs com 2 falhas seguidas e envia alerta por e-mail
- **Tabela de jobs:** status, última execução, próxima execução, taxa de sucesso

### 4.6 Relatório de Impacto (`/impact-report`)

Documentação das otimizações realizadas com análise de impacto financeiro:

- Registro de sessões de otimização (negativos, URLs, extensões, grupo institucional, posts GBP)
- Estimativa de impacto financeiro (CPC, CTR, economia mensal)
- Painel comparativo entre dois relatórios
- Anotações no gráfico de tendência de CTR (marcar eventos como "mudança de bid")
- Exportação PDF do relatório
- Envio automático por e-mail (job domingo 18h)
- Botão de disparo manual

### 4.7 Monitoramento Diário (`/monitoramento-diario`)

Score de saúde da campanha (0–100) calculado com base em 8 indicadores ponderados:

| Indicador | Peso | Fonte |
|---|---|---|
| CPA ≤ R$ 65 | 20 | Google Ads API |
| Conversões registradas | 20 | Google Ads API |
| GA4 recebendo sessões | 15 | GA4 API |
| Tráfego pago chegando ao GA4 | 15 | GA4 API |
| SEO orgânico ativo | 10 | GA4 API |
| Sem alertas de anomalia | 10 | Banco de dados |
| CTR acima de 1% | 5 | Google Ads API |
| GA4 vinculado ao Google Ads | 5 | GA4 API |

Quando o score cai abaixo de 70, o sistema envia notificação automática ao owner a cada 6 horas.

---

## 5. Automações e Jobs

O sistema possui **23 jobs agendados** rodando no servidor. Todos os jobs são registrados no banco de dados com status, duração e resultado.

### 5.1 Jobs em Tempo Real / Horários

| Job | Arquivo | Frequência | API |
|---|---|---|---|
| Negativação Automática | `hourlyAutoNegative.ts` | A cada hora | Google Ads |
| Sincronização de Integração | `hourlyIntegrationSync.ts` | Horário (minuto 5) | REST interno |
| Alerta de Anomalia | `anomalyAlertCheck.ts` | A cada 4h | Google Ads |
| Alerta de Orçamento | `budgetAlertCheck.ts` | A cada 2h (8h–18h) | Google Ads |
| Orçamento Dinâmico | `dynamicBudget.ts` | A cada 2h comercial | Google Ads |
| PageSpeed Monitor | `pageSpeedMonitor.ts` | A cada 2h | PageSpeed API |

### 5.2 Jobs Diários

| Job | Arquivo | Horário | API |
|---|---|---|---|
| Briefing de Voz | `dailyVoiceBriefing.ts` | 7h45 | Google Ads + LLM |
| GBP Diagnosis | `dailyGBZeniteDiagnosis.ts` | 7h30 | Google Ads |
| Inteligência Competitiva | `dailyCompetitiveIntelligence.ts` | 6h | Google Ads |
| Sincronização Instagram | `dailyInstagramSync.ts` | 8h | Instagram MCP |
| Calendário Sazonal | `seasonalCalendarCheck.ts` | 8h | Banco local |
| Score por Grupo | `dailyAdGroupScore.ts` | 8h30 | Google Ads |
| Proposta de Pausa | `dailyAutoPauseCheck.ts` | 9h | Google Ads |
| Verificação Meta Ads | `dailyMetaAdsCheck.ts` | 9h30 | Meta Ads (parcial) |
| Sync Conversões WhatsApp | `whatsappConversionSyncJob.ts` | 9h | Google Ads |

### 5.3 Jobs Semanais

| Job | Arquivo | Horário | API |
|---|---|---|---|
| Relatório de Impacto | `weeklyReport.ts` | Domingo 18h | Google Ads |
| Busca de Termos Alerta | `weeklySearchTermsAlert.ts` | Segunda 8h | Google Ads |
| Relatório Executivo | `weeklyExecutiveReport.ts` | Segunda 8h | Google Ads + LLM |
| Health Score | `weeklyHealthScore.ts` | Segunda 7h30 | Google Ads |
| Previsão de Leads | `weeklyLeadPrediction.ts` | Sexta 16h | Google Ads + LLM |
| ROI por Produto | `weeklyProductROI.ts` | Sexta 17h | Google Ads + Gmail MCP |
| Rotação RSA | `weeklyRSARotation.ts` | Quarta 10h | Google Ads + LLM |

### 5.4 Jobs Mensais e Especiais

| Job | Arquivo | Horário | API |
|---|---|---|---|
| Relatórios para Clientes | `monthlyClientReports.ts` | Dia 1 às 9h | Google Ads |
| Verificação GA4 ↔ Google Ads | `ga4LinkCheckJob.ts` | 8h e 20h (diário) | GA4 Admin API |

### 5.5 Painel de Aprovação de Pausas

O job `dailyAutoPauseCheck` gera **propostas** de pausa para grupos com CTR < 2% nos últimos 7 dias. Nenhuma pausa é executada automaticamente. O fluxo é:

1. Job detecta grupo com CTR < 2% e gasto > R$ 50
2. Cria proposta em `auto_pause_proposals` com CTR médio, gasto e critérios
3. Envia notificação push ao owner via `notifyOwner()`
4. Ricardo acessa `/automacoes` → aba "Propostas de Pausa"
5. Aprova ou rejeita com nota obrigatória
6. Apenas após aprovação o grupo é pausado via API

---

## 6. Integrações Externas

### 6.1 Integrações Ativas (Dados Reais)

| Sistema | Secrets | Status |
|---|---|---|
| **Google Ads API** | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | ✅ Ativo |
| **Google Analytics 4** | `GA4_PROPERTY_ID` (531461479), `GA4_SERVICE_ACCOUNT_JSON` | ✅ Ativo |
| **PageSpeed Insights** | API pública Google (sem key) | ✅ Ativo |
| **Instagram via MCP** | Configurado via `manus-mcp-cli` (servidor `instagram`) | ✅ Ativo |
| **Gmail via MCP** | Configurado via `manus-mcp-cli` (servidor `gmail`) | ✅ Ativo |
| **Google Calendar via MCP** | Configurado via `manus-mcp-cli` (servidor `google-calendar`) | ✅ Ativo |
| **LLM (invokeLLM)** | `BUILT_IN_FORGE_API_KEY`, `BUILT_IN_FORGE_API_URL` | ✅ Ativo |
| **S3 Storage** | Injetado automaticamente pela plataforma Manus | ✅ Ativo |
| **Notificações (notifyOwner)** | `BUILT_IN_FORGE_API_KEY` | ✅ Ativo |
| **Banco de Dados (MySQL/TiDB)** | `DATABASE_URL` | ✅ Ativo |

### 6.2 Integrações Pendentes

| Sistema | Situação | O que falta |
|---|---|---|
| **Meta Ads (Facebook Ads)** | Dados parcialmente simulados na série temporal | Configurar `META_ADS_TOKEN` e `META_ADS_ACCOUNT_ID` |
| **Search Console** | Router existe, sem credenciais reais | Configurar `SEARCH_CONSOLE_SITE_URL` |
| **WhatsApp (Evolution API)** | Router existe, aguardando credenciais | Configurar `EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_INSTANCE_NAME` |

---

## 7. Banco de Dados

O sistema utiliza MySQL/TiDB (cloud). As tabelas são gerenciadas via Drizzle ORM com migrations automáticas.

### 7.1 Tabelas Principais

| Tabela | Finalidade |
|---|---|
| `users` | Usuários do dashboard (auth própria) |
| `dashboard_sessions` | Sessões ativas dos usuários |
| `password_reset_tokens` | Tokens de recuperação de senha |
| `user_preferences` | Filtros, período e estado de UI por usuário |
| `alert_history` | Histórico centralizado de todos os alertas |
| `auto_pause_proposals` | Propostas de pausa automática de grupos |
| `ad_group_scores` | Score 0–100 por grupo de anúncios (histórico diário) |
| `account_health_scores` | Índice composto semanal de saúde da conta |
| `pagespeed_history` | Histórico de medições PageSpeed |
| `impact_reports` | Sessões de otimização com dados de impacto |
| `chart_annotations` | Anotações no gráfico de tendência de CTR |
| `negative_keyword_history` | Histórico de negativos adicionados |
| `keyword_reasons` | Motivos de negativação por keyword |
| `instagram_snapshots` | Snapshots horários de métricas do Instagram |
| `integration_sync_log` | Log de sincronizações com sistemas externos |
| `alert_email_config` | Destinatários de alertas por e-mail |
| `system_job_logs` | Logs de execução de todos os jobs |
| `ab_experiments` | Experimentos A/B de headlines RSA |
| `discrepancy_alert_logs` | Histórico de alertas de discrepância GA4 × Ads |
| `negative_proposals` | Propostas de negativação automática |

---

## 8. Arquitetura Técnica

### 8.1 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Tailwind 4 + shadcn/ui + Recharts |
| Backend | Express 4 + tRPC 11 + Drizzle ORM |
| Banco de dados | MySQL/TiDB (cloud) |
| Autenticação | JWT + cookies HttpOnly (auth própria) |
| IA | Manus LLM API (`invokeLLM`) |
| Notificações | `notifyOwner` (Manus built-in) |
| Agendamento | node-cron (23 jobs ativos) |
| Storage | S3 (Manus built-in) |

### 8.2 Routers tRPC (28 total)

`abExperiments`, `aiChat`, `alertEmailConfig`, `alertHistory`, `autoPause`, `automations`, `clientReport`, `dashboardAuth`, `dynamicBudget`, `ga4`, `ga4Real`, `gbZenite`, `googleAds`, `healthScore`, `impactReports`, `indexing`, `insights`, `insightsHistory`, `instagram`, `leadPrediction`, `metaAds`, `pageSpeed`, `searchConsole`, `systemHealth`, `userPreferences`, `voiceBriefing`, `whatsappAlerts`, `system`, `auth`

### 8.3 Estrutura de Arquivos Relevantes

```
server/
  routers/
    googleAds.ts       ← Campanhas, grupos, keywords, trends, summary
    ga4Real.ts         ← GA4 Data API (sessões, canais, páginas, discrepâncias)
    systemHealth.ts    ← Jobs, logs, taxa de sucesso, falhas consecutivas
    alertEmailConfig.ts ← Configuração de e-mails de alerta
  jobs/
    hourlyAutoNegative.ts
    anomalyAlertCheck.ts
    ga4LinkCheckJob.ts
    [+ 20 outros jobs]
  db.ts                ← Query helpers Drizzle
drizzle/
  schema.ts            ← Definição de todas as tabelas
client/src/pages/
  GA4AdsReport.tsx     ← Relatório cruzado GA4 × Ads (Rodadas 18–20)
  admin/
    AdminSystemStatus.tsx ← Painel de saúde do sistema (Rodada 17)
```

---

## 9. Configuração de Conversões (GA4 + Google Ads)

### 9.1 Property GA4

| Campo | Valor |
|---|---|
| Property ID | G-XN8107LBV6 |
| Property Numérico | 531461479 |
| Domínio | zenitetech.com |
| Status | ✅ Ativo |

### 9.2 Vinculação GA4 ↔ Google Ads

A vinculação foi ativada em **07/04/2026** e está operacional.

| Item | Detalhe |
|---|---|
| Conta Google Ads vinculada | Zênite Tech (300-329-1643) |
| Status | ✅ Ativa (confirmada em 14/04/2026) |
| Conversão principal importada | `whatsapp_click` |
| Conversão secundária importada | `generate_lead` |

### 9.3 Conversões Configuradas no Google Ads

| Conversão | Origem | Tipo | Primária | Status |
|---|---|---|---|---|
| whatsapp_click | GA4 Custom Event | Importada | ✅ Sim | ✅ Ativa |
| generate_lead | GA4 | Importada | ✅ Sim | ✅ Ativa |
| Botão WhatsApp | Webpage | Direta | ✅ Sim | ✅ Ativa |
| Lead form - Submit | Webpage | Direta | ✅ Sim | ✅ Ativa |
| Zênite Tech (web) formulário | Webpage | Direta | ⚠️ Secundária | ✅ Ativa |

> **Decisão:** A conversão "Zênite Tech (web) formulário" permanece como **secundária**. O WhatsApp é a conversão primária que alimenta o algoritmo de lances (Maximizar Conversões). Esta decisão foi confirmada por Ricardo em 14/04/2026.

### 9.4 Service Account GA4

| Item | Detalhe |
|---|---|
| Nome | ga4-analytics-reader |
| Permissão no GA4 | Editor (elevada manualmente em 13/04/2026) |
| Secret no dashboard | `GA4_SERVICE_ACCOUNT_JSON` |
| Status | ✅ Operacional |

> **Atenção:** A elevação de permissão para Editor precisou ser feita manualmente no painel do GA4 (Admin → Gerenciamento de acesso → ga4-analytics-reader → Editor → Salvar), pois a automação via browser falhou por incompatibilidade com o Angular Material.

---

## 10. Integração Bidirecional com Instagram Dashboard

O dashboard de tráfego pago (`trafego-google.zenitetech.com`) se comunica com o dashboard de redes sociais (`redes-sociais.zenitetech.com`) a cada hora via REST API autenticada.

### 10.1 Autenticação

Todas as chamadas usam o header:
```
X-Integration-Key: <valor_do_INTEGRATION_API_KEY>
```

A mesma chave deve estar configurada em ambos os sistemas como variável de ambiente `INTEGRATION_API_KEY`.

### 10.2 Fluxo Horário

```
:00 — Google Ads Dashboard executa hourlyAutoNegative
:05 — Google Ads Dashboard executa hourlyIntegrationSync:
        → Busca métricas do Google Ads (últimos 7 dias)
        → POST https://redes-sociais.zenitetech.com/api/integration/gads/receive
        → Registra resultado em integration_sync_log

:XX — Instagram Dashboard executa seu job horário:
        → Busca métricas do Instagram via MCP
        → POST https://trafego-google.zenitetech.com/api/integration/instagram/sync
        → Registra resultado em seu próprio log
```

### 10.3 Endpoints Disponíveis

Para a documentação completa dos endpoints REST de integração, consulte o arquivo `INTEGRACAO_API.md` no repositório do projeto.

---

## 11. Erros Conhecidos e Soluções

### 11.1 Falso Positivo do TypeScript Watcher

**Sintoma:** O watcher `tsc` reporta erros de tipo em arquivos que já foram corrigidos.

**Causa:** Cache corrompido do TypeScript watcher. O servidor `tsx` (que é o que roda em produção) compila corretamente.

**Solução:** O erro é falso positivo e não afeta o funcionamento. Para resolver permanentemente: `rm -f node_modules/typescript/tsbuildinfo` e reiniciar o servidor.

### 11.2 Permissão da Service Account GA4

**Sintoma:** Endpoints GA4 retornam `isReal: false` mesmo com credenciais configuradas.

**Causa:** Service Account com permissão `Visualizador` insuficiente para a GA4 Data API.

**Solução:** Elevar manualmente para `Editor` no painel do GA4: Admin → Gerenciamento de acesso → ga4-analytics-reader → Editor → Salvar.

### 11.3 Import de Toast Incorreto

**Sintoma:** Erro de build `Cannot find module '@/hooks/use-toast'`.

**Causa:** O projeto usa `sonner` para toasts, não o hook `use-toast` do shadcn.

**Solução:** Substituir `import { useToast } from "@/hooks/use-toast"` por `import { toast } from "sonner"` e ajustar as chamadas de `toast.success()` / `toast.error()`.

### 11.4 Sandbox Hibernado Após Inatividade

**Sintoma:** O servidor para de responder após período de inatividade.

**Causa:** O sandbox Manus hiberna automaticamente após inatividade.

**Solução:** O sandbox retoma automaticamente ao receber uma requisição. Se o servidor não reiniciar, use `webdev_restart_server` para forçar o reinício.

### 11.5 Erro de Migração do Banco (pnpm db:push)

**Sintoma:** `pnpm db:push` falha com erro de migração.

**Causa:** Conflito entre migração pendente e estado atual do banco.

**Solução:** Aplicar o SQL diretamente no banco via `node -e "require('./server/db.ts')"` com o comando SQL explícito, ou usar o painel de banco de dados do Manus para executar o DDL manualmente.

---

## 12. Roadmap e Próximas Ações

### 12.1 Ações Imediatas (Alta Prioridade)

| Ação | Onde | Impacto |
|---|---|---|
| **Publicar dashboard** | Botão Publish na UI do Manus | Atualiza trafego-google.zenitetech.com com Rodadas 17–20 |
| **Configurar Evolution API** | Secrets do projeto | Alertas de anomalia chegam em tempo real no WhatsApp |
| **Ativar Orçamento Dinâmico em modo real** | `/orcamento-dinamico` → desativar simulationMode | Realocação automática de verba entre grupos |

### 12.2 Melhorias de Médio Prazo

| Melhoria | Esforço Estimado |
|---|---|
| Conectar Meta Ads à Graph API real (remover dados simulados) | 2h |
| Exportar log de alertas de discrepância em CSV | 30min |
| Benchmark de CTR por segmento (B2B tecnologia) na tabela de keywords | 1h |
| Alerta automático de queda de conversões (> 30% vs média 7d) | 1h |
| Vincular Search Console e ativar router | 1h |
| Cadastrar primeiros 3 clientes em `/relatorios-clientes` | 30min |

### 12.3 Expansão (Meses 2–3)

1. **Dashboard de Concorrência Avançado** — integrar SimilarWeb API para dados de tráfego dos concorrentes
2. **Módulo de Proposta Comercial Automática** — gerar PDF de proposta baseado nos dados de performance
3. **Score de Qualidade de Landing Page** — análise automática de Core Web Vitals + taxa de conversão
4. **Integração com Google Search Console** — dados de posicionamento orgânico vs pago por keyword

### 12.4 Escala (Meses 4–6)

1. **Multi-cliente** — suporte a múltiplas contas Google Ads com dashboard separado por cliente
2. **API pública para parceiros** — endpoints REST para integração com ferramentas externas
3. **Fine-tuning do modelo de previsão** — melhoria contínua da acurácia com dados históricos reais

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| API Google Ads fora do ar | Baixa | Alto | Fallback com dados demo em todas as páginas |
| Orçamento Dinâmico realocação incorreta | Média | Alto | Modo simulação por 2 semanas antes de ativar |
| WhatsApp bloqueado por spam | Baixa | Médio | Rate limit + quiet hours configurados |
| Custo de LLM elevado | Média | Médio | Briefings e previsões com cache de 24h |
| Token Google Ads expirado | Alta | Alto | Monitorar logs + renovação manual do refresh token |
| Vinculação GA4 ↔ Google Ads cair | Baixa | Alto | Job `ga4LinkCheckJob` verifica 2x/dia e alerta por e-mail |

---

*Manual gerado em 14 de abril de 2026 — Zênite Tech / Dashboard Avant Charge*  
*Versão do checkpoint: `a8a9fbd3` (Rodada 20)*
