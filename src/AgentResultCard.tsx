/**
 * AI 工具调用成功结果的可折叠内联卡片（search_files / read_file / list_dir / execute_command）。
 *
 * 动画：播放时固定高度 + overflow-y:auto（滚动条），逐行追加并自动滚底。
 * 播完后：read/search/命令输出用 Monaco colorize 做语法高亮（与编辑器主题一致）。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { layout, prepare } from '@chenglou/pretext';
import type { ActivityResultLine } from './agentChatSegments';
import {
	colorizeJoinedLines,
	colorizeSearchMatchLines,
	languageIdFromPath,
} from './agentResultMonaco';
import { FileTypeIcon } from './fileTypeIcons';

const RESULT_MONO_FONT = '11.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const RESULT_MONO_LH = 11.5 * 1.55;
const RESULT_PREVIEW_MAX_PX = 200;

/** 首行较快出现，后续行在总时长内均分，避免少行时像「一整块弹出」 */
function rowIntervalMs(total: number): number {
	if (total <= 1) return 0;
	const minTotal = 820;
	const maxTotal = 2300;
	const target = Math.min(maxTotal, Math.max(minTotal, 40 * total));
	return Math.max(14, Math.floor(target / (total - 1)));
}

function fileBasename(p: string): string {
	const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
	return i >= 0 ? p.slice(i + 1) : p;
}

function sliceByPixelBudget(
	lines: ActivityResultLine[],
	containerWidthPx: number,
	maxPx: number
): ActivityResultLine[] {
	const w = Math.max(48, containerWidthPx - 24);
	let acc = 0;
	const out: ActivityResultLine[] = [];
	for (const line of lines) {
		const text = line.text || '\u00a0';
		const p = prepare(text, RESULT_MONO_FONT, { whiteSpace: 'pre-wrap' });
		const h = layout(p, w, RESULT_MONO_LH).height;
		if (acc + h > maxPx && out.length > 0) break;
		acc += h;
		out.push(line);
	}
	return out;
}

function stableLinesSignature(lines: readonly ActivityResultLine[]): string {
	return lines
		.map((l) => `${l.text}\x1f${l.filePath ?? ''}\x1f${l.lineNo ?? ''}\x1f${l.matchText ?? ''}`)
		.join('\x1e');
}

const completedResultAnimSignatures = new Set<string>();
const MAX_COMPLETED_RESULT_ANIM_SIGNATURES = 480;

function rememberCompletedResultAnim(sig: string) {
	if (completedResultAnimSignatures.size >= MAX_COMPLETED_RESULT_ANIM_SIGNATURES) {
		const first = completedResultAnimSignatures.values().next().value as string | undefined;
		if (first !== undefined) completedResultAnimSignatures.delete(first);
	}
	completedResultAnimSignatures.add(sig);
}

function prefersReducedMotion(): boolean {
	try {
		return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	} catch {
		return false;
	}
}

type Props = {
	lines: ActivityResultLine[];
	kind: 'search' | 'read' | 'dir' | 'plain';
	/** read_file：用于选择 Monaco 语言 */
	readSourcePath?: string;
	onOpenFile?: (relPath: string, revealLine?: number) => void;
	/**
	 * 仅在本轮 Agent 实时生成（最后一条助手且 awaiting）时为 true。
	 * 历史消息 / 重开应用后为 false，避免依赖进程内 Set 导致整段结果再次逐行「流式」播放。
	 */
	animateLineReveal?: boolean;
};

export function AgentResultCard({
	lines,
	kind,
	readSourcePath,
	onOpenFile,
	animateLineReveal = false,
}: Props) {
	const [expanded, setExpanded] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const streamBodyRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(320);

	const linesSignature = useMemo(() => stableLinesSignature(lines), [lines]);

	const alreadySeen = completedResultAnimSignatures.has(linesSignature);
	const skipAnim =
		!animateLineReveal || alreadySeen || prefersReducedMotion() || lines.length === 0;

	const [revealedCount, setRevealedCount] = useState<number>(() => (skipAnim ? lines.length : 0));
	const [streaming, setStreaming] = useState<boolean>(() => !skipAnim && lines.length > 0);

	const [highlightedLines, setHighlightedLines] = useState<(string | null)[] | null>(null);

	const prevSigRef = useRef<string>(linesSignature);
	if (prevSigRef.current !== linesSignature) {
		prevSigRef.current = linesSignature;
		const skip =
			!animateLineReveal ||
			completedResultAnimSignatures.has(linesSignature) ||
			prefersReducedMotion() ||
			lines.length === 0;
		setRevealedCount(skip ? lines.length : 0);
		setStreaming(!skip && lines.length > 0);
		setHighlightedLines(null);
	}

	useEffect(() => {
		if (!streaming) return;
		if (revealedCount >= lines.length) {
			setStreaming(false);
			rememberCompletedResultAnim(linesSignature);
			return;
		}

		const between = rowIntervalMs(lines.length);
		const delay = revealedCount === 0 ? Math.min(56, Math.max(20, between || 40)) : between || 32;

		const id = setTimeout(() => {
			setRevealedCount((c) => c + 1);
		}, delay);
		return () => clearTimeout(id);
	}, [streaming, revealedCount, lines.length, linesSignature]);

	useLayoutEffect(() => {
		if (!streaming) return;
		const el = streamBodyRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [revealedCount, streaming]);

	useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const apply = (w: number) => { if (w > 0) setContainerWidth(w); };
		apply(el.getBoundingClientRect().width);
		const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? 0));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const canHighlight = kind === 'read' || kind === 'search' || kind === 'plain';

	useEffect(() => {
		let cancelled = false;
		if (streaming) {
			setHighlightedLines(null);
			return () => { cancelled = true; };
		}
		if (!canHighlight) {
			setHighlightedLines(null);
			return () => { cancelled = true; };
		}

		(async () => {
			if (kind === 'read') {
				const lang = readSourcePath ? languageIdFromPath(readSourcePath) : 'plaintext';
				const texts = lines.map((l) => (l.lineNo !== undefined ? (l.matchText ?? '') : l.text));
				const out = await colorizeJoinedLines(texts, lang);
				if (!cancelled) setHighlightedLines(out);
			} else if (kind === 'search') {
				const out = await colorizeSearchMatchLines(lines);
				if (!cancelled) setHighlightedLines(out);
			} else if (kind === 'plain') {
				const texts = lines.map((l) => l.text);
				const out = await colorizeJoinedLines(texts, 'shell');
				if (!cancelled) setHighlightedLines(out);
			}
		})();

		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps -- lines 内容由 linesSignature 表征
	}, [linesSignature, streaming, kind, readSourcePath, canHighlight]);

	const previewLines = useMemo(
		() => sliceByPixelBudget(lines, containerWidth, RESULT_PREVIEW_MAX_PX),
		[lines, containerWidth]
	);

	const needsExpand = !streaming && previewLines.length < lines.length;
	const hiddenCount = lines.length - previewLines.length;

	const displayLines = streaming
		? lines.slice(0, revealedCount)
		: expanded
			? lines
			: previewLines;

	const renderHighlightedCode = (i: number, plain: string, className: string) => {
		const hi = highlightedLines?.[i];
		if (hi) {
			return <code className={className} dangerouslySetInnerHTML={{ __html: hi }} />;
		}
		return <code className={className}>{plain}</code>;
	};

	const renderLine = (line: ActivityResultLine, i: number) => {
		if (kind === 'search' && line.filePath !== undefined) {
			const canOpen = Boolean(onOpenFile && line.filePath);
			const fname = fileBasename(line.filePath);
			const matchPlain = line.matchText ?? '';
			return (
				<div key={i} className="ref-result-card-line ref-result-card-line--search">
					<span className="ref-result-card-file-ico" aria-hidden>
						<FileTypeIcon fileName={fname} isDirectory={false} className="ref-result-card-ico-svg" />
					</span>
					{canOpen ? (
						<button
							type="button"
							className="ref-result-card-file-link"
							onClick={() => onOpenFile!(line.filePath!, line.lineNo)}
							title={`${line.filePath}${line.lineNo ? `:${line.lineNo}` : ''}`}
						>
							<span className="ref-result-card-fname">{fname}</span>
							{line.lineNo !== undefined ? (
								<span className="ref-result-card-lineno">:{line.lineNo}</span>
							) : null}
						</button>
					) : (
						<span className="ref-result-card-fname">{fname}</span>
					)}
					{matchPlain !== '' || highlightedLines?.[i] ? (
						renderHighlightedCode(i, matchPlain, 'ref-result-card-match ref-result-card-match--monaco')
					) : null}
				</div>
			);
		}

		if (kind === 'search') {
			return (
				<div key={i} className="ref-result-card-line">
					{renderHighlightedCode(i, line.text, 'ref-result-card-match ref-result-card-match--monaco')}
				</div>
			);
		}

		if (kind === 'read' && line.lineNo !== undefined) {
			const plain = line.matchText ?? '';
			return (
				<div key={i} className="ref-result-card-line ref-result-card-line--read">
					<span className="ref-result-card-lineno-gutter" aria-hidden>{line.lineNo}</span>
					{renderHighlightedCode(i, plain, 'ref-result-card-match ref-result-card-match--monaco')}
				</div>
			);
		}

		if (kind === 'read') {
			return (
				<div key={i} className="ref-result-card-line ref-result-card-line--read">
					{renderHighlightedCode(i, line.text, 'ref-result-card-match ref-result-card-match--monaco')}
				</div>
			);
		}

		if (kind === 'dir') {
			const isDir = line.text.startsWith('[dir]');
			const name = line.text.replace(/^\[(dir|file)\]\s*/, '');
			return (
				<div key={i} className="ref-result-card-line ref-result-card-line--dir">
					<span className="ref-result-card-file-ico" aria-hidden>
						<FileTypeIcon fileName={name} isDirectory={isDir} className="ref-result-card-ico-svg" />
					</span>
					<span className={`ref-result-card-fname ${isDir ? 'ref-result-card-fname--dir' : ''}`}>{name}</span>
				</div>
			);
		}

		if (kind === 'plain') {
			return (
				<div key={i} className="ref-result-card-line ref-result-card-line--plain">
					{renderHighlightedCode(i, line.text, 'ref-result-card-match ref-result-card-match--monaco')}
				</div>
			);
		}

		return (
			<div key={i} className="ref-result-card-line">
				<code className="ref-result-card-match">{line.text}</code>
			</div>
		);
	};

	if (lines.length === 0) return null;

	return (
		<div ref={containerRef} className="ref-result-card">
			{streaming ? (
				<div ref={streamBodyRef} className="ref-result-card-body--stream">
					{displayLines.map((line, i) => renderLine(line, i))}
					<div className="ref-result-card-stream-cursor" aria-hidden />
				</div>
			) : (
				<>
					<div
						className={[
							'ref-result-card-body',
							!expanded ? 'ref-result-card-body--preview' : 'ref-result-card-body--expanded',
						].join(' ')}
					>
						{displayLines.map((line, i) => renderLine(line, i))}
					</div>
					{needsExpand ? (
						<div className={['ref-result-card-chrome', expanded ? 'is-expanded' : ''].filter(Boolean).join(' ')}>
							{!expanded ? <div className="ref-result-card-fade" aria-hidden /> : null}
							<button
								type="button"
								className="ref-result-card-toggle"
								aria-expanded={expanded}
								onClick={() => setExpanded((v) => !v)}
							>
								{expanded ? (
									<>
										<IconChevron up />
										<span>收起</span>
									</>
								) : (
									<>
										<IconChevron up={false} />
										<span>展开全部 {hiddenCount} 行</span>
									</>
								)}
							</button>
						</div>
					) : null}
				</>
			)}
		</div>
	);
}

function IconChevron({ up }: { up: boolean }) {
	return (
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			{up ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
		</svg>
	);
}
