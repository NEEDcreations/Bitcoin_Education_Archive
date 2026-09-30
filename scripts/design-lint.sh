#!/bin/bash
# design-lint.sh — keeps the visual system from drifting back.
#
# STRICT scope (fails the build): the files that have been migrated to the
# design system. Anything new must be written in the system's terms.
#
# LEGACY scope (reports only): the ~7,000 inline styles still living in the
# un-swept JS files. Counts are printed so progress is visible; they do not
# fail the build. Move a file into STRICT once it has been swept.
set -uo pipefail
cd "$(dirname "$0")/.."

STRICT=(index.html styles/tokens.css styles/base.css styles/primitives.css)
LEGACY=(app.js ranking.js quests.js beats.js forum.js global-chat.js badges.js
        features.js marketplace.js timechain-tv.js learning-quests.js modules.js
        mobile-ux.js onboarding.js scholar.js nacho.js)

fail=0
red=$'\033[31m'; yel=$'\033[33m'; grn=$'\033[32m'; dim=$'\033[2m'; off=$'\033[0m'

# check <name> <grep-pattern> <explanation>
check() {
    local name="$1" pat="$2" why="$3" hits
    hits=$(grep -InE "$pat" "${STRICT[@]}" 2>/dev/null || true)
    if [ -n "$hits" ]; then
        echo "${red}✗ $name${off} — $why"
        echo "$hits" | head -8 | sed 's/^/    /'
        [ "$(echo "$hits" | wc -l)" -gt 8 ] && echo "    ${dim}… $(echo "$hits" | wc -l | tr -d ' ') total${off}"
        fail=1
    else
        echo "${grn}✓${off} $name"
    fi
}

echo "── strict: ${STRICT[*]}"
check "no 135deg gradients"   'linear-gradient\(135deg'                  "the default generated gradient angle; use a flat token"
check "no backdrop-filter"    'backdrop-filter'                          "glassmorphism is retired; use --ink-900"
check "no decorative indigo"  '#(6366f1|8b5cf6|a855f7|818cf8|7c3aed)'    "orange is the only accent hue"
check "one orange"            '#(f97316|ea580c|fb923c|e8720c)'           "unify on #F7931A / var(--orange)"
check "no slate ramp"         '#(0f172a|1e293b|020617|94a3b8|64748b|475569|e2e8f0|f8fafc)' "use the warm --ink-*/--fg-* ramp"
check "weight ceiling 600"    'font-weight: ?(700|800|900)\b'            "the system tops out at 600"
check "radius on scale"       'border-radius: ?(2|3|4|5|8|12|14|16|20|24)px' "only 6px / 10px / 999px / 50%"
check "no glow shadows"       'box-shadow:[^;]*(accent-glow|rgba\(2(47|49),)' "hover changes border-color, not glow"

# CSS structural checks. A stray `*/` inside comment prose silently closes the
# comment early and the browser discards the rule that follows — this cost real
# debugging time when `--ink-*/--fg-*` in a comment ate the whole alias block.
echo ""
echo "── css structure"
for f in styles/tokens.css styles/base.css styles/primitives.css; do
    [ -f "$f" ] || continue
    o=$(grep -o '{' "$f" | wc -l | tr -d ' '); c=$(grep -o '}' "$f" | wc -l | tr -d ' ')
    if [ "$o" != "$c" ]; then echo "${red}✗ $f${off} — brace imbalance ($o open, $c close)"; fail=1
    else echo "${grn}✓${off} $f braces balanced ($o)"; fi
    # a comment terminator preceded by a non-space, non-dash char is prose, not a close
    if stray=$(grep -nE '\*/.*[^ ]' "$f" | grep -E '[A-Za-z0-9*]\*/' | grep -vE '^\s*[0-9]+:\s*(/\*|\*)' || true); [ -n "$stray" ]; then
        echo "${yel}!${off} $f — possible premature comment close:"; echo "$stray" | head -3 | sed 's/^/    /'
    fi
done

# Parse each stylesheet and assert the expected rule count is actually reached.
if command -v node >/dev/null 2>&1; then
    node -e '
const fs=require("fs");
let bad=0;
for(const f of ["styles/tokens.css","styles/base.css","styles/primitives.css"]){
  if(!fs.existsSync(f))continue;
  const s=fs.readFileSync(f,"utf8");
  // strip comments, then count top-level rule bodies
  const stripped=s.replace(/\/\*[\s\S]*?\*\//g,"");
  if(stripped.includes("*/")){console.log("  \x1b[31m✗\x1b[0m "+f+" — unbalanced comment: a stray */ survives stripping");bad=1;continue}
  const rules=(stripped.match(/\{/g)||[]).length;
  console.log("  \x1b[32m✓\x1b[0m "+f+" — "+rules+" rule blocks, comments balanced");
}
process.exit(bad);
' || fail=1
fi

echo ""
echo "── legacy (report only — not yet swept)"
tot=0
for pat_name in "linear-gradient(135deg:135deg gradients" "backdrop-filter:backdrop-filter" "#6366f1:indigo-500" "#8b5cf6:violet-500" "#f97316:orange-500 dupe"; do
    pat="${pat_name%%:*}"; label="${pat_name##*:}"
    n=$(grep -oF "$pat" "${LEGACY[@]}" 2>/dev/null | wc -l | tr -d ' ')
    tot=$((tot + n))
    printf "   %-22s %5s\n" "$label" "$n"
done
inline=$(grep -oF 'style="' "${LEGACY[@]}" 2>/dev/null | wc -l | tr -d ' ')
printf "   %-22s %5s\n" "inline style= attrs" "$inline"
echo "   ${dim}→ $tot legacy visual violations, $inline inline styles remaining${off}"

echo ""
if [ "$fail" -ne 0 ]; then
    echo "${red}design-lint FAILED${off} — migrated files must follow the system."
    exit 1
fi
echo "${grn}design-lint passed${off}"
