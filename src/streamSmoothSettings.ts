/**
 * 对话流式平滑（渲染侧）：预设与自定义积压档位，持久化在 settings.json → ui.*
 */
export type StreamSmoothPreset = 'character' | 'balanced' | 'fast';

export type StreamSmoothBand = {
	/** 待揭示队列长度（UTF-16 码元）上界（含）；与上游 IPC 块大小一致，便于理解 */
	maxPending: number;
	/** 每帧最多揭示的字素数 */
	graphemes: number;
};

export function cloneDefaultStreamSmoothBands(): StreamSmoothBand[] {
	return [
		{ maxPending: 350, graphemes: 1 },
		{ maxPending: 2000, graphemes: 2 },
		{ maxPending: 6000, graphemes: 5 },
		{ maxPending: Number.MAX_SAFE_INTEGER, graphemes: 14 },
	];
}

export function coerceStreamSmoothPreset(v: unknown): StreamSmoothPreset {
	if (v === 'character' || v === 'fast') return v;
	return 'balanced';
}

function clampG(g: number): number {
	return Math.max(1, Math.min(64, Math.floor(g)));
}

export function normalizeStreamSmoothBands(raw: unknown): StreamSmoothBand[] {
	const defs = cloneDefaultStreamSmoothBands();
	if (!Array.isArray(raw) || raw.length === 0) {
		return defs;
	}
	const parsed: StreamSmoothBand[] = [];
	for (const x of raw) {
		if (!x || typeof x !== 'object') continue;
		const o = x as Record<string, unknown>;
		const maxPending = Number(o.maxPending);
		const graphemes = Number(o.graphemes);
		if (!Number.isFinite(maxPending) || !Number.isFinite(graphemes)) continue;
		parsed.push({
			maxPending: Math.max(0, Math.floor(maxPending)),
			graphemes: Math.max(1, Math.min(64, Math.floor(graphemes))),
		});
	}
	if (parsed.length === 0) return defs;
	parsed.sort((a, b) => a.maxPending - b.maxPending);
	const last = { ...parsed[parsed.length - 1]! };
	last.maxPending = Number.MAX_SAFE_INTEGER;
	parsed[parsed.length - 1] = last;
	return parsed;
}

/** 设置页与状态始终使用 4 档；不足时与默认合并 */
export function ensureFourStreamSmoothBands(raw: unknown): StreamSmoothBand[] {
	const base = cloneDefaultStreamSmoothBands();
	const parsed = normalizeStreamSmoothBands(raw);
	const out: StreamSmoothBand[] = [];
	for (let i = 0; i < 4; i++) {
		out.push({
			maxPending: parsed[i]?.maxPending ?? base[i]!.maxPending,
			graphemes: clampG(parsed[i]?.graphemes ?? base[i]!.graphemes),
		});
	}
	out[3]!.maxPending = Number.MAX_SAFE_INTEGER;
	const m0 = Math.max(1, out[0]!.maxPending);
	const m1 = Math.max(m0 + 1, out[1]!.maxPending);
	const m2 = Math.max(m1 + 1, out[2]!.maxPending);
	out[0]!.maxPending = m0;
	out[1]!.maxPending = m1;
	out[2]!.maxPending = m2;
	return out;
}

export type StreamSmoothUiSnapshot = {
	enabled: boolean;
	preset: StreamSmoothPreset;
	useCustomBands: boolean;
	bands: StreamSmoothBand[];
};

function presetStep(pendingLen: number, preset: StreamSmoothPreset): number {
	switch (preset) {
		case 'character':
			if (pendingLen > 12000) return 8;
			if (pendingLen > 6000) return 4;
			return 1;
		case 'fast':
			if (pendingLen > 6000) return 28;
			if (pendingLen > 2000) return 10;
			if (pendingLen > 350) return 4;
			return 2;
		case 'balanced':
		default:
			if (pendingLen > 6000) return 14;
			if (pendingLen > 2000) return 5;
			if (pendingLen > 350) return 2;
			return 1;
	}
}

/**
 * 根据当前设置返回「本帧应揭示多少字素」；未启用平滑时不应调用（或调用方跳过）。
 */
export function createStreamSmoothGraphemeStepFn(
	enabled: boolean,
	useCustomBands: boolean,
	preset: StreamSmoothPreset,
	bands: StreamSmoothBand[]
): (pendingLen: number) => number {
	if (!enabled) {
		return () => 1;
	}
	if (useCustomBands && bands.length > 0) {
		const sorted = [...bands].sort((a, b) => a.maxPending - b.maxPending);
		return (pendingLen: number) => {
			for (const b of sorted) {
				if (pendingLen <= b.maxPending) {
					return clampG(b.graphemes);
				}
			}
			return clampG(sorted[sorted.length - 1]!.graphemes);
		};
	}
	return (pendingLen: number) => clampG(presetStep(pendingLen, preset));
}
