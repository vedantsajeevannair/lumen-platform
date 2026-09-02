#!/usr/bin/env node
const { networkInterfaces } = require('os');
const { spawn } = require('child_process');

function getLocalIp() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return null;
  }
  const nets = networkInterfaces();
  // Prioritize en0/en1 (macOS Wi-Fi / Ethernet), then any active non-internal IPv4
  const interfaceNames = Object.keys(nets).sort((a, b) => {
    if (a.startsWith('en')) return -1;
    if (b.startsWith('en')) return 1;
    return 0;
  });

  for (const name of interfaceNames) {
    for (const net of nets[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const customUrl = process.env.EXPO_PUBLIC_API_URL;
const detectedIp = getLocalIp();
const apiUrl = customUrl || `http://${detectedIp}:4000`;

console.log('==================================================');
console.log(' 📡 LUMEN Mobile Dev Server');
console.log(` 🔗 Auto-configured Backend URL : ${apiUrl}`);
console.log('==================================================\n');

const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL: apiUrl,
};

const args = process.argv.slice(2);
const child = spawn('npx', ['expo', 'start', '-c', ...args], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
