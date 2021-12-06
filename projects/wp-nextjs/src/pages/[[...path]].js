import { usePosts, fetchHookData, addHookData, handleError } from '@10up/headless-next';

const Home = () => {
	const { loading, data } = usePosts();

	return loading ? (
		'Loading...'
	) : (
		<ul>
			{data.posts.map((post) => (
				<li key={post.id}>{post.title.rendered}</li>
			))}
		</ul>
	);
};

export default Home;

export async function getServerSideProps(context) {
	try {
		const hookData = await fetchHookData('usePosts', context);

		return addHookData(hookData, {});
	} catch (e) {
		return handleError(e);
	}
}
