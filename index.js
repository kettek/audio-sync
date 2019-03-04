#!/usr/bin/node

const rExpress      = require('express'),
      rHttp         = require('http'),
      rUrl          = require('url'),
      rPath         = require('path'),
      rFS           = require('fs');

const app           = rExpress();
const expressWs     = require('express-ws')(app)

app.use(rExpress.static('public'));

let rooms = {};

function handleWebsocket(ws, req) {
  const roomId = req.params.id;
  console.log('room id: ' + roomId);
  console.log(req.params);
  if (!rooms[roomId]) {
    try {
      rooms[roomId] = Object.assign({clients: [], audioGroups: {}, volume: 1.0}, JSON.parse(rFS.readFileSync(rPath.join('db', roomId+'.json'))));
    } catch(err) {
      rooms[roomId] = {clients: [], audioGroups: {}, volume: 1.0};
    }
  }
  rooms[roomId].clients.push(ws);

  ws.isAlive = true;
  ws.on('pong', () => { this.isAlive = true; });

  function bcast(data) {
    for (let client of rooms[roomId].clients) {
      client.send(data);
    }
  }

  // TODO: check if auth is there
  ws.on('message', data => {
    const msg = JSON.parse(data);

    if (msg.cmd === 'addGroup') {
      if (!msg.group) return;
      rooms[roomId].audioGroups[msg.group] = Object.assign({settings: {}, tracks: {}, volume: 1.0}, msg);
    } else if (msg.cmd === 'removeGroup') {
      if (!msg.group) return;
      if (!rooms[roomId].audioGroups[msg.group]) return;
      delete rooms[roomId].audioGroups[msg.group];
    } else if (msg.cmd === 'setGroup') {
      if (!msg.group) return;
      if (!rooms[roomId].audioGroups[msg.group]) return;
      if (msg.autoplay !== undefined) rooms[roomId].audioGroups[msg.group].autoplay = msg.autoplay;
      if (msg.shuffle !== undefined) rooms[roomId].audioGroups[msg.group].shuffle = msg.shuffle;
      if (msg.loop !== undefined) rooms[roomId].audioGroups[msg.group].loop = msg.loop;
    } else if (msg.cmd === 'addTrack') {
      if (!msg.group || !msg.track_id || !msg.track) return;
      if (!rooms[roomId].audioGroups[msg.group]) rooms[roomId].audioGroups[msg.group] = {settings: {}, tracks: {}, volume: 1.0};
      rooms[roomId].audioGroups[msg.group].tracks[msg.track_id] = Object.assign({volume: 1.0}, msg);
    } else if (msg.cmd === 'removeTrack') {
      if (!msg.group || !msg.track_id) return;
      if (!rooms[roomId].audioGroups[msg.group]) return;
      delete rooms[roomId].audioGroups[msg.group].tracks[msg.track_id];
    } else if (msg.cmd === 'setTrack') {
      if (!msg.group || !msg.track_id) return;
      if (!rooms[roomId].audioGroups[msg.group]) return;
      rooms[roomId].audioGroups[msg.group].tracks[msg.track_id] = msg;
    } else if (msg.cmd === 'moveTrack') {
      if (!msg.group || !msg.track_id) return;
      if (!rooms[roomId].audioGroups[msg.group]) return;
      // TODO: Move .track to .target index
    } else if (msg.cmd === 'playTrack') {
      try {
        let group = rooms[roomId].audioGroups[msg.group];
        if (group.type == 'Playlist' && group.tracks[msg.track_id]) {
          group.current_track = msg.track_id;
        }
      } catch(e) {}
    } else if (msg.cmd === 'stopTrack') {
      try {
        let group = rooms[roomId].audioGroups[msg.group];
        if (group.type == 'Playlist') {
          delete group.current_track;
        }
      } catch(e) {}
    } else if (msg.cmd === 'currentTrack') {
      try {
        let group = rooms[roomId].audioGroups[msg.group];
        if (group.type == 'Playlist' && group.tracks[msg.track_id]) {
          group.current_track = msg.track_id;
        }
      } catch(e) {}
    } else if (msg.cmd === 'setVolume') {
      try {
        if (msg.group !== undefined) {
          let group = rooms[roomId].audioGroups[msg.group];
          if (msg.track_id !== undefined) {
            group.tracks[msg.track_id].volume = msg.volume;
          } else {
            group.volume = msg.volume;
          }
        } else {
          rooms[roomId].volume = msg.volume;
        }
      } catch(e) {}
    }

    for (let client of rooms[roomId].clients) {
      client.send(data);
    }
  });
  ws.on('error', err => {
    console.log('--error');
  })
  ws.on('close', err => {
    console.log('--close');
    rooms[roomId].clients.splice(rooms[roomId].clients.indexOf(ws), 1);
  })
  // Send full audio group state to client
  setTimeout(() => {
    ws.send(JSON.stringify({ cmd: 'setVolume', volume: rooms[roomId].volume}));
    for (let gid in rooms[roomId].audioGroups) {
      ws.send(JSON.stringify(rooms[roomId].audioGroups[gid]));
    }
  }, 0);
}
app.ws('/l/:id', handleWebsocket);
app.ws('/a/:id', handleWebsocket);

const keepAliveInterval = setInterval(() => {
  expressWs.getWss().clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = true;
    ws.ping(() => {});
  });
}, 30000);

app.get('/l/:id', (req, res) => {
  console.log(req.params);
  res.sendFile(rPath.join(__dirname, 'public', 'index.html'));
});
app.get('/a/:id', (req, res) => {
  console.log(req.params);
  res.sendFile(rPath.join(__dirname, 'public', 'admin.html'));
});

app.listen(8081);

function exitHandler(options, exitCode) {
  console.log("Quitting.");
  if (options.cleanup) {
    cleanupHandler();
  }
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) process.exit();
}

function cleanupHandler() {
  Object.keys(rooms).forEach(function(room_id) {
    console.log("Saving " + room_id);
    let obj = {
      audioGroups: rooms[room_id].audioGroups,
      volume: rooms[room_id].volume
    }
    rFS.writeFileSync(rPath.join("db", room_id+".json"), JSON.stringify(obj));
  });
  rooms = {}
  process.exit();
}

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGTERM', cleanupHandler);
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
