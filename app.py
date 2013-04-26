#!/usr/bin/env python
#
# Copyright 2013 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
import re
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
    json = str(int(delay_msec))
    callback = self.request.params.get('callback')
    if callback and re.match(r'^\w+$', callback):
      self.response.out.write('%s(%s);' % (callback, json))
    else:
      self.response.out.write(json)

wsgi_app = webapp2.WSGIApplication([('/mindelay', MinDelayPage)])
