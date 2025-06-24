// commands/tagall.js (Versão Melhorada)

module.exports = {
    name: 'tagall',
    description: '📢 (Admin do Bot) Marca todos os membros do grupo.',
    aliases: ['everyone', 'marcartodos', 'aviso'],

    /**
     * @param {object} context - O objeto de contexto fornecido pelo handler de comandos.
     * @param {import('@whiskeysockets/baileys').WASocket} context.sock - A instância do socket Baileys.
     * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} context.msg - O objeto da mensagem.
     * @param {string[]} context.args - Argumentos passados junto ao comando.
     * @param {boolean} context.isGroup - Verdadeiro se a mensagem foi enviada em um grupo.
     * @param {boolean} context.isBotAdmin - Verdadeiro se o remetente é um admin do bot.
     */
    async execute({ sock, msg, args, isGroup, isBotAdmin }) {
        const id = msg.key.remoteJid;

        // ================== VERIFICAÇÕES INICIAIS ==================
        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' }, { quoted: msg });
        }
        
        try {
            // ================== LÓGICA DO COMANDO ==================

            // 1. Pega os metadados do grupo (que inclui a lista de participantes)
            const groupMetadata = await sock.groupMetadata(id);
            const participants = groupMetadata.participants.map(p => p.id);

            // 2. Define o texto do aviso
            let text = '';
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (quotedMsg) {
                // PRIORIDADE 1: Usa o conteúdo da mensagem respondida (incluindo legendas de mídias)
                text = quotedMsg.conversation || 
                       quotedMsg.extendedTextMessage?.text || 
                       quotedMsg.imageMessage?.caption || 
                       quotedMsg.videoMessage?.caption || 
                       '';
            } else {
                // PRIORIDADE 2: Usa o texto fornecido junto com o comando (Ex: /tagall Reunião hoje)
                text = args.join(' ');
            }
            
            text = text.trim();

            // 3. Validação: Verifica se, após as tentativas, existe um texto para enviar
            if (!text) {
                const errorMessage = '❌ *Nenhum texto para o aviso.*\n\n' +
                                     'Você pode usar o comando de duas formas:\n\n' +
                                     '1️⃣ *Respondendo a uma mensagem:*\n' +
                                     '   O texto (ou legenda da mídia) será usado no aviso.\n\n' +
                                     '2️⃣ *Escrevendo na mesma mensagem:*\n' +
                                     '   Ex: `/tagall Reunião importante amanhã!`';
                
                return sock.sendMessage(id, { text: errorMessage }, { quoted: msg });
            }

            // 4. Envia a mensagem final com a menção para todos os participantes
            await sock.sendMessage(id, {
                text: text,
                mentions: participants
            }, { quoted: msg }); // Responde à mensagem original para dar contexto

        } catch (e) {
            console.error("Erro no comando /tagall:", e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao tentar marcar todos os membros.' });
        }
    }
};