const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function getLog() {
  try {
    if (global.log) return global.log;
    const Logger = require('../logger/logs');
    const tz =
      global.config?.botInfo?.timezone ||
      global.config?.settings?.timezone ||
      global.config?.timezone ||
      'Asia/Dhaka';
    return new Logger(tz);
  } catch {
    return {
      info: (...a) => console.log('[INFO]', ...a),
      success: (...a) => console.log('[✓]', ...a),
      warn: (...a) => console.log('[⚠]', ...a),
      error: (...a) => console.log('[✗]', ...a)
    };
  }
}

async function installMissingPackage(packageName) {
  const log = getLog();
  return new Promise((resolve, reject) => {
    log.info(`📦 Installing missing package: ${packageName}...`);
    exec(
      `npm install ${packageName} --save`,
      { cwd: path.join(__dirname, '..') },
      error => {
        if (error) {
          log.error(`Failed to install ${packageName}: ${error.message}`);
          reject(error);
          return;
        }
        log.success(`✓ Installed ${packageName}`);
        resolve();
      }
    );
  });
}

async function tryInstallAndLoad(filePath) {
  try {
    try {
      delete require.cache[require.resolve(filePath)];
    } catch {}
    return { success: true, command: require(filePath) };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      const match = error.message.match(/Cannot find module '([^']+)'/);
      if (match) {
        const missingPackage = match[1];
        if (
          !missingPackage.startsWith('.') &&
          !missingPackage.startsWith('/') &&
          !path.isAbsolute(missingPackage)
        ) {
          try {
            await installMissingPackage(missingPackage);
            try {
              delete require.cache[require.resolve(filePath)];
            } catch {}
            return { success: true, command: require(filePath) };
          } catch (installError) {
            return {
              success: false,
              error: `Install fail ${missingPackage}: ${installError.message}`
            };
          }
        }
      }
    }
    return { success: false, error: error.message || String(error) };
  }
}

async function loadCommands(showProgress = true) {
  const log = getLog();
  const commandsPath = path.join(__dirname, '..', 'Script', 'cmds');
  const loadedCommands = [];
  const errorCommands = [];
  const loadedNames = [];

  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║         📦  LOADING COMMANDS               ║');
  console.log('╚════════════════════════════════════════════╝');

  if (!fs.existsSync(commandsPath)) {
    fs.mkdirSync(commandsPath, { recursive: true });
    log.warn('Script/cmds not found → created');
    return { loaded: [], errors: [] };
  }

  if (!global.badol) global.badol = {};
  if (!global.badol.commands) global.badol.commands = new Map();

  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  const disabled =
    global.config?.settings?.disabledCommands ||
    global.config?.disabledCommands ||
    [];

  log.info(`Found ${files.length} command file(s)`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tag = `[${String(i + 1).padStart(2, '0')}/${String(files.length).padStart(2, '0')}]`;

    if (disabled.includes(file) || disabled.includes(file.replace('.js', ''))) {
      console.log(`${tag} ⏭  SKIP  ${file} (disabled in config)`);
      continue;
    }

    const filePath = path.join(commandsPath, file);
    const result = await tryInstallAndLoad(filePath);

    if (!result.success) {
      errorCommands.push({ file, error: result.error });
      console.log(`${tag} ✗  FAIL  ${file}`);
      console.log(`         └─ ${result.error}`);
      continue;
    }

    try {
      const command = result.command;
      if (!command || typeof command !== 'object') throw new Error('Invalid export');
      if (!command.config) throw new Error('Missing config');
      if (!command.config.name) throw new Error('Missing config.name');
      if (!command.config.author) command.config.author = 'Community';

      if (
        !command.BADOL &&
        !command.onReply &&
        !command.onCallback &&
        !command.onLoad &&
        !command.onChat
      ) {
        throw new Error('Missing BADOL / onChat / onCallback / onReply / onLoad');
      }

      if (global.badol.commands.has(command.config.name)) {
        errorCommands.push({ file, error: `Duplicate: ${command.config.name}` });
        console.log(`${tag} ✗  FAIL  ${file} (duplicate name: ${command.config.name})`);
        continue;
      }

      global.badol.commands.set(command.config.name, command);
      if (Array.isArray(command.config.aliases)) {
        command.config.aliases.forEach(alias => {
          if (alias) global.badol.commands.set(String(alias).toLowerCase(), command);
        });
      }

      loadedCommands.push(file);
      loadedNames.push(command.config.name);

      const handlers = [];
      if (command.BADOL) handlers.push('BADOL');
      if (command.onChat) handlers.push('onChat');
      if (command.onCallback) handlers.push('onCallback');
      if (command.onReply) handlers.push('onReply');
      if (command.onLoad) handlers.push('onLoad');

      console.log(
        `${tag} ✓  ${file} → /${command.config.name}` +
          (handlers.length ? `  [${handlers.join('+')}]` : '')
      );

      if (command.onLoad && typeof command.onLoad === 'function' && global.bot) {
        try {
          await command.onLoad.call(command, {
            api: global.bot.telegram || global.bot,
            bot: global.bot
          });
        } catch (e) {
          console.log(`         └─ onLoad error: ${e.message}`);
        }
      }
    } catch (error) {
      errorCommands.push({ file, error: error.message });
      console.log(`${tag} ✗  FAIL  ${file}`);
      console.log(`         └─ ${error.message}`);
    }
  }

  console.log('');
  console.log('┌──────────── COMMAND SUMMARY ────────────┐');
  console.log(`│  ✓ Loaded : ${String(loadedCommands.length).padEnd(28)}│`);
  console.log(`│  ✗ Failed : ${String(errorCommands.length).padEnd(28)}│`);
  console.log('└─────────────────────────────────────────┘');
  if (loadedNames.length) {
    console.log(`📋 Commands: ${loadedNames.join(', ')}`);
  }
  if (errorCommands.length) {
    console.log('❌ Failures:');
    errorCommands.forEach(e => console.log(`   • ${e.file}: ${e.error}`));
  }
  console.log('');

  return { loaded: loadedCommands, errors: errorCommands };
}

async function loadEvents(showProgress = true) {
  const log = getLog();
  const eventsPath = path.join(__dirname, '..', 'Script', 'events');
  const loadedEvents = [];
  const errorEvents = [];
  const loadedNames = [];

  console.log('╔════════════════════════════════════════════╗');
  console.log('║         📡  LOADING EVENTS                 ║');
  console.log('╚════════════════════════════════════════════╝');

  if (!fs.existsSync(eventsPath)) {
    fs.mkdirSync(eventsPath, { recursive: true });
    log.warn('Script/events not found → created');
    return { loaded: [], errors: [] };
  }

  if (!global.badol) global.badol = {};
  if (!global.badol.events) global.badol.events = new Map();

  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  const disabled = global.config?.settings?.disabledEvents || [];

  log.info(`Found ${files.length} event file(s)`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tag = `[${String(i + 1).padStart(2, '0')}/${String(files.length).padStart(2, '0')}]`;

    if (disabled.includes(file) || disabled.includes(file.replace('.js', ''))) {
      console.log(`${tag} ⏭  SKIP  ${file}`);
      continue;
    }

    const filePath = path.join(eventsPath, file);
    const result = await tryInstallAndLoad(filePath);

    if (!result.success) {
      errorEvents.push({ file, error: result.error });
      console.log(`${tag} ✗  FAIL  ${file} → ${result.error}`);
      continue;
    }

    try {
      const event = result.command;
      if (!event?.config?.name) throw new Error('Missing config.name');
      if (!event.config.author) event.config.author = 'Community';
      if (!event.BADOL) throw new Error('Missing BADOL()');

      global.badol.events.set(event.config.name, event);
      loadedEvents.push(file);
      loadedNames.push(event.config.name);
      console.log(
        `${tag} ✓  ${file} → ${event.config.name} (${event.config.eventType || 'custom'})`
      );
    } catch (error) {
      errorEvents.push({ file, error: error.message });
      console.log(`${tag} ✗  FAIL  ${file} → ${error.message}`);
    }
  }

  console.log('');
  console.log('┌──────────── EVENT SUMMARY ──────────────┐');
  console.log(`│  ✓ Loaded : ${String(loadedEvents.length).padEnd(28)}│`);
  console.log(`│  ✗ Failed : ${String(errorEvents.length).padEnd(28)}│`);
  console.log('└─────────────────────────────────────────┘');
  if (loadedNames.length) console.log(`📋 Events: ${loadedNames.join(', ')}`);
  if (errorEvents.length) {
    errorEvents.forEach(e => console.log(`   • ${e.file}: ${e.error}`));
  }
  console.log('');

  return { loaded: loadedEvents, errors: errorEvents };
}

function unloadCommand(commandName) {
  try {
    const command = global.badol.commands.get(commandName);
    if (!command) return { success: false, message: 'Command not found' };
    global.badol.commands.delete(commandName);
    if (command.config?.aliases) {
      command.config.aliases.forEach(a => global.badol.commands.delete(a));
    }
    console.log(`[UNLOAD] ✓ command ${commandName}`);
    return { success: true, message: `Command ${commandName} unloaded` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function unloadEvent(eventName) {
  try {
    global.badol.events.delete(eventName);
    console.log(`[UNLOAD] ✓ event ${eventName}`);
    return { success: true, message: `Event ${eventName} unloaded` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function reloadCommand(commandName) {
  try {
    const commandsPath = path.join(__dirname, '..', 'Script', 'cmds');
    const files = fs.readdirSync(commandsPath);
    const commandFile = files.find(
      f => f.replace('.js', '') === commandName || f === commandName
    );
    if (!commandFile) return { success: false, message: 'File not found' };
    const fullPath = path.join(commandsPath, commandFile);
    try {
      delete require.cache[require.resolve(fullPath)];
    } catch {}
    const command = require(fullPath);
    if (!command?.config?.name) return { success: false, message: 'Invalid structure' };
    if (!command.config.author) command.config.author = 'Community';
    unloadCommand(command.config.name);
    global.badol.commands.set(command.config.name, command);
    if (command.config.aliases) {
      command.config.aliases.forEach(a => global.badol.commands.set(a, command));
    }
    console.log(`[RELOAD] ✓ /${command.config.name}`);
    return { success: true, message: `Command ${commandName} reloaded` };
  } catch (error) {
    console.log(`[RELOAD] ✗ ${commandName}: ${error.message}`);
    return { success: false, message: error.message };
  }
}

async function reloadEvent(eventName) {
  try {
    const eventsPath = path.join(__dirname, '..', 'Script', 'events');
    const files = fs.readdirSync(eventsPath);
    const eventFile = files.find(
      f => f.replace('.js', '') === eventName || f === eventName
    );
    if (!eventFile) return { success: false, message: 'Not found' };
    const fullPath = path.join(eventsPath, eventFile);
    try {
      delete require.cache[require.resolve(fullPath)];
    } catch {}
    const event = require(fullPath);
    if (!event?.config) return { success: false, message: 'Invalid' };
    if (!event.config.author) event.config.author = 'Community';
    global.badol.events.set(event.config.name, event);
    console.log(`[RELOAD] ✓ event ${event.config.name}`);
    return { success: true, message: `Event ${eventName} reloaded` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function deleteCommandFile(fileName) {
  try {
    const p = path.join(
      __dirname,
      '..',
      'Script',
      'cmds',
      fileName.endsWith('.js') ? fileName : fileName + '.js'
    );
    if (!fs.existsSync(p)) return { success: false, message: 'File not found' };
    fs.unlinkSync(p);
    unloadCommand(path.basename(p, '.js'));
    return { success: true, message: `Deleted ${fileName}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteEventFile(fileName) {
  try {
    const p = path.join(
      __dirname,
      '..',
      'Script',
      'events',
      fileName.endsWith('.js') ? fileName : fileName + '.js'
    );
    if (!fs.existsSync(p)) return { success: false, message: 'Not found' };
    fs.unlinkSync(p);
    global.badol.events.delete(path.basename(p, '.js'));
    return { success: true, message: `Deleted ${fileName}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function installCommandFile(fileName, code) {
  try {
    const p = path.join(
      __dirname,
      '..',
      'Script',
      'cmds',
      fileName.endsWith('.js') ? fileName : fileName + '.js'
    );
    fs.writeFileSync(p, code, 'utf8');
    return { success: true, message: `Installed ${fileName}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function installEventFile(fileName, code) {
  try {
    const p = path.join(
      __dirname,
      '..',
      'Script',
      'events',
      fileName.endsWith('.js') ? fileName : fileName + '.js'
    );
    fs.writeFileSync(p, code, 'utf8');
    return { success: true, message: `Installed ${fileName}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(
      path.join(__dirname, '..', 'config.json'),
      JSON.stringify(global.config, null, 2)
    );
  } catch {}
}

function restartProject() {
  try {
    exec('pm2 restart ESB-BOT || pm2 restart all');
  } catch {}
}

function evalCode(code) {
  try {
    return eval(code);
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

module.exports = {
  loadCommands,
  loadEvents,
  unloadCommand,
  unloadEvent,
  reloadCommand,
  reloadEvent,
  deleteCommandFile,
  deleteEventFile,
  installCommandFile,
  installEventFile,
  restartProject,
  evalCode,
  saveConfig
};
