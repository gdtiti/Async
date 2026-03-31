import type { ModelRequestParadigm, ShellSettings, UserModelEntry } from '../settingsStore.js';
import { normalizeThinkingLevel, type ThinkingLevel } from './thinkingLevel.js';

export type ResolvedChatModel = {
	requestModelId: string;
	paradigm: ModelRequestParadigm;
};

/** 应用内默认上限；单条模型可覆盖；若网关限制更低请自行调小 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 16384;
const MIN_MAX_OUT = 1;
const MAX_MAX_OUT = 128_000;

export type ResolvedModelRequest =
	| {
			ok: true;
			entryId: string;
			requestModelId: string;
			paradigm: ModelRequestParadigm;
			maxOutputTokens: number;
			apiKey: string;
			baseURL?: string;
	  }
	| { ok: false; message: string };

function entryById(entries: UserModelEntry[], id: string): UserModelEntry | undefined {
	return entries.find((e) => e.id === id);
}

function isUsable(e: UserModelEntry): boolean {
	return e.requestName.trim().length > 0;
}

export function clampMaxOutputTokens(n: number | undefined): number {
	const v = n ?? DEFAULT_MAX_OUTPUT_TOKENS;
	const floored = Math.floor(v);
	if (!Number.isFinite(floored)) {
		return DEFAULT_MAX_OUTPUT_TOKENS;
	}
	return Math.min(MAX_MAX_OUT, Math.max(MIN_MAX_OUT, floored));
}

function resolveCredentials(
	settings: ShellSettings,
	entry: UserModelEntry
): { ok: true; apiKey: string; baseURL?: string } | { ok: false; message: string } {
	const useC = entry.useCustomConnection === true;

	if (entry.paradigm === 'openai-compatible') {
		const key = useC
			? (entry.customApiKey?.trim() ?? '')
			: (settings.openAI?.apiKey?.trim() ?? '');
		if (!key) {
			return {
				ok: false,
				message: useC
					? '该模型已开启独立端点，但未填写 OpenAI 兼容 API 密钥。请在设置 → 模型 → 该模型的高级选项中填写，或关闭独立端点后使用全局密钥。'
					: '未配置 OpenAI 兼容 API Key。请在设置 → 模型 → 全局默认连接中填写。',
			};
		}
		const base = useC
			? (entry.customBaseURL?.trim() || undefined)
			: (settings.openAI?.baseURL?.trim() || undefined);
		return { ok: true, apiKey: key, baseURL: base };
	}

	if (entry.paradigm === 'anthropic') {
		const key = useC
			? (entry.customApiKey?.trim() ?? '')
			: (settings.anthropic?.apiKey?.trim() ?? '');
		if (!key) {
			return {
				ok: false,
				message: useC
					? '该模型已开启独立端点，但未填写 Anthropic API 密钥。请在高级选项中填写，或关闭独立端点后使用全局密钥。'
					: '未配置 Anthropic API Key。请在设置 → 模型 → 全局默认连接中填写。',
			};
		}
		const base = useC
			? (entry.customBaseURL?.trim() || undefined)
			: (settings.anthropic?.baseURL?.trim() || undefined);
		return { ok: true, apiKey: key, baseURL: base };
	}

	// gemini
	const key = useC ? (entry.customApiKey?.trim() ?? '') : (settings.gemini?.apiKey?.trim() ?? '');
	if (!key) {
		return {
			ok: false,
			message: useC
				? '该模型已开启独立端点，但未填写 Gemini API 密钥。请在高级选项中填写，或关闭独立端点后使用全局密钥。'
				: '未配置 Google Gemini API Key。请在设置 → 模型 → 全局默认连接中填写。',
		};
	}
	return { ok: true, apiKey: key, baseURL: undefined };
}

/**
 * 解析当前选择对应的模型 id、范式、输出上限与有效密钥（含按模型独立端点）。
 * @param selectionId `auto` 或用户模型条目的 id
 */
export function resolveModelRequest(settings: ShellSettings, selectionId: string): ResolvedModelRequest {
	const entries = settings.models?.entries ?? [];
	const enabledIds = settings.models?.enabledIds ?? [];
	const enabledSet = new Set(enabledIds);

	const pickFirstEntry = (): UserModelEntry | null => {
		for (const id of enabledIds) {
			const e = entryById(entries, id);
			if (e && enabledSet.has(e.id) && isUsable(e)) {
				return e;
			}
		}
		return null;
	};

	const sid = selectionId.trim().toLowerCase();
	let entry: UserModelEntry | null = null;
	if (sid === 'auto' || sid === '') {
		entry = pickFirstEntry();
		if (!entry) {
			return {
				ok: false,
				message:
					'无法解析当前模型：请在模型目录中至少添加并启用一条模型，填写「请求名称」；若选 Auto，请确保启用列表中有可用项。',
			};
		}
	} else {
		const e = entryById(entries, selectionId);
		if (!e || !enabledSet.has(e.id) || !isUsable(e)) {
			return {
				ok: false,
				message:
					'无法解析当前模型：该模型未启用、不存在或「请求名称」为空。请在模型目录中检查。',
			};
		}
		entry = e;
	}

	const creds = resolveCredentials(settings, entry);
	if (!creds.ok) {
		return creds;
	}

	return {
		ok: true,
		entryId: entry.id,
		requestModelId: entry.requestName.trim(),
		paradigm: entry.paradigm,
		maxOutputTokens: clampMaxOutputTokens(entry.maxOutputTokens),
		apiKey: creds.apiKey,
		baseURL: creds.baseURL,
	};
}

/**
 * @param selectionId `auto` 或用户模型条目的 id
 */
export function resolveChatModel(settings: ShellSettings, selectionId: string): ResolvedChatModel | null {
	const r = resolveModelRequest(settings, selectionId);
	if (!r.ok) {
		return null;
	}
	return { requestModelId: r.requestModelId, paradigm: r.paradigm };
}

/** 按模型选择器当前项（`auto` 或某条目 id）解析思考强度；无记录时默认为 medium。 */
export function resolveThinkingLevelForSelection(settings: ShellSettings, selectionId: string): ThinkingLevel {
	const trimmed = String(selectionId ?? '').trim();
	const key = trimmed === '' || trimmed.toLowerCase() === 'auto' ? 'auto' : trimmed;
	const raw = settings.models?.thinkingByModelId?.[key];
	return normalizeThinkingLevel(raw != null ? String(raw) : 'medium');
}
