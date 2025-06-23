// commands/figurinha.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const pino = require('pino');
const Jimp = require('jimp'); // <<-- NOVA DEPENDÊNCIA, SUBSTITUINDO O SHARP

// --- Constantes de Configuração ---
const MAX_FILE_SIZE_MB = 5; // Pode ser um pouco maior, jimp vai redimensionar
const MAX_VIDEO_DURATION_SEC = 7;
const STICKER_AUTHOR = "Meu Bot Incrível";
const STICKER_PACK = "Figurinhas do Bot";
const STICKER_DIMENSIONS = 512;

module.exports = {
    name: 'figurinha',
    description: 'Cria uma figurinha otimizada a partir de uma imagem ou vídeo.',
    aliases: ['f', 'sticker'],

    async execute({ sock, msg }) {
        const id = msg.key.remoteJid;
        const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quotedMsg) {
            const replyText = '🤖 Para criar uma figurinha, responda a uma imagem ou vídeo com o comando.';
            return sock.sendMessage(id, { text: replyText }, { quoted: msg });
        }

        const messageType = Object.keys(quotedMsg)[0];
        const mediaMessage = quotedMsg[messageType];

        if (messageType !== 'imageMessage' && messageType !== 'videoMessage') {
            const replyText = '❌ Formato não suportado! Por favor, responda a uma imagem ou a um vídeo.';
            return sock.sendMessage(id, { text: replyText }, { quoted: msg });
        }

        if (mediaMessage.fileLength > MAX_FILE_SIZE_MB * 1024 * 1024) {
            const replyText = `❌ Arquivo muito grande! O limite é de ${MAX_FILE_SIZE_MB}MB.`;
            return sock.sendMessage(id, { text: replyText }, { quoted: msg });
        }
        if (messageType === 'videoMessage' && mediaMessage.seconds > MAX_VIDEO_DURATION_SEC) {
            const replyText = `❌ Vídeo muito longo! O limite é de ${MAX_VIDEO_DURATION_SEC} segundos.`;
            return sock.sendMessage(id, { text: replyText }, { quoted: msg });
        }

        try {
            await sock.sendMessage(id, { text: '✨ Redimensionando e criando sua figurinha, aguarde...' }, { quoted: msg });

            const buffer = await downloadMediaMessage(
                { key: msg.key, message: quotedMsg },
                'buffer',
                {},
                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
            );

            let finalBuffer;

            if (messageType === 'imageMessage') {
                // --- NOVO PASSO: Otimização com Jimp ---
                const image = await Jimp.read(buffer);
                image.scaleToFit(STICKER_DIMENSIONS, STICKER_DIMENSIONS); // Redimensiona mantendo a proporção
                finalBuffer = await image.getBufferAsync(Jimp.MIME_PNG); // Pega o buffer da imagem redimensionada
            } else {
                // Para vídeos, não precisamos redimensionar, só passar o buffer direto
                finalBuffer = buffer;
            }

            const sticker = new Sticker(finalBuffer, {
                pack: STICKER_PACK,
                author: STICKER_AUTHOR,
                type: StickerTypes.FULL,
                quality: 60, // A qualidade pode ser um pouco maior, já que redimensionamos
            });
            
            const stickerBuffer = await sticker.toBuffer();

            await sock.sendMessage(id, { sticker: stickerBuffer }, { quoted: msg });

        } catch (error) {
            console.error('❌ Erro detalhado ao criar figurinha:', error);
            const replyText = '😥 Ops! Algo deu errado. A mídia pode estar corrompida ou em um formato muito incomum. Tente com outra.';
            await sock.sendMessage(id, { text: replyText }, { quoted: msg });
        }
    }
};