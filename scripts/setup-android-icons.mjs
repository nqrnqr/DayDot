import fs from 'node:fs';
import path from 'node:path';

/**
 * Copies DayDot's generated PNG icons into the freshly generated Capacitor Android
 * project's mipmap directories:
 * - Adaptive foreground (transparent, sized to Android's 108dp safe zone) -> ic_launcher_foreground.png
 * - Full-bleed paper icons -> legacy ic_launcher.png & ic_launcher_round.png
 * - Sets adaptive background color to warm paper ivory (#F8F7F4).
 */
const root = process.cwd();
const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');
const icon512 = path.join(root, 'public', 'icon-512.png');
const icon192 = path.join(root, 'public', 'icon-192.png');
const adaptiveForeground = path.join(root, 'scripts', 'assets', 'android-icon-foreground.png');

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
  const legacyIcon =
    dirName === 'mipmap-xxxhdpi' || dirName === 'mipmap-xxhdpi' ? icon512 : icon192;

  for (const fileName of ['ic_launcher.png', 'ic_launcher_round.png']) {
    const dest = path.join(targetDir, fileName);
    if (fs.existsSync(dest)) {
      fs.copyFileSync(legacyIcon, dest);
    }
  }

  const fgDest = path.join(targetDir, 'ic_launcher_foreground.png');
  if (fs.existsSync(fgDest) && fs.existsSync(adaptiveForeground)) {
    fs.copyFileSync(adaptiveForeground, fgDest);
  }
}

// Match adaptive icon background color to warm Morandi paper ivory (#F8F7F4)
const bgXml = path.join(resDir, 'values', 'ic_launcher_background.xml');
if (fs.existsSync(bgXml)) {
  fs.writeFileSync(
    bgXml,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F8F7F4</color>\n</resources>\n`,
    'utf8',
  );
}

console.log('Applied DayDot Morandi paper adaptive icons to Android project.');
