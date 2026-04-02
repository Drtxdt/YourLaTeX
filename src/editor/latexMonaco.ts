import * as monaco from 'monaco-editor'

const LATEX_LANGUAGE_ID = 'latex-workshop-lite'

let isLanguageRegistered = false

interface LatexCompletionOptions {
  getCitationKeys?: () => string[]
  getLabelKeys?: () => string[]
  getTexTargets?: () => string[]
  getImageTargets?: () => string[]
  getBibTargets?: () => string[]
  getActivePackages?: () => string[]
  getPackageSymbols?: () => Record<string, { commands: string[]; environments: string[] }>
}

const LATEX_MARKER_OWNER = 'latex-workshop-lite-diagnostics'

interface LatexCommandSnippet {
  command: string
  snippet: string
  detail: string
}

const LATEX_COMMAND_SNIPPETS: LatexCommandSnippet[] = [
  { command: 'part', snippet: '\\part{$1}', detail: 'Part heading' },
  { command: 'chapter', snippet: '\\chapter{$1}', detail: 'Chapter heading' },
  { command: 'section', snippet: '\\section{$1}', detail: 'Section heading' },
  { command: 'subsection', snippet: '\\subsection{$1}', detail: 'Subsection heading' },
  { command: 'subsubsection', snippet: '\\subsubsection{$1}', detail: 'Subsubsection heading' },
  { command: 'paragraph', snippet: '\\paragraph{$1}', detail: 'Paragraph heading' },
  { command: 'subparagraph', snippet: '\\subparagraph{$1}', detail: 'Subparagraph heading' },
  { command: 'textbf', snippet: '\\textbf{$1}', detail: 'Bold text' },
  { command: 'textit', snippet: '\\textit{$1}', detail: 'Italic text' },
  { command: 'underline', snippet: '\\underline{$1}', detail: 'Underline text' },
  { command: 'texttt', snippet: '\\texttt{$1}', detail: 'Typewriter text' },
  { command: 'emph', snippet: '\\emph{$1}', detail: 'Emphasis text' },
  { command: 'url', snippet: '\\url{$1}', detail: 'Insert URL' },
  { command: 'href', snippet: '\\href{$1}{$2}', detail: 'Insert hyperlink' },
  { command: 'footnote', snippet: '\\footnote{$1}', detail: 'Insert footnote' },
  { command: 'tableofcontents', snippet: '\\tableofcontents', detail: 'Insert table of contents' },
  { command: 'listoffigures', snippet: '\\listoffigures', detail: 'Insert list of figures' },
  { command: 'listoftables', snippet: '\\listoftables', detail: 'Insert list of tables' },
  { command: 'input', snippet: '\\input{$1}', detail: 'Input TeX file' },
  { command: 'include', snippet: '\\include{$1}', detail: 'Include TeX file' },
  { command: 'begin', snippet: '\\begin{$1}\n\t$0\n\\end{$1}', detail: 'Environment block' },
  { command: 'end', snippet: '\\end{$1}', detail: 'Environment end' },
  { command: 'item', snippet: '\\item $0', detail: 'List item' },
  { command: 'description', snippet: '\\begin{description}\n\t\\item[$1] $0\n\\end{description}', detail: 'Description list' },
  { command: 'quote', snippet: '\\begin{quote}\n\t$0\n\\end{quote}', detail: 'Quote block' },
  { command: 'verbatim', snippet: '\\begin{verbatim}\n$0\n\\end{verbatim}', detail: 'Verbatim block' },
  { command: 'itemize', snippet: '\\begin{itemize}\n\t\\item $0\n\\end{itemize}', detail: 'Bulleted list' },
  { command: 'enumerate', snippet: '\\begin{enumerate}\n\t\\item $0\n\\end{enumerate}', detail: 'Numbered list' },
  { command: 'equation', snippet: '\\begin{equation}\n\t$0\n\\end{equation}', detail: 'Equation environment' },
  { command: 'align', snippet: '\\begin{align}\n\t$0\n\\end{align}', detail: 'Align environment' },
  { command: 'cases', snippet: '\\begin{cases}\n\t$0\n\\end{cases}', detail: 'Cases environment' },
  { command: 'figure', snippet: '\\begin{figure}[htbp]\n\t\\centering\n\t\\includegraphics[width=0.8\\textwidth]{$1}\n\t\\caption{$2}\n\t\\label{fig:$3}\n\\end{figure}', detail: 'Figure environment' },
  { command: 'table', snippet: '\\begin{table}[htbp]\n\t\\centering\n\t\\caption{$1}\n\t\\label{tab:$2}\n\t$0\n\\end{table}', detail: 'Table environment' },
  { command: 'tabular', snippet: '\\begin{tabular}{$1}\n\t$0\n\\end{tabular}', detail: 'Tabular environment' },
  { command: 'center', snippet: '\\begin{center}\n\t$0\n\\end{center}', detail: 'Center block' },
  { command: 'label', snippet: '\\label{$1}', detail: 'Insert label' },
  { command: 'ref', snippet: '\\ref{$1}', detail: 'Insert reference' },
  { command: 'eqref', snippet: '\\eqref{$1}', detail: 'Insert equation reference' },
  { command: 'pageref', snippet: '\\pageref{$1}', detail: 'Insert page reference' },
  { command: 'cite', snippet: '\\cite{$1}', detail: 'Insert citation' },
  { command: 'autocite', snippet: '\\autocite{$1}', detail: 'Insert autocite (biblatex)' },
  { command: 'parencite', snippet: '\\parencite{$1}', detail: 'Insert parencite (biblatex)' },
  { command: 'textcite', snippet: '\\textcite{$1}', detail: 'Insert textcite (biblatex)' },
  { command: 'includegraphics', snippet: '\\includegraphics[width=$1\\textwidth]{$2}', detail: 'Include image' },
  { command: 'caption', snippet: '\\caption{$1}', detail: 'Insert caption' },
  { command: 'usepackage', snippet: '\\usepackage{$1}', detail: 'Load package' },
  { command: 'RequirePackage', snippet: '\\RequirePackage{$1}', detail: 'Require package in style/class files' },
  { command: 'documentclass', snippet: '\\documentclass[12pt]{article}', detail: 'Set document class' },
  { command: 'newcommand', snippet: '\\newcommand{\\$1}[$2]{$0}', detail: 'Define new command' },
  { command: 'renewcommand', snippet: '\\renewcommand{\\$1}[$2]{$0}', detail: 'Redefine command' },
  { command: 'providecommand', snippet: '\\providecommand{\\$1}[$2]{$0}', detail: 'Provide command if undefined' },
  { command: 'newenvironment', snippet: '\\newenvironment{$1}{$2}{$3}', detail: 'Define new environment' },
  { command: 'bibliography', snippet: '\\bibliography{$1}', detail: 'Insert bibliography files' },
  { command: 'addbibresource', snippet: '\\addbibresource{$1.bib}', detail: 'Add biblatex resource' },
  { command: 'printbibliography', snippet: '\\printbibliography', detail: 'Print bibliography' },
  { command: 'maketitle', snippet: '\\maketitle', detail: 'Render title block' },
  { command: 'author', snippet: '\\author{$1}', detail: 'Author declaration' },
  { command: 'title', snippet: '\\title{$1}', detail: 'Title declaration' },
  { command: 'date', snippet: '\\date{$1}', detail: 'Date declaration' },
  { command: 'frac', snippet: '\\frac{$1}{$2}', detail: 'Fraction' },
  { command: 'sqrt', snippet: '\\sqrt{$1}', detail: 'Square root' },
  { command: 'sum', snippet: '\\sum_{$1}^{$2}', detail: 'Summation' },
  { command: 'prod', snippet: '\\prod_{$1}^{$2}', detail: 'Product' },
  { command: 'int', snippet: '\\int_{$1}^{$2}', detail: 'Integral' },
  { command: 'lim', snippet: '\\lim_{$1 \\to $2}', detail: 'Limit' },
  { command: 'cdot', snippet: '\\cdot', detail: 'Multiplication dot' },
  { command: 'times', snippet: '\\times', detail: 'Times sign' },
  { command: 'leq', snippet: '\\leq', detail: 'Less or equal' },
  { command: 'geq', snippet: '\\geq', detail: 'Greater or equal' },
  { command: 'neq', snippet: '\\neq', detail: 'Not equal' },
  { command: 'infty', snippet: '\\infty', detail: 'Infinity symbol' },
  { command: 'left', snippet: '\\left($1\\right)', detail: 'Auto-sized delimiters' },
  { command: 'mathbf', snippet: '\\mathbf{$1}', detail: 'Bold math symbol' },
  { command: 'mathbb', snippet: '\\mathbb{$1}', detail: 'Blackboard bold symbol' },
  { command: 'mathcal', snippet: '\\mathcal{$1}', detail: 'Calligraphic symbol' },
]

const PACKAGE_JS_RULES: Record<string, { commands: LatexCommandSnippet[]; environments: string[] }> = {
  amsmath: {
    commands: [
      { command: 'align', snippet: '\\begin{align}\n\t$0\n\\end{align}', detail: 'amsmath align environment' },
      { command: 'gather', snippet: '\\begin{gather}\n\t$0\n\\end{gather}', detail: 'amsmath gather environment' },
      { command: 'split', snippet: '\\begin{split}\n\t$0\n\\end{split}', detail: 'amsmath split environment' },
      { command: 'dfrac', snippet: '\\dfrac{$1}{$2}', detail: 'Display style fraction' },
      { command: 'text', snippet: '\\text{$1}', detail: 'Text inside math mode' },
    ],
    environments: ['align', 'align*', 'gather', 'gather*', 'multline', 'split', 'cases'],
  },
  amssymb: {
    commands: [
      { command: 'mathbb', snippet: '\\mathbb{$1}', detail: 'Blackboard bold' },
      { command: 'mathfrak', snippet: '\\mathfrak{$1}', detail: 'Fraktur symbol' },
    ],
    environments: [],
  },
  amsthm: {
    commands: [
      { command: 'newtheorem', snippet: '\\newtheorem{$1}{$2}', detail: 'Define theorem environment' },
      { command: 'theoremstyle', snippet: '\\theoremstyle{$1}', detail: 'Set theorem style' },
      { command: 'qedhere', snippet: '\\qedhere', detail: 'Place qed symbol here' },
    ],
    environments: ['theorem', 'lemma', 'proposition', 'corollary', 'definition', 'remark', 'proof'],
  },
  mathtools: {
    commands: [
      { command: 'coloneqq', snippet: '\\coloneqq', detail: 'Definition equals' },
      { command: 'DeclarePairedDelimiter', snippet: '\\DeclarePairedDelimiter{\\$1}{$2}{$3}', detail: 'Declare paired delimiter' },
      { command: 'prescript', snippet: '\\prescript{$1}{$2}{$3}', detail: 'Left superscript/subscript' },
    ],
    environments: ['multlined', 'dcases'],
  },
  graphicx: {
    commands: [
      { command: 'includegraphics', snippet: '\\includegraphics[width=$1\\textwidth]{$2}', detail: 'Insert graphic' },
      { command: 'graphicspath', snippet: '\\graphicspath{{$1/}}', detail: 'Set graphics search path' },
    ],
    environments: [],
  },
  biblatex: {
    commands: [
      { command: 'addbibresource', snippet: '\\addbibresource{$1.bib}', detail: 'Register bib resource' },
      { command: 'printbibliography', snippet: '\\printbibliography', detail: 'Print bibliography' },
      { command: 'autocite', snippet: '\\autocite{$1}', detail: 'Autocite command' },
      { command: 'parencite', snippet: '\\parencite{$1}', detail: 'Parenthetical cite' },
      { command: 'textcite', snippet: '\\textcite{$1}', detail: 'Textual cite' },
    ],
    environments: [],
  },
  xcolor: {
    commands: [
      { command: 'textcolor', snippet: '\\textcolor{$1}{$2}', detail: 'Set text color' },
      { command: 'color', snippet: '\\color{$1}', detail: 'Set current color' },
      { command: 'definecolor', snippet: '\\definecolor{$1}{$2}{$3}', detail: 'Define custom color' },
      { command: 'colorbox', snippet: '\\colorbox{$1}{$2}', detail: 'Color box' },
    ],
    environments: [],
  },
  hyperref: {
    commands: [
      { command: 'href', snippet: '\\href{$1}{$2}', detail: 'Hyperlink' },
      { command: 'url', snippet: '\\url{$1}', detail: 'URL' },
      { command: 'autoref', snippet: '\\autoref{$1}', detail: 'Automatic reference' },
      { command: 'hyperref', snippet: '\\hyperref[$1]{$2}', detail: 'Hyperref with label' },
    ],
    environments: [],
  },
  cleveref: {
    commands: [
      { command: 'cref', snippet: '\\cref{$1}', detail: 'Clever reference' },
      { command: 'Cref', snippet: '\\Cref{$1}', detail: 'Capitalized clever reference' },
      { command: 'cpageref', snippet: '\\cpageref{$1}', detail: 'Clever page reference' },
    ],
    environments: [],
  },
  natbib: {
    commands: [
      { command: 'citet', snippet: '\\citet{$1}', detail: 'Text citation' },
      { command: 'citep', snippet: '\\citep{$1}', detail: 'Parenthetical citation' },
      { command: 'citeauthor', snippet: '\\citeauthor{$1}', detail: 'Citation author' },
      { command: 'citeyear', snippet: '\\citeyear{$1}', detail: 'Citation year' },
    ],
    environments: [],
  },
  booktabs: {
    commands: [
      { command: 'toprule', snippet: '\\toprule', detail: 'Top table rule' },
      { command: 'midrule', snippet: '\\midrule', detail: 'Middle table rule' },
      { command: 'bottomrule', snippet: '\\bottomrule', detail: 'Bottom table rule' },
      { command: 'cmidrule', snippet: '\\cmidrule{$1-$2}', detail: 'Partial table rule' },
    ],
    environments: [],
  },
  siunitx: {
    commands: [
      { command: 'SI', snippet: '\\SI{$1}{$2}', detail: 'Number with unit' },
      { command: 'si', snippet: '\\si{$1}', detail: 'Unit only' },
      { command: 'num', snippet: '\\num{$1}', detail: 'Formatted number' },
      { command: 'qty', snippet: '\\qty{$1}{$2}', detail: 'Quantity' },
    ],
    environments: [],
  },
  enumitem: {
    commands: [
      { command: 'setlist', snippet: '\\setlist[$1]{$2}', detail: 'Configure list style' },
      { command: 'setitemize', snippet: '\\setitemize{$1}', detail: 'Configure itemize' },
      { command: 'setenumerate', snippet: '\\setenumerate{$1}', detail: 'Configure enumerate' },
    ],
    environments: [],
  },
  caption: {
    commands: [
      { command: 'captionsetup', snippet: '\\captionsetup{$1}', detail: 'Configure captions' },
      { command: 'captionof', snippet: '\\captionof{$1}{$2}', detail: 'Caption outside float' },
    ],
    environments: [],
  },
  subcaption: {
    commands: [
      { command: 'subcaption', snippet: '\\subcaption{$1}', detail: 'Sub-caption text' },
      { command: 'subref', snippet: '\\subref{$1}', detail: 'Reference subfigure/subtable' },
    ],
    environments: ['subfigure', 'subtable'],
  },
  listings: {
    commands: [
      { command: 'lstset', snippet: '\\lstset{$1}', detail: 'Configure listings' },
      { command: 'lstinline', snippet: '\\lstinline|$1|', detail: 'Inline code listing' },
      { command: 'lstinputlisting', snippet: '\\lstinputlisting[$1]{$2}', detail: 'Import source file' },
    ],
    environments: ['lstlisting'],
  },
  minted: {
    commands: [
      { command: 'mint', snippet: '\\mint{$1}{$2}', detail: 'Inline minted code' },
      { command: 'inputminted', snippet: '\\inputminted[$1]{$2}{$3}', detail: 'Input minted file' },
      { command: 'setminted', snippet: '\\setminted{$1}', detail: 'Configure minted defaults' },
    ],
    environments: ['minted'],
  },
  tikz: {
    commands: [
      { command: 'tikzset', snippet: '\\tikzset{$1}', detail: 'Configure tikz styles' },
      { command: 'draw', snippet: '\\draw $0;', detail: 'TikZ draw command' },
      { command: 'node', snippet: '\\node ($1) at ($2) {$3};', detail: 'TikZ node command' },
      { command: 'path', snippet: '\\path $0;', detail: 'TikZ path command' },
    ],
    environments: ['tikzpicture', 'scope'],
  },
  pgfplots: {
    commands: [
      { command: 'addplot', snippet: '\\addplot {$1};', detail: 'Add plot curve' },
      { command: 'addlegendentry', snippet: '\\addlegendentry{$1}', detail: 'Add legend entry' },
      { command: 'pgfplotsset', snippet: '\\pgfplotsset{$1}', detail: 'Configure pgfplots' },
    ],
    environments: ['axis', 'semilogxaxis', 'semilogyaxis', 'loglogaxis'],
  },
}

const MATH_MODE_COMMANDS: LatexCommandSnippet[] = [
  { command: 'alpha', snippet: '\\alpha', detail: 'Greek alpha' },
  { command: 'beta', snippet: '\\beta', detail: 'Greek beta' },
  { command: 'gamma', snippet: '\\gamma', detail: 'Greek gamma' },
  { command: 'theta', snippet: '\\theta', detail: 'Greek theta' },
  { command: 'lambda', snippet: '\\lambda', detail: 'Greek lambda' },
  { command: 'mu', snippet: '\\mu', detail: 'Greek mu' },
  { command: 'pi', snippet: '\\pi', detail: 'Greek pi' },
  { command: 'sigma', snippet: '\\sigma', detail: 'Greek sigma' },
  { command: 'sum', snippet: '\\sum_{$1}^{$2}', detail: 'Summation' },
  { command: 'prod', snippet: '\\prod_{$1}^{$2}', detail: 'Product' },
  { command: 'int', snippet: '\\int_{$1}^{$2}', detail: 'Integral' },
  { command: 'lim', snippet: '\\lim_{$1 \\to $2}', detail: 'Limit' },
  { command: 'frac', snippet: '\\frac{$1}{$2}', detail: 'Fraction' },
  { command: 'sqrt', snippet: '\\sqrt{$1}', detail: 'Square root' },
  { command: 'cdot', snippet: '\\cdot', detail: 'Multiplication dot' },
  { command: 'times', snippet: '\\times', detail: 'Times sign' },
  { command: 'leq', snippet: '\\leq', detail: 'Less or equal' },
  { command: 'geq', snippet: '\\geq', detail: 'Greater or equal' },
  { command: 'neq', snippet: '\\neq', detail: 'Not equal' },
  { command: 'infty', snippet: '\\infty', detail: 'Infinity' },
  { command: 'left', snippet: '\\left($1\\right)', detail: 'Auto-sized delimiters' },
  { command: 'mathbf', snippet: '\\mathbf{$1}', detail: 'Bold math symbol' },
  { command: 'mathbb', snippet: '\\mathbb{$1}', detail: 'Blackboard bold symbol' },
]

const LATEX_PACKAGES = [
  'amsmath',
  'amssymb',
  'amsthm',
  'mathtools',
  'graphicx',
  'xcolor',
  'hyperref',
  'cleveref',
  'biblatex',
  'natbib',
  'booktabs',
  'siunitx',
  'geometry',
  'fancyhdr',
  'titlesec',
  'caption',
  'subcaption',
  'float',
  'enumitem',
  'csquotes',
  'fontspec',
  'xeCJK',
  'listings',
  'minted',
  'tikz',
  'pgfplots',
  'algorithm',
  'algorithmicx',
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
  options?: LatexCompletionOptions,
): monaco.languages.CompletionList {
  const contentBeforeCursor = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })

  const linePrefix = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  })

  const includeMatch = linePrefix.match(/\\(?:input|include)\{([^}]*)$/)
  if (includeMatch) {
    const filePrefix = includeMatch[1] || ''
    const texTargets = [...(options?.getTexTargets?.() ?? [])]
      .sort((a, b) => sortByPrefixThenAlpha(a, b, filePrefix))

    return {
      suggestions: texTargets
        .filter((target) => target.startsWith(filePrefix))
        .map((target, index) => ({
          label: target,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: target,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - filePrefix.length,
            endColumn: position.column,
          },
          detail: 'TeX file path',
          sortText: String(index).padStart(4, '0'),
        })),
    }
  }

  const graphicsMatch = linePrefix.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)$/)
  if (graphicsMatch) {
    const filePrefix = graphicsMatch[1] || ''
    const imageTargets = [...(options?.getImageTargets?.() ?? [])]
      .sort((a, b) => sortByPrefixThenAlpha(a, b, filePrefix))

    return {
      suggestions: imageTargets
        .filter((target) => target.startsWith(filePrefix))
        .map((target, index) => ({
          label: target,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: target,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - filePrefix.length,
            endColumn: position.column,
          },
          detail: 'Image file path',
          sortText: String(index).padStart(4, '0'),
        })),
    }
  }

  const bibPathMatch = linePrefix.match(/\\(bibliography|addbibresource)\{([^}]*)$/)
  if (bibPathMatch) {
    const filePrefix = bibPathMatch[2] || ''
    const bibTargets = [...(options?.getBibTargets?.() ?? [])]
      .sort((a, b) => sortByPrefixThenAlpha(a, b, filePrefix))

    return {
      suggestions: bibTargets
        .filter((target) => target.startsWith(filePrefix))
        .map((target, index) => ({
          label: target,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: target,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - filePrefix.length,
            endColumn: position.column,
          },
          detail: 'Bib file path',
          sortText: String(index).padStart(4, '0'),
        })),
    }
  }

  const packageMatch = linePrefix.match(/\\usepackage(?:\[[^\]]*\])?\{([^}]*)$/)
  if (packageMatch) {
    const packagePrefix = packageMatch[1] || ''
    const matchedPackages = LATEX_PACKAGES
      .filter((pkg) => pkg.startsWith(packagePrefix))
      .sort((a, b) => sortByPrefixThenAlpha(a, b, packagePrefix))

    return {
      suggestions: matchedPackages.map((pkg, index) => ({
        label: pkg,
        kind: monaco.languages.CompletionItemKind.Module,
        insertText: pkg,
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - packagePrefix.length,
          endColumn: position.column,
        },
        detail: 'LaTeX package',
        sortText: String(index).padStart(3, '0'),
      })),
    }
  }

  const citeMatch = linePrefix.match(/\\(?:cite|autocite|parencite|textcite)\{([^}]*)$/)
  if (citeMatch) {
    const keyPrefix = citeMatch[1] || ''
    const citationKeys = [...(options?.getCitationKeys?.() ?? [])].sort((a, b) => sortByPrefixThenAlpha(a, b, keyPrefix))
    return {
      suggestions: citationKeys
        .filter((key) => key.startsWith(keyPrefix))
        .map((key, index) => ({
          label: key,
          kind: monaco.languages.CompletionItemKind.Reference,
          insertText: key,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - keyPrefix.length,
            endColumn: position.column,
          },
          detail: 'BibTeX key',
          sortText: String(index).padStart(4, '0'),
        })),
    }
  }

  const refMatch = linePrefix.match(/\\(?:ref|eqref|pageref)\{([^}]*)$/)
  if (refMatch) {
    const keyPrefix = refMatch[1] || ''
    const labelKeys = [...(options?.getLabelKeys?.() ?? [])].sort((a, b) => sortByPrefixThenAlpha(a, b, keyPrefix))
    return {
      suggestions: labelKeys
        .filter((key) => key.startsWith(keyPrefix))
        .map((key, index) => ({
          label: key,
          kind: monaco.languages.CompletionItemKind.Reference,
          insertText: key,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - keyPrefix.length,
            endColumn: position.column,
          },
          detail: 'Label key',
          sortText: String(index).padStart(4, '0'),
        })),
    }
  }

  const beginMatch = linePrefix.match(/\\begin\{([a-zA-Z]*)$/)
  if (beginMatch) {
    const envPrefix = beginMatch[1] || ''
    const dynamicPackageEnvs = getDynamicPackageEnvironments(options)
    const matchedEnvironments = Array.from(new Set([...LATEX_ENVIRONMENTS, ...dynamicPackageEnvs]))
      .filter((env) => env.startsWith(envPrefix))
      .sort((a, b) => sortByPrefixThenAlpha(a, b, envPrefix))

    return {
      suggestions: matchedEnvironments
        .map((env, index) => ({
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
          detail: 'Environment',
          sortText: String(index).padStart(4, '0'),
        })),
    }
  }

  const commandMatch = linePrefix.match(/\\([a-zA-Z]*)$/)
  if (commandMatch) {
    const commandPrefix = commandMatch[1] || ''
    const inMathContext = isMathContext(contentBeforeCursor)
    const dynamicPackageCommands = getDynamicPackageCommands(options)
    const mathCommands = inMathContext ? MATH_MODE_COMMANDS : []
    const allCommandSnippets = mergeCommandSnippets([
      ...LATEX_COMMAND_SNIPPETS,
      ...dynamicPackageCommands,
      ...mathCommands,
    ])

    const matchedCommands = allCommandSnippets
      .map((item) => item.command)
      .filter((cmd) => cmd.startsWith(commandPrefix))
      .sort((a, b) => sortByPrefixThenAlpha(a, b, commandPrefix))

    return {
      suggestions: matchedCommands
        .map((cmd, index) => {
          const snippet = allCommandSnippets.find((item) => item.command === cmd)
          return {
            label: `\\${cmd}`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet?.snippet ?? `\\${cmd}`,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - commandPrefix.length - 1,
              endColumn: position.column,
            },
            documentation: `LaTeX command \\${cmd}`,
            detail: snippet?.detail ?? 'LaTeX command',
            sortText: String(index).padStart(4, '0'),
          }
        }),
    }
  }

  return { suggestions: [] }
}

function mergeCommandSnippets(items: LatexCommandSnippet[]) {
  const map = new Map<string, LatexCommandSnippet>()
  for (const item of items) {
    if (!map.has(item.command)) {
      map.set(item.command, item)
    }
  }
  return Array.from(map.values())
}

function getDynamicPackageCommands(options?: LatexCompletionOptions): LatexCommandSnippet[] {
  const activePackages = (options?.getActivePackages?.() ?? []).map((pkg) => pkg.toLowerCase().trim())
  const packageSymbols = options?.getPackageSymbols?.() ?? {}

  const fromJsRules = activePackages.flatMap((pkg) => PACKAGE_JS_RULES[pkg]?.commands ?? [])
  const fromParsedSymbols = activePackages.flatMap((pkg) =>
    (packageSymbols[pkg]?.commands ?? []).map((command) => ({
      command: command.replace(/^\\/, ''),
      snippet: command,
      detail: `${pkg} package command`,
    }))
  )

  return mergeCommandSnippets([...fromJsRules, ...fromParsedSymbols])
}

function getDynamicPackageEnvironments(options?: LatexCompletionOptions) {
  const activePackages = (options?.getActivePackages?.() ?? []).map((pkg) => pkg.toLowerCase().trim())
  const packageSymbols = options?.getPackageSymbols?.() ?? {}

  const jsEnvs = activePackages.flatMap((pkg) => PACKAGE_JS_RULES[pkg]?.environments ?? [])
  const parsedEnvs = activePackages.flatMap((pkg) => packageSymbols[pkg]?.environments ?? [])

  return Array.from(new Set([...jsEnvs, ...parsedEnvs]))
}

function isMathContext(contentBeforeCursor: string) {
  const inlineMathCount = (contentBeforeCursor.match(/(?<!\\)\$/g) ?? []).length
  if (inlineMathCount % 2 === 1) {
    return true
  }

  const mathEnvironments = ['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'cases']
  for (const env of mathEnvironments) {
    const beginCount = (contentBeforeCursor.match(new RegExp(`\\\\begin\\{${env.replace('*', '\\*')}\\}`, 'g')) ?? []).length
    const endCount = (contentBeforeCursor.match(new RegExp(`\\\\end\\{${env.replace('*', '\\*')}\\}`, 'g')) ?? []).length
    if (beginCount > endCount) {
      return true
    }
  }

  return false
}

function sortByPrefixThenAlpha(a: string, b: string, prefix: string) {
  const aExact = a === prefix
  const bExact = b === prefix
  if (aExact !== bExact) {
    return aExact ? -1 : 1
  }

  const aStarts = a.startsWith(prefix)
  const bStarts = b.startsWith(prefix)
  if (aStarts !== bStarts) {
    return aStarts ? -1 : 1
  }

  return a.localeCompare(b)
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

function registerLatexDiagnostics(editor: monaco.editor.IStandaloneCodeEditor, options?: LatexCompletionOptions) {
  let timer: ReturnType<typeof setTimeout> | null = null

  const runDiagnostics = () => {
    const model = editor.getModel()
    if (!model) {
      return
    }

    const markers: monaco.editor.IMarkerData[] = []
    const content = model.getValue()

    const knownCitations = new Set(options?.getCitationKeys?.() ?? [])
    const knownLabels = new Set(options?.getLabelKeys?.() ?? [])

    const environmentRegex = /\\(begin|end)\{([a-zA-Z*]+)\}/g
    const envStack: Array<{ name: string; index: number }> = []
    let envMatch: RegExpExecArray | null
    while ((envMatch = environmentRegex.exec(content)) !== null) {
      const kind = envMatch[1]
      const envName = envMatch[2]
      const tokenIndex = envMatch.index

      if (kind === 'begin') {
        envStack.push({ name: envName, index: tokenIndex })
        continue
      }

      const top = envStack[envStack.length - 1]
      if (!top || top.name !== envName) {
        const pos = model.getPositionAt(tokenIndex)
        markers.push({
          message: `Environment mismatch: expected \\end{${top?.name ?? '?'}} but got \\end{${envName}}`,
          severity: monaco.MarkerSeverity.Warning,
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: pos.lineNumber,
          endColumn: pos.column + envMatch[0].length,
        })
      } else {
        envStack.pop()
      }
    }

    for (const remaining of envStack) {
      const pos = model.getPositionAt(remaining.index)
      markers.push({
        message: `Environment not closed: \\begin{${remaining.name}}`,
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column + remaining.name.length + 8,
      })
    }

    const citeRegex = /\\(?:cite|autocite|parencite|textcite)\{([^}]+)\}/g
    let citeMatch: RegExpExecArray | null
    while ((citeMatch = citeRegex.exec(content)) !== null) {
      const keys = citeMatch[1].split(',').map((part) => part.trim()).filter(Boolean)
      const unknown = keys.find((key) => !knownCitations.has(key))
      if (!unknown) continue

      const full = citeMatch[0]
      const startOffset = full.indexOf('{') + 1 + Math.max(0, citeMatch[1].indexOf(unknown))
      const pos = model.getPositionAt(citeMatch.index + startOffset)
      markers.push({
        message: `Unknown citation key: ${unknown}`,
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column + unknown.length,
      })
    }

    const refRegex = /\\(?:ref|eqref|pageref)\{([^}]+)\}/g
    let refMatch: RegExpExecArray | null
    while ((refMatch = refRegex.exec(content)) !== null) {
      const key = refMatch[1].trim()
      if (!key || knownLabels.has(key)) {
        continue
      }

      const full = refMatch[0]
      const startOffset = full.indexOf('{') + 1
      const pos = model.getPositionAt(refMatch.index + startOffset)
      markers.push({
        message: `Unknown label key: ${key}`,
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: pos.lineNumber,
        startColumn: pos.column,
        endLineNumber: pos.lineNumber,
        endColumn: pos.column + key.length,
      })
    }

    monaco.editor.setModelMarkers(model, LATEX_MARKER_OWNER, markers)
  }

  const scheduleDiagnostics = () => {
    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(runDiagnostics, 180)
  }

  const changeDisposable = editor.onDidChangeModelContent(() => {
    scheduleDiagnostics()
  })

  runDiagnostics()

  return {
    dispose: () => {
      if (timer) {
        clearTimeout(timer)
      }
      const model = editor.getModel()
      if (model) {
        monaco.editor.setModelMarkers(model, LATEX_MARKER_OWNER, [])
      }
      changeDisposable.dispose()
    },
    refresh: runDiagnostics,
  }
}

export function setupLatexEnhancements(editor: monaco.editor.IStandaloneCodeEditor, options?: LatexCompletionOptions) {
  ensureLatexLanguageRegistered()

  const model = editor.getModel()
  if (model) {
    monaco.editor.setModelLanguage(model, LATEX_LANGUAGE_ID)
  }

  const completionDisposable = monaco.languages.registerCompletionItemProvider(LATEX_LANGUAGE_ID, {
    triggerCharacters: ['\\', '{'],
    provideCompletionItems: (model, position) => createCompletionItems(model, position, options),
  })

  const autoCloseDisposable = enableBeginBraceAutoClose(editor)
  const diagnosticsController = registerLatexDiagnostics(editor, options)

  return {
    dispose: () => {
      completionDisposable.dispose()
      autoCloseDisposable.dispose()
      diagnosticsController.dispose()
    },
    refreshDiagnostics: diagnosticsController.refresh,
  }
}
