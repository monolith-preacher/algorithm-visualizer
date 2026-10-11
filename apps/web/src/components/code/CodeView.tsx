import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { SourceMap } from '@av/shared';

import { cx } from '../../lib/cx';
import { monaco } from '../../lib/monaco';
import { IconButton } from '../ui/Button';
import { Tabs } from '../ui/misc';
import { useMonacoEditor } from './useMonacoEditor';

interface CodeViewProps {
  fileName: string;
  headerName: string;
  map: SourceMap;
  header: string;
  /** Line to highlight, in raw (instrumented) numbering. */
  line: number | null;
}

/**
 * The real C source of the algorithm. By default instrumentation lines are
 * hidden; the toggle shows the file exactly as compiled.
 */
export function CodeView({ fileName, headerName, map, header, line }: CodeViewProps) {
  const [tab, setTab] = useState<'source' | 'header'>('source');
  const [raw, setRaw] = useState(false);
  const { container, editor } = useMonacoEditor({
    readOnly: true,
    domReadOnly: true,
    language: 'c',
    glyphMargin: true,
    folding: false,
    lineNumbersMinChars: 3,
    renderValidationDecorations: 'off',
    contextmenu: false,
    occurrencesHighlight: 'off',
    selectionHighlight: false,
    matchBrackets: 'never',
  });
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  const text = tab === 'header' ? header : raw ? map.rawLines.join('\n') : map.cleanText;

  useEffect(() => {
    if (!editor) {
      return;
    }
    const model = editor.getModel();
    if (model && model.getValue() === text) {
      return;
    }
    const next = monaco.editor.createModel(text, 'c');
    editor.setModel(next);
    model?.dispose();
    decorations.current = editor.createDecorationsCollection();
  }, [editor, text]);

  useEffect(() => {
    if (!editor || !decorations.current) {
      return;
    }
    const items: monaco.editor.IModelDeltaDecoration[] = [];
    if (tab === 'source') {
      if (raw) {
        for (const l of map.instrumentation) {
          items.push({ range: new monaco.Range(l, 1, l, 1), options: { isWholeLine: true, inlineClassName: 'av-trace-line' } });
        }
      }
      const target = line === null ? null : raw ? map.resolve(line) : map.toClean(line);
      if (target !== null) {
        items.push({
          range: new monaco.Range(target, 1, target, 1),
          options: { isWholeLine: true, className: 'av-exec-line', glyphMarginClassName: 'av-exec-glyph' },
        });
        editor.revealLineInCenterIfOutsideViewport(target, monaco.editor.ScrollType.Smooth);
      }
    }
    decorations.current.set(items);
  }, [editor, line, raw, tab, map, text]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex h-8 shrink-0 items-stretch justify-between border-b border-line pr-1.5">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'source', label: fileName },
            { id: 'header', label: headerName },
          ]}
        />
        <div className={cx('flex items-center', tab !== 'source' && 'invisible')}>
          <IconButton
            label={raw ? 'Hide instrumentation (TRACE_* lines)' : 'Show instrumentation (TRACE_* lines)'}
            active={raw}
            onClick={() => setRaw(!raw)}
            className="h-6 w-6"
          >
            {raw ? <Eye size={12} /> : <EyeOff size={12} />}
          </IconButton>
        </div>
      </div>
      <div ref={container} className="min-h-0 flex-1" />
    </div>
  );
}
