/**
 * 必须在任何 `monaco-editor` 初始化之前执行。
 * 所有 worker label 共用 editor worker，避免加载 ts/json/css/html 等语言专用 worker（预览模式不需要）。
 */
function installMonacoEnvironment(): void {
	const globalObj = typeof self !== 'undefined' ? self : globalThis;

	(globalObj as unknown as { MonacoEnvironment?: { getWorker: typeof getWorker } }).MonacoEnvironment = {
		getWorker,
	};
}

function getWorker(_moduleId: string, _label: string): Worker {
	return new Worker(new URL('../node_modules/monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), {
		type: 'module',
	});
}

installMonacoEnvironment();
