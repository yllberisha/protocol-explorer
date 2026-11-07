import { cp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-pages.mjs'], { stdio: 'inherit' });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
execFileSync(process.execPath, ['scripts/check.mjs', 'dist'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-pages.mjs', 'dist'], { stdio: 'inherit' });
console.log('Build complete: dist/ is ready for static hosting.');
