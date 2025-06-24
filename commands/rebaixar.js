// commands/rebaixar.js

// Supondo que você tenha um arquivo utils.js para essa função
const getTargetJid = (msg) => {
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        return msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
    }
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        return msg.message.extendedTextMessage.contextInfo.participant;
    }
    return null;
};

module.exports = {
    name: 'rebaixar',
    description: 'Remove os privilégios de Admin do Bot de um usuário.',
    aliases: ['unpromote'],

    /**
     * @param {object} context
     * @param {boolean} context.isBotAdmin - Verdadeiro se o remetente é um admin do bot.
     * @param {object} context.db - O módulo do banco de dados.
     * @param {string} context.ownerJid - O JID do dono do bot.
     */
    async execute({ sock, msg, isGroup, isBotAdmin, db, ownerJid }) {
        const id = msg.key.remoteJid;

        if (!isGroup) return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        if (!isBotAdmin) return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });

        const target = getTargetJid(msg);

        if (!target) {
            return sock.sendMessage(id, { text: 'Você precisa mencionar um usuário ou responder à mensagem de alguém para rebaixá-lo.' });
        }
        
        if (target === ownerJid) {
            return sock.sendMessage(id, { text: 'Você não pode rebaixar o Dono do bot.' });
        }

        const targetIsAdmin = await db.isUserBotAdmin(id, target);
        if (!targetIsAdmin) {
            return sock.sendMessage(id, { text: 'Este usuário não é um Admin do Bot.' });
        }

        try {
            await db.removeBotAdmin(id, target);
            await sock.sendMessage(id, { 
                text: `👎 O usuário @${target.split('@')[0]} não é mais um Admin do Bot.`,
                mentions: [target] 
            });
        } catch(e) {
            console.error("Erro ao rebaixar usuário:", e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao remover a permissão no banco de dados.' });
        }
    }
};