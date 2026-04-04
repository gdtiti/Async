import type { AppLocale, TFunction, TParams } from './types';
import { messagesZhCN } from './messages.zh-CN';
import { messagesEn } from './messages.en';

export function interpolate(template: string, params?: TParams): string {
	if (!params) {
		return template;
	}
	return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
		const v = params[key];
		return v === undefined || v === null ? '' : String(v);
	});
}

export function createTranslate(locale: AppLocale): TFunction {
	const primary = locale === 'en' ? messagesEn : messagesZhCN;
	const secondary = locale === 'en' ? messagesZhCN : messagesEn;
	return (key: string, params?: TParams): string => {
		const raw = primary[key] ?? secondary[key] ?? key;
		return interpolate(raw, params);
	};
}

/** 无 Context 时的回退（与默认语言一致） */
export const defaultT = createTranslate('zh-CN');

export function normalizeLocale(raw: unknown): AppLocale {
	if (raw === 'en') {
		return 'en';
	}
	return 'zh-CN';
}
