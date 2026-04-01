/**
 * Agent 工具定义 — 类似 Cursor / Claude Code 的工具集。
 * 每个工具包含名称、描述和 JSON Schema 参数，供 OpenAI / Anthropic / Gemini 的 tool calling 使用。
 */

export type AgentToolDef = {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, Record<string, unknown>>;
		required: string[];
	};
};

export type ToolCall = {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
};

export type ToolResult = {
	toolCallId: string;
	name: string;
	content: string;
	isError: boolean;
};

/** 只读工具：可安全并发执行，不修改文件系统或运行副作用命令（含 Claude Code 风格的 MCP 资源工具） */
export const READ_ONLY_AGENT_TOOL_NAMES = [
	'read_file',
	'list_dir',
	'search_files',
	'get_diagnostics',
	'ListMcpResourcesTool',
	'ReadMcpResourceTool',
] as const;

export function isReadOnlyAgentTool(name: string): boolean {
	return (READ_ONLY_AGENT_TOOL_NAMES as readonly string[]).includes(name);
}

export function agentToolsForComposerMode(mode: 'agent' | 'plan', all: AgentToolDef[] = AGENT_TOOLS): AgentToolDef[] {
	if (mode === 'plan') {
		return all.filter((d) => isReadOnlyAgentTool(d.name));
	}
	return all;
}

export const AGENT_TOOLS: AgentToolDef[] = [
	{
		name: 'read_file',
		description:
			'Read the contents of a file at the given path relative to the workspace root. Returns the file content with line numbers. Use this to understand existing code before making changes. Prefer this instead of shell commands like cat, head, type, or Get-Content when you need to inspect source files. You can optionally specify start_line and end_line to read a specific range.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Relative path to the file from workspace root' },
				start_line: {
					type: 'number',
					description: 'Optional 1-based start line number',
				},
				end_line: {
					type: 'number',
					description: 'Optional 1-based end line number (inclusive)',
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'write_to_file',
		description:
			'Create a new file or completely overwrite an existing file with the provided content. Use this for creating new files or when you need to rewrite an entire file. For targeted edits to existing files, prefer str_replace instead.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Relative path to the file from workspace root' },
				content: { type: 'string', description: 'The complete file content to write' },
			},
			required: ['path', 'content'],
		},
	},
	{
		name: 'str_replace',
		description:
			'Replace an exact string occurrence in a file. The old_str must match EXACTLY one location in the file (including all whitespace, indentation, and newlines). This is the preferred way to make targeted edits to existing files. If old_str appears multiple times, or is not found, read a larger surrounding context and retry with a more unique snippet.',
		parameters: {
			type: 'object',
			properties: {
				path: { type: 'string', description: 'Relative path to the file from workspace root' },
				old_str: {
					type: 'string',
					description:
						'The exact string to find in the file. Must match exactly one location including whitespace.',
				},
				new_str: {
					type: 'string',
					description: 'The replacement string. Use empty string to delete the matched text.',
				},
			},
			required: ['path', 'old_str', 'new_str'],
		},
	},
	{
		name: 'list_dir',
		description:
			'List all files and directories at the given path. Returns entries sorted with directories first. Useful for understanding project structure. Prefer this over shell commands like ls or dir for exploration.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description:
						'Relative path to directory from workspace root. Use empty string or omit for workspace root.',
				},
			},
			required: [],
		},
	},
	{
		name: 'search_files',
		description:
			'Search for a text pattern across files in the workspace. Supports regex. Returns matching lines with file paths and line numbers. Useful for finding usages, definitions, and references. Prefer this over shell grep/findstr/rg calls during exploration.',
		parameters: {
			type: 'object',
			properties: {
				pattern: {
					type: 'string',
					description: 'Search pattern (supports regex)',
				},
				path: {
					type: 'string',
					description: 'Optional subdirectory to limit search scope',
				},
				symbol: {
					type: 'boolean',
					description:
						'If true, search exported symbol names (substring match) instead of grepping file contents. Use to find functions/classes/types by name.',
				},
			},
			required: ['pattern'],
		},
	},
	{
		name: 'execute_command',
		description:
			'Execute a shell command in the workspace directory. Use this for running tests, installing dependencies, building projects, git operations, etc. Do not use this for reading source files or listing directories when read_file/list_dir/search_files can do the job. The command runs with a 120-second timeout.',
		parameters: {
			type: 'object',
			properties: {
				command: { type: 'string', description: 'The shell command to execute' },
			},
			required: ['command'],
		},
	},
	{
		name: 'get_diagnostics',
		description:
			'Get TypeScript/JavaScript compiler diagnostics (errors and warnings) for a file in the workspace using the language server. Use this after editing a TypeScript or JavaScript file to verify there are no type errors or syntax issues. Returns a list of diagnostics with line numbers, severity, and messages. If the language server is not running or the file type is not supported, returns an appropriate message.',
		parameters: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Relative path to the TypeScript or JavaScript file from workspace root',
				},
			},
			required: ['path'],
		},
	},
	{
		name: 'delegate_task',
		description:
			'Delegate a focused sub-task to a nested agent loop. Use this for well-scoped, independent tasks that can be completed autonomously (e.g. "refactor this single file", "write tests for this module"). The sub-agent has access to all the same tools. Returns the sub-agent\'s final output as a string. Maximum nesting depth is 1 — do not call delegate_task from within a delegated task.',
		parameters: {
			type: 'object',
			properties: {
				task: {
					type: 'string',
					description: 'A clear, self-contained description of the task for the sub-agent to execute',
				},
				context: {
					type: 'string',
					description: 'Optional additional context, file paths, or constraints for the sub-agent',
				},
			},
			required: ['task'],
		},
	},
	{
		name: 'ListMcpResourcesTool',
		description:
			'List resources exposed by connected MCP (Model Context Protocol) servers. Each entry includes uri, name, optional mimeType/description, and server (the configured MCP server display name). Use optional `server` to filter to one server. Requires MCP servers to be connected (e.g. enabled in settings).',
		parameters: {
			type: 'object',
			properties: {
				server: {
					type: 'string',
					description:
						'Optional: MCP server id or display name to filter; omit to list from all connected servers.',
				},
			},
			required: [],
		},
	},
	{
		name: 'ReadMcpResourceTool',
		description:
			'Read a resource from a connected MCP server by URI (same naming as Claude Code). Use ListMcpResourcesTool first to discover URIs. Parameters must identify the server (id or display name as configured) and the resource uri.',
		parameters: {
			type: 'object',
			properties: {
				server: { type: 'string', description: 'MCP server id or display name from settings' },
				uri: { type: 'string', description: 'Resource URI to read' },
			},
			required: ['server', 'uri'],
		},
	},
];

export function toOpenAITools(defs: AgentToolDef[]) {
	return defs.map((d) => ({
		type: 'function' as const,
		function: {
			name: d.name,
			description: d.description,
			parameters: d.parameters,
		},
	}));
}

export function toAnthropicTools(defs: AgentToolDef[]) {
	return defs.map((d) => ({
		name: d.name,
		description: d.description,
		input_schema: d.parameters as Record<string, unknown>,
	}));
}
