import { characters, getCharacters, getRequestHeaders, selectCharacterById } from '../../../../../../script.js';
import {
    buildGameMasterCharacterCreatePayload,
    findCharacterByName,
    GAME_MASTER_CARD_NAME,
    normalizeCharacterName,
    resolveNarratorCardName,
} from './game-master-card-lib.js';

export {
    buildGameMasterCharacterCreatePayload,
    findCharacterByName,
    GAME_MASTER_CARD_NAME,
    normalizeCharacterName,
    resolveNarratorCardName,
} from './game-master-card-lib.js';

/**
 * Create an empty narrator card, or select it if it already exists.
 * @param {{ name?: string }} [options]
 * @returns {Promise<{ ok: boolean, created: boolean, selected: boolean, avatar: string, name: string }>}
 */
export async function createOrSelectGameMasterCard(options = {}) {
    const name = resolveNarratorCardName(options.name);
    const ctx = globalThis.SillyTavern?.getContext?.();
    const headers = (typeof ctx?.getRequestHeaders === 'function' ? ctx.getRequestHeaders() : null)
        || getRequestHeaders();

    let allChars = [];
    try {
        const res = await fetch('/api/characters/all', {
            method: 'POST',
            headers,
            body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(await res.text());
        const raw = await res.json();
        allChars = Array.isArray(raw) ? raw : [];
    } catch (err) {
        const msg = String(err?.message || err || '无法加载角色卡。');
        globalThis.toastr?.error?.(msg.substring(0, 180), 'Multihog D&D 规则框架');
        return { ok: false, created: false, selected: false, avatar: '', name };
    }

    const selectByAvatarOrName = async (avatar = '', targetName = name) => {
        if (typeof getCharacters === 'function') await getCharacters();
        const index = characters.findIndex(c => (
            (avatar && c.avatar === avatar)
            || normalizeCharacterName(c?.name) === normalizeCharacterName(targetName)
        ));
        if (index !== -1 && typeof selectCharacterById === 'function') {
            await selectCharacterById(index);
            return true;
        }
        return false;
    };

    const existing = findCharacterByName(allChars, name);
    if (existing) {
        try {
            const selected = await selectByAvatarOrName(existing.avatar, name);
            globalThis.toastr?.info?.(`"${name}" 已存在 —— 已选择该角色卡。`, 'Multihog D&D 规则框架');
            return { ok: true, created: false, selected, avatar: existing.avatar || '', name };
        } catch (err) {
            const msg = String(err?.message || err || '无法选择地下城主 (GM) 角色卡。');
            globalThis.toastr?.error?.(msg.substring(0, 180), 'Multihog D&D 规则框架');
            return { ok: false, created: false, selected: false, avatar: existing.avatar || '', name };
        }
    }

    try {
        const res = await fetch('/api/characters/create', {
            method: 'POST',
            headers,
            body: JSON.stringify(buildGameMasterCharacterCreatePayload(name)),
        });
        if (!res.ok) throw new Error(await res.text());
        const avatarKey = (await res.text()).trim();
        const selected = await selectByAvatarOrName(avatarKey, name);
        globalThis.toastr?.success?.(`已创建并选择 "${name}"。`, 'Multihog D&D 规则框架');
        return { ok: true, created: true, selected, avatar: avatarKey, name };
    } catch (err) {
        const msg = String(err?.message || err || '无法创建地下城主 (GM) 角色卡。');
        globalThis.toastr?.error?.(msg.substring(0, 180), 'Multihog D&D 规则框架');
        return { ok: false, created: false, selected: false, avatar: '', name };
    }
}
