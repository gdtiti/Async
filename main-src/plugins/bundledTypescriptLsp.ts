import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ScopedLspServerConfig } from './pluginLspTypes.js';

/**
 * 解析随应用打包的 typescript-language-server CLI（dependencies 中的包）。
 * 主进程打 bundle 为 `electron/main.bundle.cjs` 时，与 appWindow 一样依赖运行时的 `__dirname`（即 `electron/`）。
 */
export function resolveBundledTypescriptLanguageServerCli(appPath: string): string | null {
	const candidates = [
		path.join(appPath, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs'),
		path.join(path.dirname(appPath), 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs'),
		path.join(process.cwd(), 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs'),
		typeof __dirname !== 'undefined'
			? path.join(__dirname, '..', 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs')
			: '',
	];
	for (const p of candidates) {
		if (!p) continue;
		try {
			const abs = path.resolve(p);
			if (fs.existsSync(abs)) return abs;
		} catch {
			/* ignore */
		}
	}
	let d = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
	for (let i = 0; i < 12; i++) {
		const tryP = path.join(d, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs');
		if (fs.existsSync(tryP)) return path.resolve(tryP);
		const parent = path.dirname(d);
		if (parent === d) break;
		d = parent;
	}
	return null;
}

export function getBuiltinTypescriptScopedServers(appPath: string): Record<string, ScopedLspServerConfig> {
	const cli = resolveBundledTypescriptLanguageServerCli(appPath);
	if (!cli) return {};

	const nodeCmd = process.platform === 'win32' ? 'node.exe' : 'node';
	return {
		'plugin:async-builtin:typescript': {
			command: nodeCmd,
			args: [cli, '--stdio'],
			extensionToLanguage: {
				'.ts': 'typescript',
				'.tsx': 'typescriptreact',
				'.mts': 'typescript',
				'.cts': 'typescript',
				'.js': 'javascript',
				'.jsx': 'javascriptreact',
				'.mjs': 'javascript',
				'.cjs': 'javascript',
			},
			transport: 'stdio',
			scope: 'builtin',
			source: 'async-builtin',
		},
	};
}
