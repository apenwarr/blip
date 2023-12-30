/*
 * Copyright 2013 Google Inc. All Rights Reserved.
 * Copyright 2013 Avery Pennarun. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const localColor = 'rgba(0,128,0,0.8)';
const internetColor = 'rgba(0,0,255,0.8)';
const dnsColor = 'rgba(0,0,0,1.0)';

const vbarColor = 'rgba(128,128,128,1.0)';
const vbarEraseColor = 'rgba(255,255,255,1.0)'

let running = true;
let wantDns = false;
let dnsName;

let now;
if (window.performance && window.performance.now) {
  now = function() { return window.performance.now(); };
} else {
  now = function() { return new Date().getTime(); };
}

// Sigh, not all browsers have Object.values yet.  Use the shim
// unconditionally to avoid any obscure incompatibilities.
function getValues(obj) {
  let out = [];
  for (let i in obj) {
    out.push(obj[i]);
  }
  return out;
};

let bestNextFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function(callback) {
      setTimeout(callback, 1000 / 60);
    };
const brokenRTT = 1e6;      // RTT that means we didn't get valid answer
const minReasonableRTT = 2; // browser might reject invalid URLs in < this time
const msecMax = 2200;       // max timeout that fits on the chart
const log_msecMax = Math.log(msecMax * 1.5);
const absolute_mindelay = 10;
let mindelay = absolute_mindelay;
let lastBotch = 0;

// constructor
function BlipCanvas(canvas, width) {
  this.canvas = canvas;
  this.canvas.width = 1000;
  this.canvas.height = 1000;
  this.ctx = this.canvas.getContext('2d');
  this.xofs = 100;
  this.current_x = 0;
  this.xdiv = width / 1000;

  this.drawYAxis = function() {
    let labels = [2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    this.ctx.fillStyle = 'black';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'right';
    this.ctx.font = '32px Arial';
    for (let i = 0; i < labels.length; i++) {
      let msecs = labels[i];
      this.ctx.fillText(msecs, (this.xofs - 10), this.msecToY(msecs));
    }
    this.ctx.scale(1, 2);
    this.ctx.textAlign = 'center';
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.font = '24px Arial';
    this.ctx.fillText('milliseconds', -this.canvas.height / 2 / 2, 16);
    this.ctx.rotate(Math.PI / 2);
    this.ctx.scale(1, 1 / 2);
  };

  this.nextX = function(msecs) {
    let steps = msecs / absolute_mindelay;
    if (steps > 100) {
      steps = 100;
    }
    let x_inc = steps / this.xdiv;
    let new_x = (this.current_x + x_inc) % (this.canvas.width - this.xofs);

    // draw the new bar
    this.ctx.fillStyle = vbarColor;
    this.ctx.fillRect(new_x + this.xofs + 1, 0,
                      4, this.canvas.height);

    // wipe out the old bar
    this.ctx.fillStyle = vbarEraseColor;
    this.ctx.fillRect(this.current_x + this.xofs, 0,
                      x_inc + 1, this.canvas.height);
    if (new_x < this.current_x) {
      this.ctx.fillRect(this.xofs, 0,
                        new_x - 1, this.canvas.height);
    }
    this.current_x = new_x;
  };

  this.msecToY = function(msecs) {
    return this.canvas.height -
        (Math.log(msecs) * this.canvas.height / log_msecMax);
  };

  this.drawBlip = function(color, startTime, endTime, minlatency, width) {
    let msecs = endTime - startTime;
    if (msecs < minlatency) {
      // impossibly short; that implies we're not actually reaching the
      // remote end, probably because we're entirely offline
      lastBotch = endTime;
    }
    if (endTime > 2100 && endTime - lastBotch < 2100) {
      // if there were any "offline" problems recently, there might be
      // a bit of jitter where some of the requests are a bit slower than
      // the impossible timeout, but that doesn't mean it's working yet.
      // So stop reporting for a minimum amount of time.  During that time,
      // we just want to show an error.
      msecs = msecMax;
    }
    let y = this.msecToY(msecs);
    let x = this.current_x + this.xofs;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width, y - 15, 1 + width, 31);
    if (msecs >= msecMax) {
      this.ctx.fillStyle = '#f00';
      this.ctx.fillRect(x - 1 - width, y - 5, 2 + width, 20);
    }
  };
};

const c1 = new BlipCanvas($('#hires')[0], 1000);
const c2 = new BlipCanvas($('#lores')[0], 10000);
const c3 = new BlipCanvas($('#vlores')[0], 100000);

const blips = [];

function addBlip(color, url, minlatency) {
  blips.push({color: color, url: url, minlatency: minlatency});
};

function gotBlip(color, url, minlatency, startTime) {
  const endTime = now();
  const blipWidth = url ? 1 : 3;
  c1.drawBlip(color, startTime, endTime, minlatency, blipWidth);
  c2.drawBlip(color, startTime, endTime, minlatency, blipWidth);
  c3.drawBlip(color, startTime, endTime, minlatency, blipWidth);
  addBlip(color, url, minlatency);
};

if (AbortSignal.timeout === undefined) {
  const controller = new AbortController();
  const signal = controller.signal;
  AbortSignal.timeout = function(msec) {
    setTimeout(() => controller.abort(), msec);
    return signal;
  }
}

function startFetch(url, msecTimeout) {
  return fetch(url, {
    method: 'HEAD',
    mode: 'no-cors',
    cache: 'no-cache',
    priority: 'high',
    signal: AbortSignal.timeout(msecTimeout),
  });
}

function startBlips() {
  while (blips.length) {
    let blip = blips.shift();
    if (!blip.url && !wantDns) {
      let createResult = function(blip) {
        return function() {
          addBlip(blip.color, blip.url, blip.minlatency);
        }
      };
      let result = createResult(blip);
      setTimeout(result, 1000);
    } else {
      let createResult = function(blip) {
        let startTime = now();
        let result = function() {
          gotBlip(blip.color, blip.url, blip.minlatency, startTime);
        };
        return result;
      };
      let result = createResult(blip);
      let url = blip.url;
      if (!blip.url) {
        // Desired URL format:
        //   https://x<rand>.<ndt_site>.blipdns.apenwarr.ca:<port>
        url = 'https://' +
                'x' + Math.floor(Math.random()*1e9) +
                '.' + dnsName +
                '.blipdns.apenwarr.ca:8999';
        }

      startFetch(url, msecMax).then(result, result);
    }
  }
};

let lastTick = now(), lastStart = lastTick;
function gotTick() {
  let t = now();
  let tdiff = t - lastTick;
  if (running) {
    if (tdiff >= absolute_mindelay) {
      if (t - lastStart > mindelay) {
        lastStart = t;
        startBlips();
      }
      c1.nextX(tdiff);
      c2.nextX(tdiff);
      c3.nextX(tdiff);
      lastTick = t;
    }
    bestNextFrame(gotTick);
  }
};

function toggleBlip() {
  if (running) {
    running = 0;
  } else {
    running = 1;
    lastTick = now();
    bestNextFrame(gotTick);
  }
};

function toggleDns() {
  wantDns = dnsName && !wantDns;
};

async function pickBestSite(hosts, minNeeded, maxParallel) {
  let hostsFinished = 0;
  let outstanding = 0;
  let promiseDone;
  let promise = new Promise((resolve, reject) => { promiseDone = resolve; });
  let queue = [];

  for (let h of hosts) {
    h.minRTT = brokenRTT;
    h.nProbes = 0;
  }

  let runTest = async function(h) {
    const startTime = now();
    outstanding++;
    try {
      await startFetch(h.url, msecMax * 1.5);
    }
    catch (e) {
      const rtt = now() - startTime;
      if (!(e instanceof TypeError)) {
        // timed out, or some non-network error
        console.log('Server check failed:', h, e);
        if (queue.length > 0) {
          return runTest(queue.shift());
        }
        // (don't increment hostsFinished here, since although this host is
        // "finished" it didn't give valid results.)
        outstanding--;
        if (outstanding==0) {
          promiseDone();
        }
        return;
      }
      // otherwise fall through and consider the probe to have passed
    }
    outstanding--;

    const rtt = now() - startTime;
    if (rtt < h.minRTT && rtt >= minReasonableRTT) {
      h.minRTT = rtt;
    }
    h.nProbes++;

    // try each host 3 times
    if (h.nProbes < 3) {
      queue.push(h);
    } else {
      if (h.minRTT < brokenRTT) {
        hostsFinished++;
        if (hostsFinished <= minNeeded) {
          console.log('Tested #' + hostsFinished +
              ' (target ' + minNeeded + '):',
              Math.round(h.minRTT) + 'ms',
              h.label, 'qlen', queue.length, 'outstanding', outstanding);
        }
      } else {
          console.log('Tested #(' + hostsFinished +
              ') (target ' + minNeeded + '):',
              '(too fast)' + 'ms',
              h.label, 'qlen', queue.length, 'outstanding', outstanding);
      }
      if (hostsFinished == minNeeded || outstanding == 0) {
        promiseDone();
      }
    }

    if (queue.length > 0 && hostsFinished < minNeeded) {
      runTest(queue.shift());
    }
  }

  for (let hi in hosts) {
    queue.push(hosts[hi]);
  }

  // start the first few tests in parallel
  for (let i = 0; i < maxParallel && queue.length > 0; i++) {
    runTest(queue.shift());
  }

  await promise;

  // when done enough of them...
  hosts.sort((a, b) => (a.minRTT - b.minRTT));
  console.log('pickBest', hosts);

  return hosts;
}

// Pick an Internet site with reasonably high latency (at least, higher than
// the usually-very-low-latency gstatic.com) to add contrast to the graph.
//
// Nobody really cares about apenwarr.ca, which is just hosted on a cheap
// VPS somewhere.  If you overload it, I guess I'll be sort of impressed
// that you like my program.  So, you know, whatever.
//     -- apenwarr, 2013/04/26
async function pickMlabSite() {
  let response = await fetch('https://mlab-ns.appspot.com/ndt_ssl?policy=all');

  // We want the selected hostname to be reasonably stable across page reloads
  // from a single location, even on separate devices.  To help with this,
  // choose only from the first server in the first city in each country.
  // The latency between countries is hopefully different enough that there
  // should be little jitter.
  if (!response.ok) {
    console.error('m-lab response error:', response);
    return;
  }

  let ndt = await response.json();
  console.log('m-lab index:', ndt);

  let allHosts = [];
  for (let n of ndt) {
    // put the sort keys in the desired order
    allHosts.push([n.country, n.city, n.site, n.fqdn, n]);
  }
  allHosts.sort();

  let hosts = {};
  for (let i in allHosts) {
    let h = allHosts[i][4];
    let k = h.country + ' ' + h.city;
    if (!hosts[k]) {
      hosts[k] = {
        label: h.city + ', ' + h.country,
        url: 'https://' + h.fqdn,
        site: h.site,
      };
    }
  }

  // convert dict back into a list
  hosts = getValues(hosts);

  const need1 = Math.floor(Object.keys(hosts).length / 4), need2 = 10;
  const minNeeded = need1 < need2 ? need2 : need1;
  const maxParallel = 20;

  let results = await pickBestSite(hosts, minNeeded, maxParallel);

  // Pick a desirable entry.
  // The "fastest" server seems like an obvious choice, but it might not
  // test the "real" long-distance Internet link quality, so we opt for
  // something a little further away.
  let best = results[1];
  dnsName = best.site;
  $('#internetlegend').html('&#x275a; ' + best.label);
  addBlip(internetColor, best.url, 5);
}

async function pickLocalSite() {
  let tryFastSites = [
    '192.168.0.1',
    '192.168.1.1',
    '192.168.2.1',
    '192.168.3.1',
    '192.168.4.1',
    '10.0.0.1',
    '10.1.1.1',
    'gstatic.com',
  ];

  // Add the internet-facing client IP address (ie. after NATting).
  // This is not quite as good as the local router IP, but seems to
  // generally work pretty well as long as your ISP gives Connection Refused
  // instead of blackholing TCP connection requests.
  let cipr = await (await fetch('https://apenwarr.ca/blip/clientip')).json();
  let cip = cipr['client_ip'];
  console.log('clientip', cip);
  tryFastSites.unshift(cip);

  let hosts = [];
  for (let s of tryFastSites) {
    hosts.push({
      label: s,
      url: (s=='gstatic.com'
            ? 'http://' + s + '/generate_204'
            : 'http://' + s + ':8999/generate_204'),
    });
  }

  const minNeeded = 1, maxParallel = 20;

  let results = await pickBestSite(hosts, minNeeded, maxParallel);

  let fastest = results[0];
  $('#locallegend').html('&#x275a; ' + fastest.label);
  addBlip(localColor, fastest.url, 0);
}

async function start() {
  c1.drawYAxis();

  // This one uses apenwarr.ca by default. Please be polite if modifying
  // blip to send a lot more traffic than usual.
  addBlip(dnsColor, null, 5);

  // this starts the polling and animation
  bestNextFrame(gotTick);

  // this will async add the "local-ish" blip
  await pickLocalSite();

  // this will async add the "Internet" blip
  await pickMlabSite();
}
