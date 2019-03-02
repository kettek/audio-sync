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
          ])
        ] : [
          m('button', {
            onclick: function(e) {
              let section = window.location.pathname.lastIndexOf('/');
              if (section >= 0) {
                let room = window.location.pathname.substring(section+1);
                audioSyncClient.connect("ws://" + window.location.host + "/l/" + room);
              }
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
