/**
 * Firebase Configuration
 * For Push Notifications and Authentication
 */

import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import { getAuth } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Lazy initialize Firebase Cloud Messaging (only in browser context)
let messagingInstance = null;

/**
 * Get Firebase Messaging instance
 * @returns {Messaging|null} Firebase Messaging instance or null if not supported
 */
export const getMessagingInstance = () => {
  if (messagingInstance) {
    return messagingInstance;
  }
  
  // Check if running in browser context (not service worker)
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    } catch (error) {
      console.error('Failed to initialize Firebase Messaging:', error);
      return null;
    }
  }
  
  console.warn('Firebase Messaging not available in this context');
  return null;
};

// Export messaging getter for backward compatibility
export const messaging = getMessagingInstance();

// Initialize Firebase Authentication
export const auth = getAuth(app);

export default app;
