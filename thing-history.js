#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const {
  promises: { readFile },
} = require("fs");

const axios = require("axios");

const express = require('express');
const app = express();

app.get('/history/:slug.json', (req, res) => {
const slug = req.params.slug;

const text = "history-" + slug + "";
console.log("text",text);
const r = getHistory(text);
console.log("r",r);
r.then((result) =>{

const t = {
uuid:result.from,
thing:{uuid:result.from, to:result.to,subject:result.subject},
thingReport:{history:result.agent_input}}

    res.send(t);
}).catch((error)=>{


});
});


var port = process.env.PORT;

app.listen(port, () => console.log('Listening on port ' + port));

const datagrams = [{}];

// 14 November 2022
console.log("thing-history-memcached-mongo 1.0.1 7 December 2022");

const fileFlag = false;
const urlFlag = true;

// And then quiet.
//console.log = function() {}

/*
Standard stack stuff above.
*/

const { MongoClient } = require("mongodb");

var url = "mongodb://localhost:27017/stack";
const client = new MongoClient(url);
const dbName = "variables";

client.connect();

const db = client.db(dbName);
const collection = db.collection("slugs");

var hosts = process.env.STATIONS.split(" ");
var channel = process.env.CHANNEL;
var transport = process.env.TRANSPORT;
var interval_milliseconds = process.env.INTERVAL;
var http_transport = process.env.HTTP_TRANSPORT;
var station = process.env.STATION;

var historyWindowSize = process.env.HISTORY_WINDOW_SIZE; //8;

var to = "history";

const keyPathname = process.env.KEY_PATHNAME;

// Get snapshots to generate histories for.
const snapshotPathnames = readJsonFile(
  "/home/nick/codebase/thing-history-mongo/snapshots.json"
);

the_interval = interval_milliseconds;

const intervals = [
//  { milliseconds: the_interval, text: "" },
//  { milliseconds: 10000, text: "10s", comment: "test" },
//  { milliseconds: 30000, text: "30s", comment: "test" },
  { milliseconds: 60000, text: "1m" },
  { milliseconds: 120000, text: "2m" },
  { milliseconds: 600000, text: "10m" },
  { milliseconds: 900000, text: "15m" },
  { milliseconds: 1800000, text: "30m" },
  { milliseconds: 3600000, text: "1h" },
];

const currentPollInterval = the_interval;

function StartInterval(text, frequency) {
  setInterval(function () {
    snapshotPathnames.map((snapshotPathname) => {
      handleLine(text, snapshotPathname);
    });
  }, frequency);
}

for (i = 0; i < intervals.length; i++) {
  StartInterval(intervals[i].text, intervals[i].milliseconds);
}

function handleLine(input, snapshotPathname) {
  var agent_input = "snapshot";

  var line = "";
  if (!(input === null || input === "")) {
    line = "-" + input;
  }

  const timestamp = new Date();
  const utc = timestamp.toISOString();
  try {

    const readStartTime = new Date();

    readUrl(snapshotPathname)
      .then((data) => {
        const readRunTime = new Date() - readStartTime;

        console.log("Read file in", readRunTime, "ms.");

        agent_input = data;
        parsed = data;

        parsed = { ...parsed, refreshedAt: utc };

        Object.keys(parsed).forEach((name) => {
          if (
            ["ping", "transducers", "cellular-modem", "snapshot"].includes(name)
          ) {
            const elements = parsed[name];

            Object.keys(elements).forEach((elementText) => {
              const startTime = new Date();

              const uuid = extractUuid(snapshotPathname);
              const slug = (
                "history" +
                "-" +
                uuid +
                "-" +
                name +
                "-" +
                elementText
              ).toLowerCase();
              const key = slug;

              const value = elements[elementText];
              // Do Mongo write here

              getHistory(slug + line)
                .then((result) => {

                  var isValidHistory = false;
                  if (result && result.agent_input) {
                    isValidHistory = Array.isArray(result.agent_input);
                  }
                  const event = { event: value, eventAt: getTimestamp() };
                  var items = [];
                  if (isValidHistory) {
                    items = result.agent_input;
                  }
                  items.push(event);

                  const slicedItems = items.slice(-1 * historyWindowSize);
                  setHistory(slug + line, slicedItems, uuid);

                  const runTime = new Date() - startTime;
                  console.info(
                    slug + line,
                    "processed in",
                    runTime,
                    "ms",
                    "has",
                    slicedItems.length,
                    "items."
                  );
                })
                .catch((error) => {
                  console.error("getHistory error", error);
                  setHistory(slug + line, value, uuid);
                });
            });
          }
        });

        const totalRunTime = new Date() - readStartTime;
        console.log("totalRunTime", totalRunTime, "ms");
      })
      .catch((error) => {
        console.log(error);
      });
    //    });
  } catch (err) {
    console.log("Promise all error", err);
  }
}

function getTimestamp() {
  const timestamp = new Date();
  const utc = timestamp.toISOString();
  return utc;
}

async function getHistory(slug) {
  const thing = await collection.findOne({ subject: slug });
  return thing;
}

function setHistory(slug, history, uuid) {
  console.log("setHistory slug", slug);
  var arr = {
    from: uuid,
    to: to,
    subject: slug,
    agent_input: history,
    precedence: "routine",
    interval: currentPollInterval,
  };
  var datagram = JSON.stringify(arr);

  var snapshot = JSON.stringify({
    ...arr,
  });

  if (false) {
    fs.writeFile(
      keyPathname + slug + ".json",
      snapshot,
      "utf8",
      function (err) {
        if (err) return console.log(err);
      }
    );
  }
  const event = new Date(Date.now());

  // https://stackoverflow.com/questions/13808389/node-js-mongodb-upsert-update
  // https://www.mongodb.com/docs/drivers/node/current/fundamentals/crud/write-operations/upsert/
  const { insertedId } = collection.updateOne(
    { subject: slug },
    { $set: arr },
    { upsert: true }
  );

  if (transport === "apache") {
    axios
      .post(http_transport, datagram, {
        headers: {
          "Content-Type": "application/json",
        },
      })
      .then((result) => {
        //              console.log("result", result);
        const thing_report = result.data.thingReport;

        const requestedPollInterval =
          thing_report && thing_report.requested_poll_interval;

        if (
          parseFloat(requestedPollInterval) !== parseFloat(currentPollInterval)
        ) {
          if (requestedPollInterval === "x") {
          } else if (requestedPollInterval === "z") {
          } else {
            var i = parseFloat(requestedPollInterval);
            clearInterval(interval);
            interval = setInterval(function () {
              // do your stuff here
              // console.log("hosts", hosts);
              hosts.map((h) => {
                var host = h;
                handleLine(null);
              });
              currentPollInterval = i;
            }, i);
          }
        }

        // Create a fallback message.
        // Which says 'sms'.
        sms = "sms";
        message = "sms";

        try {
          //      var thing_report = JSON.parse(job.response);
          var sms = thing_report.sms;
          var message = thing_report.message;
          //var agent = thing_report.agent;
          //var uuid = thing_report.thing.uuid;
        } catch (e) {
          console.log(e);

          var sms = "quiet";
          var message = "Quietness. Just quietness.";
        }

        const image_url =
          thing_report && thing_report.image_url
            ? thing_report.image_url
            : null;

        if (sms !== null) {
          if (image_url === null) {
            console.log(sms);
            //        discordMessage.channel.send(sms);
          } else {
            console.log(sms);
            console.log("image(s) available");
            //        discordMessage.channel.send(sms, { files: [image_url] });
          }
        }
      })
      .catch((error) => {
        console.log("POST ERROR", http_transport);
        Promise.resolve("ignore");
      });
  }
}

// Consider caching of readUrl
function readUrl(h) {
  return axios
    .get(h, {
      headers: {
        "Content-Type": "application/json",
      },
    })
    .then((result) => {
      //console.log(result.data);
      return result.data.thingReport;
    })
    .catch((error) => {
      console.error("readUrl error", error);
    });
}

function readJsonFile(f) {
  console.log(f);

  const data = fs.readFileSync(f, "utf8");
  return JSON.parse(data);
}

function extractUuid(input) {
  const uuids = extractUuids(input);

  if (uuids.length === 1) {
    return uuids[0];
  }

  return false;
}

function extractUuids(input) {
  pattern = /[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/g;

  return input.match(pattern);
}
