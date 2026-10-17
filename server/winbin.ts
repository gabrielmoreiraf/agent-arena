/**
 * No Windows o npm instala as CLIs como shims `.cmd`, que o Node não executa sem shell (ENOENT).
 * Aqui o shim é lido e trocado por `node <script.js>`, sem passar por shell (os argumentos, como prompts, não são reinterpretados).
 */
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, isAbsolute, join, resolve } from 'node:path';

const cache = new Map<string, { bin: string; pre: string[] } | null>();

function resolveShim(bin: string) {
  if (cache.has(bin)) return cache.get(bin)!;
  let found: { bin: string; pre: string[] } | null = null;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    const cmd = join(dir, `${bin}.cmd`);
    if (!dir || !existsSync(cmd)) continue;
    const text = readFileSync(cmd, 'utf8');
    const m = text.match(/"%dp0%\\+([^"]+\.js)"/i) ?? text.match(/"%~dp0\\+([^"]+\.js)"/i);
    if (m) {
      const script = resolve(dir, m[1]);
      if (existsSync(script)) found = { bin: process.execPath, pre: [script] };
    }
    break;
  }
  cache.set(bin, found);
  return found;
}

/** devolve o comando e os argumentos prontos para execFile/spawn (iguais aos de entrada fora do Windows ou quando já é um caminho) */
export function winCmd(bin: string, args: string[]): { bin: string; args: string[] } {
  if (process.platform !== 'win32' || isAbsolute(bin) || /[\\/]/.test(bin)) return { bin, args };
  const s = resolveShim(bin);
  return s ? { bin: s.bin, args: [...s.pre, ...args] } : { bin, args };
}
