/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTopupInfo } from '../hooks/use-topup-info'
import { useWCheckoutPayment } from '../hooks/use-wcheckout-payment'

interface WCheckoutSelectProps {
  amount: number
}

// Token-type order requested by product: WUSD first, then USDC, then USDT.
const TOKEN_TYPE_ORDER = ['WUSD', 'USDC', 'USDT'] as const
type TokenType = (typeof TOKEN_TYPE_ORDER)[number]

// Chain identifier prefixes per WCheckout docs.
const CHAIN_LABELS: Record<string, string> = {
  ETH: 'Ethereum',
  TRX: 'TRON',
  SOL: 'Solana',
}
const CHAIN_ORDER = ['ETH', 'TRX', 'SOL']

// Split "ETH_USDT" → { chain: "ETH", type: "USDT" }.
function splitToken(id: string): { chain: string; type: string } {
  const idx = id.indexOf('_')
  if (idx <= 0) return { chain: '', type: id }
  return { chain: id.slice(0, idx), type: id.slice(idx + 1) }
}

export function WCheckoutSelect({ amount }: WCheckoutSelectProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { topupInfo, loading } = useTopupInfo()
  const { processing, processWCheckoutPayment } = useWCheckoutPayment()

  // Group admin-enabled tokens by token type, keeping a list of chains
  // available for each type.
  const tokensByType = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const tok of topupInfo?.wcheckout_tokens ?? []) {
      const { chain, type } = splitToken(tok.token)
      if (!chain || !type) continue
      const list = map.get(type) ?? []
      if (!list.includes(chain)) list.push(chain)
      map.set(type, list)
    }
    // Sort chains within each type using canonical order.
    for (const [k, v] of map) {
      v.sort((a, b) => {
        const ai = CHAIN_ORDER.indexOf(a)
        const bi = CHAIN_ORDER.indexOf(b)
        if (ai === -1 && bi === -1) return a.localeCompare(b)
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      map.set(k, v)
    }
    return map
  }, [topupInfo?.wcheckout_tokens])

  // Visible token-type tiles: requested order WUSD → USDC → USDT, plus
  // anything else the admin configured that doesn't fit the canonical set.
  const tokenTypes = useMemo(() => {
    const ordered: string[] = []
    for (const tt of TOKEN_TYPE_ORDER) {
      if (tokensByType.has(tt)) ordered.push(tt)
    }
    for (const tt of tokensByType.keys()) {
      if (!ordered.includes(tt)) ordered.push(tt)
    }
    return ordered
  }, [tokensByType])

  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedChain, setSelectedChain] = useState<string>('')

  // Initialise selections once topupInfo lands.
  useEffect(() => {
    if (!selectedType && tokenTypes.length > 0) {
      const first = tokenTypes[0]
      setSelectedType(first)
      const chains = tokensByType.get(first) ?? []
      setSelectedChain(chains[0] ?? '')
    }
  }, [tokenTypes, tokensByType, selectedType])

  const availableChains = useMemo(
    () => (selectedType ? tokensByType.get(selectedType) ?? [] : []),
    [selectedType, tokensByType]
  )

  // When user switches token type, reset chain to a valid one for that type.
  const handleTypeChange = (next: string) => {
    setSelectedType(next)
    const chains = tokensByType.get(next) ?? []
    if (!chains.includes(selectedChain)) {
      setSelectedChain(chains[0] ?? '')
    }
  }

  const enabled = topupInfo?.enable_wcheckout_topup === true
  const minTopup = topupInfo?.wcheckout_min_topup ?? 1
  const amountValid = amount >= minTopup
  const tokenId =
    selectedChain && selectedType ? `${selectedChain}_${selectedType}` : ''

  const handlePay = async () => {
    if (!tokenId || !amountValid || processing) return
    const ok = await processWCheckoutPayment(amount, tokenId)
    if (ok) {
      // Payment page opened in a new tab; return this tab to the wallet with
      // the top-up history expanded so the user sees the new pending order
      // (credited by webhook/reconciliation once paid).
      void navigate({ to: '/wallet', search: { show_history: true } })
    }
  }

  const handleBack = () => {
    void navigate({ to: '/wallet' })
  }

  const chainLabel = (c: string) =>
    CHAIN_LABELS[c] ? t(CHAIN_LABELS[c]) : c

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('WCheckout - Choose Payment Token')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Select the stablecoin and chain to complete your top-up')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-3xl flex-col gap-4'>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleBack}
            className='w-fit gap-2'
          >
            <ArrowLeft className='h-4 w-4' />
            {t('Back to wallet')}
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <span>{t('Top-up amount')}</span>
                <span className='text-2xl font-bold'>{amount}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-6'>
              {!amountValid && (
                <Alert>
                  <AlertDescription>
                    {t(
                      'Amount must be at least {{min}}. Please go back and adjust.',
                      { min: minTopup }
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {loading ? (
                <div className='space-y-3'>
                  <Skeleton className='h-12 w-full rounded-lg' />
                  <Skeleton className='h-12 w-full rounded-lg' />
                </div>
              ) : !enabled ? (
                <Alert>
                  <AlertDescription>
                    {t(
                      'WCheckout is not enabled. Please contact administrator.'
                    )}
                  </AlertDescription>
                </Alert>
              ) : tokenTypes.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    {t('No payment tokens are currently enabled.')}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className='space-y-2'>
                    <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {t('Stablecoin')}
                    </Label>
                    <div className='grid grid-cols-3 gap-2'>
                      {tokenTypes.map((tt) => (
                        <Button
                          key={tt}
                          variant={selectedType === tt ? 'default' : 'outline'}
                          onClick={() => handleTypeChange(tt)}
                          disabled={processing}
                          className='h-11'
                        >
                          {tt}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {t('Chain')}
                    </Label>
                    <Select
                      value={selectedChain}
                      onValueChange={setSelectedChain}
                      disabled={processing || availableChains.length === 0}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select a chain')} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChains.map((c) => (
                          <SelectItem key={c} value={c}>
                            {chainLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableChains.length === 1 && (
                      <p className='text-muted-foreground text-xs'>
                        {t(
                          '{{token}} is only available on {{chain}}.',
                          {
                            token: selectedType,
                            chain: chainLabel(availableChains[0]),
                          }
                        )}
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={handlePay}
                    disabled={!tokenId || !amountValid || processing}
                    className='w-full'
                    size='lg'
                  >
                    {processing ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        {t('Processing...')}
                      </>
                    ) : (
                      t('Pay with {{token}}', { token: tokenId || '...' })
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
