#!/usr/bin/env python3
"""
Fix all API routes that use session.companyId instead of resolveCompanyId(session).
Properly inserts resolveCompanyId call BEFORE any DB operations.
"""

import re
import os
import glob

BASE = "/home/z/my-project/src/app/api"

files = glob.glob(os.path.join(BASE, "**", "route.ts"), recursive=True)

for filepath in sorted(files):
    with open(filepath, "r") as f:
        content = f.read()
    
    original = content
    
    if "session.companyId" not in content:
        continue
    
    # Check if resolveCompanyId is already imported
    has_resolve_import = bool(re.search(r'import\s*\{[^}]*resolveCompanyId[^}]*\}\s*from\s*"@/lib/db"', content))
    has_db_import = bool(re.search(r'import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*"@/lib/db"', content))
    
    if has_db_import and not has_resolve_import:
        # Add resolveCompanyId to existing import from @/lib/db
        content = re.sub(
            r'(import\s*\{[^}]*\bdb\b[^}]*\})\s*(from\s*"@/lib/db")',
            lambda m: m.group(1).replace('{ ', '{ resolveCompanyId, ').replace(', db', ', db') + ' ' + m.group(2),
            content,
            count=1
        )
    elif not has_db_import:
        print(f"SKIP (no db import): {filepath}")
        continue
    
    # Find handler functions and fix them
    handlers = list(re.finditer(
        r'(export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\([^)]*\)\s*\{)',
        content
    ))
    
    for m in reversed(handlers):
        handler_start = m.end()
        
        # Find end of function
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
        
        if "resolveCompanyId" in handler_body:
            continue
        
        # Replace all session.companyId with realCompanyId
        handler_body = handler_body.replace("session.companyId", "realCompanyId")
        
        # Find the auth/session check pattern to insert resolveCompanyId right after
        # Look for the line after the auth check or after `if (!session) return...`
        patterns = [
            r'if\s*\(!session\)\s*return\s+[^;]+;',
            r'const\s+session\s*=\s*await\s+auth\(request\);',
        ]
        
        insert_pos = None
        for pat in patterns:
            match = re.search(pat, handler_body)
            if match:
                # Insert after this line
                line_end = handler_body.find("\n", match.end())
                if line_end == -1:
                    line_end = match.end()
                insert_pos = line_end + 1
                break
        
        if insert_pos is None:
            # Fallback: insert at the very beginning of the handler
            insert_pos = 0
        
        # Get indentation at insertion point
        line_text = handler_body[insert_pos:]
        indent_match = re.match(r'(\s*)', line_text)
        indent = indent_match.group(1) if indent_match else "    "
        
        insertion = f"{indent}const realCompanyId = await resolveCompanyId(session);\n"
        handler_body = handler_body[:insert_pos] + insertion + handler_body[insert_pos:]
        
        content = content[:handler_start] + handler_body + content[func_end:]
    
    if content != original:
        with open(filepath, "w") as f:
            f.write(content)
        rel = os.path.relpath(filepath, BASE)
        print(f"FIXED: {rel}")
    else:
        print(f"NO CHANGE: {os.path.relpath(filepath, BASE)}")

print("\nDone!")
