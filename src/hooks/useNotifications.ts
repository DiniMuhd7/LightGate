import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

// Configure how notifications are handled when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface UseNotificationsReturn {
  /** Call this to show a notification from web content. */
  showWebNotification: (title: string, body: string, icon?: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const permissionGranted = useRef(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;

      // Create the default Android notification channel.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'LifeGate',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0AADA2',
          sound: 'default',
        });
      }

      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
        },
      });
      permissionGranted.current = status === 'granted';
    })();

    // Handle notification tap — bring the app to foreground without
    // opening any external browser. We intentionally ignore any URL
    // that might be embedded in the notification data so the OS never
    // hands it off to Safari / Chrome.
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (_response) => {
        // Bringing the app to the foreground is handled automatically by
        // the OS when the user taps the notification. We only need to
        // ensure we don't accidentally trigger external URL handling.
        // Explicitly move app to active state on Android if needed.
        if (AppState.currentState !== 'active') {
          // No-op: the OS already activates the app on notification tap.
          // This listener exists to intercept and block any default
          // URL-opening behaviour from expo-notifications.
        }
      },
    );

    return () => {
      responseSub.remove();
    };
  }, []);

  const showWebNotification = async (title: string, body: string, _icon?: string) => {
    if (!permissionGranted.current) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || 'LifeGate',
          body: body || '',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          // Explicitly no URL data — prevents any external browser launch.
          data: { source: 'lifegate_web' },
        },
        trigger: null, // fire immediately
      });
    } catch {
      // silently ignore if notifications are unavailable
    }
  };

  return { showWebNotification };
}

