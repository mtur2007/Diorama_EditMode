// インデックス検索コード
import { UIevent } from './main.js';

const UI_COLOR_DEFAULT = '';
const UI_COLOR_ACTIVE = '#2b4f8a';   // 親（経路）ボタン
const UI_COLOR_SELECTED = '#3f7cff'; // 押下ボタン
const UI_TEXT_ACTIVE = '#ffffff';
const UI_ICON_TEXT_DEFAULT = '#f3f3f3';
const UI_ICON_TEXT_ACTIVE = '#8ff0c2';
const UI_STATE_STORAGE_KEY = 'train_editmode_ui_state_v1';
const UI_BUTTON_ROW_GAP = 42;
const UI_BUTTON_TOP_OFFSET = 2.5;
const UI_ROOT_BUTTON_LEFT_OFFSET = 0;
const UI_ROOT_BUTTON_COLUMN_GAP = 52;
const UI_CHILDREN_TOP_OFFSET = 58;
const UI_EDIT_CHILD_LEFT_OFFSET = 0;
const UI_EDIT_CHILD_COLUMN_GAP = 45;
const ROTATION_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="2.6"></circle>
  <path d="M4.7 9.2a8.3 8.3 0 0 1 13.5-2.4"></path>
  <path d="M19.3 14.8a8.3 8.3 0 0 1-13.5 2.4"></path>
  <path d="M18.5 6.3l-1.1 2.5-2-1.8"></path>
  <path d="M5.5 17.7l1.1-2.5 2 1.8"></path>
</svg>`;
const MOVE_POINT_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 3.8v16.4"></path>
  <path d="M3.8 12h16.4"></path>
  <path d="M12 3.8l-2.4 3.1h4.8z" fill="currentColor" stroke="none"></path>
  <path d="M20.2 12l-3.1-2.4v4.8z" fill="currentColor" stroke="none"></path>
  <path d="M12 20.2l2.4-3.1H9.6z" fill="currentColor" stroke="none"></path>
  <path d="M3.8 12l3.1 2.4V9.6z" fill="currentColor" stroke="none"></path>
  <rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" stroke="none"></rect>
</svg>`;
const ADD_POINT_ICON_SVG = `
<svg class="ui-icon-glyph ui-icon-glyph-accent" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M6 4.5h5"></path>
  <path d="M8.5 2v5"></path>
  <path d="M9.5 8.5h8l0 8-8 0z"></path>
  <path d="M9.5 8.5l3.8-3h8l-3.7 3z"></path>
  <path d="M17.5 8.5v8l3.8-3v-8z"></path>
</svg>`;
const COPY_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="5.5" y="5.5" width="10.5" height="10.5" rx="0.8"></rect>
  <rect x="9" y="9" width="10.5" height="10.5" rx="0.8"></rect>
</svg>`;
const SEARCH_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M6 5v14"></path>
  <path d="M6 19h13"></path>
  <path d="M9.3 19a9.7 9.7 0 0 0-3.3-7.3"></path>
  <path d="M12.5 19a6.5 6.5 0 0 0-6.5-6.5"></path>
  <path d="M15.7 19a9.7 9.7 0 0 0-9.7-9.7"></path>
  <path d="M4.8 7h2.4"></path>
  <path d="M4.8 9.2h2.4"></path>
  <path d="M4.8 11.4h2.4"></path>
  <path d="M4.8 13.6h2.4"></path>
  <path d="M4.8 15.8h2.4"></path>
</svg>`;
const GROUP_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M10.2 9H8.1a3.6 3.6 0 0 0 0 7.2h3.4a3.6 3.6 0 0 0 2.5-1"></path>
  <path d="M13.8 15h2.1a3.6 3.6 0 1 0 0-7.2h-3.4a3.6 3.6 0 0 0-2.5 1"></path>
  <path d="M9.6 12h4.8"></path>
</svg>`;
const VIEW_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5z"></path>
  <circle cx="12" cy="12" r="2.4"></circle>
</svg>`;
const CONSTRUCTION_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M8 8h8v8H8z"></path>
  <path d="M6 6h2v2H6z" fill="currentColor" stroke="none"></path>
  <path d="M16 6h2v2h-2z" fill="currentColor" stroke="none"></path>
  <path d="M6 16h2v2H6z" fill="currentColor" stroke="none"></path>
  <path d="M16 16h2v2h-2z" fill="currentColor" stroke="none"></path>
</svg>`;
const STRUCTURE_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4.5 15.5h15"></path>
  <path d="M6.5 15.5V9.2"></path>
  <path d="M17.5 15.5V9.2"></path>
  <path d="M5.5 9.2h13"></path>
  <path d="M7.3 9.2l2.5-2.7h4.4l2.5 2.7"></path>
  <path d="M8.2 12.4h7.6"></path>
</svg>`;
const DELETE_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 48 48" aria-hidden="true">
  <line x1="9" y1="12" x2="39" y2="12"></line>
  <polyline points="17 12 20 8 28 8 31 12"></polyline>
  <polyline points="36 16 34.222 40 13.778 40 12 16"></polyline>
  <line x1="24" y1="18" x2="24" y2="32"></line>
  <line x1="30" y1="18" x2="30" y2="32"></line>
  <line x1="18" y1="18" x2="18" y2="32"></line>
</svg>`;
const DIFFERENCE_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="6" y="9" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="2 3"></rect>
  <path d="M19 15v-8H11" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="miter" stroke-linecap="butt"></path>
</svg>`;
const SPACE_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M5.3 8.9L14.7 8.9L14.7 18.3L5.3 18.3L5.3 8.9" stroke-dasharray="2 3"></path>
  <path d="M5.3 8.9L9.7 5.4L19.1 5.4L14.7 8.9" stroke-dasharray="2 3"></path>
  <path d="M14.7 8.9L14.7 18.3L19.1 14.8L19.1 5.4" stroke-dasharray="2 3"></path>
</svg>`;
const EXCAVATION_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M9 7.2l8 4.8-8 4.8z" fill="currentColor" stroke="none"></path>
</svg>`;
const STYLE_ICON_SVG = `
<svg class="ui-icon-glyph" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M6 10V6h4"></path>
  <path d="M14 6h4v4"></path>
  <path d="M18 14v4h-4"></path>
  <path d="M10 18H6v-4"></path>
</svg>`;
const DECORATION_ICON_SVG = `
<svg class="ui-icon-glyph ui-icon-glyph-filled" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="1" y="1" width="22" height="22" rx="4.2" fill="none" stroke="currentColor" stroke-width="0.2"></rect>
  <path d="M6.2 2.1v19.8M12 2.1v19.8M17.8 2.1v19.8M2.1 6.2h19.8M2.1 12h19.8M2.1 17.8h19.8" stroke="currentColor" stroke-width="0.2"></path>
  <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="0.2" fill="none"></circle>
  <circle cx="12" cy="12" r="4.8" stroke="currentColor" stroke-width="0.2" fill="none"></circle>
  <path d="M2.1 2.1l19.8 19.8M21.9 2.1L2.1 21.9" stroke="currentColor" stroke-width="0.2"></path>
</svg>`;
const CREAT_ICON_SVG = `
<svg class="ui-icon-glyph ui-icon-glyph-filled" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="1" y="1" width="22" height="22" rx="4.2" fill="#2f9ae6" stroke="#8ff0c2" stroke-width="0.2"></rect>
  <path d="M6.2 2.1v19.8M12 2.1v19.8M17.8 2.1v19.8M2.1 6.2h19.8M2.1 12h19.8M2.1 17.8h19.8" stroke="#8ff0c2" stroke-width="0.2"></path>
  <circle cx="12" cy="12" r="8.5" stroke="#8ff0c2" stroke-width="0.2" fill="none"></circle>
  <circle cx="12" cy="12" r="4.8" stroke="#8ff0c2" stroke-width="0.2" fill="none"></circle>
  <path d="M2.1 2.1l19.8 19.8M21.9 2.1L2.1 21.9" stroke="#8ff0c2" stroke-width="0.2"></path>
</svg>`;

const UI_BUTTON_META = {
    see: {
        label: '鑑賞モード',
        icon: '🎦',
        variant: 'icon',
    },
    edit: {
        label: '編集モード',
        icon: '🛠️',
        variant: 'icon',
    },
    rail: {
        label: 'レール編集',
        icon: '🛤️',
        variant: 'icon-square',
    },
    structure: {
        label: '構造物',
        svg: STRUCTURE_ICON_SVG,
        variant: 'icon-square',
    },
    creat: {
        label: 'クリエイトモード',
        icon: '✨',
        variant: 'icon',
    },
    rotation: {
        label: '回転',
        svg: ROTATION_ICON_SVG,
        variant: 'icon-square',
    },
    rotation_rail: {
        label: 'レール回転',
        svg: ROTATION_ICON_SVG,
        variant: 'icon-square',
    },
    move_point: {
        label: 'ポイント移動',
        svg: MOVE_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    move: {
        label: '移動',
        svg: MOVE_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    face_move: {
        label: '面方向移動',
        icon: '面',
        variant: 'icon-square',
    },
    plane_move: {
        label: '平面移動',
        icon: '平面',
        variant: 'icon-square',
    },
    height_move: {
        label: '高さ移動',
        icon: '高さ',
        variant: 'icon-square',
    },
    move_structure: {
        label: '移動',
        svg: MOVE_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    add_point: {
        label: 'ポイント追加',
        svg: ADD_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    new: {
        label: '新規追加',
        svg: ADD_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    guide_y: {
        label: 'ガイドY変更',
        icon: '↕',
        variant: 'icon-square',
    },
    copy: {
        label: 'コピー',
        svg: COPY_ICON_SVG,
        variant: 'icon-square',
    },
    delete: {
        label: '削除',
        svg: DELETE_ICON_SVG,
        variant: 'icon-square',
    },
    Difference: {
        label: 'Difference',
        svg: DIFFERENCE_ICON_SVG,
        variant: 'icon-square',
    },
    area: {
        label: 'Area',
        svg: SPACE_ICON_SVG,
        variant: 'icon-square',
    },
    area_space: {
        label: 'Area Space',
        svg: SPACE_ICON_SVG,
        variant: 'icon-square',
    },
    area_add: {
        label: 'Area Add',
        svg: ADD_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    area_move: {
        label: 'Area Move',
        svg: MOVE_POINT_ICON_SVG,
        variant: 'icon-square',
    },
    area_rotation: {
        label: 'Area Rotation',
        svg: ROTATION_ICON_SVG,
        variant: 'icon-square',
    },
    area_scale: {
        label: 'Area Scale',
        icon: '拡',
        variant: 'icon-square',
    },
    space: {
        label: 'Difference Space',
        svg: SPACE_ICON_SVG,
        variant: 'icon-square',
    },
    excavation: {
        label: 'Excavation',
        svg: EXCAVATION_ICON_SVG,
        variant: 'icon-square',
    },
    style: {
        label: 'スタイル',
        svg: STYLE_ICON_SVG,
        variant: 'icon-square',
    },
    texture: {
        label: 'テクスチャ',
        svg: STYLE_ICON_SVG,
        variant: 'icon-square',
    },
    search: {
        label: '検索',
        svg: SEARCH_ICON_SVG,
        variant: 'icon-square',
    },
    group: {
        label: 'グループ',
        svg: GROUP_ICON_SVG,
        variant: 'icon-square',
    },
    view: {
        label: '表示',
        svg: VIEW_ICON_SVG,
        variant: 'icon-square',
    },
    construction: {
        label: '構造生成',
        svg: CONSTRUCTION_ICON_SVG,
        variant: 'icon-square',
    },
    'construction/2': {
        label: '構造生成',
        svg: CONSTRUCTION_ICON_SVG,
        variant: 'icon-square',
    },
    decoration: {
        label: 'デコレーション',
        svg: DECORATION_ICON_SVG,
        variant: 'icon-square',
    },
};

function compactVisibleButtons() {
    const buttons = Array.from(UiGroup.querySelectorAll('button'));
    let rootColumn = 0;
    let editChildColumn = 0;
    let row = 1;
    console.log('compactVisibleButtons', buttons.map(b => ({ id: b.id, hidden: b.hidden })));
    buttons.forEach((b) => {
        if (b.hidden) {
            return;
        }
        if (b.dataset.uiRootLevel === '1') {
             console.log(UI_CHILDREN_TOP_OFFSET);
            b.style.top = UI_BUTTON_TOP_OFFSET + 'px';
            b.style.left = (UI_ROOT_BUTTON_LEFT_OFFSET + (UI_ROOT_BUTTON_COLUMN_GAP * rootColumn)) + 'px';
            rootColumn += 1;
            return;
        }
        if (b.dataset.uiParentId === 'edit') {
             console.log(UI_CHILDREN_TOP_OFFSET);
            b.style.top = UI_CHILDREN_TOP_OFFSET + 'px';
            b.style.left = (UI_EDIT_CHILD_LEFT_OFFSET + (UI_EDIT_CHILD_COLUMN_GAP * editChildColumn)) + 'px';
            editChildColumn += 1;
            return;
        }
        b.style.top = 15+((UI_BUTTON_ROW_GAP * row) + UI_CHILDREN_TOP_OFFSET) + 'px';
        row += 1;
        console.log('compacting', b.id, b.style.top);
    });
}

function paintUiSelection(uiIDs = [], selectedId = null) {
    UiGroup.querySelectorAll('button').forEach((b) => {
        b.style.backgroundColor = UI_COLOR_DEFAULT;
        b.style.color = b.classList.contains('ui-icon-button') ? UI_ICON_TEXT_DEFAULT : '';
    });

    UiGroup.querySelectorAll('button').forEach((b) => {
        if (uiIDs.includes(b.id)) {
            b.style.backgroundColor = UI_COLOR_ACTIVE;
            b.style.color = b.classList.contains('ui-icon-button') ? UI_ICON_TEXT_ACTIVE : UI_TEXT_ACTIVE;
        }
    });

    if (selectedId) {
        const selected = document.getElementById(selectedId);
        if (selected) {
            selected.style.backgroundColor = UI_COLOR_SELECTED;
            selected.style.color = selected.classList.contains('ui-icon-button') ? UI_ICON_TEXT_ACTIVE : UI_TEXT_ACTIVE;
        }
    }
}

function toggleProcessing(uiIDs,next_nest,selectedId = null){
    
    // 無効化
    UiGroup.querySelectorAll('button').forEach(b => {
        // console.log(b.id)
        const active = uiIDs.includes(b.id);
        const next = next_nest.includes(b.id);
        if (!active) {
            b.hidden = true; // 非表示
            b.style.display = 'none';
            if(UisToggle[b.id] === 'active'){
                // console.log('ruuu')
                UisToggle[b.id] = 'inactive'
                UIevent (b.id, 'inactive')
            }
        }

        if (next){
            b.hidden = false; // 表示
            b.style.display = '';
        }
    })

    // 有効化
    UiGroup.querySelectorAll('button').forEach(b => {
        // console.log(b.id)
        const active = uiIDs.includes(b.id);
        if (active) {
            b.hidden = false; // 表示
            b.style.display = '';
            if(UisToggle[b.id] === 'inactive'){
                // console.log('runn')
                UisToggle[b.id] = 'active'
                UIevent (b.id, 'active')
            }
        }
    })

    // 第一層はモード遷移に関わらず常時表示
    UiGroup.querySelectorAll('button[data-ui-root-level="1"]').forEach((b) => {
        b.hidden = false;
        b.style.display = '';
    });

    compactVisibleButtons();
    paintUiSelection(uiIDs, selectedId);
}

function getValueByIndex(uiTree, UiGroup, index){

    const active_UIs = []
    const next_nest = []

    // UiGroup.querySelectorAll('button').forEach(b => {
    //     b.hidden = true; // 押されたボタンは表示
    // })
        
    let val = []
    for (let i = 0; i < index.length; i++){
        const values = Object.entries(uiTree);  // ["Apple", "Banana", "Cherry"]
        
        if (values.length-1 < index[i]){
            console.log('存在しない値です')
            return
        }
        uiTree = values[index[i]][1]
        const key = values[index[i]][0]
        active_UIs.push(key)
        
        // UiGroup.querySelectorAll('button').forEach(b => {
        //     if (b.id === key) {
        //       b.hidden = false; // 押されたボタンは表示
        //     }
        //   });
        
        const nest = Object.keys(uiTree);  // ["Apple", "Banana", "Cherry"]

        //  console.log(val.length)
        for (let i_a = 0; i_a < nest.length; i_a++){
            next_nest.push(nest[i_a])
            // UiGroup.querySelectorAll('button').forEach(b => {
            //     if (b.id === nest[i_a]) {
            //     b.hidden = false; // 押されたボタンは表示
            //     }
            // });
        }
    }

    toggleProcessing(active_UIs,next_nest,active_UIs[active_UIs.length - 1] || null)

}

function getAllkeys(uiTree, now_index=[], Allkeys={}, Duplication={}, rename_uiTree={}){
    const obj = Object.entries(uiTree)
    for (let i = 0; i <obj.length; i++){
        const key = obj[i][0]
        let rename_key = key
        if(Duplication[key] > 0){
            Duplication[key] += 1
            rename_key = key+'/'+Duplication[key]
            Allkeys[rename_key] = now_index.concat([i])
        } else {
            Duplication[key] = 1
            Allkeys[key] = now_index.concat([i])
        }
        rename_uiTree[rename_key] = ''
        const ReturnValue = getAllkeys(obj[i][1], now_index.concat([i]), Allkeys, Duplication)
        Allkeys = ReturnValue[0]
        Duplication = ReturnValue[1]
        if (Object.keys(ReturnValue[2]).length > 0){rename_uiTree[rename_key] = ReturnValue[2]}
    }
    return [Allkeys, Duplication, rename_uiTree]
}

function buildUiGroup(uiTree, uiGroup){
    const ReturnValue = getAllkeys(uiTree)
    const allKeysMap = ReturnValue[0]
    const orderedKeys = Object.keys(allKeysMap)
    const deepth = allKeysMap
    const creatPath = allKeysMap['creat'] || null
    const railPath = allKeysMap['rail'] || null
    const railRowIndex = orderedKeys.indexOf('rail')
    const creatRowIndex = orderedKeys.indexOf('creat')
    const railBaseLeft = Array.isArray(railPath) ? (railPath.length - 1) * 10 : 10
    const creatBranchOffset = 0//36

    if (!uiGroup) {
        return { allKeysMap, orderedKeys, renameTree: ReturnValue[2] }
    }

    uiGroup.textContent = ''
    for (let i = 0; i < orderedKeys.length; i++){
        const key = orderedKeys[i]
        const btn = document.createElement('button')
        const path = deepth[key]
        const inCreatBranch = Array.isArray(creatPath)
          && Array.isArray(path)
          && creatPath.every((v, idx) => path[idx] === v)
        const parentKey = Array.isArray(path) && path.length > 1
          ? orderedKeys.find((candidate) => {
              const candidatePath = deepth[candidate]
              return Array.isArray(candidatePath)
                && candidatePath.length === path.length - 1
                && candidatePath.every((v, idx) => v === path[idx])
            }) || ''
          : ''
        btn.id = key
        btn.dataset.uiParentId = parentKey
        const topRow = inCreatBranch && railRowIndex >= 0 && creatRowIndex >= 0
            ? railRowIndex + (i - creatRowIndex)
            : i
        if (path.length === 1) {
            // btn.style.top = UI_BUTTON_TOP_OFFSET + 'px'
            btn.style.left = (UI_ROOT_BUTTON_LEFT_OFFSET + (UI_ROOT_BUTTON_COLUMN_GAP * i)) + 'px'
            btn.style.right = 'auto'
        } else if (inCreatBranch) {
            // btn.style.top = ( 20 + (UI_BUTTON_ROW_GAP * topRow) + UI_CHILDREN_TOP_OFFSET) + 'px'
            btn.style.left = (creatBranchOffset + (path.length - 3) * 7) + 'px'
            btn.style.right = 'auto'
        } else {
            // btn.style.top = ( 20 + (UI_BUTTON_ROW_GAP * topRow) + UI_CHILDREN_TOP_OFFSET) + 'px'
            btn.style.left = ((path.length - 3) * 7) + 'px'
            btn.style.right = 'auto'
        }
        const meta = UI_BUTTON_META[key] || null
        btn.setAttribute('type', 'button')
        if (meta) {
            if (meta.svg) {
                btn.innerHTML = meta.svg
            } else {
                btn.textContent = meta.icon
            }
            btn.classList.add('ui-icon-button')
            if (meta.variant === 'icon-square') {
                btn.classList.add('ui-icon-button-square')
            }
            btn.setAttribute('aria-label', meta.label)
            // A custom tooltip is rendered in index.html, so avoid the native browser tooltip.
            btn.removeAttribute('title')
            btn.dataset.uiVariant = meta.variant
        } else {
            btn.textContent = key
            btn.setAttribute('aria-label', key)
        }
        uiGroup.appendChild(btn)
    }

    return { allKeysMap, orderedKeys, renameTree: ReturnValue[2] }
}

function connectionUI(uiTree){
    const Allkeys = getAllkeys(uiTree)
    const UIs = {}
    for(let i=0; i < Allkeys.length; i++){
        UIs.Allkeys[i] = document.getElementById(Allkeys[i]);
    }
    return UIs.Allkeys
}

const uiTree = {
    'see': '',
    'edit': {
        'rail': {
            'new': '',
            'move': { 'x_z': '', 'y': '', 
                // 'rotation_rail': '' 
            },
            'structure': {
                'new': '',
                'move_structure': '',
                'construction': {
                    'bridge': '',
                    'elevated': '',
                    'wall': '',
                    'floor': '',
                    'pillar': '',
                    'rib_bridge': '',
                    'tunnel_rect': '',
                    'tunnel_circle': '',
                    'platform': '',
                    'group_rail': '',
                },
            },
        },
        'creat': {
            'view': '',
            'decoration': {
              'add_point': {
                  'template': '',
                  'guide': {
                      'add': '',
                      'change_angle': '',
                      'miller': {
                          'miller_add': '',
                          'Influence': '',
                      },
                      'x_z_move': '',
                      'y_add': '',
                  },
              },
              'rotation': '',
              'search': '',
              'move_point': { 'x_z_sf': '', 'y_sf': '', 'rotation': '', 'scale': '' },
              'copy': '',
              'group': '',
              'style': '',
              'delete': '',
              'construction': {
                  'pillar': { 'Round_bar': '', 'H_beam': '', 'T_beam': '', 'L_beam': '' },
                  'rite': { 'tubular': '' },
                  'tube': { 'normal': '' },
              },
            },
            'Difference': {
                'space': {
                    'add': '',
                    'move': {
                        'face_move': '',
                        'plane_move': '',
                        'height_move': '',
                    },
                    'rotation': '',
                    'scale': '',
                    'tube': '',
                    'line': '',
                    'texture': '',
                },
                'excavation': '',
            },
            'area': {
                'area_space': {
                    'area_add': '',
                    'area_move': '',
                    'area_rotation': '',
                    'area_scale': '',
                },
            },
        },
        // 'custom': {
        //     'new': '',
        //     'move': { 'x_z': '', 'y': '' },
        //     'construct': '',
        // },
    },
}

// function UIevent (uiID, toggle){
//     if ( uiID === 'see' ){ if ( toggle === 'active' ){
//     console.log( 'see _active' )
//     } else {
//     console.log( 'see _inactive' )
//     }} else if ( uiID === 'edit' ){ if ( toggle === 'active' ){
//     console.log( 'edit _active' )
//     } else {
//     console.log( 'edit _inactive' )
//     }} else if ( uiID === 'rail' ){ if ( toggle === 'active' ){
//     console.log( 'rail _active' )
//     } else {
//     console.log( 'rail _inactive' )
//     }} else if ( uiID === 'new' ){ if ( toggle === 'active' ){
//     console.log( 'new _active' )
//     } else {
//     console.log( 'new _inactive' )
//     }} else if ( uiID === 'move' ){ if ( toggle === 'active' ){
//     console.log( 'move _active' )
//     } else {
//     console.log( 'move _inactive' )
//     }} else if ( uiID === 'x_z' ){ if ( toggle === 'active' ){
//     console.log( 'x_z _active' )
//     } else {
//     console.log( 'x_z _inactive' )
//     }} else if ( uiID === 'y' ){ if ( toggle === 'active' ){
//     console.log( 'y _active' )
//     } else {
//     console.log( 'y _inactive' )
//     }} else if ( uiID === 'new/2' ){ if ( toggle === 'active' ){
//     console.log( 'new/2 _active' )
//     } else {
//     console.log( 'new/2 _inactive' )
//     }} else if ( uiID === 'move/2' ){ if ( toggle === 'active' ){
//     console.log( 'move/2 _active' )
//     } else {
//     console.log( 'move/2 _inactive' )
//     }} else if ( uiID === 'x_z/2' ){ if ( toggle === 'active' ){
//     console.log( 'x_z/2 _active' )
//     } else {
//     console.log( 'x_z/2 _inactive' )
//     }} else if ( uiID === 'y/2' ){ if ( toggle === 'active' ){
//     console.log( 'y/2 _active' )
//     } else {
//     console.log( 'y/2 _inactive' )
//     }} else if ( uiID === 'creat' ){ if ( toggle === 'active' ){
//     console.log( 'creat _active' )
//     } else {
//     console.log( 'creat _inactive' )
//     }} else if ( uiID === 'sphere' ){ if ( toggle === 'active' ){
//     console.log( 'sphere _active' )
//     } else {
//     console.log( 'sphere _inactive' )
//     }} else if ( uiID === 'cube' ){ if ( toggle === 'active' ){
//     console.log( 'cube _active' )
//     } else {
//     console.log( 'cube _inactive' )
//     }} else if ( uiID === 'pick' ){ if ( toggle === 'active' ){
//     console.log( 'pick _active' )
//     } else {
//     console.log( 'pick _inactive' )
//     }} else if ( uiID === 'x_z/3' ){ if ( toggle === 'active' ){
//     console.log( 'x_z/3 _active' )
//     } else {
//     console.log( 'x_z/3 _inactive' )
//     }} else if ( uiID === 'y/3' ){ if ( toggle === 'active' ){
//     console.log( 'y/3 _active' )
//     } else {
//     console.log( 'y/3 _inactive' )
//     }}
//   }

const UiGroup = document.getElementById('UiGroup');
UI_BUTTON_META.creat.svg = CREAT_ICON_SVG
UI_BUTTON_META.creat.variant = 'icon-square'
UI_BUTTON_META.creat.iconClass = 'ui-icon-glyph-decoration'
delete UI_BUTTON_META.creat.icon
const buildResult = buildUiGroup(uiTree, UiGroup)
const Allkeys = buildResult.allKeysMap
const rename_uiTree = buildResult.renameTree
const UisToggle = {...Allkeys};
Object.keys(UisToggle).forEach(key => {
    UisToggle[key] = 'inactive';
  });
UisToggle.see = 'active'

console.log(uiTree)
console.log(rename_uiTree)
// getValueByIndex(rename_uiTree,0,[1,1])

const rootKeys = Object.keys(rename_uiTree)
UiGroup.querySelectorAll('button').forEach(b => {
    b.dataset.uiRootLevel = rootKeys.includes(b.id) ? '1' : '0';
    if (rootKeys.includes(b.id)) {
      b.hidden = false; // ルートは表示
      b.style.display = '';
    } else {
      b.hidden = true;
    }
  })
paintUiSelection(['see'], 'see');

function showRootButtons(rootKeys) {
  UiGroup.querySelectorAll('button').forEach((b) => {
    if (rootKeys.includes(b.id)) {
      b.hidden = false;
      b.style.display = '';
    }
  });
}

function saveUiState(indexPath) {
  return Boolean(Array.isArray(indexPath) && indexPath.length > 0);
}

function loadUiState() {
  return null;
}

function applyUiState(indexPath, rootKeys) {
  if (!Array.isArray(indexPath) || indexPath.length < 1) { return false; }
  const ok = indexPath.every((v) => Number.isInteger(v));
  if (!ok) { return false; }
  try {
    getValueByIndex(rename_uiTree, UiGroup, indexPath);
    showRootButtons(rootKeys);
    return true;
  } catch (err) {
    console.warn('failed to apply UI state', err);
    return false;
  }
}

function applyUiStateById(id) {
  const indexPath = Allkeys[String(id || '').trim()];
  if (!Array.isArray(indexPath) || indexPath.length < 1) { return false; }
  const applied = applyUiState(indexPath, rootKeys);
  if (applied) {
    saveUiState(indexPath);
  }
  return applied;
}

function applySavedUiStateOrDefault(defaultId = 'see') {
  if (!defaultId) {
    return false;
  }
  return applyUiStateById(defaultId);
}

UiGroup.addEventListener('click', (event) => {
  // クリックされた要素から一番近い button を探す
  const btn = event.target.closest('button');
  if (!btn || !UiGroup.contains(btn)) return; // グループ外やボタン以外は無視

  // ID を取得
  const id = btn.id; // 例: "btn-save"
  console.log('押されたボタンのID:', id, Allkeys[id]);

//   UIevent(id)

  getValueByIndex(rename_uiTree,UiGroup,Allkeys[id])
  saveUiState(Allkeys[id]);
  // もし data-id を使いたければ:
  // console.log('data-id:', btn.dataset.id);
  showRootButtons(rootKeys);
});

UiGroup.addEventListener('touchstart', (event) => {
    // クリックされた要素から一番近い button を探す
    const btn = event.target.closest('button');
    if (!btn || !UiGroup.contains(btn)) return; // グループ外やボタン以外は無視
  
    // ID を取得
    const id = btn.id; // 例: "btn-save"
    console.log('押されたボタンのID:', id, Allkeys[id]);
  
  //   UIevent(id)
  
    getValueByIndex(rename_uiTree,UiGroup,Allkeys[id])
    saveUiState(Allkeys[id]);
    // もし data-id を使いたければ:
    // console.log('data-id:', btn.dataset.id);
    showRootButtons(rootKeys);
  });

window.applyTrainEditUiStateById = applyUiStateById;
window.applyTrainEditSavedUiState = applySavedUiStateOrDefault;

applySavedUiStateOrDefault('see');
  
