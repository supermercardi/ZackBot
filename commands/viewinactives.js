// commands/viewinactives.js

module.exports = {
    name: 'viewinactives',
    description: 'Envia uma lista de membros inativos no privado do administrador.',
    aliases: ['inativos', 'viewinativos', 'fantasmas'], // Apelidos para facilitar o uso

    async execute({ sock, msg, sender, isGroup, isBotAdmin, db, settings }) {
        const id = msg.key.remoteJid;

        // 1. Verifica se o comando foi usado em um grupo e por um admin
        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: '❌ Apenas Admins do Bot podem usar este comando.' });
        }

        try {
            // Avisa no grupo que a verificação começou e o resultado será enviado no privado
            await sock.sendMessage(id, { text: `👻 Verificando membros inativos... A lista será enviada no seu privado.` });

            // 2. Pega o limite de dias de inatividade das configurações do grupo
            const inactiveDays = settings.kickina_days; // Valor vem da tabela group_settings

            // 3. Usa a nova função do db.js para buscar os usuários inativos
            const inactiveUsers = await db.getInactiveUsers(id, inactiveDays);

            // 4. Se não houver inativos, informa o admin no privado
            if (!inactiveUsers || inactiveUsers.length === 0) {
                return sock.sendMessage(sender, { text: `✅ Ótima notícia! Não há membros inativos há mais de ${inactiveDays} dias no grupo.` });
            }

            // 5. Monta a mensagem com a lista de inativos
            let messageText = `👻 *Lista de Membros Inativos*\n\n`;
            messageText += `Abaixo estão os ${inactiveUsers.length} membros que não enviam mensagens há mais de *${inactiveDays} dias*:\n\n`;

            const mentions = [];
            inactiveUsers.forEach((user, index) => {
                const userJid = user.user_jid;
                mentions.push(userJid);
                messageText += `${index + 1}. @${userJid.split('@')[0]}\n`;
            });

            messageText += `\nPara remover inativos, um administrador do grupo pode usar o comando de remoção (se disponível).`;
            
            // 6. Envia a lista formatada para o privado (DM) do admin que solicitou
            await sock.sendMessage(sender, { 
                text: messageText, 
                mentions: mentions // 'mentions' faz o WhatsApp marcar os usuários corretamente
            });

        } catch (error) {
            console.error('Erro ao executar /viewinactives:', error);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao buscar a lista de inativos.' });
        }
    }
};