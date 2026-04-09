import { useNotificationListener } from '@/hooks/useNotificationListener';

/**
 * Component that enables message and call notifications
 * Listens for incoming messages and calls, shows toast notifications
 * with action buttons to navigate to Messages & Calls section
 */
export function NotificationListener() {
  useNotificationListener();
  return null; // This component doesn't render anything
}
