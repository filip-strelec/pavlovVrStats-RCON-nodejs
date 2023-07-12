require('dotenv').config();
var fs = require('fs');
var path = require('path');
var express = require('express');
var NetcatClient = require('node-netcat').client;
const scrapeImageInfo = require('./mapScrapper');
var app = express();
var dataFolder = path.join(__dirname, 'data');
var port = process.env.PORT;
var allDataFolder = path.join(__dirname, 'data', 'all-data');
if (!fs.existsSync(dataFolder)) {
  fs.mkdirSync(dataFolder);
}
if (!fs.existsSync(allDataFolder)) {
  fs.mkdirSync(allDataFolder);
}
let previousMapLabel = null; 

app.get('/', function(req, res) {

    res.json({wassup:"gg"});
  });



app.get('/data/:server/:filename', function(req, res) {
  var server = req.params.server;
  var filename = req.params.filename;
  var filePath = path.join(dataFolder, server, filename);

  fs.readFile(filePath, 'utf8', function(err, data) {
    if (err) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    var jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON data' });
      return;
    }

    res.json(jsonData);
  });
});

var numServers = parseInt(process.env.NUM_SERVERS) || 0;
var servers = [];
let jsonAllData={};
for (var i = 1; i <= numServers; i++) {
  var server = {
    port: process.env[`SERVER${i}_PORT`],
    password: process.env[`SERVER${i}_PASSWORD`],
    name: process.env[`SERVER${i}_NAME`]
  };

  servers.push(server);

 
  var serverFolder = path.join(dataFolder, server.name);
  if (!fs.existsSync(serverFolder)) {
    fs.mkdirSync(serverFolder);
  }

  createClient(server);
}

function createClient(server) {
  var client = NetcatClient(server.port, 'localhost');
  let mapName="";
  let mapUrl="";

  client.on('open', function () {
    console.log(server.name + ' connected');
    client.send(server.password + '\n');
  });

  client.on('data', async function (data) {
    var response = data.toString('ascii');
    console.log(server.name + ' response:', response);
    if (response.includes('Authenticated')||response.includes('Password')||response.trim()==="")return;
    try {
     
      let jsonData = JSON.parse(response);

      if (jsonData.hasOwnProperty('InspectList')) {
    
jsonAllData[`${server.name}_list`] = jsonData;
          fs.writeFile(path.join(dataFolder, server.name, 'inspectlist.json'), JSON.stringify(jsonData), function (err) {
            if (err) throw err;
            console.log('Combined InspectList saved to ' + server.name + '/inspectlist.json');
          });
        
      }

      else if (jsonData.hasOwnProperty('ServerInfo')) {
        const currentMapLabel = jsonData.ServerInfo.MapLabel;
        if (currentMapLabel !== previousMapLabel) {
          previousMapLabel = currentMapLabel;
           mapLabelChanged(currentMapLabel, jsonData.ServerInfo.MapLabel.substr(3)).then((data=>{
            
            mapName = data[1];
            mapUrl = data[0];


            
  
           }))
       
        }
        jsonData.ServerInfo.mapName = mapName;
        jsonData.ServerInfo.imgUrl = mapUrl;
        jsonAllData[`${server.name}_info`] = jsonData.ServerInfo;

        fs.writeFile(path.join(dataFolder, server.name, 'serverinfo.json'), JSON.stringify(jsonData.ServerInfo), function (err) {
          if (err) throw err;
          console.log('ServerInfo saved to ' + server.name + '/serverinfo.json');
        });
      }
      else {
        console.log(+ ' response:', response);

      }
    } catch (error) {
      console.error('Error parsing JSON for ' + server.name + ':', error);
    }
  });

  client.on('error', function (err) {
    console.log(server.name + ' error:', err);
  });

  client.on('close', function () {
    console.log(server.name + ' closed');
    createClient(server);
  });

  client.start();

  // Send requests to each client every 6 seconds
  setInterval(() => {
    setTimeout(() => {
      client.send('ServerInfo' + '\n');
    }, 200);

    setTimeout(() => {
      client.send('InspectAll' + '\n');
    }, 400);
    setTimeout(() => {
      fs.writeFile(path.join(dataFolder,'all-data', 'all-data.json'), JSON.stringify(jsonAllData), function (err) {
        if (err) throw err;
        console.log('ServerInfo saved to ' + server.name + '/serverinfo.json');
      });
    }, 2600);
  }, 6000);
}

function mapLabelChanged(newMapLabel, id) {
  return new Promise((resolve, reject) => {
    console.log(`MapLabel changed to: ${newMapLabel}`);

    scrapeImageInfo(id)
      .then(data => {
        if (data.error) {
          console.log(data.error);
          resolve([]);
        } else {
          console.log('Image URL:', data.imageUrl);
          console.log('Alt:', data.alt);
          resolve([data.imageUrl, data.alt]);
        }
      })
      .catch(error => {
        console.error('Error:', error.message);
        reject([]);
      });
  });
}

app.listen(port, function() {
  console.log('API server listening on port ' + port);
});
