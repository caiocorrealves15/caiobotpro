const { execSync } = require('child_process');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const ytsr = require('ytsr');

// Lógica de extração da sessão (Arquivo único)
if (fs.existsSync('minha-sessao.tar.gz')) {
    console.log("Extraindo sessão do arquivo...");
    execSync('tar -xvzf minha-sessao.tar.gz');
    console.log("Sessão extraída!");
}

const isRender = process.env.RENDER === 'true';
if (isRender || process.env.PORT) {
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.send('Bot está online!'));
    app.listen(process.env.PORT || 10000);
}

let brincadeirasAtivas = true;
const ARQUIVO_RANK = './rank.json';
let contagemMensagens = fs.existsSync(ARQUIVO_RANK) ? JSON.parse(fs.readFileSync(ARQUIVO_RANK)) : {};

async function connectToWhatsApp() {
    console.log("--- FUNÇÃO DE CONEXÃO INICIADA ---");
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    console.log("Configurando socket...");
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        syncFullHistory: true,
        browser: ['Desktop', 'Chrome', '121.0.0.0'] 
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'connecting') {
            console.log("Conectando...");
        } else if (connection === 'open') {
            console.log("✅ BOT CONECTADO COM SUCESSO!");
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        }
    });

    async function criarFigurinha(mediaMessage, sock, sender, type) {
        try {
            const ext = type === 'videoMessage' ? 'mp4' : 'jpg';
            const tempPath = `./temp_${Date.now()}.${ext}`;
            const finalPath = `./final_${Date.now()}.webp`;
            const stream = await downloadContentFromMessage(mediaMessage, type === 'imageMessage' ? 'image' : 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            fs.writeFileSync(tempPath, buffer);
            if (type === 'videoMessage') {
                execSync(`ffmpeg -i "${tempPath}" -t 5 -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -c:v libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 "${finalPath}"`);
                await sock.sendMessage(sender, { sticker: fs.readFileSync(finalPath) });
                fs.unlinkSync(finalPath);
            } else {
                const sticker = new Sticker(tempPath, { pack: 'BotNice', author: 'CAIOOOO', type: StickerTypes.CROPPED, crop: true });
                await sock.sendMessage(sender, await sticker.toMessage());
            }
            fs.unlinkSync(tempPath);
        } catch (err) { await sock.sendMessage(sender, { text: "❌ Erro ao criar figurinha." }); }
    }

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const participant = msg.key.participant || msg.key.remoteJid;
        
        contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
        fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens));
        
        const getIsAdmin = async () => {
            if (!sender.endsWith('@g.us')) return false;
            try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; }
        };

        if (text.startsWith('!ban') && await getIsAdmin()) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) { await sock.sendMessage(sender, { text: `Tchau!`, mentions: [mention] }); setTimeout(async () => { await sock.groupParticipantsUpdate(sender, [mention], 'remove'); }, 1500); }
        }
        if ((text === '!fechar' || text === '!mute' || text === '!abrir' || text === '!desmute') && await getIsAdmin()) {
            await sock.groupSettingUpdate(sender, (text === '!fechar' || text === '!mute') ? 'announcement' : 'not_announcement');
            await sock.sendMessage(sender, { text: `Grupo ${text.includes('fechar') || text.includes('mute') ? 'silenciado' : 'aberto'}.` });
        }
        if (text === '!ativar' || text === '!desativar') {
            if (await getIsAdmin()) { brincadeirasAtivas = (text === '!ativar'); await sock.sendMessage(sender, { text: brincadeirasAtivas ? "😊 Como estou bonzinho hoje, vou deixar vocês brincarem :)" : "😤 DESATIVADO!!! Vocês estão abusando da minha generosidade." }); }
        }
        if (brincadeirasAtivas) {
            if (text === '!rank') { let msgRank = "📊 Rank:\n"; for (let id in contagemMensagens) msgRank += `${id.split('@')[0]}: ${contagemMensagens[id]} msgs\n`; await sock.sendMessage(sender, { text: msgRank }); }
            if (text === '!dado') await sock.sendMessage(sender, { text: `🎲 ${Math.floor(Math.random() * 6) + 1}` });
            if (text === '!sortear') { const metadata = await sock.groupMetadata(sender); const sorteado = metadata.participants[Math.floor(Math.random() * metadata.participants.length)].id; await sock.sendMessage(sender, { text: `🏆 Sorteado: @${sorteado.split('@')[0]}`, mentions: [sorteado] }); }
            if (text.startsWith('!musica ')) {
                const busca = text.replace('!musica ', ''); await sock.sendMessage(sender, { text: `🔍 Procurando por "${busca}" no YouTube...` });
                try { const searchResults = await ytsr(busca, { limit: 5 }); const video = searchResults.items[Math.floor(Math.random() * searchResults.items.length)]; await sock.sendMessage(sender, { text: `🎵 *Encontrado:*\n*Título:* ${video.title}\n*Link:* ${video.url}` }); } catch { await sock.sendMessage(sender, { text: "❌ Não achei nada." }); }
            }
        }
        if (text.startsWith('!f') || text.startsWith('!fig')) {
            const msgObj = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
            const media = msgObj.imageMessage || msgObj.videoMessage || msgObj.documentMessage;
            if (media) { await sock.sendMessage(sender, { text: "🤖✨ Processando figurinha..." }); await criarFigurinha(media, sock, sender, media.mimetype?.includes('video') ? 'videoMessage' : 'imageMessage'); }
        }
    });
}

connectToWhatsApp();