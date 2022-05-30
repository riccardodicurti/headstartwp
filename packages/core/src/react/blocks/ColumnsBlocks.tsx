import { isBlock } from '../../dom';
import { IBlock } from '../components';
import { useBlock } from './hooks';
import { useBlockAttributes } from './hooks/useBlockAttributes';
import { IBlockAttributes } from './types';

export interface ColumnsBlockProps extends IBlockAttributes {}

export interface IColumnsBlock extends IBlock<ColumnsBlockProps> {}

export function ColumnsBlock({ domNode: node, children, component: Component }: IColumnsBlock) {
	const { name, className } = useBlock(node);
	const blockAttributes = useBlockAttributes(node);

	return (
		<Component name={name} domNode={node} className={className} attributes={blockAttributes}>
			{children}
		</Component>
	);
}

/**
 * @internal
 */
// eslint-disable-next-line no-redeclare
export namespace ColumnsBlock {
	export const defaultProps = {
		test: (node) => isBlock(node, { tagName: 'div', className: 'wp-block-columns' }),
	};
}
