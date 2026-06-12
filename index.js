const { execSync } = require('child_process');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const dataPath = '/var/data';
const arquivoPlacarEmoji = path.join(dataPath, 'placar_emoji.json');
const ARQUIVO_PLACAR_EMOJI = arquivoPlacarEmoji; 
const ARQUIVO_RANK = path.join(dataPath, 'rank.json');
const ARQUIVO_MUTADOS = path.join(dataPath, 'mutados.json');
const arquivoMutados = ARQUIVO_MUTADOS;
const arquivoPlacar = path.join(dataPath, 'placar.json');
const arquivoCargos = path.join(dataPath, 'cargos.json');
const arquivoCasais = path.join(dataPath, 'casais.json');
const cookies = process.env.COOKIES_JSON ? JSON.parse(process.env.COOKIES_JSON) : [];
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const ytSearch = require('yt-search'); 
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const infrações = {};
const ultimaMensagem = {};
let ataquesFuria = {}; 
const contagemFlood = {};
let admsTemporarios = {};
let escudosAtivos = {};
const cooldownRoubo = {}; // Armazena o timestamp do último roubo
let membrosPendentes = {}; // { jid: timestamp }
const cacheAdmins = {}; // <--- SÓ ADICIONAR ISSO AQUI



function lerArquivoSeguro(caminho) {
    try {
        if (!fs.existsSync(caminho)) return {};
        const conteudo = fs.readFileSync(caminho, 'utf8');
        return conteudo.trim() ? JSON.parse(conteudo) : {};
    } catch (err) {
        console.error(`Erro ao ler ${caminho}:`, err);
        return {};
    }
}

let tribunal = {
    ativo: false,
    vitima: null,
    acusador: null,
    votos: {}
};

let raidBoss = {
    ativo: false,
    hp: 0,
    maxHp: 0,
    idMensagem: ""
};

const enviarBackupAutomatico = async (sock) => {
    const meuNumero = '5527992997083@s.whatsapp.net';
    const arquivos = [arquivoPlacar, arquivoCargos, arquivoCasais, arquivoRank];
    for (const arquivo of arquivos) {
        if (fs.existsSync(arquivo)) {
            await sock.sendMessage(meuNumero, { 
                document: fs.readFileSync(arquivo), 
                fileName: arquivo.split('/').pop(), 
                mimetype: 'application/json' 
            });
        }
    }
};

let listaCasais = [];
let jogoPiada = {
    ativo: false,
    resposta: "",
    idMensagem: ""
};
let jogosLiberados = true;
let jogoPerguntas = {
    ativo: false,
    idMensagem: ""
};

const salvarCasais = () => {
    listaCasais = lerArquivoSeguro(arquivoCasais);
};

function garantirArquivo(caminho) {
    if (!fs.existsSync(caminho)) {
        console.log(`Criando arquivo inexistente: ${caminho}`);
        if (caminho === arquivoCasais) fs.writeFileSync(caminho, JSON.stringify([]));
        else fs.writeFileSync(caminho, JSON.stringify({})); 
    }
}

garantirArquivo(arquivoPlacar);
garantirArquivo(arquivoCargos);
garantirArquivo(arquivoCasais);
garantirArquivo(ARQUIVO_RANK);
garantirArquivo(ARQUIVO_MUTADOS);
garantirArquivo(ARQUIVO_PLACAR_EMOJI);

let placarEmoji = lerArquivoSeguro(ARQUIVO_PLACAR_EMOJI);

const isRender = process.env.RENDER === 'true';
if (isRender) {
    const express = require('express');
    const app = express();
    app.get('/', (req, res) => res.send('Bot está online!'));
    app.listen(process.env.PORT || 10000);
}

let jogoForca = {
    ativo: false,
    processando: false, 
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
    idMensagem: "" 
};

let contagemMensagens = lerArquivoSeguro(ARQUIVO_RANK);
let mutados = lerArquivoSeguro(ARQUIVO_MUTADOS);

async function connectToWhatsApp() {
    console.log("--- FUNÇÃO DE CONEXÃO INICIADA ---");
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        syncFullHistory: false,
        browser: ['Desktop', 'Chrome', '121.0.0.0'] 
    });
sock.ev.on('creds.update', saveCreds);
    sock.ev.removeAllListeners('messages.upsert');
    sock.ev.removeAllListeners('group-participants.update');
        
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        const userId = typeof participants[0] === 'string' ? participants[0] : participants[0].id;

        if (action === 'add') {
            membrosPendentes[userId] = Date.now(); 
            const textoBoasVindas = `━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔥 *BEM-VINDO AO CAOS: BONDE DO BRASIL* 🔥\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nFala aí, @${userId.split('@')[0]}! 🎉 \nVocê acaba de pisar na elite da zueira! Mas antes de soltar a voz, preste muita atenção nas leis do grupo pra não ir de arrasta pra cima no primeiro dia! 🚀\n\n🚨 *REGULAMENTO MÁXIMO (LEU, TÁ LIDO. NÃO LEU, É BAN)* 🚨\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚫 *1. ZERO PUTARIA E INVASÃO DE PV:* Aqui não é bagunça! É ESTRITAMENTE PROIBIDO qualquer tipo de conteúdo adulto (nudes, pornografia, figurinhas pesadas). Além disso, chamar os membros no PV sem permissão é BAN NA HORA, sem aviso prévio e sem choro!\n🚫 *2. ZERO TOLERÂNCIA:* Link suspeito, spam ou trava zap? O sistema te expulsa na velocidade da luz.\n⚠️ *3. RESPEITO:* A zueira é liberada, mas sem brigas pesadas ou mimimi. Saiba brincar.\n\n📝 *REGISTRO OBRIGATÓRIO (NÃO SEJA UM FANTASMA):*\nEnvie IMEDIATAMENTE a sua apresentação no formato abaixo:\n👉 *FOTO | CIDADE | IDADE | NOME*\nSe não registrar, o bot acha que você é intruso e vai te expulsar automaticamente! 🤖📸\n\n🎮 *O QUE ROLA NO BONDE:*\n• *JOGOS:* Participe do Quiz (*!perguntas*), encare o Boss (*!atacar*) ou lute pelo topo do ranking (*!rank*).\n• *LOJA:* Use *!comprar [item]* para dominar a economia (compre mutes, escudos e cargos VIP 🤫).\n• *CAOS:* Tem tribunal (*!julgar*), casamentos (*!casar*), assaltos (*!roubar*) e muita fofoca (*!fofoca*).\n\n🤖 *DICA DE OURO:* Digite *!menu* no grupo AGORA para ver todos os comandos. Se ficar parado, os outros membros vão te roubar! 💸`;

            await sock.sendMessage(id, { 
                text: textoBoasVindas, 
                mentions: [userId]
            });
        } else if (action === 'remove') {
            if (membrosPendentes[userId]) {
                delete membrosPendentes[userId];
                console.log(`🧹 ${userId.split('@')[0]} saiu do grupo.`);
            }
        }
    });
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') console.log("✅ Bot conectado!");
        else if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(), 30000);
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
                execSync(`ffmpeg -i "${tempPath}" -t 6 -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=10" -c:v libwebp -lossless 0 -compression_level 6 -q:v 30 -loop 0 -an -vcodec libwebp -fs 900K "${finalPath}"`);
                await sock.sendMessage(sender, { sticker: fs.readFileSync(finalPath) });
                fs.unlinkSync(finalPath);
            } else {
                const sticker = new Sticker(tempPath, { 
                    pack: 'Bonde do Brasil', 
                    author: 'Caio',          
                    type: StickerTypes.CROPPED, 
                    crop: true 
                });
                await sock.sendMessage(sender, await sticker.toMessage());
            }
            fs.unlinkSync(tempPath);
        } catch (err) { 
            console.error("ERRO DETALHADO: ", err);
            await sock.sendMessage(sender, { text: "❌ Erro ao baixar ou processar a mídia." }); 
        }
    }

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const sender = msg.key.remoteJid;
        const participant = msg.key.participant || sender;
        
        // --- A MÁGICA QUE SALVA O BOT DO WHATSAPP WEB ---

        const isLid = participant && participant.includes('@lid');
        const quoteMsg = isLid ? undefined : msg; 
        const myMention = isLid ? [] : [participant];

        const isGroup = sender.endsWith('@g.us');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
        const lowerText = text.toLowerCase();
        const isMedia = !!(msg.message.imageMessage || msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage);
        // --- SISTEMA DE CACHE DE ADM (ACELERA O BOT EM 1000%) ---
        let isAdmin = false;
        let groupAdmins = [];
        if (isGroup) {
            if (!cacheAdmins[sender] || Date.now() - cacheAdmins[sender].lastFetch > 60000) {
                try {
                    const metadata = await sock.groupMetadata(sender);
                    groupAdmins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
                    cacheAdmins[sender] = { admins: groupAdmins, lastFetch: Date.now() };
                } catch (e) { console.log("Erro ao buscar admins:", e); }
            } else {
                groupAdmins = cacheAdmins[sender].admins;
            }
            isAdmin = groupAdmins.includes(participant);
        }

        // --- 1. VERIFICAÇÃO DE MUTADOS ---
        if (mutados[participant] && Date.now() < mutados[participant]) {
            await sock.sendMessage(sender, { delete: msg.key });
            return; 
        }

        // --- 2. SISTEMA DE CADASTRO (AUTO-APROVAÇÃO E COBRANÇA) ---
        if (membrosPendentes[participant]) {
            const msgCorpo = msg.message;
            
            // Busca foto ou vídeo em todos os formatos possíveis do WhatsApp
            const viewOnce = msgCorpo?.viewOnceMessage?.message;
            const viewOnceV2 = msgCorpo?.viewOnceMessageV2?.message;
            const ephemeral = msgCorpo?.ephemeralMessage?.message; // Para mensagens temporárias
            
            // Verifica a mídia em cada um dos formatos
            const midiaNormal = msgCorpo?.imageMessage || msgCorpo?.videoMessage;
            const midiaViewOnce = viewOnce?.imageMessage || viewOnce?.videoMessage || viewOnceV2?.imageMessage || viewOnceV2?.videoMessage;
            const midiaEphemeral = ephemeral?.imageMessage || ephemeral?.videoMessage;
            const midiaQuoted = msgCorpo?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msgCorpo?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

            // Se for mídia de visualização única, marcamos para dar uma resposta especial!
            const mandouViewOnce = !!midiaViewOnce;
            const midia = midiaNormal || midiaViewOnce || midiaEphemeral || midiaQuoted;

            const padraoApresentacao = /\|/g;
            const enviouTextoCorreto = (text.match(padraoApresentacao) || []).length >= 3;

            // Pega o ID da pessoa (Mesmo que seja LID, o mentions: [participant] vai converter em tag azul)
            const numeroExibicao = participant.split('@')[0];

            if (midia || enviouTextoCorreto) {
                let textoConfirmacao = `✅ *Cadastro confirmado!* 🎉\n\nFala, @${numeroExibicao}! Você mandou muito bem na apresentação. Bem-vindo(a) à elite do Bonde! 🚀🔥`;
                let emojiReacao = '✅';
                
                // Se o bot detectar que a pessoa usou visualização única
                if (mandouViewOnce) {
                    textoConfirmacao = `🕵️‍♂️ *Visão Biônica Ativada!* 👀\n\nRelaxa, @${numeroExibicao}, eu consegui validar sua foto/vídeo de visualização única! Ninguém precisa ver, só o sistema! 🔒✨\n\n✅ *Cadastro 100% confirmado!* Bem-vindo(a) ao Bonde! 🚀🎉`;
                    emojiReacao = '🕵️‍♂️';
                }

                // 1. Reage à mensagem que o usuário mandou
                await sock.sendMessage(sender, { react: { text: emojiReacao, key: msg.key } });

                // 2. Responde EM CIMA da mensagem e MARCA a pessoa corretamente
                await sock.sendMessage(sender, { 
                    text: textoConfirmacao, 
                    mentions: [participant] 
                }, { quoted: msg });
                
                delete membrosPendentes[participant];
            } else {
                // Reage com aviso e cobra o padrão correto
                await sock.sendMessage(sender, { react: { text: '⚠️', key: msg.key } });
                await sock.sendMessage(sender, { 
                    text: `⚠️ Ei, @${numeroExibicao}, cadê a apresentação? Você não seguiu o padrão! 🤦‍♂️\n\nEnvie uma *FOTO/VÍDEO* (pode ser de visualização única 🔒) ou o formato:\n*FOTO | CIDADE | IDADE | NOME* 📸`, 
                    mentions: [participant] 
                }, { quoted: msg });
            }
            return;
        }

        // --- INÍCIO DO NOVO ANTI-SPAM (4 mensagens em 1 segundo = MUTE) ---
const agora = Date.now();
if (!contagemFlood[participant]) contagemFlood[participant] = [];
contagemFlood[participant] = contagemFlood[participant].filter(t => agora - t < 1000);
contagemFlood[participant].push(agora);

if (contagemFlood[participant].length >= 5) {
    if (!isAdmin) {
        await sock.sendMessage(sender, { react: { text: '🛑', key: msg.key } });
        mutados[participant] = Date.now() + 60000;
        fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
        await sock.sendMessage(sender, { text: `🚫 @${participant.split('@')[0]}, spam detectado! Mutado.`, mentions: [participant] }, { quoted: msg });
        contagemFlood[participant] = [];
        return; 
    } else {
        await sock.sendMessage(sender, { react: { text: '⚠️', key: msg.key } });
        await sock.sendMessage(sender, { text: `⚠️ Calma, meu rei @${participant.split('@')[0]}! Só nao reajo por que você não é meu chefe! 😂`, mentions: [participant] }, { quoted: msg });
        contagemFlood[participant] = [];
    }
}
        // --- 4. ANTI-LINK E ANTI-TRAVA ---
        const isLink = /https?:\/\/[^\s]+/.test(text);
        if (isLink) {
            if (!isAdmin) {
                infrações[participant] = (infrações[participant] || 0) + 1;
                const limite = 3; 
                const restam = limite - infrações[participant];

                if (infrações[participant] >= limite) {
                    await sock.sendMessage(sender, { text: `🚫 @${participant.split('@')[0]} foi banido por insistir em mandar links!`, mentions: [participant] }, { quoted: msg });
                    await sock.groupParticipantsUpdate(sender, [participant], "remove");
                    delete infrações[participant];
                } else {
                    const frasesAviso = [
                        `🚫 OPA, @${participant.split('@')[0]}! Aqui não pode link. Você tem ${restam} chance(s) antes do ban!`,
                        `⚠️ @${participant.split('@')[0]}, soltou o link? O sistema não perdoa! Faltam ${restam} chances.`,
                        `🧐 Opa, link por aqui? Nem tenta! O sistema está de olho. Mais ${restam} chance(s) e vaza!`,
                        `🚫 Link detectado! @${participant.split('@')[0]}, você está brincando com a sorte. ${restam} chance(s) restantes!`
                    ];
                    await sock.sendMessage(sender, { 
                        video: { url: 'https://media.tenor.com/q4GIdsYVSXcAAAPo/no-nooo.mp4' },
                        gifPlayback: true,
                        caption: frasesAviso[Math.floor(Math.random() * frasesAviso.length)],
                        mentions: [participant]
                    }, { quoted: msg });
                    await sock.sendMessage(sender, { delete: msg.key });
                }
                return; 
            } else {
                await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            }
        }

    if (text.length > 5000) {
        if (!isAdmin) {
            await sock.sendMessage(sender, { delete: msg.key });
            await sock.sendMessage(sender, { 
                text: `🚨 *ALERTA DE SEGURANÇA!* 🚨\n\nO membro @${participant.split('@')[0]} tentou enviar uma trava pesada e o sistema bloqueou!\n\n${groupAdmins.map(adm => `@${adm.split('@')[0]}`).join(' ')} -> *Fiquem de olho neste membro!*`, 
                mentions: [participant, ...groupAdmins]
            }, { quoted: msg });
            return;
        } else {
            await sock.sendMessage(sender, { react: { text: '😂', key: msg.key } });
            await sock.sendMessage(sender, { text: `Chefe, precisa falar tanto assim? Se for assim escreve um novo testamento logo 😂😂😂`, }, { quoted: msg });
        }
    }
        // --- 5. COMANDO INVÁLIDO ---
        if (text.startsWith('!')) {
            const comandosExistentes = ['!menu', '!comprar', '!bola8', '!shippar',  '!julgar', '!loja', '!pesquisar', '!backup', '!dar_pontos', '!atacar', '!boss', '!rank', '!casar', '!casais', '!piada', '!avisoadm', '!descasar', '!emoji', '!sortear', '!cadastros', '!perguntas', '!jogar', '!forca', '!jogosoff', '!jogoson', '!limpar', '!fixar', '!status', '!link', '!tier', '!ranking', '!placar', '!penalti', '!musica', '!socar', '!beijar', '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', '!clima', '!desmute', '!mute', '!gado', '!corno', '!fofoca', '!roubar', '!cargos', '!comprar_cargo', '!dar_cargo'];
            const cmdDigitado = text.split(' ')[0]; 
            
            if (!comandosExistentes.includes(cmdDigitado)) {
                await sock.sendMessage(sender, { react: { text: '🤦‍♂️', key: msg.key } });
                await sock.sendMessage(sender, { 
                    text: `Aí que você quer demais né, @${participant.split('@')[0]}? Olha o menu e digite esse maldito comando direito!!!!!`, 
                    mentions: [participant] 
                }, { quoted: msg });
                return;
            }
        }

        // --- 6. COMANDOS PRINCIPAIS ---
        if (text === '!cadastros') {
            if (!isAdmin) {
                const frasesErro = [
                    "❌ Opa, @${participant.split('@')[0]}, você não é ADM! Fica na sua que quem fiscaliza aqui sou eu e os chefes! 🤡",
                    "🚫 Tentando dar uma de fiscal, @${participant.split('@')[0]}? Esse comando é só pros ADMs, senta lá! 😂",
                    "🧐 Eita, querendo mandar no grupo sem ter cargo? Volta pro seu lugar, esse comando é exclusivo da Elite! 👑"
                ];
                return await sock.sendMessage(sender, { text: frasesErro[Math.floor(Math.random() * frasesErro.length)], mentions: [participant] }, { quoted: msg });
            }
            const pendentes = Object.keys(membrosPendentes);
            if (pendentes.length === 0) return await sock.sendMessage(sender, { text: "✅ Todos já se apresentaram! O grupo está limpo. 😇" });
            
            let msgLista = "🕵️‍♂️ *Atenção, ADMs! O radar detectou novos membros que ainda não tomaram vergonha na cara para se registrar!*\n\n👻 *LISTA DE FANTASMAS (NÃO APRESENTADOS):*\n\n";
            pendentes.forEach(p => { msgLista += `• @${p.split('@')[0]}\n`; });
            msgLista += "\n_Se apresentem logo (mandem a FOTO ou DADOS) ou serão expulsos sem aviso prévio! 🤡_";
            await sock.sendMessage(sender, { text: msgLista, mentions: pendentes }, { quoted: msg });
        }

        if (text === '!jogosoff') {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Apenas ADMs podem desativar os jogos!", quoted: msg });
            jogosLiberados = false;
            return await sock.sendMessage(sender, { text: "🚫 *JOGOS DESATIVADOS!* O bonde está em modo sério! 🤐", quoted: msg });
        }

        if (text === '!jogoson') {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Apenas ADMs podem ativar os jogos!", quoted: msg });
            jogosLiberados = true;
            return await sock.sendMessage(sender, { text: "🔓 *JOGOS ATIVADOS!* Podem soltar a bagunça! 🎉", quoted: msg });
        }

        const comandosDeJogo = ['!piada', '!casar', '!descasar', '!forca', '!penalti', '!sortear', '!emoji', '!jogar', '!musica', '!perguntas'];
        if (!jogosLiberados && comandosDeJogo.some(cmd => text.startsWith(cmd))) {
            if (isAdmin) {
                await sock.sendMessage(sender, { text: "🤖 Os jogos estão trancados, mas você é ADM, vou abrir uma exceção! 👑", quoted: msg });
            } else {
                return await sock.sendMessage(sender, { text: "❌ *Os jogos estão desativados por um ADM.* Aguarde a liberação! 🤐", quoted: msg });
            }
        }

        if (lowerText.startsWith('!f') && isMedia) {
            const media = msg.message.imageMessage || msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
            const type = (msg.message.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) ? 'imageMessage' : 'videoMessage';
            await criarFigurinha(media, sock, sender, type);
            return;
        }

        if (text.startsWith('!comprar_cargo')) {
            const novoCargo = text.replace('!comprar_cargo', '').trim();
            if (!novoCargo) return await sock.sendMessage(sender, { text: "❌ Qual cargo você quer? Ex: !comprar_cargo Rei da Zueira", quoted: msg });
            let placar = {};
            if (fs.existsSync(arquivoPlacar)) placar = JSON.parse(fs.readFileSync(arquivoPlacar, 'utf8'));
            let cargos = lerArquivoSeguro(arquivoCargos);
            const custo = 500; 
            if ((placar[participant] || 0) < custo) return await sock.sendMessage(sender, { text: `❌ Você não tem ${custo} pontos! Vai trabalhar! 😂`, quoted: msg });

            placar[participant] -= custo;
            cargos[participant] = novoCargo;
            fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
            fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));
            await sock.sendMessage(sender, { text: `👑 Parabéns @${participant.split('@')[0]}! Agora seu cargo oficial é: *${novoCargo}*`, mentions: [participant], quoted: msg });
        }

        if (text.startsWith('!dar_pontos')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Apenas ADMs têm autoridade para manipular a economia do Bonde! 🚫", quoted: msg });
            const args = text.split(' ');
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const quantidade = parseInt(args[2]);
            if (!mention || isNaN(quantidade)) return await sock.sendMessage(sender, { text: "❌ Formato inválido.\nUse: !dar_pontos @mencao [quantidade]", quoted: msg });
            
            let placar = {};
            try {
                if (fs.existsSync(arquivoPlacar)) {
                    placar = JSON.parse(fs.readFileSync(arquivoPlacar, 'utf8'));
                }
            } catch (e) { placar = {}; }
            placar[mention] = (placar[mention] || 0) + quantidade;
            fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
            await sock.sendMessage(sender, { text: `✅ Sucesso! Foram adicionados *${quantidade} pontos* ao saldo de @${mention.split('@')[0]}.`, mentions: [mention], quoted: msg });
        }

        if (text.startsWith('!dar_cargo')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Só ADM tem poder para dar cargos!", quoted: msg });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const cargoNome = text.replace('!dar_cargo', '').replace(/@\d+/, '').trim();
            if (!mention || !cargoNome) return await sock.sendMessage(sender, { text: "❌ Use: !dar_cargo @mencao [nome do cargo]", quoted: msg });

            let cargos = lerArquivoSeguro(arquivoCargos);
            cargos[mention] = cargoNome;
            fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));
            await sock.sendMessage(sender, { text: `✅ Cargo "${cargoNome}" concedido com sucesso ao @${mention.split('@')[0]}!`, mentions: [mention], quoted: msg });
        }

        if (text === '!perguntas') {
            const quiz = [
                { q: "Qual a capital da Austrália? (Dica: não é Sydney) 🦘", r: "canberra" },
                { q: "Qual o elemento químico de símbolo 'W' na tabela periódica? 🧪", r: "tungstenio" },
                { q: "Quem escreveu o clássico da literatura 'A Divina Comédia'? 📖", r: "dante alighieri" },
                { q: "Qual o deserto mais árido do mundo, localizado no norte do Chile? 🏜️", r: "atacama" },
                { q: "Qual o nome do menor osso do corpo humano, localizado no ouvido médio? 👂", r: "estribo" },
                { q: "Em que ano ocorreu a queda do Muro de Berlim? 🧱", r: "1989" },
                { q: "Qual a unidade de medida do Sistema Internacional para resistência elétrica? ⚡", r: "ohm" },
                { q: "Qual explorador britânico descobriu a tumba do faraó Tutancâmon em 1922? (Nome e Sobrenome) 🏺", r: "howard carter" },
                { q: "Qual organela celular é conhecida como a 'usina de energia' da célula? 🔬", r: "mitocondria" },
                { q: "Qual foi o primeiro domínio '.com' registrado na história da internet (em 1985)? 🌐", r: "symbolics" },
                { q: "Na mitologia grega, qual herói decapitou a Górgona Medusa? 🐍", r: "perseu" },
                { q: "Qual o nome do tratado assinado em 1494 que dividiu as terras recém-descobertas entre Portugal e Espanha? 📜", r: "tordesilhas" },
                { q: "Qual rio é considerado o mais longo de todo o continente europeu? 🏞️", r: "volga" },
                { q: "Quem é reconhecida mundialmente como a primeira programadora de computadores da história? (Nome e Sobrenome) 💻", r: "ada lovelace" },
                { q: "Qual a partícula subatômica responsável por manter os quarks unidos (a mediadora da força forte)? ⚛️", r: "gluon" },
                { q: "Como se chama o medo irracional, patológico e paralisante de palhaços? 🤡", r: "coulrofobia" },
                { q: "Contra qual doença foi desenvolvida a primeira vacina da história (criada por Edward Jenner)? 💉", r: "variola" },
                { q: "Quem pintou a célebre obra surrealista 'A Persistência da Memória' (famosa pelos relógios derretidos)? (Nome e Sobrenome) 🎨", r: "salvador dali" },
                { q: "Qual é a galáxia espiral mais próxima da nossa Via Láctea? 🌌", r: "andromeda" },
                { q: "Que país asiático nunca foi colonizado por uma potência europeia e antigamente era chamado de Sião? 🇹🇭", r: "tailandia" },
                { q: "Qual matemático britânico foi o gênio por trás da decifração da máquina Enigma na 2ª Guerra Mundial? (Nome e Sobrenome) 🧩", r: "alan turing" },
                { q: "Qual é a montanha (e vulcão) mais alta de todo o Sistema Solar, localizada em Marte? 🌋", r: "monte olimpo" },
                { q: "Em que ano exato o homem pisou na Lua pela primeira vez? 🌕", r: "1969" },
                { q: "Qual a capital da Mongólia, frequentemente listada como a capital mais fria do mundo? 🥶", r: "ulan bator" },
                { q: "Que gás compõe aproximadamente 78% de toda a atmosfera terrestre? ☁️", r: "nitrogenio" },
                { q: "Qual famoso e excêntrico imperador romano teria tentado nomear seu próprio cavalo, Incitatus, como cônsul? 🐎", r: "caligula" },
                { q: "A palavra 'Tsunami' tem origem em qual idioma? 🌊", r: "japones" },
                { q: "Qual é a letra da vitamina sintetizada pelo corpo humano quando exposto diretamente à luz solar? ☀️", r: "d" },
                { q: "Qual o livro de ficção mais traduzido do mundo? (Escrito por Antoine de Saint-Exupéry) 📚", r: "o pequeno principe" },
                { q: "Quem foi o lendário líder mongol que fundou o maior império de terras contíguas da história? (Nome e Sobrenome) 🐎", r: "gengis khan" },
                { q: "Qual é o único país do mundo cuja bandeira não tem o formato retangular nem quadrado? 🇳🇵", r: "nepal" },
                { q: "Qual o nome da teoria científica revolucionária que Albert Einstein publicou em 1915 sobre a gravidade? 🌌", r: "relatividade geral" },
                { q: "Como é chamado na geometria um polígono que possui exatamente 12 lados? 📐", r: "dodecagono" },
                { q: "Na tabela periódica, a sigla 'Hg' representa qual elemento químico de metal líquido? 🌡️", r: "mercurio" },
                { q: "Qual grande compositor clássico compôs a célebre 'Nona Sinfonia' enquanto já estava quase totalmente surdo? 🎼", r: "beethoven" },
                { q: "Qual filósofo da Grécia Antiga, aluno de Platão, foi o tutor do jovem Alexandre, o Grande? 🏛️", r: "aristoteles" },
                { q: "Qual cidade é atualmente considerada a área metropolitana mais populosa de todo o planeta? 🏙️", r: "toquio" },
                { q: "Qual navegador português iniciou e liderou a primeira expedição a circum-navegar o globo terrestre? ⛵", r: "fernao de magalhaes" },
                { q: "Qual órgão vital humano é capaz de se regenerar quase completamente mesmo se perder até 75% da sua massa? 🩸", r: "figado" },
                { q: "Exatamente quantas casas existem em um tabuleiro de xadrez tradicional? ♟️", r: "64" },
                { q: "Qual foi o nome do primeiro satélite artificial da Terra, lançado ao espaço pelos soviéticos em 1957? 🛰️", r: "sputnik" },
                { q: "Qual é o nome do país africano que é um enclave, ou seja, totalmente cercado pelo território da África do Sul? 🌍", r: "lesoto" },
                { q: "Quem foi o físico teórico que desenvolveu as três leis do movimento e a lei da gravitação universal? (Nome e Sobrenome) 🍎", r: "isaac newton" },
                { q: "Qual é a parte mais externa e visível do Sol, que só pode ser vista a olho nu durante um eclipse solar total? ☀️", r: "coroa" },
                { q: "Qual metal precioso é tradicionalmente associado ao 25º aniversário de casamento? 💍", r: "prata" }
            ];

            const sorteada = quiz[Math.floor(Math.random() * quiz.length)];
            await sock.sendMessage(sender, { react: { text: '🤔', key: msg.key } });
            const msgQuiz = await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/OoxmND1_sEMAAAPo/batman-doubt.mp4' }, 
                gifPlayback: true,
                caption: `🧠 *QUIZ DO BONDE - NÍVEL AVANÇADO (VALENDO 30 PONTOS)* 🧠\n\n${sorteada.q}\n\n*Responda em cima desta mensagem!*`, 
            }, { quoted: msg });
            
            jogoPerguntas.ativo = true;
            jogoPerguntas.resposta = sorteada.r;
            jogoPerguntas.idMensagem = msgQuiz.key.id;
        }

        if (jogoPerguntas.ativo && msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoPerguntas.idMensagem) {
            const respostaUsuario = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
            const respostaCerta = jogoPerguntas.resposta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

            if (respostaUsuario === respostaCerta) {
                jogoPerguntas.ativo = false;
                let placar = lerArquivoSeguro(arquivoPlacar);
                placar[participant] = (placar[participant] || 0) + 30; 
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

                await sock.sendMessage(sender, { react: { text: '🏆', key: msg.key } });
                await sock.sendMessage(sender, { 
                    text: `🎉 BRABO! @${participant.split('@')[0]} ganhou 30 pontos! A resposta era: *${jogoPerguntas.resposta.toUpperCase()}*`, 
                    mentions: [participant], 
                    quoted: msg 
                });
            } else {
                await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                await sock.sendMessage(sender, { text: `❌ Errou! Estuda mais, hein! 😂`, quoted: msg });
            }
        }

        if (text.startsWith('!emoji')) {
            const desafios = [
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
            const msgDesafio = await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/oJKQsEPQrYIAAAPo/spongebob-spongebob-squarepants.mp4' },
                gifPlayback: true,
                caption: `🧩 *ADIVINHE O FILME/SÉRIE:* \n\n${sorteado.emojis}\n\nResponda em cima nesta mensagem, hein!`,
            }, { quoted: msg });

            jogoEmoji.ativo = true;
            jogoEmoji.resposta = sorteado.resposta;
            jogoEmoji.gifResposta = sorteado.gif; 
            jogoEmoji.idMensagem = msgDesafio.key.id;
        }

        if (jogoEmoji.ativo && msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoEmoji.idMensagem) {
            const respostaUsuario = text.toLowerCase().trim();

            if (respostaUsuario === jogoEmoji.resposta) {
                jogoEmoji.ativo = false; 
                const pId = msg.key.participant;
                placarEmoji[pId] = (placarEmoji[pId] || 0) + 100;
                fs.writeFileSync(arquivoPlacarEmoji, JSON.stringify(placarEmoji, null, 2));

                await sock.sendMessage(sender, { 
                    video: { url: jogoEmoji.gifResposta }, 
                    gifPlayback: true,
                    caption: `🎉 PARABÉNS! @${pId.split('@')[0]} acertou! A resposta era: *${jogoEmoji.resposta.toUpperCase()}*\n\nVocê agora tem ${placarEmoji[pId]} ponto(s) no ranking de emojis!`, 
                    mentions: [pId]
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/VYsoMg08CSoAAAPo/faustao-silva.mp4' },
                    gifPlayback: true,
                    caption: "❌ Errou! Tente de novo, o jogo continua!" 
                }, { quoted: msg });
            }
        }

        if (text === '!ranking' || text === '!placar') {
            let placar = {};
            try {
                if (fs.existsSync(arquivoPlacar)) {
                    const conteudo = fs.readFileSync(arquivoPlacar, 'utf8');
                    placar = (conteudo && conteudo.trim().length > 0) ? JSON.parse(conteudo) : {};
                }
            } catch (e) {
                return await sock.sendMessage(sender, { text: "❌ Erro ao ler o banco de dados.", quoted: msg });
            }

            const entries = Object.entries(placar);
            if (entries.length === 0) return await sock.sendMessage(sender, { text: "❌ O placar está vazio.", quoted: msg });

            const ranking = entries.sort((a, b) => b[1] - a[1]).slice(0, 10);
            let res = `💎 *TOP 10 - RICOS DO BONDE*\n\n`;
            let listaMentions = [];

            ranking.forEach((entry, i) => {
                const [id, pontos] = entry;
                listaMentions.push(id); 
                const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔹";
                const numero = id.split('@')[0];
                res += `${medalha} ${i + 1}. @${numero} - *${pontos.toLocaleString('pt-BR')} pts*\n`;
            });

            await sock.sendMessage(sender, { text: res, mentions: listaMentions }, { quoted: msg });
        }

        if (lowerText === '!link') {
            await sock.sendMessage(sender, { react: { text: '🔗', key: msg.key } });
            const linkDoGrupo = "https://chat.whatsapp.com/HT7DEVaIjiE7hZ8PDThZ5a?s=cl&p=i&ilr=0"; 
            await sock.sendMessage(sender, { text: `🔗 *LINK DO BONDE DO BRASIL*\n\nAqui está o link para convidar a galera:\n${linkDoGrupo}\n\n*Regra:* Não convide gringos, hein! 😂`, }, { quoted: msg });
        }

        if (lowerText.includes('bot')) {
            const reacoesPossiveis = ['🤖', '🔥', '👀', '🤙', '😎', '💥', '👻'];
            const reacoesEscolhidas = reacoesPossiveis.sort(() => 0.5 - Math.random()).slice(0, 3);
            for (const emoji of reacoesEscolhidas) {
                await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });
                await new Promise(resolve => setTimeout(resolve, 300)); 
            }

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
                
                await new Promise(resolve => setTimeout(resolve, 800));
                await sock.sendMessage(sender, { text: `🤖 *${mensagemFinal}*`, mentions: [participant] }, { quoted: msg });
            }
        }

        if (lowerText.includes('dinheiro') || lowerText.includes('grana') || lowerText.includes('cash')) {
            const reacoes = ['💸', '💰', '🤑', '👀'];
            const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
            await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
        }

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
                }, { quoted: msg }); 
            } catch (e) {
                await sock.sendMessage(sender, { text: "❌ Erro ao sortear. Verifique se sou administrador do grupo." }, { quoted: msg }); 
            }
        }

        if (lowerText.includes('bom dia') || lowerText.includes('boa tarde') || lowerText.includes('boa noite')) {
            let emoji = '✨';
            let frases = [];

            if (lowerText.includes('bom dia')) {
                emoji = '☀️';
                frases = [
                    'Bom dia! Já acordou querendo trabalhar ou só vai enrolar o dia todo mesmo? 🤡',
                    'Bom dia! O sol nasceu para todos, mas só para os trouxas que já estão acordados. ☀️',
                    'Bom dia! Já deu bom dia pro grupo ou vai ficar só de olho nas mensagens? 🧐',
                    'Bom dia! Levanta que o boleto não se paga sozinho e a vida de herdeiro não chegou! 💸',
                    'Bom dia! O café tá pronto, mas a vontade de trabalhar ainda não apareceu. ☕',
                    'Bom dia! Mais um dia tentando não ser demitido. Boa sorte pra nós! 🍀'
                ];
            } else if (lowerText.includes('boa tarde')) {
                emoji = '🌤️';
                frases = [
                    'Boa tarde! O dia já tá acabando e você produziu o quê? Exatamente... nada! 😂',
                    'Boa tarde! Hora daquele cochilo maroto que o chefe não pode saber. 💤',
                    'Boa tarde! Só passei pra ver quem ainda está vivo e quem já morreu de preguiça. 💀',
                    'Boa tarde! A tarde é o melhor horário pra fingir que está muito ocupado. 📉',
                    'Boa tarde! O almoço foi bom, agora é só esperar a hora de ir embora. ⏳',
                    'Boa tarde! Quem tá trabalhando que lute, eu só estou aqui de bot! 🤖'
                ];
            } else if (lowerText.includes('boa noite')) {
                emoji = '🌙';
                frases = [
                    'Boa noite! Vai dormir que amanhã o sofrimento continua! 🌙',
                    'Boa noite! Sonhe com os anjos (ou com o pix que nunca cai). 💸',
                    'Boa noite! Desliga esse celular e vai dormir, viciado em zap! 📱',
                    'Boa noite! Amanhã é um novo dia para cometer os mesmos erros de sempre. 🤡',
                    'Boa noite! Já escovou os dentes ou vai dormir com bafo de dragão? 🐉',
                    'Boa noite! O grupo vai ficar em paz agora que você finalmente vai fechar o olho. 😴'
                ];
            }

            const sorteio = frases[Math.floor(Math.random() * frases.length)];
            await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });
            await sock.sendMessage(sender, { text: `🤖 *${sorteio}*` }, { quoted: msg });
        }

        if (lowerText.includes('sextou')) {
            const reacoes = ['🥳', '🍺', '🔥', '🍹', '😜'];
            const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
            await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
        }

        if (lowerText.includes('trabalhar') || lowerText.includes('trabalho')) {
            const reacoes = ['😰', '🤡', '☕', '😪', '💀'];
            const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
            await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
        }

        if (lowerText.includes('bebida') || lowerText.includes('cerveja') || lowerText.includes('vodka') || lowerText.includes('whisky')) {
            const reacoes = ['🍻', '🥂', '🥃', '👀', '🥴'];
            const emojiSorteado = reacoes[Math.floor(Math.random() * reacoes.length)];
            await sock.sendMessage(sender, { react: { text: emojiSorteado, key: msg.key } });
        }

        if (text === '!menu') {
            const senderId = msg.key.participant || msg.key.remoteJid; 
            const dataAtual = new Date().toLocaleDateString('pt-BR');
            const horaAtual = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const meuId = '5527992997083@s.whatsapp.net'; 
            
            const menuTexto = `
⚜️ ━━━ *B O N D E  V I P* ━━━ ⚜️
  
 👤 *Membro:* @${senderId.split('@')[0]}
 🕒 *Acesso:* ${dataAtual} às ${horaAtual}
 👑 *CEO:* @5527992997083

💎 *MERCADO & ECONOMIA*
 ┣ 🛒 !loja ➾ _Itens VIP_
 ┣ 💰 !roubar ➾ _Assaltar_
 ┣ 💳 !comprar_cargo [nome]
 ┣ 🎁 !comprar [item]
 ┗ 🏆 !ranking / !rank

🎲 *DIVERSÃO & SORTE*
 ┣ 👾 !jogar ➾ !forca ➾ !penalti
 ┣ 🧠 !perguntas ➾ !musica
 ┣ 🎬 !emoji ➾ !piada
 ┣ 🎱 !bola8 [pergunta]
 ┗ 💘 !shippar @mencao

😈 *CAOS & TRETA*
 ┣ ⚖️ !julgar @alvo ➾ !culpado/!inocente
 ┣ 🔪 !expor ➾ !aprovado/!reprovado
 ┣ 🤥 !poligrafo ➾ !sim/!nao
 ┣ 💍 !casar ➾ !descasar ➾ !casais
 ┣ 🤫 !fofoca ➾ !socar ➾ !beijar
 ┣ 🐂 !gado ➾ !corno ➾ !matar
 ┗ 🖼️ !f _(Figurinha)_

⚔️ *GUERRA & STATUS*
 ┣ 👹 !boss ➾ !atacar
 ┗ 🎖️ !cargos ➾ !tier

🚨 *CONTROLE (ADMS)*
 ┣ 🔨 !ban ➾ !mute ➾ !desmute
 ┣ 🔒 !fechar/abrir ➾ !adm
 ┣ 🕹️ !jogoson/off ➾ !dar_pontos
 ┗ 📣 !avisoadm ➾ !cadastros

🛠️ *SISTEMA*
 ┣ 🌤️ !clima [cidade]
 ┣ 🔍 !pesquisar [algo]
 ┣ 🔗 !link ➾ !backup
 ┗ 📛 !menu

━━━━━━━━━━━━━━━━━━━━
⚠️ _O sistema nunca dorme._`.trim();

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/WV_2tGerThoAAAPo/farming-aura-farming.mp4' },
                gifPlayback: true, 
                caption: menuTexto,
                mentions: [senderId, meuId] 
            }, { quoted: msg });
        }

        if (text.startsWith('!jogar')) {
            await sock.sendMessage(sender, { react: { text: '🎮', key: msg.key } });
            const args = text.split(' ');
            const escolha = parseInt(args[1]);

            const cenarios = [
                { nome: "Caverna Misteriosa", desc: "Você entrou numa caverna úmida e escura. Escolha um caminho:" },
                { nome: "Castelo Assombrado", desc: "Você está na porta de um castelo mal-assombrado! Escolha uma porta:" },
                { nome: "Floresta Proibida", desc: "Você se perdeu na floresta e ouviu um barulho estranho! Escolha uma trilha:" }
            ];

            if (!escolha || escolha < 1 || escolha > 3) {
                const cenarioSorteado = cenarios[Math.floor(Math.random() * cenarios.length)];
                return await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/jhsMAREYalUAAAPo/pacman-gaming.mp4' }, 
                    gifPlayback: true,
                    caption: `🎮 *RPG DO BONDE - ${cenarioSorteado.nome}*\n\n${cenarioSorteado.desc}\n\n1. Esquerda\n2. Centro\n3. Direita\n\nDigite !jogar [1, 2 ou 3]`
                }, { quoted: msg });
            }

            const caminhoVencedor = Math.floor(Math.random() * 3) + 1;
            
            const frasesVitoria = [
                `🏆 BOA! Você escolheu o caminho ${escolha} e encontrou um baú cheio de ouro! Ganhou 150 pontos! 💰`,
                `🎉 MITOU! Você escolheu o ${escolha} e deu de cara com um tesouro escondido. Recebeu 150 pontos! 💎`,
                `😎 O mestre do destino! Você acertou e o bot te deu 150 pontos pela sorte! 🧧`
            ];

            const frasesDerrota = [
                `💀 Xiii... deu ruim! Você escolheu o ${escolha} e caiu numa armadilha de urso. O caminho certo era o ${caminhoVencedor}. Tenta não morrer na próxima! 😂`,
                `🤡 Que feio! Você escolheu o ${escolha} e deu de cara com um monstro faminto. O certo era ${caminhoVencedor}. Pobre coitado! 👻`,
                `📉 Deu PT! Você escolheu o ${escolha} e se perdeu todo. O caminho era o ${caminhoVencedor}. Fraco demais! 🤣`
            ];

            if (escolha === caminhoVencedor) {
                let placar = lerArquivoSeguro(arquivoPlacar);
                placar[participant] = (placar[participant] || 0) + 150;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/FCtDCj3ihF8AAAPo/bugs-bunny-looney-tunes.mp4' }, 
                    gifPlayback: true, 
                    caption: frasesVitoria[Math.floor(Math.random() * frasesVitoria.length)]
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/Lhwo0gmSWLcAAAPo/higuruma-jjk.mp4' }, 
                    gifPlayback: true, 
                    caption: frasesDerrota[Math.floor(Math.random() * frasesDerrota.length)]
                }, { quoted: msg });
            }
        }

        if (text === '!piada') {
            const piadas = [
                { pergunta: "O que o pato disse para a pata? (Dica: é um trocadilho amoroso)", resposta: "vem quá" },
                { pergunta: "Por que a plantinha não vai ao médico? (Dica: ela é...)", resposta: "porque ela já tem plantão" },
                { pergunta: "O que o tijolo disse para o outro tijolo? (Dica: é uma relação profissional)", resposta: "há um tijolo entre nós" },
                { pergunta: "Qual é a cidade que não tem luz? (Dica: é um trocadilho)", resposta: "luziania" },
                { pergunta: "Por que o computador foi preso? (Dica: ele fez algo ilegal com a internet)", resposta: "porque ele rodou um programa" },
                { pergunta: "Qual o animal que mais gosta de música? (Dica: é um animal de fazenda)", resposta: "o porquinho" },
                { pergunta: "Por que o livro de matemática se suicidou? (Dica: ele tinha muitos...)", resposta: "porque ele tinha muitos problemas" },
                { pergunta: "Qual a diferença entre a lagoa e a padaria? (Dica: um tem peixe, o outro tem...)", resposta: "na lagoa há sapos, na padaria há pães" },
                { pergunta: "Por que a aranha é muito rica? (Dica: ela tem várias delas)", resposta: "porque ela tem muitas teias" },
                { pergunta: "Como se chama o cão que trabalha no circo? (Dica: ele é um...)", resposta: "cão-palhaço" },
                { pergunta: "Qual é o cúmulo da paciência? (Dica: tem a ver com algo muito pequeno)", resposta: "esperar um mosquito fazer xixi" },
                { pergunta: "O que o zero disse para o oito? (Dica: é sobre o cinto)", resposta: "que cinto apertado você usa" },
                { pergunta: "Por que a girafa se dá bem com todo mundo? (Dica: ela é...)", resposta: "porque ela é muito alta" },
                { pergunta: "Por que a geladeira é burra? (Dica: ela sempre esquece de...)", resposta: "porque ela só sabe guardar as coisas" },
                { pergunta: "O que o sal disse para o açúcar? (Dica: é sobre ser doce)", resposta: "você é muito doce para mim" }
            ];

            const sorteada = piadas[Math.floor(Math.random() * piadas.length)];
            await sock.sendMessage(sender, { react: { text: '🤡', key: msg.key } });

            const msgPiada = await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/TK5ohR8zXzAAAAPo/o-livro-dos-insultos-the-noite-com-danilo-gentili.mp4' },
                gifPlayback: true,
                caption: `🤡 *DESAFIO DA PIADA RUIM!* 🤡\n\n${sorteada.pergunta}\n\n*Responda em cima desta mensagem com a resposta correta!*`, 
            }, { quoted: msg });

            jogoPiada.ativo = true;
            jogoPiada.resposta = sorteada.resposta;
            jogoPiada.idMensagem = msgPiada.key.id;
        }

        if (jogoPiada.ativo && msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoPiada.idMensagem) {
            const respostaUsuario = text.toLowerCase().trim();
            if (respostaUsuario === jogoPiada.resposta) {
                jogoPiada.ativo = false;
                let placar = lerArquivoSeguro(arquivoPlacar);
                placar[participant] = (placar[participant] || 0) + 75; 
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                await sock.sendMessage(sender, { react: { text: '🏆', key: msg.key } });
                await sock.sendMessage(sender, { text: `🎉 BOA! @${participant.split('@')[0]} ganhou 75 pontos! A resposta era: *${jogoPiada.resposta.toUpperCase()}*`, mentions: [participant], quoted: msg });
            } else {
                await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            }
        }

        if (text.startsWith('!penalti')) {
            await sock.sendMessage(sender, { react: { text: '⚽', key: msg.key } });
            const args = text.split(' ');
            const escolha = parseInt(args[1]);
            const senderId = msg.key.remoteJid;

            let placar = lerArquivoSeguro(arquivoPlacar);
            if (!placar[senderId]) placar[senderId] = 0;

            if (!escolha || escolha < 1 || escolha > 3) {
                return await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/Rfz8o91xR5wAAAPo/jonathan-david-jo-david.mp4' }, 
                    gifPlayback: true,
                    caption: `⚽ *DISPUTA DE PÊNALTIS*\n\nSeu total de gols: ${placar[senderId]}\n\nEscolha o canto para bater o pênalti: !penalti1, !penalti2 ou !penalti3`
                }, { quoted: msg });
            }

            const defesa = Math.random() < 0.5;
            if (!defesa) {
                placar[senderId] += 50;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                await sock.sendMessage(sender, { 
                    caption: `⚽ GOOOOOL! Você marcou! Total de pontos ganhos: ${placar[senderId]}`, 
                    video: { url: 'https://media.tenor.com/vnXD4h47_ZwAAAPo/kick-goal.mp4' }, 
                    gifPlayback: true
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { 
                    caption: `🧤 DEFESA! O goleiro pegou, se é ruim hein.😂😂😂 Seu total continua ${placar[senderId]} gols.`, 
                    video: { url: 'https://media.tenor.com/AdTJAjjVaIkAAAPo/goalkeeper.mp4' }, 
                    gifPlayback: true
                }, { quoted: msg });
            }
        }

        if (text.startsWith('!ban')) {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
            } else {
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                const meuIDProtegido = '96057379803159'; 

                if (mention && mention.includes(meuIDProtegido)) {
                    await sock.sendMessage(sender, { text: "❌ Nem tenta! O criador é intocável! 👑" });
                } else if (mention) {
                    const frasesBan = [
                        `👋 O @${mention.split('@')[0]} decidiu tirar férias permanentes do grupo. Aproveita a liberdade! ✈️`,
                        `🚫 O banhammer passou por aqui e o @${mention.split('@')[0]} foi o escolhido da vez. Tchauzinho! 👋`,
                        `🤡 @${mention.split('@')[0]} foi promovido a "ex-membro". Parabéns pela conquista! 😂`,
                        `💨 @${mention.split('@')[0]} foi convidado a se retirar porque estava brilhando demais... ou não. Vaza! 🏃‍♂️`,
                        `🛑 @${mention.split('@')[0]} entrou para a galeria dos que tentaram, mas não conseguiram. Até a próxima! 💅`,
                        `💤 @${mention.split('@')[0]} foi colocar o grupo pra dormir, mas acabou sendo ele quem foi dormir... fora daqui! 😴`,
                        `🚪 A porta da rua é serventia da casa, @${mention.split('@')[0]}! Boa sorte na caminhada. 🚶‍♂️`
                    ];
                    const sorteioBan = frasesBan[Math.floor(Math.random() * frasesBan.length)];
                    await sock.sendMessage(sender, { text: sorteioBan, mentions: [mention] }, { quoted: msg });
                    setTimeout(async () => { 
                        await sock.groupParticipantsUpdate(sender, [mention], 'remove'); 
                    }, 2000);
                } else {
                    await sock.sendMessage(sender, { text: "❌ Mencione alguém para banir!" }, { quoted: msg });
                }
            }
        }

        // --- COMANDO !PESQUISAR (REFEITO PARA WIKIPÉDIA - BLINDADO) ---
        if (text.startsWith('!pesquisar ')) {
            const termo = text.replace('!pesquisar ', '').trim();
            if (!termo) return await sock.sendMessage(sender, { text: "❌ O que você quer pesquisar?" }, { quoted: quoteMsg });

            if (!isLid) await sock.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
            
            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/IzywMgoVemYAAAPo/cat-busy.mp4' }, 
                gifPlayback: true,
                caption: `🔍 Pesquisando na Wikipédia sobre: *${termo.toUpperCase()}*...`
            }, { quoted: quoteMsg });

            try {
                // Configuração de Headers para evitar bloqueio da Wikipédia (Eles bloqueiam bots sem User-Agent)
                const axiosConfig = {
                    headers: {
                        'User-Agent': 'BondeDoBrasilBot/1.0 (Bot do WhatsApp) axios/1.x'
                    }
                };

                // 1. Faz uma busca inteligente para achar o título exato do artigo
                const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(termo)}&utf8=&format=json`;
                const searchRes = await axios.get(searchUrl, axiosConfig);

                // Se não achou nenhum resultado na busca
                if (!searchRes.data?.query?.search || searchRes.data.query.search.length === 0) {
                    return await sock.sendMessage(sender, { text: "❌ Não encontrei absolutamente nada sobre isso na Wikipédia. Tente usar outras palavras!" }, { quoted: quoteMsg });
                }

                // Pega o título do resultado mais relevante (o primeiro da lista)
                const tituloExato = searchRes.data.query.search[0].title;
                const tituloFormatado = encodeURIComponent(tituloExato.replace(/ /g, '_')); // Troca espaços por _ para não bugar a URL

                try {
                    // 2. Agora sim, puxa o resumo usando o título certinho
                    const res = await axios.get(`https://pt.wikipedia.org/api/rest_v1/page/summary/${tituloFormatado}`, axiosConfig);
                    
                    if (res.data && res.data.extract) {
                        const respostaTexto = `🔍 *RESULTADO: ${tituloExato.toUpperCase()}*\n\n${res.data.extract}\n\n🔗 *Fonte:* ${res.data.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${tituloFormatado}`}`;
                        await sock.sendMessage(sender, { text: respostaTexto }, { quoted: quoteMsg });
                    } else {
                        throw new Error("Página encontrada, mas sem resumo (extract).");
                    }
                } catch (restError) {
                    // PLANO B: Se a API de resumo falhar, pega o trecho (snippet) da pesquisa original e limpa a sujeira do HTML
                    let snippet = searchRes.data.query.search[0].snippet;
                    snippet = snippet.replace(/<[^>]*>?/gm, ''); // Expressão regular que apaga as tags <span class="searchmatch"> da Wikipédia
                    
                    const respostaTextoFallback = `🔍 *RESULTADO: ${tituloExato.toUpperCase()}*\n\n${snippet}...\n\n🔗 *Fonte:* https://pt.wikipedia.org/wiki/${tituloFormatado}`;
                    await sock.sendMessage(sender, { text: respostaTextoFallback }, { quoted: quoteMsg });
                }

            } catch (e) {
                console.error("Erro no !pesquisar:", e.message);
                await sock.sendMessage(sender, { text: "❌ O buscador deu erro de conexão com a Wikipédia. Tente de novo!" }, { quoted: quoteMsg });
            }
        }

        // ==========================================
        // 🔮 A BOLA 8 MÁGICA (!bola8)
        // ==========================================
        if (text.startsWith('!bola8')) {
            const pergunta = text.replace('!bola8', '').trim();
            if (!pergunta) {
                return await sock.sendMessage(sender, { text: "❌ Você precisa me fazer uma pergunta! Ex: !bola8 Eu vou ficar rico?" }, { quoted: msg });
            }

            const respostas = [
                "🔮 Com certeza! Pode apostar sua casa nisso.",
                "🔮 Nem em um milhão de anos, desista.",
                "🔮 Minhas fontes dizem que vai dar ruim...",
                "🔮 As estrelas dizem que sim, mas meu sistema diz que não.",
                "🔮 Vai sonhando, iludido! 😂",
                "🔮 Sim! Mas só se você fizer um pix pro ADM.",
                "🔮 Não conte com isso.",
                "🔮 Talvez... a vida é uma caixinha de surpresas.",
                "🔮 Sem dúvida! (A menos que dê errado).",
                "🔮 Pergunta de novo mais tarde, tô com preguiça agora."
            ];

            const respostaSorteada = respostas[Math.floor(Math.random() * respostas.length)];
            
            await sock.sendMessage(sender, { react: { text: '🎱', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `🎱 *A BOLA DE CRISTAL DO BONDE DIZ:*\n\n*Sua pergunta:* _${pergunta}_\n*Resposta:* ${respostaSorteada}`,
                mentions: [participant]
            }, { quoted: msg });
        }

        // ==========================================
        // ❤️ MEDIDOR DE CASAL / SHIPP (!shippar)
        // ==========================================
        if (text.startsWith('!shippar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) {
                return await sock.sendMessage(sender, { text: "❌ Marque o @ do seu crush pra ver se dá match! Ex: !shippar @fulano" }, { quoted: msg });
            }
            if (mention === participant) {
                return await sock.sendMessage(sender, { text: "❌ Shippar você com você mesmo? É carência ou amor-próprio demais? 😂" }, { quoted: msg });
            }

            const porcentagem = Math.floor(Math.random() * 101);
            let diagnostico = "";

            if (porcentagem === 0) diagnostico = "Péssima ideia. Se vocês ficarem juntos, vai dar polícia! 🚓💔";
            else if (porcentagem < 30) diagnostico = "Amizade e olhe lá. Um de vocês vai acabar chorando no banho. 🚿";
            else if (porcentagem < 60) diagnostico = "Tem uma química, mas vai dar um trabalho... 🧪👀";
            else if (porcentagem < 90) diagnostico = "EITA! O clima esquentou! Eu já shippo, só falta o beijo! 👩‍❤️‍💋‍👨🔥";
            else diagnostico = "PERFEIÇÃO! Almas gêmeas! Já podem casar e dividir a conta do Nubank! 💍💳";

            const p1 = participant.split('@')[0];
            const p2 = mention.split('@')[0];

            await sock.sendMessage(sender, { react: { text: '💘', key: msg.key } });
            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/IAIStVNhf-wAAAPo/love-amor.mp4' }, 
                gifPlayback: true,
                caption: `💘 *MÁQUINA DO AMOR* 💘\n\nAnalisando a química entre @${p1} e @${p2}...\n\n*Resultado:* ${porcentagem}% Compatíveis! 💞\n\n*Veredito:* ${diagnostico}`,
                mentions: [participant, mention]
            }, { quoted: msg });
        }

        if (text.startsWith('!tier')) {
            await sock.sendMessage(sender, { react: { text: '📊', key: msg.key } });
            const tema = text.replace('!tier', '').trim() || "do grupo";
            const metadata = await sock.groupMetadata(sender);
            let ppts = metadata.participants.sort(() => 0.5 - Math.random()).slice(0, 5);
            
            const frasesTier = [
                `🏆 *TIER LIST: ${tema.toUpperCase()} (OS ESCOLHIDOS PELO DESTINO)*`,
                `🔥 *TOP 5: OS MAIS ${tema.toUpperCase()} SEGUNDO A CIÊNCIA (CONFIA!)*`,
                `📉 *RANKING DE ${tema.toUpperCase()}: A LISTA QUE NINGUÉM PEDIU, MAS TODO MUNDO QUERIA!*`,
                `👀 *QUEM SÃO OS ${tema.toUpperCase()} DA VEZ? DESCUBRA AGORA:*`
            ];
            const titulo = frasesTier[Math.floor(Math.random() * frasesTier.length)];
            let res = `${titulo}\n\n`;

            ppts.forEach((p, i) => {
                const score = Math.floor(Math.random() * 100) + 1;
                let comentario = "";
                if (score > 90) comentario = " (Lenda! 😎)";
                else if (score > 70) comentario = " (Respeita o homem/mulher! 🤙)";
                else if (score > 40) comentario = " (Tá na média... eu acho 🤡)";
                else comentario = " (Vixe, passa vergonha não! 💀)";
                res += `${i + 1}. @${p.id.split('@')[0]} - ${score}% ${comentario}\n`;
            });

            await sock.sendMessage(sender, { text: res, mentions: ppts.map(p => p.id) }, { quoted: msg });
        }

        // ==========================================
        // ⚖️ O TRIBUNAL DO BONDE ⚖️
        // ==========================================
        if (text.startsWith('!julgar')) {
            if (!isGroup) return await sock.sendMessage(sender, { text: "❌ O tribunal só funciona em grupos!" }, { quoted: quoteMsg });
            if (tribunal.ativo) return await sock.sendMessage(sender, { text: "❌ Já existe um julgamento acontecendo! Aguarde o martelo bater." }, { quoted: quoteMsg });

            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o réu que vai a julgamento! Ex: !julgar @membro" }, { quoted: quoteMsg });
            if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Você não pode processar a si mesmo, seu maluco! 😂" }, { quoted: quoteMsg });

            // --- TRAVA DE IMUNIDADE (ADM E BOT) ---
            const MEU_ID_REAL = "96057379803159@lid"; 
            const meuNumero = "5527992997083";
            if (groupAdmins.includes(mention)) {
                return await sock.sendMessage(sender, { text: "❌ TÁ MALUCO? O réu faz parte da Elite (ADM)! Vocês não têm poder para julgar a chefia! 👑" }, { quoted: quoteMsg });
            }
            if (mention === MEU_ID_REAL || String(mention).includes(meuNumero)) {
                return await sock.sendMessage(sender, { text: "❌ Tentando julgar o juiz? O bot é intocável! 🤖" }, { quoted: quoteMsg });
            }

            // --- INICIA O TRIBUNAL ---
            tribunal.ativo = true;
            tribunal.vitima = mention;
            tribunal.acusador = participant;
            tribunal.votos = {};

            const msgAbertura = `⚖️ *O TRIBUNAL DO BONDE ESTÁ ABERTO!* ⚖️\n\nO promotor @${participant.split('@')[0]} acusou o(a) @${mention.split('@')[0]} de falar muita besteira!\n\nJúri, vocês têm *1 MINUTO* para decidir o destino dele(a)!\nFloodem o chat com:\n🔴 *!culpado*\n🟢 *!inocente*\n\n_Se for inocentado, o acusador sofrerá a punição!_`;
            
            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/myw9F3Q5zs0AAAPo/stand-up-ada-samantha-maroun.mp4' }, 
                gifPlayback: true,
                caption: msgAbertura,
                mentions: [participant, mention]
            });

            // Contagem regressiva de 1 minuto (60.000 milissegundos)
            setTimeout(async () => {
                if (!tribunal.ativo) return; // Medida de segurança

                let culpados = 0;
                let inocentes = 0;

                Object.values(tribunal.votos).forEach(voto => {
                    if (voto === 'culpado') culpados++;
                    if (voto === 'inocente') inocentes++;
                });

                tribunal.ativo = false; // Fecha o tribunal

                if (culpados > inocentes) {
                    // VÍTIMA CONDENADA: Mute de 5 min (300.000ms) + Cargo Humilhante
                    mutados[tribunal.vitima] = Date.now() + 300000;
                    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));

                    let cargos = lerArquivoSeguro(arquivoCargos);
                    cargos[tribunal.vitima] = "⚖️ Condenado";
                    fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));

                    const msgCondenado = `👨‍⚖️ *VEREDITO: CULPADO!* (${culpados}x${inocentes})\n\nA voz do povo é a voz de Deus! O @${tribunal.vitima.split('@')[0]} tomou uma martelada na cabeça!\n\n*PUNIÇÃO:* Mute de 5 minutos e foi rebaixado a "⚖️ Condenado"! 🔨`;
                    
                    await sock.sendMessage(sender, { 
                        video: { url: 'https://media.tenor.com/pUnjk3G9hGgAAAPo/gavel-order-in-court.mp4' }, 
                        gifPlayback: true,
                        caption: msgCondenado,
                        mentions: [tribunal.vitima]
                    });

                } else {
                    // VÍTIMA INOCENTADA: Acusador se ferra! Mute de 5 min (300.000ms)
                    mutados[tribunal.acusador] = Date.now() + 300000;
                    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));

                    const msgInocente = `👨‍⚖️ *VEREDITO: INOCENTE!* (${inocentes}x${culpados})\n\nO réu @${tribunal.vitima.split('@')[0]} foi ABSOLVIDO pelo júri!\n\n🚨 *REVIRAVOLTA!* O promotor de araque @${tribunal.acusador.split('@')[0]} foi condenado por falsa acusação!\n\n*PUNIÇÃO:* Mute de 5 minutos para aprender a não brincar com a justiça! 🤡`;
                    
                    await sock.sendMessage(sender, { 
                        video: { url: 'https://media.tenor.com/AENPKL0I4uEAAAPo/judge.mp4' }, 
                        gifPlayback: true,
                        caption: msgInocente,
                        mentions: [tribunal.vitima, tribunal.acusador]
                    });
                }
            }, 60000); // 60 segundos exatos
        }

        // --- SISTEMA DE VOTAÇÃO (Capta os votos da galera) ---
        if (text === '!culpado' || text === '!inocente') {
            if (!tribunal.ativo) return;
            
            // Regra de ouro: O Acusador e a Vítima NÃO PODEM VOTAR!
            if (participant === tribunal.vitima || participant === tribunal.acusador) {
                if (!isLid) await sock.sendMessage(sender, { react: { text: '🚫', key: msg.key } });
                return;
            }

            // Cada pessoa só vota uma vez (democracia)
            if (tribunal.votos[participant]) {
                if (!isLid) await sock.sendMessage(sender, { react: { text: '👀', key: msg.key } });
                return;
            }

            tribunal.votos[participant] = text === '!culpado' ? 'culpado' : 'inocente';
            if (!isLid) await sock.sendMessage(sender, { react: { text: '⚖️', key: msg.key } });
        }

        if (text.startsWith('!matar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention) {
                const autor = participant.split('@')[0];
                const alvo = mention.split('@')[0];
                const frasesMatar = [
                    `O @${autor} mandou o @${alvo} de arrasta pra cima! Que vacilo, hein? 💀`,
                    `Vixi... @${autor} não teve piedade e eliminou o @${alvo} do mapa! ⚰️`,
                    `O @${autor} decidiu que o @${alvo} não precisava mais respirar o mesmo ar. Que maldade! 🗡️`,
                    `@${autor} aplicou o golpe final no @${alvo}. RIP para esse guerreiro! 🪦`,
                    `Game Over para o @${alvo}! O @${autor} deu um fim na história dele aqui. 😂`,
                    `O @${autor} acabou de fazer uma limpa no @${alvo}. Tá com Deus agora! 👻`
                ];
                const sorteioMatar = frasesMatar[Math.floor(Math.random() * frasesMatar.length)];
                const linkGifMatar = "https://media.tenor.com/3gus0SGhiEIAAAPo/cool-beans.mp4";

                await sock.sendMessage(sender, { 
                    video: { url: linkGifMatar }, 
                    gifPlayback: true,
                    caption: sorteioMatar, 
                    mentions: [participant, mention] 
                }, { quoted: msg }); 
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém para eliminar!", quoted: msg });
            }
        }

        if (text === '!loja') {
            let placar = lerArquivoSeguro(arquivoPlacar);
            const saldo = placar[participant] || 0;
            const menu = `💎 *LOJA DO PODER ABSOLUTO* 💎
💰 *Seu Saldo:* ${saldo} pts

*--- STATUS & PROTEÇÃO ---*
1️⃣ *MUTE (1 min)* - 100 pts | !comprar mute @mencao
2️⃣ *DESMUTE* - 300 pts | !comprar desmute
3️⃣ *FÚRIA* - 400 pts | !comprar fúria
4️⃣ *ESCUDO (1h)* - 600 pts | !comprar escudo
5️⃣ *VIP (Cargo)* - 800 pts | !comprar vip

*--- DOMÍNIO & ESTRATÉGIA ---*
6️⃣ *⛓️ CORRENTE* - 900 pts | !comprar corrente
7️⃣ *🔮 ORÁCULO* - 700 pts | !comprar oraculo @mencao

*--- GESTÃO DE GRUPO (ELITE) ---*
8️⃣ *👑 ADM DE FACHADA* - 3500 pts | !comprar adm
   (Limpar mensagens, fixar, etc)
9️⃣ *📅 SORTE (Bônus)* - 1500 pts | !comprar sorte
🔟 *🔑 CHAVE MESTRA* - 2000 pts | !comprar chave

━━━━━━━━━━━━━━━━━━
🤖 *Use !comprar [item] e domine o ranking!*`.trim();
            await sock.sendMessage(sender, { text: menu, quoted: msg });
        }

        if (text.startsWith('!comprar') || text.startsWith('!limpar') || text.startsWith('!fixar') || text.startsWith('!status')) {
            if (text.startsWith('!comprar')) {
                const args = text.split(' ');
                const item = args[1];
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                
                let placar = lerArquivoSeguro(arquivoPlacar);
                let cargos = lerArquivoSeguro(arquivoCargos);
                const saldo = placar[participant] || 0;

                const itens = {
                    'mute': 100, 'desmute': 300, 'fúria': 400, 'escudo': 600, 
                    'vip': 800, 'corrente': 900, 'oraculo': 700, 
                    'adm': 3500, 'sorte': 1500, 'chave': 2000
                };

                if (!itens[item]) return await sock.sendMessage(sender, { text: "❌ Item não encontrado!", quoted: msg });
                if (saldo < itens[item]) return await sock.sendMessage(sender, { text: `❌ Você precisa de ${itens[item]} pontos!`, quoted: msg });

                let sucesso = false;

                if (item === 'mute') {
                    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione o alvo!", quoted: msg });
                    try {
                        const metadata = await sock.groupMetadata(sender);
                        const groupAdmins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
                        if (groupAdmins.includes(mention)) {
                            return await sock.sendMessage(sender, { text: "❌ Não posso mutar um ADM, eles mandam no grupo! 😂", quoted: msg });
                        }
                    } catch (e) {
                        console.error("Erro ao verificar admins para o mute:", e);
                    }
                    mutados[mention] = Date.now() + 60000;
                    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                    sucesso = true;
                } else if (item === 'desmute') {
                    if (!mutados[participant]) {
                        return await sock.sendMessage(sender, { text: "❌ Você não está mutado, não precisa gastar pontos!", quoted: msg });
                    }
                    delete mutados[participant];
                    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                    sucesso = true;
                } else if (item === 'fúria') {
                    ataquesFuria[participant] = true; 
                    await sock.sendMessage(sender, { 
                        text: "🔥 *FÚRIA ATIVADA!* Seu próximo ataque no Boss será dobrado! Use !atacar logo antes que a fúria passe!",
                        quoted: msg 
                    });
                    sucesso = true; 
                } else if (item === 'escudo') {
                    escudosAtivos[participant] = Date.now() + 3600000;
                    sucesso = true;
                } else if (item === 'vip') {
                    cargos[participant] = "VIP";
                    fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));
                    sucesso = true;
                } else if (item === 'adm') {
                    admsTemporarios[participant] = Date.now() + 3600000;
                    await sock.sendMessage(sender, { text: "👑 ADM de Fachada ativado (1h)!" });
                    sucesso = true;
                }

                if (sucesso) {
                    placar[participant] -= itens[item];
                    fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                    await sock.sendMessage(sender, { text: `✅ Compra de *${item.toUpperCase()}* realizada!`, quoted: msg });
                }
            } else {
                if (!admsTemporarios[participant] || admsTemporarios[participant] < Date.now()) 
                    return await sock.sendMessage(sender, { text: "❌ Você não tem o cargo de ADM de Fachada!", quoted: msg });

                if (text.startsWith('!limpar')) {
                    const messages = await sock.fetchMessagesFromHistory(sender, 10);
                    for (let m of messages) await sock.sendMessage(sender, { delete: m.key });
                    await sock.sendMessage(sender, { text: "✅ Chat limpo!" });
                } else if (text.startsWith('!fixar')) {
                    const msgFix = text.replace('!fixar', '').trim();
                    await sock.sendMessage(sender, { text: `📌 *FIXADO:*\n${msgFix}` });
                } else if (text.startsWith('!status')) {
                    const totalMsg = Object.values(contagemMensagens).reduce((a, b) => a + b, 0);
                    await sock.sendMessage(sender, { text: `📊 *ESTATÍSTICAS:* ${totalMsg} msgs no total.` });
                }
            }
        }

        if (text.startsWith('!gado')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para ver o nível de gado!", quoted: msg });
            const porcentagem = Math.floor(Math.random() * 101);
            const alvo = mention.split('@')[0];
            let mensagemGado = "";
            
            if (porcentagem < 20) mensagemGado = "é apenas um bezerro aprendiz, ainda tem salvação. 🐮";
            else if (porcentagem < 50) mensagemGado = "é 50% gado, tá no caminho certo pra virar um boi reprodutor. 🐂";
            else if (porcentagem < 80) mensagemGado = "é um gado nível hard! Esse aí já tá até seguindo o crush no LinkedIn. 🤡";
            else mensagemGado = "é 100% GADO SUPREMO! Esse aí se chamar de 'amor' ele assina até o testamento no nome da pessoa. 🚩🚩🚩";

            await sock.sendMessage(sender, { text: `🐂 *TESTE DO GADO* 🐂\n\nO @${alvo} é ${porcentagem}% gado! \n${mensagemGado}`, mentions: [mention] }, { quoted: msg });
        }

        if (text.startsWith('!corno')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para fazer o teste do chifre!", quoted: msg });

            await sock.sendMessage(sender, { react: { text: '🦌', key: msg.key } });

            const nivelChifre = Math.floor(Math.random() * 101);
            const alvo = mention.split('@')[0];
            let resultado = "";
            
            if (nivelChifre === 0) resultado = "é fiel pra caramba! Nem o GPS consegue rastrear desvio. 😇";
            else if (nivelChifre < 30) resultado = "tem apenas um 'chifrinho' de estimação. Quase nada! 🤏";
            else if (nivelChifre < 60) resultado = "tá usando um chifre que já começa a incomodar na hora de passar na porta. 🦌";
            else if (nivelChifre < 90) resultado = "tem um chifre de nível altíssimo! A cabeça tá até pesando, né? 😂";
            else resultado = "é o REI DOS CORNOS! Esse aí o chifre já virou anteninha pra pegar Wi-Fi de motel! 🚩🚩🚩";

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/JTnj9CLoaI8AAAPo/meek-horn-corno-manso.mp4' }, 
                gifPlayback: true,
                caption: `🦌 *DETECTOR DE CHIFRES* 🦌\n\nO @${alvo} está com ${nivelChifre}% de chifre no momento!\n\nResultado: ${resultado}`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        if (text === '!cargos') {
            let cargos = lerArquivoSeguro(arquivoCargos);
            const opcoesDisponiveis = ["👑 LENDA", "🔥 REI DA ZUEIRA", "🐂 GADO SUPREMO", "🤫 FOFOQUEIRO(A)", "💎 VIP", "🌟 ESTRELA DO BONDE"];
            let texto = "👑 *SISTEMA DE CARGOS DE LUXO* 👑\n\n*--- CARGOS DISPONÍVEIS PARA COMPRA ---*\n";
            
            opcoesDisponiveis.forEach(c => texto += `• ${c}\n`);
            texto += "\n_Use !comprar_cargo [nome do cargo] para se tornar um de nós!_\n\n";

            const listaDeCargos = Object.entries(cargos);
            if (listaDeCargos.length > 0) {
                texto += "*--- QUEM JÁ OSTENTA UM CARGO ---*\n";
                let listaMentions = [];
                listaDeCargos.forEach(([id, nomeCargo]) => {
                    listaMentions.push(id);
                    texto += `• @${id.split('@')[0]}: *${nomeCargo}*\n`;
                });
                await sock.sendMessage(sender, { text: texto, mentions: listaMentions, quoted: msg });
            } else {
                texto += "_Ninguém comprou um cargo ainda. Seja o primeiro!_";
                await sock.sendMessage(sender, { text: texto, quoted: msg });
            }
        }

        if (text.startsWith('!fofoca')) {
            if (!isGroup) return await sock.sendMessage(sender, { text: "❌ Isso só funciona em grupos, senão não tem graça!", quoted: msg });
            await sock.sendMessage(sender, { react: { text: '🤫', key: msg.key } });

            try {
                const metadata = await sock.groupMetadata(sender);
                const ppts = metadata.participants;
                const alvo1 = ppts[Math.floor(Math.random() * ppts.length)];
                const alvo2 = ppts[Math.floor(Math.random() * ppts.length)];

                if (alvo1.id === alvo2.id) {
                    return await sock.sendMessage(sender, { text: `❌ O @${alvo1.id.split('@')[0]} estava querendo fofocar sozinho, mas não deu certo. Tente de novo! 😂`, mentions: [alvo1.id], quoted: msg });
                }

                const fofocas = [
                    `FONTES EXCLUSIVAS! Vi o @${alvo1.id.split('@')[0]} e o @${alvo2.id.split('@')[0]} de mãos dadas no privado! O grupo tá sabendo disso? 🤫`,
                    `Gente, não espalhem... mas o @${alvo1.id.split('@')[0]} foi visto bloqueando o @${alvo2.id.split('@')[0]} e depois desbloqueando logo em seguida. O drama! 🎭`,
                    `Parem tudo! @${alvo1.id.split('@')[0]} e @${alvo2.id.split('@')[0]} foram vistos discutindo por causa de uma figurinha polêmica! 🥊`,
                    `Vazou print! @${alvo1.id.split('@')[0]} disse que o @${alvo2.id.split('@')[0]} é o membro mais suspeito do grupo. Alguém confirma? 🧐`,
                    `O @${alvo1.id.split('@')[0]} estava perguntando ontem sobre o @${alvo2.id.split('@')[0]}... será que temos um novo casal ou uma nova treta? 🍿`
                ];

                const sorteioFofoca = fofocas[Math.floor(Math.random() * fofocas.length)];
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/pSDQzIsy8bUAAAPo/brizza-brizzabro.mp4' }, 
                    gifPlayback: true,
                    caption: `🤫 *BOMBA NO GRUPO!* 🤫\n\n${sorteioFofoca}`, 
                    mentions: [alvo1.id, alvo2.id] 
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(sender, { text: "❌ Erro ao buscar os fofoqueiros. Verifique se o bot é ADM!", quoted: msg });
            }
        }

        if (text.startsWith('!roubar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione quem você quer assaltar!", quoted: msg });
            if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Você não pode roubar a si mesmo, seu gênio! 😂", quoted: msg });

            const agora = Date.now();
            const tempoCooldown = 3 * 60 * 60 * 1000; 
            if (cooldownRoubo[participant] && (agora - cooldownRoubo[participant]) < tempoCooldown) {
                const tempoRestante = Math.ceil((tempoCooldown - (agora - cooldownRoubo[participant])) / (60 * 1000));
                return await sock.sendMessage(sender, { text: `⏳ *CALMA LÁ, LADRÃO!* Você está sendo procurado pela polícia. Tente novamente daqui a ${tempoRestante} minutos.`, quoted: msg });
            }

            if (typeof escudosAtivos !== 'undefined' && escudosAtivos[mention]) {
                return await sock.sendMessage(sender, { text: `🛡️ *ASSALTO FRUSTRADO!* O @${mention.split('@')[0]} está protegido por um ESCUDO!`, mentions: [mention], quoted: msg });
            }

            let placar = {};
            try {
                if (fs.existsSync(arquivoPlacar)) { placar = JSON.parse(fs.readFileSync(arquivoPlacar, 'utf8')); }
            } catch (e) { placar = {}; }

            if (!placar[participant]) placar[participant] = 0;
            if (!placar[mention]) placar[mention] = 0;

            const sucesso = Math.random() < 0.5;
            cooldownRoubo[participant] = agora; 

            if (sucesso) {
                const valorRoubado = Math.floor(Math.random() * 50) + 10;
                placar[participant] += valorRoubado;
                placar[mention] = Math.max(0, placar[mention] - valorRoubado);
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/5ckH12PXdUYAAAPo/ladr%C3%A3o-thief.mp4' }, 
                    gifPlayback: true,
                    caption: `💸 *ASSALTO BEM SUCEDIDO!* 💸\n\n@${participant.split('@')[0]} roubou ${valorRoubado} pontos do @${mention.split('@')[0]}!`, 
                    mentions: [participant, mention] 
                }, { quoted: msg });
            } else {
                placar[participant] = Math.max(0, placar[participant] - 20);
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/wbMLB5AzQFkAAAPo/jail-bugs.mp4' }, 
                    gifPlayback: true,
                    caption: `🚓 *OPS! VOCÊ FOI PRESO!* 🚓\n\nO @${participant.split('@')[0]} tentou roubar o @${mention.split('@')[0]} e a polícia chegou! Perdeu 20 pontos de fiança!`, 
                    mentions: [participant, mention] 
                }, { quoted: msg });
            }
        }

        if (text === '!rank') {
            let cargos = lerArquivoSeguro(arquivoCargos);
            const ranking = Object.entries(contagemMensagens).sort((a, b) => b[1] - a[1]).slice(0, 10);
            let res = "🏆 *RANKING DE QUEM VIVE NO ZAP*\n\n";
            let listaMentions = []; 

            ranking.forEach((entry, index) => {
                const [id, count] = entry;
                listaMentions.push(id); 
                let cargoDisplay = cargos[id] ? `💎 *${cargos[id].toUpperCase()}*` : "👤 *Membro*";
                res += `${index + 1}. @${id.split('@')[0]} | ${cargoDisplay} | ${count} msg\n`;
            });

            res += "\n━━━━━━━━━━━━━━━━━━\n\n👑 *HIERARQUIA DE PODER (ELITE):*\n";
            const cargosExistentes = ["Lenda", "Rei da Zueira", "Gado Supremo", "Fofoqueiro(a)"];
            const icones = { "Lenda": "👑", "Rei da Zueira": "🔥", "Gado Supremo": "🐂", "Fofoqueiro(a)": "🤫" };

            cargosExistentes.forEach(cargo => {
                const membros = Object.entries(cargos).filter(([id, nomeCargo]) => nomeCargo === cargo).map(([id]) => {
                    listaMentions.push(id); 
                    return `@${id.split('@')[0]}`;
                });
                if (membros.length > 0) res += `${icones[cargo] || "⭐"} *${cargo.toUpperCase()}*: ${membros.join(', ')}\n`;
            });

            res += "\n🤖 *Dica: Seja ativo e compre seu cargo!*";
            await sock.sendMessage(sender, { text: res, mentions: listaMentions }, { quoted: msg });
        }

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
                }, { quoted: msg }); 
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém!", quoted: msg });
            }
        }

        if (text.startsWith('!descasar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione quem você quer largar, seu indeciso!", quoted: msg });

            const p1 = participant; 
            const p2 = mention;     

            const index = listaCasais.findIndex(c => (c.p1 === p1 && c.p2 === p2) || (c.p1 === p2 && c.p2 === p1));
            if (index === -1) {
                return await sock.sendMessage(sender, { text: "❌ Vocês nem casados estão! Tá tentando divorciar de quem não tem compromisso? 😂", quoted: msg });
            }

            listaCasais.splice(index, 1);
            salvarCasais(); 

            const frasesDivorcio = [
                `💔 O divórcio saiu! @${p1.split('@')[0]} e @${p2.split('@')[0]} não aguentaram a pressão e deram fim nisso! 🥂`,
                `📉 Fim da linha! @${p1.split('@')[0]} e @${p2.split('@')[0]} assinaram o papel e cada um pro seu lado. Vida de solteiro é mais barato! 💸`,
                `🏃‍♂️ Correram! @${p1.split('@')[0]} e @${p2.split('@')[0]} decidiram que o amor era só uma ilusão de ótica. Livreeee! 💨`,
                `⚖️ Cartório do Caos informa: @${p1.split('@')[0]} e @${p2.split('@')[0]} estão oficialmente divorciados. O churrasco acabou! 🥩`,
                `🚪 A porta da rua é serventia da casa! @${p1.split('@')[0]} e @${p2.split('@')[0]} agora são apenas conhecidos. Deu ruim! 🤡`
            ];

            await sock.sendMessage(sender, { react: { text: '💔', key: msg.key } });
            await sock.sendMessage(sender, { text: frasesDivorcio[Math.floor(Math.random() * frasesDivorcio.length)], mentions: [p1, p2], quoted: msg });
        }

        if (text.startsWith('!casar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para casar, senão vai ficar encalhado!", quoted: msg });

            listaCasais = lerArquivoSeguro(arquivoCasais);
            const p1 = participant; 
            const p2 = mention;     

            const jaTemRelacionamento = listaCasais.find(c => c.p1 === p1 || c.p2 === p1 || c.p1 === p2 || c.p2 === p2);
            if (jaTemRelacionamento) {
                return await sock.sendMessage(sender, { text: "🚫 CRIME DE BIGAMIA! Um de vocês já está comprometido. Divorcie-se primeiro, seu safado! 😂", quoted: msg });
            }

            listaCasais.push({ p1, p2 }); 
            try {
                fs.writeFileSync(arquivoCasais, JSON.stringify(listaCasais, null, 2));
                console.log("✅ Casamento salvo no disco com sucesso!");
            } catch (err) {
                console.error("❌ Erro ao salvar casamento no disco:", err);
            }

            const frases = [
                `💍 O @${p1.split('@')[0]} casou com @${p2.split('@')[0]}!`,
                `💒 Alerta de união duvidosa! @${p1.split('@')[0]} e @${p2.split('@')[0]} casaram.`,
                `💘 O amor venceu! @${p1.split('@')[0]} e @${p2.split('@')[0]} agora formam o casal mais improvável do grupo! 😂`,
                `🥂 A vida de solteiro acabou para o @${p1.split('@')[0]}! @${p2.split('@')[0]}, prepara o divórcio que a gente já vai começar a contar o tempo! 🤡`,
                `💍 O @${p1.split('@')[0]} cansou da vida de solteiro e fisgou o @${p2.split('@')[0]}! Agora é oficial, bora pro churrasco de comemoração! 🥩`,
                `🤵👰 Alguém avisa o cartório que o @${p1.split('@')[0]} e o @${p2.split('@')[0]} perderam o juízo e casaram! 💒`,
                `🔥 O @${p1.split('@')[0]} não aguentou a pressão e pediu o @${p2.split('@')[0]} em casamento. O mico é grande, mas a união é sagrada! 🤣`,
                `💖 É oficial: @${p1.split('@')[0]} e @${p2.split('@')[0]} decidiram dividir a conta de luz (e a paciência)! Casaram! ⚡`
            ];
            
            await sock.sendMessage(sender, { react: { text: '💍', key: msg.key } });
            await sock.sendMessage(sender, { 
                video: { url: "https://media.tenor.com/h981yJykAXYAAAPo/la-haut-dessin-anime.mp4" }, 
                gifPlayback: true,
                caption: frases[Math.floor(Math.random() * frases.length)], 
                mentions: [p1, p2] 
            }, { quoted: msg });
        }

        if (text === '!casais') {
            try {
                if (fs.existsSync(arquivoCasais)) {
                    const dados = fs.readFileSync(arquivoCasais, 'utf8');
                    listaCasais = (dados && dados.trim().length > 0) ? JSON.parse(dados) : [];
                } else {
                    listaCasais = [];
                }
            } catch (e) {
                console.error("❌ Erro ao ler casais.json no comando !casais:", e);
                listaCasais = [];
            }

            if (!listaCasais || listaCasais.length === 0) return await sock.sendMessage(sender, { text: "❌ Ninguém casou ainda! Estão todos encalhados.", quoted: msg });

            const frasesZueiras = [
                "🏆 *CARTÓRIO DO CAOS - CASAIS DO MOMENTO* 🏆",
                "🔥 *OS LOUCOS QUE DECIDIRAM SOFRER JUNTOS* 🔥",
                "💒 *LISTA DE QUEM PERDEU A LIBERDADE (E A DIGNIDADE)* 💒",
                "🤡 *REDE GLOBO DE CASAMENTOS DUVIDOSOS* 🤡",
                "💖 *ALERTA DE ROMANCE: CUIDADO, CONTÉM EXCESSO DE MICO!* 💖",
                "💀 *UNIDADES DE CUIDADOS INTENSIVOS (CASAL)* 💀",
                "💍 *OS QUE ACHARAM QUE O AMOR NÃO ACABA (COITADOS)* 💍",
                "📉 *RANKING DE QUEM VAI TER QUE DIVIDIR O PIX* 📉",
                "🧨 *CASAMENTOS COM PRAZO DE VALIDADE CURTO* 🧨"
            ];
            let texto = frasesZueiras[Math.floor(Math.random() * frasesZueiras.length)] + "\n\n";
            let listaMentions = [];

            listaCasais.forEach((c, i) => {
                const id1 = c.p1.split('@')[0];
                const id2 = c.p2.split('@')[0];
                texto += `${i + 1}. @${id1} ❤️ @${id2}\n`;
                listaMentions.push(c.p1);
                listaMentions.push(c.p2);
            });
            
            texto += "\n🤡 Quem será o próximo trouxa a cair na armadilha? Digite !casar @alguém";
            await sock.sendMessage(sender, { react: { text: '💍', key: msg.key } });
            await sock.sendMessage(sender, { text: texto, mentions: listaMentions, quoted: msg });
        }

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
                }, { quoted: msg }); 
            } else {
                await sock.sendMessage(sender, { text: "❌ Mencione alguém para beijar!", quoted: msg });
            }
        }

        if (text === '!backup') {
            const meuNumero = '5527992997083@s.whatsapp.net';
            if (participant !== meuNumero) return;
            try {
                const arquivos = [arquivoPlacar, arquivoCargos, arquivoCasais, arquivoRank];
                for (const arquivo of arquivos) {
                    if (fs.existsSync(arquivo)) {
                        await sock.sendMessage(sender, { 
                            document: fs.readFileSync(arquivo), 
                            fileName: arquivo.replace('./', ''), 
                            mimetype: 'application/json' 
                        });
                    }
                }
                await sock.sendMessage(sender, { text: "✅ Backup enviado com sucesso!" });
            } catch (e) {
                await sock.sendMessage(sender, { text: "❌ Erro ao enviar backup: " + e.message });
            }
        }

        if (text === '!boss') {
            if (raidBoss.ativo) {
                const frasesDeboche = ["⚠️ O chefe já tá na área, seu cego! Quer que eu chame dois pra você perder mais rápido? 😂", "😤 Já tem um monstro destruindo tudo! Pega sua espada e ataca o que já tá aqui, preguiçoso!"];
                return await sock.sendMessage(sender, { text: frasesDeboche[Math.floor(Math.random() * frasesDeboche.length)], quoted: msg });
            }
            raidBoss.ativo = true;
            raidBoss.hp = 500;
            raidBoss.maxHp = 500;
            const msgBoss = await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/CGTSjjR7FIIAAAPo/game-interface-video-game.mp4' }, 
                gifPlayback: true,
                caption: `👹 *BOSS INVOCADO!* 👹\n\nHP: ${raidBoss.hp}/${raidBoss.maxHp}\n\nTodos ataquem com *!atacar* antes que ele destrua o grupo!` 
            }, { quoted: msg });
            raidBoss.idMensagem = msgBoss.key.id;
        }

        if (text === '!atacar') {
            if (!raidBoss.ativo) return await sock.sendMessage(sender, { text: "❌ Não tem monstro aqui. Tá batendo no vento?" });
            let dano = Math.floor(Math.random() * 50) + 10;
            let mensagemFuria = "";

            if (ataquesFuria[participant]) {
                dano *= 2; 
                mensagemFuria = "\n🔥 *DANO CRÍTICO DE FÚRIA!*";
                delete ataquesFuria[participant]; 
            }

            raidBoss.hp -= dano;
            await new Promise(resolve => setTimeout(resolve, 1000));

            if (raidBoss.hp <= 0) {
                raidBoss.ativo = false;
                let placar = lerArquivoSeguro(arquivoPlacar);
                placar[participant] = (placar[participant] || 0) + 200;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/NgTSh0Bq5lYAAAPo/wearwolfwere-werewolfwhere.mp4' }, 
                    gifPlayback: true,
                    caption: `🎉 VITÓRIA! O Boss foi derrotado! @${participant.split('@')[0]} deu o golpe final e ganhou 200 pontos!`,
                    mentions: [participant]
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `⚔️ Você causou ${dano} de dano!${mensagemFuria}\nHP do Boss: ${raidBoss.hp}/${raidBoss.maxHp}` });
            }
        }

        if (text === '!fechar') {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Ih, ala! O engraçadinho quer fechar o grupo? Deixa isso com quem manda! 🤡" }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: "Grupo fechado! 🤐" }, { quoted: msg });
                try {
                    await sock.groupSettingUpdate(sender, { announcement: true });
                } catch (e) {
                    await sock.groupSettingUpdate(sender, 'announcement');
                }
            }
        }

        if (text === '!abrir') {
            if (!isAdmin) {
                await sock.sendMessage(sender, { text: "Negativo! Só ADM manda aqui! 😂" }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: "Grupo aberto! Podem soltar a bagunça! 🔓" }, { quoted: msg });
                try {
                    await sock.groupSettingUpdate(sender, { announcement: false });
                } catch (e) {
                    await sock.groupSettingUpdate(sender, 'not_announcement');
                }
            }
        }

        if (text === '!avisoadm') { 
            if (!msg.key.remoteJid.endsWith('@g.us')) return await sock.sendMessage(sender, { text: 'Este comando só funciona em grupos!', quoted: msg });
            try {
                const metadata = await sock.groupMetadata(msg.key.remoteJid);
                const participantes = metadata.participants;
                const autorId = msg.key.participant || msg.key.remoteJid;
                const autorDados = participantes.find(p => p.id === autorId);
                if (!autorDados || autorDados.admin === null) return await sock.sendMessage(sender, { text: '❌ Sai pra lá, apenas administradores podem usar este comando.', quoted: msg });

                const admins = participantes.filter(p => p.admin !== null).map(p => p.id);
                if (admins.length === 0) return await sock.sendMessage(sender, { text: 'Não encontrei administradores neste grupo.', quoted: msg });

                const frasesAlerta = [
                    `🚨 *ALERTA VERMELHO!* 🚨\n\nOs ADMs foram convocados para uma reunião de emergência! O circo está pegando fogo! 🔥`,
                    `📢 *CHAMADA GERAL DE ADMS!* 📢\n\nLarguem o que estão fazendo! O grupo precisa de vocês antes que a casa caia! 🏃‍♂️`
                ];
                const sorteioAlerta = frasesAlerta[Math.floor(Math.random() * frasesAlerta.length)];
                const mençãoAdm = `${sorteioAlerta} \n\n${admins.map(adm => `@${adm.split('@')[0]}`).join(' ')}`;

                await sock.sendMessage(sender, { text: mençãoAdm, mentions: admins }, { quoted: msg });
            } catch (error) {
                await sock.sendMessage(sender, { text: '❌ O sistema de alarme falhou... os ADMs estão soltos!', quoted: msg });
            }
        }

        if (text === '!musica') {
            const desafios = [
                { frase: "Numa folha qualquer eu desenho um sol amarelo, e com cinco ou seis retas é fácil fazer um...", resposta: "castelo" },
                { frase: "Pela luz dos olhos teus, o que se vê, não é exatamente o que se vê, o que a gente vê, não é exatamente o que a gente...", resposta: "vê" },
                { frase: "Eu não sou daqui, marinheiro só, eu não tenho amor, marinheiro...", resposta: "só" }
            ];
            const sorteio = desafios[Math.floor(Math.random() * desafios.length)];
            await sock.sendMessage(sender, { react: { text: '🎤', key: msg.key } });
            
            const msgJogo = await sock.sendMessage(sender, { 
                caption: `🎤 *DESAFIO MESTRE (VALENDO 50 PONTOS)* 🎤\n\n"${sorteio.frase}..."\n\n*Responda EM CIMA desta mensagem!*`,
                video: { url: 'https://media.tenor.com/8DDZDteRUFgAAAPo/muzeke.mp4' },
                gifPlayback: true
            }, { quoted: msg });

            jogoEmoji.ativo = true; 
            jogoEmoji.resposta = sorteio.resposta;
            jogoEmoji.idMensagem = msgJogo.key.id;
        }

        if (text.startsWith('!forca')) {
            const palavrasHard = ['abstrato', 'efemeridade', 'paradoxo', 'onisciente', 'idiossincrasia', 'inexoravel'];
            const palavrasMedio = ['arquitetura', 'paradigma', 'recursividade', 'criptografia', 'abstração', 'framework'];
            
            const nivel = Math.random() > 0.5 ? 'hard' : 'medio';
            const listaPalavras = nivel === 'hard' ? palavrasHard : palavrasMedio;
            const listaDicas = { 'abstrato': 'Algo não concreto', 'efemeridade': 'Dura pouco', 'paradoxo': 'Contradição', 'onisciente': 'Sabe tudo', 'idiossincrasia': 'Peculiaridade', 'inexoravel': 'Invitável', 'arquitetura': 'Estrutura', 'paradigma': 'Modelo', 'recursividade': 'Função que chama a si', 'criptografia': 'Proteção de dados', 'abstração': 'Esconder detalhes', 'framework': 'Ferramentas' };

            jogoForca.palavra = listaPalavras[Math.floor(Math.random() * listaPalavras.length)];
            jogoForca.dica = listaDicas[jogoForca.palavra] || 'Sem dica';
            jogoForca.descobertas = Array(jogoForca.palavra.length).fill('_');
            jogoForca.tentativas = [];
            jogoForca.ativo = true;
            jogoForca.erros = 0;
            jogoForca.maxErros = 6;

            const msgForca = await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/7HUogy7rXs4AAAPo/feel-me-think-about-it.mp4' }, 
                gifPlayback: true,
                caption: `💀 *JOGO DA FORCA (${nivel.toUpperCase()})*\n\nDica: ${jogoForca.dica}\n\nPalavra: ${jogoForca.descobertas.join(' ')}` 
            }, { quoted: msg });
            jogoForca.idMensagem = msgForca.key.id; 
            return;
        }

        if (jogoForca.ativo && !jogoForca.processando) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo || msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo;
            if (contextInfo?.stanzaId === jogoForca.idMensagem && !text.startsWith('!')) {
                jogoForca.processando = true;
                const resposta = text.toLowerCase().trim();
                const autor = msg.key.participant || msg.key.remoteJid;

                if (resposta.length > 1) {
                    if (resposta === jogoForca.palavra) {
                        jogoForca.ativo = false;
                        await sock.sendMessage(sender, { text: `🎉 ACERTOU! A palavra era *${jogoForca.palavra.toUpperCase()}*`, quoted: msg });
                    }
                } else if (resposta.length === 1) {
                    if (!jogoForca.tentativas.includes(resposta)) {
                        jogoForca.tentativas.push(resposta);
                        if (jogoForca.palavra.includes(resposta)) {
                            for (let i = 0; i < jogoForca.palavra.length; i++) if (jogoForca.palavra[i] === resposta) jogoForca.descobertas[i] = resposta;
                            await sock.sendMessage(sender, { text: `Boa! ${jogoForca.descobertas.join(' ')}` });
                        } else {
                            jogoForca.erros++;
                            await sock.sendMessage(sender, { text: `❌ Errou! ${jogoForca.maxErros - jogoForca.erros} vidas restando.` });
                        }
                    }
                }
                setTimeout(() => { jogoForca.processando = false; }, 1000); 
            }
        }

        if (text.startsWith('!desmute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "Você não é ADM!" });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (mention && mutados[mention]) {
                delete mutados[mention];
                fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                await sock.sendMessage(sender, { text: "Desmutado!😎😂", mentions: [mention] });
            }
        }

        if (text.startsWith('!mute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "Somente ADMs podem mutar!" });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione o alvo!", quoted: msg });
            
            const MEU_ID_REAL = "96057379803159@lid"; 
            const meuNumero = "5527992997083";
            
            if (mention === MEU_ID_REAL || String(mention).includes(meuNumero)) {
                return await sock.sendMessage(sender, { text: "❌ Nem tenta! O criador é intocável! 👑", quoted: msg });
            }

            const tempo = text.includes('h') ? 3600000 : 1800000;
            mutados[mention] = Date.now() + tempo;
            fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
            await sock.sendMessage(sender, { text: "Você está falando demais, dá um tempo seu rabugento.😂❌", mentions: [mention] }, { quoted: msg });
        }

        if (text.startsWith('!clima')) {
            const cidade = text.replace('!clima', '').trim();
            if (!cidade) return await sock.sendMessage(sender, { text: "❌ Digite a cidade!", quoted: msg });

            const piadasClima = {
                'sunny': ["Tá um sol que parece o inferno! 🔥", "Dia de ficar no PC. ☀️"],
                'cloudy': ["Tempo nublado, igual ao seu histórico. ☁️", "Parece que vai chover... ou não. 🌩️"],
                'rain': ["Chovendo? Ótimo, desculpa pra não fazer nada! 🌧️", "Combo: chuva, café e tédio. ☕"]
            };

            try {
                // Trocado o weather-js bugado pela api da wttr.in (MUITO mais estável)
                const res = await axios.get(`https://wttr.in/${encodeURIComponent(cidade)}?format=j1`);
                const climaData = res.data.current_condition[0];
                const tempC = climaData.temp_C;
                const desc = climaData.lang_pt ? climaData.lang_pt[0].value : climaData.weatherDesc[0].value;
                const cat = desc.toLowerCase().includes('sol') || desc.toLowerCase().includes('limpo') ? 'sunny' : (desc.toLowerCase().includes('chuva') ? 'rain' : 'cloudy');

                const msgClima = `🌤 *Tempo em: ${cidade.toUpperCase()}*\n🌡 Temp: ${tempC}°C\n☁️ Condição: ${desc}\n\n💬 *Bot:* ${piadasClima[cat][Math.floor(Math.random() * piadasClima[cat].length)]}`;
                await sock.sendMessage(sender, { text: msgClima }, { quoted: msg });
            } catch (err) {
                await sock.sendMessage(sender, { text: "❌ Cidade não encontrada ou erro no satélite do clima.", quoted: msg });
            }
        }

        // --- SALVAMENTO FINAL DE RANKING ---
        contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
        fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens)); 

    }); 
}

connectToWhatsApp();
