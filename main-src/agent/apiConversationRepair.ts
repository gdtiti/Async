/**
 * 在发往模型前对对话做 tool 配对修复，对齐 Claude Code `utils/messages.ts` 中
 * `ensureToolResultPairing` 的核心语义：
 * - Forward：assistant 声明的每个 tool_call / tool_use 必须有对应 tool / tool_result，缺失则插入合成错误结果；
 * - Reverse：剥离引用不存在 tool_use 的孤儿 tool_result（及重复 tool_use_id）；
 * - 丢弃无前置 assistant（含 tool_calls）的孤儿 `role: tool`。
 *
 * @see D:/WebstormProjects/claude-code/claude-code-2.1.88/src/utils/messages.ts ensureToolResultPairing
 */

import type OpenAI from 'openai';
import type { ContentBlockParam, MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';

export type OAIMsg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

const SYNTHETIC_OPENAI_TOOL =
	'[Tool result unavailable: conversation pairing repair — missing or invalid tool response.]';

const SYNTHETIC_ANTHROPIC_TOOL =
	'Tool result unavailable: conversation pairing repair — missing or invalid tool response.';

function dedupeOpenAIAssistantToolCalls(
	assist: OpenAI.Chat.ChatCompletionAssistantMessageParam
): OpenAI.Chat.ChatCompletionAssistantMessageParam {
	const tc = assist.tool_calls;
	if (!tc?.length) return assist;
	const seen = new Set<string>();
	const next = tc.filter((x) => {
		const id = x.id;
		if (!id || seen.has(id)) return false;
		seen.add(id);
		return true;
	});
	return next.length === tc.length ? assist : { ...assist, tool_calls: next };
}

/**
 * 修复 OpenAI Chat Completions 消息序列中的 tool_calls ↔ tool 配对。
 * 保留 `system` 及非工具相关消息原样顺移。
 */
export function repairOpenAIToolPairing(messages: OAIMsg[]): OAIMsg[] {
	const out: OAIMsg[] = [];
	let i = 0;
	while (i < messages.length) {
		const m = messages[i]!;

		if (m.role === 'tool') {
			i++;
			continue;
		}

		if (m.role === 'assistant') {
			const raw = m as OpenAI.Chat.ChatCompletionAssistantMessageParam;
			const tc = raw.tool_calls;
			if (Array.isArray(tc) && tc.length > 0) {
				const assist = dedupeOpenAIAssistantToolCalls(raw);
				const idOrder = (assist.tool_calls ?? [])
					.map((x) => x.id)
					.filter((id): id is string => typeof id === 'string' && id.length > 0);
				const ids = new Set(idOrder);
				if (ids.size === 0) {
					out.push(assist);
					i++;
					continue;
				}
				out.push(assist);
				i++;
				const responded = new Map<string, OpenAI.Chat.ChatCompletionToolMessageParam>();
				while (i < messages.length && messages[i]!.role === 'tool') {
					const t = messages[i] as OpenAI.Chat.ChatCompletionToolMessageParam;
					const id = t.tool_call_id;
					if (ids.has(id) && !responded.has(id)) {
						responded.set(id, t);
					}
					i++;
				}
				for (const id of idOrder) {
					const hit = responded.get(id);
					if (hit) {
						out.push(hit);
					} else {
						out.push({
							role: 'tool',
							tool_call_id: id,
							content: SYNTHETIC_OPENAI_TOOL,
						});
					}
				}
				continue;
			}
		}

		out.push(m);
		i++;
	}
	return out;
}

function dedupeAnthropicAssistantToolUses(content: ContentBlockParam[]): ContentBlockParam[] {
	const seen = new Set<string>();
	const out: ContentBlockParam[] = [];
	for (const b of content) {
		if (b.type === 'tool_use') {
			const id = b.id;
			if (seen.has(id)) continue;
			seen.add(id);
		}
		out.push(b);
	}
	return out;
}

/**
 * 修复 Anthropic Messages API 序列中 tool_use ↔ tool_result 配对。
 */
export function repairAnthropicToolPairing(messages: MessageParam[]): MessageParam[] {
	const out: MessageParam[] = [];
	let i = 0;
	while (i < messages.length) {
		const m = messages[i]!;

		if (m.role === 'assistant' && Array.isArray(m.content)) {
			const dedupedContent = dedupeAnthropicAssistantToolUses(m.content);
			const toolUseIds: string[] = [];
			for (const b of dedupedContent) {
				if (b.type === 'tool_use') {
					toolUseIds.push(b.id);
				}
			}
			const idOrder = [...new Set(toolUseIds)];
			const idSet = new Set(idOrder);

			if (idOrder.length === 0) {
				out.push(
					dedupedContent === m.content ? m : { ...m, content: dedupedContent }
				);
				i++;
				continue;
			}

			const assistMsg =
				dedupedContent === m.content ? m : { ...m, content: dedupedContent };
			out.push(assistMsg);
			i++;

			const carryText: ContentBlockParam[] = [];
			const trById = new Map<string, ToolResultBlockParam>();

			if (i < messages.length && messages[i]!.role === 'user') {
				const u = messages[i]!;
				const c = u.content;
				if (Array.isArray(c)) {
					for (const block of c as ContentBlockParam[]) {
						if (block.type === 'tool_result') {
							const tr = block as ToolResultBlockParam;
							const tid = tr.tool_use_id;
							if (idSet.has(tid) && !trById.has(tid)) {
								trById.set(tid, tr);
							}
						} else {
							carryText.push(block);
						}
					}
				} else if (typeof c === 'string' && c.trim()) {
					carryText.push({ type: 'text', text: c });
				}
				i++;
			}

			const toolBlocks: ToolResultBlockParam[] = idOrder.map((id) => {
				const hit = trById.get(id);
				return (
					hit ?? {
						type: 'tool_result' as const,
						tool_use_id: id,
						content: SYNTHETIC_ANTHROPIC_TOOL,
						is_error: true,
					}
				);
			});

			const userContent: ContentBlockParam[] = [...toolBlocks, ...carryText];
			out.push({ role: 'user', content: userContent });
			continue;
		}

		if (m.role === 'user') {
			const c = m.content;
			if (Array.isArray(c) && c.length > 0) {
				const onlyTr = (c as ContentBlockParam[]).every((b) => b.type === 'tool_result');
				if (onlyTr) {
					const prev = out[out.length - 1];
					if (!prev || prev.role !== 'assistant') {
						i++;
						continue;
					}
				}
			}
		}

		out.push(m);
		i++;
	}
	return out;
}
