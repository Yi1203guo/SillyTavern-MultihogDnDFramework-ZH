/**
 * First-open API checklist. SillyTavern still defaults to Text Completion and
 * cramped token sliders. This overlay shows live status checkboxes; it is not
 * a hard gate and can always be dismissed.
 */

import { getSettings } from '../state/settings-ref.js';
import { saveSettings } from '../app/runtime-bridge.js';
import { GAME_MASTER_CARD_NAME, resolveNarratorCardName } from './game-master-card-lib.js';

export const CHAT_COMPLETION_API = 'openai';
export const RECOMMENDED_OUTPUT_LENGTH = 100000;

const OVERLAY_ID = 'rt-api-setup-gate';
const PULSE_CLASS = 'rt-api-setup-pulse';
const API_SCREENSHOT = '/scripts/extensions/third-party/SillyTavern-MultihogDnDFramework/assets/st-api-chat-completion.png';

const API_LABELS = {
    openai: 'Chat Completion',
    textgenerationwebui: 'Text Completion',
    novel: 'NovelAI',
    koboldhorde: 'AI Horde',
    kobold: 'KoboldAI Classic',
};

const CHECKLIST_ITEMS = [
    {
        id: 'chatCompletion',
        title: '已启用聊天补全 (Chat Completion)',
        body: '文本补全 (Text Completion) 是在 ChatGPT 问世前使用的过时 API。请勿使用它。',
        shot: true,
    },
    {
        id: 'functionCalling',
        title: '已启用函数调用 (Function calling)',
        body: '这对于在 Multihog D&D 中使用更高效的工具版本至关重要，当然如果确实无法使用工具，也提供了备用方案。',
    },
    {
        id: 'maxContextUnlocked',
        title: '最大上下文长度无限制',
        body: '如今没有任何理由去限制它，实际上更有不应限制的理由。你理应搭配使用 {{summarizer}} 来隐藏历史消息，因此上下文实际通常不会超过 30k。人为施加硬性上下文限制只会破坏缓存命中率，导致成本更高。上下文上限是过去人们尚未学会如何做上下文摘要时的历史遗留产物。',
    },
    {
        id: 'outputLength',
        title: '单次输出长度设为 100,000',
        body: '默认设置过低，会导致程序开箱即无法正常运作。模型会突然中断输出，让用户困惑不解。更糟糕的是：当智能体输出 JSON 对象时如果撞上极低的截断上限，会导致 JSON 被截断并报出语法错误。\n\n这往往会导致扩展报错显得像是坏了一样，但这纯粹是因为过低的默认值。',
    },
];

export function getSillyTavernMainApi() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const fromContext = String(ctx?.mainApi || '').trim();
        if (fromContext) return fromContext;
    } catch (_) { /* context not ready */ }
    if (typeof document === 'undefined') return '';
    return String(document.querySelector('#main_api')?.value || '').trim();
}

export function isChatCompletionApi(api = getSillyTavernMainApi()) {
    return api === CHAT_COMPLETION_API;
}

export function describeMainApi(api = getSillyTavernMainApi()) {
    const id = String(api || '').trim();
    if (!id) return 'not set';
    return API_LABELS[id] || id;
}

export function getChatCompletionSettings() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const settings = ctx?.chatCompletionSettings;
        if (settings && typeof settings === 'object') return settings;
    } catch (_) { /* context not ready */ }
    return null;
}

function readBoolSetting(settings, key, selector) {
    if (settings && typeof settings[key] === 'boolean') return settings[key];
    if (typeof document === 'undefined') return false;
    return !!document.querySelector(selector)?.checked;
}

function readNumberSetting(settings, key, selector) {
    if (settings && Number.isFinite(Number(settings[key]))) return Number(settings[key]);
    if (typeof document === 'undefined') return 0;
    const raw = document.querySelector(selector)?.value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

export function isFunctionCallingEnabled(settings = getChatCompletionSettings()) {
    return readBoolSetting(settings, 'function_calling', '#openai_function_calling');
}

export function isMaxContextUnlocked(settings = getChatCompletionSettings()) {
    return readBoolSetting(settings, 'max_context_unlocked', '#oai_max_context_unlocked');
}

export function isOutputLengthRecommended(settings = getChatCompletionSettings()) {
    return readNumberSetting(settings, 'openai_max_tokens', '#openai_max_tokens') >= RECOMMENDED_OUTPUT_LENGTH;
}

export function getApiSetupStatuses() {
    const settings = getChatCompletionSettings();
    return {
        chatCompletion: isChatCompletionApi(),
        functionCalling: isFunctionCallingEnabled(settings),
        maxContextUnlocked: isMaxContextUnlocked(settings),
        outputLength: isOutputLengthRecommended(settings),
    };
}

export function shouldShowApiSetupGate(seen) {
    if (seen === true || seen === false) return seen !== true;
    try {
        return getSettings().apiSetupGateSeen !== true;
    } catch (_) {
        return true;
    }
}

function markGateSeen() {
    try {
        const settings = getSettings();
        settings.apiSetupGateSeen = true;
        saveSettings();
    } catch (_) { /* init race */ }
}

function setDomCheckbox(selector, checked) {
    if (typeof document === 'undefined') return false;
    const el = /** @type {HTMLInputElement|null} */ (document.querySelector(selector));
    if (!el) return false;
    const jq = globalThis.$;
    if (jq && typeof jq === 'function') {
        jq(el).prop('checked', checked).trigger('input');
        return !!el.checked === checked;
    }
    el.checked = checked;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return !!el.checked === checked;
}

function setDomNumber(selector, value) {
    if (typeof document === 'undefined') return false;
    const el = /** @type {HTMLInputElement|null} */ (document.querySelector(selector));
    if (!el) return false;
    const max = Number(el.max);
    if (Number.isFinite(max) && max < value) el.max = String(value);
    const jq = globalThis.$;
    if (jq && typeof jq === 'function') {
        jq(el).val(value).trigger('input');
        return Number(el.value) === value;
    }
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return Number(el.value) === value;
}

export function switchSillyTavernToChatCompletion() {
    if (typeof document === 'undefined') return false;
    const select = /** @type {HTMLSelectElement|null} */ (document.querySelector('#main_api'));
    if (!select) return false;
    const option = select.querySelector(`option[value="${CHAT_COMPLETION_API}"]`);
    if (!option) return false;
    const jq = globalThis.$;
    if (jq && typeof jq === 'function') {
        jq(select).val(CHAT_COMPLETION_API).trigger('change');
        return select.value === CHAT_COMPLETION_API;
    }
    if (select.value !== CHAT_COMPLETION_API) {
        select.value = CHAT_COMPLETION_API;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return select.value === CHAT_COMPLETION_API;
}

export function applyRecommendedApiSettings() {
    switchSillyTavernToChatCompletion();
    try {
        const settings = getChatCompletionSettings();
        if (settings) {
            settings.function_calling = true;
            settings.max_context_unlocked = true;
            settings.openai_max_tokens = RECOMMENDED_OUTPUT_LENGTH;
        }
    } catch (_) { /* settings bag not ready */ }
    setDomCheckbox('#openai_function_calling', true);
    setDomCheckbox('#oai_max_context_unlocked', true);
    const applyOutput = () => {
        try {
            const settings = getChatCompletionSettings();
            if (settings) settings.openai_max_tokens = RECOMMENDED_OUTPUT_LENGTH;
        } catch (_) { /* ignore */ }
        setDomNumber('#openai_max_tokens', RECOMMENDED_OUTPUT_LENGTH);
    };
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        window.setTimeout(applyOutput, 150);
    } else {
        applyOutput();
    }
    return getApiSetupStatuses();
}

export function revealSillyTavernApiDropdown() {
    if (typeof document === 'undefined') return false;
    const select = /** @type {HTMLSelectElement|null} */ (document.querySelector('#main_api'));
    if (!select) return false;
    let node = select.parentElement;
    while (node && node !== document.body) {
        if (node instanceof HTMLElement && node.style.display === 'none') node.style.display = '';
        node = node.parentElement;
    }
    const drawer = select.closest('.drawer-content, .inline-drawer-content, #rm_api_block');
    if (drawer instanceof HTMLElement && drawer.style.display === 'none') drawer.style.display = '';
    select.classList.add(PULSE_CLASS);
    try { select.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { /* ignore */ }
    try { select.focus(); } catch (_) { /* ignore */ }
    window.setTimeout(() => select.classList.remove(PULSE_CLASS), 8000);
    return true;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const SUMMARIZER_LINK = '<a href="https://github.com/Lodactio/Extension-Summaryception" target="_blank" rel="noopener noreferrer">摘要扩展</a>';

function renderBody(text) {
    return escapeHtml(text)
        .replace(/\n\n/g, '</span><span class="rt-api-setup-item-why">')
        .replace(/\{\{summarizer\}\}/g, SUMMARIZER_LINK);
}

function renderChecklist(statuses) {
    return CHECKLIST_ITEMS.map(item => {
        const ok = !!statuses[item.id];
        const shot = item.shot
            ? `<img class="rt-api-setup-shot" src="${API_SCREENSHOT}" alt="选中聊天补全的 SillyTavern API 下拉菜单">`
            : '';
        return `
            <div class="rt-api-setup-item${ok ? ' is-ok' : ''}">
                <input type="checkbox" disabled ${ok ? 'checked' : ''} aria-label="${escapeHtml(item.title)}">
                <span>
                    <span class="rt-api-setup-item-title">${escapeHtml(item.title)}</span>
                    <span class="rt-api-setup-item-why">${renderBody(item.body)}</span>
                    ${shot}
                </span>
            </div>`;
    }).join('');
}

export function buildOverlayHtml(statuses = getApiSetupStatuses(), options = {}) {
    const doneCount = Object.values(statuses).filter(Boolean).length;
    const narratorCardName = resolveNarratorCardName(options.narratorCardName);
    return `
        <div class="rt-api-setup-card" role="dialog" aria-labelledby="rt-api-setup-title">
            <div class="rt-api-setup-scroll">
            <div class="rt-api-setup-kicker">告别陈旧设置指引 (Anti-Museum Tour)</div>
            <h2 id="rt-api-setup-title">SillyTavern API 必查设置项</h2>
            <p>此菜单总结了作者数月以来收集的“错误报告”，发现 98% 的问题根源在于 SillyTavern 的默认设置。用户频繁遇到 JSON 语法错误等问题，调查后发现均是因为酒馆默认的最大输出长度过低导致的。</p>
            <div class="rt-api-setup-list" id="rt-api-setup-list">
                ${renderChecklist(statuses)}
            </div>
            <div class="rt-api-setup-gm-block">
                <div class="rt-api-setup-gm-row">
                    <label class="rt-api-setup-gm-label" for="rt-api-setup-gm-name">叙事者卡片名称</label>
                    <input id="rt-api-setup-gm-name" class="rt-api-setup-gm-name text_pole" type="text" value="${escapeHtml(narratorCardName)}" placeholder="${escapeHtml(GAME_MASTER_CARD_NAME)}" maxlength="120">
                    <button type="button" class="rt-api-setup-create-gm" id="rt-api-setup-create-gm">创建叙事者卡片</button>
                </div>
                <p class="rt-api-setup-gm-note">Multihog 不采用传统的一对一聊天格式，而是采用书籍风格的叙事格式，可无缝容纳多名角色登场。消息归属于叙事者，而非单一角色。</p>
            </div>
            <div class="rt-api-setup-status ${doneCount === 4 ? 'rt-api-setup-status-ok' : 'rt-api-setup-status-bad'}">
                已启用 ${doneCount} / 4 项推荐设置。当前 API：<b>${escapeHtml(describeMainApi())}</b>。
            </div>
            </div>
            <div class="rt-api-setup-actions">
                <button type="button" class="rt-api-setup-apply" id="rt-api-setup-apply">应用推荐设置</button>
                <button type="button" class="rt-api-setup-show" id="rt-api-setup-show">高亮指示 API 下拉菜单</button>
                <button type="button" class="rt-api-setup-continue" id="rt-api-setup-continue">继续</button>
            </div>
            <p class="rt-api-setup-foot">点击继续后此屏幕将不再自动出现。你可以随时从“常规与界面外观 → 核心与分支 → 告别陈旧设置指引”中重新打开。</p>
        </div>`;
}

function readNarratorCardNameFromOverlay(overlay) {
    const input = /** @type {HTMLInputElement|null} */ (overlay?.querySelector('#rt-api-setup-gm-name'));
    return resolveNarratorCardName(input?.value);
}

function refreshIfOpen() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const narratorCardName = readNarratorCardNameFromOverlay(overlay);
    overlay.innerHTML = buildOverlayHtml(getApiSetupStatuses(), { narratorCardName });
    bindOverlayControls(overlay);
}

function bindOverlayControls(overlay) {
    overlay.querySelector('#rt-api-setup-apply')?.addEventListener('click', () => {
        const switched = switchSillyTavernToChatCompletion();
        applyRecommendedApiSettings();
        if (!switched) revealSillyTavernApiDropdown();
        refreshIfOpen();
        if (typeof window !== 'undefined') window.setTimeout(refreshIfOpen, 180);
    });
    overlay.querySelector('#rt-api-setup-show')?.addEventListener('click', () => {
        revealSillyTavernApiDropdown();
    });
    overlay.querySelector('#rt-api-setup-create-gm')?.addEventListener('click', async () => {
        const btn = /** @type {HTMLButtonElement|null} */ (overlay.querySelector('#rt-api-setup-create-gm'));
        const name = readNarratorCardNameFromOverlay(overlay);
        if (btn) btn.disabled = true;
        try {
            const { createOrSelectGameMasterCard } = await import('./game-master-card.js');
            await createOrSelectGameMasterCard({ name });
        } finally {
            if (btn) btn.disabled = false;
        }
    });
    overlay.querySelector('#rt-api-setup-continue')?.addEventListener('click', () => {
        markGateSeen();
        overlay.remove();
    });
}

export function hideApiSetupGate() {
    if (typeof document === 'undefined') return;
    document.getElementById(OVERLAY_ID)?.remove();
}

export function showApiSetupGate() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'rt-api-setup-gate';
        document.body.appendChild(overlay);
    }
    overlay.innerHTML = buildOverlayHtml(getApiSetupStatuses());
    bindOverlayControls(overlay);
}

export function syncApiSetupGate() {
    if (shouldShowApiSetupGate()) showApiSetupGate();
    else hideApiSetupGate();
}

function bindLiveStatusRefresh() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const eventSource = ctx?.eventSource;
        const eventTypes = ctx?.eventTypes || ctx?.event_types;
        if (eventSource?.on) {
            if (eventTypes?.MAIN_API_CHANGED) eventSource.on(eventTypes.MAIN_API_CHANGED, refreshIfOpen);
            if (eventTypes?.SETTINGS_UPDATED) eventSource.on(eventTypes.SETTINGS_UPDATED, refreshIfOpen);
        }
    } catch (_) { /* ST events not ready */ }
    if (typeof document === 'undefined') return;
    document.addEventListener('change', (event) => {
        if (event.target?.id === 'main_api') refreshIfOpen();
    }, true);
    document.addEventListener('input', (event) => {
        const id = event.target?.id;
        if (id === 'openai_function_calling' || id === 'oai_max_context_unlocked' || id === 'openai_max_tokens') {
            refreshIfOpen();
        }
    }, true);
}

export function installApiSetupGate() {
    if (typeof document === 'undefined') return;
    syncApiSetupGate();
    bindLiveStatusRefresh();
}
