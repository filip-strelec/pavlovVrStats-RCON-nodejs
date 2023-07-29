require('dotenv').config();
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const express = require('express');
const net = require('net');
const scrapeImageInfo = require('./mapScrapper');

const app = express();
const dataFolder = path.join(__dirname, 'data');
const port = process.env.PORT;
const allDataFolder = path.join(__dirname, 'data', 'all-data');

if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder);
}
if (!fs.existsSync(allDataFolder)) {
  fs.mkdirSync(allDataFolder);
}

app.use(cors());

app.get('/', function (req, res) {
  res.json({ wassup: 'gg' });
});

app.get('/data/:server/:filename', function (req, res) {
  const server = req.params.server;
  const filename = req.params.filename;
  const filePath = path.join(dataFolder, server, filename);

  fs.readFile(filePath, 'utf8', function (err, data) {
    if (err) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON data' });
      return;
    }

    res.json(jsonData);
  });
});

const numServers = parseInt(process.env.NUM_SERVERS) || 0;
const servers = [];
let jsonAllData = {};

for (let i = 1; i <= numServers; i++) {
  const server = {
    port: process.env[`SERVER${i}_PORT`],
    password: process.env[`SERVER${i}_PASSWORD`],
    name: process.env[`SERVER${i}_NAME`],
  };
  jsonAllData[`${server.name}_list`] = {};
  jsonAllData[`${server.name}_info`] = {};
  servers.push(server);
  const serverFolder = path.join(dataFolder, server.name);
  if (!fs.existsSync(serverFolder)) {
    fs.mkdirSync(serverFolder);
  }
  createClient(server, i);
}

function createClient(server, i) {
  const client = net.createConnection({ port: server.port, host: 'localhost' }, () => {
    console.log(server.name + ' connected');
    client.write(server.password + '\n');

    // Send requests to each client every 6 seconds
    setTimeout(() => {
      setInterval(() => {
        setTimeout(() => {
          client.write('ServerInfo' + '\n');
        }, 200);

        setTimeout(() => {
          client.write('InspectAll' + '\n');
        }, 400);

        setTimeout(() => {
          fs.writeFile(path.join(dataFolder, 'all-data', 'all-data.json'), JSON.stringify(jsonAllData), function (err) {
            if (err) throw err;
          });
        }, 2600);
      }, 10000);
    }, i * 500);
  });

  let mapName = '';
  let mapUrl = '';
  let previousMapLabel = null;

  client.on('data', async function (data) {
    const response = data.toString('ascii');

    if (response.includes('Authenticated') || response.includes('Password') || response.trim() === '') {
      return;
    }

    let jsonData;
    try {
      jsonData = JSON.parse(response);
    } catch (error) {
      console.error('Error parsing JSON for ' + server.name + ':', error);
      console.error('Error parsing JSON for ' + response);
      client.end();
      return;
    }

    if (jsonData.hasOwnProperty('InspectList')) {
      jsonAllData[`${server.name}_list`] = jsonData;
      fs.writeFile(path.join(dataFolder, server.name, 'inspectlist.json'), JSON.stringify(jsonData), function (err) {
        if (err) throw err;
      });
    } else if (jsonData.hasOwnProperty('ServerInfo')) {
      const currentMapLabel = jsonData.ServerInfo.MapLabel;
      if (currentMapLabel !== previousMapLabel) {
        previousMapLabel = currentMapLabel;
        mapLabelChanged(currentMapLabel, jsonData.ServerInfo.MapLabel.substr(3)).then((data) => {
          mapName = data[1];
          mapUrl = data[0];
        });
      }
      jsonData.ServerInfo.mapName = mapName;
      jsonData.ServerInfo.imgUrl = mapUrl;
      jsonAllData[`${server.name}_info`] = jsonData.ServerInfo;

      fs.writeFile(path.join(dataFolder, server.name, 'serverinfo.json'), JSON.stringify(jsonData.ServerInfo), function (err) {
        if (err) throw err;
      });
    } else {
      // Handle other responses as needed
    }
  });

  client.on('error', function (err) {
    console.log(server.name + ' error:', err);
  });





  client.on('close', function () {
    console.log(server.name + ' closed');
    createClient(server, i);
  });
}

function mapLabelChanged(newMapLabel, id) {
  return new Promise((resolve, reject) => {
    console.log(`MapLabel changed to: ${newMapLabel}`);

    scrapeImageInfo(id)
      .then((data) => {
        if (data.error) {
          console.log(data.error);
          resolve([]);
        } else {
          console.log('Image URL:', data.imageUrl);
          console.log('Alt:', data.alt);
          resolve([data.imageUrl, data.alt]);
        }
      })
      .catch((error) => {
        console.error('Error:', error.message);
        reject([]);
      });
  });
}

app.listen(port, function () {
  console.log('API server listening on port ' + port);
});