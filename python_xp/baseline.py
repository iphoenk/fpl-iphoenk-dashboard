"""Versioned experimental empirical baseline; no copied provider predictions."""
import math
from .validate import validate_snapshot,instant,utc,digest,POSITIONS,RULES_VERSION,RULES_URL,InputError

CONFIG={'rate_prior_minutes':180,'minute_prior_fixtures':2,'team_prior_matches':5,'prior_cohort':'position-neutral-all-complete-observations','recency':'unweighted-complete-current-season','saves_group':3,'conceded_group':2,'defcon_threshold':{'GKP':None,'DEF':10,'MID':12,'FWD':12}}

def grouped_poisson(mean,group):
 if not 0<=mean<=100:raise InputError('Invalid event-rate model')
 probability=math.exp(-mean);total=0.0
 for k in range(240):
  if k:probability*=mean/k
  total+=(k//group)*probability
 return total

def team_context(s):
 fixtures=s['final_fixtures']
 if not fixtures:raise InputError('No final checked fixture context')
 mu=sum(f['team_h_score']+f['team_a_score'] for f in fixtures)/(2*len(fixtures))
 if mu<=0:raise InputError('Insufficient observed goal context')
 prior=CONFIG['team_prior_matches'];strength={}
 for team in s['bootstrap']['teams']:
  mine=[f for f in fixtures if team['id'] in (f['team_h'],f['team_a'])]
  if not mine:continue
  gf=sum(f['team_h_score'] if f['team_h']==team['id'] else f['team_a_score'] for f in mine)
  ga=sum(f['team_a_score'] if f['team_h']==team['id'] else f['team_h_score'] for f in mine)
  strength[team['id']]=((gf+mu*prior)/(len(mine)+prior),(ga+mu*prior)/(len(mine)+prior))
 venue={side:(sum(f['team_'+side+'_score'] for f in fixtures)+mu*prior)/(len(fixtures)+prior)/mu for side in ('h','a')}
 return strength,mu,venue

def profile(rows,prior_rows,pos):
 if not rows or not prior_rows:return None
 # Registered nonappearances remain observed zeros; absent history is never added.
 n=len(rows);prior_n=len(prior_rows);weight=CONFIG['minute_prior_fixtures']
 atoms=[(r['minutes'],1/(n+weight)) for r in rows]+[(r['minutes'],weight/prior_n/(n+weight)) for r in prior_rows]
 minutes=sum(r['minutes'] for r in rows);prior_minutes=sum(r['minutes'] for r in prior_rows)
 if prior_minutes<=0:return atoms,{key:0.0 for key in ('expected_goals','expected_assists','saves','bonus','yellow_cards','red_cards','own_goals','penalties_saved','penalties_missed','dc_hit')}
 k=CONFIG['rate_prior_minutes'];rates={}
 for key in ('expected_goals','expected_assists','saves','bonus','yellow_cards','red_cards','own_goals','penalties_saved','penalties_missed'):
  prior90=sum(r[key] for r in prior_rows)/prior_minutes*90
  rates[key]=(sum(r[key] for r in rows)+prior90*k/90)/(minutes/90+k/90)
 threshold=CONFIG['defcon_threshold'][pos]
 prior_dc=sum(1 for r in prior_rows if threshold is not None and r['defensive_contribution']>=threshold)/prior_minutes*90
 rates['dc_hit']=(sum(1 for r in rows if threshold is not None and r['defensive_contribution']>=threshold)+prior_dc*k/90)/(minutes/90+k/90)
 return atoms,rates

def fixture_points(pos,profile,availability,lam_for,lam_against,norm,scoring):
 atoms,rates=profile;parts={k:0.0 for k in ('appearance','goals','assists','clean_sheet','conceded','saves','bonus','defcon','penalties_saved','penalties_missed','cards','own_goals')}
 for minutes,weight in atoms:
  if minutes<=0:continue
  weight*=availability;share=minutes/90;played=1;long=minutes>=60;attack=lam_for/norm
  parts['appearance']+=weight*(scoring['long_play'] if long else scoring['short_play'])
  parts['goals']+=weight*scoring['goals_scored'][pos]*rates['expected_goals']*share*attack
  parts['assists']+=weight*scoring['assists']*rates['expected_assists']*share*attack
  parts['clean_sheet']+=weight*scoring['clean_sheets'][pos]*long*math.exp(-lam_against*share)
  parts['conceded']+=weight*scoring['goals_conceded'][pos]*grouped_poisson(lam_against*share,2)
  if pos=='GKP':parts['saves']+=weight*scoring['saves']*grouped_poisson(rates['saves']*share,3)
  parts['bonus']+=weight*scoring['bonus']*rates['bonus']*share
  parts['defcon']+=weight*scoring['defensive_contribution'][pos]*min(1,rates['dc_hit']*share)
  for key in ('penalties_saved','penalties_missed','own_goals'):parts[key]+=weight*scoring[key]*rates[key]*share
  parts['cards']+=weight*(scoring['yellow_cards']*rates['yellow_cards']+scoring['red_cards']*rates['red_cards'])*share
 return parts

def predict(snapshot,*,now,model_version='0.1.1'):
 s=validate_snapshot(snapshot,now);bs=s['bootstrap'];target=s['target'];strength,mu,venue=team_context(s)
 # Official history has no as-of position. Never assign old rows to today's position.
 prior=[r for rows in s['histories'].values() for r in rows]
 output={};teams={t['id']:t['short_name'] for t in bs['teams']}
 for p in bs['elements']:
  fixtures=sorted([f for f in s['fixtures'] if f.get('event')==target['id'] and p['team'] in (f['team_h'],f['team_a'])],key=lambda f:f['id'])
  rows=s['histories'][str(p['id'])];pos=POSITIONS[p['element_type']]
  row={'permanent_code':p['code'],'current_element_id':p['id'],'name':p['web_name'],'team_id':p['team'],'team':teams[p['team']],'position':p['element_type'],'fixture_ids':[f['id'] for f in fixtures],'status':'unavailable','xp':None,'components':{},'evidence_count':len(rows),'reason':'insufficient-complete-evidence','availability':{'status':p['status'],'chance':p.get('chance_of_playing_next_round')}}
  output[str(p['id'])]=row
  if not fixtures:row.update(status='ready',xp=0,reason='confirmed-blank');continue
  if any(f.get('kickoff_time') is None or f.get('finished') for f in fixtures):row['reason']='fixture-context-unavailable';continue
  chance=p.get('chance_of_playing_next_round')
  available=1 if p['status']=='a' and chance is None else chance/100 if isinstance(chance,(int,float)) and not isinstance(chance,bool) and 0<=chance<=100 else None
  if available is None or p['status'] not in ('a','d','i','s','u'):row['reason']='availability-unknown';continue
  prof=profile(rows,prior,pos)
  if not prof:continue
  parts={};complete=True
  for f in fixtures:
   opponent=f['team_a'] if f['team_h']==p['team'] else f['team_h'];home=f['team_h']==p['team']
   if p['team'] not in strength or opponent not in strength:complete=False;break
   attack,defence=strength[p['team']];opp_attack,opp_defence=strength[opponent]
   lam_for=attack*opp_defence/mu*venue['h' if home else 'a'];lam_against=opp_attack*defence/mu*venue['a' if home else 'h']
   current=fixture_points(pos,prof,available,lam_for,lam_against,attack,s['scoring'])
   for key,value in current.items():parts[key]=parts.get(key,0)+value
  if complete:
   parts={k:round(v,6) for k,v in parts.items()};row.update(status='ready',xp=round(sum(parts.values()),6),components=parts,reason=None)
 asof=s['acquisition_started_at'];expiry=min(instant(asof)+21600,instant(target['deadline_time']))
 return {'schema_version':1,'model_id':'fpl-iphoenk-python-v1','model_version':model_version,'experimental':True,'season':s['season'],'target_gw':target['id'],'deadline_utc':target['deadline_time'],'generated_at_utc':utc(instant(now)),'inputs_as_of_utc':asof,'acquisition_finished_at_utc':s['acquisition_finished_at'],'expires_at_utc':utc(expiry),'scoring_version':RULES_VERSION,'scoring_hash':digest(s['scoring']),'rules_url':RULES_URL,'fixture_hash':s['fixture_hash'],'source_manifest':s['source_manifest'],'input_hash':digest(snapshot),'configuration':CONFIG,'historical_position_coverage':{'verified_rows':0,'unknown_rows':len(prior),'prior_cohort':'position-neutral'},'validation_status':'ready','players':output,'coverage':{'ready':sum(r['status']=='ready' for r in output.values()),'universe':len(output)},'training_gws':sorted({r['round'] for rows in s['histories'].values() for r in rows}),'methodology':'Experimental empirical position baseline. Unweighted checked current-season fixtures; position-neutral shrinkage priors (historical positions unavailable), current-position scoring and Poisson fixture assumptions. Published availability scaling is a heuristic, not a calibrated start probability. Manual refresh; expires within six hours. No tactical fit, simulated ranges or provider xP inputs.'}
