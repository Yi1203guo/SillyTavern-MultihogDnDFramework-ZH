# Multihog D&D 规则框架 (中文汉化版)

> **关于本仓库**：  
> 本项目 Fork 自原作者仓库 [MultihogAurelius/SillyTavern-MultihogDnDFramework](https://github.com/MultihogAurelius/SillyTavern-MultihogDnDFramework)。  
> 本仓库仅利用 AI 将该扩展插件的前端界面及交互内容完整翻译为**简体中文**，未对底层运行逻辑与提示词系统作任何额外扩充或改动。所有 D&D 相关专有名词严格遵照 D&D 官方中文译名规范，惯用术语（如 DC、AC、DM、HP 等）按行业习惯予以保留。

### 本汉化版安装方式

建议直接通过 SillyTavern 的扩展管理界面在线安装：

1. 打开 SillyTavern，进入 **扩展菜单（Extensions）**（顶部积木图标）。
2. 点击上方的 **“安装扩展 (Install Extension)”**。
3. 在安装输入框中填入本汉化仓库的 Git 地址：
   ```text
   https://github.com/Yi1203guo/SillyTavern-MultihogDnDFramework-ZH.git
   ```
4. 点击保存/安装，等待安装完成并重启或刷新页面即可。

---

*(以下为原仓库 README 完整内容的中文翻译)*

# 未来展望与维护说明
本项目正进入维护模式。原作者正逐步放缓本程序扩展版本（即本代码库）的开发，转向 SillyTavern 的私有 Fork 版本。为什么不公开呢？因为原作者无意成为全职的前端维护者，承担宿主程序本身的持续兼容性与安全性责任。

原作者仍可能在收到错误报告后修复 Bug，并对现有系统、提示词等进行微调，但不会再推出重大的新功能。

这绝不意味着该扩展未完成。它已经具备极丰富的功能，且原作者始终坚持维持高标准的品质。

任何希望继续开发该扩展的开发者，欢迎 Fork 本项目。

---

# Multihog D&D 框架 (Multihog D&D Framework)

*专为 SillyTavern 设计的高度可定制、模块化 RPG 平台与仿真引擎。*

最初只是一个简朴的“RPG 状态追踪器 (RPG State Tracker)”，现已发展为一个更具雄心的游戏引擎、模拟系统与模块化 RPG 平台。你甚至可以用它制作拥有独特系统和游戏逻辑的自制 RPG —— 这一切都可以通过大量内置的 AI 向导/工具，直接使用自然语言提示词来完成。

默认自带开箱即用的“硬核”配置，最贴切的描述就是“极致拟真”。行为皆有后果，且不存在数值动态缩放。哪怕你只有 2 级，巨龙也会毫不留情地将你碾碎。其核心目标与设计哲学，是通过稳健的模拟逻辑带来沉浸式体验：以真实的时间流逝作为串联众多系统的骨干，并贯彻上述“对玩家一视同仁/中立客观”的原则。从根本上说，它既是一个高度协调的 RPG 框架，也是一套对抗大模型阿谀奉承（Anti-Sycophancy）的机制。

虽然名字叫“D&D 框架”，但除了奇幻题材外，该系统同样适用于日常系生活切片（Slice of Life）场景、现代都市背景或任何你能想象到的设定，因此你绝不仅限于法师与地精。一切皆**完全可定制**且对自制规则（Homebrew）极其友好，并配备了 AI 向导，几乎不需要任何专业技术知识。

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/878e437c-e7b4-4140-94b9-f9a14aab1002" width="60%" alt="基础角色卡" />
  <br>
  <em>基础角色卡</em>
</p>

---

### 核心组件：

1. 🖥️ **RPG 状态追踪器 (RPG State Tracker)** - 通过专门的二次分析模型提取并维护 HP、物品栏、队伍、状态增益/减益 (Buffs)、XP、法术等。将滚动的状态备忘录 (State Memo) 重新注入到每个提示词中，让 AI（以及你）时刻保持状态同步。
2. 🎲 **混合 RNG 检定系统 (Hybrid RNG System)** - 双引擎桌面规则物理机制。
   - **RNG 队列**：预先生成随机种子的确定性骰子序列，注入到每个回合中。相比使用工具调用（Tool Calls）成本更低，在战斗等多骰子连续检定场景下体验极其流畅。
   - **工具调用 RNG**：启用“承诺逻辑”，AI 在看到检定结果前必须先声明 DC，彻底杜绝奉承迎合。
3. 🤖 **世界书智能体 (Lorebook Agent)** - 自动创建、激活/休眠、更新及合并世界书条目，在有总结压缩的情况下仍能确保长期记忆不丢失。
4. 🌍 **世界推进 (World Progression)** - 以地点为中心的宏观模拟器，根据可读的地点设定及可选的世界骨架生成每日（或更高频的）叙事简报。简报将立即引导叙述者，并由地图演变系统延迟实装；细粒度实体与隐藏地图不属于 WP 的管辖范围。
5. 🗺️ **地图演变 (Map Evolution)** - 地下城与定居点会自主演进。敌人可能会重新盘踞或设立伏击，第三方拾荒者可能会进入，等等。

它们共同解决了大语言模型跑团/TRPG 的四大核心痛点：AI 遗忘你的物品栏/法术、AI 遗忘长期上下文、玩家永远轻松获胜（即主角光环），以及玩家所在气泡之外的世界静止僵死。该系统的稳定性极佳 —— 你只需专注于游戏，无需费心反复调整。

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/ea7d9ff2-9c32-4a81-9c28-d4f11a7e26f7" width="60%" alt="战斗进行中" />
  <br>
  <em>究竟什么是地图演变？这张截图非常清晰地展示了这一点！</em>
</p>

---

## 特性亮点

- **完整移动端支持**：在手机上无缝继续桌面端的进度。
- **AI 赋能的轻松创建**：从自然语言提示词即可轻松生成整套游戏系统，AI 包揽全部配置。
- **自动法术位追踪**：通过界面中的 🔵 点阵实时显示；再也不用费心记还剩多少法术位。
- **状态效果随时间衰减**：通过 [时间] 增量追踪；增益/减益状态根据时间流逝自动过期。
- **CYOA 互动小说模式**：提供可点击的选项分支，实现无阻碍游戏体验。当然，完全可选。
- **自动模型切换**：为不同的任务自动调度最适合的模型。
- **队伍委派休整系统**：派遣你的小队去执行任务；他们最终会自动返回，任务成功与否取决于他们的能力与 RNG 检定。
- **自定义字段、AI 主题向导、可排序版块**：追踪标准字段之外的任意内容，并随心定制界面视觉效果。
- **强大的角色创建选项**：指定详细的角色信息、简短的描述，或者直接随机骰出一个全新的角色。
- **将你的 RPG 保存为游戏卡带 (Game Cartridges)**：对整套 RPG 配置进行完整快照。支持导入与导出，便于备份甚至向他人分享。
- **自制规则友好**：高度灵活，支持任意题材与规则设定。
- **全自主世界书智能体**：完全免人工干预打理世界书，无需复杂配置。
- **通过 (💬) 直接与模型对话**：让编辑或新增内容变得轻而易举。
- **AI 肖像生成与实时可视化模式**：为万物生成头像肖像，并配备可视化视口。
- **角色卡导入**：将任何现有角色导入故事中作为 NPC；AI 会自动将其适配进故事中，无论何种背景/题材。
- **生活/恋爱模拟风格的好感度组件**：建立友谊与浪漫关系。
- **d100 骰子支持**：适用于基于百分比的系统与检定。
- **冒险副手 (Adventure Companion)**：包含可选的新手教程模式以帮助上手本框架，可探讨冒险历程、更新战役状态或世界设定，甚至可以要求它代你执行下一回合。
- **高效双引擎 RNG**：确定性队列用于即时战斗；工具调用用于叙事技能检定。
- **详尽的地图**：细粒度资产级地图，即使你不在身边，也会持续演变并生发自己的微观叙事。

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/8e615285-1eed-4312-98c6-6cb47febaed5" width="100%" alt="战斗进行中" />
  <br>
  <em>战斗进行中的界面展示</em>
</p>

---

## 安装指南

**打包发布的 Release 版本可能无法保持最新。建议直接克隆仓库或按以下步骤安装。**

### 本汉化版安装（推荐）

1. 进入 SillyTavern 的 **扩展菜单 (Extensions)**。
2. 点击顶部的 **“安装扩展 (Install Extension)”**。
3. 输入本汉化仓库的 URL：
   ```text
   https://github.com/Yi1203guo/SillyTavern-MultihogDnDFramework-ZH.git
   ```

### 原版安装步骤

1. 进入 SillyTavern 的扩展菜单。
2. 点击顶部的“Install extension”。
3. 输入原仓库的 URL（`https://github.com/MultihogAurelius/SillyTavern-MultihogDnDFramework`）。

## 使用指南

1. **初始设置**：在空白追踪器上使用原型按钮随机生成一个新角色，或将现有的角色卡粘贴到“原始视图 (Raw View)”中（如果你的角色卡格式与界面所需不匹配，可通过 💬 让模型修正格式）。为你使用的“叙述者”创建一张角色卡，例如原作者使用的 Simulation Engine，也可以命名为 Game Master（游戏主持人 / DM）。
2. **自动追踪**：在角色扮演过程中，扩展会智能解析助手回复。它能检测到 HP 的减少、新获得的战利品或战斗触发，将多部分工具调用回复拼合在一起，并在后台执行分析来更新状态。
3. **提示词注入与执行**：状态备忘录 (State Memo) 与 RNG 队列将无缝注入到你发出的提示词中，充当“唯一事实来源”。对于叙事行为，框架会动态捕获并处理 AI 的 `RollTheDice` 工具调用。
4. **世界推进骨架与设置**：可选择性地创建仅包含宏观信息的地点、势力和冲突的世界骨架。地点成为模拟的主体，而势力与冲突则提供更广阔的背景；命名 NPC 则通过游玩过程和常规世界书来确立。

### 初始设置视频指南

https://www.youtube.com/watch?v=82Lt9pRYFS0

---

<p align="center">
  <img src="https://github.com/user-attachments/assets/368d05be-009b-4f0d-b753-5c3cf8ae7dad" width="60%" alt="区域地图" />
  <br>
  <em>区域地图详尽且充满生机</em>
</p>

---

## 摘要插件为必装项 (A Summarizer is Mandatory)

- 🧠 **[Summaryception](https://github.com/Lodactio/Extension-Summaryception)：** 请安装此扩展或具备同等功能的扩展（能够总结并隐藏逐字消息）。本扩展设计上需配合摘要插件一同使用。

---

<div align="center">
  <figure>
    <img width="1918" height="982" alt="魔兽世界场景下的进本前招募" src="https://github.com/user-attachments/assets/e7e9e81d-0cfd-44a1-9a94-61e72d046d5a" />
    <em>魔兽世界场景下的进本地下城前招募队员</em>
  </figure>
</div>

<div align="center">
  <figure>
    <img width="1918" height="982" alt="危机四伏的险境" src="https://github.com/user-attachments/assets/6ad4aaca-0d28-4948-a33e-682a02e86791" />
    <em>同一次冒险中险象环生的艰难局面</em>
  </figure>
</div>

<div align="center">
  <figure>
    <img width="1918" height="982" alt="惨胜" src="https://github.com/user-attachments/assets/e229e61c-c667-4471-ba44-02adc3836c3f" />
    <em>惨胜 —— 初出茅庐的法师力挽狂澜</em>
  </figure>
</div>

---

## 许可证 (License)

Copyright (c) 2026 MultihogAurelius

本程序为自由软件：您可以根据自由软件基金会发布的 GNU 通用公共许可证（GPL-3.0）条款（许可证的第 3 版或（根据您的选择）任何更高版本）重新分发和/或修改它。

详见 [LICENSE](LICENSE) 完整文本。
