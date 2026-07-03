export const UI_STATE_STORAGE_KEY = 'train_editmode_ui_state_v1';

export function createCreateModeStateCodec({ encode, decode }) {
  if (typeof encode !== 'function' || typeof decode !== 'function') {
    throw new Error('createCreateModeStateCodec requires encode/decode functions.');
  }

  const u8view = (typed) => new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);

  function maxIndexValue(indices) {
    if (!Array.isArray(indices) || indices.length < 1) { return -1; }
    let m = -1;
    for (let i = 0; i < indices.length; i += 1) {
      const v = Number(indices[i]) || 0;
      if (v > m) { m = v; }
    }
    return m;
  }

  function packState(state) {
    const packed = structuredClone(state);
    const packSpaces = (spaces) => {
      spaces.forEach((ds) => {
        const geom = ds?.geometry;
        if (!geom || !Array.isArray(geom.position)) { return; }
        const posF32 = Float32Array.from(geom.position);
        const rawIndex = Array.isArray(geom.index) ? geom.index : [];
        const idxMax = maxIndexValue(rawIndex);
        const idxTyped = (idxMax >= 0 && idxMax <= 65535)
          ? Uint16Array.from(rawIndex)
          : Uint32Array.from(rawIndex);
        ds.geometry = {
          position: { dtype: 'f32', itemSize: 3, data: u8view(posF32) },
          index: { dtype: (idxTyped instanceof Uint16Array) ? 'u16' : 'u32', data: u8view(idxTyped) },
        };
      });
    };
    const spaces = Array.isArray(packed?.differenceSpaces) ? packed.differenceSpaces : [];
    const areaSpaces = Array.isArray(packed?.areaSpaces) ? packed.areaSpaces : [];
    packSpaces(spaces);
    packSpaces(areaSpaces);
    return encode(packed);
  }

  function fromBin(binU8, dtype) {
    const src = Array.isArray(binU8) ? Uint8Array.from(binU8) : binU8;
    if (!src || typeof src !== 'object' || !('buffer' in src) || !('byteOffset' in src) || !('byteLength' in src)) {
      throw new Error('invalid binary payload');
    }
    const toAlignedView = (bytesPerElement, Ctor) => {
      const byteLen = src.byteLength;
      if (byteLen % bytesPerElement !== 0) {
        throw new Error(`invalid ${dtype} byteLength=${byteLen}`);
      }
      // MessagePack decode の戻りは byteOffset が未アラインな場合があるため、
      // 必要時のみコピーして安全に TypedArray を生成する。
      if (src.byteOffset % bytesPerElement !== 0) {
        const copy = new Uint8Array(byteLen);
        copy.set(new Uint8Array(src.buffer, src.byteOffset, byteLen));
        return new Ctor(copy.buffer);
      }
      return new Ctor(src.buffer, src.byteOffset, byteLen / bytesPerElement);
    };
    if (dtype === 'f32') { return toAlignedView(4, Float32Array); }
    if (dtype === 'u16') { return toAlignedView(2, Uint16Array); }
    if (dtype === 'u32') { return toAlignedView(4, Uint32Array); }
    throw new Error('unknown dtype');
  }

  function unpackState(bytes) {
    const state = decode(bytes);
    const unpackSpaces = (spaces) => {
      spaces.forEach((ds) => {
        const gp = ds?.geometry?.position;
        const gi = ds?.geometry?.index;
        if (!gp?.data || !gp?.dtype) { return; }
        const pos = fromBin(gp.data, gp.dtype);
        const idx = (gi?.data && gi?.dtype) ? fromBin(gi.data, gi.dtype) : new Uint32Array();
        ds.geometry = {
          position: Array.from(pos),
          index: Array.from(idx),
        };
      });
    };
    const spaces = Array.isArray(state?.differenceSpaces) ? state.differenceSpaces : [];
    const areaSpaces = Array.isArray(state?.areaSpaces) ? state.areaSpaces : [];
    unpackSpaces(spaces);
    unpackSpaces(areaSpaces);
    return state;
  }

  function parseMapDataBytes(bytes, { name = 'unknown', size = 0 } = {}) {
    const lowerName = String(name || '').toLowerCase();
    const explicitJson = lowerName.endsWith('.json');
    const tryMsgPack = () => unpackState(bytes);
    const tryJson = () => {
      const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
      return JSON.parse(text);
    };
    const firstTry = explicitJson ? tryJson : tryMsgPack;
    const secondTry = explicitJson ? tryMsgPack : tryJson;
    try {
      return firstTry();
    } catch (firstErr) {
      try {
        return secondTry();
      } catch (secondErr) {
        const msgpackErr = explicitJson ? secondErr : firstErr;
        const jsonErr = explicitJson ? firstErr : secondErr;
        const detail = [
          `msgpack: ${msgpackErr?.message || msgpackErr}`,
          `json: ${jsonErr?.message || jsonErr}`,
          `name: ${name}`,
          `size: ${Number(size) || 0} bytes`,
        ].join(' | ');
        throw new Error(`MessagePack / JSON の解析に失敗しました。${detail}`);
      }
    }
  }

  function isZipBytes(bytes) {
    return bytes instanceof Uint8Array
      && bytes.byteLength >= 4
      && bytes[0] === 0x50
      && bytes[1] === 0x4b
      && bytes[2] === 0x03
      && bytes[3] === 0x04;
  }

  async function loadJsZipCtor() {
    const candidates = [
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm',
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    ];
    for (const url of candidates) {
      try {
        const mod = await import(url);
        const ctor = mod?.default || mod?.JSZip || null;
        if (ctor) {
          return ctor;
        }
      } catch (_error) {
        // Try the next candidate.
      }
    }
    throw new Error('ZIP 解析ライブラリの読み込みに失敗しました。');
  }

  function rankZipEntryName(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.endsWith('single_structure.msgpack')) { return 0; }
    if (lower.endsWith('single_structure.mpk')) { return 1; }
    if (lower.endsWith('single_structure.json')) { return 2; }
    if (lower.endsWith('create_mode_state.msgpack')) { return 3; }
    if (lower.endsWith('create_mode_state.mpk')) { return 4; }
    if (lower.endsWith('create_mode_state.json')) { return 5; }
    if (lower.endsWith('.msgpack')) { return 10; }
    if (lower.endsWith('.mpk')) { return 11; }
    if (lower.endsWith('.json')) { return 12; }
    return 999;
  }

  async function readMapDataBytes(bytes, { name = 'unknown', size = 0 } = {}) {
    const lowerName = String(name || '').toLowerCase();
    const explicitZip = lowerName.endsWith('.zip');
    if (!explicitZip && !isZipBytes(bytes)) {
      return parseMapDataBytes(bytes, { name, size });
    }

    const JSZipCtor = await loadJsZipCtor();
    const zip = await JSZipCtor.loadAsync(bytes);
    const candidates = Object.values(zip.files)
      .filter((entry) => entry && !entry.dir)
      .filter((entry) => /\.(json|msgpack|mpk)$/i.test(String(entry.name || '')))
      .sort((a, b) => rankZipEntryName(a.name) - rankZipEntryName(b.name));

    if (candidates.length < 1) {
      throw new Error('ZIP 内に読込可能な map_data ファイルが見つかりません。');
    }

    const mergeDifferencePayloadIntoCreatePayload = async () => {
      const findEntry = (suffix) => candidates.find((entry) => String(entry?.name || '').toLowerCase().endsWith(suffix)) || null;
      const createEntry = findEntry('single_structure.msgpack')
        || findEntry('single_structure.mpk')
        || findEntry('single_structure.json')
        || findEntry('create_mode_state.msgpack')
        || findEntry('create_mode_state.mpk')
        || findEntry('create_mode_state.json');
      const differenceEntry = findEntry('difference_space.msgpack')
        || findEntry('difference_space.mpk')
        || findEntry('difference_space.json');
      if (!createEntry || !differenceEntry) { return null; }

      const createBytes = new Uint8Array(await createEntry.async('uint8array'));
      const differenceBytes = new Uint8Array(await differenceEntry.async('uint8array'));
      const createPayload = parseMapDataBytes(createBytes, {
        name: createEntry.name || name,
        size: createBytes.byteLength,
      });
      const differencePayload = parseMapDataBytes(differenceBytes, {
        name: differenceEntry.name || name,
        size: differenceBytes.byteLength,
      });
      if (!createPayload || typeof createPayload !== 'object') { return null; }
      if (!differencePayload || typeof differencePayload !== 'object') { return createPayload; }

      return {
        ...createPayload,
        differenceSpaces: Array.isArray(differencePayload?.differenceSpaces)
          ? differencePayload.differenceSpaces
          : (Array.isArray(createPayload?.differenceSpaces) ? createPayload.differenceSpaces : []),
        differenceRailOperations: Array.isArray(differencePayload?.differenceRailOperations)
          ? differencePayload.differenceRailOperations
          : (Array.isArray(createPayload?.differenceRailOperations) ? createPayload.differenceRailOperations : []),
      };
    };

    const mergedPayload = await mergeDifferencePayloadIntoCreatePayload();
    if (mergedPayload) {
      return mergedPayload;
    }

    const selectedEntry = candidates[0];
    const entryBytes = new Uint8Array(await selectedEntry.async('uint8array'));
    return parseMapDataBytes(entryBytes, {
      name: selectedEntry.name || name,
      size: entryBytes.byteLength,
    });
  }

  async function readMapDataArchiveBytes(bytes, { name = 'unknown', size = 0 } = {}) {
    const lowerName = String(name || '').toLowerCase();
    const explicitZip = lowerName.endsWith('.zip');
    if (!explicitZip && !isZipBytes(bytes)) {
      return [{
        name,
        size: Number(size) || bytes.byteLength || 0,
        payload: parseMapDataBytes(bytes, { name, size }),
      }];
    }

    const JSZipCtor = await loadJsZipCtor();
    const zip = await JSZipCtor.loadAsync(bytes);
    const candidates = Object.values(zip.files)
      .filter((entry) => entry && !entry.dir)
      .filter((entry) => /\.(json|msgpack|mpk)$/i.test(String(entry.name || '')))
      .sort((a, b) => rankZipEntryName(a.name) - rankZipEntryName(b.name));

    if (candidates.length < 1) {
      throw new Error('ZIP 内に読込可能な map_data ファイルが見つかりません。');
    }

    const rows = [];
    for (const entry of candidates) {
      const entryBytes = new Uint8Array(await entry.async('uint8array'));
      rows.push({
        name: entry.name || name,
        size: entryBytes.byteLength,
        payload: parseMapDataBytes(entryBytes, {
          name: entry.name || name,
          size: entryBytes.byteLength,
        }),
      });
    }
    return rows;
  }

  function readMapDataFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = reader.result;
          if (!(data instanceof ArrayBuffer)) {
            reject(new Error('ファイル形式が不正です。'));
            return;
          }
          const bytes = new Uint8Array(data);
          resolve(await readMapDataBytes(bytes, {
            name: file?.name || 'unknown',
            size: Number(file?.size) || 0,
          }));
          return;
        } catch (err) {
          reject(new Error(`MessagePack / JSON の解析に失敗しました。${err?.message || err}`));
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function readMapDataPayloadFromUrl(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`fetch failed: ${response.status} ${response.statusText} (${url})`);
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const pathname = String(url || '').split('?')[0];
    const name = pathname.split('/').pop() || pathname || 'unknown';
    return readMapDataBytes(bytes, { name, size: bytes.byteLength });
  }

  return {
    packState,
    unpackState,
    parseMapDataBytes,
    readMapDataBytes,
    readMapDataArchiveBytes,
    readMapDataFile,
    readMapDataPayloadFromUrl,
  };
}
