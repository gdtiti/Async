import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentCommandCard } from './AgentCommandCard';
import { AgentDiffCard } from './AgentDiffCard';
import { AgentEditCard } from './AgentEditCard';
import { segmentAssistantContent, type AssistantSegment } from './agentChatSegments';
import { useI18n } from './i18n';

type Props = {
	content: string;
	agentUi?: boolean;
	workspaceRoot?: string | null;
	onOpenAgentFile?: (relPath: string, revealLine?: number) => void;
	showAgentWorking?: boolean;
};

export function ChatMarkdown({
	content,
	agentUi = false,
	workspaceRoot,
	onOpenAgentFile,
	showAgentWorking = false,
}: Props) {
	const { t } = useI18n();
	if (!agentUi) {
		return (
			<div className="ref-md-root">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
			</div>
		);
	}

	const segments = segmentAssistantContent(content, { t });
	const renderSegments: AssistantSegment[] = [...segments];
	const lastSeg = renderSegments[renderSegments.length - 1];
	const hasPendingTail = lastSeg?.type === 'activity' && lastSeg.status === 'pending';
	if (showAgentWorking && !hasPendingTail) {
		renderSegments.push({
			type: 'activity',
			text: t('agent.working'),
			status: 'pending',
		});
	}
	if (renderSegments.length === 0) {
		return <div className="ref-md-root ref-md-root--agent-chat" />;
	}
	if (renderSegments.length === 1 && renderSegments[0]!.type === 'markdown') {
		return (
			<div className="ref-md-root ref-md-root--agent-chat">
				<ReactMarkdown remarkPlugins={[remarkGfm]}>{renderSegments[0]!.text}</ReactMarkdown>
			</div>
		);
	}

	return (
		<div className="ref-md-root ref-md-root--agent-chat">
			{renderSegments.map((seg, i) => {
				switch (seg.type) {
					case 'markdown':
						return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>;
					case 'diff':
						return (
							<AgentDiffCard
								key={i}
								diff={seg.diff}
								workspaceRoot={workspaceRoot}
								onOpenFile={onOpenAgentFile}
							/>
						);
					case 'command':
						return <AgentCommandCard key={i} lang={seg.lang} body={seg.body} />;
					case 'file_edit':
						return (
							<AgentEditCard
								key={i}
								edit={seg}
								onOpenFile={onOpenAgentFile}
							/>
						);
					case 'file_changes':
						return null;
					case 'activity':
						return (
							<div key={i} className={`ref-agent-activity ref-agent-activity--${seg.status}`}>
								<div className="ref-agent-activity-main">
									<span className="ref-agent-activity-dot" aria-hidden />
									<span className="ref-agent-activity-text">{seg.text}</span>
									{seg.summary ? (
										<span className="ref-agent-activity-summary">{seg.summary}</span>
									) : null}
								</div>
								{seg.detail ? (
									<pre className="ref-agent-activity-detail">{seg.detail}</pre>
								) : null}
							</div>
						);
					case 'tool_call':
						return (
							<p key={i} className="ref-agent-activity">
								{t('agent.toolPending', { name: seg.name })}
							</p>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}
