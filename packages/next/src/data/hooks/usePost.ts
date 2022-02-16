import {
	getPostAuthor,
	getPostTerms,
	PostEntity,
	PostParams,
	SinglePostFetchStrategy,
} from '@10up/headless-core';
import { useFetch } from './useFetch';
import { HookResponse } from './types';

interface usePostResponse extends HookResponse {
	data?: { post: PostEntity };
}

/**
 * The usePost hook. Returns a single post entity
 *
 * @param params - Supported params
 *
 * @returns
 */
export function usePost(params: PostParams): usePostResponse {
	const { data, error } = useFetch<PostEntity, PostParams>(
		{ _embed: true, ...params },
		usePost.fetcher(),
	);

	if (error) {
		return { error, loading: false };
	}

	if (!data) {
		return { loading: true };
	}

	// TODO: fix types
	const post = Array.isArray(data.result) ? (data.result[0] as PostEntity) : data.result;

	post.author = getPostAuthor(post);
	post.terms = getPostTerms(post);

	return { data: { post }, loading: false };
}

usePost.fetcher = () => new SinglePostFetchStrategy();
