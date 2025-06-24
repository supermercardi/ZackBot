// commands/authgroup.js

module.exports = {
  name: 'authgroup',
  aliases: ['autorizar'],
  description: 'Autoriza o grupo atual a usar as funções do bot.',
  
  /**
   * @param {import('../index').GroupExecHook} options
   */
  async execute({ sock, msg, isGroup, sender, isOwner, db, invalidateSettingsCache }) {
    // 1. Verifica se a mensagem foi enviada em um grupo
    if (!isGroup) {
      return sock.sendMessage(sender, { text: 'Este comando só pode ser usado em grupos.' });
    }

    // 2. Verifica se o autor da mensagem é o proprietário do bot
    if (!isOwner) {
      return sock.sendMessage(msg.key.remoteJid, { text: 'Apenas o proprietário do bot pode executar este comando.' }, { quoted: msg });
    }

    const groupId = msg.key.remoteJid;

    // 3. Verifica se o grupo já está autorizado
    if (db.isGroupAuthorized(groupId)) {
      return sock.sendMessage(groupId, { text: 'Este grupo já está autorizado.' }, { quoted: msg });
    }

    try {
      // 4. Autoriza o grupo e define o autor do comando como o primeiro admin do bot no grupo
      db.authorizeGroup(groupId, sender);
      
      // 5. Invalida o cache de configurações para este grupo
      invalidateSettingsCache();

      console.log(`[SUCESSO] Grupo ${groupId} autorizado por ${sender}`);
      await sock.sendMessage(groupId, { 
        text: `✅ Grupo autorizado com sucesso!\n\nO usuário @${sender.split('@')[0]} foi definido como administrador do bot neste grupo.`,
        mentions: [sender]
      });

    } catch (error) {
      console.error('[ERRO] Falha ao autorizar o grupo:', error);
      await sock.sendMessage(groupId, { text: 'Ocorreu um erro ao tentar autorizar o grupo.' }, { quoted: msg });
    }
  }
}