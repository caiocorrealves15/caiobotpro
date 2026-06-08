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
const ARQUIVO_PLACAR_EMOJI = './placar_emoji.json';
const infrações = {};
const ultimaMensagem = {};
const contagemFlood = {};


let placarEmoji = fs.existsSync(ARQUIVO_PLACAR_EMOJI) ? JSON.parse(fs.readFileSync(ARQUIVO_PLACAR_EMOJI)) : {};

const isRender = process.env.RENDER === 'true';
if (isRender) {
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.send('Bot está online!'));
    app.listen(process.env.PORT || 10000);
}

// --- CONFIGURAÇÕES E VARIÁVEIS INICIAIS ---
let brincadeirasAtivas = true;

let jogoForca = {
    ativo: false,
    processando: false, // <--- ADICIONE ESTA LINHA
    palavra: "",
    descobertas: [],
    tentativas: [],
    erros: 0,
    maxErros: 6,
    idMensagem: ""
};


let jogoEmoji = {
    ativo: false,
    resposta: "",
    idMensagem: "" // O ID único da mensagem do desafio
};

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
        const userId = typeof participants[0] === 'string' ? participants[0] : participants[0].id;
        
        const textoBoasVindas = 
`━━━━━━━━━━━━━━━━━━━━━━━━━━
        🌟 BONDE DO BRASIL 🌟        
━━━━━━━━━━━━━━━━━━━━━━━━━━

Fala aí, @${userId.split('@')[0]}! 🎉 
Você acaba de entrar no grupo mais zueiro do Zap!

🚀 *O QUE ROLA POR AQUI?*
🎮 *JOGOS:* Emoji, RPG, Forca, Ranking de mensagens, Pênalti e mais!
🎶 Músicas via comando !musica.
🥊 Muita interação e resenha.
🏆 Ranking de membros ativos.

👑 *DONO DO GRUPO:* Caio
Dúvidas? Procure um dos nossos ADMs no privado.

📝 *PARA COMEÇAR BEM:*
Envie sua *FOTO | CIDADE | IDADE | NOME*.

🚫 *REGRAS DE OURO E SEGURANÇA*
━━━━━━━━━━━━━━━━━━━━━━━━━━
• Proibido brigas, ofensas ou preconceito.
• Proibido invadir PV sem permissão.
• Proibido conteúdo adulto.

🚨 *SISTEMA DE PROTEÇÃO ATIVO 24H:*
O bot monitora automaticamente:
• *Links:* Proibido (Ban automático na insistência).
• *Travas:* Proibido (Ban imediato).
• *Spam/Flood:* Proibido (Mute automático).
━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 *DICA:* Digite *!menu* para ver todos os comandos e divirta-se!`;

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
                setTimeout(() => connectToWhatsApp(), 30000);
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
    
    const isMedia = (msg.message.imageMessage || msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage);
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption || "";
    const lowerText = text.toLowerCase();
    const participant = msg.key.participant || msg.key.remoteJid;
    const sender = msg.key.remoteJid;

    // Verificação de Mutados
    if (mutados[participant] && Date.now() < mutados[participant]) {
        await sock.sendMessage(sender, { delete: msg.key });
        return; 
    }

    // --- LÓGICA DO ANTI-LINK COM AUTO BAN ---
    const isLink = /https?:\/\/[^\s]+/.test(text);
    if (isLink) {
        const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
        const isAdmin = await getIsAdmin();
        
        if (!isAdmin) {
            infrações[participant] = (infrações[participant] || 0) + 1;
            const limite = 3; 
            const restam = limite - infrações[participant];

            if (infrações[participant] >= limite) {
                await sock.sendMessage(sender, { text: `🚫 @${participant.split('@')[0]} foi banido por insistir em mandar links!`, mentions: [participant] }, { quoted: msg });
                await sock.groupParticipantsUpdate(sender, [participant], "remove");
                delete infrações[participant];
            } else {
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/q4GIdsYVSXcAAAPo/no-nooo.mp4' },
                    gifPlayback: true,
                    caption: `🚫 OPA, @${participant.split('@')[0]}! Aqui não pode link. Você tem ${restam} chance(s) antes do ban!`,
                    mentions: [participant]
                }, { quoted: msg });
                await sock.sendMessage(sender, { delete: msg.key });
            }
            return; 
        } else {
            await sock.sendMessage(sender, { react: { text: '👀', key: msg.key } });
            await sock.sendMessage(sender, { text: `😎 Link?? Você se salvou porque é ADM, filho, se não eu ia bloquear na HORAA!!!!!!! 😎😎😎😎` }, { quoted: msg });
        }
    }

    // --- INÍCIO DO ANTI-TRAVA ---
    if (text.length > 5000) {
        const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
        const isAdmin = await getIsAdmin();

        if (!isAdmin) {
            const metadata = await sock.groupMetadata(sender);
            const admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
            const mentions = [participant, ...admins];
            await sock.sendMessage(sender, { delete: msg.key });
            await sock.sendMessage(sender, { 
                text: `🚨 *ALERTA DE SEGURANÇA!* 🚨\n\nO membro @${participant.split('@')[0]} tentou enviar uma trava pesada e o sistema bloqueou!\n\n${admins.map(adm => `@${adm.split('@')[0]}`).join(' ')} -> *Fiquem de olho neste membro!*`, 
                mentions: mentions
            }, { quoted: msg });
            return;
        } else {
            await sock.sendMessage(sender, { react: { text: '😂', key: msg.key } });
            await sock.sendMessage(sender, { text: `Chefe, precisa falar tanto assim? Se for assim escreve um novo testamento logo 😂😂😂`, }, { quoted: msg });
        }
    }

    // --- INÍCIO DO NOVO ANTI-SPAM (4 mensagens em 1 segundo = MUTE) ---
        // --- NOVO ANTI-SPAM COM AVISO PARA ADM ---
    // --- ANTI-SPAM AJUSTADO (SEM ERROS DE ASSINCRONIA) ---
const agora = Date.now();
if (!contagemFlood[participant]) contagemFlood[participant] = [];
contagemFlood[participant] = contagemFlood[participant].filter(t => agora - t < 1000);
contagemFlood[participant].push(agora);

if (contagemFlood[participant].length >= 4) {
    // Agora o bot testa na hora sem depender de buscar o metadata do grupo
    // Se o seu número (ou dos ADMs) estiver na lista de admins do grupo, isso vai disparar
    const metadata = await sock.groupMetadata(sender).catch(() => null);
    const ehAdm = metadata?.participants.find(p => p.id === participant)?.admin !== null;

    if (!ehAdm) {
        await sock.sendMessage(sender, { react: { text: '🛑', key: msg.key } });
        mutados[participant] = Date.now() + 60000;
        fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
        await sock.sendMessage(sender, { text: `🚫 @${participant.split('@')[0]}, spam detectado! Mutado.`, mentions: [participant] }, { quoted: msg });
        contagemFlood[participant] = [];
        return; 
    } else {
        // REAÇÃO PARA ADM (agora garantida)
        await sock.sendMessage(sender, { react: { text: '⚠️', key: msg.key } });
        await sock.sendMessage(sender, { text: `⚠️ Calma, meu rei @${participant.split('@')[0]}! Só nao reajo por que você não é meu chefe! 😂`, mentions: [participant] }, { quoted: msg });
        contagemFlood[participant] = [];
    }
}
// --- FIM ---

    // --- FIM DO NOVO ANTI-SPAM ---


    // --- COMANDO !f (FIGURINHA INTEGRADO) ---
    if (lowerText.startsWith('!f') && isMedia) {
        const media = msg.message.imageMessage || msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
        const type = (msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) ? 'imageMessage' : 'videoMessage';
        await criarFigurinha(media, sock, sender, type);
        return;
    }
    // ... daqui pra baixo continua o seu código normal (contagemMensagens, etc
  
    
    contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
    fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens));
    
    const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
    const isAdmin = await getIsAdmin();

    if (text.startsWith('!emoji')) {
    const desafios = [
        // NÍVEL HARDCORE / QUASE IMPOSSÍVEL
        { emojis: '⏳🏜️🪰🕶️', resposta: 'duna', gif: 'https://tenor.com/pt-BR/view/mike-dune-mike-paul-dune-mikes-book-reviews-dune-mikes-book-reviews-paul-mike-atreides-gif-22418379' },
        { emojis: '🏢🧩💀📼', resposta: 'jogos mortais', gif: 'https://media.tenor.com/_VCUIiAYnQUAAAPo/jigsaw-saw.mp4' },
        { emojis: '🥃👽🌑🎷', resposta: 'o quinto elemento', gif: 'https://media.tenor.com/nr1ihysLytYAAAPo/fifth-element-friday.mp4' },
        { emojis: '🏨❄️🪓👨‍👩‍👦', resposta: 'o iluminado', gif: 'https://media.tenor.com/sU7qOfCln0cAAAPo/resplandor-shining.mp4' },
        { emojis: '🤖🧠🕶️🌆', resposta: 'blade runner', gif: 'https://media.tenor.com/OLN4EbHbw0MAAAPo/ryan-gosling.mp4' },
        { emojis: '👨‍🦱💊🃏🏙️', resposta: 'coringa', gif: 'https://media.tenor.com/YA5eTXsPOGQAAAPo/%E1%83%AF%E1%83%9D%E1%83%99%E1%83%94%E1%83%A0%E1%83%98-joker.mp4' },
        { emojis: '🏰🗝️🦁🏹', resposta: 'narnia', gif: 'https://media.tenor.com/L3uIXGs50TMAAAPo/narnia-mrtumnus.mp4' },
        { emojis: '🦖🌴🧬🧪', resposta: 'jurassic park', gif: 'https://media.tenor.com/xvxsUY2gWtgAAAPo/t-rex.mp4' },
        { emojis: '👤🔥🌌🕰️', resposta: 'donnie darko', gif: 'https://media.tenor.com/bZgc0s9WzgQAAAPo/donniedarko-bunny.mp4' },
        { emojis: '🛶💍👹🌋', resposta: 'o hobbit', gif: 'https://media.tenor.com/ofMWBWlpN4IAAAPo/hasanshabbir-blaaah.mp4' },
        { emojis: '👩‍🏫📓🤫💅', resposta: 'meninas malvadas', gif: 'https://media.tenor.com/9DP0qd04vvsAAAPo/mean-girls-looking-around.mp4' },
        { emojis: '🕵️‍♂️♟️🎩🔪', resposta: 'o grande truque', gif: 'https://media.tenor.com/CvDyQw6dUBQAAAPo/prestige-movie-hugh-jackman.mp4' },
        { emojis: '👨‍🔬🧪🚐💰', resposta: 'breaking bad', gif: 'https://media.tenor.com/XyAE6nJKCIUAAAPo/breaking-bad.mp4' },
        { emojis: '👨‍🚀🌌🌑🚪', resposta: '2001 uma odisseia no espaço', gif: 'https://media.tenor.com/wP-HjXYA6HgAAAPo/dave-bowman-david-bowman.mp4' },
        { emojis: '👺🎭🎹🎼', resposta: 'o fantasma da ópera', gif: 'https://media.tenor.com/jvxE-RQjbaIAAAPo/phantom-of-the-opera-gerard-butler.mp4' },
        { emojis: '🥊🏢🛌💤', resposta: 'origem', gif: 'https://media.tenor.com/yaRszZthE04AAAPo/cillian-murphy-inception.mp4' }
    ];
    
    const sorteado = desafios[Math.floor(Math.random() * desafios.length)];
    
    // GIF de entrada
    const msgDesafio = await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/oJKQsEPQrYIAAAPo/spongebob-spongebob-squarepants.mp4' },
        gifPlayback: true,
        caption: `🧩 *ADIVINHE O FILME/SÉRIE:* \n\n${sorteado.emojis}\n\nResponda em cima nesta mensagem, hein!`,
    }, { quoted: msg });

    jogoEmoji.ativo = true;
    jogoEmoji.resposta = sorteado.resposta;
    jogoEmoji.gifResposta = sorteado.gif; // Guarda o GIF do filme
    jogoEmoji.idMensagem = msgDesafio.key.id;
}

// Verifica se tem jogo ativo E se a mensagem é um reply à mensagem do desafio
// Verifica se tem jogo ativo E se a mensagem é um reply à mensagem do desafio
// Verifica se tem jogo ativo E se a mensagem é um reply à mensagem do desafio
if (jogoEmoji.ativo && 
    msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoEmoji.idMensagem) {
    
    const respostaUsuario = text.toLowerCase().trim();

    if (respostaUsuario === jogoEmoji.resposta) {
        jogoEmoji.ativo = false; // Fecha o jogo
        
        // --- ATUALIZAÇÃO DO PLACAR ---
        const pId = msg.key.participant;
        placarEmoji[pId] = (placarEmoji[pId] || 0) + 1;
        fs.writeFileSync(ARQUIVO_PLACAR_EMOJI, JSON.stringify(placarEmoji, null, 2));

        await sock.sendMessage(sender, { 
            video: { url: jogoEmoji.gifResposta }, 
            gifPlayback: true,
            caption: `🎉 PARABÉNS! @${pId.split('@')[0]} acertou! A resposta era: *${jogoEmoji.resposta.toUpperCase()}*\n\nVocê agora tem ${placarEmoji[pId]} ponto(s) no ranking de emojis!`, 
            mentions: [pId]
        }, { quoted: msg });
    } else {
        // GIF de erro
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/VYsoMg08CSoAAAPo/faustao-silva.mp4' },
            gifPlayback: true,
            caption: "❌ Errou! Tente de novo, o jogo continua!" 
        }, { quoted: msg });
    }
}

if (text === '!rankingemoji') {
    const ranking = Object.entries(placarEmoji)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    let res = `🏆 *TOP 10 - MESTRES DOS EMOJIS*\n\n`;
    ranking.forEach((entry, i) => {
        res += `${i + 1}. @${entry[0].split('@')[0]} - ${entry[1]} pontos\n`;
    });

    await sock.sendMessage(sender, { text: res, mentions: ranking.map(e => e[0]) }, { quoted: msg });
}

// --- COMANDO !link ---
if (lowerText === '!link') {
    // 1º Ação: Reação na mensagem de quem pediu
    await sock.sendMessage(sender, { 
        react: { text: '🔗', key: msg.key } 
    });

    // Substitua pelo link real do seu grupo
    const linkDoGrupo = "https://chat.whatsapp.com/GcOAxFxsA3cGVya2n6NbSr?mode=gi_t"; 
    
    // 2º Ação: Envia a resposta com o link
    await sock.sendMessage(sender, { 
        text: `🔗 *LINK DO BONDE DO BRASIL*\n\nAqui está o link para convidar a galera:\n${linkDoGrupo}\n\n*Regra:* Não convide gringos, hein! 😂`, 
    }, { quoted: msg });
}
// --- FIM DO COMANDO !link ---

// 1. Resposta ao mencionar Bot (Versão Aleatória - Revisada e Garantida)
// 1. Resposta ao mencionar Bot (Reage com múltiplas e responde apenas no Reply)
if (lowerText.includes('bot')) {
    // --- LÓGICA DE MÚLTIPLAS REAÇÕES ---
    const reacoesPossiveis = ['🤖', '🔥', '👀', '🤙', '😎', '💥', '👻'];
    // Sorteia 3 emojis diferentes para reagir
    const reacoesEscolhidas = reacoesPossiveis.sort(() => 0.5 - Math.random()).slice(0, 3);

    // Envia as reações em sequência
    for (const emoji of reacoesEscolhidas) {
        await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });
        await new Promise(resolve => setTimeout(resolve, 300)); // Pequeno delay entre reações
    }

    // --- LÓGICA DE RESPOSTA APENAS NO REPLY ---
    // Verifica se a mensagem é um REPLY e se a mensagem original foi enviada pelo próprio BOT
    const isReply = msg.message.extendedTextMessage?.contextInfo?.participant !== undefined;
    const replyFromBot = msg.message.extendedTextMessage?.contextInfo?.fromMe === true;

    if (isReply && replyFromBot) {
        const frasesBot = [
            'Fala aí, o que você quer? Dinheiro eu não tenho',
            'Tô te ouvindo, diga...',
            'Pode falar, o que manda?',
            'Chamou? Estou aqui, processando!',
            'Diga, @{user}, estou ouvindo!'
        ];
        
        const respostaSorteada = frasesBot[Math.floor(Math.random() * frasesBot.length)];
        const nomeUsuario = participant.split('@')[0];
        const mensagemFinal = respostaSorteada.replace('{user}', nomeUsuario);
        
        // Pequena pausa antes de responder
        await new Promise(resolve => setTimeout(resolve, 800));

        await sock.sendMessage(sender, { 
            text: `🤖 *${mensagemFinal}*`, 
            mentions: [participant] 
        }, { quoted: msg });
    }
}

// 2. Dinheiro (Apenas reage)
if (lowerText.includes('dinheiro') || lowerText.includes('grana') || lowerText.includes('cash')) {
    // Sorteia um dos emojis para a reação
    const reacoes = ['💸', '💰', '🤑', '👀'];
    const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];

    // Apenas reage à mensagem original
    await sock.sendMessage(sender, { 
        react: { text: emojiSorteado, key: msg.key } 
    });
}

// 3. !SORTEAR
if (text === '!sortear') {
    try {
        const metadata = await sock.groupMetadata(sender);
        const ppts = metadata.participants;
        const sorteado = ppts[Math.floor(Math.random() * ppts.length)];
        await sock.sendMessage(sender, { 
            video: { url: "https://media.tenor.com/9o4vX6kOlUcAAAPo/cat-dance-dancing-cat.mp4" }, 
            gifPlayback: true, 
            caption: `🎲 A sorte foi lançada! O sorteado da vez foi: @${sorteado.id.split('@')[0]}`, 
            mentions: [sorteado.id] 
        }, { quoted: msg }); // Ajustado para responder em cima
    } catch (e) {
        await sock.sendMessage(sender, { text: "❌ Erro ao sortear. Verifique se sou administrador do grupo." }, { quoted: msg }); // Ajustado para responder em cima
    }
}


    // 4. Saudações
// 4. Saudações (Mensagens Motivacionais)
if (lowerText.includes('bom dia') || lowerText.includes('boa tarde') || lowerText.includes('boa noite')) {
    let emoji = '✨';
    let frases = [];

    if (lowerText.includes('bom dia')) {
        emoji = '☀️';
        frases = [
            'Bom dia! Cada novo amanhecer é uma página em branco na sua história. Escreva algo incrível hoje! ✨',
            'Bom dia! Acredite no seu potencial. Hoje é o dia perfeito para dar um passo em direção aos seus sonhos. 🚀',
            'Bom dia! Que a sua energia positiva contagie a todos ao seu redor. Tenha um dia produtivo e abençoado! 🌈',
            'Bom dia! Não deixe para amanhã o sucesso que você pode começar a construir agora mesmo. 💪',
            'Bom dia! A vida é um presente valioso. Agradeça por mais esta oportunidade de evoluir. 🎁',
            'Bom dia! O otimismo é o ímã da felicidade. Mantenha o foco no positivo e coisas boas acontecerão. ☀️'
        ];
    } else if (lowerText.includes('boa tarde')) {
        emoji = '🌤️';
        frases = [
            'Boa tarde! Respire fundo e foque no que realmente importa. Você está fazendo um ótimo trabalho! 🍃',
            'Boa tarde! O dia ainda não acabou, ainda há tempo de realizar grandes coisas. Mantenha a motivação! 🔥',
            'Boa tarde! A persistência é o caminho do êxito. Continue firme, o resultado virá. 🎯',
            'Boa tarde! Aproveite este momento para renovar as energias e seguir com força total. 🔋',
            'Boa tarde! Lembre-se: pequenas vitórias diárias constroem grandes conquistas no futuro. 🎖️',
            'Boa tarde! Que a paz e o equilíbrio acompanhem o restante do seu dia. 🕊️'
        ];
    } else if (lowerText.includes('boa noite')) {
        emoji = '🌙';
        frases = [
            'Boa noite! Descanse o corpo e a mente. Amanhã é uma nova oportunidade para brilhar. 💤',
            'Boa noite! A gratidão transforma o que temos em suficiente. Durma bem e sinta-se em paz. 🌟',
            'Boa noite! Que o seu descanso seja reparador e seus sonhos tragam inspiração. 🌌',
            'Boa noite! Desligue as preocupações e abra espaço para o descanso merecido. Você merece! 🛡️',
            'Boa noite! O sol se põe, mas a sua luz interior continua brilhando. Até amanhã! ✨',
            'Boa noite! Guarde com carinho as conquistas de hoje e prepare o coração para as de amanhã. 🌙'
        ];
    }

    const sorteio = frases[Math.floor(Math.random() * frases.length)];

    // Reação na mensagem do usuário
    await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });
    
    // Envia a mensagem de texto motivacional
    await sock.sendMessage(sender, { text: `🤖 *${sorteio}*` }, { quoted: msg });
}

        // 5. Sextou
 // 5. Sextou (Apenas reações aleatórias)
if (lowerText.includes('sextou')) {
    const reacoes = ['🥳', '🍺', '🔥', '🍹', '😜'];
    const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
    await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
}

// 6. Trabalho (Apenas reações aleatórias)
if (lowerText.includes('trabalhar') || lowerText.includes('trabalho')) {
    const reacoes = ['😰', '🤡', '☕', '😪', '💀'];
    const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
    await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
}

// 7. Bebida (Apenas reações aleatórias)
if (lowerText.includes('bebida') || lowerText.includes('cerveja') || lowerText.includes('vodka') || lowerText.includes('whisky')) {
    const reacoes = ['🍻', '🥂', '🥃', '👀', '🥴'];
    const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
    await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
}


    // 9. Comandos extras (ban, tier, matar, rank, adm, socar, beijar, fechar, abrir, musica, desmute, mute, clima)
    // *Dica: Aplique o quoted: msg em todos os sock.sendMessage dentro desses blocos também!*
    const comandosExistentes = ['!menu', '!rank', '!casar', '!avisoadm', '!emoji', '!sortear', '!jogar', '!forca', '!link', '!tier', '!rankingemoji', '!penalti', '!musica', '!socar', '!beijar', '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', '!clima', '!desmute', '!mute'];

if (text.startsWith('!') && !comandosExistentes.some(cmd => text.startsWith(cmd))) {
    const autor = msg.key.participant || msg.key.remoteJid;
    
    // Reação com o emoji 🤦‍♂️ na mensagem do usuário
    await sock.sendMessage(sender, { react: { text: '🤦‍♂️', key: msg.key } });
    
    // Resposta citando o usuário e dando a bronca
    await sock.sendMessage(sender, { 
        text: `Aí que você quer demais né, @${autor.split('@')[0]}? Olha o menu e digite esse maldito comando direito!!!!!`, 
        mentions: [autor] 
    }, { quoted: msg });
}



        // 2. !MENU
        // 2. !MENU (ESTILO PERSONALIZADO BASEADO NA IMAGEM)
        if (text === '!menu') {
    const senderId = msg.key.participant || msg.key.remoteJid; 
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // ID completo com o formato correto do seu número
    const meuId = '5527992997083@s.whatsapp.net'; 

    const menuTexto = `
╭━━ 🇧🇷 BONDE DO BRASIL 🇧🇷
│
│ Fala, @${senderId.split('@')[0]}!
│ 📅 ${dataAtual} | ⏰ ${horaAtual}
│ 👑 Criador: @5527992997083
│
├──── 🎮 JOGOS ────
│ 🔰 !rank   | ⌛ !sortear
│ 🎇 !tier    | 🎮 !jogar
│ 😵 !forca  | ⚽ !penalti
│ 🎥 !emoji
│
├──── 😂 ZUEIRA ────
│ 🤜 !socar  | 😘 !beijar
│ 🗡️ !matar  | 🤳 !f
│
├──── 🚨 ADMIN ────
│ ❌ !ban     | ❇️ !adm
│ 🚫 !fechar | 🔓 !abrir
│
├──── ⚙️ UTIL ────
│ 📛 !menu   | 🌤️ !clima
│
├──── 🛠️ SUPORTE ────
│ Problemas no BOT?
│ Chame @5527992997083
│ Ou um dos ADMs           
╰━━━━━━━━━━━━━━━╯
🤖 *Bot em evolução! Toda semana tem novas funções e jogos.*`.trim();

    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/WV_2tGerThoAAAPo/farming-aura-farming.mp4' },
        gifPlayback: true, 
        caption: menuTexto,
        // O WhatsApp vai substituir o número @5527992997083 pelo seu nome de perfil: Caio SRN🔴⚫
        mentions: [senderId, meuId] 
    }, { quoted: msg });
}
// Adicione !jogar na sua lista de comandosExistentes
if (text.startsWith('!jogar')) {
    // Reação de videogame
    await sock.sendMessage(sender, { react: { text: '🎮', key: msg.key } });

    const args = text.split(' ');
    const escolha = parseInt(args[1]);

    // Definição dos cenários possíveis
    const cenarios = [
        { nome: "Caverna Misteriosa", desc: "Você encontrou uma caverna! Escolha um caminho:" },
        { nome: "Castelo Assombrado", desc: "Você está na porta de um castelo! Escolha uma porta:" },
        { nome: "Floresta Proibida", desc: "Você se perdeu na floresta! Escolha uma trilha:" }
    ];

    // Se o usuário não digitou um número (ou número inválido)
    if (!escolha || escolha < 1 || escolha > 3) {
        const cenarioSorteado = cenarios[Math.floor(Math.random() * cenarios.length)];
        return await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/jhsMAREYalUAAAPo/pacman-gaming.mp4' }, // GIF de abertura
            gifPlayback: true,
            caption: `🎮 *RPG DO BONDE - ${cenarioSorteado.nome}*\n\n${cenarioSorteado.desc}\n\n1. Esquerda\n2. Centro\n3. Direita\n\nDigite !jogar [1, 2 ou 3]`
        }, { quoted: msg }); // Responde ao jogador corretamente
    }

    // Lógica de resultado
    const caminhoVencedor = Math.floor(Math.random() * 3) + 1;

    if (escolha === caminhoVencedor) {
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/FCtDCj3ihF8AAAPo/bugs-bunny-looney-tunes.mp4' }, 
            gifPlayback: true, 
            caption: `🏆 BOA! Você escolheu o caminho ${escolha} e encontrou um tesouro épico!`
        }, { quoted: msg });
    } else {
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/Lhwo0gmSWLcAAAPo/higuruma-jjk.mp4' }, 
            gifPlayback: true, 
            caption: `💀 Xiii... deu ruim! Você escolheu o ${escolha} e deu de cara com um monstro. O caminho certo era o ${caminhoVencedor}.`
        }, { quoted: msg });
    }
}



if (text.startsWith('!penalti')) {
    // Reação de bola de futebol
    await sock.sendMessage(sender, { react: { text: '⚽', key: msg.key } });

    const args = text.split(' ');
    const escolha = parseInt(args[1]);
    const senderId = msg.key.remoteJid;

    // Carrega o placar atual
    let placar = JSON.parse(fs.readFileSync('./placar.json', 'utf8'));
    if (!placar[senderId]) placar[senderId] = 0;

    // Mensagem inicial com GIF e respondendo a quem chamou
    if (!escolha || escolha < 1 || escolha > 3) {
        return await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/Rfz8o91xR5wAAAPo/jonathan-david-jo-david.mp4' }, 
            gifPlayback: true,
            caption: `⚽ *DISPUTA DE PÊNALTIS*\n\nSeu total de gols: ${placar[senderId]}\n\nEscolha o canto para bater o pênalti: 1, 2 ou 3`
        }, { quoted: msg });
    }

    const defesa = Math.random() < 0.5;
    if (!defesa) {
        placar[senderId] += 1;
        fs.writeFileSync('./placar.json', JSON.stringify(placar, null, 2));
        await sock.sendMessage(sender, { 
            caption: `⚽ GOOOOOL! Você marcou! Total de gols: ${placar[senderId]}`, 
            video: { url: 'https://media.tenor.com/vnXD4h47_ZwAAAPo/kick-goal.mp4' }, 
            gifPlayback: true
        }, { quoted: msg });
    } else {
        await sock.sendMessage(sender, { 
            caption: `🧤 DEFESA! O goleiro pegou. Seu total continua ${placar[senderId]} gols.`, 
            video: { url: 'https://media.tenor.com/AdTJAjjVaIkAAAPo/goalkeeper.mp4' }, 
            gifPlayback: true
        }, { quoted: msg });
    }
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

// 5. !SOCAR (Com Reply e Frases Aleatórias)
        if (text.startsWith('!socar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) {
                const frasesSoco = [
                    `TOMAAAAAAAA 😤😤!!!! O @${participant.split('@')[0]} deu um soco no @${mention.split('@')[0]}! 🤜`,
                    `VRAU! 💥 O @${participant.split('@')[0]} perdeu a paciência e mandou o @${mention.split('@')[0]} pra lona!`,
                    `EITA! O @${participant.split('@')[0]} não perdoou e desceu o cacete no @${mention.split('@')[0]}! 🥊`,
                    `O clima fechou! O @${participant.split('@')[0]} aplicou um golpe certeiro no @${mention.split('@')[0]}! 💥`
                ];
                const sorteioSoco = frasesSoco[Math.floor(Math.random() * frasesSoco.length)];

                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/6Cp5tiRwh-YAAAPo/meme-memes.mp4' }, 
                    gifPlayback: true, 
                    caption: sorteioSoco,
                    mentions: [participant, mention]
                }, { quoted: msg }); // Adicionado reply aqui
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém!", quoted: msg });
            }
        }

        // 5.2 !CASAR (Com Reply, Reação de Aliança e Frases)
if (text.startsWith('!casar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mention) {
        const quemCasa = participant.split('@')[0];
        const quemRecebe = mention.split('@')[0];
        
        const frasesCasamento = [
            `O @${quemCasa} pediu o @${quemRecebe} em casamento! Agora é só aguentar a sogra! 💍`,
            `Socorro! @${quemCasa} e @${quemRecebe} decidiram casar. O buffet vai ser pão com ovo? 😂`,
            `Alguém chame o padre! @${quemCasa} oficializou o romance com @${quemRecebe}! 💒`,
            `O @${quemCasa} perdeu a liberdade e casou com o @${quemRecebe}! Meus pêsames... digo, parabéns! 💍`,
            `Direto para o altar! @${quemCasa} e @${quemRecebe} formam o novo casal do pedaço. Quem paga o divórcio? 👰🤵`
        ];
        const sorteioCasamento = frasesCasamento[Math.floor(Math.random() * frasesCasamento.length)];

        // Reação de aliança na mensagem de quem pediu
        await sock.sendMessage(sender, { react: { text: '💍', key: msg.key } });

        await sock.sendMessage(sender, { 
            video: { url: "https://media.tenor.com/h981yJykAXYAAAPo/la-haut-dessin-anime.mp4" }, // Link de exemplo de casamento
            gifPlayback: true,
            caption: sorteioCasamento, 
            mentions: [participant, mention] 
        }, { quoted: msg }); // Reply garantido
    } else {
        await sock.sendMessage(sender, { text: "❌ Mencione alguém para casar!", quoted: msg });
    }
}

        // 5.1 !BEIJAR (Com Reply e Frases Aleatórias)
        if (text.startsWith('!beijar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) {
                const quemBeija = participant.split('@')[0];
                const quemRecebe = mention.split('@')[0];
                const frasesBeijo = [
                    `O @${quemBeija} está dando um beijão no @${quemRecebe}! Que clima de romance... 💋`,
                    `Oh lá lá! O @${quemBeija} tascou um beijo apaixonado no @${quemRecebe}! 👩‍❤️‍💋‍👨`,
                    `O amor está no ar! @${quemBeija} beijou o @${quemRecebe} e deixou todo mundo sem graça. 😍`,
                    `Clima de romance! @${quemBeija} e @${quemRecebe} protagonizaram um beijão de cinema! 💘`
                ];
                const sorteioBeijo = frasesBeijo[Math.floor(Math.random() * frasesBeijo.length)];
                
                await sock.sendMessage(sender, { 
                    video: { url: "https://media.tenor.com/eCNrTq7wOpgAAAPo/kiss.mp4" }, 
                    gifPlayback: true,
                    caption: sorteioBeijo, 
                    mentions: [participant, mention] 
                }, { quoted: msg }); // Adicionado reply aqui
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém para beijar!", quoted: msg });
            }
        }

        // 6. Admin Fechar/Abrir (Com Reply e Frases Aleatórias)
if (text === '!fechar') {
    if (!isAdmin) {
        const frasesErro = [
            "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?",
            "Ops! Você não tem o poder necessário para isso, melhor não brincar com o perigo! 🚫",
            "Ih, ala! O engraçadinho quer fechar o grupo? Deixa isso com quem manda! 🤡"
        ];
        const msgErro = frasesErro[Math.floor(Math.random() * frasesErro.length)];
        await sock.sendMessage(sender, { text: msgErro, quoted: msg });
    } else {
        const frasesAdm = [
            "SILÊNCIO!!!!!!!!! Fechei mesmo🤫, Um ADM vai querer anunciar alguma coisa🫡🫡🫡",
            "Grupo fechado! Todo mundo de boca calada, hora de ouvir os chefes! 🤐",
            "Cala a boca todo mundo! O grupo está em modo de anúncio! 📢"
        ];
        const msgAdm = frasesAdm[Math.floor(Math.random() * frasesAdm.length)];
        await sock.sendMessage(sender, { text: msgAdm, quoted: msg });
        await sock.groupSettingUpdate(sender, 'announcement');
    }
}

if (text === '!abrir') {
    if (!isAdmin) {
        const frasesErro = [
            "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?",
            "Tá achando que é dono do pedaço? Acesso negado, amigão! 🚫",
            "Negativo! Só ADM manda aqui, volta pra sua cadeira! 😂"
        ];
        const msgErro = frasesErro[Math.floor(Math.random() * frasesErro.length)];
        await sock.sendMessage(sender, { text: msgErro, quoted: msg });
    } else {
        const frasesAdm = [
            "Pronto, podem falar a vontade bando de desempregados HAHAHAHA.😂😂",
            "Grupo aberto! Podem soltar os cachorros e começar a bagunça de novo! 🔓",
            "Liberado para conversas! O silêncio acabou, podem gastar o teclado! ⌨️"
        ];
        const msgAdm = frasesAdm[Math.floor(Math.random() * frasesAdm.length)];
        await sock.sendMessage(sender, { text: msgAdm, quoted: msg });
        await sock.groupSettingUpdate(sender, 'not_announcement');
    }
}

        // 7. Música e Figurinha
        // Adicione lá no topo do arquivo (junto com os outros 'require')

// Dentro de sock.ev.on('messages.upsert', ...), substitua o seu bloco !musica atual por este:
// 7. Música e Figurinha// Altere para um nome que não conflite com o seu !adm atual
if (text === '!avisoadm') { 
    if (!msg.key.remoteJid.endsWith('@g.us')) {
        return await sock.sendMessage(sender, { text: 'Este comando só funciona em grupos!' }, { quoted: msg });
    }

    try {
        const metadata = await sock.groupMetadata(msg.key.remoteJid);
        const participantes = metadata.participants;
        
        // 1. Identifica quem enviou a mensagem
        const autorId = msg.key.participant || msg.key.remoteJid;
        const autorDados = participantes.find(p => p.id === autorId);

        // 2. Verifica se o autor é administrador
        const ehAdmin = autorDados && autorDados.admin !== null;

        if (!ehAdmin) {
            return await sock.sendMessage(sender, { text: '❌ Sai pra lá, apenas administradores podem usar este comando.' }, { quoted: msg });
        }

        // 3. Prossegue com a busca dos ADMs para notificar
        const admins = participantes.filter(p => p.admin !== null).map(p => p.id);

        if (admins.length === 0) {
            return await sock.sendMessage(sender, { text: 'Não encontrei administradores neste grupo.' }, { quoted: msg });
        }

        const mençãoAdm = `📢 *ATENÇÃO ADMS!* \n\nPrecisamos de uma reunião ou verificação urgente. \n\n${admins.map(adm => `@${adm.split('@')[0]}`).join(' ')}`;

        await sock.sendMessage(sender, { 
            text: mençãoAdm, 
            mentions: admins 
        }, { quoted: msg });

    } catch (error) {
        console.error('Erro ao chamar ADMs:', error);
    }
}
        // Substitua seu bloco !musica por este:
// Você precisará instalar: npm install ytsr (para buscar) e usar uma API que entregue o stream direto
// Como o YouTube é a fonte de quase tudo, vou manter a busca, mas forçar o envio como ÁUDIO.
if (text.startsWith('!musica ')) {
    const busca = text.replace('!musica ', '');
    try {
        await sock.sendMessage(sender, { text: "Calma aí apressado, 🔍 Buscando sua música..." });
        

        const searchResults = await ytsr(busca, { limit: 1 });
        const video = searchResults.items[0];
        
        if (!video) return await sock.sendMessage(sender, { text: "❌ Não encontrado." });

        // Enviamos apenas o link. É seguro, não bloqueia o bot e não exige processamento pesado do Render.
        const mensagem = `🎵 *Música Encontrada!*\n\n` +
                         `🎤 *Título:* ${video.title}\n` +
                         `🔗 *Link:* ${video.url}\n\n` +
                         `🤖 *Dica:* Como o YouTube bloqueia tentativas de extrair áudio direto, estou te mandando o link para você ouvir com tranquilidade!`;

        await sock.sendMessage(sender, { text: mensagem }, { quoted: msg });

    } catch (e) {
        console.error(e);
        await sock.sendMessage(sender, { text: "❌ O YouTube está protegendo demais o conteúdo agora. Tente novamente mais tarde." });
    }
}
       
// --- BLOCO DO JOGO DA FORCA ---
    // 1. Comando de Início
    if (text.startsWith('!forca')) {
        const palavrasHard = ['abstrato', 'efemeridade', 'paradoxo', 'onisciente', 'idiossincrasia', 'inexoravel'];
        const palavrasMedio = ['arquitetura', 'paradigma', 'recursividade', 'criptografia', 'abstração', 'framework'];
        
        const dicasHard = {
            'abstrato': 'Algo que não é concreto, uma ideia ou conceito.',
            'efemeridade': 'Algo que dura pouco tempo.',
            'paradoxo': 'Uma contradição que parece verdadeira.',
            'onisciente': 'Alguém que sabe tudo.',
            'idiossincrasia': 'Uma característica peculiar de alguém.',
            'inexoravel': 'Algo que não se pode evitar ou dobrar.'
        };
        const dicasMedio = {
            'arquitetura': 'A estrutura lógica ou física de um sistema.',
            'paradigma': 'Um modelo ou padrão a ser seguido.',
            'recursividade': 'Uma função que chama a si mesma.',
            'criptografia': 'Transformar informação em código para proteger dados.',
            'abstração': 'Esconder detalhes complexos e mostrar apenas o essencial.',
            'framework': 'Um conjunto de ferramentas que facilita o desenvolvimento de software.'
        };

        // Decide entre Hard ou Medio
        const nivel = Math.random() > 0.5 ? 'hard' : 'medio';
        const listaPalavras = nivel === 'hard' ? palavrasHard : palavrasMedio;
        const listaDicas = nivel === 'hard' ? dicasHard : dicasMedio;

        jogoForca.palavra = listaPalavras[Math.floor(Math.random() * listaPalavras.length)];
        jogoForca.dica = listaDicas[jogoForca.palavra];
        jogoForca.descobertas = Array(jogoForca.palavra.length).fill('_');
        jogoForca.tentativas = [];
        jogoForca.ativo = true;
        jogoForca.erros = 0;
        jogoForca.maxErros = 6;

        const msgForca = await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/7HUogy7rXs4AAAPo/feel-me-think-about-it.mp4' }, 
            gifPlayback: true,
            caption: `💀 *JOGO DA FORCA (${nivel.toUpperCase()})*\n\nDica: ${jogoForca.dica}\n\nPalavra: ${jogoForca.descobertas.join(' ')}\n\nResponda em cima dessa mensagem com uma letra ou a palavra toda!` 
        }, { quoted: msg });
        jogoForca.idMensagem = msgForca.key.id; 
        return;
    }


    // 2. Lógica de Adivinhação
    if (jogoForca.ativo && !jogoForca.processando) {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo || 
                            msg.message?.imageMessage?.contextInfo || 
                            msg.message?.videoMessage?.contextInfo;

        if (contextInfo?.stanzaId === jogoForca.idMensagem && !text.startsWith('!')) {
            jogoForca.processando = true;
            const resposta = text.toLowerCase().trim();
            const autor = msg.key.participant || msg.key.remoteJid;

            // 1. TENTAR PALAVRA COMPLETA (MAIS DE UMA LETRA)
            if (resposta.length > 1) {
                if (resposta === jogoForca.palavra) {
                    jogoForca.ativo = false;
                    await sock.sendMessage(sender, { react: { text: '🎉', key: msg.key } });
                    await sock.sendMessage(sender, { 
                        video: { url: 'https://media.tenor.com/eakvOpIu7fAAAAPo/sarcastic-clap.mp4' }, 
                        gifPlayback: true, 
                        caption: `🎉 PARABÉNS @${autor.split('@')[0]}! Você acertou a palavra completa: *${jogoForca.palavra.toUpperCase()}*`,
                        mentions: [autor]
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(sender, { text: `QUASE!! Mas não é HAHAHAHA, tente novamente! 🤡`, quoted: msg });
                }
            } 
            // 2. TENTAR LETRA ÚNICA
            else if (resposta.length === 1) {
                const letra = resposta;
  
                if (jogoForca.tentativas.includes(letra)) {
                    await sock.sendMessage(sender, { text: `⚠️ @${autor.split('@')[0]}, você já tentou a letra "${letra.toUpperCase()}".`, mentions: [autor] }, { quoted: msg });
                } else {
                    jogoForca.tentativas.push(letra);
       
                    if (jogoForca.palavra.includes(letra)) {
                        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                        for (let i = 0; i < jogoForca.palavra.length; i++) {
                            if (jogoForca.palavra[i] === letra) jogoForca.descobertas[i] = letra;
                        }
    
                        if (!jogoForca.descobertas.includes('_')) {
                            jogoForca.ativo = false;
                            await sock.sendMessage(sender, { text: `🎉 PARABÉNS @${autor.split('@')[0]}! Você salvou a alma dele! A palavra era: *${jogoForca.palavra.toUpperCase()}*`, mentions: [autor] }, { quoted: msg });
                        } else {
                            await sock.sendMessage(sender, { text: `Boa, campeão @${autor.split('@')[0]}!! Continue: ${jogoForca.descobertas.join(' ')}`, mentions: [autor] });
                        }
                    } else {
                        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                        jogoForca.erros++;
                        if (jogoForca.erros >= jogoForca.maxErros) {
                            jogoForca.ativo = false;
                            await sock.sendMessage(sender, { 
                                video: { url: 'https://media.tenor.com/HyeG4dSurbwAAAPo/hanging-skeleton-skeleton.mp4' }, 
                                gifPlayback: true, 
                                caption: `💀 VOCÊ PERDEU, @${autor.split('@')[0]}! A palavra era *${jogoForca.palavra.toUpperCase()}*`,
                                mentions: [autor]
                            }, { quoted: msg });
                        } else {
                            await sock.sendMessage(sender, { text: `❌ Errou, @${autor.split('@')[0]}! ${jogoForca.maxErros - jogoForca.erros} vidas restando.`, mentions: [autor] });
                        }
                    }
                }
            }

            setTimeout(() => { jogoForca.processando = false; }, 1000); 
        }
    }
    // --- FIM DA LÓGICA DA FORCA ---
        // 8. COMANDO CLIMA (COM DIAGNÓSTICO)
        if (text.startsWith('!desmute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention && mutados[mention]) {
                delete mutados[mention];
                // ADICIONE ESSA LINHA PARA SALVAR A REMOÇÃO NO ARQUIVO:
                fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                
                await sock.sendMessage(sender, { text: "Fala agora, mas com cuidado, ok? To doidinho pra mutar de novo😎😂", mentions: [mention] });
            }
        }
        // 4. COMANDO !MUTE (CORRIGIDO)
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
            
            fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
            await sock.sendMessage(sender, { text: "Você está falando demais, dá um tempo seu rabugento.😂❌", mentions: [mention] });
        }
        // 8. COMANDO CLIMA (TRADUZIDO)
       // 8. COMANDO CLIMA (Forçando o Reply com variável constante)
// 8. COMANDO CLIMA (Com frases engraçadas!)
if (text.startsWith('!clima')) {
    const cidade = text.replace('!clima', '').trim();
    if (!cidade) return await sock.sendMessage(sender, { text: "❌ Digite a cidade! Ex: !clima Cariacica", quoted: msg });

    const mensagemParaResponder = msg;

    // Objeto com frases engraçadas por condição
    const piadasClima = {
        'sunny': [
            "Tá um sol pra cada um, né? Não derrete não, hein! 😂",
            "Céu limpo... perfeito pra ficar no ar-condicionado e não fazer nada. ☀️",
            "Esse sol tá mais forte que minha vontade de ganhar na mega-sena. 🔥"
        ],
        'cloudy': [
            "Tempo nublado... o clima perfeito pra uma depressão motivacional. ☁️",
            "Tá nublado, mas minha alma continua brilhando... ou quase isso. 🤡",
            "Céu cinza, igual à minha cara quando vejo o boleto chegando. 💸"
        ],
        'rain': [
            "Chuva? Ótimo, agora minha preguiça tem justificativa oficial! 🌧️",
            "Tá chovendo, o clima perfeito pra dormir e esquecer da vida. 💤",
            "Se molhar na chuva dá gripe, então fica em casa assistindo série! 📺"
        ]
    };

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
        if (err || !result || result.length === 0) {
            return await sock.sendMessage(sender, { text: "❌ Cidade não encontrada.", quoted: mensagemParaResponder });
        }
        
        const current = result[0].current;
        const condicaoOriginal = current.skytext.toLowerCase();
        const condicaoTraduzida = traduzir(current.skytext);
        
        // Define uma frase engraçada baseada na condição
        let fraseExtra = "";
        if (condicaoOriginal.includes('sunny') || condicaoOriginal.includes('clear')) {
            fraseExtra = piadasClima['sunny'][Math.floor(Math.random() * piadasClima['sunny'].length)];
        } else if (condicaoOriginal.includes('cloudy')) {
            fraseExtra = piadasClima['cloudy'][Math.floor(Math.random() * piadasClima['cloudy'].length)];
        } else if (condicaoOriginal.includes('rain')) {
            fraseExtra = piadasClima['rain'][Math.floor(Math.random() * piadasClima['rain'].length)];
        }

        const msgClima = `🌤 *Tempo em: ${current.observationpoint}*\n` +
                         `🌡 Temperatura: ${current.temperature}°C\n` +
                         `☁️ Condição: ${condicaoTraduzida}\n\n` +
                         (fraseExtra ? `💬 *Bot:* ${fraseExtra}` : "");
        
        // REAÇÃO
        await sock.sendMessage(sender, { react: { text: '🌤', key: mensagemParaResponder.key } });

        // RESPOSTA COM BALÃO (REPLY)
        await sock.sendMessage(sender, { text: msgClima }, { quoted: mensagemParaResponder });
    });
}
    }); // Fecha o messages.upsert
} // Fecha o connectToWhatsApp
connectToWhatsApp();
