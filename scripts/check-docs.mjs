import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

async function collectDocs(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'archive') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectDocs(path)));
    else if (entry.name.endsWith('.md')) files.push(path);
  }
  return files;
}

const files = [
  ...['AGENTS.md', 'README.md', 'START_HERE.md', 'ARCHITECTURE.md'].map((name) => resolve(root, name)),
  ...(await collectDocs(resolve(root, 'docs'))),
];
let checked = 0;
const failures = [];
for (const file of files) {
  // This project's inline Markdown links only; fences, external URLs and anchors are excluded.
  const source = (await readFile(file, 'utf8')).replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const [, link] of source.matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(link)) continue;
    const target = decodeURIComponent(link.split(/[?#]/)[0]);
    if (!target) continue;
    checked++;
    try {
      await access(resolve(dirname(file), target));
    } catch {
      failures.push(`${relative(root, file)} -> ${link}`);
    }
  }
}

if (failures.length) {
  console.error(`Missing local documentation targets:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} local file links across ${files.length} active documents.`);
}
