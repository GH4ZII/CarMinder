import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_URL } from './apiCall';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Returns null if permissions are denied or on simulator.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('eu-control', {
      name: 'EU Control Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#007AFF',
    });
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'acf90c67-6607-4433-b3a7-990766cdf1e9',
    });
    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Send the push token to the backend for storage.
 */
export async function sendPushTokenToBackend(
  expoPushToken: string,
  authToken: string,
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
    if (!res.ok) {
      console.error('Failed to register push token with backend:', res.status);
    }
  } catch (error) {
    console.error('Error sending push token to backend:', error);
  }
}

/**
 * Remove the push token from the backend (call on sign out).
 */
export async function removePushTokenFromBackend(
  expoPushToken: string,
  authToken: string,
): Promise<void> {
  try {
    await fetch(`${API_URL}/push-tokens`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
  } catch (error) {
    console.error('Error removing push token from backend:', error);
  }
}
