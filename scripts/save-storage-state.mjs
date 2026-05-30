import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const statePath = process.env.STORAGE_STATE_PATH ?? 'playwright/.auth/storage-state.json';
const chromeUserDataDir = process.env.CHROME_USER_DATA_DIR;
const zustandKeys = ['resume-storage', 'resume-ui'];

function upsertZustandState(storageState, origin, values) {
  if (!storageState.origins) storageState.origins = [];

  let originEntry = storageState.origins.find((entry) => entry.origin === origin);
  if (!originEntry) {
    originEntry = { origin, localStorage: [] };
    storageState.origins.push(originEntry);
  }

  const map = new Map((originEntry.localStorage ?? []).map((item) => [item.name, item.value]));
  for (const [name, value] of Object.entries(values)) {
    map.set(name, value);
  }

  originEntry.localStorage = Array.from(map, ([name, value]) => ({ name, value }));
}

async function readZustandValues(page) {
  return page.evaluate((keys) => {
    const values = {};
    for (const key of keys) {
      const value = window.localStorage.getItem(key);
      if (value !== null) values[key] = value;
    }
    return values;
  }, zustandKeys);
}

async function captureAndSaveState(context, page) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  let values = await readZustandValues(page);
  if (Object.keys(values).length === 0) {
    console.log(
      `No persisted Zustand keys found for ${appUrl}. If needed, interact with the page/login, then press Enter to retry.`
    );
    await waitForEnter();
    values = await readZustandValues(page);
  }

  const state = await context.storageState();
  upsertZustandState(state, new URL(appUrl).origin, values);

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

  const found = Object.keys(values);
  if (found.length === 0) {
    console.log(
      `Saved storage state, but did not find ${zustandKeys.join(', ')} on ${new URL(appUrl).origin}.`
    );
  } else {
    console.log(`Captured Zustand keys: ${found.join(', ')}`);
  }
}

async function waitForEnter() {
  const rl = readline.createInterface({ input, output });

  try {
    await rl.question('Complete login in the opened Chrome window, then press Enter to save storage state...\\n');
  } finally {
    rl.close();
  }
}

async function saveWithPersistentContext() {
  const context = await chromium.launchPersistentContext(chromeUserDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
  });

  try {
    const existingPage = context.pages()[0];
    const page = existingPage ?? (await context.newPage());
    await captureAndSaveState(context, page);
  } finally {
    await context.close();
  }
}

async function saveWithFreshContext() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
  });

  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await captureAndSaveState(context, page);
  } finally {
    await context.close();
    await browser.close();
  }
}

(async () => {
  try {
    if (chromeUserDataDir) {
      console.log(`Using Chrome user data dir: ${chromeUserDataDir}`);
      await saveWithPersistentContext();
    } else {
      console.log('CHROME_USER_DATA_DIR not set. Launching a fresh Chrome context.');
      await saveWithFreshContext();
    }

    console.log(`Storage state saved to ${statePath}`);
  } catch (error) {
    console.error('Failed to save storage state.');
    console.error(error);
    process.exitCode = 1;
  }
})();
