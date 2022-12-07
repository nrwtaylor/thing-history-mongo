#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const {
  promises: { readFile },
} = require("fs");

const axios = require("axios");

const datagrams = [{}];

// 14 November 2022
console.log("thing-history-memcached-mongo 1.0.0 6 December 2022");

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
var from = process.env.FROM;

var historyWindowSize = process.env.HISTORY_WINDOW_SIZE; //8;

var to = "history";

const keyPathname = process.env.KEY_PATHNAME;
const snapshotPathnames = process.env.SNAPSHOT_PATHNAMES.split(",");


const x = readJsonFile("/home/nick/codebase/thing-history-mongo/snapshots.json");
console.log("xxxx", x);

the_interval = interval_milliseconds;

const intervals = [
  { milliseconds: the_interval, text: "" },
  { milliseconds: 10000, text: "10s", comment:"test" },
  { milliseconds: 30000, text: "30s", comment:"test" },
  { milliseconds: 60000, text: "1m" },
  { milliseconds: 120000, text: "2m" },
  { milliseconds: 600000, text: "10m" },
  { milliseconds: 900000, text: "15m" },
  { milliseconds: 1800000, text: "30m" },
  { milliseconds: 3600000, text: "1h" },
];

const  currentPollInterval = the_interval;


function StartInterval(text, frequency) {
    setInterval(function(){
//        myfunction(index);
handleLine(text);
    },frequency);
}


for(i=0;i<intervals.length;i++){
    StartInterval(intervals[i].text, intervals[i].milliseconds)
}


function handleLine(input) {
  var agent_input = "snapshot";

  var line = "";
  if (!(input === null || input === "")) {
    line = "-" + input;
  }

  //  if (input.text) {line = input.text === "" ? "" : "-"+input.text;}

  const timestamp = new Date();
  const utc = timestamp.toISOString();
  try {
    const promiseArray = snapshotPathnames.map((snapshotPathname) => {
      return readUrl(snapshotPathname);
    });



    const readStartTime = new Date();
    Promise.all(promiseArray).then((promises) => {
      const readRunTime = new Date() - readStartTime;
      console.log("Read file in", readRunTime, "ms.");

      const data = promises[0];
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

            const uuid = "56f2dbb4-fde9-4f5c-89cf-35fb19494b8e";
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
//thing-history-memcached-mongo            console.log("slug+line", slug + line);
            // Do Mongo write here

            getHistory(slug + line)
              .then((result) => {

//                console.log("result slug+line", slug + line, result);

                var isValidHistory = false;
                if (result && result.agent_input) {
                  isValidHistory = Array.isArray(result.agent_input);
                }
                const event = { event: value, eventAt: getTimestamp() };
                //                var items = [event];
                var items = [];
                if (isValidHistory) {
                  items = result.agent_input;
                }
                items.push(event);

                const slicedItems = items.slice(-1 * historyWindowSize);
//                console.log("slicedItems", slicedItems);
                setHistory(slug + line, slicedItems);

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
                setHistory(slug + line, value);
              });
          });
        }
      });

      const totalRunTime = new Date() - readStartTime;
      console.log("totalRunTime", totalRunTime, "ms");
    });
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

  var parsed = "";
  //const snapshotPath = "/tmp/" + slug + ".json";
  const snapshotPath = keyPathname + slug + ".json";
  console.log("snapshotPath", snapshotPath);

  const p = new Promise((resolve, reject) => {
    //    if (fileFlag === true) {
    fs.readFile(snapshotPath, "utf8", (err, data) => {
      //console.log("Reading file at " + snapshotPath + ".");

      if (err) {
        agent_input = `Error reading file from disk: ${err}`;
        console.log(agent_input);
        reject({ error: agent_input });
      } else {
        agent_input = data;

        try {
          parsed = JSON.parse(agent_input);
        } catch (e) {
          parsed = { error: "JSON parse error" };
          reject(parsed);
        }

        const timestamp = new Date();
        const utc = timestamp.toUTCString();

        parsed = { ...parsed, refreshedAt: utc };

        resolve(parsed);
      }
    });
    //    }

    if (urlFlag === false) {
      console.log("URL");
      const h =
        "https://stackr.ca/snapshot/56f2dbb4-fde9-4f5c-89cf-35fb19494b8e/coop-temperature-humidity.json";
      return axios
        .get(h, {
          headers: {
            "Content-Type": "application/json",
          },
        })
        .then((result) => {
          console.log(result.data.thingReport);

          var parsed = result.data.thingReport;
          const timestamp = new Date();
          const utc = timestamp.toUTCString();

          parsed = { ...parsed, refreshedAt: utc };
          resolve(parsed);
        })
        .catch((error) => {
          console.log("Axios error", error);
          reject(error);
        });
    }
  });
  console.log("p", p);
  return p;
}

function setHistory(slug, history) {
  console.log("setHistory slug", slug);
  var arr = {
    from: from,
    to: to,
    subject: slug,
    agent_input: history,
    precedence: "routine",
    interval: currentPollInterval,
  };
  var datagram = JSON.stringify(arr);

  var snapshot = JSON.stringify({
    ...arr,
    //    thingReport: { snapshot: parsed },
  });

  if (true) {
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

  console.log("insertedId", insertedId);

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
        //console.log("thing_report", thing_report);
        // console.log("requested_poll_interval", requestedPollInterval);

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

        // console.log(thing_report);
        // console.log(thing_report.link);
        //    const image_url = thing_report && thing_report.link ? thing_report.link + '.png' : null

        const image_url =
          thing_report && thing_report.image_url
            ? thing_report.image_url
            : null;

        // console.log(image_url);
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

    fs.readFile(f, "utf8", (err, data) => {
      //console.log("Reading file at " + snapshotPath + ".");

      if (err) {
        agent_input = `Error reading file from disk: ${err}`;
        console.log(agent_input);
        reject({ error: agent_input });
      } else {
        agent_input = data;
console.log(data);
        try {
          parsed = JSON.parse(agent_input);
console.log(parsed);
        } catch (e) {
console.log(e);
          parsed = { error: "JSON parse error" };
//          reject(parsed);
console.log(parsed);
return true;
        }

        const timestamp = new Date();
        const utc = timestamp.toUTCString();

        parsed = { ...parsed, refreshedAt: utc };
return parsed;
//        resolve(parsed);
      }
    });



}
