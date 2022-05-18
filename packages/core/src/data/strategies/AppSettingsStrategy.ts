import { AppEntity } from '../types';
import { AbstractFetchStrategy, EndpointParams } from './AbstractFetchStrategy';
import { endpoints } from '../utils';

/**
 * @category Data Fetching
 */
export class AppSettingsStrategy extends AbstractFetchStrategy<AppEntity, EndpointParams> {
	getDefaultEndpoint(): string {
		return endpoints.appSettings;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getParamsFromURL(path: string): Partial<EndpointParams> {
		return { _embed: true };
	}
}
