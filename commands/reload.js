// commands/reload.js

module.exports = {
    name: 'reload',
    description: '🔄 (Dono) Recarrega todos os arquivos de comando.',
    aliases: ['rl'],

    /**
     * @param {object} context - O objeto de contexto.
     * @param {boolean} context.isOwner - Verdadeiro se o remetente é o dono do bot.
     * @param {() => void} context.loadCommands - A função para recarregar os comandos.
     */
    async execute({ sock, msg, isOwner, loadCommands }) {
        const id = msg.key.remoteJid;

        // Apenas o dono do bot pode usar este comando
        if (!isOwner) {
            return sock.sendMessage(id, { text: 'Este comando é restrito ao Dono do Bot.' });
        }

        try {
            // Executa a função que foi passada pelo index.js
            loadCommands();
            await sock.sendMessage(id, { text: '✅ Todos os comandos foram recarregados com sucesso!' }, { quoted: msg });
        } catch (e) {
            console.error("Erro ao recarregar comandos:", e);
            await sock.sendMessage(id, { text: '❌ Ocorreu um erro ao tentar recarregar os comandos.' }, { quoted: msg });
        }
    }
};