/*
 * Rule Engine — Stage 2 純函式核心（逐步抽出）
 *
 * 原則：
 * - 這裡只做「資料 → 資料」的計算，不讀 DOM、不寫 localStorage、不改傳入物件。
 * - UI/持久化層（index.html）負責取得日期、套用回傳的狀態變化。
 * - 每次只搬一個純函式，並用 tests/engine.html 鎖住行為，避免一次大改。
 */
(function (global) {
  'use strict';

  var VERSION = '2.3.0';
  var pad2 = function (n) { return String(n).padStart(2, '0'); };

  // 純日曆計算：不建立 Date、不讀目前時間。
  function daysInMonth(year, month) {
    if (month === 2) {
      var leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return leap ? 29 : 28;
    }
    return [4, 6, 9, 11].indexOf(month) >= 0 ? 30 : 31;
  }

  /**
   * 取得回饋項目的週期 key（純函式）。
   * @param {object} plan  方案（可能有 cycle / statementDay）
   * @param {object} part  回饋項目（可能有 cycle / start / end）
   * @param {{year:number, month:number, day:number}} dateParts 台北日期
   * @returns {string|null}
   */
  function getPeriodKey(plan, part, dateParts) {
    plan = plan || {};
    part = part || {};
    if (!dateParts) return null;
    var year = Number(dateParts.year);
    var month = Number(dateParts.month);
    var day = Number(dateParts.day);
    if (!year || !month || !day) return null;

    var cycle = part.cycle || plan.cycle || 'none';
    if (cycle === 'month') return year + '-' + pad2(month);
    if (cycle === 'quarter') return year + '-Q' + (Math.floor((month - 1) / 3) + 1);
    if (cycle === 'campaign') return 'campaign:' + (part.start || '') + ':' + (part.end || '');

    var statementDay = Number(plan.statementDay);
    if (cycle === 'billing' && statementDay >= 1 && statementDay <= 31) {
      var closeYear = year;
      var closeMonth = month;
      var daysThisMonth = daysInMonth(year, month);
      if (day > Math.min(statementDay, daysThisMonth)) {
        closeMonth += 1;
        if (closeMonth > 12) { closeMonth = 1; closeYear += 1; }
      }
      var closeDays = daysInMonth(closeYear, closeMonth);
      return 'billing:' + closeYear + '-' + pad2(closeMonth) + '-' + pad2(Math.min(statementDay, closeDays));
    }
    return null;
  }

  /**
   * 方案是否符合已選情境（純函式）。
   * 決策頁情境為 OR 匹配；merchant 相容一般消費方案（舊行為）。
   * @param {string[]} planContexts
   * @param {string[]|Set<string>} selectedContexts
   * @param {{merchantIncludesGeneral?: boolean}} [options]
   */
  function planMatchesContexts(planContexts, selectedContexts, options) {
    var selected = Array.isArray(selectedContexts)
      ? selectedContexts
      : (selectedContexts && typeof selectedContexts[Symbol.iterator] === 'function'
        ? Array.from(selectedContexts)
        : (selectedContexts || []));
    var contexts = planContexts || [];
    var merchantIncludesGeneral = !!(options && options.merchantIncludesGeneral);
    return contexts.some(function (context) {
      if (selected.indexOf(context) >= 0) return true;
      return merchantIncludesGeneral && selected.indexOf('merchant') >= 0 && context === 'general';
    });
  }

  /**
   * 解析使用者自行填寫的店家/通路文字（純函式）。
   * 支援逗號、頓號、分號、換行；去重並保留輸入順序。
   */
  function parseMerchantText(text) {
    var seen = new Set();
    return String(text || '')
      .split(/[\n,，、;；]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      });
  }

  /**
   * 取方案的特約店家原文（純函式）。
   * 新資料以 merchantText 為單一真相；舊資料才回退到 merchants 陣列。
   */
  function getMerchantText(plan) {
    plan = plan || {};
    if (typeof plan.merchantText === 'string' && plan.merchantText.trim()) return plan.merchantText;
    return Array.isArray(plan.merchants) ? plan.merchants.join('、') : '';
  }

  /**
   * 特約店家文字比對（純函式）。
   * 不拆店名、不建立商店索引；只要使用者搜尋字串出現在原文，或原文出現在明細字串中就算命中。
   */
  function merchantTextMatches(plan, query) {
    var text = getMerchantText(plan).trim().toLocaleLowerCase('zh-TW');
    var needle = String(query || '').trim().toLocaleLowerCase('zh-TW');
    if (!needle) return true;
    if (!text) return true;
    if (text.indexOf(needle) >= 0) return true;
    return needle.length >= 2 && text.length >= 2 && needle.indexOf(text) >= 0;
  }

  /**
   * 評估單一方案（純函式）。
   * 不修改 card / plan / rewardParts；週期重置以 partChanges 回傳，由 UI 層套用。
   *
   * @param {{
   *   card: object,
   *   plan: object,
   *   spendTwd: number,
   *   merchant?: string,
   *   contexts?: string[],
   *   today?: string,
   *   dateParts: {year:number, month:number, day:number}
   * }} input
   * @returns {{
   *   offer: object,
   *   partChanges: Array<object>,
   *   periodReset: boolean
   * }}
   */
  function evaluatePlan(input) {
    input = input || {};
    var card = input.card || {};
    var plan = input.plan || {};
    var spendTwd = Math.max(0, Number(input.spendTwd) || 0);
    var merchant = input.merchant || '';
    var evalArr = Array.isArray(input.contexts)
      ? input.contexts
      : (input.contexts ? [String(input.contexts)] : ['general']);
    var dateParts = input.dateParts || {};
    var today = input.today || '';
    if (!today && dateParts.year && dateParts.month && dateParts.day) {
      today = dateParts.year + '-' + pad2(dateParts.month) + '-' + pad2(dateParts.day);
    }

    var matchedParts = [];
    var cumulativePartIds = [];
    var notes = [];
    var quotaGroups = new Map();
    var partChanges = [];
    var periodReset = false;

    // 先建立 snapshot：週期 key 的更新只寫進 snapshot，不碰原始資料。
    var parts = (plan.rewardParts || []).map(function (part) {
      var next = Object.assign({}, part);
      var periodKey = getPeriodKey(plan, part, dateParts);
      var change = { partId: part.id };

      if (periodKey) {
        if (part.periodKey && part.periodKey !== periodKey) {
          next.usedReward = 0;
          periodReset = true;
          change.usedReward = 0;
        }
        next.periodKey = periodKey;
        change.periodKey = periodKey;
      } else if ((part.cycle || plan.cycle) === 'billing' && !plan.statementDay) {
        notes.push('尚未設定結帳日，請自行確認並手動重置額度');
      }

      if (periodKey) {
        if (part.cumulativePeriodKey && part.cumulativePeriodKey !== periodKey) {
          next.cumulativeSpendTwd = 0;
          change.cumulativeSpendTwd = 0;
        }
        next.cumulativePeriodKey = periodKey;
        change.cumulativePeriodKey = periodKey;
      }

      if (change.periodKey || change.usedReward !== undefined || change.cumulativeSpendTwd !== undefined) {
        partChanges.push(change);
      }
      return next;
    });

    // 通用：若方案同時符合其他已選情境（如 特約商店+交通卡共用），不因特約商店店家未命中而擋掉整體資格
    var hasNonMerchantQual = (plan.contexts || []).some(function (context) {
      return context !== 'merchant' && evalArr.indexOf(context) >= 0;
    });
    var enforceMerchantList = evalArr.indexOf('merchant') >= 0
      && (plan.contexts || []).indexOf('merchant') >= 0
      && !hasNonMerchantQual;

    parts.forEach(function (part) {
      if (part.start && today < part.start || part.end && today > part.end) return;
      if (enforceMerchantList && merchant && !merchantTextMatches(plan, merchant)) return;

      var partThreshold = part.thresholdTwd !== undefined
        ? Math.max(0, Number(part.thresholdTwd) || 0)
        : Math.max(0, Number(plan.thresholdTwd) || 0);
      var thresholdType = part.thresholdType || plan.thresholdType || 'single';
      if (thresholdType === 'cumulative') cumulativePartIds.push(part.id);
      var thresholdSpend = thresholdType === 'cumulative'
        ? (Number(part.cumulativeSpendTwd) || 0) + spendTwd
        : spendTwd;
      if (partThreshold > 0 && thresholdSpend < partThreshold) {
        notes.push((thresholdType === 'cumulative' ? '週期累積' : '單筆') + '未達 NT$' + partThreshold.toLocaleString() + '，此加碼不計');
        return;
      }

      var cap = Number(part.capAmount !== undefined && part.capAmount !== null ? part.capAmount : plan.capAmount) || 0;
      var groupId = part.quotaGroupId || null;
      var groupParts = groupId
        ? parts.filter(function (item) { return item.quotaGroupId === groupId; })
        : [];
      var groupCap = groupParts.length ? Number(groupParts[0].capAmount) || cap : cap;
      var used = groupId
        ? groupParts.reduce(function (sum, item) { return sum + Math.max(0, Number(item.usedReward) || 0); }, 0)
        : Math.max(0, Number(part.usedReward) || 0);
      var remaining = cap > 0
        ? (groupId && quotaGroups.has(groupId) ? quotaGroups.get(groupId) : Math.max(0, groupCap - used))
        : Infinity;
      if (remaining <= 0) {
        notes.push((part.name || '加碼') + '額度已用完');
        return;
      }

      var reward = Math.min(spendTwd * Math.max(0, Number(part.rate) || 0) / 100, remaining);
      if (groupId && Number.isFinite(remaining)) {
        quotaGroups.set(groupId, Math.max(0, remaining - reward));
      }
      if (reward > 0) {
        matchedParts.push({
          partId: part.id,
          name: part.name || '加碼回饋',
          rate: Number(part.rate) || 0,
          reward: reward,
          cap: groupCap,
          remainingBefore: remaining,
          quotaGroupId: groupId
        });
      }
    });

    var includeBase = plan.includeBaseReward !== false;
    var bonusEligibleSpend = matchedParts.reduce(function (sum, part) {
      return sum + (part.rate > 0 ? part.reward / (part.rate / 100) : 0);
    }, 0);
    var fallbackSpend = Math.max(0, spendTwd - Math.min(spendTwd, bonusEligibleSpend));
    var planBaseRate = (plan.baseRateOverride !== undefined && plan.baseRateOverride !== null)
      ? Math.max(0, Number(plan.baseRateOverride) || 0)
      : Math.max(0, Number(card.baseRate) || 0);
    var base = includeBase
      ? spendTwd * planBaseRate / 100
      : (plan.fallbackBase ? fallbackSpend * planBaseRate / 100 : 0);
    var feeApplies = plan.foreignFeeApplies !== undefined ? plan.foreignFeeApplies : card.baseFeeApplies;
    var fee = feeApplies ? spendTwd * 0.015 : 0;
    var bonus = matchedParts.reduce(function (sum, part) { return sum + part.reward; }, 0);
    var net = base + bonus - fee;

    var groupSpendCapacity = new Map();
    var incrementalCapSpend = 0;
    matchedParts.forEach(function (part) {
      if (!Number.isFinite(part.remainingBefore) || part.rate <= 0) {
        incrementalCapSpend = Infinity;
        return;
      }
      var capacity = part.remainingBefore / (part.rate / 100);
      if (part.quotaGroupId) {
        var members = parts.filter(function (item) { return item.quotaGroupId === part.quotaGroupId; });
        var groupCap = Number(members[0] && members[0].capAmount) || 0;
        var used = members.reduce(function (sum, item) { return sum + Number(item.usedReward || 0); }, 0);
        var topRate = Math.max.apply(null, members.map(function (item) { return Number(item.rate) || 0; }));
        groupSpendCapacity.set(part.quotaGroupId, topRate > 0 ? Math.max(0, groupCap - used) / (topRate / 100) : capacity);
      } else {
        incrementalCapSpend += capacity;
      }
    });
    if (incrementalCapSpend !== Infinity) {
      groupSpendCapacity.forEach(function (capacity) { incrementalCapSpend += capacity; });
    }
    var capSpend = incrementalCapSpend === Infinity ? Infinity : incrementalCapSpend;

    return {
      offer: {
        card: card,
        plan: plan,
        spendTwd: spendTwd,
        base: base,
        bonus: bonus,
        fee: fee,
        net: net,
        matchedParts: matchedParts,
        cumulativePartIds: cumulativePartIds,
        notes: notes,
        capSpend: capSpend,
        includeBase: includeBase,
        feeApplies: feeApplies
      },
      partChanges: partChanges,
      periodReset: periodReset
    };
  }

  var api = {
    version: VERSION,
    getPeriodKey: getPeriodKey,
    planMatchesContexts: planMatchesContexts,
    parseMerchantText: parseMerchantText,
    getMerchantText: getMerchantText,
    merchantTextMatches: merchantTextMatches,
    evaluatePlan: evaluatePlan
  };

  global.RuleEngine = Object.assign(global.RuleEngine || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
