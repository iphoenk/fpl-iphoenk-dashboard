import copy
import unittest
from fixtures import snapshot,NOW
from python_xp.acquire import acquire_snapshot,fetch_json
from python_xp.validate import InputError,instant

class AcquisitionTests(unittest.TestCase):
 def test_next_deadline_changed_during_collection_aborts(self):
  s=snapshot();calls=[]
  def fetch(path):
   calls.append(path)
   if path=='fixtures/':return s['fixtures']
   if path=='bootstrap-static/':
    bs=copy.deepcopy(s['bootstrap'])
    if calls.count(path)>1:bs['events'][-1]['deadline_time']='2026-10-26T00:00:00Z'
    return bs
   return {'history':s['histories'][path.split('/')[1]]}
  with self.assertRaises(InputError):acquire_snapshot(fetch,lambda:instant(NOW))
 def test_collection_is_complete_and_allowlist_is_fixed(self):
  s=snapshot()
  def fetch(path):return s['bootstrap'] if path=='bootstrap-static/' else s['fixtures'] if path=='fixtures/' else {'history':s['histories'][path.split('/')[1]]}
  self.assertEqual(len(acquire_snapshot(fetch,lambda:instant(NOW))['histories']),4)
  with self.assertRaises(InputError):fetch_json('https://example.com/')

if __name__=='__main__':unittest.main()
