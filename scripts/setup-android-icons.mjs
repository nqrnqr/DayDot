import fs from 'node:fs';
import path from 'node:path';

/**
 * Copies DayDot's generated PNG icon into the freshly generated Capacitor Android
 * project's mipmap directories and sets the adaptive icon background to #18181B.
 */
const root = process.cwd();
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const icon512 = path.join(root, 'public', 'icon-512.png');
const icon192 = path.join(root, 'public', 'icon-192.png');

if (!fs.existsSync(resDir)) {
  console.error('Android res directory not found:', resDir);
  process.exit(1);
}

const mipmapDirs = [
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

for (const dirName of mipmapDirs) {
  const targetDir = path.join(resDir, dirName);
  if (!fs.existsSync(targetDir)) continue;
  const srcIcon = dirName === 'mipmap-xxxhdpi' || dirName === 'mipmap-xxhdpi' ? icon512 : icon192;
  for (const fileName of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const dest = path.join(targetDir, fileName);
    if (fs.existsSync(dest) || fileName !== 'ic_launcher_foreground.png') {
      fs.copyFileSync(srcIcon, dest);
    }
  }
}

// Match adaptive icon background color to our dark icon card (#18181B)
const bgXml = path.join(resDir, 'values', 'ic_launcher_background.xml');
if (fs.existsSync(bgXml)) {
  fs.writeFileSync(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#18181B</color>\n</resources>\n`,
    'utf8',
  );
}

console.log('Applied DayDot launcher icons to Android project.');
