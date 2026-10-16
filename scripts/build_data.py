import re
import json
import urllib.request
import urllib.parse
import os

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

postcode_pat = re.compile(r'([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})', re.IGNORECASE)

# Known coordinate overrides / manual fallbacks
known_coords = {
    'W1F6LU': {'lat': 51.511751, 'lng': -0.132221, 'address': '64 Shaftesbury Ave, London W1D 6LU'},
    'SE12AA': {'lat': 51.503533, 'lng': -0.077670, 'address': 'One Tower Bridge, Tower Bridge Rd, London SE1 2AA'},
    'W69HW': {'lat': 51.492454, 'lng': -0.227884, 'address': '43 King St, London W6 9HW'},
    'SW191PS': {'lat': 51.420496, 'lng': -0.205512, 'address': '31 The Broadway, London SW19 1PS'},
    'NW26LN': {'lat': 51.567266, 'lng': -0.229188, 'address': '395 Edgware Rd, London NW2 6LN'},
    'EC2M4YN': {'lat': 51.516843, 'lng': -0.078825, 'address': 'Devonshire Square, London EC2M 4YN'},
    'W127GA': {'lat': 51.507459, 'lng': -0.222272, 'address': 'Westfield London, Southern Terrace, Ariel Way, London W12 7GA'},
    'W127GB': {'lat': 51.508222, 'lng': -0.222156, 'address': 'Westfield London, Southern Terrace, Ariel Way, London W12 7GB'},
    'WC2H0DT': {'lat': 51.514196, 'lng': -0.129856, 'address': '107-109 Charing Cross Rd, London WC2H 0DT'},
    'W69JT': {'lat': 51.492497, 'lng': -0.233097, 'address': '201 King St, London W6 9JT'},
    'W1D7DH': {'lat': 51.510449, 'lng': -0.132849, 'address': '19 Coventry St, London W1D 7DH'},
    'SE100DX': {'lat': 51.502194, 'lng': 0.002819, 'address': 'Peninsula Square, London SE10 0DX'},
    'WC2N4LH': {'lat': 51.510994, 'lng': -0.126413, 'address': '5 New Row, Covent Garden, London WC2N 4LH'},
    'WC2H8LE': {'lat': 51.515475, 'lng': -0.127685, 'address': '64 St Giles High St, London WC2H 8LE'},
    'W1D4TL': {'lat': 51.513808, 'lng': -0.130290, 'address': '16 Old Compton St, London W1D 4TL'},
    'W1F0TS': {'lat': 51.513975, 'lng': -0.134059, 'address': '112 Wardour St, London W1F 0TS'},
    'WC2R0DE': {'lat': 51.509963, 'lng': -0.122089, 'address': '73-75 Strand, London WC2R 0DE'},
    'W1D3JF': {'lat': 51.514118, 'lng': -0.131690, 'address': '10 Frith St, London W1D 3JF'},
    'NW15RT': {'lat': 51.523314, 'lng': -0.157665, 'address': '198 Baker St, London NW1 5RT'},
    'W1D6AP': {'lat': 51.512640, 'lng': -0.130980, 'address': 'Shaftesbury Ave, Soho, London W1D 6AP'},
}

# Collect all postcodes
all_pcs = set()
for it in items:
    for l in it['lines']:
        if '📍' in l:
            parts = l.split('📍')
            for p in parts[1:]:
                m = postcode_pat.search(p)
                if m:
                    clean = re.sub(r'\s+', '', m.group(1).upper().strip())
                    all_pcs.add(clean)

print(f'Total postcodes in text: {len(all_pcs)}')

# Query postcodes.io
geocache = dict(known_coords)
pcs_to_query = [p for p in all_pcs if p not in geocache]

print(f'Postcodes to fetch online: {len(pcs_to_query)}')
for i in range(0, len(pcs_to_query), 50):
    chunk = pcs_to_query[i:i+50]
    try:
        req = urllib.request.Request(
            'https://api.postcodes.io/postcodes',
            data=json.dumps({'postcodes': chunk}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            res = json.loads(resp.read().decode())
            for item in res['result']:
                q = item['query']
                if item['result']:
                    geocache[q] = {
                        'lat': item['result']['latitude'],
                        'lng': item['result']['longitude'],
                        'district': item['result'].get('admin_district'),
                        'ward': item['result'].get('admin_ward')
                    }
    except Exception as e:
        print('Geocoding error:', e)

print(f'Geocache size: {len(geocache)}')

# Special cases for items without 📍 in original text
special_unlocated = {
    'Khun Pakin Thai': [{'address': '43 King St, London W6 9HW, United Kingdom', 'postcode': 'W6 9HW', 'pc_key': 'W69HW'}],
    'Tampopo Wimbledon': [{'address': '31 The Broadway, London SW19 1PS, United Kingdom', 'postcode': 'SW19 1PS', 'pc_key': 'SW191PS'}],
    'Wing Yip Superstore Cricklewood': [{'address': '395 Edgware Rd, London NW2 6LN, United Kingdom', 'postcode': 'NW2 6LN', 'pc_key': 'NW26LN'}],
    'WA日式甜点 蛋糕': [{'address': '5 New Row, Covent Garden, London WC2N 4LH, United Kingdom', 'postcode': 'WC2N 4LH', 'pc_key': 'WC2N4LH'}],
    'Kanada-Ya 金田家': [{'address': '64 St Giles High St, London WC2H 8LE, United Kingdom', 'postcode': 'WC2H 8LE', 'pc_key': 'WC2H8LE'}],
    'wagamama': [{'address': 'Unit 1081, Ariel Way, Westfield London, London W12 7GF, United Kingdom', 'postcode': 'W12 7GF', 'pc_key': 'W127GA'}],
    'Eat Tokyo': [{'address': '16 Old Compton St, Soho, London W1D 4TL, United Kingdom', 'postcode': 'W1D 4TL', 'pc_key': 'W1D4TL'}],
    'EL&N': [{'address': '112 Wardour St, Soho, London W1F 0TS, United Kingdom', 'postcode': 'W1F 0TS', 'pc_key': 'W1F0TS'}],
    'zizi': [{'address': '73-75 Strand, London WC2R 0DE, United Kingdom', 'postcode': 'WC2R 0DE', 'pc_key': 'WC2R0DE'}],
    'Sticks\'n\'Sushi': [{'address': 'Westfield London, Southern Terrace, Ariel Way, London W12 7GA, United Kingdom', 'postcode': 'W12 7GA', 'pc_key': 'W127GA'}],
    'Bill\'s': [{'address': 'Westfield London, Southern Terrace, Ariel Way, London W12 7GB, United Kingdom', 'postcode': 'W12 7GB', 'pc_key': 'W127GB'}],
    'Wahaca': [{'address': 'Westfield London, Southern Terrace, Ariel Way, London W12 7GA, United Kingdom', 'postcode': 'W12 7GA', 'pc_key': 'W127GA'}],
    'YGF Yangguofu Malatang': [
        {'address': '107-109 Charing Cross Rd, London WC2H 0DT, United Kingdom (Soho店)', 'postcode': 'WC2H 0DT', 'pc_key': 'WC2H0DT'},
        {'address': '201 King St, London W6 9JT, United Kingdom (Hammersmith店)', 'postcode': 'W6 9JT', 'pc_key': 'W69JT'}
    ],
    'Haidilao Hot Pot': [
        {'address': '19 Coventry St, London W1D 7DH, United Kingdom (Soho店)', 'postcode': 'W1D 7DH', 'pc_key': 'W1D7DH'},
        {'address': 'Peninsula Square, London SE10 0DX, United Kingdom (狗岛/O2店)', 'postcode': 'SE10 0DX', 'pc_key': 'SE100DX'}
    ],
    'Nando\'s': [{'address': '10 Frith St, Soho, London W1D 3JF, United Kingdom', 'postcode': 'W1D 3JF', 'pc_key': 'W1D3JF'}],
    'Chicken Shop': [{'address': '198 Baker St, London NW1 5RT, United Kingdom', 'postcode': 'NW1 5RT', 'pc_key': 'NW15RT'}],
    'T4 Bubble Tea': [{'address': '28 Gerrard St, Chinatown, London W1D 6JW, United Kingdom', 'postcode': 'W1D 6JW', 'pc_key': 'W1D7DH'}],
    'Silverleaf': [{'address': 'Devonshire Square, London EC2M 4YN, United Kingdom (永久闭店)', 'postcode': 'EC2M 4YN', 'pc_key': 'EC2M4YN'}],
    '可以搜一些随机举办的主题夜场': [{'address': 'Central London, United Kingdom', 'postcode': 'W1D 6AP', 'pc_key': 'W1D6AP'}]
}

def categorize(title, notes, area):
    combined = title + ' ' + notes + ' ' + area
    categories = []
    
    # Cuisine primary
    if '中餐' in combined or '火锅' in combined or '粤菜' in combined or '川菜' in combined or '米粉' in combined or '面馆' in combined or '烤串' in combined or '大骨头' in combined or '煎饼' in combined or '饺子' in combined or '麻辣烫' in combined or '泡馍' in combined or '中超' in combined or '铁锅炖' in combined:
        categories.append('中餐')
    if '亚洲菜' in combined or '日料' in combined or '韩料' in combined or '泰餐' in combined or '马来西亚' in combined or '新加坡' in combined or '越南' in combined or '印度' in combined or '巴基斯坦' in combined or '拉面' in combined or '寿司' in combined or '烧鸟' in combined:
        categories.append('亚洲菜')
    if '西餐' in combined or '英国菜' in combined or '法餐' in combined or '意大利' in combined or '西班牙' in combined or '希腊' in combined or '土耳其' in combined or '黎巴嫩' in combined or '叙利亚' in combined or '披萨' in combined or '早午餐' in combined or '汉堡' in combined or '牛排' in combined:
        categories.append('西餐')
    if '甜品' in combined or '甜点' in combined or '蛋糕' in combined or '奶茶' in combined or '椰子冻' in combined or '巧克力' in combined or '糕点' in combined:
        categories.append('甜品饮品')
    if '酒吧' in combined or 'Bar' in combined or '调酒' in combined or '酒馆' in combined or '夜场' in combined:
        categories.append('酒吧夜生活')
        
    if not categories:
        categories.append('特色美食')

    # Specific sub tags
    subtags = []
    for tag in ['川菜', '粤菜', '火锅', '自助火锅', '面食', '米粉', '螺蛳粉', '烧烤', '日料', '寿司', '拉面', '韩料', '韩式烤肉', '泰餐', '法餐', '英国菜', '西班牙菜', '意大利菜', '披萨', '下午茶', '奶茶', '甜品', '早午餐', '汉堡', '牛排', '生腌', '煲仔饭', '新疆菜', '东北菜']:
        if tag in combined:
            subtags.append(tag)

    return categories, subtags

restaurants = []

for idx, it in enumerate(items):
    content_lines = it['lines']
    title_line = it['title']

    rating = 'normal'
    if '🌟' in title_line or any('🌟' in l for l in content_lines[:2]):
        rating = 'star'
    elif '👍' in title_line or any('👍' in l for l in content_lines[:2]):
        rating = 'thumb_up'
    elif '👎' in title_line or any('👎' in l for l in content_lines[:2]):
        rating = 'thumb_down'

    is_closed = '关门' in title_line or any('闭店' in l or '已关门' in l for l in content_lines)

    clean_title = re.sub(r'^(?:(?:\d\ufe0f?\u20e3)+|\U0001f51f|⚠️这家已关门⚠️|\s+|🌟|👍|👎|⚠️)+', '', title_line).strip()

    images = []
    for l in content_lines:
        img_matches = re.findall(r'!\[([^\]]*)\]\((Attachments/[^\)]+)\)', l)
        for alt, path in img_matches:
            images.append({
                'alt': alt if alt and alt != 'Image' else clean_title,
                'path': path
            })

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

    # Locations
    loc_entries = []
    for l in content_lines:
        if '📍' in l:
            parts = l.split('📍')
            for p in parts[1:]:
                p_clean = p.strip()
                if not p_clean:
                    continue
                m = postcode_pat.search(p_clean)
                postcode_found = m.group(1).upper() if m else None
                pc_key = re.sub(r'\s+', '', postcode_found) if postcode_found else None
                
                coord = geocache.get(pc_key)
                loc_entries.append({
                    'raw': p_clean,
                    'address': p_clean.replace('GB**邮政编码**:', '').replace('**邮政编码**:', '').strip(),
                    'postcode': postcode_found,
                    'lat': coord['lat'] if coord else None,
                    'lng': coord['lng'] if coord else None,
                    'district': coord.get('district') if coord else None
                })

    # If no 📍 in text, check special unlocated
    if not loc_entries:
        for k, specials in special_unlocated.items():
            if k in clean_title:
                for sp in specials:
                    coord = geocache.get(sp['pc_key'])
                    loc_entries.append({
                        'raw': sp['address'],
                        'address': sp['address'],
                        'postcode': sp['postcode'],
                        'lat': coord['lat'] if coord else None,
                        'lng': coord['lng'] if coord else None,
                        'district': coord.get('district') if coord else None
                    })
                break

    categories, subtags = categorize(clean_title, note_text, it['area'])

    restaurant_record = {
        'id': f'resto_{idx+1}',
        'name': clean_title,
        'raw_title': title_line,
        'city': it['city'],
        'area': it['area'] or it['city'],
        'rating': rating,
        'is_closed': is_closed,
        'categories': categories,
        'subtags': subtags,
        'images': images,
        'locations': loc_entries,
        'notes': note_text,
        'notes_html': note_text.replace('\n', '<br>')
    }
    restaurants.append(restaurant_record)

print(f'Processed {len(restaurants)} restaurants.')
missing_coords = 0
for r in restaurants:
    has_coord = any(loc['lat'] is not None for loc in r['locations'])
    if not has_coord:
        missing_coords += 1
        print(f"Missing coords for: [{r['city']} - {r['area']}] {r['name']}")

print(f'Restaurants with missing coordinates: {missing_coords}')

# Save to JSON
with open('./data/restaurants.json', 'w', encoding='utf-8') as f:
    json.dump(restaurants, f, ensure_ascii=False, indent=2)

print('Saved data/restaurants.json successfully!')
