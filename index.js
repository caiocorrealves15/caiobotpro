console.log("--- TESTE DE INÍCIO ---");
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
console.log("Bibliotecas carregadas!");
const pino = require('pino');

async function iniciarBot() {
    console.log("Entrando na função...");
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info');
        console.log("Estado de autenticação criado!");
        
        const sock = makeWASocket({
    logger: pino({ level: 'debug' }),
    auth: state,
    printQRTerminal: true,
    browser: ['Chrome (Windows)', 'Chrome', '126.0.0.0'],
    connectTimeoutMs: 60000, // Aumenta o tempo de espera para 60 segundos
    defaultQueryTimeoutMs: 60000
});

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', (update) => {
            console.log("Atualização de conexão:", update);
            if (update.connection === 'open') console.log('CONECTADO COM SUCESSO!');
        });
        console.log("Socket configurado!");
    } catch (err) {
        console.log("ERRO FATAL:", err);
    }
}

iniciarBot();