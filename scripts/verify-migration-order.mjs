import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const migrationsDirectory = path.resolve(process.cwd(), 'supabase');
const files = (await readdir(migrationsDirectory))
  .filter((file) => /^\d{3}_.+\.sql$/.test(file))
  .sort();

const migrationsByNumber = new Map();

for (const file of files) {
  const number = Number(file.slice(0, 3));
  const matchingFiles = migrationsByNumber.get(number) ?? [];
  matchingFiles.push(file);
  migrationsByNumber.set(number, matchingFiles);
}

const duplicates = [...migrationsByNumber.entries()]
  .filter(([, matchingFiles]) => matchingFiles.length > 1)
  .map(([number, matchingFiles]) => `${String(number).padStart(3, '0')}: ${matchingFiles.join(', ')}`);

const highestNumber = Math.max(...migrationsByNumber.keys());
const missing = Array.from({ length: highestNumber }, (_, index) => index + 1)
  .filter((number) => !migrationsByNumber.has(number))
  .map((number) => String(number).padStart(3, '0'));

if (duplicates.length || missing.length) {
  if (duplicates.length) console.error(`Duplicate migration numbers:\n${duplicates.join('\n')}`);
  if (missing.length) console.error(`Missing migration numbers: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`OK — ${files.length} migrations numbered continuously from 001 to ${String(highestNumber).padStart(3, '0')}`);
