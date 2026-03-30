import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentCustomization } from './agentSettingsTypes.js';
import { resolveAsyncDataDir } from './dataDir.js';
import type { ThinkingLevel } from './llm/thinkingLevel.js';
export type { ThinkingLevel } from './llm/thinkingLevel.js';
export type { AgentCustomization, AgentRule, AgentSkill, AgentSubagent, AgentCommand } from './agentSettingsTypes.js';

/** 单条用户模型实际请求时使用的协议（与适配器一致） */
export type ModelRequestParadigm = 'openai-compatible' | 'anthropic' | 'gemini';

export type UserModelEntry = {
	/** 稳定 id，用于设置与选择器 */
	id: string;
	/** 界面显示名称 */
	displayName: string;
	/** 发给 API 的模型名 */
	requestName: string;
	paradigm: ModelRequestParadigm;
};

export type LLMProviderId = ModelRequestParadigm;

/** 主界面左右侧栏宽度（桌面端持久化，避免 file:// localStorage 因路径变化丢失） */
export type SidebarLayoutPx = { left: number; right: number };

export type ShellUiSettings = {
	sidebarLayout?: SidebarLayoutPx;
};

export type ShellSettings = {
	/** 界面语言：zh-CN 简体中文（默认）、en 英文 */
	language?: 'zh-CN' | 'en';
	/** @deprecated 已由每条模型的 paradigm 取代，保留仅兼容旧 settings.json */
	llm?: {
		provider?: LLMProviderId;
	};
	openAI?: {
		apiKey?: string;
		baseURL?: string;
		/** HTTP/HTTPS 代理，如 http://127.0.0.1:7890 */
		proxyUrl?: string;
	};
	anthropic?: {
		apiKey?: string;
		baseURL?: string;
	};
	gemini?: {
		apiKey?: string;
	};
	/** 当前选择：`auto` 或某条用户模型的 id */
	defaultModel?: string;
	/**
	 * 推理/扩展思考强度（Anthropic extended thinking、OpenAI reasoning_effort 等）。
	 * Gemini 等路径可能忽略。
	 */
	thinkingLevel?: ThinkingLevel;
	models?: {
		/** 用户自添加的模型条目 */
		entries?: UserModelEntry[];
		/** 在选择器中启用的条目 id，顺序决定 Auto 的优先级 */
		enabledIds?: string[];
	};
	recentWorkspaces?: string[];
	lastOpenedWorkspace?: string | null;
	/** Rules / Skills / Subagents / Commands（对话注入） */
	agent?: AgentCustomization;
	/** 窗口布局等纯界面状态 */
	ui?: ShellUiSettings;
};

const defaultSettings: ShellSettings = {
	language: 'zh-CN',
	defaultModel: 'auto',
	thinkingLevel: 'off',
	recentWorkspaces: [],
	lastOpenedWorkspace: null,
};

const MAX_RECENTS = 24;

let cached: ShellSettings = { ...defaultSettings };
let settingsPath = '';

export function initSettingsStore(userData: string): void {
	const dir = resolveAsyncDataDir(userData);
	fs.mkdirSync(dir, { recursive: true });
	settingsPath = path.join(dir, 'settings.json');
	if (fs.existsSync(settingsPath)) {
		try {
			const raw = fs.readFileSync(settingsPath, 'utf8');
			cached = { ...defaultSettings, ...JSON.parse(raw) };
		} catch {
			cached = { ...defaultSettings };
		}
	} else {
		cached = { ...defaultSettings };
		save();
	}
}

export function getSettings(): ShellSettings {
	return { ...cached };
}

export function patchSettings(partial: Partial<ShellSettings>): ShellSettings {
	const { ui: partialUi, ...partialRest } = partial;

	const nextModels =
		partial.models !== undefined
			? {
					entries:
						partial.models.entries !== undefined
							? partial.models.entries
							: (cached.models?.entries ?? []),
					enabledIds:
						partial.models.enabledIds !== undefined
							? partial.models.enabledIds
							: (cached.models?.enabledIds ?? []),
				}
			: cached.models;

	const nextAgent =
		partial.agent !== undefined
			? {
					importThirdPartyConfigs:
						partial.agent.importThirdPartyConfigs ?? cached.agent?.importThirdPartyConfigs ?? false,
					rules: partial.agent.rules ?? cached.agent?.rules ?? [],
					skills: partial.agent.skills ?? cached.agent?.skills ?? [],
					subagents: partial.agent.subagents ?? cached.agent?.subagents ?? [],
					commands: partial.agent.commands ?? cached.agent?.commands ?? [],
				}
			: cached.agent;

	const mergedUi =
		partialUi !== undefined ? { ...(cached.ui ?? {}), ...partialUi } : cached.ui;

	cached = {
		...cached,
		...partialRest,
		llm: partial.llm ? { ...(cached.llm ?? {}), ...partial.llm } : cached.llm,
		openAI: partial.openAI ? { ...cached.openAI, ...partial.openAI } : cached.openAI,
		anthropic: partial.anthropic ? { ...(cached.anthropic ?? {}), ...partial.anthropic } : cached.anthropic,
		gemini: partial.gemini ? { ...(cached.gemini ?? {}), ...partial.gemini } : cached.gemini,
		models: nextModels,
		agent: nextAgent,
		ui: mergedUi,
	};
	save();
	return getSettings();
}

export function getRecentWorkspaces(): string[] {
	const raw = cached.recentWorkspaces ?? [];
	return raw.filter((p) => typeof p === 'string' && p.length > 0);
}

export function rememberWorkspace(root: string): void {
	const norm = path.resolve(root);
	const rest = getRecentWorkspaces().filter((p) => path.resolve(p) !== norm);
	cached.recentWorkspaces = [norm, ...rest].slice(0, MAX_RECENTS);
	cached.lastOpenedWorkspace = norm;
	save();
}

export function getRestorableWorkspace(): string | null {
	const p = cached.lastOpenedWorkspace;
	if (!p || typeof p !== 'string') {
		return null;
	}
	const norm = path.resolve(p);
	try {
		if (fs.existsSync(norm) && fs.statSync(norm).isDirectory()) {
			return norm;
		}
	} catch {
		/* ignore */
	}
	return null;
}

function save(): void {
	if (!settingsPath) {
		return;
	}
	fs.writeFileSync(settingsPath, JSON.stringify(cached, null, 2), 'utf8');
}
