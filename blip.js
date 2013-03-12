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
var delay = 10;

var BlipCanvas = function(canvas, width) {
  this.canvas = canvas;
  this.canvas.width = 1000;
  this.canvas.height = 200;
  this.ctx = this.canvas.getContext('2d');
  this.xofs = 50;
  this.current_x = 0;
  this.xdiv = width / 1000;
  
  this.drawYAxis = function() {
    var labels = [ 2, 5, 10, 20, 50, 100, 200, 500, 1000 ];
    this.ctx.setFillColor('black');
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
    var steps = parseInt(msecs / delay);
    if (steps > 100) {
      steps = 100;
    }
    var x_inc = steps / this.xdiv;
    var new_x = (this.current_x + x_inc) % (this.canvas.width - this.xofs);
    this.ctx.setFillColor('rgba(128,128,128,1.0)');
    this.ctx.fillRect(this.current_x + this.xofs + 4, 0,
		      x_inc, this.canvas.height);
    this.ctx.setFillColor('rgba(255,255,255,1.0)');
    this.ctx.fillRect(this.current_x + this.xofs, 0,
		      x_inc + 1, this.canvas.height);
    this.current_x = new_x;
  }

  this.msecToY = function(msecs) {
    return this.canvas.height -
	(Math.log(msecs) * this.canvas.height / log_range);
  }
  
  this.drawBlip = function(color, startTime, endTime) {
    var msecs = endTime - startTime;
    var y = this.msecToY(msecs);
    var x = this.current_x + this.xofs;
    if (msecs >= range) {
      this.ctx.setFillColor('#f00');
      this.ctx.fillRect(x - 2, y - 1, 3, 4);
    }
    this.ctx.setFillColor(color);
    this.ctx.fillRect(x - 1, y - 3, 2, 6);
  }
}

var c1 = new BlipCanvas($('#hires')[0], 1000);
var c2 = new BlipCanvas($('#lores')[0], 10000);

var blips = [];

var addBlip = function(color, url) {
  blips.push({color: color, url: url});
}

var gotBlip = function(color, url, startTime) {
  var endTime = now();
  c1.drawBlip(color, startTime, endTime);
  c2.drawBlip(color, startTime, endTime);
  addBlip(color, url);
}

var startBlips = function() {
  while (blips.length) {
    var blip = blips.shift();
    var createResult = function(blip) {
      var startTime = now();
      var result = function() {
	gotBlip(blip.color, blip.url, startTime);
      }
      return result;
    }
    var result = createResult(blip);
    $.ajax({
      'url': blip.url,
      crossDomain: false,
      success: result,
      error: result,
      timeout: range
    });
  }
};

var lastTick = now();
var gotTick = function() {
  var t = now();
  if (running) {
    if (t - lastTick >= delay) {
      startBlips();
      c1.nextX(t - lastTick);
      c2.nextX(t - lastTick);
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

//addBlip('rgba(255,0,0,0.8)', 'http://8.8.8.8:53/blip');
addBlip('rgba(0,255,0,0.8)', 'http://gstatic.com/generate_204');
addBlip('rgba(0,0,255,0.8)', 'http://apenwarr.ca/blip/');
nextFrame(gotTick);
