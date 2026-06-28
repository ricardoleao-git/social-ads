# Contrato de API — Integração Bidirecional entre Sistemas Zênite Tech

**Versão:** 1.0.0  
**Data:** Abril 2026  
**Sistemas envolvidos:**
- **Google Ads Dashboard** → `trafego-google.zenitetech.com` (este sistema)
- **Instagram Analytics Dashboard** → `redes-sociais.zenitetech.com` (sistema parceiro)

---

## Visão Geral da Integração

Os dois sistemas se comunicam a cada hora via REST API autenticada por chave compartilhada (`INTEGRATION_API_KEY`). A sincronização é bidirecional:

| Direção | Origem | Destino | Frequência |
|---|---|---|---|
| **Outbound** | Google Ads Dashboard | Instagram Dashboard | A cada hora (minuto :05) |
| **Inbound** | Instagram Dashboard | Google Ads Dashboard | A cada hora (qualquer minuto) |

---

## Autenticação

Todas as chamadas autenticadas devem incluir o header:

```
X-Integration-Key: <valor_do_INTEGRATION_API_KEY>
```

A mesma chave deve estar configurada em **ambos os sistemas** como variável de ambiente `INTEGRATION_API_KEY`.

> **Importante:** O endpoint `/api/integration/health` não requer autenticação e pode ser usado para verificar se o sistema está online.

---

## Endpoints do Google Ads Dashboard (trafego-google.zenitetech.com)

### `GET /api/integration/health`
Verifica se o sistema está online. **Sem autenticação.**

**Resposta:**
```json
{
  "status": "ok",
  "system": "Google Ads Dashboard",
  "domain": "trafego-google.zenitetech.com",
  "timestamp": "2026-04-05T11:43:18.626Z",
  "version": "1.0.0",
  "endpoints": { ... }
}
```

---

### `POST /api/integration/instagram/sync`
**Recebe** um snapshot de métricas do Instagram. Chamado pelo sistema de redes sociais a cada hora.

**Header:** `X-Integration-Key: <chave>`

**Body (JSON):**
```json
{
  "accountHandle": "@zenite.tech",
  "accountName": "Zênite Tech",
  "followers": 1250,
  "reach": 3400,
  "likes": 892,
  "engagementRate": 4.7,
  "impressions": 8900,
  "comments": 45,
  "shares": 23,
  "period": "7d"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `accountHandle` | string | ✅ | Handle da conta (ex: `@zenite.tech`) |
| `accountName` | string | — | Nome de exibição da conta |
| `followers` | number | — | Total de seguidores |
| `reach` | number | — | Alcance no período |
| `likes` | number | — | Total de curtidas |
| `engagementRate` | number | — | Taxa de engajamento em % |
| `impressions` | number | — | Total de impressões |
| `comments` | number | — | Total de comentários |
| `shares` | number | — | Total de compartilhamentos |
| `period` | string | — | Período: `7d`, `30d`, `90d` |

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Instagram metrics snapshot saved",
  "account": "@zenite.tech",
  "syncedAt": "2026-04-05T11:43:37.456Z"
}
```

---

### `GET /api/integration/gads/summary`
**Envia** o resumo de performance do Google Ads dos últimos 7 dias.

**Header:** `X-Integration-Key: <chave>`  
**Query param:** `?period=7d` (opcional, padrão: `7d`)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "totalClicks": 585,
    "totalImpressions": 5420,
    "totalConversions": 28,
    "totalSpend": 892.50,
    "avgCtrPercent": 10.79,
    "avgCpcBrl": 1.53,
    "currency": "BRL",
    "generatedAt": "2026-04-05T11:00:05.000Z"
  }
}
```

---

### `GET /api/integration/gads/campaigns`
**Envia** a lista de campanhas ativas com métricas dos últimos 7 dias.

**Header:** `X-Integration-Key: <chave>`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "id": "12345678",
        "name": "Performance Ads - Recarga Veicular",
        "status": "ENABLED",
        "impressions": 1200,
        "clicks": 172,
        "spend": 476.44,
        "conversions": 15
      }
    ],
    "count": 9,
    "generatedAt": "2026-04-05T11:00:05.000Z"
  }
}
```

---

### `GET /api/integration/gads/trends`
**Envia** a tendência diária de CTR/CPC dos últimos 7 dias.

**Header:** `X-Integration-Key: <chave>`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "date": "2026-03-30",
        "impressions": 820,
        "clicks": 94,
        "spend": 144.10,
        "conversions": 4,
        "ctrPercent": 11.46,
        "cpcBrl": 1.53
      }
    ],
    "days": 7,
    "generatedAt": "2026-04-05T11:00:05.000Z"
  }
}
```

---

### `GET /api/integration/instagram/history`
**Consulta** os snapshots de Instagram armazenados neste sistema.

**Header:** `X-Integration-Key: <chave>`  
**Query params:** `?limit=48` (máx 200), `?handle=@zenite.tech` (opcional)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "snapshots": [ { ... } ],
    "count": 48
  }
}
```

---

### `GET /api/integration/sync-log`
**Consulta** o histórico de sincronizações (entradas e saídas).

**Header:** `X-Integration-Key: <chave>`  
**Query params:** `?limit=50` (máx 200)

---

## Endpoints que o Instagram Dashboard DEVE implementar

Para que a integração seja completa, o sistema `redes-sociais.zenitetech.com` precisa implementar os seguintes endpoints:

### `GET /api/integration/health`
Health check sem autenticação. Mesma estrutura do Google Ads Dashboard.

---

### `POST /api/integration/gads/receive`
**Recebe** o resumo de performance do Google Ads enviado pelo job horário deste sistema.

**Header:** `X-Integration-Key: <chave>`

**Body (JSON):** mesmo formato de `GET /api/integration/gads/summary`
```json
{
  "period": "7d",
  "totalClicks": 585,
  "totalImpressions": 5420,
  "totalConversions": 28,
  "totalSpend": 892.50,
  "avgCtrPercent": 10.79,
  "avgCpcBrl": 1.53,
  "currency": "BRL",
  "source": "trafego-google.zenitetech.com",
  "syncedAt": "2026-04-05T11:05:00.000Z"
}
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Google Ads data received",
  "receivedAt": "2026-04-05T11:05:01.234Z"
}
```

---

### `GET /api/integration/instagram/summary`
**Envia** o resumo de métricas do Instagram para ser consumido pelo Google Ads Dashboard.

**Header:** `X-Integration-Key: <chave>`  
**Query param:** `?handle=@zenite.tech` (opcional)

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "accountHandle": "@zenite.tech",
    "accountName": "Zênite Tech",
    "followers": 1250,
    "followersGrowth": 45,
    "reach": 3400,
    "engagementRate": 4.7,
    "impressions": 8900,
    "period": "7d",
    "topPost": {
      "id": "post_123",
      "caption": "...",
      "likes": 234,
      "comments": 18,
      "reach": 1200
    },
    "generatedAt": "2026-04-05T11:00:00.000Z"
  }
}
```

---

## Fluxo Horário Completo

```
:00 — Google Ads Dashboard executa hourlyAutoNegative (negativação automática)
:05 — Google Ads Dashboard executa hourlyIntegrationSync:
        → Busca métricas do Google Ads (últimos 7 dias)
        → POST https://redes-sociais.zenitetech.com/api/integration/gads/receive
        → Registra resultado em integration_sync_log

:XX — Instagram Dashboard executa seu job horário:
        → Busca métricas do Instagram via MCP
        → POST https://trafego-google.zenitetech.com/api/integration/instagram/sync
        → Registra resultado em seu próprio log
```

---

## Tratamento de Erros

| Código | Significado |
|---|---|
| `200` | Sucesso |
| `400` | Dados inválidos (campo obrigatório ausente) |
| `401` | Chave de integração inválida ou ausente |
| `500` | Erro interno do servidor |
| `503` | Banco de dados indisponível |

Após **3 falhas consecutivas** de outbound sync, o sistema Google Ads Dashboard envia uma notificação ao proprietário via Manus Notifications.

---

## Configuração Necessária no Instagram Dashboard

1. Adicionar `INTEGRATION_API_KEY` como variável de ambiente (mesma chave do Google Ads Dashboard)
2. Implementar os endpoints listados na seção "Endpoints que o Instagram Dashboard DEVE implementar"
3. Criar um job horário que chame `POST /api/integration/instagram/sync` no Google Ads Dashboard

---

## Segurança

- A chave `INTEGRATION_API_KEY` nunca deve ser exposta no frontend
- Todas as chamadas entre sistemas devem ser feitas server-side
- A chave deve ser rotacionada periodicamente e atualizada em ambos os sistemas simultaneamente
- Em produção, considere adicionar rate limiting (ex: máximo 10 chamadas por minuto por IP)
