import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { resolveAsyncDataDir } from './dataDir.js';
import { appendSuffixToStructuredAssistant, isStructuredAssistantMessage } from '../src/agentStructuredMessage.js';

export type ChatMessage = {
	role: 'user' | 'assistant' | 'system';
	content: string;
};

export type ThreadTokenUsage = {
	totalInput: number;
	totalOutput: number;
};

export type FileStateAction = 'created' | 'modified' | 'deleted';

export type FileState = {
	action: FileStateAction;
	firstTouchedAt: number;
	touchCount: number;
};

export type ThreadRecord = {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messages: ChatMessage[];
	/** 本会话累计 token 用量（各回合叠加） */
	tokenUsage?: ThreadTokenUsage;
	/** Agent 本会话触碰过的文件（相对路径 → 状态） */
	fileStates?: Record<string, FileState>;
	/** 已压缩的历史摘要（仅影响发送给 LLM 的副本，磁盘仍存完整消息） */
	summary?: string;
	/** 摘要覆盖的消息数量（从第 0 条起算，不含 system） */
	summaryCoversMessageCount?: number;
	/** 结构化计划（从 Plan 模式输出解析而来） */
	plan?: ThreadPlan;
};

export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type PlanStep = {
	id: string;
	title: string;
	description: string;
	targetFiles?: string[];
	status: PlanStepStatus;
};

export type ThreadPlan = {
	title: string;
	steps: PlanStep[];
	updatedAt: number;
};

type StoreFile = {
	currentThreadId: string | null;
	threads: Record<string, ThreadRecord>;
};

let storePath = '';
let data: StoreFile = { currentThreadId: null, threads: {} };

export function initThreadStore(userData: string): void {
	const dir = resolveAsyncDataDir(userData);
	fs.mkdirSync(dir, { recursive: true });
	storePath = path.join(dir, 'threads.json');
	load();
}

function load(): void {
	if (!fs.existsSync(storePath)) {
		data = { currentThreadId: null, threads: {} };
		save();
		return;
	}
	try {
		const raw = fs.readFileSync(storePath, 'utf8');
		data = JSON.parse(raw) as StoreFile;
		if (!data.threads) {
			data.threads = {};
		}
	} catch {
		data = { currentThreadId: null, threads: {} };
	}
}

/** Call after load + before serving IPC. */
export function ensureDefaultThread(): void {
	if (Object.keys(data.threads).length === 0) {
		createThread();
		return;
	}
	if (!data.currentThreadId || !data.threads[data.currentThreadId]) {
		data.currentThreadId = Object.keys(data.threads)[0] ?? null;
		save();
	}
}

function save(): void {
	fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
}

export function listThreads(): ThreadRecord[] {
	return Object.values(data.threads).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCurrentThreadId(): string | null {
	return data.currentThreadId;
}

export function getThread(id: string): ThreadRecord | undefined {
	return data.threads[id];
}

export function createThread(): ThreadRecord {
	const id = randomUUID();
	const now = Date.now();
	const t: ThreadRecord = {
		id,
		title: '新会话',
		createdAt: now,
		updatedAt: now,
		messages: [
			{
				role: 'system',
				content:
					'You are Async, a concise coding assistant. Use markdown for code. The user workspace is open in the app.',
			},
		],
	};
	data.threads[id] = t;
	data.currentThreadId = id;
	save();
	return t;
}

export function selectThread(id: string): ThreadRecord | null {
	if (!data.threads[id]) {
		return null;
	}
	data.currentThreadId = id;
	save();
	return data.threads[id];
}

export function deleteThread(id: string): void {
	delete data.threads[id];
	if (data.currentThreadId === id) {
		const ids = Object.keys(data.threads);
		data.currentThreadId = ids[0] ?? null;
	}
	save();
}

const MAX_THREAD_TITLE_LEN = 200;

/** 手动重命名对话标题（非空、去首尾空白） */
export function setThreadTitle(id: string, title: string): boolean {
	const t = data.threads[id];
	if (!t) {
		return false;
	}
	const trimmed = title.trim().slice(0, MAX_THREAD_TITLE_LEN);
	if (!trimmed) {
		return false;
	}
	t.title = trimmed;
	t.updatedAt = Date.now();
	save();
	return true;
}

export function appendMessage(threadId: string, msg: ChatMessage): ThreadRecord {
	const t = data.threads[threadId];
	if (!t) {
		throw new Error('Thread not found');
	}
	t.messages.push(msg);
	t.updatedAt = Date.now();
	if (msg.role === 'user' && t.messages.filter((m) => m.role === 'user').length === 1) {
		t.title = msg.content.slice(0, 48) + (msg.content.length > 48 ? '…' : '');
	}
	save();
	return t;
}

export function updateLastAssistant(threadId: string, fullContent: string): void {
	const t = data.threads[threadId];
	if (!t) {
		return;
	}
	const last = t.messages[t.messages.length - 1];
	if (last && last.role === 'assistant') {
		last.content = fullContent;
	} else {
		t.messages.push({ role: 'assistant', content: fullContent });
	}
	t.updatedAt = Date.now();
	save();
}

/** 在末尾助手气泡后追加文本（用于 Agent 审阅通过后写入脚注）。 */
export function appendToLastAssistant(threadId: string, suffix: string): void {
	const t = data.threads[threadId];
	if (!t || !suffix) {
		return;
	}
	const last = t.messages[t.messages.length - 1];
	if (last?.role === 'assistant') {
		last.content = isStructuredAssistantMessage(last.content)
			? appendSuffixToStructuredAssistant(last.content, suffix)
			: last.content + suffix;
		t.updatedAt = Date.now();
		save();
	}
}

/** 累加本回合 token 用量到线程统计（无 usage 时跳过）。 */
export function accumulateTokenUsage(
	threadId: string,
	input: number | undefined,
	output: number | undefined
): void {
	const t = data.threads[threadId];
	if (!t || (!input && !output)) {
		return;
	}
	const prev = t.tokenUsage ?? { totalInput: 0, totalOutput: 0 };
	t.tokenUsage = {
		totalInput: prev.totalInput + (input ?? 0),
		totalOutput: prev.totalOutput + (output ?? 0),
	};
	t.updatedAt = Date.now();
	save();
}

/**
 * 从「非 system 消息列表」中的第 visibleIndex 条用户消息起截断（含该条），再追加新的用户消息。
 * visibleIndex 与 IPC threads:messages 返回顺序一致。
 */
export function replaceFromUserVisibleIndex(
	threadId: string,
	visibleIndex: number,
	newUserContent: string
): ThreadRecord {
	const t = data.threads[threadId];
	if (!t) {
		throw new Error('Thread not found');
	}
	const system = t.messages.filter((m) => m.role === 'system');
	const rest = t.messages.filter((m) => m.role !== 'system');
	if (
		visibleIndex < 0 ||
		visibleIndex >= rest.length ||
		rest[visibleIndex]!.role !== 'user'
	) {
		throw new Error('Invalid user message index');
	}
	const kept = rest.slice(0, visibleIndex);
	t.messages = [...system, ...kept, { role: 'user', content: newUserContent }];
	t.updatedAt = Date.now();
	if (visibleIndex === 0) {
		t.title = newUserContent.slice(0, 48) + (newUserContent.length > 48 ? '…' : '');
	}
	save();
	return t;
}

/** 保存结构化计划到线程记录。 */
export function savePlan(threadId: string, plan: ThreadPlan): void {
	const t = data.threads[threadId];
	if (!t) {
		return;
	}
	t.plan = plan;
	save();
}

/** 更新计划步骤状态。 */
export function updatePlanStepStatus(threadId: string, stepId: string, status: PlanStepStatus): void {
	const t = data.threads[threadId];
	if (!t?.plan) {
		return;
	}
	const step = t.plan.steps.find((s) => s.id === stepId);
	if (step) {
		step.status = status;
		t.plan.updatedAt = Date.now();
		save();
	}
}

/** 保存摘要到线程记录（不修改 messages）。 */
export function saveSummary(threadId: string, summary: string, coversCount: number): void {
	const t = data.threads[threadId];
	if (!t) {
		return;
	}
	t.summary = summary;
	t.summaryCoversMessageCount = coversCount;
	save();
}

/** 记录 Agent 触碰文件（写入/创建/删除）；持久化到 fileStates。 */
export function touchFileInThread(
	threadId: string,
	relPath: string,
	action: FileStateAction,
	isNew: boolean
): void {
	const t = data.threads[threadId];
	if (!t) {
		return;
	}
	if (!t.fileStates) {
		t.fileStates = {};
	}
	const prev = t.fileStates[relPath];
	if (prev) {
		t.fileStates[relPath] = {
			action,
			firstTouchedAt: prev.firstTouchedAt,
			touchCount: prev.touchCount + 1,
		};
	} else {
		t.fileStates[relPath] = {
			action: isNew ? 'created' : action,
			firstTouchedAt: Date.now(),
			touchCount: 1,
		};
	}
	save();
}

function sanitizeTranscriptFilePart(s: string): string {
	return s.replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 120);
}

/** 追加子 Agent 运行日志到数据目录（不污染主对话 JSON）。 */
export function appendSubagentTranscript(threadId: string, parentToolCallId: string, chunk: string): void {
	if (!chunk || !storePath) {
		return;
	}
	try {
		const root = path.dirname(storePath);
		const dir = path.join(root, 'subagent_transcripts', sanitizeTranscriptFilePart(threadId));
		fs.mkdirSync(dir, { recursive: true });
		const file = path.join(dir, `${sanitizeTranscriptFilePart(parentToolCallId)}.md`);
		fs.appendFileSync(file, chunk, 'utf8');
	} catch (e) {
		console.warn('[threadStore] appendSubagentTranscript:', e instanceof Error ? e.message : e);
	}
}
