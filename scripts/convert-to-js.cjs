const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = process.cwd();
const skipDirs = new Set(['node_modules', 'dist', '.git']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

const allFiles = walk(root);
const tsFiles = allFiles.filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'));
const dtsFiles = allFiles.filter((f) => f.endsWith('.d.ts'));

for (const file of tsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      verbatimModuleSyntax: true,
      useDefineForClassFields: true,
    },
    fileName: file,
  }).outputText;

  const newFile = file.replace(/\.tsx$/, '.jsx').replace(/\.ts$/, '.js');
  fs.writeFileSync(newFile, out, 'utf8');
  fs.unlinkSync(file);
}

for (const file of dtsFiles) {
  fs.unlinkSync(file);
}

for (const name of ['tsconfig.json', 'tsconfig.node.json', 'tsconfig.app.json']) {
  const file = path.join(root, name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log(`Converted ${tsFiles.length} files and removed ${dtsFiles.length} declaration files.`);
