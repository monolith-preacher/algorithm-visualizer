import { useEffect, useLayoutEffect, useRef } from 'react';

import { useMonacoEditor } from '../components/code/useMonacoEditor';
import { monaco } from '../lib/monaco';
import { useActiveFile, useFiles } from './files';
import { useSession } from './session';

export interface EditorCommands {
  run(): void;
  debug(): void;
  stepOver(): void;
  stepInto(): void;
  stepOut(): void;
  stop(): void;
}

const models = new Map<string, monaco.editor.ITextModel>();

function modelFor(id: string, code: string): monaco.editor.ITextModel {
  let model = models.get(id);
  if (!model || model.isDisposed()) {
    model = monaco.editor.createModel(code, 'c', monaco.Uri.parse(`file:///${id}/main.c`));
    models.set(id, model);
  } else if (model.getValue() !== code) {
    model.setValue(code);
  }
  return model;
}

/**
 * Editable C source with GCC diagnostics as markers, breakpoints in the
 * glyph margin and the debugger's current line.
 */
export function CodeEditor({ commands }: { commands: EditorCommands }) {
  const file = useActiveFile();
  const update = useFiles((s) => s.update);
  const toggleBreakpoint = useFiles((s) => s.toggleBreakpoint);
  const diagnostics = useSession((s) => s.diagnostics);
  const debugging = useSession((s) => s.debugging);
  const snapshot = useSession((s) => s.snapshot);
  const selectedFrame = useSession((s) => s.selectedFrame);
  const confirmed = useSession((s) => s.confirmedBreakpoints);
  const { container, editor } = useMonacoEditor({
    language: 'c',
    glyphMargin: true,
    lineNumbersMinChars: 3,
    tabSize: 4,
    insertSpaces: true,
    autoIndent: 'full',
    formatOnType: true,
    renderLineHighlight: 'line',
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: false, indentation: true },
    stickyScroll: { enabled: false },
    wordBasedSuggestions: 'currentDocument',
    quickSuggestions: { other: true, comments: false, strings: false },
  });
  const breakpointDecorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const debugDecorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const hoverDecorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const commandsRef = useRef(commands);
  const fileRef = useRef(file);
  useLayoutEffect(() => {
    commandsRef.current = commands;
    fileRef.current = file;
  });

  // One model per file keeps independent undo histories. External changes
  // (revert, import) are pushed into the model; edits made here already match.
  useEffect(() => {
    if (!editor) {
      return;
    }
    const model = modelFor(file.id, file.code);
    if (editor.getModel() !== model) {
      editor.setModel(model);
    }
  }, [editor, file.id, file.code]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    breakpointDecorations.current = editor.createDecorationsCollection();
    debugDecorations.current = editor.createDecorationsCollection();
    hoverDecorations.current = editor.createDecorationsCollection();
    const subscriptions = [
      editor.onDidChangeModelContent(() => {
        const current = fileRef.current;
        const value = editor.getValue();
        if (value !== current.code) {
          update(current.id, value);
        }
      }),
      editor.onMouseDown((e) => {
        const target = e.target;
        if (
          (target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
            target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) &&
          target.position
        ) {
          toggleBreakpoint(fileRef.current.id, target.position.lineNumber);
        }
      }),
      editor.onMouseMove((e) => {
        const line = e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ? e.target.position?.lineNumber : undefined;
        hoverDecorations.current?.set(
          line && !fileRef.current.breakpoints.includes(line)
            ? [{ range: new monaco.Range(line, 1, line, 1), options: { glyphMarginClassName: 'av-breakpoint-hint' } }]
            : [],
        );
      }),
      editor.onMouseLeave(() => hoverDecorations.current?.set([])),
    ];
    const { KeyMod, KeyCode } = monaco;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => commandsRef.current.run());
    editor.addCommand(KeyCode.F5, () => commandsRef.current.debug());
    editor.addCommand(KeyMod.Shift | KeyCode.F5, () => commandsRef.current.stop());
    editor.addCommand(KeyCode.F10, () => commandsRef.current.stepOver());
    editor.addCommand(KeyCode.F11, () => commandsRef.current.stepInto());
    editor.addCommand(KeyMod.Shift | KeyCode.F11, () => commandsRef.current.stepOut());
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, () => undefined);
    return () => subscriptions.forEach((s) => s.dispose());
  }, [editor, update, toggleBreakpoint]);

  useEffect(() => {
    editor?.updateOptions({ readOnly: debugging, readOnlyMessage: { value: 'Stop the debug session to edit the program.' } });
  }, [editor, debugging]);

  useEffect(() => {
    const model = editor?.getModel();
    if (!model) {
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      'gcc',
      diagnostics.map((d) => ({
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.line,
        endColumn: Math.max(d.column + 1, model.getLineMaxColumn(Math.min(d.line, model.getLineCount()))),
        message: d.message,
        severity:
          d.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : d.severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
        source: 'gcc',
      })),
    );
  }, [editor, diagnostics, file.id]);

  useEffect(() => {
    const lines = debugging && confirmed.length > 0 ? confirmed : file.breakpoints;
    breakpointDecorations.current?.set(
      lines.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: { glyphMarginClassName: 'av-breakpoint-glyph', glyphMarginHoverMessage: { value: 'Breakpoint' } },
      })),
    );
  }, [editor, file.breakpoints, confirmed, debugging]);

  useEffect(() => {
    if (!editor || !debugDecorations.current) {
      return;
    }
    const items: monaco.editor.IModelDeltaDecoration[] = [];
    const top = snapshot?.frames.find((f) => f.user);
    const selected = snapshot?.frames.find((f) => f.level === selectedFrame);
    if (snapshot && top?.line) {
      items.push({
        range: new monaco.Range(top.line, 1, top.line, 1),
        options: {
          isWholeLine: true,
          className: snapshot.signal ? 'av-crash-line' : 'av-exec-line',
          glyphMarginClassName: 'av-exec-glyph',
        },
      });
      editor.revealLineInCenterIfOutsideViewport(top.line, monaco.editor.ScrollType.Smooth);
    }
    if (selected && selected !== top && selected.user && selected.line) {
      items.push({ range: new monaco.Range(selected.line, 1, selected.line, 1), options: { isWholeLine: true, className: 'av-frame-line' } });
      editor.revealLineInCenterIfOutsideViewport(selected.line, monaco.editor.ScrollType.Smooth);
    }
    debugDecorations.current.set(items);
  }, [editor, snapshot, selectedFrame]);

  return <div ref={container} className="h-full min-h-0 w-full" />;
}

/** Reveals a line (e.g. from the Problems list). */
export function revealLine(fileId: string, line: number, column = 1): void {
  const model = models.get(fileId);
  const editor = monaco.editor.getEditors().find((e) => e.getModel() === model);
  editor?.revealLineInCenter(line);
  editor?.setPosition({ lineNumber: line, column });
  editor?.focus();
}

export function disposeModel(fileId: string): void {
  models.get(fileId)?.dispose();
  models.delete(fileId);
}
