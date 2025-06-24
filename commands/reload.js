// commands/reload.js

const path = require('path');

module.exports = {
    name: 'reload',
    description: '🔄 (Dono) Recarrega um ou todos os comandos do bot.',
    aliases: ['rl'],

    async execute({ sock, msg, args, isOwner, loadCommands }) {
        const id = msg.key.remoteJid;

        if (!isOwner) {
            return sock.sendMessage(id, { text: 'Este comando é restrito ao Dono do Bot.' });
        }

        // --- MODO 1: RECARREGAR TODOS OS COMANDOS ---
        if (args.length === 0) {
            try {
                // Executa a função aprimorada que retorna um relatório
                const result = loadCommands();
                
                let responseText = `🔄 *Relatório de Recarregamento Global* 🔄\n\n`;
                responseText += `✅ *Sucesso:* ${result.loadedCount} comandos foram recarregados.\n`;
                
                if (result.failedCount > 0) {
                    responseText += `❌ *Falhas:* ${result.failedCount} comandos não puderam ser carregados.\n\n`;
                    responseText += `*Arquivos com Erro:*\n`;
                    result.failedFiles.forEach(item => {
                        responseText += `• \`${item.file}\`\n  └─ _Motivo: ${item.error}_\n`;
                    });
                } else {
                    responseText += `\nNenhum erro encontrado. Tudo certo! ✨`;
                }

                return sock.sendMessage(id, { text: responseText });

            } catch (e) {
                console.error("Erro CRÍTICO no processo de reload:", e);
                return sock.sendMessage(id, { text: '❌ Ocorreu um erro crítico ao tentar recarregar os comandos.' });
            }
        }

        // --- MODO 2: RECARREGAR UM COMANDO ESPECÍFICO ---
        const commandName = args[0].toLowerCase();
        const commandToReload = Array.from(commands.values()).find(cmd => cmd.name === commandName || (cmd.aliases && cmd.aliases.includes(commandName)));

        if (!commandToReload) {
            return sock.sendMessage(id, { text: `⚠️ Comando \`/${commandName}\` não encontrado. Não foi possível recarregar.` });
        }
        
        // Assume que todos os arquivos de comando estão na pasta 'commands' e têm o nome da chave 'name'
        const commandPath = path.join(__dirname, `${commandToReload.name}.js`);
        
        try {
            // Limpa o cache do módulo específico
            delete require.cache[require.resolve(commandPath)];
            // Recarrega o módulo
            const newCommand = require(commandPath);

            // Atualiza o comando e seus apelidos no mapa de comandos
            commands.set(newCommand.name, newCommand);
            if (newCommand.aliases) {
                newCommand.aliases.forEach(alias => commands.set(alias, newCommand));
            }

            await sock.sendMessage(id, { text: `✅ O comando \`/${commandToReload.name}\` foi recarregado com sucesso!` });
        } catch (error) {
            console.error(`Erro ao recarregar o comando ${commandName}:`, error);
            await sock.sendMessage(id, { text: `❌ Ocorreu um erro ao recarregar o comando \`/${commandName}\`:\n\n_${error.message}_` });
        }
    }
};