import { useEffect, useRef, useState } from 'react';

import { EDITOR_FONT, monaco } from '../../lib/monaco';

type Options = monaco.editor.IStandaloneEditorConstructionOptions;

/** Creates a Monaco editor in the container for the lifetime of the component. */
export function useMonacoEditor(options: Options) {
  const container = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  const initial = useRef(options);

  useEffect(() => {
    if (!container.current) {
      return;
    }
    const instance = monaco.editor.create(container.current, {
      theme: 'av-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      padding: { top: 10, bottom: 10 },
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, useShadows: false },
      ...EDITOR_FONT,
      ...initial.current,
    });
    setEditor(instance);
    return () => {
      instance.getModel()?.dispose();
      instance.dispose();
    };
  }, []);

  return { container, editor };
}
