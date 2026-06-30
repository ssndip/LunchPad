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
  let lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<button') && !lines[i].includes('aria-label') && !lines[i].includes('>{') && !lines[i].includes('>t(')) {
      // Very basic heuristic
      let nextLine = lines[i+1] || '';
      if (nextLine.includes('<') && nextLine.includes('className') && nextLine.includes('w-') && !nextLine.includes('</button>')) {
        let textMatch = /^[ \t]*<[^>]+>[ \t]*$/.test(nextLine);
        if (textMatch) {
            console.log(`${file}:${i+1} : ${lines[i].trim()} \n ${nextLine.trim()}`);
        }
      }
    }
  }
}
