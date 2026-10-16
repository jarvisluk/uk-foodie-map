import re
import json

with open('./data/🇬🇧英留美食.md', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')

current_city = '伦敦'
current_area = ''

keycap_pat = re.compile(r'^(?:(?:\d\ufe0f?\u20e3)+|\U0001f51f|⚠️这家已关门⚠️)')

items = []
current_item = None

for i, l in enumerate(lines):
    line_s = l.strip()
    if line_s.startswith('## '):
        h = line_s.replace('##', '').strip()
        if h:
            current_city = h.replace('🎡', '').replace('🏴\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074\U000e007f', '').replace('：', '').strip()
            current_area = ''
    elif line_s.startswith('### '):
        sub = line_s.replace('###', '').strip()
        if sub:
            current_area = sub.replace('：', '').strip()

    if keycap_pat.match(line_s):
        if current_item:
            items.append(current_item)
        current_item = {
            'line': i + 1,
            'title': line_s,
            'city': current_city,
            'area': current_area,
            'lines': [line_s]
        }
    elif current_item:
        current_item['lines'].append(line_s)

if current_item:
    items.append(current_item)

print(f'Total items: {len(items)}')

# UK Postcode regex: e.g. SW11 3JS, W1F 6LU, EC4N 7HR, WC2H 7BP, EH1 1PE, OX1 2AU, CB2 1SJ, M1 4HF, B5 4SG, TR18 2QN, etc.
postcode_pat = re.compile(r'\b([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})\b', re.IGNORECASE)

parsed_records = []

for idx, it in enumerate(items):
    content_lines = it['lines']
    title_line = it['title']
    
    # Extract rating
    rating = 'normal'
    if '🌟' in title_line or any('🌟' in l for l in content_lines[:2]):
        rating = 'star'
    elif '👍' in title_line or any('👍' in l for l in content_lines[:2]):
        rating = 'thumb_up'
    elif '👎' in title_line or any('👎' in l for l in content_lines[:2]):
        rating = 'thumb_down'
    
    is_closed = '关门' in title_line or any('闭店' in l or '已关门' in l for l in content_lines)

    # Clean title
    # Remove emojis at start: keycaps, 🌟, 👍, 👎, ⚠️这家已关门⚠️
    clean_title = re.sub(r'^(?:(?:\d\ufe0f?\u20e3)+|\U0001f51f|⚠️这家已关门⚠️|\s+|🌟|👍|👎|⚠️)+', '', title_line).strip()
    
    # Extract tags from title (e.g. 西餐, 西班牙菜, 中餐, 川菜, 日料, etc.)
    # Often title has: Name [Category] [Cuisine]
    
    # Extract images
    images = []
    for l in content_lines:
        img_matches = re.findall(r'!\[([^\]]*)\]\((Attachments/[^\)]+)\)', l)
        for alt, path in img_matches:
            images.append({'alt': alt, 'path': path})
    
    # Extract locations / addresses
    loc_lines = []
    for l in content_lines:
        if '📍' in l:
            # could be multiple 📍 in one line or split
            parts = l.split('📍')
            for p in parts[1:]:
                loc_lines.append(p.strip())
    
    # Extract notes (all non-empty lines that are not title, not address, not image)
    notes = []
    for l in content_lines[1:]:
        l_s = l.strip()
        if not l_s:
            continue
        if '📍' in l_s:
            continue
        if l_s.startswith('!['):
            continue
        if l_s.startswith('###') or l_s.startswith('##'):
            continue
        notes.append(l_s)
    
    note_text = '\n'.join(notes)
    
    record = {
        'id': f'resto_{idx+1}',
        'title': clean_title,
        'raw_title': title_line,
        'city': it['city'],
        'area': it['area'],
        'rating': rating,
        'is_closed': is_closed,
        'images': images,
        'locations': loc_lines,
        'notes': note_text
    }
    parsed_records.append(record)

print(f'Parsed {len(parsed_records)} records.')
# Check postcodes in locations
total_locations = 0
found_postcodes = 0
for r in parsed_records:
    for loc in r['locations']:
        total_locations += 1
        m = postcode_pat.search(loc)
        if m:
            found_postcodes += 1
        else:
            print(f"NO POSTCODE: [{r['city']} - {r['title']}] -> {loc}")

print(f'Total location entries: {total_locations}, with postcode: {found_postcodes}')
