"""FORME geometry service: resolution-aware volumetric Boolean union + QA.

No claim of production-ready jewelry: geometric QA is not a casting/process certificate.
"""
from __future__ import annotations
import io
import os
import uuid
import re
import asyncio
import time
from starlette.concurrency import run_in_threadpool
from pathlib import Path
import numpy as np
import trimesh
from scipy import ndimage
from skimage.measure import marching_cubes
import vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray, vtk_to_numpy
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parent
RESULTS = Path(os.environ.get('FORME_RESULTS_DIR', str(ROOT / 'solid_results')))
RESULTS.mkdir(exist_ok=True)
app = FastAPI(title='FORME Geometry QA', version='1.3')
MAX_UPLOAD = 20_000_000
compute_slot = asyncio.Semaphore(1)
API = '/api/forme'

def cleanup_results():
    cutoff = time.time() - 86400
    for path in RESULTS.glob('*'):
        if path.is_file() and path.stat().st_mtime < cutoff:
            path.unlink(missing_ok=True)

@app.get(API + '/health')
def health():
    return {'status':'ok','engine':'vtk voxel union + scipy + trimesh','units':'mm','version':'1.3'}

def voxelize_piece(mesh:trimesh.Trimesh, origin:np.ndarray, step:float, dims:np.ndarray) -> np.ndarray:
    # Create VTK mesh for closed component; isolate components so overlapping shells
    # do not XOR each other under even-odd stencil filling.
    pts = vtk.vtkPoints()
    pts.SetData(numpy_to_vtk(np.asarray(mesh.vertices, dtype=np.float64), deep=True))
    faces = np.asarray(mesh.faces, dtype=np.int64)
    connectivity = numpy_to_vtkIdTypeArray(faces.ravel(), deep=True)
    offsets = numpy_to_vtkIdTypeArray(np.arange(0, 3 * len(faces) + 1, 3, dtype=np.int64), deep=True)
    cells = vtk.vtkCellArray()
    cells.SetData(offsets, connectivity)
    poly = vtk.vtkPolyData()
    poly.SetPoints(pts)
    poly.SetPolys(cells)
    stencil_source = vtk.vtkPolyDataToImageStencil()
    stencil_source.SetInputData(poly)
    stencil_source.SetOutputOrigin(*map(float,origin))
    stencil_source.SetOutputSpacing(float(step),float(step),float(step))
    stencil_source.SetOutputWholeExtent(0,int(dims[0]-1),0,int(dims[1]-1),0,int(dims[2]-1))
    stencil_source.Update()
    image = vtk.vtkImageData()
    image.SetOrigin(*map(float,origin))
    image.SetSpacing(step,step,step)
    image.SetDimensions(*map(int,dims))
    image.AllocateScalars(vtk.VTK_UNSIGNED_CHAR,1)
    vtk_to_numpy(image.GetPointData().GetScalars())[:] = 1
    cutter=vtk.vtkImageStencil()
    cutter.SetInputData(image)
    cutter.SetStencilConnection(stencil_source.GetOutputPort())
    cutter.SetBackgroundValue(0)
    cutter.Update()
    return vtk_to_numpy(cutter.GetOutput().GetPointData().GetScalars()).reshape(tuple(dims[::-1])).transpose(2,1,0).astype(bool)

def ball(radius:int):
    if radius < 1: return None
    a=np.arange(-radius,radius+1)
    return sum(q*q for q in np.meshgrid(a,a,a,indexing='ij'))<=radius*radius

def solidify(data:bytes, *, step:float=.12, repair:float=.36,
             min_join:float=.65, count:int=12, diameter:float=18, product:str='ring'):
    if len(data)>20_000_000: raise ValueError('STL 超出 20MB 上限')
    model=trimesh.load(io.BytesIO(data), file_type='stl', force='mesh',process=True)
    if not isinstance(model,trimesh.Trimesh) or len(model.faces)<10: raise ValueError('无法解析有效 STL')
    if len(model.faces)>400000: raise ValueError('模型超过 40 万面限制')
    original_watertight=bool(model.is_watertight)
    parts=model.split(only_watertight=False)
    lo=model.bounds[0]-step*3
    hi=model.bounds[1]+step*3
    dims=np.ceil((hi-lo)/step).astype(int)+1
    if np.prod(dims)>7_000_000:raise ValueError('体素网格超过 700 万单元：请调大分辨率')
    if np.any(dims<4): raise ValueError('模型尺寸不适合当前体素分辨率')
    occupancy=np.zeros(tuple(dims),dtype=bool)
    invalid_parts=0
    for piece in parts:
        if len(piece.faces)<4: continue
        if not piece.is_watertight:
            invalid_parts+=1
            continue
        occupancy |= voxelize_piece(piece,lo,step,dims)
    if invalid_parts:
        raise ValueError(f'源模型有 {invalid_parts} 个非封闭部件，停止融合；请先修复原始网格')
    if not occupancy.any():raise ValueError('体素化失败，请减小体素间距或检查源网格法向')
    before_count=int(ndimage.label(occupancy,structure=ndimage.generate_binary_structure(3,1))[1])
    # Local morphological close can connect overlapping or near-touching motif seams.
    # Repair radius is explicit and bounded; no hidden support bands are added.
    rr=int(round(repair/step))
    if rr>0:
        occupancy=ndimage.binary_closing(occupancy,structure=ball(rr))
    if not occupancy.any():raise ValueError('修补操作使实体消失，尝试减小修补半径')
    after_count=int(ndimage.label(occupancy,structure=ndimage.generate_binary_structure(3,1))[1])
    padded=np.pad(occupancy,2,constant_values=False)
    vertices,faces,_,_=marching_cubes(padded.astype(np.uint8),.5,spacing=(step,step,step),allow_degenerate=False)
    vertices += lo-2*step
    fused=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
    if fused.volume<0: fused.invert()
    pieces=fused.split(only_watertight=False)
    shells=len(pieces)
    watertight=bool(fused.is_watertight)
    orientable=bool(fused.is_winding_consistent)
    # Join check: intersect the finished solid with each radial plane BETWEEN
    # two modules. Each connected 2D cross-section represents an independent
    # load-bearing bridge. The smallest inscribed-disk diameter of these bridges
    # estimates the weakest join. This is a voxel-limited *local* estimate,
    # not a certified minimum wall thickness of the entire model.
    seam_diameters=[]
    seam_sections=[]
    if product=='ring':
        R=diameter/2+.85
        rr=np.arange(R-2.3,R+2.3,step)
        yy=np.arange(lo[1],hi[1]+step,step)
        radial, vertical=np.meshgrid(rr,yy,indexing='ij')
        for k in range(count):
            a=(k+.5)*2*np.pi/count
            coords=np.array([(radial*np.sin(a)-lo[0])/step,
                             (vertical-lo[1])/step,
                             (radial*np.cos(a)-lo[2])/step])
            section=ndimage.map_coordinates(occupancy.astype(np.uint8),coords,order=0,mode='constant')>0
            labels,nsec=ndimage.label(section,structure=ndimage.generate_binary_structure(2,1))
            bridges=[]
            for j in range(1,nsec+1):
                bridge=labels==j
                if np.count_nonzero(bridge)>=3:
                    diameter_2d=float(2*step*ndimage.distance_transform_edt(bridge).max())
                    bridges.append(round(diameter_2d,3))
            seam_sections.append(len(bridges))
            seam_diameters.append(round(min(bridges),3) if bridges else 0.)
    min_seam=round(min(seam_diameters),3) if seam_diameters else None
    geometry_ok=watertight and orientable and shells==1 and after_count==1
    thickness_ok=(min_seam is not None and min_seam>=min_join) if product=='ring' else None
    warnings=[]
    if len(parts)>1:warnings.append(f'预览模型包含 {len(parts)} 个独立网格部件，已尝试体素并集')
    if repair>0:warnings.append(f'局部形态学闭合半径 {repair:.2f} mm 可能改变原始细节')
    if not geometry_ok:warnings.append(f'几何尚不满足单一闭合实体条件：{shells} 个表面连通部分')
    if min_seam is not None and not thickness_ok:warnings.append(f'接缝等效厚度估计 {min_seam:.2f} mm，低于设定门槛 {min_join:.2f} mm')
    if product!='ring':warnings.append('项链包含柔性连接/配件；本次未做各接点专项厚度检查')
    warnings.append('体素近似布尔 + 局部厚度估计不是全局最小壁厚或铸造工艺合格证明')
    return fused,{
      'engine':'分辨率约束体素布尔并集','step_mm':step,'repair_radius_mm':repair,
      'input_triangles':int(len(model.faces)),'input_watertight':original_watertight,
      'input_components':len(parts),'voxel_components_before':before_count,
      'voxel_components_after':after_count,'output_triangles':int(len(fused.faces)),
      'watertight':watertight,'orientable':orientable,'connected_shells':shells,
      'volume_mm3':round(float(abs(fused.volume)),2),'min_join_estimate_mm':min_seam,
      'min_join_threshold_mm':min_join if product=='ring' else None,
      'seam_diameters_mm':seam_diameters,'seam_bridge_counts':seam_sections,'geometry_ok':geometry_ok,
      'thickness_ok':thickness_ok,'passed':bool(geometry_ok and (thickness_ok if product=='ring' else False)),
      'warnings':warnings,'units':'mm'}

def write_results(model, uid):
    (RESULTS / f'{uid}.stl').write_bytes(model.export(file_type='stl'))
    (RESULTS / f'{uid}.obj').write_bytes(model.export(file_type='obj').encode('utf-8'))

@app.post(API + '/solidify')
async def run_solidify(request:Request, step:float=.12, repair:float=.36,
                       min_join:float=.65, count:int=12, diameter:float=18,product:str='ring'):
    if not (.08<=step<=.35 and 0<=repair<=.48 and .2<=min_join<=2 and 4<=count<=50 and 10<=diameter<=40 and product in ('ring','necklace')):
        raise HTTPException(400,'参数不在安全范围内')
    if compute_slot.locked():
        raise HTTPException(429, '几何服务正在处理其他设计，请稍后重试')
    async with compute_slot:
        data = bytearray()
        async for chunk in request.stream():
            if len(data) + len(chunk) > MAX_UPLOAD:
                raise HTTPException(413, 'STL 超出 20MB 上限')
            data.extend(chunk)
        try:
            model, report = await run_in_threadpool(solidify, bytes(data), step=step, repair=repair,
                                min_join=min_join, count=count, diameter=diameter, product=product)
        except (ValueError, RuntimeError) as e:
            raise HTTPException(422, detail=str(e))
        cleanup_results()
        uid = uuid.uuid4().hex[:16]
        await run_in_threadpool(write_results, model, uid)
    return {'id':uid,'report':report,'stl_url':f'{API}/solids/{uid}.stl','obj_url':f'{API}/solids/{uid}.obj'}

@app.get(API + '/solids/{filename}')
def download_solid(filename:str):
    if not re.fullmatch(r'[0-9a-f]{16}\.(stl|obj)', filename):
        raise HTTPException(404,'文件不存在')
    cleanup_results()
    p=RESULTS / filename
    if not p.is_file():raise HTTPException(404,'文件不存在')
    return FileResponse(p,filename='FORME-voxel-union-'+filename,media_type='application/octet-stream')

if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host=os.environ.get('HOST','127.0.0.1'),port=int(os.environ.get('PORT','8787')))
