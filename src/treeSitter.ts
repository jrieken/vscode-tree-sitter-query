import { Uri } from 'vscode';
import Parser from "web-tree-sitter";

export function getWasmLanguage(languageId: string) {
    switch (languageId) {
        case 'python':
            return WASMLanguage.Python;
        case 'javascript':
            return WASMLanguage.JavaScript;
        case 'typescript':
            return WASMLanguage.TypeScript;
        case 'go':
            return WASMLanguage.Go;
        case 'ruby':
            return WASMLanguage.Ruby;
        case 'csharp':
            return WASMLanguage.Csharp;
        case 'cpp':
            return WASMLanguage.Cpp;
        case 'java':
            return WASMLanguage.Java;
        case 'rust':
            return WASMLanguage.Rust;
        default:
            throw new Error(`Unsupported language ${languageId}`);
    }
}

export enum WASMLanguage {
	Python = 'python',
	JavaScript = 'javascript',
	TypeScript = 'typescript',
	Go = 'go',
	Ruby = 'ruby',
	Csharp = 'csharp',
	Cpp = 'cpp',
	Java = 'java',
    Rust = 'rust'
}

export function loadLanguage(extensionUri: Uri, language: WASMLanguage): Promise<Parser.Language> {
    // construct a path that works both for the TypeScript source, which lives under `/src`, and for
    // the transpiled JavaScript, which lives under `/dist`
    const wasmFileLang = language === 'csharp' ? 'c-sharp' : language;

    const wasmFilename = `tree-sitter-${wasmFileLang}.wasm`;

    const wasmUri = Uri.joinPath(extensionUri, 'dist', wasmFilename);
    const wasmFile = wasmUri.scheme === 'file' ? wasmUri.fsPath : wasmUri.toString(true);

    return Parser.Language.load(wasmFile);
}
