var running = true;
var now;
if (window.performance && window.performance.now) {
  now = function() { return window.performance.now(); };
} else {
  now = function() { return new Date().getTime(); };
}

var canvas = $('#blipchart')[0];
canvas.width = 1000;
canvas.height = 100;
var ctx = canvas.getContext('2d');
var delay = 10;
var range = 500;
var current_x = 0;
var blips = [];

var addBlip = function(color, url) {
  blips.push({color: color, url: url});
}

var gotBlip = function(color, url, x, startTime) {
  var endTime = now();
  var msecs = endTime - startTime;
  var y = canvas.height - (Math.log(msecs)/Math.log(10) * canvas.height / 4.0);
  if (msecs >= range) {
    ctx.setFillColor('#f00');
    ctx.fillRect(x - 1, y - 1, 3, 4);
  }
  ctx.setFillColor(color);
  ctx.fillRect(x, y, 2, 2);
  addBlip(color, url);
}

var startBlips = function() {
  while (blips.length) {
    var blip = blips.shift();
    var createResult = function(blip) {
      var startTime = now();
      var result = function() {
	gotBlip(blip.color, blip.url, current_x, startTime);
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

var gotTick = function() {
  if (running) {
    startBlips();
    current_x = (current_x + 1) % canvas.width;
    ctx.setFillColor('rgba(128,128,128,1.0)');
    ctx.fillRect(current_x + 4, 0, 1, canvas.height);
    ctx.setFillColor('rgba(255,255,255,1.0)');
    ctx.fillRect(current_x, 0, 2, canvas.height);
  }
  setTimeout(gotTick, delay);
}

var enableBlip = function(enable) {
  running = enable;
}

//addBlip('rgba(255,0,0,0.8)', 'http://8.8.8.8:53/blip');
addBlip('rgba(0,255,0,0.8)', 'http://gstatic.com/generate_204');
addBlip('rgba(0,0,255,0.8)', 'http://apenwarr.ca/blip');
gotTick();
