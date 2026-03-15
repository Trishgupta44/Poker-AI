import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, 'poker-ai'));
await import('./poker-ai/node_modules/vite/bin/vite.js');
