const SOURCE_URL = 'https://rate.bot.com.tw/xrt?Lang=zh-TW'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })
  }

  try {
    const sourceResponse = await fetch(SOURCE_URL, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
    })
    if (!sourceResponse.ok) throw new Error(`Bank of Taiwan returned HTTP ${sourceResponse.status}`)

    const html = await sourceResponse.text()
    const jpyRow = html.match(/<tr\b[^>]*>(?:(?!<tr\b)[\s\S])*?JPY(?:(?!<tr\b)[\s\S])*?<\/tr>/i)?.[0]
    if (!jpyRow) throw new Error('臺銀頁面沒有可讀取的日圓牌價（可能是來源暫時阻擋）')

    const spotSellCell = [...jpyRow.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)]
      .find(([, attributes]) => /data-table=["']本行即期賣出["']/i.test(attributes))
    const spotSellingRate = Number(spotSellCell?.[2].replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '').trim())
    if (!Number.isFinite(spotSellingRate) || spotSellingRate <= 0) {
      throw new Error('Bank of Taiwan spot selling rate is invalid')
    }

    const displayedTime = html.match(/class=["'][^"']*\btime\b[^"']*["'][^>]*>\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/i)?.[1]
    if (!displayedTime) throw new Error('臺銀頁面沒有牌價更新時間，拒絕套用無法確認日期的匯率')
    const sourceUpdatedAt = new Date(`${displayedTime.replaceAll('/', '-').replace(' ', 'T')}:00+08:00`)
    if (Number.isNaN(sourceUpdatedAt.getTime())) throw new Error('臺銀牌價時間格式無法辨識')

    return Response.json({
      rate: spotSellingRate,
      source: '臺灣銀行牌告匯率',
      rateType: '日圓即期賣出',
      fetchedAt: sourceUpdatedAt.toISOString(),
      checkedAt: new Date().toISOString(),
      sourceUrl: SOURCE_URL,
    }, { headers: corsHeaders })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Rate lookup failed' }, {
      status: 502,
      headers: corsHeaders,
    })
  }
})
