#!/usr/bin/env node
// Sets every Cloud Functions secret in Google Secret Manager, prompting for each value.
// Values are typed with hidden input and piped straight to the Firebase CLI; nothing is
// printed or stored. Optional integrations you skip are set to "disabled".
//   pnpm exec node scripts/set-secrets.mjs --project <id>
//   pnpm exec node scripts/set-secrets.mjs --project <id> --only SMTP_PASS,TEAM_EMAILS
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import readline from 'node:readline';

const SECRETS = [
  { name: 'SMTP_HOST', help: 'SMTP server host name, e.g. smtp.gmail.com' },
  { name: 'SMTP_PORT', help: 'SMTP port: 465 (SSL) or 587 (STARTTLS)' },
  { name: 'SMTP_USER', help: 'SMTP user name (usually the sending email address)' },
  { name: 'SMTP_PASS', help: 'SMTP password or app password' },
  { name: 'MAIL_FROM', help: 'Sender shown on emails, e.g. Books <orders@your-domain>' },
  { name: 'TEAM_EMAILS', help: 'Comma-separated addresses that receive new-order emails' },
  { name: 'HASH_SALT', help: 'Leave empty to generate a random value (recommended)', generate: true },
  { name: 'TELEGRAM_BOT_TOKEN', help: 'Optional. Leave empty to disable Telegram alerts', optional: true },
  { name: 'TELEGRAM_CHAT_ID', help: 'Optional. Leave empty to disable Telegram alerts', optional: true },
  { name: 'WA_TOKEN', help: 'Optional. WhatsApp Cloud API permanent token. Leave empty to disable', optional: true },
  { name: 'WA_PHONE_NUMBER_ID', help: 'Optional. WhatsApp Cloud API phone number ID. Leave empty to disable', optional: true },
];

const args = process.argv.slice(2);
const project = args[args.indexOf('--project') + 1];
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
if (!args.includes('--project') || !project) {
  console.error('Usage: set-secrets.mjs --project <firebase-project-id> [--only NAME,NAME]');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput.bind(rl);
    let prompted = false;
    rl._writeToOutput = (s) => {
      if (!prompted) {
        write(s);
        prompted = true;
      } else if (s.includes('\n')) write('\n');
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function setSecret(name, value) {
  return new Promise((resolve, reject) => {
    const p = spawn('pnpm', ['exec', 'firebase', 'functions:secrets:set', name, '--project', project, '--data-file', '-', '--force'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    p.stdin.end(value);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${name}: firebase exited with ${code}`))));
  });
}

for (const s of SECRETS) {
  if (only && !only.includes(s.name)) continue;
  console.log(`\n${s.name} — ${s.help}`);
  let value = await askHidden(`${s.name}: `);
  if (!value && s.generate) value = randomBytes(32).toString('hex');
  if (!value && s.optional) value = 'disabled';
  if (!value) {
    console.error(`${s.name} is required.`);
    process.exit(1);
  }
  await setSecret(s.name, value);
  console.log(`${s.name}: saved.`);
}
console.log('\nAll secrets set. Deploy functions again so they pick up the new versions.');
