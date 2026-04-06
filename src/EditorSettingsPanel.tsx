import { useI18n } from './i18n';
import { VoidSelect } from './VoidSelect';

export type EditorSettings = {
	tabSize: number;
	insertSpaces: boolean;
	wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
	fontSize: number;
	fontFamily: string;
	lineNumbers: 'on' | 'off' | 'relative';
	minimap: boolean;
	bracketPairColorization: boolean;
	cursorStyle: 'line' | 'block' | 'underline';
	smoothScrolling: boolean;
	renderWhitespace: 'none' | 'boundary' | 'all';
	formatOnSave: boolean;
	autoSave: 'off' | 'afterDelay' | 'onFocusChange';
};

export const defaultEditorSettings = (): EditorSettings => ({
	tabSize: 4,
	insertSpaces: false,
	wordWrap: 'off',
	fontSize: 14,
	fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace",
	lineNumbers: 'on',
	minimap: true,
	bracketPairColorization: true,
	cursorStyle: 'line',
	smoothScrolling: true,
	renderWhitespace: 'none',
	formatOnSave: false,
	autoSave: 'off',
});

/** 将 EditorSettings 映射为 Monaco IEditorOptions（主编辑区为只读预览器） */
export function editorSettingsToMonacoOptions(s: EditorSettings): Record<string, unknown> {
	return {
		readOnly: true,
		tabSize: s.tabSize,
		insertSpaces: s.insertSpaces,
		wordWrap: s.wordWrap,
		fontSize: s.fontSize,
		fontFamily: s.fontFamily,
		lineNumbers: s.lineNumbers,
		minimap: { enabled: s.minimap },
		'bracketPairColorization.enabled': s.bracketPairColorization,
		cursorStyle: s.cursorStyle,
		smoothScrolling: s.smoothScrolling,
		renderWhitespace: s.renderWhitespace,
	};
}


type Props = {
	value: EditorSettings;
	onChange: (next: EditorSettings) => void;
};

export function EditorSettingsPanel({ value, onChange }: Props) {
	const { t } = useI18n();
	const v = { ...defaultEditorSettings(), ...value };

	const patch = (p: Partial<EditorSettings>) => {
		onChange({ ...v, ...p });
	};

	return (
		<div className="ref-settings-panel ref-settings-panel--editor">
			<p className="ref-settings-lead">
				{t('editorSettings.lead')}
			</p>

			{/* ─── Text & Formatting（只读预览：隐藏 Tab/空格等编辑相关项）── */}
			<section className="ref-settings-agent-section" aria-labelledby="editor-text-h">
				<h2 id="editor-text-h" className="ref-settings-agent-section-title">{t('editorSettings.textFormatting')}</h2>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.wordWrap')}</span>
					<VoidSelect
						ariaLabel={t('editorSettings.wordWrap')}
						value={v.wordWrap}
						onChange={(s) => patch({ wordWrap: s as EditorSettings['wordWrap'] })}
						options={[
							{ value: 'off', label: 'Off' },
							{ value: 'on', label: 'On' },
							{ value: 'wordWrapColumn', label: 'Word Wrap Column' },
							{ value: 'bounded', label: 'Bounded' },
						]}
					/>
				</label>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.renderWhitespace')}</span>
					<VoidSelect
						ariaLabel={t('editorSettings.renderWhitespace')}
						value={v.renderWhitespace}
						onChange={(s) => patch({ renderWhitespace: s as EditorSettings['renderWhitespace'] })}
						options={[
							{ value: 'none', label: 'None' },
							{ value: 'boundary', label: 'Boundary' },
							{ value: 'all', label: 'All' },
						]}
					/>
				</label>
			</section>

			{/* ─── Font ─── */}
			<section className="ref-settings-agent-section" aria-labelledby="editor-font-h">
				<h2 id="editor-font-h" className="ref-settings-agent-section-title">{t('editorSettings.font')}</h2>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.fontSize')}</span>
					<input
						type="number"
						min={8}
						max={32}
						value={v.fontSize}
						onChange={(e) => {
							const n = Number(e.target.value);
							if (n >= 8 && n <= 32) patch({ fontSize: n });
						}}
					/>
				</label>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.fontFamily')}</span>
					<input
						value={v.fontFamily}
						onChange={(e) => patch({ fontFamily: e.target.value })}
						placeholder="ui-monospace, Menlo, Consolas, monospace"
					/>
				</label>
			</section>

			{/* ─── Display ─── */}
			<section className="ref-settings-agent-section" aria-labelledby="editor-display-h">
				<h2 id="editor-display-h" className="ref-settings-agent-section-title">{t('editorSettings.display')}</h2>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.lineNumbers')}</span>
					<VoidSelect
						ariaLabel={t('editorSettings.lineNumbers')}
						value={v.lineNumbers}
						onChange={(s) => patch({ lineNumbers: s as EditorSettings['lineNumbers'] })}
						options={[
							{ value: 'on', label: 'On' },
							{ value: 'off', label: 'Off' },
							{ value: 'relative', label: 'Relative' },
						]}
					/>
				</label>

				<div className="ref-settings-agent-card">
					<div className="ref-settings-agent-card-row">
						<div>
							<div className="ref-settings-agent-card-title">{t('editorSettings.minimap')}</div>
							<p className="ref-settings-agent-card-desc">{t('editorSettings.minimapDesc')}</p>
						</div>
						<button
							type="button"
							className={`ref-settings-toggle ${v.minimap ? 'is-on' : ''}`}
							role="switch"
							aria-checked={v.minimap}
							onClick={() => patch({ minimap: !v.minimap })}
						>
							<span className="ref-settings-toggle-knob" />
						</button>
					</div>
				</div>

				<div className="ref-settings-agent-card">
					<div className="ref-settings-agent-card-row">
						<div>
							<div className="ref-settings-agent-card-title">{t('editorSettings.bracketColorization')}</div>
							<p className="ref-settings-agent-card-desc">{t('editorSettings.bracketColorizationDesc')}</p>
						</div>
						<button
							type="button"
							className={`ref-settings-toggle ${v.bracketPairColorization ? 'is-on' : ''}`}
							role="switch"
							aria-checked={v.bracketPairColorization}
							onClick={() => patch({ bracketPairColorization: !v.bracketPairColorization })}
						>
							<span className="ref-settings-toggle-knob" />
						</button>
					</div>
				</div>

				<div className="ref-settings-agent-card">
					<div className="ref-settings-agent-card-row">
						<div>
							<div className="ref-settings-agent-card-title">{t('editorSettings.smoothScrolling')}</div>
						</div>
						<button
							type="button"
							className={`ref-settings-toggle ${v.smoothScrolling ? 'is-on' : ''}`}
							role="switch"
							aria-checked={v.smoothScrolling}
							onClick={() => patch({ smoothScrolling: !v.smoothScrolling })}
						>
							<span className="ref-settings-toggle-knob" />
						</button>
					</div>
				</div>
			</section>

		</div>
	);
}
