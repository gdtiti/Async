import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { computeClampedPopoverLayout, POPOVER_VIEW_MARGIN } from './anchorPopoverLayout';
import type { CaretRectSnapshot } from './caretRectSnapshot';
import type { AtMenuItem } from './composerAtMention';
import { FileTypeIcon } from './fileTypeIcons';
import { estimateAtMenuContentHeightPx } from './pretextLayout';

function IconBranch({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<line x1="6" y1="3" x2="6" y2="15" />
			<circle cx="18" cy="6" r="3" />
			<circle cx="6" cy="18" r="3" />
			<path d="M18 9a9 9 0 0 1-9 9" />
		</svg>
	);
}

function IconGlobe({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
		</svg>
	);
}

function IconFolder({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
		</svg>
	);
}

function IconChat({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
		</svg>
	);
}

function IconFile({ className }: { className?: string }) {
	return (
		<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	);
}

function AtIcon({ kind }: { kind: AtMenuItem['icon'] }) {
	const c = 'ref-at-menu-ico';
	switch (kind) {
		case 'branch':
			return <IconBranch className={c} />;
		case 'browser':
			return <IconGlobe className={c} />;
		case 'folder':
			return <IconFolder className={c} />;
		case 'chat':
			return <IconChat className={c} />;
		case 'file':
		default:
			return <IconFile className={c} />;
	}
}

type Props = {
	open: boolean;
	items: AtMenuItem[];
	/** 工作区文件 IPC 搜索进行中（可与静态项并存） */
	fileSearchLoading?: boolean;
	highlightIndex: number;
	caretRect: CaretRectSnapshot | null;
	onHighlight: (index: number) => void;
	onSelect: (item: AtMenuItem) => void;
	onClose: () => void;
};

export function ComposerAtMenu({
	open,
	items,
	fileSearchLoading = false,
	highlightIndex,
	caretRect,
	onHighlight,
	onSelect,
	onClose,
}: Props) {
	const menuRef = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		if (!open) {
			return;
		}
		const onDoc = (e: MouseEvent) => {
			const t = e.target as Node;
			if (menuRef.current?.contains(t)) {
				return;
			}
			onClose();
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, [open, onClose]);

	/** 键盘上下选中项超出 max-height 滚动区时，滚入可视区域 */
	useLayoutEffect(() => {
		if (!open || items.length === 0) {
			return;
		}
		const root = menuRef.current;
		if (!root) {
			return;
		}
		const safeHi = Math.min(Math.max(0, highlightIndex), items.length - 1);
		const row = root.querySelector<HTMLElement>(`[data-at-menu-idx="${safeHi}"]`);
		row?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}, [open, items, highlightIndex]);

	if (!open || !caretRect) {
		return null;
	}

	const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
	const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
	const menuWidth = Math.min(340, vw - 2 * POPOVER_VIEW_MARGIN);
	const loadingExtraPx = fileSearchLoading ? 28 : 0;
	const pretexMenuBodyPx = estimateAtMenuContentHeightPx(items, menuWidth) + loadingExtraPx;
	const estHeight = Math.min(
		Math.max(pretexMenuBodyPx, items.length ? 48 : fileSearchLoading ? 52 : 44),
		vh * 0.45
	);

	// 使用统一的 popover 定位逻辑（自动处理上/下展开、视口边界裁剪）
	const anchorRect = new DOMRect(caretRect.left, caretRect.top, caretRect.width, caretRect.height);
	const layout = computeClampedPopoverLayout(anchorRect, {
		viewportWidth: vw,
		viewportHeight: vh,
		menuWidth,
		contentHeight: estHeight,
	});

	const posStyle: React.CSSProperties = {
		position: 'fixed',
		left: layout.left,
		width: layout.width,
		maxHeight: layout.maxHeightPx,
		zIndex: 20000,
	};
	if (layout.top !== undefined) {
		posStyle.top = layout.top;
	}
	if (layout.bottom !== undefined) {
		posStyle.bottom = layout.bottom;
	}

	if (items.length === 0) {
		return createPortal(
			<div
				ref={menuRef}
				className="ref-at-menu ref-at-menu--empty"
				style={posStyle}
				onMouseDown={(e) => e.preventDefault()}
				role="status"
			>
				<div className="ref-at-menu-empty-msg">
					{fileSearchLoading ? '正在加载文件索引…' : '无匹配项'}
				</div>
			</div>,
			document.body
		);
	}

	const safeHi = Math.min(highlightIndex, items.length - 1);

	return createPortal(
		<div
			ref={menuRef}
			className="ref-at-menu"
			role="listbox"
			aria-activedescendant={items[safeHi] ? `at-item-${items[safeHi].id}` : undefined}
			style={posStyle}
			onMouseDown={(e) => e.preventDefault()}
		>
			{fileSearchLoading ? (
				<div className="ref-at-menu-loading-hint" role="status">
					正在更新文件匹配…
				</div>
			) : null}
			{items.map((it, i) => (
				<button
					key={it.id}
					type="button"
					id={`at-item-${it.id}`}
					data-at-menu-idx={i}
					role="option"
					aria-selected={i === highlightIndex}
					className={`ref-at-menu-row ${i === safeHi ? 'is-active' : ''}`}
					onMouseEnter={() => onHighlight(i)}
					onClick={() => onSelect(it)}
				>
					<span className="ref-at-menu-row-ico" aria-hidden>
						{it.id.startsWith('ws:') ? (
							<FileTypeIcon fileName={it.label} isDirectory={false} className="ref-at-menu-ico" />
						) : (
							<AtIcon kind={it.icon} />
						)}
					</span>
					<span className="ref-at-menu-row-text">
						<span className="ref-at-menu-row-label">{it.label}</span>
						{it.subtitle ? <span className="ref-at-menu-row-sub">{it.subtitle}</span> : null}
					</span>
					{i === safeHi ? (
						<kbd className="ref-at-menu-kbd" aria-hidden>
							↵
						</kbd>
					) : null}
				</button>
			))}
		</div>,
		document.body
	);
}
