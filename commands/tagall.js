// commands/tagall.js

module.exports = {
    name: 'tagall',
    description: '📢 (Admin do Bot) Marca todos os membros do grupo em um aviso.',
    aliases: ['everyone', 'marcartodos'],

    /**
     * @param {object} context - O objeto de contexto fornecido pelo handler de comandos.
     * @param {import('@whiskeysockets/baileys').WASocket} context.sock - A instância do socket Baileys.
     * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} context.msg - O objeto da mensagem.
     * @param {boolean} context.isGroup - Verdadeiro se a mensagem foi enviada em um grupo.
     * @param {boolean} context.isBotAdmin - Verdadeiro se o remetente é um admin do bot.
     */
    async execute({ sock, msg, isGroup, isBotAdmin }) {
        const id = msg.key.remoteJid;

        // ================== VERIFICAÇÕES INICIAIS ==================
        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });
        }

        // Verifica se o comando foi enviado em resposta a uma mensagem
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            return sock.sendMessage(id, { text: 'Você precisa responder a uma mensagem para usar este comando. O texto da mensagem respondida será usado no aviso.' });
        }
        
        try {
            // ================== LÓGICA DO COMANDO ==================

            // 1. Pega os metadados do grupo (que inclui a lista de participantes)
            const groupMetadata = await sock.groupMetadata(id);
            
            // 2. Extrai apenas o ID (JID) de cada participante
            const participants = groupMetadata.participants.map(p => p.id);

            // 3. Extrai o texto da mensagem que foi respondida
            const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || '';

            if (!text) {
                return sock.sendMessage(id, { text: 'A mensagem respondida não contém texto para ser usado no aviso.' });
            }

            // 4. Envia a mensagem de texto com a menção para todos os participantes
            await sock.sendMessage(id, {
                text: text, // O texto da mensagem respondida
                mentions: participants // A lista com o ID de todos para notificar
            });

        } catch (e) {
            console.error("Erro no comando /tagall:", e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao tentar marcar todos os membros.' });
        }
    }
};