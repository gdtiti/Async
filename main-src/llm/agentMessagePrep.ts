import * as fs from 'node:fs';
import * as path from 'node:path';
import { minimatch } from 'minimatch';
import type { AgentCustomization, AgentCommand, AgentSkill } from '../agentSettingsTypes.js';
import { collectAtWorkspacePathsInText } from './workspaceContextExpand.js';

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 消息以 `/slash` 开头时展开为命令模板（长 slash 优先） */
export function applySlashCommands(text: string, commands: AgentCommand[] | undefined): string {
	const raw = text.trim();
	if (!commands?.length) {
		return raw;
	}
	const sorted = [...commands].filter((c) => c.slash.trim()).sort((a, b) => b.slash.length - a.slash.length);
	for (const c of sorted) {
		const slash = c.slash.trim().replace(/^\//, '');
		const re = new RegExp(`^/${escapeRe(slash)}(?:\\s+|$)`, 'i');
		if (!re.test(raw)) {
			continue;
		}
		const rest = raw.replace(re, '').trim();
		let body = (c.body ?? '').trim();
		body = body.replace(/\{\{\s*args\s*\}\}/gi, rest);
		body = body.replace(/\{\{\s*input\s*\}\}/gi, rest);
		return body.length > 0 ? body : rest;
	}
	return raw;
}

const SKILL_LEAD = /^\s*\.\/([\w.-]+)\s*([\s\S]*)$/;

/** `./slug` 触发 Skill：正文去掉前缀，技能说明注入系统区 */
export function applySkillInvocation(
	text: string,
	skills: AgentSkill[] | undefined
): { userText: string; skillSystemBlock: string } {
	const raw = text.trim();
	const m = raw.match(SKILL_LEAD);
	if (!m || !skills?.length) {
		return { userText: raw, skillSystemBlock: '' };
	}
	const slug = m[1]!.toLowerCase();
	const rest = (m[2] ?? '').trim();
	const sk = skills.find((s) => s.slug.trim().toLowerCase() === slug && s.enabled !== false);
	if (!sk) {
		return { userText: raw, skillSystemBlock: '' };
	}
	const userText = rest.length > 0 ? rest : '（已调用 Skill，请按下列说明执行。）';
	const skillSystemBlock = `#### Skill: ${sk.name}\n${sk.description ? `${sk.description}\n\n` : ''}${sk.content}`;
	return { userText, skillSystemBlock };
}

function pathMatchesGlob(relPath: string, pattern: string): boolean {
	const norm = relPath.replace(/\\/g, '/');
	const pat = pattern.replace(/\\/g, '/').trim();
	if (!pat) {
		return false;
	}
	if (minimatch(norm, pat, { dot: true })) {
		return true;
	}
	const base = norm.split('/').pop() ?? norm;
	return minimatch(base, pat, { dot: true });
}

/** 读取工作区 `.cursor/rules` 下 .md / .mdc（与 Cursor 习惯对齐） */
export function loadThirdPartyAgentRules(workspaceRoot: string | null): string {
	if (!workspaceRoot) {
		return '';
	}
	const dir = path.join(workspaceRoot, '.cursor', 'rules');
	if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
		return '';
	}
	const parts: string[] = [];
	try {
		const names = fs.readdirSync(dir);
		for (const n of names) {
			if (!/\.(md|mdc)$/i.test(n)) {
				continue;
			}
			const full = path.join(dir, n);
			try {
				const t = fs.readFileSync(full, 'utf8').trim();
				if (t) {
					parts.push(`**${n}**\n${t}`);
				}
			} catch {
				/* skip */
			}
		}
	} catch {
		return '';
	}
	return parts.join('\n\n---\n\n');
}

export function buildAgentSystemAppend(opts: {
	agent: AgentCustomization | undefined;
	userText: string;
	atPaths: string[];
	skillSystemBlock: string;
	thirdPartyRules: string;
}): string {
	const parts: string[] = [];
	const agent = opts.agent;

	if (opts.thirdPartyRules.trim()) {
		parts.push(`#### 从项目导入的规则\n${opts.thirdPartyRules.trim()}`);
	}

	for (const r of agent?.rules ?? []) {
		if (!r.enabled) {
			continue;
		}
		if (r.scope === 'always') {
			parts.push(`#### Rule: ${r.name}\n${r.content}`);
		} else if (r.scope === 'glob' && r.globPattern?.trim()) {
			const pat = r.globPattern.trim();
			if (opts.atPaths.some((p) => pathMatchesGlob(p, pat))) {
				parts.push(`#### Rule（路径匹配）: ${r.name}\n${r.content}`);
			}
		}
	}

	if (opts.skillSystemBlock.trim()) {
		parts.push(opts.skillSystemBlock.trim());
	}

	const subs = (agent?.subagents ?? []).filter((s) => s.enabled !== false);
	if (subs.length > 0) {
		const body = subs
			.map((s) => `##### Subagent: ${s.name}\n- ${s.description}\n\n${s.instructions}`)
			.join('\n\n');
		parts.push(`#### Subagents\n在任务适合时可按下列角色组织回答：\n\n${body}`);
	}

	return parts.join('\n\n');
}

export type PreparedUserTurn = {
	userText: string;
	agentSystemAppend: string;
};

export function prepareUserTurnForChat(
	rawText: string,
	agent: AgentCustomization | undefined,
	workspaceRoot: string | null,
	workspaceFiles: string[]
): PreparedUserTurn {
	const afterCmd = applySlashCommands(rawText, agent?.commands);
	const { userText, skillSystemBlock } = applySkillInvocation(afterCmd, agent?.skills);
	const atPaths = workspaceRoot
		? collectAtWorkspacePathsInText(userText, workspaceFiles)
		: [];
	const thirdParty =
		agent?.importThirdPartyConfigs && workspaceRoot ? loadThirdPartyAgentRules(workspaceRoot) : '';
	const agentSystemAppend = buildAgentSystemAppend({
		agent,
		userText,
		atPaths,
		skillSystemBlock,
		thirdPartyRules: thirdParty,
	});
	return { userText, agentSystemAppend };
}
