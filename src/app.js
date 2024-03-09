import  express  from 'express';
import { Server } from "socket.io";
import http from 'http';

const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000"
  }
});

const PORT = 4000; /* process.env.PORT || 4000; */
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`listening on *:${PORT}`);
});


let rooms = [];

io.sockets.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected now');
    rooms = rooms.filter(r => r.id !== String(socket.handshake.issued));
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
    room.messages.push(message);
    io.in(room.id).emit('server:msg', message1);
  });

  socket.on('user:needHelp', (data) => {
    console.log(`User need help.`);

    const room = {
      id: (socket.handshake.issued).toString(),
      members: [socket.handshake.issued.toString()],
      messages: [],
    };

    if (rooms.every(r => r.id !== room.id) ) {
      rooms.push(room);
    }
    socket.join(room.id);
    const responce = {
      roomId: room.id,
      authorId: 1,
      authorName: 'ADMIN',
      avatarURL: '/img/admin_avatar.avif',
      body: 'Hello, I am here to help you. How can I help you?',
    };
    io.to(room.id).emit('server:msg', responce);
    console.log('room created:', room.id);
    console.log('rooms:', rooms);
  });

  socket.on('admin:rooms', () => {
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
        authorId: 1,
        authorName: 'Pavlo',
        avatarURL: '/img/admin_avatar.avif',
        body: 'Support team member joined the chat.',
      };
      io.to(room.id).emit('server:msg', responce);
      console.log('admin:joinRoom', data);
    }
  });
});








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