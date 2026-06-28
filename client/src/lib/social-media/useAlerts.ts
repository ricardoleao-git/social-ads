import { useState, useCallback } from "react";
import { EngagementAlert, AlertThreshold } from "@/lib/alertsService";

export function useAlerts(_accountId: string) {
  const [alerts, setAlerts] = useState<EngagementAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [threshold, setThreshold] = useState<AlertThreshold>({
    engagementDropPercent: 20,
    engagementPeakPercent: 50,
    minFollowersForAlert: 1000,
    enableNotifications: true,
  });

  const markAsRead = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  const updateThreshold = useCallback((newThreshold: AlertThreshold) => {
    setThreshold(newThreshold);
  }, []);

  const getAlertStats = useCallback(() => ({
    total: alerts.length,
    unread: unreadCount,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  }), [alerts, unreadCount]);

  return {
    alerts,
    unreadCount,
    threshold,
    markAsRead,
    dismissAlert,
    clearAllAlerts,
    updateThreshold,
    getAlertStats,
  };
}
