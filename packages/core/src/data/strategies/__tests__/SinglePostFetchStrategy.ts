import { setHeadlessConfig } from '../../../utils';
import { apiGet } from '../../api';
import { PostParams, SinglePostFetchStrategy } from '../SinglePostFetchStrategy';

jest.mock('../../api');

const apiGetMock = jest.mocked(apiGet);

describe('SinglePostFetchStrategy', () => {
	let fetchStrategy: SinglePostFetchStrategy;

	beforeEach(() => {
		fetchStrategy = new SinglePostFetchStrategy();

		setHeadlessConfig({});
		apiGetMock.mockReset();
		apiGetMock.mockClear();
	});

	it('parses the url properly', async () => {
		expect(fetchStrategy.getParamsFromURL('/post-name')).toEqual({
			slug: 'post-name',
		});

		expect(fetchStrategy.getParamsFromURL('/2021/post-name')).toEqual({
			slug: 'post-name',
		});

		expect(fetchStrategy.getParamsFromURL('/2021/10/post-name')).toEqual({
			slug: 'post-name',
		});

		expect(fetchStrategy.getParamsFromURL('/2021/10/30/post-name')).toEqual({
			slug: 'post-name',
		});

		expect(fetchStrategy.getParamsFromURL('/parent/post-name')).toEqual({
			slug: 'post-name',
		});

		expect(fetchStrategy.getParamsFromURL('/2021/10/30/parent/post-name')).toEqual({
			slug: 'post-name',
		});
	});

	it('builds the endpoint url properly', () => {
		expect(fetchStrategy.buildEndpointURL({ slug: 'post-name' })).toBe(
			'/wp-json/wp/v2/posts?slug=post-name',
		);

		let params = fetchStrategy.getParamsFromURL('/2021/10/30/parent/post-name');
		expect(fetchStrategy.buildEndpointURL(params)).toBe('/wp-json/wp/v2/posts?slug=post-name');

		params = fetchStrategy.getParamsFromURL('/2021/10/30/post-name');
		expect(fetchStrategy.buildEndpointURL(params)).toBe('/wp-json/wp/v2/posts?slug=post-name');

		setHeadlessConfig({
			customPostTypes: [
				{
					slug: 'book',
					endpoint: '/wp-json/wp/v2/book',
				},
			],
		});

		expect(
			fetchStrategy.buildEndpointURL({
				slug: 'book-name',
				postType: 'book',
			}),
		).toBe('/wp-json/wp/v2/book?slug=book-name');

		// when passing multiple post types, buildEndpointUrl should use the first one to build the URL
		// Then fetch method would later fetch the rest of the post types if needed
		expect(
			fetchStrategy.buildEndpointURL({
				slug: 'book-name',
				postType: ['page', 'book'],
			}),
		).toBe('/wp-json/wp/v2/pages?slug=book-name');

		expect(
			fetchStrategy.buildEndpointURL({
				postType: 'book',
				id: 10,
			}),
		).toBe('/wp-json/wp/v2/book/10');

		expect(
			fetchStrategy.buildEndpointURL({
				postType: 'book',
				id: 10,
				revision: true,
			}),
		).toBe('/wp-json/wp/v2/book/10');

		expect(
			fetchStrategy.buildEndpointURL({
				postType: ['book', 'page'],
				id: 10,
				revision: true,
			}),
		).toBe('/wp-json/wp/v2/book/10');

		// ensure it throws an error if post type is not defined
		expect(() =>
			fetchStrategy.buildEndpointURL({
				postType: 'custom-post-type',
			}),
		).toThrow('Unknown post type, did you forget to add it to headless.config.js?');
	});

	it('fetches content properly', async () => {
		const samplePost = { title: 'test', id: 1, link: '/2021/10/post-name' };
		const sampleHeaders = {
			'x-wp-totalpages': 1,
			'x-wp-total': 1,
		};

		apiGetMock.mockResolvedValue({
			headers: sampleHeaders,
			json: [samplePost],
		});

		setHeadlessConfig({
			customPostTypes: [
				{
					slug: 'book',
					endpoint: '/wp-json/wp/v2/book',
				},
			],
		});

		let params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		const results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			'/wp-json/wp/v2/posts?slug=post-name',
			{},
			false,
		);
		expect(results).toMatchObject({
			result: samplePost,
			pageInfo: {
				page: 1,
				totalItems: 1,
				totalPages: 1,
			},
		});

		params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			2,
			'/wp-json/wp/v2/posts?slug=post-name',
			{},
			false,
		);

		params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		const paramsWithId = { ...params, id: 10 };
		await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(paramsWithId), paramsWithId);
		expect(apiGetMock).toHaveBeenNthCalledWith(3, '/wp-json/wp/v2/posts/10', {}, false);

		params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		const paramsWithPostType = { ...params, postType: 'book' };
		await fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL(paramsWithPostType),
			paramsWithPostType,
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			4,
			'/wp-json/wp/v2/book?slug=post-name',
			{},
			false,
		);

		params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		const paramsWithPostTypeAndId = { ...params, postType: 'book', id: 10 };
		await fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL(paramsWithPostTypeAndId),
			paramsWithPostTypeAndId,
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(5, '/wp-json/wp/v2/book/10', {}, false);

		apiGetMock.mockReset();
		apiGetMock.mockClear();

		apiGetMock.mockImplementation(async (url) => {
			const isBookEndpoint = url.includes('/wp/v2/book');
			const isPagesEndpoint = url.includes('/wp/v2/pages');

			if (isBookEndpoint || isPagesEndpoint) {
				return Promise.resolve({ headers: {}, json: [] });
			}

			return Promise.resolve({ headers: {}, json: [{ id: 1, link: '/2021/10/post-name' }] });
		});

		// when passing multiple post types and the first one is not found, the rest of the post types should be fetched
		params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		const paramsWithPostTypes = { ...params, postType: ['book', 'post'] };
		await fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL(paramsWithPostTypes),
			paramsWithPostTypes,
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			'/wp-json/wp/v2/book?slug=post-name',
			{},
			false,
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			2,
			'/wp-json/wp/v2/posts?slug=post-name',
			{},
			false,
		);
	});

	it('handle revisions', async () => {
		const samplePostRevision = { title: 'test', id: 1, link: '/post-name' };
		const sampleHeaders = {
			'x-wp-totalpages': 1,
			'x-wp-total': 1,
		};

		apiGetMock.mockResolvedValue({
			headers: sampleHeaders,
			json: [samplePostRevision],
		});

		const params = fetchStrategy.getParamsFromURL('/post-name');
		const revisionParams = { ...params, id: 1, revision: true, authToken: 'test token' };

		await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(revisionParams), revisionParams);

		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			'/wp-json/wp/v2/posts/1/revisions?per_page=1',
			{
				headers: { Authorization: 'Bearer test token' },
			},
			false,
		);
		expect(apiGetMock).toHaveBeenNthCalledWith(
			2,
			'/wp-json/wp/v2/posts/1',
			{
				headers: { Authorization: 'Bearer test token' },
			},
			false,
		);
	});

	it('handle draft posts', async () => {
		const samplePost = { title: 'test', id: 1 };
		const sampleHeaders = {
			'x-wp-totalpages': 1,
			'x-wp-total': 1,
		};

		apiGetMock.mockResolvedValue({
			headers: sampleHeaders,
			json: samplePost,
		});

		const params = fetchStrategy.getParamsFromURL('/post-name');
		const draftParams = { ...params, id: 10, authToken: 'test token' };

		await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(draftParams), draftParams);

		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			'/wp-json/wp/v2/posts/10',
			{
				headers: { Authorization: 'Bearer test token' },
			},
			false,
		);
	});

	it('throws errors with bad arguments', async () => {
		apiGetMock.mockImplementation(async (url) => {
			const isBookEndpoint = url.includes('/wp/v2/book');
			const ispagesEndpoint = url.includes('/wp/v2/pages');

			if (isBookEndpoint || ispagesEndpoint) {
				return Promise.resolve({ headers: {}, json: [] });
			}

			return Promise.resolve({ headers: {}, json: [{ id: 1 }] });
		});

		setHeadlessConfig({
			customPostTypes: [
				{
					slug: 'book',
					endpoint: '/wp-json/wp/v2/book',
				},
			],
		});

		let params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		let paramsWithPostTypes = { ...params, postType: ['book', 'unknown-post-type'] };
		let fetchPromise = fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL(paramsWithPostTypes),
			paramsWithPostTypes,
		);

		await expect(fetchPromise).rejects.toThrow(
			'Unknown post type, did you forget to add it to headless.config.js?',
		);

		params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		paramsWithPostTypes = {
			...params,
			postType: ['book', 'unknown-post-type-1', 'unknown-post-type-2'],
		};
		fetchPromise = fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL(paramsWithPostTypes),
			paramsWithPostTypes,
		);

		await expect(fetchPromise).rejects.toThrow(
			'Unknown post type, did you forget to add it to headless.config.js?',
		);
	});

	it('handles child pages with same slugs and different parents', async () => {
		const childPost1 = { title: 'test', id: 1, link: 'http://sourceurl.com/parent-page/about' };
		const childPost2 = {
			title: 'test',
			id: 2,
			link: 'http://sourceurl.com/parent-page-2/about',
		};

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 2,
			},
			json: [childPost1, childPost2],
		});

		fetchStrategy.setBaseURL('http://sourceurl.com');

		let params = fetchStrategy.getParamsFromURL('/parent-page-2/about');
		let results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: childPost2,
		});

		params = fetchStrategy.getParamsFromURL('/parent-page/about');

		results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: childPost1,
		});
	});

	it('handles post path mapping', async () => {
		const englishPostSlug = 'test';
		const utf8EncodedPostSlug = 'لأخبار-المالية';

		const post1 = {
			title: 'test',
			id: 1,
			link: `http://sourceurl.com/${englishPostSlug}`,
		};

		const post2 = {
			title: 'test',
			id: 2,
			link: `http://sourceurl.com/${encodeURIComponent(utf8EncodedPostSlug)}`,
		};

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post1],
		});

		fetchStrategy.setBaseURL('http://sourceurl.com');

		let params = fetchStrategy.getParamsFromURL(`/${englishPostSlug}`);
		let results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: post1,
		});

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post2],
		});

		params = fetchStrategy.getParamsFromURL(`/${utf8EncodedPostSlug}`);
		results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: post2,
		});
	});

	it('handles post path mapping for cpts', async () => {
		const englishPostSlug = 'test';
		const utf8EncodedPostSlug = 'لأخبار-المالية';

		setHeadlessConfig({
			customPostTypes: [
				{
					endpoint: 'https://sourceurl.com',
					slug: 'book',
					single: '/book',
					archive: '/books',
				},
			],
		});

		const post1 = {
			title: 'test',
			id: 1,
			link: `http://sourceurl.com/book/${englishPostSlug}`,
			type: 'book',
		};

		const post2 = {
			title: 'test',
			id: 2,
			type: 'book',
			link: `http://sourceurl.com/book/${encodeURIComponent(utf8EncodedPostSlug)}`,
		};

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post1],
		});

		fetchStrategy.setBaseURL('http://sourceurl.com');

		const fetchParams = { postType: 'book' };
		let params = fetchStrategy.getParamsFromURL(`/${englishPostSlug}`);

		let results = await fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL({ ...params, ...fetchParams }),
			{ ...params, ...fetchParams },
		);

		expect(results).toMatchObject({
			result: post1,
		});

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post2],
		});

		params = fetchStrategy.getParamsFromURL(`/${utf8EncodedPostSlug}`);
		results = await fetchStrategy.fetcher(
			fetchStrategy.buildEndpointURL({ ...params, ...fetchParams }),
			{ ...params, ...fetchParams },
		);

		expect(results).toMatchObject({
			result: post2,
		});
	});

	it('handle post path mapping with locale', async () => {
		const englishPostSlug = 'test';
		const utf8EncodedPostSlug = 'لأخبار-المالية';

		const post1 = {
			title: 'test',
			id: 1,
			link: `http://sourceurl.com/en/${englishPostSlug}`,
		};

		const post2 = {
			title: 'test',
			id: 2,
			link: `http://sourceurl.com/ar/${encodeURIComponent(utf8EncodedPostSlug)}`,
		};

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post1],
		});

		setHeadlessConfig({
			integrations: {
				polylang: {
					enable: true,
				},
			},
		});

		fetchStrategy.setBaseURL('http://sourceurl.com');

		let params: Partial<PostParams> = { lang: 'en' };
		params = fetchStrategy.getParamsFromURL(`/${englishPostSlug}`, params);
		let results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: post1,
		});

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post2],
		});

		params = { lang: 'ar' };
		params = fetchStrategy.getParamsFromURL(`/${utf8EncodedPostSlug}`, params);
		results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: post2,
		});

		// if lang is not passed it should fail
		params = fetchStrategy.getParamsFromURL(`/${utf8EncodedPostSlug}`);

		await expect(
			fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params),
		).rejects.toThrow();
	});

	it('handle post path mapping with locale for cpts', async () => {
		const englishPostSlug = 'test';
		const utf8EncodedPostSlug = 'لأخبار-المالية';

		const post1 = {
			title: 'test',
			id: 1,
			link: `http://sourceurl.com/en/book/${englishPostSlug}`,
			type: 'book',
		};

		const post2 = {
			title: 'test',
			id: 2,
			link: `http://sourceurl.com/ar/book/${encodeURIComponent(utf8EncodedPostSlug)}`,
			type: 'book',
		};

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post1],
		});

		setHeadlessConfig({
			integrations: {
				polylang: {
					enable: true,
				},
			},
			customPostTypes: [
				{
					endpoint: 'https://sourceurl.com',
					slug: 'book',
					single: '/book',
					archive: '/books',
				},
			],
		});

		fetchStrategy.setBaseURL('http://sourceurl.com');

		let params: Partial<PostParams> = { lang: 'en', postType: 'book' };
		params = { ...params, ...fetchStrategy.getParamsFromURL(`/${englishPostSlug}`, params) };
		let results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: post1,
		});

		apiGetMock.mockResolvedValue({
			headers: {
				'x-wp-totalpages': 1,
				'x-wp-total': 1,
			},
			json: [post2],
		});

		params = { lang: 'ar', postType: 'book' };
		params = {
			...params,
			...fetchStrategy.getParamsFromURL(`/${utf8EncodedPostSlug}`, params),
		};
		results = await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params);

		expect(results).toMatchObject({
			result: post2,
		});

		// if lang is not passed it should fail
		params = fetchStrategy.getParamsFromURL(`/${utf8EncodedPostSlug}`);

		await expect(
			fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params),
		).rejects.toThrow();
	});

	it('allows overriding default params', () => {
		const defaultParams = { postType: 'book' };
		const fetcher = new SinglePostFetchStrategy('http://sourceurl.com', defaultParams);
		expect(fetcher.getDefaultParams()).toMatchObject(defaultParams);
	});

	it('appends timestamp when passing burstCache flag', async () => {
		const samplePost = { title: 'test', id: 1, link: '/2021/10/post-name' };
		const sampleHeaders = {
			'x-wp-totalpages': 1,
			'x-wp-total': 1,
		};

		apiGetMock.mockResolvedValue({
			headers: sampleHeaders,
			json: [samplePost],
		});

		const params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		await fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params, {
			burstCache: true,
		});

		expect(apiGetMock).toHaveBeenNthCalledWith(
			1,
			'/wp-json/wp/v2/posts?slug=post-name',
			{},
			true,
		);
	});

	it('does not thrown error for path not matching if there are no posts and throwIfNotFound is set to false', async () => {
		const sampleHeaders = {
			'x-wp-totalpages': 0,
			'x-wp-total': 0,
		};

		apiGetMock.mockResolvedValue({
			headers: sampleHeaders,
			json: [],
		});

		const params = fetchStrategy.getParamsFromURL('/2021/10/post-name');
		const promise = fetchStrategy.fetcher(fetchStrategy.buildEndpointURL(params), params, {
			throwIfNotFound: false,
		});

		// if there aren't any posts there's nothing to match for so this should not happen
		// it should just resolve to an empty array
		await expect(promise).resolves.toMatchObject({
			pageInfo: { page: 1, totalItems: 0, totalPages: 0 },
			queriedObject: {},
			result: {},
		});
	});
});
