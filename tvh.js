// class for communication with TVHeadend REST API, if not served from TVHeadend itself
// (i.e. located under /usr/share/tvheadend/src/webui/static) set "HTTP CORS origin" to
// "*" in THV settings
class TVH {

   constructor(url) {
      this.url = url ? url : "";
   }   
   
   async getCurrentEPG() {
       var response = await fetch(this.url + "/api/epg/events/grid?mode=now");
       var data = await response.json();
       return data.entries;
   }
   
   
   async getEpgEvent(eventId) {
    // api/epg/events/load?eventId=1512097
       var response = await fetch(this.url + "/api/epg/events/load?eventId=" + eventId);
       var data = await response.json();
       return data.entries[0];
  }
   
}
