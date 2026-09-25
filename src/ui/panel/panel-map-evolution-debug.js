import { getActiveChatId } from '../../../state-manager.js';
import { createChatCommitGuard, chatCommitResult, ignoreChatCancellation } from '../../state/pass-affinity.js';
import { getSettings } from '../../../state-manager.js';
import {
    MAP_ASSET_KINDS,
    advanceCampaignTime,
    currentCampaignTimeLabel,
    debugAddAsset,
    debugClearEvolutionHistory,
    debugRedoLastEvolutionPass,
    debugRunEvolution,
    debugSetAsset,
    debugSimulateTicks,
    debugUndoLastEvolutionPass,
    describeEvolutionSandbox,
    peekTestingGroundLastPass,
    setCampaignTimeLabel,
} from '../../../map-evolution-debug.js';
import { collectEvolutionArcSubjects, describeEvolutionAssetArc, stripEvolutionDigestSitePrefix } from '../../../map-evolution-lib.js';

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function optionList(values, selected = '') {
    return values.map(value => {
        const label = typeof value === 'string' ? value : value.label;
        const id = typeof value === 'string' ? value : value.id;
        return `<option value="${escapeHtml(id)}"${id === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
}

function prettyJson(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value ?? '');
    }
}

function formatTokenCount(value) {
    const n = Math.max(0, Math.floor(Number(value) || 0));
    return String(n);
}

function renderMemoryBar(memory) {
    const mem = memory || {};
    const closed = formatTokenCount(mem.closedTokens);
    const threshold = formatTokenCount(mem.threshold);
    const over = !!mem.overThreshold;
    const enabled = mem.compressEnabled !== false;
    const status = !enabled
        ? '压缩关闭'
        : over
            ? '达到或超过阈值 —— 本次演进在记录后将压缩已结束的事件链'
            : '低于阈值 —— 已结束的历史记录保持原样';
    return `
        <div class="rt-map-evo-debug-memory-bar${over ? ' is-over' : ''}${enabled ? '' : ' is-off'}">
            <div class="rt-map-evo-debug-stat">
                <span>已结束事件链 Token</span>
                <strong data-debug="closed-tokens">${escapeHtml(closed)} / ${escapeHtml(threshold)}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>未结束事件链 (保留)</span>
                <strong>${escapeHtml(formatTokenCount(mem.openTokens))} tok · ${escapeHtml(String(mem.openCount || 0))}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>待处理积压</span>
                <strong>${escapeHtml(formatTokenCount(mem.backlogTokens))} tok · ${escapeHtml(String(mem.backlogCount || 0))}</strong>
            </div>
            <div class="rt-map-evo-debug-stat">
                <span>存储记忆总量</span>
                <strong>${escapeHtml(formatTokenCount(mem.totalTokens))} tok · ${escapeHtml(String(mem.entryCount || 0))} 个事件${mem.digestCount ? ` · ${escapeHtml(String(mem.digestCount))} 条摘要` : ''}</strong>
            </div>
        </div>
        <p class="rt-map-evo-debug-memory-status">${escapeHtml(status)}</p>
    `;
}

function renderMemoryLedger(memory) {
    const mem = memory || {};
    const threadJson = prettyJson(mem.storedThreads || []);
    const backlogJson = prettyJson(mem.storedBacklog || []);
    const threadText = String(mem.threadText || '').trim() || '(未存储因果事件链文本。)';
    const backlogText = String(mem.backlogText || '').trim() || '(未存储演进积压。)';
    return `
        <section class="rt-map-evo-debug-memory">
            <div class="rt-map-evo-debug-subtitle">存储的演进记忆</div>
            <p class="rt-map-evo-debug-lead">这是该地点存储的台账。压缩针对已结束的事件进行统计；DIGEST 行是压缩器的输出；当前未结束的事件链保持原样。</p>
            <div class="rt-map-evo-debug-memory-grid">
                <section>
                    <div class="rt-map-evo-debug-subtitle">因果事件链 (存储的 JSON)</div>
                    <pre class="rt-map-evo-debug-memory-pre" data-debug="threads-json">${escapeHtml(threadJson)}</pre>
                </section>
                <section>
                    <div class="rt-map-evo-debug-subtitle">演进积压 (存储的 JSON)</div>
                    <pre class="rt-map-evo-debug-memory-pre" data-debug="backlog-json">${escapeHtml(backlogJson)}</pre>
                </section>
            </div>
            <div class="rt-map-evo-debug-subtitle">演进读取的因果事件链</div>
            <pre class="rt-map-evo-debug-memory-pre" data-debug="threads-text">${escapeHtml(threadText)}</pre>
            <div class="rt-map-evo-debug-subtitle">演进读取的积压内容</div>
            <pre class="rt-map-evo-debug-memory-pre" data-debug="backlog-text">${escapeHtml(backlogText)}</pre>
        </section>
    `;
}

function renderThreads(threads) {
    const open = threads?.open || [];
    if (!open.length && !(threads?.entries || []).length) {
        return '<div class="rt-map-evo-debug-empty">暂无因果事件链。击杀、击伤或附带原因移动某实体即可开启。</div>';
    }
    const openHtml = open.length
        ? open.map(entry => `<li><span class="rt-map-evo-debug-open">OPEN</span> <code>${escapeHtml(entry.subjectId)}</code>${entry.actor ? ` by ${escapeHtml(entry.actor)}` : ''}: ${escapeHtml(entry.cause)} <time>${escapeHtml(entry.at)}</time></li>`).join('')
        : '<li class="rt-map-evo-debug-empty">无未结束的事件链。</li>';
    const recentEntries = [...(threads?.entries || [])].reverse();
    const recent = recentEntries.map(entry => {
        const kind = entry.compressed ? 'compressed' : (entry.status || 'open');
        const label = entry.compressed ? 'DIGEST' : String(entry.status || 'open').toUpperCase();
        const badgeClass = entry.compressed ? 'rt-map-evo-debug-compressed' : `rt-map-evo-debug-${kind}`;
        return `<li><span class="${badgeClass}">${escapeHtml(label)}</span> ${escapeHtml(entry.summary)} <time>${escapeHtml(entry.at)}</time></li>`;
    }).join('');
    const truncated = threads?.truncated
        ? `<div class="rt-map-evo-debug-empty">较早的历史事件因达到存储上限已被舍弃。</div>`
        : '';
    return `<div class="rt-map-evo-debug-subtitle">未结束事件链</div><ul class="rt-map-evo-debug-list">${openHtml}</ul>
        <div class="rt-map-evo-debug-subtitle">归因事件</div><ul class="rt-map-evo-debug-list">${recent || '<li class="rt-map-evo-debug-empty">无。</li>'}</ul>${truncated}`;
}

function renderAssets(document, selectedId = '') {
    const assets = Array.isArray(document?.assets) ? document.assets : [];
    if (!assets.length) return '<div class="rt-map-evo-debug-empty">本地图上暂无资产。</div>';
    return `<ul class="rt-map-evo-debug-list">${assets.map(asset => {
        const cause = asset.cause ? ` — ${escapeHtml(asset.cause)}` : '';
        const actor = asset.actor ? ` by ${escapeHtml(asset.actor)}` : '';
        const since = asset.changed_at ? ` <time>${escapeHtml(asset.changed_at)}</time>` : '';
        const count = Number.isInteger(asset.count) ? ` ×${asset.count}` : '';
        const selected = asset.id === selectedId ? ' is-selected' : '';
        return `<li class="rt-map-evo-debug-asset${selected}" data-debug-arc="${escapeHtml(asset.id)}" title="追踪此资产的演化历程"><code>${escapeHtml(asset.id)}</code> ${escapeHtml(asset.name)}${count} [${escapeHtml(asset.kind)} / ${escapeHtml(asset.state)} / ${escapeHtml(asset.location || '—')}]${actor}${cause}${since}</li>`;
    }).join('')}</ul>`;
}

function arcSubjectOptions(subjects, selectedId) {
    const blank = [{ id: '', label: '选择要追踪的资产' }, ...subjects.map(subject => {
        const bits = [];
        if (subject.kind) bits.push(subject.kind);
        if (subject.state) bits.push(subject.state);
        if (!subject.onMap) bits.push('不在地图上');
        if (subject.open) bits.push('OPEN');
        if (subject.eventCount) bits.push(`${subject.eventCount} 个事件`);
        const extra = bits.length ? ` — ${bits.join(' · ')}` : '';
        return { id: subject.id, label: `${subject.name} (${subject.id})${extra}` };
    })];
    return optionList(blank, selectedId);
}

function renderAssetArc(sandbox, selectedId) {
    const storedThreads = sandbox?.memory?.storedThreads || [];
    const storedBacklog = sandbox?.memory?.storedBacklog || [];
    const subjects = collectEvolutionArcSubjects(storedThreads, sandbox?.document);
    if (!subjects.length) {
        return `<section class="rt-map-evo-debug-arc" data-debug="arc">
            <div class="rt-map-evo-debug-subtitle">资产演化历程</div>
            <div class="rt-map-evo-debug-empty">暂无资产或归因事件可追踪。</div>
        </section>`;
    }
    const chosen = String(selectedId || '').trim();
    const arc = chosen
        ? describeEvolutionAssetArc(storedThreads, chosen, { storedBacklog, document: sandbox?.document })
        : null;
    const occupancy = arc?.asset
        ? `<code>${escapeHtml(arc.asset.id)}</code> ${escapeHtml(arc.asset.name)}${Number.isInteger(arc.asset.count) ? ` ×${arc.asset.count}` : ''} [${escapeHtml(arc.asset.kind)} / ${escapeHtml(arc.asset.state)} / ${escapeHtml(arc.asset.location || '—')}]${arc.open ? ' · <span class="rt-map-evo-debug-open">OPEN</span>' : ''}`
        : chosen
            ? `<code>${escapeHtml(chosen)}</code> 不在当前地图上。${arc?.open ? ' 事件链仍处于 <span class="rt-map-evo-debug-open">OPEN</span>。' : ''}`
            : '从列表或下拉菜单中选择一个资产。仅显示该主体的事件，包括其对他人采取的行动以及压缩后的 DIGEST 提及。';
    const events = (arc?.events || []).map(entry => {
        const kind = entry.compressed ? 'compressed' : (entry.status || 'open');
        const label = entry.compressed ? 'DIGEST' : String(entry.status || 'open').toUpperCase();
        const badgeClass = entry.compressed ? 'rt-map-evo-debug-compressed' : `rt-map-evo-debug-${kind}`;
        const role = entry.role === 'actor' ? '行动方' : entry.role === 'digest' ? '提及' : '受体';
        return `<li>
            <time>${escapeHtml(entry.at)}</time>
            <span class="${badgeClass}">${escapeHtml(label)}</span>
            <span class="rt-map-evo-debug-arc-role">${escapeHtml(role)}</span>
            ${escapeHtml(stripEvolutionDigestSitePrefix(entry.summary, sandbox?.siteRoot))}
        </li>`;
    }).join('');
    const backlog = (arc?.backlogHits || []).map(entry => (
        `<li><time>${escapeHtml(entry.at)}</time> <span class="rt-map-evo-debug-transformed">BACKLOG</span> ${escapeHtml(stripEvolutionDigestSitePrefix(entry.summary, sandbox?.siteRoot))}</li>`
    )).join('');
    const empty = chosen && !events && !backlog
        ? '<div class="rt-map-evo-debug-empty">存储的事件中尚未提及此资产。</div>'
        : '';
    return `<section class="rt-map-evo-debug-arc" data-debug="arc">
        <div class="rt-map-evo-debug-subtitle">资产演化历程</div>
        <p class="rt-map-evo-debug-lead">追踪单个资产在地图动态变更中的历程。点击右侧资产或在此选择。</p>
        <label class="rt-map-evo-debug-site">追踪
            <select data-debug="arc-subject">${arcSubjectOptions(subjects, chosen)}</select>
        </label>
        <div class="rt-map-evo-debug-arc-now">${occupancy}</div>
        ${events ? `<ol class="rt-map-evo-debug-arc-list">${events}</ol>` : ''}
        ${backlog ? `<div class="rt-map-evo-debug-subtitle">匹配的演进积压</div><ul class="rt-map-evo-debug-list">${backlog}</ul>` : ''}
        ${empty}
    </section>`;
}

function areaOptions(document) {
    return (document?.areas || []).map(area => ({ id: area.id, label: `${area.name} (${area.id})` }));
}

function assetOptions(document) {
    return (document?.assets || []).map(asset => ({ id: asset.id, label: `${asset.name} [${asset.state}]` }));
}

/**
 * Open the Map Evolution testing ground for simulation and balancing.
 * @param {{ siteRoot?: string }} [options]
 */
export async function openMapEvolutionTestingGround({ siteRoot = '' } = {}) {
    const ownsChat = createChatCommitGuard(getActiveChatId(), getActiveChatId);

    const ctx = globalThis.SillyTavern?.getContext?.();
    if (!ctx?.callGenericPopup) return;

    const popup = document.createElement('div');
    popup.className = 'rt-map-evo-debug';
    let sandbox = chatCommitResult(ownsChat, await describeEvolutionSandbox(siteRoot));
    const settings = getSettings();
    let selectedArcId = '';

    const paint = () => {
        const areas = areaOptions(sandbox.document);
        const assets = assetOptions(sandbox.document);
        const lastPass = peekTestingGroundLastPass();
        popup.innerHTML = `
            <div class="rt-map-evo-debug-title"><i class="fa-solid fa-flask"></i> 地图演进测试场</div>
            <p class="rt-map-evo-debug-lead">无需在战役中跑团即可推进时间、附带起因生成或击杀实体并运行演进。所有更改将写入当前聊天的地图和 [TIME] 区块。运行演进后，“撤销上次演进”可将地图、[TIME]、上次演进时间和演进记忆完全恢复至该次运行前，方便重做测试。对比不同提示词前可清除演进历史，避免先前周期的残留影响下次结果。</p>
            <label class="rt-map-evo-debug-site">地点
                <select data-debug="site">${optionList(sandbox.sites.map(site => ({
                    id: site.siteRoot,
                    label: `${site.siteRoot}${site.current ? ' (当前)' : ''}`,
                })), sandbox.siteRoot)}</select>
            </label>
            <div class="rt-map-evo-debug-stats">
                <div class="rt-map-evo-debug-stat">
                    <span>游戏内时间</span>
                    <strong data-debug="time">${escapeHtml(sandbox.timeLabel || '未知')}</strong>
                </div>
                <div class="rt-map-evo-debug-stat">
                    <span>上次演进</span>
                    <strong>${escapeHtml(sandbox.lastEvolved || '从未')}</strong>
                </div>
                <div class="rt-map-evo-debug-stat">
                    <span>流逝时间</span>
                    <strong>${escapeHtml(sandbox.timeWindow?.elapsed || '未知')}</strong>
                </div>
            </div>
            ${renderMemoryBar(sandbox.memory)}
            <div class="rt-map-evo-debug-row">
                <input type="text" data-debug="set-time" class="text_pole" placeholder="设置时间，例如 Day 3, 08:00" value="${escapeHtml(currentCampaignTimeLabel())}">
                <button type="button" class="menu_button" data-debug-action="set-time">设置时间</button>
                <input type="number" data-debug="hours" class="text_pole" min="1" max="168" value="${escapeHtml(String(settings.mapEvolutionIntervalHours ?? 8))}" title="推进小时数">
                <button type="button" class="menu_button" data-debug-action="advance-hours">推进小时</button>
                <button type="button" class="menu_button" data-debug-action="advance-day">+1 天</button>
            </div>
            <div class="rt-map-evo-debug-row">
                <button type="button" class="menu_button" data-debug-action="evolve"><i class="fa-solid fa-wand-magic-sparkles"></i> 立即演进本地图</button>
                <input type="number" data-debug="ticks" class="text_pole" min="1" max="20" value="3" title="模拟演进周期数">
                <button type="button" class="menu_button" data-debug-action="simulate"><i class="fa-solid fa-forward"></i> 模拟演进周期</button>
                <button type="button" class="menu_button" data-debug-action="undo-pass" title="将地图、[TIME]、上次演进时间和演进记忆恢复至上次演进或模拟运行前的状态。" ${!lastPass || lastPass.undone ? 'disabled' : ''}><i class="fa-solid fa-rotate-left"></i> 撤销上次演进</button>
                <button type="button" class="menu_button" data-debug-action="redo-pass" title="恢复运行前快照，然后重新运行相同的演进或模拟。" ${!lastPass ? 'disabled' : ''}><i class="fa-solid fa-rotate-right"></i> 重做上次演进</button>
                <button type="button" class="menu_button" data-debug-action="clear-history" title="清除此地点的积压与因果事件链。不会更改地图实体、[TIME] 或上次演进时间。"><i class="fa-solid fa-eraser"></i> 清除演进历史</button>
            </div>
            <div class="rt-map-evo-debug-status" data-debug="status" role="status"></div>
            <details class="rt-map-evo-debug-form" open>
                <summary>创建实体</summary>
                <div class="rt-map-evo-debug-form-grid">
                    <input type="text" data-debug="add-name" class="text_pole" placeholder="名称">
                    <select data-debug="add-kind">${optionList(MAP_ASSET_KINDS, 'CREATURE')}</select>
                    <select data-debug="add-location">${optionList(areas)}</select>
                    <input type="number" data-debug="add-count" class="text_pole" min="1" max="99" placeholder="数量 (群体: 2–99)">
                    <input type="text" data-debug="add-faction" class="text_pole" placeholder="阵营 (可选)">
                    <input type="text" data-debug="add-cause" class="text_pole" placeholder="起因 (必填)">
                    <input type="text" data-debug="add-actor" class="text_pole" placeholder="行动方 (可选)">
                </div>
                <div class="rt-map-evo-debug-row">
                    <button type="button" class="menu_button" data-debug-action="add">添加至地图</button>
                </div>
            </details>
            <details class="rt-map-evo-debug-form" open>
                <summary>击杀 / 变更实体状态</summary>
                <div class="rt-map-evo-debug-form-grid">
                    <select data-debug="set-asset">${optionList(assets)}</select>
                    <select data-debug="set-state">${optionList(['DESTROYED', 'DEAD', 'DEACTIVATED', 'DAMAGED', 'FLEEING', 'LEFT', 'ACTIVE', 'ALERT'], 'DESTROYED')}</select>
                    <input type="number" data-debug="set-count" class="text_pole" min="1" max="99" placeholder="数量 (减员)">
                    <input type="text" data-debug="set-actor" class="text_pole" placeholder='行动方: party、资产 ID 或 "冒险小队名称"'>
                    <input type="text" data-debug="set-cause" class="text_pole" placeholder="起因，例如：被玩家队伍击杀">
                </div>
                <div class="rt-map-evo-debug-row">
                    <button type="button" class="menu_button" data-debug-action="set">应用变更</button>
                </div>
            </details>
            <div class="rt-map-evo-debug-columns">
                <section>
                    <div class="rt-map-evo-debug-subtitle">因果事件链</div>
                    <div class="rt-map-evo-debug-pane" data-debug="threads">${renderThreads(sandbox.threads)}</div>
                </section>
                <section>
                    <div class="rt-map-evo-debug-subtitle">地图资产</div>
                    <div class="rt-map-evo-debug-pane" data-debug="assets">${renderAssets(sandbox.document, selectedArcId)}</div>
                </section>
            </div>
            ${renderAssetArc(sandbox, selectedArcId)}
            ${renderMemoryLedger(sandbox.memory)}
        `;
        bind();
    };

    const setStatus = (text) => {
        const status = popup.querySelector('[data-debug="status"]');
        if (status) status.textContent = text || '';
    };

    const reload = ignoreChatCancellation(async (root = popup.querySelector('[data-debug="site"]')?.value || sandbox.siteRoot) => {

        if (!ownsChat()) return;
        sandbox = chatCommitResult(ownsChat, await describeEvolutionSandbox(root));
        const subjects = collectEvolutionArcSubjects(sandbox?.memory?.storedThreads || [], sandbox?.document);
        if (selectedArcId && !subjects.some(subject => subject.id === selectedArcId)) selectedArcId = '';
        paint();
    });

    const bind = () => {
        popup.querySelector('[data-debug="site"]')?.addEventListener('change', ignoreChatCancellation(async (event) => {

            if (!ownsChat()) return;
            chatCommitResult(ownsChat, await reload(event.target.value));

        }));
        popup.querySelector('[data-debug-action="set-time"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const result = setCampaignTimeLabel(popup.querySelector('[data-debug="set-time"]')?.value);
            setStatus(result.ok ? `时间已设置为 ${result.timeLabel}。` : result.error);
            if (result.ok) chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="advance-hours"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const hours = Number(popup.querySelector('[data-debug="hours"]')?.value) || 12;
            const result = advanceCampaignTime(hours * 60);
            setStatus(result.ok ? `已推进至 ${result.timeLabel}。` : result.error);
            if (result.ok) chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="advance-day"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const result = advanceCampaignTime(1440);
            setStatus(result.ok ? `已推进至 ${result.timeLabel}。` : result.error);
            if (result.ok) chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="evolve"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            setStatus(`正在为 ${sandbox.siteRoot} 运行地图演进…`);
            const result = chatCommitResult(ownsChat, await debugRunEvolution(sandbox.siteRoot));
            if (result?.skipped === 'busy') setStatus('已有智能体正在运行。');
            else if (result?.ok && result?.applied) setStatus(`地图演进已应用 ${result.applied} 项实质性更新。可点击撤销回滚本次演进。`);
            else if (result?.ok) setStatus('地图演进已运行，无实质性变更。可点击撤销回滚本次演进。');
            else setStatus(result?.error || '地图演进失败。');
            chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="simulate"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const ticks = Number(popup.querySelector('[data-debug="ticks"]')?.value) || 3;
            const hours = Number(popup.querySelector('[data-debug="hours"]')?.value) || Number(getSettings().mapEvolutionIntervalHours) || 8;
            setStatus(`正在模拟 ${ticks} 个周期 (每周期 ${hours} 小时)…`);
            const result = chatCommitResult(ownsChat, await debugSimulateTicks({
                siteRoot: sandbox.siteRoot,
                ticks,
                hoursPerTick: hours,
                onTick: ({ index, count, timeLabel, phase }) => {
                    setStatus(`周期 ${index + 1}/${count} (${phase}) 时间 ${timeLabel}…`);
                },
            }));
            if (!result.ok) setStatus(result.error || '模拟已停止。');
            else setStatus(`已模拟 ${result.ticks} 个周期 (每周期 ${result.hoursPerTick} 小时)。可点击撤销回滚本次运行。`);
            chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="undo-pass"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            setStatus('正在恢复运行前快照…');
            const result = chatCommitResult(ownsChat, await debugUndoLastEvolutionPass());
            if (result?.skipped === 'busy') setStatus('已有智能体正在运行。');
            else if (result.ok) {
                const kind = result.action?.type === 'simulate' ? '模拟' : '演进';
                setStatus(`已撤销 ${result.siteRoot} 上的${kind}。可点击重做再次运行。`);
            } else setStatus(result.error || '撤销失败。');
            chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="redo-pass"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const prior = peekTestingGroundLastPass();
            const kind = prior?.action?.type === 'simulate' ? '模拟' : '演进';
            setStatus(`正在重做${kind}…`);
            const result = chatCommitResult(ownsChat, await debugRedoLastEvolutionPass({
                onTick: ({ index, count, timeLabel, phase }) => {
                    setStatus(`重做周期 ${index + 1}/${count} (${phase}) 时间 ${timeLabel}…`);
                },
            }));
            if (result?.skipped === 'busy') setStatus('已有智能体正在运行。');
            else if (result?.ok && result?.action?.type === 'simulate') setStatus(`已重做模拟: ${result.ticks} 个周期 (每周期 ${result.hoursPerTick} 小时)。`);
            else if (result?.ok && result?.applied) setStatus(`已重做演进: 应用了 ${result.applied} 项实质性更新。`);
            else if (result?.ok) setStatus('已重做演进；无实质性变更。');
            else setStatus(result?.error || '重做失败。');
            chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="clear-history"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const root = sandbox.siteRoot;
            const confirmed = window.confirm(`确认清除 "${root}" 的演进积压和因果事件链吗？\n\n地图实体动态、[TIME] 和上次演进时间保持不变。此操作仅清空历史记录，避免后续演进受到先前提示词周期的残留影响。`);
            if (!confirmed) return;
            const result = debugClearEvolutionHistory(root);
            setStatus(result.ok ? `已清除 ${root} 的演进历史。` : result.error);
            if (result.ok) chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="add"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const result = chatCommitResult(ownsChat, await debugAddAsset({
                siteRoot: sandbox.siteRoot,
                name: popup.querySelector('[data-debug="add-name"]')?.value,
                kind: popup.querySelector('[data-debug="add-kind"]')?.value,
                location: popup.querySelector('[data-debug="add-location"]')?.value,
                count: popup.querySelector('[data-debug="add-count"]')?.value,
                faction: popup.querySelector('[data-debug="add-faction"]')?.value,
                cause: popup.querySelector('[data-debug="add-cause"]')?.value,
                actor: popup.querySelector('[data-debug="add-actor"]')?.value,
            }));
            setStatus(result.ok ? '实体已添加。' : result.error);
            if (result.ok) chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-action="set"]')?.addEventListener('click', ignoreChatCancellation(async () => {

            if (!ownsChat()) return;
            const result = chatCommitResult(ownsChat, await debugSetAsset({
                siteRoot: sandbox.siteRoot,
                assetId: popup.querySelector('[data-debug="set-asset"]')?.value,
                state: popup.querySelector('[data-debug="set-state"]')?.value,
                count: popup.querySelector('[data-debug="set-count"]')?.value,
                actor: popup.querySelector('[data-debug="set-actor"]')?.value,
                cause: popup.querySelector('[data-debug="set-cause"]')?.value,
            }));
            setStatus(result.ok ? '实体已更新。' : result.error);
            if (result.ok) chatCommitResult(ownsChat, await reload());

        }));
        popup.querySelector('[data-debug-arc-subject"]')?.addEventListener('change', (event) => {
            if (!ownsChat()) return;
            selectedArcId = String(event.target.value || '').trim();
            paintArc();
        });
        popup.querySelectorAll('[data-debug-arc]').forEach(node => {
            node.addEventListener('click', () => {
                if (!ownsChat()) return;
                selectedArcId = String(node.getAttribute('data-debug-arc') || '').trim();
                paintArc();
            });
        });
    };

    const paintArc = () => {
        const host = popup.querySelector('[data-debug="arc"]');
        if (host) host.outerHTML = renderAssetArc(sandbox, selectedArcId);
        popup.querySelectorAll('[data-debug-arc]').forEach(node => {
            node.classList.toggle('is-selected', node.getAttribute('data-debug-arc') === selectedArcId);
        });
        popup.querySelector('[data-debug="arc-subject"]')?.addEventListener('change', (event) => {
            if (!ownsChat()) return;
            selectedArcId = String(event.target.value || '').trim();
            paintArc();
        });
    };

    paint();
    chatCommitResult(ownsChat, await ctx.callGenericPopup(popup, ctx.POPUP_TYPE?.TEXT ?? 1, '', {
        okButton: '关闭', cancelButton: false, wide: true, large: true,
        allowVerticalScrolling: true,
        leftAlign: true,
    }));

}
