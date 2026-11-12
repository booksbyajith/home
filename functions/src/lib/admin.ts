import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { STORAGE_BUCKET } from '../options.js';

const app = getApps()[0] ?? initializeApp();

export const db = () => getFirestore(app);
export const auth = () => getAuth(app);
export const bucket = () => {
  const name = STORAGE_BUCKET.value();
  return name ? getStorage(app).bucket(name) : getStorage(app).bucket();
};
export { FieldValue, Timestamp };
