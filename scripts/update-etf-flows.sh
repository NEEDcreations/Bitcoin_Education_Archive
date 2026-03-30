#!/bin/bash
# Fetch latest Bitcoin ETF daily flows from Bitbo (SSR HTML scraping)
# Run via cron: 0 */4 * * * /root/simple-archive/scripts/update-etf-flows.sh

cd /root/simple-archive || exit 1

node -e "
var https = require('https');
var fs = require('fs');

var options = {
    hostname: 'bitbo.io',
    path: '/treasuries/etf-flows/',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BitcoinArchive/1.0)' }
};

https.get(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
        // Parse table
        var tableMatch = data.match(/<table[\\s\\S]*?Totals[\\s\\S]*?<\\/table>/);
        if (!tableMatch) { console.error('No table found'); process.exit(1); }

        var rows = tableMatch[0].match(/<tr[^>]*>[\\s\\S]*?<\\/tr>/g);
        if (!rows || rows.length < 3) { console.error('Too few rows'); process.exit(1); }

        var dailyFlows = [];
        for (var i = 1; i < rows.length; i++) {
            var cells = rows[i].match(/<t[dh][^>]*>([\\s\\S]*?)<\\/t[dh]>/g);
            if (!cells) continue;
            var vals = cells.map(function(c) { return c.replace(/<[^>]*>/g, '').trim(); });
            if (vals[0] === 'Total' || vals[0] === 'Average' || vals[0] === 'Maximum' || vals[0] === 'Minimum') continue;
            var total = parseFloat(vals[vals.length - 1]);
            if (!isNaN(total)) {
                dailyFlows.push({ date: vals[0], total: total, ibit: parseFloat(vals[1]) || 0 });
            }
        }

        if (dailyFlows.length === 0) { console.error('No flow data parsed'); process.exit(1); }

        // Calculate stats
        var latest = dailyFlows[0];
        var sum5d = 0, sum10d = 0, outflowDays = 0;
        for (var j = 0; j < dailyFlows.length; j++) {
            if (j < 5) sum5d += dailyFlows[j].total;
            if (j < 10) sum10d += dailyFlows[j].total;
            if (dailyFlows[j].total < 0) outflowDays++;
        }

        var result = {
            ts: Date.now(),
            latestDate: latest.date,
            latestFlow: latest.total,
            sum5d: Math.round(sum5d * 10) / 10,
            sum10d: Math.round(sum10d * 10) / 10,
            outflowDays: outflowDays,
            totalDays: dailyFlows.length,
            flows: dailyFlows.slice(0, 10)
        };

        fs.writeFileSync('data/etf-flows.json', JSON.stringify(result));
        console.log('Updated ETF flows: latest=' + latest.date + ' flow=' + latest.total + 'M, 5d=' + result.sum5d + 'M, outflow days=' + outflowDays + '/' + dailyFlows.length);
    });
}).on('error', function(e) { console.error('Fetch error:', e.message); process.exit(1); });
"
