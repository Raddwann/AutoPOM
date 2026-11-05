const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');
const isTest = process.argv.includes('--test');

function copyWebviewAssets() {
  const srcDir = path.join(__dirname, 'src', 'views', 'webview');
  const destDir = path.join(__dirname, 'dist', 'webview');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = ['index.html', 'style.css', 'main.js'];
  for (const f of files) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
  console.log('[esbuild] Webview assets copied to dist/webview');
}

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
  copyWebviewAssets();

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
