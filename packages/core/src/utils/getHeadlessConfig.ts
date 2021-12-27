import { HeadlessConfig } from '../provider/types';

export function getHeadlessConfig() {
	// @ts-ignore
	const { customPostTypes, redirectStrategy } = HEADLESS_CONFIG;

	const headlessConfig: HeadlessConfig = {
		customPostTypes: customPostTypes || [],
		redirectStrategy: redirectStrategy || 'none',
	};

	return headlessConfig;
}
