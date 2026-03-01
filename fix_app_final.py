with open('app.js') as f:
    c = f.read()

import re

# Correct replacements for the current state in app.js
c = c.replace(\"nachoRate('\\'' + _replyMsgId + '\\'', 1)\", \"nachoRate('\\'' + _replyMsgId + '\\'', 1)\")
# Wait - if I use c.replace it's easier.
# Broken: actionRow += '<button onclick=\"nachoRate('\\'' + _replyMsgId + '\\'', 1)\" style=\"' + btnS + '\">👍 Helpful</button>';

# I will just define the WHOLE respond function cleanly and overwrite it.
start = c.find('function respond(html, source, meta) {')
end = c.find('checkNachoMilestone()')
if start != -1 and end != -1:
    # Find the closing brace of the respond function (before try block)
    closing = c.find('}', end)
    
    new_func = \"\"\"function respond(html, source, meta) {
            if (window._nachoWatchdog) { clearTimeout(window._nachoWatchdog); window._nachoWatchdog = null; }
            nachoChatClearThinking();
            nachoModeStopTalking();
            window._nachoBusy = false;

            var extra = '';
            if (meta && meta.siteAction) {
                extra = '<br><br><button onclick=\"' + meta.siteAction + '\" style=\"width:100%;padding:10px;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;\">' + (meta.siteLabel || 'Go →') + '</button>';
            } else if (meta && meta.channel) {
                var cid = meta.channel;
                var cname = meta.channelName || cid;
                extra = '<br><br><div style=\"color:var(--accent);font-weight:600;cursor:pointer;\" onclick=\"exitNachoMode(true);setTimeout(function(){go(\\'' + cid + '\\')},300)\">📖 Read more: ' + cname + ' →</div>';
            }

            var _replyMsgId = 'nm_' + Date.now();
            if (!window._nachoAnswerData) window._nachoAnswerData = {};
            window._nachoAnswerData[_replyMsgId] = html;

            var actionRow = '<div style=\"margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;\">';
            var btnS = 'background:none;border:1px solid var(--border);border-radius:16px;cursor:pointer;font-size:0.75rem;padding:4px 10px;color:var(--text-muted);display:inline-flex;align-items:center;gap:3px;';
            
            if (typeof nachoRatingHtml === 'function') {
                actionRow += '<button onclick=\"nachoRate(\\'' + _replyMsgId + '\\', 1)\" style=\"' + btnS + '\">👍 Helpful</button>';
                actionRow += '<button onclick=\"nachoRate(\\'' + _replyMsgId + '\\', -1)\" style=\"' + btnS + '\">👎 Not quite</button>';
            }
            actionRow += '<button onclick=\"nachoShareAnswer(window._nachoAnswerData[\\'' + _replyMsgId + '\\'])\" style=\"' + btnS + '\">📤 Share</button></div>';

            const personalized = (typeof personalize === 'function') ? personalize(html + extra) : (html + extra);
            
            nachoChatAdd('nacho', '', personalized + actionRow);
            nachoChatAppend('nacho', '', personalized + actionRow);
            updateNachoModeFriendship();
            if (typeof nachoTrackTopic === 'function') nachoTrackTopic(q, source || 'unknown');
            const ms = checkNachoMilestone();
            if (ms) setTimeout(function(){ nachoChatAdd('nacho','',ms); nachoChatAppend('nacho','',ms); }, 1500);
        }\"\"\"
    
    c = c[:start] + new_func + c[closing+1:]

with open('app.js', 'w') as f:
    f.write(c)
print(\"Rewrote respond function\")
