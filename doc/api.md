# Cloud Mail API 文档

## 概述

所有 API 均以 `/api` 为前缀，返回格式为 JSON：

```json
{
  "code": 200,
  "msg": "success",
  "data": {}
}
```

## 认证方式

### 1. JWT Token 认证（用户接口）
大部分接口需要在 Header 中携带 `Authorization` 字段：
```
Authorization: <jwt_token>
```

### 2. Public Token 认证（公开接口）
`/public/*` 接口需要先调用 `genToken` 获取 token，然后在 Header 中携带：
```
Authorization: <public_token>
```

### 3. 无需认证
部分接口无需认证即可访问。

---

## 公开接口 (Public API)

> 这些接口用于外部系统集成，需要 Public Token 认证（除 genToken 和 fetchmail 外）

### 生成 Public Token
**无需认证**

```
POST /api/public/genToken
```

**请求参数：**
```json
{
  "email": "admin@example.com",
  "password": "admin_password"
}
```

**说明：** 需要使用管理员账号验证

---

### 获取邮件列表
```
POST /api/public/emailList
```

**请求参数：**
```json
{
  "toEmail": "%@example.com%",
  "sendEmail": "%sender%",
  "sendName": "%name%",
  "subject": "%keyword%",
  "content": "%keyword%",
  "type": 0,
  "isDel": 0,
  "timeSort": "desc",
  "num": 1,
  "size": 20
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| toEmail | string | 收件邮箱（支持 LIKE 模糊匹配） |
| sendEmail | string | 发件邮箱（支持 LIKE 模糊匹配） |
| sendName | string | 发件人名称（支持 LIKE 模糊匹配） |
| subject | string | 邮件主题（支持 LIKE 模糊匹配） |
| content | string | 邮件内容（支持 LIKE 模糊匹配） |
| type | number | 邮件类型：0=接收，1=发送 |
| isDel | number | 是否删除：0=未删除，1=已删除 |
| timeSort | string | 时间排序：asc/desc |
| num | number | 页码（从1开始） |
| size | number | 每页数量（默认20） |

---

### 批量添加用户
```
POST /api/public/addUser
```

**请求参数：**
```json
{
  "list": [
    {
      "email": "user1@example.com",
      "password": "password123",
      "roleName": "普通用户"
    },
    {
      "email": "user2@example.com"
    }
  ]
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| list[].email | string | 用户邮箱（必填） |
| list[].password | string | 密码（可选，不填则自动生成） |
| list[].roleName | string | 角色名称（可选，默认为系统默认角色） |

---

### 获取指定邮箱的邮件
**无需认证**

```
GET /api/public/fetchmail/{email}----{password}
```

**路径参数：**
- `email`: 邮箱地址
- `password`: 用户密码或管理员密码（用于无人收件场景）

**示例：**
```
GET /api/public/fetchmail/user@example.com----mypassword
```

**说明：**
- 如果用户存在，使用用户密码验证
- 如果用户不存在（无人收件场景），使用管理员密码验证
- 返回最近 50 封邮件

---

### 添加邮件域名
```
POST /api/public/addDomain
```

**请求参数：**
```json
{
  "domain": "example.com",
  "workerName": "cloud-mail"
}
```

| 参数 | 类型 | 说明 |
|------|------|------|
| domain | string | 要添加的域名（必填） |
| workerName | string | Worker 名称（默认 cloud-mail） |

**说明：**
- 需要先在系统设置中配置 Cloudflare API Token 或 API Key + Email
- 自动完成以下操作：
  1. 获取域名的 Zone ID
  2. 添加 Email Routing DNS 记录
  3. 启用 Email Routing
  4. 设置 Catch-All 规则指向 Worker
  5. 将域名保存到 KV 存储

---

## 登录认证接口

### 用户登录
**无需认证**

```
POST /api/login
```

**请求参数：**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**返回：**
```json
{
  "code": 200,
  "data": {
    "token": "jwt_token_string"
  }
}
```

---

### 用户注册
**无需认证**

```
POST /api/register
```

**请求参数：**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "regKey": "registration_key"
}
```

---

### 用户登出
```
DELETE /api/logout
```

---

## 邮件接口

### 获取邮件列表
```
GET /api/email/list
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| accountId | number | 邮箱账户 ID |
| num | number | 页码 |
| size | number | 每页数量 |
| type | number | 邮件类型 |

---

### 获取最新邮件
```
GET /api/email/latest
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| accountId | number | 邮箱账户 ID |
| latestEmailId | number | 上次最新邮件 ID |

---

### 删除邮件
```
DELETE /api/email/delete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| emailId | number | 邮件 ID |

---

### 发送邮件
```
POST /api/email/send
```

**请求参数：**
```json
{
  "accountId": 1,
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "bcc": ["bcc@example.com"],
  "subject": "邮件主题",
  "content": "<p>邮件内容</p>",
  "inReplyTo": "message_id"
}
```

---

### 标记已读
```
PUT /api/email/read
```

**请求参数：**
```json
{
  "emailId": 1
}
```

---

### 获取附件列表
```
GET /api/email/attList
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| emailId | number | 邮件 ID |

---

## 邮箱账户接口

### 获取账户列表
```
GET /api/account/list
```

---

### 添加邮箱账户
```
POST /api/account/add
```

**请求参数：**
```json
{
  "email": "newaccount@example.com"
}
```

---

### 删除邮箱账户
```
DELETE /api/account/delete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| accountId | number | 账户 ID |

---

### 设置账户名称
```
PUT /api/account/setName
```

**请求参数：**
```json
{
  "accountId": 1,
  "name": "新名称"
}
```

---

### 设置接收所有邮件
```
PUT /api/account/setAllReceive
```

**请求参数：**
```json
{
  "accountId": 1,
  "allReceive": 1
}
```

---

## 收藏接口

### 添加收藏
```
POST /api/star/add
```

**请求参数：**
```json
{
  "emailId": 1
}
```

---

### 获取收藏列表
```
GET /api/star/list
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| num | number | 页码 |
| size | number | 每页数量 |

---

### 取消收藏
```
DELETE /api/star/cancel
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| emailId | number | 邮件 ID |

---

## 个人设置接口

### 获取登录用户信息
```
GET /api/my/loginUserInfo
```

---

### 修改密码
```
PUT /api/my/resetPassword
```

**请求参数：**
```json
{
  "oldPassword": "old_password",
  "newPassword": "new_password"
}
```

---

### 注销账户
```
DELETE /api/my/delete
```

---

## 用户管理接口（管理员）

### 获取用户列表
```
GET /api/user/list
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| email | string | 邮箱筛选 |
| status | number | 状态筛选 |
| num | number | 页码 |
| size | number | 每页数量 |

---

### 添加用户
```
POST /api/user/add
```

**请求参数：**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "type": 1
}
```

---

### 删除用户
```
DELETE /api/user/delete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| userId | number | 用户 ID |

---

### 恢复用户
```
PUT /api/user/restore
```

**请求参数：**
```json
{
  "userId": 1
}
```

---

### 设置用户密码
```
PUT /api/user/setPwd
```

**请求参数：**
```json
{
  "userId": 1,
  "password": "new_password"
}
```

---

### 设置用户状态
```
PUT /api/user/setStatus
```

**请求参数：**
```json
{
  "userId": 1,
  "status": 0
}
```

---

### 设置用户角色
```
PUT /api/user/setType
```

**请求参数：**
```json
{
  "userId": 1,
  "type": 1
}
```

---

### 重置发送次数
```
PUT /api/user/resetSendCount
```

**请求参数：**
```json
{
  "userId": 1
}
```

---

### 获取用户所有邮箱
```
GET /api/user/allAccount
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| userId | number | 用户 ID |

---

### 删除用户邮箱
```
DELETE /api/user/deleteAccount
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| accountId | number | 账户 ID |

---

## 全部邮件接口（管理员）

### 获取所有邮件
```
GET /api/allEmail/list
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| email | string | 邮箱筛选 |
| num | number | 页码 |
| size | number | 每页数量 |

---

### 删除邮件
```
DELETE /api/allEmail/delete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| emailId | number | 邮件 ID |

---

### 批量删除邮件
```
DELETE /api/allEmail/batchDelete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| emailIds | string | 邮件 ID 列表，逗号分隔 |

---

## 角色管理接口（管理员）

### 获取角色列表
```
GET /api/role/list
```

---

### 获取可用角色
```
GET /api/role/selectUse
```

---

### 添加角色
```
POST /api/role/add
```

**请求参数：**
```json
{
  "name": "角色名称",
  "description": "角色描述",
  "sendCount": 100,
  "sendType": "count",
  "accountCount": 10,
  "permIds": [1, 2, 3]
}
```

---

### 修改角色
```
PUT /api/role/set
```

**请求参数：**
```json
{
  "roleId": 1,
  "name": "角色名称",
  "permIds": [1, 2, 3]
}
```

---

### 设置默认角色
```
PUT /api/role/setDefault
```

**请求参数：**
```json
{
  "roleId": 1
}
```

---

### 删除角色
```
DELETE /api/role/delete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| roleId | number | 角色 ID |

---

### 获取权限树
```
GET /api/role/permTree
```

---

## 注册密钥接口（管理员）

### 获取密钥列表
```
GET /api/regKey/list
```

---

### 添加密钥
```
POST /api/regKey/add
```

**请求参数：**
```json
{
  "code": "registration_key",
  "count": 10,
  "roleId": 1,
  "expireTime": "2024-12-31"
}
```

---

### 删除密钥
```
DELETE /api/regKey/delete
```

**查询参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| regKeyId | number | 密钥 ID |

---

### 清除未使用密钥
```
DELETE /api/regKey/clearNotUse
```

---

### 密钥使用历史
```
GET /api/regKey/history
```

---

## 系统设置接口（管理员）

### 获取系统设置
```
GET /api/setting/query
```

---

### 修改系统设置
```
PUT /api/setting/set
```

**请求参数：**
```json
{
  "register": 0,
  "receive": 0,
  "send": 0,
  "title": "Cloud Mail",
  "autoRefreshTime": 5,
  "cfApiToken": "cloudflare_api_token",
  "cfApiKey": "cloudflare_api_key",
  "cfEmail": "cloudflare_email"
}
```

---

### 获取网站配置
**无需认证**

```
GET /api/setting/websiteConfig
```

---

### 设置背景图
```
PUT /api/setting/setBackground
```

**请求参数：**
```json
{
  "background": "https://example.com/bg.jpg"
}
```

---

### 删除背景图
```
DELETE /api/setting/deleteBackground
```

---

## 数据分析接口（管理员）

### 获取图表数据
```
GET /api/analysis/echarts
```

---

## OAuth 接口

### LinuxDo 登录
**无需认证**

```
POST /api/oauth/linuxDo/login
```

**请求参数：**
```json
{
  "code": "oauth_code"
}
```

---

### 绑定用户
```
PUT /api/oauth/bindUser
```

**请求参数：**
```json
{
  "oauthId": 1,
  "email": "user@example.com",
  "password": "password123"
}
```

---

## 其他接口

### 初始化数据库
**无需认证**

```
GET /api/init/{secret}
```

**路径参数：**
- `secret`: JWT 密钥，用于验证

---

### 获取 OSS 文件
**无需认证**

```
GET /api/oss/{key}
```

**路径参数：**
- `key`: 文件 key

---

### Resend Webhooks
**无需认证**

```
POST /api/webhooks
```

用于接收 Resend 的邮件发送状态回调。

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 401 | 认证失败/Token 过期 |
| 403 | 权限不足 |
| 500 | 服务器内部错误 |
