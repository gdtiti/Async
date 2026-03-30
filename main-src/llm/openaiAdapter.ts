import OpenAI from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import type { ChatMessage } from '../threadStore.js';
import type { ShellSettings } from '../settingsStore.js';
import { composeSystem, temperatureForMode } from './modePrompts.js';
import type { StreamHandlers, UnifiedChatOptions } from './types.js';
import { openAIReasoningEffort } from './thinkingLevel.js';

export async function streamOpenAICompatible(
	settings: ShellSettings,
	messages: ChatMessage[],
	options: UnifiedChatOptions,
	handlers: StreamHandlers
): Promise<void> {
	const key = settings.openAI?.apiKey?.trim();
	if (!key) {
		handlers.onError('未配置 OpenAI 兼容 API Key。请在设置 → Models → API Keys 中填写。');
		return;
	}

	const baseURL = settings.openAI?.baseURL?.trim() || undefined;
	const model = options.requestModelId.trim();
	if (!model) {
		handlers.onError('模型请求名称为空。请在 Models 中编辑该模型的「请求名称」。');
		return;
	}

	const proxyRaw = settings.openAI?.proxyUrl?.trim();
	let httpAgent: InstanceType<typeof HttpsProxyAgent> | undefined;
	if (proxyRaw) {
		try {
			httpAgent = new HttpsProxyAgent(proxyRaw);
		} catch {
			handlers.onError('代理地址无效，请在 Models 中检查 HTTP 代理格式（如 http://127.0.0.1:7890）。');
			return;
		}
	}

	const client = new OpenAI({
		apiKey: key,
		baseURL,
		httpAgent,
		dangerouslyAllowBrowser: false,
	});

	const apiMessages = messages
		.filter((m) => m.role !== 'system')
		.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

	const storedSystem = messages.find((m) => m.role === 'system');
	const systemContent = composeSystem(storedSystem?.content, options.mode, options.agentSystemAppend);
	const temperature = temperatureForMode(options.mode);
	const effort = openAIReasoningEffort(options.thinkingLevel ?? 'off');

	let full = '';
	try {
		const stream = await client.chat.completions.create(
			{
				model,
				messages: [{ role: 'system' as const, content: systemContent }, ...apiMessages],
				stream: true,
				temperature,
				...(effort ? { reasoning_effort: effort } : {}),
			},
			{ signal: options.signal }
		);

		for await (const chunk of stream) {
			if (options.signal.aborted) {
				break;
			}
			const piece = chunk.choices[0]?.delta?.content ?? '';
			if (piece) {
				full += piece;
				handlers.onDelta(piece);
			}
		}
		handlers.onDone(full);
	} catch (e: unknown) {
		if (options.signal.aborted) {
			handlers.onDone(full);
			return;
		}
		const msg = e instanceof Error ? e.message : String(e);
		handlers.onError(msg);
	}
}
