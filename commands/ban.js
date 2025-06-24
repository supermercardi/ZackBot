// commands/ban.js
const { getTargetJid } = require('../utils'); // Corretamente usando o arquivo de utilitários

module.exports = {
    name: 'ban',
    description: 'Bane um usuário do grupo por menção ou respondendo à mensagem.',
    aliases: ['kick', 'remover'],

    /**
     * @param {object} context
     * @param {boolean} context.isBotAdmin - Verdadeiro se o remetente é um admin do bot.
     * @param {object} context.db - O módulo do banco de dados.
     * @param {string} context.ownerJid - O JID do dono do bot.
     */
    async execute({ sock, msg, isGroup, isBotAdmin, db, ownerJid }) {
        const id = msg.key.remoteJid;

        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });
        }

        const target = getTargetJid(msg);

        if (!target) {
            return sock.sendMessage(id, { text: 'Você precisa mencionar um usuário com @ ou responder à mensagem de alguém para banir.' });
        }

        // Impede que o bot se bane
        if (target === sock.user.id.split(':')[0] + '@s.whatsapp.net') {
            return sock.sendMessage(id, { text: 'Eu não posso me banir... 😅' });
        }

        // Impede que um admin do bot tente banir outro ou o dono
        const targetIsBotAdmin = await db.isUserBotAdmin(id, target);
        if (targetIsBotAdmin || target === ownerJid) {
            return sock.sendMessage(id, { text: 'Você não pode banir outro Admin do Bot ou o Dono.' });
        }

        try {
            await sock.groupParticipantsUpdate(id, [target], 'remove');
            await sock.sendMessage(id, {
                text: `⛔ O usuário @${target.split('@')[0]} foi banido do grupo.`,
                mentions: [target]
            });
        } catch (e) {
            console.error("Erro ao banir:", e);
            await sock.sendMessage(id, { text: 'Não foi possível banir o usuário. Verifique se sou admin do grupo e se o alvo não é o criador do grupo.' });
        }
    }
};