"""Decode export fixtures independently with Pillow; compare every frame's alpha."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

folder = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/overlay-verification')
for ext in ('apng', 'gif'):
    im = Image.open(folder / f'test.{ext}')
    assert im.n_frames == 20
    assert im.info.get('loop') == 0
    duration = 0
    semi = 0
    for i in range(20):
        im.seek(i)
        actual = np.asarray(im.convert('RGBA'))
        expected = np.fromfile(folder / f'frame-{i}.rgba', dtype=np.uint8).reshape(150, 540, 4)
        if ext == 'apng':
            assert np.array_equal(actual, expected), (ext, i, 'RGBA mismatch')
            semi += np.count_nonzero((actual[:, :, 3] > 0) & (actual[:, :, 3] < 255))
        else:
            assert np.array_equal(actual[:, :, 3] > 0, expected[:, :, 3] >= 128), (ext, i, 'alpha/disposal mismatch')
        assert actual[0, 0, 3] == 0
        duration += im.info.get('duration', 0)
    assert duration == 2000
    if ext == 'apng':
        assert semi > 0
    print(f'PASS {ext}: 20 frames, 2 seconds, infinite loop, accurate transparency on every frame')
