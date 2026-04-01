import * as monaco from 'monaco-editor'

const LATEX_LANGUAGE_ID = 'latex-workshop-lite'

let isLanguageRegistered = false

const LATEX_COMMANDS = [
  'section',
  'subsection',
  'subsubsection',
  'paragraph',
  'textbf',
  'textit',
  'emph',
  'begin',
  'end',
  'item',
  'itemize',
  'enumerate',
  'figure',
  'table',
  'label',
  'ref',
  'cite',
  'includegraphics',
  'caption',
  'usepackage',
  'documentclass',
  'maketitle',
  'author',
  'title',
]

const LATEX_ENVIRONMENTS = [
  'document',
  'abstract',
  'equation',
  'align',
  'itemize',
  'enumerate',
  'figure',
  'table',
  'tabular',
  'center',
]

function ensureLatexLanguageRegistered() {
  if (isLanguageRegistered) {
    return
  }

  monaco.languages.register({ id: LATEX_LANGUAGE_ID, aliases: ['LaTeX'] })

  monaco.languages.setMonarchTokensProvider(LATEX_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/\\[a-zA-Z@]+\*?/, 'keyword'],
        [/%.*/, 'comment'],
        [/\$\$[^$]*\$\$/, 'string'],
        [/\$[^$]*\$/, 'string'],
        [/[{}\[\]()]/, 'delimiter'],
        [/[0-9]+/, 'number'],
      ],
    },
  })

  monaco.languages.setLanguageConfiguration(LATEX_LANGUAGE_ID, {
    comments: {
      lineComment: '%',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
    ],
  })

  isLanguageRegistered = true
}

function createCompletionItems(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): monaco.languages.CompletionList {
  const linePrefix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })

  const beginMatch = linePrefix.match(/\\begin\{([a-zA-Z]*)$/)
  if (beginMatch) {
    const envPrefix = beginMatch[1] || ''
    return {
      suggestions: LATEX_ENVIRONMENTS
        .filter((env) => env.startsWith(envPrefix))
        .map((env) => ({
          label: env,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: `${env}}\n\t$0\n\\end{${env}}`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - envPrefix.length,
            endColumn: position.column,
          },
          documentation: `Insert ${env} environment block`,
        })),
    }
  }

  const commandMatch = linePrefix.match(/\\([a-zA-Z]*)$/)
  if (commandMatch) {
    const commandPrefix = commandMatch[1] || ''
    return {
      suggestions: LATEX_COMMANDS
        .filter((cmd) => cmd.startsWith(commandPrefix))
        .map((cmd) => ({
          label: `\\${cmd}`,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `\\${cmd}`,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - commandPrefix.length - 1,
            endColumn: position.column,
          },
          documentation: `LaTeX command \\${cmd}`,
        })),
    }
  }

  return { suggestions: [] }
}

function enableBeginBraceAutoClose(editor: monaco.editor.IStandaloneCodeEditor) {
  return editor.onDidChangeModelContent((event) => {
    const change = event.changes[0]
    if (!change || change.text !== '{') {
      return
    }

    const position = editor.getPosition()
    const model = editor.getModel()
    if (!position || !model) {
      return
    }

    const linePrefix = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    })

    if (!linePrefix.endsWith('\\begin{')) {
      return
    }

    editor.executeEdits('latex-begin-autoclose', [
      {
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: '}',
        forceMoveMarkers: true,
      },
    ])

    editor.setPosition({
      lineNumber: position.lineNumber,
      column: position.column,
    })
  })
}

export function setupLatexEnhancements(editor: monaco.editor.IStandaloneCodeEditor) {
  ensureLatexLanguageRegistered()

  const model = editor.getModel()
  if (model) {
    monaco.editor.setModelLanguage(model, LATEX_LANGUAGE_ID)
  }

  const completionDisposable = monaco.languages.registerCompletionItemProvider(LATEX_LANGUAGE_ID, {
    triggerCharacters: ['\\', '{'],
    provideCompletionItems: (model, position) => createCompletionItems(model, position),
  })

  const autoCloseDisposable = enableBeginBraceAutoClose(editor)

  return () => {
    completionDisposable.dispose()
    autoCloseDisposable.dispose()
  }
}
