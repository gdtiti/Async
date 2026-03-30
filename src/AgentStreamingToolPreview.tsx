/**
 * Agent 流式生成工具参数时的实时预览（write_to_file / str_replace 等）。
 * partialJson 可能不完整，用宽松方式抽取 path 与字符串字段尾部。
 */

function unescapeJsonFragment(s: string): string {
	let out = '';
	let i = 0;
	while (i < s.length) {
		const c = s[i]!;
		if (c === '\\' && i + 1 < s.length) {
			const n = s[i + 1]!;
			if (n === 'n') out += '\n';
			else if (n === 't') out += '\t';
			else if (n === 'r') out += '\r';
			else if (n === '"') out += '"';
			else if (n === '\\') out += '\\';
			else out += n;
			i += 2;
			continue;
		}
		if (c === '"') break;
		out += c;
		i++;
	}
	return out;
}

function tailAfterKey(partialJson: string, key: string): string | null {
	const re = new RegExp(`"${key}"\\s*:\\s*"`, 'm');
	const m = partialJson.match(re);
	if (m == null || m.index === undefined) return null;
	const start = m.index + m[0].length;
	return unescapeJsonFragment(partialJson.slice(start));
}

type Props = {
	toolName: string;
	partialJson: string;
	toolIndex: number;
	labels: { title: string; path: string; streaming: string };
};

export function AgentStreamingToolPreview({ toolName, partialJson, toolIndex, labels }: Props) {
	const pathGuess = tailAfterKey(partialJson, 'path') ?? '';
	let body = '';
	if (toolName === 'write_to_file') {
		body = tailAfterKey(partialJson, 'content') ?? '';
	} else if (toolName === 'str_replace') {
		const oldS = tailAfterKey(partialJson, 'old_str');
		const newS = tailAfterKey(partialJson, 'new_str');
		if (oldS || newS) {
			body = `--- old_str ---\n${oldS ?? '…'}\n\n--- new_str ---\n${newS ?? '…'}`;
		}
	} else {
		body = partialJson.length > 4000 ? `${partialJson.slice(0, 4000)}\n…` : partialJson;
	}

	const showBody = body.length > 0 || partialJson.length > 0;

	return (
		<div className="ref-agent-stream-tool" role="status" aria-live="polite">
			<div className="ref-agent-stream-tool-head">
				<span className="ref-agent-stream-tool-title">{labels.title}</span>
				<span className="ref-agent-stream-tool-meta">
					{toolIndex > 0 ? `#${toolIndex + 1} · ` : ''}
					{toolName}
				</span>
			</div>
			{pathGuess ? (
				<div className="ref-agent-stream-tool-path" title={pathGuess}>
					<span className="ref-agent-stream-tool-path-label">{labels.path}</span>
					<code>{pathGuess}</code>
				</div>
			) : null}
			{showBody ? (
				<div className="ref-agent-stream-tool-body">
					<span className="ref-agent-stream-tool-streaming-label">{labels.streaming}</span>
					<pre className="ref-agent-stream-tool-pre">{body || partialJson}</pre>
				</div>
			) : null}
		</div>
	);
}
