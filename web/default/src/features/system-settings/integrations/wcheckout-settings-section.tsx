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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { updateSystemOption } from '../api'
import { SettingsSection } from '../components/settings-section'

export interface WCheckoutSettingsValues {
  WCheckoutEnabled: boolean
  WCheckoutSandbox: boolean
  WCheckoutApiKey: string
  WCheckoutApiSecret: string
  WCheckoutSignKey: string
  WCheckoutSandboxApiKey: string
  WCheckoutSandboxApiSecret: string
  WCheckoutSandboxSignKey: string
  WCheckoutMerchantId: string
  WCheckoutNotifyUrl: string
  WCheckoutReturnUrl: string
  WCheckoutUnitPrice: number
  WCheckoutMinTopUp: number
  WCheckoutExpiredIn: number
  WCheckoutEnabledTokens: string
}

interface TokenEntry {
  name: string
  token: string
  icon?: string
}

interface Props {
  defaultValues: WCheckoutSettingsValues
}

export function WCheckoutSettingsSection(props: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)

  const form = useForm<Omit<WCheckoutSettingsValues, 'WCheckoutEnabledTokens'>>(
    {
      defaultValues: props.defaultValues,
    }
  )

  const [tokens, setTokens] = useState<TokenEntry[]>(() => {
    try {
      return JSON.parse(props.defaultValues.WCheckoutEnabledTokens || '[]')
    } catch {
      return []
    }
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIdx, setEditingIdx] = useState(-1)
  const [tokenForm, setTokenForm] = useState<TokenEntry>({
    name: '',
    token: '',
    icon: '',
  })

  useEffect(() => {
    form.reset(props.defaultValues)
    try {
      setTokens(JSON.parse(props.defaultValues.WCheckoutEnabledTokens || '[]'))
    } catch {
      setTokens([])
    }
  }, [props.defaultValues, form])

  const handleSave = async () => {
    setLoading(true)
    try {
      const values = form.getValues()
      const options: { key: string; value: string }[] = [
        { key: 'WCheckoutEnabled', value: String(values.WCheckoutEnabled) },
        { key: 'WCheckoutSandbox', value: String(values.WCheckoutSandbox) },
        { key: 'WCheckoutMerchantId', value: values.WCheckoutMerchantId || '' },
        { key: 'WCheckoutNotifyUrl', value: values.WCheckoutNotifyUrl || '' },
        { key: 'WCheckoutReturnUrl', value: values.WCheckoutReturnUrl || '' },
        {
          key: 'WCheckoutUnitPrice',
          value: String(values.WCheckoutUnitPrice || 1),
        },
        {
          key: 'WCheckoutMinTopUp',
          value: String(values.WCheckoutMinTopUp || 1),
        },
        {
          key: 'WCheckoutExpiredIn',
          value: String(values.WCheckoutExpiredIn || 1800),
        },
        { key: 'WCheckoutEnabledTokens', value: JSON.stringify(tokens) },
      ]
      if (values.WCheckoutApiKey)
        options.push({ key: 'WCheckoutApiKey', value: values.WCheckoutApiKey })
      if (values.WCheckoutApiSecret)
        options.push({
          key: 'WCheckoutApiSecret',
          value: values.WCheckoutApiSecret,
        })
      if (values.WCheckoutSignKey)
        options.push({
          key: 'WCheckoutSignKey',
          value: values.WCheckoutSignKey,
        })
      if (values.WCheckoutSandboxApiKey)
        options.push({
          key: 'WCheckoutSandboxApiKey',
          value: values.WCheckoutSandboxApiKey,
        })
      if (values.WCheckoutSandboxApiSecret)
        options.push({
          key: 'WCheckoutSandboxApiSecret',
          value: values.WCheckoutSandboxApiSecret,
        })
      if (values.WCheckoutSandboxSignKey)
        options.push({
          key: 'WCheckoutSandboxSignKey',
          value: values.WCheckoutSandboxSignKey,
        })

      // Calling the raw API in sequence so the upstream useUpdateOption hook's
      // per-call success toast doesn't fire once per field. We show a single
      // toast at the end and invalidate the cache ourselves.
      const results = await Promise.all(options.map((opt) => updateSystemOption(opt)))
      const failed = results.find((r) => !r.success)
      if (failed) {
        toast.error(failed.message || t('Update failed'))
        return
      }
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      toast.success(t('Updated successfully'))
    } catch {
      toast.error(t('Update failed'))
    } finally {
      setLoading(false)
    }
  }

  const openAdd = () => {
    setEditingIdx(-1)
    setTokenForm({ name: '', token: '', icon: '' })
    setDialogOpen(true)
  }

  const openEdit = (idx: number) => {
    setEditingIdx(idx)
    setTokenForm({ ...tokens[idx] })
    setDialogOpen(true)
  }

  const saveToken = () => {
    if (!tokenForm.name.trim() || !tokenForm.token.trim()) {
      toast.error(t('Token name and identifier are required'))
      return
    }
    if (editingIdx === -1) {
      setTokens((prev) => [...prev, tokenForm])
    } else {
      setTokens((prev) =>
        prev.map((tok, i) => (i === editingIdx ? tokenForm : tok))
      )
    }
    setDialogOpen(false)
  }

  return (
    <>
      <SettingsSection
        title={t('WCheckout Payment Gateway')}
        description={t(
          'Configure WCheckout stablecoin payment integration (USDT/USDC/WUSD on Ethereum/TRON/Solana)'
        )}
      >
        <Alert>
          <AlertDescription className='text-xs'>
            {t(
              'Obtain apiKey / apiSecret / signKey from the WCheckout dashboard. Set the webhook URL to https://<your-host>/api/wcheckout/webhook.'
            )}
          </AlertDescription>
        </Alert>

        <div className='grid grid-cols-2 gap-4'>
          <div className='flex items-center gap-2'>
            <Switch
              checked={form.watch('WCheckoutEnabled')}
              onCheckedChange={(v) => form.setValue('WCheckoutEnabled', v)}
            />
            <Label>{t('Enable WCheckout')}</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={form.watch('WCheckoutSandbox')}
              onCheckedChange={(v) => form.setValue('WCheckoutSandbox', v)}
            />
            <Label>{t('Sandbox mode')}</Label>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('API Key (Sandbox)')}</Label>
            <Input
              type='password'
              {...form.register('WCheckoutSandboxApiKey')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('API Secret (Sandbox)')}</Label>
            <Input
              type='password'
              {...form.register('WCheckoutSandboxApiSecret')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Sign Key (Sandbox)')}</Label>
            <Input
              type='password'
              {...form.register('WCheckoutSandboxSignKey')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Merchant ID')}</Label>
            <Input {...form.register('WCheckoutMerchantId')} />
          </div>
        </div>

        <Separator />

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('API Key (Production)')}</Label>
            <Input type='password' {...form.register('WCheckoutApiKey')} />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('API Secret (Production)')}</Label>
            <Input type='password' {...form.register('WCheckoutApiSecret')} />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Sign Key (Production)')}</Label>
            <Input type='password' {...form.register('WCheckoutSignKey')} />
          </div>
        </div>

        <Separator />

        <div className='grid grid-cols-3 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('Unit price (USD)')}</Label>
            <Input
              type='number'
              step={0.1}
              min={0}
              {...form.register('WCheckoutUnitPrice')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Minimum top-up quantity')}</Label>
            <Input
              type='number'
              min={1}
              {...form.register('WCheckoutMinTopUp')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Order expiry (seconds)')}</Label>
            <Input
              type='number'
              min={60}
              {...form.register('WCheckoutExpiredIn')}
            />
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='grid gap-1.5'>
            <Label>{t('Callback notification URL')}</Label>
            <Input
              placeholder='https://example.com/api/wcheckout/webhook'
              {...form.register('WCheckoutNotifyUrl')}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>{t('Payment return URL')}</Label>
            <Input
              placeholder='https://example.com/console/topup'
              {...form.register('WCheckoutReturnUrl')}
            />
          </div>
        </div>

        <Separator />

        <div className='flex items-center justify-between'>
          <h4 className='font-medium'>{t('Enabled Tokens')}</h4>
          <Button variant='outline' size='sm' onClick={openAdd}>
            <Plus className='mr-1 h-3 w-3' />
            {t('Add token')}
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Display name')}</TableHead>
                <TableHead>{t('Token identifier')}</TableHead>
                <TableHead>{t('Icon')}</TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className='text-muted-foreground py-8 text-center'
                  >
                    {t('No tokens configured')}
                  </TableCell>
                </TableRow>
              ) : (
                tokens.map((tok, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{tok.name}</TableCell>
                    <TableCell className='font-mono text-xs'>
                      {tok.token}
                    </TableCell>
                    <TableCell>
                      {tok.icon ? (
                        <img
                          src={tok.icon}
                          alt={tok.name}
                          className='h-6 w-6 rounded object-contain'
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display =
                              'none'
                          }}
                        />
                      ) : (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() => openEdit(idx)}
                        >
                          <Pencil className='h-3 w-3' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-7 w-7'
                          onClick={() =>
                            setTokens((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2 className='h-3 w-3' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? t('Saving...') : t('Save Changes')}
        </Button>
      </SettingsSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIdx === -1 ? t('Add token') : t('Edit token')}
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-3'>
            <div className='grid gap-1.5'>
              <Label>{t('Display name')} *</Label>
              <Input
                value={tokenForm.name}
                onChange={(e) =>
                  setTokenForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder='USDT (Ethereum)'
              />
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Token identifier')} *</Label>
              <Input
                value={tokenForm.token}
                onChange={(e) =>
                  setTokenForm((p) => ({ ...p, token: e.target.value }))
                }
                placeholder='ETH_USDT'
                className='font-mono'
              />
              <p className='text-muted-foreground text-xs'>
                {t(
                  'Format: {CHAIN}_{TOKEN}. Supported: ETH/TRON/SOL × USDT/USDC/WUSD.'
                )}
              </p>
            </div>
            <div className='grid gap-1.5'>
              <Label>{t('Icon URL')}</Label>
              <Input
                value={tokenForm.icon}
                onChange={(e) =>
                  setTokenForm((p) => ({ ...p, icon: e.target.value }))
                }
                placeholder='/pay-usdt.png'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={saveToken}>{t('Confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
