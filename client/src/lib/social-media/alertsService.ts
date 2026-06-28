// Intelligent alerts service for engagement drops and peaks
import { toast } from "sonner";

export interface AlertThreshold {
  engagementDropPercent: number; // e.g., 20 = 20% drop
  engagementPeakPercent: number; // e.g., 50 = 50% increase
  minFollowersForAlert: number; // Minimum followers to trigger alert
  enableNotifications: boolean;
}

export interface EngagementAlert {
  id: string;
  accountId: string;
  type: "drop" | "peak" | "milestone";
  severity: "low" | "medium" | "high";
  title: string;
  message: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  timestamp: Date;
  read: boolean;
}

class AlertsService {
  private alerts: Map<string, EngagementAlert[]> = new Map();
  private thresholds: Map<string, AlertThreshold> = new Map();
  private previousMetrics: Map<string, any> = new Map();

  /**
   * Initialize alerts for an account
   */
  initializeAlerts(
    accountId: string,
    threshold: AlertThreshold
  ): void {
    this.thresholds.set(accountId, threshold);
    this.alerts.set(accountId, []);
    this.loadAlertsFromStorage(accountId);
  }

  /**
   * Check for engagement changes and create alerts
   */
  checkEngagementMetrics(
    accountId: string,
    currentMetrics: any
  ): EngagementAlert[] {
    const threshold = this.thresholds.get(accountId);
    if (!threshold) return [];

    const previousMetrics = this.previousMetrics.get(accountId);
    const newAlerts: EngagementAlert[] = [];

    if (!previousMetrics) {
      this.previousMetrics.set(accountId, currentMetrics);
      return [];
    }

    // Check for engagement drop
    const engagementChange =
      ((currentMetrics.engagement - previousMetrics.engagement) /
        previousMetrics.engagement) *
      100;

    if (engagementChange < -threshold.engagementDropPercent) {
      const alert = this.createAlert(
        accountId,
        "drop",
        "high",
        `Queda de Engajamento: ${Math.abs(engagementChange).toFixed(1)}%`,
        `O engajamento caiu de ${previousMetrics.engagement.toFixed(1)}% para ${currentMetrics.engagement.toFixed(1)}%`,
        previousMetrics.engagement,
        currentMetrics.engagement,
        engagementChange
      );
      newAlerts.push(alert);
    }

    // Check for engagement peak
    if (engagementChange > threshold.engagementPeakPercent) {
      const alert = this.createAlert(
        accountId,
        "peak",
        "medium",
        `Pico de Engajamento: +${engagementChange.toFixed(1)}%`,
        `O engajamento aumentou de ${previousMetrics.engagement.toFixed(1)}% para ${currentMetrics.engagement.toFixed(1)}%`,
        previousMetrics.engagement,
        currentMetrics.engagement,
        engagementChange
      );
      newAlerts.push(alert);
    }

    // Check for follower milestones
    if (
      currentMetrics.followers >= threshold.minFollowersForAlert &&
      previousMetrics.followers < threshold.minFollowersForAlert
    ) {
      const alert = this.createAlert(
        accountId,
        "milestone",
        "low",
        `Marco de Seguidores Atingido`,
        `Parabéns! Você atingiu ${currentMetrics.followers} seguidores!`,
        previousMetrics.followers,
        currentMetrics.followers,
        ((currentMetrics.followers - previousMetrics.followers) /
          previousMetrics.followers) *
          100
      );
      newAlerts.push(alert);
    }

    // Update previous metrics
    this.previousMetrics.set(accountId, currentMetrics);

    // Add new alerts to storage
    newAlerts.forEach((alert) => this.addAlert(accountId, alert));

    return newAlerts;
  }

  /**
   * Create an alert
   */
  private createAlert(
    accountId: string,
    type: "drop" | "peak" | "milestone",
    severity: "low" | "medium" | "high",
    title: string,
    message: string,
    previousValue: number,
    currentValue: number,
    changePercent: number
  ): EngagementAlert {
    return {
      id: `${accountId}-${Date.now()}`,
      accountId,
      type,
      severity,
      title,
      message,
      previousValue,
      currentValue,
      changePercent,
      timestamp: new Date(),
      read: false,
    };
  }

  /**
   * Add alert to list
   */
  private addAlert(accountId: string, alert: EngagementAlert): void {
    const accountAlerts = this.alerts.get(accountId) || [];
    accountAlerts.unshift(alert); // Add to beginning
    this.alerts.set(accountId, accountAlerts);

    // Keep only last 100 alerts
    if (accountAlerts.length > 100) {
      accountAlerts.pop();
    }

    this.saveAlertsToStorage(accountId);

    // Show notification
    this.showNotification(alert);
  }

  /**
   * Show notification toast
   */
  private showNotification(alert: EngagementAlert): void {
    const threshold = this.thresholds.get(alert.accountId);
    if (!threshold?.enableNotifications) return;

    if (alert.type === "drop") {
      toast.error(alert.title, {
        description: alert.message,
        duration: 5000,
      });
    } else if (alert.type === "peak") {
      toast.success(alert.title, {
        description: alert.message,
        duration: 5000,
      });
    } else {
      toast(alert.title, {
        description: alert.message,
        duration: 5000,
      });
    }
  }

  /**
   * Get alerts for an account
   */
  getAlerts(accountId: string): EngagementAlert[] {
    return this.alerts.get(accountId) || [];
  }

  /**
   * Get unread alerts count
   */
  getUnreadCount(accountId: string): number {
    const alerts = this.alerts.get(accountId) || [];
    return alerts.filter((a) => !a.read).length;
  }

  /**
   * Mark alert as read
   */
  markAsRead(accountId: string, alertId: string): void {
    const alerts = this.alerts.get(accountId) || [];
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.read = true;
      this.saveAlertsToStorage(accountId);
    }
  }

  /**
   * Mark all alerts as read
   */
  markAllAsRead(accountId: string): void {
    const alerts = this.alerts.get(accountId) || [];
    alerts.forEach((a) => (a.read = true));
    this.saveAlertsToStorage(accountId);
  }

  /**
   * Delete alert
   */
  deleteAlert(accountId: string, alertId: string): void {
    const alerts = this.alerts.get(accountId) || [];
    const index = alerts.findIndex((a) => a.id === alertId);
    if (index !== -1) {
      alerts.splice(index, 1);
      this.saveAlertsToStorage(accountId);
    }
  }

  /**
   * Clear all alerts
   */
  clearAllAlerts(accountId: string): void {
    this.alerts.set(accountId, []);
    this.saveAlertsToStorage(accountId);
  }

  /**
   * Save alerts to localStorage
   */
  private saveAlertsToStorage(accountId: string): void {
    try {
      const alerts = this.alerts.get(accountId) || [];
      localStorage.setItem(
        `alerts_${accountId}`,
        JSON.stringify(alerts)
      );
    } catch (error) {
      console.error("Erro ao salvar alertas:", error);
    }
  }

  /**
   * Load alerts from localStorage
   */
  private loadAlertsFromStorage(accountId: string): void {
    try {
      const stored = localStorage.getItem(`alerts_${accountId}`);
      if (stored) {
        const alerts = JSON.parse(stored);
        this.alerts.set(accountId, alerts);
      }
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    }
  }

  /**
   * Update threshold
   */
  updateThreshold(
    accountId: string,
    threshold: AlertThreshold
  ): void {
    this.thresholds.set(accountId, threshold);
  }

  /**
   * Get threshold
   */
  getThreshold(accountId: string): AlertThreshold | undefined {
    return this.thresholds.get(accountId);
  }

  /**
   * Get alert statistics
   */
  getAlertStats(accountId: string): {
    total: number;
    unread: number;
    drops: number;
    peaks: number;
    milestones: number;
  } {
    const alerts = this.alerts.get(accountId) || [];
    return {
      total: alerts.length,
      unread: alerts.filter((a) => !a.read).length,
      drops: alerts.filter((a) => a.type === "drop").length,
      peaks: alerts.filter((a) => a.type === "peak").length,
      milestones: alerts.filter((a) => a.type === "milestone").length,
    };
  }
}

// Export singleton instance
export const alertsService = new AlertsService();
