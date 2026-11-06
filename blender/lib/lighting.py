"""Two lighting states that the browser cross-fades between.

evening: blue-hour sky over Buda, warm 2700 K lamps, the display glowing, a candle.
day:     soft west light, a low afternoon sun through the window, lamps off.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Vector

from . import materials as M
from .room import GLASS_Y, WIN_X0, WIN_X1, WIN_Z0, WIN_Z1
from .util import kelvin

LIGHTS_COLL = 'LIGHTS'


def _coll():
    c = bpy.data.collections.get(LIGHTS_COLL)
    if c is None:
        c = bpy.data.collections.new(LIGHTS_COLL)
        bpy.context.scene.collection.children.link(c)
    return c


def clear_lights():
    c = bpy.data.collections.get(LIGHTS_COLL)
    if c:
        for ob in list(c.objects):
            bpy.data.objects.remove(ob, do_unlink=True)


def point(name, loc, watts, color, radius=0.05):
    ld = bpy.data.lights.new(name, 'POINT')
    ld.energy = watts
    ld.color = color
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    _coll().objects.link(ob)
    return ob


def spot(name, loc, aim, watts, color, size_deg=95, blend=0.7, radius=0.03):
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = watts
    ld.color = color
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = blend
    ld.shadow_soft_size = radius
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    direction = Vector(aim) - Vector(loc)
    ob.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    _coll().objects.link(ob)
    return ob


def area(name, loc, size, watts, color, rot, portal=False):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size = size[0]
    ld.size_y = size[1]
    ld.energy = watts
    ld.color = color
    if portal:
        try:
            ld.cycles.is_portal = True
        except AttributeError:
            pass
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = rot
    _coll().objects.link(ob)
    return ob


def sun(name, direction, strength, color, angle_deg=0.6):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = strength
    ld.color = color
    ld.angle = math.radians(angle_deg)
    ob = bpy.data.objects.new(name, ld)
    ob.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    _coll().objects.link(ob)
    return ob


def world_gradient(stops, strength=1.0, name='sky', z_range=(-0.2, 0.9)):
    """Sky as a vertical gradient of the view direction; also lights the room through the window."""
    w = bpy.data.worlds.get(name) or bpy.data.worlds.new(name)
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    remap = nt.nodes.new('ShaderNodeMapRange')
    remap.inputs['From Min'].default_value = z_range[0]
    remap.inputs['From Max'].default_value = z_range[1]
    nt.links.new(sep.outputs['Z'], remap.inputs['Value'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], M.hex_rgb(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], M.hex_rgb(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = M.hex_rgb(col)
    nt.links.new(remap.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    bpy.context.scene.world = w
    return w


def set_emission_strength(mat_name: str, value: float):
    m = bpy.data.materials.get(mat_name)
    if not m:
        return
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            M.set_in(n, 'Emission Strength', value)


def portal():
    w = WIN_X1 - WIN_X0
    h = WIN_Z1 - WIN_Z0
    return area('window_portal', (0, GLASS_Y + 0.02, (WIN_Z0 + WIN_Z1) / 2), (w, h), 0, (1, 1, 1), (math.radians(-90), 0, 0), portal=True)


def evening(anchors: dict):
    clear_lights()
    world_gradient([(0.0, '#2B3A55'), (0.38, '#52607E'), (0.5, '#B88A86'), (0.56, '#E7A777'), (0.66, '#7D86A6'), (1.0, '#1C2A44')], strength=1.6, name='sky_evening')
    warm = kelvin(2700)
    point('pendant', anchors['pendant'], 38, warm, 0.05)
    spot('desk_lamp', anchors['desk_lamp'], anchors['desk_lamp_aim'], 22, kelvin(2900), 100, 0.75, 0.03)
    point('floor_lamp', anchors['floor_lamp'], 55, warm, 0.07)
    point('candle', anchors['candle'], 0.6, kelvin(1900), 0.01)
    # soft cool fill so shadow sides read as blue-hour rather than black
    area('fill_window', (0, 2.0, 1.7), (2.3, 1.4), 18, (0.62, 0.72, 1.0), (math.radians(-90), 0, 0))
    portal()
    set_emission_strength('screen_glow', 2.2)
    set_emission_strength('pendant_inner', 1.5)
    set_emission_strength('bulb_warm', 4.0)
    set_emission_strength('city_evening', 1.0)


def day(anchors: dict):
    clear_lights()
    world_gradient([(0.0, '#9AA7B5'), (0.42, '#B9C7D6'), (0.52, '#E9E6DF'), (0.6, '#CFE0F0'), (1.0, '#86AEDB')], strength=3.2, name='sky_day')
    # afternoon sun from the south-west: travelling towards +x, -y and down
    sun('sun', (0.42, -0.82, -0.38), 4.2, kelvin(5200), 0.7)
    area('fill_window', (0, 2.0, 1.7), (2.3, 1.4), 30, (0.92, 0.96, 1.0), (math.radians(-90), 0, 0))
    portal()
    set_emission_strength('screen_glow', 1.6)
    set_emission_strength('pendant_inner', 0.0)
    set_emission_strength('bulb_warm', 0.0)
    set_emission_strength('city_evening', 1.0)
