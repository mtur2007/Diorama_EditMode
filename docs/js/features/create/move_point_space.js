import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

export function createMovePointSpaceHelpers({
  getGuideCoordinateFrameOverride,
  getChangeAngleGridTarget,
} = {}) {
  function parseMovePointAxisInput(raw) {
    const text = String(raw ?? '').trim();
    if (!text) { return null; }
    const delta = text.match(/^\+=\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
    if (delta) {
      return { mode: 'delta', value: parseFloat(delta[1]) };
    }
    const absolute = text.match(/^[+-]?(?:\d+\.?\d*|\.\d+)$/);
    if (absolute) {
      return { mode: 'absolute', value: parseFloat(absolute[0]) };
    }
    return { mode: 'invalid', raw: text };
  }

  function readGuideMirrorCoordFrame(rawFrame) {
    if (!rawFrame || !Array.isArray(rawFrame.anchor) || !Array.isArray(rawFrame.quat)) { return null; }
    const anchor = new THREE.Vector3(
      Number(rawFrame.anchor[0]) || 0,
      Number(rawFrame.anchor[1]) || 0,
      Number(rawFrame.anchor[2]) || 0
    );
    const quat = new THREE.Quaternion(
      Number(rawFrame.quat[0]) || 0,
      Number(rawFrame.quat[1]) || 0,
      Number(rawFrame.quat[2]) || 0,
      Number(rawFrame.quat[3]) || 1
    ).normalize();
    return { anchor, quat };
  }

  function getMovePointGridFrameForMesh(mesh) {
    const planeRef = mesh?.userData?.planeRef;
    const meshMirrorFrame = readGuideMirrorCoordFrame(mesh?.userData?.guideMirrorCoordFrame);

    const selectedMirrorFrame = readGuideMirrorCoordFrame(getGuideCoordinateFrameOverride?.())
      || readGuideMirrorCoordFrame(getChangeAngleGridTarget?.()?.userData?.guideMirrorCoordFrame);
    if (selectedMirrorFrame) {
      return selectedMirrorFrame;
    }

    if (meshMirrorFrame) {
      return meshMirrorFrame;
    }

    const mirrorFrame = readGuideMirrorCoordFrame(planeRef?.userData?.guideMirrorCoordFrame);
    if (mirrorFrame) {
      return mirrorFrame;
    }
    if (mesh?.quaternion?.isQuaternion && mesh?.position?.isVector3) {
      const isGuideGrid = mesh?.userData?.guideGridDisplay === 'grid'
        || mesh?.userData?.guideGridDisplay === 'plane'
        || String(mesh?.name || '').includes('GuideGrid');
      if (isGuideGrid) {
        return {
          anchor: mesh.position.clone(),
          quat: mesh.quaternion.clone().normalize(),
        };
      }
    }
    if (!planeRef?.quaternion?.isQuaternion) { return null; }
    const anchor = planeRef?.position ? planeRef.position.clone() : new THREE.Vector3(0, 0, 0);
    const quat = planeRef.quaternion.clone().normalize();
    return { anchor, quat };
  }

  function worldToGridPosition(worldPos, frame) {
    return worldPos.clone().sub(frame.anchor).applyQuaternion(frame.quat.clone().invert());
  }

  function gridToWorldPosition(gridPos, frame) {
    return gridPos.clone().applyQuaternion(frame.quat).add(frame.anchor);
  }

  function getMovePointAxisPosition(mesh, mode = 'world') {
    if (mode !== 'grid') {
      return mesh.position.clone();
    }
    const frame = getMovePointGridFrameForMesh(mesh);
    if (!frame) {
      return mesh.position.clone();
    }
    return worldToGridPosition(mesh.position, frame);
  }

  return {
    parseMovePointAxisInput,
    readGuideMirrorCoordFrame,
    getMovePointGridFrameForMesh,
    worldToGridPosition,
    gridToWorldPosition,
    getMovePointAxisPosition,
  };
}
