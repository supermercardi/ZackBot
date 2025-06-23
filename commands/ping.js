// commands/ping.js
module.exports = {
    name: 'ping',
    description: 'Verifica se o bot está online e responde com Pong.',
    aliases: ['p'], // Apelido para o comando, pode ser chamado com /p

    async execute({ sock, msg }) {
        const id = msg.key.remoteJid;
        await sock.sendMessage(id, { text: 'Pong! 🏓' }, { quoted: msg });
    }
};