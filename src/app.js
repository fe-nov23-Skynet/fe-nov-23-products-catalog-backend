import  express  from 'express';
import { Server } from "socket.io";
import http from 'http';
import OpenAI from "openai";


const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000"
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
      if (!room.messages.some(m => m.body === message.body)){
        room.messages.push(message);
        io.to(room.id).emit('server:msg', message)
      }
    });

  };
  }

  listenAIAnswers(sendMessageToRoom(room));

  if (rooms.every(r => r.id !== room.id) ) {
    rooms.push(room);
  }
  socket.join(room.id);

  sendRoomsToAdmins();

  return room;
}

io.sockets.on('connection', (socket) => {
  console.log('a user connected');
  connections.push(socket);

  socket.on('disconnect', () => {
    console.log('user disconnected now');
    rooms = rooms.filter(r => r.id !== String(socket.handshake.issued));
    sendRoomsToAdmins();

    if (adminsList.includes(String(socket.handshake.issued)) ) {
      adminsList = adminsList.filter(a => a !== String(socket.handshake.issued));
    }
  });

  socket.on('user:msg', (message) => {
    const socketIssue = String(socket.handshake.issued);
    const room = rooms.find((r) => r.id === socketIssue);
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
    /* room.messages.push(message);
    io.in(room.id).emit('server:msg', message1); */
  });

  socket.on('user:needHelp', async (data) => {
    console.log(`User need help.`);

    const room = await createRoom(socket);
    const responce = {
      roomId: room.id,
      authorId: 0,
      authorName: 'ADMIN',
      avatarURL: '/img/admin_avatar.avif',
      body: 'Hello! AI helper will help you soon. Please wait.',
    };
    io.to(room.id).emit('server:msg', responce);
    console.log('room created:', room.id);
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
  apiKey: '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',
});

async function createAIChat() {
  const assistant = await openai.beta.assistants.retrieve('asst_gc3HWkC5sYga6z1FOjzzjeT8');
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
        const messagesArray = await openai.beta.threads.messages.list(
          thread.id,
        );
        const newMessages = messagesArray.data.map(msg => {
          if ('text' in msg.content[0]) {
            return {
              authorId: msg.role === 'assistant' ? 1 : 2,
              authorName: 'Alice',
              body: msg.content[0].text.value,
              avatarURL: msg.role === 'assistant' ? adminImgURL : userImgURL,
            };
          }
          return null;
        });
        sendAIAnswer(newMessages);
      }
    }, 2000);
  }

  return {
    sendMessage,
    listenAIAnswers,
  };
}


// chatGPT
/*   useEffect(() => {
    const fetchData = async () => {
      const assistant1 = await openai.beta.assistants.retrieve('asst_gc3HWkC5sYga6z1FOjzzjeT8');
      setAssistant(assistant1);
      const thread1 = await openai.beta.threads.create();
      setThread(thread1);
    };

    fetchData();
  }, []);

  async function sendMessage() {
    setMessageText('');

    if (assistant && thread) {
      const message = await openai.beta.threads.messages.create(
        thread.id,
        {
          role: 'user',
          content: messageText,
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

  useEffect(() => {
    setInterval(async () => {
      if (assistant && thread) {
        const messages3 = await openai.beta.threads.messages.list(
          thread.id,
        );
        console.log(messages3);
        const newMessages = messages3.data.map(msg => {
          if ('text' in msg.content[0]) {
            return {
              authorId: msg.role === 'assistant' ? 1 : 2,
              authorName: 'Alice',
              body: msg.content[0].text.value,
              avatarURL: msg.role === 'assistant' ? adminImgURL : userImgURL,
            };
          }
          return null;
        });
        setMessages(newMessages.filter(Boolean).reverse() as Message[]);
      }
    }, 2000);
  }, [assistant, thread]); */





/* const openai = new OpenAI({
  apiKey: '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',
});

async function testAI() {
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: "Say this is a test" }],
    model: "gpt-3.5-turbo",
  });

  console.log(chatCompletion.choices[0].message);

}

testAI(); */

/* const PORThttp = 4001;
const PORTio = 4000; */

/* server.listen(PORThttp, () => {
  console.log(`listening on *:${PORThttp}`);
});
 */

/* const io = new Server({
  cors: {
    origin: "http://localhost:3000"
  }
});
  io.listen(PORTio);
*/