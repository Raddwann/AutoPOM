const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');
const isTest = process.argv.includes('--test');

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: './dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !isProduction,
  minify: isProduction,
};

/** @type {import('esbuild').BuildOptions} */
const testConfig = {
  entryPoints: ['./test/runTests.ts'],
  bundle: true,
  outfile: './dist/tests.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
};

async function main() {
  if (isTest) {
    await esbuild.build(testConfig);
    console.log('[esbuild] Tests built successfully.');
    return;
  }

  if (isWatch) {
    const ctx = await esbuild.context(extensionConfig);
    await ctx.watch();
    console.log('[esbuild] Watching for changes...');
  } else {
    await esbuild.build(extensionConfig);
    console.log('[esbuild] Build complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
