// commands/config.js

/**
 * Mapeamento das chaves de configuração amigáveis para as colunas exatas do banco de dados (de db.js),
 * o tipo de dado esperado para validação e uma descrição clara para o usuário.
 * Este mapa reflete a estrutura da tabela 'group_settings' em seu db.js.
 */
const configMap = {
    // Chave Amigável: [Coluna no DB, Tipo de Dado, Descrição]
    'antilink': ['antilink_enabled', 'boolean', 'Ativa ou desativa a remoção de links.'],
    'welcome': ['welcome_enabled', 'boolean', 'Ativa ou desativa as boas-vindas.'],
    'farewell': ['farewell_enabled', 'boolean', 'Ativa ou desativa as mensagens de adeus.'],
    'welcomemsg': ['welcome_message', 'text', 'Define a mensagem de boas-vindas. Use @user para marcar.'],
    'farewellmsg': ['farewell_message', 'text', 'Define a mensagem de adeus. Use @user para marcar.'],
    'warnlimit': ['warn_limit', 'number', 'Define o nº de advertências para banir um membro.'],
    'kickinadays': ['kickina_days', 'number', 'Define os dias de inatividade para o comando /kickina.']
};

module.exports = {
    name: 'config',
    description: 'Visualiza ou altera as configurações do bot para este grupo.',
    aliases: ['settings', 'configurar', 'conf'],
    
    async execute({ sock, msg, args, isGroup, sender, isBotAdmin, db, settings, invalidateSettingsCache }) {
        const id = msg.key.remoteJid;
        
        // --- 1. VERIFICAÇÕES DE PERMISSÃO ---
        // Garante que o comando só seja usado em grupos e por administradores do bot.
        if (!isGroup) {
            return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        }
        if (!isBotAdmin) {
            return sock.sendMessage(id, { text: '❌ Apenas Admins do Bot podem usar este comando.' });
        }

        const [key, ...valueParts] = args;
        const value = valueParts.join(' ');

        // --- 2. MODO VISUALIZAÇÃO (PAINEL NO PRIVADO) ---
        // Se nenhuma chave for fornecida, exibe o painel de configurações no privado do admin.
        if (!key) {
            // Avisa no grupo que o painel foi enviado no privado para não poluir o chat.
            await sock.sendMessage(id, { text: `⚙️ Olá, admin! Enviei o painel de configurações no seu privado para facilitar a visualização e alteração.` });

            let panelText = '⚙️ *Painel de Configurações do Grupo*\n\n';
            panelText += 'Aqui você pode ver e alterar as configurações do bot. Para alterar, use o comando correspondente.\n\n';

            // Itera sobre o mapa para construir a mensagem do painel de forma organizada
            for (const [chave, configInfo] of Object.entries(configMap)) {
                const [dbKey, type, description] = configInfo;
                // 'settings' é o objeto com os valores atuais, passado pelo index.js
                const currentValue = settings[dbKey];
                let displayValue = currentValue;

                // Formata os valores para uma melhor experiência de usuário
                if (type === 'boolean') {
                    displayValue = currentValue ? 'ON' : 'OFF';
                }
                if (type === 'text' && displayValue.length > 40) {
                    displayValue = displayValue.substring(0, 40) + '...';
                }

                panelText += `*• Chave:* \`${chave}\`\n`;
                panelText += `  ├─ Status Atual: \`${displayValue}\`\n`;
                panelText += `  ├─ Descrição: _${description}_\n`;
                panelText += `  └─ Exemplo: \`/config ${chave} ${type === 'boolean' ? (currentValue ? 'off' : 'on') : '<novo_valor>'}\`\n\n`;
            }
            
            // 'sender' é o JID do usuário que executou o comando, passado pelo index.js
            return sock.sendMessage(sender, { text: panelText });
        }
        
        // --- 3. MODO ALTERAÇÃO ---
        // Lógica para alterar uma configuração específica.
        const lowerKey = key.toLowerCase();
        const configInfo = configMap[lowerKey];

        if (!configInfo) {
            return sock.sendMessage(id, { text: `❌ Chave de configuração inválida. As chaves válidas são: \`${Object.keys(configMap).join('`, `')}\`` });
        }
        if (!value) {
            return sock.sendMessage(id, { text: `❌ Você precisa fornecer um valor para a chave \`${lowerKey}\`. Ex: /config ${lowerKey} on` });
        }

        const [dbKey, type] = configInfo;
        let dbValue = value;

        // Valida e converte o valor de entrada de acordo com o tipo esperado.
        if (type === 'boolean') {
            if (['on', 'ligar', 'true', '1'].includes(value.toLowerCase())) {
                dbValue = 1; // SQLite usa 1 para TRUE
            } else if (['off', 'desligar', 'false', '0'].includes(value.toLowerCase())) {
                dbValue = 0; // SQLite usa 0 para FALSE
            } else {
                return sock.sendMessage(id, { text: 'Valor inválido para chave booleana. Use `on` ou `off`.' });
            }
        }
        if (type === 'number') {
            dbValue = parseInt(value, 10);
            if (isNaN(dbValue) || dbValue < 1) {
                return sock.sendMessage(id, { text: 'Valor inválido. Deve ser um número inteiro e maior que 0.' });
            }
        }
        
        try {
            // Usa a função 'updateGroupSetting' do seu db.js para salvar a alteração.
            await db.updateGroupSetting(id, dbKey, dbValue);
            
            // ESSENCIAL: Limpa o cache para que a nova configuração seja lida na próxima vez.
            // Esta função é passada diretamente pelo index.js.
            invalidateSettingsCache(); 
            
            await sock.sendMessage(id, { text: `✅ Configuração \`${lowerKey}\` atualizada com sucesso para \`${value}\`.` });
        } catch (e) {
            console.error("Erro ao atualizar configuração:", e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao salvar a configuração. Verifique os logs do console.' });
        }
    }
};