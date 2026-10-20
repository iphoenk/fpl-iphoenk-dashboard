"""Strict source validation. Missing observations never become synthetic zeros."""
import copy
import hashlib
import json
import math
from datetime import datetime,timezone

class InputError(ValueError):pass

POSITIONS={1:'GKP',2:'DEF',3:'MID',4:'FWD'}
REQUIRED=('minutes','starts','goals_scored','assists','clean_sheets','goals_conceded','saves','bonus','yellow_cards','red_cards','own_goals','penalties_saved','penalties_missed','defensive_contribution','expected_goals','expected_assists','total_points')
SCORING={'long_play':2,'short_play':1,'goals_conceded':{'GKP':-1,'DEF':-1,'MID':0,'FWD':0},'saves':1,'goals_scored':{'GKP':10,'DEF':6,'MID':5,'FWD':4},'assists':3,'clean_sheets':{'GKP':4,'DEF':4,'MID':1,'FWD':0},'penalties_saved':5,'penalties_missed':-2,'yellow_cards':-1,'red_cards':-3,'own_goals':-2,'bonus':1,'defensive_contribution':{'GKP':0,'DEF':2,'MID':2,'FWD':2}}
RULES_VERSION='official-2026-27-v1'
RULES_URL='https://www.premierleague.com/en/news/2174909/'

def instant(value):
 try:
  t=datetime.fromisoformat(str(value).replace('Z','+00:00'))
  if t.tzinfo is None:raise ValueError()
  return t.timestamp()
 except (ValueError,TypeError,OverflowError):raise InputError('Invalid timezone-aware timestamp')

def utc(value):return datetime.fromtimestamp(value,timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
def digest(value):return hashlib.sha256(canonical(value).encode()).hexdigest()

def numeric(value,name):
 if value is None or isinstance(value,bool) or isinstance(value,str) and not value.strip():raise InputError('Missing numeric '+name)
 try:n=float(value)
 except (ValueError,TypeError):raise InputError('Invalid numeric '+name)
 if not math.isfinite(n):raise InputError('Nonfinite '+name)
 return n

def validate_scoring(config):
 scoring=config.get('scoring') if isinstance(config,dict) else None
 if not isinstance(scoring,dict) or any(scoring.get(k)!=v for k,v in SCORING.items()):raise InputError('Unsupported official scoring configuration')
 # Refuse a new nonzero scoring component that the model does not account for.
 for k,v in scoring.items():
  if k not in SCORING and k!='special_multiplier' and (any(x!=0 for x in v.values()) if isinstance(v,dict) else v!=0):raise InputError('Unknown active scoring component: '+k)
 if scoring.get('special_multiplier',1)!=1:raise InputError('Unsupported special multiplier')
 return copy.deepcopy(SCORING)

def fixture_context(fixtures,gw):
 return sorted([{k:f.get(k) for k in ('id','event','team_h','team_a','kickoff_time')} for f in fixtures if f.get('event')==gw],key=lambda f:f['id'])

def validate_snapshot(snapshot,now):
 s=copy.deepcopy(snapshot);clock=instant(now);bs=s.get('bootstrap',{});events=bs.get('events',[])
 if s.get('schema_version')!=1:raise InputError('Unknown input schema')
 start=instant(s.get('acquisition_started_at'));end=instant(s.get('acquisition_finished_at'))
 if not start<=end<=clock or end-start>1800 or clock-start>=21600:raise InputError('Input acquisition expired or incomplete')
 sources=s.get('source_manifest')
 if not isinstance(sources,list) or not sources or any(not start<=instant(r.get('fetched_at'))<=end or len(r.get('sha256',''))!=64 for r in sources):raise InputError('Missing input provenance')
 nexts=[e for e in events if e.get('is_next')]
 if len(nexts)!=1 or clock>=instant(nexts[0].get('deadline_time')):raise InputError('Next GW deadline unavailable/closed')
 if datetime.fromtimestamp(instant(events[0]['deadline_time']),timezone.utc).year!=2026:raise InputError('Rules not verified for this season')
 target=nexts[0];teams={t['id'] for t in bs.get('teams',[])};players=bs.get('elements',[])
 if not players or len({p['id'] for p in players})!=len(players) or len({p['code'] for p in players})!=len(players):raise InputError('Invalid player identity universe')
 for p in players:
  if p.get('element_type') not in POSITIONS or p.get('team') not in teams or not p.get('web_name') or not isinstance(p.get('code'),int):raise InputError('Invalid identity')
 s['scoring']=validate_scoring(bs.get('game_config'))
 unique={}
 for f in s.get('fixtures',[]):
  if not isinstance(f.get('id'),int) or f.get('team_h') not in teams or f.get('team_a') not in teams or f['team_h']==f['team_a']:raise InputError('Invalid fixture identity')
  if f['id'] in unique and unique[f['id']]!=f:raise InputError('Conflicting fixture duplicate')
  unique[f['id']]=f
 s['fixtures']=list(unique.values());s['target']=target;s['season']='2026';s['fixture_hash']=digest(fixture_context(s['fixtures'],target['id']))
 if not s['fixtures']:raise InputError('Missing fixture schedule')
 checked={e['id'] for e in events if e.get('finished') is True and e.get('data_checked') is True and e['id']<target['id']}
 final={f['id']:f for f in s['fixtures'] if f.get('finished') is True and f.get('event') in checked}
 for f in final.values():
  if instant(f.get('kickoff_time'))>=clock or any(numeric(f.get(k),k)<0 for k in ('team_h_score','team_a_score')):raise InputError('Invalid finished fixture')
 histories=s.get('histories')
 if not isinstance(histories,dict) or set(histories)!={str(p['id']) for p in players}:raise InputError('Incomplete history acquisition')
 for p in players:
  rows=histories[str(p['id'])];seen={}
  if not isinstance(rows,list):raise InputError('Missing player history')
  for r in rows:
   if r.get('element')!=p['id'] or r.get('fixture') not in unique:raise InputError('Player/fixture identity mismatch')
   f=unique[r['fixture']]
   if r.get('round')!=f.get('event') or not isinstance(r.get('was_home'),bool) or r.get('opponent_team')!=(f['team_a'] if r['was_home'] else f['team_h']):raise InputError('History fixture mismatch')
   if f['id'] not in final:continue
   row=copy.deepcopy(r)
   for k in REQUIRED:row[k]=numeric(r.get(k),k)
   if any(row[k]<0 for k in REQUIRED if k!='total_points') or row['minutes']>120 or row['starts'] not in (0,1):raise InputError('Invalid statistical observation')
   row['historical_team']=f['team_h'] if row['was_home'] else f['team_a']
   if f['id'] in seen and seen[f['id']]!=row:raise InputError('Conflicting player duplicate')
   seen[f['id']]=row
  histories[str(p['id'])]=list(seen.values())
 s['final_fixtures']=list(final.values());return s
