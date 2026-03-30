import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export type PtyTerminalViewProps = {
	sessionId: string;
	/** 多标签时仅当前标签参与 fit / pty resize */
	active: boolean;
	compactChrome?: boolean;
	/** shell 退出时（pty 已由主进程关闭） */
	onSessionExit?: () => void;
};

/**
 * 与主进程 node-pty 会话绑定的 xterm；输入直接进伪终端（VS Code 式交互 shell）。
 */
export function PtyTerminalView({ sessionId, active, compactChrome, onSessionExit }: PtyTerminalViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const termRef = useRef<XTerm | null>(null);
	const fitRef = useRef<FitAddon | null>(null);
	const activeRef = useRef(active);
	const onExitRef = useRef(onSessionExit);
	activeRef.current = active;
	onExitRef.current = onSessionExit;

	useEffect(() => {
		const shell = window.asyncShell;
		const el = containerRef.current;
		if (!shell?.subscribeTerminalPtyData || !el) {
			return;
		}

		const term = new XTerm({
			theme: {
				background: '#0c0c0e',
				foreground: '#e4e4e7',
				cursor: '#6366f1',
			},
			fontSize: 12,
			fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
			cursorBlink: true,
		});
		const fit = new FitAddon();
		term.loadAddon(fit);
		term.open(el);
		termRef.current = term;
		fitRef.current = fit;

		const unsubData = shell.subscribeTerminalPtyData((id, data) => {
			if (id === sessionId) {
				term.write(data);
			}
		});
		const unsubExit =
			shell.subscribeTerminalPtyExit?.((id) => {
				if (id === sessionId) {
					onExitRef.current?.();
				}
			}) ?? (() => {});

		const dListener = term.onData((data) => {
			void shell.invoke('terminal:ptyWrite', sessionId, data);
		});

		const ro = new ResizeObserver(() => {
			if (!activeRef.current) {
				return;
			}
			fit.fit();
			const dims = fit.proposeDimensions();
			if (dims) {
				void shell.invoke('terminal:ptyResize', sessionId, dims.cols, dims.rows);
			}
		});
		ro.observe(el);

		return () => {
			ro.disconnect();
			dListener.dispose();
			unsubData();
			unsubExit();
			term.dispose();
			termRef.current = null;
			fitRef.current = null;
		};
	}, [sessionId]);

	useEffect(() => {
		if (!active) {
			return;
		}
		const term = termRef.current;
		const fit = fitRef.current;
		const shell = window.asyncShell;
		if (!term || !fit || !shell) {
			return;
		}
		const id = requestAnimationFrame(() => {
			try {
				fit.fit();
				const dims = fit.proposeDimensions();
				if (dims) {
					void shell.invoke('terminal:ptyResize', sessionId, dims.cols, dims.rows);
				}
			} catch {
				/* ignore */
			}
		});
		return () => cancelAnimationFrame(id);
	}, [active, sessionId]);

	return (
		<div className={`pty-term-root${compactChrome ? ' pty-term-root--embedded' : ''}`}>
			<div ref={containerRef} className="xterm-viewport" />
		</div>
	);
}
