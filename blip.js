/*
 * Copyright 2013 Google Inc. All Rights Reserved.
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

const localColor = 'rgba(0,0,255,0.8)';
const internetColor = 'rgba(0,128,0,0.8)';
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
let getValues = function(obj) {
  let out = [];
  for (let i in obj) {
    out.push(obj[i]);
  }
  return out;
};

let nextFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function(callback) {
      setTimeout(callback, 1000 / 60);
    };
let range = 2200;
let log_range = Math.log(range * 1.5);
let default_delay = 1000;
let absolute_mindelay = 10;
let mindelay = default_delay;
let lastBotch = 0;

let updateMinDelay = function() {
  // Hi there!  This program is open source, so you have the ability to make
  // your own copy of it, which might change or remove this mindelay
  // calculation.  However, if you do that, you might unintentionally cause
  // the servers we point at to get overloaded.  So we'd appreciate it if
  // you leave this mindelay calculation (including the mindelay URL below)
  // the same, *or* please also change the code to ping your own servers,
  // and then it's your problem.  Thanks!
  //    -- apenwarr, 2013/04/26
  $.getJSON('https://gfblip.appspot.com/mindelay?callback=?', function(data) {
    let newdelay = parseInt(data);
    if (newdelay >= absolute_mindelay) {
      mindelay = newdelay;
    } else {
      mindelay = default_delay;
    }

    // sigh, unfortunately this periodic update causes a periodic glitch in
    // the measurements... but it's important in case the server needs to slow
    // us down under load.
    setTimeout(updateMinDelay, 60000);
  });
};
updateMinDelay();

let BlipCanvas = function(canvas, width) {
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
        (Math.log(msecs) * this.canvas.height / log_range);
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
      msecs = range;
    }
    let y = this.msecToY(msecs);
    let x = this.current_x + this.xofs;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width, y - 15, 1 + width, 30);
    if (msecs >= range) {
      this.ctx.fillStyle = '#f00';
      this.ctx.fillRect(x - 1 - width, y - 5, 2 + width, 20);
    }
  };
};

let c1 = new BlipCanvas($('#hires')[0], 1000);
let c2 = new BlipCanvas($('#lores')[0], 10000);
let c3 = new BlipCanvas($('#vlores')[0], 100000);

let blips = [];

let addBlip = function(color, url, minlatency) {
  blips.push({color: color, url: url, minlatency: minlatency});
};

let gotBlip = function(color, url, minlatency, startTime) {
  let endTime = now();
  c1.drawBlip(color, startTime, endTime, minlatency, url ? 1 : 3);
  c2.drawBlip(color, startTime, endTime, minlatency, url ? 1 : 3);
  c3.drawBlip(color, startTime, endTime, minlatency, url ? 1 : 3);
  addBlip(color, url, minlatency);
};

let startBlips = function() {
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
        //   [method://][rand].random.[ndt_host].blipdns.apenwarr.ca[suffix]
        let g = dnsName.match(/(^[^\/]*\/\/)([^:\/]*)(.*)/);
        url = (g[1] + Math.random() +
               'random.' + g[2] + '.blipdns.apenwarr.ca' + g[3]);
      }
      $.ajax({
        'url': url,
        crossDomain: false,
        timeout: range
      }).complete(result);
    }
  }
};

let lastTick = now(), lastStart = lastTick;
let gotTick = function() {
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
    nextFrame(gotTick);
  }
};

let toggleBlip = function() {
  if (running) {
    running = 0;
  } else {
    running = 1;
    lastTick = now();
    nextFrame(gotTick);
  }
};

let toggleDns = function() {
  wantDns = dnsName && !wantDns;
};

c1.drawYAxis();

// Hi there!  The people at Google who monitor traffic on gstatic.com were
// kind enough to let us use their server in this tool.  Because gstatic.com
// latency is very low almost anywhere in the world, blip will generate a
// higher volume of traffic (up to 100 queries per second per client!) than
// most other sites you might ping.  This is great for measurement accuracy,
// but is a bit impolite if you do it in an uncontrolled way.  Blip uses the
// mindelay server, up above, to try to scale things back if a lot of people
// run blip all at once.  If you're modifying blip and you significantly
// change the kind of traffic it generates, especially if you change the
// mindelay calculation (see above), then please be a good Internet citizen
// and find a different server to ping.
//     -- apenwarr, 2013/04/26
let addGstatic = function() {
  addBlip(localColor, 'http://gstatic.com/generate_204', 0);
};

// This also ends up using Google resources, so see above.  But in this case,
// we trigger a new DNS lookup every time, so it's a good test to see if
// your DNS server is flakey.
// TODO(apenwarr): figure out whether this is too impactful or not.
addBlip(dnsColor, null, 5);

// Pick an Internet site with reasonably high latency (at least, higher than
// the usually-very-low-latency gstatic.com) to add contrast to the graph.
//
// Nobody really cares about apenwarr.ca, which is just hosted on a cheap
// VPS somewhere.  If you overload it, I guess I'll be sort of impressed
// that you like my program.  So, you know, whatever.
//     -- apenwarr, 2013/04/26
$.ajax({
  'url': 'https://mlab-ns.appspot.com/ndt_ssl?policy=all',
  crossDomain: true,
}).success(function(ndt) {
  // We want the selected hostname to be reasonably stable across page reloads
  // from a single location, even on separate devices.  To help with this,
  // choose only from the first server in the first city in each country.
  // The latency between countries is hopefully different enough that there
  // should be little jitter.
  //
  // TODO(apenwarr): think about reducing the country list to 2 per region?
  //   Africa          Johannesburg-ZA, Nairobi-KE
  //   Australia       Auckland-NZ
  //   Asia            Bangkok-TH, Taipei-TW
  //   Western EU      Dublin-IE, Stockholm-SE
  //   Eastern EU      Belgrade-RS
  //   NA              Seattle_WA-US, New York_NY-US
  //   SA              Bogota-CO
  //
  let hosts = [];
  for (let i in ndt) {
    hosts.push([ndt[i].country, ndt[i].city, ndt[i].fqdn]);
  }
  hosts.sort();
  let one_per_country = {};
  for (let i in hosts) {
    let country = hosts[i][0];
    let city = hosts[i][1];
    let url = 'https://' + hosts[i][2];
    if (!one_per_country[country]) {
      one_per_country[country] = {
        where: city + ', ' + country,
        url: url,
        rttList: []
      };
    }
  }

  let roundsDone = 0;
  let outstanding = 0;
  let doRound = function() {
    for (let ci in one_per_country) {
      (function() {
        let v = one_per_country[ci];
        let startTime = now();
        outstanding++;
        $.ajax({
          'url': v.url,
          crossDomain: false,
          timeout: range
        }).complete(function() {
          v.rttList.push(now() - startTime);
          outstanding--;
          console.log('outstanding', outstanding);
          if (!outstanding) {
            roundsDone++;
            if (roundsDone < 3) {
              doRound();
            } else {
              console.log(one_per_country);
              let results = getValues(one_per_country);
              results.sort(function(a, b) {
                return (Math.min.apply(Math, a.rttList) -
                        Math.min.apply(Math, b.rttList));
              });
              console.log(results);
              // Pick an entry at least one city away
              let best = results[1];
              dnsName = best.url;
              $('#internetlegend').text('o ' + best.where);
              addBlip(internetColor, best.url, 5);
            }
          }
        });
      })();
    }
  };
  doRound();
});


let tryFastSites = [
  '192.168.0.1',
  '192.168.0.254',
  '192.168.1.1',
  '192.168.1.254',
  '192.168.2.1',
  '192.168.2.254',
  '192.168.3.1',
  '192.168.3.254',
  '192.168.4.1',
  '192.168.4.254',
  '10.0.0.1',
  '10.0.0.254',
  '10.1.1.1',
  '10.1.1.254',
  '10.33.4.1',
  '10.33.4.254'
];
let curFastSite = 0;
let fastest;

function doneFastSite(reason, host, url, start_time) {
  let delay = now() - start_time;
  console.debug(reason + ' delay=' + delay + ' ' + url);
  if (reason != 'timeout' && (!fastest || delay < fastest[0])) {
    fastest = [delay, host, url];
  }
  curFastSite++;
  if (curFastSite < tryFastSites.length) {
    nextFastSite();
  } else {
    if (fastest) {
      $('#locallegend').html('o ' + fastest[1]);
      addBlip(localColor, fastest[2], 0);
    } else {
      $('#locallegend').html('o gstatic.com');
      addGstatic();
    }
  }
}

function nextFastSite() {
  let host = tryFastSites[curFastSite];
  let url = 'http://' + host + ':8999/generate_204';
  let start_time = now();
  $.ajax({
    'url': url,
    crossDomain: false,
    timeout: 200
  }).complete(function(e, reason) {
    doneFastSite(reason, host, url, start_time);
  });
}
nextFastSite();

nextFrame(gotTick);
