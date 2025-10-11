import path from 'path';
import webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import nodeExternals from 'webpack-node-externals';
import { fileURLToPath } from 'url';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  entry: {
    server: './src/server.ts',
  },
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: [
    nodeExternals({
      // Include modules that need special handling or are problematic
      allowlist: [
        /^@xenova\/transformers/,
        /^@tensorflow\/tfjs-node/,
      ],
    }),
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
    libraryTarget: 'commonjs2',
    // Ensure proper module exports
    chunkFilename: '[name].[contenthash].js',
    assetModuleFilename: 'assets/[hash][ext][query]',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@agents': path.resolve(__dirname, 'src/agents'),
      '@routers': path.resolve(__dirname, 'src/routers'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@workers': path.resolve(__dirname, 'src/workers'),
      '@memory': path.resolve(__dirname, 'src/memory'),
      '@middleware': path.resolve(__dirname, 'src/middleware'),
      '@enhanced': path.resolve(__dirname, 'src/enhanced'),
    },
    // Prevent bundling of native modules
    fallback: {
      fs: false,
      net: false,
      tls: false,
      child_process: false,
      worker_threads: false,
      perf_hooks: false,
      crypto: false,
      stream: false,
      path: false,
      os: false,
      util: false,
      buffer: false,
      events: false,
      string_decoder: false,
      url: false,
      querystring: false,
      zlib: false,
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
              transpileOnly: false, // Enable type checking in production
              happyPackMode: false,
              compilerOptions: {
                sourceMap: false,
                removeComments: true,
              },
            },
          },
        ],
        exclude: /node_modules/,
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
      {
        test: /\.node$/,
        use: 'node-loader',
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 2020,
          },
          compress: {
            ecma: 2020,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug', 'console.info'],
            passes: 2,
            toplevel: true,
            dead_code: true,
            unused: true,
          },
          mangle: {
            safari10: true,
            toplevel: true,
            keep_classnames: true,
            keep_fnames: false,
            reserved: ['Agent', 'Service', 'Manager', 'System', 'Handler'],
          },
          format: {
            comments: false,
            ecma: 2020,
          },
          module: true,
          toplevel: true,
        },
        extractComments: false,
        parallel: true,
      }),
    ],
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    runtimeChunk: false,
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            // Get the name. E.g. node_modules/packageName/not/this/part.js
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            // npm package names are URL-safe, but some servers don't like @ symbols
            return `vendor.${packageName.replace('@', '')}`;
          },
          priority: 10,
          reuseExistingChunk: true,
        },
        supabase: {
          test: /[\\/]node_modules[\\/]@supabase[\\/]/,
          name: 'vendor.supabase',
          priority: 20,
          reuseExistingChunk: true,
        },
        tensorflow: {
          test: /[\\/]node_modules[\\/]@tensorflow[\\/]/,
          name: 'vendor.tensorflow',
          priority: 20,
          reuseExistingChunk: true,
        },
        transformers: {
          test: /[\\/]node_modules[\\/]@xenova[\\/]transformers[\\/]/,
          name: 'vendor.transformers',
          priority: 20,
          reuseExistingChunk: true,
        },
        common: {
          minChunks: 2,
          priority: -10,
          reuseExistingChunk: true,
          name: 'common',
        },
        agents: {
          test: /[\\/]src[\\/]agents[\\/]/,
          name: 'agents',
          priority: 15,
          reuseExistingChunk: true,
        },
        memory: {
          test: /[\\/]src[\\/]memory[\\/]/,
          name: 'memory',
          priority: 15,
          reuseExistingChunk: true,
        },
        services: {
          test: /[\\/]src[\\/]services[\\/]/,
          name: 'services',
          priority: 15,
          reuseExistingChunk: true,
        },
        utils: {
          test: /[\\/]src[\\/]utils[\\/]/,
          name: 'utils',
          priority: 15,
          reuseExistingChunk: true,
        },
      },
    },
    usedExports: true,
    sideEffects: false,
    concatenateModules: true,
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['**/*', '!.gitkeep'],
    }),
    
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.WEBPACK_BUILD': JSON.stringify(true),
      '__DEV__': false,
    }),
    
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
    
    new webpack.ContextReplacementPlugin(
      /express[\\/]lib/,
      path.resolve(__dirname, 'src'),
    ),
    
    // Copy necessary files to dist
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/schema',
          to: 'schema',
          globOptions: {
            ignore: ['**/*.test.*', '**/*.spec.*'],
          },
        },
        {
          from: 'package.json',
          to: 'package.json',
          transform(content) {
            const packageJson = JSON.parse(content.toString());
            // Remove devDependencies and scripts for production
            delete packageJson.devDependencies;
            delete packageJson.scripts;
            packageJson.scripts = {
              start: 'node server.js',
              'start:prod': 'NODE_ENV=production node server.js',
            };
            return JSON.stringify(packageJson, null, 2);
          },
        },
        {
          from: '.env.example',
          to: '.env.example',
          noErrorOnMissing: true,
        },
      ],
    }),
    
    new webpack.ProgressPlugin({
      activeModules: false,
      entries: true,
      modules: true,
      modulesCount: 5000,
      profile: false,
      dependencies: true,
      dependenciesCount: 10000,
      percentBy: null,
    }),
    
    ...(process.env.ANALYZE ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: 'bundle-analysis.html',
        generateStatsFile: true,
        statsFilename: 'bundle-stats.json',
      }),
    ] : []),
    
    // Generate a manifest of all output files
    new WebpackManifestPlugin({
      fileName: 'manifest.json',
      publicPath: '',
      generate: (seed, files, entries) => {
        const manifestFiles = files.reduce((manifest, file) => {
          manifest[file.name] = file.path;
          return manifest;
        }, seed);
        
        const entrypoints = {};
        Object.keys(entries).forEach((key) => {
          entrypoints[key] = entries[key];
        });
        
        return {
          files: manifestFiles,
          entrypoints,
          buildTime: new Date().toISOString(),
          version: process.env.npm_package_version,
        };
      },
    }),
  ],
  devtool: 'hidden-source-map', // Generate source maps but don't include reference in files
  stats: {
    all: false,
    errors: true,
    warnings: true,
    colors: true,
    assets: true,
    assetsSort: 'size',
    entrypoints: true,
    chunks: true,
    chunkGroups: true,
    chunkModules: false,
    chunkOrigins: true,
    depth: false,
    env: true,
    orphanModules: false,
    modules: false,
    reasons: false,
    source: false,
    timings: true,
    version: true,
    hash: true,
  },
  performance: {
    hints: 'warning',
    maxEntrypointSize: 5000000, // 5MB
    maxAssetSize: 2000000, // 2MB
  },
  bail: true, // Stop on first error
  cache: false, // Disable cache for production builds
};