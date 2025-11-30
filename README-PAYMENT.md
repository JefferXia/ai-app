# Sound项目 - ZPAY支付系统集成

## 概述

本项目已成功集成了ZPAY支付系统，支持支付宝、微信支付、QQ钱包、财付通等多种支付方式。系统提供了完整的支付流程，包括订单创建、支付处理、回调通知、订单查询和退款等功能。

## 功能特性

### 🚀 核心功能

- ✅ 多种支付方式支持（支付宝、微信、QQ钱包、财付通）
- ✅ 页面跳转支付和API接口支付两种模式
- ✅ 完整的订单生命周期管理
- ✅ 安全的签名验证机制
- ✅ 异步通知和页面跳转通知
- ✅ 订单状态查询和刷新
- ✅ 退款功能支持

### 🎨 用户界面

- ✅ 响应式支付表单
- ✅ 订单列表管理
- ✅ 支付结果页面（成功/失败/错误）
- ✅ 现代化的UI设计
- ✅ 移动端友好

### 🔒 安全特性

- ✅ MD5签名验证
- ✅ 参数完整性校验
- ✅ 防重放攻击
- ✅ 金额验证
- ✅ 订单状态防重复处理

## 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端组件      │    │   API接口       │    │   ZPAY服务      │
│                 │    │                 │    │                 │
│ • PaymentForm   │◄──►│ • /api/payment  │◄──►│ • 支付网关      │
│ • OrderList     │    │ • /api/payment  │    │ • 回调通知      │
│ • 结果页面      │    │ • /api/payment  │    │ • 订单查询      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 文件结构

```
sound/
├── app/
│   ├── api/payment/           # 支付API接口
│   │   ├── create/            # 创建支付订单
│   │   ├── page/              # 页面跳转支付
│   │   ├── notify/            # 异步通知回调
│   │   ├── return/            # 页面跳转回调
│   │   ├── query/             # 查询订单状态
│   │   └── refund/            # 申请退款
│   └── payment/               # 支付页面
│       ├── page.tsx           # 支付主页面
│       ├── success/           # 支付成功页面
│       ├── failed/            # 支付失败页面
│       └── error/             # 支付错误页面
├── components/
│   ├── PaymentForm.tsx        # 支付表单
│   └── OrderList.tsx          # 订单列表
├── lib/
│   └── payment.ts             # 支付工具类
├── types/
│   └── payment.d.ts           # 支付类型定义
└── docs/
    └── payment-setup.md       # 配置说明文档
```

## 快速开始

### 1. 环境配置

创建 `.env.local` 文件：

```bash
# ZPAY支付配置
ZPAY_PID=你的商户ID
ZPAY_KEY=你的商户密钥
ZPAY_NOTIFY_URL=https://你的域名.com/api/payment/notify
ZPAY_RETURN_URL=https://你的域名.com/api/payment/return
ZPAY_API_URL=https://z-pay.cn
```

### 2. 启动项目

```bash
npm run dev
```

### 3. 访问支付页面

打开浏览器访问：`http://localhost:3000/payment`

## API接口说明

### 创建支付订单

```http
POST /api/payment/create
Content-Type: application/json

{
  "userId": "user_123",
  "amount": 99.99,
  "productName": "VIP会员",
  "paymentType": "alipay",
  "metadata": {
    "description": "年度VIP会员"
  }
}
```

### 页面跳转支付

```http
POST /api/payment/page
Content-Type: application/json

{
  "userId": "user_123",
  "amount": 99.99,
  "productName": "VIP会员",
  "paymentType": "alipay"
}
```

### 查询订单状态

```http
GET /api/payment/query?out_trade_no=订单号
```

### 申请退款

```http
POST /api/payment/refund
Content-Type: application/json

{
  "pid": "商户ID",
  "key": "商户密钥",
  "out_trade_no": "订单号",
  "money": "退款金额"
}
```

## 支付流程

### 1. 创建订单

用户填写商品信息和选择支付方式，系统生成订单并调用ZPAY API。

### 2. 用户支付

- **API支付**：返回支付URL或二维码，用户完成支付
- **页面跳转**：直接跳转到ZPAY支付页面

### 3. 支付回调

- **异步通知**：ZPAY服务器主动通知支付结果
- **页面跳转**：用户支付完成后跳转回指定页面

### 4. 结果处理

系统验证签名，更新订单状态，处理业务逻辑。

## 组件使用

### PaymentForm 组件

```tsx
import { PaymentForm } from '@/components/payment/PaymentForm';

<PaymentForm
  userId="user_123"
  onPaymentSuccess={(orderId) => {
    console.log('支付成功:', orderId);
  }}
  onPaymentError={(error) => {
    console.error('支付失败:', error);
  }}
/>;
```

### OrderList 组件

```tsx
import { OrderList } from '@/components/payment/OrderList';

<OrderList userId="user_123" />;
```

## 状态管理

系统使用简单的内存存储管理支付订单状态：

> **注意**：当前版本使用数据库存储支付记录，不再需要内存状态管理。

## 安全注意事项

1. **签名验证**：所有回调都必须验证签名
2. **金额验证**：验证支付金额与订单金额一致
3. **订单状态**：防止重复处理同一笔支付
4. **HTTPS**：生产环境必须使用HTTPS协议
5. **密钥安全**：不要将商户密钥提交到代码仓库

## 测试

### 本地开发测试

使用ngrok等工具创建公网可访问的HTTPS地址：

```bash
# 安装ngrok
npm install -g ngrok

# 启动本地服务
npm run dev

# 启动ngrok
ngrok http 3000

# 使用ngrok地址配置回调
ZPAY_NOTIFY_URL=https://xxxx.ngrok.io/api/payment/notify
ZPAY_RETURN_URL=https://xxxx.ngrok.io/api/payment/return
```

### 测试支付

- 测试金额：建议使用0.01元
- 支付宝测试账号：13800138000
- 微信支付：使用微信扫码支付

## 部署

### 生产环境要求

1. 使用HTTPS协议
2. 配置正确的回调地址
3. 设置适当的安全头
4. 监控支付日志

### 环境变量

确保生产环境正确配置所有必要的环境变量。

## 故障排除

### 常见问题

**Q: 回调地址无法访问？**
A: 确保回调地址是公网可访问的HTTPS地址。

**Q: 签名验证失败？**
A: 检查商户密钥是否正确，确保签名算法按照文档实现。

**Q: 支付成功但订单状态未更新？**
A: 检查异步通知接口是否正常返回"success"。

## 技术支持

- ZPAY官方文档：[https://z-pay.cn/doc.html](https://z-pay.cn/doc.html)
- 项目问题：查看项目Issues或联系开发者

## 更新日志

### v1.0.0 (2024-01-XX)

- ✅ 初始版本发布
- ✅ 支持多种支付方式
- ✅ 完整的支付流程
- ✅ 响应式UI设计
- ✅ 安全签名验证

## 许可证

本项目采用MIT许可证，详见LICENSE文件。
