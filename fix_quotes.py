with open('app.js', 'r') as f:
    text = f.read()

import re

# 1. FIX THE RESPOND FUNCTION ONCLICK QUOTES
# These were previously messed up by multiple edit/python attempts.
# Correct format should be: onclick="nachoRate(' + _replyMsgId + ', 1)" ... 
# but inside a single-quoted JS string it needs backslash escaping for the single quotes.

text = text.replace("go(''+ cid + '')", "go('\\'' + cid + '\\'')")
text = text.replace("nachoRate(''+ _replyMsgId + '', 1)", "nachoRate('\\'' + _replyMsgId + '\\'', 1)")
text = text.replace("nachoRate(''+ _replyMsgId + '', -1)", "nachoRate('\\'' + _replyMsgId + '\\'', -1)")
text = text.replace("nachoShareAnswer(window._nachoAnswerData[''+ _replyMsgId + ''])", "nachoShareAnswer(window._nachoAnswerData['\\' + _replyMsgId + '\\''])")

with open('app.js', 'w') as f:
    f.write(text)
print("Quotes fixed.")
