const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let qrCodeData = "";

async function iniciarBot() {
    // O Railway sempre reinicia, então usamos a pasta auth_info que ele preserva
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Chrome (Windows)', 'Chrome', '126.0.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) qrCodeData = qr; 

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) iniciarBot();
        } else if (connection === 'open') {
            console.log('✅ BOT CONECTADO COM SUCESSO!');
            qrCodeData = ""; 
        }
    });

    // PAREAMENTO POR CÓDIGO (Mais estável no Railway)
    if (!sock.authState.creds.me) {
        console.log("Aguardando 10 segundos para gerar o código...");
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode("5527988792916");
                console.log('================================================');
                console.log('COPIE ESTE CÓDIGO: ' + code);
                console.log('================================================');
            } catch (err) {
                console.error("Erro ao gerar código de pareamento:", err);
            }
        }, 10000);
    }
}

app.get('/', (req, res) => {
    res.send("<h1>Bot Online! Olhe o log no Railway para o código de pareamento.</h1>");
});

app.listen(port, () => console.log(`Servidor Web rodando na porta ${port}`));
iniciarBot();