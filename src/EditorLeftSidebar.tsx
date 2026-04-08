import { memo, useCallback, useEffect, type RefObject } from 'react';
import {
	useAppShellChrome,
	useAppShellGitActions,
	useAppShellGitFiles,
	useAppShellGitMeta,
	useAppShellWorkspace,
} from './app/appShellContexts';
import { FileTypeIcon } from './fileTypeIcons';
import { GitUnavailableState } from './gitBadge';
import { classifyGitUnavailableReason, type GitUnavailableReason } from './gitAvailability';
import { useI18n } from './i18n';
import {
	IconArrowUpRight,
	IconChevron,
	IconExplorer,
	IconGitSCM,
	IconNewFile,
	IconNewFolder,
	IconPlugin,
	IconRefresh,
	IconSearch,
} from './icons';
import type { SettingsNavId } from './SettingsPage';
import { EditorGitScmPathList } from './GitScmVirtualLists';
import { WorkspaceExplorer, type WorkspaceExplorerActions } from './WorkspaceExplorer';

type Shell = NonNullable<Window['asyncShell']>;
type SearchResult = { rel: string; fileName: string; dir: string };

/** 资源管理器 Git 刷新：仅订阅 Git Actions（稳定引用），fullStatus 大对象更新时不重渲。 */
const EditorExplorerGitRefreshButton = memo(function EditorExplorerGitRefreshButton() {
	const { t } = useAppShellChrome();
	const { refreshGit } = useAppShellGitActions();
	return (
		<button
			type="button"
			className="ref-editor-sidebar-action"
			aria-label={t('app.explorerRefreshAria')}
			title={t('common.refresh')}
			onClick={refreshGit}
		>
			<IconRefresh />
		</button>
	);
});

/** 活动栏 Git 标签：只刷新轻状态，预览由 Git 面板缺口检测后后台补齐。 */
const EditorGitTabButton = memo(function EditorGitTabButton({
	isActive,
	onActivate,
}: {
	isActive: boolean;
	onActivate: () => void;
}) {
	const { t } = useAppShellChrome();
	const { refreshGit } = useAppShellGitActions();
	return (
		<button
			type="button"
			className={`ref-editor-sidebar-tab ${isActive ? 'is-active' : ''}`}
			title={t('app.tabGit')}
			aria-label={t('app.tabGit')}
			aria-pressed={isActive}
			onClick={() => {
				onActivate();
				void refreshGit();
			}}
		>
			<IconGitSCM />
		</button>
	);
});

/** 仅挂载于 Git 视图时订阅 Git context，与 explorer/search 重渲解耦。 */
const EditorLeftSidebarGitPane = memo(function EditorLeftSidebarGitPane({
	hasShellAndWorkspace,
	workspaceBasename,
	editorSidebarSelectedRel,
	onExplorerOpenFile,
	setWorkspacePickerOpen,
}: {
	hasShellAndWorkspace: boolean;
	workspaceBasename: string;
	editorSidebarSelectedRel: string;
	onExplorerOpenFile: (rel: string) => void;
	setWorkspacePickerOpen: (v: boolean) => void;
}) {
	const { t } = useAppShellChrome();
	const { workspace } = useAppShellWorkspace();
	const { refreshGit } = useAppShellGitActions();
	const { gitLines, gitStatusOk, diffLoading } = useAppShellGitMeta();
	const { gitChangedPaths, gitPathStatus, diffPreviews, loadGitDiffPreviews } = useAppShellGitFiles();

	const gitUnavailableReason: GitUnavailableReason = gitStatusOk
		? 'none'
		: classifyGitUnavailableReason(gitLines[0]);
	const hasMissingGitPreviews = gitChangedPaths.some((path) => diffPreviews[path] == null);

	useEffect(() => {
		if (
			!hasShellAndWorkspace ||
			!gitStatusOk ||
			gitChangedPaths.length === 0 ||
			diffLoading ||
			!hasMissingGitPreviews
		) {
			return;
		}
		void loadGitDiffPreviews();
	}, [
		hasShellAndWorkspace,
		workspace,
		gitStatusOk,
		gitChangedPaths,
		diffLoading,
		hasMissingGitPreviews,
		loadGitDiffPreviews,
	]);

	return (
		<>
			<div className="ref-editor-sidebar-section-bar">
				<div className="ref-editor-sidebar-section-title">
					<span className="ref-editor-sidebar-section-name">{t('app.tabGit')}</span>
				</div>
				{hasShellAndWorkspace ? (
					<div className="ref-editor-sidebar-section-actions">
						<button
							type="button"
							className="ref-editor-sidebar-action"
							aria-label={t('app.explorerRefreshAria')}
							title={t('common.refresh')}
							onClick={() => void refreshGit()}
						>
							<IconRefresh />
						</button>
					</div>
				) : null}
			</div>
			{!hasShellAndWorkspace || gitUnavailableReason !== 'none' || gitChangedPaths.length === 0 ? (
				<div className="ref-editor-sidebar-scroll ref-editor-sidebar-scroll--list">
					<div className="ref-editor-sidebar-file-list">
						{!hasShellAndWorkspace ? (
							<div className="ref-editor-sidebar-empty">
								<p className="ref-editor-sidebar-empty-copy">{t('app.explorerPlaceholder')}</p>
								<button
									type="button"
									className="ref-open-workspace ref-open-workspace--inline"
									onClick={() => setWorkspacePickerOpen(true)}
								>
									{t('app.openWorkspace')}
								</button>
							</div>
						) : gitUnavailableReason !== 'none' ? (
							<div className="ref-editor-sidebar-empty">
								<GitUnavailableState t={t} reason={gitUnavailableReason} detail={gitLines[0] ?? ''} />
							</div>
						) : (
							<div className="ref-editor-sidebar-empty">
								<p className="ref-editor-sidebar-empty-copy">{t('app.gitNoChanges')}</p>
							</div>
						)}
					</div>
				</div>
			) : (
				<EditorGitScmPathList
					paths={gitChangedPaths}
					gitPathStatus={gitPathStatus}
					workspaceBasename={workspaceBasename}
					editorSidebarSelectedRel={editorSidebarSelectedRel.replace(/\\/g, '/')}
					onExplorerOpenFile={onExplorerOpenFile}
					t={t}
				/>
			)}
		</>
	);
});

/** 仅订阅 Git Files，使资源管理器装饰与左侧栏其它区（search/git tab）在 fullStatus 时解耦 */
const EditorWorkspaceExplorerGate = memo(function EditorWorkspaceExplorerGate({
	shell,
	workspace,
	editorSidebarSelectedRel,
	workspaceExplorerActions,
	onExplorerOpenFile,
}: {
	shell: Shell;
	workspace: string;
	editorSidebarSelectedRel: string;
	workspaceExplorerActions: WorkspaceExplorerActions | null;
	onExplorerOpenFile: (rel: string) => void;
}) {
	const { gitPathStatus } = useAppShellGitFiles();
	const { treeEpoch } = useAppShellGitMeta();
	return (
		<WorkspaceExplorer
			key={workspace}
			shell={shell}
			pathStatus={gitPathStatus}
			selectedRel={editorSidebarSelectedRel}
			treeEpoch={treeEpoch}
			onOpenFile={onExplorerOpenFile}
			directoryIconMode="hidden"
			indentBase={0}
			indentStep={8}
			explorerActions={workspaceExplorerActions}
		/>
	);
});

interface EditorLeftSidebarProps {
	shell: Shell | undefined;
	workspace: string | null;
	workspaceBasename: string;
	ipcOk: string;
	editorLeftSidebarView: 'explorer' | 'search' | 'git';
	setEditorLeftSidebarView: (v: 'explorer' | 'search' | 'git') => void;
	editorExplorerCollapsed: boolean;
	toggleEditorExplorerCollapsed: () => void;
	editorSidebarWorkspaceLabel: string;
	editorSidebarSelectedRel: string;
	editorExplorerScrollRef: RefObject<HTMLDivElement | null>;
	workspaceExplorerActions: WorkspaceExplorerActions | null;
	editorSidebarSearchQuery: string;
	setEditorSidebarSearchQuery: (q: string) => void;
	normalizedEditorSidebarSearchQuery: string;
	editorSidebarSearchResults: SearchResult[];
	editorSidebarSearchInputRef: RefObject<HTMLInputElement | null>;
	fileMenuNewFile: () => void;
	revealWorkspaceInOs: (path: string) => void;
	onExplorerOpenFile: (rel: string) => void;
	setWorkspacePickerOpen: (v: boolean) => void;
	openSettingsPage: (nav: SettingsNavId) => void;
}

export const EditorLeftSidebar = memo(function EditorLeftSidebar({
	shell,
	workspace,
	workspaceBasename,
	ipcOk,
	editorLeftSidebarView,
	setEditorLeftSidebarView,
	editorExplorerCollapsed,
	toggleEditorExplorerCollapsed,
	editorSidebarWorkspaceLabel,
	editorSidebarSelectedRel,
	editorExplorerScrollRef,
	workspaceExplorerActions,
	editorSidebarSearchQuery,
	setEditorSidebarSearchQuery,
	normalizedEditorSidebarSearchQuery,
	editorSidebarSearchResults,
	editorSidebarSearchInputRef,
	fileMenuNewFile,
	revealWorkspaceInOs,
	onExplorerOpenFile,
	setWorkspacePickerOpen,
	openSettingsPage,
}: EditorLeftSidebarProps) {
	const { t } = useI18n();
	const hasShellAndWorkspace = Boolean(shell && workspace);
	const activateGitView = useCallback(() => {
		setEditorLeftSidebarView('git');
	}, [setEditorLeftSidebarView]);

	return (
		<div className="ref-left-editor-nest">
			<div className="ref-editor-activity-bar" aria-label={t('app.rightSidebarViews')}>
				<button
					type="button"
					className={`ref-editor-sidebar-tab ${editorLeftSidebarView === 'explorer' ? 'is-active' : ''}`}
					title={t('app.tabExplorer')}
					aria-label={t('app.tabExplorer')}
					aria-pressed={editorLeftSidebarView === 'explorer'}
					onClick={() => setEditorLeftSidebarView('explorer')}
				>
					<IconExplorer />
				</button>
				<button
					type="button"
					className={`ref-editor-sidebar-tab ${editorLeftSidebarView === 'search' ? 'is-active' : ''}`}
					title={t('app.tabSearch')}
					aria-label={t('app.tabSearch')}
					aria-pressed={editorLeftSidebarView === 'search'}
					onClick={() => setEditorLeftSidebarView('search')}
				>
					<IconSearch />
				</button>
				<EditorGitTabButton
					isActive={editorLeftSidebarView === 'git'}
					onActivate={activateGitView}
				/>
				<div className="ref-editor-activity-spacer" aria-hidden />
				<button
					type="button"
					className="ref-editor-sidebar-tab"
					title={t('settings.nav.plugins')}
					aria-label={t('settings.nav.plugins')}
					onClick={() => openSettingsPage('plugins')}
				>
					<IconPlugin />
				</button>
				<button
					type="button"
					className="ref-editor-sidebar-tab"
					title={t('app.openWorkspace')}
					aria-label={t('app.openWorkspace')}
					onClick={() => setWorkspacePickerOpen(true)}
				>
					<IconChevron />
				</button>
			</div>

			<div className="ref-editor-sidebar-pane">
				{editorLeftSidebarView === 'explorer' ? (
					<>
						<div className="ref-editor-sidebar-section-bar">
							<button
								type="button"
								className="ref-editor-sidebar-section-toggle"
								onClick={(event) => {
									event.currentTarget.blur();
									toggleEditorExplorerCollapsed();
								}}
								aria-expanded={!editorExplorerCollapsed}
							>
								<div className="ref-editor-sidebar-section-title">
									<IconChevron className="ref-editor-sidebar-section-chevron" />
									<span className="ref-editor-sidebar-section-name">{editorSidebarWorkspaceLabel}</span>
								</div>
							</button>
							{hasShellAndWorkspace ? (
								<div className="ref-editor-sidebar-section-actions">
									<button
										type="button"
										className="ref-editor-sidebar-action"
										title={t('app.fileMenu.newFile')}
										aria-label={t('app.fileMenu.newFile')}
										onClick={fileMenuNewFile}
									>
										<IconNewFile />
									</button>
									<button
										type="button"
										className="ref-editor-sidebar-action"
										title={t('app.openWorkspace')}
										aria-label={t('app.openWorkspace')}
										onClick={() => setWorkspacePickerOpen(true)}
									>
										<IconNewFolder />
									</button>
									<EditorExplorerGitRefreshButton />
									<button
										type="button"
										className="ref-editor-sidebar-action"
										title={t('app.workspaceMenuOpenInExplorer')}
										aria-label={t('app.workspaceMenuOpenInExplorer')}
										onClick={() => revealWorkspaceInOs(workspace!)}
									>
										<IconArrowUpRight />
									</button>
								</div>
							) : null}
						</div>
						<div
							ref={editorExplorerScrollRef}
							className={`ref-editor-sidebar-scroll ref-editor-sidebar-scroll--explorer ${
								editorExplorerCollapsed ? 'is-collapsed' : ''
							}`}
						>
							{hasShellAndWorkspace ? (
								<EditorWorkspaceExplorerGate
									shell={shell!}
									workspace={workspace!}
									editorSidebarSelectedRel={editorSidebarSelectedRel}
									workspaceExplorerActions={workspaceExplorerActions}
									onExplorerOpenFile={onExplorerOpenFile}
								/>
							) : (
								<div className="ref-editor-sidebar-empty">
									<p className="ref-editor-sidebar-empty-copy">{t('app.explorerPlaceholder')}</p>
									<button
										type="button"
										className="ref-open-workspace ref-open-workspace--inline"
										onClick={() => setWorkspacePickerOpen(true)}
									>
										{t('app.openWorkspace')}
									</button>
									<div className="ref-ipc-hint">{ipcOk}</div>
								</div>
							)}
						</div>
					</>
				) : null}

				{editorLeftSidebarView === 'search' ? (
					<>
						<div className="ref-editor-sidebar-section-bar">
							<div className="ref-editor-sidebar-section-title">
								<span className="ref-editor-sidebar-section-name">{t('app.tabSearch')}</span>
							</div>
						</div>
						<div className="ref-editor-sidebar-search-field">
							<IconSearch className="ref-editor-sidebar-search-icon" />
							<input
								ref={editorSidebarSearchInputRef}
								type="search"
								value={editorSidebarSearchQuery}
								onChange={(e) => setEditorSidebarSearchQuery(e.target.value)}
								className="ref-editor-sidebar-search-input"
								placeholder={t('app.editorSidebarSearchPlaceholder')}
								aria-label={t('app.tabSearch')}
							/>
						</div>
						<div className="ref-editor-sidebar-scroll ref-editor-sidebar-scroll--list">
							<div className="ref-editor-sidebar-file-list">
								{!hasShellAndWorkspace ? (
									<div className="ref-editor-sidebar-empty">
										<p className="ref-editor-sidebar-empty-copy">{t('app.explorerPlaceholder')}</p>
										<button
											type="button"
											className="ref-open-workspace ref-open-workspace--inline"
											onClick={() => setWorkspacePickerOpen(true)}
										>
											{t('app.openWorkspace')}
										</button>
									</div>
								) : !normalizedEditorSidebarSearchQuery ? (
									<div className="ref-editor-sidebar-empty">
										<p className="ref-editor-sidebar-empty-copy">{t('app.editorSidebarSearchHint')}</p>
									</div>
								) : editorSidebarSearchResults.length === 0 ? (
									<div className="ref-editor-sidebar-empty">
										<p className="ref-editor-sidebar-empty-copy">{t('app.editorSidebarSearchEmpty')}</p>
									</div>
								) : (
									editorSidebarSearchResults.map((result) => (
										<button
											key={result.rel}
											type="button"
											className={`ref-editor-sidebar-file-row ${editorSidebarSelectedRel === result.rel ? 'is-active' : ''}`}
											onClick={() => onExplorerOpenFile(result.rel)}
											title={result.rel}
										>
											<span className="ref-editor-sidebar-file-icon" aria-hidden>
												<FileTypeIcon fileName={result.fileName} isDirectory={false} />
											</span>
											<span className="ref-editor-sidebar-file-main">
												<span className="ref-editor-sidebar-file-name">{result.fileName}</span>
												<span className="ref-editor-sidebar-file-path">{result.dir || workspaceBasename}</span>
											</span>
										</button>
									))
								)}
							</div>
						</div>
					</>
				) : null}

				{editorLeftSidebarView === 'git' ? (
					<EditorLeftSidebarGitPane
						hasShellAndWorkspace={hasShellAndWorkspace}
						workspaceBasename={workspaceBasename}
						editorSidebarSelectedRel={editorSidebarSelectedRel}
						onExplorerOpenFile={onExplorerOpenFile}
						setWorkspacePickerOpen={setWorkspacePickerOpen}
					/>
				) : null}
			</div>
		</div>
	);
});
