// class for communication with KODI JSONRPC API over websocket (to prevent CORS issues)
class Kodi {

  constructor(url) {
    this.url = url;
    this.pendingRequests = new Map();
    this.id = 0;
    this.eventHandler = null;
  }

  close() {
    try {
       this.conn.close();
    } catch (error) {
       console.debug('ignoring error on  close', error);
    }
  }

  async connect() {
     return new Promise((resolve, reject) => {
        this.conn = new ProxyWebSocket(this.url);
        this.conn.onopen = () => resolve();
        this.conn.onclose = () => reject(new Error('Connection closed'));
        this.conn.onerror = (err) => reject(new Error('Connection error'));
        this.conn.onmessage = async (evt) => this.handleMessage(evt.data);
     });
  }
  
  eventHandler(handler) {
     this.eventHandler = handler;
  }

  async handleMessage(msg) {
     const m = JSON.parse(msg);
     if (this.pendingRequests.has(m.id)) {
        const {resolve, reject, type} = this.pendingRequests.get(m.id);
        this.pendingRequests.delete(m.id);
        resolve(m.result);
     } else if (this.eventHandler) {
        await this.eventHandler(m);
     }
  }

  request(msg) {
    return new Promise((resolve, reject) => {
      const p = {
        type: 'request',
        id: this.genid(),
        payload: {},
        ...msg,
      };
      this.pendingRequests.set(p.id, {resolve, reject});
      this.conn.send(JSON.stringify(p));
    });
  }
  
  genid() {
    return String(this.id++);
  }

  async switchOnTv() {
    // todo: this behaves differently than in yatse
    await this.request({jsonrpc: "2.0", method: "Addons.ExecuteAddon", params: { addonid: "plugin.program.scripts", params: { action: "execute", id: "tv-on" }}, id: this.genid()});
    // we fix this by sending an additional back command
    await this.sendKey('backspace');
  }
   
  async sendKey(name) {
    return await this.request({jsonrpc: "2.0", method: "Input.ButtonEvent", params: {button: name, keymap: "KB"}, id: this.genid()});
  }
  
  async sendText(s) {
    return await this.request({jsonrpc: "2.0", method: "Input.SendText", params: {text: s}, id: this.genid()});
  }
  
  async getPlayerInfos(type) {
     // var data = await this.request({jsonrpc: "2.0", method:"Player.GetItem", params: { playerid: 1, properties: ["title", "endtime", "duration", "starttime"]}, id: this.genid()});
     var data = await this.request({jsonrpc: "2.0", method:"XBMC.GetInfoLabels", params: {"labels": ["player.title", "player.finishtime", "player.duration", "player.starttime"]}, id: this.genid()});
     if (!data["player.duration"] && !data["player.title"]) {
        return null;
     }
     Object.keys(data).forEach(key => {
        if (key.startsWith("player.")) {
           data[key.substring(7)] = data[key];
           delete(data[key]);
        }
     });
     return data;
  }
  
  isConnected() {
     return !!this?.conn?.isConnected();
  }
}
