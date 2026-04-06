import { useEffect, useState } from 'react';

type Shell = NonNullable<Window['asyncShell']>;

const AGENT_WORKSPACE_ALIASES_KEY = 'async:agent-workspace-aliases-v1';
const AGENT_WORKSPACE_HIDDEN_KEY = 'async:agent-workspace-hidden-v1';
const AGENT_WORKSPACE_COLLAPSED_KEY = 'async:agent-workspace-collapsed-v1';

function readJsonStorage<T>(key: string, fallback: T): T {
	try {
		if (typeof window === 'undefined') return fallback;
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function writeJsonStorage(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* ignore */
	}
}

export type UseWorkspaceManagerOpts = {
	/**
	 * Agent 专用窗口首帧优先对话区：工作区文件列表稍后在空闲时拉取，减轻与首屏 IPC/React 争用。
	 */
	deferWorkspaceFileList?: boolean;
};

/**
 * 管理工作区核心状态：路径、文件列表、最近列表、别名。
 * Action callbacks（applyWorkspacePath 等）由调用方用返回的 setters 自行组合，
 * 避免与 clearWorkspaceConversationState / refreshThreads 产生循环依赖。
 */
export function useWorkspaceManager(shell: Shell | undefined, opts?: UseWorkspaceManagerOpts) {
	const deferFileList = opts?.deferWorkspaceFileList === true;
	const [workspace, setWorkspace] = useState<string | null>(null);
	const [workspaceFileList, setWorkspaceFileList] = useState<string[]>([]);
	const [homeRecents, setHomeRecents] = useState<string[]>([]);
	/** 文件菜单「打开最近的文件夹」：与是否打开工作区无关 */
	const [folderRecents, setFolderRecents] = useState<string[]>([]);
	const [workspaceAliases, setWorkspaceAliases] = useState<Record<string, string>>(() =>
		readJsonStorage<Record<string, string>>(AGENT_WORKSPACE_ALIASES_KEY, {})
	);
	const [hiddenAgentWorkspacePaths, setHiddenAgentWorkspacePaths] = useState<string[]>(() =>
		readJsonStorage<string[]>(AGENT_WORKSPACE_HIDDEN_KEY, [])
	);
	const [collapsedAgentWorkspacePaths, setCollapsedAgentWorkspacePaths] = useState<string[]>(() =>
		readJsonStorage<string[]>(AGENT_WORKSPACE_COLLAPSED_KEY, [])
	);

	// ── 持久化 ────────────────────────────────────────────────────────────────

	useEffect(() => {
		writeJsonStorage(AGENT_WORKSPACE_ALIASES_KEY, workspaceAliases);
	}, [workspaceAliases]);

	useEffect(() => {
		writeJsonStorage(AGENT_WORKSPACE_HIDDEN_KEY, hiddenAgentWorkspacePaths);
	}, [hiddenAgentWorkspacePaths]);

	useEffect(() => {
		writeJsonStorage(AGENT_WORKSPACE_COLLAPSED_KEY, collapsedAgentWorkspacePaths);
	}, [collapsedAgentWorkspacePaths]);

	// ── 文件列表 ──────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!shell || !workspace) {
			setWorkspaceFileList([]);
			return;
		}
		let cancelled = false;
		const loadList = () => {
			void (async () => {
				const r = (await shell.invoke('workspace:listFiles')) as
					| { ok: true; paths: string[] }
					| { ok: false; error?: string };
				if (cancelled) return;
				setWorkspaceFileList(r.ok && Array.isArray(r.paths) ? r.paths : []);
			})();
		};
		if (!deferFileList) {
			loadList();
			return () => {
				cancelled = true;
			};
		}
		if (typeof requestIdleCallback === 'function') {
			const idleId = requestIdleCallback(
				() => {
					if (!cancelled) loadList();
				},
				{ timeout: 2500 }
			);
			return () => {
				cancelled = true;
				cancelIdleCallback(idleId);
			};
		}
		const t = window.setTimeout(() => {
			if (!cancelled) loadList();
		}, 0);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, [shell, workspace, deferFileList]);

	// ── 最近工作区 ────────────────────────────────────────────────────────────

	useEffect(() => {
		if (!shell) {
			setHomeRecents([]);
			setFolderRecents([]);
			return;
		}
		if (workspace) setHomeRecents([]);
		let cancelled = false;
		void (async () => {
			try {
				const r = (await shell.invoke('workspace:listRecents')) as { paths?: string[] };
				if (cancelled) return;
				const paths = Array.isArray(r.paths) ? r.paths : [];
				if (!workspace) setHomeRecents(paths);
				setFolderRecents(paths.slice(0, 14));
			} catch {
				if (!cancelled) {
					setHomeRecents([]);
					setFolderRecents([]);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [shell, workspace]);

	// 打开工作区后取消 hidden/collapsed 标记
	useEffect(() => {
		if (!workspace) return;
		setHiddenAgentWorkspacePaths((prev) => prev.filter((item) => item !== workspace));
		setCollapsedAgentWorkspacePaths((prev) => prev.filter((item) => item !== workspace));
	}, [workspace]);

	// ── TS LSP ────────────────────────────────────────────────────────────────
	// 不在渲染进程自动启动 language server。关闭工作区时通知主进程停止会话。

	useEffect(() => {
		if (!shell || workspace) return;
		void shell.invoke('lsp:ts:stop').catch(() => {});
	}, [shell, workspace]);

	return {
		workspace,
		setWorkspace,
		workspaceFileList,
		homeRecents,
		setHomeRecents,
		folderRecents,
		setFolderRecents,
		workspaceAliases,
		setWorkspaceAliases,
		hiddenAgentWorkspacePaths,
		setHiddenAgentWorkspacePaths,
		collapsedAgentWorkspacePaths,
		setCollapsedAgentWorkspacePaths,
	};
}
