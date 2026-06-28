import { toast } from "sonner";

export interface EngagementMilestone {
  id: string;
  type: "likes" | "comments" | "shares" | "followers" | "reach";
  threshold: number;
  accountName: string;
  postTitle?: string;
}

export interface NotificationPreference {
  likes: boolean;
  comments: boolean;
  shares: boolean;
  followers: boolean;
  reach: boolean;
  email: boolean;
}

export const defaultNotificationPreferences: NotificationPreference = {
  likes: true,
  comments: true,
  shares: true,
  followers: true,
  reach: true,
  email: false,
};

export function checkEngagementMilestones(
  currentMetrics: {
    likes?: number;
    comments?: number;
    shares?: number;
    followers?: number;
    reach?: number;
  },
  milestones: EngagementMilestone[],
  preferences: NotificationPreference
): void {
  milestones.forEach((milestone) => {
    const metricValue = currentMetrics[milestone.type];

    if (metricValue && metricValue >= milestone.threshold) {
      const message = generateNotificationMessage(milestone, metricValue);
      notifyUser(message, milestone.type, preferences);
    }
  });
}

function generateNotificationMessage(
  milestone: EngagementMilestone,
  value: number
): string {
  const typeLabel = {
    likes: "Curtidas",
    comments: "Comentários",
    shares: "Compartilhamentos",
    followers: "Seguidores",
    reach: "Alcance",
  };

  if (milestone.postTitle) {
    return `🎉 Parabéns! Seu post "${milestone.postTitle}" atingiu ${value} ${typeLabel[milestone.type].toLowerCase()}!`;
  }

  return `🎉 Parabéns! Sua conta ${milestone.accountName} atingiu ${value} ${typeLabel[milestone.type].toLowerCase()}!`;
}

export function notifyUser(
  message: string,
  type: string,
  preferences: NotificationPreference
): void {
  const typeKey = type as keyof NotificationPreference;

  if (!preferences[typeKey]) {
    return;
  }

  // Toast notification
  const toastTypeMap: Record<string, "success" | "info" | "error" | "loading"> = {
    likes: "success",
    comments: "info",
    shares: "success",
    followers: "success",
    reach: "info",
  };

  const toastType = toastTypeMap[type] || "info";

  toast[toastType](message, {
    duration: 5000,
    position: "top-right",
  })

  // Browser notification
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("InstaMetrics", {
      body: message,
      icon: "/instagram-icon.png",
    });
  }

  // Email notification (if enabled)
  if (preferences.email) {
    sendEmailNotification(message, type);
  }
}

export function requestNotificationPermission(): void {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function sendEmailNotification(
  message: string,
  type: string
): Promise<void> {
  return new Promise((resolve) => {
    // Simulated email notification
    console.log(`Email notification sent: ${message}`);
    setTimeout(() => resolve(), 1000);
  });
}

export function saveNotificationPreferences(
  preferences: NotificationPreference
): void {
  localStorage.setItem(
    "notificationPreferences",
    JSON.stringify(preferences)
  );
}

export function getNotificationPreferences(): NotificationPreference {
  const stored = localStorage.getItem("notificationPreferences");
  return stored
    ? JSON.parse(stored)
    : defaultNotificationPreferences;
}

export function saveMilestones(milestones: EngagementMilestone[]): void {
  localStorage.setItem("engagementMilestones", JSON.stringify(milestones));
}

export function getMilestones(): EngagementMilestone[] {
  const stored = localStorage.getItem("engagementMilestones");
  return stored ? JSON.parse(stored) : [];
}
