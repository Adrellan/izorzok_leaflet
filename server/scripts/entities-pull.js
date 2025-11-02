#!/usr/bin/env node
/*
 Simple entities generator using DATABASE_URL.
 Usage: node scripts/entities-pull.js
 Requires dev dep: typeorm-model-generator
*/
require('dotenv').config();
const { spawnSync } = require('child_process');

function fail(msg) {
  console.error(`[entities-pull] ${msg}`);
  process.exit(1);
}

const urlStr = process.env.DATABASE_URL;
if (!urlStr) fail('DATABASE_URL is not set in environment/.env');

let url;
try {
  url = new URL(urlStr);
} catch (e) {
  fail(`Invalid DATABASE_URL: ${e.message}`);
}

if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
  fail(`Unsupported protocol: ${url.protocol}. Expected postgres://`);
}

const host = url.hostname || 'localhost';
const port = url.port || '5432';
const database = (url.pathname || '').replace(/^\//, '');
const username = decodeURIComponent(url.username || '');
const password = decodeURIComponent(url.password || '');
const schema = process.env.DB_SCHEMA || 'public';
const outDir = process.env.ENTITIES_OUT || 'src/entities';

const qp = url.searchParams;
const sslMode = (qp.get('sslmode') || '').toLowerCase();
const ssl = (qp.get('ssl') || '').toLowerCase();
const useSSL = ssl === 'true' || ssl === '1' || sslMode === 'require' || process.env.DB_SSL === 'true';

const args = [
  '-h', host,
  '-d', database,
  '-u', username,
  '-x', password,
  '-p', port,
  '-e', 'postgres',
  '-o', outDir,
  '-s', schema,
];
if (useSSL) args.push('--ssl');

console.log('[entities-pull] Running typeorm-model-generator with:', args.join(' '));
const result = spawnSync('npx', ['typeorm-model-generator', ...args], { stdio: 'inherit', shell: true });
if (result.error) fail(result.error.message);
process.exit(result.status || 0);
