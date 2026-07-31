const fs = require('fs');

const serverTs = fs.readFileSync('server.ts', 'utf8');
const settingsControllerTs = fs.readFileSync('server/controllers/settingsController.ts', 'utf8');

console.log(serverTs.includes('aiApiKey: settings.aiApiKey'));
console.log(settingsControllerTs.includes('aiApiKey: settings.aiApiKey'));
