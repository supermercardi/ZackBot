// commands/groupinfo.js

const chalk = require('chalk');

module.exports = {
  name: 'groupinfo',
  aliases: ['infogrupo', 'authinfo'],
  description: 'Mostra o status de autorização do grupo e envia o token de acesso no privado.',
  
  /**
   * Executa o comando para verificar as informações do grupo.
   * @param {import('../index').GroupExecHook} options
   */
  async execute({ sock, msg, isGroup, sender, isBotAdmin, db }) {
    const commandName = 'groupinfo';
    const groupId = msg.key.remoteJid;

    // =================================================================
    // 1. VERIFICAÇÕES INICIAIS
    // =================================================================

    if (!isGroup) {
      console.log(chalk.yellow(`[DEBUG][${commandName}] Tentativa de uso fora de um grupo por ${sender}.`));
      return sock.sendMessage(sender, { text: '⚠️ Este comando só pode ser executado dentro de um grupo.' });
    }

    // Apenas administradores do bot (ou o dono) podem ver esta informação.
    if (!isBotAdmin) {
      console.log(chalk.red(`[FAIL][${commandName}] Tentativa de uso não autorizada por ${sender} no grupo ${groupId}.`));
      return sock.sendMessage(groupId, { text: '❌ Você não tem permissão para usar este comando.' }, { quoted: msg });
    }

    // =================================================================
    // 2. VERIFICAÇÃO E EXIBIÇÃO DAS INFORMAÇÕES
    // =================================================================

    try {
      // Busca as informações de autorização no banco de dados.
      const authInfo = db.getGroupAuthInfo(groupId);

      if (!authInfo) {
        console.log(chalk.blue(`[INFO][${commandName}] Grupo ${groupId} não está autorizado.`));
        return sock.sendMessage(groupId, { text: 'ℹ️ Este grupo ainda não foi autorizado a usar o bot. Use `/authgroup` para autorizar.' }, { quoted: msg });
      }

      console.log(chalk.green(`[SUCCESS][${commandName}] Informações do grupo ${groupId} solicitadas por ${sender}.`));

      // -------------------------------------------------
      // MENSAGEM PÚBLICA (informativa)
      // -------------------------------------------------
      const authorizedByJid = authInfo.authorized_by;
      const authorizedAt = new Date(authInfo.authorized_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      
      const groupMessage = `✅ *Status do Grupo: Autorizado*\n\nFui autorizado neste grupo por @${authorizedByJid.split('@')[0]} em ${authorizedAt}.\n\n_Estou enviando o token de acesso confidencial para @${sender.split('@')[0]} no privado..._`;

      await sock.sendMessage(groupId, {
        text: groupMessage,
        mentions: [authorizedByJid, sender]
      });
      
      // -------------------------------------------------
      // MENSAGEM PRIVADA (com o token)
      // -------------------------------------------------
      const privateMessage = `🔐 *Token de Acesso para o Grupo*\n\nConforme solicitado, aqui está o token de acesso:\n\n*Token:* \`\`\`${authInfo.access_token}\`\`\`\n\n*Lembrete:* Mantenha este token seguro e não o compartilhe.`;

      await sock.sendMessage(sender, { text: privateMessage });

    } catch (error) {
      console.error(chalk.red.bold(`[CRITICAL_ERROR][${commandName}] Falha ao buscar informações do grupo ${groupId}:`), error);
      await sock.sendMessage(groupId, { text: '❌ Ocorreu um erro crítico ao buscar as informações do grupo. Verifique os logs.' }, { quoted: msg });
    }
  }
}
