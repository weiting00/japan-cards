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

  function getCycleLabel(plan, part) {
    var cycle = (part && part.cycle) || (plan && plan.cycle) || 'none';
    if (cycle === 'month') return '每月；自動重置';
    if (cycle === 'quarter') return '每季日曆季；自動重置';
    if (cycle === 'campaign') return '活動期間內計算';
    if (cycle === 'billing') {
      var day = Number(plan && plan.statementDay) || 0;
      return day >= 1 && day <= 31
        ? '帳單週期；每月 ' + day + ' 日結帳，次日自動重置'
        : '帳單週期；結帳日待確認，手動重置';
    }
    return '無自動週期；手動重置';
  }

  function formatDateParts(parts) {
    return parts.year + '-' + pad2(parts.month) + '-' + pad2(parts.day);
  }

  /**
   * 下次重置日（純日曆計算）。回傳 {year, month, day} 或 null（手動／待確認）。
   */
  function getNextResetDate(plan, part, dateParts) {
    if (!dateParts || !dateParts.year || !dateParts.month || !dateParts.day) return null;
    var year = Number(dateParts.year);
    var month = Number(dateParts.month);
    var day = Number(dateParts.day);
    if (!year || !month || !day) return null;
    var cycle = (part && part.cycle) || (plan && plan.cycle) || 'none';

    if (cycle === 'month') {
      var nextMonth = month + 1;
      var nextYear = year;
      if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
      return { year: nextYear, month: nextMonth, day: 1 };
    }

    if (cycle === 'quarter') {
      var nextQuarterMonth = Math.floor((month - 1) / 3) * 3 + 4;
      var quarterYear = year;
      if (nextQuarterMonth > 12) { nextQuarterMonth -= 12; quarterYear += 1; }
      return { year: quarterYear, month: nextQuarterMonth, day: 1 };
    }

    if (cycle === 'billing') {
      var statementDay = Number(plan && plan.statementDay) || 0;
      if (statementDay < 1 || statementDay > 31) return null;
      var daysThisMonth = daysInMonth(year, month);
      var closeYear = year;
      var closeMonth = month;
      if (day > Math.min(statementDay, daysThisMonth)) {
        closeMonth += 1;
        if (closeMonth > 12) { closeMonth = 1; closeYear += 1; }
      }
      var daysCloseMonth = daysInMonth(closeYear, closeMonth);
      var closeDay = Math.min(statementDay, daysCloseMonth);
      var nextDay = closeDay + 1;
      if (nextDay > daysCloseMonth) {
        nextDay = 1;
        closeMonth += 1;
        if (closeMonth > 12) { closeMonth = 1; closeYear += 1; }
      }
      return { year: closeYear, month: closeMonth, day: nextDay };
    }

    return null;
  }

  function getNextResetLabel(plan, part, dateParts) {
    var cycle = (part && part.cycle) || (plan && plan.cycle) || 'none';
    if (cycle === 'campaign') return '活動結束後重置';
    if (cycle === 'none') return '手動重置';
    var next = getNextResetDate(plan, part, dateParts);
    if (next) return formatDateParts(next);
    return cycle === 'billing' ? '待確認' : '手動重置';
  }

  /**
   * 額度狀態（純函式）：列出所有需要追蹤上限的加碼項目。
   * 共用 quotaGroup 只回傳一筆，used 合併、remaining 由 cap - used 計算。
   *
   * @param {{cards: object[], dateParts: {year:number, month:number, day:number}}} input
   * @returns {Array<object>}
   */
  function getQuotaState(input) {
    input = input || {};
    var cards = Array.isArray(input.cards) ? input.cards : [];
    var dateParts = input.dateParts || {};
    var entries = [];

    cards.forEach(function (card) {
      card = card || {};
      (card.plans || []).forEach(function (plan) {
        if (plan.enabled === false) return;
        var seen = new Set();
        (plan.rewardParts || []).forEach(function (part) {
          var groupId = part.quotaGroupId || null;
          var displayKey = groupId || part.id;
          if (seen.has(displayKey)) return;
          seen.add(displayKey);

          var members = groupId
            ? (plan.rewardParts || []).filter(function (entry) { return entry.quotaGroupId === groupId; })
            : [part];
          var rawCap = members[0] ? members[0].capAmount : undefined;
          var cap = Number(rawCap !== undefined && rawCap !== null ? rawCap : plan.capAmount) || 0;
          if (cap <= 0) return;
          var used = Math.min(cap, members.reduce(function (sum, entry) {
            return sum + Math.max(0, Number(entry.usedReward) || 0);
          }, 0));
          var remaining = Math.max(0, cap - used);
          var threshold = Math.max(0, Number(part.thresholdTwd !== undefined ? part.thresholdTwd : plan.thresholdTwd) || 0);
          var rate = Math.max(0, Number(part.rate) || 0);
          var cycle = part.cycle || plan.cycle || 'none';

          entries.push({
            card: card,
            plan: plan,
            part: part,
            groupId: groupId,
            displayKey: displayKey,
            members: members,
            cap: cap,
            used: used,
            remaining: remaining,
            threshold: threshold,
            rate: rate,
            cycle: cycle,
            cycleLabel: getCycleLabel(plan, part),
            nextResetDate: getNextResetDate(plan, part, dateParts),
            nextResetLabel: getNextResetLabel(plan, part, dateParts)
          });
        });
      });
    });

    return entries;
  }

  function offerNetRate(offer) {
    var baseRate = offer.includeBase ? Math.max(0, Number(offer.card.baseRate) || 0) : 0;
    var feeRate = offer.feeApplies ? 1.5 : 0;
    var bonusRate = (offer.matchedParts || []).reduce(function (max, part) {
      return Math.max(max, Number(part.rate) || 0);
    }, 0);
    return baseRate + bonusRate - feeRate;
  }

  function offerThreshold(offer) {
    var values = (offer.plan.rewardParts || []).map(function (part) {
      var raw = Number(part.thresholdTwd !== undefined ? part.thresholdTwd : offer.plan.thresholdTwd) || 0;
      return (part.thresholdType || offer.plan.thresholdType) === 'cumulative'
        ? Math.max(0, raw - (Number(part.cumulativeSpendTwd) || 0))
        : raw;
    }).filter(function (value) { return value > 0; });
    return values.length ? Math.min.apply(null, values) : 0;
  }

  function offerKey(offer) {
    return offer.card.id + '::' + offer.plan.id;
  }

  /**
   * 拆刷配置（純函式）：只回傳每個方案被分配的金額，不重新評估回饋。
   * UI 再以 evaluatePlan 重新試算每段，並處理剩餘金額 fallback。
   *
   * @param {{offers: object[], spendTwd: number}} input
   * @returns {{
   *   candidates: object[],
   *   allocations: Array<{offer: object, amount: number}>,
   *   left: number
   * }}
   */
  function allocateSplit(input) {
    input = input || {};
    var offers = Array.isArray(input.offers) ? input.offers : [];
    var spendTwd = Math.max(0, Number(input.spendTwd) || 0);
    var splitCandidates = offers.slice().sort(function (a, b) {
      return offerNetRate(b) - offerNetRate(a) || b.net - a.net;
    });
    var segments = [];

    splitCandidates.forEach(function (candidate) {
      var baseRate = candidate.includeBase ? Math.max(0, Number(candidate.card.baseRate) || 0) : 0;
      var feeRate = candidate.feeApplies ? 1.5 : 0;
      var threshold = offerThreshold(candidate);
      var quotaGroups = new Map();

      (candidate.matchedParts || []).forEach(function (part) {
        var rate = Math.max(0, Number(part.rate) || 0);
        if (rate <= 0) return;
        var capacity = Number.isFinite(part.remainingBefore) ? part.remainingBefore / (rate / 100) : Infinity;
        if (capacity <= 0) return;
        if (threshold > 0 && Number.isFinite(capacity) && capacity < threshold) return;
        if (part.quotaGroupId) {
          var group = quotaGroups.get(part.quotaGroupId) || { rate: 0, capacity: 0 };
          group.rate = Math.max(group.rate, rate);
          group.capacity = Number.isFinite(capacity) ? Math.max(group.capacity, capacity) : Infinity;
          quotaGroups.set(part.quotaGroupId, group);
        } else {
          segments.push({ offer: candidate, kind: 'bonus', capacity: capacity, rate: baseRate + rate - feeRate, threshold: threshold });
        }
      });

      quotaGroups.forEach(function (group) {
        segments.push({ offer: candidate, kind: 'bonus', capacity: group.capacity, rate: baseRate + group.rate - feeRate, threshold: threshold });
      });
      if (baseRate > 0 || feeRate > 0) {
        segments.push({ offer: candidate, kind: 'base', capacity: Infinity, rate: baseRate - feeRate, threshold: threshold });
      }
    });

    segments.sort(function (a, b) {
      return b.rate - a.rate || (a.kind === 'bonus' ? 0 : 1) - (b.kind === 'bonus' ? 0 : 1);
    });

    var left = spendTwd;
    var bucket = new Map();
    segments.forEach(function (segment) {
      if (left <= 0) return;
      var capacity = segment.capacity;
      if (!Number.isFinite(capacity)) capacity = left;
      capacity = Math.max(0, Math.floor(capacity));
      if (capacity <= 0) return;
      if (segment.kind === 'bonus' && segment.threshold > 0 && left < segment.threshold) return;
      var amount = Math.min(left, capacity);
      if (amount <= 0) return;
      var key = offerKey(segment.offer);
      var entry = bucket.get(key) || { offer: segment.offer, amount: 0 };
      entry.amount += amount;
      bucket.set(key, entry);
      left -= amount;
    });

    return {
      candidates: splitCandidates,
      allocations: Array.from(bucket.values()),
      left: left
    };
  }

  /**
   * 依情境、店家與金額評估所有卡片方案，回傳排序後候選。
   * 不修改 cards / plans；週期重置以 partChanges 回傳，由 UI 層套用。
   *
   * @param {{
   *   cards: object[],
   *   contexts: string[]|Set<string>,
   *   merchant?: string,
   *   spendTwd: number,
   *   today?: string,
   *   dateParts: {year:number, month:number, day:number},
   *   preferredCardId?: string,
   *   merchantIncludesGeneral?: boolean
   * }} input
   * @returns {{
   *   offers: object[],
   *   storeOffers: object[],
   *   storeBest: object|null,
   *   preferredApplied: boolean,
   *   preferredCardId: string,
   *   partChanges: Array<{cardId:string, planId:string, change:object}>,
   *   periodReset: boolean
   * }}
   */
  function rankOffers(input) {
    input = input || {};
    var cards = Array.isArray(input.cards) ? input.cards : [];
    var selectedContexts = Array.isArray(input.contexts)
      ? input.contexts.slice()
      : (input.contexts && typeof input.contexts[Symbol.iterator] === 'function'
        ? Array.from(input.contexts)
        : (input.contexts ? [String(input.contexts)] : ['general']));
    var merchant = input.merchant || '';
    var spendTwd = Math.max(0, Number(input.spendTwd) || 0);
    var dateParts = input.dateParts || {};
    var today = input.today || '';
    if (!today && dateParts.year && dateParts.month && dateParts.day) {
      today = dateParts.year + '-' + pad2(dateParts.month) + '-' + pad2(dateParts.day);
    }
    var merchantIncludesGeneral = input.merchantIncludesGeneral !== false;
    var offers = [];
    var partChanges = [];
    var periodReset = false;

    cards.forEach(function (card) {
      card = card || {};
      var plans = (card.plans || []).filter(function (plan) {
        return plan.enabled !== false && planMatchesContexts(plan.contexts || [], selectedContexts, {
          merchantIncludesGeneral: merchantIncludesGeneral
        });
      });
      var evaluatedPlanCount = 0;

      plans.forEach(function (plan) {
        var hasNonMerchantQual = (plan.contexts || []).some(function (context) {
          return context !== 'merchant' && selectedContexts.indexOf(context) >= 0;
        });
        var enforceMerchantPre = selectedContexts.indexOf('merchant') >= 0
          && (plan.contexts || []).indexOf('merchant') >= 0
          && !hasNonMerchantQual;
        if (enforceMerchantPre && merchant && !merchantTextMatches(plan, merchant)) return;

        evaluatedPlanCount += 1;
        var result = evaluatePlan({
          card: card,
          plan: plan,
          spendTwd: spendTwd,
          merchant: merchant,
          contexts: selectedContexts,
          today: today,
          dateParts: dateParts
        });
        (result.partChanges || []).forEach(function (change) {
          partChanges.push({ cardId: card.id, planId: plan.id, change: change });
        });
        if (result.periodReset) periodReset = true;
        if (result.offer.net > 0 || result.offer.base > 0 || result.offer.matchedParts.length) {
          offers.push(result.offer);
        }
      });

      // 特店方案全部因店家未命中而被跳過時，仍要用該卡基本回饋參與比較。
      if (!evaluatedPlanCount && Number(card.baseRate) > 0
        && !(selectedContexts.length === 1 && selectedContexts.indexOf('paypay') >= 0)) {
        var fallbackCtx = selectedContexts.indexOf('general') >= 0
          ? 'general'
          : (selectedContexts.find(function (context) { return context !== 'paypay'; }) || 'general');
        var basePlan = {
          id: 'base-' + card.id,
          legacyKey: null,
          name: '基本回饋',
          contexts: [fallbackCtx],
          includeBaseReward: true,
          foreignFeeApplies: card.baseFeeApplies,
          rewardParts: [],
          enabled: true
        };
        var baseResult = evaluatePlan({
          card: card,
          plan: basePlan,
          spendTwd: spendTwd,
          merchant: merchant,
          contexts: selectedContexts,
          today: today,
          dateParts: dateParts
        });
        (baseResult.partChanges || []).forEach(function (change) {
          partChanges.push({ cardId: card.id, planId: basePlan.id, change: change });
        });
        if (baseResult.periodReset) periodReset = true;
        offers.push(baseResult.offer);
      }
    });

    offers.sort(function (a, b) { return b.net - a.net; });
    var storeOffers = offers.slice();
    var storeBest = storeOffers[0] || null;
    var preferredCardId = input.preferredCardId || '';
    var preferredApplied = false;

    if (preferredCardId) {
      var preferredOffer = offers.find(function (offer) { return offer.card.id === preferredCardId; });
      if (preferredOffer) {
        offers = [preferredOffer].concat(offers.filter(function (offer) { return offer !== preferredOffer; }));
        preferredApplied = true;
      } else {
        preferredCardId = '';
      }
    }

    return {
      offers: offers,
      storeOffers: storeOffers,
      storeBest: storeBest,
      preferredApplied: preferredApplied,
      preferredCardId: preferredCardId,
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
    evaluatePlan: evaluatePlan,
    rankOffers: rankOffers,
    allocateSplit: allocateSplit,
    getCycleLabel: getCycleLabel,
    getNextResetDate: getNextResetDate,
    getNextResetLabel: getNextResetLabel,
    getQuotaState: getQuotaState
  };

  global.RuleEngine = Object.assign(global.RuleEngine || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
