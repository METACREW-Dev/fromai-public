/**
 * Simple Push Notification Service
 * Handle Firebase push notifications
 */

import { getMessagingInstance } from "@/firebase/config";
import { getToken, onMessage } from "firebase/messaging";
import { base44 } from '@/api/base44Client';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

/**
 * Helper: Resolve target URL from notification data
 * Centralized logic to avoid duplication
 * @param {Object} data - Notification data payload
 * @returns {string} Target URL
 */
const resolveTargetUrl = (data) => {
  if (!data) return "/";

  // Priority: url > click_url > articleId > click_action > default
  if (data.url) {
    return data.url;
  }

  if (data.click_url) {
    return data.click_url;
  }

  if (data.click_action) {
    return data.click_action;
  }

  return "/";
};


const generateUuidV4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const getOrCreateUUID = () => {
  try {
  let uuid = undefined;
  // Check uuid in cookie
  if (typeof document !== "undefined") {
    const match = document.cookie.match('(^|;)\\s*x-uuid\\s*=\\s*([^;]+)');
    if (match) {
      uuid = match[2];
    } else {
      uuid = generateUuidV4();
      document.cookie = `x-uuid=${uuid}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } else {
    uuid = generateUuidV4();
  }
  return uuid;
  } catch (error) {
    // Fallback if localStorage is not available
    console.warn("Failed to access localStorage for UUID:", error);
    return generateUuidV4();
  }
};

const appClient = createAxiosClient({
    baseURL: import.meta.env.VITE_API_URL,
     headers: {
        Accept: "application/json",
        "x-uuid": getOrCreateUUID(),
     },
    interceptResponses: true
});


class SimplePushService {
  constructor() {
    this.currentToken = null;
    this.isInitialized = false;
    this.toastFunction = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.messaging = null;
  }

  /**
   * Initialize push notification service (without requesting permissions)
   * Permissions must be requested through user gesture
   */
  async initialize() {
    try {
      // Check if notifications are supported
      if (!("Notification" in window)) {
        console.warn("This browser does not support notifications");
        return false;
      }

      // Check if service worker is supported
      if (!("serviceWorker" in navigator)) {
        console.warn("Service workers are not supported");
        return false;
      }

      // Get Firebase Messaging instance
      this.messaging = getMessagingInstance();
      if (!this.messaging) {
        console.warn("Firebase Messaging not available");
        return false;
      }

      // Register Firebase messaging service worker
      try {
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          {
            scope: "/",
          }
        );
        console.log("✅ Service Worker registered:", registration);

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        console.log("✅ Service Worker ready");
      } catch (swError) {
        console.error("❌ Service Worker registration failed:", swError);
        return false;
      }

      // Check current permission status
      const currentPermission = Notification.permission;
      console.log("📱 Current notification permission:", currentPermission);

      if (currentPermission === "granted") {
        // If permission is already granted, initialize fully
        await this.initializeWithPermission();
        return true;
      } else {
        // For denied or default permissions, still try to get token and register device
        // This allows the server to have device info even without notification permission
        console.log(
          "ℹ️ Permission not granted, but attempting to register device anyway"
        );
        await this.attemptDeviceRegistration();
        return true; // Service is ready
      }
    } catch (error) {
      console.error("❌ Failed to initialize push notifications:", error);
      return false;
    }
  }

  /**
   * Initialize push notifications after permission is granted
   * This should only be called after user grants permission
   */
  async initializeWithPermission() {
    try {
      if (!this.messaging) {
        console.warn("Messaging instance not available");
        return false;
      }

      // Get FCM token
      await this.getFCMToken();

      // Listen for foreground messages
      this.setupMessageListener();

      this.isInitialized = true;
      console.log("✅ Push notifications fully initialized with permission");

      return true;
    } catch (error) {
      console.error(
        "❌ Failed to initialize push notifications with permission:",
        error
      );
      return false;
    }
  }

  /**
   * Attempt to register device even without notification permission
   * This allows the server to track devices for analytics or future use
   */
  async attemptDeviceRegistration() {
    try {
      if (!this.messaging) {
        console.warn("Messaging instance not available");
        return false;
      }

      // Try to get FCM token even without permission
      // This might work in some browsers or return null
      const token = await this.getFCMTokenWithoutPermission();

      if (token) {
        console.log("✅ Got FCM token without permission, registering device");
        await this.registerDevice(token);
      } else {
        console.log(
          "ℹ️ No FCM token available without permission, registering device with minimal info"
        );
        // Register device without token for analytics/tracking purposes
        await this.registerDeviceMinimal();
      }

      return true;
    } catch (error) {
      console.warn("⚠️ Failed to register device without permission:", error);
      // Don't throw error, just log warning - this is not critical
      return false;
    }
  }

  /**
   * Request notification permission (must be called from user gesture)
   */
  async requestPermission() {
    try {
      if (!("Notification" in window)) {
        console.warn("This browser does not support notifications");
        return { success: false, reason: "not_supported" };
      }

      const currentPermission = Notification.permission;

      if (currentPermission === "granted") {
        console.log("✅ Notification permission already granted");
        await this.initializeWithPermission();
        return { success: true, reason: "already_granted" };
      }

      if (currentPermission === "denied") {
        console.warn("⚠️ Notification permission was previously denied");
        return { success: false, reason: "previously_denied" };
      }

      // Request permission (this must be called from a user gesture)
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        console.log("✅ Notification permission granted by user");
        await this.initializeWithPermission();
        return { success: true, reason: "granted" };
      } else {
        console.warn("⚠️ Notification permission denied by user");
        return { success: false, reason: "denied" };
      }
    } catch (error) {
      console.error("❌ Error requesting notification permission:", error);
      return { success: false, reason: "error", error };
    }
  }

  /**
   * Set toast function for showing notifications
   * @param {Function} toastFn - Toast function from useToast hook
   */
  setToastFunction(toastFn) {
    this.toastFunction = toastFn;
  }

  /**
   * Get Firebase Cloud Messaging token
   */
  async getFCMToken() {
    try {
      if (!this.messaging) {
        console.warn("Messaging instance not available");
        return null;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        console.warn(
          "⚠️ VAPID key not configured - Push notifications disabled"
        );
        return null;
      }

      const token = await getToken(this.messaging, { vapidKey });

      if (token) {
        console.log("🔑 FCM Token:", token);
        this.currentToken = token;

        // Register device with retry logic
        const registrationResult = await this.registerDevice(token);
        if (!registrationResult) {
          console.warn("⚠️ Device registration failed, but token obtained");
        }

        return token;
      } else {
        console.warn("No registration token available");
        await this.registerDevice("");
        return null;
      }
    } catch (error) {
      console.error("❌ Error getting FCM token:", error);

      // Handle specific error cases
      if (error.code === "messaging/failed-service-worker-registration") {
        console.error("❌ Service worker registration failed for FCM");
      } else if (error.code === "messaging/permission-blocked") {
        console.error("❌ Notification permission blocked");
      } else if (error.code === "messaging/permission-default") {
        console.error("❌ Notification permission not granted");
      }

      return null;
    }
  }

  /**
   * Setup message listener for foreground notifications
   */
  setupMessageListener() {
    if (!this.messaging) {
      console.warn("Messaging instance not available for listener");
      return;
    }

    onMessage(this.messaging, (payload) => {
      console.log("📱 Message received:", payload);
      console.log("📱 Data:", payload.notification);

      // Show toast notification at top
      // this.showToastNotification(payload);

      // Show browser notification
      this.showNotification(payload);
    });
  }

  /**
   * Register device with server for push notifications
   * @param {string} fcmToken - Firebase Cloud Messaging token
   */
  async registerDevice(fcmToken, retryCount = 0) {
    try {

      const response =  await appClient.post("/devices/register", {
        fcm_token: fcmToken,
        device_type: "web",
      });
      // const response =  await base44.entities.DevicesRegister.create({
      //   fcm_token: fcmToken,
      //   device_type: "web",
      // });

      console.log("📱 Device registered successfully:", response);
      this.retryCount = 0;
      return response;
    } catch (error) {
      console.error(
        `❌ Failed to register device (attempt ${retryCount + 1}/${
          this.maxRetries
        }):`,
        error
      );

      if (
        retryCount < this.maxRetries - 1 &&
        (error.request || error.code === "NETWORK_ERROR")
      ) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 Retrying device registration in ${delay}ms...`);

        setTimeout(() => {
          this.registerDevice(fcmToken, retryCount + 1);
        }, delay);

        return null;
      }

      if (error.response) {
        console.error("Server response:", error.response.data);
        console.error("Status:", error.response.status);
      } else if (error.request) {
        console.error("Network error:", error.message);
      }

      return null;
    }
  }

  /**
   * Show toast notification at top
   * @param {Object} payload - Notification payload
   */
  showToastNotification(payload) {
    const { data } = payload;

    if (data && this.toastFunction) {
      const targetUrl = resolveTargetUrl(data);

      // Create onClick handler if URL is not home
      const onClickHandler =
        targetUrl !== "/"
          ? () => {
              window.open(targetUrl, "_blank", "noopener,noreferrer");
            }
          : undefined;

      // Display notification as toast
      this.toastFunction({
        title: data.title,
        description: data.body,
        type: "notification",
        image: data.image,
        duration: 6000,
        onClick: onClickHandler,
      });
    }
  }

  /**
   * Show browser notification
   * @param {Object} payload - Notification payload
   */
  showNotification(payload) {
    const { notification } = payload;

    if (notification) {
      const notificationOptions = {
        body: notification.body,
        icon: notification.icon || "/icon-192x192.png",
        image: notification.image,
        tag: "vibex-notification",
        data: notification,
        requireInteraction: false,
      };

      const browserNotification = new Notification(
        notification.title,
        notificationOptions
      );

      // Handle notification click (foreground)
      browserNotification.onclick = (event) => {
        event.preventDefault();

        const targetUrl = resolveTargetUrl(notification);
        console.log(
          "🖱️ Notification clicked (foreground), opening:",
          targetUrl
        );

        window.open(targetUrl, "_blank", "noopener,noreferrer");
        browserNotification.close();
      };
    }
  }

  /**
   * Get current token
   */
  getCurrentToken() {
    return this.currentToken;
  }

  /**
   * Handle token refresh
   */
  async handleTokenRefresh() {
    try {
      if (!this.messaging) {
        console.warn("Messaging instance not available for token refresh");
        return;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

      if (!vapidKey) {
        return;
      }

      const newToken = await getToken(this.messaging, { vapidKey });

      if (newToken && newToken !== this.currentToken) {
        console.log("🔄 FCM Token refreshed:", newToken);
        this.currentToken = newToken;
        await this.registerDevice(newToken);
      }
    } catch (error) {
      console.error("❌ Error refreshing token:", error);
    }
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized() {
    return this.isInitialized;
  }

  /**
   * Check if service is ready to request permissions
   */
  isReadyForPermissionRequest() {
    return this.messaging !== null && Notification.permission === "default";
  }

  /**
   * Try to get FCM token without notification permission
   * This might work in some browsers or return null
   */
  async getFCMTokenWithoutPermission() {
    try {
      if (!this.messaging) {
        return null;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn("VAPID key not configured");
        return null;
      }

      // Try to get token even without permission
      const token = await getToken(this.messaging, { vapidKey });
      return token;
    } catch (error) {
      console.log("Could not get FCM token without permission:", error.message);
      return null;
    }
  }

  /**
   * Register device with minimal information (no FCM token)
   * For analytics and tracking purposes
   */
  async registerDeviceMinimal() {
    try {
      const response = await apiClient.post("/devices/register", {
        device_type: "web",
      });

      // const response = await base44.entities.DevicesRegister.create({
      //   device_type: "web",
      // });

      console.log("📱 Device registered with minimal info:", response);
      return response;
    } catch (error) {
      console.error("❌ Failed to register device with minimal info:", error);
      return null;
    }
  }

  /**
   * Get current permission status
   */
  getPermissionStatus() {
    if (!("Notification" in window)) {
      return "not_supported";
    }
    return Notification.permission;
  }
}

// Create singleton instance
const simplePushService = new SimplePushService();

export default simplePushService;
