#!/usr/bin/env python
import time
import webapp2
from google.appengine.api import memcache

MAX_TOTAL_QPS = 100000.0
MIN_DELAY_MSEC = 10
REFRESH_PERIOD = 60.0  # seconds

memclient = memcache.Client()


def RoundedTime(t):
  return int(t / REFRESH_PERIOD)


def IncrAndCountClients():
  now = time.time()
  prevtick = str(RoundedTime(now - REFRESH_PERIOD));
  curtick = str(RoundedTime(now))
  prev = memclient.get(prevtick) or 0
  cur = memclient.incr(curtick, initial_value=0)
  return max(cur, prev)


class MinDelayPage(webapp2.RequestHandler):
  def get(self):
    nclients = IncrAndCountClients()
    qps = MAX_TOTAL_QPS / nclients
    delay_msec = max(MIN_DELAY_MSEC, 1000. / qps)
    self.response.headers['Content-Type'] = 'application/json'
    self.response.out.write(str(int(delay_msec)))

wsgi_app = webapp2.WSGIApplication([('/mindelay', MinDelayPage)])
