## UltimateAI 对外接入文档

本文档说明如何接入 UltimateAI 的登录与通用积分扣费能力，以及在积分不足时的处理流程。

---

## 一、环境说明

- **基础域名**: `https://ai.ultimateai.vip`
- **字符编码**: UTF-8
- **返回格式**: `application/json`
- **跨域支持**: 默认允许浏览器直接调用（已设置 CORS 头）

---

## 二、登录态检查接口

### 1. 接口概览

- **方法**: `GET`
- **URL**: `/api/session`
- **作用**: 检查当前请求是否已登录，并返回用户基础信息与 session 过期时间。

### 2. 请求示例

```http
GET https://ai.ultimateai.vip/api/session
```

> 建议在请求中附带业务方的 Cookie / Token 等（如果你通过浏览器直接访问，一般会自动携带 Cookie）。

### 3. 成功响应示例

```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": "xxxxxx",
    "email": null,
    "phone": "18668088956",
    "name": "问心",
    "balance": 6090,
    "grade": "V1",
    "createdAt": "2025-08-22T06:38:53.913Z",
    "avatar": "https://thirdwx.qlogo.cn/mmopen/vi_32/xxx/132",
    "isFirstLogin": false
  },
  "session": {
    "expires": "2026-02-08T08:03:30.451Z"
  }
}
```

### 4. 未登录响应示例

- **HTTP 状态码**: `401`

```json
{
  "success": false,
  "error": "未登录",
  "authenticated": false
}
```

### 5. 前端/接入方建议处理逻辑

- **已登录 (`authenticated = true`)**
  - 缓存 `user` 信息和 `session.expires`。
  - 正常进入业务流程。
- **未登录 (`authenticated = false` 或状态码 401)**
  - 引导用户跳转到登录页：
    - `https://ai.ultimateai.vip/login`

---

## 三、通用积分扣费接口

### 1. 接口概览

- **方法**: `POST`
- **URL**: `/api/billing/consume`
- **作用**: 扣减指定用户的积分（通过当前登录态识别用户），用于通用业务消费。

### 2. 请求参数

- **请求体（JSON）**

| 字段名  | 类型   | 是否必填 | 说明                                      |
| ------- | ------ | -------- | ----------------------------------------- |
| amount  | number | 是       | 扣除的积分数量（必须为正数）              |
| bizType | string | 否       | 业务类型标记，例如 `IDEA_SHREDDER_UNLOCK` |
| bizId   | string | 否       | 业务方 ID，如订单号、分析 ID 等           |
| remark  | string | 否       | 备注信息，便于后期排查与对账              |

### 3. 请求示例

```http
POST https://ai.ultimateai.vip/api/billing/consume
Content-Type: application/json

{
  "amount": 100,
  "bizType": "IDEA_SHREDDER_UNLOCK",
  "bizId": "analysis-123",
  "remark": "想法粉碎机解锁资源包"
}
```

### 4. 成功响应示例

- **HTTP 状态码**: `200`

```json
{
  "success": true,
  "userId": "8dc4b202-82f1-42be-9ec3-711191c31a8b",
  "cost": 100,
  "balance": 5990,
  "bizType": "IDEA_SHREDDER_UNLOCK",
  "bizId": "analysis-123"
}
```

字段说明：

- **success**: 是否扣费成功。
- **userId**: 执行扣费的用户 ID。
- **cost**: 实际扣除的积分数量。
- **balance**: 扣费后最新积分余额。
- **bizType / bizId**: 回显业务方传入的信息，便于对账。

### 5. 未登录响应

- **HTTP 状态码**: `401`

```json
{
  "success": false,
  "error": "未登录",
  "authenticated": false
}
```

**处理建议：**

- 业务方前端拿到 401 或 `authenticated = false` 时，跳转到登录页：
  - `https://ai.ultimateai.vip/login`

### 6. 积分不足响应

- **HTTP 状态码**: `402`

```json
{
  "success": false,
  "error": "积分不足",
  "balance": 10,
  "need": 100
}
```

字段说明：

- **balance**: 当前用户剩余积分。
- **need**: 本次扣费所需积分。

**处理建议：**

- 前端/接入方在检测到 `status = 402` 或 `error = "积分不足"` 时，应提示用户：
  > 积分不足，请先充值
- 同时提供“去充值”的按钮或引导，跳转到充值页面：
  - `https://ai.ultimateai.vip/recharge`

前端伪代码示例（仅示意）：

```javascript
if (response.status === 402 && data.error === '积分不足') {
  alert('积分不足，请先充值');
  window.location.href = 'https://ai.ultimateai.vip/recharge';
}
```

### 7. 参数校验异常响应

- **HTTP 状态码**: `400`

```json
{
  "success": false,
  "error": "扣费金额不合法"
}
```

**说明**：当 `amount` 非数字、为负数或为 0 时会返回该错误。

### 8. 服务器内部错误

- **HTTP 状态码**: `500`

```json
{
  "success": false,
  "error": "通用扣费失败"
}
```

---

## 四、跨域（CORS）说明

`/api/session` 与 `/api/billing/consume` 已统一设置 CORS 头，支持在浏览器环境直接调用：

- **响应头包含：**

  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization`

- **OPTIONS 预检请求**
  - 两个接口均实现了 `OPTIONS` 方法，可直接被浏览器用于预检。

---

## 五、推荐接入流程（前端视角）

1. **进入业务页面时**

   - 调用 `GET /api/session` 检查是否登录。
   - 未登录 => 跳转到 `https://ai.ultimateai.vip/login`。
   - 已登录 => 缓存用户信息、积分余额等。

2. **执行需要扣费的操作前**

   - 调用 `POST /api/billing/consume`，传入 `amount` 和相关 `bizType` / `bizId`。
   - `success = true` => 执行业务逻辑（例如解锁内容、开始任务等）。
   - `status = 402`/`error = "积分不足"` =>
     - 弹窗提示“积分不足，请先充值”；
     - 引导用户跳转 `https://ai.ultimateai.vip/recharge`。

3. **充值完成后**
   - 用户返回业务页面时，可再次调用 `GET /api/session` 获取最新 `balance`，再尝试调用扣费接口。
