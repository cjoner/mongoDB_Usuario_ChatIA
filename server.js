//-------------------CONEXAO MONGODB-------------------------//

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Chat = require('./models/Chat');

const app = express();
app.use(express.json()); // Para lidar com dados JSON no corpo das requisições

// Conectando ao MongoDB

mongoose.connect('mongodb+srv://clarachjoner2007:alex156600@chat-chef-ia.ficqopw.mongodb.net/db_chatChef?retryWrites=true&w=majority&appName=Chat-chef-ia', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Conectado ao MongoDB'))
.catch(err => console.error('Erro ao conectar ao MongoDB', err));


// Definindo o schema do histórico
const historicoSchema = new mongoose.Schema({
    userId: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const Historico = mongoose.model('Historico', historicoSchema);
// Definindo o schema para logs de IP e data
const logSchema = new mongoose.Schema({
    userId: String,
    ip: String,
    timestamp: { type: Date, default: Date.now }
});

const Log = mongoose.model('Log', logSchema);

// Endpoint para registrar o histórico
app.post('/api/db_chatChef_historico', async (req, res) => {
    const { userId, message } = req.body;
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log('User IP:', userIp); // Adicione isso para verificar o IP

    try {
        // Salvar o histórico de mensagens
        const novoHistorico = new Historico({ userId, message });
        await novoHistorico.save();

        // Salvar o log de IP e data
        const novoLog = new Log({ userId, ip: userIp });
        await novoLog.save();

        res.status(201).send('Histórico e log salvos com sucesso');
    } catch (error) {
        console.error('Erro ao salvar histórico e log:', error);
        res.status(500).send('Erro ao salvar histórico e log');
    }
});


//--------------------CHAT IA---------------------//

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuração da IA do Google
const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: 'chef de cozinha que dá dicas e responde perguntas de donas de casa, leve em conta a renda dos usuários e recomende restaurantes',
});

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 8192,
    responseMimeType: 'text/plain',
};

// Rota para processar a mensagem do usuário e obter a resposta da IA
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        console.log('Received message from user:', userMessage);

        // Iniciar uma nova sessão de chat
        const chatSession = model.startChat({
            generationConfig,
            history: [],
        });

        const result = await chatSession.sendMessage(userMessage);
        const aiResponse = result.response.text();
        console.log('AI response:', aiResponse);

        // Salvar o histórico de chat no banco de dados
        const chat = new Chat({ userMessage, aiResponse });
        await chat.save();

        res.json({ response: aiResponse });
    } catch (error) {
        console.error('Error processing chat:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint para registrar o histórico
app.post('/api/historico', async (req, res) => {
    const { userId, message } = req.body;

    try {
        const novoHistorico = new Historico({ userId, message });
        await novoHistorico.save();
        res.status(201).send('Histórico salvo com sucesso');
    } catch (error) {
        res.status(500).send('Erro ao salvar histórico');
    }
});

// Rota básica para o caminho root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
