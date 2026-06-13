import fs from "node:fs";
import path from "node:path";

const buildGradlePath = path.join(process.cwd(), "android", "app", "build.gradle");
let contents = fs.readFileSync(buildGradlePath, "utf8");

if (!contents.includes("keystorePropertiesFile")) {
  contents = contents.replace(
    "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()",
    `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}`
  );
}

if (!contents.includes("signingConfigs.release")) {
  contents = contents.replace(
    `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`,
    `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (!keystorePropertiesFile.exists()) {
                throw new GradleException("Missing android/key.properties. Configure Android signing before running bundleRelease.")
            }
            storeFile rootProject.file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }`
  );

  contents = contents.replace(
    `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`,
    `        release {
            signingConfig signingConfigs.release`
  );
}

fs.writeFileSync(buildGradlePath, contents);
