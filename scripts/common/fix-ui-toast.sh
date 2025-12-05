#!/bin/bash

# Script to automatically apply fixes to toast.jsx and toaster.jsx
# This script adds pointer-events-none to ToastProvider and ToastViewport
# and adds dismiss functionality to ToastClose

set -e

# Detect OS for sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_IN_PLACE="sed -i ''"
else
  SED_IN_PLACE="sed -i"
fi

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TOAST_FILE="${PROJECT_ROOT}/src/components/ui/toast.jsx"
TOASTER_FILE="${PROJECT_ROOT}/src/components/ui/toaster.jsx"

echo "Applying fixes to toast components..."

# Check if files exist
if [ ! -f "$TOAST_FILE" ]; then
  echo "Warning: toast.jsx not found at $TOAST_FILE, skipping toast.jsx fixes"
fi
if [ ! -f "$TOASTER_FILE" ]; then
  echo "Warning: toaster.jsx not found at $TOASTER_FILE, skipping toaster.jsx fixes"
  exit 0
fi

# Fix toast.jsx - Add pointer-events-none to ToastProvider className (line 9)
if [ -f "$TOAST_FILE" ] && grep -q 'md:max-w-\[420px\]"' "$TOAST_FILE"; then
  if ! grep -q 'md:max-w-\[420px\] pointer-events-none"' "$TOAST_FILE"; then
    echo "  - Adding pointer-events-none to ToastProvider..."
    $SED_IN_PLACE 's/md:max-w-\[420px\]"/md:max-w-\[420px\] pointer-events-none"/g' "$TOAST_FILE"
  else
    echo "  - ToastProvider already has pointer-events-none"
  fi
fi

# Fix toast.jsx - Add pointer-events-none to ToastViewport className (line 18)
# Check if ToastViewport line needs the fix
if grep -A 2 'const ToastViewport' "$TOAST_FILE" | grep -q 'md:max-w-\[420px\]"' && \
   ! grep -A 2 'const ToastViewport' "$TOAST_FILE" | grep -q 'pointer-events-none'; then
  echo "  - Adding pointer-events-none to ToastViewport..."
  # Use sed to replace the specific line in ToastViewport section
  $SED_IN_PLACE '/const ToastViewport/,/ToastViewport\.displayName/ {
    s/md:max-w-\[420px\]"/md:max-w-\[420px\] pointer-events-none"/
  }' "$TOAST_FILE"
else
  echo "  - ToastViewport already has pointer-events-none"
fi

# Fix toaster.jsx - Add dismiss to useToast destructuring
if ! grep -q 'const { toasts, dismiss } = useToast();' "$TOASTER_FILE"; then
  if grep -q 'const { toasts } = useToast();' "$TOASTER_FILE"; then
    echo "  - Adding dismiss to useToast destructuring..."
    $SED_IN_PLACE 's/const { toasts } = useToast();/const { toasts, dismiss } = useToast();/' "$TOASTER_FILE"
  else
    echo "  - Warning: Could not find useToast() call in toaster.jsx"
  fi
else
  echo "  - dismiss already added to useToast destructuring"
fi

# Fix toaster.jsx - Add onClick handler to ToastClose
if ! grep -q 'onClick={(e) => {' "$TOASTER_FILE"; then
  if grep -q '<ToastClose' "$TOASTER_FILE"; then
    echo "  - Adding onClick handler to ToastClose..."
    # Use awk to replace <ToastClose /> with multi-line version
    TEMP_FILE=$(mktemp)
    awk '
      /<ToastClose \/>/ {
        print "            <ToastClose"
        print "              onClick={(e) => {"
        print "                e.preventDefault();"
        print "                e.stopPropagation();"
        print "                dismiss && dismiss(id);"
        print "              }}"
        print "            />"
        next
      }
      { print }
    ' "$TOASTER_FILE" > "$TEMP_FILE"
    mv "$TEMP_FILE" "$TOASTER_FILE"
  else
    echo "  - Warning: Could not find ToastClose in toaster.jsx"
  fi
else
  echo "  - onClick handler already added to ToastClose"
fi

# Ensure file ends with newline
if [ -f "$TOASTER_FILE" ]; then
  if [ -n "$(tail -c 1 "$TOASTER_FILE" 2>/dev/null)" ]; then
    echo "" >> "$TOASTER_FILE"
  fi
fi

echo "Done! Toast components have been fixed."

