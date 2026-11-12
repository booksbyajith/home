import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes, deleteObject, listAll } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ajith-rules',
    storage: {
      rules: readFileSync(resolve(import.meta.dirname, '../../firebase/storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => env?.cleanup());

const PATHS = ['slips/AJ-2611-7K3Q/slip.jpg', 'other/file.txt'];
const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const p of PATHS) await uploadBytes(ref(ctx.storage(), p), bytes);
  });
});

const storage = (who: string) => {
  if (who === 'anon') return env.unauthenticatedContext().storage();
  if (who === 'user') return env.authenticatedContext('user1').storage();
  return env.authenticatedContext('admin1', { admin: true }).storage();
};

describe('storage is closed to all clients', () => {
  for (const who of ['anon', 'user', 'admin'])
    for (const p of PATHS) {
      it(`${who} cannot read ${p}`, async () => {
        await assertFails(getBytes(ref(storage(who), p)));
      });
      it(`${who} cannot write or delete ${p}`, async () => {
        await assertFails(uploadBytes(ref(storage(who), p), bytes));
        await assertFails(deleteObject(ref(storage(who), p)));
      });
    }
  it('nobody can list slips', async () => {
    await assertFails(listAll(ref(storage('admin'), 'slips')));
  });
});
