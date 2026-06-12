const weather = require('weather-js');
const { execSync } = require('child_process');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const dataPath = '/var/data';
const arquivoPlacarEmoji = path.join(dataPath, 'placar_emoji.json');
const ARQUIVO_PLACAR_EMOJI = arquivoPlacarEmoji; // Garante que ambos os nomes funcionem
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
let ataquesFuria = {}; // Adicione isso junto com as outras let no topo
const contagemFlood = {};
let admsTemporarios = {};
let escudosAtivos = {};
const cooldownRoubo = {}; // Armazena o timestamp do último roubo
let membrosPendentes = {}; // { jid: timestamp }
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
// ... (seus outros requires)
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

// Função de salvamento (mantenha como está)
const salvarCasais = () => {
    listaCasais = lerArquivoSeguro(arquivoCasais);
};
// Garante que o arquivo exista antes de qualquer coisa
if (!fs.existsSync(ARQUIVO_PLACAR_EMOJI)) {
    fs.writeFileSync(ARQUIVO_PLACAR_EMOJI, JSON.stringify({}));
}
// Faça o mesmo para o placar.json se necessário:
if (!fs.existsSync(arquivoPlacar)) {
    fs.writeFileSync(arquivoPlacar, JSON.stringify({}));
}
// --- CARREGAMENTO SEGURO DE CASAIS ---
try {
    if (fs.existsSync(arquivoCasais)) {
        const dados = fs.readFileSync(arquivoCasais, 'utf8');
        // Verifica se o arquivo não está vazio ou apenas com espaços em branco
        if (dados && dados.trim().length > 0) {
            listaCasais = JSON.parse(dados);
            console.log(`✅ Lista de casais carregada com sucesso (${listaCasais.length} casais).`);
        } else {
            console.log("⚠️ casais.json estava vazio, iniciando lista limpa.");
            listaCasais = [];
        }
    } else {
        console.log("ℹ️ Arquivo casais.json não encontrado, criando um novo.");
        listaCasais = [];
        fs.writeFileSync(arquivoCasais, JSON.stringify([], null, 2));
    }
} catch (e) {
    console.error("❌ Erro fatal ao ler casais.json, reiniciando lista:", e);
    listaCasais = [];
}

// Função para garantir que os arquivos existem no DISCO, não no repositório
function garantirArquivo(caminho) {
    if (!fs.existsSync(caminho)) {
        console.log(`Criando arquivo inexistente no disco: ${caminho}`);
        fs.writeFileSync(caminho, JSON.stringify({})); // Cria um JSON vazio
    }
}

// Aplique para todos os seus arquivos
garantirArquivo(arquivoPlacar);
garantirArquivo(arquivoCargos);
garantirArquivo(arquivoCasais);
garantirArquivo(ARQUIVO_RANK);
garantirArquivo(ARQUIVO_MUTADOS);


let placarEmoji = lerArquivoSeguro(ARQUIVO_PLACAR_EMOJI);

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


// --- VARIÁVEIS DE ESTADO E ARQUIVOS ---
let contagemMensagens = lerArquivoSeguro(ARQUIVO_RANK);
let mutados = lerArquivoSeguro(ARQUIVO_MUTADOS);

// Garante que os arquivos existam no disco
if (!fs.existsSync(arquivoPlacar)) fs.writeFileSync(arquivoPlacar, JSON.stringify({}));
if (!fs.existsSync(arquivoCargos)) fs.writeFileSync(arquivoCargos, JSON.stringify({}));
if (!fs.existsSync(arquivoCasais)) fs.writeFileSync(arquivoCasais, JSON.stringify([], null, 2));

// --- FUNÇÃO DE CONEXÃO ---
// --- FUNÇÃO DE CONEXÃO ---
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

    // Boas-vindas (VERSÃO COMPLETA)
        
        sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    const userId = typeof participants[0] === 'string' ? participants[0] : participants[0].id;

    if (action === 'add') {
        membrosPendentes[userId] = Date.now(); // Salva a hora que entrou
        
        const textoBoasVindas = 
`━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 *BEM-VINDO AO CAOS: BONDE DO BRASIL* 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━

Fala aí, @${userId.split('@')[0]}! 🎉 
Você acaba de ser convocado para a elite da zueira! 🚀

🎮 *O QUE ROLA NO BONDE:*
Aqui o pau quebra com estilo! Temos sistema de economia, cargos exclusivos e muito caos.
• *JOGOS:* Participe do nosso *Quiz* (!perguntas), encare o *Boss* (!atacar) ou vire um *mestre do ranking* (!placar).
• *LOJA:* Use *!comprar [item]* para virar o jogo (tem até mute, vip e adm de fachada! 🤫).
• *CASAMENTOS:* Quer dividir o mico? Digite *!casar @alguém*.

📜 *REGULAMENTO DO BONDE (OU A LEI DO MAIS FORTE)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
① *Respeito acima de tudo:* Sem brigas ou mimimi.
② *Privacidade:* PV alheio sem permissão = BAN.
③ *Segurança:* Nada de conteúdo adulto ou você vaza.
④ *Zero Tolerância:* Link suspeito, spam ou trava? É BAN direto sem direito a apelação! 🚫
━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 *REGISTRO OBRIGATÓRIO (NÃO SEJA UM FANTASMA):*
Envie: *FOTO | CIDADE | IDADE | NOME*. 
Se não registrar, o bot acha que você é robô e vai te perseguir! 🤖

🤖 *DICA:* Digite *!menu* AGORA para ver todos os comandos e começar a brincadeira. Se não digitar, já entra perdendo pontos! 💸`;

        await sock.sendMessage(id, { 
            text: textoBoasVindas, 
            mentions: [userId]
        });
    } else if (action === 'remove') {
        // --- LIMPEZA AUTOMÁTICA DE QUEM SAIU ---
        if (membrosPendentes[userId]) {
            delete membrosPendentes[userId];
            console.log(\`🧹 ${userId.split('@')[0]} saiu do grupo, removido da lista de pendentes.\`);
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
        const participant = msg.key.participant || sender;
        console.log("DEBUG ID DO PARTICIPANTE: " + participant);
        const isGroup = sender.endsWith('@g.us');
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
        const lowerText = text.toLowerCase();
        const isMedia = (msg.message.imageMessage || msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage);

        let isAdmin = false;
        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(sender);
                const groupAdmins = metadata.participants.filter(p => p.admin !== null).map(p => p.id);
                isAdmin = groupAdmins.includes(participant);
            } catch (e) { console.log("Erro ao buscar admins:", e); }
        }

    // 2. Verificação de Mutados
    if (mutados[participant] && Date.now() < mutados[participant]) {
        await sock.sendMessage(sender, { delete: msg.key });
        return; 
    }

    // Verifica se a pessoa mandou o formato FOTO | CIDADE | IDADE | NOME
// --- AUTO-APROVAÇÃO POR FOTO OU APRESENTAÇÃO ---
// --- SISTEMA DE CADASTRO (AUTO-APROVAÇÃO E COBRANÇA) ---
if (membrosPendentes[participant]) {
    // Busca a imagem em qualquer um dos dois formatos (normal ou viewOnce)
    const imagem = msg.message?.imageMessage || 
                   msg.message?.viewOnceMessage?.message?.imageMessage || 
                   msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
                   msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.viewOnceMessage?.message?.imageMessage;

    const padraoApresentacao = /\|/g;
    const enviouTextoCorreto = (text.match(padraoApresentacao) || []).length >= 3;

    // Se tiver imagem (qualquer tipo) OU enviou o texto correto, aprovamos
    if (imagem || enviouTextoCorreto) {
        await sock.sendMessage(sender, { 
            text: `✅ Cadastro confirmado, @${participant.split('@')[0]}! Bem-vindo ao Bonde!`, 
            mentions: [participant] 
        }, { quoted: msg });
        delete membrosPendentes[participant];
    } else {
        await sock.sendMessage(sender, { 
            text: `⚠️ Ei, @${participant.split('@')[0]}, cadê a apresentação, você não seguiu o padrão! \n\nEnvie uma FOTO ou o formato: FOTO | CIDADE | IDADE | NOME. 📸`, 
            mentions: [participant] 
        }, { quoted: msg });
    }
}

// --- COMANDO PARA ADM LISTAR OS ATRASADOS ---
// --- COMANDO PARA ADMS LISTAR OS ATRASADOS ---
if (text === '!cadastros') {
    // 1. Verifica se quem enviou é um administrador
    if (!isAdmin) {
        const frasesErro = [
            "❌ Opa, @${participant.split('@')[0]}, você não é ADM! Fica na sua que quem fiscaliza aqui sou eu e os chefes! 🤡",
            "🚫 Tentando dar uma de fiscal, @${participant.split('@')[0]}? Esse comando é só pros ADMs, senta lá! 😂",
            "🧐 Eita, querendo mandar no grupo sem ter cargo? Volta pro seu lugar, esse comando é exclusivo da Elite! 👑"
        ];
        const msgErro = frasesErro[Math.floor(Math.random() * frasesErro.length)];
        
        return await sock.sendMessage(sender, { 
            text: msgErro, 
            mentions: [participant] 
        }, { quoted: msg });
    }

    // 2. Lógica para os ADMs
    const pendentes = Object.keys(membrosPendentes);
    if (pendentes.length === 0) return await sock.sendMessage(sender, { text: "✅ Todos já se apresentaram! O grupo está limpo. 😇" });
    
    let msgLista = "🕵️‍♂️ *Atenção, ADMs! O radar detectou novos membros que ainda não tomaram vergonha na cara para se registrar!*\n\n";
    msgLista += "👻 *LISTA DE FANTASMAS (NÃO APRESENTADOS):*\n\n";
    
    pendentes.forEach(p => {
        msgLista += `• @${p.split('@')[0]}\n`;
    });
    
    msgLista += "\n_Se apresentem logo (mandem a FOTO ou DADOS) ou serão expulsos sem aviso prévio! 🤡_";
    
    await sock.sendMessage(sender, { text: msgLista, mentions: pendentes }, { quoted: msg });
}

    // 3. Comando de Controle de Jogos (Ativar/Desativar)
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

    // --- 4. Trava de segurança para jogos (COM EXCEÇÃO PARA ADM) ---
const comandosDeJogo = ['!piada', '!casar', '!descasar', '!forca', '!penalti', '!sortear', '!emoji', '!jogar', '!musica', '!perguntas'];

if (!jogosLiberados && comandosDeJogo.some(cmd => text.startsWith(cmd))) {
    if (isAdmin) {
        const frasesAdm = [
            "🤖 Os jogos estão trancados a sete chaves, mas como você é o dono da banca (ADM), vou abrir uma exceção só pra você! 👑",
            "😎 O grupo tá em modo sério, mas pra você eu abro qualquer porta. Pode mandar o comando! 🔓",
            "🤴 Você não deveria, mas você é o chefe, né? Jogos liberados só por causa da sua majestade! 👑",
            "🧐 O sistema tá bloqueado, mas pra você eu faço um 'gato' aqui. Manda ver, ADM! 🛠️",
            "🤡 Os plebeus não podem jogar, mas como você é o ADM, vou ignorar as regras só pra te agradar! 🎉"
        ];
        
        await sock.sendMessage(sender, { 
            text: frasesAdm[Math.floor(Math.random() * frasesAdm.length)], 
            quoted: msg 
        });
        // O código continua e executa o jogo normalmente
    } else {
        return await sock.sendMessage(sender, { 
            text: "❌ *Os jogos estão desativados por um ADM.* Aguarde a liberação para brincar, seu apressado! 🤐", 
            quoted: msg 
        });
    }
}

if (text.startsWith('!comprar_cargo')) {
    const novoCargo = text.replace('!comprar_cargo', '').trim();
    if (!novoCargo) return await sock.sendMessage(sender, { text: "❌ Qual cargo você quer? Ex: !comprar_cargo Rei da Zueira", quoted: msg });

    let placar = {};
if (fs.existsSync(arquivoPlacar)) {
    placar = JSON.parse(fs.readFileSync(arquivoPlacar, 'utf8'));
}
    let cargos = lerArquivoSeguro(arquivoCargos);
    
    const custo = 500; // Preço do luxo
    if ((placar[participant] || 0) < custo) return await sock.sendMessage(sender, { text: `❌ Você não tem ${custo} pontos! Vai trabalhar! 😂`, quoted: msg });

    placar[participant] -= custo;
    cargos[participant] = novoCargo;
    
    console.log("Tentando salvar no caminho: " + arquivoPlacar);
    fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
    fs.writeFileSync(arquivoCargos, JSON.stringify(cargos, null, 2));

    await sock.sendMessage(sender, { text: `👑 Parabéns @${participant.split('@')[0]}! Agora seu cargo oficial é: *${novoCargo}*`, mentions: [participant], quoted: msg });
}

// --- COMANDO !DAR_PONTOS (EXCLUSIVO PARA ADM) ---
if (text.startsWith('!dar_pontos')) {
    // 1. Verifica se quem enviou é ADM (Certifique-se que sua variável isAdmin esteja correta)
    if (!isAdmin) {
        return await sock.sendMessage(sender, { text: "❌ Apenas ADMs têm autoridade para manipular a economia do Bonde! 🚫", quoted: msg });
    }

    // 2. Extrai a menção e a quantidade
    // O args[0] é o comando, args[1] é a menção (@bot), args[2] é o valor
    const args = text.split(' ');
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quantidade = parseInt(args[2]);

    if (!mention || isNaN(quantidade)) {
        return await sock.sendMessage(sender, { 
            text: "❌ Formato inválido.\nUse: !dar_pontos @mencao [quantidade]\nEx: !dar_pontos @5521999999999 500", 
            quoted: msg 
        });
    }

    // 3. Carrega o placar com segurança total
    let placar = {};
    try {
        if (fs.existsSync(arquivoPlacar)) {
            const conteudo = fs.readFileSync(arquivoPlacar, 'utf8');
            // Se o arquivo estiver vazio, define como objeto vazio
            placar = conteudo ? JSON.parse(conteudo) : {};
        }
    } catch (e) {
        console.error("Erro ao ler o arquivo de placar:", e);
        placar = {};
    }

    // 4. Adiciona os pontos
    // A chave do JSON será o ID completo (ex: 552199999999@s.whatsapp.net)
    placar[mention] = (placar[mention] || 0) + quantidade;
    
    // 5. Salva no arquivo
    try {
        fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
    } catch (e) {
        return await sock.sendMessage(sender, { text: "❌ Erro ao salvar os pontos no banco de dados.", quoted: msg });
    }

    // 6. Confirmação com menção correta
    await sock.sendMessage(sender, { 
        text: `✅ Sucesso! Foram adicionados *${quantidade} pontos* ao saldo de @${mention.split('@')[0]}.`, 
        mentions: [mention],
        quoted: msg 
    });
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

// --- COMANDO !PERGUNTAS (QUIZ MEDIANO/DIFÍCIL) ---
// --- COMANDO !PERGUNTAS (QUIZ NÍVEL AVANÇADO) ---
if (text === '!perguntas') {
    const quiz = [
        { q: "Qual o nome da menor unidade de memória de um computador? 💻", r: "bit" },
        { q: "Qual país possui o maior número de fusos horários do mundo? 🌍", r: "franca" },
        { q: "Quem foi o arquiteto responsável pelo projeto de Brasília? 🏛️", r: "oscar niemeyer" },
        { q: "Qual é o metal mais denso da tabela periódica? 🧪", r: "osmio" },
        { q: "Qual é a capital da Etiópia? 🇪🇹", r: "adis abeba" },
        { q: "Qual o nome do satélite natural que possui uma atmosfera própria em nosso sistema solar? 🪐", r: "tita" },
        { q: "Em que ano a Segunda Guerra Mundial terminou oficialmente? 🕊️", r: "1945" },
        { q: "Qual a profundidade do ponto mais profundo dos oceanos, a Fossa das Marianas? 🌊", r: "11000 metros" },
        { q: "Quem é conhecido como o pai da computação moderna? 🤖", r: "alan turing" },
        { q: "Qual o nome da reação química que ocorre quando o ferro enferruja? ⚙️", r: "oxidacao" },
        { q: "Qual é o único continente que não possui vulcões ativos? 🏔️", r: "australia" },
        { q: "Qual foi o primeiro país a conceder o voto às mulheres? 🗳️", r: "nova zelandia" },
        { q: "Qual a velocidade da luz no vácuo em km/s? ⚡", r: "300000" },
        { q: "Qual é o maior mamífero terrestre do mundo? 🐘", r: "elefante africano" },
        { q: "Qual cientista propôs as leis da gravitação universal? 🍎", r: "isaac newton" },
        { q: "Qual o idioma mais falado do mundo por falantes nativos? 🗣️", r: "mandarim" },
        { q: "Qual o nome da linha imaginária que divide o globo em Norte e Sul? 🗺️", r: "linha do equador" },
        { q: "Quem pintou a 'Mona Lisa'? 🎨", r: "leonardo da vinci" },
        { q: "Qual é a floresta tropical que produz 20% do oxigênio da Terra? 🌳", r: "amazonica" },
        { q: "Qual é o país que tem a forma de uma bota no mapa? 🇮🇹", r: "italia" },
        { q: "Qual é o maior animal que já existiu na Terra? 🐋", r: "baleia azul" },
        { q: "Quem escreveu a obra 'Crime e Castigo'? 📚", r: "dostoievski" },
        { q: "Qual a temperatura em que a água ferve ao nível do mar em Celsius? 🌡️", r: "100" },
        { q: "Qual é o nome da substância que dá a cor verde às plantas? 🍃", r: "clorofila" },
        { q: "Qual é a cidade conhecida como 'cidade luz'? 🗼", r: "paris" }
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

// Lógica de validação do Quiz (AGORA COM PONTUAÇÃO REAL)
if (jogoPerguntas.ativo && msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoPerguntas.idMensagem) {
    const respostaUsuario = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
    const respostaCerta = jogoPerguntas.resposta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");

    if (respostaUsuario === respostaCerta) {
        jogoPerguntas.ativo = false;
        
        // --- ATUALIZAÇÃO DO PLACAR ---
        let placar = lerArquivoSeguro(arquivoPlacar);
        placar[participant] = (placar[participant] || 0) + 30; // ADICIONA 30 PONTOS
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

// --- LÓGICA DO ANTI-LINK COM AUTO BAN ---
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
            // Frases aleatórias para o aviso (apenas para membros)
            const frasesAviso = [
                `🚫 OPA, @${participant.split('@')[0]}! Aqui não pode link. Você tem ${restam} chance(s) antes do ban!`,
                `⚠️ @${participant.split('@')[0]}, soltou o link? O sistema não perdoa! Faltam ${restam} chances.`,
                `🧐 Opa, link por aqui? Nem tenta! O sistema está de olho. Mais ${restam} chance(s) e vaza!`,
                `🚫 Link detectado! @${participant.split('@')[0]}, você está brincando com a sorte. ${restam} chance(s) restantes!`
            ];
            const sorteioAviso = frasesAviso[Math.floor(Math.random() * frasesAviso.length)];

            await sock.sendMessage(sender, { 
                video: { url: 'https://media.tenor.com/q4GIdsYVSXcAAAPo/no-nooo.mp4' },
                gifPlayback: true,
                caption: sorteioAviso,
                mentions: [participant]
            }, { quoted: msg });
            await sock.sendMessage(sender, { delete: msg.key });
        }
        return; 
    } else {
        // Para ADM: Apenas reage com um emoji e não envia texto
        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    }
}
    // --- INÍCIO DO ANTI-TRAVA ---
    if (text.length > 5000) {
    

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
// --- ANTI-SPAM AJUSTADO (SEM ERROS DE ASSINCRONIA) ---
const agora = Date.now();
if (!contagemFlood[participant]) contagemFlood[participant] = [];
contagemFlood[participant] = contagemFlood[participant].filter(t => agora - t < 1000);
contagemFlood[participant].push(agora);

if (contagemFlood[participant].length >= 5) {
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
        placarEmoji[pId] = (placarEmoji[pId] || 0) + 100;
        fs.writeFileSync(arquivoPlacarEmoji, JSON.stringify(placarEmoji, null, 2));

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

// Substitua o seu bloco !rankingemoji por este:

if (text === '!ranking' || text === '!placar') {
    // 1. Carregamento forçado e seguro do arquivo no disco
    let placar = {};
    try {
        if (fs.existsSync(arquivoPlacar)) {
            const conteudo = fs.readFileSync(arquivoPlacar, 'utf8');
            placar = (conteudo && conteudo.trim().length > 0) ? JSON.parse(conteudo) : {};
        }
    } catch (e) {
        console.error("❌ Erro ao ler o banco de dados do ranking:", e);
        return await sock.sendMessage(sender, { text: "❌ Erro ao ler o banco de dados.", quoted: msg });
    }

    // 2. Transformar em array e limpar
    const entries = Object.entries(placar);
    
    if (entries.length === 0) {
        return await sock.sendMessage(sender, { text: "❌ O placar está vazio.", quoted: msg });
    }

    // 3. Ordena os 10 primeiros
    const ranking = entries.sort((a, b) => b[1] - a[1]).slice(0, 10);

    let res = `💎 *TOP 10 - RICOS DO BONDE*\n\n`;
    let listaMentions = [];

    ranking.forEach((entry, i) => {
        const [id, pontos] = entry;
        listaMentions.push(id); // Adiciona o ID para o WhatsApp mencionar corretamente
        const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🔹";
        
        const numero = id.split('@')[0];
        res += `${medalha} ${i + 1}. @${numero} - *${pontos.toLocaleString('pt-BR')} pts*\n`;
    });

    // 4. Envio do ranking
    await sock.sendMessage(sender, { 
        text: res, 
        mentions: listaMentions 
    }, { quoted: msg });
}

// --- COMANDO !link ---
if (lowerText === '!link') {
    // 1º Ação: Reação na mensagem de quem pediu
    await sock.sendMessage(sender, { 
        react: { text: '🔗', key: msg.key } 
    });

    // Substitua pelo link real do seu grupo
    const linkDoGrupo = "https://chat.whatsapp.com/HT7DEVaIjiE7hZ8PDThZ5a?s=cl&p=i&ilr=0"; 
    
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


   // 4. Saudações (Mensagens Engraçadas e Debochadas)
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

    // Reação na mensagem do usuário
    await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } });
    
    // Envia a mensagem de texto debochada
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

    // Ache essa linha no seu código e adicione o '!cargos' nela:
const comandosExistentes = [
    '!menu', '!comprar', '!loja', '!pesquisar', '!backup', '!dar_pontos', '!atacar', '!boss', '!rank', '!casar', '!casais', '!piada', '!avisoadm', 
    '!descasar', '!emoji', '!sortear', '!cadastros', '!perguntas', '!jogar', 
    '!forca', '!jogosoff', '!jogoson', '!limpar', '!fixar', '!status', '!link', '!tier', 
    '!ranking', '!penalti', '!musica', '!socar', '!beijar', 
    '!matar', '!f', '!ban', '!adm', '!fechar', '!abrir', 
    '!clima', '!desmute', '!mute', '!gado', '!corno', 
    '!fofoca', '!roubar', '!cargos', '!comprar_cargo', '!dar_cargo' // Adicionei aqui
];

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

// 2. !MENU (MENU COMPLETO E ATUALIZADO)
if (text === '!menu') {
    const senderId = msg.key.participant || msg.key.remoteJid; 
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date(new Date().getTime() - (3 * 60 * 60 * 1000)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const meuId = '5527992997083@s.whatsapp.net'; 

    const menuTexto = `
╭━━━ 🇧🇷 BONDE DO BRASIL 🇧🇷
│
│ 👤 Fala, @${senderId.split('@')[0]}!
│ 📅 ${dataAtual} | ⏰ ${horaAtual}
│ 👑 Dono: @5527992997083
│
├────🛍️ LOJA & ECONOMIA────
│ 🛒 !loja      | 💰 !roubar
│ 💳 !comprar_cargo [nome]
│ 💵 !dar_pontos @mencao [qtd]
│ 🤫 !comprar [item]
│
├────🔥 EVENTOS & RAIDS────
│ 👹 !boss      | ⚔️ !atacar
│
├────💎 STATUS & CARGOS────
│ 🛍️ !cargos    | 🎖️ !dar_cargo @mencao
│ 🔰 !rank      | 🏆 !ranking
│
├────🎮 JOGOS & DESAFIOS────
│ ⌛ !sortear   | 🎮 !jogar
│ 😵 !forca     | ⚽ !penalti
│ 🎥 !emoji     | 🤡 !piada
│ 🎤 !musica (Quiz)
│ 🧠 !perguntas | 💍 !casar
│ 💔 !descasar  | 👥 !casais
│
├────😂 ZUEIRA────
│ 🤜 !socar     | 😘 !beijar
│ 🗡️ !matar     | 🤳 !f
│ 🐂 !gado      | 🦌 !corno
│ 🤫 !fofoca
│
├────🚨 ADMIN────
│ ❌ !ban       | ❇️ !adm
│ 🚫 !fechar    | 🔓 !abrir
│ 🔇 !mute      | 🔊 !desmute
│ 📣 !avisoadm  | 🕹️ !jogoson/off
│ 👻 !cadastros
│
├────⚙️ UTIL & SUPORTE────
│ 📛 !menu      | 🌤️ !clima
│ 🔍 !pesquisar| 🔗 !link
│ 📦 !backup
│
╰━━━━━━━━━━━━━━━━━━━━━━╯
🤖 *Acumule pontos, derrote os Bosses e não seja um NPC.*`.trim();

    await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/WV_2tGerThoAAAPo/farming-aura-farming.mp4' },
        gifPlayback: true, 
        caption: menuTexto,
        mentions: [senderId, meuId] 
    }, { quoted: msg });
}
// Adicione !jogar na sua lista de comandosExistentes
if (text.startsWith('!jogar')) {
    // Reação de videogame
    await sock.sendMessage(sender, { react: { text: '🎮', key: msg.key } });

    const args = text.split(' ');
    const escolha = parseInt(args[1]);
    const senderId = msg.key.remoteJid;

    // Definição dos cenários possíveis
    const cenarios = [
        { nome: "Caverna Misteriosa", desc: "Você entrou numa caverna úmida e escura. Escolha um caminho:" },
        { nome: "Castelo Assombrado", desc: "Você está na porta de um castelo mal-assombrado! Escolha uma porta:" },
        { nome: "Floresta Proibida", desc: "Você se perdeu na floresta e ouviu um barulho estranho! Escolha uma trilha:" }
    ];

    // Se o usuário não digitou um número (ou número inválido)
    if (!escolha || escolha < 1 || escolha > 3) {
        const cenarioSorteado = cenarios[Math.floor(Math.random() * cenarios.length)];
        return await sock.sendMessage(sender, { 
            video: { url: 'https://media.tenor.com/jhsMAREYalUAAAPo/pacman-gaming.mp4' }, 
            gifPlayback: true,
            caption: `🎮 *RPG DO BONDE - ${cenarioSorteado.nome}*\n\n${cenarioSorteado.desc}\n\n1. Esquerda\n2. Centro\n3. Direita\n\nDigite !jogar [1, 2 ou 3]`
        }, { quoted: msg });
    }

    // Lógica de resultado
    const caminhoVencedor = Math.floor(Math.random() * 3) + 1;
    
    // Frases zueiras para vitória
    const frasesVitoria = [
        `🏆 BOA! Você escolheu o caminho ${escolha} e encontrou um baú cheio de ouro! Ganhou 150 pontos! 💰`,
        `🎉 MITOU! Você escolheu o ${escolha} e deu de cara com um tesouro escondido. Recebeu 150 pontos! 💎`,
        `😎 O mestre do destino! Você acertou e o bot te deu 150 pontos pela sorte! 🧧`
    ];

    // Frases zueiras para derrota
    const frasesDerrota = [
        `💀 Xiii... deu ruim! Você escolheu o ${escolha} e caiu numa armadilha de urso. O caminho certo era o ${caminhoVencedor}. Tenta não morrer na próxima! 😂`,
        `🤡 Que feio! Você escolheu o ${escolha} e deu de cara com um monstro faminto. O certo era ${caminhoVencedor}. Pobre coitado! 👻`,
        `📉 Deu PT! Você escolheu o ${escolha} e se perdeu todo. O caminho era o ${caminhoVencedor}. Fraco demais! 🤣`
    ];

    if (escolha === caminhoVencedor) {
        // Premiação no placar
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

// ... (mantenha tudo o que vem antes, até o final do !jogar)

// --- COMANDO !PIADA ---
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

// Lógica de validação do piada
if (jogoPiada.ativo && msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoPiada.idMensagem) {
    const respostaUsuario = text.toLowerCase().trim();
    if (respostaUsuario === jogoPiada.resposta) {
        jogoPiada.ativo = false;
        let placar = lerArquivoSeguro(arquivoPlacar);
        placar[participant] = (placar[participant] || 0) + 75; // Premiação piada
        fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
        await sock.sendMessage(sender, { react: { text: '🏆', key: msg.key } });
        await sock.sendMessage(sender, { text: `🎉 BOA! @${participant.split('@')[0]} ganhou 75 pontos! A resposta era: *${jogoPiada.resposta.toUpperCase()}*`, mentions: [participant], quoted: msg });
    } else {
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
}

// ... (Siga o padrão acima para os outros comandos)

if (text.startsWith('!penalti')) {
    // Reação de bola de futebol
    await sock.sendMessage(sender, { react: { text: '⚽', key: msg.key } });

    const args = text.split(' ');
    const escolha = parseInt(args[1]);
    const senderId = msg.key.remoteJid;

    // Carrega o placar atual
    let placar = lerArquivoSeguro(arquivoPlacar);
    if (!placar[senderId]) placar[senderId] = 0;

    // Mensagem inicial com GIF e respondendo a quem chamou
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

        // 3. !BAN
if (text.startsWith('!ban')) {
    if (!isAdmin) {
        await sock.sendMessage(sender, { text: "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?" });
    } else {
        const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const meuIDProtegido = '96057379803159'; // Seu ID de criador/dono

        if (mention && mention.includes(meuIDProtegido)) {
            await sock.sendMessage(sender, { text: "❌ Nem tenta! O criador é intocável! 👑" });
        } else if (mention) {
            // Frases leves e debochadas
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

            // Envia a mensagem de deboche
            await sock.sendMessage(sender, { 
                text: sorteioBan, 
                mentions: [mention] 
            }, { quoted: msg });

            // Executa o banimento após 2 segundos
            setTimeout(async () => { 
                await sock.groupParticipantsUpdate(sender, [mention], 'remove'); 
            }, 2000);
        } else {
            await sock.sendMessage(sender, { text: "❌ Mencione alguém para banir!" }, { quoted: msg });
        }
    }
}

      // --- COMANDO !PESQUISAR (VERSÃO GOOGLE-IT) ---
// --- COMANDO !PESQUISAR (VERSÃO ROBUSTA SEM BIBLIOTECA) ---
// --- COMANDO !PESQUISAR (CORRIGIDO) ---
// --- COMANDO !PESQUISAR (VERSÃO ROBUSTA E CORRIGIDA) ---
if (text.startsWith('!pesquisar ')) {
    const termo = text.replace('!pesquisar ', '').trim();
    if (!termo) return await sock.sendMessage(sender, { text: "❌ O que você quer pesquisar?", quoted: msg });

    // 1. Reação inicial e GIF de carregando
    await sock.sendMessage(sender, { react: { text: '🔍', key: msg.key } });
    const msgCarregando = await sock.sendMessage(sender, { 
        video: { url: 'https://media.tenor.com/IzywMgoVemYAAAPo/cat-busy.mp4' }, // GIF de pesquisa
        gifPlayback: true,
        caption: `🔍 Pesquisando sobre: *${termo.toUpperCase()}*...`
    }, { quoted: msg });

    try {
        // 2. Busca na API do DuckDuckGo
        const res = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(termo)}&format=json&pretty=1&no_redirect=1`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const data = res.data;

        // 3. Montagem da resposta
        let respostaTexto = "";
        if (data.AbstractText && data.AbstractText.length > 0) {
            respostaTexto = `🔍 *RESULTADO: ${termo.toUpperCase()}*\n\n${data.AbstractText}\n\n🔗 *Fonte:* ${data.AbstractURL || 'DuckDuckGo'}`;
        } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            const topo = data.RelatedTopics[0];
            respostaTexto = `🔍 *RESULTADO: ${termo.toUpperCase()}*\n\n${topo.Text}\n\n🔗 *Fonte:* ${topo.FirstURL || 'DuckDuckGo'}`;
        } else {
            respostaTexto = "❌ Não encontrei um resumo detalhado sobre isso.";
        }

        // 4. Ação Final: Deleta o GIF e envia o texto real
        await sock.sendMessage(sender, { delete: msgCarregando.key });
        await sock.sendMessage(sender, { text: respostaTexto }, { quoted: msg });

    } catch (e) {
        console.error("Erro no !pesquisar:", e);
        // Tenta deletar o GIF mesmo se der erro antes de avisar
        await sock.sendMessage(sender, { delete: msgCarregando.key }).catch(() => {});
        await sock.sendMessage(sender, { text: "❌ O buscador deu ruim (erro de conexão). Tente de novo!", quoted: msg });
    }
}
        // 4. !TIER (Versão Debochada e com Resposta)
if (text.startsWith('!tier')) {
    // 1. Reação imediata de quem solicitou
    await sock.sendMessage(sender, { react: { text: '📊', key: msg.key } });

    const tema = text.replace('!tier', '').trim() || "do grupo";
    const metadata = await sock.groupMetadata(sender);
    
    // Sorteia 5 participantes aleatórios
    let ppts = metadata.participants.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    // Frases de efeito engraçadas para o cabeçalho
    const frasesTier = [
        `🏆 *TIER LIST: ${tema.toUpperCase()} (OS ESCOLHIDOS PELO DESTINO)*`,
        `🔥 *TOP 5: OS MAIS ${tema.toUpperCase()} SEGUNDO A CIÊNCIA (CONFIA!)*`,
        `📉 *RANKING DE ${tema.toUpperCase()}: A LISTA QUE NINGUÉM PEDIU, MAS TODO MUNDO QUERIA!*`,
        `👀 *QUEM SÃO OS ${tema.toUpperCase()} DA VEZ? DESCUBRA AGORA:*`
    ];
    
    const titulo = frasesTier[Math.floor(Math.random() * frasesTier.length)];
    let res = `${titulo}\n\n`;

    // Monta o ranking com frases extras
    ppts.forEach((p, i) => {
        const score = Math.floor(Math.random() * 100) + 1;
        let comentario = "";
        
        if (score > 90) comentario = " (Lenda! 😎)";
        else if (score > 70) comentario = " (Respeita o homem/mulher! 🤙)";
        else if (score > 40) comentario = " (Tá na média... eu acho 🤡)";
        else comentario = " (Vixe, passa vergonha não! 💀)";

        res += `${i + 1}. @${p.id.split('@')[0]} - ${score}% ${comentario}\n`;
    });

    // 2. Envio com menções e resposta no balão (quoted)
    await sock.sendMessage(sender, { 
        text: res, 
        mentions: ppts.map(p => p.id) 
    }, { quoted: msg });
}

// 5.2 !MATAR (COM GIF E DEBOCHE)
if (text.startsWith('!matar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mention) {
        const autor = participant.split('@')[0];
        const alvo = mention.split('@')[0];
        
        // Frases de deboche
        const frasesMatar = [
            `O @${autor} mandou o @${alvo} de arrasta pra cima! Que vacilo, hein? 💀`,
            `Vixi... @${autor} não teve piedade e eliminou o @${alvo} do mapa! ⚰️`,
            `O @${autor} decidiu que o @${alvo} não precisava mais respirar o mesmo ar. Que maldade! 🗡️`,
            `@${autor} aplicou o golpe final no @${alvo}. RIP para esse guerreiro! 🪦`,
            `Game Over para o @${alvo}! O @${autor} deu um fim na história dele aqui. 😂`,
            `O @${autor} acabou de fazer uma limpa no @${alvo}. Tá com Deus agora! 👻`
        ];

        const sorteioMatar = frasesMatar[Math.floor(Math.random() * frasesMatar.length)];

        // Link do GIF (mantido conforme pedido)
        const linkGifMatar = "https://media.tenor.com/3gus0SGhiEIAAAPo/cool-beans.mp4";

        await sock.sendMessage(sender, { 
            video: { url: linkGifMatar }, 
            gifPlayback: true,
            caption: sorteioMatar, 
            mentions: [participant, mention] 
        }, { quoted: msg }); // Mantido o quoted: msg para responder no balão
    } else {
        await sock.sendMessage(sender, { text: "❌ Mencione alguém para eliminar!", quoted: msg });
    }
}
// --- COMANDO !LOJA (COMPLETO) ---
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
// --- COMANDO !COMPRAR E GESTÃO (BLOCO UNIFICADO) ---
// --- COMANDO !COMPRAR E GESTÃO (BLOCO UNIFICADO) ---
if (text.startsWith('!comprar') || text.startsWith('!limpar') || text.startsWith('!fixar') || text.startsWith('!status')) {
    
    // LÓGICA DE COMPRA
    // --- COMANDO !COMPRAR E GESTÃO (BLOCO UNIFICADO) ---
if (text.startsWith('!comprar') || text.startsWith('!limpar') || text.startsWith('!fixar') || text.startsWith('!status')) {
    
    // LÓGICA DE COMPRA
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
            
            // --- PROTEÇÃO: VERIFICA SE O ALVO É ADM ---
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
            // --- AJUSTE: VERIFICA SE O USUÁRIO ESTÁ MUTADO ---
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
            console.log("Salvando placar em: " + arquivoPlacar);
            fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));
            await sock.sendMessage(sender, { text: `✅ Compra de *${item.toUpperCase()}* realizada!`, quoted: msg });
        }
    } 
    // LÓGICA DE GESTÃO (ADM DE FACHADA)
    else {
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
// --- !GADO (COM PORCENTAGEM E DEBOCHE) ---
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

    await sock.sendMessage(sender, { 
        text: `🐂 *TESTE DO GADO* 🐂\n\nO @${alvo} é ${porcentagem}% gado! \n${mensagemGado}`, 
        mentions: [mention] 
    }, { quoted: msg });
}

// --- !CORNO (NÍVEL DE CHIFRE) ---
if (text.startsWith('!corno')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para fazer o teste do chifre!", quoted: msg });

    // Reação na mensagem de quem solicitou o comando
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
// --- COMANDO !CARGOS (LISTA DE OPÇÕES E CARGOS ATUAIS) ---
if (text === '!cargos') {
    let cargos = lerArquivoSeguro(arquivoCargos);
    
    // Lista de cargos disponíveis (Baseado na lógica da sua loja)
    const opcoesDisponiveis = [
        "👑 LENDA", 
        "🔥 REI DA ZUEIRA", 
        "🐂 GADO SUPREMO", 
        "🤫 FOFOQUEIRO(A)", 
        "💎 VIP", 
        "🌟 ESTRELA DO BONDE"
    ];

    let texto = "👑 *SISTEMA DE CARGOS DE LUXO* 👑\n\n";
    
    texto += "*--- CARGOS DISPONÍVEIS PARA COMPRA ---*\n";
    opcoesDisponiveis.forEach(c => texto += `• ${c}\n`);
    texto += "\n_Use !comprar_cargo [nome do cargo] para se tornar um de nós!_\n\n";

    // Lista de quem já comprou
    const listaDeCargos = Object.entries(cargos);
    
    if (listaDeCargos.length > 0) {
        texto += "*--- QUEM JÁ OSTENTA UM CARGO ---*\n";
        let listaMentions = [];
        listaDeCargos.forEach(([id, nomeCargo]) => {
            listaMentions.push(id);
            texto += `• @${id.split('@')[0]}: *${nomeCargo}*\n`;
        });
        
        await sock.sendMessage(sender, { 
            text: texto, 
            mentions: listaMentions,
            quoted: msg 
        });
    } else {
        texto += "_Ninguém comprou um cargo ainda. Seja o primeiro!_";
        await sock.sendMessage(sender, { text: texto, quoted: msg });
    }
}
// --- !FOFOCA (BOMBA NO GRUPO) ---
if (text.startsWith('!fofoca')) {
    if (!isGroup) return await sock.sendMessage(sender, { text: "❌ Isso só funciona em grupos, senão não tem graça!", quoted: msg });

    // 1. Reação de segredo
    await sock.sendMessage(sender, { react: { text: '🤫', key: msg.key } });

    try {
        const metadata = await sock.groupMetadata(sender);
        const ppts = metadata.participants;
        
        // Sorteia duas pessoas diferentes
        const alvo1 = ppts[Math.floor(Math.random() * ppts.length)];
        const alvo2 = ppts[Math.floor(Math.random() * ppts.length)];

        // Garante que não sorteie a mesma pessoa
        if (alvo1.id === alvo2.id) {
            return await sock.sendMessage(sender, { text: "❌ O @${alvo1.id.split('@')[0]} estava querendo fofocar sozinho, mas não deu certo. Tente de novo! 😂", mentions: [alvo1.id], quoted: msg });
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

// --- !ROUBAR (ASSALTO A PONTOS) ---
// --- COMANDO !ROUBAR (AJUSTADO COM ESCUDO) ---
if (text.startsWith('!roubar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    
    // 1. Validações básicas
    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione quem você quer assaltar!", quoted: msg });
    if (mention === participant) return await sock.sendMessage(sender, { text: "❌ Você não pode roubar a si mesmo, seu gênio! 😂", quoted: msg });

    // 2. Sistema de Cooldown (3 horas = 10.800.000 milissegundos)
    const agora = Date.now();
    const tempoCooldown = 3 * 60 * 60 * 1000; 
    if (cooldownRoubo[participant] && (agora - cooldownRoubo[participant]) < tempoCooldown) {
        const tempoRestante = Math.ceil((tempoCooldown - (agora - cooldownRoubo[participant])) / (60 * 1000));
        return await sock.sendMessage(sender, { text: `⏳ *CALMA LÁ, LADRÃO!* Você está sendo procurado pela polícia. Tente novamente daqui a ${tempoRestante} minutos.`, quoted: msg });
    }

    // 3. Verificação de ESCUDO
    if (typeof escudosAtivos !== 'undefined' && escudosAtivos[mention]) {
        return await sock.sendMessage(sender, { text: `🛡️ *ASSALTO FRUSTRADO!* O @${mention.split('@')[0]} está protegido por um ESCUDO!`, mentions: [mention], quoted: msg });
    }

    // 4. Carrega e prepara o placar
    let placar = {};
    try {
        if (fs.existsSync(arquivoPlacar)) {
            placar = JSON.parse(fs.readFileSync(arquivoPlacar, 'utf8'));
        }
    } catch (e) { placar = {}; }

    if (!placar[participant]) placar[participant] = 0;
    if (!placar[mention]) placar[mention] = 0;

    // 5. Execução do Assalto
    const sucesso = Math.random() < 0.5;
    cooldownRoubo[participant] = agora; // Define o tempo do último roubo

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

        // 1. !RANK (ORGANIZADO E DEBOCHADO)
if (text === '!rank') {
    let cargos = lerArquivoSeguro(arquivoCargos);

    const ranking = Object.entries(contagemMensagens)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    let res = "🏆 *RANKING DE QUEM VIVE NO ZAP*\n\n";
    let listaMentions = []; // Lista que vai carregar os IDs para o WhatsApp mencionar

    ranking.forEach((entry, index) => {
        const [id, count] = entry;
        listaMentions.push(id); // Adiciona o ID completo na lista de menções
        
        // Aqui usamos o @ + o ID cortado. O WhatsApp vai buscar o nome pelo ID na lista de mentions.
        let cargoDisplay = cargos[id] ? `💎 *${cargos[id].toUpperCase()}*` : "👤 *Membro*";
        res += `${index + 1}. @${id.split('@')[0]} | ${cargoDisplay} | ${count} msg\n`;
    });

    res += "\n━━━━━━━━━━━━━━━━━━\n\n👑 *HIERARQUIA DE PODER (ELITE):*\n";
    
    const cargosExistentes = ["Lenda", "Rei da Zueira", "Gado Supremo", "Fofoqueiro(a)"];
    const icones = { "Lenda": "👑", "Rei da Zueira": "🔥", "Gado Supremo": "🐂", "Fofoqueiro(a)": "🤫" };

    cargosExistentes.forEach(cargo => {
        const membros = Object.entries(cargos)
            .filter(([id, nomeCargo]) => nomeCargo === cargo)
            .map(([id]) => {
                listaMentions.push(id); // Adiciona também na lista de menções da hierarquia
                return `@${id.split('@')[0]}`;
            });
        
        if (membros.length > 0) {
            res += `${icones[cargo] || "⭐"} *${cargo.toUpperCase()}*: ${membros.join(', ')}\n`;
        }
    });

    res += "\n🤖 *Dica: Seja ativo e compre seu cargo!*";

    await sock.sendMessage(sender, { 
        text: res, 
        mentions: listaMentions // A mágica acontece aqui: passando a lista de IDs, ele vira @Nome
    }, { quoted: msg });
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


if (text.startsWith('!descasar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione quem você quer largar, seu indeciso!", quoted: msg });

    const p1 = participant; // ID completo
    const p2 = mention;     // ID completo

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
    await sock.sendMessage(sender, { 
        text: frasesDivorcio[Math.floor(Math.random() * frasesDivorcio.length)], 
        mentions: [p1, p2], 
        quoted: msg 
    });
}

if (text.startsWith('!casar')) {
    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione alguém para casar, senão vai ficar encalhado!", quoted: msg });

    // 1. FORÇA A LEITURA DO DISCO (Atualiza a variável global antes de checar)
    listaCasais = lerArquivoSeguro(arquivoCasais);

    const p1 = participant; // ID completo de quem chamou
    const p2 = mention;     // ID completo do mencionado

    // 2. TRAVA DE BIGAMIA: Ninguém casa se já estiver casado com outra pessoa
    const jaTemRelacionamento = listaCasais.find(c => c.p1 === p1 || c.p2 === p1 || c.p1 === p2 || c.p2 === p2);
    if (jaTemRelacionamento) {
        return await sock.sendMessage(sender, { 
            text: "🚫 CRIME DE BIGAMIA! Um de vocês já está comprometido. Divorcie-se primeiro, seu safado! 😂", 
            quoted: msg 
        });
    }

    // 3. Adiciona o novo casal na memória
    listaCasais.push({ p1, p2 }); 

    // 4. SALVAMENTO FORÇADO NO DISCO (Garante que vai para o /var/data/casais.json)
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
    // 1. Carregamento forçado e seguro do disco para a variável global
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

    // 2. Verificação se a lista está vazia
    if (!listaCasais || listaCasais.length === 0) {
        return await sock.sendMessage(sender, { text: "❌ Ninguém casou ainda! Estão todos encalhados.", quoted: msg });
    }

    // 3. Montagem do texto zueiro
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

    // 4. Loop para listar os casais
    listaCasais.forEach((c, i) => {
        // Formatação do número para exibir
        const id1 = c.p1.split('@')[0];
        const id2 = c.p2.split('@')[0];
        
        texto += `${i + 1}. @${id1} ❤️ @${id2}\n`;
        
        // Adiciona os IDs completos (ex: 552199999999@s.whatsapp.net) para a menção funcionar
        listaMentions.push(c.p1);
        listaMentions.push(c.p2);
    });
    
    texto += "\n🤡 Quem será o próximo trouxa a cair na armadilha? Digite !casar @alguém";

    // 5. Envio da mensagem com reações e menções
    await sock.sendMessage(sender, { react: { text: '💍', key: msg.key } });
    await sock.sendMessage(sender, { 
        text: texto, 
        mentions: listaMentions,
        quoted: msg 
    });
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

       if (text === '!backup') {
    console.log("Comando !backup recebido!");
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

// 2. COMANDO !BOSS (INVOCAR MONSTRO)
// --- COMANDO !BOSS (COMPLETÃO E DEBOCHADO) ---
if (text === '!boss') {
    if (raidBoss.ativo) {
        const frasesDeboche = [
            "⚠️ O chefe já tá na área, seu cego! Quer que eu chame dois pra você perder mais rápido? 😂",
            "😤 Já tem um monstro destruindo tudo! Pega sua espada e ataca o que já tá aqui, preguiçoso!",
            "🚫 Tá achando que é festa? Só pode um monstro por vez! Ataca o atual logo! 🗡️",
            "🤡 Dois chefes ao mesmo tempo? Nem em anime ruim acontece isso! Ataca o que tá aí!"
        ];
        return await sock.sendMessage(sender, { 
            text: frasesDeboche[Math.floor(Math.random() * frasesDeboche.length)], 
            quoted: msg 
        });
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

// 3. COMANDO !ATACAR (O CORAÇÃO DO JOGO)
if (text === '!atacar') {
    if (!raidBoss.ativo) return await sock.sendMessage(sender, { text: "❌ Não tem monstro aqui. Tá batendo no vento?" });
    
    // --- LÓGICA DA FÚRIA ---
    let dano = Math.floor(Math.random() * 50) + 10;
    let mensagemFuria = "";

    if (ataquesFuria[participant]) {
        dano *= 2; // Dobra o dano
        mensagemFuria = "\n🔥 *DANO CRÍTICO DE FÚRIA!*";
        delete ataquesFuria[participant]; // Remove a fúria após o uso
    }
    // -----------------------

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
// AVISO ADM (ESTILO EMERGÊNCIA DRAMÁTICA)
if (text === '!avisoadm') { 
    if (!msg.key.remoteJid.endsWith('@g.us')) {
        return await sock.sendMessage(sender, { text: 'Este comando só funciona em grupos!', quoted: msg });
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
            return await sock.sendMessage(sender, { text: '❌ Sai pra lá, apenas administradores podem usar este comando.', quoted: msg });
        }

        // 3. Prossegue com a busca dos ADMs para notificar
        const admins = participantes.filter(p => p.admin !== null).map(p => p.id);

        if (admins.length === 0) {
            return await sock.sendMessage(sender, { text: 'Não encontrei administradores neste grupo.', quoted: msg });
        }

        // Frases de pânico para o aviso
        const frasesAlerta = [
            `🚨 *ALERTA VERMELHO!* 🚨\n\nOs ADMs foram convocados para uma reunião de emergência! O circo está pegando fogo! 🔥`,
            `📢 *CHAMADA GERAL DE ADMS!* 📢\n\nLarguem o que estão fazendo! O grupo precisa de vocês antes que a casa caia! 🏃‍♂️`,
            `⚠️ *STATUS: CAOS!* ⚠️\n\nPrecisamos de uma verificação urgente dos nossos ADMs. Cadê vocês, seus lindos? 🧐`,
            `🔥 *REUNIÃO DE CÚPULA!* 🔥\n\nOs ADMs foram convocados para resolver mais uma encrenca. O show não pode parar! 🎭`,
            `📢 *ALERTA DE SEGURANÇA!* 📢\n\nADM, atenda ao chamado! A zueira está fora de controle! 😂`
        ];

        const sorteioAlerta = frasesAlerta[Math.floor(Math.random() * frasesAlerta.length)];
        const mençãoAdm = `${sorteioAlerta} \n\n${admins.map(adm => `@${adm.split('@')[0]}`).join(' ')}`;

        await sock.sendMessage(sender, { 
            text: mençãoAdm, 
            mentions: admins 
        }, { quoted: msg });

    } catch (error) {
        console.error('Erro ao chamar ADMs:', error);
        await sock.sendMessage(sender, { text: '❌ O sistema de alarme falhou... os ADMs estão soltos!', quoted: msg });
    }
}
// --- COMANDO !MUSICA (JOGO DE COMPLETAR A LETRA - COMPLETO) ---
// --- COMANDO !MUSICA (JOGO DE COMPLETAR A LETRA - NÍVEL MESTRE) ---
if (text === '!musica') {
    const desafios = [
        // Clássicos Difíceis
        { frase: "Numa folha qualquer eu desenho um sol amarelo, e com cinco ou seis retas é fácil fazer um...", resposta: "castelo" },
        { frase: "Pela luz dos olhos teus, o que se vê, não é exatamente o que se vê, o que a gente vê, não é exatamente o que a gente...", resposta: "vê" },
        { frase: "Eu não sou daqui, marinheiro só, eu não tenho amor, marinheiro...", resposta: "só" },
        { frase: "Onde o rio encontra o mar, onde o sol encontra o luar, onde a gente se...", resposta: "encontra" },
        { frase: "Vou deixar a vida me levar, vida leva eu, sou feliz e agradeço por tudo que...", resposta: "deus me deu" },
        { frase: "Construção: Amou daquela vez como se fosse a última, beijou sua mulher como se fosse a...", resposta: "única" },
        { frase: "Apenas um rapaz latino-americano sem dinheiro no bolso, sem parentes importantes e vindo do...", resposta: "interior" },
        { frase: "O que é, o que é? É a vida, é bonita e é...", resposta: "bonita" },
        { frase: "E no meio de tanta gente, eu encontrei você, e no meio de tanta gente, você me...", resposta: "escolheu" },
        { frase: "Se você fosse um peixinho e soubesse nadar, eu tirava o nome do meu amor do fundo do...", resposta: "mar" },
        { frase: "Eu quero ver você não chorar, não olhar pra trás, nem se arrepender do que...", resposta: "fez" },
        { frase: "Alguma coisa acontece no meu coração, que só quando cruza a Ipiranga e a...", resposta: "avenida são joão" },
        { frase: "O tempo não para, eu vejo o futuro repetir o...", resposta: "passado" },
        { frase: "Na bruma leve das paixões que vêm de dentro, tu vens, tu vens, eu já escuto os teus...", resposta: "sinais" },
        // Nível Pesado / Raiz
        { frase: "Águas de março: É a vara, é o buraco, é o terreno, é o...", resposta: "lodo" },
        { frase: "Aquarela: Numa folha qualquer eu desenho um sol amarelo, e com cinco ou seis retas é fácil fazer um...", resposta: "castelo" },
        { frase: "Ouro de tolo: Eu devia estar contente porque eu tenho um emprego, sou um dito cidadão com...", resposta: "direito" },
        { frase: "Metamorfose Ambulante: Eu prefiro ser essa metamorfose ambulante do que ter aquela velha opinião formada sobre...", resposta: "tudo" },
        { frase: "Como nossos pais: Você diz que depois deles não apareceu mais ninguém, e você vive do que...", resposta: "já aconteceu" },
        { frase: "Faroeste Caboclo: João de Santo Cristo era o seu nome, não tinha medo do perigo, ele era...", resposta: "lugar-tenente" },
        { frase: "Cálice: Pai, afasta de mim esse...", resposta: "cálice" },
        { frase: "O Bêbado e a Equilibrista: Chora a nossa pátria mãe gentil, choram Marias e...", resposta: "Clarisses" }
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

// Lógica de validação (dentro do seu loop de mensagens)
if (jogoEmoji.ativo && msg.message?.extendedTextMessage?.contextInfo?.stanzaId === jogoEmoji.idMensagem) {
    const respostaUsuario = text.toLowerCase().trim();
    
    if (respostaUsuario === jogoEmoji.resposta) {
        jogoEmoji.ativo = false;
        
        let placar = lerArquivoSeguro(arquivoPlacar);
        placar[participant] = (placar[participant] || 0) + 50;
        fs.writeFileSync(arquivoPlacar, JSON.stringify(placar, null, 2));

        await sock.sendMessage(sender, { react: { text: '🔥', key: msg.key } });
        await sock.sendMessage(sender, { 
            text: `🔥 *BRABO!* @${participant.split('@')[0]} é cultura pura! Ganhou 50 pontos!`, 
            mentions: [participant], 
            quoted: msg 
        });
    } else {
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(sender, { 
            text: `❌ Errou! @${participant.split('@')[0]} tá precisando ouvir mais rádio, hein? 😂`, 
            mentions: [participant],
            quoted: msg 
        });
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

if (text.startsWith('!mute')) {
    // 1. Verifica se quem mandou o comando é ADM
    if (!isAdmin) {
        const frasesAdm = [
            "Tentando furar as regras, né?? HAHAHHAHA 👀👀👀\n\nSabe que um ADM está de olho em você agora né?",
            "Tá achando que é dono do pedaço? Acesso negado, amigão! 🚫",
            "Negativo! Só ADM manda aqui, volta pra sua cadeira! 😂",
            "Quer mutar alguém? Primeiro vira ADM, depois a gente conversa! 🤡"
        ];
        return await sock.sendMessage(sender, { 
            text: frasesAdm[Math.floor(Math.random() * frasesAdm.length)], 
            quoted: msg 
        });
    }

    const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mention) return await sock.sendMessage(sender, { text: "❌ Mencione o alvo do seu silenciamento, ô lerdo!", quoted: msg });
    // 2. Proteção do seu ID (O dono/criador é intocável)
    const MEU_ID_REAL = "96057379803159@lid"; 
    const meuNumero = "5527992997083";

    if (mention === MEU_ID_REAL || (mention && String(mention).includes(meuNumero))) {
        const frasesTraicao = [
            "❌ Nem tenta! O criador é intocável e ninguém muta o patrão! 👑",
            "⚠️ Opa! Traição? O dono do sistema não pode ser mutado, seu infiel! 🚩",
            "🤡 Engraçadinho... quer mutar o criador? Vai ser banido se tentar de novo! 💀",
            "🤣 Tentativa frustrada! O criador tem imunidade diplomática! 🥂"
        ];
        return await sock.sendMessage(sender, { 
            text: frasesTraicao[Math.floor(Math.random() * frasesTraicao.length)], 
            quoted: msg 
        });
    }

    // 3. Aplica o Mute
    const tempo = text.includes('h') ? 3600000 : 1800000;
    mutados[mention] = Date.now() + tempo;
    fs.writeFileSync(ARQUIVO_MUTADOS, JSON.stringify(mutados));
    
    await sock.sendMessage(sender, { 
        text: "Você está falando demais, dá um tempo seu rabugento.😂❌", 
        mentions: [mention] 
    }, { quoted: msg });
}

// --- COMANDO !CLIMA (AJUSTADO E LIMPO) ---
if (text.startsWith('!clima')) {
    const cidade = text.replace('!clima', '').trim();
    if (!cidade) return await sock.sendMessage(sender, { text: "❌ Digite a cidade! Ex: !clima Cariacica", quoted: msg });

    const mensagemParaResponder = msg;

    const piadasClima = {
        'sunny': [
            "Tá um sol que parece que o inferno abriu uma filial aqui! 🔥",
            "Céu azul... ótimo dia para ficar mofando dentro de casa no computador. ☀️",
            "Solzão de rachar mamona! Se você sair na rua, vai virar churrasco. 🥩",
            "Tá mais quente que o banho que você nem tomou hoje. 🥵"
        ],
        'cloudy': [
            "Tempo nublado... bem deprimido, igual ao seu histórico de pesquisas. ☁️",
            "Céu cinza... o clima perfeito para dormir até o ano que vem. 💤",
            "Tá nublado, mas a feiura continua a mesma. 🤡",
            "Parece que vai chover... ou não. Minha previsão é tão inútil quanto você. 🌩️"
        ],
        'rain': [
            "Chovendo? Ótimo, desculpa perfeita para não fazer nada o dia todo! 🌧️",
            "Tempo de chuva... cuidado para não derreter, você é feito de açúcar? 🍭",
            "Tá caindo o mundo lá fora e você aí preocupado com o clima? Vai arrumar um emprego! 💼",
            "Chuva, café e tédio. O combo completo da vida adulta. ☕"
        ]
    };

    weather.find({ search: cidade, degreeType: 'C' }, async (err, result) => {
        if (err || !result || result.length === 0) {
            return await sock.sendMessage(sender, { text: "❌ Cidade não encontrada. Tente colocar o Estado junto, ex: !clima Cariacica, ES", quoted: mensagemParaResponder });
        }
        
        const current = result[0].current;
        const condicaoOriginal = current.skytext.toLowerCase();
        
        let categoria = 'cloudy';
        if (condicaoOriginal.includes('sunny') || condicaoOriginal.includes('clear')) categoria = 'sunny';
        else if (condicaoOriginal.includes('rain') || condicaoOriginal.includes('storm')) categoria = 'rain';

        const fraseExtra = piadasClima[categoria][Math.floor(Math.random() * piadasClima[categoria].length)];

        const msgClima = `🌤 *Tempo em: ${current.observationpoint}*\n` +
                         `🌡 Temperatura: ${current.temperature}°C\n` +
                         `☁️ Condição: ${current.skytext}\n\n` +
                         `💬 *Bot:* ${fraseExtra}`;
        
        await sock.sendMessage(sender, { react: { text: '🌤', key: mensagemParaResponder.key } });
        await sock.sendMessage(sender, { text: msgClima }, { quoted: mensagemParaResponder });
    }); 
} 

// --- FECHAMENTO DO BOT ---
}); 
}

connectToWhatsApp();
