// functions.js

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const PILLAR_STEEL_COLOR = 0x5f6670;
const PILLAR_STEEL_METALNESS = 0.28;
const PILLAR_STEEL_ROUGHNESS = 0.72;

function updateInstancedObject({
  ins_obj = NaN,
  ins_idx = NaN,
  pos_x = NaN,
  pos_y = NaN,
  pos_z = NaN,
  rot_x = NaN,
  rot_y = NaN,
  rot_z = NaN,
  scale = NaN,
} = {}) {
  const dummy = new THREE.Object3D();
  if (!Number.isNaN(pos_x)) dummy.position.x = pos_x;
  if (!Number.isNaN(pos_y)) dummy.position.y = pos_y;
  if (!Number.isNaN(pos_z)) dummy.position.z = pos_z;
  if (!Number.isNaN(rot_x)) dummy.rotation.x = rot_x;
  if (!Number.isNaN(rot_y)) dummy.rotation.y = rot_y;
  if (!Number.isNaN(rot_z)) dummy.rotation.z = rot_z;
  if (!Number.isNaN(scale)) dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  ins_obj.setMatrixAt(ins_idx, dummy.matrix);
  ins_obj.instanceMatrix.needsUpdate = true;
}

export function createCatenaryTrussTower(height, {
  sideLength = 0.1,
  material = null,
} = {}) {
  const tower = new THREE.Group();
  const safeSide = Math.max(0.02, Number(sideLength) || 0.1);
  const rawHeight = Math.max(0, Number(height) || 0);
  const roundedHeight = rawHeight - (rawHeight % safeSide);
  tower.userData = {
    ...(tower.userData || {}),
    catenaryTrussHeight: roundedHeight,
    catenaryTrussSideLength: safeSide,
  };
  if (roundedHeight <= 0) { return tower; }

  const poleMaterial = material || new THREE.MeshStandardMaterial({
    color: PILLAR_STEEL_COLOR,
    metalness: PILLAR_STEEL_METALNESS,
    roughness: PILLAR_STEEL_ROUGHNESS,
    envMapIntensity: 1,
    side: THREE.FrontSide,
  });
  const boardRotation = 45 * Math.PI / 180;
  const rotationXLen = Math.sin(boardRotation) * safeSide * 0.8;
  const boardXLen = (safeSide / rotationXLen) * rotationXLen + rotationXLen;
  const boardGeometry = new THREE.BoxGeometry(boardXLen, 0.02, 0.01);
  const boardCount = Math.round(roundedHeight / safeSide) * 4;
  const board = new THREE.InstancedMesh(boardGeometry, poleMaterial, boardCount);

  for (let i = 0; i < roundedHeight / safeSide; i += 1) {
    const rotZ = i % 2 === 0 ? boardRotation : -boardRotation;
    updateInstancedObject({ ins_obj: board, ins_idx: i * 4, pos_x: 0, pos_y: safeSide * i + safeSide * 0.5, pos_z: safeSide * 0.5, rot_x: NaN, rot_y: 0, rot_z: rotZ, scale: NaN });
    updateInstancedObject({ ins_obj: board, ins_idx: i * 4 + 1, pos_x: safeSide * 0.5, pos_y: safeSide * i + safeSide * 0.5, pos_z: 0, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: rotZ, scale: NaN });
    updateInstancedObject({ ins_obj: board, ins_idx: i * 4 + 2, pos_x: 0, pos_y: safeSide * i + safeSide * 0.5, pos_z: -safeSide * 0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: rotZ, scale: NaN });
    updateInstancedObject({ ins_obj: board, ins_idx: i * 4 + 3, pos_x: -safeSide * 0.5, pos_y: safeSide * i + safeSide * 0.5, pos_z: 0, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: rotZ, scale: NaN });
  }

  const poleGeometry = new THREE.BoxGeometry(0.02, roundedHeight, 0.02);
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.set(safeSide * 0.5, roundedHeight * 0.5, safeSide * 0.5);
  tower.add(pole.clone());
  pole.position.set(safeSide * 0.5, roundedHeight * 0.5, -safeSide * 0.5);
  tower.add(pole.clone());
  pole.position.set(-safeSide * 0.5, roundedHeight * 0.5, safeSide * 0.5);
  tower.add(pole.clone());
  pole.position.set(-safeSide * 0.5, roundedHeight * 0.5, -safeSide * 0.5);
  tower.add(pole.clone());
  tower.add(board);
  return tower;
}

export class TrainSystem {
  constructor(scene, light) {
    this.scene = scene;
    this.light = light
    this.pillarDebugGroup = null;
  }

  ensurePillarDebugGroup() {
    if (this.pillarDebugGroup) { return this.pillarDebugGroup; }
    this.pillarDebugGroup = new THREE.Group();
    this.pillarDebugGroup.name = 'PillarDebugArrows';
    this.scene.add(this.pillarDebugGroup);
    return this.pillarDebugGroup;
  }

  clearPillarDebugArrows() {
    if (!this.pillarDebugGroup) { return; }
    while (this.pillarDebugGroup.children.length > 0) {
      const child = this.pillarDebugGroup.children.pop();
      if (child) {
        this.pillarDebugGroup.remove(child);
      }
    }
  }

  addPillarDebugArrows(origin, tangent, rightVec, length = 1) {
    const group = this.ensurePillarDebugGroup();
    const tangentDir = tangent.clone().setY(0);
    if (tangentDir.lengthSq() === 0) {
      tangentDir.set(0, 0, 1);
    } else {
      tangentDir.normalize();
    }
    const offsetDir = rightVec.clone().setY(0);
    if (offsetDir.lengthSq() === 0) {
      offsetDir.set(1, 0, 0);
    } else {
      offsetDir.normalize();
    }
    const up = new THREE.Vector3(0, 0.05, 0);
    const tangentArrow = new THREE.ArrowHelper(
      tangentDir,
      origin.clone().add(up),
      length,
      0x00ff00,
      0.2,
      0.1
    );
    const offsetArrow = new THREE.ArrowHelper(
      offsetDir,
      origin.clone().add(up),
      length,
      0x00aaff,
      0.2,
      0.1
    );
    group.add(tangentArrow);
    group.add(offsetArrow);
  }
  
  fitDirectionalLightShadowForObject(rootObj, light) {
    const box = new THREE.Box3().setFromObject(rootObj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
  
    const factor = 1.25;
    const halfWidth = Math.max(size.x, size.z) * factor * 0.5;
  
    light.target.position.copy(center);
    this.scene.add(light.target);
    light.target.updateMatrixWorld();
  
    light.shadow.camera.left = -halfWidth;
    light.shadow.camera.right =  halfWidth;
    light.shadow.camera.top =    halfWidth;
    light.shadow.camera.bottom = -halfWidth;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far  = Math.max(500, size.y * 10);
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.05;
    light.shadow.radius = 4;
    light.shadow.camera.updateProjectionMatrix();
    light.updateMatrixWorld();
  
  
  }
  
  Map_pin(x, z, y = 5, Thickness = 0.5, color = 0xff0000) {
    const height = 5
    const geometry = new THREE.BoxGeometry(Thickness, height - 2, Thickness);
    const material = new THREE.MeshStandardMaterial({ color: color });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(x, y, z);
    this.scene.add(pillar);
    return pillar;
  }


  //三角関数(ラジアンの方向可視化)
  getArrowSymbolFromAngle(deg,red) {
    if (red){
      const angle = (radian + 2 * Math.PI) % (2 * Math.PI); // 0〜2π に正規化
      deg = angle * (180 / Math.PI); // 度数に変換
    };
  
    if (deg >= 337.5 || deg < 22.5) return '↑'+deg;
    if (deg >= 22.5 && deg < 67.5) return '↗'+deg;
    if (deg >= 67.5 && deg < 112.5) return '→'+deg;
    if (deg >= 112.5 && deg < 157.5) return '↘'+deg;
    if (deg >= 157.5 && deg < 202.5) return '↓'+deg;
    if (deg >= 202.5 && deg < 247.5) return '↙'+deg;
    if (deg >= 247.5 && deg < 292.5) return '←'+deg;
    if (deg >= 292.5 && deg < 337.5) return '↖'+deg;
  }
  
  degToRad(deg) {
    return deg * (Math.PI / 180);
  }
  
  radToDeg(rad) {
    return rad * (180 / Math.PI);
  }
  
  vectorToDegreesXZ(vector) {
    let angleRad = Math.atan2(vector.x, vector.z); // Z前方基準
    let angleDeg = angleRad * (180 / Math.PI);
    return (angleDeg + 360) % 360; // 0〜360度に正規化
  }
    
  normalizeRad(rad) {
    return (rad % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  }
  
  getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }
  
  getPointByDistanceRatio(curvePoints, ratio) {
    const totalLength = curvePoints.length;
    const index = Math.floor(ratio * totalLength);
    return curvePoints[Math.min(index, totalLength - 1)];
  }

  getPointAtDistance(curve, distance) {
    const length = curve.getLength();
    if (length <= 0) { return curve.getPointAt(0); }
    const t = Math.min(Math.max(distance / length, 0), 1);
    return curve.getPointAt(t);
  }

  getDirectionAtDistance(curve, distance) {
    const length = curve.getLength();
    if (length <= 0) { return new THREE.Vector3(1, 0, 0); }
    const t = Math.min(Math.max(distance / length, 0), 1);
    const tangent = curve.getTangentAt(t).clone();
    tangent.y = 0;
    if (tangent.lengthSq() === 0) {
      tangent.set(1, 0, 0);
    } else {
      tangent.normalize();
    }
    return tangent;
  }

  getCurveSideByDirection(curveA, curveB, distance = 0.5) {
    const pointA = this.getPointAtDistance(curveA, distance);
    const direction = this.getDirectionAtDistance(curveA, distance);
    const pointB = this.getPointAtDistance(curveB, distance);
    const toB = pointB.clone().sub(pointA);
    toB.y = 0;
    const cross = (direction.x * toB.z) - (direction.z * toB.x);
    if (Math.abs(cross) < 1e-6) { return 'center'; }
    return cross > 0 ? 'left' : 'right';
  }

  findCurveRange(curve, targetA, targetB, { axis = 'z', resolution = 1000 } = {}) {
    const sampledPoints = curve.getPoints(resolution);
    const lastIndex = sampledPoints.length - 1;
  
    const isVectorLike = (value) =>
      value instanceof THREE.Vector3 ||
      (value && typeof value === 'object' && ('x' in value || 'y' in value || 'z' in value));
  
    const useVectorTargets = isVectorLike(targetA) && isVectorLike(targetB);
  
    const getComponent = (value, key) => {
      if (value instanceof THREE.Vector3) {
        return value[key];
      }
      if (value && typeof value === 'object' && key in value) {
        return value[key];
      }
      return undefined;
    };
  
    const hasAnyComponent = (value) => ['x', 'y', 'z'].some((key) => getComponent(value, key) !== undefined);
  
    const findNearestIndex = (target, searchStart = 0, searchEnd = lastIndex) => {
      const axisKey = axis === 'x' ? 'x' : axis === 'y' ? 'y' : 'z';
      let closestIndex = searchStart;
      let smallestMetric = Infinity;
  
      if (useVectorTargets) {
        if (!hasAnyComponent(target)) {
          return closestIndex;
        }
  
        for (let i = searchStart; i <= searchEnd; i++) {
          const point = sampledPoints[i];
          let metric = 0;
          let usedComponents = 0;
  
          ['x', 'y', 'z'].forEach((key) => {
            const component = getComponent(target, key);
            if (component !== undefined) {
              const diff = point[key] - component;
              metric += diff * diff;
              usedComponents += 1;
            }
          });
  
          if (usedComponents === 0) {
            continue;
          }
  
          if (metric < smallestMetric) {
            smallestMetric = metric;
            closestIndex = i;
          }
        }
      } else {
        for (let i = searchStart; i <= searchEnd; i++) {
          const diff = Math.abs(sampledPoints[i][axisKey] - target);
          if (diff < smallestMetric) {
            smallestMetric = diff;
            closestIndex = i;
          }
        }
      }
  
      return closestIndex;
    };
  
    let firstIndex = findNearestIndex(targetA);
    let secondIndex = findNearestIndex(targetB);
  
    if (!useVectorTargets) {
      if (targetA <= targetB && secondIndex < firstIndex) {
        secondIndex = findNearestIndex(targetB, firstIndex, lastIndex);
      } else if (targetA > targetB && secondIndex > firstIndex) {
        secondIndex = findNearestIndex(targetB, 0, firstIndex);
      }
    }
  
    let startIndex = Math.min(firstIndex, secondIndex);
    let endIndex = Math.max(firstIndex, secondIndex);
  
    if (startIndex === endIndex) {
      if (endIndex < lastIndex) {
        endIndex += 1;
      } else if (startIndex > 0) {
        startIndex -= 1;
      }
    }
  
    const slicePoints = sampledPoints
      .slice(startIndex, endIndex + 1)
      .map((point) => point.clone());
  
    const Range = {
      startIndex,
      endIndex,
      startRatio: startIndex / lastIndex,
      endRatio: endIndex / lastIndex,
      startPoint: sampledPoints[startIndex].clone(),
      endPoint: sampledPoints[endIndex].clone(),
      slicePoints,
      sliceCurve: slicePoints.length > 1 ? new THREE.CatmullRomCurve3(slicePoints) : null,
    };
    
    return Range.sliceCurve ?? sliceCurvePoints(curve, Range.startRatio, Range.endRatio);
  }
  
  sampleCurveCoordinates(curve, position, rotation, interval = 1) {
    const sampledPoints = this.getPointsEveryM(curve, interval);
    const obstacle = [];
    rotation = this.normalizeRad(rotation)
    
    let start_index = null

    for (let i = 0; i < sampledPoints.length; i++) {
    // for (let i = 0; i < 1; i++) {
      const point = sampledPoints[i];
      const diff_x = point.x - position.x;
      // const y = point.y;
      const diff_z = point.z - position.z;

      const angle = this.normalizeRad(Math.atan2(diff_x, diff_z)) - rotation;
      const range = Math.sqrt(diff_x**2 + diff_z**2)

      const organize_point_y = Math.abs(Math.sin(angle) * range)
      const organize_point_x = Math.abs(Math.cos(angle) * range)

      if (organize_point_y <= 2 && organize_point_x <= 3){
        if (start_index === null){start_index = i}
        // coordinates.push({ x, y, z });
      } else if (start_index != null){
        const obstacle_range = this.getPointsEveryM(this.findCurveRange(curve, sampledPoints[start_index], sampledPoints[i-1]), 0.1)
        let min_point = null
        let min_distance = 2
        let min_index = null
    
        for (let detail_i = 0; detail_i < obstacle_range.length; detail_i++) {
          const point = obstacle_range[detail_i];
          const diff_x = point.x - position.x;
          // const y = point.y;
          const diff_z = point.z - position.z;
    
          const angle = this.normalizeRad(Math.atan2(diff_x, diff_z)) - rotation;
          const range = Math.sqrt(diff_x**2 + diff_z**2)
    
          const organize_point_y = Math.abs(Math.sin(angle) * range)
          const organize_point_x = Math.cos(angle) * range

          if (organize_point_y < min_distance){
            min_distance = organize_point_y
            min_point = point
            min_index = detail_i
          };
        }

        const now = sampledPoints[start_index]
        const next = sampledPoints[i-1]

        start_index = null

        const obstacle_angle = rotation - this.normalizeRad(Math.atan2(now.x - next.x, now.z - next.z))

        // 線路の幅(1)
        // const 0.5 / Math.cos(obstacle_angle)
        const obstacle_len = Math.sqrt(((Math.cos(obstacle_angle)/0.5) * Math.sin(obstacle_angle))**2 + 1)

        if (min_point != null){
          // console.log(min_point, obstacle_len, obstacle_angle)
          // console.log(Math.sqrt(((1 / Math.sin(obstacle_angle)) * Math.cos(obstacle_angle))**2 + 1))
          
          // console.log(min_point.x+Math.sin(rotation)*obstacle_len,min_point.z+Math.cos(rotation)*obstacle_len,min_point.y)
          // // this.Map_pin(min_point.x+Math.sin(rotation)*obstacle_len,min_point.z+Math.cos(rotation)*obstacle_len,min_point.y)
         this.createBridgePillar(min_point.x+Math.sin(rotation)*obstacle_len, min_point.z+Math.cos(rotation)*obstacle_len, position.y);
         min_point.x = min_point.x+Math.sin(rotation)*obstacle_len
         min_point.z = min_point.z+Math.cos(rotation)*obstacle_len
         
         // const avoid_point = {
          //   x: min_point.x+Math.sin(rotation)*obstacle_len,
          //   y: position.y-0.3,
          //   z: min_point.z+Math.cos(rotation)*obstacle_len
          // }
          // const point = {
          //   x: position.x,
          //   y: position.y-0.3,
          //   z: position.z
          // }
          // this.scene.add(this.createBoxBetweenPoints3D(point,avoid_point,0.7,0.7))


          if (obstacle.length === 0){
            obstacle.push(min_point)
          } else {
            for (let i = 0; i < obstacle.length; i++){
              if (i === obstacle.length-1){
                obstacle.push(min_point)
                break;
              }
              const point = obstacle[i];
              const diff_x = point.x - position.x;
              const diff_z = point.z - position.z;
    
              const range = Math.sqrt(diff_x**2 + diff_z**2)

              if (range >= min_distance){
                obstacle.splice(i, 0, min_point);
                break;
              }
            }
          }
      }
      }
      
    }

    return obstacle;
  }
  
  createDebugSphere(position, radius = 0.1, color = 0xff0000) {
    const geometry = new THREE.SphereGeometry(radius, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(position.x, position.y, position.z);
    this.scene.add(sphere);
    return sphere;  // 必要なら戻り値でMeshを返す
  }
  
  // 線路表示
  createTrack(curve, pointy ,color = 0x000000, name=false) {
    const normalizedName = typeof name === 'string' ? name : '';
    const isGreenHelperLine = Number(color) === 0x00ff00 && (
      normalizedName === 'Rail'
      || normalizedName.startsWith('GuideRail_')
      || normalizedName.includes('RailSelectionLine')
    );
    if (isGreenHelperLine) {
      return null;
    }
    const points = curve.getPoints(100);
    // すべての点にY座標を追加 or 修正（例：Y=1.5）
    for (let i = 0; i < points.length; i++) {
      points[i].y += pointy;
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(geom, mat);
    if (name != false){
      line.name = name
    }
    this.scene.add(line);
    return line;
  }  

  //---- 軌道調整 ----

  // 線路から均等に空ける関数
  RailMargin(points, margin, angle=false){
    const edit_points = structuredClone(points); // 深いコピーを作る（破壊防止）
    const angles_y = []
  
    for (let i = 0; i < points.length; i++){
      const rear = i > 0 ? points[i - 1] : points[i];
      const now = points[i];
      const next = i < points.length-1 ? points[i + 1] : points[i];
  
      let rear_atan2 = this.normalizeRad(Math.atan2(now.x - rear.x, now.z - rear.z));
      let next_atan2 = this.normalizeRad(Math.atan2(now.x - next.x, now.z - next.z));
      if (i === 0){
        rear_atan2 = next_atan2 + 180 * Math.PI / 180;
      } else if (i === points.length-1){
        next_atan2 = rear_atan2 + 180 * Math.PI / 180;
      }
  
      let whole = next_atan2 - rear_atan2;
      if (whole < 0) whole += Math.PI * 2;
  
      const diff = rear_atan2 + whole * 0.5;
  
      edit_points[i].x = now.x - Math.sin(diff) * margin;
      edit_points[i].z = now.z - Math.cos(diff) * margin;
      
      angles_y.push(diff)
    }
    if (angle){return [edit_points,angles_y]}else{return edit_points}
  }

  // 線路の座標を指定されたmで均等に分ける為の関数
  getPointsEveryM(curve, interval = 25) {
    const length = curve.getLength();
    const points = [];
  
    // 等間隔の精度向上（必要に応じて増やす）
    curve.arcLengthDivisions = Math.max(200, Math.ceil(length / interval) * 10);
  
    // 距離 s を 0..length で刻む
    for (let s = 0; s <= length; s += interval) {
      const u = s / length;                 // u は 0..1
      points.push(curve.getPointAt(u).clone());
    }
  
    // 終点 (u=1) を必ず追加（重複チェック）
    const end = curve.getPointAt(1);
    const last = points[points.length - 1];
    if (!last || last.distanceTo(end) > 1e-6) {
      points.push(end.clone());
    }
  
    return points;
  }  // --- 角度計算 ---
  
  // 縦方向の角度を求める関数
  getVerticalAngle(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
  
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalAngle = Math.atan2(dy, horizontalDistance);  // ラジアン
  
    return verticalAngle;
  }
  
  scaleVectors(vectors, scale = 1.0) {
    return vectors.map(([x, y]) => [x * scale, y * scale]);
  }
  
  // --- 物体操作 ----
  object_update({
    ins_obj = NaN,
    ins_idx = NaN,
    pos_x = NaN,
    pos_y = NaN,
    pos_z = NaN,
    rot_x = NaN,
    rot_y = NaN,
    rot_z = NaN,
    scale = NaN} = {}) {
      
      const dummy = new THREE.Object3D();
      // 位置の更新
      if (!Number.isNaN(pos_x)) dummy.position.x = pos_x;
      if (!Number.isNaN(pos_y)) dummy.position.y = pos_y;
      if (!Number.isNaN(pos_z)) dummy.position.z = pos_z;
  
      // 回転の更新
      if (!Number.isNaN(rot_x)) dummy.rotation.x = rot_x;
      if (!Number.isNaN(rot_y)) dummy.rotation.y = rot_y;
      if (!Number.isNaN(rot_z)) dummy.rotation.z = rot_z;
  
      // スケールの更新
      if (!Number.isNaN(scale)) dummy.scale.setScalar(scale);
  
      dummy.updateMatrix();                       // 行列計算更新
      ins_obj.setMatrixAt(ins_idx, dummy.matrix); // i番目のインスタンスに行列を適用
      ins_obj.instanceMatrix.needsUpdate = true;  // 更新フラグ
    }  

  //物体を生成する補助関数
  createBoxBetweenPoints3D(p1, p2, thickness, depth, material = new THREE.MeshStandardMaterial({//color: 0x3399cc 
    color: PILLAR_STEEL_COLOR,
    metalness: PILLAR_STEEL_METALNESS,
    roughness: PILLAR_STEEL_ROUGHNESS,
    // envMapIntensity: 1.0,    // 環境マップの反射強度（envMapを使うなら）
    side: THREE.FrontSide,
  })
) {
    const dir = new THREE.Vector3().subVectors(p2, p1); // 方向ベクトル
    const length = dir.length(); // 距離（ボックスの長さ）
    const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5); // 中心点
    
    const geometry = new THREE.BoxGeometry(length, thickness, depth);
    const mesh = new THREE.Mesh(geometry, material);
    
    // デフォルトのボックスはX軸方向に長い → 回転してdir方向に合わせる
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    mesh.quaternion.copy(quaternion);
    
    mesh.position.copy(center);
    return mesh;
    }

  setShadowRecursive(object3d, cast = true, receive = true) {
    if (!object3d) { return; }
    object3d.traverse((node) => {
      if (!node?.isMesh) { return; }
      node.castShadow = cast;
      node.receiveShadow = receive;
    });
  }

  createDoubleArcBridge(params1, params2, { bridgeDepth = 3 } = {}) {
    const bridge = new THREE.Group();
    const bridgeBeam = new THREE.Group();

    const rangeRad1 = (params1.rangeDeg * Math.PI) / 180;
    const segments1 = params1.stepDeg;
    const halfRangeX1 = params1.radius * Math.sin(rangeRad1 / 2);
    const xStart1 = -halfRangeX1;
    const xEnd1 = halfRangeX1;
    const stepX1 = (xEnd1 - xStart1) / segments1;

    const rangeRad2 = (params2.rangeDeg * Math.PI) / 180;
    const segments2 = params2.stepDeg;
    const halfRangeX2 = params2.radius * Math.sin(rangeRad2 / 2);
    const xStart2 = -halfRangeX2;
    const xEnd2 = halfRangeX2;
    const stepX2 = (xEnd2 - xStart2) / segments2;

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.8,
      roughness: 0.5,
      envMapIntensity: 1.0,
      side: THREE.FrontSide,
    });

    const x1 = xStart1 + (1 * stepX1);
    const y1 = Math.sqrt(params1.radius ** 2 - x1 ** 2) + params1.centerOffset.y;
    const x2 = xStart1 + (2 * stepX1);

    const x1b = xStart2 + (1 * stepX2);
    const y1b = Math.sqrt(params2.radius ** 2 - x1b ** 2) + params2.centerOffset.y;

    const x2b = xStart2 + (2 * stepX2);
    const y2b = Math.sqrt(params2.radius ** 2 - x2b ** 2) + params2.centerOffset.y;

    const beamX = x2;
    const beamY = y2b;

    bridge.add(this.createBoxBetweenPoints3D(
      new THREE.Vector3(x1, y1, 0),
      new THREE.Vector3(x1, y1b, 0),
      0.3, 0.3, material
    ));

    for (let i = 1; i < Math.max(segments1, segments2) - 1; i += 1) {
      const px1 = xStart1 + (i * stepX1);
      const py1 = Math.sqrt(params1.radius ** 2 - px1 ** 2) + params1.centerOffset.y;
      const px2 = xStart1 + ((i + 1) * stepX1);
      const py2 = Math.sqrt(params1.radius ** 2 - px2 ** 2) + params1.centerOffset.y;

      bridge.add(this.createBoxBetweenPoints3D(
        new THREE.Vector3(px2, py2, 0),
        new THREE.Vector3(px1, py1, 0),
        0.3, 0.3, material
      ));

      const px1b = xStart2 + (i * stepX2);
      const py1b = Math.sqrt(params2.radius ** 2 - px1b ** 2) + params2.centerOffset.y;
      const px2b = xStart2 + ((i + 1) * stepX2);
      const py2b = Math.sqrt(params2.radius ** 2 - px2b ** 2) + params2.centerOffset.y;

      bridge.add(this.createBoxBetweenPoints3D(
        new THREE.Vector3(px1, py1b, 0),
        new THREE.Vector3(px2, py2b, 0),
        0.3, 0.3, material
      ));

      if (i < (Math.max(segments1, segments2) - 1) / 2) {
        bridge.add(this.createBoxBetweenPoints3D(
          new THREE.Vector3(px1, py1, 0),
          new THREE.Vector3(px2, py2b, 0),
          0.2, 0.2, material
        ));
        if (i > 2) {
          bridgeBeam.add(this.createBoxBetweenPoints3D(
            new THREE.Vector3(px1, py1, 0),
            new THREE.Vector3(px2, py2, bridgeDepth * 0.5),
            0.1, 0.1, material
          ));
          bridgeBeam.add(this.createBoxBetweenPoints3D(
            new THREE.Vector3(px1, py1, bridgeDepth),
            new THREE.Vector3(px2, py2, bridgeDepth * 0.5),
            0.1, 0.1, material
          ));
        }
      } else {
        bridge.add(this.createBoxBetweenPoints3D(
          new THREE.Vector3(px2, py2, 0),
          new THREE.Vector3(px1, py1b, 0),
          0.2, 0.2, material
        ));
        if (i < Math.max(segments1, segments2) - 3) {
          bridgeBeam.add(this.createBoxBetweenPoints3D(
            new THREE.Vector3(px1, py1, bridgeDepth * 0.5),
            new THREE.Vector3(px2, py2, 0),
            0.1, 0.1, material
          ));
          bridgeBeam.add(this.createBoxBetweenPoints3D(
            new THREE.Vector3(px1, py1, bridgeDepth * 0.5),
            new THREE.Vector3(px2, py2, bridgeDepth),
            0.1, 0.1, material
          ));
        }
      }

      bridge.add(this.createBoxBetweenPoints3D(
        new THREE.Vector3(px2, py2, 0),
        new THREE.Vector3(px2, py2b, 0),
        0.2, 0.2, material
      ));

      if (i > 2 && i < Math.max(segments1, segments2) - 3) {
        bridgeBeam.add(this.createBoxBetweenPoints3D(
          new THREE.Vector3(px1, py1, bridgeDepth),
          new THREE.Vector3(px1, py1, 0),
          0.1, 0.1, material
        ));
      }

      bridge.add(this.createBoxBetweenPoints3D(
        new THREE.Vector3(px2, py2, 0),
        new THREE.Vector3(px2, beamY, 0),
        0.2, 0.2, material
      ));

      if (i === Math.max(segments1, segments2) - 4) {
        bridgeBeam.add(this.createBoxBetweenPoints3D(
          new THREE.Vector3(px2, py2, bridgeDepth),
          new THREE.Vector3(px2, py2, 0),
          0.2, 0.2, material
        ));
      }

      if (i === Math.max(segments1, segments2) - 2) {
        bridge.add(this.createBoxBetweenPoints3D(
          new THREE.Vector3(beamX, beamY, 0),
          new THREE.Vector3(px1, py1b, 0),
          0.3, 0.3, material
        ));
      }
    }

    const bridge2 = bridge.clone();
    bridge2.position.z += bridgeDepth;
    const archBridge = new THREE.Group();
    archBridge.add(bridge);
    archBridge.add(bridge2);
    archBridge.add(bridgeBeam);
    return archBridge;
  }

  createDefaultArchBridge({
    position = new THREE.Vector3(-4.25, -17.8, -117),
    rotationY = 1.750662913747207,
    addToScene = true,
    castShadow = true,
    receiveShadow = true,
  } = {}) {
    const arcA = {
      radius: 29,
      rangeDeg: 65,
      stepDeg: 16,
      thickness: 0.4,
      depth: 0.5,
      color: 0x996633,
      centerOffset: new THREE.Vector3(5, 0, 0),
      rotationOffset: 90 * Math.PI / 180,
    };

    const arcB = {
      radius: 25.2,
      rangeDeg: 85,
      stepDeg: 16,
      thickness: 0.4,
      depth: 0.5,
      color: 0x336699,
      centerOffset: new THREE.Vector3(5, 3, 0),
      rotationOffset: 90 * Math.PI / 180,
    };

    const archBridge = this.createDoubleArcBridge(arcA, arcB);
    archBridge.position.copy(position);
    archBridge.rotation.y = rotationY;
    this.setShadowRecursive(archBridge, castShadow, receiveShadow);
    if (addToScene) {
      this.scene.add(archBridge);
    }
    return archBridge;
  }

  // --- 鉄橋用ユーティリティ ---
  // 柱
  createBridgePillar(x, z, height = 5) {
    const geometry = new THREE.BoxGeometry(0.7, height, 0.35);
    const material = new THREE.MeshStandardMaterial({ 
      color: PILLAR_STEEL_COLOR,
      metalness: PILLAR_STEEL_METALNESS,
      roughness: PILLAR_STEEL_ROUGHNESS,
      side: THREE.FrontSide,
    });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(x, height / 2, z);
    pillar.receiveShadow = true
    pillar.castShadow = true;
    this.scene.add(pillar);
  }
  
  // 橋面(高架橋の上面・床)
  createBridgeGirder(curve) {
    const points_center = this.RailMargin(this.getPointsEveryM(curve, 0.3), 0,true);
    const points = points_center[0]
    const angles = points_center[1]
  
    const geometry = new THREE.BoxGeometry(0.12, 0.05, 0.9);
    const material = new THREE.MeshStandardMaterial({
      color: 0x603513,     // 石っぽいグレー（DimGray）
      roughness: 0.4,      // 表面ザラザラ（石っぽさを出す）
      metalness: 0.8,      // 金属感なし
      side: THREE.FrontSide
    });
  
    const sleeper = new THREE.InstancedMesh(geometry, material, points.length);
  
    for(let i = 0; i<points.length; i++){
      const pos = points[i]//-0.95
      this.object_update({ins_obj: sleeper, ins_idx: i, pos_x: pos.x,  pos_y: pos.y-0.89, pos_z: pos.z, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
    }
    this.scene.add(sleeper)
  
  }
  // 床板(コンクリート床)
  createDeckSlab(start, end) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const dy = end.y - start.y;
  
    const length = Math.sqrt(dx * dx + dz * dz);
    const geometry = new THREE.BoxGeometry(length, 0.2 ,1.75);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      side: THREE.FrontSide
    });
    const girder = new THREE.Mesh(geometry, material);
    girder.position.set(
      (start.x + end.x) / 2,
       start.y +dy/2,
      (start.z + end.z) / 2
    );
    girder.rotation.y = Math.atan2(dx,dz)-1.57;
    girder.rotation.z = Math.atan2(dy,length);
    this.scene.add(girder);
    
    // this.fitDirectionalLightShadowForObject(girder, this.light)
    girder.receiveShadow = true
    girder.castShadow = true;
  }

  createFloorAlongCurve(curve, {
    width = 0.5,
    thickness = 0.2,
    color = 0x888888,
    segmentLength = 1.2,
  } = {}) {
    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.FrontSide,
    });
    const points = this.getPointsEveryM(curve, segmentLength);
    if (!Array.isArray(points) || points.length < 2) { return null; }

    const group = new THREE.Group();
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const horizontalDist = Math.hypot(dx, dz);
      // 水平成分が極小の区間は、床板が縦向きに見える原因になるためスキップ。
      if (horizontalDist < 1e-3) { continue; }
      const segment = this.createBoxBetweenPoints3D(p0, p1, thickness, width, material);
      segment.castShadow = true;
      segment.receiveShadow = true;
      group.add(segment);
    }
    if (group.children.length === 0) { return null; }
    this.scene.add(group);
    return group;
  }

  createCatenaryPolesAlongCurve(curve, {
    interval = 14,
    leftHeight = 3.2,
    rightHeight = 3.2,
    beamLength = 2.6,
    beamHeight = 3.2,
    yOffset = 0,
    yawOffset = 0,
  } = {}) {
    if (!curve || typeof curve.getLength !== 'function') { return 0; }
    const length = curve.getLength();
    if (!Number.isFinite(length) || length <= 0) { return 0; }
    const count = Math.max(1, Math.round(length / Math.max(1, interval)));
    let placed = 0;
    for (let i = 0; i <= count; i += 1) {
      const t = count > 0 ? i / count : 0;
      const point = curve.getPointAt(t).clone();
      const tangent = curve.getTangentAt(t).clone().setY(0);
      if (tangent.lengthSq() <= 1e-8) {
        tangent.set(0, 0, 1);
      } else {
        tangent.normalize();
      }
      const pole = this.createCatenaryPole(leftHeight, rightHeight, beamLength, beamHeight, 1);
      pole.position.set(point.x, point.y + yOffset, point.z);
      pole.rotation.y += Math.atan2(tangent.x, tangent.z) + yawOffset;
      this.setShadowRecursive(pole, true, true);
      this.scene.add(pole);
      placed += 1;
    }
    return placed;
  }

  createRibbedSideBridge(curve, {
    side = 'right',
    sideOffset = 0.7,
    topWidth = 0.6,
    topThickness = 0.05,
    webHeight = 0.8,
    webThickness = 0.05,
    ribSpacing = 1.0,
    ribThickness = 0.2,
    ribDepth = 0.1,
    yOffset = 0,
    color = 0x94aa86,
  } = {}) {
    const sign = side === 'left' ? -1 : 1;
    const samples = this.getPointsEveryM(curve, 0.8);
    if (samples.length < 2) { return; }
    const material = new THREE.MeshStandardMaterial({ 
      color,    
      metalness: 0.8,       // 金属光沢最大
      roughness: 0.5,
      envMapIntensity: 1.0,
      side: THREE.FrontSide 
    });
    

    const topPoints = [];
    const webPoints = [];
    for (let i = 0; i < samples.length; i++) {
      const point = samples[i].clone();
      const t = samples.length > 1 ? i / (samples.length - 1) : 0;
      const tangent = curve.getTangentAt(t).clone().setY(0);
      if (tangent.lengthSq() === 0) {
        tangent.set(0, 0, 1);
      } else {
        tangent.normalize();
      }
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const edge = point.add(right.multiplyScalar(sign * sideOffset));
      const topCenter = edge.clone();
      topCenter.y += yOffset;
      const webCenter = edge.clone();
      webCenter.y += yOffset - (webHeight * 0.5) - (topThickness * 0.5);
      topPoints.push(topCenter);
      webPoints.push(webCenter);
    }

    for (let i = 0; i < topPoints.length - 1; i++) {
      this.scene.add(this.createBoxBetweenPoints3D(topPoints[i], topPoints[i + 1], topThickness, topWidth, material));
      this.scene.add(this.createBoxBetweenPoints3D(webPoints[i], webPoints[i + 1], webHeight, webThickness, material));
    }

    const ribPoints = this.getPointsEveryM(curve, ribSpacing);
    ribPoints.forEach((point, index) => {
      const t = ribPoints.length > 1 ? index / (ribPoints.length - 1) : 0;
      const tangent = curve.getTangentAt(t).clone().setY(0);
      if (tangent.lengthSq() === 0) {
        tangent.set(0, 0, 1);
      } else {
        tangent.normalize();
      }
      const yaw = Math.atan2(tangent.x, tangent.z);
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const edge = point.clone().add(right.multiplyScalar(sign * sideOffset));
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(ribThickness, webHeight, ribDepth),
        material
      );
      rib.position.set(edge.x, edge.y + yOffset - (webHeight * 0.5), edge.z);
      rib.rotation.y = yaw;
      this.scene.add(rib);
    });
  }

  createRectTunnelAlongCurve(curve, {
    innerWidth = 1,
    innerHeight = 1.2,
    wallThickness = 0.1,
    segmentSpacing = 1.2,
    yOffset = -0.1,
    color = 0x8b8f94,
  } = {}) {
    const points = this.getPointsEveryM(curve, segmentSpacing);
    if (!Array.isArray(points) || points.length < 2) { return; }
    const material = new THREE.MeshStandardMaterial({ color, side: THREE.FrontSide });

    const topCenter = [];
    const leftCenter = [];
    const rightCenter = [];

    for (let i = 0; i < points.length; i++) {
      const point = points[i].clone();
      const t = points.length > 1 ? i / (points.length - 1) : 0;
      const tangent = curve.getTangentAt(t).clone().setY(0);
      if (tangent.lengthSq() === 0) {
        tangent.set(0, 0, 1);
      } else {
        tangent.normalize();
      }
      const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
      const center = point.clone();
      center.y += yOffset;

      const halfW = (innerWidth * 0.5) + (wallThickness * 0.5);
      topCenter.push(center.clone().setY(center.y + innerHeight + (wallThickness * 0.5)));
      leftCenter.push(center.clone().add(right.clone().multiplyScalar(-halfW)).setY(center.y + (innerHeight * 0.5)));
      rightCenter.push(center.clone().add(right.clone().multiplyScalar(halfW)).setY(center.y + (innerHeight * 0.5)));
    }

    const topWidth = innerWidth + (wallThickness * 2);
    for (let i = 0; i < points.length - 1; i++) {
      this.scene.add(this.createBoxBetweenPoints3D(topCenter[i], topCenter[i + 1], wallThickness, topWidth, material));
      this.scene.add(this.createBoxBetweenPoints3D(leftCenter[i], leftCenter[i + 1], innerHeight, wallThickness, material));
      this.scene.add(this.createBoxBetweenPoints3D(rightCenter[i], rightCenter[i + 1], innerHeight, wallThickness, material));
    }
  }

  createCircularTunnelAlongCurve(curve, {
    innerRadius = 1.4,
    yOffset = -0.1,
    color = 0x8b8f94,
    tubularSegments = 160,
    radialSegments = 28,
  } = {}) {
    if (!curve || typeof curve.getLength !== 'function' || curve.getLength() <= 0) { return null; }
    const radius = Math.max(0.2, Number(innerRadius) || 1.4);
    const points = curve.getPoints(Math.max(12, tubularSegments));
    if (!Array.isArray(points) || points.length < 2) { return null; }
    const shiftedCurve = new THREE.CatmullRomCurve3(
      points.map((point) => point.clone().setY(point.y + yOffset + radius))
    );
    const geometry = new THREE.TubeGeometry(
      shiftedCurve,
      Math.max(12, tubularSegments),
      radius,
      Math.max(12, radialSegments),
      false
    );
    const material = new THREE.MeshStandardMaterial({
      color,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    return mesh;
  }

  buildTunnelEnvelopeFromTracks(trackGroups, {
    sampleCount = 120,
  } = {}) {
    if (!Array.isArray(trackGroups) || trackGroups.length < 1) { return null; }
    const validTracks = trackGroups.filter((group) => group?.curve && typeof group.curve.getLength === 'function' && group.curve.getLength() > 0);
    if (validTracks.length < 1) { return null; }
    const refDir = this.getCurveDirectionAtDistance(validTracks[0].curve, 0.5);
    const alignedTracks = validTracks.map((group) => {
      const aligned = this.alignCurveDirection(group.curve, refDir);
      return {
        ...group,
        curve: aligned.curve,
      };
    });
    const orderedTracks = this.getRouteOrderRightToLeft(alignedTracks);
    const rightEdge = orderedTracks[0];
    const leftEdge = orderedTracks[orderedTracks.length - 1];
    if (!rightEdge?.curve || !leftEdge?.curve) { return null; }

    const centerPoints = [];
    let maxSpan = 0;
    const count = Math.max(8, Number(sampleCount) || 120);
    for (let i = 0; i <= count; i++) {
      const t = count > 0 ? i / count : 0;
      const rightPoint = rightEdge.curve.getPointAt(t).clone();
      const leftPoint = leftEdge.curve.getPointAt(t).clone();
      centerPoints.push(rightPoint.clone().lerp(leftPoint, 0.5));
      const dx = rightPoint.x - leftPoint.x;
      const dz = rightPoint.z - leftPoint.z;
      maxSpan = Math.max(maxSpan, Math.sqrt((dx * dx) + (dz * dz)));
    }

    return {
      orderedTracks,
      rightEdge,
      leftEdge,
      maxSpan,
      centerCurve: centerPoints.length > 1 ? new THREE.CatmullRomCurve3(centerPoints) : rightEdge.curve.clone(),
    };
  }

  reverseCurveCopy(curve, steps = 300) {
    const reversedPoints = curve.getPoints(steps).map((point) => point.clone()).reverse();
    return new THREE.CatmullRomCurve3(reversedPoints);
  }

  getCurveDirectionAtDistance(curve, distance = 0.5) {
    const length = curve.getLength();
    const t = length > 0 ? Math.min(Math.max(distance / length, 0), 1) : 0;
    const start = curve.getPointAt(0);
    const end = curve.getPointAt(t);
    const dir = end.clone().sub(start).setY(0);
    if (dir.lengthSq() === 0) {
      dir.set(0, 0, 1);
    } else {
      dir.normalize();
    }
    return dir;
  }

  alignCurveDirection(curve, refDir) {
    const dir = this.getCurveDirectionAtDistance(curve, 0.5);
    if (dir.dot(refDir) < 0) {
      return { curve: this.reverseCurveCopy(curve), reversed: true };
    }
    return { curve: curve.clone(), reversed: false };
  }

  alignTrackGroupsForLateralOrder(trackGroups) {
    if (!Array.isArray(trackGroups) || trackGroups.length === 0) { return []; }
    const validTracks = trackGroups.filter((group) =>
      group?.curve && typeof group.curve.getLength === 'function'
    );
    if (validTracks.length === 0) { return []; }
    const refDir = this.getCurveDirectionAtDistance(validTracks[0].curve, 0.5);
    return validTracks.map((group) => {
      const aligned = this.alignCurveDirection(group.curve, refDir);
      return {
        ...group,
        curve: aligned.curve,
        reversed: aligned.reversed,
      };
    });
  }

  getRouteOrderRightToLeft(trackGroups) {
    if (trackGroups.length === 0) { return []; }
    const ref = trackGroups[0];
    const refStart = ref.curve.getPointAt(0).clone();
    const refDir = this.getCurveDirectionAtDistance(ref.curve, 0.5);
    const rightVec = new THREE.Vector3(refDir.z, 0, -refDir.x).normalize();
    return trackGroups.map((group) => {
      const start = group.curve.getPointAt(0).clone();
      const score = start.sub(refStart).setY(0).dot(rightVec);
      return { ...group, sideScore: score };
    }).sort((a, b) => b.sideScore - a.sideScore);
  }

  sampleOtherTracksNearby(trackGroups, selfTrackName, centerPoint, {
    searchRadius = 3,
    samplePrecision = 0.2,
    belowOffset = 0.1,
  } = {}) {
    const nearby = [];
    const radiusSq = searchRadius * searchRadius;
    const centerXZ = centerPoint.clone().setY(0);
    const maxTargetY = centerPoint.y - belowOffset;
    trackGroups.forEach((group) => {
      if (group.trackName === selfTrackName) { return; }
      const samples = this.getPointsEveryM(group.curve, samplePrecision);
      samples.forEach((point) => {
        if (point.y > maxTargetY) { return; }
        const pointXZ = point.clone().setY(0);
        if (pointXZ.distanceToSquared(centerXZ) <= radiusSq) {
          nearby.push({ point, trackName: group.trackName });
        }
      });
    });
    return nearby;
  }

  hasCollisionWithNearbyTracks(candidatePoint, nearbyPoints, avoidRadius = 0.7) {
    const avoidSq = avoidRadius * avoidRadius;
    const candidateXZ = candidatePoint.clone().setY(0);
    for (let i = 0; i < nearbyPoints.length; i++) {
      const targetPoint = nearbyPoints[i]?.point ?? nearbyPoints[i];
      if (!targetPoint) { continue; }
      const targetXZ = targetPoint.clone().setY(0);
      if (candidateXZ.distanceToSquared(targetXZ) <= avoidSq) {
        return true;
      }
    }
    return false;
  }

  getCollidingNearbyPoint(candidatePoint, nearbyPoints, avoidRadius = 0.7) {
    const avoidSq = avoidRadius * avoidRadius;
    const candidateXZ = candidatePoint.clone().setY(0);
    for (let i = 0; i < nearbyPoints.length; i++) {
      const targetPoint = nearbyPoints[i]?.point ?? nearbyPoints[i];
      if (!targetPoint) { continue; }
      const targetXZ = targetPoint.clone().setY(0);
      if (candidateXZ.distanceToSquared(targetXZ) <= avoidSq) {
        return targetPoint.clone();
      }
    }
    return null;
  }

  placePillarWithAvoidance(basePoint, tangent, nearbyPoints, {
    preferredSide = 'right',
    avoidRadius = 0.7,
    baseOffset = 0.4,
    maxOffset = 1.0,
    offsetStep = 0.2,
    fallbackPlace = true,
    collisionDebugPin = false,
    collisionDebugPinHeight = 3,
    collisionDebugPinColor = 0xffff00,
    directionDebugArrow = false,
    directionDebugArrowLength = 0.8,
  } = {}) {
    const dir = tangent.clone().setY(0);
    if (dir.lengthSq() === 0) {
      dir.set(0, 0, 1);
    } else {
      dir.normalize();
    }
    const rightVec = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
    if (directionDebugArrow) {
      this.addPillarDebugArrows(basePoint, dir, rightVec, directionDebugArrowLength);
    }
    const sideOrder = preferredSide === 'left' ? ['left', 'right'] : ['right', 'left'];
    const offsets = [];
    for (let d = baseOffset; d <= maxOffset + 1e-6; d += offsetStep) {
      offsets.push(d);
    }
    if (offsets.length === 0) {
      offsets.push(baseOffset);
    }
    const nearbyTrackCount = new Set(
      nearbyPoints
        .map((entry) => entry?.trackName)
        .filter((trackName) => typeof trackName === 'string' && trackName.length > 0)
    ).size;
    console.log(`[pillar-nearby] tracks=${nearbyTrackCount} samples=${nearbyPoints.length}`);

    for (let s = 0; s < sideOrder.length; s++) {
      const side = sideOrder[s];
      const sign = side === 'right' ? 1 : -1;
      for (let i = 0; i < offsets.length; i++) {
        const distance = offsets[i];
        const candidate = basePoint.clone().add(rightVec.clone().multiplyScalar(sign * distance));
        const collidedPoint = this.getCollidingNearbyPoint(candidate, nearbyPoints, avoidRadius);
        if (collidedPoint) {
          console.log(`[pillar-collision] side=${side} offset=${distance.toFixed(2)} point=(${candidate.x.toFixed(2)}, ${candidate.y.toFixed(2)}, ${candidate.z.toFixed(2)})`);
          if (collisionDebugPin) {
            this.Map_pin(
              collidedPoint.x,
              collidedPoint.z,
              collidedPoint.y + collisionDebugPinHeight,
              0.12,
              collisionDebugPinColor
            );
          }
          continue;
        }
        this.createBridgePillar(candidate.x, candidate.z, candidate.y);
        return { placed: true, side, offset: distance, point: candidate };
      }
    }

    if (fallbackPlace) {
      this.createBridgePillar(basePoint.x, basePoint.z, basePoint.y);
      return { placed: true, side: 'center', offset: 0, point: basePoint.clone(), fallback: true };
    }
    return { placed: false };
  }

  buildStructureFromPins(type, pins, trackLookup = null, options = {}) {
    if (!Array.isArray(pins)) {
      console.warn('buildStructureFromPins expects an array of pins.');
      return false;
    }

    const resolveTrackCurve = (trackName) => {
      if (!trackLookup || !trackName) { return null; }
      if (typeof trackLookup === 'function') {
        return trackLookup(trackName) || null;
      }
      if (trackLookup instanceof Map) {
        return trackLookup.get(trackName) || null;
      }
      if (typeof trackLookup === 'object') {
        return trackLookup[trackName] || null;
      }
      return null;
    };

    const entries = pins.map((pin, index) => {
      if (pin instanceof THREE.Vector3) {
        return { point: pin.clone(), trackName: null, index };
      }
      if (pin && Number.isFinite(pin.x) && Number.isFinite(pin.y) && Number.isFinite(pin.z)) {
        return {
          point: new THREE.Vector3(pin.x, pin.y, pin.z),
          trackName: typeof pin.trackName === 'string' ? pin.trackName : null,
          index,
        };
      }
      return null;
    }).filter(Boolean);

    if (entries.length < 2) {
      console.warn('buildStructureFromPins requires at least 2 valid pins.');
      return false;
    }

    const maxAngleDiff = this.degToRad(20);
    const maxPairDistance = 10;
    const groups = new Map();

    const getDirectionInfo = (points) => {
      let bestStart = points[0];
      let bestEnd = points[points.length - 1];
      let bestDist = -1;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx = points[j].x - points[i].x;
          const dz = points[j].z - points[i].z;
          const dist = dx * dx + dz * dz;
          if (dist > bestDist) {
            bestDist = dist;
            bestStart = points[i];
            bestEnd = points[j];
          }
        }
      }
      const dir = new THREE.Vector3(
        bestEnd.x - bestStart.x,
        0,
        bestEnd.z - bestStart.z
      );
      if (dir.lengthSq() === 0) {
        dir.set(1, 0, 0);
      }
      dir.normalize();
      return { start: bestStart, end: bestEnd, dir };
    };

    entries.forEach((entry) => {
      if (!entry.trackName) { return; }
      if (!groups.has(entry.trackName)) {
        groups.set(entry.trackName, []);
      }
      groups.get(entry.trackName).push(entry.point);
    });

    const trackGroups = [];
    groups.forEach((points, trackName) => {
      if (points.length < 2) { return; }
      const { start, dir } = getDirectionInfo(points);
      const ordered = points.slice().sort((a, b) => {
        const da = new THREE.Vector3().subVectors(a, start).dot(dir);
        const db = new THREE.Vector3().subVectors(b, start).dot(dir);
        return da - db;
      });
      const baseCurve = resolveTrackCurve(trackName);
      const curve = baseCurve
        ? this.findCurveRange(baseCurve, ordered[0], ordered[ordered.length - 1])
        : new THREE.CatmullRomCurve3(ordered);
      const center = ordered.reduce((acc, p) => {
        acc.x += p.x;
        acc.y += p.y;
        acc.z += p.z;
        return acc;
      }, new THREE.Vector3()).multiplyScalar(1 / ordered.length);
      const direction = ordered[ordered.length - 1].clone().sub(ordered[0]).setY(0);
      if (direction.lengthSq() === 0) {
        direction.set(1, 0, 0);
      } else {
        direction.normalize();
      }
      trackGroups.push({
        trackName,
        points: ordered,
        curve,
        center,
        direction,
      });
    });

    const pairCandidates = [];
    for (let i = 0; i < trackGroups.length; i++) {
      for (let j = i + 1; j < trackGroups.length; j++) {
        const a = trackGroups[i];
        const b = trackGroups[j];
        const dot = a.direction.dot(b.direction);
        if (dot <= 0) { continue; }
        const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
        if (angle > maxAngleDiff) { continue; }
        const dx = a.center.x - b.center.x;
        const dz = a.center.z - b.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > maxPairDistance) { continue; }
        pairCandidates.push({ i, j, dist });
      }
    }

    pairCandidates.sort((a, b) => a.dist - b.dist);
    const paired = new Set();
    const pairs = [];
    pairCandidates.forEach((candidate) => {
      if (paired.has(candidate.i) || paired.has(candidate.j)) { return; }
      paired.add(candidate.i);
      paired.add(candidate.j);
      pairs.push(candidate);
    });

    if (type === 'bridge') {
      pairs.forEach(({ i, j }) => {
        const a = trackGroups[i];
        const b = trackGroups[j];
        const y = (a.center.y + b.center.y) * 0.5;
        const quantity = Math.max(2, Math.min(a.points.length, b.points.length));
        this.placeGirderBridge(a.curve, b.curve, y, quantity);
      });
      return true;
    }

    if (type === 'elevated') {
      const pillarInterval = 10;
      const interval = 25;
      pairs.forEach(({ i, j }) => {
        const a = trackGroups[i];
        const b = trackGroups[j];
        this.generateElevated(a.curve, pillarInterval, interval, false, b.curve);
      });
      trackGroups.forEach((group, index) => {
        if (paired.has(index)) { return; }
        this.generateElevated(group.curve, pillarInterval, interval);
      });
      return true;
    }

    if (type === 'wall') {
      // margin の符号を安定させるため、隣接路線の進行方向を揃えてから左右順を判定する。
      const alignedTracks = this.alignTrackGroupsForLateralOrder(trackGroups);
      const orderedTracks = this.getRouteOrderRightToLeft(alignedTracks);
      for (let i = 0; i < orderedTracks.length - 1; i++) {
        const rightTrack = orderedTracks[i];
        const leftTrack = orderedTracks[i + 1];
        const quantity = Math.max(2, Math.min(rightTrack.points.length, leftTrack.points.length));
        // 右 -> 左の順で隣接路線ごとに壁を生成
        this.createWall(rightTrack.curve, leftTrack.curve, quantity, 0.8, -0.8);
      }
      return true;
    }

    if (type === 'floor') {
      trackGroups.forEach((group) => {
        this.createFloorAlongCurve(group.curve, { width: 1.5, thickness: 0.2 });
      });
      return true;
    }

    if (type === 'catenary_pole') {
      const catenaryOptions = {
        interval: options.interval ?? 14,
        leftHeight: options.leftHeight ?? 3.2,
        rightHeight: options.rightHeight ?? 3.2,
        beamLength: options.beamLength ?? 2.6,
        beamHeight: options.beamHeight ?? 3.2,
        yOffset: options.yOffset ?? 0,
        yawOffset: options.yawOffset ?? 0,
      };
      trackGroups.forEach((group) => {
        this.createCatenaryPolesAlongCurve(group.curve, catenaryOptions);
      });
      return true;
    }

    if (type === 'rib_bridge') {
      const alignedTracks = this.alignTrackGroupsForLateralOrder(trackGroups);
      const orderedTracks = this.getRouteOrderRightToLeft(alignedTracks);
      if (orderedTracks.length === 0) { return false; }
      let rightEdge = orderedTracks[0];
      let leftEdge = orderedTracks[orderedTracks.length - 1];
      const edgeNames = options.edgeTrackNames || {};
      if (edgeNames.right) {
        rightEdge = orderedTracks.find((track) => track.trackName === edgeNames.right) || rightEdge;
      }
      if (edgeNames.left) {
        leftEdge = orderedTracks.find((track) => track.trackName === edgeNames.left) || leftEdge;
      }
      this.createRibbedSideBridge(rightEdge.curve, { side: 'right' });
      if (leftEdge.trackName !== rightEdge.trackName) {
        this.createRibbedSideBridge(leftEdge.curve, { side: 'left' });
      } else {
        this.createRibbedSideBridge(leftEdge.curve, { side: 'left' });
      }
      return true;
    }

    if (type === 'tunnel_rect') {
      const tunnelOptions = {
        innerWidth: options.innerWidth ?? 2.2,
        innerHeight: options.innerHeight ?? 2.6,
        wallThickness: options.wallThickness ?? 0.25,
        segmentSpacing: options.segmentSpacing ?? 1.2,
        yOffset: options.yOffset ?? -0.1,
        sideClearance: options.sideClearance ?? 1.2,
        color: options.color ?? 0x8b8f94,
      };
      const envelope = this.buildTunnelEnvelopeFromTracks(trackGroups);
      if (!envelope) { return false; }
      const expandedWidth = envelope.orderedTracks.length > 1
        ? Math.max(
          tunnelOptions.innerWidth,
          envelope.maxSpan + (Math.max(0, Number(tunnelOptions.sideClearance) || 0) * 2)
        )
        : tunnelOptions.innerWidth;
      this.createRectTunnelAlongCurve(envelope.centerCurve, {
        innerWidth: expandedWidth,
        innerHeight: tunnelOptions.innerHeight,
        wallThickness: tunnelOptions.wallThickness,
        segmentSpacing: tunnelOptions.segmentSpacing,
        yOffset: tunnelOptions.yOffset,
        color: tunnelOptions.color,
      });
      return true;
    }

    if (type === 'tunnel_circle') {
      const tunnelOptions = {
        innerRadius: options.innerRadius ?? 1.3,
        yOffset: options.yOffset ?? -1.2,
        sideClearance: options.sideClearance ?? 0.1,
        color: options.color ?? 0x8b8f94,
      };
      const envelope = this.buildTunnelEnvelopeFromTracks(trackGroups);
      if (!envelope) { return false; }
      const trackCount = envelope.orderedTracks.length;
      if (trackCount !== 1 && trackCount !== 2) {
        console.warn('tunnel_circle supports only 1 or 2 tracks.');
        return false;
      }
      const radius = trackCount === 2
        ? Math.max(
          tunnelOptions.innerRadius,
          (envelope.maxSpan * 0.5) + Math.max(0, Number(tunnelOptions.sideClearance) || 0)
        )
        : tunnelOptions.innerRadius;
      this.createCircularTunnelAlongCurve(envelope.centerCurve, {
        innerRadius: radius,
        yOffset: tunnelOptions.yOffset,
        color: tunnelOptions.color,
      });
      return true;
    }

    if (type === 'pillar') {
      const pillarOptions = {
        baseInterval: options.baseInterval ?? 8,
        avoidRadius: options.avoidRadius ?? 0.7,
        searchRadius: options.searchRadius ?? 3,
        samplePrecision: options.samplePrecision ?? 0.2,
        belowOffset: options.belowOffset ?? 0.1,
        maxOffset: options.maxOffset ?? 1.0,
        baseOffset: options.baseOffset ?? 0.4,
        offsetStep: options.offsetStep ?? 0.2,
        directionDebugArrow: options.directionDebugArrow ?? true,
        directionDebugArrowLength: options.directionDebugArrowLength ?? 0.8,
      };
      if (pillarOptions.directionDebugArrow) {
        this.clearPillarDebugArrows();
      }
      const validTracks = trackGroups.filter((group) => group.curve && group.curve.getLength() > 0);
      if (validTracks.length === 0) {
        console.warn('pillar requires valid track curves.');
        return false;
      }

      const lengths = validTracks.map((group) => ({ trackName: group.trackName, len: group.curve.getLength() }));
      const sortedLengths = lengths.map((item) => item.len).slice().sort((a, b) => a - b);
      const mid = sortedLengths.length / 2;
      const median = sortedLengths.length % 2 === 0
        ? (sortedLengths[mid - 1] + sortedLengths[mid]) * 0.5
        : sortedLengths[Math.floor(mid)];
      let baseTrack = validTracks[0];
      let minDiff = Infinity;
      validTracks.forEach((group) => {
        const diff = Math.abs(group.curve.getLength() - median);
        if (diff < minDiff) {
          minDiff = diff;
          baseTrack = group;
        }
      });

      const refDir = this.getCurveDirectionAtDistance(baseTrack.curve, 0.5);
      const alignedTracks = validTracks.map((group) => {
        const aligned = this.alignCurveDirection(group.curve, refDir);
        return {
          ...group,
          curve: aligned.curve,
          reversed: aligned.reversed,
          length: aligned.curve.getLength(),
        };
      });

      const orderedTracks = this.getRouteOrderRightToLeft(alignedTracks);
      const lookupTracks = [];
      if (trackLookup instanceof Map) {
        trackLookup.forEach((curve, trackName) => {
          if (curve) {
            lookupTracks.push({ trackName, curve });
          }
        });
      } else if (trackLookup && typeof trackLookup === 'object') {
        Object.keys(trackLookup).forEach((trackName) => {
          const curve = trackLookup[trackName];
          if (curve) {
            lookupTracks.push({ trackName, curve });
          }
        });
      }
      const nearbyTrackSource = lookupTracks.length > 0 ? lookupTracks : orderedTracks;

      const baseLength = baseTrack.curve.getLength();
      const baseCountFloat = baseLength / pillarOptions.baseInterval;

      orderedTracks.forEach((group, index) => {
        const countFloat = baseLength > 0 ? (group.length / baseLength) * baseCountFloat : 0;
        const segmentCount = Math.max(1, Math.round(countFloat));

        for (let i = 0; i <= segmentCount; i++) {
          const t = segmentCount > 0 ? i / segmentCount : 0;
          const point = group.curve.getPointAt(t).clone();
          const tangent = group.curve.getTangentAt(t).clone();
          const nearby = this.sampleOtherTracksNearby(nearbyTrackSource, group.trackName, point, {
            searchRadius: pillarOptions.searchRadius,
            samplePrecision: pillarOptions.samplePrecision,
            belowOffset: pillarOptions.belowOffset,
          });

          if (orderedTracks.length === 1) {
            this.placePillarWithAvoidance(point, tangent, nearby, {
              preferredSide: 'right',
              avoidRadius: pillarOptions.avoidRadius,
              baseOffset: pillarOptions.baseOffset,
              maxOffset: pillarOptions.maxOffset,
              offsetStep: pillarOptions.offsetStep,
              collisionDebugPin: options.collisionDebugPin ?? true,
              collisionDebugPinHeight: options.collisionDebugPinHeight ?? 3,
              collisionDebugPinColor: options.collisionDebugPinColor ?? 0xffff00,
              directionDebugArrow: pillarOptions.directionDebugArrow,
              directionDebugArrowLength: pillarOptions.directionDebugArrowLength,
            });
            this.placePillarWithAvoidance(point, tangent, nearby, {
              preferredSide: 'left',
              avoidRadius: pillarOptions.avoidRadius,
              baseOffset: pillarOptions.baseOffset,
              maxOffset: pillarOptions.maxOffset,
              offsetStep: pillarOptions.offsetStep,
              collisionDebugPin: options.collisionDebugPin ?? true,
              collisionDebugPinHeight: options.collisionDebugPinHeight ?? 3,
              collisionDebugPinColor: options.collisionDebugPinColor ?? 0xffff00,
              directionDebugArrow: pillarOptions.directionDebugArrow,
              directionDebugArrowLength: pillarOptions.directionDebugArrowLength,
            });
          } else {
            let preferredSide = 'right';
            if (index === 0) {
              preferredSide = 'right';
            } else if (index === orderedTracks.length - 1) {
              preferredSide = 'left';
            } else {
              preferredSide = 'right';
            }
            this.placePillarWithAvoidance(point, tangent, nearby, {
              preferredSide,
              avoidRadius: pillarOptions.avoidRadius,
              baseOffset: pillarOptions.baseOffset,
              maxOffset: pillarOptions.maxOffset,
              offsetStep: pillarOptions.offsetStep,
              collisionDebugPin: options.collisionDebugPin ?? true,
              collisionDebugPinHeight: options.collisionDebugPinHeight ?? 3,
              collisionDebugPinColor: options.collisionDebugPinColor ?? 0xffff00,
              directionDebugArrow: pillarOptions.directionDebugArrow,
              directionDebugArrowLength: pillarOptions.directionDebugArrowLength,
            });
          }
        }
      });
      return true;
    }

    console.warn(`Unknown structure type: ${type}`);
    return false;
  }

  // 高架線路生成(線型に沿う)
  generateElevated(curve, pillarInterval = 10, interval = 25, obstacle = false, curve2 = false) {
    const points = this.getPointsEveryM(curve, interval);
    const angles_y = this.RailMargin(points, 0, true)[1]

    let points2 = false
    let angles2_y = false
    if (curve2 != false){
      points2 = this.getPointsEveryM(curve2, interval);
      angles2_y = this.RailMargin(points2, 0, true)[1]
    }

    for (let i = 0; i < points.length; i += pillarInterval*2) {
      let p = points[i];
      let p2 = points2[i];

      let PillarPoint = points[i]
     
      if (!obstacle){
          this.createBridgePillar(p.x, p.z, p.y);
        } else {
          const l_p = {x:p.x, y:p.y, z:p.z}
          const pillar_Coordinatpoint = this.sampleCurveCoordinates(obstacle, l_p, angles_y[i], interval = 1)
          const len =  pillar_Coordinatpoint.length
          if (len === 0){
            this.createBridgePillar(p.x, p.z, p.y);
          } else {
            
            PillarPoint = pillar_Coordinatpoint[0]
          }
        }
    
      if (i + pillarInterval < points.length) {
        const p1e = points[i + pillarInterval];
        this.createDeckSlab(p, p1e);
      }

      if (curve2 != false){
        this.createBridgePillar(p2.x, p2.z, p2.y);
        if (i + pillarInterval < points2.length) {
          const p2e = points2[i + pillarInterval];
          this.createDeckSlab(p2, p2e);
        }
      }

    if (i + pillarInterval*2 < points.length) {
  
      p = points[i + 3];
      let PillarPoint2 = p
      if (!obstacle){
        this.createBridgePillar(p.x, p.z, p.y);
      } else {
        const l_p = {x:p.x, y:p.y, z:p.z}
        const pillar_Coordinatpoint = this.sampleCurveCoordinates(obstacle, l_p, angles_y[i], interval = 2)
        const len =  pillar_Coordinatpoint.length 
        if (len === 0){
          this.createBridgePillar(p.x, p.z, p.y);
        } else {
          
          PillarPoint2 = pillar_Coordinatpoint[0]
        }
      }

      const p1e = points[i + pillarInterval*2];
      this.createDeckSlab(p, p1e);
  
      if (p2 != undefined){
        
        const avoid_point = {
          x: PillarPoint.x,
          y: p2.y-0.3,
          z: PillarPoint.z
        }
        const point = {
          x: p2.x,
          y: p2.y-0.3,
          z: p2.z
        }
        this.scene.add(this.createBoxBetweenPoints3D(point,avoid_point,0.7,0.7))
      }

      p2 = points2[i + 3];
      
      if (curve2 != false){
        this.createBridgePillar(p2.x, p2.z, p2.y);
        if (i + pillarInterval*2 < points2.length) {
          const p2e = points2[i + pillarInterval*2];
          this.createDeckSlab(p2, p2e);
        }
      }

      if (p2 != undefined){
        
        const avoid_point = {
          x: PillarPoint2.x,
          y:  p2.y-0.3,
          z: PillarPoint2.z
        }
        const point = {
          x: p2.x,
          y: p2.y-0.3,
          z: p2.z
        }
        this.scene.add(this.createBoxBetweenPoints3D(point,avoid_point,0.7,0.7))
      }

      if (p2 != undefined){
        
        const p1 = points2[i]
        const avoid_point = {
          x: p1.x,
          y: p1.y-0.3,
          z: p1.z
        }

        const point = {
          x: p2.x,
          y: p2.y-0.3,
          z: p2.z
        }
        this.scene.add(this.createBoxBetweenPoints3D(point,avoid_point,0.7,0.7))
      }
    }

    }
  } 
  
  // 線路 ,I...I,
  rawRail(points_data, name = false){
    const points = points_data[0]
    const angles = points_data[1]
    
    //   0123456
    // 7 .#---#.
    // 6 ..\./..
    // 5 ..#.#..
    // 4 ..|.|..
    // 3.5  ◆
    // 3 ..|.|..
    // 2 ..|.|..
    // 1 . #.#..
    // 0 #-----#
    const baseVectors = [
      [  0.07,  0.175 ],
      [ -0.07,  0.175 ],
      [  0.02,  0.075 ],
      [ -0.02,  0.075 ],
      [  0.02, -0.125 ],
      [ -0.02, -0.125 ],
      [  0.14, -0.15 ],
      [ -0.14, -0.15 ]
    ];
    
    // 任意の倍率（例：0.5倍）
    const scaleFactor = 0.25;
    const scaledVectors_plane = this.scaleVectors(baseVectors, scaleFactor);
    
    const verticesArray = [];
    const vertexArray = [];
    
    let before_pos = points[0]
    for (let i = 0; i<points.length; i++){
      
      const pos = points[i]; //基準座標
  
      const anglex = this.getVerticalAngle(before_pos, pos);
      const angle_vertical = Math.cos(anglex)
      const angle_plene = Math.sin(anglex)
      // createDebugSphere(scene, pos, 0.01, 0xff0000);
      // createDebugSphere(scene, {x:0,y:0,z:0}, 0.01, 0xff0000);
      // 新しい座標配列（x, z の2D座標）
      scaledVectors_plane.map((theta, c) => {
  
        const y_new = pos.y+theta[1] * angle_vertical  +0.17;
        let z_new = theta[1] * angle_plene
        let x_new = theta[0]
  
        // console.log(angles[i])
        const rotation_y = Math.atan2(z_new,x_new)+angles[i]// + i*90 * Math.PI / 180;
        const length = Math.sqrt(x_new**2 + z_new**2)
        x_new = pos.x+Math.sin(rotation_y)*length
        z_new = pos.z+Math.cos(rotation_y)*length
  
        const debugPos = { x: x_new, y: y_new, z: z_new };
        // createDebugSphere(scene, debugPos, 0.005, 0x00ff00);
  
        verticesArray.push(x_new, y_new, z_new);
      });
      if (i>1){
        // vertexArray.push((i-1)*8,(i-1)*8+1,i*8)
        // vertexArray.push((i-1)*8+1,i*8+1,i*8)
  
        // vertexArray.push(i*8+1,(i-1)*8+3,(i-1)*8+1)
        // vertexArray.push(i*8+1,i*8+3,(i-1)*8+3)
  
        // vertexArray.push(i*8+3,(i-1)*8+5,(i-1)*8+3)
        // vertexArray.push(i*8+3,i*8+5,(i-1)*8+5)
  
        // vertexArray.push((i-1)*8+5,(i-1)*8+7,i*8+5)
        // vertexArray.push((i-1)*8+7,i*8+7,i*8+5)
  
        // // -----------------------------------------
  
        // vertexArray.push((i-1)*8+2,(i-1)*8+4,i*8+2)
        // vertexArray.push((i-1)*8+4,i*8+4,i*8+2)
  
        // vertexArray.push((i-1)*8+4,(i-1)*8+6,i*8+4)
        // vertexArray.push((i-1)*8+6,i*8+6,i*8+4)
  
        // vertexArray.push((i-1)*8,(i-1)*8+2,i*8)
        // vertexArray.push((i-1)*8+2,i*8+2,i*8)
        // =========================================
        // vertexArray.push(i*8,(i-1)*8+1,(i-1)*8)
        // vertexArray.push(i*8,i*8+1,(i-1)*8+1)
  
        // vertexArray.push(i*8+1,(i-1)*8+3,(i-1)*8+1)
        // vertexArray.push(i*8+1,i*8+3,(i-1)*8+3)
  
        // vertexArray.push(i*8+3,(i-1)*8+5,(i-1)*8+3)
        // vertexArray.push(i*8+3,i*8+5,(i-1)*8+5)
  
        // vertexArray.push((i-1)*8+5,(i-1)*8+7,i*8+5)
        // vertexArray.push((i-1)*8+7,i*8+7,i*8+5)
  
        // // -----------------------------------------
  
        // vertexArray.push((i-1)*8+2,(i-1)*8+4,i*8+2)
        // vertexArray.push((i-1)*8+4,i*8+4,i*8+2)
  
        // vertexArray.push((i-1)*8+4,(i-1)*8+6,i*8+4)
        // vertexArray.push((i-1)*8+6,i*8+6,i*8+4)
  
        // vertexArray.push((i-1)*8,(i-1)*8+2,i*8)
        // vertexArray.push((i-1)*8+2,i*8+2,i*8)
  
        // =========================================
  
        vertexArray.push((i-1)*8,(i-1)*8+1,i*8)
        vertexArray.push((i-1)*8+1,i*8+1,i*8)
  
        vertexArray.push((i-1)*8+1,(i-1)*8+3,i*8+1)
        vertexArray.push((i-1)*8+3,i*8+3,i*8+1)
  
        vertexArray.push((i-1)*8+3,(i-1)*8+5,i*8+3)
        vertexArray.push((i-1)*8+5,i*8+5,i*8+3)
  
        vertexArray.push((i-1)*8+5,(i-1)*8+7,i*8+5)
        vertexArray.push((i-1)*8+7,i*8+7,i*8+5)
  
        // -----------------------------------------
  
        vertexArray.push((i-1)*8+4,(i-1)*8+2,i*8+2)
        vertexArray.push(i*8+2,i*8+4,(i-1)*8+4)
  
        vertexArray.push(i*8+4,(i-1)*8+6,(i-1)*8+4)
        vertexArray.push(i*8+4,i*8+6,(i-1)*8+6)
  
        vertexArray.push(i*8,(i-1)*8+2,(i-1)*8)
        vertexArray.push(i*8,i*8+2,(i-1)*8+2)
  
      }
      // console.log(rotatedPositions);
      before_pos = pos
    }
  
    // 最後にFloat32Arrayに変換
    const vertices = new Float32Array(verticesArray);
    
    // BufferGeometryにセット
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  
    geometry.setIndex(vertexArray); // 2枚の三角形で四角形に
    geometry.computeVertexNormals(); // 光の当たり具合を正しくする
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x503513,
      metalness: 1,   // 金属っぽさ（0〜1）
      roughness: 0.2,   // 表面の粗さ（0：つるつる、1：ザラザラ）
      envMapIntensity: 1,    // 環境マップの反射強度（envMapを使うなら）
      side: THREE.FrontSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    if(name){
      mesh.name = 'Rail'
    }
    this.scene.add(mesh);
  
  }

  createRail(curve, name = false){
    const points_right = this.RailMargin(curve.getPoints(70), 0.24,true);
    const points_lift = this.RailMargin(curve.getPoints(70), -0.24,true);
    const points_center = this.RailMargin(this.getPointsEveryM(curve, 0.25), 0,true);
    const points = points_center[0]
    const angles = points_center[1]
  
    const geometry = new THREE.BoxGeometry(0.1, 0.02, 0.9);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,     // 石っぽいグレー（DimGray）
      roughness: 0.9,      // 表面ザラザラ（石っぽさを出す）
      metalness: 0.0,      // 金属感なし
      side: THREE.FrontSide
    });
    const loc_geometry = new THREE.BoxGeometry(0.05, 0.01, 0.1);
    const loc_material = new THREE.MeshStandardMaterial({
      color: 0x664513,
      metalness: 1,   // 金属っぽさ（0〜1）
      roughness: 0.8,   // 表面の粗さ（0：つるつる、1：ザラザラ）
      side: THREE.FrontSide
    });
  
    const sleeper = new THREE.InstancedMesh(geometry, stoneMaterial, points.length);
    const loc = new THREE.InstancedMesh(loc_geometry, loc_material, points.length*2);
    for(let i = 0; i<points.length; i++){
      const pos = points[i]
      this.object_update({ins_obj: sleeper, ins_idx: i, pos_x: pos.x,  pos_y: pos.y+0.1, pos_z: pos.z, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
      const x_sin = Math.sin(angles[i])
      const z_cos = Math.cos(angles[i])
      this.object_update({ins_obj: loc, ins_idx: i*2, pos_x: pos.x+x_sin*0.245,  pos_y: pos.y+0.14, pos_z: pos.z+z_cos*0.21, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
      this.object_update({ins_obj: loc, ins_idx: i*2+1, pos_x: pos.x+x_sin*-0.245,  pos_y: pos.y+0.14, pos_z: pos.z+z_cos*-0.21, rot_x: NaN, rot_y: angles[i], rot_z: NaN,scale: NaN})
  
    }
    
    if(name){
      sleeper.name = 'Rail'
      loc.name = 'Rail'
    }
    this.scene.add(sleeper)
    this.scene.add(loc)
  
    this.rawRail(points_right, name)
    this.rawRail(points_lift, name)
    
  }
  
  // 壁の生成
  createWall(track_1,track_2,quantity,margin_1=0.8,margin_2=-0.8,y_1=0,y_2=0,color=0x666666,material=false){
    const board_length_1 = track_1.getLength(track_1)/quantity;
    const board_length_2 = track_2.getLength(track_2)/quantity;
    const points_1 = this.RailMargin(this.getPointsEveryM(track_1, board_length_1), margin_1);
    const points_2 = this.RailMargin(this.getPointsEveryM(track_2, board_length_2), margin_2);
    
    const verticesArray = [];
    const vertexArray = [];
  
    for(let i=0; i < points_1.length; i++){
    // for(let i=0; i < 2; i++){
      const coordinate1 = points_1[i]
      verticesArray.push(coordinate1.x, coordinate1.y+y_1, coordinate1.z)
      const coordinate2 = points_2[i]
      verticesArray.push(coordinate2.x, coordinate2.y+y_2, coordinate2.z)
      if (i < points_1.length-1){
        vertexArray.push(i*2,i*2+1,i*2+2);
        vertexArray.push(i*2+3,i*2+2,i*2+1);
      }
    }
  
    // 最後にFloat32Arrayに変換
    const vertices = new Float32Array(verticesArray);
    
    // BufferGeometryにセット
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  
    geometry.setIndex(vertexArray); // 2枚の三角形で四角形に
    geometry.computeVertexNormals(); // 光の当たり具合を正しくする
    
    if (material === false){material =  new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide })};
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true

    this.scene.add(mesh);
    
  }

  createCustomGeometry(tiles){
    // 最後にFloat32Arrayに変換
    const tiles_Float32 = new Float32Array(tiles);

    // BufferGeometryにセット
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(tiles_Float32, 3));
  
    geometry.setIndex(vertexArray); // 2枚の三角形で四角形に
    geometry.computeVertexNormals(); // 光の当たり具合を正しくする
    
    if (material === false){material =  new THREE.MeshStandardMaterial({ color: color, side: THREE.DoubleSide })};
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }

  // 架線柱 トラス型                   ,__________|¯'¯|_______________|¯'¯|__________,
  createCatenaryPole(left_height, right_height, beamLength, beam_height, makes) {
    const pos_x = 0 //　             |_|_/_\_/_\_|_|_/_\_/_\_/_\_/_\_|_|_/_\_/_\_|_|
    const pos_y = 0 //　             |X|/      ___|___             ___|___      \|X|
    const pos_z = 0 //　             |X|        ¯¯¥¯¯               ¯¯¥¯¯        |X|
    const Poles = new THREE.Group(); // 　　　 　　　　                            |X|
    const Side_len = 0.1 //　        |X|                                         |X|
    const board_rotation = 45 * Math.PI / 180; // /_ 45度  　　　                 |X|
    //　                             |X|__,I,,,I,__,I,,,I,_____,I,,,I,__,I,,,I,__|X|
    const rotation_x_len = Math.sin(board_rotation)*Side_len*0.8
    const board_xlen = (Side_len/rotation_x_len)*rotation_x_len+rotation_x_len
    const boardGeometry = new THREE.BoxGeometry(board_xlen, 0.02, 0.01);
    const poleMaterial = new THREE.MeshStandardMaterial({ 
      color: PILLAR_STEEL_COLOR,
      metalness: PILLAR_STEEL_METALNESS,
      roughness: PILLAR_STEEL_ROUGHNESS,
      envMapIntensity: 1,    // 環境マップの反射強度（envMapを使うなら）
      side: THREE.FrontSide
     });
    const board = new THREE.InstancedMesh(boardGeometry, poleMaterial, ((right_height/Side_len)*4+(left_height/Side_len)*4+(beamLength/Side_len)*4));
  
    right_height = right_height-right_height%Side_len
    left_height = left_height-left_height%Side_len
    beam_height = beam_height-beam_height%Side_len
    beamLength = beamLength-beamLength%Side_len
  
    let plus_index = 0
    const Pole = new THREE.Group();
  
    if (right_height != 0){
      for (let i =0; i<right_height/Side_len; i++){
        if (i%2===0){
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: board_rotation,scale: NaN})      
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: board_rotation,scale: NaN})  
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
        } else {
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
        }
        
      }
      const poleGeometry_right = new THREE.BoxGeometry(0.02, right_height, 0.02);
      const pole_right = new THREE.Mesh(poleGeometry_right, poleMaterial);
      pole_right.position.set(pos_x+Side_len*0.5,pos_y+right_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_right.clone());
      pole_right.position.set(pos_x+Side_len*0.5,pos_y+right_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_right.clone());
      pole_right.position.set(pos_x-Side_len*0.5,pos_y+right_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_right.clone());
      pole_right.position.set(pos_x-Side_len*0.5,pos_y+right_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_right.clone());
    
      plus_index += (right_height/Side_len)*4
    }
  
    if (left_height != 0){
      const move_x = beamLength-Side_len
      for (let i =0; i<left_height/Side_len; i++){
        if (i%2===0){
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: board_rotation,scale: NaN})      
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: board_rotation,scale: NaN})  
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
        } else {
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z+Side_len*0.5, rot_x: NaN, rot_y: 0 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_x: pos_x+Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 90 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_x: pos_x+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z-Side_len*0.5, rot_x: NaN, rot_y: 180 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})
          this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_x: pos_x-Side_len*0.5+move_x,  pos_y: pos_y+Side_len*i+Side_len*0.5, pos_z: pos_z, rot_x: NaN, rot_y: 270 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
        }
      }
      const poleGeometry_left = new THREE.BoxGeometry(0.02, left_height, 0.02);
      const pole_left = new THREE.Mesh(poleGeometry_left, poleMaterial);
      pole_left.position.set(pos_x+Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_left.clone());
      pole_left.position.set(pos_x+Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_left.clone());
      pole_left.position.set(pos_x-Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z+Side_len*0.5)
      Pole.add(pole_left.clone());
      pole_left.position.set(pos_x-Side_len*0.5+move_x,pos_y+left_height*0.5,pos_z-Side_len*0.5)
      Pole.add(pole_left.clone());
    
      plus_index += (left_height/Side_len)*4
    }
    
    // scene.add(Pole2)
  
    for (let i =0; i<beamLength/Side_len; i++){
      if (i%2===0){
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: Side_len*0.5, rot_y: NaN, rot_x: 0 * Math.PI / 180, rot_z: board_rotation,scale: NaN})      
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_y: beam_height,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 270 * Math.PI / 180, rot_z: board_rotation,scale: NaN})  
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: -Side_len*0.5, rot_y: NaN, rot_x: 180 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_y: beam_height-Side_len,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 90 * Math.PI / 180, rot_z: board_rotation,scale: NaN}) 
      } else {
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: Side_len*0.5, rot_y: NaN, rot_x: 0 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})      
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+1, pos_y: beam_height,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 270 * Math.PI / 180, rot_z: -board_rotation,scale: NaN})  
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+2, pos_y: beam_height-Side_len*0.5,  pos_x: Side_len*i, pos_z: -Side_len*0.5, rot_y: NaN, rot_x: 180 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
        this.object_update({ins_obj: board, ins_idx: plus_index+i*4+3, pos_y: beam_height-Side_len,  pos_x: Side_len*i, pos_z: 0, rot_y: NaN, rot_x: 90 * Math.PI / 180, rot_z: -board_rotation,scale: NaN}) 
      }
    }
  
    const poleGeometry_beam = new THREE.BoxGeometry(beamLength, 0.02, 0.02);
    const pole_beam = new THREE.Mesh(poleGeometry_beam, poleMaterial);
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height-Side_len,Side_len*0.5)
    Pole.add(pole_beam.clone());
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height,-Side_len*0.5)
    Pole.add(pole_beam.clone());
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height,Side_len*0.5)
    Pole.add(pole_beam.clone());
    pole_beam.position.set(beamLength*0.5-Side_len*0.5,beam_height-Side_len,-Side_len*0.5)
    Pole.add(pole_beam.clone());
  
    Pole.add(board)
  
    Pole.rotation.y += -90 * Math.PI / 180
    plus_index += (beamLength/Side_len)*4
  
    for (let i=0; i<makes; i++){Poles.add(Pole.clone())}
    return Poles
  }
  

  // --- 駅用ユーティリティ ---
  // 駅
  createStation(track_1,track_2,delicacy,y,margin,a){

    const points_1 = track_1.getPoints(delicacy);
    const points_2 = track_2.getPoints(delicacy);

    let track_1_diff = Math.atan2(points_1[1].x - points_1[0].x,points_1[1].z - points_1[0].z) + (90 * Math.PI/180)
    let track_1a_atan2 = 0
    let track_1b_atan2 = 0

    let track_1_s = 0
    let track_1_after = 0
    let track_1_m = points_1[0].clone();
    track_1_m.x -= Math.sin(track_1_diff) *margin; // dx
    track_1_m.z -= Math.cos(track_1_diff) *margin; // dy

    let track_1_f = points_1[1];

    let track_2_diff = Math.atan2(points_2[0].x - points_2[1].x,points_2[0].z - points_1[1].z) - (90 * Math.PI/180)
  
    let track_2a_atan2 = 0
    let track_2b_atan2 = 0

    let track_2_s = 0;
    let track_2_after = 0
    let track_2_m = points_2[0].clone();
    track_2_m.x += Math.sin(track_1_diff) *margin; // dx
    track_2_m.z += Math.cos(track_1_diff) *margin; // dy

    let track_2_f = points_2[1];

    for (let i = 1; i < delicacy-3; i++) {
  
      track_1_after = track_1_m.clone();
      
      track_1_s = points_1[i-1].clone();
      track_1_m = points_1[i].clone();
      track_1_f = points_1[i+1].clone();
  
      track_1a_atan2 = this.normalizeRad(Math.atan2(track_1_m.x-track_1_s.x,track_1_m.z-track_1_s.z));
      track_1b_atan2 = this.normalizeRad(Math.atan2(track_1_m.x-track_1_f.x,track_1_m.z-track_1_f.z));
      track_1b_atan2 -= track_1a_atan2;
      if (track_1b_atan2 < 0) {track_1b_atan2 += 6.283185307179586};
     
      track_1_diff = track_1a_atan2+track_1b_atan2*0.5;
      track_1_m.x -= Math.sin(track_1_diff) *margin; // dx
      track_1_m.z -= Math.cos(track_1_diff) *margin; // dy
     
      track_2_after = track_2_m.clone();
  
      track_2_s = points_2[i-1].clone();
      track_2_m = points_2[i].clone();
      track_2_f = points_2[i+1].clone();
  
      track_2a_atan2 = this.normalizeRad(Math.atan2(track_2_s.x-track_2_m.x,track_2_s.z-track_2_m.z));
      track_2b_atan2 = this.normalizeRad(Math.atan2(track_2_f.x-track_2_m.x,track_2_f.z-track_2_m.z));
  
      track_2b_atan2 -= track_2a_atan2;
      if (track_2b_atan2 < 0) {track_2b_atan2 += 6.283185307179586}
    
      track_2_diff = track_2a_atan2-track_2b_atan2*0.5;
  
      track_2_m.x += Math.sin(track_2_diff) *margin; // dx
      track_2_m.z += Math.cos(track_2_diff) *margin; // dy
  
      const shape = new THREE.Shape();
      shape.moveTo(track_1_after.x, track_1_after.z);
      shape.lineTo(track_1_m.x, track_1_m.z);
      shape.lineTo(track_2_m.x, track_2_m.z);
      shape.lineTo(track_2_after.x, track_2_after.z);
  
      const materials = [
        new THREE.MeshStandardMaterial({ color: 0x222222 }), // right
        new THREE.MeshStandardMaterial({ color: 0x444444 }), // left
        new THREE.MeshStandardMaterial({ color: 0x000000 }), // top
        new THREE.MeshStandardMaterial({ color: 0x000000 }), // bottom
        new THREE.MeshStandardMaterial({ color: 0x111111 }), // front
        new THREE.MeshStandardMaterial({ color: 0x000000 })  // back
      ];
      
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
      const material = new THREE.MeshBasicMaterial({ color: 0x869989, side: THREE.FrontSide });
      const mesh = new THREE.Mesh(geometry, materials);
  
      mesh.rotation.x = 90 * Math.PI / 180;
      mesh.position.y = y + 0.5//-0.4; // 高さ1.5に移動
  
      this.scene.add(mesh);
      
    }
  }
  // ホーム屋根 の作成
  placePlatformRoof(track_1,track_2,y,quantity) {
  
    const board_length_1 = track_1.getLength(track_1)/quantity;
    const board_length_2 = track_2.getLength(track_2)/quantity;
    const points_1 = this.RailMargin(this.getPointsEveryM(track_1, board_length_1), 0.7);
    const points_2 = this.RailMargin(this.getPointsEveryM(track_2, board_length_2), -0.7);
    
    if (points_1.length != points_2.length){console.log('Err: 不均一')}
  
  
    // 1. テクスチャ読み込み
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/roof.png');
    texture.colorSpace = THREE.SRGBColorSpace;
  
    // 表示位置
    texture.repeat.set(0.2, 0.2);   // サイズを50%
    texture.offset.set(0.25, 0.25); // 真ん中に寄せる
    
    // 2. 繰り返し設定
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  
    // 3. 幾何体サイズ（例：10m × 5m）
    const width = 0.6;
    const height = 0.4;
  
    // 4. 画像1枚 = 1m四方とみなして、自動で repeat を計算
    texture.repeat.set(width / 1, height / 1);
  
    // 5. マテリアルに貼る
    const material = new THREE.MeshStandardMaterial({ map: texture });
  
    const diff_x = points_1[0].x - points_2[0].x
    const diff_z = points_1[0].z - points_2[0].z
  
    let middle_0 = {}
    let middle_1 = {
      x: points_1[0].x - diff_x / 2,
      z: points_1[0].z - diff_z / 2
    }
  
    for (let i = 0; i < points_1.length-1; i++){
  
      // for (let i = 0; i < 1; i++){
      const diff_x = points_1[i+1].x - points_2[i+1].x
      const diff_z = points_1[i+1].z - points_2[i+1].z
  
      middle_0 = middle_1
      middle_1 = {
        x: points_1[i+1].x - diff_x / 2,
        z: points_1[i+1].z - diff_z / 2
      }
  
      // １番線
      const corner_1 = {
        x: middle_0.x - middle_1.x, 
        z: middle_0.z - middle_1.z}
      const diff_rotation = 0 - Math.atan2(corner_1.x,corner_1.z)
      const fixes_rotation_1 = Math.atan2(corner_1.x,corner_1.z) + diff_rotation
      const radius_1 = Math.sqrt(corner_1.x**2 + corner_1.z**2)
  
      const geometry = new THREE.BoxGeometry(0.15, 1.4, 0.15);
      const roofpillar = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: PILLAR_STEEL_COLOR,
          metalness: PILLAR_STEEL_METALNESS,
          roughness: PILLAR_STEEL_ROUGHNESS,
        }),
        4
      );
      roofpillar.position.x = middle_0.x-corner_1.x/2
      roofpillar.position.y = y-0.2
      roofpillar.position.z = middle_0.z-corner_1.z/2
      this.scene.add(roofpillar)
  
      const corner_2 = {
        x: middle_0.x - points_1[i].x, 
        z: middle_0.z - points_1[i].z}
      const fixes_rotation_2 = Math.atan2(corner_2.x,corner_2.z) + diff_rotation
      const radius_2 = Math.sqrt(corner_2.x**2 + corner_2.z**2)
  
      const corner_3 = {
        x: middle_0.x - points_1[i+1].x, 
        z: middle_0.z - points_1[i+1].z}
      const fixes_rotation_3 = Math.atan2(corner_3.x,corner_3.z) + diff_rotation
      const radius_3 = Math.sqrt(corner_3.x**2 + corner_3.z**2)
  
      // Map_pin(middle_0.x,middle_0.z,15,0.05,0x00ff00)
      // Map_pin(points_1[i].x,points_1[i].z,15,0.05,0x0000ff)
  
      // Map_pin(middle_1.x,middle_1.z,15,0.05,0x00ff00)
      // Map_pin(points_1[i+1].x,points_1[i+1].z,15,0.05,0x0000ff)
  
      const board_1 = new THREE.Shape();
      board_1.moveTo(0, 0);
      board_1.lineTo(Math.sin(fixes_rotation_1) * radius_1, Math.cos(fixes_rotation_1) * radius_1);
      board_1.lineTo(Math.sin(fixes_rotation_3) * radius_3,Math.cos(fixes_rotation_3) * radius_3);
      board_1.lineTo(Math.sin(fixes_rotation_2) * radius_2, Math.cos(fixes_rotation_2) * radius_2);
  
      const geometry_1 = new THREE.ExtrudeGeometry(board_1, { depth: 0.1, bevelEnabled: false });
      const mesh_1 = new THREE.Mesh(geometry_1, material);
  
      mesh_1.rotation.z = Math.atan2(corner_1.x,corner_1.z)
      mesh_1.rotation.x = -90 * Math.PI / 180;
      
      const cornerA = new THREE.Vector3(
        0, 
        0,
        0
      );
      
      const cornerB = new THREE.Vector3(
        Math.sin(fixes_rotation_1) * radius_1,
        Math.cos(fixes_rotation_1) * radius_1,
        0
      );
  
      // 1. 最新の点Aと点Bを取得（ローカル or ワールド座標で）
      const pointA_world = mesh_1.localToWorld(cornerA.clone());
      const pointB_world = mesh_1.localToWorld(cornerB.clone());
  
      // 2. 回転軸 = B - A（単位ベクトルに正規化）
      const axis = new THREE.Vector3().subVectors(pointB_world, pointA_world).normalize();
  
      // 3. クォータニオンで回転
      const angle = -170 * Math.PI / 180; // 例えば毎回2度ずつ回転させたいとき
      const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  
      // 4. 回転を適用
      mesh_1.applyQuaternion(quat);
  
      mesh_1.position.x = middle_0.x
      mesh_1.position.z = middle_0.z
      mesh_1.position.y = y+0.5; // 高さ1.5に移動
    
      this.scene.add(mesh_1);
  
      // 2番線
      const corner2_1 = {
        x: middle_0.x - middle_1.x, 
        z: middle_0.z - middle_1.z}
      const diff_rotation2 = 0 - Math.atan2(corner2_1.x,corner2_1.z)
      const fixes_rotation2_1 = Math.atan2(corner2_1.x,corner2_1.z) + diff_rotation2
      const radius2_1 = Math.sqrt(corner2_1.x**2 + corner2_1.z**2)
  
      const corner2_2 = {
        x: middle_0.x - points_2[i].x, 
        z: middle_0.z - points_2[i].z}
      const fixes_rotation2_2 = Math.atan2(corner2_2.x,corner2_2.z) + diff_rotation2
      const radius2_2 = Math.sqrt(corner2_2.x**2 + corner2_2.z**2)
  
      const corner2_3 = {
        x: middle_0.x - points_2[i+1].x, 
        z: middle_0.z - points_2[i+1].z}
      const fixes_rotation2_3 = Math.atan2(corner2_3.x,corner2_3.z) + diff_rotation2
      const radius2_3 = Math.sqrt(corner2_3.x**2 + corner2_3.z**2)
  
      // Map_pin(points_2[i].x,points_2[i].z,15,0.05,0xff0000)
      // Map_pin(points_2[i+1].x,points_2[i+1].z,15,0.05,0x000000)
  
      const board2_1 = new THREE.Shape();
      board2_1.moveTo(0, 0);
      board2_1.lineTo(Math.sin(fixes_rotation2_1) * radius2_1, Math.cos(fixes_rotation2_1) * radius2_1);
      board2_1.lineTo(Math.sin(fixes_rotation2_3) * radius2_3,Math.cos(fixes_rotation2_3) * radius2_3);
      board2_1.lineTo(Math.sin(fixes_rotation2_2) * radius2_2, Math.cos(fixes_rotation2_2) * radius2_2);
  
      const geometry2_1 = new THREE.ExtrudeGeometry(board2_1, { depth: 0.1, bevelEnabled: false });
      const mesh2_1 = new THREE.Mesh(geometry2_1, material);
  
      mesh2_1.rotation.z = Math.atan2(corner2_1.x,corner2_1.z)
      mesh2_1.rotation.x = -90 * Math.PI / 180;
      
      const corner2A = new THREE.Vector3(
        0, 
        0,
        0
      );
      
      const corner2B = new THREE.Vector3(
        Math.sin(fixes_rotation2_1) * radius2_1,
        Math.cos(fixes_rotation2_1) * radius2_1,
        0
      );
  
      // 1. 最新の点Aと点Bを取得（ローカル or ワールド座標で）
      const point2A_world = mesh2_1.localToWorld(corner2A.clone());
      const point2B_world = mesh2_1.localToWorld(corner2B.clone());
  
      // 2. 回転軸 = B - A（単位ベクトルに正規化）
      const axis2 = new THREE.Vector3().subVectors(point2B_world, point2A_world).normalize();
  
      // 3. クォータニオンで回転
      const angle2 = 170 * Math.PI / 180; // 例えば毎回2度ずつ回転させたいとき
      const quat2 = new THREE.Quaternion().setFromAxisAngle(axis2, angle2);
  
      // 4. 回転を適用
      mesh2_1.applyQuaternion(quat2);
  
      mesh2_1.position.x = middle_0.x
      mesh2_1.position.z = middle_0.z
      mesh2_1.position.y = y+0.5; // 高さ1.5に移動
    
      this.scene.add(mesh2_1);
  
    }
  }
  // ホームドア の生成
  placeTrainDoors(centerX, centerY, centerZ, angle, track_doors, totalLength = 4, doorCount = 4) {
    const spacing = totalLength / doorCount;   // ドア同士の中心間隔（例：1m）
    const doorWidth = 0.65;                    // ドアの横幅
    const half = (doorCount - 1) / 2;          // 例：4枚 → half = 1.5
  
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);
  
    const fence_point = spacing/2;
    const fenceLength = spacing - doorWidth;
  
    const fence_material = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.3,
      roughness: 0.15,
      envMapIntensity: 1.0,
      side: THREE.FrontSide
    });
  
    for (let i = 0; i < doorCount; i++) {
      const offset = (i - half) * spacing;      // -1.5, 1 -0.5, 1 +0.5, 1 +1.5（m）(ドアの横幅4mの場合)
      const x = centerX + dirX * offset;
      const z = centerZ + dirZ * offset;
      const y = centerY;
  
      // ドア(開閉部分)（横:可変長, 高さ0.37m, 厚さ0.03m）
      const door_0 = new THREE.Group();
      
      let door_center = 0.37/2
      let leng_move_door = 0.05
      
      let door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, leng_move_door, doorWidth/2), fence_material)
      door_object.position.set(0,door_center-leng_move_door*0.5,0)
      door_0.add(door_object)
  
      door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, leng_move_door, doorWidth/2), fence_material)
      door_object.position.set(0,(-door_center)+leng_move_door*0.5,0)
      door_0.add(door_object)
      
      const over_space = 0.045
      const half_fence = (fenceLength/2) + over_space
      const half_fence_diff = half_fence/2 - over_space
      
      const door_1 = door_0.clone(true);
      
      door_center = doorWidth/4
      leng_move_door = 0.015
    
      door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.37, leng_move_door), fence_material)
      door_object.position.set(0,0,(-door_center)+leng_move_door*0.5)
      door_0.add(door_object)
  
      door_object = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.37, leng_move_door), fence_material)
      door_object.position.set(0,0,door_center-leng_move_door*0.5)
      door_1.add(door_object)
  
  
      // ドア:右
      door_0.position.set(x+dirX*doorWidth/4, y+0.005, z+dirZ*doorWidth/4);
      door_0.rotation.y = angle;
    
      // ドア:左
      door_1.position.set(x-dirX*doorWidth/4, y+0.005, z-dirZ*doorWidth/4);
      door_1.rotation.y = angle;
    
      track_doors.add(door_0);
      track_doors.add(door_1);
  
      // 柵(非開閉部分)（横:可変長, 高さ0.45m, 厚さ0.07m）
      if ( i === 0 ){
        const fence_geometry = new THREE.BoxGeometry(0.07, 0.45, half_fence);
        const fence = new THREE.Mesh(fence_geometry, fence_material);
        
        // 高さ中央をY=ドア中心に（例：y+1）
        fence.position.set(centerX + dirX * (offset-fence_point+half_fence_diff), y, centerZ + dirZ * (offset-fence_point+half_fence_diff));
        fence.rotation.y = angle;
        this.scene.add(fence);
      }
      
      if (i === 3) {
        const fence_geometry = new THREE.BoxGeometry(0.07, 0.45, half_fence);
        const fence = new THREE.Mesh(fence_geometry, fence_material);
  
        // 高さ中央をY=ドア中心に（例：y+1）
        fence.position.set(centerX + dirX * (offset+fence_point-half_fence_diff), y, centerZ + dirZ * (offset+fence_point-half_fence_diff));
        fence.rotation.y = angle;
        this.scene.add(fence);
  
      } else {
        const fence_geometry = new THREE.BoxGeometry(0.07, 0.45, fenceLength);
        const fence = new THREE.Mesh(fence_geometry, fence_material);
  
        // 高さ中央をY=ドア中心に（例：y+1）
        fence.position.set(centerX + dirX * (offset+fence_point), y, centerZ + dirZ * (offset+fence_point));
        fence.rotation.y = angle;
        this.scene.add(fence);
      }
    }
    
    this.scene.add(track_doors);
    return track_doors;
  }

  // ホームドア場所の計算
  placePlatformDoors(curve, offset = 1, interval = 25, side = 'left') {
    const points = this.getPointsEveryM(curve, interval);
    let track_doors = new THREE.Group();
  
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
  
      const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
      const dist = p1.distanceTo(p2);
  
      // 中点をラジアンと長さで計算
      const midX = p1.x + Math.sin(angle) * (dist / 2);
      const midZ = p1.z + Math.cos(angle) * (dist / 2);
  
      // 左右方向のオフセット
      const direction = (side === 'left') ? 1 : -1;
      const offsetAngle = angle + direction * Math.PI / 2;
  
      const x = midX - Math.sin(offsetAngle) * offset;
      const z = midZ - Math.cos(offsetAngle) * offset;
  
      track_doors = this.placeTrainDoors(x, p1.y+0.7, z, angle, track_doors, interval);  // 中心点と角度を渡すだけ！
    }
    return track_doors
  }
  
  // ---- エスカレーター ----
  // 斜め前カットのステップ形状を返す関数
  createEscalatorStepMesh() {
    const shape = new THREE.Shape();
    shape.moveTo(0.3, 0.15);    // 1. 上奥  
    shape.lineTo(0, 0.15);      // 2. 上手前 2 . - . 1
    shape.lineTo(0.015, 0.075); // 3. 中手前  3 .  |
    shape.lineTo(0.06, -0.015); // 4. 下       4  .
    // shape.lineTo(0.015, 0.075); // 3. 上手前
    // shape.lineTo(0, 0.15);      // 2. 中手前
  
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.8,               // ステップの奥行き
      bevelEnabled: false,
    });
  
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/step.png'); // ← パスを適宜変更
    texture.colorSpace = THREE.SRGBColorSpace;
  
    const material = new THREE.MeshStandardMaterial({
      map: texture,           // ← テクスチャ画像を適用
      color: 0xffffff,        // ← 色も併用可能（色 × テクスチャ）
    });
  
    geometry.center(); // ← これを追加すると原点中心になります
  
    const mesh = new THREE.Mesh(geometry, material);
    // 形状が縦に立っているので寝かせる
    mesh.rotation.y = -Math.PI / 2;
    return mesh;
  }
  
  createSteps(numSteps = 5) {
    const group = [];
  
    for (let i = 0; i < numSteps; i++) {
      const step = this.createEscalatorStepMesh();
  
      // ステップを少しずつ後ろに配置（例：0.3m間隔）
      step.position.y = 0; // 高さは固定
      step.position.z = i * -0.35; // 奥に並べる
  
      this.scene.add(step);
      group.push(step);
    }
  
    return group;
  }

  // エレベーター🛗
  
  // ドアを生成する補助関数
  createDualSidedDoor(geometry, position, bodyFront, bodyBack, rotation_y = false) {
    const meshFront = new THREE.Mesh(geometry, bodyFront);
    const meshBack = new THREE.Mesh(geometry, bodyBack);
    meshFront.position.copy(position);
    meshBack.position.copy(position);
    meshBack.scale.z = -0.009;
    if (rotation_y !== false) {
      meshFront.rotation.y = rotation_y;
      meshBack.rotation.y = rotation_y;
    }
    rotation_y = meshFront.rotation.y;
    meshBack.position.x += Math.sin(rotation_y) * 0.005;
    meshBack.position.z += Math.cos(rotation_y) * 0.005;
    const group = new THREE.Group();
    group.add(meshFront);
    group.add(meshBack);
    return group;
  }
  
  // ----- ドアグループ作成（A1〜D2） -----
  makeDoorGroupA1(xOffset = 0, yOffset = 0, zOffset = 0, door_x, y, z, door_z_diff, bodyFront, bodyBack) {
    const group = new THREE.Group();
    const doorGeometry1 = new THREE.BoxGeometry(0.0425, 0.75, 0.01);
    const doorGeometry2 = new THREE.BoxGeometry(0.085, 0.1, 0.01);
    const doorGeometry3 = new THREE.BoxGeometry(0.085, 0.25, 0.01);
    const doorGeometry4 = new THREE.BoxGeometry(0.0425, 0.75, 0.01);

    group.add(this.createDualSidedDoor(doorGeometry1, new THREE.Vector3(door_x + xOffset, y + 0.375 + yOffset, z + door_z_diff + zOffset), bodyFront, bodyBack, Math.PI));
    group.add(this.createDualSidedDoor(doorGeometry2, new THREE.Vector3(door_x + 0.06375 + xOffset, y + 0.7 + yOffset, z + door_z_diff + zOffset), bodyFront, bodyBack, Math.PI));
    group.add(this.createDualSidedDoor(doorGeometry3, new THREE.Vector3(door_x + 0.06375 + xOffset, y + 0.125 + yOffset, z + door_z_diff + zOffset), bodyFront, bodyBack, Math.PI));
    group.add(this.createDualSidedDoor(doorGeometry4, new THREE.Vector3(door_x + 0.1275 + xOffset, y + 0.375 + yOffset, z + door_z_diff + zOffset), bodyFront, bodyBack, Math.PI));
    return group;
  }

  createElevator(x, y, z, scale_x=1, scale_z=1, glass_material, metal_material, bodyFront, bodyBack, F1=false) {
    const ElevatorGaugeGroup = new THREE.Group();
    const ElevatorBodyGroup = new THREE.Group();
    const ElevatorDoorGroup_gate = new THREE.Group();
    const ElevatorDoorGroup_body = new THREE.Group();
  
    const pos_x = x
    const pos_y = y
    const pos_z = z
  
    x = 0
    y = 0
    z = 0
  
    // 各パラメータ定義（元のコードから）
    const x_len = 0.9;
    const z_len = 1.2;
    const thickness = 0.02;
    const thickness_diff_x = x_len - thickness;
    const thickness_diff_z = z_len - thickness;
    const gaugebody_space = 0.15;
    const body_x_len = x_len - gaugebody_space * 2;
    const body_z_len = z_len - gaugebody_space * 2;
    const elevatorz_center = z + gaugebody_space + body_z_len / 2;
    const door_z_diff = z_len - 0.1785;
  
    // ----- Glass and Metal Frames -----
    let glassGeometry = new THREE.BoxGeometry(thickness_diff_x, 0.8, 0.01);
    let glassMesh = new THREE.Mesh(glassGeometry, glass_material);
    glassMesh.position.set(x, y + 0.5, z);
    ElevatorGaugeGroup.add(glassMesh);
  
    let metalGeometry = new THREE.BoxGeometry(thickness_diff_x, 0.1, 0.02);
    let metalMesh = new THREE.Mesh(metalGeometry, metal_material);
    metalMesh.position.set(x, y + 0.05, z);
    ElevatorGaugeGroup.add(metalMesh);
  
    glassGeometry = new THREE.BoxGeometry(0.01, 0.8, thickness_diff_z);
    glassMesh = new THREE.Mesh(glassGeometry, glass_material);
    glassMesh.position.set(x + x_len / 2, y + 0.5, z + z_len / 2);
    ElevatorGaugeGroup.add(glassMesh);
  
    metalGeometry = new THREE.BoxGeometry(0.02, 0.1, thickness_diff_z);
    metalMesh = new THREE.Mesh(metalGeometry, metal_material);
    metalMesh.position.set(x + x_len / 2, y + 0.05, z + z_len / 2);
    ElevatorGaugeGroup.add(metalMesh);
  
    glassMesh = new THREE.Mesh(glassGeometry, glass_material);
    glassMesh.position.set(x + x_len / 2, y + 0.5, z + z_len / 2);
    ElevatorGaugeGroup.add(glassMesh);
  
    metalMesh = new THREE.Mesh(metalGeometry, metal_material);
    metalMesh.position.set(x - x_len / 2, y + 0.05, z + z_len / 2);
    ElevatorGaugeGroup.add(metalMesh);
  
    glassGeometry = new THREE.BoxGeometry(thickness_diff_x / 9, 0.8, 0.01);
    glassMesh = new THREE.Mesh(glassGeometry, glass_material);
    glassMesh.position.set(x + x_len / 2 - thickness_diff_x / 18 - thickness / 2, y + 0.5, z + z_len);
    ElevatorGaugeGroup.add(glassMesh);
  
    const geom3 = new THREE.BoxGeometry(thickness_diff_x / 9, 0.1, thickness);
    glassMesh = new THREE.Mesh(geom3, new THREE.MeshStandardMaterial(metal_material));
    glassMesh.position.set(x + x_len / 2 - thickness_diff_x / 18 - thickness / 2, y + 0.05, z + z_len);
    ElevatorGaugeGroup.add(glassMesh);
  
    glassGeometry = new THREE.BoxGeometry(thickness_diff_x / 9, 0.8, 0.01);
    glassMesh = new THREE.Mesh(glassGeometry, glass_material);
    glassMesh.position.set(x - x_len / 2 + thickness_diff_x / 18 + thickness / 2, y + 0.5, z + z_len);
    ElevatorGaugeGroup.add(glassMesh);
  
    glassMesh = new THREE.Mesh(geom3, new THREE.MeshStandardMaterial(metal_material));
    glassMesh.position.set(x - x_len / 2 + thickness_diff_x / 18 + thickness / 2, y + 0.05, z + z_len);
    ElevatorGaugeGroup.add(glassMesh);
  
    glassGeometry = new THREE.BoxGeometry(0.195, 0.8, 0.01);
    glassMesh = new THREE.Mesh(glassGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
    glassMesh.position.set(x - x_len / 2 + thickness_diff_x / 18 + thickness / 2 + 0.0975 + thickness_diff_x / 18, y + 0.5, z + z_len);
    ElevatorGaugeGroup.add(glassMesh);
  
    const geom4 = new THREE.BoxGeometry(0.195, 0.1, thickness);
    glassMesh = new THREE.Mesh(geom4, new THREE.MeshStandardMaterial(metal_material));
    glassMesh.position.set(x - x_len / 2 + thickness_diff_x / 18 + thickness / 2 + 0.0975 + thickness_diff_x / 18, y + 0.05, z + z_len);
    ElevatorGaugeGroup.add(glassMesh);
  
    // 横棒・縦棒
    const geom1 = new THREE.BoxGeometry(thickness, 0.9, 0.001);
    const geom2 = new THREE.BoxGeometry(0.001, 0.9, thickness);
  
    const barPositions = [
      [x + x_len / 2, y + 0.45, z + thickness / 2, geom1],
      [x + x_len / 2 - thickness / 2, y + 0.45, z, geom2],
      [x - x_len / 2, y + 0.45, z + thickness / 2, geom1],
      [x - x_len / 2 + thickness / 2, y + 0.45, z, geom2],
      [x - x_len / 2, y + 0.45, z + z_len - thickness / 2, geom1],
      [x - x_len / 2 + thickness / 2, y + 0.45, z + z_len, geom2],
      [x + x_len / 2, y + 0.45, z + z_len - thickness / 2, geom1],
      [x + x_len / 2 - thickness / 2, y + 0.45, z + z_len, geom2],
    ];
  
    for (const [px, py, pz, geom] of barPositions) {
      const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial(metal_material));
      mesh.position.set(px, py, pz);
      ElevatorGaugeGroup.add(mesh);
    }
  
    // gate / 上部ボックス
    let gate1 = new THREE.BoxGeometry(0.08, 0.75, 0.22);
    let mesh = new THREE.Mesh(gate1, new THREE.MeshStandardMaterial(metal_material));
    mesh.position.set(x + x_len / 2 - thickness_diff_x / 18 - thickness / 2 - thickness_diff_x / 18 - 0.04, y + 0.375, z + z_len - 0.1 + 0.02);
    ElevatorGaugeGroup.add(mesh);
  
    gate1 = new THREE.BoxGeometry(0.08, 0.75, 0.185);
    mesh = new THREE.Mesh(gate1, new THREE.MeshStandardMaterial(metal_material));
    mesh.position.set(x + x_len / 2 - thickness_diff_x / 18 - thickness / 2 - thickness_diff_x / 18 - 0.45, y + 0.375, z + z_len - 0.1 + 0.0375);
    ElevatorGaugeGroup.add(mesh);
  
    const gateGeometry = new THREE.BoxGeometry(0.49, 0.15, 0.22);
    const gateMesh = new THREE.Mesh(gateGeometry, new THREE.MeshStandardMaterial(metal_material));
    gateMesh.position.set(x + x_len / 2 - thickness_diff_x / 18 - thickness / 2 - thickness_diff_x / 18 - 0.04 - 0.205, y + 0.75 + 0.075, z + z_len - 0.1 + 0.02);
    ElevatorGaugeGroup.add(gateMesh);
  
    const box = new THREE.BoxGeometry(x_len, 0.2, z_len);
    mesh = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: 0x222222 }));
    mesh.position.set(x, y + 1, z + z_len / 2);
    ElevatorGaugeGroup.add(mesh);
  
    if (F1 === true){  
    const box2 = new THREE.BoxGeometry(x_len, 2, z_len);
    mesh = new THREE.Mesh(box2, new THREE.MeshStandardMaterial(glass_material));
    mesh.position.set(x, y + 2.1, z + z_len / 2);
    ElevatorGaugeGroup.add(mesh);
    }
  
    // ----- ElevatorBodyGroup 作成 -----
    let wall_x = x - x_len / 2 + (x_len - gaugebody_space);
    const bodyGeometry1 = new THREE.BoxGeometry(body_z_len, 0.35, 0.01);
    const bodyGeometry2 = new THREE.BoxGeometry(body_z_len * 0.1, 0.4, 0.01);
    const bodyGeometry3 = new THREE.BoxGeometry(body_z_len, 0.1, 0.01);
  
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry1, new THREE.Vector3(wall_x, y + 0.175, elevatorz_center), bodyFront, bodyBack, -Math.PI / 2));
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry2, new THREE.Vector3(wall_x, y + 0.55, elevatorz_center + body_z_len * 0.5 - body_z_len * 0.05),bodyFront, bodyBack, -Math.PI / 2));
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry2, new THREE.Vector3(wall_x, y + 0.55, elevatorz_center - body_z_len * 0.5 + body_z_len * 0.05), bodyFront, bodyBack, -Math.PI / 2));
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry3, new THREE.Vector3(wall_x, y + 0.8, elevatorz_center), bodyFront, bodyBack, -Math.PI / 2));
  
    wall_x = x + x_len / 2 - (x_len - gaugebody_space);
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry1, new THREE.Vector3(wall_x, y + 0.175, elevatorz_center), bodyFront, bodyBack, Math.PI / 2));
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry2, new THREE.Vector3(wall_x, y + 0.55, elevatorz_center + body_z_len * 0.5 - body_z_len * 0.05), bodyFront, bodyBack, Math.PI / 2));
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry2, new THREE.Vector3(wall_x, y + 0.55, elevatorz_center - body_z_len * 0.5 + body_z_len * 0.05), bodyFront, bodyBack, Math.PI / 2));
    ElevatorBodyGroup.add(this.createDualSidedDoor(bodyGeometry3, new THREE.Vector3(wall_x, y + 0.8, elevatorz_center), bodyFront, bodyBack, Math.PI / 2));
   
    const door_x = x + x_len / 2 - thickness_diff_x / 18 - thickness / 2 - thickness_diff_x / 18 - 0.04 - 0.205 + 0.02125// - 0.045    group.add(createDualSidedDoor(doorGeometry1, new THREE.Vector3(door_x + xOffset, y + 0.375 + yOffset, z + door_z_diff + zOffset), Math.PI));
    ElevatorDoorGroup_gate.add(this.makeDoorGroupA1(0, 0, 0, door_x, y, z, door_z_diff, bodyFront, bodyBack));
    ElevatorDoorGroup_gate.add(this.makeDoorGroupA1(-0.17, 0, 0.0125, door_x, y, z, door_z_diff, bodyFront, bodyBack));
    ElevatorDoorGroup_body.add(this.makeDoorGroupA1(0, 0, -0.02, door_x, y, z, door_z_diff, bodyFront, bodyBack));
    ElevatorDoorGroup_body.add(this.makeDoorGroupA1(-0.17, 0, -0.0325, door_x, y, z, door_z_diff, bodyFront, bodyBack));
  
    const elevatorGroup = new THREE.Group();
    elevatorGroup.add(ElevatorGaugeGroup);
    elevatorGroup.add(ElevatorDoorGroup_gate);
    elevatorGroup.add(ElevatorDoorGroup_body);
    if (F1===true){elevatorGroup.add(ElevatorBodyGroup)};
  
    elevatorGroup.scale.x = scale_x
    elevatorGroup.scale.z = scale_z
  
    elevatorGroup.position.set(pos_x,pos_y,pos_z)
    //rotation
    return elevatorGroup;
  }
  
  updateObjectOnPath(path, time=0, speed=0.0005) {
    const Equal_path = this.getPointsEveryM(path, 0.005); // spacing=0.1mごと（細かすぎたら25に）
    const length = path.getLength(path);
    const step_depth = 0.3
    const depth_idx = step_depth/length
    const steps_num = Math.floor(length/step_depth)
    const step_diff = depth_idx * steps_num
    const steps = this.createSteps(steps_num);
    const leng = Equal_path.length-1
  
    // 1. 長方形の幅と高さを指定（例：幅3、高さ1.5）
    const width = 0.6;
    const height = 1;
  
    // 2. 形状を作成（PlaneGeometry はXZ平面ではなくXY平面）
    const geometry = new THREE.PlaneGeometry(height, width);
  
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load('textures/roof.png'); // ← パスを適宜変更
    texture.colorSpace = THREE.SRGBColorSpace;
  
    // 3. マテリアル（色やテクスチャ）を設定
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      // color: 0x00ff00,
      side: THREE.DoubleSide // 裏からも見えるようにする
    });
  
    // 4. メッシュを作成してシーンに追加
    const rectangle = new THREE.Mesh(geometry, material);
  
    rectangle.rotation.x = -Math.PI/2;
    // rectangle.rotation.z = -Math.PI/2;
    const point = 0
    rectangle.position.set(Equal_path[point].x,Equal_path[point].y+0.085,Equal_path[point].z); 
    this.scene.add(rectangle);
  
    const rectangle2 = new THREE.Mesh(geometry, material);
    rectangle2.rotation.x = -Math.PI/2;
    const point2 = Math.floor(leng * step_diff)
    rectangle2.position.set(Equal_path[point2].x,Equal_path[point2].y+0.085,Equal_path[point2].z); 
    this.scene.add(rectangle2);
  
    function moveObject(){
      for (let i =0; i < steps_num; i++){
        steps[i].position.copy(Equal_path[Math.floor(leng*((time+i*depth_idx)%step_diff))]);
      }
      if (time >= step_diff){time = 0}else{time+=speed};
      requestAnimationFrame(moveObject);
    };
    moveObject();
  }  
  

  // --- アニメーション ---

  // 桁橋 の作成
  placeGirderBridge(track_1,track_2,y,quantity) {
  
  const board_length_1 = track_1.getLength(track_1)/quantity;
  const board_length_2 = track_2.getLength(track_2)/quantity;
  const points_data_1 = this.RailMargin(this.getPointsEveryM(track_1, board_length_1), -0.7, true);
  const points_1 = points_data_1[0]
  const angles_1 = points_data_1[1]
  const points_data_2 = this.RailMargin(this.getPointsEveryM(track_2, board_length_2), 0.7, true);
  const points_2 = points_data_2[0]
  const angles_2 = points_data_2[1]
  
  if (points_1.length != points_2.length){console.log('Err: 不均一')}

  const material = new THREE.MeshStandardMaterial({//color: 0x3399cc 
    color: 0xffffff,      // 暗めのグレー（鉄色）
    metalness: 0.8,       // 金属光沢最大
    roughness: 0.5,       // 少しザラザラ（低くするとツルツル）
    envMapIntensity: 1.0,    // 環境マップの反射強度（envMapを使うなら）
    side: THREE.FrontSide,
  });

  const diff_x = points_1[0].x - points_2[0].x
  const diff_z = points_1[0].z - points_2[0].z

  let middle_0 = {}
  let middle_1 = {
    x: points_1[0].x - diff_x / 2,
    z: points_1[0].z - diff_z / 2,
    y: y
  }
  
  let Bridge_width_1 = Math.sqrt(diff_x**2+diff_z**2)-0.1
  let Angle_1 = Math.atan2(diff_x,diff_z)
  
  for (let i = 0; i < points_1.length-1; i++){

    // for (let i = 0; i < 1; i++){
    const diff_x = points_1[i+1].x - points_2[i+1].x
    const diff_z = points_1[i+1].z - points_2[i+1].z

    middle_0 = middle_1
    middle_1 = {
      x: points_1[i+1].x - diff_x / 2,
      z: points_1[i+1].z - diff_z / 2,
      y: y
    }
    
    const Bridge_width_0 = Bridge_width_1
    Bridge_width_1 = Math.sqrt(diff_x**2+diff_z**2)

    const beam_num = 3
    const cut_len = -0.5

    const margin_0 = (Bridge_width_0/(beam_num-1))*0.5
    const margin_1 = (Bridge_width_1/(beam_num-1))*0.5
    const half = (beam_num+1)%2

    const Angle_0 = Angle_1
    Angle_1 = Math.atan2(diff_x,diff_z)

    for (let i = 0; i<Math.floor(beam_num/2); i++){
      this.scene.add(this.createBoxBetweenPoints3D(({x: middle_0.x+Math.sin(Angle_0)*margin_0*(((i+1)*2)-half)+Math.sin(angles_1[i])*cut_len,z: middle_0.z+Math.cos(Angle_0)*margin_0*(((i+1)*2)-half)+Math.cos(angles_1[i])*cut_len, y: y}),
                                                   ({x: middle_1.x+Math.sin(Angle_1)*margin_1*(((i+1)*2)-half)+Math.sin(angles_1[i+1])*cut_len,z: middle_1.z+Math.cos(Angle_1)*margin_1*(((i+1)*2)-half)+Math.cos(angles_1[i+1])*cut_len, y: y}),0.7,0.2,material))
    };
    for (let i = 0; i<Math.floor(beam_num/2); i++){
      this.scene.add(this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(Angle_0)*margin_0*(((i+1)*2)-half)-Math.sin(angles_2[i])*cut_len,z: middle_0.z-Math.cos(Angle_0)*margin_0*(((i+1)*2)-half)-Math.cos(angles_2[i])*cut_len, y: y}),
                                                   ({x: middle_1.x-Math.sin(Angle_1)*margin_1*(((i+1)*2)-half)-Math.sin(angles_2[i+1])*cut_len,z: middle_1.z-Math.cos(Angle_1)*margin_1*(((i+1)*2)-half)-Math.cos(angles_2[i+1])*cut_len, y: y}),0.7,0.2,material))
      };
    
    if (beam_num%2 === 1){
        for (let i = 0; i<Math.floor(beam_num/2); i++){
            this.scene.add(this.createBoxBetweenPoints3D(middle_0,middle_1,0.7,0.2,material))
          };        
    }

    // for (let i = 0; i<beam_num/2; i++){
    //     this.scene.add(this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(angles_1[i])*margin_0*(i*2+half),z: middle_0.z-Math.cos(angles_1[i])*margin_0*(i*2+1), y: y}),
    //                                                  ({x: middle_1.x-Math.sin(angles_1[i+1])*margin_1*(i*2+half),z: middle_1.z-Math.cos(angles_1[i+1])*margin_1*(i*2+1), y: y}),0.7,0.2,material))
  
    //   };
  
    // const beam_3 = this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(angles_1[i])*margin_0,z: middle_0.z-Math.cos(angles_1[i])*margin_0, y: y}),
    //                                              ({x: middle_1.x-Math.sin(angles_1[i+1])*margin_1,z: middle_1.z-Math.cos(angles_1[i+1])*margin_1, y: y}),1,0.2,material)
    // const beam_4 = this.createBoxBetweenPoints3D(({x: middle_0.x-Math.sin(angles_1[i])*margin_0*3,z: middle_0.z-Math.cos(angles_1[i])*margin_0*3, y: y}),
    //                                              ({x: middle_1.x-Math.sin(angles_1[i+1])*margin_1*3,z: middle_1.z-Math.cos(angles_1[i+1])*margin_1*3, y: y}),1,0.2,material)

    // beam_1.position.set(middle_1.x,middle_1.y,middle_1.z)
    // this.scene.add(beam_1)
    // this.scene.add(beam_3)
    // this.scene.add(beam_4)
}
}
}
