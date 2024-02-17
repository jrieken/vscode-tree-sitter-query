//@ts-check

'use strict';

const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");
const { DefinePlugin } = require('webpack');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const sharedConfig = {
  mode: 'none',
  entry: './src/extension.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  devtool: 'nosources-source-map',
};

/** @type WebpackConfig */
const nodeExtensionConfig = {
  ...sharedConfig,
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/.wasm/*.wasm", to({ context, absoluteFilename }) {
          return "[name][ext]";
        }, },
      ],
    }),
  ],
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

/** @type WebpackConfig */
const webExtensionConfig = {
  ...sharedConfig,
  target: 'webworker', // extensions run in a webworker context
  output: {
    filename: 'extension.js',
    path: path.join(__dirname, './dist/web'),
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]'
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
    extensions: ['.ts', '.js'], // support ts-files and js-files,
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      path: require.resolve('path-browserify'),
      fs: false,
    }
  },
  plugins: [],
  performance: {
    hints: false
  },
};


const rendererConfig = {
	...sharedConfig,
	entry: './src/renderer/tree-sitter-renderer.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'renderer.js',
		libraryTarget: 'module',
	},
	resolve: {
		extensions: ['.ts'],
	},
	experiments: {
		outputModule: true,
	},
	module: {
		rules: [
			{
				test: /\.ts?$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
						options: {
							configFile: path.resolve(__dirname, './src/renderer/tsconfig.json'),
							projectReferences: true,
							compilerOptions: {
								module: 'esnext',
							},
						},
					},
				],
			}
		],
	}
};

module.exports = [ nodeExtensionConfig, webExtensionConfig, rendererConfig ];
