export type UiFontPresetId = 'apple' | 'inter' | 'segoe';
export type CodeFontPresetId = 'sfmono' | 'monospace' | 'jetbrains';

type AppearanceChromeSeed = {
	accentColor: string;
	backgroundColor: string;
	foregroundColor: string;
	contrast: number;
	translucentSidebar: boolean;
};

export type AppAppearanceSettings = {
	accentColor: string;
	backgroundColor: string;
	foregroundColor: string;
	uiFontPreset: UiFontPresetId;
	codeFontPreset: CodeFontPresetId;
	translucentSidebar: boolean;
	contrast: number;
	usePointerCursors: boolean;
	uiFontSize: number;
	codeFontSize: number;
};

export const APPLE_UI_FONT_STACK =
	'-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif';
export const INTER_UI_FONT_STACK =
	'"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const SEGOE_UI_FONT_STACK =
	'"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif';

export const SFMONO_CODE_FONT_STACK =
	'ui-monospace, "SF Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace';
export const MONOSPACE_CODE_FONT_STACK =
	'ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace';
export const JETBRAINS_CODE_FONT_STACK =
	'"JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, monospace';

/**
 * 与 `styles/theme-dark.css` / `theme-light.css` 中 mac-codex 的 `--void-*` 一致（另补 `--void-accent` = `--void-ring`）。
 * 仅用于设置页内局部预览；document 上内置配色时应 **清除** 这些变量的内联覆盖，让主题表生效。
 */
function macCodexBuiltinPreviewVarsDark(): Record<string, string> {
	const accent = '#37d6d4';
	return {
		'--void-bg-0': '#11171c',
		'--void-bg-1': '#151c22',
		'--void-bg-2': '#1e2831',
		'--void-bg-3': '#293743',
		'--void-fg-0': '#f3f7f8',
		'--void-fg-1': '#ced7dc',
		'--void-fg-2': '#94a3af',
		'--void-fg-3': '#657582',
		'--void-accent': accent,
		'--void-accent-contrast': accentContrast(accent),
		'--void-accent-glow': 'rgba(55, 214, 212, 0.18)',
		'--void-accent-soft': 'rgba(55, 214, 212, 0.1)',
		'--void-border': 'rgba(205, 217, 224, 0.14)',
		'--void-border-soft': 'rgba(205, 217, 224, 0.07)',
		'--void-ring': '#37d6d4',
		'--void-scrollbar-track': 'rgba(17, 23, 28, 0.66)',
		'--void-scrollbar-thumb': 'rgba(108, 122, 134, 0.42)',
		'--void-scrollbar-thumb-hover': 'rgba(132, 148, 162, 0.56)',
		'--void-scrollbar-thumb-active': 'rgba(164, 178, 191, 0.64)',
		'--ref-menubar-chrome-bg': '#161d24',
		'--void-sidebar-fill': 'rgba(19, 25, 31, 0.98)',
	};
}

function macCodexBuiltinPreviewVarsLight(): Record<string, string> {
	const accent = '#418eff';
	return {
		'--void-bg-0': '#e8edf5',
		'--void-bg-1': '#f5f7fb',
		'--void-bg-2': '#edf2f8',
		'--void-bg-3': '#dfe6f0',
		'--void-fg-0': '#18202e',
		'--void-fg-1': '#354055',
		'--void-fg-2': '#5f6d86',
		'--void-fg-3': '#8b98ad',
		'--void-accent': accent,
		'--void-accent-contrast': accentContrast(accent),
		'--void-accent-glow': 'rgba(78, 146, 255, 0.2)',
		'--void-accent-soft': 'rgba(78, 146, 255, 0.1)',
		'--void-border': 'rgba(93, 109, 136, 0.18)',
		'--void-border-soft': 'rgba(79, 93, 122, 0.09)',
		'--void-ring': '#418eff',
		'--void-scrollbar-track': 'rgba(229, 235, 245, 0.78)',
		'--void-scrollbar-thumb': 'rgba(123, 137, 160, 0.38)',
		'--void-scrollbar-thumb-hover': 'rgba(98, 113, 139, 0.5)',
		'--void-scrollbar-thumb-active': 'rgba(82, 96, 120, 0.58)',
		'--ref-menubar-chrome-bg': 'rgba(240, 244, 250, 0.86)',
		'--void-sidebar-fill': 'rgba(245, 247, 251, 0.78)',
	};
}

/** 写入 html 内联的 chrome 变量名（清除时用） */
const APPEARANCE_CHROME_CSS_VAR_KEYS: string[] = [
	'--void-bg-0',
	'--void-bg-1',
	'--void-bg-2',
	'--void-bg-3',
	'--void-fg-0',
	'--void-fg-1',
	'--void-fg-2',
	'--void-fg-3',
	'--void-accent',
	'--void-accent-contrast',
	'--void-accent-glow',
	'--void-accent-soft',
	'--void-border',
	'--void-border-soft',
	'--void-ring',
	'--void-scrollbar-track',
	'--void-scrollbar-thumb',
	'--void-scrollbar-thumb-hover',
	'--void-scrollbar-thumb-active',
	'--ref-menubar-chrome-bg',
	'--void-sidebar-fill',
];

/**
 * 与 mac-codex `theme-dark` / `theme-light` 的 bg0、fg0、强调色（ring）一致，作为内置种子与「恢复默认」。
 */
export const BUILTIN_COLOR_SCHEME_APPEARANCE: Record<'light' | 'dark', AppearanceChromeSeed> = {
	dark: {
		backgroundColor: '#11171C',
		foregroundColor: '#F3F7F8',
		accentColor: '#37D6D4',
		contrast: 58,
		translucentSidebar: true,
	},
	light: {
		backgroundColor: '#E8EDF5',
		foregroundColor: '#18202E',
		accentColor: '#418EFF',
		contrast: 54,
		translucentSidebar: true,
	},
};

/** 旧版 index 内置暗色（紫系），切换亮暗时应视为「未自定义」并迁移 */
const LEGACY_INDEX_BUILTIN_DARK: Pick<
	AppAppearanceSettings,
	'accentColor' | 'backgroundColor' | 'foregroundColor' | 'contrast' | 'translucentSidebar'
> = {
	backgroundColor: '#08080A',
	foregroundColor: '#F4F4F5',
	accentColor: '#8B93FF',
	contrast: 58,
	translucentSidebar: true,
};

const LEGACY_INDEX_BUILTIN_LIGHT: Pick<
	AppAppearanceSettings,
	'accentColor' | 'backgroundColor' | 'foregroundColor' | 'contrast' | 'translucentSidebar'
> = {
	backgroundColor: '#F5F5F7',
	foregroundColor: '#1D1D1F',
	accentColor: '#0A84FF',
	contrast: 54,
	translucentSidebar: true,
};

/** 历史「Codex」预设三色（无主题选择器后仍用于识别旧配置并参与亮暗迁移） */
const LEGACY_CODEX_CHROME_SEED: AppearanceChromeSeed = {
	accentColor: '#0169CC',
	backgroundColor: '#111111',
	foregroundColor: '#FCFCFC',
	contrast: 60,
	translucentSidebar: true,
};

/** 与当前亮/暗模式一致的内置默认外观（配色与主题表同源） */
export function defaultAppearanceSettingsForScheme(colorScheme: 'light' | 'dark'): AppAppearanceSettings {
	const seed = BUILTIN_COLOR_SCHEME_APPEARANCE[colorScheme];
	return {
		accentColor: seed.accentColor,
		backgroundColor: seed.backgroundColor,
		foregroundColor: seed.foregroundColor,
		uiFontPreset: 'apple',
		codeFontPreset: 'sfmono',
		translucentSidebar: seed.translucentSidebar,
		contrast: seed.contrast,
		usePointerCursors: false,
		uiFontSize: 13,
		codeFontSize: 12,
	};
}

/** 首屏与未持久化场景：与历史行为一致，按暗色内置默认 */
export function defaultAppearanceSettings(): AppAppearanceSettings {
	return defaultAppearanceSettingsForScheme('dark');
}

/** 是否与当前亮/暗下的内置默认一致（含配色、字体与字号等） */
export function isAppearanceFactoryDefault(appearance: AppAppearanceSettings, colorScheme: 'light' | 'dark'): boolean {
	const n = normalizeAppearanceSettings(appearance, colorScheme);
	const d = defaultAppearanceSettingsForScheme(colorScheme);
	const keys: (keyof AppAppearanceSettings)[] = [
		'accentColor',
		'backgroundColor',
		'foregroundColor',
		'uiFontPreset',
		'codeFontPreset',
		'translucentSidebar',
		'contrast',
		'usePointerCursors',
		'uiFontSize',
		'codeFontSize',
	];
	return keys.every((k) => n[k] === d[k]);
}

export function normalizeUiFontPreset(raw: unknown): UiFontPresetId {
	if (raw === 'apple' || raw === 'inter' || raw === 'segoe') {
		return raw;
	}
	return 'apple';
}

export function normalizeCodeFontPreset(raw: unknown): CodeFontPresetId {
	if (raw === 'sfmono' || raw === 'monospace' || raw === 'jetbrains') {
		return raw;
	}
	return 'sfmono';
}

function clamp(n: number, min: number, max: number): number {
	return Math.min(Math.max(n, min), max);
}

function normalizeBoolean(raw: unknown, fallback: boolean): boolean {
	return typeof raw === 'boolean' ? raw : fallback;
}

function normalizeNumber(raw: unknown, fallback: number, min: number, max: number): number {
	return typeof raw === 'number' && Number.isFinite(raw) ? clamp(Math.round(raw), min, max) : fallback;
}

function normalizeHexColor(raw: unknown, fallback: string): string {
	const s = String(raw ?? '').trim();
	if (/^#[0-9a-fA-F]{6}$/.test(s)) {
		return s.toUpperCase();
	}
	if (/^#[0-9a-fA-F]{3}$/.test(s)) {
		const digits = s.slice(1).split('');
		return (`#${digits.map((d) => d + d).join('')}`).toUpperCase();
	}
	return fallback.toUpperCase();
}

export function normalizeAppearanceSettings(
	raw?: Partial<Record<string, unknown>> | null,
	colorScheme: 'light' | 'dark' = 'dark'
): AppAppearanceSettings {
	const defaults = defaultAppearanceSettingsForScheme(colorScheme);
	return {
		accentColor: normalizeHexColor(raw?.accentColor, defaults.accentColor),
		backgroundColor: normalizeHexColor(raw?.backgroundColor, defaults.backgroundColor),
		foregroundColor: normalizeHexColor(raw?.foregroundColor, defaults.foregroundColor),
		uiFontPreset: normalizeUiFontPreset(raw?.uiFontPreset ?? raw?.fontPreset),
		codeFontPreset: normalizeCodeFontPreset(raw?.codeFontPreset),
		translucentSidebar: normalizeBoolean(raw?.translucentSidebar, defaults.translucentSidebar),
		contrast: normalizeNumber(raw?.contrast, defaults.contrast, 0, 100),
		usePointerCursors: normalizeBoolean(raw?.usePointerCursors, defaults.usePointerCursors),
		uiFontSize: normalizeNumber(raw?.uiFontSize, defaults.uiFontSize, 11, 18),
		codeFontSize: normalizeNumber(raw?.codeFontSize, defaults.codeFontSize, 11, 18),
	};
}

export function resolveUiFontFamily(preset: UiFontPresetId): string {
	switch (preset) {
		case 'inter':
			return INTER_UI_FONT_STACK;
		case 'segoe':
			return SEGOE_UI_FONT_STACK;
		case 'apple':
		default:
			return APPLE_UI_FONT_STACK;
	}
}

export function resolveCodeFontFamily(preset: CodeFontPresetId): string {
	switch (preset) {
		case 'monospace':
			return MONOSPACE_CODE_FONT_STACK;
		case 'jetbrains':
			return JETBRAINS_CODE_FONT_STACK;
		case 'sfmono':
		default:
			return SFMONO_CODE_FONT_STACK;
	}
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const normalized = normalizeHexColor(hex, '#000000').slice(1);
	return {
		r: Number.parseInt(normalized.slice(0, 2), 16),
		g: Number.parseInt(normalized.slice(2, 4), 16),
		b: Number.parseInt(normalized.slice(4, 6), 16),
	};
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
	return `#${[rgb.r, rgb.g, rgb.b]
		.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
		.join('')}`.toUpperCase();
}

function mixHex(base: string, target: string, targetWeight: number): string {
	const a = hexToRgb(base);
	const b = hexToRgb(target);
	const w = Math.min(Math.max(targetWeight, 0), 1);
	return rgbToHex({
		r: a.r * (1 - w) + b.r * w,
		g: a.g * (1 - w) + b.g * w,
		b: a.b * (1 - w) + b.b * w,
	});
}

function hexToRgba(hex: string, alpha: number): string {
	const { r, g, b } = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${Math.min(Math.max(alpha, 0), 1).toFixed(3)})`;
}

function relativeLuminance(hex: string): number {
	const { r, g, b } = hexToRgb(hex);
	const linear = [r, g, b].map((v) => {
		const channel = v / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function accentContrast(hex: string): string {
	return relativeLuminance(hex) > 0.45 ? '#111111' : '#FCFCFC';
}

/**
 * 由外观配色推导出的 CSS 变量（与 applyAppearanceSettingsToDom 中颜色部分一致）。
 * 可用于局部作用域（例如设置里「导入前」预览）而不污染 document。
 */
export function appearanceSettingsColorVars(settings: AppAppearanceSettings): Record<string, string> {
	const contrastBoost = settings.contrast / 100;
	const bg0 = normalizeHexColor(settings.backgroundColor, '#111111');
	const fg0 = normalizeHexColor(settings.foregroundColor, '#FCFCFC');
	const accent = normalizeHexColor(settings.accentColor, '#0169CC');
	const bg1 = mixHex(bg0, fg0, 0.03 + contrastBoost * 0.035);
	const bg2 = mixHex(bg0, fg0, 0.06 + contrastBoost * 0.055);
	const bg3 = mixHex(bg0, fg0, 0.1 + contrastBoost * 0.075);
	const fg1 = mixHex(fg0, bg0, 0.14 + (1 - contrastBoost) * 0.03);
	const fg2 = mixHex(fg0, bg0, 0.34 + (1 - contrastBoost) * 0.08);
	const fg3 = mixHex(fg0, bg0, 0.54 + (1 - contrastBoost) * 0.08);
	const border = mixHex(bg0, fg0, 0.12 + contrastBoost * 0.1);
	const borderSoft = hexToRgba(fg0, 0.06 + contrastBoost * 0.08);
	const sidebarAlpha = settings.translucentSidebar ? 0.74 : 0.98;
	return {
		'--void-bg-0': bg0,
		'--void-bg-1': bg1,
		'--void-bg-2': bg2,
		'--void-bg-3': bg3,
		'--void-fg-0': fg0,
		'--void-fg-1': fg1,
		'--void-fg-2': fg2,
		'--void-fg-3': fg3,
		'--void-accent': accent,
		'--void-accent-contrast': accentContrast(accent),
		'--void-accent-glow': hexToRgba(accent, 0.22 + contrastBoost * 0.08),
		'--void-accent-soft': hexToRgba(accent, 0.1 + contrastBoost * 0.04),
		'--void-border': border,
		'--void-border-soft': borderSoft,
		'--void-ring': accent,
		'--void-scrollbar-track': bg1,
		'--void-scrollbar-thumb': mixHex(bg0, fg0, 0.2 + contrastBoost * 0.1),
		'--void-scrollbar-thumb-hover': mixHex(bg0, fg0, 0.26 + contrastBoost * 0.1),
		'--void-scrollbar-thumb-active': mixHex(bg0, fg0, 0.32 + contrastBoost * 0.1),
		'--void-sidebar-fill': hexToRgba(bg1, sidebarAlpha),
		'--ref-menubar-chrome-bg': mixHex(bg0, fg0, 0.07 + contrastBoost * 0.04),
	};
}

/** 三色/对比度/侧栏与当前亮暗下的内置种子一致时，应使用样式表级 token（含青紫倾向的暗色层级）。 */
export function appearanceMatchesBuiltinChromeSeed(appearance: AppAppearanceSettings, scheme: 'light' | 'dark'): boolean {
	const n = normalizeAppearanceSettings(appearance, scheme);
	const b = defaultAppearanceSettingsForScheme(scheme);
	return (
		n.accentColor === b.accentColor &&
		n.backgroundColor === b.backgroundColor &&
		n.foregroundColor === b.foregroundColor &&
		n.contrast === b.contrast &&
		n.translucentSidebar === b.translucentSidebar
	);
}

/** 与历史 Codex 预设三色一致（常见「未改色」状态） */
export function appearanceUsesUnambiguousDarkAutoChrome(appearance: AppAppearanceSettings): boolean {
	const n = normalizeAppearanceSettings(appearance, 'dark');
	const p = LEGACY_CODEX_CHROME_SEED;
	return (
		n.accentColor === p.accentColor &&
		n.backgroundColor === p.backgroundColor &&
		n.foregroundColor === p.foregroundColor &&
		n.contrast === p.contrast &&
		n.translucentSidebar === p.translucentSidebar
	);
}

function matchesLegacyIndexBuiltin(appearance: AppAppearanceSettings, scheme: 'light' | 'dark'): boolean {
	const n = normalizeAppearanceSettings(appearance, scheme);
	const L = scheme === 'dark' ? LEGACY_INDEX_BUILTIN_DARK : LEGACY_INDEX_BUILTIN_LIGHT;
	return (
		n.accentColor === normalizeHexColor(L.accentColor, n.accentColor) &&
		n.backgroundColor === normalizeHexColor(L.backgroundColor, n.backgroundColor) &&
		n.foregroundColor === normalizeHexColor(L.foregroundColor, n.foregroundColor) &&
		n.contrast === L.contrast &&
		n.translucentSidebar === L.translucentSidebar
	);
}

/**
 * 离开某一亮暗模式时，若当前配色属于该模式下的「自动/内置」（含旧 index 紫系与 Codex），
 * 切换有效亮暗后应换成新模式内置色，避免仍用上一模式的种子。
 */
export function shouldMigrateChromeWhenLeavingScheme(appearance: AppAppearanceSettings, fromScheme: 'light' | 'dark'): boolean {
	if (appearanceMatchesBuiltinChromeSeed(appearance, fromScheme)) {
		return true;
	}
	if (fromScheme === 'dark') {
		return appearanceUsesUnambiguousDarkAutoChrome(appearance) || matchesLegacyIndexBuiltin(appearance, 'dark');
	}
	return matchesLegacyIndexBuiltin(appearance, 'light');
}

export function replaceBuiltinChromeColorsForScheme(
	current: AppAppearanceSettings,
	scheme: 'light' | 'dark'
): AppAppearanceSettings {
	const b = defaultAppearanceSettingsForScheme(scheme);
	return {
		...current,
		accentColor: b.accentColor,
		backgroundColor: b.backgroundColor,
		foregroundColor: b.foregroundColor,
		contrast: b.contrast,
		translucentSidebar: b.translucentSidebar,
	};
}

/** 设置页局部预览：内置 → mac-codex 主题表等价变量；否则按三色推导。 */
export function resolveAppearanceChromeColorVars(
	appearance: AppAppearanceSettings,
	scheme: 'light' | 'dark'
): Record<string, string> {
	if (appearanceMatchesBuiltinChromeSeed(appearance, scheme)) {
		return scheme === 'light' ? macCodexBuiltinPreviewVarsLight() : macCodexBuiltinPreviewVarsDark();
	}
	return appearanceSettingsColorVars(normalizeAppearanceSettings(appearance, scheme));
}

export function applyAppearanceSettingsToDom(settings: AppAppearanceSettings, colorScheme: 'light' | 'dark'): void {
	if (typeof document === 'undefined') {
		return;
	}

	const root = document.documentElement;
	if (appearanceMatchesBuiltinChromeSeed(settings, colorScheme)) {
		for (const key of APPEARANCE_CHROME_CSS_VAR_KEYS) {
			root.style.removeProperty(key);
		}
	} else {
		const vars = appearanceSettingsColorVars(normalizeAppearanceSettings(settings, colorScheme));
		for (const [key, val] of Object.entries(vars)) {
			root.style.setProperty(key, val);
		}
	}

	root.style.setProperty('--void-ui-font-family', resolveUiFontFamily(settings.uiFontPreset));
	root.style.setProperty('--void-code-font-family', resolveCodeFontFamily(settings.codeFontPreset));
	root.style.setProperty('--void-ui-font-size-px', `${settings.uiFontSize}px`);
	root.style.setProperty('--void-code-font-size-px', `${settings.codeFontSize}px`);
	root.setAttribute('data-ui-font', settings.uiFontPreset);
	root.setAttribute('data-code-font', settings.codeFontPreset);
	root.setAttribute('data-pointer-cursors', settings.usePointerCursors ? 'true' : 'false');
	root.setAttribute('data-translucent-sidebar', settings.translucentSidebar ? 'true' : 'false');
}
