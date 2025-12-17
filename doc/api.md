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