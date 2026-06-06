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
        
        // Mensagem de boas-vindas aprimorada
       sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    if (action === 'add') {
        const userId = typeof participants[0] === 'string' ? participants[0] : participants[0].id;
        
        const textoBoasVindas = 
            `🌟 *BEM-VINDO(A) AO BONDE DO BRASIL* 🌟\n\n` +
            `Olá, @${userId.split('@')[0]}! Ficamos felizes com sua chegada.\n\n` +
            `📝 *PARA UMA BOA CONVIVÊNCIA, ATENTE-SE:* \n\n` +
            `📍 *APRESENTAÇÃO OBRIGATÓRIA*\n` +
            `Envie: *FOTO | CIDADE | IDADE | NOME*\n\n` +
            `🚫 *REGRAS DE OURO (BAN)*\n` +
            `• Proibido links externos.\n` +
            `• Proibido brigas ou ofensas.\n` +
            `• Proibido spam ou vendas não autorizadas.\n` +
            `• Respeite o espaço alheio (não invada o PV).\n\n` +
            `🤖 *DICA:* O bot está disponível para uso, mas evite abusar dos comandos.\n\n` +
            `❓ *Dúvidas?* Marque um administrador no grupo ou chame-o no privado.`;

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

    if (mutados[participant] && Date.now() < mutados[participant]) {
        await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        return; 
    }

    const sender = msg.key.remoteJid;
    const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
    
    contagemMensagens[participant] = (contagemMensagens[participant] || 0) + 1;
    fs.writeFileSync(ARQUIVO_RANK, JSON.stringify(contagemMensagens));
    
    const getIsAdmin = async () => { if (!sender.endsWith('@g.us')) return false; try { const metadata = await sock.groupMetadata(sender); return metadata.participants.find(p => p.id === participant)?.admin !== null; } catch { return false; } };
    const isAdmin = await getIsAdmin();

    const lowerText = text.toLowerCase();

// 1. Resposta ao mencionar Bot
if (lowerText.includes('bot')) {
    await sock.sendMessage(sender, { 
        text: `Fala aí @${participant.split('@')[0]}, tá falando de mim, por que? Quer morrer?🔫👀`, 
        mentions: [participant] 
    }, { quoted: msg }); // Ajustado para responder em cima
}

// 2. Dinheiro
if (lowerText.includes('dinheiro') || lowerText.includes('grana') || lowerText.includes('cash')) {
    await sock.sendMessage(sender, { react: { text: '💸', key: msg.key } });
    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/cLjA_QYEHesAAAPo/grana.mp4' }, 
        gifPlayback: true, 
        caption: 'Opa, falou em dinheiro? Tá sobrando ou tá faltando, meu parceiro? 💸👀' 
    }, { quoted: msg }); // Ajustado para responder em cima
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
        let urlGif = 'https://media.tenor.com/7HPdFKRYFwMAAAPo/thank-you.mp4';
        let frase = 'Bom dia! Dormi igual a um anjo, acordei igual a um boleto vencido.😂😂 ';
        
        if (lowerText.includes('boa tarde')) { 
            emoji = '🌤️'; 
            urlGif = 'https://media.tenor.com/C78aGUgwTEYAAAPo/good-afternoon-rollygifs.mp4'; 
            frase = 'Boa tarde! Que a força do café esteja comigo, porque a minha já acabou.💔😂'; 
        } else if (lowerText.includes('boa noite')) { 
            emoji = '🌙'; 
            urlGif = 'https://media.tenor.com/0RCfPxdUCs8AAAPo/dvfedvr.mp4'; 
            frase = 'Boa noite! Que o seu sono seja tão profundo quanto o saldo negativo da minha conta.🥱😵‍💫'; 
        }

        await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });
        
        // Ajuste aqui: o quoted agora aponta para a chave da mensagem original
        await sock.sendMessage(sender, { 
            video: { url: urlGif }, 
            gifPlayback: true, 
            caption: `🤖 *${frase}*` 
        }, { quoted: msg }); 
    }

        // 5. Sextou
    if (lowerText.includes('sextou')) {
        await sock.sendMessage(sender, { react: { text: '🥳', key: msg.key } });
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/IuZs76jQrG4AAAPo/sextou-familia.mp4' }, 
            gifPlayback: true, 
            caption: 'Sextou! Corpo no trabalho, mente no primeiro gole de cerveja.🍺😜' 
        }, { quoted: msg });
    }

    // 6. Trabalho
    if (lowerText.includes('trabalhar') || lowerText.includes('trabalho')) {
        await sock.sendMessage(sender, { react: { text: '😰', key: msg.key } });
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/ONR_In8tDa8AAAPo/meme-funny-funny-meme.mp4' }, 
            gifPlayback: true, 
            caption: 'Se trabalho desse dinheiro, o dono da empresa não estaria milionário enquanto eu tomo café morno.😪☕️' 
        }, { quoted: msg });
    }

    // 7. Bebida
    if (lowerText.includes('bebida') || lowerText.includes('cerveja') || lowerText.includes('vodka') || lowerText.includes('whisky')) {
        await sock.sendMessage(sender, { react: { text: '🍻', key: msg.key } });
        await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/6ZIClIzEuGwAAAPo/drink-dog.mp4' }, 
            gifPlayback: true, 
            caption: 'Opa, falou em bebida???? 👀👀👀👀' 
        }, { quoted: msg });
    }


    // 9. Comandos extras (ban, tier, matar, rank, adm, socar, beijar, fechar, abrir, musica, desmute, mute, clima)
    // *Dica: Aplique o quoted: msg em todos os sock.sendMessage dentro desses blocos também!*
    const comandosExistentes = ['!menu', '!rank', '!sortear', '!jogar', '!tier', '!penalti', '!musica', '!socar', '!beijar', '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', '!clima', '!desmute', '!mute'];
    if (text.startsWith('!') && !comandosExistentes.some(cmd => text.startsWith(cmd))) {
        await sock.sendMessage(sender, { text: "Aí que você quer demais né, amigo? Olha o menu e digite esse maldito comando direito!!!!!", quoted: msg });
    }



        // 2. !MENU
        // 2. !MENU (ESTILO PERSONALIZADO BASEADO NA IMAGEM)
        if (text === '!menu') {
    // Definimos quem enviou a mensagem (o participante real)
    const senderId = msg.key.participant || msg.key.remoteJid; 
    const nomeUsuario = msg.pushName || 'visitante';
    const dataAtual = new Date().toLocaleDateString('pt-BR');
const horaAtual = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });


    const menuTexto = `
「 ❍ BONDE DO BRASIL ❍ 」

✨ BOAS-VINDAS, @${senderId.split('@')[0]}! 🔔✨

↪ 🔔 DATA: ${dataAtual}
↪ ⏰ HORA: ${horaAtual}
↪ 👑 DEV: Caio o melhor 😎
↪ 🤖 ATUALIZAÇÕES: Semanais

🔔 MENU DE COMANDOS 🫧

⚽ 1. JOGOS E ORGANIZAÇÃO
🩸 🔰 !rank
🩸 ⌛ !sortear
🩸 🎇 !tier [tema]
🩸 🎮 !jogar
🩸 ⚽️ !penalti

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

    // 3. Envio com menção correta ao senderId
    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/WV_2tGerThoAAAPo/farming-aura-farming.mp4' },
        gifPlayback: true, 
        caption: menuTexto,
        mentions: [senderId] // Garantimos que o ID está na lista de menções
    }, { quoted: msg }); // Adicionei o quoted para responder sua mensagem!
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
// 7. Música e Figurinha
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
        // Comando !clima
        // 8. COMANDO CLIMA (AJUSTADO)
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
