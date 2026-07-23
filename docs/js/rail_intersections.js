function toPoint(value) {
  return {
    x: Number(value?.x) || 0,
    y: Number(value?.y) || 0,
    z: Number(value?.z) || 0,
  };
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function lerpPoint(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function distanceSqXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return (dx * dx) + (dz * dz);
}

function distanceXZ(a, b) {
  return Math.sqrt(distanceSqXZ(a, b));
}

function distance3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += distance3D(points[i - 1], points[i]);
  }
  return length;
}

export const RAIL_SIDE_RIGHT = 0;
export const RAIL_SIDE_LEFT = 1;
export const RAIL_SIDE_CODE_TO_NAME = Object.freeze({
  [RAIL_SIDE_RIGHT]: 'right',
  [RAIL_SIDE_LEFT]: 'left',
});

function normalizeRailSide(side) {
  return String(side || '').trim().toLowerCase() === 'left' ? 'left' : 'right';
}

function getRailOffsets(options = {}) {
  const halfGauge = Math.max(0.01, Number(options.railOffset) || 0.42);
  return {
    right: halfGauge,
    left: -halfGauge,
  };
}

function offsetPolyline(points, offset) {
  if (!Array.isArray(points) || points.length < 1) {
    return [];
  }
  return points.map((point, index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangentX = next.x - prev.x;
    const tangentZ = next.z - prev.z;
    const length = Math.sqrt((tangentX * tangentX) + (tangentZ * tangentZ));
    if (length <= 1e-9) {
      return toPoint(point);
    }
    const rightX = tangentZ / length;
    const rightZ = -tangentX / length;
    return {
      x: point.x + (rightX * offset),
      y: point.y,
      z: point.z + (rightZ * offset),
    };
  });
}

function segmentBoundsOverlapXZ(a0, a1, b0, b1, padding = 0) {
  const aMinX = Math.min(a0.x, a1.x) - padding;
  const aMaxX = Math.max(a0.x, a1.x) + padding;
  const aMinZ = Math.min(a0.z, a1.z) - padding;
  const aMaxZ = Math.max(a0.z, a1.z) + padding;
  const bMinX = Math.min(b0.x, b1.x) - padding;
  const bMaxX = Math.max(b0.x, b1.x) + padding;
  const bMinZ = Math.min(b0.z, b1.z) - padding;
  const bMaxZ = Math.max(b0.z, b1.z) + padding;
  return !(aMaxX < bMinX || bMaxX < aMinX || aMaxZ < bMinZ || bMaxZ < aMinZ);
}

function intersectSegmentsXZ(a0, a1, b0, b1, epsilon = 1e-9) {
  const rX = a1.x - a0.x;
  const rZ = a1.z - a0.z;
  const sX = b1.x - b0.x;
  const sZ = b1.z - b0.z;
  const denom = (rX * sZ) - (rZ * sX);
  const qpX = b0.x - a0.x;
  const qpZ = b0.z - a0.z;
  if (Math.abs(denom) <= epsilon) {
    return null;
  }
  const uA = ((qpX * sZ) - (qpZ * sX)) / denom;
  const uB = ((qpX * rZ) - (qpZ * rX)) / denom;
  if (uA < -epsilon || uA > 1 + epsilon || uB < -epsilon || uB > 1 + epsilon) {
    return null;
  }
  const tA = Math.min(1, Math.max(0, uA));
  const tB = Math.min(1, Math.max(0, uB));
  const pointA = lerpPoint(a0, a1, tA);
  const pointB = lerpPoint(b0, b1, tB);
  return {
    ua: tA,
    ub: tB,
    pointA,
    pointB,
    point: {
      x: (pointA.x + pointB.x) * 0.5,
      y: (pointA.y + pointB.y) * 0.5,
      z: (pointA.z + pointB.z) * 0.5,
    },
    distanceXZ: distanceXZ(pointA, pointB),
    distance3D: distance3D(pointA, pointB),
    yDelta: Math.abs(pointA.y - pointB.y),
  };
}

function closestPointOnSegmentXZ(point, a, b) {
  const abX = b.x - a.x;
  const abZ = b.z - a.z;
  const lenSq = (abX * abX) + (abZ * abZ);
  if (lenSq <= 1e-12) {
    return {
      t: 0,
      point: toPoint(a),
      distanceXZ: distanceXZ(point, a),
    };
  }
  const apX = point.x - a.x;
  const apZ = point.z - a.z;
  const rawT = ((apX * abX) + (apZ * abZ)) / lenSq;
  const t = Math.min(1, Math.max(0, rawT));
  const nearest = lerpPoint(a, b, t);
  return {
    t,
    point: nearest,
    distanceXZ: distanceXZ(point, nearest),
  };
}

function closestSegmentPair(a0, a1, b0, b1) {
  const intersection = intersectSegmentsXZ(a0, a1, b0, b1);
  if (intersection) {
    return intersection;
  }

  const candidates = [];
  const a0ToB = closestPointOnSegmentXZ(a0, b0, b1);
  candidates.push({
    ua: 0,
    ub: a0ToB.t,
    pointA: toPoint(a0),
    pointB: a0ToB.point,
  });
  const a1ToB = closestPointOnSegmentXZ(a1, b0, b1);
  candidates.push({
    ua: 1,
    ub: a1ToB.t,
    pointA: toPoint(a1),
    pointB: a1ToB.point,
  });
  const b0ToA = closestPointOnSegmentXZ(b0, a0, a1);
  candidates.push({
    ua: b0ToA.t,
    ub: 0,
    pointA: b0ToA.point,
    pointB: toPoint(b0),
  });
  const b1ToA = closestPointOnSegmentXZ(b1, a0, a1);
  candidates.push({
    ua: b1ToA.t,
    ub: 1,
    pointA: b1ToA.point,
    pointB: toPoint(b1),
  });

  candidates.sort((left, right) => (
    distanceSqXZ(left.pointA, left.pointB) - distanceSqXZ(right.pointA, right.pointB)
  ));
  const best = candidates[0];
  return {
    ua: best.ua,
    ub: best.ub,
    pointA: best.pointA,
    pointB: best.pointB,
    point: {
      x: (best.pointA.x + best.pointB.x) * 0.5,
      y: (best.pointA.y + best.pointB.y) * 0.5,
      z: (best.pointA.z + best.pointB.z) * 0.5,
    },
    distanceXZ: distanceXZ(best.pointA, best.pointB),
    distance3D: distance3D(best.pointA, best.pointB),
    yDelta: Math.abs(best.pointA.y - best.pointB.y),
  };
}

function samplePointAt(track, t) {
  if (track?.curve && typeof track.curve.getPointAt === 'function') {
    return toPoint(track.curve.getPointAt(t));
  }
  const rawPoints = Array.isArray(track?.points) ? track.points.map(toPoint) : [];
  if (rawPoints.length < 1) {
    return { x: 0, y: 0, z: 0 };
  }
  if (rawPoints.length === 1) {
    return rawPoints[0];
  }
  const scaled = Math.min(1, Math.max(0, t)) * (rawPoints.length - 1);
  const index = Math.min(rawPoints.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  return lerpPoint(rawPoints[index], rawPoints[index + 1], localT);
}

export function getTrackReferenceFrame(track, options = {}) {
  const referenceT = Math.max(0, Math.min(1, Number(options.referenceT) || 0.5));
  const deltaT = Math.max(1e-4, Number(options.referenceDeltaT) || 0.01);
  const center = samplePointAt(track, referenceT);
  const prev = samplePointAt(track, Math.max(0, referenceT - deltaT));
  const next = samplePointAt(track, Math.min(1, referenceT + deltaT));
  let tangentX = next.x - prev.x;
  let tangentZ = next.z - prev.z;
  let tangentLen = Math.sqrt((tangentX * tangentX) + (tangentZ * tangentZ));

  if (tangentLen <= 1e-9) {
    const controlPoints = Array.isArray(track?.points) ? track.points.map(toPoint) : [];
    for (let i = 1; i < controlPoints.length; i += 1) {
      tangentX = controlPoints[i].x - controlPoints[i - 1].x;
      tangentZ = controlPoints[i].z - controlPoints[i - 1].z;
      tangentLen = Math.sqrt((tangentX * tangentX) + (tangentZ * tangentZ));
      if (tangentLen > 1e-9) {
        break;
      }
    }
  }

  if (tangentLen <= 1e-9) {
    tangentX = 0;
    tangentZ = 1;
    tangentLen = 1;
  }

  const forward = {
    x: tangentX / tangentLen,
    z: tangentZ / tangentLen,
  };
  const right = {
    x: forward.z,
    z: -forward.x,
  };
  const yawFromZeroDeg = Math.atan2(forward.x, forward.z);

  return {
    t: referenceT,
    center,
    forward,
    right,
    yawFromZeroDeg,
    zeroDegreeAxis: { x: 0, z: 1 },
  };
}

export function sampleTrack(track, options = {}) {
  const controlPoints = Array.isArray(track?.points) ? track.points.map(toPoint) : [];
  const fallbackLength = controlPoints.length > 1 ? polylineLength(controlPoints) : 0;
  const curveLength = track?.curve && typeof track.curve.getLength === 'function'
    ? Number(track.curve.getLength()) || fallbackLength
    : fallbackLength;
  const sampleStep = Math.max(0.02, Number(options.sampleStep) || 0.1);
  const sampleCount = Math.max(
    Number(options.minSamples) || 32,
    Math.ceil(Math.max(curveLength, sampleStep) / sampleStep)
  );
  const points = [];
  for (let i = 0; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    points.push({
      t,
      point: samplePointAt(track, t),
    });
  }
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({
      index: i,
      start: points[i],
      end: points[i + 1],
    });
  }
  return {
    trackName: String(track?.name || ''),
    controlPoints,
    points,
    segments,
    sampleCount,
    tStep: sampleCount > 0 ? 1 / sampleCount : 1,
  };
}

function sampleRailLineFromTrack(track, railSide, options = {}) {
  const side = normalizeRailSide(railSide);
  const railDataProvider = options.railDataProvider
    || globalThis.__dioramaRailVisualEditorRailDataProvider
    || null;
  if (typeof railDataProvider === 'function' && track?.name) {
    const railPoints = [];
    const railAngles = [];
    const segmentCount = Math.max(0, (Array.isArray(track?.points) ? track.points.length : 0) - 1);
    for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
      const segmentRailData = railDataProvider(track.name, segmentIndex, side);
      const segmentPoints = Array.isArray(segmentRailData?.[0]) ? segmentRailData[0].map(toPoint) : [];
      const segmentAngles = Array.isArray(segmentRailData?.[1]) ? [...segmentRailData[1]] : [];
      if (segmentPoints.length < 1) {
        continue;
      }
      if (railPoints.length > 0) {
        segmentPoints.shift();
        if (segmentAngles.length > 0) {
          segmentAngles.shift();
        }
      }
      railPoints.push(...segmentPoints);
      railAngles.push(...segmentAngles);
    }

    if (railPoints.length >= 2) {
      const lastIndex = railPoints.length - 1;
      const normalizedPoints = railPoints.map((point, index) => ({
        t: lastIndex > 0 ? (index / lastIndex) : 0,
        point,
      }));
      const segments = [];
      for (let i = 0; i < normalizedPoints.length - 1; i += 1) {
        segments.push({
          index: i,
          start: normalizedPoints[i],
          end: normalizedPoints[i + 1],
        });
      }
      return {
        trackName: String(track?.name || ''),
        controlPoints: railPoints.map(toPoint),
        points: normalizedPoints,
        segments,
        sampleCount: lastIndex,
        tStep: lastIndex > 0 ? 1 / lastIndex : 1,
        railSide: side,
        offset: 0,
        sourceTrackName: String(track?.name || ''),
        sourceAngles: railAngles,
      };
    }
  }

  const sampledCenter = sampleTrack(track, options);
  const offsets = getRailOffsets(options);
  const offset = offsets[side];
  const controlPoints = offsetPolyline(sampledCenter.controlPoints, offset);
  const centerPoints = sampledCenter.points.map((entry) => entry.point);
  const offsetPoints = offsetPolyline(centerPoints, offset);
  const normalizedPoints = sampledCenter.points.map((entry, index) => ({
    t: entry.t,
    point: offsetPoints[index],
  }));
  const segments = [];
  for (let i = 0; i < normalizedPoints.length - 1; i += 1) {
    segments.push({
      index: i,
      start: normalizedPoints[i],
      end: normalizedPoints[i + 1],
    });
  }
  return {
    ...sampledCenter,
    railSide: side,
    offset,
    controlPoints,
    points: normalizedPoints,
    segments,
    sourceTrackName: String(track?.name || ''),
  };
}

function buildRailLineKey(trackName, railSide) {
  return `${String(trackName || '').trim()}:${normalizeRailSide(railSide)}`;
}

export function buildRailSideReference(trackDefs, options = {}) {
  const tracks = Array.isArray(trackDefs) ? trackDefs : [];
  const offsets = getRailOffsets(options);
  const reference = [];
  const byTrack = {};
  const byLineKey = {};

  tracks
    .filter((track) => Array.isArray(track?.points) && track.points.length >= 2)
    .forEach((track) => {
      const trackName = String(track?.name || '').trim();
      if (!trackName) { return; }

      const frame = getTrackReferenceFrame(track, options);
      const rightPoint = {
        x: frame.center.x + (frame.right.x * offsets.right),
        y: frame.center.y,
        z: frame.center.z + (frame.right.z * offsets.right),
      };
      const leftPoint = {
        x: frame.center.x + (frame.right.x * offsets.left),
        y: frame.center.y,
        z: frame.center.z + (frame.right.z * offsets.left),
      };

      const entry = {
        trackName,
        zeroDegreeBasis: {
          yawRadians: frame.yawFromZeroDeg,
          yawDegrees: frame.yawFromZeroDeg * (180 / Math.PI),
          axis: frame.zeroDegreeAxis,
          referenceT: frame.t,
          centerPoint: frame.center,
          forward: frame.forward,
          rightVector: frame.right,
        },
        rails: [
          {
            railSide: 'right',
            sideCode: RAIL_SIDE_RIGHT,
            sideIndex: RAIL_SIDE_RIGHT,
            offset: offsets.right,
            referencePoint: rightPoint,
            lineKey: buildRailLineKey(trackName, 'right'),
          },
          {
            railSide: 'left',
            sideCode: RAIL_SIDE_LEFT,
            sideIndex: RAIL_SIDE_LEFT,
            offset: offsets.left,
            referencePoint: leftPoint,
            lineKey: buildRailLineKey(trackName, 'left'),
          },
        ],
      };

      byTrack[trackName] = entry;
      entry.rails.forEach((rail) => {
        byLineKey[rail.lineKey] = {
          trackName,
          railSide: rail.railSide,
          sideCode: rail.sideCode,
          sideIndex: rail.sideIndex,
          lineKey: rail.lineKey,
          oppositeLineKey: buildRailLineKey(trackName, rail.railSide === 'right' ? 'left' : 'right'),
          zeroDegreeBasis: entry.zeroDegreeBasis,
          referencePoint: rail.referencePoint,
        };
      });
      reference.push(entry);
    });

  return {
    rightCode: RAIL_SIDE_RIGHT,
    leftCode: RAIL_SIDE_LEFT,
    sideCodeToName: RAIL_SIDE_CODE_TO_NAME,
    reference,
    byTrack,
    byLineKey,
  };
}

export function getRailSideInfo(sideReference, trackName, railSideOrCode) {
  const safeTrackName = String(trackName || '').trim();
  if (!safeTrackName || !sideReference || typeof sideReference !== 'object') {
    return null;
  }
  let railSide = railSideOrCode;
  if (typeof railSideOrCode === 'number') {
    railSide = RAIL_SIDE_CODE_TO_NAME[railSideOrCode] || 'right';
  }
  const key = buildRailLineKey(safeTrackName, railSide);
  return sideReference.byLineKey?.[key] || null;
}

function samplePointAtOnSampledLine(sampledLine, t) {
  const samples = Array.isArray(sampledLine?.points) ? sampledLine.points : [];
  if (samples.length < 1) {
    return { x: 0, y: 0, z: 0 };
  }
  if (samples.length === 1) {
    return toPoint(samples[0].point);
  }
  const clampedT = Math.max(0, Math.min(1, Number(t) || 0));
  for (let i = 0; i < samples.length - 1; i += 1) {
    const start = samples[i];
    const end = samples[i + 1];
    if (clampedT < start.t || clampedT > end.t) {
      continue;
    }
    const span = Math.max(1e-9, end.t - start.t);
    const localT = (clampedT - start.t) / span;
    return lerpPoint(start.point, end.point, localT);
  }
  return toPoint(samples[samples.length - 1].point);
}

function findNearestSampleIndex(samples, t) {
  let bestIndex = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const diff = Math.abs(samples[i].t - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function computeMinDistancesToTrack(primary, secondary) {
  return primary.points.map((entry) => {
    let best = {
      distanceXZ: Infinity,
      distance3D: Infinity,
      yDelta: Infinity,
      otherPoint: null,
      otherT: 0,
    };
    secondary.segments.forEach((segment) => {
      const pointOnSecondary = closestPointOnSegmentXZ(entry.point, segment.start.point, segment.end.point);
      const otherPoint = pointOnSecondary.point;
      const yDelta = Math.abs(entry.point.y - otherPoint.y);
      const dXZ = pointOnSecondary.distanceXZ;
      const d3 = distance3D(entry.point, otherPoint);
      if (dXZ < best.distanceXZ) {
        best = {
          distanceXZ: dXZ,
          distance3D: d3,
          yDelta,
          otherPoint,
          otherT: lerp(segment.start.t, segment.end.t, pointOnSecondary.t),
        };
      }
    });
    return best;
  });
}

function expandInteractionRange(sampled, metrics, centerIndex, threshold, yTolerance) {
  const inside = (index) => (
    metrics[index].distanceXZ <= threshold
    && metrics[index].yDelta <= yTolerance
  );
  let startIndex = centerIndex;
  while (startIndex > 0 && inside(startIndex - 1)) {
    startIndex -= 1;
  }
  let endIndex = centerIndex;
  while (endIndex < metrics.length - 1 && inside(endIndex + 1)) {
    endIndex += 1;
  }

  let startT = sampled.points[startIndex].t;
  if (startIndex > 0) {
    const outsideIndex = startIndex - 1;
    const dIn = metrics[startIndex].distanceXZ;
    const dOut = metrics[outsideIndex].distanceXZ;
    const span = dOut - dIn;
    if (Math.abs(span) > 1e-8) {
      const alpha = Math.min(1, Math.max(0, (threshold - dIn) / span));
      startT = lerp(sampled.points[startIndex].t, sampled.points[outsideIndex].t, alpha);
    }
  }

  let endT = sampled.points[endIndex].t;
  if (endIndex < metrics.length - 1) {
    const outsideIndex = endIndex + 1;
    const dIn = metrics[endIndex].distanceXZ;
    const dOut = metrics[outsideIndex].distanceXZ;
    const span = dOut - dIn;
    if (Math.abs(span) > 1e-8) {
      const alpha = Math.min(1, Math.max(0, (threshold - dIn) / span));
      endT = lerp(sampled.points[endIndex].t, sampled.points[outsideIndex].t, alpha);
    }
  }

  return {
    startT: Math.max(0, Math.min(1, startT)),
    endT: Math.max(0, Math.min(1, endT)),
    startIndex,
    endIndex,
  };
}

function buildInteractionIntervals(sampled, metrics, threshold, yTolerance) {
  const intervals = [];
  const points = Array.isArray(sampled?.points) ? sampled.points : [];
  if (points.length < 1 || !Array.isArray(metrics) || metrics.length !== points.length) {
    return intervals;
  }

  const inside = (index) => (
    metrics[index].distanceXZ <= threshold
    && metrics[index].yDelta <= yTolerance
  );

  let index = 0;
  while (index < metrics.length) {
    if (!inside(index)) {
      index += 1;
      continue;
    }

    const startIndex = index;
    let endIndex = index;
    while (endIndex + 1 < metrics.length && inside(endIndex + 1)) {
      endIndex += 1;
    }

    let startT = points[startIndex].t;
    if (startIndex > 0) {
      const outsideIndex = startIndex - 1;
      const dIn = metrics[startIndex].distanceXZ;
      const dOut = metrics[outsideIndex].distanceXZ;
      const span = dOut - dIn;
      if (Math.abs(span) > 1e-8) {
        const alpha = Math.min(1, Math.max(0, (threshold - dIn) / span));
        startT = lerp(points[startIndex].t, points[outsideIndex].t, alpha);
      }
    }

    let endT = points[endIndex].t;
    if (endIndex < metrics.length - 1) {
      const outsideIndex = endIndex + 1;
      const dIn = metrics[endIndex].distanceXZ;
      const dOut = metrics[outsideIndex].distanceXZ;
      const span = dOut - dIn;
      if (Math.abs(span) > 1e-8) {
        const alpha = Math.min(1, Math.max(0, (threshold - dIn) / span));
        endT = lerp(points[endIndex].t, points[outsideIndex].t, alpha);
      }
    }

    let bestIndex = startIndex;
    let bestDistance = metrics[startIndex].distanceXZ;
    let otherTMin = metrics[startIndex].otherT;
    let otherTMax = metrics[startIndex].otherT;
    for (let i = startIndex; i <= endIndex; i += 1) {
      if (metrics[i].distanceXZ < bestDistance) {
        bestDistance = metrics[i].distanceXZ;
        bestIndex = i;
      }
      otherTMin = Math.min(otherTMin, metrics[i].otherT);
      otherTMax = Math.max(otherTMax, metrics[i].otherT);
    }

    intervals.push({
      startIndex,
      endIndex,
      startT: Math.max(0, Math.min(1, startT)),
      endT: Math.max(0, Math.min(1, endT)),
      centerIndex: bestIndex,
      centerT: points[bestIndex].t,
      centerOtherT: metrics[bestIndex].otherT,
      otherStartT: Math.max(0, Math.min(1, otherTMin)),
      otherEndT: Math.max(0, Math.min(1, otherTMax)),
      minDistanceXZ: bestDistance,
      candidateCount: (endIndex - startIndex) + 1,
    });

    index = endIndex + 1;
  }

  return intervals;
}

function estimateControlSegmentIndex(controlPoints, point) {
  if (!Array.isArray(controlPoints) || controlPoints.length < 2 || !point) {
    return 0;
  }
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < controlPoints.length - 1; i += 1) {
    const nearest = closestPointOnSegmentXZ(point, controlPoints[i], controlPoints[i + 1]);
    if (nearest.distanceXZ < bestDistance) {
      bestDistance = nearest.distanceXZ;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function clusterCandidates(candidates, pointMergeDistance = 0.35, tMergeDistance = 0.025) {
  const clusters = [];
  candidates.forEach((candidate) => {
    const cluster = clusters.find((entry) => (
      distanceXZ(entry.centerPoint, candidate.point) <= pointMergeDistance
      && Math.abs(entry.centerTA - candidate.tA) <= tMergeDistance
      && Math.abs(entry.centerTB - candidate.tB) <= tMergeDistance
    ));
    if (!cluster) {
      clusters.push({
        candidates: [candidate],
        centerPoint: candidate.point,
        centerTA: candidate.tA,
        centerTB: candidate.tB,
      });
      return;
    }
    cluster.candidates.push(candidate);
    const weight = cluster.candidates.length;
    cluster.centerPoint = {
      x: ((cluster.centerPoint.x * (weight - 1)) + candidate.point.x) / weight,
      y: ((cluster.centerPoint.y * (weight - 1)) + candidate.point.y) / weight,
      z: ((cluster.centerPoint.z * (weight - 1)) + candidate.point.z) / weight,
    };
    cluster.centerTA = ((cluster.centerTA * (weight - 1)) + candidate.tA) / weight;
    cluster.centerTB = ((cluster.centerTB * (weight - 1)) + candidate.tB) / weight;
  });
  return clusters;
}

function mergeIntersectionEntries(entries, pointMergeDistance = 0.35, tMergeDistance = 0.025) {
  const merged = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const match = merged.find((candidate) => (
      candidate.pairKey === entry.pairKey
      && distanceXZ(candidate.intersectionPoint, entry.intersectionPoint) <= pointMergeDistance
      && Math.abs(candidate.trackA.centerT - entry.trackA.centerT) <= tMergeDistance
      && Math.abs(candidate.trackB.centerT - entry.trackB.centerT) <= tMergeDistance
    ));

    if (!match) {
      merged.push(entry);
      return;
    }

    match.candidateCount += entry.candidateCount || 0;
    match.intersectionPoint = {
      x: (match.intersectionPoint.x + entry.intersectionPoint.x) * 0.5,
      y: (match.intersectionPoint.y + entry.intersectionPoint.y) * 0.5,
      z: (match.intersectionPoint.z + entry.intersectionPoint.z) * 0.5,
    };
    match.trackA.centerT = (match.trackA.centerT + entry.trackA.centerT) * 0.5;
    match.trackB.centerT = (match.trackB.centerT + entry.trackB.centerT) * 0.5;
    match.trackA.startT = Math.min(match.trackA.startT, entry.trackA.startT);
    match.trackA.endT = Math.max(match.trackA.endT, entry.trackA.endT);
    match.trackB.startT = Math.min(match.trackB.startT, entry.trackB.startT);
    match.trackB.endT = Math.max(match.trackB.endT, entry.trackB.endT);
    if (entry.trackA.startSampleIndex < match.trackA.startSampleIndex) {
      match.trackA.startSampleIndex = entry.trackA.startSampleIndex;
      match.trackA.startSegmentIndex = entry.trackA.startSegmentIndex;
      match.trackA.startPoint = entry.trackA.startPoint;
    }
    if (entry.trackA.endSampleIndex > match.trackA.endSampleIndex) {
      match.trackA.endSampleIndex = entry.trackA.endSampleIndex;
      match.trackA.endSegmentIndex = entry.trackA.endSegmentIndex;
      match.trackA.endPoint = entry.trackA.endPoint;
    }
    if (entry.trackB.startSampleIndex < match.trackB.startSampleIndex) {
      match.trackB.startSampleIndex = entry.trackB.startSampleIndex;
      match.trackB.startSegmentIndex = entry.trackB.startSegmentIndex;
      match.trackB.startPoint = entry.trackB.startPoint;
    }
    if (entry.trackB.endSampleIndex > match.trackB.endSampleIndex) {
      match.trackB.endSampleIndex = entry.trackB.endSampleIndex;
      match.trackB.endSegmentIndex = entry.trackB.endSegmentIndex;
      match.trackB.endPoint = entry.trackB.endPoint;
    }
  });

  return merged.map((entry, index) => ({
    ...entry,
    id: `${entry.pairKey.replace(/[:]/g, '_')}__${index}`,
  }));
}

function mergePointIntersectionEntries(entries, pointMergeDistance = 0.05, tMergeDistance = 0.01) {
  const merged = [];
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const match = merged.find((candidate) => (
      candidate.pairKey === entry.pairKey
      && distanceXZ(candidate.intersectionPoint, entry.intersectionPoint) <= pointMergeDistance
      && Math.abs(candidate.trackA.centerT - entry.trackA.centerT) <= tMergeDistance
      && Math.abs(candidate.trackB.centerT - entry.trackB.centerT) <= tMergeDistance
    ));

    if (!match) {
      merged.push({
        ...entry,
        candidateCount: entry.candidateCount || 1,
      });
      return;
    }

    const weight = (match.candidateCount || 1) + (entry.candidateCount || 1);
    match.intersectionPoint = {
      x: ((match.intersectionPoint.x * (weight - 1)) + entry.intersectionPoint.x) / weight,
      y: ((match.intersectionPoint.y * (weight - 1)) + entry.intersectionPoint.y) / weight,
      z: ((match.intersectionPoint.z * (weight - 1)) + entry.intersectionPoint.z) / weight,
    };
    match.trackA.centerT = (match.trackA.centerT + entry.trackA.centerT) * 0.5;
    match.trackA.startT = Math.min(match.trackA.startT, entry.trackA.startT);
    match.trackA.endT = Math.max(match.trackA.endT, entry.trackA.endT);
    match.trackB.centerT = (match.trackB.centerT + entry.trackB.centerT) * 0.5;
    match.trackB.startT = Math.min(match.trackB.startT, entry.trackB.startT);
    match.trackB.endT = Math.max(match.trackB.endT, entry.trackB.endT);
    match.trackA.startSampleIndex = Math.min(match.trackA.startSampleIndex, entry.trackA.startSampleIndex);
    match.trackA.endSampleIndex = Math.max(match.trackA.endSampleIndex, entry.trackA.endSampleIndex);
    match.trackB.startSampleIndex = Math.min(match.trackB.startSampleIndex, entry.trackB.startSampleIndex);
    match.trackB.endSampleIndex = Math.max(match.trackB.endSampleIndex, entry.trackB.endSampleIndex);
    match.candidateCount = weight;
  });

  return merged.map((entry, index) => ({
    ...entry,
    id: `${entry.pairKey.replace(/[:]/g, '_')}__poly__${index}`,
  }));
}

export function detectRailIntersections(trackDefs, options = {}) {
  const interactionDistance = Math.max(0.01, Number(options.interactionDistance) || 0.7);
  const yTolerance = Math.max(0, Number(options.yTolerance) || 0.35);
  const sampleStep = Math.max(0.02, Number(options.sampleStep) || 0.1);
  const minSamples = Math.max(16, Number(options.minSamples) || 48);
  const resultMergeDistance = Math.max(0.05, Number(options.resultMergeDistance) || interactionDistance * 0.75);

  const sampledRails = (Array.isArray(trackDefs) ? trackDefs : [])
    .filter((track) => Array.isArray(track?.points) && track.points.length >= 2)
    .flatMap((track) => ([
      {
        track,
        sampled: sampleRailLineFromTrack(track, 'right', { sampleStep, minSamples, railOffset: options.railOffset }),
      },
      {
        track,
        sampled: sampleRailLineFromTrack(track, 'left', { sampleStep, minSamples, railOffset: options.railOffset }),
      },
    ]));

  const results = [];

  for (let i = 0; i < sampledRails.length; i += 1) {
    const left = sampledRails[i];
    for (let j = i + 1; j < sampledRails.length; j += 1) {
      const right = sampledRails[j];
      if (String(left.sampled.trackName || '') === String(right.sampled.trackName || '')) {
        continue;
      }
      const leftMetrics = computeMinDistancesToTrack(left.sampled, right.sampled);
      const intervals = buildInteractionIntervals(left.sampled, leftMetrics, interactionDistance, yTolerance);

      intervals.forEach((interval, intervalIndex) => {
        const leftStartPoint = samplePointAtOnSampledLine(left.sampled, interval.startT);
        const leftEndPoint = samplePointAtOnSampledLine(left.sampled, interval.endT);
        const rightStartPoint = samplePointAtOnSampledLine(right.sampled, interval.otherStartT);
        const rightEndPoint = samplePointAtOnSampledLine(right.sampled, interval.otherEndT);
        const centerPointA = samplePointAtOnSampledLine(left.sampled, interval.centerT);
        const centerPointB = samplePointAtOnSampledLine(right.sampled, interval.centerOtherT);
        const intersectionPoint = {
          x: (centerPointA.x + centerPointB.x) * 0.5,
          y: (centerPointA.y + centerPointB.y) * 0.5,
          z: (centerPointA.z + centerPointB.z) * 0.5,
        };

        results.push({
          id: `${left.sampled.trackName}_${left.sampled.railSide}__${right.sampled.trackName}_${right.sampled.railSide}__${intervalIndex}`,
          pairKey: `${left.sampled.trackName}:${left.sampled.railSide}::${right.sampled.trackName}:${right.sampled.railSide}`,
          interactionDistance,
          yTolerance,
          candidateCount: interval.candidateCount,
          intersectionPoint,
          trackA: {
            trackName: left.sampled.trackName,
            railSide: left.sampled.railSide,
            centerT: interval.centerT,
            startT: interval.startT,
            endT: interval.endT,
            startPoint: leftStartPoint,
            endPoint: leftEndPoint,
            startSampleIndex: interval.startIndex,
            endSampleIndex: interval.endIndex,
            startSegmentIndex: estimateControlSegmentIndex(left.sampled.controlPoints, leftStartPoint),
            endSegmentIndex: estimateControlSegmentIndex(left.sampled.controlPoints, leftEndPoint),
          },
          trackB: {
            trackName: right.sampled.trackName,
            railSide: right.sampled.railSide,
            centerT: interval.centerOtherT,
            startT: interval.otherStartT,
            endT: interval.otherEndT,
            startPoint: rightStartPoint,
            endPoint: rightEndPoint,
            startSampleIndex: findNearestSampleIndex(right.sampled.points, interval.otherStartT),
            endSampleIndex: findNearestSampleIndex(right.sampled.points, interval.otherEndT),
            startSegmentIndex: estimateControlSegmentIndex(right.sampled.controlPoints, rightStartPoint),
            endSegmentIndex: estimateControlSegmentIndex(right.sampled.controlPoints, rightEndPoint),
          },
        });
      });
    }
  }

  return mergeIntersectionEntries(
    results,
    resultMergeDistance,
    Math.max(sampleStep * 1.5, 0.03),
  );
}

export function detectRailPolylineIntersections(trackDefs, options = {}) {
  const sampleStep = Math.max(0.02, Number(options.sampleStep) || 0.1);
  const minSamples = Math.max(16, Number(options.minSamples) || 48);
  const yTolerance = Math.max(0, Number(options.yTolerance) || 0.35);
  const pointMergeDistance = Math.max(0.001, Number(options.pointMergeDistance) || sampleStep * 0.5);
  const tMergeDistance = Math.max(0.0001, Number(options.tMergeDistance) || (sampleStep * 0.25));

  const sampledRails = (Array.isArray(trackDefs) ? trackDefs : [])
    .filter((track) => Array.isArray(track?.points) && track.points.length >= 2)
    .flatMap((track) => ([
      {
        track,
        sampled: sampleRailLineFromTrack(track, 'right', {
          sampleStep,
          minSamples,
          railOffset: options.railOffset,
        }),
      },
      {
        track,
        sampled: sampleRailLineFromTrack(track, 'left', {
          sampleStep,
          minSamples,
          railOffset: options.railOffset,
        }),
      },
    ]));

  const results = [];

  for (let i = 0; i < sampledRails.length; i += 1) {
    const left = sampledRails[i];
    for (let j = i + 1; j < sampledRails.length; j += 1) {
      const right = sampledRails[j];
      if (String(left.sampled.trackName || '') === String(right.sampled.trackName || '')) {
        continue;
      }

      left.sampled.segments.forEach((leftSegment) => {
        const a0 = leftSegment?.start?.point || null;
        const a1 = leftSegment?.end?.point || null;
        if (!a0 || !a1) { return; }

        right.sampled.segments.forEach((rightSegment) => {
          const b0 = rightSegment?.start?.point || null;
          const b1 = rightSegment?.end?.point || null;
          if (!b0 || !b1) { return; }
          if (!segmentBoundsOverlapXZ(a0, a1, b0, b1, 0)) { return; }

          const hit = intersectSegmentsXZ(a0, a1, b0, b1);
          if (!hit || hit.yDelta > yTolerance) { return; }

          const centerTA = lerp(leftSegment.start.t, leftSegment.end.t, hit.ua);
          const centerTB = lerp(rightSegment.start.t, rightSegment.end.t, hit.ub);
          const intersectionPoint = hit.point;
          const pointA = toPoint(hit.pointA);
          const pointB = toPoint(hit.pointB);

          results.push({
            id: `${left.sampled.trackName}_${left.sampled.railSide}__${right.sampled.trackName}_${right.sampled.railSide}__${leftSegment.index}_${rightSegment.index}`,
            pairKey: `${left.sampled.trackName}:${left.sampled.railSide}::${right.sampled.trackName}:${right.sampled.railSide}`,
            candidateCount: 1,
            intersectionPoint,
            trackA: {
              trackName: left.sampled.trackName,
              railSide: left.sampled.railSide,
              centerT: centerTA,
              startT: centerTA,
              endT: centerTA,
              startPoint: pointA,
              endPoint: pointA,
              startSampleIndex: leftSegment.index,
              endSampleIndex: leftSegment.index + 1,
              startSegmentIndex: estimateControlSegmentIndex(left.sampled.controlPoints, pointA),
              endSegmentIndex: estimateControlSegmentIndex(left.sampled.controlPoints, pointA),
            },
            trackB: {
              trackName: right.sampled.trackName,
              railSide: right.sampled.railSide,
              centerT: centerTB,
              startT: centerTB,
              endT: centerTB,
              startPoint: pointB,
              endPoint: pointB,
              startSampleIndex: rightSegment.index,
              endSampleIndex: rightSegment.index + 1,
              startSegmentIndex: estimateControlSegmentIndex(right.sampled.controlPoints, pointB),
              endSegmentIndex: estimateControlSegmentIndex(right.sampled.controlPoints, pointB),
            },
          });
        });
      });
    }
  }

  return mergePointIntersectionEntries(results, pointMergeDistance, tMergeDistance);
}

export function indexRailIntersectionsByRail(results) {
  const map = new Map();
  const pushEntry = (trackInfo, otherInfo, source) => {
    const key = `${trackInfo.trackName}:${trackInfo.railSide}`;
    if (!map.has(key)) {
      map.set(key, {
        trackName: trackInfo.trackName,
        railSide: trackInfo.railSide,
        intersections: [],
      });
    }
    map.get(key).intersections.push({
      id: source.id,
      pairKey: source.pairKey,
      lineKey: key,
      sideCode: trackInfo.railSide === 'left' ? RAIL_SIDE_LEFT : RAIL_SIDE_RIGHT,
      centerT: trackInfo.centerT,
      intersectionPoint: source.intersectionPoint,
      orderedRangeT: [
        [trackInfo.startT, trackInfo.endT],
        [otherInfo.startT, otherInfo.endT],
      ],
      orderedRangePoints: [
        [trackInfo.startPoint, trackInfo.endPoint],
        [otherInfo.startPoint, otherInfo.endPoint],
      ],
      otherSideCode: otherInfo.railSide === 'left' ? RAIL_SIDE_LEFT : RAIL_SIDE_RIGHT,
      self: {
        trackName: trackInfo.trackName,
        railSide: trackInfo.railSide,
        centerT: trackInfo.centerT,
        startT: trackInfo.startT,
        endT: trackInfo.endT,
        startPoint: trackInfo.startPoint,
        endPoint: trackInfo.endPoint,
        startSampleIndex: trackInfo.startSampleIndex,
        endSampleIndex: trackInfo.endSampleIndex,
        startSegmentIndex: trackInfo.startSegmentIndex,
        endSegmentIndex: trackInfo.endSegmentIndex,
      },
      other: {
        trackName: otherInfo.trackName,
        railSide: otherInfo.railSide,
        centerT: otherInfo.centerT,
        startT: otherInfo.startT,
        endT: otherInfo.endT,
        startPoint: otherInfo.startPoint,
        endPoint: otherInfo.endPoint,
        startSampleIndex: otherInfo.startSampleIndex,
        endSampleIndex: otherInfo.endSampleIndex,
        startSegmentIndex: otherInfo.startSegmentIndex,
        endSegmentIndex: otherInfo.endSegmentIndex,
      },
    });
  };

  (Array.isArray(results) ? results : []).forEach((entry) => {
    if (!entry?.trackA || !entry?.trackB) { return; }
    pushEntry(entry.trackA, entry.trackB, entry);
    pushEntry(entry.trackB, entry.trackA, entry);
  });

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      sideCode: entry.railSide === 'left' ? RAIL_SIDE_LEFT : RAIL_SIDE_RIGHT,
      lineKey: `${entry.trackName}:${entry.railSide}`,
      intersections: entry.intersections.sort((left, right) => right.centerT - left.centerT),
    }))
    .sort((left, right) => {
      const trackCompare = String(left.trackName || '').localeCompare(String(right.trackName || ''));
      if (trackCompare !== 0) { return trackCompare; }
      return String(left.railSide || '').localeCompare(String(right.railSide || ''));
    });
}

export function listRailIntersectionRangesByRail(results) {
  const indexed = indexRailIntersectionsByRail(results);
  return indexed.map((entry) => ({
    trackName: entry.trackName,
    railSide: entry.railSide,
    sideCode: entry.sideCode,
    lineKey: entry.lineKey,
    ranges: entry.intersections.map((intersection) => ({
      id: intersection.id,
      pairKey: intersection.pairKey,
      centerT: intersection.centerT,
      otherTrackName: intersection.other.trackName,
      otherRailSide: intersection.other.railSide,
      otherSideCode: intersection.otherSideCode,
      points: [
        [intersection.self.startPoint, intersection.self.endPoint],
        [intersection.other.startPoint, intersection.other.endPoint],
      ],
      tRanges: [
        [intersection.self.startT, intersection.self.endT],
        [intersection.other.startT, intersection.other.endT],
      ],
    })),
  }));
}

function formatPoint(point) {
  return `(${Number(point?.x || 0).toFixed(3)}, ${Number(point?.y || 0).toFixed(3)}, ${Number(point?.z || 0).toFixed(3)})`;
}

export function summarizeRailIntersections(results) {
  if (!Array.isArray(results) || results.length < 1) {
    return '交差候補は見つかりませんでした。';
  }
  return results.map((entry, index) => [
    `[${index}] ${entry.trackA.trackName}[${entry.trackA.railSide}] x ${entry.trackB.trackName}[${entry.trackB.railSide}]`,
    `  cross: ${formatPoint(entry.intersectionPoint)}`,
    `  A: t=${entry.trackA.startT.toFixed(4)} -> ${entry.trackA.endT.toFixed(4)} / sample=${entry.trackA.startSampleIndex}-${entry.trackA.endSampleIndex} / seg=${entry.trackA.startSegmentIndex}-${entry.trackA.endSegmentIndex}`,
    `  A pts: ${formatPoint(entry.trackA.startPoint)} -> ${formatPoint(entry.trackA.endPoint)}`,
    `  B: t=${entry.trackB.startT.toFixed(4)} -> ${entry.trackB.endT.toFixed(4)} / sample=${entry.trackB.startSampleIndex}-${entry.trackB.endSampleIndex} / seg=${entry.trackB.startSegmentIndex}-${entry.trackB.endSegmentIndex}`,
    `  B pts: ${formatPoint(entry.trackB.startPoint)} -> ${formatPoint(entry.trackB.endPoint)}`,
  ].join('\n')).join('\n\n');
}
