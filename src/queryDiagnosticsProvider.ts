import * as vscode from 'vscode';
import Parser from 'web-tree-sitter';
import { WASMLanguage, loadLanguage } from './treeSitter';
import { Lazy } from './utils';

export class QueryDiagnosticsProvider {

	private typescriptLanguage: Parser.Language | undefined;
	private treeSitterQueryTemplateStringQuery: Parser.Query | undefined;

	private queryDiagnosticsCollection: vscode.DiagnosticCollection;
	private disposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri
	) {

		this.queryDiagnosticsCollection = vscode.languages.createDiagnosticCollection("tree-sitter-query");

		this.disposables.push(

			vscode.window.onDidChangeActiveTextEditor(async (editor) => {
				if (!editor) {
					this.queryDiagnosticsCollection.clear();
					return;
				}

				await this.updateDiagnostics(editor.document);
			}),

			vscode.workspace.onDidChangeTextDocument(e => this.updateDiagnostics(e.document)),

			vscode.workspace.onDidCloseTextDocument(doc => {
				if (this.queryDiagnosticsCollection.has(doc.uri)) {
					this.queryDiagnosticsCollection.delete(doc.uri);
				};
			}),
		);
	}

	async init() {
		this.typescriptLanguage = await loadLanguage(this.extensionUri, WASMLanguage.TypeScript);
		this.treeSitterQueryTemplateStringQuery = this.typescriptLanguage.query(`
		(call_expression
			function: (member_expression
							object: (identifier) @identifier
							(#eq? @identifier "treeSitterQuery")
							property: (property_identifier) @target_language
							(#any-of? @target_language 
								${Object.values(WASMLanguage).map(lang => `"${lang}"`).join(' ')}
							)
						)
			arguments: (template_string) @query_src_with_quotes
		) @call_expression
		`);

		this.disposables.push(new vscode.Disposable(() => this.treeSitterQueryTemplateStringQuery?.delete()));

		if (vscode.window.activeTextEditor) {
			this.updateDiagnostics(vscode.window.activeTextEditor.document);
		}
	}

	async updateDiagnostics(document: vscode.TextDocument) {

		switch (document.languageId) {
			case 'typescript':
				return this.updateDiagnosticsInTypescriptSourceFile(document);
			case 'scm':
				return this.updateDiagnosticsInScmFile(document);
			default:
				return;
		}
	}

	private async updateDiagnosticsInTypescriptSourceFile(document: vscode.TextDocument) {

		const parser = new Parser();
		parser.setLanguage(this.typescriptLanguage!);
		try {
			const parseTree = parser.parse(document.getText());
			const matches = this.treeSitterQueryTemplateStringQuery!.matches(parseTree.rootNode);
			if (matches.length === 0) {
				return;
			}
			const treeSitterQueries = InSourceTreeSitterQuery.fromQueryMatches(matches);
			const errors = await Promise.all(treeSitterQueries.map(query => query.getError(this.extensionUri)));
			const diagnostics: vscode.Diagnostic[] = [];

			for (let i = 0; i < errors.length; i++) {
				const error = errors[i];

				if (/* is tree-sitter query parsing error */
					error && typeof error === 'object' &&
					'index' in error && typeof error.index === 'number' &&
					'message' in error && typeof error.message === 'string'
				) {
					const diagnosticStartPos = document.positionAt(treeSitterQueries[i].queryWithQuotes.startIndex + 1 + error.index);
					const diagnosticEndPos = document.lineAt(diagnosticStartPos.line).range.end;
					const diagnosticRange = new vscode.Range(diagnosticStartPos, diagnosticEndPos);
					const errorMessage = error.message.replace(/ at offset (\d+)/g, '').replace(/\.\.\.$/g, '');
					const diagnostic = new vscode.Diagnostic(diagnosticRange, errorMessage, vscode.DiagnosticSeverity.Error);
					diagnostics.push(diagnostic);
				}
			}

			this.queryDiagnosticsCollection.set(document.uri, diagnostics);
		} catch (e) {
			console.error(JSON.stringify(e, null, '\t'));
		} finally {
			parser.delete();
		}
	}

	private async updateDiagnosticsInScmFile(document: vscode.TextDocument) {

		const topMostLine = document.lineAt(0).text.trim();
		if (!topMostLine.startsWith(';;')) {
			return;
		}
		const targetLang = topMostLine.slice(2).trim().toLocaleLowerCase();
		if (!Object.values(WASMLanguage).includes(<WASMLanguage>targetLang)) {
			return;
		}

		const language = await loadLanguage(this.extensionUri, <WASMLanguage>targetLang);

		let error: Error | undefined;
		try {
			language.query(document.getText());
		} catch (e) {
			if (e instanceof Error) {
				error = e;
			} else {
				error = new Error(JSON.stringify(e, null, '\t'));
			}
		}

		const diagnostics: vscode.Diagnostic[] = [];

		if (/* is tree-sitter query parsing error */
			error && typeof error === 'object'
		) {
			let diagnosticStartPos: vscode.Position;
			let diagnosticEndPos: vscode.Position;
			if ('index' in error && typeof error.index === 'number') {
				diagnosticStartPos = document.positionAt(error.index);
				diagnosticEndPos = document.lineAt(diagnosticStartPos.line).range.end;
			} else {
				const offsetInErrorMessage = error.message.match(/ at offset (\d+)/)?.[1];
				if (offsetInErrorMessage) {
					diagnosticStartPos = document.positionAt(Number(offsetInErrorMessage));
					diagnosticEndPos = document.lineAt(diagnosticStartPos.line).range.end;
				} else { // whole document
					diagnosticStartPos = new vscode.Position(0, 0);
					diagnosticEndPos = document.lineAt(document.lineCount - 1 /* because 0-indexed */).range.end;
				}
			}
			const diagnosticRange = new vscode.Range(diagnosticStartPos, diagnosticEndPos);

			let errorMessage: string;
			if ('message' in error && typeof error.message === 'string') {
				errorMessage = error.message.replace(/ at offset (\d+)/g, '').replace(/\.\.\.$/g, '');
			} else {
				errorMessage = JSON.stringify(error, null, '\t');
			}

			const diagnostic = new vscode.Diagnostic(diagnosticRange, errorMessage, vscode.DiagnosticSeverity.Error);

			diagnostics.push(diagnostic);
		}

		this.queryDiagnosticsCollection.set(document.uri, diagnostics);

	}

	dispose() {
		this.disposables.forEach(d => d.dispose());
	}
}

class InSourceTreeSitterQuery {
	readonly _querySrc: Lazy<string>;

	constructor(
		readonly targetLanguage: Parser.SyntaxNode,
		readonly queryWithQuotes: Parser.SyntaxNode,
	) {
		this._querySrc = new Lazy(() => this.queryWithQuotes.text.slice(1, -1));
	}

	get querySrc() {
		return this._querySrc.value;
	}

	async getError(extensionUri: vscode.Uri) {
		if (!Object.values(WASMLanguage).includes(this.targetLanguage.text as WASMLanguage)) {
			return undefined;
		}

		try {
			const language = await loadLanguage(extensionUri, this.targetLanguage.text as WASMLanguage);
			language.query(this.querySrc);
			return undefined;
		} catch (e) {
			return e;
		}
	}

	static fromQueryMatches(matches: Parser.QueryMatch[]): InSourceTreeSitterQuery[] {
		const captures = matches.flatMap(({ captures }) => captures)
			.sort((a, b) => a.node.startIndex - b.node.startIndex || b.node.endIndex - a.node.endIndex);

		const treeSitterQueries: InSourceTreeSitterQuery[] = [];
		for (let i = 0; i < captures.length;) {
			const capture = captures[i];
			if (capture.name === 'call_expression' && captures[i + 2].name === 'target_language' && captures[i + 3].name === 'query_src_with_quotes') {
				treeSitterQueries.push(new InSourceTreeSitterQuery(captures[i + 2].node, captures[i + 3].node));
				i += 4;
			} else {
				i++;
			}
		}

		return treeSitterQueries;
	}
}
