import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { ComposerMode } from './ComposerPlusMenu';
import { useI18n } from './i18n';

type Phase = 'thinking' | 'streaming' | 'done';

type Props = {
	phase: Phase;
	/** 首 token 前已用秒数（思考阶段）；done 时为冻结值 */
	elapsedSeconds: number;
	/** 整段生成总秒数（done 时可选） */
	totalStreamSeconds?: number | null;
	mode: ComposerMode;
	/** 受控折叠；默认收起 */
	defaultOpen?: boolean;
	/** 扩展思考流式正文（Anthropic 等）；不写入历史气泡 */
	streamingThinking?: string;
};

export function ComposerThoughtBlock({
	phase,
	elapsedSeconds,
	totalStreamSeconds,
	mode,
	defaultOpen = false,
	streamingThinking = '',
}: Props) {
	const { t } = useI18n();
	const [open, setOpen] = useState(defaultOpen);

	useEffect(() => {
		if (streamingThinking.trim()) {
			setOpen(true);
		}
	}, [streamingThinking]);
	const id = useId();
	const headId = `${id}-head`;
	const panelId = `${id}-panel`;

	const sec = Math.max(0, elapsedSeconds);
	const secLabel = sec < 10 ? sec.toFixed(1) : String(Math.round(sec));

	const modeHint = useMemo(() => {
		const key =
			mode === 'ask'
				? 'thought.mode.ask'
				: mode === 'plan'
					? 'thought.mode.plan'
					: mode === 'debug'
						? 'thought.mode.debug'
						: 'thought.mode.agent';
		return t(key);
	}, [mode, t]);

	const detailText = useMemo(() => {
		if (phase === 'thinking') {
			return t('thought.detail.thinking', { modeHint });
		}
		if (phase === 'streaming') {
			return t('thought.detail.streaming', { modeHint });
		}
		const total =
			totalStreamSeconds != null && totalStreamSeconds > 0
				? t('thought.totalBlock', { sec: Math.max(1, Math.round(totalStreamSeconds)) })
				: '';
		return t('thought.detail.done', {
			modeHint,
			sec: Math.max(1, Math.round(elapsedSeconds)),
			total,
		});
	}, [phase, modeHint, elapsedSeconds, totalStreamSeconds, t]);

	const headline =
		phase === 'thinking' ? t('thought.thinking', { sec: secLabel }) : t('thought.for', { sec: secLabel });

	const onToggle = useCallback(() => setOpen((o) => !o), []);

	return (
		<div className="ref-thought-block">
			<button
				type="button"
				id={headId}
				className="ref-thought-head"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={onToggle}
			>
				<span className="ref-thought-head-label">{headline}</span>
				<span className={`ref-thought-chev ${open ? 'is-open' : ''}`} aria-hidden>
					<svg
						className="ref-thought-chev-svg"
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</span>
			</button>
			{open ? (
				<div id={panelId} role="region" aria-labelledby={headId} className="ref-thought-panel">
					{streamingThinking.trim() ? (
						<div className="ref-thought-reasoning-wrap">
							<pre className="ref-thought-reasoning-pre">{streamingThinking}</pre>
						</div>
					) : null}
					<pre className="ref-thought-panel-pre">{detailText}</pre>
				</div>
			) : null}
		</div>
	);
}
