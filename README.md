
# LG TV Remote HTML

A web-based remote control interface for LG Smart TVs, a connected Kodi instance.
EPG is retrieved from a TVHeadend instance in the same network.

## Features

- Control your LG TV from any device with a web browser
- Simple, intuitive HTML interface
- Remote control functionality including power, volume, one-click channel navigation

## Usage

Open the HTML file in your web browser and connect to your LG TV on the same network.
Hosting could be e.g. done by adding these file into the 'static' folder of your
TVHeadend installation (e.g. '/usr/share/tvheadend/src/webui/static/', root folder
may vary depending on your distribution).

## Technical Details

No Framework, plain HTML plus Javascript. For Websocket connections to LG-TV and
TVHeadend a dirty hack with an on-the-fly invisible iframe with a encoded 'data'
attribute for 'src'. This way the websocket connection succeeds even when the initiating
site is not delivered over https.
I assume TVHeadend needs no auth, and that in config ('Base / Server') HTTP CORS
origin is set to *.

## Requirements

- LG Smart TV with network connectivity
- Kodi
- TVHeadend
- Web browser (desktop or mobile)
