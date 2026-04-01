/**
 * 长对话压缩：仅影响发送给 LLM 的消息副本，磁盘仍保留完整历史。
 *
 * 策略：
 * - 估算 non-system 消息总字符数，超过阈值时触发压缩。
 * - 保留最近 KEEP_RECENT_TURNS 轮（user + assistant 对）完整消息。
 * - 将更早的消息通过一次独立 LLM 调用生成摘要，替换为单条 user 前置消息。
 * - 若线程已有缓存摘要且覆盖范围未变，直接复用，不重复调用 LLM。
 */

import type { ChatMessage } from '../threadStore.js';
import {
	budgetStructuredAssistantToolResults,
	formatChatMessageForCompactionSummary,
	isStructuredAssistantMessage,
} from '../../src/agentStructuredMessage.js';
import type { ShellSettings } from '../settingsStore.js';
import type { StreamHandlers, UnifiedChatOptions } from '../llm/types.js';
import { streamChatUnified } from '../llm/llmRouter.js';

/** 触发压缩的 token 估算阈值（字符数 / 4 粗估） */
const COMPRESS_TOKEN_THRESHOLD = 20_000;

/** 压缩后保留的最近完整轮数（user+assistant 各算一条） */
const KEEP_RECENT_TURNS = 8;

/** 发送给 LLM 前每条工具结果内容的最大字符数 */
const MAX_TOOL_RESULT_CHARS = 8_000;

function estimateTokens(messages: ChatMessage[]): number {
	return Math.ceil(messages.reduce((s, m) => s + m.content.length, 0) / 4);
}

/**
 * 对消息列表中的 tool_result 标记块做字符截断预算，
 * 避免单条大输出（如命令输出、搜索结果）撑爆 context 窗口。
 */
function budgetToolResults(messages: ChatMessage[], maxChars = MAX_TOOL_RESULT_CHARS): ChatMessage[] {
	return messages.map((m) => {
		if (m.role === 'assistant' && isStructuredAssistantMessage(m.content)) {
			const next = budgetStructuredAssistantToolResults(m.content, maxChars);
			return next === m.content ? m : { ...m, content: next };
		}
		if (!m.content.includes('<tool_result')) return m;
		// 替换每个 <tool_result ...>...</tool_result> 块中超长的内容
		const truncated = m.content.replace(
			/(<tool_result[^>]*>)([\s\S]*?)(<\/tool\u200c?_result>)/g,
			(_match, open: string, body: string, close: string) => {
				if (body.length <= maxChars) return open + body + close;
				return open + body.slice(0, maxChars) + '\n... (truncated for context budget)' + close;
			}
		);
		if (truncated === m.content) return m;
		return { ...m, content: truncated };
	});
}

/** 从 non-system 消息中提取最近 N 条（保留完整的 user/assistant 对）。 */
function splitOldAndRecent(
	nonSystem: ChatMessage[],
	keepCount: number
): { old: ChatMessage[]; recent: ChatMessage[] } {
	if (nonSystem.length <= keepCount) {
		return { old: [], recent: nonSystem };
	}
	// 确保 recent 从 user 消息开始（不截断在 assistant 中间）
	let cutAt = nonSystem.length - keepCount;
	while (cutAt < nonSystem.length && nonSystem[cutAt]?.role !== 'user') {
		cutAt++;
	}
	return { old: nonSystem.slice(0, cutAt), recent: nonSystem.slice(cutAt) };
}

async function generateSummary(
	settings: ShellSettings,
	oldMessages: ChatMessage[],
	options: UnifiedChatOptions
): Promise<string> {
	const historyText = oldMessages
		.map((m) => formatChatMessageForCompactionSummary(m.role, m.content, { maxChars: 4000, toolSnip: 900 }))
		.join('\n\n');

	const summaryMessages: ChatMessage[] = [
		{
			role: 'user',
			content:
				`Please summarize the following conversation history concisely. ` +
				`Focus on: what the user asked, what files were modified, what tools were called, ` +
				`and any important decisions or conclusions. ` +
				`Preserve all file paths, function names, and technical details.\n\n` +
				`<conversation_history>\n${historyText}\n</conversation_history>`,
		},
	];

	return new Promise<string>((resolve, reject) => {
		let result = '';
		const handlers: StreamHandlers = {
			onDelta: (text) => { result += text; },
			onDone: () => resolve(result),
			onError: (msg) => reject(new Error(msg)),
		};
		void streamChatUnified(settings, summaryMessages, { ...options, mode: 'ask' }, handlers);
	});
}

export type CompressResult = {
	messages: ChatMessage[];
	/** 新生成的摘要文本（若触发了压缩）；undefined 表示未压缩 */
	newSummary?: string;
	/** 新摘要覆盖的 non-system 消息数量 */
	newSummaryCoversCount?: number;
};

/**
 * 对即将发送给 LLM 的消息列表做发送端压缩。
 * 不修改原始数组，返回压缩后的副本。
 */
export async function compressForSend(
	messages: ChatMessage[],
	settings: ShellSettings,
	options: UnifiedChatOptions,
	cachedSummary?: string,
	cachedCoversCount?: number
): Promise<CompressResult> {
	const systemMsg = messages.find((m) => m.role === 'system');
	const nonSystem = messages.filter((m) => m.role !== 'system');

	if (estimateTokens(nonSystem) < COMPRESS_TOKEN_THRESHOLD) {
		return { messages: budgetToolResults(messages) };
	}

	const { old: oldMessages, recent } = splitOldAndRecent(nonSystem, KEEP_RECENT_TURNS);

	if (oldMessages.length === 0) {
		return { messages };
	}

	// 复用缓存摘要（覆盖范围相同时无需重新生成）
	let summary = cachedSummary;
	let coversCount = cachedCoversCount;
	if (!summary || coversCount !== oldMessages.length) {
		try {
			summary = await generateSummary(settings, oldMessages, options);
			coversCount = oldMessages.length;
		} catch {
			// 摘要生成失败：降级为保留更多最近轮次，丢弃最旧消息（而非完全不压缩）
			const { recent: fallbackRecent } = splitOldAndRecent(nonSystem, KEEP_RECENT_TURNS * 2);
			return {
				messages: budgetToolResults([
					...(systemMsg ? [systemMsg] : []),
					...fallbackRecent,
				]),
			};
		}
	}

	const summaryMessage: ChatMessage = {
		role: 'user',
		content: `[Conversation summary — ${oldMessages.length} earlier messages compressed]\n\n${summary}`,
	};

	const compressed: ChatMessage[] = budgetToolResults([
		...(systemMsg ? [systemMsg] : []),
		summaryMessage,
		...recent,
	]);

	return {
		messages: compressed,
		newSummary: summary,
		newSummaryCoversCount: coversCount,
	};
}
