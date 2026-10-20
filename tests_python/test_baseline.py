import copy
import unittest
from fixtures import snapshot,NOW
from python_xp.baseline import predict
from python_xp.validate import InputError

class BaselineTests(unittest.TestCase):
 def test_position_scoring_and_complete_component_sum(self):
  result=predict(snapshot(),now=NOW);rows=result['players']
  self.assertEqual([rows[str(i)]['position'] for i in range(1,5)],[1,2,3,4])
  goals=[rows[str(i)]['components']['goals'] for i in range(1,5)]
  for i,coefficient in enumerate([10,6,5,4]):self.assertAlmostEqual(goals[i]/coefficient,goals[0]/10,places=5)
  self.assertGreater(rows['1']['components']['saves'],0)
  self.assertEqual(rows['4']['components']['clean_sheet'],0)
  self.assertEqual(rows['1']['components']['defcon'],0)
  for row in rows.values():self.assertAlmostEqual(sum(row['components'].values()),row['xp'],places=4)
 def test_dgw_adds_fixtures_without_captain_and_blank_is_proven(self):
  s=snapshot();one=predict(s,now=NOW)['players']['1']['xp'];f=copy.deepcopy(s['fixtures'][1]);f['id']=3;s['fixtures'].append(f)
  two=predict(s,now=NOW)['players']['1'];self.assertAlmostEqual(two['xp'],one*2,places=4);self.assertEqual(two['fixture_ids'],[2,3])
  s=snapshot();s['fixtures']=s['fixtures'][:1];r=predict(s,now=NOW)['players']['1'];self.assertEqual(r['xp'],0);self.assertEqual(r['reason'],'confirmed-blank')
 def test_unknown_and_missing_are_not_fabricated_zero(self):
  s=snapshot();s['histories']['1']=[];row=predict(s,now=NOW)['players']['1'];self.assertEqual(row['status'],'unavailable');self.assertIsNone(row['xp'])
  s=snapshot();s['bootstrap']['elements'][0]['status']='d';s['bootstrap']['elements'][0]['chance_of_playing_next_round']=None
  self.assertIsNone(predict(s,now=NOW)['players']['1']['xp'])
  s=snapshot();del s['histories']['1'][0]['saves']
  with self.assertRaises(InputError):predict(s,now=NOW)
 def test_historical_observations_never_move_between_position_priors(self):
  s=snapshot();s['histories']['2'][0]['expected_goals']=5;before=predict(s,now=NOW)
  s['bootstrap']['elements'][1]['element_type']=3
  after=predict(s,now=NOW)
  self.assertEqual(before['players']['3']['xp'],after['players']['3']['xp'])
  self.assertEqual(after['historical_position_coverage']['verified_rows'],0)
 def test_complete_zero_minute_observations_are_ready_zero(self):
  s=snapshot()
  for rows in s['histories'].values():
   for key in rows[0]:
    if key in ('minutes','starts','saves','defensive_contribution','expected_goals','expected_assists','clean_sheets','total_points'):rows[0][key]=0
  for row in predict(s,now=NOW)['players'].values():
   self.assertEqual(row['status'],'ready');self.assertEqual(row['xp'],0)
 def test_true_zero_attack_and_deductions_and_expiry(self):
  s=snapshot()
  for rows in s['histories'].values():rows[0]['expected_goals']='0';rows[0]['red_cards']=1
  result=predict(s,now=NOW)
  self.assertEqual(result['players']['1']['components']['goals'],0)
  self.assertLess(result['players']['1']['components']['cards'],0)
  self.assertEqual(result['expires_at_utc'],'2026-10-20T06:00:00.000Z')
  self.assertNotIn('probability',result['players']['1']);self.assertNotIn('range',result['players']['1'])
  self.assertEqual(result,predict(s,now=NOW))

if __name__=='__main__':unittest.main()
