import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Staff } from '../types';

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function fetchStaffProfile(uid: string): Promise<Staff | null> {
  const snap = await getDoc(doc(db, 'staff', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as Staff;
}
