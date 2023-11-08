import * as path from 'path';
import { ITreeSitterGrammar, ensureWasm } from './compileWasm';

async function compileWasm(outputPath: string) {
    const treeSitterGrammars: ITreeSitterGrammar[] = [
        {
            name: 'tree-sitter-c-sharp',
            filename: 'tree-sitter-c_sharp.wasm' // non-standard filename
        },
        {
            name: 'tree-sitter-cpp',
        },
        {
            name: 'tree-sitter-go',
        },
        {
            name: 'tree-sitter-javascript',
        },
        {
            name: 'tree-sitter-python',
        },
        {
            name: 'tree-sitter-ruby',
        },
        {
            name: 'tree-sitter-typescript',
            projectPath: 'tree-sitter-typescript/typescript', // non-standard path
        },
        {
            name: 'tree-sitter-tsx',
            projectPath: 'tree-sitter-typescript/tsx', // non-standard path
        },
        {
            name: 'tree-sitter-java',
        },
        {
            name: 'tree-sitter-rust',
        },
    ];

    for (const grammar of treeSitterGrammars) {
        await ensureWasm(grammar, outputPath);
    }
}

compileWasm(process.argv[2] ?? path.join(__dirname, '.wasm'));
