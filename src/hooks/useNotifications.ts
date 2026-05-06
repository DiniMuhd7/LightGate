import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

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
  /** Call this to show a local notification triggered by web content. */
  showWebNotification: (title: string, body: string, icon?: string) => Promise<void>;
  /**
   * Expo push token for the device. Null until permissions are granted and
   * the token has been fetched. Pass this to the website so it can register
   * the device with the LifeGate backend for remote push notifications.
   */
  pushToken: string | null;
}

interface UseNotificationsOptions {
  /**
   * Called when the user taps a push notification that contains a `url`
   * field in its data payload. Used to navigate the WebView to that URL.
   */
  onNotificationTap?: (url: string) => void;
}

export function useNotifications(
  { onNotificationTap }: UseNotificationsOptions = {},
): UseNotificationsReturn {
  const permissionGranted = useRef(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  // Keep a ref to avoid stale closures in listeners
  const onTapRef = useRef(onNotificationTap);
  onTapRef.current = onNotificationTap;

  useEffect(() => {
    let isMounted = true;

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

      // Obtain the Expo push token so the LifeGate backend can send
      // targeted push notifications to this device via Expo's push service.
      // The token is also injected into the WebView as window.__lgPushToken.
      if (permissionGranted.current) {
        try {
          const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
          if (projectId) {
            const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            if (isMounted) setPushToken(tokenData.data);
          }
        } catch {
          // Not available in Expo Go without a development build — silently skip.
        }
      }
    })();

    // Foreground notification received — already displayed via setNotificationHandler.
    // Listener kept for future extensibility (badge updates, etc.).
    const receivedSub = Notifications.addNotificationReceivedListener(() => {});

    // Notification tap handler — extracts a URL from the notification data
    // payload and navigates the WebView to it. Fires when the app is open or
    // resuming from background.
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | null;
      const url = typeof data?.url === 'string' ? data.url : null;
      if (url && url.startsWith('http') && onTapRef.current) {
        onTapRef.current(url);
      }
    });

    // Cold-start: app was killed and launched by tapping a notification.
    // getLastNotificationResponseAsync returns the tap that launched the app.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response || !isMounted) return;
        const data = response.notification.request.content.data as Record<string, unknown> | null;
        const url = typeof data?.url === 'string' ? data.url : null;
        if (url && url.startsWith('http') && onTapRef.current) {
          onTapRef.current(url);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      receivedSub.remove();
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
          data: { source: 'lifegate_web' },
        },
        trigger: null, // fire immediately
      });
    } catch {
      // silently ignore if notifications are unavailable
    }
  };

  return { showWebNotification, pushToken };
}

