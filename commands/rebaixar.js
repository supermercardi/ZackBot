// commands/rebaixar.js
const { getTargetJid } = require('../utils');

module.exports = {
    name: 'rebaixar',
    description: 'Remove os privilégios de Admin do Bot de um usuário.',
    aliases: ['unpromote'],

    async execute({ sock, msg, isGroup, isBotAdmin, config, saveConfig }) {
        const id = msg.key.remoteJid;

        if (!isGroup) return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        if (!isBotAdmin) return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });

        const target = getTargetJid(msg);

        if (!target) {
            return sock.sendMessage(id, { text: 'Você precisa mencionar um usuário ou responder à mensagem de alguém para rebaixá-lo.' });
        }
        
        if (target === config.ownerJid) {
            return sock.sendMessage(id, { text: 'Você não pode rebaixar o Dono do bot.' });
        }

        const adminIndex = config.groups[id].admins.indexOf(target);
        if (adminIndex === -1) {
            return sock.sendMessage(id, { text: 'Este usuário não é um Admin do Bot.' });
        }

        config.groups[id].admins.splice(adminIndex, 1);
        saveConfig();

        await sock.sendMessage(id, { 
            text: `👎 O usuário @${target.split('@')[0]} não é mais um Admin do Bot.`,
            mentions: [target] 
        });
    }
};