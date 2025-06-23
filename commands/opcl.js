module.exports = {
    name: 'opcl',
    description: 'Abre ou fecha o grupo para mensagens de não-admins.',
    aliases: ['group', 'grupo'],

    async execute({ sock, msg, isGroup, sender }) {
        const id = msg.key.remoteJid;

        // 1. Verifica se o comando foi usado em um grupo
        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' }, { quoted: msg });
        }

        try {
            // 2. Pega os metadados do grupo para verificar permissões
            const metadata = await sock.groupMetadata(id);
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

            // --- CORREÇÃO APLICADA AQUI ---
            // Em vez de usar .includes(), apenas checamos a existência da propriedade 'admin'.
            // Se o participante não for admin, a propriedade será 'null', o que resultará em 'false' na verificação.
            const senderIsAdmin = metadata.participants.find(p => p.id === sender)?.admin;
            const botIsAdmin = metadata.participants.find(p => p.id === botId)?.admin;

            // 3. Verifica se o remetente é admin
            if (!senderIsAdmin) {
                return sock.sendMessage(id, { text: 'Apenas administradores do grupo podem usar este comando.' }, { quoted: msg });
            }

            // 4. Verifica se o BOT é admin
            if (!botIsAdmin) {
                return sock.sendMessage(id, { text: 'Eu preciso ser administrador para poder abrir ou fechar o grupo.' }, { quoted: msg });
            }

            // 5. Verifica o estado atual do grupo e inverte
            if (metadata.announce) {
                // Se estiver fechado (announce = true), abre o grupo
                await sock.groupSettingUpdate(id, 'not_announcement');
                await sock.sendMessage(id, { text: '🔓 Grupo aberto! Todos os participantes podem enviar mensagens.' }, { quoted: msg });
            } else {
                // Se estiver aberto (announce = false), fecha o grupo
                await sock.groupSettingUpdate(id, 'announcement');
                await sock.sendMessage(id, { text: '🔒 Grupo fechado! Apenas administradores podem enviar mensagens agora.' }, { quoted: msg });
            }

        } catch (error) {
            console.error('Erro ao abrir/fechar o grupo:', error);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao tentar alterar as configurações do grupo.' }, { quoted: msg });
        }
    }
};