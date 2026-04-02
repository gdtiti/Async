import { useI18n } from './i18n';
import { VoidSelect } from './VoidSelect';
import {
	cloneDefaultStreamSmoothBands,
	ensureFourStreamSmoothBands,
	type StreamSmoothPreset,
	type StreamSmoothUiSnapshot,
} from './streamSmoothSettings';

type Props = {
	value: StreamSmoothUiSnapshot;
	onChange: (next: StreamSmoothUiSnapshot) => void;
};

export function SettingsStreamSmoothPanel({ value, onChange }: Props) {
	const { t } = useI18n();
	const v = value;

	const patch = (partial: Partial<StreamSmoothUiSnapshot>) => {
		onChange({ ...v, ...partial });
	};

	const patchBands = (bands: StreamSmoothUiSnapshot['bands']) => {
		onChange({ ...v, bands: ensureFourStreamSmoothBands(bands) });
	};

	const presetHelpKey: string = v.useCustomBands
		? 'settings.general.streamSmooth.presetHelp.customActive'
		: `settings.general.streamSmooth.presetHelp.${v.preset}`;

	return (
		<section className="ref-settings-agent-section" aria-labelledby="ref-settings-stream-smooth-h">
			<h2 id="ref-settings-stream-smooth-h" className="ref-settings-agent-section-title">
				{t('settings.general.streamSmooth.sectionTitle')}
			</h2>
			<p className="ref-settings-proxy-hint ref-settings-field-footnote" style={{ marginTop: 0 }}>
				{t('settings.general.streamSmooth.sectionLead')}
			</p>

			<div className="ref-settings-agent-card">
				<div className="ref-settings-agent-card-row">
					<div>
						<div className="ref-settings-agent-card-title">{t('settings.general.streamSmooth.cardTitle')}</div>
						<p className="ref-settings-agent-card-desc">{t('settings.general.streamSmooth.cardDesc')}</p>
					</div>
					<button
						type="button"
						className={`ref-settings-toggle ${v.enabled ? 'is-on' : ''}`}
						role="switch"
						aria-checked={v.enabled}
						onClick={() => patch({ enabled: !v.enabled })}
					>
						<span className="ref-settings-toggle-knob" />
					</button>
				</div>

				{v.enabled ? (
					<>
						<div className="ref-settings-model-advanced" style={{ borderTop: '1px solid var(--void-border-soft)', marginTop: 12 }}>
							<label className="ref-settings-field ref-settings-field--compact" style={{ marginTop: 12 }}>
								<span>{t('settings.general.streamSmooth.presetLabel')}</span>
								<VoidSelect
									ariaLabel={t('settings.general.streamSmooth.presetLabel')}
									value={v.preset}
									disabled={v.useCustomBands}
									onChange={(next) => patch({ preset: next as StreamSmoothPreset })}
									options={[
										{ value: 'character', label: t('settings.general.streamSmooth.preset.character') },
										{ value: 'balanced', label: t('settings.general.streamSmooth.preset.balanced') },
										{ value: 'fast', label: t('settings.general.streamSmooth.preset.fast') },
									]}
								/>
							</label>
							<p className="ref-settings-agent-card-desc" style={{ marginTop: 0 }}>
								{t(presetHelpKey)}
							</p>

							<div className="ref-settings-agent-card-row" style={{ marginTop: 14 }}>
								<div>
									<div className="ref-settings-agent-card-title">
										{t('settings.general.streamSmooth.customToggleTitle')}
									</div>
									<p className="ref-settings-agent-card-desc">{t('settings.general.streamSmooth.customToggleDesc')}</p>
								</div>
								<button
									type="button"
									className={`ref-settings-toggle ${v.useCustomBands ? 'is-on' : ''}`}
									role="switch"
									aria-checked={v.useCustomBands}
									onClick={() => patch({ useCustomBands: !v.useCustomBands })}
								>
									<span className="ref-settings-toggle-knob" />
								</button>
							</div>
						</div>

						{v.useCustomBands ? (
							<details className="ref-settings-model-advanced" open>
								<summary className="ref-settings-model-advanced-summary">
									{t('settings.general.streamSmooth.advancedSummary')}
								</summary>
								<div className="ref-settings-model-advanced-body">
									<p className="ref-settings-agent-card-desc" style={{ marginTop: 0 }}>
										{t('settings.general.streamSmooth.customBandsHint')}
									</p>
									{[0, 1, 2].map((i) => (
										<div key={i} className="ref-settings-stream-smooth-tier">
											<div className="ref-settings-stream-smooth-tier-head">
												{t('settings.general.streamSmooth.bandTier', { n: i + 1 })}
											</div>
											<div className="ref-settings-stream-smooth-tier-pair">
												<label className="ref-settings-field ref-settings-field--compact">
													<span>{t('settings.general.streamSmooth.colMaxQueue')}</span>
													<input
														type="number"
														min={1}
														step={1}
														value={v.bands[i]!.maxPending}
														onChange={(e) => {
															const n = Number(e.target.value);
															const b = v.bands.map((x) => ({ ...x }));
															b[i]!.maxPending = Number.isFinite(n) ? Math.floor(n) : b[i]!.maxPending;
															patchBands(b);
														}}
													/>
												</label>
												<label className="ref-settings-field ref-settings-field--compact">
													<span>{t('settings.general.streamSmooth.colGraphemes')}</span>
													<input
														type="number"
														min={1}
														max={64}
														step={1}
														value={v.bands[i]!.graphemes}
														onChange={(e) => {
															const n = Number(e.target.value);
															const b = v.bands.map((x) => ({ ...x }));
															b[i]!.graphemes = Number.isFinite(n) ? Math.floor(n) : b[i]!.graphemes;
															patchBands(b);
														}}
													/>
												</label>
											</div>
										</div>
									))}
									<div className="ref-settings-stream-smooth-tier">
										<div className="ref-settings-stream-smooth-tier-head">{t('settings.general.streamSmooth.bandRest')}</div>
										<label className="ref-settings-field ref-settings-field--compact">
											<span>{t('settings.general.streamSmooth.colGraphemes')}</span>
											<input
												type="number"
												min={1}
												max={64}
												step={1}
												value={v.bands[3]!.graphemes}
												onChange={(e) => {
													const n = Number(e.target.value);
													const b = v.bands.map((x) => ({ ...x }));
													b[3]!.graphemes = Number.isFinite(n) ? Math.floor(n) : b[3]!.graphemes;
													patchBands(b);
												}}
											/>
										</label>
									</div>
									<button
										type="button"
										className="ref-settings-remove-model"
										onClick={() => patchBands(cloneDefaultStreamSmoothBands())}
									>
										{t('settings.general.streamSmooth.resetBands')}
									</button>
								</div>
							</details>
						) : null}
					</>
				) : null}
			</div>
		</section>
	);
}
