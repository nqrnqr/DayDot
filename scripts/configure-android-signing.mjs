import fs from 'node:fs';
import path from 'node:path';

/**
 * Patches android/app/build.gradle during CI:
 * 1. Sets monotonically increasing versionCode & versionName from env.
 * 2. When signing env vars & release.keystore are present, injects release
 *    signingConfig cleanly into buildTypes.release.
 */
const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) {
  console.error('build.gradle not found at', gradlePath);
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');

const versionCode = Number(process.env.ANDROID_VERSION_CODE || '1') || 1;
const versionName = (process.env.ANDROID_VERSION_NAME || '1.0.0').replace(/"/g, '');

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

const hasSigning =
  Boolean(process.env.ANDROID_KEYSTORE_PASSWORD) &&
  Boolean(process.env.ANDROID_KEY_ALIAS) &&
  Boolean(process.env.ANDROID_KEY_PASSWORD) &&
  fs.existsSync(path.join(process.cwd(), 'android', 'app', 'release.keystore'));

if (hasSigning && !gradle.includes('signingConfigs {')) {
  const replacement = `signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release`;

  const matched = /buildTypes\s*\{\s*release\s*\{/.test(gradle);
  if (!matched) {
    console.error('Could not find buildTypes { release { block in build.gradle');
    process.exit(1);
  }
  gradle = gradle.replace(/buildTypes\s*\{\s*release\s*\{/, replacement);
  console.log(
    `Configured permanent release signing + version ${versionName} (${versionCode}).`,
  );
} else {
  console.log(
    `Configured debug version ${versionName} (${versionCode}) without release keystore.`,
  );
}

fs.writeFileSync(gradlePath, gradle, 'utf8');
