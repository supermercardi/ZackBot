// commands/mute.js
const { getTargetJid } = require('../utils');

/**
 * Converte uma string de tempo (ex: '10m', '1h', '2d') em minutos.
 * @param {string} timeString - A string de tempo.
 * @returns {number|null} - A duração em minutos ou nulo se inválido.
 */
function parseDuration(timeString) {
    const match = timeString.match(/^(\d+)(m|h|d)$/); // 'm' for minutes, 'h' for hours, 'd' for days
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 'm': return value;
        case 'h': return value * 60;
        case 'd': return value * 60 * 24;
        default: return null;
    }
}

module.exports = {
    name: 'mute',
    description: 'Silencia um usuário por um tempo determinado (ex: 10m, 1h, 1d).',
    aliases: ['silenciar'],
    
    async execute({ sock, msg, args, isGroup, isBotAdmin, db, ownerJid }) {
        const id = msg.key.remoteJid;

        if (!isGroup || !isBotAdmin) return;

        const target = getTargetJid(msg);
        if (!target) return sock.sendMessage(id, { text: 'Você precisa marcar ou responder a um usuário para silenciar.' });
        
        const targetIsBotAdmin = await db.isUserBotAdmin(id, target);
        if (targetIsBotAdmin || target === ownerJid) {
            return sock.sendMessage(id, { text: 'Você não pode silenciar um Admin do Bot ou o Dono.' });
        }
        
        const durationString = args.find(arg => arg.match(/^(\d+)(m|h|d)$/));
        if (!durationString) {
            return sock.sendMessage(id, { text: 'Formato de tempo inválido. Use, por exemplo: `10m`, `2h`, `1d`.' });
        }

        const durationInMinutes = parseDuration(durationString);

        try {
            db.muteUser(id, target, durationInMinutes);
            await sock.sendMessage(id, {
                text: `🔇 O usuário @${target.split('@')[0]} foi silenciado por ${durationString}.`,
                mentions: [target]
            });
        } catch (e) {
            console.error('Erro no /mute:', e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao aplicar o silêncio.' });
        }
    }
};
