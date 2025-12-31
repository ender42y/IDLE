import re, sys
p='c:/Users/Steven.Yorgason/source/repos/ender42y/IDLE/IDLE-Web/src/app/components/system-view/system-view.component.html'
s=open(p,encoding='utf-8').read()
# find tokens
pattern=re.compile(r"@(if|for|switch|case|empty|else)\b|\{|\}")
# but braces may be in html; we'll track only control blocks and braces on same line
lines=s.splitlines()
stack=[]
for i,l in enumerate(lines,1):
    # detect control open patterns: @if (...){  or @for (...){ or @switch (...){ or @case 'x' { or @empty { or @else {
    m=re.search(r"@(if|for|switch|case|empty|else)\b\s*(\([^\)]*\))?\s*\{", l)
    if m:
        tok=m.group(1)
        stack.append((tok,i))
    # detect closing brace lines that only have '}' possibly followed by @else
    if re.search(r"^\s*\}\s*(?:@else|@empty|@case)?", l):
        if stack:
            stack.pop()
        else:
            print('Unmatched closing brace at',i)

if stack:
    print('Unclosed control blocks:')
    for tok,i in stack:
        print(tok,'opened at',i)
else:
    print('All control blocks closed')
