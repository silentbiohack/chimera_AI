"""Smoke-check pricing HTML for hydration-stable USD format."""
import re
import sys
import urllib.request

html = urllib.request.urlopen("http://localhost:3001/pricing").read().decode()

billed = re.findall(r"billed\s+\$([0-9,]+)", html)
amounts = re.findall(r">\$([0-9][0-9,]*)<", html)

print("billed amounts:", billed)
print("card amounts  :", amounts)

# Hydration safety: server must NOT emit narrow-NBSP (U+202F) or NBSP (U+00A0)
# inside numeric strings (this is what Intl uses for ru-RU/fr-FR).
weird = [c for c in html if c in (" ", " ", " ")]
if weird:
    print(f"WARN: found {len(weird)} suspicious whitespace chars in HTML")
    sys.exit(1)
print("ok: no NBSP/narrow-NBSP in HTML")
