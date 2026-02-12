// class for communication with TVHeadend REST API, set "HTTP CORS origin" to
// "*" in TVH settings to allow access from this app
class TVH {

   constructor(url) {
      this.url = url ? url : "";
   }

   async getCurrentEPG() {
      var response = await fetch(this.url + "/api/epg/events/grid?mode=now&channelTag=TV%20channels&limit=100");
      var data = await response.json();
      return data.entries;
   }

   async getEPG(limit = 400) {
      var response = await fetch(this.url + "/api/epg/events/grid?channelTag=TV%20channels&limit=" + limit);
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
