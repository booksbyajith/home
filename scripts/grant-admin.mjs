#!/usr/bin/env node
// Grants (or revokes) the admin custom claim for a Google account that has signed in once at /admin/.
//   node scripts/grant-admin.mjs <email> --project <id> [--revoke]
//   node scripts/grant-admin.mjs <email> --emulator [--revoke]
//   add --staff for the packing-staff role (/staff/) instead of admin
// The email is only used to look the user up. Nothing is written to the repository.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function setAdmin(auth, email, admin, claim = 'admin') {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (e) {
    if (e?.code === 'auth/user-not-found') {
      const err = new Error(
        `User not found. Ask this person to sign in once at /${claim === 'staff' ? 'staff' : 'admin'}/, then run this again.`,
      );
      err.code = 'not-found';
      throw err;
    }
    throw e;
  }
  const claims = { ...(user.customClaims ?? {}) };
  if (admin) claims[claim] = true;
  else delete claims[claim];
  await auth.setCustomUserClaims(user.uid, claims);
  await auth.revokeRefreshTokens(user.uid);
  return user.uid;
}

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--project');
  const emulator = args.includes('--emulator');
  const revoke = args.includes('--revoke');
  // --staff: the packing-staff role (the /staff/ page) instead of full admin.
  const claim = args.includes('--staff') ? 'staff' : 'admin';
  const pIdx = args.indexOf('--project');
  const projectId = emulator ? 'demo-ajith' : pIdx >= 0 ? args[pIdx + 1] : undefined;
  if (!email || !projectId) {
    console.error('Usage: grant-admin.mjs <email> (--project <id> | --emulator) [--revoke]');
    process.exit(1);
  }
  if (emulator) process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  const { initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const uid = await setAdmin(getAuth(initializeApp({ projectId })), email, !revoke, claim);
  console.log(
    `${revoke ? 'Revoked' : 'Granted'} ${claim} for uid ${uid}. They should press "Check again" or sign in again.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
