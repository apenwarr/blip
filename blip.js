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
var running = true;
var wantDns = false;
var now;
if (window.performance && window.performance.now) {
  now = function() { return window.performance.now(); };
} else {
  now = function() { return new Date().getTime(); };
}

var nextFrame =
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function(callback) {
      setTimeout(callback, 1000 / 60);
    };
var range = 2200;
var log_range = Math.log(range * 1.5);
var default_delay = 1000;
var absolute_mindelay = 10;
var mindelay = default_delay;
var lastBotch = 0;

var updateMinDelay = function() {
  // Hi there!  This program is open source, so you have the ability to make
  // your own copy of it, which might change or remove this mindelay
  // calculation.  However, if you do that, you might unintentionally cause
  // the servers we point at to get overloaded.  So we'd appreciate it if
  // you leave this mindelay calculation (including the mindelay URL below)
  // the same, *or* please also change the code to ping your own servers,
  // and then it's your problem.  Thanks!
  //    -- apenwarr, 2013/04/26
  $.getJSON('https://gfblip.appspot.com/mindelay?callback=?', function(data) {
    var newdelay = parseInt(data);
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

var BlipCanvas = function(canvas, width) {
  this.canvas = canvas;
  this.canvas.width = 1000;
  this.canvas.height = 1000;
  this.ctx = this.canvas.getContext('2d');
  this.xofs = 100;
  this.current_x = 0;
  this.xdiv = width / 1000;

  this.drawYAxis = function() {
    var labels = [2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
    this.ctx.fillStyle = 'black';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'right';
    this.ctx.font = '32px Arial';
    for (var i = 0; i < labels.length; i++) {
      var msecs = labels[i];
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
    var steps = msecs / absolute_mindelay;
    if (steps > 100) {
      steps = 100;
    }
    var x_inc = steps / this.xdiv;
    var new_x = (this.current_x + x_inc) % (this.canvas.width - this.xofs);

    // draw the new bar
    this.ctx.fillStyle = 'rgba(128,128,128,1.0)';
    this.ctx.fillRect(new_x + this.xofs + 1, 0,
                      4, this.canvas.height);

    // wipe out the old bar
    this.ctx.fillStyle = 'rgba(255,255,255,1.0)';
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
    var msecs = endTime - startTime;
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
    var y = this.msecToY(msecs);
    var x = this.current_x + this.xofs;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - width, y - 15, 1 + width, 30);
    if (msecs >= range) {
      this.ctx.fillStyle = '#f00';
      this.ctx.fillRect(x - 1 - width, y - 5, 2 + width, 20);
    }
  };
};

var c1 = new BlipCanvas($('#hires')[0], 1000);
var c2 = new BlipCanvas($('#lores')[0], 10000);
var c3 = new BlipCanvas($('#vlores')[0], 100000);

var blips = [];

var addBlip = function(color, url, minlatency) {
  blips.push({color: color, url: url, minlatency: minlatency});
};

var gotBlip = function(color, url, minlatency, startTime) {
  var endTime = now();
  c1.drawBlip(color, startTime, endTime, minlatency, url ? 1 : 3);
  c2.drawBlip(color, startTime, endTime, minlatency, url ? 1 : 3);
  c3.drawBlip(color, startTime, endTime, minlatency, url ? 1 : 3);
  addBlip(color, url, minlatency);
};

var startBlips = function() {
  while (blips.length) {
    var blip = blips.shift();
    if (!blip.url && !wantDns) {
      var createResult = function(blip) {
        return function() {
          addBlip(blip.color, blip.url, blip.minlatency);
        }
      };
      var result = createResult(blip);
      setTimeout(result, 1000);
    } else {
      var createResult = function(blip) {
        var startTime = now();
        var result = function() {
          gotBlip(blip.color, blip.url, blip.minlatency, startTime);
        };
        return result;
      };
      var result = createResult(blip);
      var url = blip.url;
      if (!blip.url) {
        url = ('http://' + Math.random() +
               'random.gfblip.appspot.com/generate_204');
      }
      $.ajax({
        'url': url,
        crossDomain: false,
        timeout: range
      }).complete(result);
    }
  }
};

var lastTick = now(), lastStart = lastTick;
var gotTick = function() {
  var t = now();
  var tdiff = t - lastTick;
  if (running) {
    if (tdiff >= absolute_mindelay) {
      if (t - lastStart > mindelay) {
        startBlips();
        lastStart = t;
      }
      c1.nextX(tdiff);
      c2.nextX(tdiff);
      c3.nextX(tdiff);
      lastTick = t;
    }
    nextFrame(gotTick);
  }
};

var toggleBlip = function() {
  if (running) {
    running = 0;
  } else {
    running = 1;
    lastTick = now();
    nextFrame(gotTick);
  }
};

var toggleDns = function() {
  wantDns = !wantDns;
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
var addGstatic = function() {
  addBlip('rgba(0,255,0,0.8)', 'http://gstatic.com/generate_204', 0);
};

// This also ends up using Google resources, so see above.  But in this case,
// we trigger a new DNS lookup every time, so it's a good test to see if
// your DNS server is flakey.
// TODO(apenwarr): figure out whether this is too impactful or not.
addBlip('rgba(0,0,0,1.0)', null, 5);

// Pick an Internet site with reasonably high latency (at least, higher than
// the usually-very-low-latency gstatic.com) to add contrast to the graph.
//
// Nobody really cares about apenwarr.ca, which is just hosted on a cheap
// VPS somewhere.  If you overload it, I guess I'll be sort of impressed
// that you like my program.  So, you know, whatever.
//     -- apenwarr, 2013/04/26
var trySlowSites = [
  'http://apenwarr.ca/blip/',
  'http://eqldata.com/blip/'
];
var remainingSlowSites = trySlowSites.length;

for (var i = 0; i < trySlowSites.length; i++) {
  var url = trySlowSites[i];
  var makeGotAnswer = function(url) {
    function gotAnswer() {
      remainingSlowSites--;
      if (!remainingSlowSites) {
        // last one standing! it must have the worst latency of the bunch.
        var hostmatch = RegExp('//([^/]*)');
        var host = hostmatch.exec(url)[1];
        $('#internetlegend').text('o ' + host);
        addBlip('rgba(0,0,255,0.8)', url, 5);
      }
    }
    return gotAnswer;
  };
  $.ajax({
    'url': url,
    crossDomain: false,
    timeout: range
  }).complete(makeGotAnswer(url));
}

var tryFastSites = [
  '192.168.0.1',
  '192.168.0.254',
  '192.168.1.1',
  '192.168.1.254',
  '192.168.2.1',
  '192.168.2.254',
  '10.0.0.1',
  '10.0.0.254',
  '10.1.1.1',
  '10.1.1.254',
  '10.33.4.1',
  '10.33.4.254'
];
var curFastSite = 0;
var fastest;

function doneFastSite(reason, host, url, start_time) {
  var delay = now() - start_time;
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
      addBlip('rgba(0,192,0,0.8)', fastest[2], 0);
    } else {
      $('#locallegend').html('o gstatic.com');
      addGstatic();
    }
  }
}

function nextFastSite() {
  var host = tryFastSites[curFastSite];
  var url = 'http://' + host + ':8999/generate_204';
  var start_time = now();
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
