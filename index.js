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

async function getProfilePic(sock, jid) {
    try {
        const ppUrl = await sock.profilePictureUrl(jid, 'image');
        return { url: ppUrl };
    } catch (err) {
        // Se der erro (pessoa sem foto ou privada), retorna uma imagem padrão
        return { url: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' };
    }
}

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
    const arquivos = [arquivoPlacar, arquivoCargos, arquivoCasais, ARQUIVO_RANK];
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
        
        const isLid = participant && participant.includes('@lid');
        const quoteMsg = isLid ? undefined : msg; 
        const myMention = isLid ? [] : [participant];

        const isGroup = sender.endsWith('@g.us');
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
        const lowerText = text.toLowerCase();
        const isMedia = !!(msg.message.imageMessage || msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage);
        
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

        if (mutados[participant] && Date.now() < mutados[participant]) {
            await sock.sendMessage(sender, { delete: msg.key });
            return; 
        }

        if (membrosPendentes[participant]) {
            const msgCorpo = msg.message;
            if (!msgCorpo) return;

            // ==========================================
            // 👁️ VERIFICAÇÃO BLINDADA DE MÍDIA (NORMAL E VIEW ONCE)
            // ==========================================
            
            // 1. Checa todas as versões de "Visualização Única" que o WhatsApp já inventou
            const viewOnceV1 = msgCorpo.viewOnceMessage?.message;
            const viewOnceV2 = msgCorpo.viewOnceMessageV2?.message;
            const viewOnceExt = msgCorpo.viewOnceMessageV2Extension?.message;
            
            // Junta tudo pra ver se tem conteúdo de visualização única
            const conteudoViewOnce = viewOnceV1 || viewOnceV2 || viewOnceExt;
            
            // Confirma se dentro do View Once tem imagem ou vídeo
            let mandouViewOnce = !!(conteudoViewOnce && (conteudoViewOnce.imageMessage || conteudoViewOnce.videoMessage));
            
            // Confirma se mandou mídia normal (sem ser view once)
            let midiaNormal = !!(msgCorpo.imageMessage || msgCorpo.videoMessage);

            // RADAR DE EMERGÊNCIA: Se por algum milagre o WhatsApp mudar de novo, ele vasculha as chaves ocultas
            if (!mandouViewOnce && !midiaNormal) {
                const chaves = JSON.stringify(msgCorpo);
                if ((chaves.includes('viewOnce') || chaves.includes('viewOnceMessage')) && (chaves.includes('imageMessage') || chaves.includes('videoMessage'))) {
                    mandouViewOnce = true;
                }
            }

            const midia = mandouViewOnce || midiaNormal;

            // ==========================================

            const padraoApresentacao = /\|/g;
            const enviouTextoCorreto = (text && (text.match(padraoApresentacao) || []).length >= 3);

            const numeroExibicao = participant.split('@')[0];

            if (midia || enviouTextoCorreto) {
                let textoConfirmacao = `✅ *Cadastro confirmado!* 🎉\n\nFala, @${numeroExibicao}! Você mandou muito bem na apresentação. Bem-vindo(a) à elite do Bonde! 🚀🔥`;
                let emojiReacao = '✅';
                
                if (mandouViewOnce) {
                    textoConfirmacao = `🕵️‍♂️ *Visão Biônica Ativada!* 👀\n\nRelaxa, @${numeroExibicao}, eu consegui validar sua foto/vídeo de visualização única! Ninguém precisa ver, só o sistema! 🔒✨\n\n✅ *Cadastro 100% confirmado!* Bem-vindo(a) ao Bonde! 🚀🎉`;
                    emojiReacao = '🕵️‍♂️';
                }

                await sock.sendMessage(sender, { react: { text: emojiReacao, key: msg.key } });
                await sock.sendMessage(sender, { 
                    text: textoConfirmacao, 
                    mentions: [participant] 
                }, { quoted: msg });
                
                delete membrosPendentes[participant];
            } else {
                await sock.sendMessage(sender, { react: { text: '⚠️', key: msg.key } });
                await sock.sendMessage(sender, { 
                    text: `⚠️ Ei, @${numeroExibicao}, cadê a apresentação? Você não seguiu o padrão! 🤦‍♂️\n\nEnvie uma *FOTO/VÍDEO* (pode ser de visualização única 🔒) ou o formato:\n*FOTO | CIDADE | IDADE | NOME* 📸`, 
                    mentions: [participant] 
                }, { quoted: msg });
            }
            return;
        }
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

        if (text.startsWith('!')) {
            const comandosExistentes = ['!menu', '!todos', '!pix', '!fantasmas', '!lembrete', '!apagar', '!decidir', '!cassino', '!conselho', '!resumo', '!regras', '!comprar', '!roleta', '!bafometro', '!verdade', '!fuga', '!corrida', '!macumba', '!calvo', '!qi', '!serasa', '!historico', '!fakenews', '!rinha', '!vasco', '!gravida', '!feio', '!clt', '!bola8', '!perfil', '!culpado', '!inocente', '!shippar',  '!julgar', '!loja', '!pesquisar', '!backup', '!dar_pontos', '!atacar', '!boss', '!rank', '!casar', '!casais', '!piada', '!avisoadm', '!descasar', '!emoji', '!sortear', '!cadastros', '!perguntas', '!jogar', '!forca', '!jogosoff', '!jogoson', '!limpar', '!fixar', '!status', '!link', '!tier', '!ranking', '!placar', '!penalti', '!musica', '!socar', '!beijar', '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', '!clima', '!desmute', '!mute', '!gado', '!corno', '!fofoca', '!roubar', '!cargos', '!comprar_cargo', '!dar_cargo'];
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

        const comandosDeJogo = ['!piada', '!casar', '!descasar', '!forca', '!penalti', '!sortear', '!emoji', '!jogar', '!musica', '!perguntas', '!roleta', '!fuga', '!corrida', '!cassino', '!bola8', '!shippar', '!decidir'];
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
                { q: "Qual a unidade de medida do Sistema Internacional para resistência elétrica? ⚡", r: "ohm" }
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

        // ==========================================
        // 👹 SISTEMA DE BOSS (!boss / !atacar)
        // ==========================================
        if (text === '!boss') {
            if (raidBoss.ativo) {
                const frasesDeboche = [
                    "⚠️ O chefe já tá na área, seu cego! Quer que eu chame dois pra você perder mais rápido? 😂", 
                    "😤 Já tem um monstro destruindo tudo! Pega sua espada e ataca o que já tá aqui, preguiçoso!"
                ];
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

        if (text.startsWith('!emoji')) {
            const desafios = [
                { emojis: '⏳🏜️🪰🕶️', resposta: 'duna', gif: 'https://tenor.com/pt-BR/view/mike-dune-mike-paul-dune-mikes-book-reviews-dune-mikes-book-reviews-paul-mike-atreides-gif-22418379' },
                { emojis: '🏢🧩💀📼', resposta: 'jogos mortais', gif: 'https://media.tenor.com/_VCUIiAYnQUAAAPo/jigsaw-saw.mp4' }
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
            
            const textoChamativo = `
╔════════════════════════╗
      🔥 *BONDE DO BRASIL* 🔥
╚════════════════════════╝

📍 *O convite oficial do nosso grupo:*

👉 ${linkDoGrupo}

⚠️ *Regra de Ouro:*
Proibido a entrada de gringos. Mantenha a qualidade da nossa Elite! 👑

━━━━━━━━━━━━━━━━━━━
_Não perca tempo, compartilhe agora!_`.trim();

            await sock.sendMessage(sender, { text: textoChamativo }, { quoted: msg });
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
                    'Bom dia! O sol nasceu para todos, mas só para os trouxas que já estão acordados. ☀️'
                ];
            } else if (lowerText.includes('boa tarde')) {
                emoji = '🌤️';
                frases = [
                    'Boa tarde! O dia já tá acabando e você produziu o quê? Exatamente... nada! 😂',
                    'Boa tarde! Hora daquele cochilo maroto que o chefe não pode saber. 💤'
                ];
            } else if (lowerText.includes('boa noite')) {
                emoji = '🌙';
                frases = [
                    'Boa noite! Vai dormir que amanhã o sofrimento continua! 🌙',
                    'Boa noite! Sonhe com os anjos (ou com o pix que nunca cai). 💸'
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
 ┣ 🛒 !loja ➾ 💰 !roubar
 ┣ 💳 !comprar_cargo ➾ 🎁 !comprar
 ┣ 💸 !pix ➾ 🎰 !cassino
 ┗ 🏆 !ranking ➾ 🥇 !rank

🎲 *DIVERSÃO & SORTE*
 ┣ 👾 !jogar ➾ 🏎️ !fuga
 ┣ 🏇 !corrida ➾ 🔫 !roleta
 ┣ 💀 !forca ➾ ⚽ !penalti
 ┣ 🧠 !perguntas ➾ 🎤 !musica
 ┣ 🎬 !emoji ➾ 🤡 !piada
 ┣ ⚖️ !decidir ➾ 🎱 !bola8
 ┗ 💘 !shippar @mencao

😈 *CAOS & TRETA*
 ┣ ⚖️ !julgar ➾ 💍 !casar
 ┣ 💔 !descasar ➾ 💞 !casais
 ┣ 🤫 !fofoca ➾ 🥊 !socar
 ┣ 💋 !beijar ➾ 🪄 !macumba
 ┣ 🐂 !gado ➾ 🦌 !corno
 ┣ 🔪 !matar ➾ ⚔️ !rinha
 ┗ 🖼️ !f _(Sticker)_ ➾ 👤 !perfil

🤡 *ZUEIRA & EXPOSED* 
 ┣ 📉 !qi ➾ 👴 !calvo
 ┣ 🧟‍♂️ !feio ➾ 🍻 !bafometro
 ┣ 🤥 !verdade ➾ 💸 !serasa
 ┣ 💼 !clt ➾ 🍼 !gravida
 ┣ ⚰️ !vasco ➾ 💻 !historico
 ┣ 🗞️ !fakenews ➾ 🧠 !conselho
 ┗ 📝 !resumo

⚔️ *GUERRA & STATUS*
 ┣ 👹 !boss ➾ ⚔️ !atacar
 ┗ 🎖️ !cargos ➾ 📊 !tier

🚨 *CONTROLE (ADMS)*
 ┣ 🔨 !ban ➾ 🔇 !mute
 ┣ 🔊 !desmute ➾ 🔒 !fechar
 ┣ 🔓 !abrir ➾ 👑 !adm
 ┣ 🕹️ !jogoson ➾ 🚫 !jogosoff
 ┣ 💰 !dar_pontos ➾ 📣 !avisoadm
 ┣ 📋 !cadastros ➾ 📣 !todos
 ┗ 👻 !fantasmas

🛠️ *SISTEMA*
 ┣ 🌤️ !clima ➾ 🔍 !pesquisar
 ┣ 🔗 !link ➾ 💾 !backup
 ┣ ⏰ !lembrete ➾ 🧹 !apagar
 ┗ 📜 !regras ➾ 📛 !menu

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

        // ==========================================
        // 1. 🔫 ROLETA RUSSA (!roleta) - ALTO RISCO, ALTA RECOMPENSA
        // ==========================================
        if (text === '!roleta') {
            await sock.sendMessage(sender, { react: { text: '🔫', key: msg.key } });
            
            // Trava para ADM/Dono não se mutar sem querer
            if (groupAdmins.includes(participant) || participant.includes('5527992997083')) {
                return await sock.sendMessage(sender, { 
                    text: "👑 *A Elite não brinca com a vida!* Deixa a roleta russa pros meros mortais.", quoted: msg 
                });
            }

            const tambor = Math.floor(Math.random() * 6) + 1; // 1 chance em 6 de atirar
            
            if (tambor === 1) {
                // Deu ruim: Mute de 2 minutos
                mutados[participant] = Date.now() + 120000;
                fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/Ui9-MdUsQO0AAAPo/skeleton-falling.mp4' }, 
                    gifPlayback: true,
                    caption: `💥 *POU!* 💥\n\nO @${participant.split('@')[0]} apertou o gatilho e a arma disparou!\n\nFoi de base! Mute de 2 minutos pra aprender a dar valor à vida! ⚰️`, 
                    mentions: [participant] 
                }, { quoted: msg });
            } else {
                // Deu bom: Ganha pontos por sobreviver
                let placar = lerArquivoSeguro(arquivoPlacar);
                placar[participant] = (placar[participant] || 0) + 100;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/KD0--RdfA18AAAPo/dance-ai-animal.mp4' }, 
                    gifPlayback: true,
                    caption: `💨 *CLIQUE VAZIO...* 💨\n\nSorte do caramba! O @${participant.split('@')[0]} sobreviveu à Roleta Russa e levou *100 pontos* pelo trauma psicológico! 💰`, 
                    mentions: [participant] 
                }, { quoted: msg });
            }
        }

        // ==========================================
        // 2. 🍻 BAFÔMETRO DO BONDE (!bafometro)
        // ==========================================
        if (text.startsWith('!bafometro')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || participant;
            const alvo = mention.split('@')[0];
            
            await sock.sendMessage(sender, { react: { text: '🍻', key: msg.key } });

            const nivelAlcool = Math.floor(Math.random() * 101);
            let diagnostico = "";

            if (nivelAlcool === 0) diagnostico = "Puro suco de santidade. Só bebeu água com gás e Dolly. 👼";
            else if (nivelAlcool < 30) diagnostico = "Deu um gole no vinho do padre e tá fingindo que tá tonto. Fraco! 🍷";
            else if (nivelAlcool < 60) diagnostico = "Tá no brilho! Já começou a rir de piada sem graça e mandar áudio pro ex. 📱🤡";
            else if (nivelAlcool < 90) diagnostico = "COMPLETAMENTE EMBRIAGADO! Abraçando poste e chorando por saudade de quem não conhece. 🍺😵‍💫";
            else diagnostico = "COMA ALCOÓLICO! A veia tá bombeando Corote puro! Chama o SAMU antes que ele beije um cachorro de rua! 🚑🚨";

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/Hi_hSejk4tgAAAPo/tammie-sutherland-tammie.mp4' }, 
                gifPlayback: true,
                caption: `🚔 *BLITZ DO BAFÔMETRO* 🚔\n\nAssopra aqui, @${alvo}!\n\n📊 *Nível de Álcool:* ${nivelAlcool}%\n📝 *Laudo:* ${diagnostico}`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        // ==========================================
        // 3. 🤥 MÁQUINA DA VERDADE (!verdade)
        // ==========================================
        if (text.startsWith('!verdade')) {
            const afirmacao = text.replace('!verdade', '').trim();
            if (!afirmacao) return await sock.sendMessage(sender, { text: "❌ Oxe, digita a fofoca! Ex: !verdade O Cleyton é calvo?" }, { quoted: msg });

            await sock.sendMessage(sender, { react: { text: '🤖', key: msg.key } });

            const isVerdade = Math.random() > 0.5;
            const resVerdade = [
                "✅ O polígrafo apitou: ISSO É A MAIS PURA VERDADE! Não tem como negar.",
                "✅ Fato comprovado cientificamente. Podem assinar embaixo!",
                "✅ O sistema não mente. É verdade absoluta! Já pode espalhar a fofoca."
            ];
            const resMentira = [
                "❌ BIIIP! BIIIP! ALARME DE MENTIROSO! 🤥 Mais falso que nota de 3 reais.",
                "❌ Mentira lavada! O polígrafo até pegou fogo de tanta falsidade.",
                "❌ Caô puro! A pessoa que falou isso tem diploma de Pinóquio."
            ];

            const respostaFinal = isVerdade ? resVerdade[Math.floor(Math.random() * resVerdade.length)] : resMentira[Math.floor(Math.random() * resMentira.length)];

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/YxZWYZxt-mQAAAPo/you-see-this-peak.mp4' }, 
                gifPlayback: true,
                caption: `🚨 *MÁQUINA DA VERDADE DO RATINHO* 🚨\n\n🗣️ *A afirmação:* "${afirmacao}"\n\n${respostaFinal}` 
            }, { quoted: msg });
        }

        // ==========================================
        // 4. 🏎️ FUGA DA POLÍCIA (!fuga) - MINI RPG
        // ==========================================
        if (text.startsWith('!fuga')) {
            const args = text.replace('!fuga', '').trim();
            const veiculo = parseInt(args);

            if (!veiculo || veiculo < 1 || veiculo > 3) {
                await sock.sendMessage(sender, { react: { text: '🚨', key: msg.key } });
                return await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/bBJVwTdMtvgAAAPo/pay-pay-pig.mp4' }, 
                    gifPlayback: true,
                    caption: `🚨 *VOCÊ ACABOU DE ROUBAR O BANCO DO ZAP!* 🚨\n\nA viatura tá na cola! Escolha seu veículo de fuga rápido:\n\n1️⃣ Celta Rebaixado com escada no teto\n2️⃣ Moto CG Titan cortando giro\n3️⃣ Patinete Elétrico sem freio\n\nDigite: !fuga [1, 2 ou 3]`
                }, { quoted: msg });
            }

            let placar = lerArquivoSeguro(arquivoPlacar);
            if (!placar[participant]) placar[participant] = 0;

            const sobreviveu = Math.random() > 0.6; // 40% de chance de escapar (é difícil!)

            if (sobreviveu) {
                const grana = Math.floor(Math.random() * 200) + 100; // Ganha entre 100 e 300
                placar[participant] += grana;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/KLtkyO5aAg4AAAPo/run-run-forest.mp4' }, 
                    gifPlayback: true,
                    caption: `🏎️ *FUGA BEM SUCEDIDA!* 💨\n\nVocê usou a opção ${veiculo}, despistou a polícia dando fuga pelo beco e escondeu o malote!\n\n💰 *Você lavou:* +${grana} pontos!\n📊 *Saldo atual:* ${placar[participant]} pts.`
                }, { quoted: msg });
            } else {
                const multa = Math.floor(Math.random() * 100) + 50; 
                placar[participant] = Math.max(0, placar[participant] - multa);
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/_SJRU8_nDKYAAAPo/monkey-monkey-in-jail.mp4' }, 
                    gifPlayback: true,
                    caption: `🚔 *DEU RUIM! PERDEU, PLAYBOY!* 🚔\n\nO pneu do seu veículo ${veiculo} furou e a ROTA te enquadrou de jeito!\n\n💸 *Multa paga:* -${multa} pontos!\n📊 *Saldo atual:* ${placar[participant]} pts.`
                }, { quoted: msg });
            }
        }

        // ==========================================
        // 5. 🏇 CORRIDA DO BICHO (!corrida)
        // ==========================================
        if (text.startsWith('!corrida')) {
            const args = text.replace('!corrida', '').trim();
            const aposta = parseInt(args);

            if (!aposta || aposta < 1 || aposta > 3) {
                await sock.sendMessage(sender, { react: { text: '🏇', key: msg.key } });
                return await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/LemH9cVat2QAAAPo/horse-horse-smile.mp4' }, 
                    gifPlayback: true,
                    caption: `🏇 *JOCKEY CLUB DO BONDE VIP* 🏇\n\nFaça sua aposta em qual bicho vai ganhar a corrida (Custa 50 pontos para entrar, prêmio de 150):\n\n1️⃣ 🐕 Caramelo com fome\n2️⃣ 🐴 Cavalo Manco\n3️⃣ 🐢 Tartaruga Ninja\n\nDigite: !corrida [1, 2 ou 3]`
                }, { quoted: msg });
            }

            let placar = lerArquivoSeguro(arquivoPlacar);
            const saldo = placar[participant] || 0;

            if (saldo < 50) return await sock.sendMessage(sender, { text: "❌ Você não tem 50 pontos pra apostar, caloteiro!" }, { quoted: msg });

            // Desconta a aposta
            placar[participant] -= 50;
            const bichoVencedor = Math.floor(Math.random() * 3) + 1;
            const nomesBichos = { 1: "🐕 Caramelo", 2: "🐴 Cavalo Manco", 3: "🐢 Tartaruga Ninja" };

            if (aposta === bichoVencedor) {
                placar[participant] += 150;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/UXES3V3dTjkAAAPo/dhulbahante-dhulo.mp4' }, 
                    gifPlayback: true,
                    caption: `🏆 *FINAL DA CORRIDA!* 🏆\n\nO bicho vencedor foi o ${nomesBichos[bichoVencedor]}!\n\nVocê acertou a aposta e ganhou *150 pontos*! Tá rico!`
                }, { quoted: msg });
            } else {
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/K_OnHPppGfAAAAPo/horse-horse-tongue-out.mp4' }, 
                    gifPlayback: true,
                    caption: `📉 *ZEBRA NA PISTA!* 📉\n\nO bicho vencedor foi o ${nomesBichos[bichoVencedor]}!\n\nSeu animal tropeçou na própria pata e você perdeu seus 50 pontos. Vai trabalhar pra recuperar! 😂`
                }, { quoted: msg });
            }
        }

        // ==========================================
        // 6. 🪄 MANDAR MACUMBA (!macumba)
        // ==========================================
        if (text.startsWith('!macumba')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Pra quem vai o feitiço? Marque o alvo!" }, { quoted: msg });
            if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Jogar praga em si mesmo? Você precisa de terapia, não de magia! 😂", quoted: msg });

            await sock.sendMessage(sender, { react: { text: '🪄', key: msg.key } });

            const feitiços = [
                "Caganeira explosiva toda vez que estiver no transporte público.",
                "Chifre duplo com LED piscante no escuro.",
                "Bateria do celular sempre acabando em 3% na hora da fofoca boa.",
                "Dedinho do pé batendo na quina do móvel 3x ao dia.",
                "Ficar calvo em menos de 6 meses e não ter dinheiro pro implante.",
                "Mandar mensagem errada pro chefe confessando que tá bebendo na terça."
            ];

            const praga = feitiços[Math.floor(Math.random() * feitiços.length)];

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/TmeM8DWY_cQAAAPo/macumba-tambor.mp4' }, 
                gifPlayback: true,
                caption: `🔮 *TRABALHO FEITO NA ENCRUZILHADA DO ZAP!* 🔮\n\nO @${participant.split('@')[0]} acendeu a vela preta e jogou uma mandinga pesada no @${mention.split('@')[0]}!\n\n🕯️ *A MALDIÇÃO:* ${praga}\n\nReza 10 Ave Marias pra ver se sai! 👹`, 
                mentions: [participant, mention] 
            }, { quoted: msg });
        }

        if (text === '!piada') {
            const piadas = [
                { pergunta: "O que o pato disse para a pata? (Dica: é um trocadilho amoroso)", resposta: "vem quá" },
                { pergunta: "Por que a plantinha não vai ao médico? (Dica: ela é...)", resposta: "porque ela já tem plantão" }
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
            const args = text.replace('!penalti', '').trim();
            const escolha = parseInt(args);
            const senderId = msg.key.participant || msg.key.remoteJid;

            let placar = lerArquivoSeguro(arquivoPlacar);
            if (!placar[senderId]) placar[senderId] = 0;

            if (!escolha || escolha < 1 || escolha > 3) {
                await sock.sendMessage(sender, { react: { text: '⚽', key: msg.key } });
                return await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/Rfz8o91xR5wAAAPo/jonathan-david-jo-david.mp4' }, 
                    gifPlayback: true,
                    caption: `⚽ *DISPUTA DE PÊNALTIS - BONDE VIP*\n\nSeu saldo atual: ${placar[senderId]} pontos\n\nEscolha o canto para o chute:\n!penalti 1 (Esquerda)\n!penalti 2 (Centro)\n!penalti 3 (Direita)\n\n*Prepare o pé e boa sorte!* 🚀`
                }, { quoted: msg });
            }

            const cantoGoleiro = Math.floor(Math.random() * 3) + 1;
            const acertou = escolha !== cantoGoleiro;

            if (acertou) {
                const ganho = 50 + Math.floor(Math.random() * 50); 
                placar[senderId] += ganho;
                fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/vnXD4h47_ZwAAAPo/kick-goal.mp4' }, 
                    gifPlayback: true,
                    caption: `⚽ *GOOOOOLAÇO!* 🚀\n\nVocê chutou no ${escolha} e o goleiro pulou no ${cantoGoleiro}!\n\n💰 *Saldo recebido:* +${ganho} pontos!\n📊 *Novo total:* ${placar[senderId]} pontos.`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/AdTJAjjVaIkAAAPo/goalkeeper.mp4' }, 
                    gifPlayback: true,
                    caption: `🧤 *DEFESA!* 😂\n\nVocê chutou no ${escolha} e o goleiro catou no reflexo! \n\n"É ruim hein! Nem com o gol aberto!"\n📊 *Seu saldo continua:* ${placar[senderId]} pontos.`
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
                        `🚫 O banhammer passou por aqui e o @${mention.split('@')[0]} foi o escolhido da vez. Tchauzinho! 👋`
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
                const axiosConfig = {
                    headers: {
                        'User-Agent': 'BondeDoBrasilBot/1.0 (Bot do WhatsApp) axios/1.x'
                    }
                };

                const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(termo)}&utf8=&format=json`;
                const searchRes = await axios.get(searchUrl, axiosConfig);

                if (!searchRes.data?.query?.search || searchRes.data.query.search.length === 0) {
                    return await sock.sendMessage(sender, { text: "❌ Não encontrei absolutamente nada sobre isso na Wikipédia. Tente usar outras palavras!" }, { quoted: quoteMsg });
                }

                const tituloExato = searchRes.data.query.search[0].title;
                const tituloFormatado = encodeURIComponent(tituloExato.replace(/ /g, '_')); 

                try {
                    const res = await axios.get(`https://pt.wikipedia.org/api/rest_v1/page/summary/${tituloFormatado}`, axiosConfig);
                    
                    if (res.data && res.data.extract) {
                        const respostaTexto = `🔍 *RESULTADO: ${tituloExato.toUpperCase()}*\n\n${res.data.extract}\n\n🔗 *Fonte:* ${res.data.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${tituloFormatado}`}`;
                        await sock.sendMessage(sender, { text: respostaTexto }, { quoted: quoteMsg });
                    } else {
                        throw new Error("Página encontrada, mas sem resumo (extract).");
                    }
                } catch (restError) {
                    let snippet = searchRes.data.query.search[0].snippet;
                    snippet = snippet.replace(/<[^>]*>?/gm, ''); 
                    
                    const respostaTextoFallback = `🔍 *RESULTADO: ${tituloExato.toUpperCase()}*\n\n${snippet}...\n\n🔗 *Fonte:* https://pt.wikipedia.org/wiki/${tituloFormatado}`;
                    await sock.sendMessage(sender, { text: respostaTextoFallback }, { quoted: quoteMsg });
                }

            } catch (e) {
                console.error("Erro no !pesquisar:", e.message);
                await sock.sendMessage(sender, { text: "❌ O buscador deu erro de conexão com a Wikipédia. Tente de novo!" }, { quoted: quoteMsg });
            }
        }

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

        if (text.startsWith('!calvo')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o futuro careca!" }, { quoted: msg });
            
            const calvicie = Math.floor(Math.random() * 101);
            let diag = "";
            if (calvicie < 20) diag = "Cabelo de propaganda de shampoo! Tá seguro. 💇‍♂️";
            else if (calvicie < 50) diag = "Aquelas entradinhas perigosas já estão aparecendo... prepara o boné! 🧢";
            else if (calvicie < 80) diag = "Já dá pra usar a testa como outdoor! Aeroporto de mosquito. 🛬";
            else diag = "100% CALVO! A cabeça tá brilhando mais que bola de cristal. Bem-vindo à tropa do Vegeta! 🎱";

            await sock.sendMessage(sender, { react: { text: '👴', key: msg.key } });
            await sock.sendMessage(sender, { text: `👴 *RAIO-X CAPILAR* 👴\n\nO @${mention.split('@')[0]} é ${calvicie}% CALVO!\n\n${diag}`, mentions: [mention] }, { quoted: msg });
        }

        if (text.startsWith('!qi')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o gênio incompreendido!" }, { quoted: msg });
            
            const qi = Math.floor(Math.random() * 250) - 50; 
            let diag = "";
            if (qi < 0) diag = "QI NEGATIVO! Uma porta tem mais capacidade cognitiva. 🚪🤡";
            else if (qi < 50) diag = "Tico e Teco estão de greve. Esquece o que ia falar no meio da frase. 🧠💨";
            else if (qi < 90) diag = "QI de temperatura ambiente. Sobrevive por milagre. 🌡️";
            else if (qi < 130) diag = "Pessoa normal. Paga imposto e sofre em silêncio. 🧍‍♂️";
            else diag = "ALBERT EINSTEIN DO ZAP! O cérebro desse aqui transcendeu. 🌌🤯";

            await sock.sendMessage(sender, { react: { text: '🧠', key: msg.key } });
            await sock.sendMessage(sender, { text: `🧠 *TESTE DE QI* 🧠\n\nO QI do @${mention.split('@')[0]} é de absurdos *${qi}*!\n\n${diag}`, mentions: [mention] }, { quoted: msg });
        }

        if (text.startsWith('!serasa')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o caloteiro!" }, { quoted: msg });
            
            const divida = (Math.random() * 50000).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const score = Math.floor(Math.random() * 1000);
            
            await sock.sendMessage(sender, { react: { text: '💸', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `🏢 *SISTEMA SERASA EXPERIAN* 🏢\n\n🔍 Consultando CPF do @${mention.split('@')[0]}...\n\n📉 *Score:* ${score}/1000\n💰 *Dívida Ativa:* ${divida}\n\n🚨 *SITUAÇÃO:* Nome mais sujo que pau de galinheiro! O agiota já está na porta. CORRE! 🏃‍♂️💨`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        if (text.startsWith('!historico')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque a vítima do vazamento!" }, { quoted: msg });
            
            const buscas = [
                "como apagar nome do serasa simpatia", "teste pra saber se sou corno online", 
                "fotos do luan santana sem camisa", "como disfarçar que peidei no onibus", 
                "como ganhar dinheiro dormindo", "sintomas de gravidez pelo whatsapp",
                "o que fazer se o agiota mandar mensagem", "como clonar zap gratis",
                "simpatia pra ex voltar chorando", "curso de agiota para iniciantes",
                "como saber se sou feio ou apenas exótico", "remédio caseiro pra dor de chifre"
            ];
            
            const b1 = buscas[Math.floor(Math.random() * buscas.length)];
            let b2 = buscas[Math.floor(Math.random() * buscas.length)];
            while (b1 === b2) b2 = buscas[Math.floor(Math.random() * buscas.length)];

            await sock.sendMessage(sender, { react: { text: '🚨', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `🚨 *VAZAMENTO DE DADOS!* 🚨\n\nO FBI invadiu o roteador do @${mention.split('@')[0]} e encontrou as últimas buscas do Google:\n\n🔍 _"${b1}"_\n🔍 _"${b2}"_\n\nQue nojeira, cara... perdi o respeito! 🤢😂`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        if (text.startsWith('!fakenews')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o protagonista da fofoca!" }, { quoted: msg });
            
            const noticias = [
                "foi pego roubando pão de queijo na padaria e fugiu de mototaxi.",
                "perdeu todo o salário no Jogo do Tigrinho e agora tá morando num Celta 2012.",
                "foi visto(a) aos beijos com o(a) ex no bailão. Que decadência!",
                "caiu no golpe do Pix agendado tentando comprar um iPhone 15 no Facebook.",
                "foi expulso(a) de um rodízio de pizza por tentar esconder fatias no bolso da jaqueta.",
                "tá processando o barbeiro/cabeleireiro porque cortou 2 dedinhos a mais."
            ];
            
            const manchete = noticias[Math.floor(Math.random() * noticias.length)];

            await sock.sendMessage(sender, { react: { text: '📰', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `📰 *PLANTÃO CHOQUEI - BONDE VIP* 📰\n\nURGENTE: Fontes confirmam que @${mention.split('@')[0]} ${manchete}\n\nSerá que é verdade? Deixe sua opinião! 🚨📸`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        if (text.startsWith('!rinha')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length < 2) return await sock.sendMessage(sender, { text: "❌ Marque DUAS pessoas para a rinha! Ex: !rinha @fulano @ciclano" }, { quoted: msg });
            
            const lutador1 = mentions[0];
            const lutador2 = mentions[1];
            const vencedor = Math.random() > 0.5 ? lutador1 : lutador2;
            const perdedor = vencedor === lutador1 ? lutador2 : lutador1;

            const finalizacoes = [
                "com uma voadora com os dois pés no peito!",
                "usando um golpe sujo: jogou areia no olho!",
                "com um argumento tão burro que o adversário desistiu da vida.",
                "depois de invocar a fúria do agiota!",
                "batendo com uma garrafa de Corote vazia!"
            ];
            
            await sock.sendMessage(sender, { react: { text: '⚔️', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `⚔️ *RINHA DE GALO CLANDESTINA* ⚔️\n\nNo canto esquerdo: @${lutador1.split('@')[0]}\nNo canto direito: @${lutador2.split('@')[0]}\n\n💥 *RESULTADO:* O @${vencedor.split('@')[0]} AMASSOU o @${perdedor.split('@')[0]} ${finalizacoes[Math.floor(Math.random() * finalizacoes.length)]}\n\nPagamento das apostas no PV! 💸`, 
                mentions: [lutador1, lutador2] 
            }, { quoted: msg });
        }

        if (text.startsWith('!vasco')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque quem vai pro gigante da colina!" }, { quoted: msg });
            
            await sock.sendMessage(sender, { react: { text: '⚽', key: msg.key } });
            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/SGXS9keeDLAAAAPo/vasco-meme-afundando.mp4' }, 
                gifPlayback: true,
                caption: `🚨 *REFORÇO NA COLINA!* 🚨\n\nInfelizmente o @${mention.split('@')[0]} não resistiu e *FOI JOGAR NO VASCO!* ⚰️⚽\n\nDescanse em paz... e tente não ser rebaixado lá também! 🕊️`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        if (text.startsWith('!gravida')) {
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length === 0) return await sock.sendMessage(sender, { text: "❌ Marque a possível grávida!" }, { quoted: msg });
            
            const gravida = mentions[0];
            let pai = mentions[1] ? `@${mentions[1].split('@')[0]}` : "o vizinho";

            const resultado = Math.random() > 0.3 ? "POSITIVO ➕" : "NEGATIVO ➖";
            let msgExtra = resultado.includes("POSITIVO") ? `Parabéns, papai ${pai}! Já pode ir comprar fralda e leite ninho! 🍼💸` : `Ufa! Escapou do chá de revelação! Pode voltar pro bar. 🍻`;

            await sock.sendMessage(sender, { react: { text: '🍼', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `🏥 *CLÍNICA DO BONDE* 🏥\n\nO resultado do exame da @${gravida.split('@')[0]} saiu!\n\n🩺 *Diagnóstico:* ${resultado}\n\n${msgExtra}`, 
                mentions: mentions 
            }, { quoted: msg });
        }

        if (text.startsWith('!feio')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o desprovido de beleza!" }, { quoted: msg });
            
            const feiura = Math.floor(Math.random() * 101);
            let diag = "";
            if (feiura < 20) diag = "Até que é pegável. Dá pro gasto no escuro. 🔦";
            else if (feiura < 50) diag = "Rosto exótico. Parece um joelho batido. 🦵";
            else if (feiura < 80) diag = "Feio que dói! Se olhar no espelho o vidro quebra. 🪞💥";
            else diag = "DEUS ME LIVRE! Parece um filhote de cruz credo. Nasceu do avesso! 👹🔥";

            await sock.sendMessage(sender, { react: { text: '👹', key: msg.key } });
            await sock.sendMessage(sender, { text: `🧟‍♂️ *ESCALA DA BELEZA* 🧟‍♂️\n\nO @${mention.split('@')[0]} é ${feiura}% FEIO!\n\n${diag}`, mentions: [mention] }, { quoted: msg });
        }

        if (text.startsWith('!clt')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o vagabundo que precisa de emprego!" }, { quoted: msg });
            
            await sock.sendMessage(sender, { react: { text: '💼', key: msg.key } });
            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/--B5p25gWrAAAAPo/clt-cachorro.mp4' }, 
                gifPlayback: true,
                caption: `💼 *FIM DAS FÉRIAS, VAGABUNDO!* 💼\n\nA carteira de trabalho do @${mention.split('@')[0]} foi assinada com sucesso!\n\nAcorda às 5h, pega 2 ônibus lotados e vai pro salário mínimo! O patrão tá te chamando! 🚌🏭`, 
                mentions: [mention] 
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
        // ⚖️ O TRIBUNAL DO BONDE (VERSÃO DEFINITIVA)
        // ==========================================
        if (text.startsWith('!julgar')) {
            if (!isGroup) return await sock.sendMessage(sender, { text: "❌ O tribunal só funciona em grupos!" }, { quoted: quoteMsg });
            if (tribunal.ativo) return await sock.sendMessage(sender, { text: "❌ Já existe um julgamento acontecendo! Aguarde o martelo bater." }, { quoted: quoteMsg });

            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Marque o réu que vai a julgamento! Ex: !julgar @membro" }, { quoted: quoteMsg });
            
            if (groupAdmins.includes(mention) || mention.includes('5527992997083')) {
                return await sock.sendMessage(sender, { 
                    text: "❌ *ORDEM JUDICIAL:* A Elite (ADM/Dono) possui imunidade diplomática total! O tribunal não tem jurisdição sobre a chefia. 👑", 
                    quoted: quoteMsg 
                });
            }

            if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Você não pode processar a si mesmo, seu maluco! 😂" }, { quoted: quoteMsg });

            tribunal.ativo = true;
            tribunal.vitima = mention;
            tribunal.acusador = participant;
            tribunal.votos = {}; 

            const msgAbertura = `⚖️ *O TRIBUNAL DO BONDE ESTÁ ABERTO!* ⚖️\n\nO promotor @${participant.split('@')[0]} acusou o(a) @${mention.split('@')[0]} de falar besteira!\n\nJúri, vocês têm *1 MINUTO* para decidir o destino dele(a)!\nFloodem o chat com:\n🔴 *!culpado*\n🟢 *!inocente*\n\n_Se for inocentado, o acusador sofrerá a punição!_`;
            
            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/myw9F3Q5zs0AAAPo/stand-up-ada-samantha-maroun.mp4' }, 
                gifPlayback: true,
                caption: msgAbertura,
                mentions: [participant, mention]
            });

            setTimeout(async () => {
                if (!tribunal.ativo) return;
                tribunal.ativo = false;

                let culpados = 0;
                let inocentes = 0;
                Object.values(tribunal.votos).forEach(voto => voto === 'culpado' ? culpados++ : inocentes++);

                if (culpados > inocentes) {
                    if (groupAdmins.includes(tribunal.vitima) || tribunal.vitima.includes('5527992997083')) {
                        await sock.sendMessage(sender, { text: "⚖️ O réu foi condenado, mas possui imunidade de ADM! Justiça perdoada." });
                    } else {
                        mutados[tribunal.vitima] = Date.now() + 300000;
                        fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                        let cargos = lerArquivoSeguro(arquivoCargos);
                        cargos[tribunal.vitima] = "⚖️ Condenado";
                        fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));
                        await sock.sendMessage(sender, { 
                            video: { url: 'https://media.tenor.com/pUnjk3G9hGgAAAPo/gavel-order-in-court.mp4' }, 
                            gifPlayback: true,
                            caption: `👨‍⚖️ *VEREDITO: CULPADO!* (${culpados}x${inocentes})\n\nO @${tribunal.vitima.split('@')[0]} tomou a martelada!\n\n*PUNIÇÃO:* Mute de 5 minutos e rebaixado a "⚖️ Condenado"! 🔨`,
                            mentions: [tribunal.vitima]
                        });
                    }
                } else {
                    if (groupAdmins.includes(tribunal.acusador) || tribunal.acusador.includes('5527992997083')) {
                        await sock.sendMessage(sender, { text: "⚖️ O promotor foi condenado por falsa acusação, mas como é ADM, está imune ao mute! 👑" });
                    } else {
                        mutados[tribunal.acusador] = Date.now() + 300000;
                        fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                        await sock.sendMessage(sender, { 
                            video: { url: 'https://media.tenor.com/AENPKL0I4uEAAAPo/judge.mp4' }, 
                            gifPlayback: true,
                            caption: `👨‍⚖️ *VEREDITO: INOCENTE!* (${inocentes}x${culpados})\n\nO réu @${tribunal.vitima.split('@')[0]} foi ABSOLVIDO!\n\n🚨 *REVIRAVOLTA!* O promotor @${tribunal.acusador.split('@')[0]} foi condenado por falsa acusação!\n\n*PUNIÇÃO:* Mute de 5 minutos para aprender a não brincar com a justiça! 🤡`,
                            mentions: [tribunal.vitima, tribunal.acusador]
                        });
                    }
                }
            }, 60000);
        }

        // ==========================================
        // ⚖️ SISTEMA DE VOTAÇÃO BLINDADO ⚖️
        // ==========================================
        const votoDigitado = text.toLowerCase().trim();
        
        if (votoDigitado === '!culpado' || votoDigitado === '!inocente') {
            if (!tribunal.ativo) return;
            
            // Impede o réu e o promotor de votarem
            if (participant === tribunal.vitima || participant === tribunal.acusador) {
                if (!isLid) await sock.sendMessage(sender, { react: { text: '🚫', key: msg.key } });
                return;
            }
            
            // Impede a pessoa de votar duas vezes
            if (tribunal.votos[participant]) {
                if (!isLid) await sock.sendMessage(sender, { react: { text: '👀', key: msg.key } });
                return;
            }

            // Registra o voto limpo na memória ('culpado' ou 'inocente')
            tribunal.votos[participant] = votoDigitado.replace('!', ''); 
            
            // Confirma pro usuário que o voto foi computado
            if (!isLid) await sock.sendMessage(sender, { react: { text: '⚖️', key: msg.key } });
            
            // Trava a execução para não cair no "Comando Inválido"
            return;
        }

        // ==========================================
        // 1. 📣 MEGAMENÇÃO (!todos) - EXCLUSIVO ADM
        // Útil para: Avisos importantes sem ninguém fingir que não viu.
        // ==========================================
        if (text.startsWith('!todos')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Abaixa a bola, só a Elite pode invocar o grupo todo!" }, { quoted: msg });
            
            const metadata = await sock.groupMetadata(sender);
            const ppts = metadata.participants.map(p => p.id);
            const mensagemAdicional = text.replace('!todos', '').trim();
            
            let textoTodos = `📣 *CHAMADA GERAL DO BONDE!* 📣\n\n${mensagemAdicional || "Apareçam, o chefe tá chamando!"}\n\n`;
            ppts.forEach(p => { textoTodos += `• @${p.split('@')[0]}\n`; });
            
            await sock.sendMessage(sender, { text: textoTodos, mentions: ppts });
        }

        // ==========================================
        // 2. 💸 TRANSFERÊNCIA (!pix @mencao [valor])
        // Útil para: A galera trocar pontos entre si ou pagar dívidas do cassino/rinha.
        // ==========================================
        if (text.startsWith('!pix')) {
            const args = text.split(' ');
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            const valor = parseInt(args[2] || args[1]); // Pega o número, tendo espaço a mais ou não

            if (!mention || isNaN(valor) || valor <= 0) return await sock.sendMessage(sender, { text: "❌ Formato errado! Use: !pix @mencao [valor]" }, { quoted: msg });
            if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Tentando lavar dinheiro mandando pra si mesmo? A Receita Federal tá de olho! 😂" }, { quoted: msg });

            let placar = lerArquivoSeguro(arquivoPlacar);
            if ((placar[participant] || 0) < valor) return await sock.sendMessage(sender, { text: `❌ Tá liso! Seu saldo atual é de apenas ${placar[participant] || 0} pontos.` }, { quoted: msg });

            // Executa a transação
            placar[participant] -= valor;
            placar[mention] = (placar[mention] || 0) + valor;
            fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

            await sock.sendMessage(sender, { react: { text: '💸', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `💸 *TRANSFERÊNCIA APROVADA!*\n\nO magnata @${participant.split('@')[0]} enviou *${valor} pontos* via PIX para @${mention.split('@')[0]}!`, 
                mentions: [participant, mention] 
            }, { quoted: msg });
        }

        // ==========================================
        // 3. 👻 CAÇA AOS INATIVOS (!fantasmas) - EXCLUSIVO ADM
        // Útil para: Ver quem está no grupo, mas NUNCA mandou uma mensagem.
        // ==========================================
        if (text === '!fantasmas') {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Só a Elite tem acesso ao radar paranormal!" });
            
            const metadata = await sock.groupMetadata(sender);
            const ppts = metadata.participants;
            const rank = lerArquivoSeguro(ARQUIVO_RANK);
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            let fantasmas = [];
            ppts.forEach(p => {
                // Se a pessoa não está no rank de mensagens e não é o bot
                if (!rank[p.id] && p.id !== botId) fantasmas.push(p.id);
            });

            if (fantasmas.length === 0) return await sock.sendMessage(sender, { text: "✅ O grupo tá limpo! Nenhum fantasma por aqui." });

            let msgFantasma = `👻 *OPERAÇÃO CAÇA-FANTASMAS* 👻\n\nEsses membros estão no grupo, mas nunca mandaram 1 miséria de mensagem:\n\n`;
            fantasmas.forEach(f => { msgFantasma += `• @${f.split('@')[0]}\n`; });
            msgFantasma += `\n_A foice da limpeza tá passando, hein! 🔨_`;
            
            await sock.sendMessage(sender, { text: msgFantasma, mentions: fantasmas }, { quoted: msg });
        }

        // ==========================================
        // 4. ⏰ SECRETÁRIA DO CAOS (!lembrete [minutos] [msg])
        // Útil para: Avisar algo importante (ex: !lembrete 15 tirar a comida do fogo).
        // ==========================================
        if (text.startsWith('!lembrete')) {
            const args = text.replace('!lembrete', '').trim().split(' ');
            const minutos = parseInt(args[0]);
            const mensagemLembrete = args.slice(1).join(' ');

            if (isNaN(minutos) || !mensagemLembrete) return await sock.sendMessage(sender, { text: "❌ Use o formato certo: !lembrete [minutos] [mensagem]\nEx: !lembrete 10 desligar o arroz" }, { quoted: msg });
            if (minutos > 180) return await sock.sendMessage(sender, { text: "❌ Máximo de 180 minutos (3 horas). Não sou calendário pra lembrar amanhã! 😂" }, { quoted: msg });

            await sock.sendMessage(sender, { react: { text: '⏰', key: msg.key } });
            await sock.sendMessage(sender, { text: `⏰ *Anotado!* Daqui a ${minutos} minuto(s) eu te marco para lembrar disso.` }, { quoted: msg });

            setTimeout(async () => {
                await sock.sendMessage(sender, { 
                    text: `🚨 *BIP BIP BIP! HORA DO SEU LEMBRETE!* 🚨\n\nAcorda, @${participant.split('@')[0]}! Você me pediu pra avisar isso agora:\n\n👉 "${mensagemLembrete}"`, 
                    mentions: [participant] 
                });
            }, minutos * 60 * 1000);
        }

        // ==========================================
        // 5. 🧹 BORRACHA MÁGICA (!apagar)
        // Útil para: Responder a uma mensagem DO BOT e pedir pra ele apagar (limpeza de poluição).
        // ==========================================
        if (text === '!apagar') {
            const quotedMsg = msg.message.extendedTextMessage?.contextInfo;
            if (!quotedMsg || !quotedMsg.stanzaId) return await sock.sendMessage(sender, { text: "❌ Você tem que RESPONDER a mensagem que quer que eu apague, usando !apagar" });
            
            const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            
            if (quotedMsg.participant !== botId) {
                return await sock.sendMessage(sender, { text: "❌ Eu só posso apagar as MINHAS próprias mensagens! Vai pedir pra apagar mensagem dos outros na casa do chapéu!" }, { quoted: msg });
            }

            await sock.sendMessage(sender, { delete: { remoteJid: sender, fromMe: true, id: quotedMsg.stanzaId, participant: botId } });
        }

        // ==========================================
        // 6. ⚖️ O JUIZ DECISOR (!decidir [A] ou [B])
        // Útil para: Acabar com qualquer discussão sobre o que fazer/escolher.
        // ==========================================
        if (text.startsWith('!decidir')) {
            const opcoesStr = text.replace('!decidir', '').trim();
            if (!opcoesStr.includes(' ou ')) return await sock.sendMessage(sender, { text: "❌ Você precisa me dar opções separadas por 'ou'.\nEx: !decidir comer pizza ou comer lanche" }, { quoted: msg });

            const opcoes = opcoesStr.split(' ou ');
            const escolha = opcoes[Math.floor(Math.random() * opcoes.length)].trim();

            await sock.sendMessage(sender, { react: { text: '⚖️', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `⚖️ *O JUIZ SUPREMO DECIDIU!* ⚖️\n\nParei de jogar paciência pra resolver o problema de vocês. A melhor escolha, sem dúvida, é:\n\n👉 *${escolha.toUpperCase()}*` 
            }, { quoted: msg });
        }

        // ==========================================
        // 7. 🎰 CASSINO DE PONTOS (!cassino [valor])
        // Útil para: Fazer a economia girar (o risco é triplicar ou perder tudo).
        // ==========================================
        if (text.startsWith('!cassino')) {
            const args = text.replace('!cassino', '').trim();
            const aposta = parseInt(args);
            if (isNaN(aposta) || aposta < 10) return await sock.sendMessage(sender, { text: "❌ Aposte no mínimo 10 pontos! Ex: !cassino 50" }, { quoted: msg });

            let placar = lerArquivoSeguro(arquivoPlacar);
            if ((placar[participant] || 0) < aposta) return await sock.sendMessage(sender, { text: `❌ Caloteiro! Seu saldo atual é só ${placar[participant] || 0} pontos.` }, { quoted: msg });

            placar[participant] -= aposta; // Desconta a aposta de cara
            
            const sorte = Math.random();
            let multiplicador = 0;
            let msgCassino = "";

            if (sorte < 0.25) { // 25% de chance de ganhar o dobro
                multiplicador = 2;
                msgCassino = `🎰 *JACKPOT!* A máquina cuspiu moedas! Você DOBROU sua aposta e recebeu *${aposta * 2} pontos*! 🍒🍒🍒`;
            } else if (sorte < 0.35) { // 10% chance de ganhar o triplo
                multiplicador = 3;
                msgCassino = `💎 *MEGA PRÊMIO!* VOCÊ QUEBROU A BANCA! TRIPlicou sua aposta e faturou absurdos *${aposta * 3} pontos*! 💎💎💎`;
            } else { // 65% de chance de perder tudo
                msgCassino = `💸 *DEU RUIM!* As máquinas engoliram seu dinheiro. Perdeu os ${aposta} pontos. O dono do cassino agradece sua doação! 🤡`;
            }

            if (multiplicador > 0) placar[participant] += (aposta * multiplicador);
            fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/iNJ3cA3wV18AAAPo/the-simpsons-mr-burns.mp4' }, 
                gifPlayback: true,
                caption: msgCassino 
            }, { quoted: msg });
        }

        // ==========================================
        // 8. 🧠 COACH DA ZUEIRA (!conselho)
        // Útil para: Quebrar o gelo quando o chat tá morto com sabedoria duvidosa.
        // ==========================================
        if (text === '!conselho') {
            const conselhos = [
                "Se alguém te chamar de feio, não ligue. Feio é quem mente, você é só exótico.",
                "Trabalhe com o que você ama e você nunca mais vai amar nada na sua vida.",
                "O 'não' você já tem. Agora vista uma roupa e vá atrás da humilhação!",
                "Nunca deixe ninguém te dizer que você não consegue. Mostre você mesmo que você é um fracasso.",
                "Não desanime por ter acordado tarde. O importante é acordar cansado de novo amanhã.",
                "Se a vida te der limões, esprema bem no olho de quem te irrita.",
                "O dinheiro não traz felicidade, mas traz coisas que a tristeza não pode comprar (tipo um lanche).",
                "Acredite sempre no seu potencial de fazer cagada logo de manhã.",
                "Se tudo der errado, lembre-se: pelo menos você serviu de mau exemplo pros outros.",
                "Paciência é uma virtude que eu gasto rápido. Use a sua enquanto tem."
            ];
            const conselho = conselhos[Math.floor(Math.random() * conselhos.length)];
            await sock.sendMessage(sender, { react: { text: '🧠', key: msg.key } });
            await sock.sendMessage(sender, { text: `🧠 *COACH QUÂNTICO DO BONDE INFORMA:* \n\n_"${conselho}"_` }, { quoted: msg });
        }

        // ==========================================
        // 9. 📝 RESUMÃO DO DIA (!resumo)
        // Útil para: Simular um resumo de inteligência artificial de forma irônica.
        // ==========================================
        if (text === '!resumo') {
            const resumos = [
                "1. Alguém mandou meme velho achando que era novidade.\n2. Dois se ofenderam por motivo idiota e quase choraram.\n3. O de sempre: ninguém trabalhando.",
                "1. Muito papo furado e zero produtividade.\n2. Alguém tá devendo no grupo e fingindo demência.\n3. Mais um dia salvo pela falta do que fazer da Elite.",
                "1. Falaram de um assunto polêmico e quase rolou banimento em massa.\n2. Foi detectada uma taxa alta de chifre no ar.\n3. O bot (eu) continua sendo a melhor coisa que tem aqui."
            ];
            await sock.sendMessage(sender, { react: { text: '📝', key: msg.key } });
            await sock.sendMessage(sender, { 
                text: `📝 *RESUMO GERADO PELA IA DO BOT:*\n\n${resumos[Math.floor(Math.random() * resumos.length)]}\n\n*Conclusão:* Vão caçar uma carteira de trabalho! 💼` 
            }, { quoted: msg });
        }

        // ==========================================
        // 10. 📜 REGRAS DO GRUPO (!regras)
        // Útil para: Facilitar a vida do ADM na hora de enquadrar um novato.
        // ==========================================
        if (text === '!regras') {
            const textoRegras = `📜 *O CÓDIGO PENAL DO BONDE VIP* 📜

1️⃣ *PROIBIDO CONTEÚDO +18:* Mandou putaria ou gore? O ban entra na velocidade da luz sem aviso. 🔞⛔
2️⃣ *INVASÃO DE PV:* Chamar os outros no privado sem autorização é crime inafiançável. Ban direto. 🕵️‍♂️
3️⃣ *LINKS E TRAVAS:* Link suspeito ou mensagem gigante pra travar o zap? O sistema exclui e te pune com mute. 🔗🗑️
4️⃣ *CADASTRO OBRIGATÓRIO:* Fantasmas que não enviam *FOTO | CIDADE | IDADE | NOME* levam rodo automático. 👻🔪
5️⃣ *RESPEITO:* A zueira não tem limites, mas evite virar chato. Acabou a graça? O martelo do Tribunal (!julgar) cai. ⚖️

👑 *A ELITE OBSERVA TUDO. JOGUEM SUJO, MAS JOGUEM DENTRO DA LEI!*`;
            
            await sock.sendMessage(sender, { text: textoRegras }, { quoted: msg });
        }

        if (text.startsWith('!matar')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para eliminar, covarde!", quoted: msg });
            
            const isDono = mention.includes('5527992997083');
            const isAdm = groupAdmins.includes(mention);
            const isBot = mention.includes(sock.user.id.split(':')[0]);

            if (isAdm || isDono || isBot) {
                return await sock.sendMessage(sender, { 
                    text: "❌ *TENTATIVA DE HOMICÍDIO FALHA:* Você não tem autorização para tocar na Elite ou no Bot! 🛡️", 
                    quoted: msg 
                });
            }

            if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Quer cometer suicídio? Procure ajuda, maluco! 😂", quoted: msg });

            const autor = participant.split('@')[0];
            const alvo = mention.split('@')[0];
            
            const frasesMatar = [
                `O @${autor} mandou o @${alvo} de arrasta pra cima! Que vacilo, hein? 💀`,
                `Vixi... @${autor} não teve piedade e eliminou o @${alvo} do mapa! ⚰️`,
                `O @${autor} decidiu que o @${alvo} não precisava mais respirar. Que maldade! 🗡️`,
                `@${autor} aplicou o golpe final no @${alvo}. RIP para esse guerreiro! 🪦`,
                `Game Over para o @${alvo}! O @${autor} deu um fim na história dele aqui. 😂`,
                `O @${autor} acabou de fazer uma limpa no @${alvo}. Tá com Deus agora! 👻`,
                `@${autor} deletou o @${alvo} da existência com requintes de crueldade! 🔪`,
                `O @${autor} enterrou o @${alvo} vivo. Que fase, hein? ⚱️`
            ];

            const sorteioMatar = frasesMatar[Math.floor(Math.random() * frasesMatar.length)];
            const linkGifMatar = "https://media.tenor.com/3gus0SGhiEIAAAPo/cool-beans.mp4";

            await sock.sendMessage(sender, { 
                video: { url: linkGifMatar }, 
                gifPlayback: true,
                caption: `⚖️ *RELATÓRIO DE ÓBITO*\n\n${sorteioMatar}`, 
                mentions: [participant, mention] 
            }, { quoted: msg });
        }

        // ==========================================
        // 🛒 SISTEMA DE LOJA VIP E COMPRAS
        // ==========================================
        if (text === '!loja') {
            let placar = lerArquivoSeguro(arquivoPlacar);
            const saldo = placar[participant] || 0;
            const menu = `💎 *LOJA DO PODER ABSOLUTO* 💎
💰 *Seu Saldo:* ${saldo} pts

*--- STATUS & PROTEÇÃO ---*
1️⃣ *MUTE (1 min)* - 100 pts | !comprar mute @mencao
2️⃣ *DESMUTE* - 300 pts | !comprar desmute
3️⃣ *FÚRIA* - 400 pts | !comprar furia
4️⃣ *ESCUDO (1h)* - 600 pts | !comprar escudo
5️⃣ *VIP (Cargo)* - 800 pts | !comprar vip

*--- DOMÍNIO & ESTRATÉGIA ---*
6️⃣ *⛓️ CORRENTE* - 900 pts | !comprar corrente @mencao
7️⃣ *🔮 ORÁCULO* - 700 pts | !comprar oraculo @mencao

*--- GESTÃO DE GRUPO (ELITE) ---*
8️⃣ *👑 ADM DE FACHADA* - 3500 pts | !comprar adm
   (Acesso: !limpar, !fixar, !status)
9️⃣ *📅 SORTE (Bônus)* - 1500 pts | !comprar sorte
🔟 *🔑 CHAVE MESTRA* - 2000 pts | !comprar chave

━━━━━━━━━━━━━━━━━━
🤖 *Use !comprar [item] e domine o ranking!*`.trim();
            await sock.sendMessage(sender, { text: menu, quoted: msg });
        }

        if (text.startsWith('!comprar') || text.startsWith('!limpar') || text.startsWith('!fixar') || text.startsWith('!status')) {
            if (text.startsWith('!comprar')) {
                const args = text.split(' ');
                let item = args[1]?.toLowerCase();
                const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                
                // Normaliza palavras com acento para evitar erros de digitação dos membros
                if (item === 'fúria') item = 'furia';
                if (item === 'oráculo') item = 'oraculo';

                let placar = lerArquivoSeguro(arquivoPlacar);
                let cargos = lerArquivoSeguro(arquivoCargos);
                const saldo = placar[participant] || 0;

                const itens = {
                    'mute': 100, 'desmute': 300, 'furia': 400, 'escudo': 600, 
                    'vip': 800, 'corrente': 900, 'oraculo': 700, 
                    'adm': 3500, 'sorte': 1500, 'chave': 2000
                };

                if (!item || !itens[item]) return await sock.sendMessage(sender, { text: "❌ Item não encontrado na loja! Digite !loja para ver as opções.", quoted: msg });
                if (saldo < itens[item]) return await sock.sendMessage(sender, { text: `❌ Tá liso! Você precisa de ${itens[item]} pontos para comprar *${item.toUpperCase()}*. Seu saldo: ${saldo}`, quoted: msg });

                let sucesso = false;

                if (item === 'mute') {
                    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione o alvo do mute! Ex: !comprar mute @fulano", quoted: msg });
                    try {
                        const metadata = await sock.groupMetadata(sender);
                        const groupAdmins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
                        if (groupAdmins.includes(mention) || mention.includes('5527992997083')) {
                            return await sock.sendMessage(sender, { text: "❌ Tá doido? Tentar mutar a Elite do grupo é pedir pra morrer! 😂", quoted: msg });
                        }
                    } catch (e) {
                        console.error("Erro ao verificar admins para o mute:", e);
                    }
                    mutados[mention] = Date.now() + 60000;
                    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                    sucesso = true;
                    await sock.sendMessage(sender, { text: `🔇 Compra efetuada! O @${mention.split('@')[0]} tomou um cala-boca de 1 minuto!`, mentions: [mention], quoted: msg });
                
                } else if (item === 'desmute') {
                    if (!mutados[participant]) return await sock.sendMessage(sender, { text: "❌ Você não está mutado, não precisa gastar seus pontos à toa!", quoted: msg });
                    delete mutados[participant];
                    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                    sucesso = true;
                    await sock.sendMessage(sender, { text: "🔊 Compra efetuada! Você comprou sua liberdade e já pode falar!", quoted: msg });
                
                } else if (item === 'furia') {
                    ataquesFuria[participant] = true; 
                    await sock.sendMessage(sender, { text: "🔥 *FÚRIA ATIVADA!* Seu próximo ataque no Boss causará o DOBRO de dano!", quoted: msg });
                    sucesso = true; 
                
                } else if (item === 'escudo') {
                    escudosAtivos[participant] = Date.now() + 3600000;
                    await sock.sendMessage(sender, { text: "🛡️ *ESCUDO ATIVADO!* Você está imune a roubos (!roubar) por 1 HORA!", quoted: msg });
                    sucesso = true;
                
                } else if (item === 'vip') {
                    cargos[participant] = "VIP";
                    fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));
                    await sock.sendMessage(sender, { text: "💎 *PARABÉNS!* Agora você ostenta o cargo de VIP no bonde!", quoted: msg });
                    sucesso = true;
                
                } else if (item === 'adm') {
                    admsTemporarios[participant] = Date.now() + 3600000;
                    await sock.sendMessage(sender, { text: "👑 *Poder Concedido!* Você agora é ADM de Fachada por 1 hora. Use !limpar, !fixar e !status à vontade!", quoted: msg });
                    sucesso = true;
                
                } else if (item === 'corrente') {
                    if (!mention) return await sock.sendMessage(sender, { text: "❌ Em quem você quer jogar as correntes? Marque o alvo! Ex: !comprar corrente @fulano", quoted: msg });
                    await sock.sendMessage(sender, { 
                        text: `⛓️ *CORRENTES DO CAOS!*\n\nO @${participant.split('@')[0]} prendeu o @${mention.split('@')[0]} com correntes pesadas! Ele agora tá humilhado em praça pública! 😂`, 
                        mentions: [participant, mention], quoted: msg 
                    });
                    sucesso = true;
                
                } else if (item === 'oraculo') {
                    if (!mention) return await sock.sendMessage(sender, { text: "❌ De quem você quer saber o futuro? Marque o alvo! Ex: !comprar oraculo @fulano", quoted: msg });
                    const previsoes = [
                        "vai tomar um chifre em menos de 1 semana.",
                        "ganhará na loteria, mas vai perder o bilhete.",
                        "vai ser pego(a) no flagra fofocando de quem não devia.",
                        "sofrerá um golpe do Pix agendado ainda hoje.",
                        "vai encontrar o grande amor da sua vida... no Tinder, e é perfil fake."
                    ];
                    const prev = previsoes[Math.floor(Math.random() * previsoes.length)];
                    await sock.sendMessage(sender, { 
                        text: `🔮 *O ORÁCULO FALOU!*\n\nAs entidades me revelaram que o(a) @${mention.split('@')[0]} ${prev} 👁️`, 
                        mentions: [mention], quoted: msg 
                    });
                    sucesso = true;
                
                } else if (item === 'sorte') {
                    await sock.sendMessage(sender, { text: "🍀 *AMULETO DA SORTE COMPRADO!* As deusas da sorte estão sorrindo para você hoje. (Dica: tente a !roleta ou !cassino)", quoted: msg });
                    sucesso = true;
                
                } else if (item === 'chave') {
                    await sock.sendMessage(sender, { text: "🔑 *CHAVE MESTRA OBTIDA!* O que ela abre? Ninguém sabe. Mas você parece mais rico e poderoso ostentando isso no grupo! 😎", quoted: msg });
                    sucesso = true;
                }

                // Debita o saldo e salva apenas se a compra funcionou
                if (sucesso) {
                    placar[participant] -= itens[item];
                    fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
                    await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                }

            } else {
                // Comandos EXCLUSIVOS de quem comprou "ADM DE FACHADA"
                if (!admsTemporarios[participant] || admsTemporarios[participant] < Date.now()) {
                    return await sock.sendMessage(sender, { text: "❌ Sai pra lá! Você não tem o cargo de *ADM de Fachada*. Compre na !loja primeiro para mandar aqui!", quoted: msg });
                }

                if (text.startsWith('!limpar')) {
                    try {
                        const messages = await sock.fetchMessagesFromHistory(sender, 10);
                        for (let m of messages) await sock.sendMessage(sender, { delete: m.key });
                        await sock.sendMessage(sender, { text: "✅ Chat limpo pelo ADM de Fachada!" });
                    } catch (err) {
                        await sock.sendMessage(sender, { text: "❌ O bot precisa ser ADM real pra apagar as mensagens dos outros!" }, { quoted: msg });
                    }
                } else if (text.startsWith('!fixar')) {
                    const msgFix = text.replace('!fixar', '').trim();
                    if(!msgFix) return await sock.sendMessage(sender, { text: "❌ Escreve a mensagem pra eu fixar, ué!", quoted: msg });
                    await sock.sendMessage(sender, { text: `📌 *FIXADO PELO ADM DE FACHADA:*\n\n${msgFix}` });
                } else if (text.startsWith('!status')) {
                    const totalMsg = Object.values(contagemMensagens).reduce((a, b) => a + b, 0);
                    await sock.sendMessage(sender, { text: `📊 *STATUS DO GRUPO:*\n\n💬 Total de Mensagens: ${totalMsg}\n👑 Seu cargo temporário está ATIVO!` });
                }
            }
        }

        if (text.startsWith('!gado')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione o alvo do gado!", quoted: msg });
            
            if (groupAdmins.includes(mention) || mention.includes('5527992997083')) {
                return await sock.sendMessage(sender, { text: "❌ *ERRO:* A Elite é imune a esse teste. Não ouse chamar o ADM de gado! 👑", quoted: msg });
            }

            const porcentagem = Math.floor(Math.random() * 101);
            const alvo = mention.split('@')[0];
            let msgGado = "";
            
            if (porcentagem < 20) msgGado = "é apenas um bezerro aprendiz, ainda tem salvação. 🐮";
            else if (porcentagem < 50) msgGado = "é 50% gado, tá no caminho certo pra virar um boi reprodutor. 🐂";
            else if (porcentagem < 80) msgGado = "é um gado nível HARD! O cara já tá pagando o Uber da crush pro encontro com outro. 🤡";
            else msgGado = "é 100% GADO SUPREMO! Esse aí se chamar de 'amor' ele assina até o testamento no nome da pessoa. PUTA MERDA! 🚩🚩🚩";

            await sock.sendMessage(sender, { 
                image: { url: 'https://i.postimg.cc/kG8qP5rF/gado.jpg' }, 
                caption: `🐂 *TESTE DO GADO - O VEREDITO* 🐂\n\nO @${alvo} é ${porcentagem}% gado!\n\n${msgGado}`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        // ==========================================
        // 💍 SISTEMA DE CARTÓRIO (!casar, !descasar, !casais)
        // ==========================================
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

        if (text.startsWith('!corno')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione quem você quer testar o chifre!", quoted: msg });
            
            if (groupAdmins.includes(mention) || mention.includes('5527992997083')) {
                return await sock.sendMessage(sender, { text: "❌ *ERRO:* A Elite é fiel! O chifre não sobe aqui. 👑", quoted: msg });
            }

            await sock.sendMessage(sender, { react: { text: '🦌', key: msg.key } });

            const nivel = Math.floor(Math.random() * 101);
            const alvo = mention.split('@')[0];
            let resultado = "";
            
            if (nivel === 0) resultado = "é fiel pra caramba! Nem o GPS consegue rastrear desvio. 😇";
            else if (nivel < 30) resultado = "tem apenas um 'chifrinho' de estimação. Quase nada, dá pra esconder com o boné! 🤏";
            else if (nivel < 60) resultado = "tá usando um chifre que já começa a incomodar na hora de passar na porta. Tá virando unicórnio! 🦌";
            else if (nivel < 90) resultado = "tem um chifre de nível altíssimo! A cabeça tá até pesando, a coluna já tá torta. 😂";
            else resultado = "é o REI DOS CORNOS! O chifre desse aí já virou antena parabólica pra pegar Wi-Fi de motel e canal de traição! 🚩🚩🚩";

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/JTnj9CLoaI8AAAPo/meek-horn-corno-manso.mp4' }, 
                gifPlayback: true,
                caption: `🦌 *DETECTOR DE CHIFRES* 🦌\n\nO @${alvo} está com ${nivel}% de chifre no momento!\n\nResultado: ${resultado}`, 
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
            if (!isGroup) return await sock.sendMessage(sender, { text: "❌ Isso só funciona em grupos!", quoted: msg });
            await sock.sendMessage(sender, { react: { text: '🤫', key: msg.key } });

            try {
                const metadata = await sock.groupMetadata(sender);
                const ppts = metadata.participants;

                const membrosComuns = ppts.filter(p => !groupAdmins.includes(p.id) && !p.id.includes('5527992997083'));

                if (membrosComuns.length < 2) {
                    return await sock.sendMessage(sender, { text: "❌ Não tem gente suficiente aqui que não seja da Elite para fofocar!", quoted: msg });
                }

                const alvo1 = membrosComuns[Math.floor(Math.random() * membrosComuns.length)];
                const alvo2 = membrosComuns[Math.floor(Math.random() * membrosComuns.length)];

                if (alvo1.id === alvo2.id) return await sock.sendMessage(sender, { text: `❌ O @${alvo1.id.split('@')[0]} tentou fofocar sozinho, mas deu vergonha. Tente de novo! 😂`, mentions: [alvo1.id], quoted: msg });

                const fofocas = [
                    `FONTES EXCLUSIVAS! Vi o @${alvo1.id.split('@')[0]} e o @${alvo2.id.split('@')[0]} de mãos dadas no privado! O grupo tá sabendo disso? 🤫`,
                    `Gente, não espalhem... mas o @${alvo1.id.split('@')[0]} foi visto bloqueando o @${alvo2.id.split('@')[0]} e depois desbloqueando logo em seguida. O drama! 🎭`,
                    `Parem tudo! @${alvo1.id.split('@')[0]} e @${alvo2.id.split('@')[0]} foram vistos discutindo por causa de uma figurinha polêmica! 🥊`,
                    `Vazou print! @${alvo1.id.split('@')[0]} disse que o @${alvo2.id.split('@')[0]} é o membro mais suspeito do grupo. Alguém confirma? 🧐`,
                    `O @${alvo1.id.split('@')[0]} estava perguntando ontem sobre o @${alvo2.id.split('@')[0]}... será que temos um novo casal ou uma nova treta? 🍿`,
                    `O @${alvo1.id.split('@')[0]} confessou pra mim que morre de inveja do @${alvo2.id.split('@')[0]}. Que situação! 🐍`,
                    `ALERTA DE TRETA: O @${alvo1.id.split('@')[0]} mandou um áudio de 5 minutos xingando o @${alvo2.id.split('@')[0]} pra mim! 🗣️`
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

        if (text.startsWith('!adm')) {
            if (!isAdmin) {
                return await sock.sendMessage(sender, { text: "❌ Apenas ADMs podem promover membros a ADM!" }, { quoted: msg });
            }

            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) {
                return await sock.sendMessage(sender, { text: "❌ Marque quem você quer promover! Ex: !adm @membro" }, { quoted: msg });
            }

            if (groupAdmins.includes(mention)) {
                return await sock.sendMessage(sender, { text: "⚠️ Esta pessoa já é ADM." }, { quoted: msg });
            }

            try {
                await sock.groupParticipantsUpdate(sender, [mention], "promote");
                
                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/nXJyFnaE2P0AAAPo/crown-marina.mp4' },
                    gifPlayback: true,
                    caption: `❇️ *NOVO ADM NO BONDE!* 👑\n\nParabéns @${mention.split('@')[0]}, você agora faz parte da Elite! Use seu poder com sabedoria. 🛡️`, 
                    mentions: [mention] 
                }, { quoted: msg });
                
            } catch (e) {
                await sock.sendMessage(sender, { text: "❌ Falha ao promover. Verifique se o bot também é ADM no grupo!" }, { quoted: msg });
            }
        }

        if (text.startsWith('!perfil')) {
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para eu revelar a verdadeira face! 😂", quoted: msg });

            // Trava de segurança: Ninguém analisa a Elite!
            if (groupAdmins.includes(mention) || mention.includes('5527992997083')) {
                return await sock.sendMessage(sender, { text: "❌ *ERRO DE ANÁLISE:* O perfil da Elite é confidencial e perfeito demais para ser analisado! 👑", quoted: msg });
            }

            const autor = participant.split('@')[0];
            const alvo = mention.split('@')[0];

            const adjetivos = ["Carente", "Caótico", "Oportunista", "Iludido", "Pé frio", "Fofoqueiro nível pro", "Aventureiro de WhatsApp", "Dramático", "Sem noção", "Viciado em treta"];
            const ocupacoes = ["Influencer de fofoca", "Doutor em mandar áudio inútil", "Especialista em dar vácuo", "Estagiário de desastre", "CEO do desemprego", "Auditor de status alheio", "Mestre das desculpas esfarrapadas"];
            const segredos = [
                "já chorou assistindo propaganda de margarina.",
                "tem uma conta secreta pra stalkear o ex e curte foto de 2018 sem querer.",
                "passa 4 horas por dia vendo vídeo de receita que nunca vai ter coragem de fazer.",
                "usa o meme de 'bom dia' pra esconder que tá de ressaca desde terça.",
                "se pudesse, viveria debaixo de um cobertor comendo miojo cru e bebendo achocolatado.",
                "tem medo de atender telefone e prefere fingir que tá sem sinal no meio da sala.",
                "já tentou copiar dancinha do TikTok e distendeu o ligamento do joelho.",
                "escondeu o histórico do navegador antes de emprestar o celular pro sobrinho.",
                "tá devendo até o pensamento pra agiota virtual.",
                "finge que tá estudando quando na verdade tá jogando fazendinha."
            ];

            const perfil = {
                adjetivo: adjetivos[Math.floor(Math.random() * adjetivos.length)],
                ocupacao: ocupacoes[Math.floor(Math.random() * ocupacoes.length)],
                segredo: segredos[Math.floor(Math.random() * segredos.length)]
            };

            await sock.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

            const msgPerfil = `🔍 *ANÁLISE DE PERFIL - BONDE DO BRASIL*\n\n` +
                              `👤 *Alvo:* @${alvo}\n` +
                              `🎭 *Perfil:* ${perfil.adjetivo}\n` +
                              `💼 *Profissão:* ${perfil.ocupacao}\n` +
                              `🤫 *Segredo Sombrio:* ${perfil.segredo}\n\n` +
                              `_Análise feita por pedido do @${autor}_`;

            try {
                // Tenta puxar a foto oficial do WhatsApp da pessoa
                const ppUrl = await sock.profilePictureUrl(mention, 'image');
                
                await sock.sendMessage(sender, { 
                    image: { url: ppUrl }, 
                    caption: msgPerfil, 
                    mentions: [participant, mention] 
                }, { quoted: msg });
                
            } catch (err) {
                // Se a pessoa ocultou a foto, manda SÓ O TEXTO! Sem travar o bot.
                await sock.sendMessage(sender, { 
                    text: `*(Foto ocultada pela privacidade)* 🕵️‍♂️\n\n${msgPerfil}`, 
                    mentions: [participant, mention] 
                }, { quoted: msg });
            }
        }

        // ==========================================
        // 🔒 CONTROLE DE GRUPO (!fechar / !abrir)
        // ==========================================
        if (text === '!fechar') {
            if (!isAdmin) {
                return await sock.sendMessage(sender, { text: "Ih, ala! O engraçadinho quer fechar o grupo? Deixa isso com quem manda! 🤡" }, { quoted: msg });
            } 
            
            try {
                // Sintaxe moderna do Baileys para fechar o grupo
                await sock.groupSettingUpdate(sender, 'announcement');
                await sock.sendMessage(sender, { text: "🔒 *Grupo fechado!* Só a Elite (Admins) fala agora. 🤐" }, { quoted: msg });
            } catch (e) {
                console.error("Erro ao fechar grupo:", e);
                await sock.sendMessage(sender, { text: "❌ Não consegui fechar o grupo. Tem certeza que **EU (o bot)** sou administrador aqui? Coloca a coroa em mim! 👑" }, { quoted: msg });
            }
        }

        if (text === '!abrir') {
            if (!isAdmin) {
                return await sock.sendMessage(sender, { text: "Negativo! Só ADM manda aqui! 😂" }, { quoted: msg });
            } 
            
            try {
                // Sintaxe moderna do Baileys para abrir o grupo
                await sock.groupSettingUpdate(sender, 'not_announcement');
                await sock.sendMessage(sender, { text: "🔓 *Grupo aberto!* Podem soltar a bagunça! 🎉" }, { quoted: msg });
            } catch (e) {
                console.error("Erro ao abrir grupo:", e);
                await sock.sendMessage(sender, { text: "❌ Não consegui abrir o grupo. O bot precisa de cargo de administrador! 👑" }, { quoted: msg });
            }
        }

        // ==========================================
        // 🔇 MUTE / DESMUTE (!mute / !desmute)
        // ==========================================
        if (text.startsWith('!mute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Somente ADMs podem mutar!" }, { quoted: msg });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione o alvo! Ex: !mute @fulano" }, { quoted: msg });
            
            const MEU_ID_REAL = "96057379803159@lid"; 
            const meuNumero = "5527992997083";
            
            if (mention === MEU_ID_REAL || String(mention).includes(meuNumero)) {
                return await sock.sendMessage(sender, { text: "❌ Nem tenta! O criador é intocável! 👑" }, { quoted: msg });
            }

            // Impede de mutar outro ADM
            if (groupAdmins.includes(mention)) {
                return await sock.sendMessage(sender, { text: "❌ Você não pode mutar outro administrador! A hierarquia precisa ser respeitada. 🛡️" }, { quoted: msg });
            }

            const tempo = text.includes('h') ? 3600000 : 1800000; // Padrão: 30 minutos, se tiver 'h' vira 1 hora
            mutados[mention] = Date.now() + tempo;
            fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
            
            await sock.sendMessage(sender, { 
                text: `🔇 *MUDO!* O @${mention.split('@')[0]} falou demais e tomou um mute!\n\n_(Obs: Certifique-se de que o bot é ADM para ele conseguir apagar as mensagens dessa pessoa)_ 🤫`, 
                mentions: [mention] 
            }, { quoted: msg });
        }

        if (text.startsWith('!desmute')) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: "❌ Você não é ADM!" }, { quoted: msg });
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            
            if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione quem você quer desmutar!" }, { quoted: msg });

            if (mutados[mention]) {
                delete mutados[mention];
                fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
                await sock.sendMessage(sender, { 
                    text: `🔊 *MILAGRE!* O @${mention.split('@')[0]} foi desmutado e já pode voltar a falar besteira! 😎`, 
                    mentions: [mention] 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: "❌ Essa pessoa não está mutada na minha lista!" }, { quoted: msg });
            }
        }
       // ==========================================
        // 🌤️ COMANDO !CLIMA (NOVO SATÉLITE OPEN-METEO - NÃO CAI!)
        // ==========================================
        if (text.startsWith('!clima')) {
            const cidade = text.replace('!clima', '').trim();
            if (!cidade) return await sock.sendMessage(sender, { text: "❌ Ô gênio, esqueceu a cidade! Ex: !clima Guarapari", quoted: msg });

            await sock.sendMessage(sender, { react: { text: '🌤️', key: msg.key } });

            try {
                // 1. Busca as coordenadas exatas da cidade (Não falha com nomes compostos)
                const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`);
                
                if (!geoRes.data.results || geoRes.data.results.length === 0) {
                    return await sock.sendMessage(sender, { text: `❌ A cidade "${cidade}" não existe ou o mapa engoliu! 😂 Tente escrever o nome certinho.`, quoted: msg });
                }

                const local = geoRes.data.results[0];
                const lat = local.latitude;
                const lon = local.longitude;
                const nomeCidade = local.name;
                const estado = local.admin1 || local.country; // Pega o estado ou o País se for cidade pequena

                // 2. Busca o clima ao vivo batendo nas coordenadas exatas
                const climaRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
                const current = climaRes.data.current_weather;
                const temp = current.temperature;
                const code = current.weathercode;

                // 3. Traduz os códigos meteorológicos mundiais (WMO) para PT-BR
                let desc = "Desconhecido";
                let tipo = "nublado";
                
                if (code === 0) { desc = "Céu Limpo ☀️"; tipo = "sol"; }
                else if (code >= 1 && code <= 3) { desc = "Parcialmente Nublado ⛅"; tipo = "nublado"; }
                else if (code === 45 || code === 48) { desc = "Nevoeiro 🌫️"; tipo = "nublado"; }
                else if (code >= 51 && code <= 67) { desc = "Chovendo 🌧️"; tipo = "chuva"; }
                else if (code >= 71 && code <= 77) { desc = "Neve ❄️"; tipo = "nublado"; }
                else if (code >= 80 && code <= 82) { desc = "Pancadas de Chuva 🌦️"; tipo = "chuva"; }
                else if (code >= 85 && code <= 86) { desc = "Nevasca 🌨️"; tipo = "nublado"; }
                else if (code >= 95) { desc = "Tempestade ⛈️"; tipo = "chuva"; }

                // Zueiras baseadas no tempo
                const piadas = {
                    sol: ["Tá um sol que parece o próprio inferno! 🔥", "Dia perfeito pra fritar um ovo no asfalto. 🍳", "Cuidado pra não derreter, hein! ☀️"],
                    chuva: ["Chovendo? Ótimo, desculpa perfeita pra não fazer nada! 🌧️", "Combo: chuva, netflix e solidão. ☕", "Traz o guarda-chuva ou vira um rato molhado! 🐭"],
                    nublado: ["Tempo nublado, igual ao seu futuro. ☁️", "Parece que vai chover... ou não. O tempo tá indeciso igual você! 🌩️", "Céu cinza, perfeito pra dormir o dia todo. 💤"]
                };

                const fraseBot = piadas[tipo][Math.floor(Math.random() * piadas[tipo].length)];

                const msgClima = `🌤 *TEMPO NO BONDE: ${nomeCidade.toUpperCase()} - ${estado.toUpperCase()}*\n\n` +
                                 `🌡 *Temperatura:* ${temp}°C\n` +
                                 `☁️ *Condição:* ${desc}\n\n` +
                                 `💬 *Analista do NeymarBOT:* ${fraseBot}`;

                await sock.sendMessage(sender, { 
                    video: { url: 'https://media.tenor.com/Ke8JW6DGWTgAAAPo/dog-weather.mp4' }, 
                    gifPlayback: true,
                    caption: msgClima,
                    mentions: [participant]
                }, { quoted: msg });
                
            } catch (err) {
                console.error("Erro na API de Clima Open-Meteo:", err.message);
                await sock.sendMessage(sender, { text: "❌ Deu pau no satélite! Tente de novo em alguns minutos.", quoted: msg });
            }
        }

        // --- SALVAMENTO FINAL DE RANKING ---
        contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
        fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens)); 

    }); 
}

connectToWhatsApp();
