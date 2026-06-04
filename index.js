const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ['Chrome (Windows)', 'Chrome', '126.0.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) iniciarBot();
        } else if (connection === 'open') {
            console.log('CONECTADO COM SUCESSO!');
        }
    });

    // A lógica de pareamento deve rodar assim que o socket for criado, 
    // mas só se não estivermos logados.
    if (!sock.authState.creds.me) {
        // Aguarda um pouquinho para garantir que o socket inicializou
        setTimeout(async () => {
            const code = await sock.requestPairingCode("5527988792916"); // COLOQUE SEU NÚMERO AQUI
            console.log('--------------------------------------------------');
            console.log('Seu código de pareamento é: ' + code);
            console.log('--------------------------------------------------');
        }, 3000); // Espera 3 segundos
    }
}

iniciarBot();