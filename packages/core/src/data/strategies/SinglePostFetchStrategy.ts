import { getCustomPostType, ConfigError } from '../../utils';
import { PostEntity } from '../types';
import { postMatchers } from '../utils/matchers';
import { parsePath } from '../utils/parsePath';
import { AbstractFetchStrategy, EndpointParams, FetchOptions } from './AbstractFetchStrategy';
import { endpoints } from '../utils';

export interface PostParams extends EndpointParams {
	slug?: string;
	postType?: string | string[];
	id?: Number;
	revision?: Boolean;
	authToken?: string;
}

/**
 * @category Data Fetching
 */
export class SinglePostFetchStrategy extends AbstractFetchStrategy<PostEntity, PostParams> {
	getDefaultEndpoint(): string {
		return endpoints.posts;
	}

	getParamsFromURL(path: string): Partial<PostParams> {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { year, day, month, ...params } = parsePath(postMatchers, path);

		return params;
	}

	buildEndpointURL(params: PostParams) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id, authToken, revision, postType, ...endpointParams } = params;

		if (params.postType) {
			// if postType is a array of slugs, start off with the first post type
			const postTypeSlug = Array.isArray(params.postType)
				? params.postType[0]
				: params.postType;

			const postType = getCustomPostType(postTypeSlug);

			if (!postType) {
				throw new ConfigError(
					'Unkown post type, did you forget to add it to headless.config.js?',
				);
			}

			this.setEndpoint(postType.endpoint);
		}

		if (id) {
			this.setEndpoint(`${this.getEndpoint()}/${id}`);
			if (endpointParams.slug) {
				delete endpointParams.slug;
			}
		}

		if (revision) {
			this.setEndpoint(`${this.getEndpoint()}/revisions`);
		}

		return super.buildEndpointURL(endpointParams);
	}

	async fetcher(url: string, params: PostParams, options: Partial<FetchOptions> = {}) {
		if (params.authToken) {
			options.bearerToken = params.authToken;
		}

		let error;
		try {
			const result = await super.fetcher(url, params, options);

			return result;
		} catch (e) {
			error = e;
		}

		// should throw error if didn't find anything and params.postType is not an array.
		if (!Array.isArray(params.postType)) {
			throw error;
		}

		// skip first post type as it has already been feteched
		const [, ...postTypes] = params.postType;

		let result;
		for await (const postType of postTypes) {
			try {
				const newParams = { ...params, postType };
				const endpointUrl = this.buildEndpointURL({ ...newParams, postType });

				result = await super.fetcher(endpointUrl, newParams, options);
			} catch (e) {
				error = e;
			}
		}

		if (!result) {
			throw error;
		}

		return result;
	}
}
