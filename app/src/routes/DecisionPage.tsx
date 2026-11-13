import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { DataStatus } from '@/features/app-data/DataStatus';
import { getTaipeiDateParts, formatTaipeiDate } from '@/lib/date';
import {
  buildMerchantNote,
  calculateDecision,
  findThresholdOpportunity,
  merchantTextFor,
  offerRatePercent,
} from '@/features/decision/calculate';
import { createLedgerRecords } from '@/features/decision/record';
import { engine } from '@/lib/engine';
import { cn } from '@/lib/utils';
import type { EngineOffer } from '@/types/decision';

const SCENARIOS = [
  { value: 'general', label: '實體店面消費', hint: '一般刷卡' },
  { value: 'merchant', label: '特約商店', hint: '指定店家' },
  { value: 'paypay', label: 'PayPay', hint: '掃碼支付' },
  { value: 'transit', label: '交通卡', hint: 'Suica 儲值' },
] as const;

function displayPlanName(cardName: string, planName: string): string {
  const card = String(cardName || '').trim();
  let name = String(planName || '').trim();
  if (card && name.startsWith(card)) name = name.slice(card.length).trim();
  name = name.replace(/^[（(]\s*([\s\S]*?)\s*[）)]\s*$/, '$1').trim();
  return name || String(planName || '');
}

function formatTwd(value: number): string {
  return `NT$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function groupByCard(offers: EngineOffer[]) {
  const groups = new Map<string, { card: EngineOffer['card']; best: EngineOffer; count: number }>();
  for (const offer of offers) {
    const key = offer.card.id || offer.card.name;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { card: offer.card, best: offer, count: 1 });
    } else {
      current.count += 1;
      if (offer.net > current.best.net) current.best = offer;
    }
  }
  return [...groups.values()].sort(
    (left, right) =>
      right.best.net - left.best.net ||
      String(left.card.name).localeCompare(String(right.card.name), 'zh-Hant'),
  );
}

export function DecisionPage() {
  const { rulesV3, rate, updateLedger, updateRulesV3 } = useAppData();
  const navigate = useNavigate();

  const [context, setContext] = useState<string>('general');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [memo, setMemo] = useState('');
  const [splitMode, setSplitMode] = useState<'auto' | 'single'>('auto');
  const [preferredCardId, setPreferredCardId] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState('');
  const [toast, setToast] = useState('');
  const [dismissedThreshold, setDismissedThreshold] = useState<number | null>(null);

  const jpy = Number(amount) || 0;
  const isMerchant = context === 'merchant';

  const decision = useMemo(() => {
    const now = new Date();
    return calculateDecision({
      rulesV3,
      contexts: [context],
      amountJpy: jpy,
      rate: rate.value,
      merchant,
      splitMode,
      preferredCardId,
      dateParts: getTaipeiDateParts(now),
      today: formatTaipeiDate(now),
    });
  }, [context, jpy, merchant, preferredCardId, rate.value, rulesV3, splitMode]);

  const threshold = useMemo(() => {
    if (jpy <= 0) return null;
    const now = new Date();
    return findThresholdOpportunity({
      rulesV3,
      amountJpy: jpy,
      rate: rate.value,
      contexts: [context],
      merchant,
      dateParts: getTaipeiDateParts(now),
      today: formatTaipeiDate(now),
    });
  }, [context, jpy, merchant, rate.value, rulesV3]);

  const lookupDecision = useMemo(() => {
    if (!lookupOpen) return decision;
    const query = lookupQuery.trim();
    if (!query) return decision;
    const now = new Date();
    return calculateDecision({
      rulesV3,
      contexts: ['merchant'],
      amountJpy: jpy,
      rate: rate.value,
      merchant: query,
      splitMode: 'single',
      preferredCardId: '',
      dateParts: getTaipeiDateParts(now),
      today: formatTaipeiDate(now),
    });
  }, [decision, jpy, lookupOpen, lookupQuery, rate.value, rulesV3]);

  const activeOffer = decision.allocations[0]?.offer || null;
  const merchantNote = isMerchant
    ? buildMerchantNote({
        merchant,
        storeOffers: decision.ranked.storeOffers,
        allocations: decision.allocations,
        totalTwd: decision.totalTwd,
        preferredCardId,
      })
    : null;
  const activeCardIds = new Set(decision.allocations.map((allocation) => allocation.offer.card.id));
  const candidates = groupByCard(lookupDecision.ranked.storeOffers);
  const lookupTerm = lookupQuery.trim() || merchant.trim();
  const matchedPlanCount = useMemo(() => {
    if (!lookupTerm) return 0;
    return rulesV3.cards.reduce(
      (sum, card) =>
        sum +
        card.plans.filter(
          (plan) =>
            plan.enabled !== false &&
            (plan.contexts || []).includes('merchant') &&
            engine.merchantTextMatches(plan, lookupTerm),
        ).length,
      0,
    );
  }, [lookupTerm, rulesV3.cards]);

  const showThreshold =
    threshold &&
    dismissedThreshold !== threshold.threshold &&
    threshold.threshold > decision.totalTwd;

  function chooseContext(next: string) {
    setContext(next);
    setPreferredCardId('');
    setDismissedThreshold(null);
    if (next !== 'merchant') setMerchant('');
    setLookupOpen(false);
    setLookupQuery('');
  }

  function addAmount(value: number) {
    setAmount(String(Math.max(0, jpy + value)));
    setDismissedThreshold(null);
  }

  function clearAmount() {
    setAmount('');
    setPreferredCardId('');
    setDismissedThreshold(null);
  }

  function chooseMerchant(cardId: string, nextMerchant: string) {
    setMerchant(nextMerchant.trim());
    setPreferredCardId(cardId);
    setLookupOpen(false);
    setLookupQuery('');
    setDismissedThreshold(null);
  }

  function clearMerchant() {
    setMerchant('');
    setPreferredCardId('');
    setLookupOpen(false);
    setLookupQuery('');
    setDismissedThreshold(null);
  }

  function record() {
    if (!decision.allocations.length || decision.totalTwd <= 0) {
      setToast('請先完成回饋試算');
      return;
    }

    const now = new Date();
    const result = createLedgerRecords({
      rulesV3,
      allocations: decision.allocations,
      totalTwd: decision.totalTwd,
      jpy,
      memo,
      now,
      dateParts: getTaipeiDateParts(now),
      today: formatTaipeiDate(now),
      contexts: [context],
      merchant,
    });
    if (!result.records.length) {
      setToast('沒有可記錄的明細');
      return;
    }

    updateRulesV3(result.rulesV3);
    updateLedger((current) => [...result.records, ...current]);
    setAmount('');
    setMemo('');
    setToast(`已記錄 ${result.records.length} 筆，估算加碼額度已更新`);
    navigate('/ledger');
  }

  return (
    <section className="decision-page">
      <div className="page-panel">
        <div className="decision-heading">
          <div>
            <p className="app-kicker">Decision</p>
            <h2>刷卡決策</h2>
          </div>
          <span className="decision-rate">
            {rate.isLive ? '即時' : '固定'} · 1 JPY = {rate.value.toFixed(4)} TWD
          </span>
        </div>

        <div className="form-block">
          <div className="field-heading">
            <label>先選消費情境</label>
            <span>一次選一個</span>
          </div>
          <div className="scenario-grid" role="group" aria-label="消費情境">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.value}
                type="button"
                className={cn('scenario-option', context === scenario.value && 'is-active')}
                onClick={() => chooseContext(scenario.value)}
                aria-pressed={context === scenario.value}
              >
                <b>{scenario.label}</b>
                <small>{scenario.hint}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="form-block">
          <div className="field-heading">
            <label htmlFor="decision-amount">結帳金額 (日幣 JPY)</label>
            <button type="button" className="text-action" onClick={clearAmount}>
              清除
            </button>
          </div>
          <div className="amount-input-wrap">
            <input
              id="decision-amount"
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setDismissedThreshold(null);
              }}
            />
            <span className="currency-tag">JPY</span>
          </div>
          <div className="amount-shortcuts">
            {[1000, 5000, 10000, 30000].map((value) => (
              <button key={value} type="button" className="shortcut-btn" onClick={() => addAmount(value)}>
                +{value.toLocaleString()}
              </button>
            ))}
          </div>
          <div className="twd-estimate">
            <span>
              折合約：<b>{formatTwd(decision.totalTwd)}</b>
            </span>
          </div>
        </div>

        {isMerchant && (
          <div className="form-block">
            <div className="field-heading">
              <label htmlFor="decision-merchant">特約商店</label>
              <span>店名或活動關鍵字</span>
            </div>
            <div className="merchant-input-row">
              <input
                id="decision-merchant"
                type="search"
                placeholder="例如：松本清、BicCamera"
                value={merchant}
                onChange={(event) => {
                  setMerchant(event.target.value);
                  setPreferredCardId('');
                  setDismissedThreshold(null);
                }}
              />
              {merchant && (
                <button type="button" className="btn-secondary compact" onClick={clearMerchant}>
                  清除
                </button>
              )}
            </div>
          </div>
        )}

        <div className="form-block">
          <div className="field-heading">
            <label htmlFor="decision-memo">消費明細（選填）</label>
          </div>
          <input
            id="decision-memo"
            type="text"
            placeholder="例如：唐吉訶德、松本清合利他命"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>

        <div className="form-block">
          <div className="field-heading">
            <label>拆刷模式</label>
            <span>切換看單卡與拆刷的差異</span>
          </div>
          <div className="split-mode-tabs" role="tablist" aria-label="拆刷模式">
            <button
              type="button"
              role="tab"
              aria-selected={splitMode === 'auto'}
              className={cn('split-mode-tab', splitMode === 'auto' && 'is-active')}
              onClick={() => setSplitMode('auto')}
            >
              <b>拆分最佳化</b>
              <small>多卡拆刷</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={splitMode === 'single'}
              className={cn('split-mode-tab', splitMode === 'single' && 'is-active')}
              onClick={() => setSplitMode('single')}
            >
              <b>整筆刷</b>
              <small>單卡</small>
            </button>
          </div>
          <p className="split-mode-hint">
            {splitMode === 'auto'
              ? '依所有方案當下可用的加碼額度與淨回饋率重新分配，不是固定卡片順序。'
              : '整筆消費只選一張卡，適合不想拆刷、店家限制或想保留其他卡額度。'}
          </p>
        </div>

        <div className={cn('result-box', !decision.allocations.length && 'is-empty')} aria-live="polite">
          {jpy <= 0 ? (
            <div className="result-empty">
              <b>請輸入金額試算</b>
              <span>選好消費情境並輸入金額，查看依卡片規則估算的回饋。</span>
            </div>
          ) : !decision.allocations.length ? (
            <div className="result-empty">
              <b>沒有符合的持卡方案</b>
              <span>請在「攻略守則」加入持有卡片及相應情境的回饋方案。</span>
            </div>
          ) : (
            <>
              <div className="result-header">
                <div>
                  <span className="result-label">
                    {decision.isSplit ? '推薦拆刷' : '建議刷卡'}
                  </span>
                  <h3>
                    {decision.isSplit
                      ? [...new Set(decision.allocations.map((item) => item.offer.card.name))].join(' ＋ ')
                      : activeOffer?.card.name}
                  </h3>
                </div>
                <span className="rate-badge">
                  淨回饋{' '}
                  {formatPercent(
                    decision.totalTwd ? (decision.totalReward / decision.totalTwd) * 100 : 0,
                  )}
                </span>
              </div>

              <div className="result-total">
                <span>整筆預估淨回饋</span>
                <b>{formatTwd(decision.totalReward)}</b>
              </div>

              {decision.isSplit ? (
                <p className="split-mode-hint is-result">
                  <b>拆分最佳化</b>：本次拆成 {decision.allocations.length} 段，比整筆刷多省{' '}
                  {formatTwd(Math.max(0, decision.totalReward - (decision.ranked.offers[0]?.net || 0)))}。
                </p>
              ) : (
                <p className="split-mode-hint is-result">
                  {splitMode === 'single'
                    ? '目前以單卡計算；切到拆分最佳化可比較多卡拆刷的回饋差異。'
                    : '本筆拆刷未優於整筆刷，維持單卡計算。'}
                </p>
              )}

              <div className="allocation-list">
                {decision.allocations.map((allocation, index) => {
                  const merchantText = merchantTextFor(allocation.offer);
                  const ratePercent = offerRatePercent(allocation.offer, allocation.amount);
                  return (
                    <div className="allocation-row" key={`${allocation.offer.card.id}-${index}`}>
                      <div className="allocation-main">
                        <span className="allocation-index">{index + 1}</span>
                        <div>
                          <b>{allocation.offer.card.name}</b>
                          <small>
                            {displayPlanName(allocation.offer.card.name, allocation.offer.plan.name)}
                            {' · '}
                            淨 {formatPercent(ratePercent)}
                          </small>
                        </div>
                      </div>
                      <div className="allocation-amount">
                        <b>{formatTwd(allocation.amount)}</b>
                        <small>回饋 {formatTwd(allocation.offer.net)}</small>
                      </div>
                      {isMerchant && (
                        <details className="merchant-text">
                          <summary>
                            特約原文
                            <span>{merchantText || '未限制店家（實體一般消費）'}</span>
                          </summary>
                          {merchantText && <p>{merchantText}</p>}
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>

              {isMerchant && decision.ranked.storeBest && (
                <div className="result-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setLookupOpen(true);
                      setLookupQuery(merchant);
                    }}
                  >
                    用店家搜尋其他卡片
                  </button>
                </div>
              )}

              {merchantNote && (
                <p className="decision-store-note" role="note">
                  {merchantNote}
                </p>
              )}

              {(() => {
                const notes = [
                  ...new Set(
                    [
                      ...decision.allocations.flatMap((allocation) =>
                        (allocation.offer.notes || []).map(
                          (note) => `${allocation.offer.card.name}：${note}`,
                        ),
                      ),
                      ...decision.ranked.offers.flatMap((offer) =>
                        (offer.notes || []).map((note) => `${offer.card.name}：${note}`),
                      ),
                    ].filter(Boolean),
                  ),
                ];
                return notes.length ? (
                  <div className="decision-notes">
                    {notes.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                ) : null;
              })()}

              {showThreshold && threshold && (
                <div className="threshold-box">
                  <p>
                    <b>門檻補足機會：</b>再加 ¥{threshold.additionalJpy.toLocaleString()}（約{' '}
                    {formatTwd(threshold.additionalTwd)}），總額達 {formatTwd(threshold.threshold)}{' '}
                    即可觸發 {threshold.cardName} 的加碼回饋（淨 {formatPercent(threshold.netRate)}%）。
                  </p>
                  <div className="result-actions">
                    <button
                      type="button"
                      className="btn-main compact"
                      onClick={() => {
                        setAmount(String(threshold.targetJpy));
                        setDismissedThreshold(null);
                      }}
                    >
                      試算加購
                    </button>
                    <button
                      type="button"
                      className="btn-secondary compact"
                      onClick={() => setDismissedThreshold(threshold.threshold)}
                    >
                      維持金額
                    </button>
                  </div>
                </div>
              )}

              <button type="button" className="btn-main record-button" onClick={record}>
                已刷卡，加入記帳
              </button>
            </>
          )}
        </div>

        {toast && (
          <p className="decision-toast" role="status">
            {toast}
          </p>
        )}
        <p className="decision-disclaimer">
          本工具僅依你設定的規則估算，不代表銀行最終認列或回饋保證；活動資格、登錄、店家 MCC
          與實際入帳請以銀行公告為準。
        </p>
      </div>
      <DataStatus />

      {lookupOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merchant-lookup-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLookupOpen(false);
          }}
        >
          <div className="modal-box merchant-lookup-modal">
            <div className="modal-title">
              <span id="merchant-lookup-title">用店家搜尋其他卡片</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setLookupOpen(false)}
                aria-label="關閉特約卡片查詢"
              >
                ×
              </button>
            </div>
            <input
              type="search"
              className="merchant-search"
              placeholder="輸入店名或活動關鍵字"
              value={lookupQuery}
              autoFocus
              onChange={(event) => setLookupQuery(event.target.value)}
            />
            <div className="merchant-feedback" aria-live="polite">
              {!lookupTerm ? (
                <p>輸入店名或活動關鍵字開始搜尋。</p>
              ) : lookupQuery.trim() && matchedPlanCount === 0 ? (
                <p className="is-warning">
                  搜尋「{lookupQuery.trim()}」：沒有方案原文命中。下方仍是一般消費候選卡。
                </p>
              ) : lookupQuery.trim() ? (
                <p className="is-ok">
                  搜尋「{lookupQuery.trim()}」：{matchedPlanCount} 個方案原文命中。
                </p>
              ) : (
                <p className="is-ok">目前店家：「{merchant}」。</p>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="merchant-candidates">
                <div className="merchant-candidates-head">
                  <b>「{lookupTerm}」的卡片</b>
                  <span>{candidates.length} 張</span>
                </div>
                {candidates.map((candidate) => {
                  const planText = merchantTextFor(candidate.best);
                  const merchantHit = Boolean(
                    lookupTerm &&
                      planText &&
                      engine.merchantTextMatches(candidate.best.plan, lookupTerm),
                  );
                  const ratePercent = offerRatePercent(candidate.best, decision.totalTwd);
                  const isCurrent = activeCardIds.has(candidate.card.id);
                  const isPreferred = candidate.card.id === preferredCardId;
                  const flags = [
                    isCurrent ? '目前推薦' : '',
                    isPreferred ? '你指定' : '',
                  ].filter(Boolean);
                  return (
                    <button
                      type="button"
                      className={cn(
                        'merchant-candidate',
                        isCurrent && 'is-current',
                        isPreferred && 'is-preferred',
                      )}
                      key={candidate.card.id}
                      onClick={() => chooseMerchant(candidate.card.id, lookupTerm)}
                    >
                      <b>{candidate.card.name}</b>
                      <small>
                        {merchantHit ? `特約命中「${lookupTerm}」` : '實體一般'} ·{' '}
                        {candidate.count > 1
                          ? `${displayPlanName(candidate.card.name, candidate.best.plan.name)} 等 ${candidate.count} 個方案`
                          : displayPlanName(candidate.card.name, candidate.best.plan.name)}
                        {' · '}淨 {formatPercent(ratePercent)}
                        {flags.length ? ` · ${flags.join(' · ')}` : ''}
                      </small>
                    </button>
                  );
                })}
                <div className="result-actions">
                  <button
                    type="button"
                    className="btn-secondary compact"
                    onClick={() => chooseMerchant('', lookupTerm)}
                  >
                    用這個條件找最高回饋
                  </button>
                </div>
              </div>
            ) : (
              <p className="merchant-empty">目前沒有可比較的卡片。</p>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setLookupOpen(false)}>
                關閉
              </button>
              <button type="button" className="btn-secondary" onClick={clearMerchant}>
                清除店家條件
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
