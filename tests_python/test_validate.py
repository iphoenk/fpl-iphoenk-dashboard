import copy
import unittest
from fixtures import snapshot,NOW
from python_xp.validate import validate_snapshot,InputError,validate_scoring

class ValidationTests(unittest.TestCase):
 def test_reported_zero_is_preserved_missing_is_rejected(self):
  s=snapshot();s['histories']['1'][0]['expected_goals']='0.00'
  self.assertEqual(validate_snapshot(s,NOW)['histories']['1'][0]['expected_goals'],0)
  del s['histories']['1'][0]['expected_goals']
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
 def test_duplicate_and_conflicting_fixture_records(self):
  s=snapshot();s['histories']['1'].append(copy.deepcopy(s['histories']['1'][0]))
  self.assertEqual(len(validate_snapshot(s,NOW)['histories']['1']),1)
  s['histories']['1'][-1]['minutes']=30
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
 def test_unchecked_gameweek_does_not_enter_history(self):
  s=snapshot();s['bootstrap']['events'][0]['data_checked']=False
  self.assertEqual(validate_snapshot(s,NOW)['histories']['1'],[])
 def test_identity_and_missing_acquisition_and_window(self):
  s=snapshot();s['histories']['1'][0]['element']=99
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
  s=snapshot();del s['histories']['4']
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
  s=snapshot();s['acquisition_started_at']='2026-10-19T22:00:00Z'
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
 def test_unknown_scoring_is_not_guessed(self):
  s=snapshot();s['bootstrap']['game_config']['scoring']['goals_scored']['GKP']=6
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
 def test_fixture_mismatch_and_future_records(self):
  s=snapshot();s['histories']['1'][0]['opponent_team']=1
  with self.assertRaises(InputError):validate_snapshot(s,NOW)
  s=snapshot();s['fixtures'][0]['kickoff_time']='2026-10-24T00:00:00Z'
  with self.assertRaises(InputError):validate_snapshot(s,NOW)

if __name__=='__main__':unittest.main()
