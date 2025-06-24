// commands/authgroup.js

const chalk = require('chalk');

module.exports = {
  name: 'authgroup',
  aliases: ['autorizar'],
  description: 'Autoriza o grupo atual a usar as funções do bot e gera um token de acesso.',
  
  /**
   * Executa o comando para autorizar um grupo.
   * @param {import('../index').GroupExecHook} options
   */
  async execute({ sock, msg, isGroup, sender, isOwner, db, invalidateSettingsCache }) {
    const commandName = 'authgroup';
    const groupId = msg.key.remoteJid;

    // =================================================================
    // 1. VERIFICAÇÕES INICIAIS
    // =================================================================

    // Checa se o comando foi usado em um grupo. Essencial para o funcionamento.
    if (!isGroup) {
      console.log(chalk.yellow(`[DEBUG][${commandName}] Tentativa de uso fora de um grupo por ${sender}.`));
      return sock.sendMessage(sender, { text: '⚠️ Este comando só pode ser executado dentro de um grupo.' });
    }

    // Apenas o proprietário do bot (definido no .env) pode autorizar novos grupos.
    if (!isOwner) {
      console.log(chalk.red(`[FAIL][${commandName}] Tentativa de uso não autorizada por ${sender} no grupo ${groupId}.`));
      return sock.sendMessage(groupId, { text: '❌ Apenas o Dono do Bot pode executar este comando.' }, { quoted: msg });
    }

    // =================================================================
    // 2. VERIFICAÇÃO DE STATUS DE AUTORIZAÇÃO
    // =================================================================

    // Verifica se o grupo já foi autorizado anteriormente para evitar duplicidade.
    if (db.isGroupAuthorized(groupId)) {
      console.log(chalk.blue(`[INFO][${commandName}] Grupo ${groupId} já está autorizado.`));
      const text = `Este grupo já está autorizado.\n\nPara ver informações da autorização e do token, use o comando \`/groupinfo\`.`;
      return sock.sendMessage(groupId, { text }, { quoted: msg });
    }

    // =================================================================
    // 3. EXECUÇÃO DA AUTORIZAÇÃO
    // =================================================================
    try {
      console.log(chalk.yellow(`[EXEC][${commandName}] Autorizando o grupo ${groupId} a pedido de ${sender}...`));

      // Chama a função do banco de dados para autorizar o grupo.
      // A função agora retorna o token de acesso gerado.
      const accessToken = db.authorizeGroup(groupId, sender);
      
      // Invalida o cache de configurações para que as novas configurações padrão sejam carregadas.
      invalidateSettingsCache();

      // Log de sucesso no console para depuração.
      console.log(chalk.greenBright(`[SUCCESS][${commandName}] Grupo ${groupId} autorizado. Token: ${accessToken}`));

      // -------------------------------------------------
      // MENSAGEM PÚBLICA (para o grupo)
      // -------------------------------------------------
      const groupMessage = `✅ *Grupo Autorizado com Sucesso!* 🎉\n\nEste grupo agora tem acesso às minhas funcionalidades.\n\nO usuário @${sender.split('@')[0]} foi definido como o primeiro administrador do bot aqui.\n\nPara começar, digite \`/menu\` para ver a lista de comandos.`;
      
      await sock.sendMessage(groupId, { 
        text: groupMessage,
        mentions: [sender] // Marca o usuário que se tornou admin.
      });

      // -------------------------------------------------
      // MENSAGEM PRIVADA (para o dono do bot)
      // -------------------------------------------------
      // Envia o token de acesso de forma segura e privada para o dono do bot.
      const privateMessage = `🔐 *Seu Token de Acesso Confidencial*\n\nOlá! O grupo que você acabou de autorizar tem o seguinte token de acesso:\n\n*Token:* \`\`\`${accessToken}\`\`\`\n\n*Atenção:* Este token é como uma senha. **Não compartilhe com ninguém.** Ele será usado para integrar o bot com sistemas externos, como um painel web.\n\nGuarde-o em um local seguro! Se precisar, você pode usar o comando \`/groupinfo\` no grupo para que eu envie o token novamente para você no privado.`;

      await sock.sendMessage(sender, { text: privateMessage });

    } catch (error) {
      // Em caso de falha, registra o erro detalhado no console.
      console.error(chalk.red.bold(`[CRITICAL_ERROR][${commandName}] Falha catastrófica ao autorizar o grupo ${groupId}:`), error);
      
      // Envia uma mensagem de erro genérica ao usuário.
      await sock.sendMessage(groupId, { text: '❌ Ocorreu um erro crítico ao tentar autorizar o grupo. Por favor, verifique os logs do console.' }, { quoted: msg });
    }
  }
}
