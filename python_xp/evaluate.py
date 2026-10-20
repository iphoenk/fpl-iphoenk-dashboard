"""Matched-cohort evaluation only; no reconstructed predeadline claims."""
import math
import statistics
from .validate import InputError

def ranks(values):
 ordered=sorted(range(len(values)),key=values.__getitem__);result=[0]*len(values);i=0
 while i<len(ordered):
  j=i+1
  while j<len(ordered) and values[ordered[j]]==values[ordered[i]]:j+=1
  for k in range(i,j):result[ordered[k]]=(i+j+1)/2
  i=j
 return result

def metrics(rows):
 if not rows:return {'count':0,'mae':None,'spearman':None}
 x=ranks([r[0] for r in rows]);y=ranks([r[1] for r in rows]);mx=statistics.mean(x);my=statistics.mean(y)
 denom=math.sqrt(sum((v-mx)**2 for v in x)*sum((v-my)**2 for v in y))
 return {'count':len(rows),'mae':statistics.mean(abs(a-b) for a,b,_ in rows),'spearman':sum((a-mx)*(b-my) for a,b in zip(x,y))/denom if denom else None}

def evaluate(predictions,actuals):
 if actuals.get('final') is not True:return {'status':'pending','count':0,'mae':None,'positions':{}}
 if not predictions.get('season') or predictions.get('season')!=actuals.get('season') or not isinstance(predictions.get('target_gw'),int) or predictions.get('target_gw')!=actuals.get('gameweek'):raise InputError('Evaluation season/gameweek mismatch')
 rows=[]
 for id,p in predictions['players'].items():
  a=actuals.get('players',{}).get(id)
  if a and (not isinstance(p.get('permanent_code'),int) or p.get('permanent_code')!=a.get('permanent_code')):raise InputError('Evaluation player identity mismatch')
  if p.get('status')=='ready' and isinstance(p.get('xp'),(int,float)) and not isinstance(p['xp'],bool) and math.isfinite(p['xp']) and a and isinstance(a.get('points'),(int,float)) and not isinstance(a['points'],bool) and math.isfinite(a['points']):rows.append((p['xp'],a['points'],p['position'],a.get('minutes')))
 return {'status':'final','evidence':'retrospective-matched-evaluation','universe':len(predictions['players']),**metrics([r[:3] for r in rows]),'positions':{str(pos):metrics([r[:3] for r in rows if r[2]==pos]) for pos in (1,2,3,4)},'active':metrics([r[:3] for r in rows if isinstance(r[3],(int,float)) and r[3]>0])}
