const fs = require('fs');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Lógica para carregar a sessão do Railway via variável de ambiente
if (process.env.SESSION_BASE64) {
    console.log("Detectado SESSION_BASE64, descompactando sessão...");
    fs.writeFileSync('sessao.tar.base64', process.env.SESSION_BASE64);
    require('child_process').execSync('base64 -d sessao.tar.base64 > sessao.tar && tar -xvf sessao.tar');
    console.log("Sessão restaurada com sucesso!");
}

let qrCodeData = "";

async function iniciarBot() {
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
            console.log('CONECTADO COM SUCESSO!');
            qrCodeData = ""; 
        }
    });

    if (!sock.authState.creds.me) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode("5527988792916");
                console.log('Código de pareamento gerado: ' + code);
            } catch (err) {
                console.error("Erro no pareamento:", err);
            }
        }, 10000);
    }
}

app.get('/', (req, res) => {
    if (qrCodeData) {
        res.send(`
            <center>
                <h1>Escaneie o QR Code abaixo com seu WhatsApp</h1>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCodeData)}"/>
            </center>
        `);
    } else {
        res.send("<h1>Bot Conectado ou aguardando gerar QR...</h1>");
    }
});

app.listen(port, () => console.log(`Servidor Web rodando na porta ${port}`));
iniciarBot();