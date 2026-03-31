import type { ModelRequestParadigm } from './llmProvider';

export const AUTO_MODEL_ID = 'auto';

/** 与主进程 `UserModelEntry` 对齐 */
export const DEFAULT_MODEL_MAX_OUTPUT_TOKENS = 16384;

export type UserModelEntry = {
	id: string;
	displayName: string;
	requestName: string;
	paradigm: ModelRequestParadigm;
	maxOutputTokens?: number;
	useCustomConnection?: boolean;
	customBaseURL?: string;
	customApiKey?: string;
};

export function createEmptyUserModel(): UserModelEntry {
	const id =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
	return {
		id,
		displayName: '',
		requestName: '',
		paradigm: 'openai-compatible',
		maxOutputTokens: DEFAULT_MODEL_MAX_OUTPUT_TOKENS,
	};
}

export function sanitizeEnabledIds(entries: UserModelEntry[], enabledIds: string[] | undefined | null): string[] {
	const valid = new Set(entries.map((e) => e.id));
	return (enabledIds ?? []).filter((id) => valid.has(id));
}

/** 若 defaultModel 指向不存在的条目，回退为 auto */
export function coerceDefaultModel(
	defaultModel: string | undefined,
	entries: UserModelEntry[],
	enabledIds: string[]
): string {
	const raw = defaultModel?.trim() || AUTO_MODEL_ID;
	if (raw.toLowerCase() === AUTO_MODEL_ID) {
		return AUTO_MODEL_ID;
	}
	const en = new Set(enabledIds);
	const exists = entries.some((e) => e.id === raw && en.has(e.id));
	return exists ? raw : AUTO_MODEL_ID;
}

export function paradigmLabel(p: ModelRequestParadigm): string {
	switch (p) {
		case 'openai-compatible':
			return 'OpenAI 兼容';
		case 'anthropic':
			return 'Anthropic';
		case 'gemini':
			return 'Gemini';
		default:
			return p;
	}
}
