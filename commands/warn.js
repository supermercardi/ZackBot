// commands/config.js

/**
 * Mapeamento das chaves de configuração amigáveis para as colunas do banco de dados
 * e o tipo de dado esperado para validação.
 */
const configMap = {
    // Chave amigável: [Coluna no DB, Tipo de Dado, Descrição]
    'antilink': ['antilink_enabled', 'boolean', 'Ativa ou desativa o anti-link.'],
    'welcome': ['welcome_enabled', 'boolean', 'Ativa ou desativa as boas-vindas.'],
    'farewell': ['farewell_enabled', 'boolean', 'Ativa ou desativa as mensagens de adeus.'],
    'welcomemsg': ['welcome_message', 'text', 'Define a mensagem de boas-vindas. Use @user para marcar.'],
    'farewellmsg': ['farewell_message', 'text', 'Define a mensagem de adeus. Use @user para marcar.'],
    'warnlimit': ['warn_limit', 'number', 'Define o n° de advertências para banir um membro.'],
    'kickinadays': ['kickina_days', 'number', 'Define os dias de inatividade para o /kickina.']
};

module.exports = {
    name: 'config',
    description: 'Visualiza ou altera as configurações do bot para este grupo.',
    
    async execute({ sock, msg, args, isGroup, isBotAdmin, db, settings, invalidateSettingsCache }) {
        const id = msg.key.remoteJid;
        
        // Verifica se o comando foi usado em um grupo e se o usuário é um admin do bot
        if (!isGroup) return sock.sendMessage(id, { text: 'Este comando só pode ser usado em grupos.' });
        if (!isBotAdmin) return sock.sendMessage(id, { text: 'Apenas Admins do Bot podem usar este comando.' });

        const [key, ...valueParts] = args;

        // --- EXIBIR PAINEL DE CONFIGURAÇÕES ---
        // Se nenhuma chave for fornecida, mostra o estado atual de todas as configurações.
        if (!key) {
            let text = '⚙️ *Painel de Configurações do Grupo*\n\n';
            text += 'Use `/config <chave> <valor>` para alterar.\n\n';

            // Itera sobre o mapa de configurações para criar uma lista formatada.
            for (const [chave, configInfo] of Object.entries(configMap)) {
                const dbKey = configInfo[0];
                const description = configInfo[2];
                const currentValue = settings[dbKey];

                let status = currentValue;
                // Formata valores booleanos para ON/OFF para melhor visualização
                if (typeof currentValue === 'boolean') {
                    status = currentValue ? 'ON' : 'OFF';
                }

                text += `*• Chave:* \`${chave}\`\n`;
                text += `  └─ Valor Atual: \`${status}\`\n`;
                text += `  └─ Descrição: _${description}_\n\n`;
            }
            return sock.sendMessage(id, { text });
        }
        
        // --- ALTERAR UMA CONFIGURAÇÃO ---
        const lowerKey = key.toLowerCase();
        const configInfo = configMap[lowerKey];
        const value = valueParts.join(' ');

        // Verifica se a chave fornecida é válida
        if (!configInfo) {
            return sock.sendMessage(id, { text: `❌ Chave de configuração inválida. Válidas: \`${Object.keys(configMap).join('`, `')}\`` });
        }
        if (!value) {
            return sock.sendMessage(id, { text: `❌ Você precisa fornecer um valor para a chave \`${lowerKey}\`.` });
        }

        const [dbKey, type] = configInfo;
        let dbValue = value;

        // Valida e converte o valor de entrada de acordo com o tipo esperado
        if (type === 'boolean') {
            if (['on', 'ligar', 'true', '1'].includes(value.toLowerCase())) dbValue = 1; // 1 para true
            else if (['off', 'desligar', 'false', '0'].includes(value.toLowerCase())) dbValue = 0; // 0 para false
            else return sock.sendMessage(id, { text: 'Valor inválido para chave booleana. Use `on` ou `off`.' });
        }
        if (type === 'number') {
            dbValue = parseInt(value, 10);
            if (isNaN(dbValue) || dbValue < 1) return sock.sendMessage(id, { text: 'Valor inválido. Deve ser um número inteiro e maior que 0.' });
        }
        
        try {
            // Atualiza a configuração no banco de dados
            await db.updateGroupSetting(id, dbKey, dbValue);
            
            // ESSENCIAL: Limpa o cache para que a nova configuração seja lida na próxima vez.
            invalidateSettingsCache(); 
            
            await sock.sendMessage(id, { text: `✅ Configuração \`${lowerKey}\` atualizada com sucesso para \`${value}\`.` });
        } catch (e) {
            console.error("Erro ao atualizar configuração:", e);
            await sock.sendMessage(id, { text: 'Ocorreu um erro ao salvar a configuração.' });
        }
    }
};
