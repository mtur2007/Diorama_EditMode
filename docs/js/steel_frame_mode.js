import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';
import { createCatenaryTrussTower } from './train_system.js';

export function createSteelFrameMode(scene, cubeGeometry, cubeMaterial) {
  const lines = [[]];
  let currentLineIndex = 0;
  const segmentMeshes = [];
  const segmentName = 'SteelFrameSegment';
  const pointColor = 0xff0000;
  const copiedPointColor = 0xffd400;
  const selectedPointColor = 0x7be6ff;
  const selectedPoints = [];
  const selectionBreakMarker = Object.freeze({ __steelFrameSelectionBreak: true });
  const generatedRecords = [];
  let generatedRecordId = 1;
  let active = false;
  let generated = false;
  let allowPointAppend = false;
  const createPointScale = 0.1;
  let materialReferenceResolver = null;
  let forcedCreatEnvMap = null;
  const BEAM_BASE_COLOR = 0x9DA2A1;
  const DEFAULT_MATERIAL_GLOSS = 0.7;
  const MIN_STYLE_DIMENSION = 0.001;
  const MIN_STYLE_RADIUS = MIN_STYLE_DIMENSION * 0.5;
  const POINT_SECTION_STYLE_KEYS = Object.freeze({
    width: 'steelFrameSectionWidthX',
    height: 'steelFrameSectionHeightY',
    radius: 'steelFrameSectionRadiusZ',
    roll: 'steelFrameSectionRollDeg',
  });

  function getDefaultPointColor(mesh) {
    return mesh?.userData?.steelFrameCopied ? copiedPointColor : pointColor;
  }

  function resolveMaterialReferenceAppearance(materialRefId = '') {
    const key = String(materialRefId || '').trim();
    if (!key || typeof materialReferenceResolver !== 'function') { return null; }
    const resolved = materialReferenceResolver(key);
    if (!resolved || typeof resolved !== 'object') { return null; }
    return {
      color: Number.isFinite(Number(resolved?.color))
        ? Math.max(0, Math.min(0xffffff, Math.round(Number(resolved.color))))
        : BEAM_BASE_COLOR,
      gloss: Number.isFinite(Number(resolved?.gloss))
        ? THREE.MathUtils.clamp(Number(resolved.gloss), 0, 1)
        : DEFAULT_MATERIAL_GLOSS,
      envDayPreset: typeof resolved?.envDayPreset === 'string' ? resolved.envDayPreset.trim() : '',
      envNightPreset: typeof resolved?.envNightPreset === 'string' ? resolved.envNightPreset.trim() : '',
    };
  }

  function resolveBeamAppearance(style = null) {
    const materialRefId = String(style?.materialRefId || '').trim();
    const referenced = resolveMaterialReferenceAppearance(materialRefId);
    if (referenced) {
      return {
        materialRefId,
        materialColor: referenced.color,
        materialGloss: referenced.gloss,
        envDayPreset: referenced.envDayPreset,
        envNightPreset: referenced.envNightPreset,
      };
    }
    return {
      materialRefId,
      materialColor: Number.isFinite(Number(style?.materialColor))
        ? Math.max(0, Math.min(0xffffff, Math.round(Number(style.materialColor))))
        : BEAM_BASE_COLOR,
      materialGloss: Number.isFinite(Number(style?.materialGloss))
        ? THREE.MathUtils.clamp(Number(style.materialGloss), 0, 1)
        : DEFAULT_MATERIAL_GLOSS,
      envDayPreset: typeof style?.envDayPreset === 'string' ? style.envDayPreset.trim() : '',
      envNightPreset: typeof style?.envNightPreset === 'string' ? style.envNightPreset.trim() : '',
    };
  }

  function compactBeamStyleForStorage(style = null) {
    if (!style || typeof style !== 'object') { return null; }
    const next = {
      beamWidthHorizontal: Number(style.beamWidthHorizontal),
      beamHeightVertical: Number(style.beamHeightVertical),
      beamThickness: Number(style.beamThickness),
      beamRollDeg: Number(style.beamRollDeg),
      materialRefId: typeof style.materialRefId === 'string' ? style.materialRefId.trim() : '',
    };
    const out = {};
    if (Number.isFinite(next.beamWidthHorizontal)) { out.beamWidthHorizontal = next.beamWidthHorizontal; }
    if (Number.isFinite(next.beamHeightVertical)) { out.beamHeightVertical = next.beamHeightVertical; }
    if (Number.isFinite(next.beamThickness)) { out.beamThickness = next.beamThickness; }
    if (Number.isFinite(next.beamRollDeg)) { out.beamRollDeg = THREE.MathUtils.clamp(next.beamRollDeg, -180, 180); }
    if (next.materialRefId) { out.materialRefId = next.materialRefId; }
    return out;
  }

  const envLoader = new THREE.TextureLoader();
  envLoader.load('textures/ct.jpg', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    forcedCreatEnvMap = texture;

    // Keep non-rite generated meshes on the fixed env map.
    segmentMeshes.forEach((obj) => {
      if (!obj || !obj.traverse) { return; }
      const profile = String(obj?.userData?.steelFrameSegmentProfile || '').toLowerCase();
      if (profile === 'tubular') { return; }
      const style = normalizeBeamStyle(profile || segmentProfile, obj?.userData?.steelFrameSegmentStyle || null);
      applyMaterialStyleToObject(obj, style);
    });
  });

  function resolveMaterialParams(gloss = DEFAULT_MATERIAL_GLOSS) {
    const g = THREE.MathUtils.clamp(Number.isFinite(Number(gloss)) ? Number(gloss) : DEFAULT_MATERIAL_GLOSS, 0, 1);
    return {
      metalness: THREE.MathUtils.lerp(0.08, 0.92, g),
      roughness: THREE.MathUtils.lerp(0.92, 0.22, g),
      envMapIntensity: THREE.MathUtils.lerp(0.35, 1.35, g),
    };
  }

  function createCreatStandardMaterial(color = BEAM_BASE_COLOR, gloss = DEFAULT_MATERIAL_GLOSS) {
    const materialParams = resolveMaterialParams(gloss);
    return new THREE.MeshStandardMaterial({
      color,
      metalness: materialParams.metalness,
      roughness: materialParams.roughness,
      envMap: forcedCreatEnvMap,
      envMapIntensity: materialParams.envMapIntensity,
    });
  }
  let segmentProfile = 'round';

  function getDefaultBeamStyle(profile) {
    const p = String(profile || '').toLowerCase();
    if (p === 'tubular' || p === 'tube') {
      return {
        // tubular / tube は X を直径として扱う。
        beamWidthHorizontal: 0.14,
        beamHeightVertical: 0.14,
        beamThickness: 0.14,
      };
    }
    if (p === 'round') {
      return {
        // round は X を直径として扱う。初期半径0.08に合わせて直径0.16。
        beamWidthHorizontal: 0.16,
        beamHeightVertical: 0.16,
        beamThickness: 0.08,
      };
    }
    if (p === 'rect_bar' || p === 'rect_tube') {
      return {
        // rect_bar / rect_tube: X=幅, Y=高さ, Z=角丸半径(R)
        beamWidthHorizontal: 0.28,
        beamHeightVertical: 0.28,
        beamThickness: 0.0,
        beamRollDeg: 0,
      };
    }
    if (p === 'corrugated_bar') {
      return {
        // corrugated_bar: X=全幅, Y=波高, Z=波密度(幅1あたりの波数)
        beamWidthHorizontal: 0.8,
        beamHeightVertical: 0.14,
        beamThickness: 5.0,
        beamRollDeg: 0,
      };
    }
    if (p === 'h_beam' || p === 't_beam' || p === 'l_beam') {
      return {
        beamWidthHorizontal: 0.28,
        beamHeightVertical: 0.28,
        beamThickness: 0.07,
        beamRollDeg: 0,
      };
    }
    if (p === 'panel_wall') {
      return {
        // panel_wall: X=分割目標長さ, Y=推奨高さ(互換用), Z=板厚
        beamWidthHorizontal: 1.2,
        beamHeightVertical: 2.2,
        beamThickness: 0.004,
      };
    }
    if (p === 'truss_column') {
      return {
        // truss_column: X=柱幅, Y=パネル長, Z=主材太さ
        beamWidthHorizontal: 0.22,
        beamHeightVertical: 0.42,
        beamThickness: 0.03,
        beamRollDeg: 0,
      };
    }
    if (p === 'truss_ladder') {
      return {
        // truss_ladder: X=柱幅, Y=パネル長, Z=主材太さ
        beamWidthHorizontal: 0.24,
        beamHeightVertical: 0.4,
        beamThickness: 0.028,
        beamRollDeg: 0,
      };
    }
    if (p === 'truss_catenary') {
      return {
        // truss_catenary: X=塔の1辺, Y=格子ピッチ, Z=主材太さ
        beamWidthHorizontal: 0.1,
        beamHeightVertical: 0.1,
        beamThickness: 0.02,
        beamRollDeg: 0,
      };
    }
    return null;
  }

  function normalizeBeamStyle(profile, rawStyle = null) {
    const base = getDefaultBeamStyle(profile);
    if (!base) { return null; }
    const p = String(profile || '').toLowerCase();
    const merged = {
      beamWidthHorizontal: Number(rawStyle?.beamWidthHorizontal),
      beamHeightVertical: Number(rawStyle?.beamHeightVertical),
      beamThickness: Number(rawStyle?.beamThickness),
      beamRollDeg: Number(rawStyle?.beamRollDeg),
      materialRefId: typeof rawStyle?.materialRefId === 'string' ? rawStyle.materialRefId.trim() : '',
      materialColor: Number(rawStyle?.materialColor),
      materialGloss: Number(rawStyle?.materialGloss),
      envDayPreset: typeof rawStyle?.envDayPreset === 'string' ? rawStyle.envDayPreset.trim() : '',
      envNightPreset: typeof rawStyle?.envNightPreset === 'string' ? rawStyle.envNightPreset.trim() : '',
    };
    const appendAppearance = (styleObject) => {
      if (!styleObject || typeof styleObject !== 'object') { return styleObject; }
      styleObject.materialRefId = merged.materialRefId || '';
      styleObject.materialColor = Number.isFinite(merged.materialColor)
        ? Math.max(0, Math.min(0xffffff, Math.round(merged.materialColor)))
        : BEAM_BASE_COLOR;
      styleObject.materialGloss = Number.isFinite(merged.materialGloss)
        ? THREE.MathUtils.clamp(merged.materialGloss, 0, 1)
        : DEFAULT_MATERIAL_GLOSS;
      styleObject.envDayPreset = merged.envDayPreset || '';
      styleObject.envNightPreset = merged.envNightPreset || '';
      return styleObject;
    };
    if (p === 'tubular' || p === 'tube') {
      const diameterRaw = Number.isFinite(merged.beamWidthHorizontal)
        ? merged.beamWidthHorizontal
        : (Number.isFinite(merged.beamThickness)
          ? merged.beamThickness
          : (Number.isFinite(merged.beamHeightVertical)
            ? merged.beamHeightVertical
            : base.beamWidthHorizontal));
      const diameter = Math.max(MIN_STYLE_DIMENSION, diameterRaw);
      return appendAppearance({
        beamWidthHorizontal: diameter,
        beamHeightVertical: diameter,
        beamThickness: diameter,
      });
    }
    const width = Number.isFinite(merged.beamWidthHorizontal) ? Math.max(MIN_STYLE_DIMENSION, merged.beamWidthHorizontal) : base.beamWidthHorizontal;
    if (p === 'corrugated_bar') {
      const waveHeightRaw = Number.isFinite(merged.beamHeightVertical) ? merged.beamHeightVertical : base.beamHeightVertical;
      let densityRaw = Number.isFinite(merged.beamThickness) ? merged.beamThickness : base.beamThickness;
      if (Number.isFinite(merged.beamThickness) && merged.beamThickness < 0.3) {
        // 旧データ(板厚)との互換: 低すぎる値は波密度既定値に寄せる
        densityRaw = base.beamThickness;
      }
      return appendAppearance({
        beamWidthHorizontal: width,
        beamHeightVertical: THREE.MathUtils.clamp(waveHeightRaw, MIN_STYLE_DIMENSION, Math.max(MIN_STYLE_DIMENSION, width * 0.9)),
        beamThickness: THREE.MathUtils.clamp(densityRaw, 0.5, 24),
        beamRollDeg: Number.isFinite(merged.beamRollDeg)
          ? THREE.MathUtils.clamp(merged.beamRollDeg, -180, 180)
          : (Number.isFinite(base.beamRollDeg) ? base.beamRollDeg : 0),
      });
    }
    if (p === 'truss_column' || p === 'truss_ladder') {
      const panelLenRaw = Number.isFinite(merged.beamHeightVertical) ? merged.beamHeightVertical : base.beamHeightVertical;
      const memberRaw = Number.isFinite(merged.beamThickness) ? merged.beamThickness : base.beamThickness;
      return appendAppearance({
        beamWidthHorizontal: width,
        beamHeightVertical: Math.max(0.08, panelLenRaw),
        beamThickness: THREE.MathUtils.clamp(memberRaw, MIN_STYLE_DIMENSION, Math.max(MIN_STYLE_DIMENSION, width * 0.35)),
        beamRollDeg: Number.isFinite(merged.beamRollDeg)
          ? THREE.MathUtils.clamp(merged.beamRollDeg, -180, 180)
          : (Number.isFinite(base.beamRollDeg) ? base.beamRollDeg : 0),
      });
    }
    if (p === 'truss_catenary') {
      const panelLenRaw = Number.isFinite(merged.beamHeightVertical) ? merged.beamHeightVertical : base.beamHeightVertical;
      const memberRaw = Number.isFinite(merged.beamThickness) ? merged.beamThickness : base.beamThickness;
      return appendAppearance({
        beamWidthHorizontal: Math.max(MIN_STYLE_DIMENSION, width),
        beamHeightVertical: Math.max(0.04, panelLenRaw),
        beamThickness: THREE.MathUtils.clamp(memberRaw, MIN_STYLE_DIMENSION, Math.max(MIN_STYLE_DIMENSION, width * 0.4)),
        beamRollDeg: Number.isFinite(merged.beamRollDeg)
          ? THREE.MathUtils.clamp(merged.beamRollDeg, -180, 180)
          : (Number.isFinite(base.beamRollDeg) ? base.beamRollDeg : 0),
      });
    }
    if (p === 'panel_wall') {
      const targetLen = Number.isFinite(merged.beamWidthHorizontal) ? Math.max(0.2, merged.beamWidthHorizontal) : base.beamWidthHorizontal;
      const wallHeight = Number.isFinite(merged.beamHeightVertical) ? Math.max(0.5, merged.beamHeightVertical) : base.beamHeightVertical;
      const thickness = Number.isFinite(merged.beamThickness) ? THREE.MathUtils.clamp(merged.beamThickness, MIN_STYLE_DIMENSION, 0.05) : base.beamThickness;
      return appendAppearance({
        beamWidthHorizontal: targetLen,
        beamHeightVertical: wallHeight,
        beamThickness: thickness,
      });
    }
    const height = Number.isFinite(merged.beamHeightVertical) ? Math.max(MIN_STYLE_DIMENSION, merged.beamHeightVertical) : base.beamHeightVertical;
    const maxThickness = (p === 'rect_bar' || p === 'rect_tube')
      ? Math.max(0, Math.min(width, height) * 0.5)
      : Math.max(MIN_STYLE_DIMENSION, Math.min(width, height) * 0.45);
    const thicknessRaw = Number.isFinite(merged.beamThickness) ? merged.beamThickness : base.beamThickness;
    const thickness = THREE.MathUtils.clamp(
      thicknessRaw,
      (p === 'rect_bar' || p === 'rect_tube') ? 0 : MIN_STYLE_DIMENSION,
      maxThickness,
    );
    const next = {
      beamWidthHorizontal: width,
      beamHeightVertical: height,
      beamThickness: thickness,
    };
    if (p === 'rect_bar' || p === 'rect_tube' || p === 'h_beam' || p === 't_beam' || p === 'l_beam') {
      next.beamRollDeg = Number.isFinite(merged.beamRollDeg)
        ? THREE.MathUtils.clamp(merged.beamRollDeg, -180, 180)
        : (Number.isFinite(base.beamRollDeg) ? base.beamRollDeg : 0);
    }
    return appendAppearance(next);
  }

  function applyLocalZRoll(object3d, rollDeg) {
    const deg = Number(rollDeg) || 0;
    if (!object3d?.quaternion?.isQuaternion || Math.abs(deg) <= 1e-6) { return; }
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      THREE.MathUtils.degToRad(deg),
    );
    object3d.quaternion.multiply(rollQuat).normalize();
  }

  function computeStableCurveFrames(curve, segmentCount) {
    const count = Math.max(1, Number(segmentCount) || 1);
    const tangents = [];
    const normals = [];
    const binormals = [];
    const worldUp = new THREE.Vector3(0, 1, 0);
    const fallbackAxes = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
    ];
    const projectReferenceToTangentPlane = (reference, tangent) => {
      const projected = reference.clone().projectOnPlane(tangent);
      if (projected.lengthSq() > 1e-10) {
        return projected.normalize();
      }
      return null;
    };

    for (let i = 0; i <= count; i += 1) {
      tangents.push(curve.getTangentAt(i / count).normalize());
    }
    const resolveFrameFromUp = (tangent, prevNormal = null, prevBinormal = null) => {
      let upAxis = projectReferenceToTangentPlane(worldUp, tangent);
      if (!upAxis && prevBinormal) {
        upAxis = prevBinormal.clone().projectOnPlane(tangent);
        if (upAxis.lengthSq() > 1e-10) {
          upAxis.normalize();
        } else {
          upAxis = null;
        }
      }
      if (!upAxis) {
        for (let i = 0; i < fallbackAxes.length; i += 1) {
          upAxis = projectReferenceToTangentPlane(fallbackAxes[i], tangent);
          if (upAxis) { break; }
        }
      }
      if (!upAxis) {
        upAxis = new THREE.Vector3(0, 1, 0);
      }
      let normal = new THREE.Vector3().crossVectors(upAxis, tangent).normalize();
      let binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
      if (prevNormal && normal.dot(prevNormal) < 0) {
        normal.multiplyScalar(-1);
        binormal.multiplyScalar(-1);
      } else if (!prevNormal && prevBinormal && binormal.dot(prevBinormal) < 0) {
        normal.multiplyScalar(-1);
        binormal.multiplyScalar(-1);
      }
      return { normal, binormal };
    };

    const firstFrame = resolveFrameFromUp(
      tangents[0]?.clone?.() || new THREE.Vector3(0, 0, 1),
      null,
      null,
    );
    normals.push(firstFrame.normal);
    binormals.push(firstFrame.binormal);

    for (let i = 1; i <= count; i += 1) {
      const nextFrame = resolveFrameFromUp(
        tangents[i],
        normals[i - 1],
        binormals[i - 1],
      );
      normals.push(nextFrame.normal);
      binormals.push(nextFrame.binormal);
    }

    return { tangents, normals, binormals };
  }

  function setMeshColorRecursive(obj, colorHex) {
    if (!obj) { return; }
    const paint = (mat) => mat?.color?.setHex?.(colorHex);
    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => paint(mat));
    } else {
      paint(obj.material);
    }
    obj.traverse?.((node) => {
      if (node === obj) { return; }
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => paint(mat));
      } else {
        paint(node.material);
      }
    });
  }

  function applyMaterialStyleToObject(obj, style = null) {
    if (!obj || !style) { return; }
    const appearance = resolveBeamAppearance(style);
    const colorHex = appearance.materialColor;
    const materialParams = resolveMaterialParams(appearance.materialGloss);
    const applyToMaterial = (mat) => {
      if (!mat || mat.type !== 'MeshStandardMaterial') { return; }
      if (mat.color?.setHex) {
        mat.color.setHex(colorHex);
      }
      mat.metalness = materialParams.metalness;
      mat.roughness = materialParams.roughness;
      mat.envMap = forcedCreatEnvMap;
      mat.envMapIntensity = materialParams.envMapIntensity;
      mat.needsUpdate = true;
    };
    if (Array.isArray(obj.material)) {
      obj.material.forEach((mat) => applyToMaterial(mat));
    } else {
      applyToMaterial(obj.material);
    }
    obj.traverse?.((node) => {
      if (node === obj) { return; }
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => applyToMaterial(mat));
      } else {
        applyToMaterial(node.material);
      }
    });
  }

  function applySegmentVisualState(mesh) {
    if (!mesh) { return; }
    const profile = String(mesh?.userData?.steelFrameSegmentProfile || '').toLowerCase();
    if (profile !== 'tubular') {
      const style = normalizeBeamStyle(profile || segmentProfile, mesh?.userData?.steelFrameSegmentStyle || null);
      applyMaterialStyleToObject(mesh, style);
    }
    if (mesh?.userData?.steelFrameCopiedObject) {
      setMeshColorRecursive(mesh, 0xffd400);
    }
  }

  function disposeObject3D(obj) {
    if (!obj) { return; }
    if (obj.traverse) {
      obj.traverse((node) => {
        if (node.geometry && typeof node.geometry.dispose === 'function') {
          node.geometry.dispose();
        }
        if (Array.isArray(node.material)) {
          node.material.forEach((mat) => mat?.dispose?.());
        } else if (node.material && typeof node.material.dispose === 'function') {
          node.material.dispose();
        }
      });
    }
  }

  function clearSegments() {
    for (let i = segmentMeshes.length - 1; i >= 0; i--) {
      const obj = segmentMeshes[i];
      if (!obj) { continue; }
      if (obj.parent) {
        obj.parent.remove(obj);
      }
      disposeObject3D(obj);
      segmentMeshes.splice(i, 1);
    }
  }

  function createRoundBarSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('round', style);
    const diameter = Number(dims?.beamWidthHorizontal);
    const radius = Number.isFinite(diameter) ? Math.max(MIN_STYLE_RADIUS, diameter * 0.5) : 0.08;
    const geometry = new THREE.CylinderGeometry(radius, radius, len, 10);
    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    mesh.visible = active;
    return mesh;
  }

  function getPointSectionStyle(mesh, fallbackStyle = null) {
    if (!mesh?.userData?.steelFramePoint) { return null; }
    const base = normalizeBeamStyle('rect_tube', fallbackStyle) || normalizeBeamStyle('rect_tube', null);
    return {
      beamWidthHorizontal: Number.isFinite(Number(mesh.userData?.[POINT_SECTION_STYLE_KEYS.width]))
        ? Math.max(MIN_STYLE_DIMENSION, Number(mesh.userData[POINT_SECTION_STYLE_KEYS.width]))
        : Number(base?.beamWidthHorizontal) || 0.28,
      beamHeightVertical: Number.isFinite(Number(mesh.userData?.[POINT_SECTION_STYLE_KEYS.height]))
        ? Math.max(MIN_STYLE_DIMENSION, Number(mesh.userData[POINT_SECTION_STYLE_KEYS.height]))
        : Number(base?.beamHeightVertical) || 0.28,
      beamThickness: Number.isFinite(Number(mesh.userData?.[POINT_SECTION_STYLE_KEYS.radius]))
        ? Math.max(0, Number(mesh.userData[POINT_SECTION_STYLE_KEYS.radius]))
        : Math.max(0, Number(base?.beamThickness) || 0),
      beamRollDeg: Number.isFinite(Number(mesh.userData?.[POINT_SECTION_STYLE_KEYS.roll]))
        ? THREE.MathUtils.clamp(Number(mesh.userData[POINT_SECTION_STYLE_KEYS.roll]), -180, 180)
        : THREE.MathUtils.clamp(Number(base?.beamRollDeg) || 0, -180, 180),
    };
  }

  function applyPointSectionStyle(pointMeshes, stylePatch = {}, fallbackStyle = null) {
    const targets = Array.from(new Set((Array.isArray(pointMeshes) ? pointMeshes : [])
      .filter((mesh) => mesh?.userData?.steelFramePoint)));
    if (targets.length < 1) {
      return { updated: 0, rebuilt: 0, points: [], meshes: [] };
    }
    const touchedSegments = [];
    let updated = 0;
    targets.forEach((mesh) => {
      const current = getPointSectionStyle(mesh, fallbackStyle);
      if (!current) { return; }
      const next = normalizeBeamStyle('rect_tube', {
        beamWidthHorizontal: stylePatch.beamWidthHorizontal ?? current.beamWidthHorizontal,
        beamHeightVertical: stylePatch.beamHeightVertical ?? current.beamHeightVertical,
        beamThickness: stylePatch.beamThickness ?? current.beamThickness,
        beamRollDeg: stylePatch.beamRollDeg ?? current.beamRollDeg,
      });
      if (!next) { return; }
      mesh.userData = {
        ...(mesh.userData || {}),
        [POINT_SECTION_STYLE_KEYS.width]: Number(next.beamWidthHorizontal),
        [POINT_SECTION_STYLE_KEYS.height]: Number(next.beamHeightVertical),
        [POINT_SECTION_STYLE_KEYS.radius]: Number(next.beamThickness),
        [POINT_SECTION_STYLE_KEYS.roll]: Number(next.beamRollDeg || 0),
      };
      segmentMeshes.forEach((seg) => {
        if (!seg?.parent || seg?.userData?.steelFrameSegmentProfile !== 'rect_tube') { return; }
        const refs = Array.isArray(seg?.userData?.steelFrameSegmentPointRefs)
          ? seg.userData.steelFrameSegmentPointRefs
          : [];
        if (refs.includes(mesh) && !touchedSegments.includes(seg)) {
          touchedSegments.push(seg);
        }
      });
      updated += 1;
    });
    const rebuilt = Number(rebuildSegmentsForPoints(targets)) || 0;
    return {
      updated,
      rebuilt,
      points: targets,
      meshes: touchedSegments.filter((mesh) => mesh?.parent),
    };
  }

  function getPointSectionStylePatch(mesh, fallbackStyle = null) {
    const current = getPointSectionStyle(mesh, fallbackStyle);
    if (!current) { return null; }
    return { ...current };
  }

  function createRoundedRectProfileShape(width, height, radius) {
    const hw = width * 0.5;
    const hh = height * 0.5;
    const r = THREE.MathUtils.clamp(radius, 0, Math.min(hw, hh));
    const shape = new THREE.Shape();
    if (r <= 1e-6) {
      shape.moveTo(-hw, -hh);
      shape.lineTo(hw, -hh);
      shape.lineTo(hw, hh);
      shape.lineTo(-hw, hh);
      shape.lineTo(-hw, -hh);
      return shape;
    }
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(hw, hh - r);
    shape.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-hw + r, hh);
    shape.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-hw, -hh + r);
    shape.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
    return shape;
  }

  function createRectBarSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('rect_bar', style);
    const width = Number(dims?.beamWidthHorizontal) || 0.28;
    const height = Number(dims?.beamHeightVertical) || 0.28;
    const roundR = Number(dims?.beamThickness) || 0;
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const profileShape = createRoundedRectProfileShape(width, height, roundR);
    const geometry = new THREE.ExtrudeGeometry(profileShape, {
      depth: len,
      bevelEnabled: false,
      curveSegments: Math.max(4, roundR > 1e-6 ? 10 : 1),
      steps: 1,
    });
    // ExtrudeGeometry depth is +Z from 0..len, center it around origin.
    geometry.translate(0, 0, -len * 0.5);
    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    // まず yaw + pitch で軸を合わせ、必要ならローカルZ軸まわりに断面を回す。
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    mesh.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(mesh, rollDeg);
    mesh.visible = active;
    return mesh;
  }

  function createCorrugatedProfileShape(width, waveHeight, waveDensity = 5) {
    const safeW = Math.max(MIN_STYLE_DIMENSION, Number(width) || 0.8);
    const safeH = Math.max(MIN_STYLE_DIMENSION, Number(waveHeight) || 0.22);
    const halfW = safeW * 0.5;
    const halfH = safeH * 0.5;
    // 波高は維持したまま、板そのものの肉厚だけを薄くする。
    const t = THREE.MathUtils.clamp(safeH * 0.16, MIN_STYLE_DIMENSION, Math.max(MIN_STYLE_DIMENSION, safeH * 0.30));
    const amp = Math.max(MIN_STYLE_RADIUS, halfH - (t * 0.5));
    const density = THREE.MathUtils.clamp(Number(waveDensity) || 5, 0.5, 24);
    const waves = Math.max(1, Math.round(safeW * density));
    const samples = Math.max(24, waves * 18);
    const shape = new THREE.Shape();

    const xAt = (i) => -halfW + (safeW * (i / samples));
    const phaseAt = (i) => ((i / samples) * waves * Math.PI * 2);
    const centerYAt = (i) => Math.sin(phaseAt(i)) * amp;
    const topYAt = (i) => centerYAt(i) + (t * 0.5);
    const bottomYAt = (i) => centerYAt(i) - (t * 0.5);

    shape.moveTo(xAt(0), topYAt(0));
    for (let i = 1; i <= samples; i += 1) {
      shape.lineTo(xAt(i), topYAt(i));
    }
    for (let i = samples; i >= 0; i -= 1) {
      shape.lineTo(xAt(i), bottomYAt(i));
    }
    shape.closePath();
    return shape;
  }

  function createCorrugatedBarSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('corrugated_bar', style);
    const width = Number(dims?.beamWidthHorizontal) || 0.8;
    const waveHeight = Number(dims?.beamHeightVertical) || 0.14;
    const waveDensity = Number(dims?.beamThickness) || 5;
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const profileShape = createCorrugatedProfileShape(width, waveHeight, waveDensity);
    const geometry = new THREE.ExtrudeGeometry(profileShape, {
      depth: len,
      bevelEnabled: false,
      curveSegments: 20,
      steps: 1,
    });
    geometry.translate(0, 0, -len * 0.5);
    const material = createCreatStandardMaterial(0xEDE7DD);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    // 波板は断面向きが見た目に直結するため、
    // 軸合わせを setFromUnitVectors ではなく安定基準で構成してねじれを防ぐ。
    const forward = dir.clone().normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let right = new THREE.Vector3().crossVectors(worldUp, forward);
    if (right.lengthSq() <= 1e-8) {
      // 軸がほぼY方向の場合のフォールバック
      right = new THREE.Vector3(1, 0, 0);
    } else {
      right.normalize();
    }
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();
    const basis = new THREE.Matrix4().makeBasis(right, up, forward);
    mesh.quaternion.setFromRotationMatrix(basis);
    if (Math.abs(rollDeg) > 1e-6) {
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        THREE.MathUtils.degToRad(rollDeg),
      );
      // 点-点軸(ローカルZ)周りに断面を回転。
      mesh.quaternion.multiply(rollQuat);
    }
    mesh.visible = active;
    return mesh;
  }

  function createTubularLightSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('tubular', style);
    const radius = Math.max(MIN_STYLE_RADIUS, Number(dims?.beamWidthHorizontal || 0.14) * 0.5);
    const geometry = new THREE.CylinderGeometry(radius, radius, len, 14);
    // Unlit bright white so it looks emissive without adding lights.
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;

    const mid = start.clone().add(end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    mesh.visible = active;
    return mesh;
  }

  function createTrussColumnSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('truss_column', style);
    const width = Math.max(MIN_STYLE_DIMENSION, Number(dims?.beamWidthHorizontal) || 0.22);
    const panelLen = Math.max(0.08, Number(dims?.beamHeightVertical) || 0.42);
    const memberSize = Math.max(MIN_STYLE_DIMENSION, Number(dims?.beamThickness) || 0.03);
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const diagonalSize = Math.max(MIN_STYLE_DIMENSION, memberSize * 0.55);
    const half = width * 0.5;
    const bayCount = Math.max(1, Math.round(len / panelLen));
    const actualPanelLen = len / bayCount;

    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const group = new THREE.Group();
    group.name = segmentName;

    const localCorners = [
      new THREE.Vector3( half,  half, 0),
      new THREE.Vector3( half, -half, 0),
      new THREE.Vector3(-half,  half, 0),
      new THREE.Vector3(-half, -half, 0),
    ];

    const addLocalBar = (a, b, thickness = memberSize) => {
      const segmentDir = b.clone().sub(a);
      const segmentLen = segmentDir.length();
      if (segmentLen < 1e-4) { return; }
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, thickness, segmentLen),
        material.clone(),
      );
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        segmentDir.normalize(),
      );
      group.add(mesh);
    };

    localCorners.forEach((corner) => {
      addLocalBar(
        new THREE.Vector3(corner.x, corner.y, -len * 0.5),
        new THREE.Vector3(corner.x, corner.y, len * 0.5),
      );
    });

    for (let i = 0; i <= bayCount; i += 1) {
      const z = (-len * 0.5) + (actualPanelLen * i);
      addLocalBar(new THREE.Vector3(-half,  half, z), new THREE.Vector3( half,  half, z), memberSize);
      addLocalBar(new THREE.Vector3(-half, -half, z), new THREE.Vector3( half, -half, z), memberSize);
      addLocalBar(new THREE.Vector3( half, -half, z), new THREE.Vector3( half,  half, z), memberSize);
      addLocalBar(new THREE.Vector3(-half, -half, z), new THREE.Vector3(-half,  half, z), memberSize);
    }

    for (let i = 0; i < bayCount; i += 1) {
      const z0 = (-len * 0.5) + (actualPanelLen * i);
      const z1 = z0 + actualPanelLen;
      addLocalBar(new THREE.Vector3( half,  half, z0), new THREE.Vector3( half, -half, z1), diagonalSize);
      addLocalBar(new THREE.Vector3( half, -half, z0), new THREE.Vector3(-half, -half, z1), diagonalSize);
      addLocalBar(new THREE.Vector3(-half, -half, z0), new THREE.Vector3(-half,  half, z1), diagonalSize);
      addLocalBar(new THREE.Vector3(-half,  half, z0), new THREE.Vector3( half,  half, z1), diagonalSize);
    }

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(group, rollDeg);
    group.visible = active;
    return group;
  }

  function createLadderTrussSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('truss_ladder', style);
    const width = Math.max(MIN_STYLE_DIMENSION, Number(dims?.beamWidthHorizontal) || 0.24);
    const panelLen = Math.max(0.08, Number(dims?.beamHeightVertical) || 0.4);
    const memberSize = Math.max(MIN_STYLE_DIMENSION, Number(dims?.beamThickness) || 0.028);
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const half = width * 0.5;
    const bayCount = Math.max(1, Math.round(len / panelLen));
    const actualPanelLen = len / bayCount;

    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const group = new THREE.Group();
    group.name = segmentName;

    const addLocalBar = (a, b, thickness = memberSize) => {
      const segmentDir = b.clone().sub(a);
      const segmentLen = segmentDir.length();
      if (segmentLen < 1e-4) { return; }
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(thickness, thickness, segmentLen),
        material.clone(),
      );
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        segmentDir.normalize(),
      );
      group.add(mesh);
    };

    addLocalBar(
      new THREE.Vector3(-half, 0, -len * 0.5),
      new THREE.Vector3(-half, 0, len * 0.5),
    );
    addLocalBar(
      new THREE.Vector3(half, 0, -len * 0.5),
      new THREE.Vector3(half, 0, len * 0.5),
    );

    for (let i = 0; i <= bayCount; i += 1) {
      const z = (-len * 0.5) + (actualPanelLen * i);
      addLocalBar(
        new THREE.Vector3(-half, 0, z),
        new THREE.Vector3(half, 0, z),
        memberSize,
      );
    }

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(group, rollDeg);
    group.visible = active;
    return group;
  }

  function createCatenaryTrussColumnSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('truss_catenary', style);
    const sideLength = Math.max(MIN_STYLE_DIMENSION, Number(dims?.beamWidthHorizontal) || 0.1);
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const tower = createCatenaryTrussTower(len, { sideLength });
    const roundedHeight = Math.max(0.001, Number(tower?.userData?.catenaryTrussHeight) || len);

    const group = new THREE.Group();
    group.name = segmentName;
    // 円柱や梁と同じく、ローカルZ軸を長手方向として扱う。
    tower.rotation.x = Math.PI * 0.5;
    tower.position.z = -roundedHeight * 0.5;
    group.add(tower);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(group, rollDeg);
    group.visible = active;
    return group;
  }

  function createInterpolatedTubeSegmentMesh(pointMeshes, style = null) {
    const refs = Array.isArray(pointMeshes) ? pointMeshes : [];
    const rawPoints = refs
      .map((mesh) => mesh?.position?.clone?.() || null)
      .filter(Boolean);
    if (rawPoints.length < 2) { return null; }

    const points = [];
    rawPoints.forEach((p, idx) => {
      if (idx < 1 || p.distanceToSquared(rawPoints[idx - 1]) > 1e-10) {
        points.push(p);
      }
    });
    if (points.length < 2) { return null; }

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    let approxLen = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      approxLen += points[i].distanceTo(points[i + 1]);
    }
    const tubularSegments = THREE.MathUtils.clamp(Math.round(Math.max(approxLen * 20, points.length * 12)), 24, 960);
    const dims = normalizeBeamStyle('tube', style);
    const radius = Math.max(MIN_STYLE_RADIUS, Number(dims?.beamWidthHorizontal || 0.14) * 0.5);
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 14, false);
    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;
    mesh.visible = active;
    return mesh;
  }

  function createInterpolatedRectTubeSegmentMesh(pointMeshes, style = null) {
    const refs = Array.isArray(pointMeshes) ? pointMeshes : [];
    const controlEntries = [];
    refs.forEach((mesh) => {
      const point = mesh?.position?.clone?.() || null;
      if (!point) { return; }
      if (controlEntries.length > 0) {
        const prev = controlEntries[controlEntries.length - 1];
        if (point.distanceToSquared(prev.point) <= 1e-10) { return; }
      }
      controlEntries.push({
        point,
        style: getPointSectionStyle(mesh, style),
      });
    });
    if (controlEntries.length < 2) { return null; }

    const points = controlEntries.map((entry) => entry.point);
    if (points.length < 2) { return null; }

    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    const controlStyles = controlEntries.map((entry) => entry.style).filter(Boolean);
    let approxLen = 0;
    const cumulativeDistances = [0];
    for (let i = 0; i < points.length - 1; i += 1) {
      approxLen += points[i].distanceTo(points[i + 1]);
      cumulativeDistances.push(approxLen);
    }
    const tubularSegments = THREE.MathUtils.clamp(Math.round(Math.max(approxLen * 20, points.length * 12)), 24, 960);
    const fallbackStyleResolved = normalizeBeamStyle('rect_tube', style);
    const resolveInterpolatedStyleAtDistance = (distance) => {
      const styles = controlStyles.length === points.length
        ? controlStyles
        : points.map((_point, idx) => controlStyles[idx] || fallbackStyleResolved);
      if (styles.length < 1) { return fallbackStyleResolved; }
      if (styles.length === 1 || approxLen <= 1e-8) { return styles[0]; }
      const clampedDistance = THREE.MathUtils.clamp(distance, 0, approxLen);
      let segmentIndex = cumulativeDistances.length - 2;
      for (let i = 0; i < cumulativeDistances.length - 1; i += 1) {
        if (clampedDistance <= cumulativeDistances[i + 1]) {
          segmentIndex = i;
          break;
        }
      }
      const startDist = cumulativeDistances[segmentIndex];
      const endDist = cumulativeDistances[segmentIndex + 1];
      const span = Math.max(1e-8, endDist - startDist);
      const t = THREE.MathUtils.clamp((clampedDistance - startDist) / span, 0, 1);
      const a = styles[segmentIndex] || fallbackStyleResolved;
      const b = styles[Math.min(styles.length - 1, segmentIndex + 1)] || a;
      const rollDelta = ((((Number(b.beamRollDeg) || 0) - (Number(a.beamRollDeg) || 0)) + 540) % 360) - 180;
      return {
        beamWidthHorizontal: THREE.MathUtils.lerp(Number(a.beamWidthHorizontal) || 0.28, Number(b.beamWidthHorizontal) || Number(a.beamWidthHorizontal) || 0.28, t),
        beamHeightVertical: THREE.MathUtils.lerp(Number(a.beamHeightVertical) || 0.28, Number(b.beamHeightVertical) || Number(a.beamHeightVertical) || 0.28, t),
        beamThickness: THREE.MathUtils.lerp(Number(a.beamThickness) || 0, Number(b.beamThickness) || Number(a.beamThickness) || 0, t),
        beamRollDeg: (Number(a.beamRollDeg) || 0) + (rollDelta * t),
      };
    };

    const frames = computeStableCurveFrames(curve, tubularSegments);
    const rings = [];
    for (let i = 0; i <= tubularSegments; i += 1) {
      const styleAtRing = normalizeBeamStyle('rect_tube', resolveInterpolatedStyleAtDistance((approxLen * i) / Math.max(1, tubularSegments))) || fallbackStyleResolved;
      const width = Math.max(MIN_STYLE_DIMENSION, Number(styleAtRing?.beamWidthHorizontal) || 0.28);
      const height = Math.max(MIN_STYLE_DIMENSION, Number(styleAtRing?.beamHeightVertical) || 0.28);
      const rollRad = THREE.MathUtils.degToRad(Number(styleAtRing?.beamRollDeg) || 0);
      const cosRoll = Math.cos(rollRad);
      const sinRoll = Math.sin(rollRad);
      const halfW = width * 0.5;
      const halfH = height * 0.5;
      const rotatedProfile = [
        { x: -halfW, y: halfH },
        { x: halfW, y: halfH },
        { x: halfW, y: -halfH },
        { x: -halfW, y: -halfH },
      ].map((point) => ({
        x: (point.x * cosRoll) - (point.y * sinRoll),
        y: (point.x * sinRoll) + (point.y * cosRoll),
      }));
      const center = curve.getPointAt(i / tubularSegments);
      const normal = frames.normals[i] || new THREE.Vector3(1, 0, 0);
      const binormal = frames.binormals[i] || new THREE.Vector3(0, 1, 0);
      const ring = [];
      for (let j = 0; j < rotatedProfile.length; j += 1) {
        const sample = rotatedProfile[j];
        const vertex = center.clone()
          .addScaledVector(normal, sample.x)
          .addScaledVector(binormal, sample.y);
        ring.push(vertex);
      }
      rings.push(ring);
    }

    const positions = [];
    const indices = [];
    const pushVertex = (vertex) => {
      const index = positions.length / 3;
      positions.push(vertex.x, vertex.y, vertex.z);
      return index;
    };
    const pushIndexedQuad = (a, b, c, d) => {
      indices.push(a, b, c);
      indices.push(a, c, d);
    };

    // Each band owns its own vertices so corners stay hard, while triangles
    // inside the same band share vertices and therefore share normals.
    const bandCornerPairs = [
      [0, 1], // top
      [1, 2], // right
      [2, 3], // bottom
      [3, 0], // left
    ];
    const bandVertexIndices = bandCornerPairs.map(() => []);
    bandCornerPairs.forEach(([cornerA, cornerB], bandIndex) => {
      for (let i = 0; i < rings.length; i += 1) {
        const ring = rings[i];
        const row = [
          pushVertex(ring[cornerA]),
          pushVertex(ring[cornerB]),
        ];
        bandVertexIndices[bandIndex].push(row);
      }
      for (let i = 0; i < tubularSegments; i += 1) {
        const current = bandVertexIndices[bandIndex][i];
        const next = bandVertexIndices[bandIndex][i + 1];
        pushIndexedQuad(current[0], next[0], next[1], current[1]);
      }
    });

    const start = rings[0];
    const end = rings[rings.length - 1];
    const startIndices = [
      pushVertex(start[0]),
      pushVertex(start[1]),
      pushVertex(start[2]),
      pushVertex(start[3]),
    ];
    const endIndices = [
      pushVertex(end[0]),
      pushVertex(end[1]),
      pushVertex(end[2]),
      pushVertex(end[3]),
    ];
    pushIndexedQuad(startIndices[0], startIndices[1], startIndices[2], startIndices[3]);
    pushIndexedQuad(endIndices[0], endIndices[3], endIndices[2], endIndices[1]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox?.();
    geometry.computeBoundingSphere?.();

    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = segmentName;
    mesh.visible = active;
    return mesh;
  }

  function createHBeamSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('h_beam', style);
    const totalWidth = dims.beamWidthHorizontal;
    const totalHeight = dims.beamHeightVertical;
    const webThickness = dims.beamThickness;
    const flangeThickness = dims.beamThickness;
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const webHeight = Math.max(0.01, totalHeight - flangeThickness * 2);
    const flangeOffset = (totalHeight * 0.5) - (flangeThickness * 0.5);

    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);

    const group = new THREE.Group();
    group.name = segmentName;

    const web = new THREE.Mesh(
      new THREE.BoxGeometry(webThickness, webHeight, len),
      material.clone(),
    );
    group.add(web);

    const topFlange = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, flangeThickness, len),
      material.clone(),
    );
    topFlange.position.y = flangeOffset;
    group.add(topFlange);

    const bottomFlange = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, flangeThickness, len),
      material.clone(),
    );
    bottomFlange.position.y = -flangeOffset;
    group.add(bottomFlange);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    // まず yaw + pitch で軸を合わせ、必要ならローカルZ軸まわりに断面を回す。
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(group, rollDeg);
    group.visible = active;
    return group;
  }

  function createTBeamSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('t_beam', style);
    const totalWidth = dims.beamWidthHorizontal;
    const totalHeight = dims.beamHeightVertical;
    const webThickness = dims.beamThickness;
    const flangeThickness = dims.beamThickness;
    const rollDeg = Number(dims?.beamRollDeg) || 0;
    const webHeight = Math.max(0.01, totalHeight - flangeThickness);

    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const group = new THREE.Group();
    group.name = segmentName;

    const topFlangeY = (totalHeight * 0.5) - (flangeThickness * 0.5);
    const webY = topFlangeY - (flangeThickness * 0.5) - (webHeight * 0.5);

    const topFlange = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, flangeThickness, len),
      material.clone(),
    );
    topFlange.position.y = topFlangeY;
    group.add(topFlange);

    const web = new THREE.Mesh(
      new THREE.BoxGeometry(webThickness, webHeight, len),
      material.clone(),
    );
    web.position.y = webY;
    group.add(web);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(group, rollDeg);
    group.visible = active;
    return group;
  }

  function createLBeamSegmentMesh(start, end, style = null) {
    const dir = end.clone().sub(start);
    const planarDir = new THREE.Vector3(dir.x, 0, dir.z);
    const len = dir.length();
    if (len < 0.001) { return null; }

    const dims = normalizeBeamStyle('l_beam', style);
    const totalWidth = dims.beamWidthHorizontal;
    const totalHeight = dims.beamHeightVertical;
    const legThickness = dims.beamThickness;
    const rollDeg = Number(dims?.beamRollDeg) || 0;

    const material = createCreatStandardMaterial(BEAM_BASE_COLOR);
    const group = new THREE.Group();
    group.name = segmentName;

    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(legThickness, totalHeight, len),
      material.clone(),
    );
    vertical.position.x = -(totalWidth * 0.5) + (legThickness * 0.5);
    group.add(vertical);

    const horizontal = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth, legThickness, len),
      material.clone(),
    );
    horizontal.position.y = (totalHeight * 0.5) - (legThickness * 0.5);
    group.add(horizontal);

    const mid = start.clone().add(end).multiplyScalar(0.5);
    group.position.copy(mid);
    const yaw = Math.atan2(planarDir.x, planarDir.z);
    const planarLen = Math.max(1e-8, planarDir.length());
    const pitch = Math.atan2(dir.y, planarLen);
    group.rotation.set(-pitch, yaw, 0, 'YXZ');
    applyLocalZRoll(group, rollDeg);
    group.visible = active;
    return group;
  }

  function estimatePlaneNormalFromPoints(points) {
    const refs = Array.isArray(points) ? points.filter((p) => p?.isVector3) : [];
    if (refs.length < 3) { return new THREE.Vector3(0, 1, 0); }
    const centroid = refs.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / refs.length);
    let p0 = refs[0];
    let maxDist = -1;
    refs.forEach((p) => {
      const d = p.distanceToSquared(centroid);
      if (d > maxDist) {
        maxDist = d;
        p0 = p;
      }
    });
    let p1 = refs[0];
    maxDist = -1;
    refs.forEach((p) => {
      const d = p.distanceToSquared(p0);
      if (d > maxDist) {
        maxDist = d;
        p1 = p;
      }
    });
    let p2 = null;
    let maxArea = -1;
    refs.forEach((p) => {
      if (p === p0 || p === p1) { return; }
      const area = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p, p0)).lengthSq();
      if (area > maxArea) {
        maxArea = area;
        p2 = p;
      }
    });
    if (!p2 || maxArea <= 1e-12) { return new THREE.Vector3(0, 1, 0); }
    const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
    if (n.lengthSq() <= 1e-12) { return new THREE.Vector3(0, 1, 0); }
    return n.normalize();
  }

  function resolvePanelWallCorners(pointRefs) {
    const points = (Array.isArray(pointRefs) ? pointRefs : [])
      .map((mesh) => mesh?.position?.clone?.() || null)
      .filter(Boolean);
    if (points.length < 4) { return null; }

    const normal = estimatePlaneNormalFromPoints(points);
    const center = points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / points.length);

    // 分割方向が世界軸依存で暴れないよう、最遠点ペアを基準軸にする。
    let maxDist = -1;
    let pairA = points[0];
    let pairB = points[1];
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const d = points[i].distanceToSquared(points[j]);
        if (d > maxDist) {
          maxDist = d;
          pairA = points[i];
          pairB = points[j];
        }
      }
    }

    let axisH = pairB.clone().sub(pairA);
    axisH.sub(normal.clone().multiplyScalar(axisH.dot(normal)));
    if (axisH.lengthSq() <= 1e-8) {
      axisH = new THREE.Vector3(1, 0, 0).sub(normal.clone().multiplyScalar(normal.x));
    }
    if (axisH.lengthSq() <= 1e-8) {
      axisH = new THREE.Vector3(0, 0, 1).sub(normal.clone().multiplyScalar(normal.z));
    }
    axisH.normalize();
    const axisV = new THREE.Vector3().crossVectors(normal, axisH).normalize();

    const projected = points.map((p) => {
      const rel = p.clone().sub(center);
      return {
        p,
        h: rel.dot(axisH),
        v: rel.dot(axisV),
      };
    });
    const hVals = projected.map((s) => s.h);
    const vVals = projected.map((s) => s.v);
    const minH = Math.min(...hVals);
    const maxH = Math.max(...hVals);
    const minV = Math.min(...vVals);
    const maxV = Math.max(...vVals);
    const targets = [
      { h: minH, v: minV }, // bottom-left
      { h: maxH, v: minV }, // bottom-right
      { h: maxH, v: maxV }, // top-right
      { h: minH, v: maxV }, // top-left
    ];
    const used = new Set();
    const pickNearest = (target) => {
      let best = null;
      let bestDist = Infinity;
      projected.forEach((row, idx) => {
        if (used.has(idx)) { return; }
        const dh = row.h - target.h;
        const dv = row.v - target.v;
        const d = (dh * dh) + (dv * dv);
        if (d < bestDist) {
          bestDist = d;
          best = { row, idx };
        }
      });
      if (!best) { return null; }
      used.add(best.idx);
      return best.row.p.clone();
    };

    const bl = pickNearest(targets[0]);
    const br = pickNearest(targets[1]);
    const tr = pickNearest(targets[2]);
    const tl = pickNearest(targets[3]);
    if (!bl || !br || !tr || !tl) { return null; }

    const ordered = [bl, br, tr, tl];
    const orderedCenter = ordered
      .reduce((acc, p) => acc.add(p), new THREE.Vector3())
      .multiplyScalar(1 / ordered.length);
    const hv = ordered.map((p) => {
      const rel = p.clone().sub(orderedCenter);
      return { p, h: rel.dot(axisH), v: rel.dot(axisV), a: Math.atan2(rel.dot(axisV), rel.dot(axisH)) };
    });
    hv.sort((a, b) => a.a - b.a);
    let startIdx = 0;
    for (let i = 1; i < hv.length; i += 1) {
      const cur = hv[i];
      const best = hv[startIdx];
      if (cur.v < best.v - 1e-8 || (Math.abs(cur.v - best.v) <= 1e-8 && cur.h < best.h)) {
        startIdx = i;
      }
    }
    const rotated = hv.slice(startIdx).concat(hv.slice(0, startIdx));
    // 回転方向を固定して bl->br->tr->tl を保証。
    if (rotated[1].h < rotated[3].h) {
      const start = rotated[0];
      const rev = [start, rotated[3], rotated[2], rotated[1]];
      rotated.splice(0, rotated.length, ...rev);
    }
    let stableBl = rotated[0].p.clone();
    let stableBr = rotated[1].p.clone();
    let stableTr = rotated[2].p.clone();
    let stableTl = rotated[3].p.clone();

    // 分割線を縦向きに出すため、bl->br を「水平寄り(=Y変化が小さい)辺」に寄せる。
    const widthDY = Math.abs(stableBr.y - stableBl.y);
    const heightDY = Math.abs(stableTl.y - stableBl.y);
    if (widthDY > heightDY) {
      const nextBr = stableTl;
      const nextTr = stableTr;
      const nextTl = stableBr;
      stableBr = nextBr;
      stableTr = nextTr;
      stableTl = nextTl;
    }

    const spanBottom = stableBl.distanceTo(stableBr);
    const spanTop = stableTl.distanceTo(stableTr);
    if (spanBottom <= 1e-5 || spanTop <= 1e-5) { return null; }
    return { bl: stableBl, br: stableBr, tr: stableTr, tl: stableTl, normal };
  }

  function pushQuad(positions, a, b, c, d, flip = false) {
    if (!flip) {
      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z,
      );
      return;
    }
    positions.push(
      a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z,
      a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z,
    );
  }

  function createPanelWallMeshFromPoints(pointRefs, style = null) {
    const refs = Array.isArray(pointRefs) ? pointRefs.filter((item) => item?.userData?.steelFramePoint) : [];
    if (refs.length < 4) { return null; }
    const corners = resolvePanelWallCorners(refs);
    if (!corners) { return null; }
    const dims = normalizeBeamStyle('panel_wall', style);
    const ordered = [corners.bl.clone(), corners.br.clone(), corners.tr.clone(), corners.tl.clone()];
    const color = 0xf4f6f8;
    const thickness = Math.max(0.005, Number(dims?.beamThickness) || Number(dims?.beamWidthHorizontal) || 0.06);
    const panelTargetLength = Math.max(0.1, Number(dims?.beamWidthHorizontal) || Number(dims?.beamHeightVertical) || 2.2);

    const normal = ordered[1].clone().sub(ordered[0]).cross(ordered[2].clone().sub(ordered[0]));
    if (!Number.isFinite(normal.x) || normal.lengthSq() < 1e-10) { return null; }
    normal.normalize();

    const upProjectedRaw = new THREE.Vector3(0, 1, 0).projectOnPlane(normal);
    let verticalAxis = upProjectedRaw.lengthSq() > 1e-8 ? upProjectedRaw.normalize() : upProjectedRaw;
    if (!Number.isFinite(verticalAxis.x) || verticalAxis.lengthSq() < 1e-8) {
      const edgeA = ordered[1].clone().sub(ordered[0]);
      const edgeB = ordered[2].clone().sub(ordered[1]);
      const fallbackEdge = Math.abs(edgeA.y) >= Math.abs(edgeB.y) ? edgeA : edgeB;
      const projected = fallbackEdge.projectOnPlane(normal);
      verticalAxis = projected.lengthSq() > 1e-8 ? projected.normalize() : projected;
    }
    if (!Number.isFinite(verticalAxis.x) || verticalAxis.lengthSq() < 1e-8) {
      verticalAxis = ordered[1].clone().sub(ordered[0]).normalize();
    }
    if (!Number.isFinite(verticalAxis.x) || verticalAxis.lengthSq() < 1e-8) { return null; }
    const horizontalAxis = new THREE.Vector3().crossVectors(normal, verticalAxis);
    if (!Number.isFinite(horizontalAxis.x) || horizontalAxis.lengthSq() < 1e-8) { return null; }
    horizontalAxis.normalize();

    const scored = ordered.map((p) => ({
      p,
      v: p.dot(verticalAxis),
      h: p.dot(horizontalAxis),
    }));
    scored.sort((a, b) => a.v - b.v);
    const bottomPair = [scored[0], scored[1]].sort((a, b) => a.h - b.h);
    const topPair = [scored[2], scored[3]].sort((a, b) => a.h - b.h);
    const bottomLeft = bottomPair[0].p.clone();
    const bottomRight = bottomPair[1].p.clone();
    const topLeft = topPair[0].p.clone();
    const topRight = topPair[1].p.clone();

    const wBottom = bottomRight.clone().sub(bottomLeft).length();
    const wTop = topRight.clone().sub(topLeft).length();
    const wallWidth = Math.max(0.001, (wBottom + wTop) * 0.5);
    const panelCount = Math.max(1, Math.round(wallWidth / panelTargetLength));
    const tStep = 1 / panelCount;
    const half = normal.clone().multiplyScalar(thickness * 0.5);

    const positions = [];
    const indices = [];
    const appendPanelPrism = (bl, br, tr, tl) => {
      const front = [bl.clone().add(half), br.clone().add(half), tr.clone().add(half), tl.clone().add(half)];
      const back = [bl.clone().sub(half), br.clone().sub(half), tr.clone().sub(half), tl.clone().sub(half)];
      const base = positions.length / 3;
      [...front, ...back].forEach((p) => positions.push(p.x, p.y, p.z));
      indices.push(
        base + 0, base + 1, base + 2, base + 0, base + 2, base + 3,
        base + 7, base + 6, base + 5, base + 7, base + 5, base + 4,
        base + 0, base + 4, base + 5, base + 0, base + 5, base + 1,
        base + 1, base + 5, base + 6, base + 1, base + 6, base + 2,
        base + 2, base + 6, base + 7, base + 2, base + 7, base + 3,
        base + 3, base + 7, base + 4, base + 3, base + 4, base + 0,
      );
    };

    for (let i = 0; i < panelCount; i += 1) {
      const t0 = tStep * i;
      const t1 = tStep * (i + 1);
      const bl = bottomLeft.clone().lerp(bottomRight, t0);
      const br = bottomLeft.clone().lerp(bottomRight, t1);
      const tr = topLeft.clone().lerp(topRight, t1);
      const tl = topLeft.clone().lerp(topRight, t0);
      appendPanelPrism(bl, br, tr, tl);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.clearGroups();
    for (let i = 0; i < panelCount; i += 1) {
      geometry.addGroup(i * 36, 36, i % 2);
    }
    geometry.computeVertexNormals();

    const materialA = createCreatStandardMaterial(color);
    materialA.metalness = 0.22;
    materialA.roughness = 0.2;
    materialA.envMapIntensity = 1.35;
    const materialB = materialA.clone();
    const mesh = new THREE.Mesh(geometry, [materialA, materialB]);
    mesh.name = segmentName;
    mesh.userData = {
      ...(mesh.userData || {}),
      panelWallPanelCount: panelCount,
    };
    mesh.visible = active;
    return mesh;
  }

  function createSegmentMesh(start, end, { profile = segmentProfile, style = null } = {}) {
    if (profile === 'tube') {
      // 2点指定時は直線バーとして扱う（多点時の補間は createSegmentsFromPoints 側で生成）。
      return createRoundBarSegmentMesh(start, end, style);
    }
    if (profile === 'rect_tube') {
      // 2点指定時は直線角材として扱う（多点時の補間は createSegmentsFromPoints 側で生成）。
      return createRectBarSegmentMesh(start, end, style);
    }
    if (profile === 'tubular') {
      return createTubularLightSegmentMesh(start, end, style);
    }
    if (profile === 'rect_bar') {
      return createRectBarSegmentMesh(start, end, style);
    }
    if (profile === 'truss_column') {
      return createTrussColumnSegmentMesh(start, end, style);
    }
    if (profile === 'truss_ladder') {
      return createLadderTrussSegmentMesh(start, end, style);
    }
    if (profile === 'truss_catenary') {
      return createCatenaryTrussColumnSegmentMesh(start, end, style);
    }
    if (profile === 'corrugated_bar') {
      return createCorrugatedBarSegmentMesh(start, end, style);
    }
    if (profile === 'h_beam') {
      return createHBeamSegmentMesh(start, end, style);
    }
    if (profile === 't_beam') {
      return createTBeamSegmentMesh(start, end, style);
    }
    if (profile === 'l_beam') {
      return createLBeamSegmentMesh(start, end, style);
    }
    if (profile === 'panel_wall') {
      // 2点指定のみの場合は最低限の板として扱う（本来は4点面生成）。
      return createRectBarSegmentMesh(start, end, {
        beamWidthHorizontal: 0.004,
        beamHeightVertical: (Number(style?.beamHeightVertical) || 2.2),
        beamThickness: 0,
      });
    }
    return createRoundBarSegmentMesh(start, end, style);
  }

  function createSegmentMeshWithProfile(start, end, profile, style = null) {
    const prevProfile = segmentProfile;
    setSegmentProfile(profile);
    const mesh = createSegmentMesh(start, end, { profile, style });
    segmentProfile = prevProfile;
    return mesh;
  }

  function replaceSegmentMesh(srcMesh, rebuiltMesh, index) {
    if (!rebuiltMesh) { return false; }
    rebuiltMesh.userData = {
      ...(srcMesh?.userData || {}),
    };
    applySegmentVisualState(rebuiltMesh);
    rebuiltMesh.visible = srcMesh?.visible ?? (active && generated);
    scene.add(rebuiltMesh);
    if (srcMesh?.parent) {
      srcMesh.parent.remove(srcMesh);
    }
    disposeObject3D(srcMesh);
    segmentMeshes[index] = rebuiltMesh;
    return true;
  }

  function createSegmentsFromPoints(points) {
    const created = [];
    if (!Array.isArray(points) || points.length < 2) { return created; }
    if (segmentProfile === 'tube') {
      const pointRefs = points.filter((item) => item?.userData?.steelFramePoint);
      if (pointRefs.length < 2) { return created; }
      const segmentStyle = normalizeBeamStyle(segmentProfile, null);
      const mesh = createInterpolatedTubeSegmentMesh(pointRefs, segmentStyle);
      if (!mesh) { return created; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentPointRefs: pointRefs,
        steelFrameSegmentProfile: segmentProfile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(segmentStyle),
      };
      scene.add(mesh);
      segmentMeshes.push(mesh);
      created.push(mesh);
      return created;
    }
    if (segmentProfile === 'rect_tube') {
      const pointRefs = points.filter((item) => item?.userData?.steelFramePoint);
      if (pointRefs.length < 2) { return created; }
      const segmentStyle = normalizeBeamStyle(segmentProfile, null);
      const mesh = createInterpolatedRectTubeSegmentMesh(pointRefs, segmentStyle);
      if (!mesh) { return created; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentPointRefs: pointRefs,
        steelFrameSegmentProfile: segmentProfile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(segmentStyle),
      };
      scene.add(mesh);
      segmentMeshes.push(mesh);
      created.push(mesh);
      return created;
    }
    if (segmentProfile === 'panel_wall') {
      const pointRefs = points.filter((item) => item?.userData?.steelFramePoint);
      if (pointRefs.length < 4) { return created; }
      const segmentStyle = normalizeBeamStyle(segmentProfile, null);
      const mesh = createPanelWallMeshFromPoints(pointRefs, segmentStyle);
      if (!mesh) { return created; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentPointRefs: pointRefs,
        steelFrameSegmentProfile: segmentProfile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(segmentStyle),
      };
      scene.add(mesh);
      segmentMeshes.push(mesh);
      created.push(mesh);
      return created;
    }
    for (let i = 0; i < points.length - 1; i++) {
      const startMesh = points[i];
      const endMesh = points[i + 1];
      const start = startMesh?.position;
      const end = endMesh?.position;
      if (!start || !end) { continue; }
      const segmentStyle = normalizeBeamStyle(segmentProfile, null);
      const mesh = createSegmentMesh(start, end, { profile: segmentProfile, style: segmentStyle });
      if (!mesh) { continue; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentPointRefs: [startMesh, endMesh].filter((item) => item?.userData?.steelFramePoint),
        steelFrameSegmentProfile: segmentProfile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(segmentStyle),
      };
      scene.add(mesh);
      segmentMeshes.push(mesh);
      created.push(mesh);
    }
    return created;
  }

  function rebuildSegmentsFromPoints() {
    if (!Array.isArray(segmentMeshes) || segmentMeshes.length < 1) { return 0; }
    let rebuilt = 0;
    const nextMeshes = [];
    const prevMeshes = [...segmentMeshes];
    prevMeshes.forEach((srcMesh) => {
      const refs = Array.isArray(srcMesh?.userData?.steelFrameSegmentPointRefs)
        ? srcMesh.userData.steelFrameSegmentPointRefs
        : [];
      const profile = srcMesh?.userData?.steelFrameSegmentProfile || segmentProfile;
      const style = normalizeBeamStyle(profile, srcMesh?.userData?.steelFrameSegmentStyle || null);
      let rebuiltMesh = null;
      let nextRefs = refs.filter((item) => item?.userData?.steelFramePoint);
      if (profile === 'tube') {
        if (nextRefs.length < 2) {
          if (srcMesh?.parent) {
            srcMesh.parent.remove(srcMesh);
          }
          disposeObject3D(srcMesh);
          return;
        }
        rebuiltMesh = createInterpolatedTubeSegmentMesh(nextRefs, style);
      } else if (profile === 'rect_tube') {
        if (nextRefs.length < 2) {
          if (srcMesh?.parent) {
            srcMesh.parent.remove(srcMesh);
          }
          disposeObject3D(srcMesh);
          return;
        }
        rebuiltMesh = createInterpolatedRectTubeSegmentMesh(nextRefs, style);
      } else if (profile === 'panel_wall') {
        if (nextRefs.length < 4) {
          if (srcMesh?.parent) {
            srcMesh.parent.remove(srcMesh);
          }
          disposeObject3D(srcMesh);
          return;
        }
        rebuiltMesh = createPanelWallMeshFromPoints(nextRefs, style);
      } else {
        const startMesh = refs[0];
        const endMesh = refs[1];
        const start = startMesh?.position;
        const end = endMesh?.position;
        if (!start || !end) {
          if (srcMesh?.parent) {
            srcMesh.parent.remove(srcMesh);
          }
          disposeObject3D(srcMesh);
          return;
        }
        nextRefs = [startMesh, endMesh];
        rebuiltMesh = createSegmentMeshWithProfile(start, end, profile, style);
      }
      if (!rebuiltMesh) {
        if (srcMesh?.parent) {
          srcMesh.parent.remove(srcMesh);
        }
        disposeObject3D(srcMesh);
        return;
      }
      rebuiltMesh.userData = {
        ...(srcMesh.userData || {}),
        steelFrameSegmentPointRefs: nextRefs,
        steelFrameSegmentProfile: profile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(style),
      };
      rebuiltMesh.visible = srcMesh.visible;
      scene.add(rebuiltMesh);
      nextMeshes.push(rebuiltMesh);
      if (srcMesh?.parent) {
        srcMesh.parent.remove(srcMesh);
      }
      disposeObject3D(srcMesh);
      rebuilt += 1;
    });
    segmentMeshes.length = 0;
    nextMeshes.forEach((mesh) => segmentMeshes.push(mesh));
    setActive(active);
    return rebuilt;
  }

  function rebuildSegmentsForPoints(points) {
    if (!Array.isArray(points) || points.length < 1) { return 0; }
    if (!Array.isArray(segmentMeshes) || segmentMeshes.length < 1) { return 0; }
    const movedSet = new Set(points.filter((mesh) => mesh?.userData?.steelFramePoint));
    if (movedSet.size < 1) { return 0; }

    let rebuilt = 0;
    for (let i = 0; i < segmentMeshes.length; i += 1) {
      const srcMesh = segmentMeshes[i];
      const refs = Array.isArray(srcMesh?.userData?.steelFrameSegmentPointRefs)
        ? srcMesh.userData.steelFrameSegmentPointRefs
        : [];
      const profile = srcMesh?.userData?.steelFrameSegmentProfile || segmentProfile;
      const style = normalizeBeamStyle(profile, srcMesh?.userData?.steelFrameSegmentStyle || null);
      let rebuiltMesh = null;
      let nextRefs = refs.filter((item) => item?.userData?.steelFramePoint);
      if (profile === 'tube') {
        const hasMoved = nextRefs.some((pointMesh) => movedSet.has(pointMesh));
        if (!hasMoved || nextRefs.length < 2) { continue; }
        rebuiltMesh = createInterpolatedTubeSegmentMesh(nextRefs, style);
      } else if (profile === 'rect_tube') {
        const hasMoved = nextRefs.some((pointMesh) => movedSet.has(pointMesh));
        if (!hasMoved || nextRefs.length < 2) { continue; }
        rebuiltMesh = createInterpolatedRectTubeSegmentMesh(nextRefs, style);
      } else if (profile === 'panel_wall') {
        const hasMoved = nextRefs.some((pointMesh) => movedSet.has(pointMesh));
        if (!hasMoved || nextRefs.length < 4) { continue; }
        rebuiltMesh = createPanelWallMeshFromPoints(nextRefs, style);
      } else {
        const startMesh = refs[0];
        const endMesh = refs[1];
        if (!startMesh || !endMesh) { continue; }
        if (!movedSet.has(startMesh) && !movedSet.has(endMesh)) { continue; }
        const start = startMesh.position;
        const end = endMesh.position;
        if (!start || !end) { continue; }
        nextRefs = [startMesh, endMesh];
        rebuiltMesh = createSegmentMeshWithProfile(start, end, profile, style);
      }
      if (!rebuiltMesh) { continue; }
      rebuiltMesh.userData = {
        ...(srcMesh.userData || {}),
        steelFrameSegmentPointRefs: nextRefs,
        steelFrameSegmentProfile: profile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(style),
      };
      if (replaceSegmentMesh(srcMesh, rebuiltMesh, i)) {
        rebuilt += 1;
      }
    }
    if (rebuilt > 0) {
      setActive(active);
    }
    return rebuilt;
  }

  function setActive(next) {
    active = Boolean(next);
    lines.forEach((points) => {
      points.forEach((mesh) => {
        if (!mesh) { return; }
        mesh.visible = active;
      });
    });
    segmentMeshes.forEach((mesh) => {
      if (!mesh) { return; }
      mesh.visible = active;
    });
  }

  function setPointColor(mesh, color) {
    if (!mesh || !mesh.material) { return; }
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => {
        if (mat && mat.color) { mat.color.setHex(color); }
      });
      return;
    }
    if (mesh.material.color) {
      mesh.material.color.setHex(color);
    }
  }

  function setPointsFromTargets(targets) {
    rebuildSegmentsForPoints(targets);
  }

  function startNewLine() {
    const newLine = [];
    lines.push(newLine);
    currentLineIndex = lines.length - 1;
    return currentLineIndex;
  }

  function addPoint(point) {
    if (!allowPointAppend) {
      return null;
    }
    const currentPoints = lines[currentLineIndex];
    const mesh = new THREE.Mesh(cubeGeometry, cubeMaterial.clone());
    mesh.position.copy(point);
    mesh.scale.setScalar(createPointScale);
    mesh.userData = {
      ...(mesh.userData || {}),
      steelFramePoint: true,
      steelFrameLine: currentLineIndex,
      steelFrameCopied: Boolean(mesh?.userData?.steelFrameCopied),
    };
    if (segmentProfile === 'rect_tube') {
      const defaults = normalizeBeamStyle('rect_tube', null);
      mesh.userData[POINT_SECTION_STYLE_KEYS.width] = Number(defaults?.beamWidthHorizontal) || 0.28;
      mesh.userData[POINT_SECTION_STYLE_KEYS.height] = Number(defaults?.beamHeightVertical) || 0.28;
      mesh.userData[POINT_SECTION_STYLE_KEYS.radius] = Number(defaults?.beamThickness) || 0;
      mesh.userData[POINT_SECTION_STYLE_KEYS.roll] = Number(defaults?.beamRollDeg) || 0;
    }
    setPointColor(mesh, getDefaultPointColor(mesh));
    mesh.visible = active;
    scene.add(mesh);
    currentPoints.push(mesh);
    generated = false;
    return mesh;
  }

  function addExistingPoint(mesh, lineIndex = currentLineIndex) {
    if (!mesh) { return false; }
    const safeLine = Number.isInteger(lineIndex) && lineIndex >= 0 ? lineIndex : currentLineIndex;
    while (lines.length <= safeLine) {
      lines.push([]);
    }
    const points = lines[safeLine];
    if (!points.includes(mesh)) {
      points.push(mesh);
    }
    mesh.userData = {
      ...(mesh.userData || {}),
      steelFramePoint: true,
      steelFrameLine: safeLine,
      steelFrameCopied: Boolean(mesh?.userData?.steelFrameCopied),
    };
    if (!Number.isFinite(Number(mesh.userData?.[POINT_SECTION_STYLE_KEYS.width]))) {
      const defaults = normalizeBeamStyle('rect_tube', null);
      mesh.userData[POINT_SECTION_STYLE_KEYS.width] = Number(defaults?.beamWidthHorizontal) || 0.28;
      mesh.userData[POINT_SECTION_STYLE_KEYS.height] = Number(defaults?.beamHeightVertical) || 0.28;
      mesh.userData[POINT_SECTION_STYLE_KEYS.radius] = Number(defaults?.beamThickness) || 0;
      mesh.userData[POINT_SECTION_STYLE_KEYS.roll] = Number(defaults?.beamRollDeg) || 0;
    }
    if (mesh?.scale?.setScalar) {
      mesh.scale.setScalar(createPointScale);
    }
    setPointColor(mesh, isSelectedPoint(mesh) ? selectedPointColor : getDefaultPointColor(mesh));
    mesh.visible = active;
    if (!mesh.parent) {
      scene.add(mesh);
    }
    generated = false;
    return true;
  }

  function removePointMesh(mesh) {
    if (!mesh) { return false; }
    let removed = false;
    lines.forEach((points) => {
      const idx = points.indexOf(mesh);
      if (idx >= 0) {
        points.splice(idx, 1);
        removed = true;
      }
    });
    const selectedIdx = selectedPoints.indexOf(mesh);
    if (selectedIdx >= 0) {
      selectedPoints.splice(selectedIdx, 1);
    }
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    if (removed) {
      generated = false;
    }
    return removed;
  }

  function addExistingSegmentMesh(mesh) {
    if (!mesh) { return false; }
    if (!segmentMeshes.includes(mesh)) {
      segmentMeshes.push(mesh);
    }
    if (!mesh.parent) {
      scene.add(mesh);
    }
    applySegmentVisualState(mesh);
    mesh.visible = active;
    return true;
  }

  function createSegmentBetweenPoints(startMesh, endMesh, {
    profile = segmentProfile,
    style = null,
    userData = {},
  } = {}) {
    const start = startMesh?.position;
    const end = endMesh?.position;
    if (!start || !end) { return null; }
    const resolvedProfile = profile || segmentProfile;
    const resolvedStyle = normalizeBeamStyle(resolvedProfile, style);
    const mesh = createSegmentMeshWithProfile(start, end, resolvedProfile, resolvedStyle);
    if (!mesh) { return null; }
    mesh.userData = {
      ...(mesh.userData || {}),
      ...(userData || {}),
      steelFrameSegmentPointRefs: [startMesh, endMesh].filter((item) => item?.userData?.steelFramePoint),
      steelFrameSegmentProfile: resolvedProfile,
      steelFrameSegmentStyle: compactBeamStyleForStorage(resolvedStyle),
    };
    addExistingSegmentMesh(mesh);
    return mesh;
  }

  function removeExistingSegmentMesh(mesh) {
    if (!mesh) { return false; }
    const idx = segmentMeshes.indexOf(mesh);
    if (idx < 0) { return false; }
    segmentMeshes.splice(idx, 1);
    return true;
  }

  function getSegmentStyle(mesh) {
    if (!mesh || mesh.name !== segmentName) { return null; }
    const profile = mesh?.userData?.steelFrameSegmentProfile || null;
    const style = normalizeBeamStyle(profile, mesh?.userData?.steelFrameSegmentStyle || null);
    if (!style) { return null; }
    return {
      ...style,
      ...resolveBeamAppearance(style),
    };
  }

  function applySegmentStyle(meshes, stylePatch = {}) {
    const targets = Array.isArray(meshes) ? meshes : [];
    const unique = Array.from(new Set(targets.filter((mesh) => mesh?.name === segmentName)));
    if (unique.length < 1) {
      return { updated: 0, rebuilt: 0, points: [] };
    }
    const points = [];
    let updated = 0;
    unique.forEach((mesh) => {
      const profile = mesh?.userData?.steelFrameSegmentProfile || null;
      const current = normalizeBeamStyle(profile, mesh?.userData?.steelFrameSegmentStyle || null);
      if (!current) { return; }
      const next = normalizeBeamStyle(profile, {
        ...current,
        ...stylePatch,
      });
      if (!next) { return; }
      mesh.userData = {
        ...(mesh.userData || {}),
        steelFrameSegmentStyle: compactBeamStyleForStorage(next),
      };
      const refs = Array.isArray(mesh?.userData?.steelFrameSegmentPointRefs)
        ? mesh.userData.steelFrameSegmentPointRefs
        : [];
      refs.forEach((pointMesh) => {
        if (pointMesh?.userData?.steelFramePoint) {
          points.push(pointMesh);
        }
      });
      updated += 1;
    });
    const rebuildResult = rebuildSegmentsForMeshes(unique);
    const mapping = rebuildResult?.mapping instanceof Map ? rebuildResult.mapping : new Map();
    const nextMeshes = unique.map((mesh) => mapping.get(mesh) || mesh).filter(Boolean);
    return {
      updated,
      rebuilt: Number(rebuildResult?.rebuilt) || 0,
      meshes: nextMeshes,
      points: Array.from(new Set(points)),
    };
  }

  function rebuildSegmentsForMeshes(meshes) {
    const targets = Array.isArray(meshes) ? meshes : [];
    const unique = Array.from(new Set(targets.filter((mesh) => mesh?.name === segmentName)));
    let rebuilt = 0;
    const mapping = new Map();
    unique.forEach((srcMesh) => {
      const idx = segmentMeshes.indexOf(srcMesh);
      if (idx < 0) { return; }
      const refs = Array.isArray(srcMesh?.userData?.steelFrameSegmentPointRefs)
        ? srcMesh.userData.steelFrameSegmentPointRefs
        : [];
      const profile = srcMesh?.userData?.steelFrameSegmentProfile || segmentProfile;
      const style = normalizeBeamStyle(profile, srcMesh?.userData?.steelFrameSegmentStyle || null);
      let rebuiltMesh = null;
      let nextRefs = refs.filter((item) => item?.userData?.steelFramePoint);
      if (profile === 'tube') {
        if (nextRefs.length < 2) { return; }
        rebuiltMesh = createInterpolatedTubeSegmentMesh(nextRefs, style);
      } else if (profile === 'rect_tube') {
        if (nextRefs.length < 2) { return; }
        rebuiltMesh = createInterpolatedRectTubeSegmentMesh(nextRefs, style);
      } else if (profile === 'panel_wall') {
        if (nextRefs.length < 4) { return; }
        rebuiltMesh = createPanelWallMeshFromPoints(nextRefs, style);
      } else {
        const startMesh = refs[0];
        const endMesh = refs[1];
        const start = startMesh?.position;
        const end = endMesh?.position;
        if (!start || !end) { return; }
        nextRefs = [startMesh, endMesh];
        rebuiltMesh = createSegmentMeshWithProfile(start, end, profile, style);
      }
      if (!rebuiltMesh) { return; }
      rebuiltMesh.userData = {
        ...(srcMesh.userData || {}),
        steelFrameSegmentPointRefs: nextRefs,
        steelFrameSegmentProfile: profile,
        steelFrameSegmentStyle: compactBeamStyleForStorage(style),
      };
      if (replaceSegmentMesh(srcMesh, rebuiltMesh, idx)) {
        rebuilt += 1;
        mapping.set(srcMesh, rebuiltMesh);
      }
    });
    if (rebuilt > 0) {
      setActive(active);
    }
    return { rebuilt, mapping };
  }

  function clearSelection() {
    selectedPoints.forEach((mesh) => {
      if (!mesh?.userData?.steelFramePoint) { return; }
      setPointColor(mesh, getDefaultPointColor(mesh));
    });
    selectedPoints.length = 0;
  }

  function toggleSelectedPoint(mesh) {
    if (!mesh || !mesh.userData?.steelFramePoint) { return false; }
    const idx = selectedPoints.indexOf(mesh);
    if (idx >= 0) {
      selectedPoints.splice(idx, 1);
      setPointColor(mesh, getDefaultPointColor(mesh));
      return false;
    }
    selectedPoints.push(mesh);
    setPointColor(mesh, selectedPointColor);
    return true;
  }

  function appendSelectedPoint(mesh) {
    if (!mesh || !mesh.userData?.steelFramePoint) { return false; }
    const idx = selectedPoints.indexOf(mesh);
    if (idx >= 0) {
      selectedPoints.splice(idx, 1);
    }
    selectedPoints.push(mesh);
    setPointColor(mesh, selectedPointColor);
    return true;
  }

  function appendSelectionBreak() {
    if (selectedPoints.length === 0) { return false; }
    const last = selectedPoints[selectedPoints.length - 1];
    if (last === selectionBreakMarker) { return false; }
    selectedPoints.push(selectionBreakMarker);
    return true;
  }

  function isSelectedPoint(mesh) {
    return selectedPoints.includes(mesh);
  }

  function restorePointColor(mesh) {
    if (!mesh) { return; }
    setPointColor(mesh, isSelectedPoint(mesh) ? selectedPointColor : getDefaultPointColor(mesh));
  }

  function getAllPointMeshes() {
    const out = [];
    lines.forEach((points) => {
      points.forEach((mesh) => out.push(mesh));
    });
    return out;
  }

  function getSelectedPointMeshes() {
    return selectedPoints.filter((mesh) => mesh?.userData?.steelFramePoint);
  }

  function getSelectedPointOrder() {
    return getSelectedPointMeshes().map((mesh, idx) => ({
      order: idx + 1,
      id: mesh?.id ?? null,
      line: mesh?.userData?.steelFrameLine ?? null,
      x: mesh?.position?.x ?? null,
      y: mesh?.position?.y ?? null,
      z: mesh?.position?.z ?? null,
    }));
  }

  function getSelectedPointSequences() {
    const sequences = [];
    let current = [];
    selectedPoints.forEach((item) => {
      if (item === selectionBreakMarker) {
        if (current.length > 0) {
          sequences.push(current);
          current = [];
        }
        return;
      }
      if (item?.userData?.steelFramePoint) {
        current.push(item);
      }
    });
    if (current.length > 0) {
      sequences.push(current);
    }
    return sequences;
  }

  function generateSteelFrame() {
    let targetPoints = lines[currentLineIndex];
    if (getSelectedPointMeshes().length >= 2) {
      const selectedLine = [...selectedPoints];
      targetPoints = selectedLine;
    }
    const createdMeshes = createSegmentsFromPoints(targetPoints);
    if (createdMeshes.length === 0) {
      clearSelection();
      return null;
    }

    const pointSnapshot = targetPoints
      .filter((mesh) => mesh?.userData?.steelFramePoint)
      .map((mesh, idx) => ({
      order: idx + 1,
      id: mesh?.id ?? null,
      x: mesh?.position?.x ?? null,
      y: mesh?.position?.y ?? null,
      z: mesh?.position?.z ?? null,
      }));
    generatedRecords.push({
      id: generatedRecordId++,
      profile: segmentProfile,
      pointCount: pointSnapshot.length,
      points: pointSnapshot,
      meshCount: createdMeshes.length,
    });

    generated = true;
    setActive(active);
    clearSelection();
    return generatedRecords[generatedRecords.length - 1];
  }

  function getCurrentPointMeshes() {
    return lines[currentLineIndex];
  }

  function getSegmentMeshes() {
    return segmentMeshes.slice();
  }

  function setAllowPointAppend(next) {
    allowPointAppend = Boolean(next);
  }

  function setSegmentProfile(profile) {
    if (profile === 'h_beam') {
      segmentProfile = 'h_beam';
    } else if (profile === 't_beam') {
      segmentProfile = 't_beam';
    } else if (profile === 'l_beam') {
      segmentProfile = 'l_beam';
    } else if (profile === 'truss_column') {
      segmentProfile = 'truss_column';
    } else if (profile === 'truss_ladder') {
      segmentProfile = 'truss_ladder';
    } else if (profile === 'truss_catenary') {
      segmentProfile = 'truss_catenary';
    } else if (profile === 'rect_bar') {
      segmentProfile = 'rect_bar';
    } else if (profile === 'rect_tube') {
      segmentProfile = 'rect_tube';
    } else if (profile === 'corrugated_bar') {
      segmentProfile = 'corrugated_bar';
    } else if (profile === 'tubular') {
      segmentProfile = 'tubular';
    } else if (profile === 'tube') {
      segmentProfile = 'tube';
    } else if (profile === 'panel_wall') {
      segmentProfile = 'panel_wall';
    } else {
      segmentProfile = 'round';
    }
  }

  function getGeneratedRecords() {
    return generatedRecords;
  }

  function refreshSegmentMaterialStyles(meshes = null) {
    const targets = Array.isArray(meshes)
      ? meshes.filter((mesh) => mesh?.name === segmentName)
      : segmentMeshes.slice();
    targets.forEach((mesh) => applySegmentVisualState(mesh));
    return { updated: targets.length };
  }

  function setMaterialReferenceResolver(resolver = null, { refresh = true } = {}) {
    materialReferenceResolver = typeof resolver === 'function' ? resolver : null;
    if (refresh) {
      refreshSegmentMaterialStyles();
    }
  }

  return {
    addPoint,
    clearSelection,
    getAllPointMeshes,
    getSelectedPointMeshes,
    getCurrentPointMeshes,
    getSegmentMeshes,
    getGeneratedRecords,
    getPointMeshes: getCurrentPointMeshes,
    getSelectedPointOrder,
    getSelectedPointSequences,
    isSelectedPoint,
    restorePointColor,
    addExistingPoint,
    addExistingSegmentMesh,
    createSegmentBetweenPoints,
    removeExistingSegmentMesh,
    removePointMesh,
    setActive,
    setSegmentProfile,
    setPointsFromTargets,
    startNewLine,
    setAllowPointAppend,
    appendSelectedPoint,
    appendSelectionBreak,
    toggleSelectedPoint,
    generateSteelFrame,
    rebuildSegmentsFromPoints,
    rebuildSegmentsForPoints,
    rebuildSegmentsForMeshes,
    getSegmentStyle,
    getPointSectionStyle: getPointSectionStylePatch,
    applySegmentStyle,
    applyPointSectionStyle,
    refreshSegmentMaterialStyles,
    setMaterialReferenceResolver,
  };
}
