const audioSyncClient = (function() {
  let mConnection   = null;
  let mUrl          = "";
  let mGroups       = {};
  let mMasterVolume = 0.5;
  let mLocalVolume  = 0.5;

  function connect(url = "wss://"+window.location.host+"/l/123") {
    mUrl = url;
    if (mConnection !== null) {
      mConnection.close();
    }
    mConnection = new WebSocket(mUrl);
    mConnection.onopen = onOpen;
    mConnection.onclose = onClose;
    mConnection.onerror = onError;
    mConnection.onmessage = onMessage;
  }
  function send(msg) {
    if (!msg instanceof Object) return;
    mConnection.send(JSON.stringify(msg));
    console.log('--send');
    console.log(msg);
  }

  function onOpen(e) {
    console.log('--opened');
    console.log(e);
    audioSyncClient.isConnected = true;
    m.redraw();
  }
  function onClose(e) {
    console.log('--closed');
    console.log(e);
    if (audioSyncClient.autoReconnect) {
      setTimeout(function() {
        connect(mUrl);
      }, 5000);
    }
  }
  function onError(e) {
    console.log('--error');
    console.log(e);
  }
  function onMessage(e) {
    let msg = JSON.parse(e.data);
    console.log(e.data);
    console.log('--receive');
    console.log(msg);
    if (msg.cmd === 'addGroup') {
      mGroups[msg.group] = msg;
      if (msg.tracks) {
        for (key in msg.tracks) {
          let track = msg.tracks[key];
          mGroups[msg.group].tracks[key] = { player: createPlaybackItem({group: msg.group, track: track.track, track_id: track.track_id}), track: track.track, title: track.title, volume: track.volume };
        }
      } else {
        msg.tracks = {};
      }
      // Automatically begin playback if there is a currently playing track
      if (msg.current_track && mGroups[msg.group].tracks[msg.current_track].player) {
        mGroups[msg.group].tracks[msg.current_track].player.resume(mGroups[msg.group].tracks[msg.current_track].player.player);
        mGroups[msg.group].tracks[msg.current_track].isPlaying = true
      }
      console.log(mGroups[msg.group]);
    } else if (msg.cmd === 'removeGroup') {
      if (!msg.group) return;
      if (!mGroups[msg.group]) return;
      for (let track_id in mGroups[msg.group].tracks) {
        let track = mGroups[msg.group].tracks[track_id];
        if (!track.player || !track.player.player) continue;
        track.player.stop(track.player.player);
      }
      delete mGroups[msg.group];
    } else if (msg.cmd === 'setGroup') {
      if (!msg.group) return;
      if (!mGroups[msg.group]) return;
      if (msg.autoplay !== undefined) mGroups[msg.group].autoplay = msg.autoplay
      if (msg.shuffle !== undefined) mGroups[msg.group].shuffle = msg.shuffle
      if (msg.loop !== undefined) mGroups[msg.group].loop = msg.loop
      if (msg.title !== undefined) mGroups[msg.group].title = msg.title
    } else if (msg.cmd === 'addTrack') {
      if (!msg.group || !msg.track_id) return;
      if (!mGroups[msg.group]) return;
      mGroups[msg.group].tracks[msg.track_id] = { player: createPlaybackItem({group: msg.group, track: msg.track, track_id: msg.track_id}), track: msg.track, title: msg.title, volume: msg.volume };
    } else if (msg.cmd === 'removeTrack') {
      if (!msg.group || !msg.track_id) return;
      if (!mGroups[msg.group]) return;
      delete mGroups[msg.group].tracks[msg.track_id];
    } else if (msg.cmd === 'playTrack') {
      if (!msg.group || !msg.track_id) return;
      if (!mGroups[msg.group]) return;
      let track = mGroups[msg.group].tracks[msg.track_id];
      if (!track || !track.player || !track.player.player) return;
      track.isPlaying = true
      track.player.stop(track.player.player);
      track.player.resume(track.player.player);
    } else if (msg.cmd === 'pauseTrack') {
      try {
        let track = mGroups[msg.group].tracks[msg.track_id];
        track.player.pause(track.player.player);
        track.isPlaying = false
      } catch (e) { return }
    } else if (msg.cmd === 'stopTrack') {
      try {
        let track = mGroups[msg.group].tracks[msg.track_id];
        track.isPlaying = false
        track.player.stop(track.player.player);
      } catch (e) { return }
    } else if (msg.cmd === 'currentTrack') {
      try {
        let track = mGroups[msg.group].tracks[msg.track_id];
        track.isPlaying = true
        console.log(mGroups[msg.group])
      } catch (e) { return }
    } else if (msg.cmd === 'setVolume') {
      try {
        if (msg.group !== undefined) {
          if (msg.track_id !== undefined) {
            let track = mGroups[msg.group].tracks[msg.track_id];
            track.volume = msg.volume;
            track.player.volume(track.player.player, getTrackVolume(msg.group, msg.track_id));
          } else {
            console.log('Wow, should be setting volume!')
            mGroups[msg.group].volume = msg.volume;
            Object.keys(mGroups[msg.group].tracks).forEach(function(track_id) {
              let track = mGroups[msg.group].tracks[track_id];
              console.log('setting volume for ' + msg.group + ' - ' + track_id)
              track.player.volume(track.player.player, getTrackVolume(msg.group, track_id));
            });
          }
        } else {
          mMasterVolume = msg.volume;
          Object.keys(mGroups).forEach(function(group) {
            Object.keys(mGroups[group].tracks).forEach(function(track_id) {
              let track = mGroups[group].tracks[track_id]
              track.player.volume(track.player.player, getTrackVolume(group, track_id));
            });
          });
        }
      } catch (e) { return }
    }
    console.log('redraw');
    m.redraw();
  }
  /* */
  let currentPlaybackHandlers = [];
  let playbackHandlers = [];
  function addPlaybackHandler(obj) {
    playbackHandlers.push(obj);
  }
  function createPlaybackItem(msg) {
    let parsedUrl = document.createElement('a');
    parsedUrl.href = msg.track;
    parsedUrl.search = "";
    for (let handler of playbackHandlers) {
      if (handler.match(parsedUrl)) {
        let instance = Object.assign({}, handler);
        instance.player = instance.create(msg);
        return instance;
      }
    }
    return {};
  }

  function getTrackVolume(group_id, track_id) {
    try {
      console.log('what');
      let group = mGroups[group_id];
      console.log('group vol: ' + group.volume);
      let track = group.tracks[track_id];
      return track.volume * group.volume * mMasterVolume * mLocalVolume;
    } catch (err) { 
      return 0.5
    }
  }

  function getMasterVolume() {
    return mMasterVolume;
  }

  function setLocalVolume(vol) {
    console.log('setting local volume to ' + vol);
    mLocalVolume = vol;
    Object.keys(mGroups).forEach(function(group) {
      console.log(group)
      Object.keys(mGroups[group].tracks).forEach(function(track_id) {
        let track = mGroups[group].tracks[track_id];
        console.log(track.volume);
        console.log(mGroups[group].volume);
        console.log(mMasterVolume);
        console.log(mLocalVolume);
        track.player.volume(track.player.player, track.volume * mGroups[group].volume * mMasterVolume * mLocalVolume);
      });
    });
  }
  function getLocalVolume(vol) {
    return mLocalVolume;
  }

  function onPlayerEnded(group, track_id) {
    if (mGroups[group].type == 'Soundboard') return;
    let track = mGroups[group].tracks[track_id];
    if (track) track.isPlaying = false
    // This is inefficient to recalculate every time, but I don't care.
    let sorted_tracks = Object.keys(mGroups[group].tracks);
    sorted_tracks.sort(function(a,b) {
      return Date(a) - Date(b);
    });
    let track_index = sorted_tracks.indexOf(track_id);
    let player;
    console.log(track_index + '/' + sorted_tracks.length);
    if (mGroups[group].shuffle && mGroups[group].autoplay) {
      mGroups[group].current_track = sorted_tracks[Math.floor(Math.random() * Math.floor(sorted_tracks.length))];
      player = mGroups[group].tracks[mGroups[group].current_track].player;
    } else if (mGroups[group].autoplay && sorted_tracks.length > track_index+1) {
      player = mGroups[group].tracks[sorted_tracks[track_index+1]].player;
      mGroups[group].current_track = sorted_tracks[track_index+1];
    } else if (mGroups[group].autoplay && sorted_tracks.length != 0) {
      if (!mGroups[group].loop) {
        if (audioSyncClient.isAdmin) send({cmd: "currentTrack", group: group, track_id: 0});
      } else {
        mGroups[group].current_track = sorted_tracks[0];
        player = mGroups[group].tracks[sorted_tracks[0]].player;
      }
    }
    if (player) player.resume(player.player);
  }
  function onPlayerPlay(group, track_id) {
    if (mGroups[group].type == 'Soundboard') return;
    if (!audioSyncClient.isAdmin) return;
    // FIXME: Only send this if this client is an admin
    console.log(mGroups[group].tracks[track_id])
    send({cmd: "currentTrack", group: group, track_id: track_id});
  }

  addPlaybackHandler({
    match: (url) => {
      if (url.hostname.match(/(www.)?(youtu.be|youtube.com)/g)) {
        // ... now what?
        return true;
      }
      return false;
    },
    create: () => {
    },
    destroy: () => {
    },
    resume: () => {
    },
    pause: () => {
    },
    seek: (pos) => {
    },
    volume: (volume) => {
    },
  });
  addPlaybackHandler({
    match: (url) => {
      let match = url.href.match(/^.+\.(mp3|m4a|mp4|ogg|oga|ogv|webm|flac|wav)$/i);
      if (!match) return false;
      return true;
    },
    create: (msg) => {
      let player = document.createElement('audio');
      player.src = msg.track;
      player.autoplay = false;
      player.preload = 'metadata';
      player.volume = getTrackVolume(msg.group, msg.track_id);
      player.addEventListener('ended', function() {
        onPlayerEnded(msg.group, msg.track_id);
      });
      player.addEventListener('play', function() {
        onPlayerPlay(msg.group, msg.track_id);
      });
      return player;
    },
    destroy: (player) => {
      player.parentNode.removeChild(player);
    },
    stop: (player) => {
      player.pause();
      player.currentTime = 0;
    },
    resume: (player) => {
      player.play();
    },
    pause: (player) => {
      player.pause();
    },
    seek: (player, position) => {
      player.currentTime = 0;
    },
    volume: (player, volume) => {
      player.volume = volume;
    },
  });

  return { 
    connect: connect, 
    send: send, 
    state: 0, 
    autoReconnect: true,
    mGroups: mGroups, 
    isAdmin: false, 
    isConnected: false, 
    getMasterVolume: getMasterVolume,
    setLocalVolume: setLocalVolume, 
    getLocalVolume: getLocalVolume,
  }
})();
