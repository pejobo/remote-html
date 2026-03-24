function proxyPayload(address) {
  function forward(type, data) {
    window.parent.postMessage(JSON.stringify({type: type, data: data}), "*");
  }
  const conn = new WebSocket(address);
  conn.onopen = function (evt) {forward('open', evt);}
  conn.onclose = function (evt) {forward('close', evt);}
  conn.onerror = function (evt) {forward('error', evt);}
  conn.onmessage = function (evt) {forward('message', {data: evt.data});}
  window.addEventListener("message", async function (event) {
    const msg = (JSON.parse(event.data));
    if (msg.type === 'send') {
      conn.send(msg.data);
    } else if (msg.type === 'close') {
      conn.close();
    }
  }, false);
}

class ProxyWebSocket {

  constructor(target) {
     this.proxy = document.createElement('iframe');
     this.proxy.setAttribute('src', 'data:text/html;base64,' + btoa(`<!DOCTYPE html><h1>${target}</h1><script>window.onerror=err=>alert(err.toString());${proxyPayload.toString()};\nproxyPayload(${JSON.stringify(target)});</script>`));
     window.addEventListener("message", (event) => {
        if (event.source !== this.proxy.contentWindow) {
           return;
        }
        const msg = JSON.parse(event.data);
        const type = msg.type; 
        const data = msg.data;
        if (type === 'message' && this.onmessage) this.onmessage(data);
        if (type === 'close') {
           this.proxy.remove();
           if (this.onclose) this.onclose(data);
        }
        if (type === 'error' && this.onerror) this.onerror(data);
        if (type === 'open' && this.onopen) this.onopen(data);
        if (type === 'log') console.info('proxy:', data);
     }, false);
     this.proxy.style.display = 'none';
     document.querySelector('body').appendChild(this.proxy);
  }
  
  isConnected() {
     return !!this.proxy.contentWindow;
  }

  send(data) {
     this.proxy.contentWindow.postMessage(JSON.stringify({type: 'send', data: data}), '*');
  }

  close() {
     this.proxy.contentWindow.postMessage(JSON.stringify({type: 'close'}), '*');
  }
}
