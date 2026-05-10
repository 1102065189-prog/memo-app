// 主应用逻辑
const App = (() => {
  let currentFilter = 'pending';
  let searchQuery = '';
  let isAIProcessing = false;

  function init() {
    Notify.init();
    loadSettings();
    bindEvents();
    render();
    updateAIButtonState();

    // 定时检查提醒
    setInterval(checkReminders, 60000);
  }

  function loadSettings() {
    // 应用保存的主题设置
    const settings = Settings.load();
    document.documentElement.setAttribute('data-theme', settings.general.theme || 'dark');
  }

  function bindEvents() {
    // 添加备忘录
    const input = document.getElementById('input-memo');
    const btnSubmit = document.getElementById('btn-submit');

    const submitMemo = async () => {
      const text = input.value.trim();
      if (!text) return;
      try {
        await handleInput(text);
      } catch (e) {
        console.error('Submit error:', e);
        Notify.showToast('处理输入时出错，请重试', 'error');
      }
      input.value = '';
    };

    btnSubmit.addEventListener('click', submitMemo);
    input.addEventListener('keydown', async e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        await submitMemo();
      }
    });

    // 筛选标签
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        render();
      });
    });

    // 搜索
    document.getElementById('input-search').addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
    });

    // AI 解析开关
    const aiParseToggle = document.getElementById('toggle-ai-parse');
    const aiParseLabel = document.querySelector('.ai-parse-label');
    if (aiParseToggle) {
      aiParseToggle.addEventListener('change', e => {
        if (e.target.checked) {
          if (!Settings.isAIConfigured()) {
            e.target.checked = false;
            Notify.showToast('请先在设置中配置 AI API', 'error');
            showSettings();
          } else {
            Notify.showToast('AI 解析已开启，提交任务将等待 2-3 分钟', 'info');
          }
        }
        aiParseLabel?.classList.toggle('active', e.target.checked);
      });
    }

    // 统计按钮
    document.getElementById('btn-stats').addEventListener('click', showStats);

    // 添加按钮（打开手动添加弹窗）
    document.getElementById('btn-add').addEventListener('click', showManualAdd);

    // 手动添加弹窗
    document.getElementById('btn-manual-save')?.addEventListener('click', saveManualTask);
    document.getElementById('btn-manual-cancel')?.addEventListener('click', () => {
      document.getElementById('modal-manual-add').style.display = 'none';
    });

    // AI 推荐按钮
    document.getElementById('btn-ai-recommend')?.addEventListener('click', showAIRecommend);

    // AI 对话按钮
    document.getElementById('btn-ai-chat')?.addEventListener('click', showAIChat);

    // 设置按钮
    document.getElementById('btn-settings')?.addEventListener('click', showSettings);

    // 模态框关闭
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').style.display = 'none';
      });
    });

    // 编辑保存
    document.getElementById('btn-edit-save').addEventListener('click', saveEdit);
    document.getElementById('btn-edit-cancel').addEventListener('click', () => {
      document.getElementById('modal-edit').style.display = 'none';
    });

    // 点击模态框背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.style.display = 'none';
      });
    });
  }

  async function handleInput(text) {
    // 检查是否是 AI 对话模式
    if (text.startsWith('/ai ') || text.startsWith('AI:') || text.startsWith('ai:')) {
      const query = text.replace(/^(\/ai |AI:|ai:)/i, '').trim();
      if (query) {
        await handleAIChat(query);
        return;
      }
    }

    let result;

    // 优先使用 AI 解析（仅当用户手动开启且 AI 已配置时）
    const aiParseEnabled = document.getElementById('toggle-ai-parse')?.checked;
    if (aiParseEnabled && Settings.isAIConfigured()) {
      try {
        Notify.showToast('AI 解析中，请耐心等待...', 'info');
        result = await AI.parseTask(text);
        if (result) {
          result.intent = 'add';
          result.raw = text;
        }
      } catch (e) {
        console.log('AI parse failed, falling back to local:', e);
      }
    }

    // 本地解析作为后备
    if (!result) {
      try {
        result = NLParser.parse(text);
      } catch (e) {
        console.error('Local parse error:', e);
      }
    }

    if (!result) {
      // 本地解析也失败时，创建一个基本任务
      result = {
        intent: 'add',
        description: text.substring(0, 50),
        category: '其他',
        priority: 'medium',
        people: [],
        datetime: null,
        datetimeText: null,
        hasTime: false,
        raw: text,
      };
    }

    switch (result.intent) {
      case 'add': {
        try {
          const memo = Store.add(result);
          if (result.datetime) Notify.schedule(memo);
          Notify.showToast(`已添加: ${memo.description}`, 'success');
        } catch (e) {
          console.error('Store.add error:', e);
          Notify.showToast('保存任务失败: ' + e.message, 'error');
        }
        break;
      }
      case 'done': {
        try {
          const memo = Store.find(result.target);
          if (memo) {
            Store.complete(memo.id);
            Notify.cancel(memo.id);
            Notify.showToast(`已完成: ${memo.description}`, 'success');
          } else {
            Notify.showToast('未找到匹配的待办', 'error');
          }
        } catch (e) {
          console.error('Done error:', e);
          Notify.showToast('操作失败', 'error');
        }
        break;
      }
      case 'cancel': {
        try {
          const memo = Store.find(result.target);
          if (memo) {
            Store.cancel(memo.id);
            Notify.cancel(memo.id);
            Notify.showToast(`已取消: ${memo.description}`, 'success');
          } else {
            Notify.showToast('未找到匹配的待办', 'error');
          }
        } catch (e) {
          console.error('Cancel error:', e);
          Notify.showToast('操作失败', 'error');
        }
        break;
      }
      case 'edit': {
        try {
          const memo = Store.find(result.target);
          if (memo) {
            const changes = {};
            if (result.newDesc) changes.description = result.newDesc;
            if (result.newTime) {
              if (result.newTime.delayDays && memo.datetime) {
                const d = new Date(memo.datetime);
                d.setDate(d.getDate() + result.newTime.delayDays);
                changes.datetime = d.toISOString();
                changes.datetimeText = TimeParser.formatDate(d, memo.hasTime);
              } else if (result.newTime.date) {
                changes.datetime = result.newTime.date.toISOString();
                changes.datetimeText = result.newTime.text;
                changes.hasTime = result.newTime.hasTime;
              }
            }
            Store.update(memo.id, changes);
            Notify.cancel(memo.id);
            if (changes.datetime) {
              const updated = { ...memo, ...changes };
              Notify.schedule(updated);
            }
            Notify.showToast('已更新', 'success');
          } else {
            Notify.showToast('未找到匹配的待办', 'error');
          }
        } catch (e) {
          console.error('Edit error:', e);
          Notify.showToast('操作失败', 'error');
        }
        break;
      }
      case 'query':
        currentFilter = 'pending';
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-filter="pending"]').classList.add('active');
        break;
    }

    render();
  }

  async function handleAIChat(query) {
    if (!Settings.isAIConfigured()) {
      Notify.showToast('请先配置 AI API', 'error');
      showSettings();
      return;
    }

    isAIProcessing = true;
    updateAIButtonState();
    Notify.showToast('AI 思考中...', 'info');

    try {
      const tasks = Store.query('pending');
      const response = await AI.chatWithAI(query, tasks);
      showAIResponse(response);
    } catch (e) {
      Notify.showToast(`AI 错误: ${e.message}`, 'error');
    } finally {
      isAIProcessing = false;
      updateAIButtonState();
    }
  }

  function showAIResponse(response) {
    const modal = document.getElementById('modal-ai-response');
    if (!modal) {
      // 创建模态框
      const div = document.createElement('div');
      div.id = 'modal-ai-response';
      div.className = 'modal';
      div.innerHTML = `
        <div class="modal-content modal-ai">
          <div class="modal-header">
            <h2>AI 回复</h2>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="ai-response-content"></div>
          </div>
        </div>
      `;
      document.body.appendChild(div);

      // 绑定关闭事件
      div.querySelector('.modal-close').addEventListener('click', () => div.style.display = 'none');
      div.addEventListener('click', e => { if (e.target === div) div.style.display = 'none'; });
    }

    const content = document.querySelector('#modal-ai-response .ai-response-content');
    content.innerHTML = formatAIResponse(response);
    document.getElementById('modal-ai-response').style.display = 'flex';
  }

  function formatAIResponse(text) {
    // 简单的 Markdown 转 HTML
    return text
      .replace(/## (.+)/g, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  async function showAIRecommend() {
    if (!Settings.isAIRoleEnabled()) {
      Notify.showToast('请先启用 AI 角色功能', 'error');
      showSettings();
      return;
    }

    const tasks = Store.query('pending');
    if (tasks.length === 0) {
      Notify.showToast('暂无待办任务', 'info');
      return;
    }

    isAIProcessing = true;
    updateAIButtonState();
    Notify.showToast('AI 分析中...', 'info');

    try {
      // 准备任务数据
      const tasksData = tasks.map(m => ({
        description: m.description,
        category: m.category,
        priority: m.priority,
        datetime: m.datetime,
        datetimeText: m.datetimeText,
        isOverdue: m.datetime && new Date(m.datetime) < new Date()
      }));

      const response = await AI.recommendTasks(tasksData);
      showAIResponse(response);
    } catch (e) {
      Notify.showToast(`AI 错误: ${e.message}`, 'error');
    } finally {
      isAIProcessing = false;
      updateAIButtonState();
    }
  }

  async function showAIChat() {
    const modal = document.getElementById('modal-ai-chat');
    if (!modal) {
      const div = document.createElement('div');
      div.id = 'modal-ai-chat';
      div.className = 'modal';
      div.innerHTML = `
        <div class="modal-content modal-ai-chat">
          <div class="modal-header">
            <h2>AI 助手</h2>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="ai-chat-messages" id="ai-chat-messages"></div>
            <div class="ai-chat-input">
              <input type="text" id="ai-chat-input" placeholder="输入问题...">
              <button id="ai-chat-send" class="btn btn-primary">发送</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);

      div.querySelector('.modal-close').addEventListener('click', () => div.style.display = 'none');
      div.addEventListener('click', e => { if (e.target === div) div.style.display = 'none'; });

      document.getElementById('ai-chat-send').addEventListener('click', sendAIChatMessage);
      document.getElementById('ai-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') sendAIChatMessage();
      });
    }

    document.getElementById('modal-ai-chat').style.display = 'flex';
  }

  async function sendAIChatMessage() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    if (!message || isAIProcessing) return;

    if (!Settings.isAIConfigured()) {
      Notify.showToast('请先配置 AI API', 'error');
      showSettings();
      return;
    }

    // 显示用户消息
    addChatMessage('user', message);
    input.value = '';

    isAIProcessing = true;
    updateAIButtonState();

    try {
      const tasks = Store.query('pending');
      const response = await AI.chatWithAI(message, tasks);
      addChatMessage('ai', response);
    } catch (e) {
      addChatMessage('error', `错误: ${e.message}`);
    } finally {
      isAIProcessing = false;
      updateAIButtonState();
    }
  }

  function addChatMessage(type, content) {
    const container = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = `chat-message chat-${type}`;
    div.innerHTML = formatAIResponse(content);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function updateAIButtonState() {
    const btnAI = document.getElementById('btn-ai-recommend');
    if (btnAI) {
      btnAI.disabled = isAIProcessing;
      btnAI.classList.toggle('processing', isAIProcessing);
    }
  }

  function showSettings() {
    const modal = document.getElementById('modal-settings');
    if (!modal) {
      createSettingsModal();
    }
    loadSettingsValues();
    document.getElementById('modal-settings').style.display = 'flex';
  }

  function createSettingsModal() {
    const div = document.createElement('div');
    div.id = 'modal-settings';
    div.className = 'modal';
    div.innerHTML = `
      <div class="modal-content modal-settings">
        <div class="modal-header">
          <h2>设置</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body settings-body">
          <!-- AI API 配置 -->
          <div class="settings-section">
            <h3>AI API 配置</h3>
            <div class="setting-item">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-ai-enabled">
                <span class="toggle-slider"></span>
              </label>
              <span>启用 AI 功能</span>
            </div>
            <div class="setting-item">
              <label>API 地址</label>
              <input type="text" id="setting-ai-baseurl" placeholder="https://api.openai.com/v1">
            </div>
            <div class="setting-item">
              <label>API Key</label>
              <input type="text" id="setting-ai-apikey" placeholder="sk-...">
            </div>
            <div class="setting-item">
              <label>模型</label>
              <div class="model-select-wrapper">
                <select id="setting-ai-model-select">
                  <option value="">-- 请选择模型 --</option>
                </select>
                <input type="text" id="setting-ai-model" placeholder="或手动输入模型名称">
              </div>
            </div>
            <div class="setting-item">
              <button id="btn-fetch-models" class="btn btn-secondary">获取模型列表</button>
              <button id="btn-test-ai" class="btn btn-secondary">测试连接</button>
            </div>
            <div class="setting-item">
              <label>Temperature (0-2)</label>
              <div class="range-wrapper">
                <input type="range" id="setting-ai-temperature" min="0" max="2" step="0.1" value="0.7">
                <span id="setting-ai-temperature-value">0.7</span>
              </div>
            </div>
            <div class="setting-item">
              <label>Max Tokens</label>
              <input type="number" id="setting-ai-maxtokens" min="1" max="128000" value="1000">
            </div>
          </div>

          <!-- AI 角色配置 -->
          <div class="settings-section">
            <h3>AI 角色设置</h3>
            <div class="setting-item">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-airole-enabled">
                <span class="toggle-slider"></span>
              </label>
              <span>启用 AI 角色功能</span>
            </div>
            <div class="setting-item">
              <label>角色名称</label>
              <input type="text" id="setting-airole-name" placeholder="AI助手">
            </div>
            <div class="setting-item">
              <label>角色性格</label>
              <input type="text" id="setting-airole-personality" placeholder="专业、友好、高效">
            </div>
            <div class="setting-item setting-item-full">
              <label>系统提示词</label>
              <textarea id="setting-airole-prompt" rows="4" placeholder="你是一个智能任务管理助手..."></textarea>
            </div>
          </div>

          <!-- 每日提醒 -->
          <div class="settings-section">
            <h3>每日提醒</h3>
            <div class="setting-item">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-daily-reminder">
                <span class="toggle-slider"></span>
              </label>
              <span>开启每日任务提醒</span>
            </div>
            <div class="setting-item">
              <label>提醒时间</label>
              <input type="time" id="setting-daily-time" value="09:00">
            </div>
            <div class="setting-item setting-item-full">
              <span class="setting-hint">每天定时推送所有未完成任务的提醒通知</span>
            </div>
          </div>

          <!-- 通用设置 -->
          <div class="settings-section">
            <h3>通用设置</h3>
            <div class="setting-item">
              <label class="toggle-switch">
                <input type="checkbox" id="setting-notifications" checked>
                <span class="toggle-slider"></span>
              </label>
              <span>启用通知提醒</span>
            </div>
          </div>

          <!-- 数据管理 -->
          <div class="settings-section">
            <h3>数据管理</h3>
            <div class="setting-item setting-item-full">
              <span class="setting-hint">导出所有备忘录数据为 JSON 文件，或从 JSON 文件导入数据</span>
            </div>
            <div class="setting-item data-actions">
              <button id="btn-export-data" class="btn btn-secondary">导出数据</button>
              <button id="btn-import-data" class="btn btn-secondary">导入数据</button>
              <input type="file" id="import-file-input" accept=".json" style="display:none">
            </div>
          </div>

          <div class="settings-actions">
            <button id="btn-settings-save" class="btn btn-primary">保存设置</button>
            <button id="btn-settings-reset" class="btn btn-secondary">恢复默认</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // 绑定事件
    div.querySelector('.modal-close').addEventListener('click', () => div.style.display = 'none');
    div.addEventListener('click', e => { if (e.target === div) div.style.display = 'none'; });

    document.getElementById('btn-test-ai').addEventListener('click', testAIConnection);
    document.getElementById('btn-fetch-models').addEventListener('click', fetchModels);
    document.getElementById('btn-settings-save').addEventListener('click', saveSettings);
    document.getElementById('btn-settings-reset').addEventListener('click', resetSettings);

    // 数据导入导出
    document.getElementById('btn-export-data').addEventListener('click', exportData);
    document.getElementById('btn-import-data').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);

    // 模型选择联动
    document.getElementById('setting-ai-model-select').addEventListener('change', e => {
      if (e.target.value) {
        document.getElementById('setting-ai-model').value = e.target.value;
      }
    });

    // 自动拉取模型：API 地址和 Key 都填写后自动获取模型列表
    let autoFetchTimer = null;
    const baseUrlInput = document.getElementById('setting-ai-baseurl');
    const apiKeyInput = document.getElementById('setting-ai-apikey');
    const modelInput = document.getElementById('setting-ai-model');

    function scheduleAutoFetch() {
      clearTimeout(autoFetchTimer);
      const url = baseUrlInput.value.trim();
      const key = apiKeyInput.value.trim();
      if (url && key) {
        autoFetchTimer = setTimeout(async () => {
          const btn = document.getElementById('btn-fetch-models');
          if (btn.disabled) return;
          btn.disabled = true;
          btn.textContent = '自动获取中...';
          try {
            Settings.set('ai.baseUrl', url);
            Settings.set('ai.apiKey', key);
            const models = await AI.fetchModels();
            const modelSelect = document.getElementById('setting-ai-model-select');
            modelSelect.innerHTML = '<option value="">-- 请选择模型 --</option>';
            models.forEach(m => {
              const opt = document.createElement('option');
              opt.value = m;
              opt.textContent = m;
              modelSelect.appendChild(opt);
            });
            // 如果当前没有选中模型，自动选中第一个
            if (!modelInput.value && models.length > 0) {
              modelInput.value = models[0];
              modelSelect.value = models[0];
            }
            Notify.showToast(`已自动获取 ${models.length} 个模型`, 'success');
          } catch (e) {
            console.log('Auto fetch models failed:', e);
          } finally {
            btn.disabled = false;
            btn.textContent = '获取模型列表';
          }
        }, 1500);
      }
    }

    baseUrlInput.addEventListener('input', scheduleAutoFetch);
    apiKeyInput.addEventListener('input', scheduleAutoFetch);

    // Temperature 滑块联动
    document.getElementById('setting-ai-temperature').addEventListener('input', e => {
      document.getElementById('setting-ai-temperature-value').textContent = e.target.value;
    });
  }

  function loadSettingsValues() {
    const settings = Settings.load();

    // AI 设置
    document.getElementById('setting-ai-enabled').checked = settings.ai.enabled;
    document.getElementById('setting-ai-baseurl').value = settings.ai.baseUrl;
    document.getElementById('setting-ai-apikey').value = settings.ai.apiKey;
    document.getElementById('setting-ai-model').value = settings.ai.model;

    // 加载模型下拉列表
    const modelSelect = document.getElementById('setting-ai-model-select');
    modelSelect.innerHTML = '<option value="">-- 请选择模型 --</option>';
    if (settings.ai.availableModels && settings.ai.availableModels.length > 0) {
      settings.ai.availableModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === settings.ai.model) opt.selected = true;
        modelSelect.appendChild(opt);
      });
    }

    // Temperature 和 MaxTokens
    document.getElementById('setting-ai-temperature').value = settings.ai.temperature;
    document.getElementById('setting-ai-temperature-value').textContent = settings.ai.temperature;
    document.getElementById('setting-ai-maxtokens').value = settings.ai.maxTokens;

    // AI 角色设置
    document.getElementById('setting-airole-enabled').checked = settings.aiRole.enabled;
    document.getElementById('setting-airole-name').value = settings.aiRole.name;
    document.getElementById('setting-airole-personality').value = settings.aiRole.personality;
    document.getElementById('setting-airole-prompt').value = settings.aiRole.systemPrompt;

    // 每日提醒设置
    document.getElementById('setting-daily-reminder').checked = settings.dailyReminder.enabled;
    document.getElementById('setting-daily-time').value = settings.dailyReminder.time;

    // 通用设置
    document.getElementById('setting-notifications').checked = settings.general.notificationsEnabled;
  }

  async function testAIConnection() {
    const btn = document.getElementById('btn-test-ai');
    btn.disabled = true;
    btn.textContent = '测试中...';

    // 先保存当前输入的值
    Settings.set('ai.baseUrl', document.getElementById('setting-ai-baseurl').value);
    Settings.set('ai.apiKey', document.getElementById('setting-ai-apikey').value);
    Settings.set('ai.model', document.getElementById('setting-ai-model').value);

    const result = await AI.testConnection();

    btn.disabled = false;
    btn.textContent = '测试连接';

    if (result.success) {
      Notify.showToast('连接成功: ' + result.message, 'success');
    } else {
      Notify.showToast('连接失败: ' + result.message, 'error');
    }
  }

  async function fetchModels() {
    const btn = document.getElementById('btn-fetch-models');
    btn.disabled = true;
    btn.textContent = '获取中...';

    // 先保存当前输入的值
    Settings.set('ai.baseUrl', document.getElementById('setting-ai-baseurl').value);
    Settings.set('ai.apiKey', document.getElementById('setting-ai-apikey').value);

    try {
      const models = await AI.fetchModels();
      Notify.showToast(`已获取 ${models.length} 个模型`, 'success');

      // 更新下拉列表
      const modelSelect = document.getElementById('setting-ai-model-select');
      modelSelect.innerHTML = '<option value="">-- 请选择模型 --</option>';
      models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        modelSelect.appendChild(opt);
      });
    } catch (e) {
      Notify.showToast('获取模型失败: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '获取模型列表';
    }
  }

  function saveSettings() {
    const settings = Settings.load();

    // AI 设置
    settings.ai.enabled = document.getElementById('setting-ai-enabled').checked;
    settings.ai.baseUrl = document.getElementById('setting-ai-baseurl').value;
    settings.ai.apiKey = document.getElementById('setting-ai-apikey').value;
    settings.ai.model = document.getElementById('setting-ai-model').value;

    // 验证并保存 Temperature
    let temperature = parseFloat(document.getElementById('setting-ai-temperature').value);
    if (isNaN(temperature) || temperature < 0) temperature = 0;
    if (temperature > 2) temperature = 2;
    settings.ai.temperature = temperature;

    // 验证并保存 MaxTokens
    let maxTokens = parseInt(document.getElementById('setting-ai-maxtokens').value);
    if (isNaN(maxTokens) || maxTokens < 1) maxTokens = 1;
    if (maxTokens > 128000) maxTokens = 128000;
    settings.ai.maxTokens = maxTokens;

    // AI 角色设置
    settings.aiRole.enabled = document.getElementById('setting-airole-enabled').checked;
    settings.aiRole.name = document.getElementById('setting-airole-name').value;
    settings.aiRole.personality = document.getElementById('setting-airole-personality').value;
    settings.aiRole.systemPrompt = document.getElementById('setting-airole-prompt').value;

    // 每日提醒设置
    settings.dailyReminder.enabled = document.getElementById('setting-daily-reminder').checked;
    settings.dailyReminder.time = document.getElementById('setting-daily-time').value;

    // 通用设置
    settings.general.notificationsEnabled = document.getElementById('setting-notifications').checked;

    Settings.save(settings);
    document.getElementById('modal-settings').style.display = 'none';
    Notify.showToast('设置已保存', 'success');
  }

  function resetSettings() {
    if (confirm('确定要恢复默认设置吗？')) {
      Settings.reset();
      loadSettingsValues();
      Notify.showToast('已恢复默认设置', 'success');
    }
  }

  function render() {
    const memos = Store.query(currentFilter, searchQuery);
    const container = document.getElementById('memo-list');
    const empty = document.getElementById('empty-state');

    if (memos.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = memos.map(m => renderCard(m)).join('');

    // 绑定卡片事件
    container.querySelectorAll('.memo-card').forEach(card => {
      const id = parseInt(card.dataset.id);

      card.querySelector('.memo-check').addEventListener('click', e => {
        e.stopPropagation();
        const memo = Store.query('all').find(m => m.id === id);
        if (memo && memo.status === 'pending') {
          Store.complete(id);
          Notify.cancel(id);
          Notify.showToast('已完成', 'success');
        } else if (memo && memo.status === 'completed') {
          Store.update(id, { status: 'pending', completedAt: null });
          Notify.showToast('已恢复', 'success');
        }
        render();
      });

      card.querySelector('.memo-action.edit').addEventListener('click', e => {
        e.stopPropagation();
        openEdit(id);
      });

      card.querySelector('.memo-action.delete').addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('确定删除这条备忘录？')) {
          Store.remove(id);
          Notify.cancel(id);
          Notify.showToast('已删除', 'success');
          render();
        }
      });
    });
  }

  function renderCard(memo) {
    const now = new Date();
    const isOverdue = memo.status === 'pending' && memo.datetime && new Date(memo.datetime) < now;
    const isCompleted = memo.status === 'completed';

    const priorityLabels = { high: '紧急', medium: '普通', low: '不急' };
    const categoryEmoji = {
      '工作': '💼', '生活': '🏠', '项目': '📋', '购物': '🛒',
      '健康': '❤️', '学习': '📚', '财务': '💰', '其他': '📌'
    };

    let timeHtml = '';
    if (memo.datetimeText) {
      const cls = isOverdue ? 'overdue-text' : '';
      const icon = isOverdue
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
      timeHtml = `<span class="memo-time ${cls}">${icon} ${memo.datetimeText}${isOverdue ? ' (已逾期)' : ''}</span>`;
    }

    let peopleHtml = '';
    if (memo.people && memo.people.length > 0) {
      peopleHtml = `<div class="memo-people">👥 ${memo.people.join('、')}</div>`;
    }

    return `
      <div class="memo-card ${isOverdue ? 'overdue' : ''} ${isCompleted ? 'completed' : ''}" data-id="${memo.id}">
        <div class="memo-top">
          <button class="memo-check ${isCompleted ? 'done' : ''}"></button>
          <div class="memo-body">
            <div class="memo-desc">${categoryEmoji[memo.category] || '📌'} ${escapeHtml(memo.description)}</div>
            <div class="memo-meta">
              <span class="memo-tag">${memo.category}</span>
              <span class="memo-tag priority-${memo.priority}">${priorityLabels[memo.priority] || '普通'}</span>
              ${timeHtml}
            </div>
            ${peopleHtml}
          </div>
          <div class="memo-actions">
            <button class="memo-action edit" title="编辑">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="memo-action delete" title="删除">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function openEdit(id) {
    const memos = Store.query('all');
    const memo = memos.find(m => m.id === id);
    if (!memo) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-desc').value = memo.description;
    document.getElementById('edit-category').value = memo.category;
    document.getElementById('edit-priority').value = memo.priority;
    document.getElementById('edit-people').value = (memo.people || []).join(', ');

    if (memo.datetime) {
      const d = new Date(memo.datetime);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      document.getElementById('edit-datetime').value = local.toISOString().slice(0, 16);
    } else {
      document.getElementById('edit-datetime').value = '';
    }

    document.getElementById('modal-edit').style.display = 'flex';
  }

  function saveEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const desc = document.getElementById('edit-desc').value.trim();
    const category = document.getElementById('edit-category').value;
    const priority = document.getElementById('edit-priority').value;
    const datetimeStr = document.getElementById('edit-datetime').value;
    const peopleStr = document.getElementById('edit-people').value;

    if (!desc) {
      Notify.showToast('描述不能为空', 'error');
      return;
    }

    const changes = { description: desc, category, priority };

    if (datetimeStr) {
      const d = new Date(datetimeStr);
      changes.datetime = d.toISOString();
      changes.datetimeText = TimeParser.formatDate(d, true);
      changes.hasTime = true;
    } else {
      changes.datetime = null;
      changes.datetimeText = null;
      changes.hasTime = false;
    }

    changes.people = peopleStr ? peopleStr.split(/[,，]\s*/).map(s => s.trim()).filter(Boolean) : [];

    Store.update(id, changes);
    Notify.cancel(id);
    if (changes.datetime) Notify.schedule({ id, ...changes });

    document.getElementById('modal-edit').style.display = 'none';
    Notify.showToast('已更新', 'success');
    render();
  }

  function showManualAdd() {
    const modal = document.getElementById('modal-manual-add');
    if (!modal) {
      const div = document.createElement('div');
      div.id = 'modal-manual-add';
      div.className = 'modal';
      div.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>添加任务</h2>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>任务描述</label>
              <input type="text" id="manual-desc" placeholder="输入任务内容">
            </div>
            <div class="form-group">
              <label>日期</label>
              <input type="date" id="manual-date">
            </div>
            <div class="form-group">
              <label>时间</label>
              <input type="time" id="manual-time">
            </div>
            <div class="form-group">
              <label>分类</label>
              <select id="manual-category">
                <option value="工作">工作</option>
                <option value="生活">生活</option>
                <option value="项目">项目</option>
                <option value="购物">购物</option>
                <option value="健康">健康</option>
                <option value="学习">学习</option>
                <option value="财务">财务</option>
                <option value="其他" selected>其他</option>
              </select>
            </div>
            <div class="form-group">
              <label>优先级</label>
              <select id="manual-priority">
                <option value="high">紧急</option>
                <option value="medium" selected>普通</option>
                <option value="low">不急</option>
              </select>
            </div>
            <div class="form-actions">
              <button id="btn-manual-save" class="btn btn-primary">添加</button>
              <button id="btn-manual-cancel" class="btn">取消</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(div);
      div.querySelector('.modal-close').addEventListener('click', () => div.style.display = 'none');
      div.addEventListener('click', e => { if (e.target === div) div.style.display = 'none'; });
      document.getElementById('btn-manual-save').addEventListener('click', saveManualTask);
      document.getElementById('btn-manual-cancel').addEventListener('click', () => div.style.display = 'none');
    }
    // 清空表单
    document.getElementById('manual-desc').value = '';
    document.getElementById('manual-date').value = '';
    document.getElementById('manual-time').value = '';
    document.getElementById('manual-category').value = '其他';
    document.getElementById('manual-priority').value = 'medium';
    document.getElementById('modal-manual-add').style.display = 'flex';
  }

  function saveManualTask() {
    const desc = document.getElementById('manual-desc').value.trim();
    if (!desc) { Notify.showToast('请输入任务描述', 'error'); return; }

    const dateStr = document.getElementById('manual-date').value;
    const timeStr = document.getElementById('manual-time').value;
    let datetime = null, datetimeText = null, hasTime = false;

    if (dateStr) {
      const parts = dateStr.split('-');
      if (timeStr) {
        const tparts = timeStr.split(':');
        datetime = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), parseInt(tparts[0]), parseInt(tparts[1]), 0);
        hasTime = true;
      } else {
        datetime = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 0, 0, 0);
      }
      if (!isNaN(datetime.getTime())) {
        datetimeText = TimeParser.formatDate(datetime, hasTime);
      } else {
        datetime = null;
      }
    }

    const data = {
      intent: 'add',
      description: desc,
      category: document.getElementById('manual-category').value,
      priority: document.getElementById('manual-priority').value,
      people: [],
      datetime, datetimeText, hasTime,
      raw: desc,
    };

    try {
      const memo = Store.add(data);
      if (datetime) Notify.schedule(memo);
      Notify.showToast(`已添加: ${memo.description}`, 'success');
    } catch (e) {
      console.error('Manual add error:', e);
      Notify.showToast('添加失败', 'error');
    }

    document.getElementById('modal-manual-add').style.display = 'none';
    render();
  }

  function showStats() {
    const s = Store.stats();
    document.getElementById('stats-body').innerHTML = `
      <div class="stat-grid">
        <div class="stat-item"><div class="stat-value">${s.pending}</div><div class="stat-label">待办</div></div>
        <div class="stat-item"><div class="stat-value">${s.today}</div><div class="stat-label">今日</div></div>
        <div class="stat-item"><div class="stat-value">${s.overdue}</div><div class="stat-label">逾期</div></div>
        <div class="stat-item"><div class="stat-value">${s.completed}</div><div class="stat-label">已完成</div></div>
      </div>
    `;
    document.getElementById('modal-stats').style.display = 'flex';
  }

  let lastDailyReminderDate = '';

  function checkReminders() {
    // 任务到期提醒
    const reminders = Store.getDueReminders();
    reminders.forEach(m => {
      Notify.showToast(`⏰ 提醒: ${m.description}`, 'info');
    });

    // 每日定时提醒
    const dr = Settings.get('dailyReminder');
    if (dr && dr.enabled && dr.time) {
      const now = new Date();
      const todayStr = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate();
      const currentTime = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      if (currentTime === dr.time && lastDailyReminderDate !== todayStr) {
        lastDailyReminderDate = todayStr;
        const pending = Store.query('pending');
        if (pending.length > 0) {
          const list = pending.slice(0, 10).map((m, i) =>
            `${i+1}. ${m.description}${m.datetimeText ? ' ('+m.datetimeText+')' : ''}`
          ).join('\n');
          Notify.showToast(`📋 每日提醒：你有 ${pending.length} 个待办任务\n${list}`, 'info');
          // 尝试发送本地通知
          if (pending.length > 0) {
            Notify.schedule({ id: 999999, description: `你有 ${pending.length} 个待办任务待处理`, datetime: new Date(Date.now() + 1000).toISOString() });
          }
        }
      }
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  // 导出数据
  function exportData() {
    try {
      const jsonStr = Store.exportAll();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      a.href = url;
      a.download = `memo_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Notify.showToast('数据导出成功', 'success');
    } catch (e) {
      console.error('Export error:', e);
      Notify.showToast('导出失败: ' + e.message, 'error');
    }
  }

  // 导入数据
  function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
      const jsonStr = ev.target.result;

      // 显示导入选项弹窗
      showImportDialog(jsonStr, file.name);
    };
    reader.onerror = function() {
      Notify.showToast('读取文件失败', 'error');
    };
    reader.readAsText(file, 'utf-8');

    // 清空 input 以便重复选择同一文件
    e.target.value = '';
  }

  function showImportDialog(jsonStr, fileName) {
    // 解析文件获取数量
    let preview;
    try {
      const data = JSON.parse(jsonStr);
      if (!data.memos || !Array.isArray(data.memos)) {
        Notify.showToast('文件格式错误：缺少 memos 数据', 'error');
        return;
      }
      preview = data;
    } catch (e) {
      Notify.showToast('JSON 解析失败', 'error');
      return;
    }

    const existingCount = Store.load().length;
    const importCount = preview.memos.length;

    // 创建弹窗
    let modal = document.getElementById('modal-import');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-import';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>导入数据</h2>
            <button class="modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="import-info"></div>
            <div class="form-actions">
              <button id="btn-import-replace" class="btn btn-primary">替换现有数据</button>
              <button id="btn-import-merge" class="btn btn-secondary">合并到现有数据</button>
              <button id="btn-import-cancel" class="btn">取消</button>
            </div>
            <div class="setting-hint import-hint"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.modal-close').addEventListener('click', () => modal.style.display = 'none');
      modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    }

    modal.querySelector('.import-info').innerHTML = `
      <p>文件: <strong>${escapeHtml(fileName)}</strong></p>
      <p>文件中包含 <strong>${importCount}</strong> 条备忘录</p>
      <p>当前已有 <strong>${existingCount}</strong> 条备忘录</p>
    `;
    modal.querySelector('.import-hint').textContent = '替换：清除现有数据，仅保留导入数据 | 合并：保留现有数据，追加导入数据';

    // 绑定按钮事件
    const btnReplace = modal.querySelector('#btn-import-replace');
    const btnMerge = modal.querySelector('#btn-import-merge');
    const btnCancel = modal.querySelector('#btn-import-cancel');

    // 移除旧事件监听（通过克隆节点）
    const newBtnReplace = btnReplace.cloneNode(true);
    const newBtnMerge = btnMerge.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnReplace.parentNode.replaceChild(newBtnReplace, btnReplace);
    btnMerge.parentNode.replaceChild(newBtnMerge, btnMerge);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnReplace.addEventListener('click', () => {
      doImport(jsonStr, 'replace', importCount);
      modal.style.display = 'none';
    });
    newBtnMerge.addEventListener('click', () => {
      doImport(jsonStr, 'merge', importCount);
      modal.style.display = 'none';
    });
    newBtnCancel.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.style.display = 'flex';
  }

  function doImport(jsonStr, mode, count) {
    try {
      const result = Store.importAll(jsonStr, mode);
      render();
      Notify.showToast(`导入成功：${result.imported} 条数据（${mode === 'replace' ? '替换模式' : '合并模式'}）`, 'success');
    } catch (e) {
      console.error('Import error:', e);
      Notify.showToast('导入失败: ' + e.message, 'error');
    }
  }

  return { init };
})();

// 启动应用
document.addEventListener('DOMContentLoaded', App.init);
