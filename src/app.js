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

  socket.on('user:msg', (data) => {
    const socketIssue = String(socket.handshake.issued);
    const room = rooms.find((r) => r.id === socketIssue);
    console.log('in room: ' + room.id);

    console.log(`Received message: ${data.messageText}`);
    const responce = {
      authorId: 1,
      authorName: 'Pavlo',
      body: data.messageText,
    };

    io.in(room.id).emit('server:msg', responce);
  });

  socket.on('user:needHelp', (data) => {
    console.log(`User need help.`);

    const room = {
      id: (socket.handshake.issued).toString(),
    };

    if (rooms.every(r => r.id !== room.id) ) {
      rooms.push(room);
    }
    socket.join(room.id);
    const responce = {
      authorId: 1,
      authorName: 'Pavlo',
      body: 'Hello, I am here to help you. How can I help you?',
    };
    io.to(room.id).emit('server:msg', responce);
    console.log('room created:', room.id);
    console.log('rooms:', rooms);
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