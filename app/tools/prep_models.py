"""Chuẩn bị mô hình KayKit (CC0, https://kaylousberg.com) cho bản app.

Nguồn (tải từ GitHub KayKit-Game-Assets, thư mục Assets/gltf hoặc Characters/gltf của từng gói):
    raw/chr/*.glb   — KayKit Character Pack: Adventurers 1.0 + Skeletons 1.0
    raw/city/*      — KayKit City Builder Bits 1.0
    raw/med/*       — KayKit Medieval Hexagon Pack 1.0 (decoration/nature + props)
    raw/dun/*       — KayKit Dungeon Remastered 1.0 (coin*, chest*)

Cách chạy:  python app/tools/prep_models.py <thư mục raw>
Kết quả:    app/skin/models/kk/{chr,city,med,dun}/

Nhân vật: chỉ giữ các hoạt ảnh game dùng, bỏ kênh hoạt ảnh không đổi, bỏ vũ khí cầm tay -> mỗi file ~0,5 MB thay vì ~4 MB.
"""
import json
import re
import shutil
import struct
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'skin' / 'models' / 'kk'

KEEP_ANIMS = ['Idle', 'Walking_A', 'Running_A', 'Jump_Full_Short', 'Jump_Full_Long', 'Cheer', 'Hit_A', 'Death_A', 'Interact',
              'Throw', 'Sit_Floor_Down', 'Sit_Floor_Idle', 'Sit_Floor_StandUp', 'PickUp']
HIDE_NODES = re.compile(r'sword|shield|axe|staff|wand|spellbook|crossbow|knife|dagger|mug|arrow|quiver|smokebomb|throwable|offhand|blade', re.I)
CHARS = ['Knight', 'Mage', 'Barbarian', 'Rogue', 'Rogue_Hooded', 'Skeleton_Warrior', 'Skeleton_Mage', 'Skeleton_Minion', 'Skeleton_Rogue']

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    d = Path(path).read_bytes()
    assert d[:4] == b'glTF'
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack('<I', d[off:off + 4])[0]
    return j, d[off + 8:off + 8 + bl]


def write_glb(path, j, binary):
    js = json.dumps(j, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    binary += b'\0' * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(b'glTF' + struct.pack('<II', 2, total))
        f.write(struct.pack('<I', len(js)) + b'JSON' + js)
        f.write(struct.pack('<I', len(binary)) + b'BIN\0' + binary)


def acc_values(j, binary, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    fmt, size = COMP[a['componentType']]
    n = NCOMP[a['type']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or size * n
    return [struct.unpack_from('<' + fmt * n, binary, start + i * stride) for i in range(a['count'])]


def prune_character(src, dst):
    j, binary = read_glb(src)
    # 1) bỏ vũ khí / khiên cầm tay
    for n in j['nodes']:
        if 'mesh' in n and 'skin' not in n and HIDE_NODES.search(n.get('name', '')):
            del n['mesh']
    # 2) chỉ giữ hoạt ảnh cần dùng, bỏ kênh không đổi (trùng tư thế nghỉ)
    anims = []
    for a in j.get('animations', []):
        if a['name'] not in KEEP_ANIMS:
            continue
        chans, samplers = [], []
        for ch in a['channels']:
            s = a['samplers'][ch['sampler']]
            path, node = ch['target']['path'], j['nodes'][ch['target']['node']]
            vals = acc_values(j, binary, s['output'])
            const = all(max(abs(x - y) for x, y in zip(v, vals[0])) < 1e-5 for v in vals)
            if const:
                rest = node.get(path, {'translation': [0, 0, 0], 'rotation': [0, 0, 0, 1], 'scale': [1, 1, 1]}[path])
                same = max(abs(x - y) for x, y in zip(vals[0], rest)) < 1e-4
                if path == 'rotation' and not same:      # q và -q là cùng một phép quay
                    same = max(abs(x + y) for x, y in zip(vals[0], rest)) < 1e-4
                if same:
                    continue
            samplers.append(s)
            chans.append({**ch, 'sampler': len(samplers) - 1})
        anims.append({'name': a['name'], 'channels': chans, 'samplers': samplers})
    j['animations'] = anims
    # 3) bỏ mesh không còn nút nào dùng
    used_mesh = sorted({n['mesh'] for n in j['nodes'] if 'mesh' in n})
    mmap = {m: i for i, m in enumerate(used_mesh)}
    j['meshes'] = [j['meshes'][m] for m in used_mesh]
    for n in j['nodes']:
        if 'mesh' in n:
            n['mesh'] = mmap[n['mesh']]
    # 4) gom accessor / bufferView còn dùng, ghi lại phần nhị phân
    used = set()
    for m in j['meshes']:
        for p in m['primitives']:
            used.update(p['attributes'].values())
            if 'indices' in p:
                used.add(p['indices'])
            for t in p.get('targets', []):
                used.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            used.add(s['inverseBindMatrices'])
    for a in j['animations']:
        for s in a['samplers']:
            used.update((s['input'], s['output']))
    used = sorted(used)
    amap = {a: i for i, a in enumerate(used)}
    accs = [dict(j['accessors'][a]) for a in used]
    bvs_used = sorted({a['bufferView'] for a in accs} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im})
    bmap, out, new_bvs = {}, bytearray(), []
    for b in bvs_used:
        bv = dict(j['bufferViews'][b])
        start = bv.get('byteOffset', 0)
        out += b'\0' * ((4 - len(out) % 4) % 4)
        bmap[b] = len(new_bvs)
        chunk = binary[start:start + bv['byteLength']]
        bv['byteOffset'] = len(out)
        bv['buffer'] = 0
        out += chunk
        new_bvs.append(bv)
    for a in accs:
        a['bufferView'] = bmap[a['bufferView']]
    for im in j.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = bmap[im['bufferView']]
    for m in j['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = amap[p['indices']]
            if 'targets' in p:
                p['targets'] = [{k: amap[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = amap[s['inverseBindMatrices']]
    for a in j['animations']:
        for s in a['samplers']:
            s['input'], s['output'] = amap[s['input']], amap[s['output']]
    j['accessors'], j['bufferViews'] = accs, new_bvs
    j['buffers'] = [{'byteLength': len(out)}]
    write_glb(dst, j, bytes(out))
    return len(anims), sum(len(a['channels']) for a in anims)


CITY = ['building_%s_withoutBase' % c for c in 'ABCDEFGH'] + ['car_hatchback', 'car_police', 'car_sedan', 'car_stationwagon', 'car_taxi',
        'bench', 'bush', 'streetlight', 'trafficlight_A', 'firehydrant', 'watertower', 'box_A', 'box_B', 'dumpster', 'trash_A',
        'road_straight', 'road_straight_crossing', 'road_corner_curved', 'base']
MED = ['tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small',
       'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E', 'cloud_big', 'cloud_small',
       'hill_single_A', 'hill_single_B', 'hill_single_C', 'mountain_A_grass_trees', 'mountain_B_grass', 'mountain_C_grass_trees',
       'flag_blue', 'flag_green', 'flag_red', 'flag_yellow', 'barrel', 'crate_A_big', 'crate_B_small', 'tent']
DUN = ['coin.gltf.glb', 'coin_stack_small.gltf.glb', 'coin_stack_medium.gltf.glb', 'coin_stack_large.gltf.glb', 'chest_gold.glb']


def copy_gltf(raw, sub, names, tex):
    dst = OUT / sub
    dst.mkdir(parents=True, exist_ok=True)
    for n in names:
        for ext in ('.gltf', '.bin'):
            shutil.copy(raw / sub / (n + ext), dst / (n + ext))
    shutil.copy(raw / sub / tex, dst / tex)


def main():
    raw = Path(sys.argv[1])
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'chr').mkdir(parents=True)
    for k, n in enumerate(CHARS):
        na, nc = prune_character(raw / 'chr' / f'{n}.glb', OUT / 'chr' / f'c{k}.glb')
        print(f'chr c{k} {n}: {na} hoạt ảnh, {nc} kênh, {(OUT / "chr" / f"c{k}.glb").stat().st_size // 1024} KB')
    copy_gltf(raw, 'city', CITY, 'citybits_texture.png')
    copy_gltf(raw, 'med', MED, 'hexagons_medieval.png')
    (OUT / 'dun').mkdir(exist_ok=True)
    for n in DUN:
        shutil.copy(raw / 'dun' / n, OUT / 'dun' / n.replace('.gltf.glb', '.glb'))
    total = sum(f.stat().st_size for f in OUT.rglob('*') if f.is_file())
    print(f'xong: {total / 1048576:.1f} MB -> {OUT}')


if __name__ == '__main__':
    main()
