// 中文时间表达式解析器 - 增强版
const TimeParser = (() => {
  const now = () => new Date();

  const WEEKDAYS = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };

  // 中文数字映射
  const CN_NUMS = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12,
    '１': 1, '２': 2, '３': 3, '４': 4, '５': 5, '６': 6, '７': 7, '８': 8, '９': 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
  };

  // 解析中文数字
  function parseCNNumber(str) {
    if (!str) return null;
    str = str.trim();
    if (CN_NUMS[str] !== undefined) return CN_NUMS[str];
    // 处理"十几"、"二十几"等
    if (str.startsWith('十')) return 10 + (CN_NUMS[str.slice(1)] || 0);
    const match = str.match(/([一二两三四五六七八九])?十([一二两三四五六七八九])?/);
    if (match) return (CN_NUMS[match[1]] || 1) * 10 + (CN_NUMS[match[2]] || 0);
    return parseInt(str) || null;
  }

  function parse(str) {
    if (!str) return null;
    const s = str.trim();
    const d = now();
    let year = d.getFullYear(), month = d.getMonth(), day = d.getDate();
    let hour = null, minute = 0, hasTime = false, hasDate = false;

    // ========== 日期解析 ==========

    // 大前天/前天/昨天/今天/明天/后天/大后天/大大后天
    const dayMatch = s.match(/(大大后天|大后天|后天|明天|今天|昨天|前天|大前天)/);
    if (dayMatch) {
      const offsets = { '大前天': -3, '前天': -2, '昨天': -1, '今天': 0, '明天': 1, '后天': 2, '大后天': 3, '大大后天': 4 };
      const target = new Date(year, month, day + offsets[dayMatch[1]]);
      year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
      hasDate = true;
    }

    // 下下周X / 下个下周X
    const nextNextWeekMatch = s.match(/下下(?:个)?(?:周|星期)([一二三四五六日天])/);
    if (nextNextWeekMatch) {
      const targetDay = WEEKDAYS[nextNextWeekMatch[1]];
      const cur = d.getDay();
      let diff = targetDay - cur + 14;
      if (diff <= 14) diff = targetDay - cur + 14;
      const target = new Date(year, month, day + diff);
      year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
      hasDate = true;
    }

    // 下周X / 下个星期X
    if (!hasDate) {
      const nextWeekMatch = s.match(/下(?:个)?(?:周|星期)([一二三四五六日天])/);
      if (nextWeekMatch) {
        const targetDay = WEEKDAYS[nextWeekMatch[1]];
        const cur = d.getDay();
        let diff = targetDay - cur + 7;
        if (diff <= 0) diff += 7;
        const target = new Date(year, month, day + diff);
        year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
        hasDate = true;
      }
    }

    // 这周X / 本周X / 这个星期X
    if (!hasDate) {
      const thisWeekMatch = s.match(/(?:这|本)(?:个)?(?:周|星期)([一二三四五六日天])/);
      if (thisWeekMatch) {
        const targetDay = WEEKDAYS[thisWeekMatch[1]];
        const cur = d.getDay();
        let diff = targetDay - cur;
        if (diff < 0) diff += 7;
        const target = new Date(year, month, day + diff);
        year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
        hasDate = true;
      }
    }

    // 周X / 星期X (默认下周)
    if (!hasDate) {
      const weekMatch = s.match(/(?<!下|这|本|上)(?:周|星期)([一二三四五六日天])/);
      if (weekMatch) {
        const targetDay = WEEKDAYS[weekMatch[1]];
        const cur = d.getDay();
        let diff = targetDay - cur;
        if (diff <= 0) diff += 7;
        const target = new Date(year, month, day + diff);
        year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
        hasDate = true;
      }
    }

    // 上周X / 上个星期X
    const lastWeekMatch = s.match(/上(?:个)?(?:周|星期)([一二三四五六日天])/);
    if (lastWeekMatch) {
      const targetDay = WEEKDAYS[lastWeekMatch[1]];
      const cur = d.getDay();
      let diff = targetDay - cur - 7;
      const target = new Date(year, month, day + diff);
      year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
      hasDate = true;
    }

    // X月X日 / X月X号 (支持中文数字)
    const mdMatch = s.match(/(\d{1,2}|[一二三四五六七八九十]+)\s*月\s*(\d{1,2}|[一二三四五六七八九十]+)\s*[日号]/);
    if (mdMatch) {
      const m = parseCNNumber(mdMatch[1]);
      const d2 = parseCNNumber(mdMatch[2]);
      if (m && d2) {
        month = m - 1;
        day = d2;
        hasDate = true;
        if (new Date(year, month, day) < new Date(d.getFullYear(), d.getMonth(), d.getDate())) {
          year++;
        }
      }
    }

    // X天后 / X天以后
    const laterMatch = s.match(/(\d+|[一二三四五六七八九十]+)\s*天(?:后|以后|之后)/);
    if (laterMatch) {
      const days = parseCNNumber(laterMatch[1]);
      if (days) {
        const target = new Date(year, month, day + days);
        year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
        hasDate = true;
      }
    }

    // X天前 / X天以前
    const agoMatch = s.match(/(\d+|[一二三四五六七八九十]+)\s*天(?:前|以前|之前)/);
    if (agoMatch) {
      const days = parseCNNumber(agoMatch[1]);
      if (days) {
        const target = new Date(year, month, day - days);
        year = target.getFullYear(); month = target.getMonth(); day = target.getDate();
        hasDate = true;
      }
    }

    // 下个月X号
    const nextMonthMatch = s.match(/下个?月\s*(\d{1,2}|[一二三四五六七八九十]+)\s*[日号]?/);
    if (nextMonthMatch) {
      const d2 = parseCNNumber(nextMonthMatch[1]);
      if (d2) {
        month += 1;
        day = d2;
        hasDate = true;
        if (month > 11) { month -= 12; year++; }
      }
    }

    // 月底
    if (s.includes('月底')) {
      day = new Date(year, month + 1, 0).getDate();
      hasDate = true;
    }

    // 年底
    if (s.includes('年底')) {
      month = 11;
      day = 31;
      hasDate = true;
    }

    // ========== 时间解析 ==========

    // 下午3点 / 上午10:30 / 早上8点半 / 晚上7点一刻 / 4点15分 / 四点五十五分
    const timeMatch = s.match(/(凌晨|早上|上午|中午|下午|晚上|傍晚|晚)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*(?:[:：]\s*(\d{1,2}|[一二两三四五六七八九十]+)|[点时]\s*(半|一刻|三刻|([一二两三四五六七八九十]+|\d{1,2})分?)?)\s*(整|正)?/);
    if (timeMatch) {
      hour = parseCNNumber(timeMatch[2]);
      let minuteRaw = timeMatch[3] || timeMatch[4];
      if (minuteRaw && minuteRaw.endsWith('分')) minuteRaw = minuteRaw.slice(0, -1);
      if (minuteRaw === '半') {
        minute = 30;
      } else if (minuteRaw === '一刻') {
        minute = 15;
      } else if (minuteRaw === '三刻') {
        minute = 45;
      } else if (minuteRaw) {
        minute = parseCNNumber(minuteRaw) || 0;
      }
      const period = timeMatch[1];

      if (period === '下午' || period === '晚上' || period === '傍晚' || period === '晚') {
        if (hour < 12) hour += 12;
      } else if (period === '上午' || period === '早上') {
        if (hour === 12) hour = 0;
      } else if (period === '中午') {
        if (hour < 12) hour = 12;
      } else if (period === '凌晨') {
        // 保持原样
      } else if (!period && hour >= 1 && hour <= 11) {
        hour += 12; // 默认下午
      }
      hasTime = true;
    }

    // HH:MM 格式
    if (!hasTime) {
      const hhmmMatch = s.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
      if (hhmmMatch) {
        hour = parseInt(hhmmMatch[1]);
        minute = parseInt(hhmmMatch[2]);
        hasTime = true;
      }
    }

    // 只有"X点"没有分钟
    if (!hasTime) {
      const hourOnlyMatch = s.match(/(?:凌晨|早上|上午|中午|下午|晚上|傍晚|晚)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点/);
      if (hourOnlyMatch) {
        hour = parseCNNumber(hourOnlyMatch[1]);
        minute = 0;
        const period = hourOnlyMatch[0].match(/凌晨|早上|上午|中午|下午|晚上|傍晚|晚/)?.[0];
        if (period === '下午' || period === '晚上' || period === '傍晚' || period === '晚') {
          if (hour < 12) hour += 12;
        } else if (period === '上午' || period === '早上') {
          if (hour === 12) hour = 0;
        } else if (period === '中午') {
          hour = 12;
        } else if (!period && hour >= 1 && hour <= 11) {
          hour += 12;
        }
        hasTime = true;
      }
    }

    if (!hasDate && !hasTime) return null;

    const result = new Date(year, month, day, hour || 0, minute, 0);
    if (isNaN(result.getTime())) return null;

    return {
      date: result,
      hasTime,
      hasDate,
      text: formatDate(result, hasTime)
    };
  }

  function formatDate(d, hasTime) {
    const today = now();
    const diff = Math.floor((d - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    let dateStr = '';
    if (diff === 0) dateStr = '今天';
    else if (diff === 1) dateStr = '明天';
    else if (diff === 2) dateStr = '后天';
    else if (diff === 3) dateStr = '大后天';
    else if (diff === -1) dateStr = '昨天';
    else if (diff === -2) dateStr = '前天';
    else {
      const m = d.getMonth() + 1;
      const day = d.getDate();
      dateStr = `${m}月${day}日`;
      if (d.getFullYear() !== today.getFullYear()) dateStr = `${d.getFullYear()}年${dateStr}`;
    }

    if (hasTime) {
      const h = d.getHours();
      const m = d.getMinutes();
      const period = h < 6 ? '凌晨' : h < 12 ? '上午' : h < 18 ? '下午' : '晚上';
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      dateStr += ` ${period}${displayH}:${String(m).padStart(2, '0')}`;
    }
    return dateStr;
  }

  // 提取时间文本（用于从描述中移除）
  function extractTimeText(str) {
    const patterns = [
      /大大后天|大后天|后天|明天|今天|昨天|前天|大前天/g,
      /下下(?:个)?(?:周|星期)[一二三四五六日天]/g,
      /下(?:个)?(?:周|星期)[一二三四五六日天]/g,
      /(?:这|本)(?:个)?(?:周|星期)[一二三四五六日天]/g,
      /(?<!下|这|本|上)(?:周|星期)[一二三四五六日天]/g,
      /上(?:个)?(?:周|星期)[一二三四五六日天]/g,
      /(\d{1,2}|[一二三四五六七八九十]+)\s*月\s*(\d{1,2}|[一二三四五六七八九十]+)\s*[日号]/g,
      /(\d+|[一二三四五六七八九十]+)\s*天(?:后|以后|之后|前|以前|之前)/g,
      /下个?月\s*(\d{1,2}|[一二三四五六七八九十]+)\s*[日号]?/g,
      /月底|年底/g,
      /(凌晨|早上|上午|中午|下午|晚上|傍晚|晚)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*(?:[:：]\s*(\d{1,2}|[一二两三四五六七八九十]+)|[点时]\s*(半|一刻|三刻|([一二两三四五六七八九十]+|\d{1,2})分?)?)\s*(整|正)?/g,
      /(\d{1,2})\s*[:：]\s*(\d{2})/g,
      /(凌晨|早上|上午|中午|下午|晚上|傍晚|晚)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点/g,
    ];

    let result = str;
    for (const p of patterns) {
      result = result.replace(p, '');
    }
    return result.trim();
  }

  return { parse, formatDate, extractTimeText };
})();
