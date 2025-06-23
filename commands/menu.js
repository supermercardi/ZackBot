// commands/menu.js

const commandsData = require('../commands.json');

module.exports = {
    name: 'menu',
    description: 'Mostra os poderes que eu permito que você use.',
    aliases: ['help', 'ajuda', 'comandos'],

    async execute({ sock, msg }) {
        const id = msg.key.remoteJid;
        // Pega o nome do usuário, ou o chama de 'Ningen' (Humano, em japonês) se não tiver.
        const userName = msg.pushName || 'Ningen'; 

        // Agrupa os comandos por categoria para um menu mais organizado.
        const commandsByCategory = {};
        for (const cmd of commandsData) {
            if (!commandsByCategory[cmd.category]) {
                commandsByCategory[cmd.category] = [];
            }
            commandsByCategory[cmd.category].push(cmd);
        }

        // Monta a mensagem do menu com a nova personalidade.
        let menuText = `Hmph, ${userName}. Acha que pode me dar ordens?\n\nTsc. Já que insiste, estes são os jutsus que eu disponibilizo para você:\n\n`;

        // Itera sobre as categorias e depois sobre os comandos de cada uma.
        for (const category in commandsByCategory) {
            menuText += `*✦ ${category.toUpperCase()} ✦*\n\n`; // Título da categoria
            
            for (const cmd of commandsByCategory[category]) {
                menuText += `➡️ */${cmd.name}*\n`;
                menuText += `   _${cmd.description}_\n\n`;
            }
        }

        menuText += `------------------------------------\n`;
        menuText += `Use meu poder com sabedoria. Ou não, o problema é seu.`;

        // Envia a mensagem final.
        await sock.sendMessage(id, { text: menuText }, { quoted: msg });
    }
};