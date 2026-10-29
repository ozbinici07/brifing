import { cp, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(path.join(output, 'config'), { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(output, 'index.html'));
for (const folder of ['js', 'css', 'assets', 'vendor']) {
  await cp(path.join(root, folder), path.join(output, folder), { recursive: true });
}
await copyFile(path.join(root, 'config/firebase-config.js'), path.join(output, 'config/firebase-config.js'));
console.log('Firebase Hosting dosyalari dist/ klasorune hazirlandi.');
