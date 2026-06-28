from __future__ import annotations

from typing import Any


def tile_bounds(width: int, height: int, tile_size: int) -> list[tuple[int, int, int, int]]:
    tiles: list[tuple[int, int, int, int]] = []
    for y in range(0, height, tile_size):
        for x in range(0, width, tile_size):
            tiles.append((x, y, min(x + tile_size, width), min(y + tile_size, height)))
    return tiles
