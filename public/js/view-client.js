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
