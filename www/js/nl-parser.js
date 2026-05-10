// 自然语言解析器
const NLParser = (() => {
  const CATEGORY_KEYWORDS = {
    '工作': ['开会', '会议', '汇报', '项目', '客户', '需求', '排期', '上线', '部署', '代码', 'bug', '测试', '评审', '周报', '日报', '加班', '出差', '面试', '招聘', '工作', '任务', '交付'],
    '生活': ['买菜', '做饭', '打扫', '洗衣服', '取快递', '寄快递', '搬家', '装修', '水电', '物业', '生活', '家里'],
    '项目': ['开发', '设计', '原型', '接口', '数据库', '服务器', '域名', '备案', '版本', '迭代', '发版', '重构'],
    '购物': ['买', '购买', '下单', '购物', '淘宝', '京东', '商城', '超市', '打折', '优惠'],
    '健康': ['看医生', '体检', '吃药', '锻炼', '跑步', '健身', '医院', '挂号', '复查', '牙医'],
    '学习': ['学习', '看书', '课程', '考试', '复习', '作业', '论文', '培训', '讲座', '读书'],
    '财务': ['报销', '账单', '还款', '工资', '转账', '缴费', '税', '发票', '理财', '贷款'],
  };

  const PRIORITY_KEYWORDS = {
    'high': ['紧急', '重要', '急', '马上', '立刻', '尽快', '优先', '火速', '赶紧'],
    'low': ['不急', '有空', '随便', '抽空', '闲了', '有时间'],
  };

  const PEOPLE_PATTERNS = [
    /(?:和|跟|与)([一-龥]{2,4})(?:一起|一块|讨论|商量|面谈|开会|沟通)/,
    /(?:找|问|联系|通知|提醒)([一-龥]{2,4})/,
    /(?:给|发给|告诉|转告)([一-龥]{2,4})/,
    /(?:约|邀请)([一-龥]{2,4})/,
    /([一-龥]{2,4})(?:说|要求|提出|提到)/,
  ];

  const ACTION_PREFIXES = [
    /^(?:添加|新建|创建|记录|记一下|提醒我|帮我记|备忘)[:：]?\s*/,
    /^(?:我要|我需要|我得|我应该|别忘了|记得)\s*/,
  ];

  const QUERY_PATTERN = /^(?:查看|看看|有什么|哪些|列出|显示|我的|所有|全部|今天|明天|这周|本周|下周|逾期|过期).*(?:待办|备忘|事|任务|提醒|memo)/i;
  const DONE_PATTERN = /^(?:完成了?|搞定了?|做完了?|完成了|done|好了|完事了?|结束了?|处理完了?)/;
  const CANCEL_PATTERN = /^(?:取消|删除|去掉|不要了|算了|撤[回销]|移除|干掉)/;
  const EDIT_PATTERN = /^(?:修改|改[成为]|推迟|延期|提前|更新|调整)/;

  function parse(text) {
    if (!text || !text.trim()) return null;
    let s = text.trim();

    try {
      // 意图识别
      if (QUERY_PATTERN.test(s)) return { intent: 'query', raw: s };
      if (DONE_PATTERN.test(s)) {
        const rest = s.replace(DONE_PATTERN, '').trim();
        return { intent: 'done', target: rest || null, raw: s };
      }
      if (CANCEL_PATTERN.test(s)) {
        const rest = s.replace(CANCEL_PATTERN, '').trim();
        return { intent: 'cancel', target: rest || null, raw: s };
      }
      if (EDIT_PATTERN.test(s)) {
        return parseEdit(s);
      }

      // 默认：添加
      return parseAdd(s);
    } catch (e) {
      console.error('NLParser.parse error:', e);
      // 解析出错时，返回基本的添加任务结构
      return {
        intent: 'add',
        description: s.substring(0, 50),
        category: '其他',
        priority: 'medium',
        people: [],
        datetime: null,
        datetimeText: null,
        hasTime: false,
        raw: s,
      };
    }
  }

  function parseAdd(s) {
    let desc = s;

    // 剥离动作前缀
    for (const p of ACTION_PREFIXES) {
      desc = desc.replace(p, '');
    }

    // 提取时间
    let timeResult = null;
    try {
      timeResult = TimeParser.parse(desc);
    } catch (e) {
      console.error('TimeParser.parse error:', e);
    }

    // 提取优先级
    let priority = 'medium';
    for (const [level, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some(k => s.includes(k))) { priority = level; break; }
    }

    // 提取分类
    let category = '其他';
    let maxScore = 0;
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const score = keywords.filter(k => s.includes(k)).length;
      if (score > maxScore) { maxScore = score; category = cat; }
    }

    // 提取人员
    const people = [];
    for (const p of PEOPLE_PATTERNS) {
      const m = s.match(p);
      if (m && !people.includes(m[1])) people.push(m[1]);
    }

    // 清理描述：移除时间文本
    if (timeResult) {
      try {
        desc = TimeParser.extractTimeText(desc);
      } catch (e) {
        console.error('TimeParser.extractTimeText error:', e);
      }
    }

    // 清理描述：移除优先级和人员文本
    for (const keywords of Object.values(PRIORITY_KEYWORDS)) {
      for (const k of keywords) desc = desc.replace(k, '');
    }
    for (const p of PEOPLE_PATTERNS) {
      desc = desc.replace(p, '');
    }

    desc = desc.replace(/[，,。.！!？?\s]+$/g, '').trim();
    if (!desc) desc = s.substring(0, 20);

    return {
      intent: 'add',
      description: desc,
      category,
      priority,
      people,
      datetime: timeResult ? timeResult.date : null,
      datetimeText: timeResult ? timeResult.text : null,
      hasTime: timeResult ? timeResult.hasTime : false,
      raw: s,
    };
  }

  function parseEdit(s) {
    let target = s;
    let newDesc, newTime;

    // "把X改成Y" / "X改成Y"
    const editMatch = s.match(/(?:把)?(.+?)(?:改[成为]|推迟|延期|提前|调整|更新到?)(.+)/);
    if (editMatch) {
      target = editMatch[1].trim();
      const change = editMatch[2].trim();
      const timeResult = TimeParser.parse(change);
      if (timeResult) {
        newTime = timeResult;
      } else {
        newDesc = change;
      }
    }

    // 推迟N天
    const delayMatch = s.match(/推迟|延期\s*(\d+)\s*天/);
    if (delayMatch) {
      newTime = { delayDays: parseInt(delayMatch[1]) };
    }

    return {
      intent: 'edit',
      target: target || null,
      newDesc,
      newTime,
      raw: s,
    };
  }

  return { parse };
})();
