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
    
    const participant = msg.key.participant || msg.key.remoteJid;
    const sender = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

    // Verificação de Mutados
    if (mutados[participant] && Date.now() < mutados[participant]) {
        await sock.sendMessage(sender, { delete: msg.key });
        return; 
    }

    // --- LÓGICA DO ANTI-LINK COM AUTO BAN ---
    // --- INÍCIO DO ANTI-LINK COM AUTO BAN ---
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
    // --- FIM DO ANTI-LINK ---

   // --- INÍCIO DO ANTI-TRAVA ---
    if (text.length > 5000) {
        const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
        const isAdmin = await getIsAdmin();

        if (!isAdmin) {
            // BUSCA OS ADMS PARA MARCAR NO ALERTA
            const metadata = await sock.groupMetadata(sender);
            const admins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
            const mentions = [participant, ...admins];

            // AÇÃO: Deleta e manda o alerta chamando os ADMs
            await sock.sendMessage(sender, { delete: msg.key });
            
            await sock.sendMessage(sender, { 
                text: `🚨 *ALERTA DE SEGURANÇA!* 🚨\n\nO membro @${participant.split('@')[0]} tentou enviar uma trava pesada e o sistema bloqueou!\n\n${admins.map(adm => `@${adm.split('@')[0]}`).join(' ')} -> *Fiquem de olho neste membro!*`, 
                mentions: mentions
            }, { quoted: msg });
            
            return; // Interrompe para não contar no rank
        } else {
            // AÇÃO PARA ADMS (Reage e faz a graça)
            await sock.sendMessage(sender, { react: { text: '😂', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `Chefe, precisa falar tanto assim? Se for assim escreve um novo testamento logo 😂😂😂`,
            }, { quoted: msg });
        }
    }
    // --- INÍCIO DO ANTI-SPAM ---
    const agora = Date.now();
    const tempoMinimo = 1000; // 2 segundos

    if (ultimaMensagem[participant] && (agora - ultimaMensagem[participant] < tempoMinimo)) {
        
        const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
        const isAdmin = await getIsAdmin();
        
        if (!isAdmin) {
            // REAÇÃO DE PARAR PARA MEMBRO
            await sock.sendMessage(sender, { react: { text: '🛑', key: msg.key } });
            
            // Muta por 1 minuto
            mutados[participant] = Date.now() + 60000; 
            fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));

            await sock.sendMessage(sender, { 
                text: `🚫 @${participant.split('@')[0]}, você está floodando demais! Você foi mutado por 1 minuto para acalmar os ânimos.`, 
                mentions: [participant] 
            }, { quoted: msg });
            return; 
        } else {
            // REAÇÃO DE RISO PARA ADM (já que não vamos mutar ele)
            await sock.sendMessage(sender, { react: { text: '😨', key: msg.key } });
            
            await sock.sendMessage(sender, { 
                text: `Calma chefe, não precisa ser tão rápido! 😂`, 
            }, { quoted: msg });
        }
    }
    ultimaMensagem[participant] = agora;
    // --- FIM DO ANTI-SPAM ---
    // ... daqui pra baixo continua o seu código normal (contagemMensagens, etc)
    
   
    
    contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
    fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens));
    
    const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
    const isAdmin = await getIsAdmin();

    const lowerText = text.toLowerCase();

    if (text.startsWith('!emoji')) {
    const desafios = [
        // Nível Fácil / Médio (Os que você já tinha)
        { emojis: '🕵️‍♂️🔍🏠', resposta: 'sherlock holmes', gif: 'https://media.tenor.com/dR3xtJ5WbFYAAAPo/sherlock-sherlock-holmes.mp4' },
        { emojis: '🚢🧊💔', resposta: 'titanic', gif: 'https://media.tenor.com/cT1pz8_yZGIAAAPo/titanic.mp4' },
        { emojis: '🦁👑🌅', resposta: 'rei leão', gif: 'https://media.tenor.com/LgB11V1I0IwAAAPo/simba.mp4' },
        { emojis: '⚡👓🏰', resposta: 'harry potter', gif: 'https://media.tenor.com/Rg2bz-jI430AAAPo/harry-potter-harry-potter-and-the-halfblood-prince.mp4' },
        { emojis: '🏎️💨🗼', resposta: 'velozes e furiosos', gif: 'https://media.tenor.com/RaoeC9AmN1QAAAPo/brian-o%27conner-paul-walker.mp4' },
        { emojis: '🤡🎈⛵', resposta: 'it', gif: 'https://media.tenor.com/GHeNyQYLEPEAAAPo/pennywise-clown.mp4' },

        // Nível Difícil / Ninja (Novos)
        { emojis: '👨‍🚀⏳🌌🌽', resposta: 'interestelar', gif: 'https://media.tenor.com/8wane_Lo91UAAAPo/no-no.mp4' },
        { emojis: '🧼👊🏢🏠', resposta: 'clube da luta', gif: 'https://media.tenor.com/NCis2CAc2akAAAPo/%D1%82%D0%B0%D0%B9%D0%BB%D0%BE%D1%80.mp4' },
        { emojis: '📺🌊🏙️🤥', resposta: 'o show de truman', gif: 'https://media.tenor.com/yMmkrRze98AAAAPo/jim-carrey-jim-carrey-snapchat.mp4' },
        { emojis: '👴💍🌋👁️', resposta: 'senhor dos aneis', gif: 'https://media.tenor.com/H2GZj21Q91YAAAPo/gandalf-lord-of-the-rings.mp4' },
        { emojis: '💊🐇🕶️🏢', resposta: 'matrix', gif: 'https://media.tenor.com/gw1yNsaFmlMAAAPo/matrix-neo.mp4' },
        { emojis: '👨‍👩‍👧‍👦🏠🔪😱', resposta: 'pânico', gif: 'https://media.tenor.com/Abk4lKtoJ3sAAAPo/omw-ghostface.mp4' },
        { emojis: '🦈🏖️🩸🌊', resposta: 'tubarão', gif: 'https://media.tenor.com/Y2mOLAczQo0AAAPo/insainment-mind-space-apocalypse.mp4' },
        { emojis: '🚀👩‍🚀👽🩸', resposta: 'alien', gif: 'https://media.tenor.com/8ybNfbAsL5YAAAPo/alien-creepy.mp4' }
    ];
    
    const sorteado = desafios[Math.floor(Math.random() * desafios.length)];
    
    // GIF de entrada
    const msgDesafio = await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/-0sxz-2EfwcAAAPo/batman-thinking.mp4' },
        gifPlayback: true,
        caption: `🧩 *ADIVINHE O FILME/SÉRIE:* \n\n${sorteado.emojis}\n\nResponda dando reply (em cima) nesta mensagem!`,
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
if (lowerText.includes('bot')) {
    const frasesBot = [
        { frase: 'Fala aí @{user}, tá falando de mim, por que? Quer morrer? 🔫👀', reacao: '🔫' },
        { frase: 'Chamou o bot? Espero que não seja pra pedir dinheiro, porque eu sou pobre igual a você @{user}! 😂', reacao: '💸' },
        { frase: 'Diga @{user}, o que você quer? Estou ocupado processando códigos e ignorando sua existência... Mentira, fala aí! 😎', reacao: '🤖' },
        { frase: 'Quem invocou o @{user} para me chamar? Fala logo antes que eu te mute! 🤐', reacao: '⚠️' },
        { frase: 'Tô aqui, @{user}! Se for pra mandar link de grupo de venda, nem precisa terminar a frase. 😠', reacao: '🚫' },
        { frase: 'Estou sentindo cheiro de alguém precisando de ajuda... ou é só o @{user} mesmo? 🤔', reacao: '🕵️‍♂️' }
    ];

    // Sorteia o índice (para garantir que usamos o mesmo para frase e reação)
    const indice = Math.floor(Math.random() * frasesBot.length);
    const sorteio = frasesBot[indice];
    
    // Substitui o placeholder {user} pelo nome do usuário
    const nomeUsuario = participant.split('@')[0];
    const mensagemFinal = sorteio.frase.replace('{user}', nomeUsuario);

    // 1º Ação: Reação (O emoji que você quer que apareça no balão da mensagem do usuário)
    await sock.sendMessage(sender, { 
        react: { text: sorteio.reacao, key: msg.key } 
    });

    // Pequena pausa para o WhatsApp processar a reação (opcional, mas ajuda)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2º Ação: A resposta do bot
    await sock.sendMessage(sender, { 
        text: `🤖 *${mensagemFinal}*`, 
        mentions: [participant] 
    }, { quoted: msg });
}

// 2. Dinheiro
if (lowerText.includes('dinheiro') || lowerText.includes('grana') || lowerText.includes('cash')) {
    const opcoes = [
        { frase: 'Opa, falou em dinheiro? Tá sobrando ou tá faltando, meu parceiro? 💸👀', url: 'https://media.tenor.com/cLjA_QYEHesAAAPo/grana.mp4' },
        { frase: 'Dinheiro não traz felicidade, mas ajuda a financiar a busca por ela! 💰🚀', url: 'https://media.tenor.com/yEFkhHoLd2MAAAPo/money.mp4' },
        { frase: 'Meu dinheiro entra na conta e sai na velocidade da luz, nem dá pra fazer amizade. 🏃‍♂️💨', url: 'https://media.tenor.com/OVynAhvE120AAAPo/money.mp4' },
        { frase: 'Se alguém aí estiver com dinheiro sobrando, aceito doações via Pix para o projeto do meu bot! 🤖💸', url: 'https://media.tenor.com/f8acChNvdVMAAAPo/poor.mp4' }
    ];
    
    // Sorteia um dos objetos da lista de opções
    const sorteio = opcoes[Math.floor(Math.random() * opcoes.length)];

    await sock.sendMessage(sender, { react: { text: '💸', key: msg.key } });
    await sock.sendMessage(sender, { 
        video: { url: sorteio.url }, 
        gifPlayback: true, 
        caption: `🤖 *${sorteio.frase}*` 
    }, { quoted: msg });
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
    // 4. Saudações
    if (lowerText.includes('bom dia') || lowerText.includes('boa tarde') || lowerText.includes('boa noite')) {
    let emoji = '☀️';
    let opcoes = [];

    if (lowerText.includes('bom dia')) {
        emoji = '☀️';
        opcoes = [
            { frase: 'Bom dia! Dormi igual a um anjo, acordei igual a um boleto vencido. 😂', url: 'https://media.tenor.com/7HPdFKRYFwMAAAPo/thank-you.mp4' },
            { frase: 'Bom dia, gente! Acordar cedo é uma decisão que tomo todos os dias, mas me arrependo em todas elas. ☕', url: 'https://media.tenor.com/3uHpirQd8qgAAAPo/max1-maxz.mp4' },
            { frase: 'Bom dia! Se a vida te der limões, faça uma limonada... ou venda e compre café. 🍋', url: 'https://media.tenor.com/8LQ_HOzhCbUAAAPo/ni%CC%87che-frui%CC%87t-lemon-eati%CC%87ng-ni%CC%87che.mp4' },
            { frase: 'Bom dia! Que a preguiça nos visite, mas que o trabalho não nos veja. 😴', url: 'https://media.tenor.com/0RCfPxdUCs8AAAPo/dvfedvr.mp4' }
        ];
    } else if (lowerText.includes('boa tarde')) {
        emoji = '🌤️';
        opcoes = [
            { frase: 'Boa tarde! Que a força do café esteja comigo, porque a minha já acabou. 💔', url: 'https://media.tenor.com/C78aGUgwTEYAAAPo/good-afternoon-rollygifs.mp4' },
            { frase: 'Boa tarde! O dia tá passando mais rápido que meu salário na mão. 💸', url: 'https://media.tenor.com/Atn_x9ecziUAAAPo/cat-dance-on-door-glass-door-window-jump.mp4' },
            { frase: 'Boa tarde! Se alguém precisar de mim, estarei ali na esquina... ou em lugar nenhum. 😎', url: 'https://media.tenor.com/0kRkOqvKwBgAAAPo/mr-bean-middle-finger.mp4' },
            { frase: 'Boa tarde! Trabalhando muito ou trabalhando pouco? O importante é que tá acabando. ⏳', url: 'https://media.tenor.com/5gOeuHmLaLoAAAPo/spongebob-wipe.mp4' }
        ];
    } else if (lowerText.includes('boa noite')) {
        emoji = '🌙';
        opcoes = [
            { frase: 'Boa noite! Que o seu sono seja tão profundo quanto o saldo negativo da minha conta. 🥱', url: 'https://media.tenor.com/p4y_zlIm1MMAAAPo/donald-duck-sleep.mp4' },
            { frase: 'Boa noite! Fechando os olhos e rezando pra não lembrar de nenhum email que esqueci de enviar. 😵‍💫', url: 'https://media.tenor.com/Ptpt40WGI_cAAAPo/boa-noite-valtatui-good-night.mp4' },
            { frase: 'Boa noite! Hora de sonhar com o feriado que nunca chega. 💤', url: 'https://media.tenor.com/R3mUg2FCAPIAAAPo/cute-sleepy.mp4' },
            { frase: 'Boa noite! Durmam bem, porque amanhã a luta recomeça e a gente nem teve folga hoje. 🌙', url: 'https://media.tenor.com/VYO7Ra0DP5wAAAPo/good-night-my-love.mp4' }
        ];
    }

    // Sorteia um dos objetos da lista de opções
    const sorteio = opcoes[Math.floor(Math.random() * opcoes.length)];

    await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });

    await sock.sendMessage(sender, { 
        video: { url: sorteio.url }, 
        gifPlayback: true, 
        caption: `🤖 *${sorteio.frase}*` 
    }, { quoted: msg }); 
}

        // 5. Sextou
    // 5. Sextou
if (lowerText.includes('sextou')) {
    const opcoes = [
        { frase: 'Sextou! Corpo no trabalho, mente no primeiro gole de cerveja. 🍺😜', url: 'https://media.tenor.com/IuZs76jQrG4AAAPo/sextou-familia.mp4' },
        { frase: 'Sextou! Se não for pra sair e não lembrar de nada, eu nem vou. 🥳', url: 'https://media.tenor.com/pcnxt7DCraEAAAPo/beer-time.mp4' },
        { frase: 'Sextou! O juízo foi embora, só sobrou a vontade de ser feliz. 🍹', url: 'https://media.tenor.com/M6l-hGumk70AAAPo/sexta-feira-bacano-bacano.mp4' }
    ];
    const sorteio = opcoes[Math.floor(Math.random() * opcoes.length)];

    await sock.sendMessage(sender, { react: { text: '🥳', key: msg.key } });
    await sock.sendMessage(sender, { video: { url: sorteio.url }, gifPlayback: true, caption: `🤖 *${sorteio.frase}*` }, { quoted: msg });
}

// 6. Trabalho
if (lowerText.includes('trabalhar') || lowerText.includes('trabalho')) {
    const opcoes = [
        { frase: 'Se trabalho desse dinheiro, o dono da empresa não estaria milionário enquanto eu tomo café morno. 😪☕️', url: 'https://media.tenor.com/VYVw1CNLUcAAAAPo/xarutinho-xarutinhorp.mp4' },
        { frase: 'Trabalhar é bom, mas você já tentou ganhar na loteria? Recomendo muito! 💸', url: 'https://media.tenor.com/Mrc7_H7ikhEAAAPo/spongebob-tired.mp4' },
        { frase: 'O trabalho dignifica o homem, mas o salário é o que mantém a dignidade em dia. 🤡', url: 'https://media.tenor.com/Q5pvPnsEVVUAAAPo/kid-baby.mp4' }
    ];
    const sorteio = opcoes[Math.floor(Math.random() * opcoes.length)];

    await sock.sendMessage(sender, { react: { text: '😰', key: msg.key } });
    await sock.sendMessage(sender, { video: { url: sorteio.url }, gifPlayback: true, caption: `🤖 *${sorteio.frase}*` }, { quoted: msg });
}

// 7. Bebida
if (lowerText.includes('bebida') || lowerText.includes('cerveja') || lowerText.includes('vodka') || lowerText.includes('whisky')) {
    const opcoes = [
        { frase: 'Opa, falou em bebida???? 👀👀👀👀', url: 'https://media.tenor.com/6ZIClIzEuGwAAAPo/drink-dog.mp4' },
        { frase: 'Bebida é o combustível que a alma pede e o fígado chora. 🍻', url: 'https://media.tenor.com/fiZF0zR-nU0AAAPo/xwf-harvey.mp4' },
        { frase: 'Eu não bebo, eu apenas faço degustação alcoólica intensiva! 🥂', url: 'https://media.tenor.com/hLj93cc8UJEAAAPo/monkey-sipping-straw-monkey.mp4' }
    ];
    const sorteio = opcoes[Math.floor(Math.random() * opcoes.length)];

    await sock.sendMessage(sender, { react: { text: '🍻', key: msg.key } });
    await sock.sendMessage(sender, { video: { url: sorteio.url }, gifPlayback: true, caption: `🤖 *${sorteio.frase}*` }, { quoted: msg });
}


    // 9. Comandos extras (ban, tier, matar, rank, adm, socar, beijar, fechar, abrir, musica, desmute, mute, clima)
    // *Dica: Aplique o quoted: msg em todos os sock.sendMessage dentro desses blocos também!*
    const comandosExistentes = ['!menu', '!rank', '!avisoadm', '!emoji', '!sortear', '!jogar', '!forca', '!tier', '!rankingemoji', '!penalti', '!musica', '!socar', '!beijar', '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', '!clima', '!desmute', '!mute'];

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

        // 5. !SOCAR
        if (text.startsWith('!socar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mention) {
        // Exemplo de como enviar um GIF junto com a mensagem
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/6Cp5tiRwh-YAAAPo/meme-memes.mp4' }, // O WhatsApp entende vídeo/gif
            gifPlayback: true, // Isso faz o arquivo tocar como GIF
            caption: `TOMAAAAAAAA 😤😤!!!! O @${participant.split('@')[0]} deu um soco no @${mention.split('@')[0]}! 🤜`,
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
        const linkGif = "https://media.tenor.com/eCNrTq7wOpgAAAPo/kiss.mp4";

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
                await sock.sendMessage(sender, { text: "SILÊNCIO!!!!!!!!! Fechei mesmo🤫, Um ADM vai querer anunciar alguma coisa🫡🫡🫡" });
                await sock.groupSettingUpdate(sender, 'announcement');
            }
        }
        
        if (text === '!abrir') {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            } else {
                await sock.sendMessage(sender, { text: "Pronto, podem falar a vontade bando de desempregados HAHAHAHA.😂😂" });
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
if (text.startsWith('!musica ')) {
    const busca = text.replace('!musica ', '');
    try {
        await sock.sendMessage(sender, { text: "🔍 Calma aí \"Cantor\", estou Buscando sua música..." });
        
        // Busca o link do vídeo
        const searchResults = await ytsr(busca, { limit: 1 });
        const video = searchResults.items[0];
        
        if (!video) return await sock.sendMessage(sender, { text: "❌ Não encontrado." });

        // Mensagem com o link e o GIF divertido
        const mensagem = `🎵 *Música Encontrada!*\n\n` +
                         `🎤 *Título:* ${video.title}\n` +
                         `🔗 *Link:* ${video.url}\n\n` +
                         `Dançando enquanto prepara o som... 😎, se você não tem Youtube Premium ou Spotify, melhor pagar seu pobre.`;

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
       
// --- BLOCO DO JOGO DA FORCA ---
    // 1. Comando de Início
    if (text.startsWith('!forca')) {
        const palavrasDificeis = ['abstrato', 'efemeridade', 'paradoxo', 'onisciente', 'idiossincrasia', 'inexoravel'];
        jogoForca.palavra = palavrasDificeis[Math.floor(Math.random() * palavrasDificeis.length)];
        jogoForca.descobertas = Array(jogoForca.palavra.length).fill('_');
        jogoForca.tentativas = [];
        jogoForca.ativo = true;
        jogoForca.erros = 0;
        jogoForca.maxErros = 6;

        const msgForca = await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/7HUogy7rXs4AAAPo/feel-me-think-about-it.mp4' }, 
            gifPlayback: true,
            caption: `💀 *JOGO DA FORCA, QUERO VER ACERTAR (NÍVEL HARD)*\n\nPalavra: ${jogoForca.descobertas.join(' ')}\n\nResponda dando reply (em cima) com uma letra!` 
        }, { quoted: msg });
        jogoForca.idMensagem = msgForca.key.id; 
        return; // Sai após iniciar
    }

    // 2. Lógica de Adivinhação
    // 2. Lógica de Adivinhação
    // 2. Lógica de Adivinhação
    if (jogoForca.ativo && !jogoForca.processando) {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo || 
                            msg.message?.imageMessage?.contextInfo || 
                            msg.message?.videoMessage?.contextInfo;

        if (contextInfo?.stanzaId === jogoForca.idMensagem && !text.startsWith('!')) {
            jogoForca.processando = true;
            const resposta = text.toLowerCase().trim();
            const autor = msg.key.participant || msg.key.remoteJid;

            // 1. TENTAR PALAVRA COMPLETA
            if (resposta === jogoForca.palavra) {
                jogoForca.ativo = false;
                await sock.sendMessage(sender, { react: { text: '🎉', key: msg.key } });
                // GIF de vitória adicionado aqui
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/eakvOpIu7fAAAAPo/sarcastic-clap.mp4' }, 
                    gifPlayback: true, 
                    caption: `🎉 PARABÉNS @${autor.split('@')[0]}! Você acertou a palavra completa: *${jogoForca.palavra.toUpperCase()}*`,
                    mentions: [autor]
                }, { quoted: msg });
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

            setTimeout(() => { 
                jogoForca.processando = false; 
            }, 1000); 
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
        // 8. COMANDO CLIMA (Ajustado)
        if (text.startsWith('!clima')) {
            const cidade = text.replace('!clima', '').trim();
            if (!cidade) return await sock.sendMessage(sender, { text: "❌ Digite a cidade! Ex: !clima Cariacica", quoted: msg });

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
                if (err || !result || result.length === 0) return await sock.sendMessage(sender, { text: "❌ Cidade não encontrada.", quoted: msg });
                
                const current = result[0].current;
                const condicaoTraduzida = traduzir(current.skytext);
                
                const msgClima = `🌤 *Tempo em: ${current.observationpoint}*\n` +
                                 `🌡 Temperatura: ${current.temperature}°C\n` +
                                 `☁️ Condição: ${condicaoTraduzida}`;
                await sock.sendMessage(sender, { text: msgClima, quoted: msg });
            });
        }
    }); // Fecha o messages.upsert
} // Fecha o connectToWhatsApp
connectToWhatsApp();
