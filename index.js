// index.js (Versão original do usuário + Handler do /play)
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

const logger = pino({ level: 'info' });

let config = require('./config.json');
const saveConfig = () => {
  fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));
};

const commands = new Map();
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.existsSync(commandsPath) ? fs.readdirSync(commandsPath).filter(file => file.endsWith('.js')) : [];
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    delete require.cache[require.resolve(filePath)];
    const command = require(filePath);
    if (command.name) {
      commands.set(command.name, command);
      console.log(`✅ Comando carregado: /${command.name}`);
    }
    if (command.aliases && Array.isArray(command.aliases)) {
      command.aliases.forEach(alias => commands.set(alias, command));
    }
  }
}

async function connectToWhatsApp() {
  loadCommands();
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state, logger: logger });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('📲 Escaneie este QR Code:');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('✅ Conexão aberta com sucesso!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async m => {
    console.log('>>> EVENTO messages.upsert DISPARADO!');
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const id = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = id.endsWith('@g.us');
    const isOwner = sender === config.ownerJid;

    // Detecta texto em diferentes tipos de mensagens
    let body = '';
    if (msg.message.conversation) body = msg.message.conversation;
    else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
    else if (msg.message.imageMessage?.caption) body = msg.message.imageMessage.caption;
    else if (msg.message.videoMessage?.caption) body = msg.message.videoMessage.caption;
    else if (msg.message.documentMessage?.caption) body = msg.message.documentMessage.caption;
    body = body.trim();

    console.log(`📨 Mensagem de ${sender} no ${isGroup ? 'grupo' : 'privado'} ${id}: "${body}"`);
    // ======================= AUTORIZAÇÃO DE GRUPO =======================
    if (body.toLowerCase() === '/authgroup') {
      if (!isOwner) return sock.sendMessage(id, { text: 'Apenas o dono pode autorizar grupos.' });
      if (!isGroup) return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
      if (config.groups?.[id]) return sock.sendMessage(id, { text: 'Este grupo já está autorizado.' });

      if (!config.groups) config.groups = {};
      config.groups[id] = { admins: [sender] };
      saveConfig();

      return sock.sendMessage(id, {
        text: `✅ Grupo autorizado! @${sender.split('@')[0]} agora é admin do bot.`,
        mentions: [sender]
      });
    }

    if (body.toLowerCase() === '/unauthgroup') {
      if (!isOwner) return;
      if (!isGroup) return;
      if (!config.groups?.[id]) return sock.sendMessage(id, { text: 'Este grupo não está autorizado.' });

      delete config.groups[id];
      saveConfig();
      return sock.sendMessage(id, { text: '❌ Grupo removido com sucesso.' });
    }

    // Se não autorizado, ignora
    if (isGroup && !config.groups?.[id]) {
      console.log('⚠️ Grupo não autorizado. Ignorando mensagem...');
      return;
    }

    const groupAdmins = isGroup ? config.groups[id].admins : [];
    const isBotAdmin = isOwner || (isGroup && groupAdmins.includes(sender));

    // ======================= ANTI-LINK =======================
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    if (isGroup && body.match(linkRegex)) {
      if (!isBotAdmin) {
        try {
          console.log(`[ANTI-LINK] Link detectado de ${sender} em ${id}`);
          await sock.groupParticipantsUpdate(id, [sender], 'remove');
          await sock.sendMessage(id, { delete: msg.key });
          await sock.sendMessage(id, {
            text: `⚠️ @${sender.split('@')[0]} foi banido por enviar link.`,
            mentions: [sender]
          });
        } catch (e) {
          console.error("[ANTI-LINK] Erro ao remover membro:", e);
          await sock.sendMessage(id, { text: 'Erro: o bot é admin no grupo?' });
        }
        return;
      }
    }

    // ======================= COMANDOS =======================
    if (!body.startsWith('/')) return;

    const args = body.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);

    console.log(`[⚙️ COMANDO] /${commandName} chamado por ${sender} com args: ${args.join(' ')}`);

    if (!command) {
      console.log(`[❌ COMANDO NÃO ENCONTRADO] ${commandName}`);
      await sock.sendMessage(id, { text: `Comando não reconhecido. Digite /menu para ver a lista de opções.` }, { quoted: msg });
      return;
    }

    try {
      await command.execute({
        sock,
        msg,
        args,
        body,
        isGroup,
        sender,
        isOwner,
        isBotAdmin,
        groupAdmins,
        config,
        saveConfig
      });
    } catch (error) {
      console.error(`Erro ao executar comando /${commandName}:`, error);
      await sock.sendMessage(id, { text: `Erro ao executar comando.` }, { quoted: msg });
    }
  });
}

connectToWhatsApp();