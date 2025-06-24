// commands/warnings.js
const { getTargetJid } = require('../utils');
const moment = require('moment-timezone'); // Instale: npm install moment-timezone

module.exports = {
    name: 'warnings',
    description: 'Verifica o histórico de advertências de um usuário.',
    aliases: ['advertencias', 'verwarns'],
    
    async execute({ sock, msg, isGroup, isBotAdmin, db }) {
        const id = msg.key.remoteJid;

        // Validações
        if (!isGroup) return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        if (!isBotAdmin) return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });

        const target = getTargetJid(msg);
        if (!target) return sock.sendMessage(id, { text: 'Você precisa marcar ou responder a um usuário para ver suas advertências.' });

        try {
            // Usa o 'db' para fazer uma query direta, já que esta função não existe no módulo
            const stmt = db.db.prepare('SELECT reason, created_at, issuer_jid FROM user_warnings WHERE group_jid = ? AND user_jid = ? ORDER BY created_at ASC');
            const warnings = stmt.all(id, target);

            if (warnings.length === 0) {
                return sock.sendMessage(id, {
                    text: `✅ O usuário @${target.split('@')[0]} não possui advertências.`,
                    mentions: [target]
                });
            }

            // Formata a lista de advertências
            let responseText = `📋 *Histórico de Advertências de @${target.split('@')[0]}* (${warnings.length} no total):\n\n`;
            
            for (let i = 0; i < warnings.length; i++) {
                const warn = warnings[i];
                const date = moment(warn.created_at).tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm');
                responseText += `*${i + 1}.* Motivo: _${warn.reason}_\n`;
                responseText += `   └─ Aplicada por @${warn.issuer_jid.split('@')[0]} em ${date}\n\n`;
            }

            // Monta a lista de menções para todos os envolvidos
            const mentions = [target, ...warnings.map(w => w.issuer_jid)];
            
            await sock.sendMessage(id, { text: responseText, mentions });
        } catch (e) {
            console.error('Erro no comando /warnings:', e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao buscar o histórico.' });
        }
    }
};
