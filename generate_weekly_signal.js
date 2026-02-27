const fs = require('fs');

// 1. Load News
const newsData = JSON.parse(fs.readFileSync('/root/simple-archive/newsletter-data.json', 'utf8'));

// 2. Load Education (from recently split scholar.js)
const scholarFile = fs.readFileSync('/root/simple-archive/scholar.js', 'utf8');
const propertiesMatch = scholarFile.match(/const SCHOLAR_PROPERTIES_POOL = (\[[\s\S]*?\]);/);
const scholarPool = propertiesMatch ? eval(propertiesMatch[1]) : [];
const randomEdu = scholarPool[Math.floor(Math.random() * scholarPool.length)];

// 3. Load a Pun (from nacho-qa.js)
const nachoFile = fs.readFileSync('/root/simple-archive/nacho-qa.js', 'utf8');
const puns = nachoFile.match(/🦌.*?(?=")/g) || ["Why did the deer start a node? He wanted to protect his herd of sats! 🦌"];
const randomPun = puns[Math.floor(Math.random() * puns.length)];

// 4. Generate HTML
const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { background: #f7931a; padding: 40px 20px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; letter-spacing: 1px; }
        .content { padding: 30px; }
        .section-title { font-size: 14px; font-weight: 800; color: #f7931a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        .news-item { margin-bottom: 24px; }
        .news-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #111; }
        .news-snippet { font-size: 15px; color: #666; margin-bottom: 10px; }
        .news-link { color: #f7931a; text-decoration: none; font-weight: 600; font-size: 14px; }
        .edu-box { background: #fff7ed; border: 1px dashed #f7931a; border-radius: 12px; padding: 20px; margin-top: 30px; }
        .edu-q { font-weight: 700; color: #111; margin-bottom: 8px; }
        .edu-a { color: #444; font-size: 15px; }
        .footer { background: #1a1a2e; color: #888; text-align: center; padding: 30px; font-size: 12px; }
        .pun { font-style: italic; color: #f7931a; margin-top: 20px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📡 THE WEEKLY SIGNAL</h1>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">Bitcoin Education Archive</div>
        </div>
        <div class="content">
            <div class="section-title">The Big Stories</div>
            ${newsData.news.map(n => `
                <div class="news-item">
                    <div class="news-title">${n.title}</div>
                    <div class="news-snippet">${n.snippet}</div>
                    <a href="${n.link}" class="news-link">Read full story →</a>
                </div>
            `).join('')}

            <div class="edu-box">
                <div class="section-title" style="border-color: rgba(247,147,26,0.2);">🎓 Antler Insight</div>
                <div class="edu-q">${randomEdu.q}</div>
                <div class="edu-a"><strong>Answer:</strong> ${randomEdu.a}</div>
            </div>

            <div style="text-align: center; margin-top: 40px;">
                <div class="section-title">Nacho's Pun of the Week</div>
                <div class="pun">"${randomPun}"</div>
            </div>
        </div>
        <div class="footer">
            <p>You received this because you opted-in on bitcoineducation.quest</p>
            <p>© 2026 603BTC LLC · Bitcoin Education Archive™</p>
            <p><a href="#" style="color: #666;">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
`;

fs.writeFileSync('/root/simple-archive/weekly_signal_draft.html', html);
console.log("Weekly Signal Draft items captured in: /root/simple-archive/weekly_signal_draft.html");
