const fs = require('fs');

const findFiles = (dir) => {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      files = [...files, ...findFiles(`${dir}/${item.name}`)];
    } else if (item.name.endsWith('.tsx')) {
      files.push(`${dir}/${item.name}`);
    }
  }
  return files;
};

const allFiles = findFiles('src/components');
let found = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/role="switch" aria-checked=\{([^\}]+)\}\s+className=\{`([^`]+)`\}/g, (match, checked, className) => {
    if (!className.includes('focus-visible')) {
        return `role="switch" aria-checked={${checked}}\n                  className={\`${className} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900\`}`;
    }
    return match;
  });

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    found++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Updated ${found} files`);
