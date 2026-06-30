const fs = require('fs');

const findFiles = (dir) => {
  let files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      files = [...files, ...findFiles(`${dir}/${item.name}`)];
    } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
      files.push(`${dir}/${item.name}`);
    }
  }
  return files;
};

const allFiles = findFiles('src/components');
let found = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');

  // Replace non-accessible switches
  let newContent = content.replace(/className=(['`])(.*?w-12 h-6 rounded-full transition-all relative focus:outline-none.*?)\1/g, 'className=$1$2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900$1');

  newContent = newContent.replace(/className=(['`])(.*?w-14 h-8 rounded-full transition-all relative focus:outline-none.*?)\1/g, 'className=$1$2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900$1');

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    found++;
    console.log(`Updated ${file}`);
  }
}

console.log(`Updated ${found} files`);
