// utils/index.js
/**
 * Extrai o JID do alvo de uma mensagem, seja por menção ou por resposta.
 * @param {import('@whiskeysockets/baileys').proto.IWebMessageInfo} msg - O objeto da mensagem.
 * @returns {string|null} O JID do alvo ou nulo se não encontrado.
 */
function getTargetJid(msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    return mentioned || quoted || null;
}

module.exports = { getTargetJid };