import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// How push notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { profile } = useAuth();
  const notifListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!profile) return;

    registerForPushNotifications(profile.id);

    // Listen to incoming notifications while app is foregrounded
    notifListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // Could update an unread badge count here if desired
    });

    // Listen for user tapping a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(_response => {
      // Navigate based on notification data in future iterations
    });

    return () => {
      notifListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [profile?.id]);
}

async function registerForPushNotifications(userId: string) {
  if (Platform.OS === 'web') return;

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Get the Expo push token
  try {
    await Notifications.getExpoPushTokenAsync();
  } catch {
    // Expo push tokens require a physical device or valid project ID — silently skip in dev
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Rillcod',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7a0606',
      sound: 'default',
    });
  }
}
