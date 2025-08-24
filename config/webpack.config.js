import path from 'path';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import nodeExternals from 'webpack-node-externals';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

export default {
  mode: isProduction ? 'production' : 'development',
  entry: {
    server: './src/server.ts',
  },
  target: 'node',
  externals: [
    // Exclude node_modules from bundle
    nodeExternals({
      allowlist: [
        // Include specific modules that need to be bundled
        '@xenova/transformers',
        '@tensorflow/tfjs-node',
      ],
    }),
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    libraryTarget: 'commonjs2',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@agents': path.resolve(__dirname, 'src/agents'),
      '@routers': path.resolve(__dirname, 'src/routers'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@workers': path.resolve(__dirname, 'src/workers'),
    },
    fallback: {
      // Node.js polyfills for browser compatibility
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      path: 'path-browserify',
      os: 'os-browserify/browser',
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json',
              transpileOnly: isDevelopment,
              compilerOptions: {
                sourceMap: isDevelopment,
                incremental: isDevelopment,
              },
            },
          },
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre',
      },
      {
        test: /\.json$/,
        type: 'json',
      },
      {
        test: /\.(wasm|onnx)$/,
        type: 'asset/resource',
        generator: {
          filename: 'models/[name][ext]',
        },
      },
    ],
  },
  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: isProduction,
            drop_debugger: isProduction,
            pure_funcs: isProduction ? ['console.log', 'console.debug'] : [],
          },
          mangle: {
            keep_fnames: /^(Agent|Service|Manager)/, // Keep important class names
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        tensorflow: {
          test: /[\\/]node_modules[\\/]@tensorflow[\\/]/,
          name: 'tensorflow',
          chunks: 'all',
          priority: 20,
        },
        transformers: {
          test: /[\\/]node_modules[\\/]@xenova[\\/]transformers[\\/]/,
          name: 'transformers',
          chunks: 'all',
          priority: 20,
        },
        utils: {
          test: /[\\/]src[\\/]utils[\\/]/,
          name: 'utils',
          chunks: 'all',
          priority: 5,
        },
      },
    },
    usedExports: true,
    sideEffects: false,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.WEBPACK_BUILD': JSON.stringify(true),
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
    new webpack.ContextReplacementPlugin(
      /express\/lib/,
      path.resolve(__dirname, 'src'),
    ),
    ...(process.env.ANALYZE ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: true,
        reportFilename: 'bundle-report.html',
      }),
    ] : []),
    new webpack.ProgressPlugin(),
  ],
  devtool: isDevelopment ? 'inline-source-map' : 'source-map',
  stats: {
    chunks: false,
    modules: false,
    assets: true,
    colors: true,
    errors: true,
    warnings: true,
    performance: true,
  },
  performance: {
    hints: isProduction ? 'warning' : false,
    maxEntrypointSize: 2000000, // 2MB
    maxAssetSize: 1000000, // 1MB
  },
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  watch: isDevelopment,
  watchOptions: {
    ignored: /node_modules/,
    aggregateTimeout: 300,
    poll: 1000,
  },
};