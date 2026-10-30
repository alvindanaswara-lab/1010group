import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Keep ID token in memory (never in localStorage)
let currentIdToken: string | null = null;

export async function signInWithGooglePopup(): Promise<{
  firebaseUser: FirebaseUser;
  idToken: string;
}> {
  const credential = await signInWithPopup(auth, googleAuthProvider);
  const token = await credential.user.getIdToken();
  currentIdToken = token;
  return {
    firebaseUser: credential.user,
    idToken: token,
  };
}

export async function getFreshIdToken(): Promise<string | null> {
  if (auth.currentUser) {
    currentIdToken = await auth.currentUser.getIdToken();
    return currentIdToken;
  }
  return currentIdToken;
}

export function clearMemoryIdToken(): void {
  currentIdToken = null;
}
