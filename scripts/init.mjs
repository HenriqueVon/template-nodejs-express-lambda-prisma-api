#!/usr/bin/env node
// Turns a fresh copy of this template into a new project. Run it once, right after copying the folder:
//
//   npm run init -- --name orders-api
//   npm run init -- --name orders-api --title "Orders API" --remove-example
//
// It has no dependencies, so it runs before `npm install`. It deletes itself when it finishes.

import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_NAME = 'my-service-api';
const DEFAULT_TITLE = 'My Service API';
const DEFAULT_DATABASE = 'my_service_api';

// serverless.yml builds role and bucket names from the service name; AWS limits them to 64 and 63
// characters, so a name above 38 characters fails on the first deploy.
const MAX_NAME_LENGTH = 38;
const NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.serverless', '.build', '.esbuild', 'dist', 'coverage']);
const SELF = join(ROOT, 'scripts', 'init.mjs');
// Files and folders that only make sense in the template repository (its guide, changelog, security policy,
// GitHub Pages and CodeQL setup). They are never transformed and are deleted at the end.
const TEMPLATE_ONLY = [
  'TEMPLATE.md',
  'CHANGELOG.md',
  'SECURITY.md',
  '.github/pages',
  '.github/workflows/docs.yml',
  '.github/workflows/codeql.yml',
].map((path) => join(ROOT, ...path.split('/')));

function usage() {
  return [
    'Usage: npm run init -- --name <service-name> [--title "<Service Title>"] [--remove-example]',
    '',
    '  --name <name>      kebab-case service name, e.g. orders-api (max ' + MAX_NAME_LENGTH + ' characters).',
    '                     Used for the package, the Serverless service, the AWS role and bucket, and the docs.',
    '  --title "<title>"  Human title used in the OpenAPI document. Default: derived from the name.',
    '  --remove-example   Delete the reference "example" module, its migration and every registration of it.',
    '',
  ].join('\n');
}

function fail(message) {
  console.error(`\nError: ${message}\n`);
  console.error(usage());
  process.exit(1);
}

function parseArguments(argv) {
  const options = { name: undefined, title: undefined, removeExample: false };

  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];

    if (argument === '--help' || argument === '-h') {
      console.info(usage());
      process.exit(0);
    } else if (argument === '--name') {
      options.name = argv[++i];
    } else if (argument === '--title') {
      options.title = argv[++i];
    } else if (argument === '--remove-example') {
      options.removeExample = true;
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function titleFromName(name) {
  return name
    .split('-')
    .map((word) => (word === 'api' ? 'API' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (TEMPLATE_ONLY.includes(path)) continue;

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) yield* walk(path);
    } else if (entry.isFile() && path !== SELF) {
      yield path;
    }
  }
}

// Removes the lines between `@template:<name>:start` and `@template:<name>:end`, markers included.
// Files with an unbalanced pair are reported and left untouched.
function removeBlocks(text, name, file) {
  const start = `@template:${name}:start`;
  const end = `@template:${name}:end`;
  const output = [];
  let inside = false;

  for (const line of text.split('\n')) {
    if (line.includes(start)) {
      inside = true;
    } else if (line.includes(end)) {
      inside = false;
    } else if (!inside) {
      output.push(line);
    }
  }

  if (inside) {
    console.warn(`Warning: unbalanced "${start}" marker in ${relative(ROOT, file)}; file left unchanged.`);
    return text;
  }

  return output.join('\n');
}

// Removes only the marker lines of `@template:<name>`, keeping what is between them
function removeMarkerLines(text, name) {
  return text
    .split('\n')
    .filter((line) => !line.includes(`@template:${name}:start`) && !line.includes(`@template:${name}:end`))
    .join('\n');
}

function transformFile(file, options) {
  const buffer = readFileSync(file);
  if (buffer.includes(0)) return; // binary

  const original = buffer.toString('utf8');
  let text = original;

  text = text.replaceAll(DEFAULT_TITLE, options.title);
  text = text.replaceAll(DEFAULT_NAME, options.name);
  text = text.replaceAll(DEFAULT_DATABASE, options.name.replaceAll('-', '_'));

  // Template-only blocks (usage notes of the template itself) never reach a project
  text = removeBlocks(text, 'only', file);

  text = options.removeExample
    ? removeBlocks(text, 'example', file)
    : removeMarkerLines(text, 'example');

  if (text !== original) writeFileSync(file, text);
}

function removeExampleFiles() {
  rmSync(join(ROOT, 'src', 'modules', 'example'), { recursive: true, force: true });

  const migrations = join(ROOT, 'src', 'services', 'database', 'prisma', 'migrations');
  for (const entry of readdirSync(migrations, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith('_create_table_examples')) {
      rmSync(join(migrations, entry.name), { recursive: true, force: true });
    }
  }
}

function createEnvFile() {
  const envFile = join(ROOT, '.env');
  if (existsSync(envFile)) return false;

  const apiKey = randomBytes(32).toString('hex');
  const example = readFileSync(join(ROOT, '.env.example'), 'utf8');
  writeFileSync(envFile, example.replace(/^API_KEY=.*$/m, `API_KEY=${apiKey}`));
  return true;
}

function removeInitFromPackageJson() {
  const file = join(ROOT, 'package.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  delete manifest.scripts.init;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const options = parseArguments(process.argv.slice(2));

  if (!options.name) fail('--name is required.');
  if (!NAME_PATTERN.test(options.name)) fail(`"${options.name}" is not a kebab-case name (lowercase letters, digits and single hyphens).`);
  if (options.name.length > MAX_NAME_LENGTH) fail(`"${options.name}" has more than ${MAX_NAME_LENGTH} characters.`);
  options.title ??= titleFromName(options.name);

  const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  if (manifest.name !== DEFAULT_NAME) {
    fail(`This project was already initialized (package name is "${manifest.name}").`);
  }

  if (options.removeExample) removeExampleFiles();

  for (const file of walk(ROOT)) {
    transformFile(file, options);
  }

  const envCreated = createEnvFile();

  removeInitFromPackageJson();
  for (const path of TEMPLATE_ONLY) rmSync(path, { recursive: true, force: true });
  rmSync(SELF, { force: true });
  if (readdirSync(join(ROOT, 'scripts')).length === 0) rmSync(join(ROOT, 'scripts'), { recursive: true, force: true });

  console.info(`\nProject "${options.name}" (${options.title}) is ready.`);
  console.info(options.removeExample ? 'The example module was removed.' : 'The example module was kept: delete it when you no longer need it as a reference.');
  console.info(envCreated ? '.env was created from .env.example with a generated API_KEY. Its database URLs match docker-compose.yml.' : '.env already existed and was not touched.');
  console.info([
    '',
    'Next steps:',
    '  1. npm install',
    '  2. docker compose up -d         (local PostgreSQL; or point DATABASE_URL and SHADOW_DATABASE_URL in .env to yours)',
    '  3. npm run prisma:generate',
    '  4. npm run prisma:migrate:dev   (applies the migrations to your local database)',
    '  5. npm run dev                  (http://localhost:3000/health, docs at /docs)',
    '  6. npm run lint && npm run check:ts && npm run test:run',
    '',
    'Before the first deploy: set the AWS_ROLE_ARN and AWS_REGION variables, and the DATABASE_URL,',
    'DIRECT_DATABASE_URL and API_KEY secrets, in the dev and prd GitHub environments.',
    '',
  ].join('\n'));
}

main();
