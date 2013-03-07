var running = true;
var now;
if (window.performance && window.performance.now) {
  now = function() { return window.performance.now(); };
} else {
  now = function() { return new Date().getTime(); };
}

var ctx = $('#blipchart')[0].getContext('2d');
var delay = 10;
var range = 500;

var tmfunc = function(color, url, x) {
  var startTime = now();
  var gotblip = function() {
    var endTime = now();
    var msecs = endTime - startTime;
    var y = ctx.canvas.height-(msecs*ctx.canvas.height/range);
    //console.debug('blip', url, msecs);
    ctx.setFillColor('rgba(255,255,255,0.1)');
    ctx.fillRect(x, 0, 10, ctx.canvas.height);
    ctx.setFillColor(color);
    ctx.fillRect(x, y, 2, 2);
    x = (x + 1) % ctx.canvas.width;
    setup_tmfunc(color, url, x, delay - msecs);
  }
  $.ajax({
    'url': url,
    crossDomain: false,
    success: gotblip,
    error: gotblip
  });
};

var setup_tmfunc = function(color, url, x, when) {
  if (running) {
    setTimeout(function() { tmfunc(color, url, x); }, when);
  } else {
    setTimeout(function() { setup_tmfunc(color, url, x, delay); });
  }
}

var grapher = function(color, url) {
  tmfunc(color, url, 0);
};

var enableBlip = function(enable) {
  running = enable;
}

grapher('rgba(255,0,0,0.5)', 'http://8.8.8.8:53/blip');
grapher('rgba(0,255,0,0.5)', 'http://gstatic.com/generate_204');
grapher('rgba(0,0,255,0.5)', 'http://apenwarr.ca/blip');
