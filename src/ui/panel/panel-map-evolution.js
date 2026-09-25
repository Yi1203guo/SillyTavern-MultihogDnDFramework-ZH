import { getActiveChatId } from '../../../state-manager.js';
import { createChatCommitGuard, chatCommitResult, ignoreChatCancellation } from '../../state/pass-affinity.js';
import { runtimeState } from '../../app/runtime-state.js';
import { evolutionIntervalHoursForSettings, summarizeMapEvolutionSchedule } from '../../../map-evolution-lib.js';

const BADGE_ON = 'font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; background:rgba(52,168,83,0.18); color:#34a853; border:1px solid rgba(52,168,83,0.3);';
const BADGE_OFF = 'font-size:0.692em; padding:1px 7px; border-radius:10px; font-weight:bold; cursor:pointer; user-select:none; background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.35); border:1px solid rgba(255,255,255,0.1);';

function syncTickRows(agentPanel, scope) {
    const nRow = agentPanel.querySelector('#rt-agent-map-evo-n-row');
    const hint = agentPanel.querySelector('#rt-agent-map-evo-selected-hint');
    if (nRow) nRow.style.display = scope === 'active' ? 'none' : 'flex';
    if (hint) hint.style.display = scope === 'selected' ? 'block' : 'none';
}

/** Wires the Lorebook Agent's Map Evolution controls and status readout. */
export function wireAgentMapEvolution({
    agentPanel,
    extractCurrentTimeStr,
    formatInWorldTime,
    getSettings,
    parseInWorldTime,
    saveChatState,
    saveSettings,
}) {
    const toggleAgentMapEvo = () => {
        const s = getSettings();
        s.agentMapEvolutionOpen = !s.agentMapEvolutionOpen;
        localStorage.setItem('rpg_tracker_agent_map_evo_open', String(s.agentMapEvolutionOpen));
        const drawer = agentPanel.querySelector('#rt-agent-map-evo-drawer');
        if (drawer) drawer.style.display = s.agentMapEvolutionOpen ? 'block' : 'none';
        const icon = agentPanel.querySelector('#rt-agent-map-evo-toggle-icon');
        if (icon) icon.className = s.agentMapEvolutionOpen ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
    };

    const mapHeader = agentPanel.querySelector('#rt-agent-map-evo-header');
    if (mapHeader) {
        mapHeader.addEventListener('click', (e) => {
            if (e.target instanceof Element && e.target.closest('#rt-agent-map-evo-enabled-badge')) return;
            toggleAgentMapEvo();
        });
    }

    const badgeEl = agentPanel.querySelector('#rt-agent-map-evo-enabled-badge');
    if (badgeEl) {
        badgeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const s = getSettings();
            s.mapEvolutionEnabled = s.mapEvolutionEnabled === false;
            saveSettings();
            updateAgentMapEvolutionStatus();
            $('#rpg_map_evolution_enabled').prop('checked', s.mapEvolutionEnabled !== false);
        });
    }

    function currentMemoMinutes() {
        const s = getSettings();
        const timeMatch = (s.currentMemo || '').match(/\[TIME\]([\s\S]*?)\[\/TIME\]/i);
        const timeStr = timeMatch ? extractCurrentTimeStr(timeMatch[1]) : '';
        return timeStr ? (parseInWorldTime(timeStr) ?? -1) : -1;
    }

    function updateAgentMapEvolutionStatus() {
        const s = getSettings();
        const schedule = summarizeMapEvolutionSchedule(s.mapEvolutionLastFiredBySite, {
            intervalHours: s.mapEvolutionIntervalHours,
            currentMinutes: currentMemoMinutes(),
            intervalHoursFor: evolutionIntervalHoursForSettings(s, s.mapEvolutionLastSiteRoot || ''),
        });
        const lastEl = agentPanel.querySelector('#rt-agent-map-evo-last-fired');
        const nextEl = agentPanel.querySelector('#rt-agent-map-evo-next-fire');
        const badge = agentPanel.querySelector('#rt-agent-map-evo-enabled-badge');
        if (lastEl) lastEl.textContent = schedule.lastMins >= 0 ? formatInWorldTime(schedule.lastMins) : '从未';
        if (nextEl) nextEl.textContent = schedule.nextMins >= 0 ? formatInWorldTime(schedule.nextMins) : '—';
        if (badge) {
            const on = s.mapEvolutionEnabled !== false;
            badge.textContent = on ? '开启' : '关闭';
            badge.style.cssText = on ? BADGE_ON : BADGE_OFF;
        }

        const intervalInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-interval'));
        if (intervalInp && document.activeElement !== intervalInp) {
            intervalInp.value = String(s.mapEvolutionIntervalHours ?? 8);
        }
        const onSiteInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-onsite-interval'));
        if (onSiteInp && document.activeElement !== onSiteInp) {
            onSiteInp.value = String(s.mapEvolutionOnSiteIntervalHours ?? 1);
        }
        const onSiteMinutesInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-onsite-minutes'));
        if (onSiteMinutesInp && document.activeElement !== onSiteMinutesInp) {
            onSiteMinutesInp.value = String(s.mapEvolutionOnSiteIntervalMinutes ?? 0);
        }
        const scopeSel = /** @type {HTMLSelectElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-tick-scope'));
        if (scopeSel && document.activeElement !== scopeSel) {
            scopeSel.value = s.mapEvolutionTickScope || 'all';
        }
        const countInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-tick-count'));
        if (countInp && document.activeElement !== countInp) {
            countInp.value = String(s.mapEvolutionTickCount ?? 2);
        }
        const randChk = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-tick-randomize'));
        if (randChk && document.activeElement !== randChk) {
            randChk.checked = s.mapEvolutionTickRandomize !== false;
        }
        syncTickRows(agentPanel, s.mapEvolutionTickScope || 'all');
    }
    runtimeState.updateAgentMapEvolutionStatusRef = updateAgentMapEvolutionStatus;

    const intervalInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-interval'));
    if (intervalInp) {
        intervalInp.addEventListener('change', () => {
            const s = getSettings();
            s.mapEvolutionIntervalHours = Math.max(1, Math.min(168, parseInt(intervalInp.value, 10) || 8));
            intervalInp.value = String(s.mapEvolutionIntervalHours);
            saveSettings();
            $('#rpg_map_evolution_interval_hours').val(s.mapEvolutionIntervalHours);
            if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
                runtimeState.updateMapEvolutionScheduleDisplayRef();
            } else {
                updateAgentMapEvolutionStatus();
            }
        });
    }

    const onSiteInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-onsite-interval'));
    if (onSiteInp) {
        onSiteInp.addEventListener('change', () => {
            const s = getSettings();
            const parsed = parseInt(onSiteInp.value, 10);
            s.mapEvolutionOnSiteIntervalHours = Math.max(0, Math.min(168, Number.isFinite(parsed) ? parsed : 1));
            onSiteInp.value = String(s.mapEvolutionOnSiteIntervalHours);
            saveSettings();
            $('#rpg_map_evolution_onsite_interval_hours').val(s.mapEvolutionOnSiteIntervalHours);
            if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
                runtimeState.updateMapEvolutionScheduleDisplayRef();
            } else {
                updateAgentMapEvolutionStatus();
            }
        });
    }

    const onSiteMinutesInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-onsite-minutes'));
    if (onSiteMinutesInp) {
        onSiteMinutesInp.addEventListener('change', () => {
            const s = getSettings();
            const parsed = parseInt(onSiteMinutesInp.value, 10);
            s.mapEvolutionOnSiteIntervalMinutes = Math.max(0, Math.min(59, Number.isFinite(parsed) ? parsed : 0));
            onSiteMinutesInp.value = String(s.mapEvolutionOnSiteIntervalMinutes);
            saveSettings();
            $('#rpg_map_evolution_onsite_interval_minutes').val(s.mapEvolutionOnSiteIntervalMinutes);
            if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
                runtimeState.updateMapEvolutionScheduleDisplayRef();
            } else {
                updateAgentMapEvolutionStatus();
            }
        });
    }

    const scopeSel = /** @type {HTMLSelectElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-tick-scope'));
    if (scopeSel) {
        scopeSel.addEventListener('change', () => {
            const s = getSettings();
            s.mapEvolutionTickScope = String(scopeSel.value || 'all');
            syncTickRows(agentPanel, s.mapEvolutionTickScope);
            saveSettings();
            $('#rpg_map_evolution_tick_scope').val(s.mapEvolutionTickScope);
            if (typeof runtimeState.applyMapEvolutionTickSettingsToUiRef === 'function') {
                runtimeState.applyMapEvolutionTickSettingsToUiRef(s);
            } else {
                $('#rpg_map_evolution_n_row').toggle(s.mapEvolutionTickScope !== 'active');
                $('#rpg_map_evolution_interval_selected_hint').toggle(s.mapEvolutionTickScope === 'selected');
            }
        });
    }

    const countInp = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-tick-count'));
    if (countInp) {
        countInp.addEventListener('change', () => {
            const s = getSettings();
            const parsed = parseInt(countInp.value, 10);
            s.mapEvolutionTickCount = Math.max(0, Math.min(50, Number.isFinite(parsed) ? parsed : 2));
            countInp.value = String(s.mapEvolutionTickCount);
            saveSettings();
            $('#rpg_map_evolution_tick_count').val(s.mapEvolutionTickCount);
        });
    }

    const randChk = /** @type {HTMLInputElement|null} */ (agentPanel.querySelector('#rt-agent-map-evo-tick-randomize'));
    if (randChk) {
        randChk.addEventListener('change', () => {
            const s = getSettings();
            s.mapEvolutionTickRandomize = !!randChk.checked;
            saveSettings();
            $('#rpg_map_evolution_tick_randomize').prop('checked', s.mapEvolutionTickRandomize);
        });
    }

    const fireNowBtn = agentPanel.querySelector('#rt-agent-map-evo-fire-now');
    if (fireNowBtn) {
        fireNowBtn.addEventListener('click', ignoreChatCancellation(async () => {
            const ownsChat = createChatCommitGuard(getActiveChatId(), getActiveChatId);
            const { isMapEvolutionRunning, runMapEvolutionPass } = chatCommitResult(ownsChat, await import('../../../map-evolution.js'));
            const { isMapUpdaterRunning } = chatCommitResult(ownsChat, await import('../../../map-updater.js'));
            const { isRouterRunning } = chatCommitResult(ownsChat, await import('../../../router.js'));
            if (isRouterRunning() || isMapUpdaterRunning() || isMapEvolutionRunning()) {
                toastr.warning('已有智能体正在运行。', '地图演进');
                return;
            }
            /** @type {HTMLButtonElement} */ (fireNowBtn).disabled = true;
            fireNowBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 正在演进…';
            try {
                const result = typeof runtimeState.runMapEvolutionPassRef === 'function'
                    ? chatCommitResult(ownsChat, await runtimeState.runMapEvolutionPassRef({ trigger: 'manual', isManual: true }))
                    : chatCommitResult(ownsChat, await runMapEvolutionPass({ trigger: 'manual', isManual: true }));
                updateAgentMapEvolutionStatus();
                if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
                    runtimeState.updateMapEvolutionScheduleDisplayRef();
                }
                const skipped = result?.skipped;
                if (skipped === 'location_mapping_off' || skipped === 'dungeon_reality_off') {
                    toastr.warning('持久化地图未开启。', '地图演进');
                } else if (skipped === 'no_maps' || skipped === 'no_active_map' || skipped === 'no_matching_sites' || skipped === 'no_selection') {
                    toastr.warning('没有可供演进的已建图地点。', '地图演进');
                } else if (skipped === 'disabled') {
                    toastr.warning('地图演进已禁用。', '地图演进');
                } else if (skipped === 'busy') {
                    toastr.warning('已有智能体正在运行。', '地图演进');
                } else if (skipped === 'stopped') {
                    toastr['info']('已停止。', '地图演进');
                } else if (result?.baseline) {
                    toastr['info']('周期基准时间已标记。演进将在间隔时间过去后触发。', '地图演进');
                } else if (result?.ok && result?.applied === 0) {
                    toastr['info']('未发生持久性变更。', '地图演进');
                } else if (result?.ok) {
                    toastr['success']('地图演进已应用。', '地图演进');
                } else {
                    toastr.error('无法应用有效的演进更新。', '地图演进');
                }
            } catch (e) {
                if (!ownsChat()) return;
                toastr.error(`地图演进错误: ${e.message}`, '地图演进');
            } finally {
                /** @type {HTMLButtonElement} */ (fireNowBtn).disabled = false;
                fireNowBtn.innerHTML = '<i class="fa-solid fa-map-location-dot"></i> 立即演进';
            }
        }));
    }

    const resetBtn = agentPanel.querySelector('#rt-agent-map-evo-reset-timeline');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const s = getSettings();
            s.mapEvolutionLastFiredBySite = {};
            saveSettings();
            if (s.chatLinkEnabled && runtimeState.currentChatId) saveChatState(runtimeState.currentChatId);
            updateAgentMapEvolutionStatus();
            if (typeof runtimeState.updateMapEvolutionScheduleDisplayRef === 'function') {
                runtimeState.updateMapEvolutionScheduleDisplayRef();
            }
            toastr['info']('地图演进时间线已重置。下个周期将从当前时间重新起算。', '地图演进');
        });
    }

    const testingGroundBtn = agentPanel.querySelector('#rt-agent-map-evo-testing-ground');
    if (testingGroundBtn) {
        testingGroundBtn.addEventListener('click', ignoreChatCancellation(async () => {
            const ownsChat = createChatCommitGuard(getActiveChatId(), getActiveChatId);
            const { openMapEvolutionTestingGround } = chatCommitResult(ownsChat, await import('./panel-map-evolution-debug.js'));
            chatCommitResult(ownsChat, await openMapEvolutionTestingGround());
        }));
    }

    return { updateStatus: updateAgentMapEvolutionStatus };
}
