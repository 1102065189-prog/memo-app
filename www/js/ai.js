// AI 模块 - 支持 OpenAI 兼容 API
const AI = (() => {
  let isProcessing = false;

  // 调用 AI API
  async function chat(messages, options = {}) {
    const config = Settings.getAIConfig();
    if (!config.enabled || !config.apiKey) {
      throw new Error('AI 未配置');
    }

    const url = `${config.baseUrl}/chat/completions`;
    const body = {
      model: options.model || config.model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens || config.maxTokens,
      stream: false,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API 错误: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (e) {
      console.error('AI API error:', e);
      throw e;
    }
  }

  // 测试 API 连接
  async function testConnection() {
    try {
      const result = await chat([
        { role: 'user', content: '你好，请回复"连接成功"' }
      ], { maxTokens: 50 });
      return { success: true, message: result };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // 获取可用模型列表
  async function fetchModels() {
    const config = Settings.getAIConfig();
    if (!config.apiKey || !config.baseUrl) {
      throw new Error('请先配置 API 地址和 Key');
    }

    const url = `${config.baseUrl}/models`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`获取模型列表失败: ${response.status}`);
      }

      const data = await response.json();
      // OpenAI 格式的模型列表
      const models = (data.data || data)
        .map(m => m.id || m)
        .filter(id => typeof id === 'string')
        .sort();

      // 保存到设置
      Settings.set('ai.availableModels', models);
      return models;
    } catch (e) {
      console.error('Fetch models error:', e);
      throw e;
    }
  }

  // 使用 AI 解析自然语言任务
  async function parseTask(text) {
    const prompt = `你是一个任务解析助手。请从以下中文文本中提取任务信息，返回 JSON 格式：
{
  "description": "任务描述",
  "category": "分类(工作/生活/项目/购物/健康/学习/财务/其他)",
  "priority": "优先级(high/medium/low)",
  "datetime": "ISO格式时间(如果有，否则null)",
  "people": ["相关人员(如果有)"],
  "hasTime": true/false
}

用户输入：${text}`;

    try {
      const result = await chat([{ role: 'user', content: prompt }]);
      // 提取 JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // 转换 datetime
        if (parsed.datetime) {
          parsed.datetime = new Date(parsed.datetime);
        }
        return parsed;
      }
    } catch (e) {
      console.error('AI parse task error:', e);
    }
    return null;
  }

  // AI 推荐优先任务
  async function recommendTasks(tasks) {
    const roleConfig = Settings.getAIRoleConfig();
    const systemPrompt = roleConfig.systemPrompt || '你是一个智能任务管理助手。';

    const tasksText = tasks.map((t, i) => {
      const time = t.datetime ? ` (${t.datetimeText || new Date(t.datetime).toLocaleString()})` : '';
      const overdue = t.isOverdue ? ' [已逾期]' : '';
      return `${i + 1}. [${t.priority}] ${t.description} - ${t.category}${time}${overdue}`;
    }).join('\n');

    const prompt = `当前待办任务列表：
${tasksText}

请分析这些任务，推荐 2-3 个最应该优先处理的任务，并给出简短的建议（每条建议不超过 50 字）。

回复格式：
## 推荐任务
1. **任务名称** - 建议内容
2. **任务名称** - 建议内容

## 总体建议
一句话总结`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
      return await chat(messages);
    } catch (e) {
      console.error('AI recommend error:', e);
      throw e;
    }
  }

  // AI 对话助手
  async function chatWithAI(userMessage, taskContext = null) {
    const roleConfig = Settings.getAIRoleConfig();
    const systemPrompt = roleConfig.systemPrompt || '你是一个智能任务管理助手。';

    let contextInfo = '';
    if (taskContext && taskContext.length > 0) {
      contextInfo = `\n\n当前用户任务列表：\n${taskContext.map(t =>
        `- ${t.description} [${t.category}] ${t.priority === 'high' ? '(紧急)' : ''}`
      ).join('\n')}`;
    }

    const messages = [
      { role: 'system', content: systemPrompt + contextInfo },
      { role: 'user', content: userMessage }
    ];

    return await chat(messages);
  }

  function isBusy() {
    return isProcessing;
  }

  return { chat, testConnection, fetchModels, parseTask, recommendTasks, chatWithAI, isBusy };
})();
