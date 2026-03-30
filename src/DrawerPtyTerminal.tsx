import { useEffect, useRef, useState } from 'react';
import { PtyTerminalView } from './PtyTerminalView';

type Props = {
	/** 创建会话前提示 */
	placeholder: string;
};

/** 侧栏抽屉内单会话 PTY，关闭抽屉时 kill */
export function DrawerPtyTerminal({ placeholder }: Props) {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const idRef = useRef<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const sh = window.asyncShell;
			if (!sh) {
				return;
			}
			const r = (await sh.invoke('terminal:ptyCreate')) as { ok: boolean; id?: string };
			if (cancelled || !r.ok || !r.id) {
				return;
			}
			idRef.current = r.id;
			setSessionId(r.id);
		})();
		return () => {
			cancelled = true;
			const killId = idRef.current;
			idRef.current = null;
			if (killId) {
				void window.asyncShell?.invoke('terminal:ptyKill', killId);
			}
		};
	}, []);

	if (!sessionId) {
		return <div className="pty-drawer-placeholder muted">{placeholder}</div>;
	}

	return <PtyTerminalView sessionId={sessionId} active compactChrome />;
}
