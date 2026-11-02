import io
import os
import tempfile
os.environ['FORME_RESULTS_DIR'] = tempfile.mkdtemp(prefix='forme-test-')

import numpy as np
import trimesh
from fastapi.testclient import TestClient
from solid_engine import app

client = TestClient(app)

def test_same_origin_union_and_both_downloads():
    first = trimesh.creation.box(extents=[2, 2, 2])
    second = first.copy()
    second.apply_translation([1, 0, 0])
    source = trimesh.util.concatenate([first, second]).export(file_type='stl')
    response = client.post('/api/forme/solidify?step=0.18&repair=0&product=necklace', content=source)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['report']['watertight']
    assert result['report']['connected_shells'] == 1
    assert result['report']['geometry_ok']
    # An unchecked necklace thickness must never become a manufacturing pass.
    assert result['report']['thickness_ok'] is None
    assert result['report']['passed'] is False
    for fmt in ('stl', 'obj'):
        url = result[f'{fmt}_url']
        assert url.startswith('/api/forme/solids/')
        exported = client.get(url)
        assert exported.status_code == 200
        mesh = trimesh.load(io.BytesIO(exported.content), file_type=fmt, force='mesh')
        assert mesh.is_watertight
        np.testing.assert_allclose(mesh.extents, [3, 2, 2], atol=0.4)

def test_health_and_invalid_input():
    assert client.get('/api/forme/health').json()['status'] == 'ok'
    assert client.post('/api/forme/solidify?step=0', content=b'bad').status_code == 400
    assert client.post('/api/forme/solidify', content=b'bad').status_code == 422
    assert client.get('/api/forme/solids/invalid.stl').status_code == 404
