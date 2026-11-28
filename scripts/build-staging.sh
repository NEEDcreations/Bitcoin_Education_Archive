#!/bin/bash
# Build dev.bitcoineducation.quest (staging) from gh-pages. Public staging Firebase web config only; no secrets.
set -euo pipefail
SRC=${SRC:-.}; CFG=$(mktemp)
# The output holds staging-only material (App Check debug token, Turnstile test
# sitekey), so it must never land inside a repo checkout where deploy.sh's
# `git add -A` or deploy.yml's copy could ship it (Red Team D1). Default to a
# fresh temp dir; refuse any OUT that resolves inside SRC or inside the git tree.
OUT=${OUT:-$(mktemp -d /tmp/bq-staging-out.XXXXXX)}
OUT_ABS=$(realpath -m "$OUT")
SRC_ABS=$(realpath -m "$SRC")
SRC_TOP=$(git -C "$SRC" rev-parse --show-toplevel 2>/dev/null || echo "$SRC_ABS")
SRC_TOP=$(realpath -m "$SRC_TOP")
if [ "$OUT_ABS" = "/" ]; then echo "REFUSING: OUT resolves to /" >&2; exit 1; fi
# OUT is rm -rf'd below, so it must not contain the checkout either.
case "$SRC_TOP/" in "$OUT_ABS"/*)
  echo "REFUSING: OUT '$OUT_ABS' contains the repo tree '$SRC_TOP'; rm -rf would delete it." >&2
  exit 1 ;;
esac
case "$OUT_ABS/" in
  "$SRC_ABS"/*|"$SRC_TOP"/*)
    echo "REFUSING: OUT '$OUT' resolves to '$OUT_ABS', inside the repo tree '$SRC_TOP' (or is /). Use a dir outside the checkout." >&2
    exit 1 ;;
esac
if CWD_TOP=$(git rev-parse --show-toplevel 2>/dev/null); then
  case "$OUT_ABS/" in "$(realpath -m "$CWD_TOP")"/*)
    echo "REFUSING: OUT '$OUT_ABS' is inside the current git checkout '$CWD_TOP'." >&2
    exit 1 ;;
  esac
fi
# OUT is rm -rf'd below (Red Team R1). Only accept a dedicated build dir:
# /tmp/bq-staging-out.* (the mktemp default) or a subdir of $RUNNER_TEMP in CI.
# Anything else (/home/box, $HOME, /tmp, /workspace, ...) is refused.
OUT_OK=0
case "$OUT_ABS" in /tmp/bq-staging-out.?*) OUT_OK=1 ;; esac
if [ -n "${RUNNER_TEMP:-}" ]; then
  RT_ABS=$(realpath -m "$RUNNER_TEMP")
  if [ "$RT_ABS" != "/" ]; then
    case "$OUT_ABS" in "$RT_ABS"/?*) OUT_OK=1 ;; esac
  fi
fi
if [ "$OUT_OK" != 1 ]; then
  echo "REFUSING: OUT '$OUT_ABS' is not a dedicated build dir. Use /tmp/bq-staging-out.<name> (or leave OUT unset), or a subdir of \$RUNNER_TEMP in CI." >&2
  exit 1
fi
# Only delete a dir this script built before: an existing non-empty OUT must
# carry the marker that this script writes at the end of every build
# (staging-build.txt, "built <sha>"). A dotfile marker would be uploaded and
# served by the Pages deploy, so the existing build stamp is the marker.
if [ -e "$OUT_ABS" ] && { [ ! -d "$OUT_ABS" ] || [ -L "$OUT_ABS" ]; }; then
  echo "REFUSING: OUT '$OUT_ABS' exists and is not a plain directory." >&2
  exit 1
fi
if [ -d "$OUT_ABS" ] && [ -n "$(ls -A "$OUT_ABS")" ]; then
  if ! grep -qxE 'built [0-9a-f]{7,40}' "$OUT_ABS/staging-build.txt" 2>/dev/null; then
    echo "REFUSING: OUT '$OUT_ABS' is not empty and has no staging-build.txt marker from an earlier build; not deleting it." >&2
    exit 1
  fi
fi
OUT=$OUT_ABS
cat > "$CFG" <<'JSON'
{"projectId": "bitcoin-quest-staging", "appId": "1:689995930118:web:915f62b60c33cac100c187", "storageBucket": "bitcoin-quest-staging.firebasestorage.app", "apiKey": "AIzaSyB1gWK65s8MPFsKSK2-Qdp3eSXOjF7lnng", "authDomain": "bitcoin-quest-staging.firebaseapp.com", "messagingSenderId": "689995930118", "projectNumber": "689995930118", "version": "2"}
JSON
rm -rf "$OUT"; mkdir -p "$OUT"
tar -C "$SRC" --exclude=./out --exclude=./_site --exclude='./.?*' --exclude='*/.?*' --exclude=functions --exclude=workers --exclude=scripts --exclude=tests --exclude=docs --exclude=node_modules --exclude='*.sh' --exclude='*.md' --exclude='*.py' --exclude='*.rules' --exclude='*.bak*' --exclude=firebase.json --exclude='firebase.*.json' --exclude=firestore.indexes.json --exclude=CNAME -cf - . | tar -C "$OUT" -xf -

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
# Staging-only Turnstile test sitekey (Cloudflare's documented always-pass key).
# Opt-in with STAGING_TURNSTILE_TEST_SITEKEY=1. Same hard guard as the App Check
# debug token: refuse unless the built projectId is bitcoin-quest-staging AND the
# Cloudflare Pages project is bq-staging. Rewrites the build output only; the repo
# and live builds (deploy.yml copies the repo and never runs this script) keep the
# real sitekey. Pairs with the staging-only TURNSTILE_SECRET_KEY test secret.
if [ "${STAGING_TURNSTILE_TEST_SITEKEY:-}" = "1" ]; then
  PAGES_PROJECT_NAME="${CLOUDFLARE_PAGES_PROJECT:-${PAGES_PROJECT:-}}"
  if ! grep -q 'projectId: "bitcoin-quest-staging"' "$OUT/firebase-config.js"; then
    echo 'REFUSING: STAGING_TURNSTILE_TEST_SITEKEY=1, but firebase-config projectId is not bitcoin-quest-staging' >&2
    exit 1
  fi
  if [ "$PAGES_PROJECT_NAME" != "bq-staging" ]; then
    echo "REFUSING: STAGING_TURNSTILE_TEST_SITEKEY=1, but CLOUDFLARE_PAGES_PROJECT/PAGES_PROJECT is '${PAGES_PROJECT_NAME:-unset}', not bq-staging" >&2
    exit 1
  fi
  LIVE_TS_SITEKEY='0x4AAAAAAD-ivgpRkbXpgz86'
  TEST_TS_SITEKEY='1x00000000000000000000AA'
  TS_FILES=$(grep -rlIF "$LIVE_TS_SITEKEY" "$OUT" || true)
  if [ -z "$TS_FILES" ]; then
    echo 'REFUSING: STAGING_TURNSTILE_TEST_SITEKEY=1, but the live sitekey was not found in the build output' >&2
    exit 1
  fi
  printf '%s\n' "$TS_FILES" | xargs sed -i "s/$LIVE_TS_SITEKEY/$TEST_TS_SITEKEY/g"
  if grep -rqIF "$LIVE_TS_SITEKEY" "$OUT"; then
    echo 'REFUSING: live Turnstile sitekey still in staging output after the swap' >&2
    exit 1
  fi
  echo "turnstile test sitekey swapped into: $(printf '%s ' $TS_FILES)"
fi
printf 'User-agent: *\nDisallow: /\n' > $OUT/robots.txt
printf '/*\n  X-Robots-Tag: noindex, nofollow\n' > $OUT/_headers
echo "built $(git -C $SRC rev-parse --short HEAD)" > $OUT/staging-build.txt
cat $OUT/staging-build.txt
