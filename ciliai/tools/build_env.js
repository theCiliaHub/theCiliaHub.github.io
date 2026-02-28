// Build ciliai/env.js from .env (simple parser)
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.resolve(rootDir, '.env');
const outPath = path.resolve(rootDir, 'env.js');

function parseEnv(text) {
    const env = {};
    text.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx === -1) return;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        env[key] = value.replace(/^['"]|['"]$/g, '');
    });
    return env;
}

if (!fs.existsSync(envPath)) {
    console.error(`[build_env] Missing .env at ${envPath}`);
    process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const content = `// Auto-generated from .env\nwindow.CILIAI_ENV = ${JSON.stringify(env, null, 4)};\n`;
fs.writeFileSync(outPath, content, 'utf8');
console.log(`[build_env] Wrote ${outPath}`);

