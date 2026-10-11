/**
 * Local Monaco setup (no CDN): the core editor API, a curated set of editor
 * contributions, the C tokenizer and a dark theme matching the application.
 */
import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

import '@monaco-esm/base/browser/ui/codicons/codicon/codicon.css';
import '@monaco-esm/base/browser/ui/codicons/codicon/codicon-modifiers.css';
import '@monaco-esm/editor/browser/coreCommands.js';
import '@monaco-esm/editor/browser/widget/codeEditor/codeEditorWidget.js';
import '@monaco-esm/editor/contrib/bracketMatching/browser/bracketMatching.js';
import '@monaco-esm/editor/contrib/caretOperations/browser/caretOperations.js';
import '@monaco-esm/editor/contrib/clipboard/browser/clipboard.js';
import '@monaco-esm/editor/contrib/comment/browser/comment.js';
import '@monaco-esm/editor/contrib/contextmenu/browser/contextmenu.js';
import '@monaco-esm/editor/contrib/cursorUndo/browser/cursorUndo.js';
import '@monaco-esm/editor/contrib/find/browser/findController.js';
import '@monaco-esm/features/find/register.js';
import '@monaco-esm/editor/contrib/folding/browser/folding.js';
import '@monaco-esm/editor/contrib/fontZoom/browser/fontZoom.js';
import '@monaco-esm/editor/contrib/gotoError/browser/gotoError.js';
import '@monaco-esm/editor/contrib/gotoError/browser/markerSelectionStatus.js';
import '@monaco-esm/editor/contrib/hover/browser/hoverContribution.js';
import '@monaco-esm/editor/contrib/indentation/browser/indentation.js';
import '@monaco-esm/editor/contrib/lineSelection/browser/lineSelection.js';
import '@monaco-esm/editor/contrib/linesOperations/browser/linesOperations.js';
import '@monaco-esm/editor/contrib/multicursor/browser/multicursor.js';
import '@monaco-esm/editor/contrib/smartSelect/browser/smartSelect.js';
import '@monaco-esm/editor/contrib/snippet/browser/snippetController2.js';
import '@monaco-esm/editor/contrib/suggest/browser/suggestController.js';
import '@monaco-esm/editor/contrib/wordOperations/browser/wordOperations.js';
import '@monaco-esm/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import '@monaco-esm/languages/definitions/cpp/register.js';

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

monaco.editor.defineTheme('av-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'd6dde7' },
    { token: 'comment', foreground: '5b6778', fontStyle: 'italic' },
    { token: 'keyword', foreground: '22d3ee' },
    { token: 'keyword.directive', foreground: 'c084fc' },
    { token: 'number', foreground: 'f5b942' },
    { token: 'string', foreground: '3ddc97' },
    { token: 'string.escape', foreground: '6ee7b7' },
    { token: 'type', foreground: '7dd3fc' },
    { token: 'identifier', foreground: 'd6dde7' },
    { token: 'delimiter', foreground: '8793a3' },
    { token: 'operator', foreground: '9fb0c3' },
    { token: 'annotation', foreground: 'c084fc' },
  ],
  colors: {
    'editor.background': '#0e131a',
    'editor.foreground': '#d6dde7',
    'editorLineNumber.foreground': '#3c4757',
    'editorLineNumber.activeForeground': '#8793a3',
    'editor.lineHighlightBackground': '#131a2380',
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': '#22d3ee33',
    'editor.inactiveSelectionBackground': '#22d3ee1f',
    'editorCursor.foreground': '#22d3ee',
    'editorIndentGuide.background1': '#1c2430',
    'editorIndentGuide.activeBackground1': '#283241',
    'editorGutter.background': '#0e131a',
    'editorWidget.background': '#131a23',
    'editorWidget.border': '#283241',
    'editorSuggestWidget.background': '#131a23',
    'editorSuggestWidget.selectedBackground': '#1c2430',
    'editorHoverWidget.background': '#131a23',
    'editorHoverWidget.border': '#283241',
    'editorError.foreground': '#ff5c7a',
    'editorWarning.foreground': '#f5b942',
    'scrollbarSlider.background': '#28324166',
    'scrollbarSlider.hoverBackground': '#283241aa',
    'editorOverviewRuler.border': '#00000000',
    'minimap.background': '#0e131a',
  },
});

export const EDITOR_FONT = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 13,
  lineHeight: 20,
  fontLigatures: false,
};

export { monaco };
