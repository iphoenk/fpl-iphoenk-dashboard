import copy

NOW='2026-10-20T00:00:00Z'
SCORING={'long_play':2,'short_play':1,'goals_conceded':{'GKP':-1,'DEF':-1,'MID':0,'FWD':0},'saves':1,'goals_scored':{'GKP':10,'DEF':6,'MID':5,'FWD':4},'assists':3,'clean_sheets':{'GKP':4,'DEF':4,'MID':1,'FWD':0},'penalties_saved':5,'penalties_missed':-2,'yellow_cards':-1,'red_cards':-3,'own_goals':-2,'bonus':1,'defensive_contribution':{'GKP':0,'DEF':2,'MID':2,'FWD':2}}

def snapshot():
 players=[{'id':i,'code':100+i,'web_name':'Player '+str(i),'team':1,'element_type':i,'status':'a','chance_of_playing_next_round':None} for i in range(1,5)]
 history={str(i):[{'element':i,'fixture':1,'round':1,'was_home':True,'opponent_team':2,'minutes':90,'starts':1,'goals_scored':0,'assists':0,'clean_sheets':1,'goals_conceded':0,'saves':3 if i==1 else 0,'bonus':0,'yellow_cards':0,'red_cards':0,'own_goals':0,'penalties_saved':0,'penalties_missed':0,'defensive_contribution':0 if i==1 else 12,'expected_goals':'1.0','expected_assists':'0.3','total_points':2}] for i in range(1,5)}
 return {'schema_version':1,'acquisition_started_at':NOW,'acquisition_finished_at':NOW,'source_manifest':[{'path':'bootstrap-static/','fetched_at':NOW,'sha256':'a'*64}], 'bootstrap':{'events':[{'id':1,'deadline_time':'2026-08-01T00:00:00Z','finished':True,'data_checked':True},{'id':2,'deadline_time':'2026-10-25T00:00:00Z','is_next':True}],'teams':[{'id':1,'short_name':'AAA'},{'id':2,'short_name':'BBB'}],'elements':players,'game_config':{'scoring':copy.deepcopy(SCORING)}},'fixtures':[{'id':1,'event':1,'team_h':1,'team_a':2,'team_h_score':2,'team_a_score':0,'kickoff_time':'2026-08-02T12:00:00Z','finished':True},{'id':2,'event':2,'team_h':2,'team_a':1,'team_h_score':None,'team_a_score':None,'kickoff_time':'2026-10-26T12:00:00Z','finished':False}], 'histories':history}
