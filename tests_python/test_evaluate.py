import unittest
from python_xp.evaluate import evaluate

class EvaluationTests(unittest.TestCase):
 def test_matched_cohorts_and_position_mae(self):
  pred={'season':'2026','target_gw':2,'players':{'1':{'xp':4,'status':'ready','position':1,'permanent_code':101},'2':{'xp':7,'status':'ready','position':2,'permanent_code':102},'3':{'xp':None,'status':'unavailable','position':3}}}
  actual={'season':'2026','gameweek':2,'final':True,'players':{'1':{'points':2,'minutes':90,'permanent_code':101},'2':{'points':8,'minutes':90,'permanent_code':102},'4':{'points':10,'minutes':90}}}
  r=evaluate(pred,actual);self.assertEqual(r['count'],2);self.assertEqual(r['mae'],1.5);self.assertEqual(r['positions']['1']['mae'],2);self.assertEqual(r['spearman'],1)
  self.assertEqual(evaluate(pred,{'final':False})['status'],'pending')
  self.assertEqual(r['evidence'],'retrospective-matched-evaluation')
  from python_xp.validate import InputError
  for change in [{'season':'2025'},{'gameweek':18},{'season':None}]:
   with self.assertRaises(InputError):evaluate(pred,{**actual,**change})
  actual['players']['1']['permanent_code']=999
  with self.assertRaises(InputError):evaluate(pred,actual)

if __name__=='__main__':unittest.main()
