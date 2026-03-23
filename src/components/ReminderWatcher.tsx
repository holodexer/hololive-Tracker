import { useEffect } from "react";
import { differenceInMinutes } from "date-fns";
import { useHolodexStreams } from "@/hooks/useHolodex";
import { useSettings } from "@/contexts/SettingsContext";
import { showSuccess } from "@/lib/errors";

const REMINDER_WINDOW_MINUTES = 10;

export function ReminderWatcher() {
  const { data } = useHolodexStreams();
  const { reminders, markReminderNotified, t } = useSettings();

  useEffect(() => {
    if (reminders.length === 0) return;

    const upcoming = data?.upcoming ?? [];
    const now = new Date();

    reminders.forEach((reminder) => {
      if (reminder.notifiedAt) return;

      const matched = upcoming.find((video) => video.id === reminder.videoId);
      const targetDate = matched ? new Date(matched.available_at) : new Date(reminder.scheduledFor);
      const minutesUntil = differenceInMinutes(targetDate, now);

      if (minutesUntil > REMINDER_WINDOW_MINUTES || minutesUntil < 0) {
        return;
      }

      showSuccess(t.reminders.toastTitle, {
        description: `${reminder.channelName} · ${reminder.title}`,
      });

      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(t.reminders.browserTitle, {
          body: `${reminder.channelName} · ${reminder.title}`,
          icon: "./favicon.ico",
        });
      }

      markReminderNotified(reminder.videoId);
    });
  }, [data?.upcoming, markReminderNotified, reminders, t.reminders.browserTitle, t.reminders.toastTitle]);

  return null;
}