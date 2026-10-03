# 个人任务管理 + 学习打卡系统

一个前后端分离的个人效率工具：**管理任务** + **番茄钟专注** + **每日学习打卡**，三者数据汇总在一个「今日概况」仪表盘上。

前端 React 19 + Vite + Ant Design，后端 Node.js + Express 5 + MySQL，认证使用 JWT。

---

## 功能

### 账号
- 注册 / 登录 / 退出登录（密码 bcrypt 加密存储，JWT 签发登录态）
- 路由守卫：未登录不能访问任何主页面，已登录不会停留在登录页
- token 失效（过期 / 被篡改 / 手动清除）时自动踢回登录页并提示

### 任务管理
- 任务的增 / 删 / 改 / 查
- 按 **完成状态**（未完成 / 已完成 / 已过期）、**发布时间**、**优先级** 三个维度筛选
- 任务状态三种：`0` 未完成、`1` 已完成、`2` 已过期
- 超过截止时间的任务自动标记为「已过期」，过期任务不能再标记完成
- 每条任务记录三个时间：创建时间、更新时间（数据库自动维护）、截止时间

### 番茄钟
- 三种模式：番茄工作法（25 分）/ 短暂休息（5 分）/ 长时间休息（30 分）
- 开始 / 暂停 / 继续 / 重置
- 计时走完自动响铃（Web Audio 合成，无音频文件）+ 弹窗提醒
- 每完成一段专注自动记录时长；累计时长与已完成番茄数实时统计

### 学习打卡
- 每日打卡（同一天只能打一次，由数据库唯一约束保证）
- 连续打卡天数、累计打卡天数

### 今日概况（仪表盘）
- 学习打卡状态与天数
- 任务完成情况饼图（已完成 / 未完成 / 已过期）
- 当日待完成任务列表，可就地删除或标记完成

---

## 技术栈

| 层   | 技术 |
|------|------|
| 前端 | React 19、Vite 8、React Router 7、Redux Toolkit 2、Ant Design 6、ECharts 6、axios、dayjs |
| 后端 | Node.js 24、Express 5、mysql2、jsonwebtoken、bcryptjs |
| 数据库 | MySQL 8+（utf8mb4） |

**几个开发上的选择：**

- **Vite 开启 React Compiler**：自动做组件级记忆化，因此代码中不手写 `useMemo` / `useCallback`
- **axios 统一实例 + 拦截器**：请求拦截器自动附加 `Authorization`，响应拦截器统一翻译错误、处理 401
- **状态分层**：登录态放 Redux（页面需要响应它的变化），其余数据由各页面自己请求自己渲染

---

## 快速开始

### 环境要求

- Node.js ≥ 20（本项目用 24 开发）
- MySQL ≥ 8

### 1. 建库建表

在 MySQL 客户端（命令行 / Workbench 均可）执行：

```sql
CREATE DATABASE IF NOT EXISTS task_app
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE task_app;

-- 用户
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任务
CREATE TABLE tasks (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  VARCHAR(500) DEFAULT NULL,
  status       TINYINT      NOT NULL DEFAULT 0,   -- 0未完成 1已完成 2已过期
  completed_at DATETIME     DEFAULT NULL,         -- 预留：记录完成时刻
  priority     TINYINT      NOT NULL DEFAULT 2,   -- 1高 2中 3低
  due_date     DATETIME     DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_status (user_id, status),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 每日打卡
CREATE TABLE checkins (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  study_date DATE         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_date (user_id, study_date),
  CONSTRAINT fk_checkins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 番茄钟专注记录
CREATE TABLE study_sessions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  mode       TINYINT      NOT NULL DEFAULT 1,     -- 1工作 2短休息 3长休息
  seconds    INT UNSIGNED NOT NULL,               -- 本次实际专注秒数
  completed  TINYINT      NOT NULL DEFAULT 0,     -- 1完整跑完 0中途结束
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_created (user_id, created_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> 表建好后可以用页面上的「注册」功能创建账号，不需要手工插数据。

### 2. 配置后端

```bash
cd server
npm install
```

在 `server/` 下新建 `.env`：

```ini
PORT=8080
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=task_app
JWT_SECRET=一串足够长的随机字符串
```

生成随机密钥：

```bash
node -e "import('node:crypto').then(c=>console.log(c.randomBytes(32).toString('hex')))"
```

启动：

```bash
npm run dev
# server running at: http://127.0.0.1:8080
```

### 3. 启动前端

**另开一个终端：**

```bash
cd first-program
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

> 前端通过 Vite 代理把 `/api` 转发到 `http://127.0.0.1:8080`，配置在 `first-program/vite.config.js`。
> **前端不能直连 MySQL**，所有数据都经后端接口读写。

---

## 项目结构

```
React19/
├── first-program/                  # 前端
│   ├── vite.config.js              # 含 /api 代理配置
│   └── src/
│       ├── api/                    # 接口层：页面不直接写 axios
│       │   ├── request.js          # axios 实例 + 请求/响应拦截器
│       │   ├── auth.js             # 登录 / 获取当前用户
│       │   ├── register.js
│       │   ├── tasks.js
│       │   ├── nowaday.js
│       │   └── study.js
│       ├── pages/
│       │   ├── login/              # 登录
│       │   ├── register/           # 注册
│       │   ├── home/               # 主布局：侧边导航 + 顶栏 + <Outlet/>
│       │   ├── nowaday/            # 今日概况（打卡 + 饼图 + 待办）
│       │   ├── task/               # 任务管理
│       │   ├── publish/            # 添加任务
│       │   └── study/              # 番茄钟
│       ├── router/
│       │   ├── index.jsx           # 路由表
│       │   └── requireAuth.jsx     # 路由守卫
│       └── store/
│           ├── index.js            # Redux store（含 localStorage 持久化）
│           └── modules/user.js     # 登录态 slice
│
└── server/                         # 后端
    ├── app.js                      # 入口：组装中间件与路由
    ├── db.js                       # mysql2 连接池
    ├── middleware.js               # 鉴权中间件 + 过期任务处理
    └── router/
        ├── auths.js                # 注册 / 登录 / 当前用户
        ├── tasks.js                # 任务 CRUD + 每日待办
        └── stats.js                # 打卡 / 概览统计 / 番茄时长
```

---

## 接口

**所有接口以 `/api` 为前缀。** 除 `login` / `register` 外都需要请求头：

```
Authorization: Bearer <token>
```

统一约定：

- 错误响应一律是 `{ "tip": "给用户看的中文提示" }`
- 成功响应直接返回数据对象，不套 `{ code, data }`

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| POST | `/api/register` | 注册 | 否 |
| POST | `/api/login` | 登录，返回 `{ token, user }` | 否 |
| GET | `/api/me` | 当前用户信息 | 是 |
| GET | `/api/tasks` | 任务列表，支持 `?created_at=&status=&priority=` | 是 |
| POST | `/api/tasks` | 新建任务 | 是 |
| PUT | `/api/tasks/:id` | 修改任务 | 是 |
| DELETE | `/api/tasks/:id` | 删除任务 | 是 |
| GET | `/api/everyday` | 当日未完成任务，`?due_date=` | 是 |
| POST | `/api/checkins` | 今日打卡 | 是 |
| GET | `/api/stats` | 概览统计（打卡天数 + 任务分布） | 是 |
| POST | `/api/time` | 记录一段专注时长 | 是 |
| GET | `/api/allTime` | 累计专注时长 + 完成番茄数 | 是 |

### 状态码约定

| 码 | 含义 | 用在哪 |
|---|---|---|
| 200 | 成功 | 查询、更新 |
| 201 | 创建成功 | 注册、新建任务 |
| 400 | 参数不合法 | 必填项为空、两次密码不一致等 |
| 401 | 未认证 | 密码错误、token 无效或过期 |
| 404 | 资源不存在 | 任务不存在，**或存在但不属于当前用户** |
| 409 | 冲突 | 用户名已被占用 |
| 500 | 服务器内部错误 | 兜底 |

> `404` 有意不区分「不存在」和「不是你的」，避免被用来试探他人数据的 id。

---

## 实现中的几个关键点

### 1. 用户数据隔离

所有涉及用户数据的 SQL 都带 `user_id = ?`：

- 查询、更新、删除都带 `AND user_id = ?`
- 新建时 `user_id` 一律取自 token（`req.user.id`），**绝不接受前端传入**

`GET /api/tasks`、`GET /api/everyday`、`GET /api/stats` 这类带多个条件的查询，条件分组都显式加括号 —— SQL 中 `AND` 的优先级高于 `OR`，少一层括号就可能让权限条件失效。

### 2. 鉴权中间件

`server/middleware.js` 的 `auth` 负责：解析 `Authorization` 头 → `jwt.verify` 验签与验过期 → 把解出的 payload 挂到 `req.user`。

`router/tasks.js` 和 `router/stats.js` 里用 `router.use(auth)` 统一挂载，**新增接口不会遗漏鉴权**；`router/auths.js` 不能统一挂载（否则登录接口自己也要 token），只在 `/api/me` 上单独挂。

### 3. 过期任务的判定

任务的「已过期」不是定时任务刷出来的，而是在读取任务时顺带处理：

```sql
UPDATE tasks SET status = 2
WHERE status = 0 AND user_id = ? AND due_date IS NOT NULL AND due_date < NOW()
```

抽成 `exprieOverdueTasks()`，在**每个会读任务状态的接口**里都调用一次 —— 否则「任务管理」页和「今日概况」页会对同一条任务给出不同的状态。

用 `NOW()` 而不是前端传时间，保证「现在几点」由服务器决定，客户端改系统时间也无法影响。

### 4. 番茄钟的计时

**不用「每秒把剩余秒数减一」，而是记下「预计结束的绝对时刻」，每次 tick 用当前时间反推剩余：**

```js
endTimeRef.current = Date.now() + leftSeconds * 1000
// 每次 tick
const t = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
```

这样浏览器在后台标签页节流 `setInterval`（乃至漏跑很多次）时，剩余时间的计算结果依然准确 —— 定时器只负责「多久刷新一次显示」，不承担「计时」的职责。

初始时间戳只在「开始」和「继续」两个动作时重算，所以暂停多久都不会影响剩余的专注时间。

### 5. 接口层的错误处理

`first-program/src/api/request.js` 里的响应拦截器统一做三件事：

- `401` → 清空登录态（守卫会自动跳回登录页）；**但放过 `/login` 自身的 401**，否则用户打错密码会被当成「登录过期」
- 把后端返回的 `{ tip }` 翻译成标准 `Error`，页面里 `catch (err) { message.error(err.message) }` 即可
- 区分「服务器答复了但状态码不对」（有 `err.response`）和「请求根本没到服务器」（没有 `err.response`，多为网络故障或后端未启动）

---

## 已知限制

- **番茄钟运行中切换页面会中断计时** —— 计时状态保存在组件内，离开页面即重置
- **关闭浏览器时正在进行的专注不会被记录** —— 记录只在「一轮结束」时提交
- 手机号登录尚未实现
- 修改密码尚未实现
- `tasks.completed_at` 字段已建但暂未使用（保留给后续的「完成时间」统计）

## 生产构建

```bash
cd first-program
npm run build     # 产物在 dist/，是纯静态文件
```

前端构建产物与后端服务彼此独立，部署时把 `dist/` 交给 Nginx 等静态服务器，并把 `/api` 反向代理到 Node 服务即可 —— 前端代码里的请求路径是相对的（`/api/xxx`），不需要改。
