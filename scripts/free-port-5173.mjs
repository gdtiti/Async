/**
 * 释放本机 5173 端口，避免上一轮 Vite 残留导致 `npm run dev` 报 Port already in use、
 * `wait-on` 永远等不到而 Electron 不启动。
 */
import { execSync } from 'node:child_process';

const PORT = 5173;

function killPidWin(pid) {
	try {
		execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
		console.log(`[free-port:${PORT}] 已结束占用端口的进程 PID=${pid}`);
	} catch {
		/* 进程已退出或无权限 */
	}
}

function freePortWindows() {
	let out;
	try {
		out = execSync('netstat -ano', { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
	} catch {
		return;
	}
	const pids = new Set();
	for (const line of out.split(/\r?\n/)) {
		if (!/LISTENING/i.test(line)) continue;
		// 匹配 127.0.0.1:5173 或 [::1]:5173 等
		if (!new RegExp(`:${PORT}\\s`).test(line)) continue;
		const parts = line.trim().split(/\s+/);
		const pid = parts[parts.length - 1];
		if (/^\d+$/.test(pid)) pids.add(pid);
	}
	for (const pid of pids) killPidWin(pid);
}

function freePortUnix() {
	try {
		const raw = execSync(`lsof -ti:${PORT}`, { encoding: 'utf8' });
		const pids = raw
			.trim()
			.split(/\n/)
			.map((s) => s.trim())
			.filter(Boolean);
		for (const pid of pids) {
			try {
				process.kill(Number(pid), 'SIGTERM');
				console.log(`[free-port:${PORT}] 已发送 SIGTERM 至 PID=${pid}`);
			} catch {
				/* ignore */
			}
		}
	} catch {
		/* 无占用 */
	}
}

if (process.platform === 'win32') {
	freePortWindows();
} else {
	freePortUnix();
}
