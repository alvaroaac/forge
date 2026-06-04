import { Notification } from 'electron';

export type NotifyDoneFn = (title: string, body: string) => void;

export function notifyDone(title: string, body: string): void {
  try {
    if (typeof Notification?.isSupported !== 'function' || !Notification.isSupported()) {
      return;
    }

    new Notification({ title, body }).show();
  } catch {
    // Notifications are nice-to-have. A native notification failure must not fail generation.
  }
}

export function notifyDoneBestEffort(notifier: NotifyDoneFn, title: string, body: string): void {
  try {
    notifier(title, body);
  } catch {
    // Keep caller workflows successful even when a custom notifier throws.
  }
}
