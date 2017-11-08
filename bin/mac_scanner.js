#!/usr/bin/env node
////REMEMBER TO TAKE ALL OF THE CONSOLE LOGGING OUT OF HERE
////I have tested the ideal working scenario but not all of the possible failures
////Error handeling and logging needs to be worked on.

//Check if sudo.  This script only works if you run as sudo because arp-scan requires it.

//Import mailer module
var mailer = require('../private/mailer');

//Import database module
var db = require('../private/db.js');

//Import config for subnets
var config = require('../private/config.js');

//For comparing arrays
Array.prototype.diff = function(a) {
  return this.filter(function(i) {return a.indexOf(i) < 0;});
};

//For making arrays unique
Array.prototype.unique = function() {
  return [...(new Set(this))];
}

//For grouping assets by MAC address.  These loops are ugly but work.  There is probably a more clever way to do this.
function groupByMac(addressArray) {
  groupedArray = []
  //Loop through array of assets
  for (i=0; i < addressArray.length; i++) {
    var contains = false;
    //Get rid of (DUP) label that is added to some vendors
    addressArray[i].Vendor = addressArray[i].Vendor.split("(DUP")[0]
    //Loop through items that have already been grouped
    for (j=0; j < groupedArray.length; j++){
      //If a Mac already exists in the grouped set...
      if (groupedArray[j].MAC == addressArray[i].MAC) {
        contains = true;
        //Push the IP address to thr grouped object
        groupedArray[j].IP.push(addressArray[i].IP[0]);
        //Remove dupliacte IP addresses
        groupedArray[j].IP = groupedArray[j].IP.unique();
        break;
      }
    }
    if (!contains) {
      groupedArray.push(addressArray[i]);
    }
  }
  return groupedArray
}

//Define scanning promise
function getScanResults(cidr){
  return new Promise(function(resolve, reject){
    const { exec } = require('child_process');
    exec('arp-scan '+cidr, (err, stdout, stderr) => { 
      if (err) {
        reject(Error(err));
      }
      else if (stderr) {
        reject(Error(stderr));
      }
      else {
        resolve(stdout);
      }
    });
  });
}

//Setup promise that should return an array of objects.  Each object should have a MAC,IP, and Vendor property.  These represent the results of arp-scan agains all cidr networks in config.js
var returnNetworkAssets = new Promise(function(resolve, reject){
  //Setup scanning promises for all network ranges
  var promises = config.CidrRanges.map(function(cidr){
    return getScanResults(cidr);
  });

  //Execute promises and get results of scans
  Promise.all(promises)
    .then(function(data){
      var  combinedResults = []

      for (i=0; i < data.length; i++){
        linesFromScan = data[i].split("\n");

        for (j = 2; j < (linesFromScan.length - 4); j++) { 
          var splitLines = linesFromScan[j].split('\t')
          var assetObject = {}
          assetObject.MAC = splitLines[1]
          assetObject.IP = []
          assetObject.IP.push(splitLines[0])
          assetObject.Vendor = splitLines[2]
          combinedResults.push(assetObject)
        }
      }

      resolve(groupByMac(combinedResults));
    })
    .catch(function (error){
      reject(Error(error));
    });
});


//Setup Promise that should return all MAC addresses from the database
var getMacsFromDatabase = new Promise(function(resolve, reject){
  db.assets.returnAllMacs(function(err, results, fields) {
    if(!err){
      var databaseMacAddresses = []

      for (i=0; i < results.length; i++){
        databaseMacAddresses.push(results[i].MAC);
      }

      resolve(databaseMacAddresses);
    } else {
      console.log(err);
      reject(Error(err));
    }
  });
});

//Scan network and query database.  Then compare results
function checkScanAndCheckDatabase(cb) {
  Promise.all([returnNetworkAssets, getMacsFromDatabase])
    .then(function(data){
      var scanResults = data[0];
      var databasesAddresses = data[1];

      var newAddresses = []
      for (i = 0; i < scanResults.length; i++){
        var contains = false;

        for (j=0; j<databasesAddresses.length; j++){
          if(scanResults[i].MAC == databasesAddresses[j]){
            contains = true;
            break;
          }
        }
        if (!contains){
          newAddresses.push(scanResults[i]);
        }
      }
      cb(null, scanResults, databasesAddresses, newAddresses);
    })
    .catch(function (error){
      reject(Error(error));
    });
}

checkScanAndCheckDatabase(function(err, scanResult, databaseMacAddresses, newAddresses){
  if(!err){
    if (newAddresses.length > 0){
      var body = "New MAC addresses detected on network.\r\n"
      for (i=0; i < newAddresses.length; i++){
        body +="MAC Address: "+newAddresses[i].MAC+"   "
        body +="IP Address: "+newAddresses[i].IP+"   "
        body +="Vendor: "+newAddresses[i].Vendor+"\r\n"
      }
      mailer.sendMessage("New Devices Detected", body, function(err, message){
        if (err){
          console.log(err);
        }
      });
    }
    db.assets.upsertMany(scanResult, function(err){
      console.log(err);
      console.log("done");
      db.dbConnection.disconnect(function(){});
    });
  }
});