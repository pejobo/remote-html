async function wait(ms) {
   await new Promise(r => setTimeout(r, ms));
}

function log(msg) {
  console.debug	(msg);
}


class TV {

  constructor(ip, client, appKey, onclose) {
     this.connected = false;
     this.ip = ip;
     this.client = client;
     this.appKey = appKey;
     (async () => {
        const sock = await client.request({
          uri: 'ssap://com.webos.service.networkinput/getPointerInputSocket'
        });
        log('waiting for input socket', sock.socketPath);
        this.inputSocket = new WebSocket(sock.socketPath);
        this.inputSocket.onopen = async () => {
           log('input open');
           // use input socket to prevent it from getting immediatly closed
           await this.inputSocket.send('\n\n');
           await wait(50);
           await this.inputSocket.send('\n\n');
           this.connected = true;
        }
        this.inputSocket.onerror = (err) => {
           this.connected = false;
           log('input err ' + err.msg);
        }
        this.inputSocket.onclose = () => {
           this.connected = false;
           log('input close');
           if (onclose) {
              onclose();
           }
        };
     })();
     // await client.request({uri: 'ssap://audio/volumeUp'});
     // await client.request({uri: 'ssap://audio/volumeDown'});
     // await client.request({uri: 'ssap://audio/getStatus'});
     // inputSocket.send('type:button\nname:HOME\n\n');
     // inputSocket.send('type:move\ndx:10\ndy:-20\ndown:0\n\n')
     // inputSocket.send('type:scroll\ndx:0\ndy:1\n\n') // dx should be always 0, because this simulates the scroll wheel
  }
  
  async getVolume() {
     return await this.client.request({uri: 'ssap://audio/getStatus'});
  }

  async setVolume(value) {
     await this.client.request({uri: 'ssap://audio/setVolume', payload: {volume: value}});
  }
  
  move(dx, dy, drag = false) {
     this.inputSocket.send(`type:move\ndx:${dx}\ndy:${dy}\ndown:${drag ? 1 : 0}\n\n`);
  }

  scrollUp() {
     this.inputSocket.send('type:scroll\ndx:0\ndy:1\n\n');
  }

  scrollDown() {
     this.inputSocket.send('type:scroll\ndx:0\ndy:-1\n\n');
  }

  // HOME, BACK, ENTER, INFO, LEFT, RIGHT, UP, DOWN, RED, GREEN, YELLOW, BLUE, 0, 1, .., MUTE, VOLUMEUP, VOLUMEDOWN, CHANNELUP, CHANNELDOWN
  clickButton(btn_name) {
     this.inputSocket.send(`type:button\nname:${btn_name}\n\n`);
  }
  
  // one of tv, hdmi1, .., ??
  async getInput() {
     var input = await tv.client.request({uri:'ssap://com.webos.applicationManager/getForegroundAppInfo'});
     input = input.appId.replace('com.webos.app.', '');
     return input == 'livetv' ? 'tv' : input;
  }
  
  // HDMI_1, .., SCART_1, AV_1, COMP_1
  async switchInput(id) {
     await tv.client.request({uri:'ssap://tv/switchInput', payload: { inputId : id }});
  }
  
  // very slow call - this is a big list
  async getChannelList() {
     return await tv.client.request({uri:'ssap://tv/getChannelList'});
  }
  
  async switchChannel(id) {
      return await tv.client.request({uri:'ssap://tv/openChannel', payload: {channelId: id}});
  }
  
  async turnOff() {
     await tv.client.request({uri: 'ssap://system/turnOff'});
  }
  
  isConnected() {
     return !!this?.client?.conn?.isConnected();
  }

}


async function connectTV(ip, app_key, onConnected, onClose) {
    var client = new SSAPClient(ip, app_key);
    log('connecting tv...');
    await client.connect();
    log('registering at tv ...');
    app_key = await client.register();
    console.log('tv app key:', app_key);
    log('...connected to tv');
    onConnected(new TV(ip, client, app_key, onClose));
}

// end
