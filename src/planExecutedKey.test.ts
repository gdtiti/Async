import { describe, expect, it } from 'vitest';
import { planExecutedKey } from './planExecutedKey';

describe('planExecutedKey', () => {
	it('prefers relative path', () => {
		expect(planExecutedKey('/proj', '.async/plans/a.plan.md', null)).toBe('.async/plans/a.plan.md');
	});

	it('strips workspace root from absolute path', () => {
		expect(planExecutedKey('D:/proj', null, 'D:/proj/.async/plans/x.plan.md')).toBe(
			'.async/plans/x.plan.md'
		);
	});
});
