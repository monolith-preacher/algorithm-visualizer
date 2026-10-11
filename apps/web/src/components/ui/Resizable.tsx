import { Group, Panel, Separator } from 'react-resizable-panels';

import { cx } from '../../lib/cx';

export { Group, Panel };

export function Handle({ direction = 'horizontal' }: { direction?: 'horizontal' | 'vertical' }) {
  return (
    <Separator
      className={cx(
        'group relative shrink-0 bg-line transition-colors data-[separator=hover]:bg-cyan-dim data-[separator=active]:bg-cyan',
        direction === 'horizontal' ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize',
      )}
    >
      <span className={cx('absolute', direction === 'horizontal' ? 'inset-y-0 -left-1 -right-1' : 'inset-x-0 -top-1 -bottom-1')} />
    </Separator>
  );
}
