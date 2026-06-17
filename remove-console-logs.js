const fs = require('fs');
const path = require('path');

// Recursively find all JS files
function findJsFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git') && !item.includes('dist')) {
      files = files.concat(findJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  return files;
}

// Remove console.log lines
function removeConsoleLogs(content) {
  // Match entire lines with console.log/warn/error
  return content.replace(/^\s*console\.(log|warn|error)\([^;]*\);\s*\n/gm, '');
}

const srcDir = path.join(__dirname, 'src');
const jsFiles = findJsFiles(srcDir);

console.log(`Found ${jsFiles.length} JS files`);

jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  const cleaned = removeConsoleLogs(content);
  
  if (content !== cleaned) {
    fs.writeFileSync(file, cleaned, 'utf-8');
    const removedLines = content.split('\n').length - cleaned.split('\n').length;
    console.log(`✅ ${file}: removed ${removedLines} lines`);
  }
});

console.log('\n✅ Done! All console.log statements removed.');
