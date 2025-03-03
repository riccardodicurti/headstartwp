import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { expectTypeOf } from 'expect-type';
import { DRAFT_POST_ID, VALID_AUTH_TOKEN } from '../../../../test/server';
import { PostEntity, PostParams } from '../../../data';
import { SettingsProvider } from '../../provider';
import { useFetchPost } from '../useFetchPost';

describe('useFetchPost', () => {
	const wrapper = ({ children }) => {
		return <SettingsProvider settings={{ sourceUrl: '' }}>{children}</SettingsProvider>;
	};

	it('throws errors if accessing data before fetch', async () => {
		const { result } = renderHook(
			() => useFetchPost({ slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto' }),
			{ wrapper },
		);

		// should throw before we have any actual results
		expect(() => result.current.data?.post.title).toThrow(
			'You are trying to access "post.title" but it is not available yet. Did you forget to fetch data on the server? Otherwise, handle the loading and error states accordingly',
		);
		expect(result.current.loading).toBe(true);

		await waitFor(() => {
			expect(result.current.error).toBeUndefined();
			expect(result.current.loading).toBe(false);
			expect(() => result.current.data).not.toThrow();
		});
	});

	it('fetches data properly', async () => {
		const { result } = renderHook(
			() => useFetchPost({ slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto' }),
			{ wrapper },
		);

		await waitFor(() =>
			expect(result.current.data?.post.slug).toBe(
				'modi-qui-dignissimos-sed-assumenda-sint-iusto',
			),
		);
	});

	it('fetch by id', async () => {
		const { result } = renderHook(() => useFetchPost({ id: 64 }), {
			wrapper,
		});

		await waitFor(() => {
			expect(result.current.data?.post.id).toBe(64);
			expect(result.current.data?.post.slug).toBe('ipsum-repudiandae-est-nam');
		});
	});

	it('errors if fetches draft posts without authToken', async () => {
		// 57 is a hardcoded draft post in msw
		const { result } = renderHook(() => useFetchPost({ id: 57 }), {
			wrapper,
		});

		await waitFor(() => expect(result.current.error).toBeTruthy());
	});

	it('fetches draft posts with authToken', async () => {
		// 57 is a hardcoded draft post in msw
		const { result } = renderHook(
			() => useFetchPost({ id: DRAFT_POST_ID, authToken: VALID_AUTH_TOKEN }),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(result.current.error).toBeFalsy();
			expect(result.current.data?.post.id).toBe(57);
		});
	});

	it('errors if fetches revisions without authToken', async () => {
		const { result } = renderHook(() => useFetchPost({ id: 57, revision: true }), {
			wrapper,
		});

		await waitFor(() => expect(result.current.error).toBeTruthy());
	});

	it('fetches revisions with authToken', async () => {
		const { result } = renderHook(
			() => useFetchPost({ id: 64, revision: true, authToken: 'Fake Auth Token' }),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(result.current.error).toBeFalsy();
			expect(result.current.data?.post.id).toBe(64);
			expect(result.current.data?.post.slug).toBe('ipsum-repudiandae-est-nam');
			// ensure fields that don't exists in revisions are returned
			expect(result.current.data?.post.format).toBe('standard');
			expect(result.current.data?.post?.terms?.category[0]?.slug).toBe('news');
		});
	});

	it('keeps backwards compatibility with swr options and that a warning is made', async () => {
		// eslint-disable-next-line no-console
		console.warn = jest.fn();

		// should not fetch anything
		const { result } = renderHook(
			() =>
				useFetchPost(
					{ slug: 'random slug' },
					{
						// @ts-expect-error
						revalidateOnMount: false,
					},
				),
			{
				wrapper,
			},
		);

		// eslint-disable-next-line no-console
		expect(console.warn).toHaveBeenCalledTimes(1);

		// eslint-disable-next-line no-console
		expect(console.warn).toHaveBeenCalledWith(
			'useSWR options should be passed under the swr namespace. "{ swr: {"revalidateOnMount":false} }"',
		);

		expect(result.current.error).toBeFalsy();
	});

	it('respect swr option', async () => {
		// should not fetch anything
		const { result } = renderHook(
			() =>
				useFetchPost(
					{ slug: 'random slug' },
					{
						swr: {
							revalidateOnMount: false,
						},
					},
				),
			{
				wrapper,
			},
		);

		// await expect(() => waitForNextUpdate({ timeout: 100 })).rejects.toThrow();

		expect(result.current.error).toBeFalsy();
	});

	it('reads param from the url and sets isMainQuery flag', async () => {
		const { result } = renderHook(
			() => useFetchPost({}, {}, '/modi-qui-dignissimos-sed-assumenda-sint-iusto'),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(result.current.error).toBeFalsy();
			expect(result.current.data?.post.slug).toBe(
				'modi-qui-dignissimos-sed-assumenda-sint-iusto',
			);
			expect(result.current.isMainQuery).toBe(true);
		});

		const { result: secondResult } = renderHook(
			() => useFetchPost({ slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto' }),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(secondResult.current.error).toBeFalsy();
			expect(secondResult.current.data?.post.slug).toBe(
				'modi-qui-dignissimos-sed-assumenda-sint-iusto',
			);
			expect(secondResult.current.isMainQuery).toBe(false);
		});
	});

	it('matches post.link with current path when matchCurrentPath is set', async () => {
		const { result } = renderHook(
			() =>
				useFetchPost(
					{
						slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto',
						matchCurrentPath: true,
					},
					{},
					'/another-path',
				),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(result.current.error).toBeTruthy();
		});

		const { result: secondResult } = renderHook(
			() =>
				useFetchPost(
					{
						slug: 'modi-qui-dignissimos-sed-assumenda-sint-iusto',
					},
					{},
					'/another-path',
				),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(secondResult.current.data?.post.slug).toBe(
				'modi-qui-dignissimos-sed-assumenda-sint-iusto',
			);
		});
	});

	it('matches post.link with fullPath when set', async () => {
		const { result } = renderHook(
			() =>
				useFetchPost(
					{
						// force post path mapping against this path
						fullPath:
							'https://js1.10up.com/2020/05/07/modi-qui-dignissimos-sed-assumenda-sint-iusto',
					},
					{},
					'/modi-qui-dignissimos-sed-assumenda-sint-iusto',
				),
			{
				wrapper,
			},
		);

		await waitFor(() => {
			expect(result.current.error).toBeFalsy();
			expect(result.current.data?.post.slug).toBe(
				'modi-qui-dignissimos-sed-assumenda-sint-iusto',
			);
		});
	});
});

describe('useFetchPost types', () => {
	it('allows overriding types', () => {
		interface Book extends PostEntity {
			isbn: string;
		}

		interface BookParams extends PostParams {
			isbn: string;
		}

		const { result } = renderHook(() => useFetchPost<Book, BookParams>({ isbn: 'sdasd' }));

		expectTypeOf(result.current.data?.post).toMatchTypeOf<
			| {
					isbn: string;
			  }
			| undefined
		>();
	});
});
