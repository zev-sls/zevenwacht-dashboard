const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
if (!process.env.DATA_ENCRYPTION_KEY) {
  const localEnv = path.join(root, '.env.local');
  if (fs.existsSync(localEnv)) process.loadEnvFile(localEnv);
}
const args = process.argv.slice(2);
const rotate = args.includes('--rotate');
const targets = args.filter(arg => arg !== '--rotate');
const target = targets[0] || 'all';
if (targets.length > 1 || !['all', 'sales', 'users'].includes(target)) {
  throw new Error('Usage: node scripts/encrypt-data.js [all|sales|users] [--rotate]');
}
const keyRaw = process.env.DATA_ENCRYPTION_KEY;
if(!keyRaw) throw new Error('Set DATA_ENCRYPTION_KEY before running this script');
const key = Buffer.from(keyRaw, 'base64');
if(key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes');

function encryptFile(source, dest){
  const value = JSON.parse(fs.readFileSync(source, 'utf8'));
  const plaintext = JSON.stringify(value);
  if (!rotate && fs.existsSync(dest)) {
    const existing = JSON.parse(fs.readFileSync(dest, 'utf8'));
    if (existing.alg !== 'AES-256-GCM') throw new Error(`Unsupported encryption in ${dest}`);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(existing.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(existing.tag, 'base64'));
    const previous = Buffer.concat([
      decipher.update(Buffer.from(existing.ciphertext, 'base64')),
      decipher.final()
    ]).toString('utf8');
    if (previous === plaintext) {
      console.log(`${path.relative(root, dest)} unchanged`);
      return;
    }
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  const payload = { alg:'AES-256-GCM', iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), ciphertext:ciphertext.toString('base64') };
  fs.writeFileSync(dest, JSON.stringify(payload, null, 2));
  console.log(`Updated ${path.relative(root, dest)}`);
}

fs.mkdirSync(path.join(root, 'data'), { recursive:true });
if (target === 'all' || target === 'users') {
  encryptFile(path.join(root, 'private', 'users.json'), path.join(root, 'data', 'users.enc.json'));
}
if (target === 'all' || target === 'sales') {
  encryptFile(path.join(root, 'private', 'sales-data.json'), path.join(root, 'data', 'sales-data.enc.json'));
}
