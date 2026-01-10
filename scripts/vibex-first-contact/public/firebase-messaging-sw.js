/**
 * Firebase Messaging Service Worker (v9 Modular Syntax)
 * Handles background push notifications and notification clicks.
 */

// Import functions from the Firebase SDK
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);
// A flag to determine if we're in a development environment
const IS_DEBUG = self.location.hostname === "localhost";

// --- IMPORTANT: Replace with your project's Firebase configuration ---
//firebase.initializeApp({
//  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//  appId: import.meta.env.VITE_FIREBASE_APP_ID,
//});

firebase.initializeApp({
  apiKey: 'AIzaSyDx2qLhf6iFNZ2a5DMJHAmah9UoHdz6NiM',
  authDomain: 'fanstory-46e5d.firebaseapp.com',
  projectId: 'fanstory-46e5d',
  storageBucket: 'fanstory-46e5d.firebasestorage.app',
  messagingSenderId: '396136388255',
  appId: '1:396136388255:web:475e20035bd26278e3f4aa',
});
const messaging = firebase.messaging();

/**
 * Handle background messages when the app is not in the foreground.
 */
messaging.onBackgroundMessage((payload) => {
  if (IS_DEBUG) {
    console.log("📱 Background message received:", payload);
  }

  const { notification } = payload;
  if (!notification || !notification.title) {
    if (IS_DEBUG) console.error("🔥 Notification data is missing 'title'.");
    return;
  }

  const notificationOptions = {
    body: notification.body,
    icon: notification.icon || "/icon-192x192.png",
    tag: "vibex-notification",
    data: notification,
    requireInteraction: true,
  };

  return self.registration.showNotification(notification.title, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  if (IS_DEBUG) {
    console.log("🖱️ Notification clicked:", event);
    console.log("📦 Notification data:", event.notification.data);
  }

  // Close the notification once it's clicked
  event.notification.close();

  // Determine the URL to navigate to
  const targetUrl = resolveTargetUrl(event.notification.data);
  if (IS_DEBUG) {
    console.log("🎯 Target URL (absolute):", targetUrl);
  }

  // Logic to focus an existing window or open a new one
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 1. Priority: Find a client that is already at the target URL
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            if (IS_DEBUG)
              console.log("✅ Found client at target URL, focusing it.");
            return client.focus();
          }
        }

        // 2. Fallback: Find any other client for this origin and navigate it
        for (const client of clientList) {
          if (
            client.url.startsWith(self.location.origin) &&
            "focus" in client
          ) {
            if (IS_DEBUG)
              console.log("✅ Focusing existing window and navigating.");
            return client.focus().then(() => client.navigate(targetUrl));
          }
        }

        // 3. Last resort: Open a new window
        if (clients.openWindow) {
          if (IS_DEBUG)
            console.log("🆕 No existing clients found, opening new window.");
          return clients.openWindow(targetUrl);
        }
      })
      .catch((error) => {
        if (IS_DEBUG)
          console.error("❌ Error handling notification click:", error);
      })
  );
});

function toAbsoluteUrl(url) {
  if (!url) return self.location.origin;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return self.location.origin + (url.startsWith("/") ? url : "/" + url);
}

function resolveTargetUrl(data) {
  let relativeUrl = "/";

  if (data) {
    if (data.url) relativeUrl = data.url;
    else if (data.click_url) relativeUrl = data.click_url;
    else if (data.click_action) relativeUrl = data.click_action;
  }

  return toAbsoluteUrl(relativeUrl);
}
