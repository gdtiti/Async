/**
 * Cursor 风格的 "Explored N files" 折叠分组。
 *
 * liveTurn=true 期间：始终展开、活动不断累积（有最大高度限制）。
 * liveTurn 由 true→false（Agent 回合结束）时：延迟后平滑折叠。
 * 用户手动点击 toggle 后：不再自动覆盖，尊重用户选择。
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ActivityGroupSegment, ActivitySegment } from './agentChatSegments';
import { AgentResultCard } from './AgentResultCard';

type Props = {
	group: ActivityGroupSegment;
	onOpenFile?: (relPath: string, revealLine?: number, revealEndLine?: number) => void;
	/** Agent 回合是否仍在进行中（awaitingReply && isLastMessage） */
	liveTurn?: boolean;
};

export function AgentActivityGroup({ group, onOpenFile, liveTurn = false }: Props) {
	const [expanded, setExpanded] = useState(group.pending || liveTurn);
	const userToggledRef = useRef(false);
	const prevLiveTurnRef = useRef(liveTurn);

	// liveTurn 期间，新 pending 活动到来时自动展开（除非用户手动折叠了）
	useEffect(() => {
		if (liveTurn && group.pending && !userToggledRef.current) {
			setExpanded(true);
		}
	}, [group.pending, group.items.length, liveTurn]);

	// 仅在整个 Agent 回合结束时自动折叠（liveTurn true→false）
	useEffect(() => {
		const wasLive = prevLiveTurnRef.current;
		prevLiveTurnRef.current = liveTurn;

		if (wasLive && !liveTurn && !userToggledRef.current) {
			const id = setTimeout(() => setExpanded(false), 600);
			return () => clearTimeout(id);
		}
	}, [liveTurn]);

	const bodyRef = useRef<HTMLDivElement>(null);
	const pinnedToBottomRef = useRef(true);

	// 监听滚动：如果用户往上滚（距底部 > 40px），暂停粘底；滚回底部则恢复
	const onBodyScroll = useCallback(() => {
		const el = bodyRef.current;
		if (!el) return;
		const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		pinnedToBottomRef.current = distFromBottom < 40;
	}, []);

	// 内容变化时，若粘底则自动滚到最新
	useLayoutEffect(() => {
		if (!expanded || !pinnedToBottomRef.current) return;
		const el = bodyRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [group.items, expanded]);

	// 展开时重置粘底状态
	useEffect(() => {
		if (expanded) {
			pinnedToBottomRef.current = true;
			const el = bodyRef.current;
			if (el) el.scrollTop = el.scrollHeight;
		}
	}, [expanded]);

	const onToggle = useCallback(() => {
		userToggledRef.current = true;
		setExpanded((v) => !v);
	}, []);

	return (
		<div className={`ref-activity-group ${group.pending ? 'is-pending' : 'is-done'}`}>
			<button
				type="button"
				className="ref-activity-group-header"
				aria-expanded={expanded}
				onClick={onToggle}
			>
				<span className="ref-activity-group-icon" aria-hidden>
					{group.pending ? <SpinnerIcon /> : <ExploreIcon />}
				</span>
				<span className="ref-activity-group-summary">{group.summary}</span>
				<span className="ref-activity-group-chevron" aria-hidden>
					<ChevronDown />
				</span>
			</button>

			<div className={`ref-activity-group-collapse ${expanded ? 'is-open' : ''}`}>
				<div
					ref={bodyRef}
					className={`ref-activity-group-body ${group.pending || liveTurn ? 'ref-activity-group-body--live' : ''}`}
					onScroll={onBodyScroll}
				>
					{group.items.map((item, i) => (
						<ActivityRow key={i} item={item} onOpenFile={onOpenFile} />
					))}
				</div>
			</div>
		</div>
	);
}

function ActivityRow({
	item,
	onOpenFile,
}: {
	item: ActivitySegment;
	onOpenFile?: (relPath: string, revealLine?: number, revealEndLine?: number) => void;
}) {
	const readLink = item.agentReadLink;
	return (
		<div className={`ref-activity-group-row ref-activity-group-row--${item.status}`}>
			<span className="ref-activity-group-row-dot" aria-hidden />
			<div className="ref-activity-group-row-content">
				<div className="ref-activity-group-row-main">
					{readLink && onOpenFile ? (
						<button
							type="button"
							className="ref-agent-activity-ref-link"
							onClick={() => onOpenFile(readLink.path, readLink.startLine, readLink.endLine)}
						>
							{item.text}
						</button>
					) : (
						<span>{item.text}</span>
					)}
					{item.summary ? (
						<span className="ref-agent-activity-summary">{item.summary}</span>
					) : null}
				</div>
				{item.detail ? (
					<pre className="ref-agent-activity-detail">{item.detail}</pre>
				) : null}
				{item.resultLines && item.resultLines.length > 0 && item.resultKind ? (
					<AgentResultCard
						lines={item.resultLines}
						kind={item.resultKind}
						readSourcePath={item.agentReadLink?.path}
						onOpenFile={onOpenFile}
					/>
				) : null}
			</div>
		</div>
	);
}

function ExploreIcon() {
	return (
		<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<circle cx="11" cy="11" r="8" />
			<path d="M21 21l-4.35-4.35" />
		</svg>
	);
}

function SpinnerIcon() {
	return (
		<svg className="ref-activity-group-spinner" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
			<path d="M12 2a10 10 0 0 1 10 10" />
		</svg>
	);
}

function ChevronDown() {
	return (
		<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M6 9l6 6 6-6" />
		</svg>
	);
}
