import express from 'express';
import { Server } from "socket.io";
import http from 'http';
import OpenAI from "openai";
import dotenv from 'dotenv'

dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;
const CORS_HOST = process.env.HOST;

const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: CORS_HOST
  }
});

const adminImgURL = '/img/admin_avatar.avif';
const userImgURL = '/img/user_avatar.avif';

const PORT = 4000; /* process.env.PORT || 4000; */
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`listening on *:${PORT}`);
});

const connections = [];
let rooms = [];
let adminsList = [];

function getUserBySocketIssued(issued) {
  return connections.find(c => c.handshake.issued === Number(issued)) || null;
}

function sendRoomsToAdmins() {
  adminsList.forEach((adminId) => {
    getUserBySocketIssued(adminId).emit('server:rooms', rooms);
  });
}

async function createRoom(socket) {
  const { sendMessage, listenAIAnswers } = await createAIChat();



  const room = {
    id: (socket.handshake.issued).toString(),
    members: [socket.handshake.issued.toString()],
    messages: [],
    sendMessageToAI: sendMessage,
  };

  function sendMessageToRoom(room) {
    return (messagesList) => {
      messagesList.forEach(message => {
        if (!room.messages.some(m => m.body === message.body)) {
          room.messages.push(message);
          io.to(room.id).emit('server:msg', message)
        }
      });

    };
  }

  listenAIAnswers(sendMessageToRoom(room));

  if (rooms.every(r => r.id !== room.id)) {
    rooms.push(room);
  }
  socket.join(room.id);

  sendRoomsToAdmins();

  return room;
}

async function createHelpRoom(socket) {
  const room = await createRoom(socket);
  const responce = {
    roomId: room.id,
    authorId: 0,
    authorName: 'ADMIN',
    avatarURL: '/img/admin_avatar.avif',
    body: 'Hello! AI helper here to assist you. Write Your question below.',
  };

  io.to(room.id).emit('server:msg', responce);
  console.log('room created:', room.id);

  return room;
}

io.sockets.on('connection', (socket) => {
  console.log('a user connected');
  connections.push(socket);

  socket.on('disconnect', () => {
    console.log('user disconnected now');
    rooms = rooms.filter(r => r.id !== String(socket.handshake.issued));
    sendRoomsToAdmins();

    if (adminsList.includes(String(socket.handshake.issued))) {
      adminsList = adminsList.filter(a => a !== String(socket.handshake.issued));
    }
  });

  socket.on('user:msg', async (message) => {
    const socketIssue = String(socket.handshake.issued);
    const room = rooms.find((r) => r.id === socketIssue);

    if (room) {
      console.log('in room: ' + room.id);
      console.log(`Received message: ${message.body}`);
      const message1 = {
        roomId: room.id,
        avatarURL: message.avatarURL,
        authorId: message.authorId,
        authorName: message.authorName,
        body: message.body,
      };
      room.sendMessageToAI(message.body);
    } else {
      const room = await createHelpRoom(socket);
      const message1 = {
        roomId: room.id,
        avatarURL: message.avatarURL,
        authorId: message.authorId,
        authorName: message.authorName,
        body: message.body,
      };
      room.sendMessageToAI(message.body);
    }

  });

  socket.on('user:needHelp', async (data) => {
    console.log(`User need help.`);
    createHelpRoom(socket);
  });

  socket.on('admin:rooms', () => {
    const socketIssue = String(socket.handshake.issued);
    adminsList.push(socketIssue);
    console.log('admin:rooms');
    socket.emit('server:rooms', rooms);
  });

  socket.on('admin:joinRoom', (data) => {
    const socketIssue = String(socket.handshake.issued);
    const room = rooms.find((r) => r.id === data.id);
    const members = room.members;
    const isMember = members.some(m => m === socketIssue);

    if (!isMember) {
      members.push(socketIssue);
      room.members = members;
      socket.join(room.id);
      const responce = {
        roomId: room.id,
        authorId: 0,
        authorName: 'Pavlo',
        avatarURL: '/img/admin_avatar.avif',
        body: 'Support team member joined the chat.',
      };
      io.to(room.id).emit('server:msg', responce);
      sendRoomsToAdmins();
      console.log('admin:joinRoom', data);
    }
  });

  socket.on('admin:msg', (message) => {
    const room = rooms.find((r) => r.id === message.roomId);
    console.log('in room: ' + room.id);

    console.log(`Received message: ${message.body}`);
    const message1 = {
      roomId: room.id,
      avatarURL: message.avatarURL,
      authorId: message.authorId,
      authorName: message.authorName,
      body: message.body,
    };
    room.messages.push(message);
    io.in(room.id).emit('server:msg', message1);
  });
});


const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

async function createAIChat() {
  const assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
  const thread = await openai.beta.threads.create();

  async function sendMessage(text) {
    if (assistant && thread) {
      const message = await openai.beta.threads.messages.create(
        thread.id,
        {
          role: 'user',
          content: text,
        },
      );
      const run = await openai.beta.threads.runs.create(
        thread.id,
        {
          assistant_id: assistant.id,
        },
      );
    }
  }
  function listenAIAnswers(sendAIAnswer) {
    const listener = setInterval(async () => {
      if (assistant && thread) {
        try {
          const messagesArray = await openai.beta.threads.messages.list(
            thread.id,
          );
          const newMessages = messagesArray.data.map(msg => {
            if ('text' in msg.content[0]) {
              return {
                authorId: msg.role === 'assistant' ? 1 : 2,
                role: msg.role,
                authorName: 'Alice',
                body: msg.content[0].text.value,
                avatarURL: msg.role === 'assistant' ? adminImgURL : userImgURL,
              };
            }
            return null;
          });
          sendAIAnswer(newMessages.filter(m => m.role === 'assistant'));
        } catch (error) {
          console.log(`Error: ${error}`);
        }
      }
    }, 2000);
  }

  return {
    sendMessage,
    listenAIAnswers,
  };
}
