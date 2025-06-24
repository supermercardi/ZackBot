// commands/promote.js

// Supondo que você tenha um arquivo utils.js para essa função
// Se não tiver, a lógica para pegar o alvo pode ser colocada aqui diretamente
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
    name: 'promover',
    description: 'Promove um usuário a Admin do Bot no grupo.',
    aliases: ['promote'],

    /**
     * @param {object} context
     * @param {boolean} context.isBotAdmin - Verdadeiro se o remetente é um admin do bot.
     * @param {object} context.db - O módulo do banco de dados.
     */
    async execute({ sock, msg, isGroup, isBotAdmin, db }) {
        const id = msg.key.remoteJid;

        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });
        }

        const target = getTargetJid(msg);

        if (!target) {
            return sock.sendMessage(id, { text: 'Você precisa mencionar um usuário com @ ou responder à mensagem de alguém para promovê-lo.' });
        }
        
        const targetIsAlreadyAdmin = await db.isUserBotAdmin(id, target);
        if (targetIsAlreadyAdmin) {
            return sock.sendMessage(id, { text: 'Este usuário já é um Admin do Bot.' });
        }

        try {
            await db.addBotAdmin(id, target);
            await sock.sendMessage(id, { 
                text: `✅ O usuário @${target.split('@')[0]} foi promovido a Admin do Bot!`,
                mentions: [target] 
            });
        } catch(e) {
            console.error("Erro ao promover usuário:", e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao salvar a promoção no banco de dados.' });
        }
    }
};