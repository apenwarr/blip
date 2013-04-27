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
var running = true;
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
var range = 1000;
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
}
updateMinDelay();

var BlipCanvas = function(canvas, width) {
  this.canvas = canvas;
  this.canvas.width = 1000;
  this.canvas.height = 200;
  this.ctx = this.canvas.getContext('2d');
  this.xofs = 60;
  this.current_x = 0;
  this.xdiv = width / 1000;

  this.drawYAxis = function() {
    var labels = [ 2, 5, 10, 20, 50, 100, 200, 500, 1000 ];
    this.ctx.fillStyle = 'black';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'right';
    this.ctx.scale(3, 1);
    this.ctx.font = '8px Arial';
    for (var i = 0; i < labels.length; i++) {
      var msecs = labels[i];
      this.ctx.fillText(msecs, (this.xofs - 5) / 3, this.msecToY(msecs));
    }
    this.ctx.scale(1/3, 1);
  }

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
  }

  this.msecToY = function(msecs) {
    return this.canvas.height -
        (Math.log(msecs) * this.canvas.height / log_range);
  }

  this.drawBlip = function(color, startTime, endTime, minlatency) {
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
      msecs = 1000;
    }
    var y = this.msecToY(msecs);
    var x = this.current_x + this.xofs;
    if (msecs >= range) {
      this.ctx.fillStyle = '#f00';
      this.ctx.fillRect(x - 2, y - 1, 3, 4);
    }
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x - 1, y - 3, 2, 6);
  }
}

var c1 = new BlipCanvas($('#hires')[0], 1000);
var c2 = new BlipCanvas($('#lores')[0], 10000);

var blips = [];

var addBlip = function(color, url, minlatency) {
  blips.push({color: color, url: url, minlatency: minlatency});
}

var gotBlip = function(color, url, minlatency, startTime) {
  var endTime = now();
  c1.drawBlip(color, startTime, endTime, minlatency);
  c2.drawBlip(color, startTime, endTime, minlatency);
  addBlip(color, url, minlatency);
}

var startBlips = function() {
  while (blips.length) {
    var blip = blips.shift();
    var createResult = function(blip) {
      var startTime = now();
      var result = function() {
        gotBlip(blip.color, blip.url, blip.minlatency, startTime);
      }
      return result;
    }
    var result = createResult(blip);
    $.ajax({
      'url': blip.url,
      crossDomain: false,
      timeout: range
    }).complete(result);
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
      lastTick = t;
    }
    nextFrame(gotTick);
  }
}

var toggleBlip = function() {
  if (running) {
    running = 0;
  } else {
    running = 1;
    lastTick = now();
    nextFrame(gotTick);
  }
}

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
addBlip('rgba(0,255,0,0.8)', 'http://gstatic.com/generate_204', 0);

// Nobody really cares about apenwarr.ca, which is just hosted on a cheap
// VPS somewhere.  If you overload it, I guess I'll be sort of impressed
// that you like my program.  So, you know, whatever.
//     -- apenwarr, 2013/04/26
addBlip('rgba(0,0,255,0.8)', 'http://apenwarr.ca/blip/', 5);

nextFrame(gotTick);
