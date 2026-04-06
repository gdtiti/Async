import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GitPathStatusMap } from '../WorkspaceExplorer';

type Shell = NonNullable<Window['asyncShell']>;
type DiffPreview = { diff: string; isBinary: boolean; additions: number; deletions: number };

type FullStatusOk = {
	ok: true;
	branch: string;
	lines: string[];
	pathStatus: GitPathStatusMap;
	changedPaths: string[];
	branches: string[];
	current: string;
	previews: Record<string, DiffPreview>;
};

type FullStatusFail = { ok: false; error?: string };

/**
 * 管理所有 Git 相关状态：分支、状态、diff 预览、分支列表。
 * 在 workspace 变化或文件系统触碰时自动刷新。
 */
export function useGitIntegration(shell: Shell | undefined, workspace: string | null) {
	const [gitBranch, setGitBranch] = useState('—');
	const [gitLines, setGitLines] = useState<string[]>([]);
	const [gitPathStatus, setGitPathStatus] = useState<GitPathStatusMap>({});
	const [gitChangedPaths, setGitChangedPaths] = useState<string[]>([]);
	/** `git:status` 成功（有仓库且本机可执行 git）；否则 Agent 改动条回退为对话解析统计 */
	const [gitStatusOk, setGitStatusOk] = useState(false);
	/** 与 refreshGit 同步预取的本地分支列表（供分支选择器立即展示） */
	const [gitBranchList, setGitBranchList] = useState<string[]>([]);
	const [gitBranchListCurrent, setGitBranchListCurrent] = useState('');
	const [diffPreviews, setDiffPreviews] = useState<Record<string, DiffPreview>>({});
	const [diffLoading, setDiffLoading] = useState(false);
	const [gitActionError, setGitActionError] = useState<string | null>(null);
	const [treeEpoch, setTreeEpoch] = useState(0);
	const [gitBranchPickerOpen, setGitBranchPickerOpen] = useState(false);

	const refreshGit = useCallback(async () => {
		if (!shell) {
			return;
		}
		const perfId = `void-git-${Date.now()}`;
		const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
		try {
			if (typeof performance !== 'undefined' && performance.mark) {
				performance.mark(`${perfId}-start`);
			}
		} catch {
			/* ignore */
		}
		setDiffLoading(true);
		try {
			const r = (await shell.invoke('git:fullStatus')) as FullStatusOk | FullStatusFail;
			if (r.ok) {
				setGitStatusOk(true);
				setGitBranch(r.branch || 'master');
				setGitLines(r.lines);
				setGitPathStatus(r.pathStatus ?? {});
				setGitChangedPaths(r.changedPaths ?? []);
				setGitBranchList(Array.isArray(r.branches) ? r.branches : []);
				setGitBranchListCurrent(typeof r.current === 'string' ? r.current : '');
				setDiffPreviews(r.previews ?? {});
			} else {
				setGitStatusOk(false);
				setGitBranch('—');
				setGitLines([r.error ?? 'Failed to load changes']);
				setGitPathStatus({});
				setGitChangedPaths([]);
				setGitBranchList([]);
				setGitBranchListCurrent('');
				setDiffPreviews({});
			}
			setTreeEpoch((n) => n + 1);
		} finally {
			setDiffLoading(false);
			try {
				if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
					performance.mark(`${perfId}-end`);
					performance.measure('void-git:refresh', `${perfId}-start`, `${perfId}-end`);
				}
			} catch {
				/* ignore */
			}
			if (t0 && typeof performance !== 'undefined') {
				console.log(`[perf] refreshGit: ${(performance.now() - t0).toFixed(1)}ms`);
			}
		}
	}, [shell]);

	const onGitBranchListFresh = useCallback((b: string[], c: string) => {
		setGitBranchList(b);
		setGitBranchListCurrent(c);
	}, []);

	// workspace 变化时刷新 git 状态
	useEffect(() => {
		if (!workspace || !shell) {
			return;
		}
		void refreshGit();
	}, [workspace, shell, refreshGit]);

	// 文件系统变化时刷新 git 状态
	useEffect(() => {
		const sub = shell?.subscribeWorkspaceFsTouched;
		if (!shell || !sub) {
			return;
		}
		const unsub = sub(() => {
			void refreshGit();
		});
		return unsub;
	}, [shell, refreshGit]);

	const diffTotals = useMemo(() => {
		let additions = 0,
			deletions = 0;
		for (const p of gitChangedPaths) {
			const pr = diffPreviews[p];
			if (pr) {
				additions += pr.additions;
				deletions += pr.deletions;
			}
		}
		return { additions, deletions };
	}, [gitChangedPaths, diffPreviews]);

	return {
		gitBranch,
		gitLines,
		gitPathStatus,
		gitChangedPaths,
		gitStatusOk,
		gitBranchList,
		gitBranchListCurrent,
		diffPreviews,
		diffLoading,
		gitActionError,
		setGitActionError,
		treeEpoch,
		gitBranchPickerOpen,
		setGitBranchPickerOpen,
		diffTotals,
		refreshGit,
		onGitBranchListFresh,
	};
}
