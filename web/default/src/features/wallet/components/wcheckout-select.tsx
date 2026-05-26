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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useTopupInfo } from '../hooks/use-topup-info'
import { useWCheckoutPayment } from '../hooks/use-wcheckout-payment'
import type { WCheckoutToken } from '../types'

interface WCheckoutSelectProps {
  amount: number
}

// Chain extracted from token identifier "{CHAIN}_{TOKEN}". Falls back to
// "Other" so tokens with unexpected formats still render.
function getChain(tokenId: string): string {
  const idx = tokenId.indexOf('_')
  return idx > 0 ? tokenId.slice(0, idx) : 'Other'
}

function chainLabel(chain: string, t: (key: string) => string): string {
  switch (chain.toUpperCase()) {
    case 'ETH':
      return t('Ethereum')
    case 'TRON':
      return t('TRON')
    case 'SOL':
      return t('Solana')
    default:
      return chain
  }
}

export function WCheckoutSelect({ amount }: WCheckoutSelectProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { topupInfo, loading } = useTopupInfo()
  const { processing, processWCheckoutPayment } = useWCheckoutPayment()

  const grouped = useMemo(() => {
    const tokens = topupInfo?.wcheckout_tokens ?? []
    const map = new Map<string, WCheckoutToken[]>()
    for (const tok of tokens) {
      const chain = getChain(tok.token)
      const list = map.get(chain) ?? []
      list.push(tok)
      map.set(chain, list)
    }
    // Stable order: ETH, TRON, SOL, then anything else alphabetical.
    const preferred = ['ETH', 'TRON', 'SOL']
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = preferred.indexOf(a)
      const bi = preferred.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [topupInfo?.wcheckout_tokens])

  const enabled = topupInfo?.enable_wcheckout_topup === true
  const minTopup = topupInfo?.wcheckout_min_topup ?? 1
  const amountValid = amount >= minTopup

  const handleBack = () => {
    void navigate({ to: '/wallet' })
  }

  const handleSelect = async (tok: WCheckoutToken) => {
    if (!amountValid || processing) return
    await processWCheckoutPayment(amount, tok.token)
  }

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
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className='h-12 rounded-lg' />
                  ))}
                </div>
              ) : !enabled ? (
                <Alert>
                  <AlertDescription>
                    {t('WCheckout is not enabled. Please contact administrator.')}
                  </AlertDescription>
                </Alert>
              ) : grouped.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    {t('No payment tokens are currently enabled.')}
                  </AlertDescription>
                </Alert>
              ) : (
                grouped.map(([chain, tokens]) => (
                  <div key={chain} className='space-y-2'>
                    <h3 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                      {chainLabel(chain, t)}
                    </h3>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                      {tokens.map((tok) => (
                        <Button
                          key={tok.token}
                          variant='outline'
                          className='h-12 justify-start gap-2 px-3'
                          disabled={!amountValid || processing}
                          onClick={() => handleSelect(tok)}
                        >
                          {processing ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : tok.icon ? (
                            <img
                              src={tok.icon}
                              alt={tok.name}
                              className='h-5 w-5 object-contain'
                              onError={(e) => {
                                ;(
                                  e.currentTarget as HTMLImageElement
                                ).style.display = 'none'
                              }}
                            />
                          ) : null}
                          <span className='truncate text-left'>{tok.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
