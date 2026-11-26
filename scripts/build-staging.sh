#!/bin/bash
# Build dev.bitcoineducation.quest (staging) from gh-pages. Public staging Firebase web config only; no secrets.
set -euo pipefail
SRC=${SRC:-.}; OUT=${OUT:-out}; CFG=$(mktemp)
cat > "$CFG" <<'JSON'
{"projectId": "bitcoin-quest-staging", "appId": "1:689995930118:web:915f62b60c33cac100c187", "storageBucket": "bitcoin-quest-staging.firebasestorage.app", "apiKey": "AIzaSyB1gWK65s8MPFsKSK2-Qdp3eSXOjF7lnng", "authDomain": "bitcoin-quest-staging.firebaseapp.com", "messagingSenderId": "689995930118", "projectNumber": "689995930118", "version": "2"}
JSON
rm -rf "$OUT"; mkdir -p $OUT
tar -C "$SRC" --exclude=./out --exclude='./.?*' --exclude='*/.?*' --exclude=functions --exclude=workers --exclude=scripts --exclude=tests --exclude=docs --exclude=node_modules --exclude='*.sh' --exclude='*.md' --exclude='*.py' --exclude='*.rules' --exclude='*.bak*' --exclude=firebase.json --exclude='firebase.*.json' --exclude=firestore.indexes.json --exclude=CNAME -cf - . | tar -C $OUT -xf -

# Hidden-file excludes drop dot-directories. Re-copy Digital Asset Links so a
# staging TWA origin can serve /.well-known/assetlinks.json.
if [ -d "$SRC/.well-known" ]; then
  rm -rf "$OUT/.well-known"
  cp -a "$SRC/.well-known" "$OUT/.well-known"
fi
python3 - "$CFG" "$OUT" <<'PY'
import json,sys,os,re
c=json.load(open(sys.argv[1])); out=sys.argv[2]
L={'AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk':c['apiKey'],'1:1055248200518:web:6c6d64a5ee78e19bfbeb47':c['appId'],
   '1055248200518':c['messagingSenderId'],'bitcoin-education-archive.firebasestorage.app':c['storageBucket'],
   'us-central1-bitcoin-education-archive.cloudfunctions.net':'us-central1-bitcoin-quest-staging.cloudfunctions.net',
   'bitcoin-education-archive.firebaseapp.com':c['authDomain']}
n=0
for root,_,fs in os.walk(out):
  for f in fs:
    if not f.endswith(('.js','.html','.json')): continue
    p=os.path.join(root,f); s=open(p,encoding='utf-8',errors='surrogateescape').read(); o=s
    for a,b in L.items(): s=s.replace(a,b)
    if f in('firebase-config.js','sw.js','firebase-messaging-sw.js'):
      s=s.replace('"bitcoin-education-archive"','"bitcoin-quest-staging"').replace("'bitcoin-education-archive'","'bitcoin-quest-staging'")
    if f=='firebase-config.js': s=re.sub(r'authDomain:\s*"[^"]*"','authDomain: "%s"'%c['authDomain'],s)
    if s!=o: open(p,'w',encoding='utf-8',errors='surrogateescape').write(s); n+=1
print('rewrote',n,'files')
ticker=os.environ.get('SIGNAL_TICKER_URL','').rstrip('/')
if ticker:
  n2=0
  for root,_,fs in os.walk(out):
    for f in fs:
      if not f.endswith(('.js','.html')): continue
      p=os.path.join(root,f); s=open(p,encoding='utf-8',errors='surrogateescape').read(); o=s
      s=s.replace("fetch('newsletter-data.json", "fetch('%s/newsletter-data.json" % ticker)
      s=s.replace('fetch("newsletter-data.json', 'fetch("%s/newsletter-data.json' % ticker)
      if s!=o: open(p,'w',encoding='utf-8',errors='surrogateescape').write(s); n2+=1
  print('pointed newsletter-data.json at Signal ticker worker in',n2,'files')

idx=os.path.join(out,'index.html'); s=open(idx).read()
s=s.replace('<head>','<head>\n<meta name="robots" content="noindex,nofollow">',1)
s=s.replace('</body>','<div style="position:fixed;bottom:0;left:0;z-index:2147483647;background:#c00;color:#fff;font:bold 11px sans-serif;padding:2px 6px;pointer-events:none">STAGING · fake data</div></body>',1)
open(idx,'w').write(s)
PY
grep -q 'projectId: "bitcoin-quest-staging"' $OUT/firebase-config.js
! grep -rlI 'AIzaSyDLwucmRxjoJp2KMBTi2ujf0mlVkgLHyKk\|1055248200518' $OUT
# Staging-only App Check debug token. Read from the build env, never committed.
# Hard guard: refuse to inject unless the built projectId is bitcoin-quest-staging
# AND the Cloudflare Pages project is bq-staging. Fail loudly otherwise.
# Baking into HTML is kept because these Pages deploys are static; a runtime
# Pages Function would be a larger change. The token must still reach the
# browser for App Check debug, so the guard is the safety rail.
if [ -n "${STAGING_APPCHECK_DEBUG_TOKEN:-}" ]; then
  PAGES_PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-${PAGES_PROJECT:-}}"
  if ! grep -q 'projectId: "bitcoin-quest-staging"' "$OUT/firebase-config.js"; then
    echo 'REFUSING: STAGING_APPCHECK_DEBUG_TOKEN is set, but firebase-config projectId is not bitcoin-quest-staging' >&2
    exit 1
  fi
  if [ "$PAGES_PROJECT_NAME" != "bq-staging" ]; then
    echo "REFUSING: STAGING_APPCHECK_DEBUG_TOKEN is set, but CLOUDFLARE_PAGES_PROJECT/PAGES_PROJECT is '${PAGES_PROJECT_NAME:-unset}', not bq-staging" >&2
    exit 1
  fi
  python3 - "$OUT" <<'PY'
import os,sys,json
tok=os.environ['STAGING_APPCHECK_DEBUG_TOKEN']; tag='<script>self.FIREBASE_APPCHECK_DEBUG_TOKEN=%s;</script>'%json.dumps(tok)
SHIM=('<script>(function(){try{Object.defineProperty(window,"_btcRecaptchaFailed",{get:function(){return false},set:function(){},configurable:false})}catch(e){}'
 'function f(){return function(){try{return firebase.appCheck().getToken(false).then(function(t){return (t&&t.token)||""},function(){return ""})}catch(e){return Promise.resolve("")}}}'
 'try{Object.defineProperty(window,"_btcAppCheckForClaim",{get:f,set:function(){},configurable:false})}catch(e){}})();</script>')
n=0
for root,_,fs in os.walk(sys.argv[1]):
  for f in fs:
    if f.endswith('.html'):
      p=os.path.join(root,f); s=open(p,encoding='utf-8',errors='surrogateescape').read()
      if '<head>' in s:
        s=s.replace('<head>','<head>\n'+tag+SHIM,1)
        open(p,'w',encoding='utf-8',errors='surrogateescape').write(s); n+=1
print('appcheck debug token injected into',n,'pages')
PY
fi
printf 'User-agent: *\nDisallow: /\n' > $OUT/robots.txt
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > $OUT/_headers
echo "built $(git -C $SRC rev-parse --short HEAD)" > $OUT/staging-build.txt
cat $OUT/staging-build.txt
