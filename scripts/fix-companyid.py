#!/usr/bin/env python3
"""
Fix all API routes that use session.companyId instead of resolveCompanyId(session).
This script:
1. Finds all API route files with session.companyId
2. Adds resolveCompanyId import from @/lib/db (if not present)
3. Adds `const realCompanyId = await resolveCompanyId(session);` early in each handler
4. Replaces session.companyId with realCompanyId throughout the handler
"""

import re
import os
import glob

BASE = "/home/z/my-project/src/app/api"

# Files to process - all .ts route files
files = glob.glob(os.path.join(BASE, "**", "route.ts"), recursive=True)

for filepath in sorted(files):
    with open(filepath, "r") as f:
        content = f.read()
    
    original = content
    
    # Check if file uses session.companyId
    if "session.companyId" not in content:
        continue
    
    # Skip if already fully converted (has resolveCompanyId and no session.companyId)
    # Actually we already checked for session.companyId above
    
    # Check if resolveCompanyId is already imported from @/lib/db
    has_resolve_import = bool(re.search(r'import\s*\{[^}]*resolveCompanyId[^}]*\}\s*from\s*"@/lib/db"', content))
    
    # Check if db is imported from @/lib/db
    has_db_import = bool(re.search(r'import\s*\{[^}]*db[^}]*\}\s*from\s*"@/lib/db"', content))
    
    if has_db_import and not has_resolve_import:
        # Add resolveCompanyId to existing import
        content = re.sub(
            r'import\s*\{([^}]*db[^}]*)\}\s*from\s*"@/lib/db"',
            lambda m: 'import {' + m.group(1).rstrip() + ', resolveCompanyId } from "@/lib/db"',
            content,
            count=1
        )
        # Clean up double spaces or trailing commas
        content = re.sub(r'\{\s*,\s*', '{ ', content)
        content = re.sub(r',\s*,', ',', content)
        content = re.sub(r',\s*\}', ' }', content)
    elif not has_db_import:
        # This shouldn't happen for files using session.companyId with DB
        print(f"SKIP (no db import): {filepath}")
        continue
    
    # Now replace session.companyId with realCompanyId
    # But we need to add `const realCompanyId = await resolveCompanyId(session);`
    # in each handler function (export async function GET/POST/PATCH/PUT/DELETE)
    
    # Find all handler functions
    handlers = re.finditer(
        r'(export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\([^)]*\)\s*\{)',
        content
    )
    
    offsets = []
    for m in handlers:
        handler_start = m.end()
        handler_name = m.group(2)
        
        # Check if this handler contains session.companyId
        # Find the end of this function (matching brace)
        depth = 0
        func_end = handler_start
        for i in range(handler_start, len(content)):
            if content[i] == '{':
                depth += 1
            elif content[i] == '}':
                depth -= 1
                if depth == 0:
                    func_end = i
                    break
        
        handler_body = content[handler_start:func_end]
        
        if "session.companyId" not in handler_body:
            continue
        
        # Check if realCompanyId is already declared in this handler
        if "resolveCompanyId" in handler_body:
            continue
        
        # Find the first line after opening brace where we can insert the resolveCompanyId call
        # Best place: right after the auth check (where session is validated)
        # Look for pattern: auth verification + session.companyId usage
        
        # Strategy: find first occurrence of session.companyId and insert before it
        first_usage = handler_body.find("session.companyId")
        if first_usage == -1:
            continue
        
        # Walk backwards from first usage to find a good insertion point (beginning of a line)
        line_start = handler_body.rfind("\n", 0, first_usage)
        if line_start == -1:
            line_start = 0
        else:
            line_start += 1  # After the newline
        
        # Get the indentation of the current line
        indent_match = re.match(r'(\s*)', handler_body[line_start:])
        indent = indent_match.group(1) if indent_match else "    "
        
        # Insert resolveCompanyId call before this line
        insertion = f"{indent}const realCompanyId = await resolveCompanyId(session);\n"
        handler_body = handler_body[:line_start] + insertion + handler_body[line_start:]
        
        # Now replace all session.companyId with realCompanyId in this handler body
        handler_body = handler_body.replace("session.companyId", "realCompanyId")
        
        offsets.append((handler_start, func_end, handler_body))
    
    # Apply changes
    for start, end, new_body in reversed(offsets):
        content = content[:start] + new_body + content[end:]
    
    if content != original:
        with open(filepath, "w") as f:
            f.write(content)
        rel = os.path.relpath(filepath, BASE)
        print(f"FIXED: {rel}")
    else:
        print(f"NO CHANGE: {os.path.relpath(filepath, BASE)}")

print("\nDone!")
