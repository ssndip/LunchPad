const fs = require('fs');

const file = 'src/components/manager/tabs/SettingsTab.tsx';
let content = fs.readFileSync(file, 'utf8');

// replace bg-neutral-900 shadow-lg shadow-neutral-200
content = content.replace(/className="w-14 h-8 rounded-full transition-all relative focus:outline-none bg-neutral-900 shadow-lg shadow-neutral-200"/g, 'className="w-14 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 bg-neutral-900 shadow-lg shadow-neutral-200"');

content = content.replace(/className="w-14 h-8 rounded-full transition-all relative focus:outline-none bg-neutral-200"/g, 'className="w-14 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 bg-neutral-200"');

fs.writeFileSync(file, content, 'utf8');
console.log(`Updated SettingsTab.tsx`);
