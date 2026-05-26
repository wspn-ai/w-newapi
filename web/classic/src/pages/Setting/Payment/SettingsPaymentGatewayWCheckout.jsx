/*
Copyright (C) 2025 QuantumNous

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

import React, { useEffect, useRef, useState } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Row,
  Spin,
} from '@douyinfe/semi-ui';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { BookOpen } from 'lucide-react';

const toBoolean = (value) => value === true || value === 'true';

const DEFAULT_TOKENS = JSON.stringify(
  [
    { name: 'USDT (Ethereum)', token: 'ETH_USDT', icon: '/pay-usdt.png' },
    { name: 'USDC (Ethereum)', token: 'ETH_USDC', icon: '/pay-usdc.png' },
    { name: 'WUSD (Ethereum)', token: 'ETH_WUSD', icon: '/pay-wusd.png' },
    { name: 'USDT (TRON)', token: 'TRON_USDT', icon: '/pay-usdt.png' },
    { name: 'USDC (TRON)', token: 'TRON_USDC', icon: '/pay-usdc.png' },
    { name: 'WUSD (TRON)', token: 'TRON_WUSD', icon: '/pay-wusd.png' },
    { name: 'USDT (Solana)', token: 'SOL_USDT', icon: '/pay-usdt.png' },
    { name: 'USDC (Solana)', token: 'SOL_USDC', icon: '/pay-usdc.png' },
    { name: 'WUSD (Solana)', token: 'SOL_WUSD', icon: '/pay-wusd.png' },
  ],
  null,
  2,
);

export default function SettingsPaymentGatewayWCheckout(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('WCheckout 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    WCheckoutEnabled: false,
    WCheckoutSandbox: true,
    WCheckoutApiKey: '',
    WCheckoutApiSecret: '',
    WCheckoutSignKey: '',
    WCheckoutSandboxApiKey: '',
    WCheckoutSandboxApiSecret: '',
    WCheckoutSandboxSignKey: '',
    WCheckoutMerchantId: '',
    WCheckoutNotifyUrl: '',
    WCheckoutReturnUrl: '',
    WCheckoutUnitPrice: 1.0,
    WCheckoutMinTopUp: 1,
    WCheckoutExpiredIn: 1800,
    WCheckoutEnabledTokens: DEFAULT_TOKENS,
  });
  const formApiRef = useRef(null);

  useEffect(() => {
    if (props.options && formApiRef.current) {
      const next = {
        WCheckoutEnabled: toBoolean(props.options.WCheckoutEnabled),
        WCheckoutSandbox:
          props.options.WCheckoutSandbox !== undefined
            ? toBoolean(props.options.WCheckoutSandbox)
            : true,
        WCheckoutApiKey: props.options.WCheckoutApiKey || '',
        WCheckoutApiSecret: props.options.WCheckoutApiSecret || '',
        WCheckoutSignKey: props.options.WCheckoutSignKey || '',
        WCheckoutSandboxApiKey: props.options.WCheckoutSandboxApiKey || '',
        WCheckoutSandboxApiSecret:
          props.options.WCheckoutSandboxApiSecret || '',
        WCheckoutSandboxSignKey: props.options.WCheckoutSandboxSignKey || '',
        WCheckoutMerchantId: props.options.WCheckoutMerchantId || '',
        WCheckoutNotifyUrl: props.options.WCheckoutNotifyUrl || '',
        WCheckoutReturnUrl: props.options.WCheckoutReturnUrl || '',
        WCheckoutUnitPrice: parseFloat(props.options.WCheckoutUnitPrice) || 1.0,
        WCheckoutMinTopUp: parseInt(props.options.WCheckoutMinTopUp) || 1,
        WCheckoutExpiredIn: parseInt(props.options.WCheckoutExpiredIn) || 1800,
        WCheckoutEnabledTokens:
          props.options.WCheckoutEnabledTokens || DEFAULT_TOKENS,
      };
      setInputs(next);
      formApiRef.current.setValues(next);
    }
  }, [props.options]);

  const handleFormChange = (values) => {
    setInputs(values);
  };

  const submit = async () => {
    setLoading(true);
    try {
      let tokensJsonString = inputs.WCheckoutEnabledTokens;
      try {
        const parsed = JSON.parse(tokensJsonString || '[]');
        if (!Array.isArray(parsed)) {
          throw new Error('not an array');
        }
        tokensJsonString = JSON.stringify(parsed);
      } catch {
        showError(t('启用代币 JSON 解析失败，请检查格式'));
        setLoading(false);
        return;
      }

      const options = [
        { key: 'WCheckoutEnabled', value: inputs.WCheckoutEnabled ? 'true' : 'false' },
        { key: 'WCheckoutSandbox', value: inputs.WCheckoutSandbox ? 'true' : 'false' },
        { key: 'WCheckoutMerchantId', value: inputs.WCheckoutMerchantId || '' },
        { key: 'WCheckoutNotifyUrl', value: inputs.WCheckoutNotifyUrl || '' },
        { key: 'WCheckoutReturnUrl', value: inputs.WCheckoutReturnUrl || '' },
        { key: 'WCheckoutUnitPrice', value: String(inputs.WCheckoutUnitPrice || 1.0) },
        { key: 'WCheckoutMinTopUp', value: String(inputs.WCheckoutMinTopUp || 1) },
        { key: 'WCheckoutExpiredIn', value: String(inputs.WCheckoutExpiredIn || 1800) },
        { key: 'WCheckoutEnabledTokens', value: tokensJsonString },
      ];
      if (inputs.WCheckoutApiKey)
        options.push({ key: 'WCheckoutApiKey', value: inputs.WCheckoutApiKey });
      if (inputs.WCheckoutApiSecret)
        options.push({ key: 'WCheckoutApiSecret', value: inputs.WCheckoutApiSecret });
      if (inputs.WCheckoutSignKey)
        options.push({ key: 'WCheckoutSignKey', value: inputs.WCheckoutSignKey });
      if (inputs.WCheckoutSandboxApiKey)
        options.push({ key: 'WCheckoutSandboxApiKey', value: inputs.WCheckoutSandboxApiKey });
      if (inputs.WCheckoutSandboxApiSecret)
        options.push({ key: 'WCheckoutSandboxApiSecret', value: inputs.WCheckoutSandboxApiSecret });
      if (inputs.WCheckoutSandboxSignKey)
        options.push({ key: 'WCheckoutSandboxSignKey', value: inputs.WCheckoutSandboxSignKey });

      const results = await Promise.all(
        options.map((opt) =>
          API.put('/api/option/', { key: opt.key, value: opt.value }),
        ),
      );
      const errs = results.filter((r) => !r.data.success);
      if (errs.length > 0) {
        errs.forEach((r) => showError(r.data.message));
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
      }
    } catch {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  return (
    <Spin spinning={loading}>
      <Form
        initValues={inputs}
        onValueChange={handleFormChange}
        getFormApi={(api) => (formApiRef.current = api)}
      >
        <Form.Section text={sectionTitle}>
          <Banner
            type='info'
            icon={<BookOpen size={16} />}
            description={
              <>
                {t(
                  'WCheckout 是稳定币支付网关（支持以太坊、波场、Solana 链上的 USDT/USDC/WUSD）。请前往 WCheckout 控制台获取 apiKey、apiSecret 和 signKey，并配置 webhook 回调地址。',
                )}
                <br />
                {t('回调地址')}：
                {props.options.ServerAddress
                  ? removeTrailingSlash(props.options.ServerAddress)
                  : t('网站地址')}
                /api/wcheckout/webhook
              </>
            }
            style={{ marginBottom: 12 }}
          />

          <Row gutter={{ xs: 8, sm: 16, md: 24 }}>
            <Col xs={24} sm={12} md={8}>
              <Form.Switch
                field='WCheckoutEnabled'
                label={t('启用 WCheckout')}
                size='default'
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Switch
                field='WCheckoutSandbox'
                label={t('沙盒模式')}
                size='default'
                extraText={t('切换当前请求与回调校验所使用的环境')}
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutMerchantId'
                label={t('商户 ID（可选）')}
                placeholder={t('如未要求可留空')}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24 }} style={{ marginTop: 16 }}>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutSandboxApiKey'
                label={t('API Key（沙盒）')}
                placeholder={t('填写后覆盖，留空保持不变')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutSandboxApiSecret'
                label={t('API Secret（沙盒）')}
                placeholder={t('填写后覆盖，留空保持不变')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutSandboxSignKey'
                label={t('Sign Key（沙盒）')}
                placeholder={t('用于 webhook 验签，留空保持不变')}
                type='password'
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24 }} style={{ marginTop: 16 }}>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutApiKey'
                label={t('API Key（生产）')}
                placeholder={t('填写后覆盖，留空保持不变')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutApiSecret'
                label={t('API Secret（生产）')}
                placeholder={t('填写后覆盖，留空保持不变')}
                type='password'
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.Input
                field='WCheckoutSignKey'
                label={t('Sign Key（生产）')}
                placeholder={t('用于 webhook 验签，留空保持不变')}
                type='password'
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24 }} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field='WCheckoutUnitPrice'
                label={t('单价 (USD)')}
                min={0}
                step={0.1}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.InputNumber
                field='WCheckoutMinTopUp'
                label={t('最低充值数量')}
                min={1}
                style={{ width: '100%' }}
              />
            </Col>
            <Col xs={24} sm={24} md={8}>
              <Form.InputNumber
                field='WCheckoutExpiredIn'
                label={t('订单过期时间 (秒)')}
                min={60}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24 }} style={{ marginTop: 16 }}>
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='WCheckoutNotifyUrl'
                label={t('回调通知 URL')}
                placeholder='https://example.com/api/wcheckout/webhook'
              />
            </Col>
            <Col xs={24} sm={24} md={12}>
              <Form.Input
                field='WCheckoutReturnUrl'
                label={t('支付返回 URL')}
                placeholder='https://example.com/console/topup'
              />
            </Col>
          </Row>

          <Row gutter={{ xs: 8, sm: 16, md: 24 }} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Form.TextArea
                field='WCheckoutEnabledTokens'
                label={t('启用的代币（JSON 数组）')}
                placeholder={DEFAULT_TOKENS}
                rows={10}
                extraText={t(
                  '格式：[{"name":"USDT (Ethereum)","token":"ETH_USDT","icon":"/pay-usdt.png"}, ...]。支持的 token：ETH/TRON/SOL × USDT/USDC/WUSD。',
                )}
              />
            </Col>
          </Row>

          <Button
            theme='solid'
            type='primary'
            onClick={submit}
            style={{ marginTop: 20 }}
          >
            {t('保存 WCheckout 设置')}
          </Button>
        </Form.Section>
      </Form>
    </Spin>
  );
}
