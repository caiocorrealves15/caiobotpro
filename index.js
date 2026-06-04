const weather = require('weather-js');
const { execSync } = require('child_process');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const ytsr = require('ytsr');
const qrcode = require('qrcode-terminal');

const isRender = process.env.RENDER === 'true';
if (isRender) {
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

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        syncFullHistory: true,
        browser: ['Desktop', 'Chrome', '121.0.0.0'] 
    });

    sock.ev.on('creds.update', saveCreds);

    // Boas-vindas (VERSÃO COMPLETA)
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        if (action === 'add') {
            const participantObj = participants[0];
            const userId = participantObj.id || participantObj;
            const userMention = userId.split('@')[0];

            const textoBoasVindas = `👋 Olá @${userMention}.\n` +
                `✨ Seja bem vindo(a) ao *Bonde do Brasil*!\n\n` +
                `📌 🔔 🔔 LEIA AS REGRAS E SE APRESENTE! 🔔 🔔\n` +
                `( Leia Descrição )\n` +
                `• Obrigatório se apresentar com :\n` +
                `• FOTO/CIDADE/IDADE/NOME.\n\n` +
                `📌 PASSIVO DE BAN:\n` +
                `• 1. SEM LINKS 🔗\n` +                
                `• 2. SEM BRIGAS 🥊\n` +
                `• Não abuse dos comandos do BOT 🤖\n\n` +
                `• Dúvidas?\n` +
                `• Qualquer dúvida pergunta ou marcar ou chamar qualquer *Administrador* no privado ou no Grupo.`;

            await sock.sendMessage(id, { 
                text: textoBoasVindas, 
                mentions: [userId] 
            });
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log("✅ Bot conectado!");
        else if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) connectToWhatsApp();
        }
    });

    async function criarFigurinha(mediaMessage, sock, sender, type) {
        console.log("DEBUG: Iniciando processamento de figurinha...");
        try {
            await sock.sendMessage(sender, { text: "🤖✨ CALMA, sou um só!!!!" });
            
            const ext = type === 'videoMessage' ? 'mp4' : 'jpg';
            const tempPath = `./temp_${Date.now()}.${ext}`;
            const finalPath = `./final_${Date.now()}.webp`;

            const stream = await downloadContentFromMessage(mediaMessage, type === 'imageMessage' ? 'image' : 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            fs.writeFileSync(tempPath, buffer);

            if (type === 'videoMessage') {
                execSync(`ffmpeg -i "${tempPath}" -t 6 -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -c:v libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 -an "${finalPath}"`);
                await sock.sendMessage(sender, { sticker: fs.readFileSync(finalPath) });
                fs.unlinkSync(finalPath);
            } else {
                const sticker = new Sticker(tempPath, { 
    pack: 'Bonde do Brasil', // Nome do pacote
    author: 'Caio',          // Nome do autor
    type: StickerTypes.CROPPED, 
    crop: true });
                await sock.sendMessage(sender, await sticker.toMessage());
            }
            fs.unlinkSync(tempPath);
        } catch (err) { 
            console.error("ERRO DETALHADO: ", err);
            await sock.sendMessage(sender, { text: "❌ Erro ao baixar ou processar a mídia. O vídeo pode estar corrompido ou o arquivo é muito grande." }); 
        }
    }

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const sender = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
        const participant = msg.key.participant || msg.key.remoteJid;
        
        contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
        fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens));
        
        const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
        const isAdmin = await getIsAdmin();

        // 1. Resposta ao mencionar Bot
        if (text.includes('bot')) {
            await sock.sendMessage(sender, { text: `Fala aí @${participant.split('@')[0]}, tá falando de mim, por que? Deixa eu comer e beber de boa, pô`, mentions: [participant] });
        }

        // 2. !MENU
        // 2. !MENU (ESTILO PERSONALIZADO BASEADO NA IMAGEM)
        if (text === '!menu') {
            const menuText = `🤖 MENU DE COMANDOS DO BOT [Bonde do Brasil] 🎮\n` +
                `Digite o comando correspondente para acionar o bot:\n\n` +
                `⚽⚽ 1. ROLÊS E ORGANIZAÇÃO\n` +
                `🔰!rank: Ranking de mensagens.\n` +
                `⌛!sortear: Sorteia alguém do grupo.\n` +
                `🎇​!tier [tema]: Ranking aleatório do grupo.\n\n` +
                `😂😂 2. INTERAÇÃO E ZUEIRA\n` +
                `🎵!musica [nome]: Busca música no YouTube.\n` +
                `🤜!socar @usuario: Dá um soco no membro.\n` +
                `😘!beijar @usuario: Dá um beijo no membro.\n` +
                `🗡️!matar @usuario: Elimina o membro.\n` +
                `🤳 !f: Transforma foto/vídeo em figurinha.\n\n` +
                `🚨 3. MODERAÇÃO (Para os administradores)\n` +
                `❌​!ban @usuario: Expulsa o membro.\n` +
                `❇️!adm @usuario: Promove membro a admin.\n` +
                `​🚫 !fechar / !abrir: Abre ou fecha o grupo.\n\n` +
                `⚙️⚙️ 4. UTILIDADES\n` +
                `📛!menu: Exibe esta lista de comandos.\n` +
                `🌤️!clima [sua cidade]: Previsão do tempo.\n\n` +
                `👑 Desenvolvido por: Caio😎😎😎\n` +
                `⏰ Atualizado`;

            await sock.sendMessage(sender, { 
                text: menuText, 
                mentions: [participant] 
            });
        }

        // 3. !BAN
        if (text.startsWith('!ban')) {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            } else {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const meuIDProtegido = '96057379803159';

                if (mention && mention.includes(meuIDProtegido)) {
                    await sock.sendMessage(sender, { text: "❌ Nem tenta! O criador é intocável! 👑" });
                } else if (mention) {
                    await sock.sendMessage(sender, { text: `Tchauuuu, chora para um ADM depois no PV se quiser voltar, viu???`, mentions: [mention] });
                    setTimeout(async () => { await sock.groupParticipantsUpdate(sender, [mention], 'remove'); }, 2000);
                }
            }
        }

        // 4. !TIER
        if (text.startsWith('!tier')) {
            const tema = text.replace('!tier', '').trim() || "do grupo";
            const metadata = await sock.groupMetadata(sender);
            let ppts = metadata.participants.sort(() => 0.5 - Math.random()).slice(0, 5);
            let res = `🏆 *TIER LIST: ${tema.toUpperCase()}*\n\n`;
            ppts.forEach((p, i) => res += `${i + 1}. @${p.id.split('@')[0]} - ${Math.floor(Math.random() * 100) + 1}%\n`);
            await sock.sendMessage(sender, { text: res, mentions: ppts.map(p => p.id) });
        }

        if (text.startsWith('!matar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) {
                const autor = participant.split('@')[0];
                const alvo = mention.split('@')[0];
                await sock.sendMessage(sender, { 
                    text: `O @${autor} mandou o @${alvo} de arrasta pra cima! Que vacilo, hein? 💀`, 
                    mentions: [participant, mention] 
                });
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém para eliminar!" });
            }
        }

        // 5.3 !ADM
        if (text.startsWith('!adm')) {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            } else {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                if (mention) {
                    try {
                        await sock.groupParticipantsUpdate(sender, [mention], 'promote');
                        await sock.sendMessage(sender, { 
                            text: `👑 O @${mention.split('@')[0]} agora é um ADMINISTRADOR do grupo! Parabéns!`, 
                            mentions: [mention] 
                        });
                    } catch (e) {
                        await sock.sendMessage(sender, { text: "❌ Não consegui promover. Verifique se o bot é administrador do grupo." });
                    }
                } else {
                    await sock.sendMessage(sender, { text: "❌ Você precisa mencionar alguém para tornar administrador!" });
                }
            }
        }

        // 5. !SOCAR
        if (text.startsWith('!socar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) {
                await sock.sendMessage(sender, { 
                    text: `O @${mention.split('@')[0]} acabou de levar um nocaute técnico! Quem mandou vacilar?`, 
                    mentions: [mention] 
                });
            } else {
                await sock.sendMessage(sender, { text: "❌ Você precisa mencionar alguém para socar!" });
            }
        }

        // 5.1 !BEIJAR
        if (text.startsWith('!beijar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) {
                const quemBeija = participant.split('@')[0];
                const quemRecebe = mention.split('@')[0];
                await sock.sendMessage(sender, { 
                    text: `O @${quemBeija} está dando um beijão no @${quemRecebe}! Que clima de romance... 💋`, 
                    mentions: [participant, mention] 
                });
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém para beijar!" });
            }
        }

        // 6. Admin Fechar/Abrir
        if (text === '!fechar') {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            } else {
                await sock.sendMessage(sender, { text: "Vocês estão falando demais, dá um tempo!!!" });
                await sock.groupSettingUpdate(sender, 'announcement');
            }
        }
        
        if (text === '!abrir') {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            } else {
                await sock.sendMessage(sender, { text: "Pronto, podem falar a vontade criançada HAHAHAHA." });
                await sock.groupSettingUpdate(sender, 'not_announcement');
            }
        }

        // 7. Música e Figurinha
        if (text.startsWith('!musica ')) {
            const busca = text.replace('!musica ', '');
            try {
                const searchResults = await ytsr(busca, { limit: 1 });
                const video = searchResults.items[0];
                await sock.sendMessage(sender, { text: `🎵 *Encontrei:* ${video.title}\n${video.url}` });
            } catch (e) { await sock.sendMessage(sender, { text: "❌ Não achei nada." }); }
        }
        
        if (text.startsWith('!f')) {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            const media = quoted?.imageMessage || quoted?.videoMessage || msg.message.imageMessage || msg.message.videoMessage;
            if (media) {
                const type = (quoted?.videoMessage || msg.message.videoMessage) ? 'videoMessage' : 'imageMessage';
                await criarFigurinha(media, sock, sender, type);
            }
        }
        // Comando !clima
        // 8. COMANDO CLIMA (AJUSTADO)
        // 8. COMANDO CLIMA (COM DIAGNÓSTICO)
        if (text.startsWith('!clima')) {
            console.log("DEBUG: Comando clima detectado!"); // Isso vai aparecer no LOG do Render
            const cidade = text.replace('!clima', '').trim();
            
            if (!cidade) {
                await sock.sendMessage(sender, { text: "❌ Você precisa digitar a cidade! Ex: !clima Cariacica" });
                return;
            }

            weather.find({ search: cidade, degreeType: 'C' }, async (err, result) => {
                if (err) {
                    console.log("ERRO WEATHER: ", err); // Isso vai aparecer no LOG do Render
                    return await sock.sendMessage(sender, { text: "❌ Erro ao buscar clima. Verifique o log." });
                }
                if (!result || result.length === 0) {
                    return await sock.sendMessage(sender, { text: "❌ Cidade não encontrada." });
                }
                const current = result[0].current;
                const msgClima = `🌤 *Tempo em: ${current.observationpoint}*\n` +
                                 `🌡 Temperatura: ${current.temperature}°C\n` +
                                 `☁️ Condição: ${current.skytext}`;
                await sock.sendMessage(sender, { text: msgClima });
            });
        }
    });
}
connectToWhatsApp();