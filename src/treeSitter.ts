import { Uri } from 'vscode';
import Parser from "web-tree-sitter";

export function getWasmLanguage(languageId: string) {
    switch (languageId) {
        case 'python':
            return WASMLanguage.Python;
        case 'javascript':
        case 'javascriptreact':
            return WASMLanguage.JavaScript; // @ulugbekna: AFAIU, tree-sitter parser for JS handles both JS and JSX
        case 'typescript':
            return WASMLanguage.TypeScript;
        case 'typescriptreact':
            return WASMLanguage.Tsx;
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
        case 'php':
            return WASMLanguage.PHP;
        default:
            throw new Error(`Unsupported language ${languageId}`);
    }
}

export enum WASMLanguage {
    Python = 'python',
    JavaScript = 'javascript',
    TypeScript = 'typescript',
    Tsx = 'tsx',
    Go = 'go',
    Ruby = 'ruby',
    Csharp = 'csharp',
    Cpp = 'cpp',
    Java = 'java',
    Rust = 'rust',
    PHP = 'php'
}

class LangLoader {
    private map = new Map<WASMLanguage, Parser.Language>();

    async loadLanguage(extensionUri: Uri, language: WASMLanguage): Promise<Parser.Language> {
        if (this.map.has(language)) {
            return Promise.resolve(this.map.get(language)!);
        }

        // construct a path that works both for the TypeScript source, which lives under `/src`, and for
        // the transpiled JavaScript, which lives under `/dist`
        const wasmFileLang = language === 'csharp' ? 'c-sharp' : language;

        const wasmFilename = `tree-sitter-${wasmFileLang}.wasm`;

        const wasmUri = Uri.joinPath(extensionUri, 'dist', wasmFilename);
        const wasmFile = wasmUri.scheme === 'file' ? wasmUri.fsPath : wasmUri.toString(true);

        const parserLang = await Parser.Language.load(wasmFile);

        this.map.set(language, parserLang);

        return parserLang;
    }

}

export const wasmLanguageLoader = new LangLoader();
