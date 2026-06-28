# Plano Estratégico — Dashboard Avant-Charge (Zênite Tech)
**Versão:** 1.0 — Abril 2026  
**Responsável:** Ricardo Leão — Zênite Tech  
**URL de produção:** https://trafego-google.zenitetech.com

---

## Resumo Executivo

O Dashboard Avant-Charge é a central de inteligência de tráfego pago da Zênite Tech, integrando dados reais do Google Ads, Instagram, GA4 e automações de IA. O sistema foi construído em fases incrementais, com foco em autonomia operacional, redução de CPL e aumento de conversões B2B.

---

## Módulos Implementados (Estado Atual)

### Fase 1 — Core Dashboard (Concluída)
| Módulo | Rota | Status |
|---|---|---|
| Dashboard principal | `/` | ✅ Ativo |
| Relatório de Ads | `/relatorio-ads` | ✅ Ativo |
| Grupos de Anúncios | `/grupos-anuncios` | ✅ Ativo |
| Palavras-chave | `/keywords` | ✅ Ativo |
| Negativos | `/negativos` | ✅ Ativo |
| RSA (Anúncios Responsivos) | `/rsa` | ✅ Ativo |

### Fase 2 — Integrações e Analytics (Concluída)
| Módulo | Rota | Status |
|---|---|---|
| Instagram Analytics | `/instagram` | ✅ Ativo |
| GA4 Conversões | `/ga4-conversoes` | ✅ Ativo |
| PageSpeed | `/pagespeed` | ✅ Ativo |
| Relatório Executivo | `/relatorio-executivo` | ✅ Ativo |
| Concorrência | `/concorrencia` | ✅ Ativo |

### Fase 3 — Automações (Concluída)
| Módulo | Rota | Job | Frequência |
|---|---|---|---|
| Alerta de Anomalia | `/automacoes` | anomalyAlertCheck.ts | A cada 4h |
| Sincronização Instagram | `/automacoes` | dailyInstagramSync.ts | Diário 8h |
| Score RSA Semanal | `/automacoes` | weeklyRsaScore.ts | Segunda 8h |
| Relatório Integrado | `/automacoes` | weeklyReport.ts | Segunda 8h |
| Otimização de Lances | `/automacoes` | bidOptimizer.ts | Sob demanda |
| Calendário Editorial | `/automacoes` | editorialCalendar.ts | Sob demanda |
| Orçamento Dinâmico | `/orcamento-dinamico` | dynamicBudget.ts | 6×/dia |

### Fase 4 — IA e Automações Avançadas (Concluída)
| Módulo | Rota | Job | Frequência |
|---|---|---|---|
| Briefing de Voz | `/briefings` | dailyVoiceBriefing.ts | Diário 7h45 |
| Previsão de Leads | `/previsao-leads` | weeklyLeadPrediction.ts | Sexta 16h |
| Relatórios para Clientes | `/relatorios-clientes` | monthlyClientReports.ts | Dia 1 às 9h |
| Alertas WhatsApp | `/alertas-whatsapp` | — | Sob demanda |

---

## Arquitetura Técnica

### Stack
- **Frontend:** React 19 + Tailwind 4 + shadcn/ui + Recharts
- **Backend:** Express 4 + tRPC 11 + Drizzle ORM
- **Banco de dados:** MySQL/TiDB (cloud)
- **Autenticação:** Manus OAuth (JWT + cookies)
- **IA:** Manus LLM API (invokeLLM)
- **Notificações:** notifyOwner (Manus built-in)
- **Agendamento:** node-cron (11 jobs ativos)

### Jobs Ativos no Servidor
```
[AnomalyAlert]         → a cada 4h
[DailyInstagramSync]   → diário 8h
[ExecutiveReport]      → segunda 8h
[DynamicBudget]        → 6h, 8h, 10h, 12h, 14h, 16h
[WeeklyLeadPrediction] → sexta 16h
[MonthlyClientReports] → dia 1 às 9h
[DailyVoiceBriefing]   → diário 7h45
```

### Integrações Externas
| Serviço | Uso | Status |
|---|---|---|
| Google Ads API | Dados de campanhas, grupos, keywords | ✅ Ativo |
| Instagram MCP | Métricas de posts e perfil | ✅ Ativo |
| GA4 Data API | Conversões e funil | ✅ Ativo |
| Gmail MCP | Envio de relatórios | ✅ Configurado |
| Evolution API | WhatsApp alertas | ⚙️ Configurar URL |
| Twilio | WhatsApp fallback | ⚙️ Configurar credenciais |

---

## Plano de Implementação por Fases

### Fase 5 — Otimizações de Performance (Próximas 4 semanas)

**Prioridade Alta:**
1. **Configurar Evolution API ou Twilio** para alertas WhatsApp reais
   - Ação: Inserir `EVOLUTION_API_KEY`, `EVOLUTION_API_URL` e `EVOLUTION_INSTANCE_NAME` nos secrets
   - Impacto: Alertas de anomalia chegam em tempo real no WhatsApp do Ricardo

2. **Ativar modo real no Orçamento Dinâmico**
   - Ação: Após validar 2 semanas de simulação, desativar `simulationMode` no painel `/orcamento-dinamico`
   - Impacto: Realocação automática de verba entre grupos de baixo e alto CTR

3. **Vincular Google Ads ao GA4**
   - Ação: GA4 → Administrador → Vinculações → Google Ads
   - Impacto: Dados de atribuição reais para CPL e conversões

**Prioridade Média:**
4. **Cadastrar primeiros clientes** em `/relatorios-clientes`
   - Ação: Adicionar 3-5 clientes com dados de campanha
   - Impacto: Relatórios mensais automáticos gerados e enviados por e-mail

5. **Testar Briefing de Voz**
   - Ação: Configurar URL VoxForge em `/briefings` → Configurações
   - Impacto: Resumo de 2 minutos ouvido às 7h45 antes de iniciar o dia

6. **Validar Previsão de Leads**
   - Ação: Aguardar primeira execução (próxima sexta às 16h)
   - Impacto: Ranking de grupos por probabilidade de conversão

### Fase 6 — Expansão (Meses 2-3)

1. **Dashboard de Concorrência Avançado**
   - Integrar SimilarWeb API para dados de tráfego dos concorrentes
   - Alertas automáticos quando concorrente aumentar investimento

2. **Módulo de Proposta Comercial Automática**
   - Gerar PDF de proposta baseado nos dados de performance do cliente
   - Integração com CRM (Pipedrive ou HubSpot)

3. **Score de Qualidade de Landing Page**
   - Análise automática de Core Web Vitals + taxa de conversão
   - Sugestões de melhoria via LLM

4. **Integração com Google Search Console**
   - Dados de posicionamento orgânico
   - Comparação pago vs. orgânico por keyword

### Fase 7 — Escala (Meses 4-6)

1. **Multi-cliente**
   - Suporte a múltiplas contas Google Ads
   - Dashboard separado por cliente com login próprio

2. **API pública para parceiros**
   - Endpoints REST para integração com ferramentas externas
   - Webhook para notificações em tempo real

3. **Módulo de Treinamento de IA**
   - Fine-tuning do modelo de previsão de leads com dados históricos reais
   - Melhoria contínua da acurácia ao longo do tempo

---

## Métricas de Sucesso

| KPI | Meta Atual | Meta 90 dias |
|---|---|---|
| CTR médio das campanhas | > 10% | > 14% |
| CPL (Custo por Lead) | < R$ 50 | < R$ 35 |
| Conversões/mês | > 20 | > 40 |
| Orçamento mensal | R$ 2.000 | R$ 3.000 |
| Taxa de anomalias detectadas | 100% | 100% |
| Tempo de resposta a anomalias | < 4h | < 30min (WhatsApp) |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| API Google Ads fora do ar | Baixa | Alto | Fallback com dados demo |
| Orçamento Dinâmico realocação incorreta | Média | Alto | Modo simulação por 2 semanas |
| WhatsApp bloqueado por spam | Baixa | Médio | Rate limit + quiet hours configurados |
| Custo de LLM elevado | Média | Médio | Briefings e previsões com cache de 24h |
| Token Google Ads expirado | Alta | Alto | Monitorar logs + renovação manual |

---

## Próximos Passos Imediatos

1. [ ] Configurar Evolution API ou Twilio nos secrets do dashboard
2. [ ] Cadastrar primeiros 3 clientes em `/relatorios-clientes`
3. [ ] Monitorar simulações do Orçamento Dinâmico por 2 semanas
4. [ ] Vincular Google Ads ao GA4 no painel do Google
5. [ ] Aguardar primeira execução do Briefing de Voz (amanhã às 7h45)
6. [ ] Aguardar primeira Previsão de Leads (próxima sexta às 16h)

---

*Documento gerado automaticamente em 07/04/2026 — Zênite Tech*
