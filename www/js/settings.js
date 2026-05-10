// 设置管理模块
const Settings = (() => {
  const SETTINGS_KEY = 'memo_settings';

  // 默认设置
  const defaults = {
    ai: {
      enabled: false,
      apiKey: '',
      baseUrl: 'https://api.moonshot.cn/v1',
      model: '',
      temperature: 0.7,
      maxTokens: 3000,
      availableModels: [],
    },
    aiRole: {
      enabled: false,
      name: 'AI助手',
      personality: '专业、友好、高效',
      systemPrompt: '你是一个智能任务管理助手。用户会给你任务列表，你需要分析并推荐优先处理的任务，给出简短的建议。回复要简洁、有条理。',
    },
    dailyReminder: {
      enabled: false,
      time: '09:00',
    },
    general: {
      theme: 'dark',
      language: 'zh-CN',
      notificationsEnabled: true,
    }
  };

  function load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return deepMerge(defaults, saved);
      }
    } catch (e) {
      console.error('Load settings error:', e);
    }
    return JSON.parse(JSON.stringify(defaults));
  }

  function save(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function get(path) {
    const settings = load();
    const keys = path.split('.');
    let value = settings;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  function set(path, value) {
    const settings = load();
    const keys = path.split('.');
    let current = settings;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    save(settings);
    return settings;
  }

  function reset() {
    localStorage.removeItem(SETTINGS_KEY);
    return JSON.parse(JSON.stringify(defaults));
  }

  function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // 获取 AI 配置
  function getAIConfig() {
    return load().ai;
  }

  // 获取 AI 角色配置
  function getAIRoleConfig() {
    return load().aiRole;
  }

  // 检查 AI 是否已配置
  function isAIConfigured() {
    const ai = getAIConfig();
    return ai.enabled && ai.apiKey && ai.baseUrl && ai.model;
  }

  // 检查 AI 角色是否启用
  function isAIRoleEnabled() {
    const aiRole = getAIRoleConfig();
    return isAIConfigured() && aiRole.enabled;
  }

  return { load, save, get, set, reset, getAIConfig, getAIRoleConfig, isAIConfigured, isAIRoleEnabled };
})();
