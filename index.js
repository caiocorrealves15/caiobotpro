const weather = require('weather-js');
const { execSync } = require('child_process');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const cookies = process.env.COOKIES_JSON ? JSON.parse(process.env.COOKIES_JSON) : [];
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const ytsr = require('ytsr');
const qrcode = require('qrcode-terminal');
const ytdl = require('ytdl-core'); // Requisito movido para o topo

const isRender = process.env.RENDER === 'true';
if (isRender) {
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.send('Bot está online!'));
    app.listen(process.env.PORT || 10000);
}

// --- CONFIGURAÇÕES E VARIÁVEIS INICIAIS ---
let brincadeirasAtivas = true;

// Definição dos arquivos de dados
const ARQUIVO_RANK = './rank.json';
const ARQUIVO_MUTADOS = './mutados.json';

// Carregamento dos dados (se existirem)
let contagemMensagens = fs.existsSync(ARQUIVO_RANK) ? JSON.parse(fs.readFileSync(ARQUIVO_RANK)) : {};
let mutados = fs.existsSync(ARQUIVO_MUTADOS) ? JSON.parse(fs.readFileSync(ARQUIVO_MUTADOS)) : {};

// --- FUNÇÃO DE CONEXÃO ---
async function connectToWhatsApp() {
        console.log("--- FUNÇÃO DE CONEXÃO INICIADA ---");
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            auth: state,
            syncFullHistory: false, // Mudei para false para estabilizar
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
                `📌 LEIA AS REGRAS E SE APRESENTE! 🔔 \n` +
                `( Leia Descrição )\n` +
                `• Obrigatório se apresentar com :\n` +
                `• FOTO/CIDADE/IDADE/NOME.\n\n` +
                `📌 PASSIVO DE BAN:\n` +
                `• 1. SEM LINKS 🔗\n` +                
                `• 2. SEM BRIGAS 🥊\n` +
                `• 3. ANUNCIAR VENDAS SEM AUTORIZAÇÃO 🚫\n` +
                `• 4. INVADIR O PV SEM AUTORIZAÇÃO ❌\n` +
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
        
        if (connection === 'open') {
            console.log("✅ Bot conectado!");
        } else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada, tentando reconectar:', shouldReconnect);
            if (shouldReconnect) {
                // A DIFERENÇA ESTÁ AQUI: Espera 5 segundos antes de tentar novamente
                setTimeout(() => connectToWhatsApp(), 5000);
            }
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

        // 2. !MENUconst lowerText = text.toLowerCase();// Verifica se alguém falou em dinheiro
if (lowerText.includes('dinheiro') || lowerText.includes('grana') || lowerText.includes('cash')) {
    
    // 1. Reage com uma nota de dinheiro ou cifrão
    await sock.sendMessage(sender, {
        react: {
            text: '💸',
            key: m.key
        }
    });

    // 2. Responde com um GIF irônico ou de "ostentação"
    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/cLjA_QYEHesAAAPo/grana.mp4' },
        gifPlayback: true,
        caption: 'Opa, falou em dinheiro? Tá sobrando ou tá faltando, meu parceiro? 💸👀',
        quoted: m 
    });
}

// Verifica se a mensagem contém as saudações
if (lowerText.includes('bom dia') || lowerText.includes('boa tarde') || lowerText.includes('boa noite')) {
    let emoji = '☀️'; // padrão sol
    let urlGif = 'https://media.tenor.com/7HPdFKRYFwMAAAPo/thank-you.mp4'; // padrão bom dia
    let frase = 'Bom dia! Tudo bem com você? Hoje é dia do dinheiro, hein? 💰';

    if (lowerText.includes('boa tarde')) {
        emoji = '🌤️';
        urlGif = 'https://media.tenor.com/C78aGUgwTEYAAAPo/good-afternoon-rollygifs.mp4';
        frase = 'Boa tarde! Como vai o dia? Bebendo muito café para aguentar a tarde? ☕';
    } else if (lowerText.includes('boa noite')) {
        emoji = '🌙';
        urlGif = 'https://media.tenor.com/0RCfPxdUCs8AAAPo/dvfedvr.mp4';
        frase = 'Boa noite! Tenha um ótimo descanso.';
    }

    // 1. Reagir à mensagem do usuário
    await sock.sendMessage(sender, {
        react: {
            text: emoji,
            key: m.key
        }
    });

    // 2. Enviar o GIF com a saudação// Verifica se a mensagem contém a palavra Sextou
if (lowerText.includes('sextou')) {
    
    // 1. Reage com uma carinha de festa
    await sock.sendMessage(sender, {
        react: {
            text: '🥳',
            key: m.key
        }
    });

    // 2. Responde citando a mensagem (reply) com um GIF de festa// Verifica se alguém falou em trabalho
if (lowerText.includes('trabalhar') || lowerText.includes('trabalho')) {
    
    // 1. Reage com um emoji de desânimo ou suor
    await sock.sendMessage(sender, {
        react: {
            text: '😰',
            key: m.key
        }
    });

    // 2. Responde com um GIF irônico de quem não quer nada com o trabalho
    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/ONR_In8tDa8AAAPo/meme-funny-funny-meme.mp4' },
        gifPlayback: true,
        caption: 'Opa, falou em trabalho? Credo, vira essa boca pra lá! 😰🏃‍♂️',
        quoted: m 
    });
}
    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/IuZs76jQrG4AAAPo/sextou-familia.mp4' },
        gifPlayback: true,
        caption: 'Sextou meu parceiro! Bora que hoje é dia de alegria! 🍻🔥',
        quoted: m 
    });
}
    await sock.sendMessage(sender, {
        video: { url: urlGif },
        gifPlayback: true,
        caption: `🤖 *${frase}*`
    });
}
        // 2. !MENU (ESTILO PERSONALIZADO BASEADO NA IMAGEM)// Verifica se a mensagem contém a palavra chave
if (lowerText.includes('bebida') || lowerText.includes('cerveja') || lowerText.includes('vodka') || lowerText.includes('whisky')) {
    
    await sock.sendMessage(sender, { 
        text: 'Opa, alguém falou em bebida???? 👀👀👀👀 É comigo mesmo, viu?',
        quoted: m // Isso faz o bot responder diretamente a mensagem da pessoa
    });
}
    // Tratamento para garantir que o nome esteja sempre bonito
    if (text === '!menu') {
    let nomeUsuario = m.pushName;
    if (!nomeUsuario || nomeUsuario.trim() === '' || nomeUsuario.trim() === '.') {
        nomeUsuario = 'Amigo(a)';
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Seu número no formato correto para menção
    const meuNumero = '96057379803159'; 

    const menuTexto = `
「 ❍ BONDE DO BRASIL ❍ 」

✨ BOAS-VINDAS, ${nomeUsuario}! 🔔✨

↪ 🫧 NICK: ${nomeUsuario}
↪ 🔔 DATA: ${dataAtual}
↪ ⏰ HORA: ${horaAtual}
↪ 👑 DEV: @${meuNumero.split('@')[0]}
↪ 🤖 ATUALIZAÇÕES: Semanais

🔔 MENU DE COMANDOS 🫧

⚽ 1. ROLÊS E ORGANIZAÇÃO
🩸 🔰 !rank
🩸 ⌛ !sortear
🩸 🎇 !tier [tema]

😂😂 2. INTERAÇÃO E ZUEIRA
🩸 🤜 !socar @usuario
🩸 😘 !beijar @usuario
🩸 🗡️ !matar @usuario
🩸 🤳 !f

🚨 3. MODERAÇÃO (ADMINS)
🩸 ❌ !ban @usuario
🩸 ❇️ !adm @usuario
🩸 🚫 !fechar / !abrir

⚙️ 4. UTILIDADES
🩸 📛 !menu
🩸 🌤️ !clima [cidade]
    `.trim();

    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/WV_2tGerThoAAAPo/farming-aura-farming.mp4' },
        gifPlayback: true, 
        caption: menuTexto,
        // Aqui o bot marca o usuário que digitou e você (o dono)
        mentions: [sender, meuNumero] 
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

        // 5.2 !MATAR (COM GIF)
if (text.startsWith('!matar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mention) {
        const autor = participant.split('@')[0];
        const alvo = mention.split('@')[0];
        
        // Link do GIF (você pode trocar por outro link que termine em .gif)
        const linkGifMatar = "https://media.tenor.com/3gus0SGhiEIAAAPo/cool-beans.mp4";

        await sock.sendMessage(sender, { 
            video: { url: linkGifMatar }, 
            gifPlayback: true,
            caption: `O @${autor} mandou o @${alvo} de arrasta pra cima! Que vacilo, hein? 💀`, 
            mentions: [participant, mention] 
        });
    } else {
        await sock.sendMessage(sender, { text: "❌ Mencione alguém para eliminar!" });
    }
}

        // 5.3 !ADM
        // 1. !RANK (ORGANIZADO)
        if (text === '!rank') {
            // Ordena os usuários pelo número de mensagens (do maior para o menor)
            const ranking = Object.entries(contagemMensagens)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10); // Mostra apenas os 10 primeiros

            let res = `🏆 *RANKING DE MENSAGENS (TOP 10)*\n\n`;
            ranking.forEach((entry, index) => {
                const [id, count] = entry;
                res += `${index + 1}. @${id.split('@')[0]} - ${count} mensagens\n`;
            });

            await sock.sendMessage(sender, { 
                text: res, 
                mentions: ranking.map(entry => entry[0]) 
            });
        }
        // 5.3 !ADM (COM GIF)
if (text.startsWith('!adm')) {
    if (!isAdmin) {
        await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
    } else {
        const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (mention) {
            try {
                await sock.groupParticipantsUpdate(sender, [mention], 'promote');
                
                // Link do GIF para promoção (substitua por um link de sua preferência)
                const linkGifAdm = "https://media.tenor.com/ASV7XuWQLXwAAAPo/alligator-crocodile.mp4";

                await sock.sendMessage(sender, { 
                    video: { url: linkGifAdm },
                    gifPlayback: true,
                    caption: `👑 O @${mention.split('@')[0]} agora é um ADMINISTRADOR do grupo! Parabéns!`, 
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
        // Exemplo de como enviar um GIF junto com a mensagem
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/6Cp5tiRwh-YAAAPo/meme-memes.mp4' }, // O WhatsApp entende vídeo/gif
            gifPlayback: true, // Isso faz o arquivo tocar como GIF
            caption: `O @${participant.split('@')[0]} deu um soco no @${mention.split('@')[0]}! 🤜`,
            mentions: [participant, mention]
        });
    } else {
        await sock.sendMessage(sender, { text: "❌ Mencione alguém!" });
    }
}

        // 5.1 !BEIJAR
        // 5.1 !BEIJAR (COM GIF)
if (text.startsWith('!beijar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mention) {
        const quemBeija = participant.split('@')[0];
        const quemRecebe = mention.split('@')[0];
        
        // Exemplo de link de GIF (você pode trocar esse link depois)
        const linkGif = "https://media.tenor.com/2ES7YijqoOwAAAPo/kiss.mp4";

        await sock.sendMessage(sender, { 
            video: { url: linkGif }, 
            gifPlayback: true,
            caption: `O @${quemBeija} está dando um beijão no @${quemRecebe}! Que clima de romance... 💋`, 
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
                await sock.sendMessage(sender, { text: "Pronto, podem falar a vontade bando de desempregados HAHAHAHA." });
                await sock.groupSettingUpdate(sender, 'not_announcement');
            }
        }

        // 7. Música e Figurinha
        // Adicione lá no topo do arquivo (junto com os outros 'require')

// Dentro de sock.ev.on('messages.upsert', ...), substitua o seu bloco !musica atual por este:
// 7. Música e Figurinha
        // Substitua seu bloco !musica por este:
if (text.startsWith('!musica ')) {
    const busca = text.replace('!musica ', '');
    try {
        await sock.sendMessage(sender, { text: "🔍 Buscando sua música..." });
        
        // Busca o link do vídeo
        const searchResults = await ytsr(busca, { limit: 1 });
        const video = searchResults.items[0];
        
        if (!video) return await sock.sendMessage(sender, { text: "❌ Não encontrado." });

        // Mensagem com o link e o GIF divertido
        const mensagem = `🎵 *Música Encontrada!*\n\n` +
                         `🎤 *Título:* ${video.title}\n` +
                         `🔗 *Link:* ${video.url}\n\n` +
                         `Dançando enquanto prepara o som... 😎, se você não tem Youtube Premium, melhor pagar seu pobre.S`;

        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/9SFSfC2n0lkAAAPo/head-phones-music.mp4' }, // GIF divertido
            gifPlayback: true, 
            caption: mensagem
        });

    } catch (e) {
        console.error(e);
        await sock.sendMessage(sender, { text: "❌ Erro ao buscar a música." });
    }
}
        // Comando !clima
        // 8. COMANDO CLIMA (AJUSTADO)
        // 8. COMANDO CLIMA (COM DIAGNÓSTICO)
        if (text.startsWith('!desmute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention && mutados[mention]) {
                delete mutados[mention];
                // ADICIONE ESSA LINHA PARA SALVAR A REMOÇÃO NO ARQUIVO:
                //fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                
                await sock.sendMessage(sender, { text: "Fala agora, mas com cuidado, ok?", mentions: [mention] });
            }
        }
        // 4. COMANDO !MUTE (CORRIGIDO)
        if (text === '!sortear') {
    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        const sortudo = participants[Math.floor(Math.random() * participants.length)];

        const mensagem = `🎰 *SORTEIO DO BONDE* 🎰\n\n` +
                         `🎉 O sorteado da vez foi: @${sortudo.id.split('@')[0]}\n` +
                         `🍀 Parabéns, muita sorte hein!`;

        await sock.sendMessage(sender, { 
            video: { url: 'https://media1.tenor.com/m/Qf_HIQNQ95wAAAAC/dogs-dog.gif' }, // GIF de máquina de caça-níqueis
            gifPlayback: true, 
            caption: mensagem,
            mentions: [sortudo.id] 
        });
    } catch (e) {
        await sock.sendMessage(sender, { text: "❌ O comando !sortear só funciona em grupos!" });
    }
}
        // 4. COMANDO !MUTE (CORRIGIDO E PROTEGIDO)
        if (text.startsWith('!mute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            
            // --- PROTEÇÃO DO CRIADOR ---
            const meuNumero = "96057379803159"; // ALTERE AQUI!
            if (mention === meuNumero) {
                return await sock.sendMessage(sender, { text: "❌ Não posso mutar o criador, respeita o chefe! 👑" });
            }
            // ---------------------------

            if (!mention) return await sock.sendMessage(sender, { text: "Mencione quem você quer mutar." });

            const tempo = text.includes('h') ? 3600000 : 1800000;
            mutados[mention] = Date.now() + tempo;
            
            //fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
            await sock.sendMessage(sender, { text: "Você está falando demais, dá um tempo.", mentions: [mention] });
        }
        // 8. COMANDO CLIMA (TRADUZIDO)
        // 8. COMANDO CLIMA (Ajustado)
        if (text.startsWith('!clima')) {
            const cidade = text.replace('!clima', '').trim();
            if (!cidade) return await sock.sendMessage(sender, { text: "❌ Digite a cidade! Ex: !clima Cariacica" });

            const traduzir = (condicao) => {
                const manual = {
                    'light rain': 'Chuva leve', 'rain': 'Chuva', 'sunny': 'Ensolarado',
                    'mostly sunny': 'Predominância de sol', 'cloudy': 'Nublado',
                    'mostly cloudy': 'Predominância de nuvens', 'partly cloudy': 'Parcialmente nublado',
                    'clear': 'Céu limpo', 'thunderstorms': 'Tempestades'
                };
                return manual[condicao.toLowerCase()] || condicao;
            };

            weather.find({ search: cidade, degreeType: 'C' }, async (err, result) => {
                if (err || !result || result.length === 0) return await sock.sendMessage(sender, { text: "❌ Cidade não encontrada." });
                
                const current = result[0].current;
                const condicaoTraduzida = traduzir(current.skytext);
                
                const msgClima = `🌤 *Tempo em: ${current.observationpoint}*\n` +
                                 `🌡 Temperatura: ${current.temperature}°C\n` +
                                 `☁️ Condição: ${condicaoTraduzida}`;
                await sock.sendMessage(sender, { text: msgClima });
            });
        }

        // --- VERIFICAÇÃO DE COMANDO ERRADO (FORA DOS IFs) ---
        const comandosExistentes = ['!menu', '!rank', '!sortear', '!tier', '!musica', '!socar', '!beijar', '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', '!clima', '!desmute', '!mute'];

        if (text.startsWith('!') && !comandosExistentes.some(cmd => text.startsWith(cmd))) {
            await sock.sendMessage(sender, { 
                text: "Aí que você quer demais né, amigo? Olha o menu e digite esse maldito comando direito!!!!!" 
            });
        }
        
    }); // Fecha o messages.upsert
} // Fecha o connectToWhatsApp

connectToWhatsApp();
