"""Bounded explicit batch acquisition, never called from a page request."""
import concurrent.futures
import json
import time
import urllib.request
from .validate import InputError,digest,utc,validate_snapshot

BASE='https://fantasy.premierleague.com/api/'

def fetch_json(path):
 import re
 if not re.fullmatch(r'(bootstrap-static/|fixtures/|element-summary/[1-9]\d*/)',path):raise InputError('Source path not allowed')
 error=None
 for attempt in range(2):
  try:
   req=urllib.request.Request(BASE+path,headers={'User-Agent':'FPL-iphoenk-xP/0.1 (explicit-batch)','Accept':'application/json'})
   with urllib.request.urlopen(req,timeout=15) as r:body=r.read(10_000_001)
   if len(body)>10_000_000:raise InputError('Response too large')
   return json.loads(body)
  except (OSError,ValueError) as e:error=e
 raise InputError('Official source failed: '+path) from error

def acquire_snapshot(fetcher=fetch_json,clock=time.time):
 started=clock();sources=[]
 def get(path):
  if clock()-started>1800:raise InputError('Collection window exceeded')
  data=fetcher(path);sources.append({'path':path,'fetched_at':utc(clock()),'sha256':digest(data)});return data
 bs=get('bootstrap-static/');fixtures=get('fixtures/')
 players=bs.get('elements')
 if not players:raise InputError('No player universe')
 def player(p):
  data=get('element-summary/'+str(p['id'])+'/')
  if not isinstance(data.get('history'),list):raise InputError('Incomplete history response')
  return str(p['id']),data['history']
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:histories=dict(pool.map(player,players))
 final_bs=get('bootstrap-static/');final_fixtures=get('fixtures/')
 identity=lambda b:[(p['id'],p['code'],p['team'],p['element_type'],p['status'],p.get('chance_of_playing_next_round')) for p in b.get('elements',[])]
 context=lambda b:[(e['id'],e['deadline_time'],e.get('is_next'),e.get('finished'),e.get('data_checked')) for e in b['events']]
 if identity(bs)!=identity(final_bs) or context(bs)!=context(final_bs) or digest(bs['game_config'])!=digest(final_bs['game_config']) or digest(fixtures)!=digest(final_fixtures):raise InputError('Official context changed during acquisition; retry explicitly')
 s={'schema_version':1,'acquisition_started_at':utc(started),'acquisition_finished_at':utc(clock()),'source_manifest':sorted(sources,key=lambda r:(r['path'],r['fetched_at'])),'bootstrap':final_bs,'fixtures':fixtures,'histories':histories}
 validate_snapshot(s,utc(clock()));return s
