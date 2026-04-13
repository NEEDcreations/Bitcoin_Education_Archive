#!/bin/bash
# X (@603BTC) → Telegram (@updates_603BTC) bridge
# Checks RSS feed for new tweets and posts them to the Telegram channel
# Run via cron every 15 minutes

# Load environment variables
if [ -f "/root/simple-archive/.env" ]; then
  export $(grep -v '^#' /root/simple-archive/.env | xargs)
fi

FEED_URL="https://rss.app/feeds/8jCjlT8E16kCeBrO.xml"
BOT_TOKEN="$X_BRIDGE_BOT_TOKEN"
CHAT_ID="$X_BRIDGE_CHAT_ID"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "Error: X_BRIDGE_BOT_TOKEN or X_BRIDGE_CHAT_ID not set in .env"
  exit 1
fi

SEEN_FILE="/root/simple-archive/scripts/.x_seen_guids"

# Create seen file if missing
touch "$SEEN_FILE"

# Fetch feed and extract items
FEED=$(curl -s "$FEED_URL" 2>/dev/null)
if [ -z "$FEED" ]; then
  echo "Failed to fetch feed"
  exit 1
fi

# Parse items with node
node -e "
var xml = require('fs').readFileSync('/dev/stdin', 'utf8');
var seen = require('fs').readFileSync('$SEEN_FILE', 'utf8').split('\n').filter(Boolean);
var seenSet = new Set(seen);
var newGuids = [];

// Simple XML parsing for RSS items
var items = xml.split('<item>').slice(1);
var toPost = [];

items.forEach(function(item) {
  var guid = (item.match(/<guid[^>]*>([^<]+)</) || [])[1] || '';
  if (!guid || seenSet.has(guid)) return;

  var title = (item.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/) || [])[1] || '';
  var link = (item.match(/<link>([^<]+)</) || [])[1] || '';
  var creator = (item.match(/<dc:creator><!\[CDATA\[(.+?)\]\]>/) || [])[1] || '@603BTC';
  var mediaUrl = (item.match(/<media:content[^>]+url=\"([^\"]+)\"/) || [])[1] || '';
  var pubDate = (item.match(/<pubDate>([^<]+)</) || [])[1] || '';

  // Skip if older than 24 hours (avoid flooding on first run)
  if (pubDate) {
    var age = Date.now() - new Date(pubDate).getTime();
    if (age > 24 * 60 * 60 * 1000) {
      newGuids.push(guid); // Mark as seen but don't post
      return;
    }
  }

  // Clean up title
  title = title.replace(/^RT by @603BTC: /, 'RT: ');

  toPost.push({ guid: guid, title: title, link: link, creator: creator, mediaUrl: mediaUrl });
  newGuids.push(guid);
});

// Mark all as seen
if (newGuids.length > 0) {
  require('fs').appendFileSync('$SEEN_FILE', newGuids.join('\n') + '\n');
}

// Output items to post (oldest first)
toPost.reverse();
console.log(JSON.stringify(toPost));
" <<< "$FEED" > /tmp/x_posts.json

# Post each new tweet
POSTS=$(cat /tmp/x_posts.json)
COUNT=$(echo "$POSTS" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)")

if [ "$COUNT" = "0" ]; then
  echo "No new tweets"
  exit 0
fi

echo "Posting $COUNT new tweets"

echo "$POSTS" | node -e "
var posts = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
var http = require('https');

function postToTelegram(text, mediaUrl) {
  return new Promise(function(resolve) {
    var method = mediaUrl ? 'sendPhoto' : 'sendMessage';
    var body = mediaUrl
      ? { chat_id: '$CHAT_ID', photo: mediaUrl, caption: text, parse_mode: 'HTML' }
      : { chat_id: '$CHAT_ID', text: text, parse_mode: 'HTML', disable_web_page_preview: false };

    var data = JSON.stringify(body);
    var req = http.request({
      hostname: 'api.telegram.org',
      path: '/bot$BOT_TOKEN/' + method,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString()); });
    });
    req.write(data);
    req.end();
  });
}

(async function() {
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var text = '🐦 <b>' + p.creator + '</b>\n\n' + p.title + '\n\n' + p.link;
    var result = await postToTelegram(text, p.mediaUrl);
    console.log('Posted:', p.title.substring(0, 50), '→', JSON.parse(result).ok ? 'OK' : 'FAIL');
    // Rate limit: wait 2s between posts
    await new Promise(function(r) { setTimeout(r, 2000); });
  }
})();
"
