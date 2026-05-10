// 数据存储层 - localStorage
const Store = (() => {
  const STORAGE_KEY = 'memos';
  const ID_KEY = 'memo_next_id';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function save(memos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  }

  function nextId() {
    let id = parseInt(localStorage.getItem(ID_KEY) || '1');
    localStorage.setItem(ID_KEY, String(id + 1));
    return id;
  }

  function add(data) {
    const memos = load();
    let datetimeStr = null;
    if (data.datetime) {
      try {
        datetimeStr = data.datetime.toISOString();
        if (isNaN(new Date(datetimeStr).getTime())) datetimeStr = null;
      } catch (e) {
        console.error('Invalid datetime:', e);
        datetimeStr = null;
      }
    }
    const memo = {
      id: nextId(),
      description: data.description,
      category: data.category || '其他',
      priority: data.priority || 'medium',
      people: data.people || [],
      datetime: datetimeStr,
      datetimeText: data.datetimeText || null,
      hasTime: data.hasTime || false,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: null,
    };
    memos.push(memo);
    save(memos);
    return memo;
  }

  function find(target) {
    const memos = load();
    if (!target) return null;

    // 按ID匹配
    const idMatch = target.match(/^#?(\d+)$/);
    if (idMatch) {
      return memos.find(m => m.id === parseInt(idMatch[1]) && m.status === 'pending') || null;
    }

    // 按关键词匹配
    const keyword = target.replace(/^(?:把|将|帮我|请)/, '').trim();
    const pending = memos.filter(m => m.status === 'pending');
    return pending.find(m =>
      m.description.includes(keyword) || keyword.includes(m.description)
    ) || null;
  }

  function complete(id) {
    const memos = load();
    const memo = memos.find(m => m.id === id);
    if (memo) {
      memo.status = 'completed';
      memo.completedAt = new Date().toISOString();
      save(memos);
    }
    return memo;
  }

  function cancel(id) {
    const memos = load();
    const memo = memos.find(m => m.id === id);
    if (memo) {
      memo.status = 'cancelled';
      memo.updatedAt = new Date().toISOString();
      save(memos);
    }
    return memo;
  }

  function update(id, changes) {
    const memos = load();
    const memo = memos.find(m => m.id === id);
    if (memo) {
      Object.assign(memo, changes, { updatedAt: new Date().toISOString() });
      save(memos);
    }
    return memo;
  }

  function remove(id) {
    const memos = load();
    const idx = memos.findIndex(m => m.id === id);
    if (idx >= 0) {
      memos.splice(idx, 1);
      save(memos);
      return true;
    }
    return false;
  }

  function query(filter, search) {
    let memos = load();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));

    switch (filter) {
      case 'pending':
        memos = memos.filter(m => m.status === 'pending');
        break;
      case 'today':
        memos = memos.filter(m => {
          if (!m.datetime) return false;
          const d = new Date(m.datetime);
          return d >= today && d < tomorrow && m.status === 'pending';
        });
        break;
      case 'overdue':
        memos = memos.filter(m => {
          if (!m.datetime || m.status !== 'pending') return false;
          return new Date(m.datetime) < today;
        });
        break;
      case 'completed':
        memos = memos.filter(m => m.status === 'completed');
        break;
      case 'all':
      default:
        break;
    }

    if (search) {
      const q = search.toLowerCase();
      memos = memos.filter(m =>
        m.description.toLowerCase().includes(q) ||
        m.category.includes(q) ||
        m.people.some(p => p.includes(q))
      );
    }

    // 排序
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    memos.sort((a, b) => {
      // 已完成的放最后
      if (a.status !== b.status) return a.status === 'completed' ? 1 : -1;
      // 按优先级
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      // 按时间
      if (a.datetime && b.datetime) return new Date(a.datetime) - new Date(b.datetime);
      if (a.datetime) return -1;
      if (b.datetime) return 1;
      return b.id - a.id;
    });

    return memos;
  }

  function stats() {
    const memos = load();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      total: memos.length,
      pending: memos.filter(m => m.status === 'pending').length,
      completed: memos.filter(m => m.status === 'completed').length,
      today: memos.filter(m => {
        if (!m.datetime) return false;
        const d = new Date(m.datetime);
        return d >= today && d < tomorrow && m.status === 'pending';
      }).length,
      overdue: memos.filter(m => {
        if (!m.datetime || m.status !== 'pending') return false;
        return new Date(m.datetime) < today;
      }).length,
    };
  }

  function getDueReminders() {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60000); // 30分钟内
    return load().filter(m => {
      if (m.status !== 'pending' || !m.datetime) return false;
      const d = new Date(m.datetime);
      return d >= now && d <= soon;
    });
  }

  // 导出所有数据为 JSON 字符串
  function exportAll() {
    const memos = load();
    const data = {
      version: '1.0',
      appName: 'Memo AI备忘录',
      exportDate: new Date().toISOString(),
      count: memos.length,
      memos: memos,
    };
    return JSON.stringify(data, null, 2);
  }

  // 导入数据（合并或替换）
  function importAll(jsonStr, mode) {
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('JSON 格式错误');
    }

    if (!data.memos || !Array.isArray(data.memos)) {
      throw new Error('数据格式错误：缺少 memos 数组');
    }

    // 验证每条数据的必要字段
    const validMemos = data.memos.filter(m => {
      return m && typeof m.description === 'string' && m.description.trim();
    }).map(m => ({
      id: m.id || nextId(),
      description: m.description,
      category: m.category || '其他',
      priority: m.priority || 'medium',
      people: Array.isArray(m.people) ? m.people : [],
      datetime: m.datetime || null,
      datetimeText: m.datetimeText || null,
      hasTime: m.hasTime || false,
      status: m.status || 'pending',
      createdAt: m.createdAt || new Date().toISOString(),
      completedAt: m.completedAt || null,
      updatedAt: m.updatedAt || null,
    }));

    if (mode === 'replace') {
      save(validMemos);
      // 更新 ID 计数器
      const maxId = validMemos.reduce((max, m) => Math.max(max, m.id || 0), 0);
      localStorage.setItem(ID_KEY, String(maxId + 1));
    } else {
      // 合并模式：追加到现有数据
      const existing = load();
      const existingIds = new Set(existing.map(m => m.id));
      // 为冲突的 ID 重新分配
      validMemos.forEach(m => {
        if (existingIds.has(m.id)) {
          m.id = nextId();
        }
      });
      save([...existing, ...validMemos]);
    }

    return { imported: validMemos.length, mode };
  }

  return { add, find, complete, cancel, update, remove, query, stats, getDueReminders, load, exportAll, importAll };
})();
