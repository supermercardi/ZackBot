// commands/unmute.js
const { getTargetJid } = require('../utils');

module.exports = {
    name: 'unmute',
    description: 'Remove o silêncio de um usuário.',
    aliases: ['dessilenciar', 'falar'],
    
    async execute({ sock, msg, isGroup, isBotAdmin, db }) {
        const id = msg.key.remoteJid;

        if (!isGroup || !isBotAdmin) return;

        const target = getTargetJid(msg);
        if (!target) return sock.sendMessage(id, { text: 'Você precisa marcar ou responder a um usuário para remover o silêncio.' });
        
        try {
            // Verifica se o usuário estava realmente silenciado antes
            if (!db.isUserMuted(id, target)) {
                return sock.sendMessage(id, {
                    text: `O usuário @${target.split('@')[0]} não estava silenciado.`,
                    mentions: [target]
                });
            }

            db.unmuteUser(id, target);

            await sock.sendMessage(id, {
                text: `🔊 O usuário @${target.split('@')[0]} foi dessilenciado e pode falar novamente.`,
                mentions: [target]
            });

        } catch (e) {
            console.error('Erro no comando /unmute:', e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao remover o silêncio.' });
        }
    }
};
