import { useId } from 'react';

/**
 * Async 品牌标：参考新版 A/S 流线结构，收敛为适合小尺寸展示的灰银图标。
 */
export function BrandLogo({
	className,
	size = 22,
	'aria-label': ariaLabel,
}: {
	className?: string;
	size?: number;
	'aria-label'?: string;
}) {
	const outerGradientId = useId();
	const innerGradientId = useId();

	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role={ariaLabel ? 'img' : undefined}
			aria-hidden={ariaLabel ? undefined : true}
			aria-label={ariaLabel}
		>
			<defs>
				<linearGradient id={outerGradientId} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="#E2E8F0" />
					<stop offset="0.5" stopColor="#FFFFFF" />
					<stop offset="1" stopColor="#F1F5F9" />
				</linearGradient>
				<linearGradient id={innerGradientId} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="#94A3B8" />
					<stop offset="1" stopColor="#CBD5E1" />
				</linearGradient>
			</defs>
			<path
				d="M12 3L3.5 18.5H8.5L12 12L15.5 18.5H20.5L12 3Z"
				fill={`url(#${outerGradientId})`}
			/>
			<circle cx="12" cy="16" r="2" fill={`url(#${innerGradientId})`} />
		</svg>
	);
}
