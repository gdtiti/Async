import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		include: ['main-src/**/*.test.ts'],
		pool: 'forks',
	},
});
