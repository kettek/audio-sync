window.addEventListener('resize', () => {
  m.redraw();
});
window.addEventListener('load', function(e) {
  audioSyncClient.alwaysReconnect = true;
  audioSyncClient.isAdmin = true;
  const M_USE = 0, M_EDIT = 1;
  const mode = M_USE;
  const viewAdmin = {
    view: () => {
      return m('.main', 
        (audioSyncClient.isConnected
        ? [
          m('h1', 'Admin Section'),
          m(viewAdminOptions),
          m(viewAdminControls),
          m('.audioGroups', Object.keys(audioSyncClient.mGroups).map(key => {
            let group = audioSyncClient.mGroups[key];
            return m(group.type == 'Soundboard' ? viewAdminSoundboard : viewAdminPlaylist, group)
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
  const viewAdminOptions = {
    view: () => {
      return m('.options', [
        m('#controls-master-volume', [
          m('span', 'master volume: '),
          m('input[type=range]', {
            min: 1,
            max: 100,
            value: audioSyncClient.getMasterVolume() * 100,
            onchange: function(e) {
              audioSyncClient.send({cmd: "setVolume", volume: Number(e.target.value) / 100});
            }
          })
        ]),
        m('#controls-local-volume', [
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
      ]);
    }
  }
  const viewAdminControls = {
    view: () => {
      return m('.controls', [
        m('button', {onclick: function() {
          audioSyncClient.send({cmd: "addGroup", group: new Date(), type: 'Soundboard', volume: 1.0});
        }}, '\uD83D\uDD09\u2795'),
        m('button', {onclick: function() {
          audioSyncClient.send({cmd: "addGroup", group: new Date(), type: 'Playlist', volume: 1.0, autoplay: true, shuffle: false, loop: true});
        }}, '\uD83C\uDFB5\u2795')
      ]);
    }
  }
  const viewAdminSoundboard = {
    view: (item) => {
      return m('.audioGroup.soundboard'+(audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT ? '.edit' : ''), [
        m('.controls',
          (audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT
            ? [
              m('button', {onclick: function(e) {
                audioSyncClient.mGroups[item.attrs.group].mode = M_USE;
              }}, '\u2714\uFE0F'),
              m('input.track'),
              m('input.title'),
              m('button', {onclick: function(e) {
                audioSyncClient.send({cmd: "addTrack", group: item.attrs.group, track_id: new Date(), title: e.target.previousSibling.value, track: e.target.previousSibling.previousSibling.value, volume: 1.0});
              }}, '\u2795'),
              m('button', {onclick: function(e) {
                audioSyncClient.send({cmd: "removeGroup", group: item.attrs.group });
              }}, '\uD83D\uDDD1'),
            ] : [
              m('button', {onclick: function(e) {
                audioSyncClient.mGroups[item.attrs.group].mode = M_EDIT;
              }}, '\u270F\uFE0F'),
              m('input[type=range][orient=vertical].vertical', {
                min: 1,
                max: 100,
                value: audioSyncClient.mGroups[item.attrs.group].volume * 100,
                onchange: function(e) {
                  audioSyncClient.send({cmd: "setVolume", group: item.attrs.group, volume: Number(e.target.value) / 100});
                }
              }),
            ]
          )
        )
        , m('.tracks', Object.keys(item.attrs.tracks).map(key => {
          let track = item.attrs.tracks[key];
          return m(viewAdminSoundboardTrack, Object.assign({isPlaying: track.isPlaying, group: item.attrs.group, track_id: key, track: track.track, title: track.title}))
        }))
      ])
    }
  }
  const viewAdminSoundboardTrack = {
    oncreate: (vnode) => {
      let fw = Math.floor(vnode.dom.getBoundingClientRect().width / vnode.dom.querySelector('button').innerText.length*1.5);
      vnode.dom.style = 'font-size:'+fw+'px';
    },
    onupdate: (vnode) => {
      try {
        let fw = Math.floor(vnode.dom.getBoundingClientRect().width / vnode.dom.querySelector('button').innerText.length*1.5);
        vnode.dom.style = 'font-size:'+fw+'px';
      } catch(e) { }
    },
    view: (item) => {
      if (audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT) {
        return m('.track.edit', [
          m('input', {
            value: item.attrs.title?item.attrs.title:item.attrs.track,
            onchange: function(e) {
              audioSyncClient.send({cmd: "addTrack", group: item.attrs.group, track_id: item.attrs.track_id, track: e.target.value, volume: 1.0});
            }
          }),
          m('input[type=range]', {
            min: 1,
            max: 100,
            value: audioSyncClient.mGroups[item.attrs.group].tracks[item.attrs.track_id].volume * 100,
            onchange: function(e) {
              audioSyncClient.send({cmd: "setVolume", group: item.attrs.group, track_id: item.attrs.track_id, volume: Number(e.target.value) / 100});
            }
          }),
          m('button', {
            onclick: function(e) {
              audioSyncClient.send({cmd: "removeTrack", group: item.attrs.group, track_id: item.attrs.track_id});
            }
          }, '\u274C')
        ])
      } else {
        return m('.track.use', [
          m('button', {
            style: (item.dom && item.dom.parentNode ?
              'font-size:'+(item.dom.parentNode.getBoundingClientRect().width / item.attrs.track.length)+'px'
            :
              ''
            ),
            onclick: function(e) {
              if (!item.attrs.isPlaying) {
                audioSyncClient.send({cmd: "playTrack", group: item.attrs.group, track_id: item.attrs.track_id});
              } else {
                audioSyncClient.send({cmd: "stopTrack", group: item.attrs.group, track_id: item.attrs.track_id});
              }
            }
          }, item.attrs.track.substring(item.attrs.track.lastIndexOf('/')+1)),
          (mode == M_EDIT ?
            m('button.remove', {
              onclick: function(e) {
                audioSyncClient.send({cmd: "stopTrack", group: item.attrs.group, track_id: item.attrs.track_id});
                audioSyncClient.send({cmd: "removeTrack", group: item.attrs.group, track_id: item.attrs.track_id});
              }
            }, 'X')
          : null )
        ])
      }
    }
  }
  const viewAdminPlaylist = {
    view: (item) => {
      return m('.audioGroup.playlist'+(audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT ? '.edit' : ''), [
        m('.title',
          (audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT 
            ? [
                m('input', {
                  value: audioSyncClient.mGroups[item.attrs.group].title||'',
                  onchange: function(e) {
                    audioSyncClient.send({cmd: "setGroup", group: item.attrs.group, title: e.target.value });
                  }
                }),
                m('button', {onclick: function(e) {
                  audioSyncClient.mGroups[item.attrs.group].mode = M_USE;
                }}, '\u2714\uFE0F')
              ]
            : [
                m('span', audioSyncClient.mGroups[item.attrs.group].title||''),
                m('button', {onclick: function(e) {
                  audioSyncClient.mGroups[item.attrs.group].mode = M_EDIT;
                }}, '\u270F\uFE0F')
              ]
          )
        ),
        m('.controls',
          (audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT
            ? [
              m('input.track'),
              m('input.title'),
              m('button', {onclick: function(e) {
                audioSyncClient.send({cmd: "addTrack", group: item.attrs.group, track_id: new Date(), title: e.target.previousSibling.value, track: e.target.previousSibling.previousSibling.value, volume: 1.0});
              }}, '\u2795'),
              m('button', {onclick: function(e) {
                audioSyncClient.send({cmd: "removeGroup", group: item.attrs.group });
              }}, '\uD83D\uDDD1'),
            ] : [
              m('button' + (!audioSyncClient.mGroups[item.attrs.group].autoplay ? '.off' : ''), {
                onclick: function(e) {
                  console.log(audioSyncClient.mGroups[item.attrs.group].autoplay)
                  audioSyncClient.send({cmd: "setGroup", group: item.attrs.group, autoplay: audioSyncClient.mGroups[item.attrs.group].autoplay ? false : true});
                }
              }, 'autoplay'),
              m('button' + (!audioSyncClient.mGroups[item.attrs.group].shuffle ? '.off' : ''), {
                onclick: function(e) {
                  console.log(audioSyncClient.mGroups[item.attrs.group].shuffle)
                  audioSyncClient.send({cmd: "setGroup", group: item.attrs.group, shuffle: audioSyncClient.mGroups[item.attrs.group].shuffle ? false : true});
                }
              }, 'shuffle'),
              m('button' + (!audioSyncClient.mGroups[item.attrs.group].loop ? '.off' : ''), {
                onclick: function(e) {
                  audioSyncClient.send({cmd: "setGroup", group: item.attrs.group, loop: audioSyncClient.mGroups[item.attrs.group].loop ? false : true});
                }
              }, 'loop'),
              m('input[type=range]', {
                min: 0,
                max: 100,
                value: audioSyncClient.mGroups[item.attrs.group].volume * 100,
                onchange: function(e) {
                  audioSyncClient.send({cmd: "setVolume", group: item.attrs.group, volume: Number(e.target.value) / 100});
                }
              })
            ]
          )
        ),
        m('.tracks', Object.keys(item.attrs.tracks).map(key => {
          let track = item.attrs.tracks[key];
          return m(viewAdminPlaylistTrack, Object.assign({group: item.attrs.group, track_id: key, track: track.track, title: track.title}))
        }))
      ])
    }
  }
  const viewAdminPlaylistTrack = {
    view: (item) => {
      return m('.track' + (item.attrs.track_id == audioSyncClient.mGroups[item.attrs.group].current_track ? '.playing' : ''), [
	      (audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT ? 
          [m('button', {onclick: function(e) {
            audioSyncClient.send({
              cmd: "addTrack",
              group: item.attrs.group,
              track_id: item.attrs.track_id,
              track: e.target.nextSibling.value,
              title: e.target.nextSibling.nextSibling.value
            });
          }}, '\u2714\uFE0F'),
          m('input.track', {
            value: item.attrs.track
          }),
          m('input.name', {
            value: item.attrs.title?item.attrs.title:item.attrs.track
          })]
        : m('label', item.attrs.title?item.attrs.title:item.attrs.track )),
        m('button.play', {
          onclick: function(e) {
            audioSyncClient.send({cmd: "playTrack", group: item.attrs.group, track_id: item.attrs.track_id});
          }
        }, m.trust('&#9654;')),
        m('button.pause', {
          onclick: function(e) {
            audioSyncClient.send({cmd: "pauseTrack", group: item.attrs.group, track_id: item.attrs.track_id});
          }
        }, m.trust('&#9646;&#9646;')),
        m('button.stop', {
          onclick: function(e) {
            audioSyncClient.send({cmd: "stopTrack", group: item.attrs.group, track_id: item.attrs.track_id});
          }
        }, m.trust('&#9726;'))
        , m('button.remove', {
          onclick: function(e) {
            audioSyncClient.send({cmd: "stopTrack", group: item.attrs.group, track_id: item.attrs.track_id});
            audioSyncClient.send({cmd: "removeTrack", group: item.attrs.group, track_id: item.attrs.track_id});
          }
        }, 'X'),
	(audioSyncClient.mGroups[item.attrs.group].mode == M_EDIT ? 
          m('input[type=range]', {
            min: 1,
            max: 100,
            value: audioSyncClient.mGroups[item.attrs.group].tracks[item.attrs.track_id].volume * 100,
            onchange: function(e) {
              audioSyncClient.send({cmd: "setVolume", group: item.attrs.group, track_id: item.attrs.track_id, volume: Number(e.target.value) / 100});
            }
          })
	  : null)
      ])
    }
  }
  
  m.route(document.body, '/', {
    '/': viewAdmin
  });

});
