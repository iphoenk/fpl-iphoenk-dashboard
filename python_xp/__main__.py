import argparse
import json
import sys
import time
from pathlib import Path
from .acquire import acquire_snapshot
from .baseline import predict
from .evaluate import evaluate
from .validate import InputError,utc

def main():
 parser=argparse.ArgumentParser(description='FPL iphoenk explicit experimental batch; no web-page computation')
 sub=parser.add_subparsers(dest='command',required=True)
 for name in ('acquire','predict','evaluate'):
  p=sub.add_parser(name);p.add_argument('--output',required=True)
  if name=='predict':p.add_argument('--input',required=True)
  if name=='evaluate':p.add_argument('--predictions',required=True);p.add_argument('--actuals',required=True)
 args=parser.parse_args();read=lambda path:json.loads(Path(path).read_text(encoding='utf-8'))
 try:
  result=acquire_snapshot() if args.command=='acquire' else predict(read(args.input),now=utc(time.time())) if args.command=='predict' else evaluate(read(args.predictions),read(args.actuals))
  output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf-8')
  print(json.dumps({'command':args.command,'coverage':result.get('coverage'),'output':str(output)}))
 except (InputError,OSError,ValueError,KeyError) as error:print('Model unavailable: '+str(error),file=sys.stderr);sys.exit(1)

if __name__=='__main__':main()
