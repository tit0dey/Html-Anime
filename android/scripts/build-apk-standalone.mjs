import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const ANDROID_MAIN = path.join(REPO_ROOT, 'android/app/src/main');
const WORK_DIR = '/tmp/openbrain-apk-work';
const TOOLCHAIN = '/tmp/android-toolchain';

const JAVA = `${TOOLCHAIN}/venv/lib/python3.11/site-packages/jdk4py/java-runtime/bin/java`;
const KEYTOOL = `${TOOLCHAIN}/venv/lib/python3.11/site-packages/jdk4py/java-runtime/bin/keytool`;
const AAPT2 = `${TOOLCHAIN}/node_modules/aaptjs3/bin/x64/linux/aapt2`;
const ANDROID_JAR = `${TOOLCHAIN}/platforms-repo/android-34/android.jar`;
const ECJ_JAR = `${TOOLCHAIN}/java2dex/app/biblis/ecj-4.8.jar`;
const DEXER_JAR = `${TOOLCHAIN}/java2dex/app/biblis/dfoda0.0.9.jar`;
const APKSIGNER_JAR = `${TOOLCHAIN}/node_modules/@postar/apktool-node/lib/apksigner.jar`;

console.log('🚀 [1/7] Building production Open Brain Web Bundle...');
const publicApkPath = path.join(REPO_ROOT, 'public/OpenBrain-AI.apk');
if (fs.existsSync(publicApkPath)) fs.unlinkSync(publicApkPath);

execSync('npx vite build', { cwd: REPO_ROOT, stdio: 'inherit' });

console.log('📦 [2/7] Creating self-contained Featherlight Android WebView Asset Bundle...');
const distDir = path.join(REPO_ROOT, 'dist');
const assetsPublicDir = path.join(ANDROID_MAIN, 'assets/public');
fs.rmSync(assetsPublicDir, { recursive: true, force: true });
fs.mkdirSync(assetsPublicDir, { recursive: true });

let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const distAssetsDir = path.join(distDir, 'assets');
const assetFiles = fs.readdirSync(distAssetsDir);
const cssFile = assetFiles.find((f) => f.endsWith('.css'));
const jsFile = assetFiles.find((f) => f.endsWith('.js'));

if (cssFile) {
  const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf8');
  html = html.replace(
    /<link[^>]+rel="stylesheet"[^>]*>/i,
    () => `<style>\n${cssContent}\n</style>`
  );
}
if (jsFile) {
  const jsContent = fs.readFileSync(path.join(distAssetsDir, jsFile), 'utf8');
  const safeJs = jsContent.replace(/<\/script>/gi, '<\\/script>');
  html = html.replace(
    /<script[^>]+src="[^"]+"[^>]*><\/script>/i,
    () => `<script type="module">\n${safeJs}\n</script>`
  );
}

fs.writeFileSync(path.join(assetsPublicDir, 'index.html'), html, 'utf8');
fs.copyFileSync(path.join(REPO_ROOT, 'public/icon.svg'), path.join(assetsPublicDir, 'icon.svg'));
fs.copyFileSync(
  path.join(REPO_ROOT, 'public/manifest.json'),
  path.join(assetsPublicDir, 'manifest.json')
);

console.log('🛠️  [3/7] Compiling Android resources & Manifest via AAPT2...');
fs.rmSync(WORK_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK_DIR, 'gen_r'), { recursive: true });
fs.mkdirSync(path.join(WORK_DIR, 'classes'), { recursive: true });

const compiledResZip = path.join(WORK_DIR, 'compiled_res.zip');
const baseUnsignedApk = path.join(WORK_DIR, 'base_unaligned.apk');

execFileSync(AAPT2, [
  'compile',
  '--dir',
  path.join(ANDROID_MAIN, 'res'),
  '-o',
  compiledResZip,
]);

execFileSync(AAPT2, [
  'link',
  '-o',
  baseUnsignedApk,
  '-I',
  ANDROID_JAR,
  '--manifest',
  path.join(ANDROID_MAIN, 'AndroidManifest.xml'),
  '-A',
  path.join(ANDROID_MAIN, 'assets'),
  '--java',
  path.join(WORK_DIR, 'gen_r'),
  '-0',
  'arsc',
  compiledResZip,
]);

console.log('☕ [4/7] Compiling OpenBrainNativeBridge (MainActivity + R.java) -> Dalvik classes.dex...');
const rJava = path.join(WORK_DIR, 'gen_r/com/openbrain/ai/R.java');
const mainJava = path.join(ANDROID_MAIN, 'java/com/openbrain/ai/MainActivity.java');

execFileSync(
  JAVA,
  [
    '-jar',
    ECJ_JAR,
    '-1.8',
    '-nowarn',
    '-bootclasspath',
    ANDROID_JAR,
    '-d',
    path.join(WORK_DIR, 'classes'),
    rJava,
    mainJava,
  ],
  { stdio: 'inherit' }
);

const classesJar = path.join(WORK_DIR, 'classes.jar');
const classesDex = path.join(WORK_DIR, 'classes.dex');

execFileSync('python3', [
  '-c',
  `
import os, zipfile
root = "${path.join(WORK_DIR, 'classes')}"
out = "${classesJar}"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for dp, _, fns in os.walk(root):
        for fn in sorted(fns):
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, root)
            z.write(full, rel)
`,
]);

execFileSync(
  JAVA,
  ['-cp', DEXER_JAR, 'com.dfoda.dexer.Main', `--saida=${classesDex}`, classesJar],
  { stdio: 'inherit' }
);

console.log('📐 [5/7] Merging classes.dex & applying strict 4-byte Android 11–16 zipalign...');
const alignedApk = path.join(WORK_DIR, 'aligned_unsigned.apk');

execFileSync('python3', [
  '-c',
  `
import struct, zlib, zipfile

base_apk = "${baseUnsignedApk}"
dex_path = "${classesDex}"
out_apk = "${alignedApk}"

entries = []
with zipfile.ZipFile(base_apk, "r") as zin:
    for info in zin.infolist():
        if info.filename.startswith("META-INF/"):
            continue
        data = zin.read(info.filename)
        store_uncompressed = (
            info.filename == "resources.arsc"
            or info.filename.endswith(".png")
            or info.filename.endswith(".webp")
        )
        entries.append((info.filename, data, store_uncompressed))

with open(dex_path, "rb") as fd:
    entries.append(("classes.dex", fd.read(), False))

central_dir = bytearray()
offset = 0

with open(out_apk, "wb") as f:
    for name_str, raw_bytes, is_stored in entries:
        name = name_str.encode("utf-8")
        crc = zlib.crc32(raw_bytes) & 0xFFFFFFFF
        uncomp_size = len(raw_bytes)

        if is_stored:
            method = 0
            comp_bytes = raw_bytes
            header_end = offset + 30 + len(name)
            pad = (4 - (header_end % 4)) % 4
            extra = b"\\x00" * pad
        else:
            method = 8
            co = zlib.compressobj(9, zlib.DEFLATED, -15)
            comp_bytes = co.compress(raw_bytes) + co.flush()
            extra = b""

        comp_size = len(comp_bytes)
        local_header = struct.pack(
            "<4sHHHHHIIIHH",
            b"PK\\x03\\x04",
            20,
            0,
            method,
            0,
            0x5548,
            crc,
            comp_size,
            uncomp_size,
            len(name),
            len(extra),
        )
        f.write(local_header)
        f.write(name)
        f.write(extra)
        data_offset = f.tell()
        if is_stored:
            assert data_offset % 4 == 0, f"Alignment error on {name_str}: {data_offset}"
        f.write(comp_bytes)

        cd_header = struct.pack(
            "<4sHHHHHHIIIHHHHHII",
            b"PK\\x01\\x02",
            20,
            20,
            0,
            method,
            0,
            0x5548,
            crc,
            comp_size,
            uncomp_size,
            len(name),
            0,
            0,
            0,
            0,
            0,
            offset,
        )
        central_dir.extend(cd_header)
        central_dir.extend(name)
        offset = f.tell()

    cd_offset = offset
    f.write(central_dir)
    eocd = struct.pack(
        "<4sHHHHIIH",
        b"PK\\x05\\x06",
        0,
        0,
        len(entries),
        len(entries),
        len(central_dir),
        cd_offset,
        0,
    )
    f.write(eocd)
print("Aligned APK written cleanly with", len(entries), "entries.")
`,
]);

console.log('🔐 [6/7] Signing OpenBrain-AI.apk with V2 + V3 Android Signatures...');
const keystorePath = path.join(WORK_DIR, 'openbrain-release.jks');
execFileSync(KEYTOOL, [
  '-genkeypair',
  '-v',
  '-keystore',
  keystorePath,
  '-alias',
  'openbrain',
  '-keyalg',
  'RSA',
  '-keysize',
  '2048',
  '-validity',
  '10000',
  '-storepass',
  'openbrain123',
  '-keypass',
  'openbrain123',
  '-dname',
  'CN=Open Brain AI, OU=OpenSource, O=OpenBrain, L=Kolkata, ST=WB, C=IN',
]);

const signedApkOut = path.join(WORK_DIR, 'OpenBrain-AI.apk');
execFileSync(
  JAVA,
  [
    '-jar',
    APKSIGNER_JAR,
    'sign',
    '--ks',
    keystorePath,
    '--ks-key-alias',
    'openbrain',
    '--ks-pass',
    'pass:openbrain123',
    '--key-pass',
    'pass:openbrain123',
    '--v1-signing-enabled',
    'true',
    '--v2-signing-enabled',
    'true',
    '--v3-signing-enabled',
    'true',
    '--out',
    signedApkOut,
    alignedApk,
  ],
  { stdio: 'inherit' }
);

console.log('✅ [7/7] Verifying OpenBrain-AI.apk Cryptographic Signature & Manifest...');
const verifyOut = execFileSync(JAVA, [
  '-jar',
  APKSIGNER_JAR,
  'verify',
  '--verbose',
  signedApkOut,
]).toString();
console.log(verifyOut.trim());

const badgingOut = execFileSync(AAPT2, ['dump', 'badging', signedApkOut]).toString();
console.log(badgingOut.split('\n').slice(0, 6).join('\n'));

const repoApkDir = path.join(REPO_ROOT, 'apk');
fs.mkdirSync(repoApkDir, { recursive: true });
fs.copyFileSync(signedApkOut, path.join(repoApkDir, 'OpenBrain-AI.apk'));
fs.copyFileSync(signedApkOut, path.join(REPO_ROOT, 'public/OpenBrain-AI.apk'));
fs.copyFileSync(signedApkOut, path.join(REPO_ROOT, 'dist/OpenBrain-AI.apk'));

const sizeMb = (fs.statSync(signedApkOut).size / (1024 * 1024)).toFixed(2);
console.log(`🎉 SUCCESS! Signed OpenBrain-AI.apk ready at apk/OpenBrain-AI.apk (${sizeMb} MB)`);
