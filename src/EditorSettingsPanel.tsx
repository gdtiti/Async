import { useI18n } from './i18n';

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

/** 将 EditorSettings 映射为 Monaco IEditorOptions */
export function editorSettingsToMonacoOptions(s: EditorSettings): Record<string, unknown> {
	return {
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

			{/* ─── Text & Formatting ─── */}
			<section className="ref-settings-agent-section" aria-labelledby="editor-text-h">
				<h2 id="editor-text-h" className="ref-settings-agent-section-title">{t('editorSettings.textFormatting')}</h2>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.tabSize')}</span>
					<select
						value={v.tabSize}
						onChange={(e) => patch({ tabSize: Number(e.target.value) })}
					>
						<option value="2">2</option>
						<option value="4">4</option>
						<option value="8">8</option>
					</select>
				</label>

				<div className="ref-settings-agent-card">
					<div className="ref-settings-agent-card-row">
						<div>
							<div className="ref-settings-agent-card-title">{t('editorSettings.insertSpaces')}</div>
							<p className="ref-settings-agent-card-desc">{t('editorSettings.insertSpacesDesc')}</p>
						</div>
						<button
							type="button"
							className={`ref-settings-toggle ${v.insertSpaces ? 'is-on' : ''}`}
							role="switch"
							aria-checked={v.insertSpaces}
							onClick={() => patch({ insertSpaces: !v.insertSpaces })}
						>
							<span className="ref-settings-toggle-knob" />
						</button>
					</div>
				</div>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.wordWrap')}</span>
					<select
						value={v.wordWrap}
						onChange={(e) => patch({ wordWrap: e.target.value as EditorSettings['wordWrap'] })}
					>
						<option value="off">Off</option>
						<option value="on">On</option>
						<option value="wordWrapColumn">Word Wrap Column</option>
						<option value="bounded">Bounded</option>
					</select>
				</label>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.renderWhitespace')}</span>
					<select
						value={v.renderWhitespace}
						onChange={(e) => patch({ renderWhitespace: e.target.value as EditorSettings['renderWhitespace'] })}
					>
						<option value="none">None</option>
						<option value="boundary">Boundary</option>
						<option value="all">All</option>
					</select>
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
					<select
						value={v.lineNumbers}
						onChange={(e) => patch({ lineNumbers: e.target.value as EditorSettings['lineNumbers'] })}
					>
						<option value="on">On</option>
						<option value="off">Off</option>
						<option value="relative">Relative</option>
					</select>
				</label>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.cursorStyle')}</span>
					<select
						value={v.cursorStyle}
						onChange={(e) => patch({ cursorStyle: e.target.value as EditorSettings['cursorStyle'] })}
					>
						<option value="line">Line</option>
						<option value="block">Block</option>
						<option value="underline">Underline</option>
					</select>
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

			{/* ─── Save Behavior ─── */}
			<section className="ref-settings-agent-section" aria-labelledby="editor-save-h">
				<h2 id="editor-save-h" className="ref-settings-agent-section-title">{t('editorSettings.saveBehavior')}</h2>

				<div className="ref-settings-agent-card">
					<div className="ref-settings-agent-card-row">
						<div>
							<div className="ref-settings-agent-card-title">{t('editorSettings.formatOnSave')}</div>
							<p className="ref-settings-agent-card-desc">{t('editorSettings.formatOnSaveDesc')}</p>
						</div>
						<button
							type="button"
							className={`ref-settings-toggle ${v.formatOnSave ? 'is-on' : ''}`}
							role="switch"
							aria-checked={v.formatOnSave}
							onClick={() => patch({ formatOnSave: !v.formatOnSave })}
						>
							<span className="ref-settings-toggle-knob" />
						</button>
					</div>
				</div>

				<label className="ref-settings-field ref-settings-field--compact">
					<span>{t('editorSettings.autoSave')}</span>
					<select
						value={v.autoSave}
						onChange={(e) => patch({ autoSave: e.target.value as EditorSettings['autoSave'] })}
					>
						<option value="off">Off</option>
						<option value="afterDelay">After Delay</option>
						<option value="onFocusChange">On Focus Change</option>
					</select>
				</label>
			</section>
		</div>
	);
}
