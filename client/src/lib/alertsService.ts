export interface AlertThreshold {
  engagementDropPercent: number;
  engagementPeakPercent: number;
  minFollowersForAlert: number;
  enableNotifications: boolean;
}

export interface EngagementAlert {
  id: string;
  type: 'drop' | 'spike' | 'threshold';
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  read: boolean;
  accountId?: string;
}

export const alertsService = {
  getAlerts: async (_accountId?: string): Promise<EngagementAlert[]> => [],
  markAsRead: async (_id: string): Promise<void> => {},
  dismissAlert: async (_id: string): Promise<void> => {},
  getThreshold: async (_accountId?: string): Promise<AlertThreshold> => ({
    engagementDropPercent: 20,
    engagementPeakPercent: 50,
    minFollowersForAlert: 1000,
    enableNotifications: true,
  }),
  setThreshold: async (_accountId: string, _threshold: AlertThreshold): Promise<void> => {},
};

export const getAlerts = alertsService.getAlerts;
export const markAsRead = alertsService.markAsRead;
export const dismissAlert = alertsService.dismissAlert;

export default alertsService;
