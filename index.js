// index.js (Versão Corrigida e com Melhorias)

require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const db = require('./db');

// Logger configurado para ser silencioso, evitando poluir o console com logs do Baileys
const logger = pino({ level: 'silent' }); 

// Verifica se o JID do proprietário está definido no arquivo .env
const ownerJid = process.env.OWNER_JID;
if (!ownerJid) {
  console.error(chalk.red("ERRO CRÍTICO: A variável de ambiente OWNER_JID não está definida no arquivo .env!"));
  process.exit(1); // Encerra o processo se a variável não estiver definida
}

// Estruturas de dados em memória
const commands = new Map();
const pendingConfirmations = {};
const groupSettingsCache = new Map();

/**
 * Função para registrar informações detalhadas sobre mensagens recebidas no console.
 * @param {object} msg - O objeto da mensagem recebida do Baileys.
 * @param {object} sock - A instância do socket do Baileys.
 */
async function logMessage(msg, sock) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const senderName = msg.pushName || 'Nome Desconhecido';
    const isGroup = isJidGroup(from);
    
    const groupName = isGroup ? (await sock.groupMetadata(from)).subject : 'Mensagem Privada';
    const messageType = Object.keys(msg.message)[0];
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || `(Tipo: ${messageType})`;

    console.log(chalk.black.bgGreenBright(' RECEBIDA '));
    console.log(chalk.gray('-----------------------------------------'));
    console.log(`${chalk.cyan('De:')} ${chalk.yellow(senderName)}`);
    console.log(`${chalk.cyan('Sender JID:')} ${chalk.yellow(sender)}`);
    if (isGroup) {
        console.log(`${chalk.cyan('Grupo:')} ${chalk.green(groupName)}`);
        console.log(`${chalk.cyan('Group JID:')} ${chalk.green(from)}`);
    }
    console.log(`${chalk.cyan('Tipo:')} ${chalk.magenta(messageType)}`);
    console.log(`${chalk.cyan('Conteúdo:')} ${chalk.white(body)}`);
    console.log(`${chalk.cyan('ID da Mensagem:')} ${chalk.gray(msg.key.id)}`);
    console.log(chalk.gray('-----------------------------------------\n'));
}

/**
 * Carrega ou recarrega todos os comandos da pasta /commands.
 * Agora retorna um relatório detalhado da operação.
 * @returns {{loadedCount: number, failedCount: number, failedFiles: {file: string, error: string}[]}}
 */
function loadCommands() {
  commands.clear();
  const commandsPath = path.join(__dirname, 'commands');
  const result = {
    loadedCount: 0,
    failedCount: 0,
    failedFiles: []
  };

  if (!fs.existsSync(commandsPath)) {
      console.error(chalk.red("A pasta 'commands' não foi encontrada."));
      return result;
  }
  
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        // Limpa o cache do módulo para garantir que a versão mais recente seja carregada
        delete require.cache[require.resolve(filePath)]; 
        const command = require(filePath);
        
        if (command.name) {
            commands.set(command.name, command);
            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => commands.set(alias, command));
            }
            result.loadedCount++;
        } else {
            throw new Error("O comando não possui a propriedade 'name'.");
        }
    } catch (error) {
        // Se um comando falhar ao carregar, registra o erro e continua
        console.error(chalk.red(`Erro ao carregar o comando ${file}:`), error);
        result.failedCount++;
        result.failedFiles.push({ file, error: error.message });
    }
  }

  console.log(chalk.green(`✅ ${result.loadedCount} comandos carregados.`));
  if (result.failedCount > 0) {
      console.log(chalk.red(`❌ ${result.failedCount} comandos falharam ao carregar.`));
  }
  
  return result; // Retorna o objeto com o relatório
}

/**
 * Obtém as configurações de um grupo, utilizando um cache para otimizar.
 * @param {string} groupId - O JID do grupo.
 * @returns {Promise<object>} As configurações do grupo.
 */
async function getSettings(groupId) {
    if (groupSettingsCache.has(groupId)) {
        return groupSettingsCache.get(groupId);
    }
    const settings = await db.getGroupSettings(groupId);
    groupSettingsCache.set(groupId, settings);
    return settings;
}

/**
 * Função principal que inicializa e conecta o bot ao WhatsApp.
 */
async function connectToWhatsApp() {
  db.initDb();
  loadCommands();
  
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({ version, auth: state, logger: logger });

  // Lida com atualizações de conexão (QR Code, conexão fechada/aberta)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log(chalk.yellow('--- LEIA O QR CODE ABAIXO ---'));
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(chalk.red(`Conexão fechada. Motivo: ${lastDisconnect.error}. Reconectar: ${shouldReconnect}`));
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log(chalk.greenBright('✅ Conexão estabelecida com sucesso!'));
    }
  });

  // Salva as credenciais sempre que forem atualizadas
  sock.ev.on('creds.update', saveCreds);

  // Lida com eventos de entrada e saída de participantes em grupos
  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
      try {
        const settings = await getSettings(id);
        const userJid = participants[0];

        // Boas-vindas para novos membros
        if (action === 'add' && settings.welcome_enabled) {
            const welcomeMsg = settings.welcome_message.replace(/@user/g, `@${userJid.split('@')[0]}`);
            sock.sendMessage(id, { text: welcomeMsg, mentions: [userJid] });
        } 
        // Despedida para membros que saíram
        else if (action === 'remove' && settings.farewell_enabled) {
            const farewellMsg = settings.farewell_message.replace(/@user/g, `@${userJid.split('@')[0]}`);
            sock.sendMessage(id, { text: farewellMsg, mentions: [userJid] });
        }

        // Sincroniza a lista de participantes com o banco de dados
        const metadata = await sock.groupMetadata(id);
        db.syncGroupParticipants(id, metadata.participants);

      } catch (e) { 
          console.error(chalk.red('Erro no evento de boas-vindas/adeus:'), e); 
      }
  });

  // Processador principal de mensagens
  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return; // Ignora mensagens sem conteúdo ou enviadas pelo próprio bot

    await logMessage(msg, sock); // Loga a mensagem recebida

    const id = msg.key.remoteJid;
    const sender = msg.key.participant || id;
    const isGroup = isJidGroup(id);
    
    // Verifica se o usuário está mutado no grupo
    if (isGroup && db.isUserMuted(id, sender)) {
        await sock.sendMessage(id, { delete: msg.key });
        return;
    }
      
    let body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '').trim();

    // Lógica de autorização de grupo
    const groupIsAuthorized = isGroup ? db.isGroupAuthorized(id) : true; // Mensagens privadas são sempre "autorizadas"
    if (isGroup && !groupIsAuthorized && !body.startsWith('/authgroup')) {
        // *** ESTA ERA A LINHA COM O ERRO (isGrup) ***
        // Ignora qualquer mensagem em um grupo não autorizado que não seja o comando de autorização
        return;
    }

    if (isGroup) {
      db.recordUserActivity(id, sender); // Registra a atividade do usuário no grupo
    }
    
    // Lida com confirmações pendentes (para comandos perigosos)
    const pending = pendingConfirmations[id];
    if (isGroup && pending && pending.requester === sender && body.toLowerCase() !== '/confirmar') {
        delete pendingConfirmations[id];
        return sock.sendMessage(id, { text: `❌ Ação pendente (${pending.command}) foi cancelada.` });
    }

    // Obtém configurações e permissões
    const settings = isGroup ? await getSettings(id) : null;
    const isOwner = sender === ownerJid;
    const isBotAdmin = isOwner || (isGroup && db.isUserBotAdmin(id, sender));

    // Funcionalidade Anti-Link
    if (isGroup && settings?.antilink_enabled && /https?:\/\//.test(body) && !isBotAdmin) {
        try {
            await sock.sendMessage(id, { text: `🛡️ Anti-Link: @${sender.split('@')[0]} foi removido por enviar um link.`, mentions: [sender] });
            await sock.groupParticipantsUpdate(id, [sender], 'remove');
            await sock.sendMessage(id, { delete: msg.key }); // Deleta a mensagem do link por último
        } catch (e) { 
            console.error(chalk.red("Erro na função Anti-Link:"), e); 
            await sock.sendMessage(id, {text: "Ocorreu um erro ao remover o usuário, mas eu não tenho permissão de administrador no grupo."});
        }
        return;
    }

    // Se a mensagem não começar com '/', ignora pois não é um comando
    if (!body.startsWith('/')) return;

    // Processamento de comandos
    const args = body.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);
    
    console.log(chalk.yellow(`[Comando Tentado] -> /${commandName} | Argumentos: ${args.join(' ')}`));

    if (!command) {
        console.log(chalk.red(`[Falha] Comando /${commandName} não encontrado.`));
        await sock.sendMessage(id, { text: `Comando \`/${commandName}\` não reconhecido. Digite \`/menu\` para ver os comandos disponíveis.` });
        return;
    }

    // Executa o comando
    try {
      await command.execute({ 
        sock, msg, args, body, isGroup, sender, 
        isOwner, isBotAdmin, db, ownerJid, settings, 
        pendingConfirmations, 
        loadCommands,
        invalidateSettingsCache: () => groupSettingsCache.delete(id) 
      });
    } catch (error) {
      console.error(chalk.red.bold(`Erro CRÍTICO ao executar /${commandName}:`), error);
      await sock.sendMessage(id, { text: `Ocorreu um erro interno ao executar este comando.` }, { quoted: msg });
    }
  });
}

// Inicia a conexão
connectToWhatsApp();