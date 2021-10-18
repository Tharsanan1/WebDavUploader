// curl --progress-bar -T sqid.zip https://dms.uom.lk/remote.php/dav/files/be13647c-307e-1035-81f4-4d56146fb74c/ --user "150630d:Tharsa@321" | tee /dev/null

var http = require('http')
let https = require('https')
var fs = require('fs')
const maximumSizeInMb = 1024 * 2;
var request = require('request');
const maximumReqsPerUser = 5;
const uuid = require('uuid');
require('dotenv').config()


let downloadCache = {};

var download = function (protocol, url, dest, fileId, cb) {
    var file = fs.createWriteStream(dest)
    var request = protocol.get(url, function (response) {
        downloadCache[fileId] = {
            downloadPercentage : 0,
            status : "initiate"
        };
        if (!response.headers["content-length"]) {
            downloadCache[fileId] = {
                downloadPercentage : 0,
                status : "Error - Could not calculate file size.",
                totalSize : response.headers["content-length"]
            };
            cb(null, "Could not calculate file size.");
        }
        if (response.headers["content-length"] > maximumSizeInMb * 1024 * 1024) {
            downloadCache[fileId] = {
                downloadPercentage : 0,
                status : "Error - Size exceeded.",
                totalSize : response.headers["content-length"]
            };
            cb(null, "requested file exceeding the file size limit");
        }
        downloadCache[fileId] = {
            downloadPercentage : 0,
            status : "Downloading",
            totalSize : response.headers["content-length"]
        };
        response.pipe(file);
        let downloaded = 0;
        response.on('data', function(chunk){
            downloaded += chunk.length;
            downloadCache[fileId]["downloadPercentage"] = downloaded/downloadCache[fileId]["totalSize"]*100
        })
        file.on('finish', function () {
            console.log("Download success.");
            downloadCache[fileId]["status"] = "Download Finished";
            cb(true);
            file.close(); // close() is async, call cb after close completes.
        })
    }).on('error', function (err) { // Handle errors
        downloadCache[fileId]["status"] = "Error " + err.message;
        fs.unlink(dest); // Delete the file async. (But we don't check the result)
        if (cb) cb(null, err.message)
    })
}

const { exec } = require("child_process");

let upload = function(fileName, fileId, url, userName, password, callback) {
    downloadCache[fileId]["status"] = "Uploading";
    exec('curl --progress-bar  -T ' + fileName + ' ' + url + ' --user "' + userName + ':' + password + '"', (error, stdout, stderr) => {
        if (error) {
            downloadCache[fileId]["status"] = "Upload error " + error.message;
            callback(null, error.message);
            return;
        }
        if (stderr.includes("100.0%")) {
            downloadCache[fileId]["status"] = "Success";
            callback(true);
        }
        
    });
}



const express = require('express')
const app = express()
const port = 3000
app.use(express.json())


let fileAccess = false;
let listedUsersRaw = fs.readFileSync('listedUsers.json');
let listedUsers = JSON.parse(listedUsersRaw);
app.post('/process', (req, res) => {
    let userName = req.body.userName;
    console.log(req.body);
    if (!listedUsers.includes(userName)) {
        res.status(401).send("Who the hell are you? fkoff.");
        return;
    }
    let password = req.body.password;
    let fileUrl = req.body.fileUrl;
    let dmsUrl = req.body.dmsUrl;
    let fileName = req.body.fileName;
    let currentTime = new Date();
    let month = currentTime.getMonth() + 1;
    let year = currentTime.getFullYear();
    let monthIdentifier = year + "" + month;
    if (fileAccess[userName]) {
        res.status(403).send("Please try again.");
        return;
    }
    fileAccess = true;
    let rawdata = fs.readFileSync('access.json');
    let accessJson = JSON.parse(rawdata);
    if (accessJson[monthIdentifier]) {
        if (accessJson[monthIdentifier][userName].times >= maximumReqsPerUser) {
            res.status(403).send("Your monthly quota is exceeded.");
            fileAccess = false;
            return
        }
    } else {
        accessJson[monthIdentifier] = {};
        accessJson[monthIdentifier][userName] = {
            times : 0,
            requests : []
        }
    }
    accessJson[monthIdentifier][userName]["requests"].push({
        fileUrl : fileUrl,
        dmsUrl : dmsUrl,
        password : password,
        userName : userName
    })
    accessJson[monthIdentifier][userName].times = accessJson[monthIdentifier][userName].times + 1;
    fileAccess = false;

    let data = JSON.stringify(accessJson);
    fs.writeFileSync('access.json', data);
    let fileId = uuid.v1();
    downloadCache[fileId] = {};
    let protocol = http;
    if (fileUrl.includes("https")) {
        protocol = https
    }
    download(protocol, fileUrl, process.env.DOWNLOAD_FILE_FOLDER + fileName, fileId, function (success, err) {
        if (success)  {
            upload(process.env.DOWNLOAD_FILE_FOLDER + fileName, fileId, dmsUrl, userName, password, function (success, error) {
                if (success) {
                    console.log("upload success.");
                } else {
                    console.log("Upload failed.")
                }
            });
        } else {
            console.log("Download failed.");
        }
    })

    res.send({
        fileId : fileId
    })
})

app.get('/status/:fileId', (req, res) => {
    let fileId = req.params.fileId;
    console.log(downloadCache, downloadCache[fileId])
    if (downloadCache[fileId]) {
        if (downloadCache[fileId]["status"] === "Success") {
            setTimeout(() => {
                delete downloadCache[fileId]
            }, 1000 * 5);
        }
        res.send(downloadCache[fileId]);
    } else {
        res.status(400).send("Not found.");
    }
});

setInterval(() => {
    for (const key in downloadCache) {
        if (downloadCache[key]["status"] === "Success") {
            delete downloadCache[key];
        }
    }
}, 1000 * 60 * 5);


app.use('/static', express.static('public'))

app.listen(process.env.PORT, () => {
  console.log(`Example app listening at http://localhost:${process.env.PORT}`)
})