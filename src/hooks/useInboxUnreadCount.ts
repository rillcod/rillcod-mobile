import { useEffect, useState } from 'react';
import { chatService } from '../services/chat.service';
import { notificationService } from '../services/notification.service';

/** Notifications + messages + newsletter deliveries the user has not seen. */
export function useInboxUnreadCount(userId: string | undefined) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }

    const fetchUnread = async () => {
      try {
        const [notif, msgs, newsletters] = await Promise.all([
          notificationService.getUnreadCount(userId),
          chatService.countUnreadForRecipient(userId),
          notificationService.countUnviewedNewsletterDeliveries(userId),
        ]);
        setUnread(notif + msgs + newsletters);
      } catch {
        setUnread(0);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  return unread;
}
