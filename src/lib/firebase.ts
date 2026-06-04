import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';

const env = (import.meta as any).env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'dummy_api_key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'dummy_project.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'dummy_project',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'dummy_project.appspot.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: env.VITE_FIREBASE_APP_ID || '1:1234567890:web:1234567890abcdef'
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Only initialize auth if we have a valid-looking API key, otherwise mock it.
const hasValidConfig = firebaseConfig.apiKey !== 'dummy_api_key';

const auth = hasValidConfig ? getAuth(app) : null;
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.addScope('https://www.googleapis.com/auth/presentations.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: Partial<User>; accessToken: string } | null> => {
  if (!auth) {
    console.warn("Using mock sign-in. Set VITE_FIREBASE_API_KEY to enable real Google authentication.");
    // Return dummy data if Firebase is not configured properly
    cachedAccessToken = "dummy_access_token_" + Date.now();
    return { 
      user: { uid: "dummy_user", displayName: "Mock User", email: "mock@example.com" }, 
      accessToken: cachedAccessToken 
    };
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};
