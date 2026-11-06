"""Procedural materials for the studio: oak, plaster, wool, linen, ceramics, paper.

The bake keeps diffuse colour and light only, so these node trees mostly shape albedo and
micro-relief. Objects that move or shine in the browser (display, folios, record player,
glass) get plain Principled values that the glTF exporter can carry as PBR parameters.
"""

from __future__ import annotations

import bpy

_CACHE: dict[str, bpy.types.Material] = {}


def hex_rgb(h: str) -> tuple[float, float, float, float]:
    h = h.lstrip('#')
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def _new(name: str) -> tuple[bpy.types.Material, bpy.types.NodeTree, bpy.types.Node]:
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:  # Blender 5 always uses nodes
        pass
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    return m, nt, bsdf


def set_in(node: bpy.types.Node, names, value) -> None:
    if isinstance(names, str):
        names = (names,)
    for n in names:
        sock = node.inputs.get(n)
        if sock is not None:
            sock.default_value = value
            return


def _link(nt, a, b):
    nt.links.new(a, b)


def _coord(nt, kind: str = 'Object'):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    return tc.outputs[kind]


def _mapping(nt, vec, scale=(1, 1, 1), rot=(0, 0, 0), loc=(0, 0, 0)):
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    mp.inputs['Rotation'].default_value = rot
    mp.inputs['Location'].default_value = loc
    _link(nt, vec, mp.inputs['Vector'])
    return mp.outputs['Vector']


def _noise(nt, vec, scale=5.0, detail=4.0, rough=0.55, distortion=0.0):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    if 'Distortion' in n.inputs:
        n.inputs['Distortion'].default_value = distortion
    _link(nt, vec, n.inputs['Vector'])
    return n


def _ramp(nt, fac, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], hex_rgb(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], hex_rgb(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = hex_rgb(col)
    _link(nt, fac, r.inputs['Fac'])
    return r.outputs['Color']


def _mix(nt, a, b, fac, blend='MIX'):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    m.blend_type = blend
    if isinstance(fac, float):
        m.inputs['Factor'].default_value = fac
    else:
        _link(nt, fac, m.inputs['Factor'])
    a_sock = m.inputs[6]
    b_sock = m.inputs[7]
    if isinstance(a, tuple):
        a_sock.default_value = a
    else:
        _link(nt, a, a_sock)
    if isinstance(b, tuple):
        b_sock.default_value = b
    else:
        _link(nt, b, b_sock)
    return m.outputs[2]


def _bump(nt, height, strength=0.1, distance=0.01):
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = strength
    bp.inputs['Distance'].default_value = distance
    _link(nt, height, bp.inputs['Height'])
    return bp.outputs['Normal']


def cached(fn):
    def wrap(*args, **kw):
        key = fn.__name__ + repr(args) + repr(sorted(kw.items()))
        if key not in _CACHE:
            _CACHE[key] = fn(*args, **kw)
        return _CACHE[key]
    wrap.__name__ = fn.__name__
    return wrap


# ---------------------------------------------------------------- surfaces

@cached
def plaster(color: str = '#ECE8E1', name: str = 'plaster') -> bpy.types.Material:
    m, nt, b = _new(name)
    co = _coord(nt)
    n = _noise(nt, co, scale=38.0, detail=6.0, rough=0.62)
    big = _noise(nt, co, scale=2.2, detail=2.0, rough=0.5)
    col = _mix(nt, hex_rgb(color), hex_rgb('#E3DED5'), big.outputs['Fac'], 'MIX')
    col = _mix(nt, col, hex_rgb('#F1EEE8'), n.outputs['Fac'], 'MIX')
    _link(nt, col, b.inputs['Base Color'])
    set_in(b, 'Roughness', 0.92)
    _link(nt, _bump(nt, n.outputs['Fac'], 0.06, 0.004), b.inputs['Normal'])
    return m


@cached
def paint(color: str, name: str = 'paint', rough: float = 0.55) -> bpy.types.Material:
    m, nt, b = _new(name)
    set_in(b, 'Base Color', hex_rgb(color))
    set_in(b, 'Roughness', rough)
    return m


@cached
def oak(name: str = 'oak', tone: str = 'light', axis: str = 'X', scale: float = 1.0) -> bpy.types.Material:
    """Oak with growth rings and fine grain; `axis` is the grain direction in object space."""
    m, nt, b = _new(name)
    co = _coord(nt)
    stretch = {'X': (0.6, 6.0, 6.0), 'Y': (6.0, 0.6, 6.0), 'Z': (6.0, 6.0, 0.6)}[axis]
    v = _mapping(nt, co, scale=tuple(s * scale for s in stretch))
    distort = _noise(nt, v, scale=1.6, detail=3.0, rough=0.5)
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'RINGS'
    wave.rings_direction = {'X': 'X', 'Y': 'Y', 'Z': 'Z'}[axis] if False else 'SPHERICAL'
    wave.inputs['Scale'].default_value = 2.4
    wave.inputs['Distortion'].default_value = 7.0
    wave.inputs['Detail'].default_value = 2.0
    _link(nt, v, wave.inputs['Vector'])
    fine = _noise(nt, _mapping(nt, co, scale=tuple(s * 9 * scale for s in stretch)), scale=6.0, detail=2.0)
    stops = {
        'light': [(0.0, '#CDAE86'), (0.45, '#C49F74'), (0.75, '#B98F63'), (1.0, '#D8BC96')],
        'warm': [(0.0, '#BD905F'), (0.5, '#AE8150'), (1.0, '#C99F70')],
        'pale': [(0.0, '#E2CDB0'), (0.5, '#D6BE9C'), (1.0, '#E8D7BE')],
    }[tone]
    base = _ramp(nt, wave.outputs['Fac'], stops)
    base = _mix(nt, base, hex_rgb('#A57A4E'), fine.outputs['Fac'], 'MULTIPLY')
    tint = _mix(nt, base, base, 0.0)
    _ = distort
    _link(nt, tint, b.inputs['Base Color'])
    set_in(b, 'Roughness', 0.58)
    _link(nt, _bump(nt, fine.outputs['Fac'], 0.05, 0.002), b.inputs['Normal'])
    return m


@cached
def oak_floor() -> bpy.types.Material:
    """Wide light-oak planks: brick texture for the layout, rings for the grain."""
    m, nt, b = _new('oak_floor')
    co = _coord(nt)
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.37
    brick.offset_frequency = 1
    brick.squash = 1.0
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Mortar Size'].default_value = 0.0016
    brick.inputs['Mortar Smooth'].default_value = 0.2
    brick.inputs['Bias'].default_value = 0.0
    brick.inputs['Brick Width'].default_value = 1.85
    brick.inputs['Row Height'].default_value = 0.205
    brick.inputs['Color1'].default_value = hex_rgb('#D2B38C')
    brick.inputs['Color2'].default_value = hex_rgb('#C3A077')
    brick.inputs['Mortar'].default_value = hex_rgb('#8C6E50')
    _link(nt, co, brick.inputs['Vector'])
    grain_v = _mapping(nt, co, scale=(0.35, 7.0, 7.0))
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Y'
    wave.inputs['Scale'].default_value = 3.2
    wave.inputs['Distortion'].default_value = 6.0
    wave.inputs['Detail'].default_value = 3.0
    _link(nt, grain_v, wave.inputs['Vector'])
    grain = _ramp(nt, wave.outputs['Fac'], [(0.0, '#FFFFFF'), (0.6, '#F3EBDF'), (1.0, '#DCCBB3')])
    fine = _noise(nt, _mapping(nt, co, scale=(1.0, 40.0, 40.0)), scale=4.0, detail=2.0)
    col = _mix(nt, brick.outputs['Color'], grain, 1.0, 'MULTIPLY')
    col = _mix(nt, col, hex_rgb('#B48D64'), fine.outputs['Fac'], 'OVERLAY')
    _link(nt, col, b.inputs['Base Color'])
    set_in(b, 'Roughness', 0.5)
    height = _mix(nt, brick.outputs['Fac'], fine.outputs['Fac'], 0.15)
    _link(nt, _bump(nt, height, 0.25, 0.003), b.inputs['Normal'])
    return m


@cached
def wool(color: str, name: str = 'wool', scale: float = 240.0) -> bpy.types.Material:
    m, nt, b = _new(name)
    co = _coord(nt)
    weave = nt.nodes.new('ShaderNodeTexWave')
    weave.wave_type = 'BANDS'
    weave.inputs['Scale'].default_value = scale
    weave.inputs['Distortion'].default_value = 1.2
    _link(nt, co, weave.inputs['Vector'])
    fuzz = _noise(nt, co, scale=scale * 0.6, detail=3.0)
    slub = _noise(nt, co, scale=6.0, detail=2.0)
    col = _mix(nt, hex_rgb(color), hex_rgb('#000000'), weave.outputs['Fac'], 'MIX')
    col = _mix(nt, hex_rgb(color), col, 0.08)
    col = _mix(nt, col, hex_rgb('#FFFFFF'), slub.outputs['Fac'], 'SOFT_LIGHT')
    _link(nt, col, b.inputs['Base Color'])
    set_in(b, 'Roughness', 1.0)
    set_in(b, ('Sheen Weight', 'Sheen'), 0.6)
    _link(nt, _bump(nt, fuzz.outputs['Fac'], 0.18, 0.002), b.inputs['Normal'])
    return m


@cached
def rug() -> bpy.types.Material:
    """Off-white wool rug with a soft ribbed weave and a thin oat border."""
    m, nt, b = _new('rug')
    co = _coord(nt, 'UV')
    ribs = nt.nodes.new('ShaderNodeTexWave')
    ribs.wave_type = 'BANDS'
    ribs.bands_direction = 'X'
    ribs.inputs['Scale'].default_value = 110.0
    ribs.inputs['Distortion'].default_value = 0.6
    _link(nt, co, ribs.inputs['Vector'])
    fuzz = _noise(nt, _coord(nt), scale=180.0, detail=3.0)
    # border mask from UV distance to edge
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    _link(nt, co, sep.inputs[0])

    def edge(axis_out):
        a = nt.nodes.new('ShaderNodeMath')
        a.operation = 'PINGPONG'
        a.inputs[1].default_value = 0.5
        _link(nt, axis_out, a.inputs[0])
        c = nt.nodes.new('ShaderNodeMath')
        c.operation = 'LESS_THAN'
        c.inputs[1].default_value = 0.035
        _link(nt, a.outputs[0], c.inputs[0])
        return c.outputs[0]

    mx = nt.nodes.new('ShaderNodeMath')
    mx.operation = 'MAXIMUM'
    _link(nt, edge(sep.outputs[0]), mx.inputs[0])
    _link(nt, edge(sep.outputs[1]), mx.inputs[1])
    base = _mix(nt, hex_rgb('#EAE4D8'), hex_rgb('#D9CFBE'), ribs.outputs['Fac'], 'MIX')
    base = _mix(nt, base, hex_rgb('#B9A585'), mx.outputs[0])
    base = _mix(nt, base, hex_rgb('#FFFFFF'), fuzz.outputs['Fac'], 'SOFT_LIGHT')
    _link(nt, base, b.inputs['Base Color'])
    set_in(b, 'Roughness', 1.0)
    _link(nt, _bump(nt, ribs.outputs['Fac'], 0.3, 0.003), b.inputs['Normal'])
    return m


@cached
def ceramic(color: str, name: str = 'ceramic', rough: float = 0.35, speckle: bool = True) -> bpy.types.Material:
    m, nt, b = _new(name)
    if speckle:
        co = _coord(nt)
        sp = nt.nodes.new('ShaderNodeTexVoronoi')
        sp.inputs['Scale'].default_value = 140.0
        _link(nt, co, sp.inputs['Vector'])
        dots = nt.nodes.new('ShaderNodeMath')
        dots.operation = 'LESS_THAN'
        dots.inputs[1].default_value = 0.06
        _link(nt, sp.outputs['Distance'], dots.inputs[0])
        col = _mix(nt, hex_rgb(color), hex_rgb('#6B5E50'), dots.outputs[0])
        _link(nt, col, b.inputs['Base Color'])
    else:
        set_in(b, 'Base Color', hex_rgb(color))
    set_in(b, 'Roughness', rough)
    return m


@cached
def paper(color: str, name: str = 'paper') -> bpy.types.Material:
    m, nt, b = _new(name)
    co = _coord(nt)
    n = _noise(nt, co, scale=90.0, detail=2.0)
    col = _mix(nt, hex_rgb(color), hex_rgb('#FFFFFF'), n.outputs['Fac'], 'SOFT_LIGHT')
    _link(nt, col, b.inputs['Base Color'])
    set_in(b, 'Roughness', 0.8)
    return m


@cached
def leaf(color: str = '#5F7D52', name: str = 'leaf') -> bpy.types.Material:
    m, nt, b = _new(name)
    co = _coord(nt)
    n = _noise(nt, co, scale=12.0, detail=3.0)
    col = _mix(nt, hex_rgb(color), hex_rgb('#7E9A63'), n.outputs['Fac'])
    _link(nt, col, b.inputs['Base Color'])
    set_in(b, 'Roughness', 0.55)
    set_in(b, ('Subsurface Weight', 'Subsurface'), 0.15)
    return m


@cached
def metal(color: str = '#C9CBCF', name: str = 'aluminium', rough: float = 0.32) -> bpy.types.Material:
    m, nt, b = _new(name)
    set_in(b, 'Base Color', hex_rgb(color))
    set_in(b, 'Metallic', 1.0)
    set_in(b, 'Roughness', rough)
    return m


@cached
def matte(color: str, name: str = 'matte', rough: float = 0.7) -> bpy.types.Material:
    m, nt, b = _new(name)
    set_in(b, 'Base Color', hex_rgb(color))
    set_in(b, 'Roughness', rough)
    return m


@cached
def emission(color: str, strength: float, name: str = 'emit') -> bpy.types.Material:
    m, nt, b = _new(name)
    set_in(b, 'Base Color', hex_rgb('#000000'))
    set_in(b, ('Emission Color', 'Emission'), hex_rgb(color))
    set_in(b, 'Emission Strength', strength)
    return m


@cached
def lampshade(color: str = '#F3EEE4', name: str = 'shade', glow: float = 0.0) -> bpy.types.Material:
    """Linen/paper shade: diffuse outside with a little translucency so it glows."""
    m, nt, b = _new(name)
    co = _coord(nt)
    n = _noise(nt, co, scale=160.0, detail=2.0)
    col = _mix(nt, hex_rgb(color), hex_rgb('#FFFFFF'), n.outputs['Fac'], 'SOFT_LIGHT')
    _link(nt, col, b.inputs['Base Color'])
    set_in(b, 'Roughness', 0.9)
    set_in(b, ('Transmission Weight', 'Transmission'), 0.0)
    if glow > 0:
        set_in(b, ('Emission Color', 'Emission'), hex_rgb('#FFD9A8'))
        set_in(b, 'Emission Strength', glow)
    return m


@cached
def glass(name: str = 'glass') -> bpy.types.Material:
    m, nt, b = _new(name)
    set_in(b, 'Base Color', hex_rgb('#FFFFFF'))
    set_in(b, 'Roughness', 0.02)
    set_in(b, ('Transmission Weight', 'Transmission'), 1.0)
    set_in(b, 'IOR', 1.45)
    return m


ART_UV = 'ArtUV'


def _art_uv(nt, tex):
    """Image lookups use a dedicated UV layer that survives merging and atlas unwrapping."""
    uvn = nt.nodes.new('ShaderNodeUVMap')
    uvn.uv_map = ART_UV
    _link(nt, uvn.outputs['UV'], tex.inputs['Vector'])


def image_emission(name: str, image_path: str, strength: float = 1.0) -> bpy.types.Material:
    """Emissive plane showing an image (used for the city backdrop and the framed print)."""
    m, nt, b = _new(name)
    img = bpy.data.images.load(image_path, check_existing=True)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'EXTEND'
    _art_uv(nt, tex)
    _link(nt, tex.outputs['Color'], b.inputs['Base Color'])
    set_in(b, 'Base Color', hex_rgb('#000000'))
    _link(nt, tex.outputs['Color'], b.inputs.get('Emission Color') or b.inputs.get('Emission'))
    set_in(b, 'Emission Strength', strength)
    set_in(b, 'Roughness', 1.0)
    return m


def image_diffuse(name: str, image_path: str, rough: float = 0.85) -> bpy.types.Material:
    m, nt, b = _new(name)
    img = bpy.data.images.load(image_path, check_existing=True)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'EXTEND'
    _art_uv(nt, tex)
    _link(nt, tex.outputs['Color'], b.inputs['Base Color'])
    set_in(b, 'Roughness', rough)
    return m
