// commands/unauthgroup.js

module.exports = {
  name: 'unauthgroup',
  aliases: ['desautorizar'],
  description: 'Remove a autorização do grupo e faz o bot sair.',

  /**
   * @param {import('../index').GroupExecHook} options
   */
  async execute({ sock, msg, args, isGroup, sender, isOwner, db, pendingConfirmations }) {
    const groupId = msg.key.remoteJid;

    // 1. Verifica se é um grupo e se o usuário é o proprietário
    if (!isGroup) {
      return sock.sendMessage(sender, { text: 'Este comando só pode ser usado em grupos.' });
    }
    if (!isOwner) {
      return sock.sendMessage(groupId, { text: 'Apenas o proprietário do bot pode desautorizar um grupo.' }, { quoted: msg });
    }

    // 2. Verifica se o grupo está realmente autorizado
    if (!db.isGroupAuthorized(groupId)) {
      return sock.sendMessage(groupId, { text: 'Este grupo não está na minha lista de autorizados.' }, { quoted: msg });
    }
    
    // 3. Lógica de confirmação para evitar remoção acidental
    const confirmationId = `unauth_${groupId}`;
    if (!pendingConfirmations[confirmationId] || pendingConfirmations[confirmationId].requester !== sender) {
      pendingConfirmations[confirmationId] = {
        requester: sender,
        command: this.name,
      };
      
      // Envia o pedido de confirmação
      const text = `⚠️ *ATENÇÃO* ⚠️\n\nVocê tem certeza que deseja desautorizar este grupo? Todos os dados (admins, avisos, configurações) serão apagados e eu sairei do grupo.\n\nPara confirmar, digite o comando \`/unauthgroup\` novamente nos próximos 30 segundos.`;
      
      // Seta um timeout para cancelar a confirmação pendente
      setTimeout(() => {
        if (pendingConfirmations[confirmationId]) {
          delete pendingConfirmations[confirmationId];
          sock.sendMessage(groupId, { text: `A solicitação para desautorizar o grupo expirou.` });
        }
      }, 30000); // 30 segundos para confirmar

      return sock.sendMessage(groupId, { text });
    }

    // 4. Execução se a confirmação for validada
    try {
      await sock.sendMessage(groupId, { text: 'Ok, confirmado. Removendo todos os dados e saindo do grupo... Adeus! 👋' });

      // Remove o grupo e todos os seus dados do banco de dados
      db.unauthorizeGroup(groupId);
      
      // Limpa a confirmação pendente
      delete pendingConfirmations[confirmationId];

      console.log(`[SUCESSO] Grupo ${groupId} desautorizado por ${sender}. O bot saiu do grupo.`);
      
      // Faz o bot sair do grupo
      await sock.groupLeave(groupId);

    } catch (error) {
      console.error(`[ERRO] Falha ao desautorizar o grupo ${groupId}:`, error);
      delete pendingConfirmations[confirmationId];
      await sock.sendMessage(groupId, { text: 'Ocorreu um erro ao processar a desautorização.' }, { quoted: msg });
    }
  }
};