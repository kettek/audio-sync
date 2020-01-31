window.addEventListener('load', function(e) {
  audioSyncClient.alwaysReconnect = true;
  //audioSyncClient.connect();
  const viewClient = {
    view: () => {
      return m('.main', 
        (audioSyncClient.isConnected
        ? [
          m('h1', 'Client Section'),
          m('.controls', [
            m('#controls-master-volume', [
              m('span', 'volume: '),
              m('input[type=range]', {
                min: 0,
                max: 100,
                value: audioSyncClient.getLocalVolume() * 100,
                onchange: function(e) {
                  audioSyncClient.setLocalVolume(Number(e.target.value)/100);
                }
              })
            ])
          ]),
          m('.playing', 'Now Playing: ', Object.keys(audioSyncClient.mGroups).map(key => {
            let group = audioSyncClient.mGroups[key];

            let trackIDs = Object.keys(group.tracks)
            let playingTrackIDs = trackIDs.filter(trackID => group.tracks[trackID].isPlaying)
            return m('.tracks', playingTrackIDs.map(trackID => {
              let track = group.tracks[trackID]
              return m('.track', track.title ? track.title : track.track)
            }))
          }))
        ] : [
          m('button', {
            onclick: function(e) {
              audioSyncClient.connect("wss://" + window.location.host + window.location.pathname)
            }
          }, 'Connect')
        ])
      );
    },
  }
  
  m.route(document.body, '/', {
    '/': viewClient
  });

});
