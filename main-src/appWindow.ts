import { BrowserWindow, app, screen } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const isDev = !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
const loadDistFlag =
	process.env.ASYNC_SHELL_LOAD_DIST === '1' || process.env.VOID_SHELL_LOAD_DIST === '1';
const openDevTools =
	process.env.ASYNC_SHELL_DEVTOOLS === '1' || process.env.VOID_SHELL_DEVTOOLS === '1';

let appIconPath: string | undefined;

export function configureAppWindowIcon(icon: string | undefined): void {
	appIconPath = icon;
}

export function createAppWindow(opts?: { blank?: boolean }): void {
	const preloadPath = path.join(__dirname, 'preload.cjs');
	const primary = screen.getPrimaryDisplay();
	const wa = primary.workArea;
	const DEFAULT_WIN_W = 1920;
	const DEFAULT_WIN_H = 1080;
	const w = Math.max(800, Math.min(DEFAULT_WIN_W, wa.width));
	const h = Math.max(600, Math.min(DEFAULT_WIN_H, wa.height));
	const x = wa.x + Math.round((wa.width - w) / 2);
	const y = wa.y + Math.round((wa.height - h) / 2);

	const titleBarOptions =
		process.platform === 'darwin'
			? { titleBarStyle: 'hiddenInset' as const }
			: process.platform === 'win32'
				? {
						titleBarStyle: 'hidden' as const,
						titleBarOverlay: {
							color: '#16161c',
							symbolColor: '#d4d4d8',
							height: 44,
						},
					}
				: {};

	const win = new BrowserWindow({
		x,
		y,
		width: w,
		height: h,
		minWidth: 800,
		minHeight: 600,
		backgroundColor: '#0c0c0e',
		...(appIconPath ? { icon: appIconPath } : {}),
		...titleBarOptions,
		webPreferences: {
			preload: preloadPath,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
		},
		show: false,
	});

	const notifyLayout = () => {
		if (!win.isDestroyed()) {
			win.webContents.send('async-shell:layout');
		}
	};
	win.on('resize', notifyLayout);
	win.on('move', notifyLayout);

	win.once('ready-to-show', () => win.show());

	const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
	const useViteDevServer = isDev && !loadDistFlag;

	if (useViteDevServer) {
		// 开发模式：通过 URL 参数传递 blank 标志
		const blankParam = opts?.blank ? '?blank=1' : '';
		void win.loadURL(devUrl + blankParam);
		if (openDevTools) {
			win.webContents.openDevTools({ mode: 'detach' });
		}
	} else {
		// 生产模式：通过 URL 参数传递 blank 标志
		const blankParam = opts?.blank ? '?blank=1' : '';
		const fileUrl = pathToFileURL(htmlPath).href + blankParam;
		void win.loadURL(fileUrl);
	}
}
