#!/bin/bash
# Save a new dashboard version exported from Grafana.
#
# Usage:
#   Paste JSON from Grafana's Save button, then run:
#   pbpaste | ./local_server/save-dashboard.sh             (macOS)
#   xclip -o | ./local_server/save-dashboard.sh            (Linux)
#   ./local_server/save-dashboard.sh < new-dashboard.json  (from file)

set -e

DASHBOARD="provisioning/dashboards/ijss-heatmap.json"
VERSIONS_DIR="provisioning/dashboards/.versions"

if [ ! -f "$DASHBOARD" ]; then
  echo "Error: $DASHBOARD not found. Run from the project root."
  exit 1
fi

# Read new version from stdin first (validate before touching the file)
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
cat > "$TMPFILE"

if [ ! -s "$TMPFILE" ]; then
  echo "Error: no input received. Pipe the dashboard JSON into this script."
  echo "  xclip -o | ./local_server/save-dashboard.sh   (Linux)"
  echo "  pbpaste | ./local_server/save-dashboard.sh    (macOS)"
  exit 1
fi

# Validate it's JSON
if ! python3 -c "import sys,json; json.load(open('$TMPFILE'))" 2>/dev/null; then
  echo "Error: input is not valid JSON."
  exit 1
fi

# Archive the current version
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
ARCHIVE="$VERSIONS_DIR/ijss-heatmap_${TIMESTAMP}.json"
cp "$DASHBOARD" "$ARCHIVE"

cp "$TMPFILE" "$DASHBOARD"

echo "Saved new version."
echo "Previous version archived → $ARCHIVE"
echo ""
echo "History:"
ls -1t "$VERSIONS_DIR"/*.json 2>/dev/null | head -10 | while read f; do
  echo "  $(basename "$f")"
done