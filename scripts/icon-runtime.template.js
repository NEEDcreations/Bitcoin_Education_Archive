// Bitcoin Education Archive — custom SVG icon system
// GENERATED FILE — do not edit by hand.
// Source icons: assets/icons/*.svg  (edit scripts/author-icons.py)
// Mapping + build: scripts/build-icons.js   Rebuild: node scripts/build-icons.js
//
// Replaces UI emojis (objects/symbols used as app chrome) with the site's own
// SVG icon set. Expressive/social emojis (faces, hands, hearts, flags) are not
// mapped, and user-content zones (chat, forum, DMs, marketplace) are excluded,
// so people's messages and reactions keep native emojis.
(function () {
    'use strict';
    if (window.BEAIcons) return;

    var ICONS = __ICONS__;

    var MAP = __MAP__;

    // Zones that must keep native emojis: user-generated content, editors,
    // and anything tagged data-emoji-keep. .bea-i prevents re-processing.
    var EXCLUDE = 'script,style,textarea,input,select,code,pre,[contenteditable],' +
        '[data-emoji-keep],.bea-i,' +
        '#globalChatMessages,#forumPosts,#forumReplies,#dmMessages,#dmInboxList,' +
        '#marketListings,#myMarketMessages,#chatAutocomplete';

    var keys = Object.keys(MAP).sort(function (a, b) { return b.length - a.length; });
    var RX = new RegExp(keys.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|'), 'g');

    // 1.2em matches the visual weight of a native emoji at the same font size.
    var css = '.bea-i{display:inline-block;width:1.2em;height:1.2em;' +
        'vertical-align:-0.24em;line-height:1;pointer-events:none}' +
        '.bea-i svg{width:100%;height:100%;display:block}';
    var style = document.createElement('style');
    style.id = 'bea-icon-css';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);

    function iconNode(name) {
        var span = document.createElement('span');
        span.className = 'bea-i bea-i-' + name;
        span.setAttribute('role', 'img');
        span.setAttribute('aria-label', name.replace(/-/g, ' '));
        span.innerHTML = ICONS[name];
        return span;
    }

    function processText(node) {
        var text = node.nodeValue;
        if (!text) return;
        RX.lastIndex = 0;
        if (!RX.test(text)) return;
        var el = node.parentElement;
        if (!el || el.closest(EXCLUDE)) return;
        RX.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        while ((m = RX.exec(text))) {
            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
            frag.appendChild(iconNode(MAP[m[0]]));
            last = m.index + m[0].length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
    }

    function sweep(root) {
        if (!root) return;
        if (root.nodeType === 3) { processText(root); return; }
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        if (root.nodeType === 1 && root.closest && root.closest(EXCLUDE)) return;
        // Collect first: replacing nodes mid-walk breaks the TreeWalker.
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (var i = 0; i < nodes.length; i++) processText(nodes[i]);
    }

    function start() {
        sweep(document.body);
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                var mu = muts[i];
                if (mu.type === 'characterData') { processText(mu.target); continue; }
                for (var j = 0; j < mu.addedNodes.length; j++) sweep(mu.addedNodes[j]);
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    window.BEAIcons = {
        names: Object.keys(ICONS),
        has: function (name) { return Object.prototype.hasOwnProperty.call(ICONS, name); },
        svg: function (name) { return ICONS[name] || ''; },
        el: iconNode,
        sweep: sweep
    };

    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
})();
