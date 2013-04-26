
blip: a tool for seeing your Internet latency
=============================================

Tip:
----

On your PC, laptop, tablet, phone, or iPod, try adding a
bookmark to http://gfblip.appspot.com/ to your home screen
for easy access.


Too long, don't read:
---------------------

 - Go to http://gfblip.appspot.com/

 - It should work on any PC, laptop, tablet, phone, or iPod
   with javascript and HTML canvas support (which means
   almost everything nowadays).

 - X axis is time. Y axis is milliseconds of latency.

 - Green blips are your ping time to gstatic.com (a very
   fast site that should be close to you wherever you are).

 - Blue blips are your ping time to apenwarr.ca ("a site on
   the Internet").  It should be slower than gstatic.com. 
   How much slower depends on how lucky you are.

 - Red blips mean something sucks.
 
 - A good Internet+Wifi connection should have no red
   blips.  And lower latency is better than higher latency.
 
 - We send blips out as fast as they come back, up to 100
   per second, so you can notice very small variations.

 - If you watch the blip output while you do different
   things (switch wifi networks, start Youtube videos
   playing, walk around), you can immediately see what
   impact that change has on the quality of your Internet
   connection.


Even longer, don't read:
------------------------

People think more bandwidth will make your Internet
connection seem faster, but that isn't even close to the
whole story.  There are three interrelated things you need
to care about:

  - bandwidth
  - latency
  - packet loss.

Bandwidth means, once things get going, how fast you can
download.  But "once things get going" can take a really
long time.  In fact, it can take longer than the whole
download!  This is especially true for simple web pages, or
web pages made up of a bunch of tiny pieces, which is very
common on today's web.

That's where latency comes in.  Latency is the time it
takes to make a round trip to the server.  Really good web
designers know how to minimize the number of round trips,
or at least do more round trips at the same time - which
makes their pages load faster on everyone's connection. 
But every web page, whether optimized or not, automatically
benefits pretty much proportionally to your network
latency.  Cut latency in half, and most pages will load
about twice as fast.

Packet loss is the third component, and it's often
forgotten.  If you run the 'ping' program, which most
people don't do and which is hard or impossible to do from
many modern Internet devices (phones, tablets, etc), it
will show you how many packets are dropped, and how many
got through.  Unfortunately, most people don't run ping
more than once per second, which gives a pretty low
resolution; if you have a really brief outage, you might
not even see it with ping.  Plus, on the modern Internet,
packet loss is hard to measure - you can't do it with a web
browser.  And it's not that useful anyway, since real web
pages don't see "packet loss." On the web (and any
TCP-based protocol), packet loss translates into packet
retransmissions, which means latency in some cases is 2, 3,
or more times higher than usual.  If you have significant
packet loss (say, 1% or more), your web performance will
totally suck eggs even if your bandwidth and latency are
both fantastic.

Blip is an end-to-end testing tool designed to let you
measure the latter two elements: latency and packet loss. 
These are the real indicators of your web browsing
performance.  It doesn't attempt to measure bandwidth; for
that there's always good old http://speedtest.net/.  (By
the way, next time you're visiting speedtest.net, watch how
the "download speedometer" dial starts off low and increases
over time.  That's what I mean when I say you might be done
downloading by the time "things get going.")

How is blip an end-to-end tool?  Simple.  It's written in
pure javascript, so it runs purely in your browser, without
needing a server-side component.  It makes real requests to
real http servers, rather than using synthetic "ping"
packets.  Then it measures the turnaround time on those
requests and plots them on a graph.  And it does this up to
100 times per second, so you can see your network quality
in high resolution.  It's the next best thing to actually
browsing the web, except you get a pretty graph instead of
"hmm, that page loaded kinda slowly today."

Blip doesn't attempt to interpret the results for you; it
just makes the plot in real time.  If you try experimenting
with it in a few different conditions, you can get an
intuitive feel for what those conditions mean to the graph -
and the graph can give you an intuitive feel for how
sucky your web browsing performance will be under those
conditions.

Here are some observations I've made using blip:

 - If there's a red blip more than once every minute or so,
   your web browsing will be noticeably more annoying than
   if there isn't.  Yes, real wifi connections exist, even
   in crowded buildings, with *zero* red blips.  That
   should be your goal.
 
 - One of my tablet devices produces red blips even when
   another device, sitting right next to it, on the same
   access point, does not.
 
 - Some wifi routers give decent speedtest.net results most
   of the time, and terrible speedtest.net results other
   times.  This is usually because they get angry and start
   losing packets at random times, which is easy to see with blip.
 
 - You can walk around your apartment or house and find out
   exactly where the wifi "dead zones" are, within seconds. 
   It's kind of like a geiger counter; wave it around and
   see what happens to the clicks.
 
 - "Wifi signal strength" meters are all a bunch of evil
   liars.  Don't trust them.  Wondering why your Internet
   is slow even with 5 bars?  Don't believe the hype.  Blip
   will show you the truth.
 
 - For me, on a wired ethernet network I can get about 15ms
   (or less from some locations) green blips.  On wifi it's more
   like 30-50ms.  On 3G cellular, with a really good signal
   (eg. outdoors with no obstructions) the best I get is
   about 100ms.  With obstructions, it's normally more like
   200ms.  And yes, the ratios between these numbers really
   do seem like the performance difference I see when web
   browsing.
 
 - 3G cellular networks, surprisingly, seem to have far
   fewer red blips than typical "public" wifi signals (eg. 
   ones in malls, parks, etc), even in moderately crowded
   area.  So even though the latency ("ping time") might
   look better on public wifi, the packet loss (shown as a
   nonzero number of red blips) means web browsing will be
   cruddy.  That matches my experience, but now I can
   measure it for real.


The Stupid Part
---------------

So you might be wondering, hey, how did you make a
javascript applet ping these arbitrary servers?  What about
cross-domain request protection?

Answer: I did it by just making the queries anyway, and
seeing how long it takes to get the error message back that
my request was refused because of cross-domain request
protection.  Yes, this results in an infinite number of
error messages to your javascript console.  Don't look at your
javascript console and you'll be fine.  Trust me on this.


The Fiddly Bits
---------------

blip is open source software released under the Apache
license.  See the file COPYING and comments inside the code
for more details.

You can get the source code at: http://github.com/apenwarr/blip

If you want to discuss this tool, you can join the
blip-users@googlegroups.com mailing list.  You don't need a
Google Account to subscribe!  Just send an email to
blip-users+subscribe@googlegroups.com and you can join.

blip probably needs lots of fancy new features.  It's the
first program I've ever written using HTML Canvas for
display (which is really fun), so I probably did some dumb
things.  Javascript is also not my first choice of
programming language (yet?) so I probably did some even dumber
things.  Send pull requests.  That is all.

  -- apenwarr
