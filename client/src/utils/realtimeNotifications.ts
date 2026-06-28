/**
 * Real-time Notifications System
 * 
 * Sistema de notificações em tempo real com WebSocket para alertas de performance.
 * Requer upgrade para web-db-user para implementar backend com Socket.io.
 */

import React from 'react';

export interface RealtimeAlert {
  id: string;
  type: 'CTR_DROP' | 'ROI_DROP' | 'SPEND_SPIKE' | 'CONVERSION_DROP' | 'LOW_CTR';
  severity: 'HIGH' | 'MEDIUM';
  campaign: string;
  message: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  timestamp: Date;
}

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

/**
 * Hook React para Notificações em Tempo Real
 */
export const useRealtimeAlerts = (customerId: string, config?: Partial<WebSocketConfig>) => {
  const [alerts, setAlerts] = React.useState<RealtimeAlert[]>([]);
  const [connected, setConnected] = React.useState(false);
  const socketRef = React.useRef<any>(null);

  React.useEffect(() => {
    const wsConfig: WebSocketConfig = {
      url: process.env.REACT_APP_WS_URL || 'http://localhost:3001',
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      ...config,
    };

    // Notificação: Importar Socket.io client quando disponível
    // const { io } = require('socket.io-client');
    // socketRef.current = io(wsConfig.url, { ... });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [customerId]);

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return {
    alerts,
    connected,
    dismissAlert,
    clearAllAlerts,
  };
};

/**
 * Função para Reproduzir Som de Alerta
 */
export const playAlertSound = (severity: 'HIGH' | 'MEDIUM') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (severity === 'HIGH') {
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } else {
      oscillator.frequency.value = 400;
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (error) {
    console.log('Audio context not available');
  }
};

/**
 * Tipos de Alertas em Tempo Real
 * 
 * HIGH: CTR_DROP, ROI_DROP, CONVERSION_DROP
 * MEDIUM: SPEND_SPIKE, LOW_CTR
 */

/**
 * BACKEND IMPLEMENTATION TEMPLATE
 * 
 * Instalar: npm install socket.io
 * 
 * import { Server } from 'socket.io';
 * import { createServer } from 'http';
 * 
 * const httpServer = createServer(app);
 * const io = new Server(httpServer, {
 *   cors: { origin: process.env.FRONTEND_URL }
 * });
 * 
 * io.on('connection', (socket) => {
 *   socket.on('subscribe-alerts', (customerId) => {
 *     socket.join(`alerts-${customerId}`);
 *   });
 * });
 * 
 * setInterval(async () => {
 *   const campaigns = await fetchCampaigns();
 *   const alerts = checkAlerts(campaigns);
 *   alerts.forEach(alert => {
 *     io.to(`alerts-${alert.customerId}`).emit('performance-alert', alert);
 *   });
 * }, 5 * 60 * 1000);
 */

/**
 * PRÓXIMOS PASSOS
 * 
 * 1. Upgrade para web-db-user
 * 2. Instalar Socket.io no backend
 * 3. Implementar servidor WebSocket
 * 4. Configurar monitoramento de performance
 * 5. Testar conexão WebSocket
 * 6. Implementar notificações do navegador
 * 7. Testar alertas em tempo real
 */
