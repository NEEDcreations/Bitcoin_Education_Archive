// usermap.js — Community World Map
// Shows where Bitcoin Education Archive users are from.
// Reads from stats/countries (aggregated by Cloud Function).
// Falls back to a lightweight client-side query if stats doc is missing.
// Renders: regional progress bars + country flag grid + CTA if no country set.

(function() {
'use strict';

/* ───────────────── Region definitions ───────────────── */
var REGIONS = [
    { name: 'North America',   emoji: '🌎', countries: ['United States','Canada','Mexico','Guatemala','Belize','Honduras','El Salvador','Nicaragua','Costa Rica','Panama','Cuba','Jamaica','Haiti','Dominican Republic','Puerto Rico','Trinidad and Tobago','Barbados','Saint Lucia','Saint Kitts and Nevis','Saint Vincent and the Grenadines','Grenada','Antigua and Barbuda','Dominica','Bahamas'] },
    { name: 'South America',   emoji: '🌎', countries: ['Brazil','Argentina','Chile','Colombia','Venezuela','Peru','Ecuador','Bolivia','Paraguay','Uruguay','Guyana','Suriname'] },
    { name: 'Europe',          emoji: '🌍', countries: ['United Kingdom','Germany','France','Italy','Spain','Netherlands','Switzerland','Sweden','Norway','Denmark','Finland','Belgium','Austria','Portugal','Poland','Czech Republic','Hungary','Romania','Bulgaria','Greece','Croatia','Slovakia','Slovenia','Estonia','Latvia','Lithuania','Luxembourg','Malta','Cyprus','Ireland','Iceland','Serbia','Montenegro','Bosnia and Herzegovina','North Macedonia','Kosovo','Albania','Moldova','Ukraine','Belarus','Russia','Georgia','Armenia','Azerbaijan','Turkey','Liechtenstein','Monaco','San Marino','Vatican City','Andorra'] },
    { name: 'Africa',          emoji: '🌍', countries: ['Nigeria','South Africa','Kenya','Ghana','Ethiopia','Tanzania','Uganda','Rwanda','Cameroon','Senegal','Ivory Coast','Zambia','Zimbabwe','Mozambique','Angola','Egypt','Morocco','Algeria','Tunisia','Libya','Sudan','South Sudan','Somalia','Eritrea','Djibouti','Botswana','Namibia','Lesotho','Eswatini','Malawi','Madagascar','Comoros','Seychelles','Mauritius','Cabo Verde','Sao Tome and Principe','Equatorial Guinea','Gabon','Republic of the Congo','Central African Republic','Chad','Niger','Mali','Burkina Faso','Benin','Togo','Gambia','Guinea','Guinea-Bissau','Sierra Leone','Liberia','Mauritania'] },
    { name: 'Asia',           emoji: '🌏', countries: ['Japan','South Korea','China','India','Indonesia','Philippines','Vietnam','Thailand','Malaysia','Singapore','Bangladesh','Pakistan','Sri Lanka','Nepal','Bhutan','Myanmar','Cambodia','Laos','Taiwan','Hong Kong','Mongolia','Kazakhstan','Uzbekistan','Kyrgyzstan','Tajikistan','Turkmenistan','Afghanistan','Iran','Iraq','Saudi Arabia','United Arab Emirates','Qatar','Kuwait','Bahrain','Oman','Jordan','Lebanon','Israel','Palestine','Syria','Yemen','Brunei','Maldives','Timor-Leste'] },
    { name: 'Oceania',         emoji: '🌏', countries: ['Australia','New Zealand','Papua New Guinea','Fiji','Samoa','Tonga','Vanuatu','Solomon Islands','Kiribati','Marshall Islands','Micronesia','Nauru','Palau'] }
];

// Flatten all known countries from REGIONS for total-countries-reached count
var ALL_REGION_COUNTRIES = (function() {
    var set = {};
    REGIONS.forEach(function(r) { r.countries.forEach(function(c) { set[c] = true; }); });
    return set;
})();

// Country → emoji flag helper (ISO 3166-1 alpha-2 lookup)
var COUNTRY_FLAG = {
    'Afghanistan':'🇦🇫','Albania':'🇦🇱','Algeria':'🇩🇿','Andorra':'🇦🇩','Angola':'🇦🇴','Antigua and Barbuda':'🇦🇬',
    'Argentina':'🇦🇷','Armenia':'🇦🇲','Australia':'🇦🇺','Austria':'🇦🇹','Azerbaijan':'🇦🇿','Bahamas':'🇧🇸',
    'Bahrain':'🇧🇭','Bangladesh':'🇧🇩','Barbados':'🇧🇧','Belarus':'🇧🇾','Belgium':'🇧🇪','Belize':'🇧🇿',
    'Benin':'🇧🇯','Bhutan':'🇧🇹','Bolivia':'🇧🇴','Bosnia and Herzegovina':'🇧🇦','Botswana':'🇧🇼','Brazil':'🇧🇷',
    'Brunei':'🇧🇳','Bulgaria':'🇧🇬','Burkina Faso':'🇧🇫','Burundi':'🇧🇮','Cabo Verde':'🇨🇻','Cambodia':'🇰🇭',
    'Cameroon':'🇨🇲','Canada':'🇨🇦','Central African Republic':'🇨🇫','Chad':'🇹🇩','Chile':'🇨🇱','China':'🇨🇳',
    'Colombia':'🇨🇴','Comoros':'🇰🇲','Congo':'🇨🇬','Costa Rica':'🇨🇷','Croatia':'🇭🇷','Cuba':'🇨🇺',
    'Cyprus':'🇨🇾','Czech Republic':'🇨🇿','Denmark':'🇩🇰','Djibouti':'🇩🇯','Dominica':'🇩🇲','Dominican Republic':'🇩🇴',
    'Ecuador':'🇪🇨','Egypt':'🇪🇬','El Salvador':'🇸🇻','Equatorial Guinea':'🇬🇶','Eritrea':'🇪🇷','Estonia':'🇪🇪',
    'Eswatini':'🇸🇿','Ethiopia':'🇪🇹','Fiji':'🇫🇯','Finland':'🇫🇮','France':'🇫🇷','Gabon':'🇬🇦',
    'Gambia':'🇬🇲','Georgia':'🇬🇪','Germany':'🇩🇪','Ghana':'🇬🇭','Greece':'🇬🇷','Grenada':'🇬🇩',
    'Guatemala':'🇬🇹','Guinea':'🇬🇳','Guinea-Bissau':'🇬🇼','Guyana':'🇬🇾','Haiti':'🇭🇹','Honduras':'🇭🇳',
    'Hungary':'🇭🇺','Iceland':'🇮🇸','India':'🇮🇳','Indonesia':'🇮🇩','Iran':'🇮🇷','Iraq':'🇮🇶',
    'Ireland':'🇮🇪','Israel':'🇮🇱','Italy':'🇮🇹','Ivory Coast':'🇨🇮','Jamaica':'🇯🇲','Japan':'🇯🇵',
    'Jordan':'🇯🇴','Kazakhstan':'🇰🇿','Kenya':'🇰🇪','Kiribati':'🇰🇮','Kosovo':'🇽🇰','Kuwait':'🇰🇼',
    'Kyrgyzstan':'🇰🇬','Laos':'🇱🇦','Latvia':'🇱🇻','Lebanon':'🇱🇧','Lesotho':'🇱🇸','Liberia':'🇱🇷',
    'Libya':'🇱🇾','Liechtenstein':'🇱🇮','Lithuania':'🇱🇹','Luxembourg':'🇱🇺','Madagascar':'🇲🇬','Malawi':'🇲🇼',
    'Malaysia':'🇲🇾','Maldives':'🇲🇻','Mali':'🇲🇱','Malta':'🇲🇹','Marshall Islands':'🇲🇭','Mauritania':'🇲🇷',
    'Mauritius':'🇲🇺','Mexico':'🇲🇽','Micronesia':'🇫🇲','Moldova':'🇲🇩','Monaco':'🇲🇨','Mongolia':'🇲🇳',
    'Montenegro':'🇲🇪','Morocco':'🇲🇦','Mozambique':'🇲🇿','Myanmar':'🇲🇲','Namibia':'🇳🇦','Nauru':'🇳🇷',
    'Nepal':'🇳🇵','Netherlands':'🇳🇱','New Zealand':'🇳🇿','Nicaragua':'🇳🇮','Niger':'🇳🇪','Nigeria':'🇳🇬',
    'North Korea':'🇰🇵','North Macedonia':'🇲🇰','Norway':'🇳🇴','Oman':'🇴🇲','Pakistan':'🇵🇰','Palau':'🇵🇼',
    'Palestine':'🇵🇸','Panama':'🇵🇦','Papua New Guinea':'🇵🇬','Paraguay':'🇵🇾','Peru':'🇵🇪','Philippines':'🇵🇭',
    'Poland':'🇵🇱','Portugal':'🇵🇹','Qatar':'🇶🇦','Romania':'🇷🇴','Russia':'🇷🇺','Rwanda':'🇷🇼',
    'Saint Kitts and Nevis':'🇰🇳','Saint Lucia':'🇱🇨','Saint Vincent and the Grenadines':'🇻🇨','Samoa':'🇼🇸',
    'San Marino':'🇸🇲','Sao Tome and Principe':'🇸🇹','Saudi Arabia':'🇸🇦','Senegal':'🇸🇳','Serbia':'🇷🇸',
    'Seychelles':'🇸🇨','Sierra Leone':'🇸🇱','Singapore':'🇸🇬','Slovakia':'🇸🇰','Slovenia':'🇸🇮',
    'Solomon Islands':'🇸🇧','Somalia':'🇸🇴','South Africa':'🇿🇦','South Korea':'🇰🇷','South Sudan':'🇸🇸',
    'Spain':'🇪🇸','Sri Lanka':'🇱🇰','Sudan':'🇸🇩','Suriname':'🇸🇷','Sweden':'🇸🇪','Switzerland':'🇨🇭',
    'Syria':'🇸🇾','Taiwan':'🇹🇼','Tajikistan':'🇹🇯','Tanzania':'🇹🇿','Thailand':'🇹🇭','Timor-Leste':'🇹🇱',
    'Togo':'🇹🇬','Tonga':'🇹🇴','Trinidad and Tobago':'🇹🇹','Tunisia':'🇹🇳','Turkey':'🇹🇷',
    'Turkmenistan':'🇹🇲','Tuvalu':'🇹🇻','Uganda':'🇺🇬','Ukraine':'🇺🇦','United Arab Emirates':'🇦🇪',
    'United Kingdom':'🇬🇧','United States':'🇺🇸','Uruguay':'🇺🇾','Uzbekistan':'🇺🇿','Vanuatu':'🇻🇺',
    'Vatican City':'🇻🇦','Venezuela':'🇻🇪','Vietnam':'🇻🇳','Yemen':'🇾🇪','Zambia':'🇿🇲','Zimbabwe':'🇿🇼'
};

var TOTAL_COUNTRIES = 195; // UN-recognised + Taiwan/Kosovo

// Country name → ISO 3166-1 alpha-2 (for flagcdn.com images)
var COUNTRY_ISO = {
    'Afghanistan':'af','Albania':'al','Algeria':'dz','Andorra':'ad','Angola':'ao','Argentina':'ar',
    'Armenia':'am','Australia':'au','Austria':'at','Azerbaijan':'az','Bahamas':'bs','Bahrain':'bh',
    'Bangladesh':'bd','Barbados':'bb','Belarus':'by','Belgium':'be','Belize':'bz','Benin':'bj',
    'Bhutan':'bt','Bolivia':'bo','Bosnia and Herzegovina':'ba','Botswana':'bw','Brazil':'br',
    'Brunei':'bn','Bulgaria':'bg','Burkina Faso':'bf','Cambodia':'kh','Cameroon':'cm','Canada':'ca',
    'Chad':'td','Chile':'cl','China':'cn','Colombia':'co','Costa Rica':'cr','Croatia':'hr',
    'Cuba':'cu','Cyprus':'cy','Czech Republic':'cz','Denmark':'dk','Dominican Republic':'do',
    'Ecuador':'ec','Egypt':'eg','El Salvador':'sv','Estonia':'ee','Ethiopia':'et','Fiji':'fj',
    'Finland':'fi','France':'fr','Gambia':'gm','Georgia':'ge','Germany':'de','Ghana':'gh',
    'Greece':'gr','Guatemala':'gt','Guinea':'gn','Haiti':'ht','Honduras':'hn','Hungary':'hu',
    'Iceland':'is','India':'in','Indonesia':'id','Iran':'ir','Iraq':'iq','Ireland':'ie',
    'Israel':'il','Italy':'it','Ivory Coast':'ci','Jamaica':'jm','Japan':'jp','Jordan':'jo',
    'Kazakhstan':'kz','Kenya':'ke','Kuwait':'kw','Kyrgyzstan':'kg','Laos':'la','Latvia':'lv',
    'Lebanon':'lb','Libya':'ly','Lithuania':'lt','Luxembourg':'lu','Madagascar':'mg','Malawi':'mw',
    'Malaysia':'my','Maldives':'mv','Mali':'ml','Malta':'mt','Mauritius':'mu','Mexico':'mx',
    'Moldova':'md','Mongolia':'mn','Montenegro':'me','Morocco':'ma','Mozambique':'mz','Myanmar':'mm',
    'Namibia':'na','Nepal':'np','Netherlands':'nl','New Zealand':'nz','Nicaragua':'ni','Niger':'ne',
    'Nigeria':'ng','North Macedonia':'mk','Norway':'no','Oman':'om','Pakistan':'pk','Palestine':'ps',
    'Panama':'pa','Paraguay':'py','Peru':'pe','Philippines':'ph','Poland':'pl','Portugal':'pt',
    'Qatar':'qa','Romania':'ro','Russia':'ru','Rwanda':'rw','Saudi Arabia':'sa','Senegal':'sn',
    'Serbia':'rs','Singapore':'sg','Slovakia':'sk','Slovenia':'si','Somalia':'so',
    'South Africa':'za','South Korea':'kr','South Sudan':'ss','Spain':'es','Sri Lanka':'lk',
    'Sudan':'sd','Sweden':'se','Switzerland':'ch','Syria':'sy','Taiwan':'tw','Tajikistan':'tj',
    'Tanzania':'tz','Thailand':'th','Togo':'tg','Trinidad and Tobago':'tt','Tunisia':'tn',
    'Turkey':'tr','Uganda':'ug','Ukraine':'ua','United Arab Emirates':'ae','United Kingdom':'gb',
    'United States':'us','Uruguay':'uy','Uzbekistan':'uz','Venezuela':'ve','Vietnam':'vn',
    'Yemen':'ye','Zambia':'zm','Zimbabwe':'zw','Kosovo':'xk','Hong Kong':'hk'
};

function _flagImg(country, size) {
    var iso = COUNTRY_ISO[country];
    var sz = size || 24;
    if (!iso) {
        var abbr = country.substring(0, 2).toUpperCase();
        return '<span style="font-size:0.65rem;font-weight:700;color:var(--text-faint);display:inline-block;width:' + sz + 'px;text-align:center;">' + abbr + '</span>';
    }
    return '<img src="https://flagcdn.com/' + iso + '.svg" width="' + sz + '" height="' + Math.round(sz * 0.75) + '" alt="' + country + '" title="' + country + '" style="border-radius:2px;vertical-align:middle;display:inline-block;" onerror="this.outerHTML=\'<span style=font-size:0.65rem;font-weight:700>' + iso.toUpperCase() + '</span>\'">';
}

/* ───────────────── Flag tap tooltip ───────────────── */
window._umShowFlagTip = function(el, text) {
    // Remove any existing tip
    var existing = document.getElementById('_umFlagTip');
    if (existing) existing.remove();
    var tip = document.createElement('div');
    tip.id = '_umFlagTip';
    tip.textContent = text;
    tip.style.cssText = 'position:fixed;background:rgba(30,30,30,0.96);color:#fff;font-size:0.75rem;font-weight:600;padding:5px 10px;border-radius:8px;pointer-events:none;z-index:9999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:1px solid rgba(247,147,26,0.4);';
    document.body.appendChild(tip);
    // Position above the element
    var rect = el.getBoundingClientRect();
    var tw = tip.offsetWidth;
    var left = Math.max(6, Math.min(rect.left + rect.width / 2 - tw / 2, window.innerWidth - tw - 6));
    var top = rect.top - tip.offsetHeight - 8 + window.scrollY;
    if (top < window.scrollY + 4) top = rect.bottom + 8 + window.scrollY;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    // Auto-dismiss after 1.8s or on next tap anywhere
    var dismiss = function() { tip.remove(); document.removeEventListener('touchstart', dismiss); document.removeEventListener('click', dismiss); };
    setTimeout(dismiss, 1800);
    setTimeout(function() { document.addEventListener('touchstart', dismiss, {once:true}); document.addEventListener('click', dismiss, {once:true}); }, 50);
};

/* ───────────────── Cache ───────────────── */
var _mapCache = null;
var _mapCacheTs = 0;
var _MAP_CACHE_TTL = 5 * 60 * 1000; // 5 min

/* ───────────────── Public entry point ───────────────── */
window.renderUserWorldMap = function() {
    var el = document.getElementById('communityWorldMap');
    if (!el) return;

    // Skeleton while loading
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.85rem;">🌍 Loading world map…</div>';

    // Use cache if fresh
    if (_mapCache && (Date.now() - _mapCacheTs < _MAP_CACHE_TTL)) {
        _renderMap(el, _mapCache);
        return;
    }

    if (typeof db === 'undefined') { el.innerHTML = ''; return; }

    // Try stats/countries first (cheap single-doc read)
    db.collection('stats').doc('countries').get().then(function(doc) {
        var data = doc.exists ? doc.data() : null;
        if (data && data.counts && Object.keys(data.counts).length > 0) {
            _mapCache = data.counts;
            _mapCacheTs = Date.now();
            _renderMap(el, data.counts);
        } else {
            // Fallback: lightweight aggregate (query users with country set, limit 500)
            _fetchCountsFromUsers(el);
        }
    }).catch(function() {
        _fetchCountsFromUsers(el);
    });
};

function _fetchCountsFromUsers(el) {
    if (typeof db === 'undefined') { el.innerHTML = ''; return; }
    db.collection('users')
      .where('country', '>', '')
      .limit(500)
      .get()
      .then(function(snap) {
          var counts = {};
          snap.forEach(function(doc) {
              var c = (doc.data().country || '').trim();
              if (c) counts[c] = (counts[c] || 0) + 1;
          });
          _mapCache = counts;
          _mapCacheTs = Date.now();
          _renderMap(el, counts);
      }).catch(function() {
          el.innerHTML = '';
      });
}

/* ───────────────── Renderer ───────────────── */
function _renderMap(el, counts) {
    var totalUsers     = Object.keys(counts).reduce(function(s, k) { return s + (counts[k] || 0); }, 0);
    var countriesReached = Object.keys(counts).filter(function(c) { return counts[c] > 0; }).length;
    if (totalUsers === 0 && countriesReached === 0) { el.innerHTML = ''; return; }

    // Sort countries by count desc
    var sorted = Object.keys(counts).sort(function(a, b) { return (counts[b] || 0) - (counts[a] || 0); });

    // Build region totals
    var regionTotals = {};
    REGIONS.forEach(function(r) {
        if (!r.countries.length) return;
        var total = 0;
        var reached = 0;
        r.countries.forEach(function(c) {
            if (counts[c]) { total += counts[c]; reached++; }
        });
        if (total > 0) regionTotals[r.name] = { total: total, reached: reached, emoji: r.emoji };
    });

    var maxCount = sorted.length > 0 ? (counts[sorted[0]] || 1) : 1;

    // ── Header ──
    var html = '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-top:16px;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">';
    html += '<div style="font-size:0.95rem;color:var(--text);">🌍 <span style="font-weight:700;">Bitcoin is Global</span> <span style="font-weight:400;">and so is our userbase</span></div>';
    html += '<div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">';
    html += '<span style="color:var(--accent);font-weight:700;">' + countriesReached + '</span>';
    html += '<span style="color:var(--text-faint);"> / ' + TOTAL_COUNTRIES + ' countries</span>';
    html += '</div></div>';
    // ── Progress bar: countries reached ──
    var pct = Math.min(100, Math.round((countriesReached / TOTAL_COUNTRIES) * 100));
    html += '<div style="margin-bottom:14px;">';
    html += '<div style="height:8px;background:var(--border);border-radius:6px;overflow:hidden;margin-bottom:4px;">';
    html += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--accent),#ffb833);border-radius:6px;transition:width 0.6s ease;"></div>';
    html += '</div>';
    html += '<div style="font-size:0.72rem;color:var(--text-faint);text-align:right;">' + pct + '% of the world reached 🟠</div>';
    html += '</div>';

    // ── Region breakdown ──
    var regionKeys = Object.keys(regionTotals).sort(function(a, b) { return regionTotals[b].total - regionTotals[a].total; });
    if (regionKeys.length > 0) {
        html += '<div style="margin-bottom:14px;">';
        var maxRegion = regionTotals[regionKeys[0]].total;
        regionKeys.forEach(function(rName) {
            var r = regionTotals[rName];
            var rPct = Math.max(4, Math.round((r.total / maxRegion) * 100));
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
            html += '<div style="width:110px;font-size:0.72rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + r.emoji + ' ' + rName + '</div>';
            html += '<div style="flex:1;height:6px;background:var(--border);border-radius:4px;overflow:hidden;">';
            html += '<div style="height:100%;width:' + rPct + '%;background:var(--accent);border-radius:4px;opacity:0.85;"></div>';
            html += '</div>';
            html += '<div style="width:40px;text-align:right;font-size:0.72rem;color:var(--text-faint);">' + _fmt(r.total) + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }

    // ── Country flag grid (top 30 by count) ──
    var topN = sorted.slice(0, 30);
    if (topN.length > 0) {
        html += '<div style="margin-bottom:12px;">';
        html += '<div style="font-size:0.72rem;color:var(--text-faint);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Top Countries</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        topN.forEach(function(c) {
            var n = counts[c] || 0;
            var barW = Math.max(8, Math.round((n / maxCount) * 40));
            var label = c + ': ' + n + ' user' + (n !== 1 ? 's' : '');
            html += '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;position:relative;" title="' + label + '" onclick="window._umShowFlagTip(this,\'' + label.replace(/'/g,"\\'\'") + '\')">';
            html += _flagImg(c, 24);
            html += '<div style="width:' + barW + 'px;height:3px;background:var(--accent);border-radius:2px;opacity:0.7;min-width:8px;"></div>';
            html += '<span style="font-size:0.6rem;color:var(--text-faint);">' + _fmt(n) + '</span>';
            html += '</div>';
        });
        html += '</div></div>';
    }

    // ── Show more toggle (remaining countries) ──
    var remaining = sorted.slice(30);
    if (remaining.length > 0) {
        html += '<div id="umMoreCountries" style="display:none;margin-bottom:10px;">';
        html += '<div style="font-size:0.72rem;color:var(--text-faint);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">Also representing</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        remaining.forEach(function(c) {
            var n = counts[c] || 0;
            var label = c + ': ' + _fmt(n) + ' user' + (n !== 1 ? 's' : '');
            html += '<span title="' + label + '" style="cursor:pointer;display:inline-block;position:relative;" onclick="window._umShowFlagTip(this,\'' + label.replace(/'/g,"\\'\'") + '\')">' + _flagImg(c, 20) + '</span>';
        });
        html += '</div></div>';
        html += '<button onclick="var m=document.getElementById(\'umMoreCountries\');m.style.display=m.style.display===\'none\'?\'block\':\'none\';this.textContent=m.style.display===\'none\'?\'▼ ' + remaining.length + ' more countries\':\'▲ hide\'" style="background:none;border:none;color:var(--text-faint);font-size:0.72rem;cursor:pointer;padding:0;font-family:inherit;margin-bottom:10px;">▼ ' + remaining.length + ' more countries</button>';
    }

    // ── CTA: add your country ──
    var hasCountry = typeof currentUser !== 'undefined' && currentUser && currentUser.country;
    if (!hasCountry) {
        var isSignedIn = typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
        html += '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(247,147,26,0.03));border:1px dashed rgba(247,147,26,0.35);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;">';
        html += '<span style="font-size:1.3rem;">📍</span>';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:0.8rem;font-weight:700;color:var(--text);">Put your flag on the map!</div>';
        html += '<div style="font-size:0.72rem;color:var(--text-muted);">Add your country and earn <span style="color:#22c55e;font-weight:700;">+100 XP</span> + the 🌍 Global Citizen badge.</div>';
        html += '</div>';
        if (isSignedIn) {
            html += '<button onclick="if(typeof showSettings===\'function\')showSettings();setTimeout(function(){if(typeof showSettingsPage===\'function\')showSettingsPage(\'account\')},200)" style="padding:7px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.75rem;cursor:pointer;font-family:inherit;white-space:nowrap;">Add Country →</button>';
        } else {
            html += '<button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:7px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-weight:700;font-size:0.75rem;cursor:pointer;font-family:inherit;white-space:nowrap;">Sign In →</button>';
        }
        html += '</div>';
    }

    html += '</div>'; // card close
    el.innerHTML = html;
}

function _fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

/* ───────────────── Refresh after profile save ───────────────── */
// Hook into profile save — clear cache so map updates immediately
var _origSaveProfile = null;
document.addEventListener('btcProfileSaved', function() {
    _mapCache = null;
    _mapCacheTs = 0;
    var el = document.getElementById('communityWorldMap');
    if (el && el.offsetParent !== null) window.renderUserWorldMap();
});

})();
