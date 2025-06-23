// commands/promote.js
const { getTargetJid } = require('../utils'); // Importa a função auxiliar

module.exports = {
    name: 'promover',
    description: 'Promove um usuário a Admin do Bot no grupo.',
    aliases: ['promote'],

    /**
     * @param {object} context - O objeto de contexto fornecido pelo handler de comandos.
     * @param {import('@whiskeysockets/baileys').WASocket} context.sock - A instância do socket Baileys.
     * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} context.msg - O objeto da mensagem.
     * @param {boolean} context.isGroup - Verdadeiro se a mensagem foi enviada em um grupo.
     * @param {boolean} context.isBotAdmin - Verdadeiro se o remetente é um admin do bot.
     * @param {object} context.config - O objeto de configuração carregado do config.json.
     * @param {() => void} context.saveConfig - A função para salvar as alterações no config.json.
     */
    async execute({ sock, msg, isGroup, isBotAdmin, config, saveConfig }) {
        const id = msg.key.remoteJid;

        // ================== VERIFICAÇÕES INICIAIS ==================
        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });
        }

        // ================== IDENTIFICAÇÃO DO ALVO ==================
        // Usa a função auxiliar para obter o alvo da forma mais limpa possível.
        const target = getTargetJid(msg);

        if (!target) {
            return sock.sendMessage(id, { text: 'Você precisa mencionar um usuário com @ ou responder à mensagem de alguém para promovê-lo.' });
        }

        // ================== LÓGICA DO COMANDO ==================
        // Verifica se o usuário já é um admin do bot para evitar duplicação.
        // A '?' (optional chaining) previne erros caso o grupo não esteja no config por algum motivo.
        if (config.groups[id]?.admins.includes(target)) {
            return sock.sendMessage(id, { text: 'Este usuário já é um Admin do Bot.' });
        }

        // Adiciona o alvo à lista de admins do grupo em memória.
        config.groups[id].admins.push(target);
        
        // Salva as alterações no arquivo config.json.
        saveConfig();

        // Envia a mensagem de sucesso, mencionando o novo admin.
        await sock.sendMessage(id, { 
            text: `✅ O usuário @${target.split('@')[0]} foi promovido a Admin do Bot!`,
            mentions: [target] 
        });
    }
};