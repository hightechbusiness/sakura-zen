#!/usr/bin/env node
// Instala sakura-zen en ~/.claude/settings.json (CLI, VS Code y app de escritorio leen el mismo archivo).
// Uso:  node install.js          -> instala
//       node install.js --remove -> restaura el backup / quita las claves
const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const file = path.join(cfgDir, 'settings.json');
const script = path.join(__dirname, 'sakura.js').replace(/\\/g, '/');

let s = {};
if (fs.existsSync(file)) {
  s = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.copyFileSync(file, file + '.sakura-backup');
}

if (process.argv.includes('--remove')) {
  delete s.statusLine; delete s.spinnerVerbs; delete s.spinnerTipsOverride;
} else {
  // --interval N : segundos entre frames (default 3). --no-refresh : solo se actualiza con eventos.
  const i = process.argv.indexOf('--interval');
  const interval = i > -1 ? Math.max(1, parseInt(process.argv[i + 1], 10) || 3) : 3;
  // --256 : fuerza 256 colores (Terminal.app de macOS). Por defecto se detecta solo.
  const prefix = process.argv.includes('--256') && process.platform !== 'win32' ? 'SAKURA_COLOR=256 ' : '';
  s.statusLine = { type: 'command', command: `${prefix}node "${script}"` };
  if (!process.argv.includes('--no-refresh')) s.statusLine.refreshInterval = interval;
  s.spinnerVerbs = { mode: 'replace', verbs: [
    'Dejando caer petalos', 'Preparando el te', 'Podando el bonsai', 'Rastrillando el jardin zen',
    'Cruzando el puente rojo', 'Escuchando el bambu', 'Plegando origami', 'Esperando el hanami',
    'Tallando el sumi-e', 'Subiendo al Fuji',
  ] };
  s.spinnerTipsOverride = { excludeDefault: false, tips: [
    'Mientras espera: respira hondo y estira los hombros',
    'Mientras espera: toma agua',
    'Mientras espera: anota el siguiente paso en una linea',
    'Mientras espera: revisa el diff del ultimo cambio',
  ] };
}
fs.mkdirSync(cfgDir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(s, null, 2));
console.log((process.argv.includes('--remove') ? 'Quitado de ' : 'Instalado en ') + file);
