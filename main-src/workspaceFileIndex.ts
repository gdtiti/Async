import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import chokidar from 'chokidar';
import {
	indexWorkspaceSourceFile,
	removeWorkspaceSymbolsForRel,
	removeWorkspaceSymbolsUnderPrefix,
	clearWorkspaceSymbolIndexForRoot,
} from './workspaceSymbolIndex.js';
import { clearWorkspaceSemanticIndexForRoot } from './workspaceSemanticIndex.js';
import { getWorkspaceFilesIndexPath } from './workspaceIndexPaths.js';

/** 遍历时跳过的目录名（小写比较） */
const SKIP_DIR_NAMES = new Set([
	'.git',
	'node_modules',
	'.venv',
	'venv',
	'dist',
	'build',
	'out',
	'coverage',
	'__pycache__',
	'.idea',
	'.vs',
	'target',
	'.next',
	'.nuxt',
	'Pods',
	'.gradle',
	'DerivedData',
	'appdata',
	'application data',
	'cookies',
	'local settings',
]);

/** 单工作区最大文件条数（提高上限以适配大型 monorepo） */
export const MAX_WORKSPACE_FILES = 50_000;

type FileIndexBucket = {
	rootNorm: string;
	relPathSet: Set<string>;
	/** 整库扫描后的有序快照；watcher 变更后置空，搜索时再按需重建 */
	sortedPathsSnapshot: string[] | null;
	/** basename 前两字符（小写）→ 路径；与 relPathSet 同步，在快照失效时清空 */
	basenameTwoCharBuckets: Map<string, Set<string>> | null;
	watcher: chokidar.FSWatcher | null;
	inFlightRefresh: Promise<string[]> | null;
	persistTimer: ReturnType<typeof setTimeout> | null;
	refCount: number;
};

const buckets = new Map<string, FileIndexBucket>();

/** 首次全量扫描完成后通知渲染进程（用于 @ 菜单重跑最后一次查询） */
let notifyFileIndexReady: ((rootNorm: string) => void) | null = null;

export function setWorkspaceFileIndexReadyBroadcaster(cb: ((rootNorm: string) => void) | null): void {
	notifyFileIndexReady = cb;
}

function getBucket(rootNorm: string): FileIndexBucket {
	let b = buckets.get(rootNorm);
	if (!b) {
		b = {
			rootNorm,
			relPathSet: new Set(),
			sortedPathsSnapshot: null,
			basenameTwoCharBuckets: null,
			watcher: null,
			inFlightRefresh: null,
			persistTimer: null,
			refCount: 0,
		};
		buckets.set(rootNorm, b);
	}
	return b;
}

/** 窗口打开文件夹时增加引用；同一 root 多窗共享一套索引与 watcher。 */
export function acquireWorkspaceFileIndexRef(rootAbs: string): void {
	const rootNorm = path.normalize(path.resolve(rootAbs));
	const b = getBucket(rootNorm);
	b.refCount++;
}

/** 关闭文件夹或销毁窗口时减少引用；到 0 时停止监听并清理该 root 的内存索引。 */
export function releaseWorkspaceFileIndexRef(rootAbs: string): void {
	const rootNorm = path.normalize(path.resolve(rootAbs));
	const b = buckets.get(rootNorm);
	if (!b) {
		return;
	}
	b.refCount = Math.max(0, b.refCount - 1);
	if (b.refCount > 0) {
		return;
	}
	destroyBucket(b);
	buckets.delete(rootNorm);
	clearWorkspaceSymbolIndexForRoot(rootNorm);
	clearWorkspaceSemanticIndexForRoot(rootNorm);
}

function destroyBucket(b: FileIndexBucket): void {
	if (b.watcher) {
		void b.watcher.close();
		b.watcher = null;
	}
	if (b.persistTimer) {
		clearTimeout(b.persistTimer);
		b.persistTimer = null;
	}
	b.relPathSet = new Set();
	b.sortedPathsSnapshot = null;
	b.basenameTwoCharBuckets = null;
	b.inFlightRefresh = null;
}

function invalidateSortedPathsSnapshot(b: FileIndexBucket): void {
	b.sortedPathsSnapshot = null;
	b.basenameTwoCharBuckets = null;
}

export function getWorkspaceFileIndexLiveStatsForRoot(rootAbs: string | null): { root: string | null; fileCount: number } {
	if (!rootAbs) {
		return { root: null, fileCount: 0 };
	}
	const rootNorm = path.normalize(path.resolve(rootAbs));
	const b = buckets.get(rootNorm);
	if (!b) {
		return { root: rootNorm, fileCount: 0 };
	}
	return { root: rootNorm, fileCount: b.relPathSet.size };
}

/** @deprecated 使用 getWorkspaceFileIndexLiveStatsForRoot；无参数时返回空统计 */
export function getWorkspaceFileIndexLiveStats(): { root: string | null; fileCount: number } {
	return { root: null, fileCount: 0 };
}

export function registerKnownWorkspaceRelPath(relPath: string, rootAbs: string): void {
	const rootNorm = path.normalize(path.resolve(rootAbs));
	const b = buckets.get(rootNorm);
	if (!b) {
		return;
	}
	const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
	if (!norm || norm.includes('..')) {
		return;
	}
	b.relPathSet.add(norm);
	invalidateSortedPathsSnapshot(b);
	schedulePersistWorkspaceFileIndex(b);
}

let workspaceFsTouchNotifier: (() => void) | null = null;
let workspaceFsTouchTimer: ReturnType<typeof setTimeout> | null = null;
const WORKSPACE_FS_TOUCH_DEBOUNCE_MS = 400;

export function setWorkspaceFsTouchNotifier(cb: (() => void) | null): void {
	workspaceFsTouchNotifier = cb;
}

function scheduleWorkspaceFsTouchNotify(): void {
	if (!workspaceFsTouchNotifier) {
		return;
	}
	if (workspaceFsTouchTimer) {
		clearTimeout(workspaceFsTouchTimer);
	}
	workspaceFsTouchTimer = setTimeout(() => {
		workspaceFsTouchTimer = null;
		try {
			workspaceFsTouchNotifier?.();
		} catch {
			/* ignore */
		}
	}, WORKSPACE_FS_TOUCH_DEBOUNCE_MS);
}

function schedulePersistWorkspaceFileIndex(b: FileIndexBucket): void {
	if (b.persistTimer) {
		clearTimeout(b.persistTimer);
	}
	b.persistTimer = setTimeout(() => {
		b.persistTimer = null;
		void persistWorkspaceFileIndexSnapshot(b);
	}, 250);
}

async function persistWorkspaceFileIndexSnapshot(b: FileIndexBucket): Promise<void> {
	const target = getWorkspaceFilesIndexPath(b.rootNorm);
	const files = Array.from(b.relPathSet).sort((a, c) => a.localeCompare(c, undefined, { sensitivity: 'base' }));
	try {
		await fsp.mkdir(path.dirname(target), { recursive: true });
		await fsp.writeFile(
			target,
			JSON.stringify(
				{
					version: 1,
					root: b.rootNorm,
					generatedAt: new Date().toISOString(),
					files,
				},
				null,
				2
			),
			'utf8'
		);
	} catch {
		/* ignore */
	}
}

function normalizeRel(rootNorm: string, absPath: string): string | null {
	const rel = path.relative(rootNorm, absPath).split(path.sep).join('/');
	if (!rel || rel.startsWith('..')) {
		return null;
	}
	return rel;
}

function shouldIgnoreAbsolutePath(absPath: string): boolean {
	const parts = absPath.split(path.sep);
	for (const part of parts) {
		if (part && SKIP_DIR_NAMES.has(part.toLowerCase())) {
			return true;
		}
	}
	return false;
}

export function listWorkspaceRelativeFiles(rootAbs: string): string[] {
	const root = path.normalize(path.resolve(rootAbs));
	const out: string[] = [];

	function walk(absDir: string): void {
		if (out.length >= MAX_WORKSPACE_FILES) {
			return;
		}
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(absDir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const ent of entries) {
			if (out.length >= MAX_WORKSPACE_FILES) {
				return;
			}
			const name = ent.name;
			if (name === '.' || name === '..') {
				continue;
			}
			const abs = path.join(absDir, name);
			if (ent.isDirectory()) {
				if (SKIP_DIR_NAMES.has(name.toLowerCase())) {
					continue;
				}
				walk(abs);
			} else if (ent.isFile()) {
				const rel = normalizeRel(root, abs);
				if (rel) {
					out.push(rel);
				}
			}
		}
	}

	try {
		const st = fs.statSync(root);
		if (!st.isDirectory()) {
			return [];
		}
	} catch {
		return [];
	}

	walk(root);
	out.sort((a, c) => a.localeCompare(c, undefined, { sensitivity: 'base' }));
	return out;
}

async function scanFullAsync(rootNorm: string): Promise<string[]> {
	const out: string[] = [];

	async function processDir(absDir: string): Promise<void> {
		if (out.length >= MAX_WORKSPACE_FILES) {
			return;
		}
		let entries: fs.Dirent[];
		try {
			entries = await fsp.readdir(absDir, { withFileTypes: true });
		} catch {
			return;
		}
		const subdirs: string[] = [];
		for (const ent of entries) {
			if (out.length >= MAX_WORKSPACE_FILES) {
				return;
			}
			if (ent.name === '.' || ent.name === '..') {
				continue;
			}
			const abs = path.join(absDir, ent.name);
			if (ent.isDirectory()) {
				if (SKIP_DIR_NAMES.has(ent.name.toLowerCase())) {
					continue;
				}
				subdirs.push(abs);
			} else if (ent.isFile()) {
				const rel = normalizeRel(rootNorm, abs);
				if (rel) {
					out.push(rel);
				}
			}
		}
		await Promise.all(subdirs.map((d) => processDir(d)));
	}

	try {
		const st = await fsp.stat(rootNorm);
		if (!st.isDirectory()) {
			return [];
		}
	} catch {
		return [];
	}

	await processDir(rootNorm);
	out.sort((a, c) => a.localeCompare(c, undefined, { sensitivity: 'base' }));
	return out;
}

function sortedFromSet(b: FileIndexBucket): string[] {
	return Array.from(b.relPathSet).sort((a, c) => a.localeCompare(c, undefined, { sensitivity: 'base' }));
}

function stopWatcherOnly(b: FileIndexBucket): void {
	if (b.watcher) {
		void b.watcher.close();
		b.watcher = null;
	}
}

export function getIndexedWorkspaceFilesIfFresh(rootAbs: string): string[] | null {
	const rootNorm = path.normalize(path.resolve(rootAbs));
	const b = buckets.get(rootNorm);
	if (b && b.relPathSet.size > 0) {
		return sortedFromSet(b);
	}
	return null;
}

/** 停止所有 root 的监听与缓存（例如应用退出前调试）。 */
export function stopAllWorkspaceFileIndexes(): void {
	for (const b of buckets.values()) {
		destroyBucket(b);
	}
	buckets.clear();
	if (workspaceFsTouchTimer) {
		clearTimeout(workspaceFsTouchTimer);
		workspaceFsTouchTimer = null;
	}
}

/** @deprecated 使用 releaseWorkspaceFileIndexRef(stopAllWorkspaceFileIndexes) */
export function stopWorkspaceFileIndex(): void {
	stopAllWorkspaceFileIndexes();
}

function attachWatcher(b: FileIndexBucket): void {
	stopWatcherOnly(b);
	const rootNorm = b.rootNorm;
	b.watcher = chokidar.watch(rootNorm, {
		ignored: (p) => shouldIgnoreAbsolutePath(p),
		ignoreInitial: true,
		persistent: true,
		ignorePermissionErrors: true,
		awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
	});

	b.watcher.on('error', (err: unknown) => {
		const code = err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
		if (code === 'EPERM' || code === 'EACCES') {
			return;
		}
		console.warn('[workspaceFileIndex] chokidar error:', err);
	});

	const applyAdd = (absPath: string) => {
		if (!buckets.get(rootNorm)) {
			return;
		}
		fs.stat(absPath, (err, st) => {
			if (err || !st.isFile()) {
				return;
			}
			const rel = normalizeRel(rootNorm, absPath);
			if (rel) {
				b.relPathSet.add(rel);
				invalidateSortedPathsSnapshot(b);
				schedulePersistWorkspaceFileIndex(b);
				void indexWorkspaceSourceFile(rootNorm, rel);
				scheduleWorkspaceFsTouchNotify();
			}
		});
	};

	const applyChange = (absPath: string) => {
		if (!buckets.get(rootNorm)) {
			return;
		}
		const rel = normalizeRel(rootNorm, absPath);
		if (rel) {
			b.relPathSet.add(rel);
			invalidateSortedPathsSnapshot(b);
			schedulePersistWorkspaceFileIndex(b);
			void indexWorkspaceSourceFile(rootNorm, rel);
			scheduleWorkspaceFsTouchNotify();
		}
	};

	const applyUnlink = (absPath: string) => {
		if (!buckets.get(rootNorm)) {
			return;
		}
		const rel = normalizeRel(rootNorm, absPath);
		if (rel) {
			b.relPathSet.delete(rel);
			invalidateSortedPathsSnapshot(b);
			schedulePersistWorkspaceFileIndex(b);
			removeWorkspaceSymbolsForRel(rootNorm, rel);
			scheduleWorkspaceFsTouchNotify();
		}
	};

	const applyUnlinkDir = (absPath: string) => {
		if (!buckets.get(rootNorm)) {
			return;
		}
		const rel = normalizeRel(rootNorm, absPath);
		if (!rel) {
			return;
		}
		const prefix = rel + '/';
		for (const k of [...b.relPathSet]) {
			if (k === rel || k.startsWith(prefix)) {
				b.relPathSet.delete(k);
			}
		}
		invalidateSortedPathsSnapshot(b);
		schedulePersistWorkspaceFileIndex(b);
		removeWorkspaceSymbolsUnderPrefix(rootNorm, rel);
		scheduleWorkspaceFsTouchNotify();
	};

	b.watcher.on('add', applyAdd);
	b.watcher.on('change', applyChange);
	b.watcher.on('unlink', applyUnlink);
	b.watcher.on('unlinkDir', applyUnlinkDir);
}

// ── 按需搜索（主进程侧过滤，渲染进程不再持有全量文件列表） ───────────────

export type FileSearchItem = {
	/** 相对路径（正斜杠） */
	path: string;
	/** 文件名 */
	label: string;
	/** 目录部分 */
	description: string;
};

type ScoredPath = { path: string; score: number };

function compareScoredPath(a: ScoredPath, b: ScoredPath): number {
	if (a.score !== b.score) {
		return a.score - b.score;
	}
	const ab = (a.path.split('/').pop() || a.path).toLowerCase();
	const bb = (b.path.split('/').pop() || b.path).toLowerCase();
	const c = ab.localeCompare(bb, undefined, { sensitivity: 'base' });
	if (c !== 0) {
		return c;
	}
	return a.path.localeCompare(b.path, undefined, { sensitivity: 'base' });
}

/** 维护按 compareScoredPath 升序的前 limit 条，避免对全量结果 O(N log N) 排序 */
function insertTopScored(top: ScoredPath[], item: ScoredPath, limit: number): void {
	if (limit <= 0) {
		return;
	}
	let lo = 0;
	let hi = top.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (compareScoredPath(item, top[mid]!) < 0) {
			hi = mid;
		} else {
			lo = mid + 1;
		}
	}
	top.splice(lo, 0, item);
	if (top.length > limit) {
		top.length = limit;
	}
}

/** 按 basename 前两字符分桶；模糊查询时先扫与 query 前缀一致的桶，再扫其余路径，避免漏匹配且常减少首轮无效打分 */
function ensureBasenameTwoCharBuckets(b: FileIndexBucket): Map<string, Set<string>> {
	let m = b.basenameTwoCharBuckets;
	if (m) {
		return m;
	}
	m = new Map<string, Set<string>>();
	for (const p of b.relPathSet) {
		const bn = (p.split('/').pop() || p).toLowerCase();
		const key = bn.length < 2 ? bn : bn.slice(0, 2);
		let s = m.get(key);
		if (!s) {
			s = new Set();
			m.set(key, s);
		}
		s.add(p);
	}
	b.basenameTwoCharBuckets = m;
	return m;
}

function isPathLikeFileQuery(q: string): boolean {
	return q.includes('/') || q.includes('\\') || q.startsWith('.');
}

function scorePathForQuery(p: string, q: string, gitSet: Set<string>, pathLike: boolean): number | null {
	const pl = p.toLowerCase();
	const base = (p.split('/').pop() || p).toLowerCase();
	if (pathLike) {
		if (!pl.includes(q) && !base.includes(q)) {
			return null;
		}
		let score = 20;
		if (pl.startsWith(q)) {
			score = 3;
		} else if (pl.includes(q)) {
			score = 8;
		} else if (base.includes(q)) {
			score = 12;
		}
		if (gitSet.has(p)) {
			score -= 1;
		}
		return score;
	}
	if (!pl.includes(q) && !base.includes(q)) {
		return null;
	}
	let score = 20;
	if (base === q) {
		score = 0;
	} else if (base.startsWith(q)) {
		score = 2;
	} else if (base.includes(q)) {
		score = 5;
	} else if (pl.includes(q)) {
		score = 10;
	}
	if (gitSet.has(p)) {
		score -= 1;
	}
	return score;
}

function emptyQueryTopPaths(b: FileIndexBucket, gitSet: Set<string>, limit: number): ScoredPath[] {
	const snap = b.sortedPathsSnapshot;
	if (snap && snap.length === b.relPathSet.size) {
		const out: ScoredPath[] = [];
		for (const p of snap) {
			if (out.length >= limit) {
				break;
			}
			if (gitSet.has(p)) {
				out.push({ path: p, score: 0 });
			}
		}
		if (out.length < limit) {
			for (const p of snap) {
				if (out.length >= limit) {
					break;
				}
				if (!gitSet.has(p)) {
					out.push({ path: p, score: 2 });
				}
			}
		}
		return out;
	}
	const top: ScoredPath[] = [];
	for (const p of b.relPathSet) {
		insertTopScored(top, { path: p, score: gitSet.has(p) ? 0 : 2 }, limit);
	}
	return top;
}

function relPathToSearchItem(slash: string): FileSearchItem {
	const idx = slash.lastIndexOf('/');
	return {
		path: slash,
		label: idx >= 0 ? slash.slice(idx + 1) : slash,
		description: idx >= 0 ? slash.slice(0, idx) : '',
	};
}

/**
 * 在已建好的文件索引上执行过滤搜索，返回评分后的 top-N 结果。
 * 如果索引未就绪，先 await 构建完成。
 * @param gitChangedPaths  渲染进程传来的 git 变更路径列表（用于提权排序）
 */
export async function searchWorkspaceFiles(
	rootAbs: string,
	query: string,
	gitChangedPaths: string[],
	limit = 60
): Promise<FileSearchItem[]> {
	const rootNorm = path.normalize(path.resolve(rootAbs));
	await ensureWorkspaceFileIndex(rootAbs);
	const b = buckets.get(rootNorm);
	if (!b || b.relPathSet.size === 0) {
		return [];
	}
	const gitSet = new Set(gitChangedPaths.map((p) => p.replace(/\\/g, '/')));
	const q = query.trim().toLowerCase();
	const cap = Math.max(1, Math.min(limit, 200));

	if (!q) {
		return emptyQueryTopPaths(b, gitSet, cap).map((s) => relPathToSearchItem(s.path));
	}

	const pathLike = isPathLikeFileQuery(q);
	const top: ScoredPath[] = [];

	const scoreIntoTop = (p: string): void => {
		const sc = scorePathForQuery(p, q, gitSet, pathLike);
		if (sc == null) {
			return;
		}
		insertTopScored(top, { path: p, score: sc }, cap);
	};

	if (!pathLike && q.length >= 2) {
		const primary = ensureBasenameTwoCharBuckets(b).get(q.slice(0, 2));
		if (primary && primary.size > 0) {
			for (const p of primary) {
				scoreIntoTop(p);
			}
			for (const p of b.relPathSet) {
				if (primary.has(p)) {
					continue;
				}
				scoreIntoTop(p);
			}
			return top.map((s) => relPathToSearchItem(s.path));
		}
	}

	for (const p of b.relPathSet) {
		scoreIntoTop(p);
	}
	return top.map((s) => relPathToSearchItem(s.path));
}

/** 后台构建文件索引，避免用户首次输入 @ 时才触发整库扫描 */
export function prewarmWorkspaceFileIndex(rootAbs: string): void {
	void ensureWorkspaceFileIndex(rootAbs).catch(() => {});
}

export async function ensureWorkspaceFileIndex(rootAbs: string): Promise<string[]> {
	const rootNorm = path.normalize(path.resolve(rootAbs));
	const b = getBucket(rootNorm);

	if (b.relPathSet.size > 0 && !b.inFlightRefresh) {
		return sortedFromSet(b);
	}

	if (b.inFlightRefresh) {
		return b.inFlightRefresh;
	}

	b.inFlightRefresh = (async () => {
		const t0 = Date.now();
		const list = await scanFullAsync(rootNorm);
		console.log(`[fileIndex] scan done: ${list.length} files in ${Date.now() - t0}ms`);
		b.relPathSet = new Set(list);
		b.sortedPathsSnapshot = list;
		attachWatcher(b);
		console.log(`[fileIndex] watcher attached: +${Date.now() - t0}ms`);
		schedulePersistWorkspaceFileIndex(b);
		try {
			notifyFileIndexReady?.(rootNorm);
		} catch {
			/* ignore */
		}
		return sortedFromSet(b);
	})();

	try {
		return await b.inFlightRefresh;
	} finally {
		b.inFlightRefresh = null;
	}
}
