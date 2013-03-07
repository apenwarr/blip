var now;
if (window.performance && window.performance.now) {
    now = function() { return window.performance.now(); };
} else {
    now = function() { return new Date().getTime(); };
}

var ctx = $('#blipchart')[0].getContext('2d');
var delay = 10;
var range = 500;

var grapher = function(color, url) {
    var tmfunc = function(url, x) {
        if (x < ctx.canvas.width) {
            var startTime = now();
            var gotblip = function() {
                var endTime = now();
                var msecs = endTime - startTime;
                var y = ctx.canvas.height-(msecs*ctx.canvas.height/range);
                console.debug('blip', url, msecs);
                ctx.setFillColor(color);
                ctx.fillRect(x, y, 2, 2);
                setTimeout(function() { tmfunc(url, x+1); }, delay - msecs);
            }
            $.ajax({
                'url': url,
                crossDomain: false,
                success: gotblip,
                error: gotblip
            });
            x++;
        }
    };
    tmfunc(url, 0);
};
grapher('#f00', 'http://8.8.8.8:53/blip');
grapher('rgba(0,255,0,10)', 'http://gstatic.com/generate_204');
grapher('rgba(0,0,255,10)', 'http://apenwarr.ca/blip');
