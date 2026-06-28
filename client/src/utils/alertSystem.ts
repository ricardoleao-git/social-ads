/**
 * Sistema de Alertas por E-mail
 * Monitora quedas de performance e envia notificações automáticas
 */

export interface AdGroup {
  id: number;
  name: string;
  ctr: number;
  cpc: number;
  clicks: number;
  conversions: number;
  spend?: number;
  status: string;
}

export interface PerformanceAlert {
  type: 'CTR_DROP' | 'NO_CONVERSIONS' | 'HIGH_CPC' | 'LOW_CTR';
  group: string;
  current: number;
  previous: number;
  change?: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface AlertConfig {
  emailRecipient: string;
  ctrDropThreshold: number; // Ex: 0.8 para 20% de queda
  minCTRThreshold: number;  // Ex: 8 para alertar se CTR < 8%
  maxCPCThreshold: number;  // Ex: 3.5 para alertar se CPC > 3.5
  enabled: boolean;
}

/**
 * Verifica performance e gera alertas
 */
export function checkPerformanceAlerts(
  currentGroups: AdGroup[],
  previousGroups: AdGroup[]
): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const now = new Date().toISOString();

  currentGroups.forEach((group, idx) => {
    const prev = previousGroups[idx];
    if (!prev) return;

    // Alerta: CTR caiu mais de 20%
    if (group.ctr < prev.ctr * 0.8 && group.ctr < 12 && prev.ctr > 0) {
      alerts.push({
        type: 'CTR_DROP',
        group: group.name,
        current: group.ctr,
        previous: prev.ctr,
        change: ((group.ctr - prev.ctr) / prev.ctr) * 100,
        severity: group.ctr < 5 ? 'high' : 'medium',
        timestamp: now
      });
    }

    // Alerta: Zero conversões (quando tinha antes)
    if (group.conversions === 0 && prev.conversions > 0) {
      alerts.push({
        type: 'NO_CONVERSIONS',
        group: group.name,
        current: group.conversions,
        previous: prev.conversions,
        severity: 'high',
        timestamp: now
      });
    }

    // Alerta: CPC muito alto
    if (group.cpc > 3.5 && group.cpc > prev.cpc * 1.2 && prev.cpc > 0) {
      alerts.push({
        type: 'HIGH_CPC',
        group: group.name,
        current: group.cpc,
        previous: prev.cpc,
        change: ((group.cpc - prev.cpc) / prev.cpc) * 100,
        severity: 'medium',
        timestamp: now
      });
    }

    // Alerta: CTR muito baixo
    if (group.ctr < 5 && group.clicks > 10) {
      alerts.push({
        type: 'LOW_CTR',
        group: group.name,
        current: group.ctr,
        previous: prev.ctr,
        severity: 'medium',
        timestamp: now
      });
    }
  });

  return alerts;
}

/**
 * Formata alertas em HTML para envio por e-mail
 */
export function formatAlertEmail(alerts: PerformanceAlert[]): string {
  const highAlerts = alerts.filter((a) => a.severity === 'high');
  const mediumAlerts = alerts.filter((a) => a.severity === 'medium');

  let html = `
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        h2 { color: #dc2626; }
        h3 { margin-top: 20px; }
        .high { color: #dc2626; }
        .medium { color: #f59e0b; }
        .alert-item { 
          padding: 10px; 
          margin: 10px 0; 
          border-left: 4px solid #ccc; 
          background: #f9fafb;
        }
        .alert-item.high { border-left-color: #dc2626; background: #fee2e2; }
        .alert-item.medium { border-left-color: #f59e0b; background: #fef3c7; }
        a { color: #3b82f6; text-decoration: none; }
        .footer { margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <h2>🚨 Alertas de Performance - Zênite Tech Dashboard</h2>
      <p>Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
  `;

  if (highAlerts.length > 0) {
    html += '<h3 class="high">⚠️ Alertas Críticos (Alta Prioridade)</h3>';
    highAlerts.forEach((alert) => {
      html += `<div class="alert-item high">`;
      html += `<strong>${alert.group}</strong>: `;
      
      if (alert.type === 'CTR_DROP') {
        html += `CTR caiu de ${alert.previous?.toFixed(2)}% para ${alert.current.toFixed(2)}% (${alert.change?.toFixed(1)}%)`;
      } else if (alert.type === 'NO_CONVERSIONS') {
        html += `Sem conversões (tinha ${alert.previous} antes)`;
      }
      html += '</div>';
    });
  }

  if (mediumAlerts.length > 0) {
    html += '<h3 class="medium">⚡ Alertas Moderados</h3>';
    mediumAlerts.forEach((alert) => {
      html += `<div class="alert-item medium">`;
      html += `<strong>${alert.group}</strong>: `;
      
      if (alert.type === 'HIGH_CPC') {
        html += `CPC subiu para R$ ${alert.current.toFixed(2)} (era R$ ${alert.previous?.toFixed(2)})`;
      } else if (alert.type === 'LOW_CTR') {
        html += `CTR muito baixo: ${alert.current.toFixed(2)}%`;
      }
      html += '</div>';
    });
  }

  html += `
    <div class="footer">
      <p><a href="https://seu-dashboard.com">Abrir Dashboard</a></p>
      <p>Este é um alerta automático do Zênite Tech Dashboard</p>
    </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Simula envio de alertas (para ambiente de desenvolvimento)
 * Em produção, usar API backend para enviar e-mails reais
 */
export async function sendAlertEmail(
  alerts: PerformanceAlert[],
  config: AlertConfig
): Promise<void> {
  if (alerts.length === 0 || !config.enabled) {
    console.log('✅ Sem alertas para enviar');
    return;
  }

  try {
    // Em desenvolvimento, apenas logar os alertas
    console.log(`📧 Alertas a enviar para ${config.emailRecipient}:`, alerts);
    
    // Em produção, chamar API backend:
    // const response = await fetch('/api/email/send-alert', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     to: config.emailRecipient,
      //   subject: `🚨 Alertas de Performance - Zênite Tech (${alerts.length} alertas)`,
    //     html: formatAlertEmail(alerts),
    //     alerts: alerts
    //   })
    // });
    
    console.log(`✅ ${alerts.length} alertas preparados para envio`);
  } catch (error) {
    console.error('❌ Erro ao preparar alertas:', error);
  }
}

/**
 * Verifica alertas e envia e-mail se necessário
 */
export async function checkAndSendAlerts(
  currentGroups: AdGroup[],
  previousGroups: AdGroup[],
  config: AlertConfig
): Promise<PerformanceAlert[]> {
  const alerts = checkPerformanceAlerts(currentGroups, previousGroups);

  if (alerts.length > 0 && config.enabled) {
    await sendAlertEmail(alerts, config);
  }

  return alerts;
}
