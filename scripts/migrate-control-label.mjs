#!/usr/bin/env node
// One-shot: migra <span class="control-label">X:</span> + <div class="control-group">
// hacia <div class="control-group" data-prefix="X"> (label inline via CSS ::before).
// Idempotente: re-correrlo no rompe nada.

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { glob } from 'node:fs/promises';

const files = [];
for await (const f of glob('src/herramientas/vanilla/tools/*/index.html')) {
  files.push(f);
}

// Captura: pre-attrs, post-attrs, ws1, label, ws2. Acepta cualquier orden de atributos.
const RE = /<div([^>]*?)\sclass="control-group"([^>]*?)>(\s+)<span class="control-label">([^<]+):<\/span>(\s+)/g;

let totalChanges = 0;
const filesChanged = [];

for (const file of files) {
  const before = readFileSync(file, 'utf-8');
  let count = 0;
  const after = before.replace(RE, (m, pre, post, ws1, label, ws2) => {
    // Si ya tenia data-prefix (idempotencia), no tocar
    if (pre.includes('data-prefix=') || post.includes('data-prefix=')) return m;
    count++;
    return `<div${pre} class="control-group" data-prefix="${label}"${post}>${ws2}`;
  });
  if (after !== before) {
    writeFileSync(file, after);
    totalChanges += count;
    filesChanged.push(`${file} (${count})`);
  }
}

console.log(`Files changed: ${filesChanged.length}`);
console.log(`Total replacements: ${totalChanges}`);
filesChanged.forEach(f => console.log('  ' + f));
