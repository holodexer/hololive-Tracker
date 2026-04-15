import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'public', 'locales');
const langs = ['en', 'zh-TW', 'ja'];

for (const lang of langs) {
  const langDir = path.join(localesDir, lang);
  if (!fs.existsSync(langDir)) continue;

  const merged: Record<string, any> = {};
  const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const ns = file.replace('.json', '');
    const content = fs.readFileSync(path.join(langDir, file), 'utf-8');
    merged[ns] = JSON.parse(content);
  }

  // Write single file
  fs.writeFileSync(path.join(localesDir, `${lang}.json`), JSON.stringify(merged, null, 2));
  
  // Cleanup old directory
  for (const file of files) {
    fs.unlinkSync(path.join(langDir, file));
  }
  fs.rmdirSync(langDir);
}

console.log("Merged i18n files successfully.");
