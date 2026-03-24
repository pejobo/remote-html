['stop', 'play', 'pause'].forEach(id => {
   const el = document.getElementById(id);
   if (el) el.style.display = 'none';
});

async function load(route) {
   var response = await fetch(route);
   return await response.text();
}

document.querySelectorAll('img').forEach(async e => {
   if (e.src.endsWith('.svg')) {
      e.parentElement.innerHTML = await load(e.src);
   }
});

document.querySelectorAll('[data-target="kodi"]').forEach(e => {
   e.addEventListener('click', async () => {
      var key = e.dataset.kodikey ? e.dataset.kodikey : e.id;
      await kodi.sendKey(key);
      updateKodiState();
   });
});

document.getElementById('volume-slider').oninput = async (event) => {
   var value = event.target.valueAsNumber;
   await tv?.setVolume(value);
};

// tv remote supports this: HOME, BACK, ENTER, INFO, LEFT, RIGHT, UP, DOWN, RED, GREEN, YELLOW, BLUE, 0, 1, .., MUTE, VOLUMEUP, VOLUMEDOWN, CHANNELUP, CHANNELDOWN
document.querySelectorAll('[data-target="tv"]').forEach(e => {
   var id = e.id;
   e.addEventListener('click', async () => {
      tv?.clickButton(id.toUpperCase());
   });
});

document.querySelectorAll('[data-target="actualsource"]').forEach(e => {
   addClick(e, async () => {
      var id = e.id;
      var input = await tv.getInput();
      if (input == 'tv') {
         tv?.clickButton(id.toUpperCase());
      } else if (input == 'hdmi1') { // assume kodi is running on hdmi 1
         var key = e.dataset.kodikey ? e.dataset.kodikey : id;
         await kodi.sendKey(key);
      }
   });
});

addLongPress(document.getElementById('up'), async () => {
   window.tv?.clickButton('VOLUMEUP');
   var volume = await tv.getVolume();
   document.getElementById('volume-slider').value = volume.volume;
});

addLongPress(document.getElementById('down'), async () => {
   window.tv?.clickButton('VOLUMEDOWN');
   var volume = await tv.getVolume();
   document.getElementById('volume-slider').value = volume.volume;
});

function showBroadcast(broadcast) {
   var dialog = document.getElementById('epgdetail');
   var channel = getChannel(broadcast.channel)
   dialog.firstElementChild.innerHTML = `
      <img class='channel-icon' src='${channel.icon}' alt="${channel.name}">
      <div class='epg-title'>
         ${formatTime(broadcast?.start)} - ${formatTime(broadcast?.stop)} ${sanitize(broadcast?.title)}
      </div>
      <div class='epg-desc'>
         ${sanitize(broadcast?.description)}
      </div>`
      .trim().replaceAll(/ *\n *</g, '<');;
   dialog.dataset.eventId = broadcast.eventId;
}

function sanitize(text) {
   if (!text) {
      return '';
   }
   return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\n', '<br/>').replaceAll(/\[[^\[]*\]/g, '');
}

function getChannel(name) {
   var result = config.channels[name];
   while (!result && name.length > 0) {
      name = name.substr(0, name.length - 1);
      result = config.channels[name];
   }
   return result;
}

function buildChannelList(channels) {
   config.channels = {};
   const container = document.getElementById('channels');
   const template = document.createElement('template');
   var index = 1;
   channels.forEach(channel => {
      var name = channel.name;
      var id = channel.id || name.toLowerCase().replace(/[ \.\-_]/g, '')
      var channel = {
         name: name,
         index: index++,
         id: id,
         icon: channel.icon || `https://raw.githubusercontent.com/MarhyCZ/picons/master/640/${id}.png`
      }
      config.channels[channel.name] = channel;
      // optional: use icons from TVHeadend
      template.innerHTML = `
         <div class='channel' id='${channel.id}' data_channel_name='${channel.name}' >
            <img class='channel-icon' src='${channel.icon}' alt='${channel.name}' />
            <div class='epg' id='epg-${channel.id}'>
               <div class='epg-title'></div>
               <div class='epg-desc'></div>
            </div>
         </div>`
         .trim().replaceAll(/ *\n *</g, '<');
      channel.element = template.content.children[0];
      container.append(channel.element);
      document.getElementById('epg-' + channel.id).addEventListener('click', async (e) => {
         if (e.target.textContent) {
            var channelConfig = getChannel(name);
            if (channelConfig.epg[0].stop.getTime() < Date.now()) {
               channelConfig.epg = [];
               await loadEpg();
            }
            var dialog = document.getElementById('epgdetail');
            dialog.dataset.channel = name;
            showBroadcast(channelConfig.epg[0]);
            dialog.showModal();
         }
      });
   });
}

function extractEpgData(tvhEpgEntry) {
   return {
      channel: tvhEpgEntry.channelName,
      eventId: tvhEpgEntry.eventId,
      start: new Date(tvhEpgEntry.start * 1000),
      stop: new Date(tvhEpgEntry.stop * 1000),
      title: tvhEpgEntry.title,
      description: tvhEpgEntry.description,
      nextEventId: tvhEpgEntry.nextEventId
   };
}

function formatTime(date) {
   if (!date) return '00:00';
   var hour = date.getHours();
   var minute = date.getMinutes();
   return hour + (minute < 10 ? ':0' : ':') + minute;
}

function nvl(instance, ifNull = '') {
   return instance ? instance : ifNull;
}

function updateChannelEpg(channel, epgEntry) {
   now = Date.now();
   if (channel && epgEntry.stop.getTime() > now) {
      if (!channel.epg) {
         channel.epg = [epgEntry];
      } else if (!channel.epg.find(e => e.eventId == epgEntry.eventId)) {
         channel.epg.push(epgEntry);
         channel.epg.sort((a, b) => a.start.getTime() - b.start.getTime());
      }
      if (epgEntry.start.getTime() <= now && now < epgEntry.stop.getTime()) {
         channel.element.querySelector('.epg-title').innerHTML = `${formatTime(epgEntry?.start)} - ${formatTime(epgEntry?.stop)} ${sanitize(epgEntry?.title)}`;
         channel.element.querySelector('.epg-desc').innerHTML = `${sanitize(epgEntry?.description)}`;
      }
   }
}

async function loadEpg() {
   try {
      epgData = (await tvheadend.getEPG()).map(e => extractEpgData(e));
      epgData.forEach(epg => {
         var channel = getChannel(epg.channel);
         updateChannelEpg(channel, epg);
      });
      window.localStorage.setItem('epg_cache', JSON.stringify(epgData));
   } catch (error) {
      console.warn('Failed to load EPG from server', error);
   }
}

function loadCachedEpg() {
   var cached = window.localStorage.getItem('epg_cache');
   if (!cached) return;
   try {
      var epgData = JSON.parse(cached);
      var now = new Date();
      epgData.forEach(epg => {
         // reconstruct Dates from strings
         epg.start = new Date(epg.start);
         epg.stop = new Date(epg.stop);
         var channel = getChannel(epg.channel);
         updateChannelEpg(channel, epg);
      });
   } catch (e) {
      console.warn('Failed to load EPG cache', e);
   }
}

async function getEpgByEventId(eventId) {
   var epg = extractEpgData(await tvheadend.getEpgEvent(eventId));
   var channel = getChannel(epg.channel);
   if (epg.start.getTime() <= Date.now() + 4 * 60 * 60 * 1000) {
      // update cache (asynchronously) when it does not include entries later than 4h from now
      loadEpg();
   }
   updateChannelEpg(channel, epg);
   return epg;
}

async function initActions(tv) {
   var channelList = (await tv.getChannelList()).channelList
      .filter(e => e.TV)
      .filter(e => !e.invisible)
      .filter(e => !e.scrambled)
      .filter(e => !e.skipped)
      .filter(e => !config.channel_ignore_list.includes(e.channelName))
      //.filter(e => e.channelNumber < 100)
      .forEach(e => {
         var channel = getChannel(e.channelName);
         if (channel && !channel.channelId) {
            channel.channelId = e.channelId;
            console.debug(`tv channel '${e.channelName}', tv=${e.channelNumber}, remote=${channel.index}`);
            document.getElementById(channel.id)?.querySelector('.channel-icon').addEventListener('click', async () => {
               await tv.switchChannel(e.channelId);
            });
         } else {
            console.debug('no match for channel from tv in config:', e.channelName);
         }
      });
}

function onTvConnected(tv) {
   console.debug('TV connected');
   window.tv = tv; // for experiments on dev console
   config.tv_app_key = tv.appKey;
   window.localStorage.config = JSON.stringify(config);
   (async () => {
      var volume = await tv.getVolume();
      document.getElementById('volume-slider').value = volume.volume;
   })();
   document.getElementById('volume-slider').addEventListener('input', async (event) => {
      await tv.setVolume(event.target.valueAsNumber);
   });
   (async () => await initActions(tv))();
   document.getElementById('power').children[0].setAttribute("fill", "#39AF35");
}

function onTvClose() {
   window.tv = undefined;
   console.debug('TV disconnected');
   document.getElementById('power').children[0].removeAttribute("fill");
}

function connect_to_tv() {
   if (!window.tv || !window.tv.isConnected()) {
      document.getElementById('power').children[0].setAttribute("fill", "#F02020");
      (async () => {
         const maxRetries = 5;
         let delay = 10000;
         for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
               await connectTV(config.tv_ip, config.tv_app_key, onTvConnected, onTvClose);
               return;
            } catch (e) {
               if (attempt < maxRetries) {
                  console.warn(`TV connection attempt ${attempt} failed, retrying in ${delay / 1000}s...`);
                  await new Promise(r => setTimeout(r, delay));
                  delay *= 2;
               } else {
                  console.error(`TV connection attempt ${attempt} failed, giving up.`);
                  document.getElementById('power').children[0].setAttribute("fill", "#0F0000");
               }
            }
         }
         console.error('TV connection failed after max retries');
      })();
   }
}

async function handleKodiEvent(event) {
   switch (event.method) {
      case 'Player.OnPlay':
      case 'Player.OnResume':
         document.getElementById('stop').style.display = '';
         var d = await kodi.getPlayerInfos();
         if (event?.params?.data?.item?.channeltype) {
            document.getElementById('kodi').querySelector('.epg-title').innerHTML = sanitize(d.title);
         } else {
            // display duration without seconds
            document.getElementById('kodi').querySelector('.epg-title').innerHTML = `${d.finishtime} (${d.duration.substring(0, d.duration.length - 3)}) ${sanitize(d.title)}`;
            document.getElementById('pause').style.display = '';
         }
         break;
      case 'Player.OnPause':
         if (event.params.data.item?.channeltype != 'tv') {
            document.getElementById('play').style.display = 'none';
            document.getElementById('pause').style.display = '';
         }
         break;
      case 'Player.OnStop':
         document.getElementById('kodi').querySelector('.epg-title').innerHTML = '';
         document.getElementById('stop').style.display = 'none';
         document.getElementById('pause').style.display = 'none';
         document.getElementById('play').style.display = 'none';
         break;
      case 'Input.OnInputRequested':
         document.getElementById('kodi-textinput').showModal();
         break;
      case 'Input.OnInputFinished':
         document.getElementById('kodi-textinput').close();
         break;
      default:
         console.debug('not handled kodi event', event);
   }
}

async function updateKodiState() {
   var playerInfo = await kodi.getPlayerInfos();
   if (playerInfo) {
      handleKodiEvent({ method: "Player.OnResume" });
   } else {
      handleKodiEvent({ method: "Player.OnStop" });
   }
}

async function connect_to_kodi() {
   if (kodi?.isConnected()) {
      return;
   }
   kodi?.close();
   console.info('connecting kodi..');
   kodi = new Kodi(config.kodi_url);
   await kodi.connect();
   console.info('connected to kodi');
   document.getElementById('kodi-status').classList.add('connected');
   kodi.onclose = () => {
      document.getElementById('kodi-status').classList.remove('connected');
      console.debug('kodi connection closed');
   };
   kodi.eventHandler = handleKodiEvent;
   if (window.SWITCH_TV_ON) {
      kodi.switchOnTv();
      delete window.SWITCH_TV_ON;
   }
   window.kodi = kodi;
   updateKodiState();
}

// initialization
var config = {};
var tvheadend;
var kodi;

async function init() {
   console.log('App initialization starting...');
   try {
      var request = await fetch('config.json');
      config = JSON.parse(await request.text());
      config.kodi_url = config.kodi_url.replaceAll('${hostname}', location.hostname);
      config.tvh_url = config.tvh_url.replaceAll('${hostname}', location.hostname);
   } catch (error) {
      console.error('Failed to load or parse config.json:', error);
      return;
   }
   tvheadend = new TVH(config.tvh_url);
   buildChannelList(config.channel_list);
   delete config.channel_list;
   loadCachedEpg();
   const elementKodi = document.getElementById('kodi');
   // elementKodi.querySelector('.channel-icon').src = '';
   elementKodi.querySelector('.channel-icon').addEventListener('click', async () => {
      if (tv?.connected) {
         await tv.switchInput('HDMI_1');
      }
   });
   document.getElementById('power').addEventListener('click', async () => {
      if (window.tv) {
         tv.turnOff();
      } else if (kodi) {
         kodi.switchOnTv();
         connect_to_tv();
      } else {
         window.SWITCH_TV_ON = true;
      }
   });
   connect_to_tv();
   document.getElementById('kodi-input-send').addEventListener('click', async e => {
      var text = document.getElementById('kodi-input').value;
      await kodi.sendText(text);
   });
   var epgDialog = document.getElementById('epgdetail')
   epgDialog.addEventListener('click', (e) => {
      epgDialog.close();
   });
   document.getElementById('nextEpg').addEventListener('click', async (e) => {
      e.stopPropagation();
      var eventId = e.target.parentElement.dataset.eventId;
      var channel = getChannel(e.target.parentElement.dataset.channel);
      var epg = channel.epg;
      var index = epg.findIndex((e) => e.eventId == eventId);
      var broadcast = (index != -1) ? epg[index + 1] : null;
      if (!broadcast) {
         broadcast = await getEpgByEventId(epg[epg.length - 1].nextEventId);
      }
      showBroadcast(broadcast);
   });
   document.getElementById('prevEpg').addEventListener('click', async (e) => {
      e.stopPropagation();
      var eventId = e.target.parentElement.dataset.eventId;
      var channel = getChannel(e.target.parentElement.dataset.channel);
      var epg = channel.epg;
      var broadcast = epg.find((e) => e.nextEventId == eventId);
      if (broadcast) {
         showBroadcast(broadcast);
      }
   });
   connect_to_kodi();
   loadEpg();
};

(async () => await init())();

document.addEventListener('visibilitychange', async () => {
   if (document.visibilityState === 'visible') {
      loadCachedEpg();
      loadEpg();
      connect_to_kodi();
      connect_to_tv();
   }
});
